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
  private readonly BATCH_SIZE = 5; // 每tick处理5个公司
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
      for (const input of method.recipe.inputs) {
        const current = inputNeeds.get(input.goodsId) ?? 0;
        inputNeeds.set(input.goodsId, current + input.amount * 24 * 30 * aggregatedCount);
      }
      
      // 统计输出产品（15天库存）× 聚合因子
      for (const output of method.recipe.outputs) {
        const current = outputProducts.get(output.goodsId) ?? 0;
        outputProducts.set(output.goodsId, current + output.amount * 24 * 15 * aggregatedCount);
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
  
  /**
   * 处理AI回合
   * 性能优化：分批处理AI公司，每tick只处理BATCH_SIZE个公司的订单和生产
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
    
    // 计算当前批次应该处理的公司范围
    const batchStart = this.currentBatchIndex * this.BATCH_SIZE;
    const batchEnd = Math.min(batchStart + this.BATCH_SIZE, totalCompanies);
    
    // 更新批次索引（循环）
    this.currentBatchIndex = (this.currentBatchIndex + 1) % Math.ceil(totalCompanies / this.BATCH_SIZE);
    
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
      
      // 检查是否到决策时间（规则驱动的小决策）- 所有公司都检查
      if (context.currentTick - company.lastDecisionTick >= company.decisionInterval) {
        this.processCompanyDecision(company, context);
        company.lastDecisionTick = context.currentTick;
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
   * 处理AI公司的市场订单（买入原料、卖出产品）
   * 性能优化：降低订单提交频率从每2-4 tick改为每10-15 tick
   */
  private processMarketOrders(company: AICompanyState, context: GameContext): void {
    const config = AI_COMPANIES_CONFIG.find(c => c.id === company.id);
    if (!config) return;
    
    const inventory = inventoryManager.getInventory(company.id);
    if (!inventory) return;
    
    // 【性能优化】每隔一定tick提交订单
    // 原逻辑每2-4 tick提交一次导致性能问题，改为每10-15 tick
    const orderInterval = Math.max(10, Math.min(15, Math.floor(config.decisionInterval / 2)));
    if (context.currentTick % orderInterval !== 0) return;
    
    // 分析需要买入的原料和可以卖出的产品
    for (const building of company.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def || building.status !== 'running') continue;
      
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      if (!method) continue;
      
      // 获取聚合因子
      const aggregatedCount = building.aggregatedCount ?? 1;
      
      // 买入原料（目标库存 × 聚合因子）
      for (const input of method.recipe.inputs) {
        this.processInputPurchase(company, config, input.goodsId, input.amount * 24 * 7 * aggregatedCount, context);
      }
      
      // 卖出产品（考虑聚合因子的产量）
      for (const output of method.recipe.outputs) {
        this.processSellOrder(company, config, output.goodsId, aggregatedCount, context);
      }
    }
  }
  
  /**
   * 处理原料采购订单
   */
  private processInputPurchase(
    company: AICompanyState,
    config: AICompanyConfig,
    goodsId: string,
    targetStock: number,
    context: GameContext
  ): void {
    const inventory = inventoryManager.getInventory(company.id);
    if (!inventory) return;
    
    const stock = inventory.stocks[goodsId];
    const currentQuantity = stock?.quantity ?? 0;
    
    // 如果库存低于目标，买入
    if (currentQuantity < targetStock) {
      const needToBuy = targetStock - currentQuantity;
      const buyPrice = this.calculateBuyPrice(company, config, goodsId, context);
      
      // 检查资金是否充足
      const totalCost = buyPrice * needToBuy;
      if (inventory.cash >= totalCost * 0.3) {
        const buyQuantity = Math.min(needToBuy, inventory.cash / buyPrice * 0.3);
        
        if (buyQuantity > 1) {
          marketOrderBook.submitBuyOrder(
            company.id,
            goodsId,
            buyQuantity,
            buyPrice,
            context.currentTick,
            20 // 20 tick过期
          );
        }
      }
    }
  }
  
  /**
   * 处理产品销售订单
   * @param _aggregatedCount 聚合因子（日产量计算已在estimateDailyProduction内处理）
   */
  private processSellOrder(
    company: AICompanyState,
    config: AICompanyConfig,
    goodsId: string,
    _aggregatedCount: number,
    context: GameContext
  ): void {
    const inventory = inventoryManager.getInventory(company.id);
    if (!inventory) return;
    
    const stock = inventory.stocks[goodsId];
    if (!stock) return;
    
    const available = stock.quantity - stock.reservedForSale;
    
    // 保留7天库存，其余卖出（日产量已包含聚合因子）
    const dailyProduction = this.estimateDailyProduction(company, goodsId);
    const reserveStock = dailyProduction * 7;
    const sellableQuantity = available - reserveStock;
    
    if (sellableQuantity > 1) {
      const sellPrice = this.calculateSellPrice(company, config, goodsId, context);
      const sellQuantity = sellableQuantity * 0.5; // 每次卖出50%的可卖量
      
      if (sellQuantity > 1) {
        marketOrderBook.submitSellOrder(
          company.id,
          goodsId,
          sellQuantity,
          sellPrice,
          context.currentTick,
          20
        );
        inventoryManager.reserveForSale(company.id, goodsId, sellQuantity, context.currentTick);
      }
    }
  }
  
  /**
   * 计算买入价格（根据人格调整）
   * 修正版：缩小价格偏移范围到 ±2%-8%，确保买卖可成交
   */
  private calculateBuyPrice(
    company: AICompanyState,
    config: AICompanyConfig,
    goodsId: string,
    _context: GameContext
  ): number {
    const marketPrice = priceDiscoveryService.getPrice(goodsId);
    
    // 添加微小随机波动 ±1%
    const randomFactor = 0.99 + Math.random() * 0.02;
    
    // 根据人格调整买入策略（收窄范围）
    switch (company.personality) {
      case AIPersonality.Monopolist:
        // 激进：愿意稍高于市价买入（+2%~+5%）
        return marketPrice * (1.02 + config.aggressiveness * 0.03) * randomFactor;
        
      case AIPersonality.OldMoney:
        // 保守：接近市价买入（-1%~+2%）
        return marketPrice * (0.99 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.TrendSurfer:
        // 跟风：紧跟市价（-1%~+3%）
        return marketPrice * (0.99 + Math.random() * 0.04) * randomFactor;
        
      case AIPersonality.CostLeader:
        // 成本导向：略低于市价（-3%~0%）
        return marketPrice * (0.97 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.Innovator:
      default:
        // 平衡策略：接近市价（-1%~+2%）
        return marketPrice * (0.99 + Math.random() * 0.03) * randomFactor;
    }
  }
  
  /**
   * 计算卖出价格（根据人格调整）
   * 修正版：缩小价格偏移范围到 ±2%-8%，确保买卖可成交
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
    
    // 添加微小随机波动 ±1%
    const randomFactor = 0.99 + Math.random() * 0.02;
    
    // 根据人格调整卖出策略（收窄范围）
    switch (company.personality) {
      case AIPersonality.Monopolist:
        // 激进：如果有玩家威胁则降价打压，否则略高于市价（+1%~+5%）
        if (playerThreat > 0.5) {
          return marketPrice * (0.95 - config.aggressiveness * 0.03) * randomFactor; // 价格战
        }
        return marketPrice * (1.01 + config.aggressiveness * 0.04) * randomFactor;
        
      case AIPersonality.OldMoney:
        // 保守：略高于市价（+1%~+4%）
        return marketPrice * (1.01 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.TrendSurfer:
        // 跟风：紧跟市价（-1%~+2%）
        return marketPrice * (0.99 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.CostLeader:
        // 低价策略：略低于市价（-3%~0%）
        return marketPrice * (0.97 + Math.random() * 0.03) * randomFactor;
        
      case AIPersonality.Innovator:
      default:
        // 品质溢价：略高于市价（0%~+3%）
        return marketPrice * (1.0 + Math.random() * 0.03) * randomFactor;
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
          // 每tick产出 * 24小时 * 效率 * 聚合因子
          const ticksPerCycle = method.recipe.ticksRequired;
          const cyclesPerDay = 24 / ticksPerCycle;
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
   * 分析市场缺口 - 找出供应不足的商品及对应工厂
   */
  private analyzeMarketGaps(context: GameContext): Array<{
    goodsId: string;
    shortage: number;  // 缺口比例 (需求-供应)/需求
    buildingId: string | null;
  }> {
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
    
    // 查找适合购买的建筑
    const affordableBuildings = BUILDINGS_DATA.filter(b => b.baseCost <= effectiveBudget);
    
    if (affordableBuildings.length === 0) {
      console.log(`[AIManager] ${company.name} 预算${Math.floor(effectiveBudget)}不足，无可购买建筑`);
      return null;
    }
    
    // 【优化2】分析市场缺口，优先建设供应不足的工厂
    const marketGaps = this.analyzeMarketGaps(context);
    
    for (const gap of marketGaps) {
      if (gap.buildingId) {
        const building = affordableBuildings.find(b => b.id === gap.buildingId);
        if (building) {
          console.log(`[AIManager] ${company.name} 发现市场缺口: ${gap.goodsId} 缺口${(gap.shortage * 100).toFixed(1)}%，建设 ${building.nameZh}`);
          return {
            tick: context.currentTick,
            type: 'purchase_building',
            description: `填补市场缺口：购买${building.nameZh}（${gap.goodsId}供应不足）`,
            targetId: building.id,
            cost: building.baseCost,
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
        const selected = strategicBuildings[Math.floor(Math.random() * strategicBuildings.length)];
        if (selected) {
          return {
            tick: context.currentTick,
            type: 'purchase_building',
            description: `战略布局：购买${selected.nameZh}`,
            targetId: selected.id,
            cost: selected.baseCost,
          };
        }
      }
    }
    
    // 【优化3】如果公司没有建筑，优先建设其专长领域的工厂
    if (company.buildings.length === 0 && config) {
      // 根据公司配置的初始建筑类型找对应建筑
      for (const initBuildingId of config.initialBuildings) {
        const building = affordableBuildings.find(b => b.id === initBuildingId);
        if (building) {
          return {
            tick: context.currentTick,
            type: 'purchase_building',
            description: `重建核心业务：购买${building.nameZh}`,
            targetId: building.id,
            cost: building.baseCost,
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
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)]?.building;
    
    if (!selected) return null;
    
    return {
      tick: context.currentTick,
      type: 'purchase_building',
      description: `购买${selected.nameZh}`,
      targetId: selected.id,
      cost: selected.baseCost,
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
   * 分析玩家依赖
   */
  private analyzePlayerDependencies(context: GameContext): string[] {
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
    return Array.from(dependencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([goodsId]) => goodsId);
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
   * 执行购买建筑
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
    
    company.cash -= action.cost;
    
    const defaultSlot = def.productionSlots[0];
    const defaultMethodId = defaultSlot?.defaultMethodId ?? defaultSlot?.methods[0]?.id ?? '';
    
    // 获取公司现有建筑的聚合因子（保持一致）
    const existingAggregatedCount = company.buildings[0]?.aggregatedCount ?? 1;
    
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
      status: 'running',
      productionProgress: 0,
      currentMethodId: defaultMethodId,
      aggregatedCount: existingAggregatedCount, // 继承公司的聚合因子
    };
    
    company.buildings.push(newBuilding);
    
    // 生成新闻
    this.pendingNews.push({
      companyId: company.id,
      headline: `${company.name}斥资扩张，新建${def.nameZh}`,
    });
    
    // 生成竞争事件
    this.pendingEvents.push({
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tick: context.currentTick,
      type: 'expansion',
      companyId: company.id,
      companyName: company.name,
      title: `${company.name}扩张产能`,
      description: `${company.name}投资新建${def.nameZh}，进一步扩大其在${def.category}领域的影响力。`,
      severity: 'moderate',
    });
    
    console.log(`[AIManager] ${company.name} 购买了 ${def.nameZh}`);
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
   * 处理AI公司生产（使用真实库存系统）
   * 产量和消耗都会乘以聚合因子
   */
  private processCompanyProduction(company: AICompanyState, context: GameContext): void {
    const TICKS_PER_MONTH = 720;
    const inventory = inventoryManager.getInventory(company.id);
    if (!inventory) return;
    
    for (const building of company.buildings) {
      if (building.status !== 'running') continue;
      
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) continue;
      
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
    
    // 防止破产（AI公司获得救济）
    if (company.cash < 0) {
      inventoryManager.addCash(company.id, 10_000_000, context.currentTick, 'bailout');
      company.cash = 10_000_000;
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