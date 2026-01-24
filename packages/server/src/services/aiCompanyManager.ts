/**
 * AI Company Manager - 管理AI竞争对手公司
 * 负责AI公司的初始化、决策和行动执行
 *
 * 商战系统：AI公司使用 inventoryManager 管理库存，通过 marketOrderBook 提交真实订单
 */

import {
  BUILDINGS_DATA,
  AI_COMPANIES_CONFIG,
  type AICompanyConfig,
  AIPersonality,
  CompanyType,
  getGoodsDefinition,
  getConstructionTime,
  getConstructionMaterials,
  getBuildingDef,
  calculateConstructionCost,
} from '@scc/shared';
import type { BuildingInstance, SupplyDemandData } from './gameLoop.js';
import { llmService, type StrategicPlan } from './llm.js';
import { inventoryManager } from './inventoryManager.js';
import { marketOrderBook } from './marketOrderBook.js';
import { priceDiscoveryService } from './priceDiscovery.js';
import { GOODS_DATA } from '@scc/shared';

/** AI公司状态 */
export interface AICompanyState {
  id: string;
  name: string;
  personality: AIPersonality;
  cash: number;
  buildings: BuildingInstance[];
  color: string;
  icon: string;
  
  // 决策状态
  lastDecisionTick: number;
  decisionInterval: number;
  currentGoal: AIGoal | null;
  
  // LLM战略计划（大决策）
  strategicPlan: StrategicPlan | null;
  lastStrategyTick: number;
  /** 战略刷新周期（tick数），默认100 */
  strategyRefreshInterval: number;
  
  // 与玩家关系
  relationshipWithPlayer: {
    trust: number;      // -100 到 100
    hostility: number;  // 0 到 100
    lastInteraction: number;
    history: AIInteractionRecord[];
  };
  
  // 市场份额追踪
  marketShares: Map<string, number>;
  
  // 最近动作
  recentActions: AIActionRecord[];
}

/** AI目标 */
export interface AIGoal {
  type: 'expand_production' | 'increase_market_share' | 'reduce_costs' | 'attack_competitor' | 'defend_position';
  priority: number;
  targetGoodsId?: string;
  targetCompanyId?: string;
  startTick: number;
  progress: number;
}

/** AI交互记录 */
export interface AIInteractionRecord {
  tick: number;
  type: 'negotiation' | 'price_war' | 'supply_block' | 'cooperation' | 'media_attack';
  description: string;
  outcome: 'positive' | 'negative' | 'neutral';
  trustChange: number;
}

/** AI动作记录 */
export interface AIActionRecord {
  tick: number;
  type: 'purchase_building' | 'switch_method' | 'price_change' | 'media_campaign' | 'stockpile' | 'market_order';
  description: string;
  targetId?: string;
  cost?: number;
}

/** 玩家行为分析结果 */
export interface PlayerBehaviorAnalysis {
  dominantGoods: string[];
  marketShareByGoods: Map<string, number>;
  recentExpansions: string[];
  pricingStrategy: 'aggressive' | 'neutral' | 'passive';
  tradingPattern: 'buyer' | 'seller' | 'balanced';
  threatLevel: number; // 0-1
}

/** 竞争事件 */
export interface CompetitionEvent {
  id: string;
  tick: number;
  type: 'price_war_start' | 'supply_block' | 'market_entry' | 'expansion' | 'media_attack' | 'strategy_change';
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  affectedGoods?: string[];
  severity: 'minor' | 'moderate' | 'major';
  /** LLM生成的战略理由（仅strategy_change类型有） */
  reasoning?: string;
}

/** 游戏上下文（用于AI决策） */
export interface GameContext {
  currentTick: number;
  marketPrices: Map<string, number>;
  supplyDemand: Map<string, SupplyDemandData>;
  playerBuildings: BuildingInstance[];
  playerCash: number;
}

/**
 * AI公司管理器
 */
export class AICompanyManager {
  private companies: Map<string, AICompanyState> = new Map();
  private pendingEvents: CompetitionEvent[] = [];
  private pendingNews: Array<{ companyId: string; headline: string }> = [];
  
  /** 异步事件队列 - 存储LLM完成后生成的事件，在下一个tick发送 */
  private asyncEventQueue: CompetitionEvent[] = [];
  private asyncNewsQueue: Array<{ companyId: string; headline: string }> = [];
  
  /** 性能优化：分批处理AI公司，每tick只处理一部分 */
  private readonly BATCH_SIZE = 10; // 每tick处理10个公司（增加以提高市场活跃度）
  private currentBatchIndex = 0;
  
  /** 性能优化：每公司最大建筑数限制（有聚合因子后可提高） */
  private readonly MAX_BUILDINGS_PER_COMPANY = 30;
  
  /**
   * 初始化AI公司
   * 使用 inventoryManager 管理库存，实现真实的市场参与
   */
  initializeCompanies(currentTick: number = 0): Map<string, AICompanyState> {
    this.companies.clear();
    
    for (const config of AI_COMPANIES_CONFIG) {
      const company = this.createCompanyFromConfig(config);
      this.companies.set(config.id, company);
      
      // 注册到 inventoryManager（真实库存管理）
      inventoryManager.initializeCompany(
        config.id,
        config.name,
        CompanyType.AICompetitor,
        config.initialCash,
        currentTick
      );
      
      // 根据初始建筑给予初始库存
      this.grantInitialInventory(config, company, currentTick);
      
      console.log(`[AIManager] 初始化AI公司: ${config.name}, 资金: ${config.initialCash / 10000}万`);
    }
    
    return this.companies;
  }
  
  /**
   * 给予AI公司初始库存（基于其建筑类型）
   * 注意：库存量需要考虑聚合因子
   */
  private grantInitialInventory(config: AICompanyConfig, company: AICompanyState, currentTick: number): void {
    // 根据建筑类型计算需要的原料和初始成品
    const inputNeeds = new Map<string, number>();
    const outputProducts = new Map<string, number>();
    
    for (const building of company.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) continue;
      
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      if (!method) continue;
      
      // 获取聚合因子
      const aggregatedCount = building.aggregatedCount ?? 1;
      
      // 统计输入需求（30天库存）× 聚合因子
      // 注意：1 tick = 1 day，所以30天 = 30 ticks
      for (const input of method.recipe.inputs) {
        const current = inputNeeds.get(input.goodsId) ?? 0;
        inputNeeds.set(input.goodsId, current + input.amount * 30 * aggregatedCount);
      }
      
      // 统计输出产品（15天库存）× 聚合因子
      for (const output of method.recipe.outputs) {
        const current = outputProducts.get(output.goodsId) ?? 0;
        outputProducts.set(output.goodsId, current + output.amount * 15 * aggregatedCount);
      }
    }
    
    // 给予初始原料库存
    for (const [goodsId, quantity] of inputNeeds) {
      inventoryManager.addGoods(config.id, goodsId, quantity, 0, currentTick, 'initial_stock');
    }
    
    // 给予初始成品库存
    for (const [goodsId, quantity] of outputProducts) {
      inventoryManager.addGoods(config.id, goodsId, quantity, 0, currentTick, 'initial_stock');
    }
  }
  
  /**
   * 计算AI公司的聚合因子
   * 根据公司规模和人格特质决定每个建筑代表多少个实际工厂
   */
  private calculateAggregatedCount(config: AICompanyConfig): number {
    // 基础聚合因子：根据初始资金规模
    // 资金越多的公司，每个建筑代表更多实际工厂
    let baseFactor = 1;
    
    if (config.initialCash >= 500_000_000) {
      baseFactor = 5; // 5亿以上：每个建筑代表5个工厂
    } else if (config.initialCash >= 200_000_000) {
      baseFactor = 4; // 2-5亿：每个建筑代表4个工厂
    } else if (config.initialCash >= 100_000_000) {
      baseFactor = 3; // 1-2亿：每个建筑代表3个工厂
    } else if (config.initialCash >= 50_000_000) {
      baseFactor = 2; // 5000万-1亿：每个建筑代表2个工厂
    }
    
    // 人格修正：垄断者和成本领导者有更大规模
    switch (config.personality) {
      case AIPersonality.Monopolist:
        baseFactor = Math.ceil(baseFactor * 1.5);
        break;
      case AIPersonality.CostLeader:
        baseFactor = Math.ceil(baseFactor * 1.3);
        break;
      case AIPersonality.Innovator:
        // 创新者规模较小但效率高
        baseFactor = Math.max(1, Math.floor(baseFactor * 0.8));
        break;
    }
    
    return Math.max(1, Math.min(10, baseFactor)); // 限制在1-10之间
  }
  
  /**
   * 从配置创建AI公司
   */
  private createCompanyFromConfig(config: AICompanyConfig): AICompanyState {
    const buildings: BuildingInstance[] = [];
    
    // 计算该公司的聚合因子
    const aggregatedCount = this.calculateAggregatedCount(config);
    
    // 为AI公司创建初始建筑
    for (const buildingDefId of config.initialBuildings) {
      const def = BUILDINGS_DATA.find(b => b.id === buildingDefId);
      if (!def) continue;
      
      const defaultSlot = def.productionSlots[0];
      const defaultMethodId = defaultSlot?.defaultMethodId ?? defaultSlot?.methods[0]?.id ?? '';
      
      const building: BuildingInstance = {
        id: `${config.id}-building-${buildings.length}-${Date.now()}`,
        definitionId: buildingDefId,
        name: def.nameZh,
        position: {
          x: 500 + buildings.length * 150,
          y: 100 + Math.random() * 200,
        },
        efficiency: 0.9 + Math.random() * 0.1, // 90-100%效率
        utilization: 0.8 + Math.random() * 0.2, // 80-100%利用率
        status: 'running',
        productionProgress: 0,
        currentMethodId: defaultMethodId,
        aggregatedCount, // 设置聚合因子
      };
      
      buildings.push(building);
    }
    
    console.log(`[AIManager] ${config.name} 聚合因子=${aggregatedCount}, 建筑数=${buildings.length}, 等效工厂数=${buildings.length * aggregatedCount}`);
    
    return {
      id: config.id,
      name: config.name,
      personality: config.personality,
      cash: config.initialCash,
      buildings,
      color: config.color,
      icon: config.icon,
      
      lastDecisionTick: 0,
      decisionInterval: config.decisionInterval,
      currentGoal: null,
      
      // LLM战略计划
      strategicPlan: null,
      lastStrategyTick: -1000, // 初始化为负值，使得第一次决策立即触发
      strategyRefreshInterval: 1000, // 每1000 tick刷新一次战略（约16分钟）以节省API
      
      relationshipWithPlayer: {
        trust: 0,
        hostility: config.aggressiveness * 20, // 初始敌意基于攻击性
        lastInteraction: 0,
        history: [],
      },
      
      marketShares: new Map(),
      recentActions: [],
    };
  }
  
  /**
   * 获取所有AI公司
   */
  getCompanies(): Map<string, AICompanyState> {
    return this.companies;
  }
  
  /**
   * 获取单个AI公司
   */
  getCompany(id: string): AICompanyState | undefined {
    return this.companies.get(id);
  }
  
  /** 性能优化：决策节流，每公司15-35 tick决策一次（进一步提高性能） */
  private decisionThrottles: Map<string, number> = new Map();
  private readonly DECISION_INTERVAL_MIN = 15;  // 从10改为15
  private readonly DECISION_INTERVAL_MAX = 35;  // 从25改为35
  
  /** 性能优化：每tick最多处理多少个AI公司的决策（从3改为2） */
  private readonly MAX_DECISIONS_PER_TICK = 2;
  
  /** 性能优化：市场分析结果缓存 */
  private marketAnalysisCache: {
    tick: number;
    gaps: Array<{ goodsId: string; shortage: number; buildingId: string | null }>;
    playerDependencies: string[];
  } | null = null;
  private readonly CACHE_TTL = 5; // 缓存5 tick
  
  /**
   * 处理AI回合
   * 性能优化：
   * 1. 分批处理AI公司生产和订单
   * 2. AI决策节流 - 每5-15 tick决策一次
   * 3. 已达建筑上限的公司快速跳过
   * 4. 每tick最多处理3个公司的决策
   */
  processTick(context: GameContext): {
    events: CompetitionEvent[];
    news: Array<{ companyId: string; headline: string }>;
  } {
    // 将上一轮异步生成的事件合并进来
    this.pendingEvents = [...this.asyncEventQueue];
    this.pendingNews = [...this.asyncNewsQueue];
    this.asyncEventQueue = [];
    this.asyncNewsQueue = [];
    
    // 为了节省API消耗，每次tick只处理一个AI公司的战略刷新
    let strategyRefreshed = false;
    
    // 获取所有公司的数组用于分批处理
    const companiesArray = Array.from(this.companies.values());
    const totalCompanies = companiesArray.length;
    
    // 计算当前批次应该处理的公司范围（生产和订单）
    const batchStart = this.currentBatchIndex * this.BATCH_SIZE;
    const batchEnd = Math.min(batchStart + this.BATCH_SIZE, totalCompanies);
    
    // 更新批次索引（循环）
    this.currentBatchIndex = (this.currentBatchIndex + 1) % Math.ceil(totalCompanies / this.BATCH_SIZE);
    
    // 【性能优化】统计本tick处理的决策数
    let decisionsThisTick = 0;
    
    for (let i = 0; i < totalCompanies; i++) {
      const company = companiesArray[i];
      if (!company) continue;
      
      // 检查是否需要刷新战略（LLM大决策）- 所有公司都检查
      // 只有在还没有刷新过战略时才检查，以错开各公司的API调用
      const ticksSinceStrategy = context.currentTick - company.lastStrategyTick;
      if (!strategyRefreshed && ticksSinceStrategy >= company.strategyRefreshInterval) {
        console.log(`[AIManager] ${company.name} 触发战略刷新 (tick=${context.currentTick}, 上次=${company.lastStrategyTick}, 间隔=${company.strategyRefreshInterval})`);
        this.refreshStrategicPlan(company, context);
        company.lastStrategyTick = context.currentTick;
        strategyRefreshed = true; // 本tick只刷新一个公司
      }
      
      // 【性能优化】限制每tick处理的决策数量
      if (decisionsThisTick < this.MAX_DECISIONS_PER_TICK) {
        // 检查决策节流
        const lastDecisionTick = this.decisionThrottles.get(company.id) || 0;
        // 计算该公司的决策间隔（基于公司ID哈希，分散决策时机）
        const companyHash = company.id.charCodeAt(company.id.length - 1) || 0;
        const decisionInterval = this.DECISION_INTERVAL_MIN + (companyHash % (this.DECISION_INTERVAL_MAX - this.DECISION_INTERVAL_MIN + 1));
        
        if (context.currentTick - lastDecisionTick >= decisionInterval) {
          // 【性能优化】已达建筑上限的公司使用快速路径
          if (company.buildings.length >= this.MAX_BUILDINGS_PER_COMPANY) {
            this.processCompanyDecisionFast(company, context);
          } else {
            this.processCompanyDecision(company, context);
          }
          this.decisionThrottles.set(company.id, context.currentTick);
          decisionsThisTick++;
        }
      }
      
      // 【性能优化】只有当前批次的公司才处理生产和订单
      if (i >= batchStart && i < batchEnd) {
        // 处理AI建筑生产（使用 inventoryManager 真实消耗/产出）
        this.processCompanyProduction(company, context);
        
        // 处理市场订单（真实参与交易）
        this.processMarketOrders(company, context);
      }
    }
    
    return {
      events: this.pendingEvents,
      news: this.pendingNews,
    };
  }
  
  /**
   * 快速决策处理（已达建筑上限的公司）
   * 只检查是否需要切换生产方法，跳过扩张逻辑
   */
  private processCompanyDecisionFast(company: AICompanyState, context: GameContext): void {
    // 每20 tick才检查一次方法优化
    if (context.currentTick % 20 !== 0) return;
    
    // 查找效率低于70%的建筑，切换生产方法
    for (const building of company.buildings) {
      if (building.efficiency < 0.7 || building.utilization < 0.5) {
        const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
        if (!def) continue;
        
        const slot = def.productionSlots[0];
        if (!slot || slot.methods.length < 2) continue;
        
        // 切换到下一个方法
        const currentIndex = slot.methods.findIndex(m => m.id === building.currentMethodId);
        const nextIndex = (currentIndex + 1) % slot.methods.length;
        const nextMethod = slot.methods[nextIndex];
        if (nextMethod) {
          building.currentMethodId = nextMethod.id;
          // 减少日志输出
        }
        break; // 每次只处理一个建筑
      }
    }
  }
  
  /** 性能优化：订单提交节流 - 记录每个公司上次提交订单的tick */
  private orderThrottles: Map<string, number> = new Map();
  
  /** 性能优化：每tick最多提交的订单数 */
  private readonly MAX_ORDERS_PER_TICK = 20;  // 从10改回20，增加市场流动性
  
  /** 性能优化：订单提交间隔 (ticks) */
  private readonly ORDER_INTERVAL = 10;  // 从25改为10，更频繁地提交订单
  
  /**
   * 处理AI公司的市场订单（买入原料、卖出产品）
   * 性能优化：
   * 1. 降低订单提交频率到每10 tick（从25改为10）
   * 2. 每tick最多提交20个订单（从10改为20）
   * 3. 合并同类商品的订单
   *
   * 重要修复：
   * - 不仅检查running状态建筑的产品，还检查库存中所有可卖的商品
   * - 这确保初始库存和之前生产的商品都能被出售
   */
  private processMarketOrders(company: AICompanyState, context: GameContext): void {
    const config = AI_COMPANIES_CONFIG.find(c => c.id === company.id);
    if (!config) return;
    
    const inventory = inventoryManager.getInventory(company.id);
    if (!inventory) return;
    
    // 【性能优化】检查订单节流 - 降低到每10 tick
    const lastOrderTick = this.orderThrottles.get(company.id) || 0;
    if (context.currentTick - lastOrderTick < this.ORDER_INTERVAL) return;
    
    // 记录本次订单提交tick
    this.orderThrottles.set(company.id, context.currentTick);
    
    // 【性能优化】合并同类商品的需求
    const buyNeeds = new Map<string, number>();  // goodsId -> totalAmount
    const sellNeeds = new Map<string, number>(); // goodsId -> totalAmount
    
    // 分析需要买入的原料和可以卖出的产品（基于running状态的建筑）
    for (const building of company.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def || building.status !== 'running') continue;
      
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      if (!method) continue;
      
      // 获取聚合因子
      const aggregatedCount = building.aggregatedCount ?? 1;
      
      // 统计买入需求（目标库存7天 × 聚合因子）
      for (const input of method.recipe.inputs) {
        const current = buyNeeds.get(input.goodsId) || 0;
        buyNeeds.set(input.goodsId, current + input.amount * 7 * aggregatedCount);
      }
      
      // 统计卖出需求（基于生产能力）
      for (const output of method.recipe.outputs) {
        const current = sellNeeds.get(output.goodsId) || 0;
        const dailyProduction = output.amount * aggregatedCount / method.recipe.ticksRequired;
        sellNeeds.set(output.goodsId, current + dailyProduction * 7); // 7天产量
      }
    }
    
    // 【重要修复】同时检查库存中所有有库存的商品，即使没有running的建筑生产它们
    // 这确保初始库存和之前生产的商品都能被出售
    for (const [goodsId, stock] of Object.entries(inventory.stocks)) {
      const available = stock.quantity - stock.reservedForSale;
      // 如果库存大于50且不在sellNeeds中，添加它
      if (available > 50 && !sellNeeds.has(goodsId)) {
        sellNeeds.set(goodsId, available * 0.5); // 尝试卖出50%
      }
    }
    
    // 【性能优化】限制每次提交的订单数
    let ordersSubmitted = 0;
    
    // 处理买入订单（合并后）
    for (const [goodsId, targetStock] of buyNeeds) {
      if (ordersSubmitted >= this.MAX_ORDERS_PER_TICK) break;
      if (this.processInputPurchaseBatched(company, config, goodsId, targetStock, context)) {
        ordersSubmitted++;
      }
    }
    
    // 处理卖出订单（合并后）
    for (const [goodsId] of sellNeeds) {
      if (ordersSubmitted >= this.MAX_ORDERS_PER_TICK) break;
      if (this.processSellOrderBatched(company, config, goodsId, context)) {
        ordersSubmitted++;
      }
    }
    
    // 调试日志（每100 tick输出一次，仅前3家公司）
    if (context.currentTick % 100 === 0 && company.id.endsWith('-1') || company.id.endsWith('-2') || company.id.endsWith('-3')) {
      const stockCount = Object.keys(inventory.stocks).length;
      const totalQuantity = Object.values(inventory.stocks).reduce((sum, s) => sum + s.quantity, 0);
      if (stockCount > 0 || ordersSubmitted > 0) {
        console.log(`[AIManager-Orders] ${company.name}: 库存${stockCount}种/${totalQuantity.toFixed(0)}件, 提交${ordersSubmitted}单, 买需${buyNeeds.size}种, 卖需${sellNeeds.size}种`);
      }
    }
  }
  
  /**
   * 处理原料采购订单（批量优化版）
   * @returns 是否成功提交了订单
   */
  private processInputPurchaseBatched(
    company: AICompanyState,
    config: AICompanyConfig,
    goodsId: string,
    targetStock: number,
    context: GameContext
  ): boolean {
    const inventory = inventoryManager.getInventory(company.id);
    if (!inventory) return false;
    
    const stock = inventory.stocks[goodsId];
    const currentQuantity = stock?.quantity ?? 0;
    
    // 如果库存低于目标，买入
    if (currentQuantity < targetStock) {
      const needToBuy = targetStock - currentQuantity;
      const buyPrice = this.calculateBuyPrice(company, config, goodsId, context);
      
      // 检查资金是否充足（提高到50%）
      const totalCost = buyPrice * needToBuy;
      if (inventory.cash >= totalCost * 0.5) {
        const buyQuantity = Math.min(needToBuy, inventory.cash / buyPrice * 0.5);
        
        if (buyQuantity > 10) { // 降低阈值增加市场流动性（50→10）
          marketOrderBook.submitBuyOrder(
            company.id,
            goodsId,
            buyQuantity,
            buyPrice,
            context.currentTick,
            20 // 20 tick过期（缩短以减少活跃订单）
          );
          return true;
        }
      }
    }
    return false;
  }
  
  /**
   * 处理产品销售订单（批量优化版）
   * @returns 是否成功提交了订单
   *
   * 修复：
   * - 降低最小可卖数量阈值
   * - 延长订单有效期
   * - 如果没有生产能力，不保留库存
   */
  private processSellOrderBatched(
    company: AICompanyState,
    config: AICompanyConfig,
    goodsId: string,
    context: GameContext
  ): boolean {
    const inventory = inventoryManager.getInventory(company.id);
    if (!inventory) return false;
    
    const stock = inventory.stocks[goodsId];
    if (!stock) return false;
    
    const available = stock.quantity - stock.reservedForSale;
    if (available <= 0) return false;
    
    // 计算日产量（用于确定保留库存）
    const dailyProduction = this.estimateDailyProduction(company, goodsId);
    
    // 计算保留库存：
    // - 如果有生产能力，保留3天库存（从7天减少到3天）
    // - 如果没有生产能力（可能是初始库存），只保留10%
    let reserveStock: number;
    if (dailyProduction > 0) {
      reserveStock = dailyProduction * 3; // 保留3天库存
    } else {
      reserveStock = available * 0.1; // 只保留10%
    }
    
    const sellableQuantity = available - reserveStock;
    
    // 降低最小可卖数量阈值到1（从10降低）
    if (sellableQuantity > 1) {
      const sellPrice = this.calculateSellPrice(company, config, goodsId, context);
      // 每次卖出80%的可卖量（从70%提高）
      const sellQuantity = Math.max(1, sellableQuantity * 0.8);
      
      marketOrderBook.submitSellOrder(
        company.id,
        goodsId,
        sellQuantity,
        sellPrice,
        context.currentTick,
        30 // 延长到30 tick过期（从20提高），给更多成交机会
      );
      inventoryManager.reserveForSale(company.id, goodsId, sellQuantity, context.currentTick);
      return true;
    }
    return false;
  }
  
  /**
   * 计算买入价格（根据人格调整）
   * 修正版：确保买价始终 >= 市价，范围 +0% to +8%，保证能与卖单撮合
   */
  private calculateBuyPrice(
    company: AICompanyState,
    config: AICompanyConfig,
    goodsId: string,
    _context: GameContext
  ): number {
    const marketPrice = priceDiscoveryService.getPrice(goodsId);
    
    // 添加微小随机波动 0~2%（始终正向）
    const randomFactor = 1.0 + Math.random() * 0.02;
    
    // 根据人格调整买入策略（全部在市价之上，确保能成交）
    switch (company.personality) {
      case AIPersonality.Monopolist:
        // 激进：愿意高于市价买入（+3%~+8%）
        return marketPrice * (1.03 + config.aggressiveness * 0.05) * randomFactor;
        
      case AIPersonality.OldMoney:
        // 保守：略高于市价买入（+0%~+3%）
        return marketPrice * (1.0 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.TrendSurfer:
        // 跟风：市价或略高（+1%~+4%）
        return marketPrice * (1.01 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.CostLeader:
        // 成本导向：接近市价（+0%~+2%）
        return marketPrice * (1.0 + Math.random() * 0.02) * randomFactor;
        
      case AIPersonality.Innovator:
      default:
        // 平衡策略：市价或略高（+0%~+3%）
        return marketPrice * (1.0 + Math.random() * 0.03) * randomFactor;
    }
  }
  
  /**
   * 计算卖出价格（根据人格调整）
   * 修正版：确保卖价始终 <= 市价，范围 -5% to +2%，保证能与买单撮合
   */
  private calculateSellPrice(
    company: AICompanyState,
    config: AICompanyConfig,
    goodsId: string,
    context: GameContext
  ): number {
    const marketPrice = priceDiscoveryService.getPrice(goodsId);
    
    // 检查玩家威胁
    const playerThreat = this.analyzePlayerThreat(company, goodsId, context);
    
    // 添加微小随机波动 -1%~0%（始终负向或零）
    const randomFactor = 0.99 + Math.random() * 0.01;
    
    // 根据人格调整卖出策略（大部分在市价之下，确保能成交）
    switch (company.personality) {
      case AIPersonality.Monopolist:
        // 激进：如果有玩家威胁则降价打压（-5%~-2%），否则接近市价（-2%~+1%）
        if (playerThreat > 0.5) {
          return marketPrice * (0.95 + Math.random() * 0.03) * randomFactor; // 价格战
        }
        return marketPrice * (0.98 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.OldMoney:
        // 保守：接近市价（-1%~+2%）
        return marketPrice * (0.99 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.TrendSurfer:
        // 跟风：略低于市价（-3%~0%）
        return marketPrice * (0.97 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.CostLeader:
        // 低价策略：低于市价（-5%~-2%）
        return marketPrice * (0.95 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.Innovator:
      default:
        // 平衡策略：接近市价（-2%~+1%）
        return marketPrice * (0.98 + Math.random() * 0.03) * randomFactor;
    }
  }
  
  /**
   * 分析玩家在特定商品上的威胁程度
   */
  private analyzePlayerThreat(company: AICompanyState, goodsId: string, context: GameContext): number {
    // 检查玩家是否有生产该商品的建筑
    let playerProduces = false;
    for (const building of context.playerBuildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) continue;
      
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      if (method) {
        for (const output of method.recipe.outputs) {
          if (output.goodsId === goodsId) {
            playerProduces = true;
            break;
          }
        }
      }
    }
    
    if (!playerProduces) return 0;
    
    // 玩家建筑数量越多威胁越大
    const playerBuildingCount = context.playerBuildings.length;
    const companyBuildingCount = company.buildings.length;
    
    return Math.min(1, playerBuildingCount / (companyBuildingCount + 1) * 0.5);
  }
  
  /**
   * 估算某商品的日产量（包含聚合因子）
   */
  private estimateDailyProduction(company: AICompanyState, goodsId: string): number {
    let dailyOutput = 0;
    
    for (const building of company.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def || building.status !== 'running') continue;
      
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      if (!method) continue;
      
      // 获取聚合因子
      const aggregatedCount = building.aggregatedCount ?? 1;
      
      for (const output of method.recipe.outputs) {
        if (output.goodsId === goodsId) {
          // 每tick产出 * 效率 * 聚合因子
          // 注意：1 tick = 1 day，所以每天周期数 = 1 / ticksPerCycle
          const ticksPerCycle = method.recipe.ticksRequired;
          const cyclesPerDay = 1 / ticksPerCycle;
          dailyOutput += output.amount * cyclesPerDay * building.efficiency * aggregatedCount;
        }
      }
    }
    
    return dailyOutput;
  }
  
  /**
   * 刷新战略计划（调用LLM）
   */
  private async refreshStrategicPlan(company: AICompanyState, context: GameContext): Promise<void> {
    console.log(`[AIManager] 开始为 ${company.name} 生成战略计划...`);
    
    const config = AI_COMPANIES_CONFIG.find((c: AICompanyConfig) => c.id === company.id);
    if (!config) {
      console.log(`[AIManager] 未找到 ${company.name} 的配置，跳过`);
      return;
    }
    
    // 收集市场数据
    const marketPrices: Record<string, number> = {};
    const priceChanges: Record<string, number> = {};
    
    for (const [goodsId, price] of context.marketPrices) {
      marketPrices[goodsId] = price;
      // 简单计算价格变化（与基准价格比较）
      const basePrice = 1000; // 简化处理
      priceChanges[goodsId] = ((price - basePrice) / basePrice) * 100;
    }
    
    // 分析公司当前涉足的行业
    const ownedIndustries = new Set<string>();
    for (const building of company.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (def?.category) {
        ownedIndustries.add(def.category);
      }
    }
    
    // 分析玩家涉足的行业
    const playerIndustries = new Set<string>();
    for (const building of context.playerBuildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (def?.category) {
        playerIndustries.add(def.category);
      }
    }
    
    console.log(`[AIManager] ${company.name} 准备调用LLM, 现金=${company.cash}, 建筑数=${company.buildings.length}`);
    
    try {
      const oldPlan = company.strategicPlan;
      
      const newPlan = await llmService.generateStrategicPlan({
        companyId: company.id,
        companyName: company.name,
        personality: config.llmPrompt,
        currentCash: company.cash,
        buildingCount: company.buildings.length,
        ownedIndustries: Array.from(ownedIndustries),
        marketPrices,
        priceChanges,
        playerIndustries: Array.from(playerIndustries),
        playerBuildingCount: context.playerBuildings.length,
        relationshipWithPlayer: {
          trust: company.relationshipWithPlayer.trust,
          hostility: company.relationshipWithPlayer.hostility,
        },
      });
      
      company.strategicPlan = newPlan;
      
      // 生成战略刷新事件（每次LLM调用都记录）- 放入异步队列
      this.asyncEventQueue.push({
        id: `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tick: context.currentTick,
        type: 'strategy_change',
        companyId: company.id,
        companyName: company.name,
        title: `${company.name}战略规划`,
        description: `${newPlan.priorityIndustry}领域 | ${newPlan.marketStance === 'aggressive' ? '激进' : newPlan.marketStance === 'defensive' ? '防守' : '中立'}立场`,
        severity: newPlan.marketStance === 'aggressive' ? 'major' : newPlan.marketStance === 'defensive' ? 'minor' : 'moderate',
        reasoning: newPlan.reasoning,
      });
      
      console.log(`[AIManager] 添加战略事件到队列: ${company.name}, 队列长度=${this.asyncEventQueue.length}`);
      
      // 如果战略发生重大变化，额外生成新闻
      if (oldPlan && this.hasStrategyChanged(oldPlan, newPlan)) {
        this.asyncNewsQueue.push({
          companyId: company.id,
          headline: `${company.name}战略调整：${newPlan.reasoning}`,
        });
      }
      
      console.log(`[AIManager] ${company.name} 战略刷新: ${newPlan.priorityIndustry} (${newPlan.marketStance})`);
    } catch (error) {
      console.error(`[AIManager] ${company.name} 战略刷新失败:`, error);
    }
  }
  
  /**
   * 检查战略是否发生重大变化
   */
  private hasStrategyChanged(oldPlan: StrategicPlan, newPlan: StrategicPlan): boolean {
    return oldPlan.priorityIndustry !== newPlan.priorityIndustry ||
           oldPlan.marketStance !== newPlan.marketStance ||
           oldPlan.targetPlayer !== newPlan.targetPlayer;
  }
  
  /**
   * 处理AI公司决策
   */
  private processCompanyDecision(company: AICompanyState, context: GameContext): void {
    const config = AI_COMPANIES_CONFIG.find((c: AICompanyConfig) => c.id === company.id);
    if (!config) {
      console.log(`[AIManager] ${company.name} 未找到配置，跳过决策`);
      return;
    }
    
    // 评估当前目标
    this.evaluateGoal(company, context);
    
    console.log(`[AIManager] ${company.name} 决策中: 目标=${company.currentGoal?.type}, 现金=${Math.floor(company.cash)}, 预算=${Math.floor(company.cash * config.riskTolerance)}`);
    
    // 根据人格和目标选择动作
    const action = this.selectAction(company, context, config);
    
    if (action) {
      console.log(`[AIManager] ${company.name} 选择动作: ${action.type} - ${action.description}`);
      this.executeAction(company, action, context);
    } else {
      console.log(`[AIManager] ${company.name} 无可执行动作`);
    }
  }
  
  /**
   * 评估和更新目标
   */
  private evaluateGoal(company: AICompanyState, context: GameContext): void {
    // 如果没有目标或目标已完成，选择新目标
    if (!company.currentGoal || company.currentGoal.progress >= 1) {
      company.currentGoal = this.selectNewGoal(company, context);
    }
  }
  
  /**
   * 选择新目标（基于LLM战略计划）
   */
  private selectNewGoal(company: AICompanyState, context: GameContext): AIGoal {
    const plan = company.strategicPlan;
    
    // 如果有LLM战略计划，基于战略选择目标
    if (plan) {
      return this.selectGoalFromStrategy(company, plan, context);
    }
    
    // 回退：根据人格特质选择目标
    return this.selectGoalFromPersonality(company, context);
  }
  
  /**
   * 基于LLM战略选择目标
   */
  private selectGoalFromStrategy(
    _company: AICompanyState,
    plan: StrategicPlan,
    context: GameContext
  ): AIGoal {
    // 根据市场立场决定目标类型
    switch (plan.marketStance) {
      case 'aggressive':
        // 激进立场：扩张或攻击
        if (plan.targetPlayer && plan.riskLevel > 0.6) {
          return {
            type: 'attack_competitor',
            priority: 10,
            targetCompanyId: 'player',
            targetGoodsId: plan.priorityIndustry,
            startTick: context.currentTick,
            progress: 0,
          };
        }
        return {
          type: 'increase_market_share',
          priority: 9,
          targetGoodsId: plan.priorityIndustry,
          startTick: context.currentTick,
          progress: 0,
        };
        
      case 'defensive':
        // 防守立场
        if (plan.investmentFocus === 'reduce_cost') {
          return {
            type: 'reduce_costs',
            priority: 8,
            startTick: context.currentTick,
            progress: 0,
          };
        }
        return {
          type: 'defend_position',
          priority: 7,
          startTick: context.currentTick,
          progress: 0,
        };
        
      case 'neutral':
      default:
        // 中立立场：稳步扩张
        return {
          type: 'expand_production',
          priority: 6,
          targetGoodsId: plan.priorityIndustry,
          startTick: context.currentTick,
          progress: 0,
        };
    }
  }
  
  /**
   * 基于人格选择目标（LLM失败时的回退）
   */
  private selectGoalFromPersonality(company: AICompanyState, context: GameContext): AIGoal {
    switch (company.personality) {
      case AIPersonality.Monopolist:
        if (Math.random() < 0.6) {
          return {
            type: 'increase_market_share',
            priority: 10,
            startTick: context.currentTick,
            progress: 0,
          };
        } else {
          return {
            type: 'attack_competitor',
            priority: 8,
            targetCompanyId: 'player',
            startTick: context.currentTick,
            progress: 0,
          };
        }
        
      case AIPersonality.Innovator:
        return {
          type: 'expand_production',
          priority: 9,
          startTick: context.currentTick,
          progress: 0,
        };
        
      case AIPersonality.OldMoney:
        return {
          type: 'defend_position',
          priority: 8,
          startTick: context.currentTick,
          progress: 0,
        };
        
      default:
        return {
          type: 'expand_production',
          priority: 5,
          startTick: context.currentTick,
          progress: 0,
        };
    }
  }
  
  /**
   * 选择动作
   */
  private selectAction(
    company: AICompanyState,
    context: GameContext,
    config: AICompanyConfig
  ): AIActionRecord | null {
    const goal = company.currentGoal;
    if (!goal) return null;
    
    // 计算可用预算
    const availableBudget = company.cash * config.riskTolerance;
    
    let action: AIActionRecord | null = null;
    
    switch (goal.type) {
      case 'expand_production':
        action = this.selectExpansionAction(company, context, availableBudget);
        break;
        
      case 'increase_market_share':
        action = this.selectMarketShareAction(company, context, availableBudget);
        break;
        
      case 'attack_competitor':
        // 攻击优先，如果无法攻击则回退到扩张
        action = this.selectAttackAction(company, context, config, availableBudget);
        if (!action) {
          action = this.selectExpansionAction(company, context, availableBudget);
        }
        break;
        
      case 'defend_position':
        action = this.selectDefenseAction(company, context);
        // 如果防守无动作，也可以考虑扩张
        if (!action) {
          action = this.selectExpansionAction(company, context, availableBudget * 0.5);
        }
        break;
        
      case 'reduce_costs':
        action = this.selectDefenseAction(company, context);
        break;
        
      default:
        action = this.selectExpansionAction(company, context, availableBudget);
    }
    
    return action;
  }
  
  /**
   * 分析市场缺口 - 找出供应不足的商品及对应工厂（带缓存）
   */
  private analyzeMarketGaps(context: GameContext): Array<{
    goodsId: string;
    shortage: number;  // 缺口比例 (需求-供应)/需求
    buildingId: string | null;
  }> {
    // 检查缓存有效性
    if (this.marketAnalysisCache &&
        context.currentTick - this.marketAnalysisCache.tick < this.CACHE_TTL) {
      return this.marketAnalysisCache.gaps;
    }
    
    const gaps: Array<{
      goodsId: string;
      shortage: number;
      buildingId: string | null;
    }> = [];
    
    // 遍历所有商品，分析供需缺口
    for (const [goodsId, data] of context.supplyDemand) {
      const shortage = data.demand > 0
        ? (data.demand - data.supply) / data.demand
        : 0;
      
      if (shortage > 0.1) { // 缺口超过10%才考虑
        // 找出能生产该商品的建筑
        const producingBuilding = BUILDINGS_DATA.find(b => {
          const slot = b.productionSlots[0];
          if (!slot) return false;
          return slot.methods.some(m =>
            m.recipe.outputs.some(o => o.goodsId === goodsId)
          );
        });
        
        gaps.push({
          goodsId,
          shortage,
          buildingId: producingBuilding?.id ?? null,
        });
      }
    }
    
    // 按缺口大小排序
    gaps.sort((a, b) => b.shortage - a.shortage);
    
    // 更新缓存
    if (!this.marketAnalysisCache) {
      this.marketAnalysisCache = { tick: context.currentTick, gaps, playerDependencies: [] };
    } else {
      this.marketAnalysisCache.tick = context.currentTick;
      this.marketAnalysisCache.gaps = gaps;
    }
    
    return gaps;
  }
  
  /**
   * 选择扩张动作（优化版：优先填补市场缺口）
   * 性能优化：限制每公司最大建筑数，防止建筑雪崩效应
   */
  private selectExpansionAction(
    company: AICompanyState,
    context: GameContext,
    budget: number
  ): AIActionRecord | null {
    // 【性能优化】检查建筑数量上限
    if (company.buildings.length >= this.MAX_BUILDINGS_PER_COMPANY) {
      console.log(`[AIManager] ${company.name} 已达建筑上限(${this.MAX_BUILDINGS_PER_COMPANY})，跳过扩张`);
      return null;
    }
    
    // 【优化1】提高最低预算阈值，确保AI有足够资金扩张
    // 如果原始预算太低但公司现金充足，使用更高的预算
    const config = AI_COMPANIES_CONFIG.find(c => c.id === company.id);
    let effectiveBudget = budget;
    
    if (config) {
      // 最低使用30%的现金，或者原预算，取较大值
      const minBudget = company.cash * 0.3;
      effectiveBudget = Math.max(budget, minBudget);
      
      // 对于激进型公司，进一步提高预算
      if (company.personality === AIPersonality.Monopolist) {
        effectiveBudget = Math.max(effectiveBudget, company.cash * 0.5);
      }
    }
    
    // 查找适合购买的建筑（使用动态成本计算）
    // 获取当前市场价格用于计算成本
    const marketPrices: Record<string, number> = {};
    for (const [goodsId, price] of context.marketPrices) {
      marketPrices[goodsId] = price;
    }
    
    // 计算每个建筑的真实成本并筛选
    const buildingsWithCosts = BUILDINGS_DATA.map(b => {
      const buildingDef = getBuildingDef(b.id);
      if (!buildingDef) return { building: b, realCost: b.baseCost };
      
      const costResult = calculateConstructionCost(buildingDef, marketPrices);
      return { building: b, realCost: costResult.totalCost };
    });
    
    const affordableBuildings = buildingsWithCosts
      .filter(item => item.realCost <= effectiveBudget)
      .map(item => ({ ...item.building, _realCost: item.realCost }));
    
    if (affordableBuildings.length === 0) {
      console.log(`[AIManager] ${company.name} 预算${Math.floor(effectiveBudget)}不足，无可购买建筑`);
      return null;
    }
    
    // 【优化2】分析市场缺口，优先建设供应不足的工厂
    const marketGaps = this.analyzeMarketGaps(context);
    
    for (const gap of marketGaps) {
      if (gap.buildingId) {
        const building = affordableBuildings.find(b => b.id === gap.buildingId) as (typeof affordableBuildings[number] & { _realCost?: number }) | undefined;
        if (building) {
          const realCost = building._realCost ?? building.baseCost;
          console.log(`[AIManager] ${company.name} 发现市场缺口: ${gap.goodsId} 缺口${(gap.shortage * 100).toFixed(1)}%，建设 ${building.nameZh}，成本 ${(realCost / 10000).toFixed(0)}万`);
          return {
            tick: context.currentTick,
            type: 'purchase_building',
            description: `填补市场缺口：购买${building.nameZh}（${gap.goodsId}供应不足）`,
            targetId: building.id,
            cost: realCost,
          };
        }
      }
    }
    
    const plan = company.strategicPlan;
    
    // 如果有战略计划，优先选择战略行业的建筑
    if (plan) {
      const strategicBuildings = affordableBuildings.filter(b =>
        b.category === plan.priorityIndustry ||
        b.category === plan.secondaryIndustry
      );
      
      if (strategicBuildings.length > 0) {
        const selected = strategicBuildings[Math.floor(Math.random() * strategicBuildings.length)] as (typeof strategicBuildings[number] & { _realCost?: number }) | undefined;
        if (selected) {
          const realCost = selected._realCost ?? selected.baseCost;
          return {
            tick: context.currentTick,
            type: 'purchase_building',
            description: `战略布局：购买${selected.nameZh}`,
            targetId: selected.id,
            cost: realCost,
          };
        }
      }
    }
    
    // 【优化3】如果公司没有建筑，优先建设其专长领域的工厂
    if (company.buildings.length === 0 && config) {
      // 根据公司配置的初始建筑类型找对应建筑
      for (const initBuildingId of config.initialBuildings) {
        const building = affordableBuildings.find(b => b.id === initBuildingId) as (typeof affordableBuildings[number] & { _realCost?: number }) | undefined;
        if (building) {
          const realCost = building._realCost ?? building.baseCost;
          return {
            tick: context.currentTick,
            type: 'purchase_building',
            description: `重建核心业务：购买${building.nameZh}`,
            targetId: building.id,
            cost: realCost,
          };
        }
      }
    }
    
    // 回退：按照当前生产链选择互补的建筑
    const existingCategories = new Set(
      company.buildings.map(b => {
        const def = BUILDINGS_DATA.find(d => d.id === b.definitionId);
        return def?.category;
      })
    );
    
    // 优先选择相关类别的建筑
    let candidates = affordableBuildings.filter(b =>
      existingCategories.has(b.category) || b.category === 'processing'
    );
    
    if (candidates.length === 0) {
      candidates = affordableBuildings;
    }
    
    // 【优化4】优先选择成本效益高的建筑（产出/成本比）
    const scoredCandidates = candidates.map(b => {
      const slot = b.productionSlots[0];
      const method = slot?.methods[0];
      let outputValue = 0;
      
      if (method) {
        for (const output of method.recipe.outputs) {
          const goodsDef = GOODS_DATA.find(g => g.id === output.goodsId);
          outputValue += (goodsDef?.basePrice ?? 1000) * output.amount;
        }
      }
      
      return {
        building: b,
        score: outputValue / (b.baseCost / 1000000), // 每百万成本的产出价值
      };
    });
    
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    // 选择得分最高的建筑（有20%随机性避免所有AI都选同一个）
    const topCount = Math.max(1, Math.floor(scoredCandidates.length * 0.3));
    const topCandidates = scoredCandidates.slice(0, topCount);
    const selectedItem = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    
    if (!selectedItem) return null;
    
    const selected = selectedItem.building as typeof selectedItem.building & { _realCost?: number };
    const realCost = selected._realCost ?? selected.baseCost;
    
    return {
      tick: context.currentTick,
      type: 'purchase_building',
      description: `购买${selected.nameZh}`,
      targetId: selected.id,
      cost: realCost,
    };
  }
  
  /**
   * 选择市场份额动作
   */
  private selectMarketShareAction(
    company: AICompanyState,
    context: GameContext,
    budget: number
  ): AIActionRecord | null {
    // 优先扩张产能
    const expansionAction = this.selectExpansionAction(company, context, budget);
    if (expansionAction) return expansionAction;
    
    // 或者发起媒体攻势
    if (budget > 10_000_000) {
      return {
        tick: context.currentTick,
        type: 'media_campaign',
        description: '发起市场营销活动',
        cost: 10_000_000,
      };
    }
    
    return null;
  }
  
  /**
   * 选择攻击动作
   */
  private selectAttackAction(
    company: AICompanyState,
    context: GameContext,
    config: AICompanyConfig,
    budget: number
  ): AIActionRecord | null {
    // 只有高攻击性的公司才会主动攻击（概率检查）
    if (Math.random() > config.aggressiveness) return null;
    
    // 分析玩家的依赖
    const playerDependencies = this.analyzePlayerDependencies(context);
    
    const targetGoods = playerDependencies[0];
    if (targetGoods && company.cash > 50_000_000) {
      // 尝试囤积玩家依赖的原料
      return {
        tick: context.currentTick,
        type: 'stockpile',
        description: `囤积${targetGoods}以控制供应`,
        targetId: targetGoods,
        cost: 50_000_000,
      };
    }
    
    // 如果无法囤积，尝试在玩家相关行业扩张以压制
    if (context.playerBuildings.length > 0) {
      // 玩家有建筑，在相关领域扩张
      return this.selectExpansionAction(company, context, budget);
    }
    
    // 玩家没有建筑，在战略行业扩张
    return null; // 让上层回退到扩张
  }
  
  /**
   * 选择防守动作
   */
  private selectDefenseAction(
    company: AICompanyState,
    context: GameContext
  ): AIActionRecord | null {
    // 保守策略：优化生产效率
    const building = company.buildings[0];
    if (building) {
      return {
        tick: context.currentTick,
        type: 'switch_method',
        description: `优化${building.name}的生产方式`,
        targetId: building.id,
      };
    }
    
    return null;
  }
  
  /**
   * 分析玩家依赖（带缓存）
   */
  private analyzePlayerDependencies(context: GameContext): string[] {
    // 检查缓存有效性
    if (this.marketAnalysisCache &&
        context.currentTick - this.marketAnalysisCache.tick < this.CACHE_TTL &&
        this.marketAnalysisCache.playerDependencies.length > 0) {
      return this.marketAnalysisCache.playerDependencies;
    }
    
    const dependencies: Map<string, number> = new Map();
    
    for (const building of context.playerBuildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) continue;
      
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      
      if (method) {
        for (const input of method.recipe.inputs) {
          const current = dependencies.get(input.goodsId) ?? 0;
          dependencies.set(input.goodsId, current + input.amount);
        }
      }
    }
    
    // 按依赖量排序
    const result = Array.from(dependencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([goodsId]) => goodsId);
    
    // 更新缓存
    if (this.marketAnalysisCache) {
      this.marketAnalysisCache.playerDependencies = result;
    }
    
    return result;
  }
  
  /**
   * 执行动作
   */
  private executeAction(
    company: AICompanyState,
    action: AIActionRecord,
    context: GameContext
  ): void {
    switch (action.type) {
      case 'purchase_building':
        this.executePurchaseBuilding(company, action, context);
        break;
        
      case 'switch_method':
        this.executeSwitchMethod(company, action);
        break;
        
      case 'media_campaign':
        this.executeMediaCampaign(company, action, context);
        break;
        
      case 'stockpile':
        this.executeStockpile(company, action, context);
        break;
    }
    
    // 记录动作
    company.recentActions.push(action);
    if (company.recentActions.length > 20) {
      company.recentActions = company.recentActions.slice(-20);
    }
    
    // 更新目标进度
    if (company.currentGoal) {
      company.currentGoal.progress += 0.2;
    }
  }
  
  /**
   * 执行购买建筑（支持建造系统）
   * AI公司购买建筑时：
   * 1. 检查并消耗建筑材料
   * 2. 设置建筑为 under_construction 状态
   * 3. 建造完成后才能生产
   */
  private executePurchaseBuilding(
    company: AICompanyState,
    action: AIActionRecord,
    context: GameContext
  ): void {
    if (!action.targetId || !action.cost) return;
    if (company.cash < action.cost) return;
    
    const def = BUILDINGS_DATA.find(b => b.id === action.targetId);
    if (!def) return;
    
    // 获取建筑定义（用于建造系统）
    const buildingDef = getBuildingDef(action.targetId);
    if (!buildingDef) return;
    
    // 获取建造材料需求
    const constructionMaterials = getConstructionMaterials(buildingDef);
    const constructionTime = getConstructionTime(buildingDef);
    
    // 检查是否有足够的建筑材料
    const inventory = inventoryManager.getInventory(company.id);
    if (!inventory) return;
    
    // AI公司对材料要求更宽松 - 只需要50%的材料即可开始建造
    // 这模拟AI公司有更多渠道获取材料
    const materialMultiplier = 0.5;
    let hasAllMaterials = true;
    const missingMaterials: string[] = [];
    
    for (const material of constructionMaterials) {
      const stock = inventory.stocks[material.goodsId];
      const available = stock ? stock.quantity - stock.reservedForSale - stock.reservedForProduction : 0;
      const requiredAmount = Math.ceil(material.amount * materialMultiplier);
      
      if (available < requiredAmount) {
        hasAllMaterials = false;
        missingMaterials.push(material.goodsId);
      }
    }
    
    // 如果缺少材料，尝试在市场上采购
    if (!hasAllMaterials) {
      console.log(`[AIManager] ${company.name} 缺少建筑材料 [${missingMaterials.join(', ')}]，尝试市场采购`);
      
      // 为缺少的材料下单采购
      for (const goodsId of missingMaterials) {
        const material = constructionMaterials.find(m => m.goodsId === goodsId);
        if (!material) continue;
        
        const requiredAmount = Math.ceil(material.amount * materialMultiplier);
        const marketPrice = priceDiscoveryService.getPrice(goodsId);
        const buyPrice = marketPrice * 1.05; // 愿意高于市价5%采购
        
        // 检查资金是否足够
        if (company.cash >= buyPrice * requiredAmount) {
          marketOrderBook.submitBuyOrder(
            company.id,
            goodsId,
            requiredAmount,
            buyPrice,
            context.currentTick,
            50 // 50 tick过期
          );
        }
      }
      
      // 材料不足时，AI公司仍然可以开始建造（模拟分期供货）
      // 但建造时间会延长
    }
    
    // 扣除建筑成本
    company.cash -= action.cost;
    
    // 消耗可用的建筑材料
    for (const material of constructionMaterials) {
      const requiredAmount = Math.ceil(material.amount * materialMultiplier);
      const stock = inventory.stocks[material.goodsId];
      const available = stock ? stock.quantity - stock.reservedForSale - stock.reservedForProduction : 0;
      const consumeAmount = Math.min(available, requiredAmount);
      
      if (consumeAmount > 0) {
        inventoryManager.consumeGoods(company.id, material.goodsId, consumeAmount, context.currentTick, 'construction');
      }
    }
    
    const defaultSlot = def.productionSlots[0];
    const defaultMethodId = defaultSlot?.defaultMethodId ?? defaultSlot?.methods[0]?.id ?? '';
    
    // 获取公司现有建筑的聚合因子（保持一致）
    const existingAggregatedCount = company.buildings[0]?.aggregatedCount ?? 1;
    
    // 计算实际建造时间（如果材料不足，时间延长50%）
    const actualConstructionTime = hasAllMaterials ? constructionTime : Math.ceil(constructionTime * 1.5);
    
    const newBuilding: BuildingInstance = {
      id: `${company.id}-building-${company.buildings.length}-${Date.now()}`,
      definitionId: action.targetId,
      name: def.nameZh,
      position: {
        x: 500 + company.buildings.length * 150,
        y: 100 + Math.random() * 200,
      },
      efficiency: 0.9 + Math.random() * 0.1,
      utilization: 0.8 + Math.random() * 0.2,
      status: 'under_construction', // 建造中状态
      productionProgress: 0,
      currentMethodId: defaultMethodId,
      aggregatedCount: existingAggregatedCount,
      constructionProgress: 0,
      constructionTimeRequired: actualConstructionTime,
    };
    
    company.buildings.push(newBuilding);
    
    // 生成新闻
    // 注意：1 tick = 1 day，actualConstructionTime 已经是天数
    this.pendingNews.push({
      companyId: company.id,
      headline: `${company.name}动工新建${def.nameZh}，预计${actualConstructionTime}天完工`,
    });
    
    // 生成竞争事件
    this.pendingEvents.push({
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tick: context.currentTick,
      type: 'expansion',
      companyId: company.id,
      companyName: company.name,
      title: `${company.name}开工建设`,
      description: `${company.name}投资新建${def.nameZh}，工程预计${actualConstructionTime}天完成。`,
      severity: 'moderate',
    });
    
    console.log(`[AIManager] ${company.name} 开始建造 ${def.nameZh}，需要${actualConstructionTime}天`);
  }
  
  /**
   * 执行切换生产方式
   */
  private executeSwitchMethod(company: AICompanyState, action: AIActionRecord): void {
    if (!action.targetId) return;
    
    const building = company.buildings.find(b => b.id === action.targetId);
    if (!building) return;
    
    const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
    if (!def) return;
    
    const slot = def.productionSlots[0];
    if (!slot || slot.methods.length < 2) return;
    
    // 切换到下一个方法
    const currentIndex = slot.methods.findIndex(m => m.id === building.currentMethodId);
    const nextIndex = (currentIndex + 1) % slot.methods.length;
    const nextMethod = slot.methods[nextIndex];
    if (nextMethod) {
      building.currentMethodId = nextMethod.id;
    }
    
    console.log(`[AIManager] ${company.name} 切换了 ${building.name} 的生产方式`);
  }
  
  /**
   * 执行媒体攻势
   */
  private executeMediaCampaign(
    company: AICompanyState,
    action: AIActionRecord,
    _context: GameContext
  ): void {
    if (!action.cost || company.cash < action.cost) return;
    
    company.cash -= action.cost;
    
    // 生成新闻
    this.pendingNews.push({
      companyId: company.id,
      headline: `${company.name}发起大规模市场推广活动`,
    });
    
    console.log(`[AIManager] ${company.name} 发起媒体攻势`);
  }
  
  /**
   * 执行囤积
   */
  private executeStockpile(
    company: AICompanyState,
    action: AIActionRecord,
    context: GameContext
  ): void {
    if (!action.targetId || !action.cost || company.cash < action.cost) return;
    
    company.cash -= action.cost;
    
    // 生成竞争事件
    this.pendingEvents.push({
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tick: context.currentTick,
      type: 'supply_block',
      companyId: company.id,
      companyName: company.name,
      title: `${company.name}大量囤积原材料`,
      description: `${company.name}正在市场上大量采购原材料，可能导致供应紧张。`,
      affectedGoods: [action.targetId],
      severity: 'major',
    });
    
    // 生成新闻
    this.pendingNews.push({
      companyId: company.id,
      headline: `警告：${company.name}疑似囤积原材料，市场供应可能紧张`,
    });
    
    console.log(`[AIManager] ${company.name} 囤积 ${action.targetId}`);
  }
  
  /**
   * 处理AI公司生产（使用真实库存系统，支持建造系统）
   * 产量和消耗都会乘以聚合因子
   */
  private processCompanyProduction(company: AICompanyState, context: GameContext): void {
    // 1 tick = 1 day, 1 month = 30 days = 30 ticks
    const TICKS_PER_MONTH = 30;
    const inventory = inventoryManager.getInventory(company.id);
    if (!inventory) return;
    
    for (const building of company.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) continue;
      
      // 处理建造中的建筑
      if (building.status === 'under_construction') {
        // 获取建造所需时间
        const constructionTimeRequired = building.constructionTimeRequired ??
          (getBuildingDef(building.definitionId) ? getConstructionTime(getBuildingDef(building.definitionId)!) : 72);
        
        // 推进建造进度
        building.constructionProgress = (building.constructionProgress ?? 0) + 1;
        
        // 检查是否建造完成
        if (building.constructionProgress >= constructionTimeRequired) {
          building.status = 'running';
          // 使用 delete 操作符清理建造相关属性
          delete building.constructionProgress;
          delete building.constructionTimeRequired;
          
          console.log(`[AIManager] ${company.name} 的 ${building.name} 建造完成，开始运营`);
          
          // 生成建造完成新闻
          this.pendingNews.push({
            companyId: company.id,
            headline: `${company.name}的${building.name}竣工投产`,
          });
        }
        
        continue; // 建造中的建筑不生产
      }
      
      // 只有 running 状态的建筑才能生产
      if (building.status !== 'running') continue;
      
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      if (!method) continue;
      
      // 获取聚合因子
      const aggregatedCount = building.aggregatedCount ?? 1;
      
      // 扣除维护成本 × 聚合因子
      const maintenanceCost = (def.maintenanceCost / TICKS_PER_MONTH) * aggregatedCount;
      inventoryManager.deductCash(company.id, maintenanceCost, context.currentTick, 'maintenance');
      
      // 检查是否有足够原料（需求量 × 聚合因子）
      let canProduce = true;
      for (const input of method.recipe.inputs) {
        const stock = inventory.stocks[input.goodsId];
        const available = stock ? stock.quantity - stock.reservedForProduction - stock.reservedForSale : 0;
        const requiredAmount = input.amount * aggregatedCount;
        if (available < requiredAmount) {
          canProduce = false;
          break;
        }
      }
      
      if (!canProduce) {
        // 缺少原料，降低效率
        building.utilization = Math.max(0.1, building.utilization * 0.95);
        continue;
      }
      
      // 推进生产进度
      building.productionProgress += building.efficiency * building.utilization;
      
      // 完成生产周期
      if (building.productionProgress >= method.recipe.ticksRequired) {
        building.productionProgress -= method.recipe.ticksRequired;
        
        // 消耗原料 × 聚合因子
        for (const input of method.recipe.inputs) {
          inventoryManager.consumeGoods(company.id, input.goodsId, input.amount * aggregatedCount, context.currentTick, 'production');
        }
        
        // 产出成品 × 聚合因子
        for (const output of method.recipe.outputs) {
          const price = context.marketPrices.get(output.goodsId) ?? getGoodsDefinition(output.goodsId)?.basePrice ?? 1000;
          inventoryManager.addGoods(company.id, output.goodsId, output.amount * aggregatedCount, price, context.currentTick, 'production');
        }
        
        // 恢复利用率
        building.utilization = Math.min(1, building.utilization + 0.05);
      }
    }
    
    // 同步现金状态
    const latestInventory = inventoryManager.getInventory(company.id);
    if (latestInventory) {
      company.cash = latestInventory.cash;
    }
    
    // 防止破产（AI公司获得救济）- 根据公司规模给予更多救济金
    if (company.cash < 0) {
      // 根据公司建筑数量和聚合因子计算救济金
      // 建筑越多、规模越大的公司需要更多资金维持运营
      let bailoutAmount = 100_000_000; // 基础1亿
      
      // 根据建筑数量增加（每个建筑额外2000万）
      bailoutAmount += company.buildings.length * 20_000_000;
      
      // 根据聚合因子增加（大公司需要更多资金）
      const maxAggregation = Math.max(1, ...company.buildings.map(b => b.aggregatedCount ?? 1));
      bailoutAmount += (maxAggregation - 1) * 30_000_000; // 每级聚合额外3000万
      
      // 上限3亿
      bailoutAmount = Math.min(bailoutAmount, 300_000_000);
      
      inventoryManager.addCash(company.id, bailoutAmount, context.currentTick, 'bailout');
      company.cash = bailoutAmount;
      console.log(`[AIManager] ${company.name} 获得救济金 ${(bailoutAmount / 1_000_000).toFixed(0)}M`);
    }
  }
  
  /**
   * 获取AI公司摘要（用于发送给客户端）
   */
  getCompaniesSummary(): Array<{
    id: string;
    name: string;
    cash: number;
    buildingCount: number;
    personality: AIPersonality;
    color: string;
    icon: string;
    trustWithPlayer: number;
    hostilityToPlayer: number;
    recentAction: string | undefined;
  }> {
    const summaries: Array<{
      id: string;
      name: string;
      cash: number;
      buildingCount: number;
      personality: AIPersonality;
      color: string;
      icon: string;
      trustWithPlayer: number;
      hostilityToPlayer: number;
      recentAction: string | undefined;
    }> = [];
    
    for (const [, company] of this.companies) {
      const lastAction = company.recentActions[company.recentActions.length - 1];
      summaries.push({
        id: company.id,
        name: company.name,
        cash: company.cash,
        buildingCount: company.buildings.length,
        personality: company.personality,
        color: company.color,
        icon: company.icon,
        trustWithPlayer: company.relationshipWithPlayer.trust,
        hostilityToPlayer: company.relationshipWithPlayer.hostility,
        recentAction: lastAction?.description,
      });
    }
    
    return summaries;
  }
  
  /**
   * 调整与玩家的关系
   */
  adjustPlayerRelationship(
    companyId: string,
    trustChange: number,
    hostilityChange: number,
    reason: string,
    tick: number
  ): void {
    const company = this.companies.get(companyId);
    if (!company) return;
    
    company.relationshipWithPlayer.trust = Math.max(-100, Math.min(100,
      company.relationshipWithPlayer.trust + trustChange
    ));
    
    company.relationshipWithPlayer.hostility = Math.max(0, Math.min(100,
      company.relationshipWithPlayer.hostility + hostilityChange
    ));
    
    company.relationshipWithPlayer.lastInteraction = tick;
    
    company.relationshipWithPlayer.history.push({
      tick,
      type: 'negotiation',
      description: reason,
      outcome: trustChange > 0 ? 'positive' : trustChange < 0 ? 'negative' : 'neutral',
      trustChange,
    });
    
    // 保留最近50条历史
    if (company.relationshipWithPlayer.history.length > 50) {
      company.relationshipWithPlayer.history = 
        company.relationshipWithPlayer.history.slice(-50);
    }
  }
}

// 导出单例
export const aiCompanyManager = new AICompanyManager();