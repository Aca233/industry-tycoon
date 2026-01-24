/**
 * GameLoop Service - Manages game time and state progression
 *
 * 经济模型：
 * - 收入 = 产出商品数量 × 市场价格
 * - 成本 = 投入商品数量 × 市场价格 + 维护成本
 * - 生产需要 ticksRequired 个 tick 才能完成一个周期
 *
 * 市场模型：
 * - 每种商品有供给量和需求量
 * - 建筑消耗原料 → 增加需求
 * - 建筑产出产品 → 增加供给
 * - 价格根据供需比例自动调整
 */

import { EventEmitter } from 'events';
import type { GameSpeed, GameTick, TradeRecord } from '@scc/shared';
import {
  BUILDINGS_DATA,
  GOODS_DATA,
  MARKET_CONSTANTS,
  ECONOMY_CONSTANTS,
  AIPersonality,
  CompanyType,
  initializeRegistries,
  getGoodsRegistry,
  getBuilding,
  getConstructionTime,
  getConstructionMaterials,
  calculateConstructionCost,
  type BuildingDef,
} from '@scc/shared';
import { aiCompanyManager, type CompetitionEvent } from './aiCompanyManager.js';
import { llmService } from './llm.js';
import { researchService } from './researchService.js';
import { technologyEffectManager } from './technologyEffectManager.js';
import { economyManager } from './economyManager.js';
import { inventoryManager } from './inventoryManager.js';
import { autoTradeManager } from './autoTradeManager.js';
import { marketOrderBook } from './marketOrderBook.js';
import { matchingEngine } from './matchingEngine.js';
import { stockMarketService } from './stockMarket.js';
import { aiStockTradingService } from './aiStockTrading.js';
import { tickSchedulerFactory, TICK_FREQUENCY } from './tickScheduler.js';
import { getPriceWorkerPool } from '../workers/index.js';
import { performanceProfiler } from './performanceProfiler.js';

// 创建商品价格查询表
const GOODS_BASE_PRICES = new Map(GOODS_DATA.map(g => [g.id, g.basePrice]));

/** 供需数据结构 */
export interface SupplyDemandData {
  /** 当前供给量（单位/tick） */
  supply: number;
  /** 当前需求量（单位/tick） */
  demand: number;
  /** 上次价格 */
  lastPrice: number;
  /** 价格变化速度 */
  priceVelocity: number;
}

export interface BuildingInstance {
  id: string;
  definitionId: string;
  name: string;
  position: { x: number; y: number };
  efficiency: number;
  utilization: number;
  status: 'running' | 'paused' | 'no_input' | 'no_power' | 'under_construction' | 'waiting_materials';
  /** 当前生产进度 (0 到 ticksRequired) */
  productionProgress: number;
  /** 当前使用的生产方式 ID */
  currentMethodId: string;
  /** 聚合数量：代表多少个相同类型的工厂，默认为1 */
  aggregatedCount?: number;
  /** 建造进度 (0 到 constructionTime) */
  constructionProgress?: number;
  /** 建造所需总时间 */
  constructionTimeRequired?: number;
  /** 建造所需材料清单（等待材料状态时使用） */
  requiredConstructionMaterials?: Array<{ goodsId: string; amount: number }>;
}

/** 价格历史记录（扩展版：包含OHLC和成交量） */
export interface PriceHistoryEntry {
  tick: GameTick;
  price: number;
  /** 开盘价（该tick开始时的价格） */
  open?: number;
  /** 最高价 */
  high?: number;
  /** 最低价 */
  low?: number;
  /** 总成交量 */
  volume?: number;
  /** 买入成交量（主动买入） */
  buyVolume?: number;
  /** 卖出成交量（主动卖出） */
  sellVolume?: number;
}

export interface GameState {
  id: string;
  currentTick: GameTick;
  speed: GameSpeed;
  isPaused: boolean;
  playerCompanyId: string;
  playerCash: number;
  buildings: BuildingInstance[];
  marketPrices: Map<string, number>;
  priceHistory: Map<string, PriceHistoryEntry[]>; // 商品价格历史
  /** 供需追踪数据 */
  supplyDemand: Map<string, SupplyDemandData>;
  lastUpdate: number;
}

export interface BuildingProfit {
  buildingId: string;
  name: string;
  /** 产出商品的销售收入 */
  income: number;
  /** 投入商品的采购成本 */
  inputCost: number;
  /** 维护成本 */
  maintenance: number;
  /** 净利润 = 收入 - 投入成本 - 维护 */
  net: number;
  /** 本 tick 是否完成了一个生产周期 */
  produced: boolean;
  /** 滚动平均净利润（按生产周期平滑） */
  avgNet: number;
}

export interface FinancialSummary {
  /** 总销售收入 */
  totalIncome: number;
  /** 总投入成本 */
  totalInputCost: number;
  /** 总维护成本 */
  totalMaintenance: number;
  /** 净利润 */
  netProfit: number;
  /** 滚动平均净利润（按生产周期平滑） */
  avgNetProfit: number;
  buildingProfits: BuildingProfit[];
}

/** LLM生成的市场事件 */
export interface MarketEventGenerated {
  id: string;
  tick: GameTick;
  type: 'market_shift' | 'regulation' | 'disaster' | 'technology' | 'social';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  title: string;
  description: string;
  effects: {
    priceChanges?: Record<string, number>;
    supplyChanges?: Record<string, number>;
  };
}

/** 库存项目 */
export interface InventoryStockItem {
  goodsId: string;
  goodsName: string;
  quantity: number;
  reservedForSale: number;
  reservedForProduction: number;
  avgCost: number;
  marketValue: number;
}

/** 库存快照 */
export interface InventorySnapshot {
  stocks: InventoryStockItem[];
  totalValue: number;
}

export interface TickUpdate {
  gameId: string;
  tick: GameTick;
  timestamp: number;
  playerCash?: number;
  buildingCount?: number;
  financials?: FinancialSummary;
  marketChanges?: Array<{
    goodsId: string;
    price: number;
    change: number;
  }> | undefined;
  /** 当前所有商品价格快照（首次或完整同步时发送） */
  marketPrices?: Record<string, number>;
  /** 价格增量（只包含发生变化的价格，用于优化带宽） */
  priceDelta?: Record<string, number>;
  /** 是否为完整快照（false时客户端应使用增量合并） */
  isFullSnapshot?: boolean;
  events?: Array<{
    id: string;
    type: string;
    message: string;
  }> | undefined;
  /** AI公司摘要 */
  aiCompanies?: Array<{
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
  }> | undefined;
  /** 竞争事件 */
  competitionEvents?: CompetitionEvent[] | undefined;
  /** AI新闻 */
  aiNews?: Array<{
    companyId: string;
    headline: string;
  }> | undefined;
  /** LLM生成的市场事件 */
  marketEvents?: MarketEventGenerated[] | undefined;
  /** 研发进度更新 */
  researchUpdates?: {
    completedProjects: string[];
    newTechnologies: Array<{
      id: string;
      name: string;
      category: string;
    }>;
  } | undefined;
  /** 经济系统交易记录 */
  trades?: TradeRecord[] | undefined;
  /** 经济系统统计 */
  economyStats?: {
    totalNPCCompanies: number;
    totalActiveOrders: number;
    totalTradesThisTick: number;
  } | undefined;
  /** 玩家库存快照 */
  inventory?: InventorySnapshot | undefined;
  /** 建筑原料短缺信息 */
  buildingShortages?: Array<{
    buildingId: string;
    buildingName: string;
    status: 'no_input' | 'no_power' | 'paused' | 'waiting_materials';
    missingInputs: Array<{
      goodsId: string;
      goodsName: string;
      needed: number;
      available: number;
    }>;
  }> | undefined;
  /** 等待建造材料的建筑信息 */
  buildingMaterialShortages?: Array<{
    buildingId: string;
    buildingName: string;
    status: 'waiting_materials';
    missingMaterials: Array<{
      goodsId: string;
      goodsName: string;
      needed: number;
      available: number;
    }>;
  }> | undefined;
  /** 本 tick 的成交量数据（用于价格图表） */
  tickVolumes?: Record<string, {
    total: number;
    buy: number;
    sell: number;
  }> | undefined;
  /** 建筑进度信息（建造中、等待材料的建筑） */
  buildingsProgress?: Array<{
    buildingId: string;
    status: 'under_construction' | 'waiting_materials' | 'running' | 'no_input';
    constructionProgress?: number;
    constructionTimeRequired?: number;
    productionProgress?: number;
  }> | undefined;
}

/** 建筑收益历史记录（用于计算滚动平均） */
interface BuildingProfitHistory {
  /** 最近N个周期的净利润 */
  recentProfits: number[];
  /** 滚动平均净利润 */
  avgNet: number;
}

export class GameLoop extends EventEmitter {
  private games: Map<string, GameState> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Base tick rate: milliseconds per tick at 1x speed
  // 200ms = 5 ticks per second at 1x, 20 ticks per second at 4x
  // This allows 1 game-month (30 ticks) to pass in 1.5 seconds at 4x speed (1 tick = 1 day)
  private readonly BASE_TICK_MS = 200;
  
  // 价格历史管理（1 tick = 1天）
  private readonly MAX_PRICE_HISTORY_LENGTH = 3650; // 保留最近3650个tick的历史（10年）
  private readonly PRICE_HISTORY_CLEANUP_THRESHOLD = 4000; // 超过此值才触发清理
  
  // ===== 增量更新优化 =====
  // 缓存上一次发送的价格快照，用于计算增量
  private lastSentPrices: Map<string, Map<string, number>> = new Map(); // gameId -> (goodsId -> price)
  // 完整快照发送间隔（每N个tick发送一次完整快照，确保客户端同步）
  private readonly FULL_SNAPSHOT_INTERVAL = 50;
  
  // 建筑收益历史（用于计算滚动平均）
  private buildingProfitHistory: Map<string, Map<string, BuildingProfitHistory>> = new Map();
  // 滚动平均的窗口大小（保留最近N个生产周期）
  private readonly PROFIT_HISTORY_SIZE = 5;
  
  // 市场事件生成 - 批量预生成模式（由tickScheduler控制触发频率）
  private marketEventGenerationInterval = 200; // 每200 tick生成一批事件
  private scheduledMarketEvents: Map<string, Array<{ event: MarketEventGenerated; triggerTick: number }>> = new Map();
  private pendingMarketEvents: Map<string, MarketEventGenerated[]> = new Map();
  
  // Worker 池统计
  private workerTaskCount = 0;
  private workerSuccessCount = 0;
  private workerFailCount = 0;
  
  // 自动采购订单追踪 - 防止重复提交
  // Key: `${buildingId}-${goodsId}`, Value: orderId
  private pendingPurchaseOrders: Map<string, string> = new Map();
  
  constructor() {
    super();
  }
  
  /**
   * Create or get a game instance
   */
  getOrCreateGame(gameId: string, playerCompanyId: string = 'player-company-1'): GameState {
    let game = this.games.get(gameId);
    
    if (!game) {
      // 从 GOODS_DATA 自动初始化所有商品的市场价格
      // 使用商品定义中的 basePrice 作为初始价格
      const initialPrices = new Map<string, number>();
      for (const goods of GOODS_DATA) {
        initialPrices.set(goods.id, goods.basePrice);
      }
      
      // 初始化价格历史
      const priceHistory = new Map<string, PriceHistoryEntry[]>();
      for (const [goodsId, price] of initialPrices) {
        priceHistory.set(goodsId, [{ tick: 0, price }]);
      }
      
      // 初始化供需数据 - 基础供需平衡
      const supplyDemand = new Map<string, SupplyDemandData>();
      for (const [goodsId, price] of initialPrices) {
        supplyDemand.set(goodsId, {
          supply: 1000,  // 初始供给
          demand: 1000,  // 初始需求（平衡状态）
          lastPrice: price,
          priceVelocity: 0,
        });
      }
      
      game = {
        id: gameId,
        currentTick: 0,
        speed: 1 as GameSpeed,
        isPaused: true,
        playerCompanyId,
        playerCash: 500000000, // 5百万初始资金
        buildings: [], // 从空白开始
        marketPrices: initialPrices,
        priceHistory,
        supplyDemand,
        lastUpdate: Date.now(),
      };
      this.games.set(gameId, game);
      
      // 初始化注册表（商品、建筑、产业链）
      initializeRegistries();
      console.log('[GameLoop] Registries initialized');
      
      // 初始化AI公司
      aiCompanyManager.initializeCompanies();
      console.log('[GameLoop] AI companies initialized');
      
      // 初始化研发服务
      researchService.initialize();
      console.log('[GameLoop] Research service initialized');
      
      // 初始化技术效果管理器
      technologyEffectManager.initialize();
      console.log('[GameLoop] Technology effect manager initialized');
      
      // 初始化玩家公司库存
      inventoryManager.initializeCompany(
        playerCompanyId,
        '玩家公司',
        CompanyType.Player,
        500000000, // 5百万初始资金
        0
      );
      console.log('[GameLoop] Player inventory initialized');
      
      // ===== 注册增量撮合回调 =====
      // 将 marketOrderBook 与 matchingEngine 连接起来
      // 每当有新订单提交时，通知撮合引擎优先处理该商品
      marketOrderBook.setNewOrderCallback((goodsId, orderId) => {
        matchingEngine.markNewOrder(goodsId, orderId);
      });
      console.log('[GameLoop] Incremental matching callback registered');
      
      // 初始化经济系统
      economyManager.initialize(0);
      console.log('[GameLoop] Economy system initialized');
      
      // 初始化自动交易管理器
      autoTradeManager.initialize(playerCompanyId);
      console.log('[GameLoop] Auto trade manager initialized');
      
      // 初始化股票市场
      stockMarketService.initialize(playerCompanyId, 0);
      console.log('[GameLoop] Stock market initialized');
    }
    
    return game;
  }
  
  /**
   * Get game state
   */
  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }
  
  /**
   * Set game speed (0 = paused, 1 = normal, 2 = fast, 4 = very fast)
   */
  setSpeed(gameId: string, speed: GameSpeed): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    game.speed = speed;
    game.isPaused = speed === 0;
    
    // Restart the interval with new speed
    this.stopGameLoop(gameId);
    if (!game.isPaused) {
      this.startGameLoop(gameId);
    }
    
    this.emit('speedChange', { gameId, speed, isPaused: game.isPaused });
  }
  
  /**
   * Toggle pause state
   */
  togglePause(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    
    if (game.isPaused) {
      // Resume with previous speed or default to 1
      game.isPaused = false;
      if (game.speed === 0) {
        game.speed = 1 as GameSpeed;
      }
      this.startGameLoop(gameId);
    } else {
      game.isPaused = true;
      this.stopGameLoop(gameId);
    }
    
    this.emit('pauseChange', { gameId, isPaused: game.isPaused, speed: game.speed });
    return game.isPaused;
  }
  
  /**
   * Start the game loop for a specific game
   *
   * 使用递归 setTimeout 代替 setInterval，解决累积延迟问题：
   * - setInterval 不等待回调完成就调度下一次执行
   * - 当 processTick() 耗时超过 tickInterval 时，任务会堆积
   * - 递归 setTimeout 在每次 tick 完成后动态计算下一次延迟
   */
  private startGameLoop(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game || game.isPaused) return;
    
    // Clear any existing interval/timeout
    this.stopGameLoop(gameId);
    
    // 递归调度下一个 tick
    const scheduleNextTick = () => {
      const currentGame = this.games.get(gameId);
      if (!currentGame || currentGame.isPaused) {
        this.intervals.delete(gameId);
        return;
      }
      
      // 根据当前速度计算目标间隔
      const tickInterval = this.BASE_TICK_MS / currentGame.speed;
      const startTime = Date.now();
      
      // 执行 tick
      this.processTick(gameId);
      
      // 计算实际执行时间
      const elapsed = Date.now() - startTime;
      
      // 动态计算下一次延迟，补偿执行耗时
      // 如果执行时间超过了目标间隔，最小延迟1ms避免阻塞
      const nextDelay = Math.max(1, tickInterval - elapsed);
      
      // 性能警告：如果 tick 执行时间超过目标间隔的150%，输出警告
      if (elapsed > tickInterval * 1.5 && elapsed > 100) {
        console.warn(`[GameLoop] ⚠️ Tick 执行过慢: ${elapsed}ms (目标: ${tickInterval}ms) - 游戏可能变慢`);
      }
      
      // 调度下一个 tick
      const timeout = setTimeout(scheduleNextTick, nextDelay);
      this.intervals.set(gameId, timeout);
    };
    
    // 开始第一个 tick
    scheduleNextTick();
    console.log(`[GameLoop] Started game ${gameId} at ${game.speed}x speed (dynamic scheduling)`);
  }
  
  /**
   * Stop the game loop for a specific game
   */
  private stopGameLoop(gameId: string): void {
    const timeout = this.intervals.get(gameId);
    if (timeout) {
      clearTimeout(timeout); // 改用 clearTimeout 配合递归 setTimeout
      this.intervals.delete(gameId);
      console.log(`[GameLoop] Stopped game ${gameId}`);
    }
  }
  
  /**
   * Purchase a building
   * 支持从 BUILDINGS_DATA 和 BUILDING_DEFINITIONS 两个数据源查找建筑
   *
   * 建造系统：
   * 1. 检查资金是否足够
   * 2. 检查建造材料是否足够（水泥、钢材、玻璃、铝材等）
   * 3. 扣除资金和材料
   * 4. 创建"建造中"状态的建筑
   * 5. 每tick推进建造进度，完成后转为运营状态
   */
  purchaseBuilding(gameId: string, buildingDefId: string): { success: boolean; building?: BuildingInstance; error?: string; newCash?: number; materialsConsumed?: Array<{ goodsId: string; amount: number }>; missingMaterials?: Array<{ goodsId: string; needed: number; available: number }> } {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: '游戏不存在' };
    }
    
    // 优先从 BUILDINGS_DATA 查找，如果没有则尝试 BUILDING_DEFINITIONS（通过 getBuilding 函数）
    let buildingDef = BUILDINGS_DATA.find(b => b.id === buildingDefId);
    if (!buildingDef) {
      // 尝试从新格式 BUILDING_DEFINITIONS 获取
      buildingDef = getBuilding(buildingDefId);
    }
    if (!buildingDef) {
      return { success: false, error: `建筑类型不存在: ${buildingDefId}` };
    }
    
    // 从库存系统获取现金
    const playerInventory = inventoryManager.getInventory(game.playerCompanyId);
    const currentCash = playerInventory?.cash ?? game.playerCash;
    
    // ===== 新成本系统：使用动态成本计算（人工成本 + 材料市价） =====
    // 获取当前市场价格
    const marketPrices: Record<string, number> = {};
    for (const [goodsId, price] of game.marketPrices) {
      marketPrices[goodsId] = price;
    }
    
    // 计算真实建造成本（材料费 + 人工费）
    const costResult = calculateConstructionCost(buildingDef as BuildingDef, marketPrices);
    const laborCost = costResult.laborCost; // 人工成本必须先付
    
    // 检查资金是否足够支付人工成本
    if (currentCash < laborCost) {
      return { success: false, error: `资金不足，需要 ${(laborCost / 10000).toFixed(0)} 万元人工费` };
    }
    
    // ===== 建造系统：检查建造材料（不再阻止购买，只记录缺失） =====
    const constructionMaterials = getConstructionMaterials(buildingDef as BuildingDef);
    const constructionTime = getConstructionTime(buildingDef as BuildingDef);
    const missingMaterials: Array<{ goodsId: string; needed: number; available: number }> = [];
    
    for (const material of constructionMaterials) {
      const available = inventoryManager.getAvailableQuantity(game.playerCompanyId, material.goodsId);
      if (available < material.amount) {
        missingMaterials.push({
          goodsId: material.goodsId,
          needed: material.amount,
          available,
        });
      }
    }
    
    // ===== 扣除人工成本（无论材料是否充足都扣除）=====
    // 注意：只扣除人工成本，材料费通过消耗库存材料来体现
    game.playerCash -= laborCost;
    if (playerInventory) {
      inventoryManager.deductCash(
        game.playerCompanyId,
        laborCost,
        game.currentTick,
        `labor-cost-building-${buildingDefId}`
      );
    }
    
    console.log(`[GameLoop] Building ${buildingDef.nameZh}: Labor cost ¥${(laborCost / 10000).toFixed(0)}万, Material cost ¥${(costResult.materialCost / 10000).toFixed(0)}万 (total ¥${(costResult.totalCost / 10000).toFixed(0)}万)`);
    
    // ===== 根据材料状态决定初始状态和是否消耗材料 =====
    let initialStatus: 'under_construction' | 'waiting_materials';
    const materialsConsumed: Array<{ goodsId: string; amount: number }> = [];
    
    if (missingMaterials.length > 0) {
      // 材料不足，进入等待材料状态，不消耗材料
      initialStatus = 'waiting_materials';
      console.log(`[GameLoop] Building purchase: ${buildingDef.nameZh} - waiting for materials: ${missingMaterials.map(m => `${m.goodsId}(需${m.needed},有${m.available})`).join(', ')}`);
    } else {
      // 材料充足，直接开始建造并消耗材料
      initialStatus = 'under_construction';
      for (const material of constructionMaterials) {
        inventoryManager.consumeGoods(
          game.playerCompanyId,
          material.goodsId,
          material.amount,
          game.currentTick,
          `construction-${buildingDefId}`
        );
        materialsConsumed.push({ goodsId: material.goodsId, amount: material.amount });
        
        // 建造消耗也增加市场需求
        this.addDemand(game, material.goodsId, material.amount);
      }
    }
    
    // 获取默认生产方式
    const defaultSlot = buildingDef.productionSlots[0];
    const defaultMethodId = defaultSlot?.defaultMethodId ?? defaultSlot?.methods[0]?.id ?? '';
    
    // Create building instance
    const building: BuildingInstance = {
      id: `building-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      definitionId: buildingDefId,
      name: buildingDef.nameZh,
      position: {
        x: 100 + (game.buildings.length % 5) * 150,
        y: 100 + Math.floor(game.buildings.length / 5) * 120,
      },
      efficiency: 1.0,
      utilization: 1.0, // 满负荷运行
      status: initialStatus, // 根据材料状态决定
      productionProgress: 0,
      currentMethodId: defaultMethodId,
      aggregatedCount: 1, // 玩家建筑默认为1（不聚合）
      constructionTimeRequired: constructionTime,
    };
    
    // 根据状态设置可选属性（避免 exactOptionalPropertyTypes 问题）
    if (initialStatus === 'under_construction') {
      building.constructionProgress = 0;
    }
    if (missingMaterials.length > 0) {
      building.requiredConstructionMaterials = constructionMaterials;
    }
    
    game.buildings.push(building);
    
    // ===== 自动配置交易策略 =====
    // 获取当前生产方式的配方
    const currentMethod = defaultSlot?.methods.find(m => m.id === defaultMethodId) ?? defaultSlot?.methods[0];
    if (currentMethod && currentMethod.recipe) {
      const recipe = currentMethod.recipe;
      // ticksRequired 在这里未直接使用，阈值计算在下方直接使用 recipe.ticksRequired
      
      // 为每个输入商品配置自动采购
      // 重要修复：使用基于生产周期的库存目标，而非日消耗量
      // 这避免了高价值原料导致的巨额采购成本
      for (const input of recipe.inputs) {
        // 每个生产周期的消耗量
        const cycleConsumption = input.amount;
        // 触发阈值：低于10个周期的原料时开始采购（提前采购）
        const triggerThreshold = Math.max(1, Math.ceil(cycleConsumption * 10));
        // 目标库存：保持50个周期的原料（足够生产很长一段时间）
        const targetStock = Math.ceil(cycleConsumption * 50);
        
        autoTradeManager.updateGoodsConfig(game.playerCompanyId, input.goodsId, {
          autoBuy: {
            enabled: true,
            triggerThreshold: triggerThreshold,
            targetStock: targetStock,
            maxPriceMultiplier: 1.15,                           // 提高最高溢价到15%，更容易成交
          },
        });
        console.log(`[GameLoop] 自动配置采购: ${input.goodsId} (周期消耗: ${cycleConsumption}, 阈值: ${triggerThreshold}, 目标: ${targetStock})`);
      }
      
      // 为每个输出商品配置自动销售
      // 关键修复：大幅降低触发阈值，让产品一旦产出就立即销售
      for (const output of recipe.outputs) {
        // 每个生产周期的产量
        const cycleProduction = output.amount;
        // 触发阈值：只要有1个周期的产量就开始卖
        const triggerThreshold = Math.max(1, Math.ceil(cycleProduction * 0.5));
        // 保留库存：几乎不保留，让产品快速流通
        const reserveStock = Math.max(0, Math.ceil(cycleProduction * 0.1));
        
        autoTradeManager.updateGoodsConfig(game.playerCompanyId, output.goodsId, {
          autoSell: {
            enabled: true,
            triggerThreshold: triggerThreshold,   // 有半个周期产量就卖
            reserveStock: reserveStock,           // 几乎不保留
            minPriceMultiplier: 0.85,             // 最低折价15%，更容易成交
          },
        });
        console.log(`[GameLoop] 自动配置销售: ${output.goodsId} (阈值: ${triggerThreshold}, 保留: ${reserveStock})`);
      }
    }
    
    // ===== 为建造材料配置自动采购（如果处于等待材料状态）=====
    if (missingMaterials.length > 0) {
      for (const material of constructionMaterials) {
        // 建造材料采购策略：一次性大量采购
        const triggerThreshold = Math.ceil(material.amount * 0.5); // 低于需求的50%时触发
        const targetStock = Math.ceil(material.amount * 2); // 目标是需求的2倍（留有余量）
        
        autoTradeManager.updateGoodsConfig(game.playerCompanyId, material.goodsId, {
          autoBuy: {
            enabled: true,
            triggerThreshold: triggerThreshold,
            targetStock: targetStock,
            maxPriceMultiplier: 1.20, // 建造材料可以接受更高溢价（20%）
          },
        });
        console.log(`[GameLoop] 自动配置建造材料采购: ${material.goodsId} (需${material.amount}, 阈值: ${triggerThreshold}, 目标: ${targetStock})`);
      }
    }
    
    // 同步玩家现金
    const updatedInventory = inventoryManager.getInventory(game.playerCompanyId);
    if (updatedInventory) {
      game.playerCash = updatedInventory.cash;
    }
    
    if (initialStatus === 'waiting_materials') {
      console.log(`[GameLoop] Building purchased (waiting for materials): ${buildingDef.nameZh}`);
    } else {
      console.log(`[GameLoop] Building construction started: ${buildingDef.nameZh}, time: ${constructionTime} ticks, materials: ${materialsConsumed.map(m => `${m.goodsId}x${m.amount}`).join(', ')}`);
    }
    
    // 构建返回结果（避免 exactOptionalPropertyTypes 问题）
    const result: {
      success: boolean;
      building?: BuildingInstance;
      error?: string;
      newCash?: number;
      materialsConsumed?: Array<{ goodsId: string; amount: number }>;
      missingMaterials?: Array<{ goodsId: string; needed: number; available: number }>;
    } = {
      success: true,
      building,
      newCash: game.playerCash,
      materialsConsumed,
    };
    
    if (missingMaterials.length > 0) {
      result.missingMaterials = missingMaterials;
    }
    
    return result;
  }
  
  /**
   * Get buildings for a game
   */
  getBuildings(gameId: string): BuildingInstance[] {
    const game = this.games.get(gameId);
    return game?.buildings ?? [];
  }
  
  /**
   * Get player cash
   */
  getPlayerCash(gameId: string): number {
    const game = this.games.get(gameId);
    return game?.playerCash ?? 0;
  }
  
  /**
   * Deduct player cash (for research investment, purchases, etc.)
   * Returns true if successful, false if insufficient funds
   */
  deductPlayerCash(gameId: string, amount: number): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    
    if (game.playerCash < amount) {
      return false;
    }
    
    game.playerCash -= amount;
    console.log(`[GameLoop] Deducted ${amount} from player cash, new balance: ${game.playerCash}`);
    return true;
  }
  
  /**
   * Add player cash (for refunds, etc.)
   */
  addPlayerCash(gameId: string, amount: number): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    game.playerCash += amount;
    console.log(`[GameLoop] Added ${amount} to player cash, new balance: ${game.playerCash}`);
  }
  
  /**
   * Switch a building's production method
   */
  switchBuildingMethod(gameId: string, buildingId: string, methodId: string): { success: boolean; error?: string } {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: '游戏不存在' };
    }
    
    const building = game.buildings.find(b => b.id === buildingId);
    if (!building) {
      return { success: false, error: '建筑不存在' };
    }
    
    // 验证 methodId 是否合法
    const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
    if (!def) {
      return { success: false, error: '建筑定义不存在' };
    }
    
    const slot = def.productionSlots[0];
    const validMethod = slot?.methods.find(m => m.id === methodId);
    if (!validMethod) {
      return { success: false, error: '生产方式不存在' };
    }
    
    // 更新生产方式
    building.currentMethodId = methodId;
    // 重置生产进度
    building.productionProgress = 0;
    
    console.log(`[GameLoop] Building ${building.name} switched to method: ${validMethod.nameZh}`);
    
    return { success: true };
  }
  
  /**
   * Get price history for a specific goods
   */
  getPriceHistory(gameId: string, goodsId?: string): Map<string, PriceHistoryEntry[]> | PriceHistoryEntry[] | null {
    const game = this.games.get(gameId);
    if (!game) return null;
    
    if (goodsId) {
      return game.priceHistory.get(goodsId) ?? [];
    }
    return game.priceHistory;
  }
  
  /**
   * Get current market prices
   */
  getMarketPrices(gameId: string): Record<string, number> {
    const game = this.games.get(gameId);
    if (!game) return {};
    
    const prices: Record<string, number> = {};
    for (const [goodsId, price] of game.marketPrices) {
      prices[goodsId] = price;
    }
    return prices;
  }
  
  /**
   * 获取商品的当前市场价格
   */
  private getPrice(game: GameState, goodsId: string): number {
    return game.marketPrices.get(goodsId) ?? GOODS_BASE_PRICES.get(goodsId) ?? 1000;
  }
  
  /**
   * Process a single game tick
   *
   * 使用分层调度器优化性能：
   * - 高频操作（每tick）：建筑生产、订单撮合、价格同步
   * - 中频操作（每5-20 tick）：AI决策、股票、自动交易
   * - 低频操作（每50-200 tick）：诊断、LLM事件
   */
  private processTick(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    const tickStartTime = Date.now();
    const scheduler = tickSchedulerFactory.getScheduler(gameId);
    
    // === 诊断日志：每10tick输出一次基础状态 ===
    if (game.currentTick % 10 === 0) {
      console.log(`[GameLoop] ========== TICK ${game.currentTick + 1} ==========`);
      console.log(`[GameLoop] 建筑数量: ${game.buildings.length}`);
      if (game.buildings.length > 0) {
        for (const b of game.buildings) {
          console.log(`[GameLoop]   - ${b.name}: 状态=${b.status}, 进度=${b.productionProgress?.toFixed(1) || 0}`);
        }
      } else {
        console.log(`[GameLoop] ⚠️ 警告: 玩家没有任何建筑!`);
      }
    }
    
    // 开始性能采样
    performanceProfiler.startTick(game.currentTick + 1, {
      buildingCount: game.buildings.length,
      activeOrders: marketOrderBook.getOrderBookStats().totalBuyOrders + marketOrderBook.getOrderBookStats().totalSellOrders,
      aiCompanyCount: aiCompanyManager.getCompanies().size,
    });
    
    // Advance tick
    game.currentTick++;
    game.lastUpdate = tickStartTime;
    
    // ===== 高频操作：订单撮合和价格发现（每tick）=====
    performanceProfiler.startPhase('economyUpdate');
    const economyResult = this.processHighFrequencyOperations(game, scheduler);
    performanceProfiler.endPhase('economyUpdate');
    
    // ===== 低频操作：诊断日志 =====
    if (scheduler.shouldExecute(game.currentTick, 'DIAGNOSTIC_LOG')) {
      this.logEconomicDiagnostics(game, economyResult);
    }
    
    // 同步玩家库存中的现金到游戏状态
    const playerInventory = inventoryManager.getInventory(game.playerCompanyId);
    if (playerInventory) {
      game.playerCash = playerInventory.cash;
    }
    
    // ===== 高频操作：建筑生产（每tick）=====
    performanceProfiler.startPhase('buildingProduction');
    const { totalIncome, totalInputCost, totalMaintenance, buildingProfits } =
      this.processBuildingProduction(game, scheduler);
    performanceProfiler.endPhase('buildingProduction');
    
    // ===== 低频操作：建筑状态诊断 =====
    if (scheduler.shouldExecute(game.currentTick, 'BUILDING_DIAGNOSTIC') && game.buildings.length > 0) {
      this.logBuildingDiagnostics(game);
    }
    
    const netProfit = totalIncome - totalInputCost - totalMaintenance;
    
    // 计算总体滚动平均净利润
    const avgNetProfit = buildingProfits.reduce((sum, bp) => sum + bp.avgNet, 0);
    
    // 构建财务摘要
    const financials: FinancialSummary = {
      totalIncome,
      totalInputCost,
      totalMaintenance,
      netProfit,
      avgNetProfit,
      buildingProfits,
    };
    
    // 基于供需比例更新市场价格
    const marketChanges: TickUpdate['marketChanges'] = [];
    
    // 汇总本 tick 每个商品的成交量（从 economyResult.trades）
    const tickVolumeByGoods = new Map<string, { total: number; buy: number; sell: number }>();
    for (const trade of economyResult.trades) {
      let vol = tickVolumeByGoods.get(trade.goodsId);
      if (!vol) {
        vol = { total: 0, buy: 0, sell: 0 };
        tickVolumeByGoods.set(trade.goodsId, vol);
      }
      vol.total += trade.quantity;
      // 如果买方是玩家公司，算作买入成交量；否则算卖出成交量
      if (trade.buyerCompanyId === game.playerCompanyId) {
        vol.buy += trade.quantity;
      } else {
        vol.sell += trade.quantity;
      }
    }
    
    for (const [goodsId, price] of game.marketPrices) {
      const data = game.supplyDemand.get(goodsId);
      const basePrice = GOODS_BASE_PRICES.get(goodsId) ?? price;
      
      let newPrice = price;
      let change = 0;
      
      if (data) {
        // 计算供需比例
        const ratio = data.supply > 0 ? data.demand / data.supply : 2;
        const imbalance = ratio - 1; // 正数 = 需求过剩，负数 = 供给过剩
        
        // 只有当失衡超过阈值时才调整价格
        const threshold = MARKET_CONSTANTS?.IMBALANCE_THRESHOLD ?? 0.05;
        const adjustmentRate = MARKET_CONSTANTS?.PRICE_ADJUSTMENT_RATE ?? 0.02;
        
        if (Math.abs(imbalance) > threshold) {
          // 价格调整带有动量（平滑变化）
          const adjustment = imbalance * adjustmentRate;
          data.priceVelocity = data.priceVelocity * 0.9 + adjustment * 0.1;
          newPrice = price * (1 + data.priceVelocity);
        } else {
          // 失衡较小时，价格缓慢回归基准
          data.priceVelocity *= 0.95;
          newPrice = price + (basePrice - price) * 0.001;
        }
        
        // 添加小幅随机波动（模拟市场噪音）
        const noise = (Math.random() - 0.5) * 0.01;
        newPrice *= (1 + noise);
        
        // 限制价格范围
        const minMultiplier = ECONOMY_CONSTANTS?.MIN_PRICE_MULTIPLIER ?? 0.2;
        const maxMultiplier = ECONOMY_CONSTANTS?.MAX_PRICE_MULTIPLIER ?? 5;
        newPrice = Math.max(
          basePrice * minMultiplier,
          Math.min(basePrice * maxMultiplier, newPrice)
        );
        
        newPrice = Math.round(newPrice);
        change = newPrice - price;
        
        // 供需量随时间衰减（模拟市场消化）- 使用配置的衰减率
        const decayRate = MARKET_CONSTANTS?.SUPPLY_DEMAND_DECAY ?? 0.995;
        data.supply = Math.max(100, data.supply * decayRate);
        data.demand = Math.max(100, data.demand * decayRate);
        data.lastPrice = newPrice;
      } else {
        // 没有供需数据时保持小幅随机波动
        const changePercent = (Math.random() - 0.5) * 0.02;
        change = Math.round(price * changePercent);
        newPrice = Math.max(1, price + change);
      }
      
      game.marketPrices.set(goodsId, newPrice);
      
      // 记录价格历史（包含成交量数据）
      let history = game.priceHistory.get(goodsId);
      if (!history) {
        history = [];
        game.priceHistory.set(goodsId, history);
      }
      
      // 获取本 tick 的成交量
      const vol = tickVolumeByGoods.get(goodsId);
      
      // 获取上一个价格点作为 open（用于K线图）
      const prevEntry = history.length > 0 ? history[history.length - 1] : null;
      const openPrice = prevEntry?.price ?? newPrice;
      
      // 计算 high/low：如果有上一个价格点，比较 open 和 close
      const highPrice = Math.max(openPrice, newPrice);
      const lowPrice = Math.min(openPrice, newPrice);
      
      history.push({
        tick: game.currentTick,
        price: newPrice,
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        volume: vol?.total ?? 0,
        buyVolume: vol?.buy ?? 0,
        sellVolume: vol?.sell ?? 0,
      });
      
      // 延迟清理：只有超过阈值才触发，减少 slice 频率
      // 这避免了每个 tick 对每个商品都执行 slice O(n) 操作
      if (history.length > this.PRICE_HISTORY_CLEANUP_THRESHOLD) {
        game.priceHistory.set(goodsId, history.slice(-this.MAX_PRICE_HISTORY_LENGTH));
      }
      
      if (Math.abs(change) > 0) {
        marketChanges.push({ goodsId, price: newPrice, change });
      }
    }
    
    // ===== 中频操作：消费需求处理 =====
    if (scheduler.shouldExecute(game.currentTick, 'CONSUMER_DEMAND')) {
      // 模拟城市居民对各类商品的持续消费需求
      // 因为频率降低了，所以需要乘以10来保持总需求量
      this.processBasicConsumerDemand(game, TICK_FREQUENCY.MEDIUM.CONSUMER_DEMAND);
    }
    
    // ===== 中频操作：自动交易 =====
    let autoTradeResult = { actions: [] as Array<{ success: boolean; type: string; quantity: number; goodsId: string; price: number }> };
    if (scheduler.shouldExecute(game.currentTick, 'AUTO_TRADE')) {
      autoTradeResult = autoTradeManager.processTick(
        game.playerCompanyId,
        game.currentTick,
        game as unknown as import('@scc/shared').GameState
      );
      
      // 记录自动交易动作
      for (const action of autoTradeResult.actions) {
        if (action.success) {
          console.log(`[AutoTrade] ${action.type === 'buy' ? '采购' : '销售'} ${action.quantity} ${action.goodsId} @ ${action.price.toFixed(2)}`);
        }
      }
    }
    
    // ===== 中频操作：AI公司决策 =====
    let aiResult = { events: [] as CompetitionEvent[], news: [] as Array<{ companyId: string; headline: string }> };
    if (scheduler.shouldExecute(game.currentTick, 'AI_COMPANY_DECISION')) {
      performanceProfiler.startPhase('aiCompanyDecision');
      const aiContext = {
        currentTick: game.currentTick,
        marketPrices: game.marketPrices,
        supplyDemand: game.supplyDemand,
        playerBuildings: game.buildings,
        playerCash: game.playerCash,
      };
      
      aiResult = aiCompanyManager.processTick(aiContext);
      
      // AI建筑的生产也影响供需系统
      for (const [, aiCompany] of aiCompanyManager.getCompanies()) {
        for (const building of aiCompany.buildings) {
          if (building.status !== 'running') continue;
          
          const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
          if (!def) continue;
          
          const slot = def.productionSlots[0];
          const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
          if (!method) continue;
          
          // 检查是否完成生产周期
          if (building.productionProgress >= method.recipe.ticksRequired) {
            // AI生产也增加供需（乘以频率因子保持总量）
            for (const input of method.recipe.inputs) {
              this.addDemand(game, input.goodsId, input.amount * 0.5 * TICK_FREQUENCY.MEDIUM.AI_COMPANY_DECISION);
            }
            for (const output of method.recipe.outputs) {
              this.addSupply(game, output.goodsId, output.amount * 0.5 * TICK_FREQUENCY.MEDIUM.AI_COMPANY_DECISION);
            }
          }
        }
      }
      performanceProfiler.endPhase('aiCompanyDecision');
    }
    
    // ===== 中频操作：股票市场 =====
    if (scheduler.shouldExecute(game.currentTick, 'STOCK_MARKET_UPDATE')) {
      performanceProfiler.startPhase('stockMarket');
      // 收集公司财务数据用于股价计算
      const companyFinancials = new Map<string, { cash: number; netIncome: number; totalAssets: number }>();
      
      // 玩家公司财务
      const playerInventoryForStock = inventoryManager.getInventory(game.playerCompanyId);
      if (playerInventoryForStock) {
        companyFinancials.set(game.playerCompanyId, {
          cash: playerInventoryForStock.cash,
          netIncome: netProfit * 30, // 转换为月收益估算（1 tick = 1天）
          totalAssets: playerInventoryForStock.cash, // 简化处理
        });
      }
      
      // AI公司财务
      for (const [companyId, aiCompany] of aiCompanyManager.getCompanies()) {
        companyFinancials.set(companyId, {
          cash: aiCompany.cash,
          netIncome: aiCompany.cash * 0.01, // 估算收益
          totalAssets: aiCompany.cash * 2,
        });
      }
      
      // 更新股票市场（撮合订单、更新股价）
      stockMarketService.processTick(game.currentTick, companyFinancials);
      performanceProfiler.endPhase('stockMarket');
    }
    
    // ===== 中频操作：AI股票交易 =====
    if (scheduler.shouldExecute(game.currentTick, 'AI_STOCK_TRADING')) {
      const aiStockOrders = aiStockTradingService.processTick(game.currentTick);
      if (aiStockOrders.length > 0 && scheduler.shouldExecute(game.currentTick, 'DIAGNOSTIC_LOG')) {
        console.log(`[GameLoop] AI股票交易: ${aiStockOrders.length}笔订单提交`);
      }
    }
    
    // ===== 中频操作：研发进度 =====
    let completedProjects: string[] = [];
    const newTechnologies: Array<{ id: string; name: string; category: string }> = [];
    if (scheduler.shouldExecute(game.currentTick, 'RESEARCH_PROGRESS')) {
      completedProjects = researchService.progressResearch(game.currentTick);
      
      // 处理完成的研发项目（异步，不阻塞tick）
      if (completedProjects.length > 0) {
        this.processCompletedResearch(completedProjects, game.currentTick, newTechnologies);
      }
    }
    
    // ===== 低频操作：专利过期检查 =====
    if (scheduler.shouldExecute(game.currentTick, 'PATENT_EXPIRY_CHECK')) {
      researchService.checkPatentExpiry(game.currentTick);
    }
    
    // Generate random events occasionally
    const events: Array<{ id: string; type: string; message: string }> = [];
    
    // ===== 低频操作：副作用处理 =====
    if (scheduler.shouldExecute(game.currentTick, 'SIDE_EFFECT_PROCESS')) {
      const triggeredSideEffects = researchService.processSideEffects(game.currentTick);
      for (const effect of triggeredSideEffects) {
        // 将副作用作为事件添加
        events.push({
          id: `side-effect-${effect.sideEffect.id}`,
          type: 'side_effect',
          message: `⚠️ ${effect.technologyName}: ${effect.sideEffect.effect.newsHeadline || effect.sideEffect.name}`,
        });
        
        // 根据副作用类型和严重程度影响游戏
        this.applySideEffectConsequences(game, effect.sideEffect);
      }
    }
    
    // 添加AI新闻作为事件
    for (const news of aiResult.news) {
      events.push({
        id: `ai-news-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'ai_activity',
        message: news.headline,
      });
    }
    
    // ===== 低频操作：LLM市场事件生成 =====
    if (scheduler.shouldExecute(game.currentTick, 'MARKET_EVENT_GENERATION')) {
      this.generateMarketEventsBatch(game);
    }
    
    // 检查预定的事件是否到了触发时间
    const scheduledEvents = this.scheduledMarketEvents.get(gameId) ?? [];
    const triggeredEvents: MarketEventGenerated[] = [];
    const remainingScheduled: Array<{ event: MarketEventGenerated; triggerTick: number }> = [];
    
    for (const scheduled of scheduledEvents) {
      if (game.currentTick >= scheduled.triggerTick) {
        triggeredEvents.push(scheduled.event);
        console.log(`[GameLoop] 触发预定市场事件: ${scheduled.event.title} (tick=${game.currentTick})`);
      } else {
        remainingScheduled.push(scheduled);
      }
    }
    this.scheduledMarketEvents.set(gameId, remainingScheduled);
    
    // 收集异步生成的市场事件（兼容老逻辑）
    const pendingEvents = [...(this.pendingMarketEvents.get(gameId) ?? []), ...triggeredEvents];
    this.pendingMarketEvents.set(gameId, []);
    
    // 应用市场事件效果
    for (const marketEvent of pendingEvents) {
      this.applyMarketEventEffects(game, marketEvent);
      // 注意：不再将市场事件添加到普通事件流，避免客户端重复处理
      // 市场事件通过 marketEvents 字段单独发送
    }
    
    // ===== 增量更新优化：只发送变化的价格 =====
    const lastPrices = this.lastSentPrices.get(gameId) ?? new Map<string, number>();
    const isFullSnapshotTick = game.currentTick % this.FULL_SNAPSHOT_INTERVAL === 0 || game.currentTick === 1;
    
    let marketPricesSnapshot: Record<string, number> | undefined;
    let priceDelta: Record<string, number> | undefined;
    
    if (isFullSnapshotTick) {
      // 完整快照：发送所有价格
      marketPricesSnapshot = {};
      for (const [goodsId, price] of game.marketPrices) {
        marketPricesSnapshot[goodsId] = price;
      }
      // 更新缓存
      this.lastSentPrices.set(gameId, new Map(game.marketPrices));
    } else {
      // 增量更新：只发送变化的价格
      priceDelta = {};
      let hasChanges = false;
      
      for (const [goodsId, price] of game.marketPrices) {
        const lastPrice = lastPrices.get(goodsId);
        // 只有价格确实变化时才包含在增量中
        if (lastPrice === undefined || lastPrice !== price) {
          priceDelta[goodsId] = price;
          hasChanges = true;
        }
      }
      
      // 如果没有任何变化，不发送增量
      if (!hasChanges) {
        priceDelta = undefined;
      } else {
        // 更新缓存
        for (const [goodsId, price] of Object.entries(priceDelta)) {
          lastPrices.set(goodsId, price);
        }
        this.lastSentPrices.set(gameId, lastPrices);
      }
    }
    
    // 获取AI公司摘要
    const aiCompaniesSummary = aiCompanyManager.getCompaniesSummary();
    
    // 获取玩家库存快照
    const inventorySnapshot = inventoryManager.getInventorySnapshot(
      game.playerCompanyId,
      game.marketPrices
    );
    
    // 收集建筑短缺信息 - 检查所有建筑的原料可用性（不仅仅是已停工的）
    const buildingShortages: TickUpdate['buildingShortages'] = [];
    // 收集等待材料建筑的信息
    const buildingMaterialShortages: TickUpdate['buildingMaterialShortages'] = [];
    
    for (const building of game.buildings) {
      // 获取建筑定义和当前生产方式
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) continue;
      
      // 处理等待材料状态的建筑
      if (building.status === 'waiting_materials') {
        const constructionMaterials = building.requiredConstructionMaterials ?? getConstructionMaterials(def);
        const missingMaterials: Array<{
          goodsId: string;
          goodsName: string;
          needed: number;
          available: number;
        }> = [];
        
        for (const material of constructionMaterials) {
          const available = inventoryManager.getAvailableQuantity(game.playerCompanyId, material.goodsId);
          if (available < material.amount) {
            const goodsDef = GOODS_DATA.find(g => g.id === material.goodsId);
            missingMaterials.push({
              goodsId: material.goodsId,
              goodsName: goodsDef?.nameZh ?? material.goodsId,
              needed: material.amount,
              available,
            });
          }
        }
        
        // 即使材料已齐全（即将开始建造），也报告当前状态
        buildingMaterialShortages.push({
          buildingId: building.id,
          buildingName: building.name,
          status: 'waiting_materials',
          missingMaterials,
        });
        
        // 同时添加到 buildingShortages 以便 UI 统一显示
        buildingShortages.push({
          buildingId: building.id,
          buildingName: building.name,
          status: 'waiting_materials',
          missingInputs: missingMaterials,
        });
        
        continue; // 等待材料的建筑不需要检查生产原料
      }
      
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      if (!method) continue;
      
      // 获取技术效果修饰符
      const techModifiers = technologyEffectManager.getBuildingModifiers(
        building.definitionId,
        def.category
      );
      
      // 获取聚合因子（默认为1）- 与 processBuildingProduction 保持一致
      const aggregatedCount = building.aggregatedCount ?? 1;
      
      // 检查缺少的原料 - 使用与 processBuildingProduction 完全相同的计算方式
      const missingInputs: Array<{
        goodsId: string;
        goodsName: string;
        needed: number;
        available: number;
      }> = [];
      
      for (const input of method.recipe.inputs) {
        // 重要：这里要乘以 aggregatedCount，与 processBuildingProduction 保持一致
        const adjustedAmount = input.amount * techModifiers.inputMultiplier * aggregatedCount;
        const available = inventoryManager.getAvailableQuantity(game.playerCompanyId, input.goodsId);
        if (available < adjustedAmount) {
          // 查找商品名称
          const goodsDef = GOODS_DATA.find(g => g.id === input.goodsId);
          missingInputs.push({
            goodsId: input.goodsId,
            goodsName: goodsDef?.nameZh ?? input.goodsId,
            needed: adjustedAmount,
            available,
          });
        }
      }
      
      // 如果有任何短缺，报告建筑
      // 注意：即使 building.status 是 'running'，如果实际缺料也要报告
      // 这确保客户端能立即得知短缺状态
      if (missingInputs.length > 0) {
        buildingShortages.push({
          buildingId: building.id,
          buildingName: building.name,
          // 如果有缺料，报告为 no_input；否则使用实际状态
          status: 'no_input',
          missingInputs,
        });
      } else if (building.status === 'no_power' || building.status === 'paused') {
        // 没有缺料但处于其他停工状态
        buildingShortages.push({
          buildingId: building.id,
          buildingName: building.name,
          status: building.status as 'no_power' | 'paused',
          missingInputs: [],
        });
      }
    }
    
    // 将成交量数据转换为Record格式
    const tickVolumesRecord: Record<string, { total: number; buy: number; sell: number }> = {};
    for (const [goodsId, vol] of tickVolumeByGoods) {
      tickVolumesRecord[goodsId] = vol;
    }
    
    // 收集建筑进度信息（用于实时更新前端建造进度）
    const buildingsProgress: TickUpdate['buildingsProgress'] = [];
    for (const building of game.buildings) {
      // 只包含需要更新进度的建筑（建造中、等待材料、停工）
      if (building.status === 'under_construction' ||
          building.status === 'waiting_materials' ||
          building.status === 'no_input') {
        // 构建进度对象，避免 exactOptionalPropertyTypes 问题
        const progressEntry: NonNullable<TickUpdate['buildingsProgress']>[number] = {
          buildingId: building.id,
          status: building.status,
        };
        // 只有在值存在时才添加可选属性
        if (building.constructionProgress !== undefined) {
          progressEntry.constructionProgress = building.constructionProgress;
        }
        if (building.constructionTimeRequired !== undefined) {
          progressEntry.constructionTimeRequired = building.constructionTimeRequired;
        }
        if (building.productionProgress !== undefined) {
          progressEntry.productionProgress = building.productionProgress;
        }
        buildingsProgress.push(progressEntry);
      }
    }
    
    // Emit tick update
    // 使用条件展开语法避免将 undefined 赋值给可选属性（exactOptionalPropertyTypes）
    const update: TickUpdate = {
      gameId,
      tick: game.currentTick,
      timestamp: game.lastUpdate,
      playerCash: game.playerCash,
      buildingCount: game.buildings.length,
      financials,
      isFullSnapshot: isFullSnapshotTick,
      // 优化：使用增量更新减少数据传输（条件展开避免 undefined）
      ...(isFullSnapshotTick && marketPricesSnapshot ? { marketPrices: marketPricesSnapshot } : {}),
      ...(!isFullSnapshotTick && priceDelta ? { priceDelta } : {}),
      ...(marketChanges.length > 0 ? { marketChanges } : {}),
      ...(events.length > 0 ? { events } : {}),
      aiCompanies: aiCompaniesSummary,
      ...(aiResult.events.length > 0 ? { competitionEvents: aiResult.events } : {}),
      ...(aiResult.news.length > 0 ? { aiNews: aiResult.news } : {}),
      ...(pendingEvents.length > 0 ? { marketEvents: pendingEvents } : {}),
      ...((completedProjects.length > 0 || newTechnologies.length > 0) ? {
        researchUpdates: { completedProjects, newTechnologies }
      } : {}),
      ...(economyResult.trades.length > 0 ? { trades: economyResult.trades } : {}),
      economyStats: {
        totalNPCCompanies: economyResult.stats.totalNPCCompanies,
        totalActiveOrders: economyResult.stats.totalActiveOrders,
        totalTradesThisTick: economyResult.stats.totalTradesThisTick,
      },
      ...(inventorySnapshot ? { inventory: inventorySnapshot } : {}),
      ...(buildingShortages.length > 0 ? { buildingShortages } : {}),
      ...(buildingMaterialShortages.length > 0 ? { buildingMaterialShortages } : {}),
      ...(Object.keys(tickVolumesRecord).length > 0 ? { tickVolumes: tickVolumesRecord } : {}),
      ...(buildingsProgress.length > 0 ? { buildingsProgress } : {}),
    };
    
    // 结束性能采样
    performanceProfiler.endTick();
    
    // 每100 tick输出一次性能报告
    if (game.currentTick % 100 === 0) {
      performanceProfiler.logReport(100);
    }
    
    this.emit('tick', update);
  }
  
  /**
   * 处理完成的研发项目（异步）
   */
  private async processCompletedResearch(
    projectIds: string[],
    currentTick: number,
    newTechnologies: Array<{ id: string; name: string; category: string }>
  ): Promise<void> {
    for (const projectId of projectIds) {
      try {
        const result = await researchService.completeResearch(projectId, currentTick);
        if (result.success && result.technology) {
          newTechnologies.push({
            id: result.technology.id,
            name: result.technology.nameZh,
            category: result.technology.category as string,
          });
          console.log(`[GameLoop] New technology invented: ${result.technology.nameZh}`);
          
          // 激活技术效果
          const tech = result.technology;
          technologyEffectManager.activateTechnology(
            tech.id,
            tech.nameZh,
            'player', // 玩家公司
            tech.globalModifiers ?? [],
            tech.productionMethodUnlocks ?? [],
            currentTick
          );
          console.log(`[GameLoop] Technology effects activated for: ${tech.nameZh}`);
          
          // 发出技术发明事件
          this.emit('technologyInvented', {
            technology: result.technology,
            patent: result.patent,
          });
        }
      } catch (error) {
        console.error(`[GameLoop] Failed to complete research ${projectId}:`, error);
      }
    }
  }
  
  /**
   * 高频操作：经济系统更新（每tick执行）
   * 包括：订单撮合、价格发现、NPC交易
   *
   * 支持 Worker 池并行计算：当 Worker 池可用时，将批量价格计算任务
   * 分发到 Worker 线程执行，释放主线程
   */
  private processHighFrequencyOperations(
    game: GameState,
    _scheduler: ReturnType<typeof tickSchedulerFactory.getScheduler>
  ): { trades: TradeRecord[]; stats: { totalNPCCompanies: number; totalActiveOrders: number; totalTradesThisTick: number } } {
    // 更新经济系统（NPC交易、订单撮合、价格发现）
    const economyResult = economyManager.update(game.currentTick);
    
    // 同步经济系统的价格到游戏状态
    const economyPrices = economyManager.getAllMarketPrices();
    for (const [goodsId, price] of economyPrices) {
      game.marketPrices.set(goodsId, price);
    }
    
    // 尝试使用 Worker 池进行批量价格计算（异步，不阻塞主循环）
    // 这里我们触发一个异步任务，结果在下一个 tick 生效
    this.triggerWorkerPriceCalculation(game);
    
    return economyResult;
  }
  
  /**
   * 触发 Worker 池进行批量价格计算
   * 异步执行，不阻塞主线程
   */
  private triggerWorkerPriceCalculation(game: GameState): void {
    const workerPool = getPriceWorkerPool();
    if (!workerPool) return;
    
    // 每 10 个 tick 执行一次 Worker 计算（避免过于频繁）
    if (game.currentTick % 10 !== 0) return;
    
    // 准备批量计算数据
    const goods: Array<{
      goodsId: string;
      basePrice: number;
      supply: number;
      demand: number;
      lastTradePrice?: number;
    }> = [];
    
    for (const [goodsId, data] of game.supplyDemand) {
      const basePrice = GOODS_BASE_PRICES.get(goodsId) ?? 1000;
      goods.push({
        goodsId,
        basePrice,
        supply: data.supply,
        demand: data.demand,
        lastTradePrice: data.lastPrice,
      });
    }
    
    if (goods.length === 0) return;
    
    this.workerTaskCount++;
    
    // 异步执行，不等待结果
    workerPool.execute<
      { goods: typeof goods; options: { elasticity: number; useLastTradePrice: boolean } },
      Record<string, number>
    >('BATCH_CALCULATE', {
      goods,
      options: { elasticity: 0.1, useLastTradePrice: true },
    })
      .then(calculatedPrices => {
        this.workerSuccessCount++;
        // 结果可用于验证或调试，但不直接覆盖价格
        // 因为经济系统已经有自己的价格发现机制
        if (game.currentTick % 100 === 0) {
          console.log(`[GameLoop] Worker 计算完成: ${Object.keys(calculatedPrices).length} 个商品价格`);
        }
      })
      .catch(error => {
        this.workerFailCount++;
        if (game.currentTick % 100 === 0) {
          console.warn(`[GameLoop] Worker 计算失败:`, error);
        }
      });
  }
  
  /**
   * 高频操作：建筑生产处理（每tick执行）
   * 处理玩家所有建筑的生产周期、原料消耗、产品产出
   */
  private processBuildingProduction(
    game: GameState,
    _scheduler: ReturnType<typeof tickSchedulerFactory.getScheduler>
  ): { totalIncome: number; totalInputCost: number; totalMaintenance: number; buildingProfits: BuildingProfit[] } {
    let totalIncome = 0;
    let totalInputCost = 0;
    let totalMaintenance = 0;
    const buildingProfits: BuildingProfit[] = [];
    
    const TICKS_PER_MONTH = 30; // 1 tick = 1天，30天/月
    
    // === 诊断日志：每100tick输出一次建筑处理摘要 ===
    const shouldLogDiagnostics = game.currentTick % 100 === 1;
    if (shouldLogDiagnostics && game.buildings.length > 0) {
      console.log(`\n[BuildingProduction] ===== tick ${game.currentTick} 建筑生产诊断 =====`);
      console.log(`[BuildingProduction] 玩家建筑总数: ${game.buildings.length}`);
    }
    
    for (const building of game.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) {
        if (shouldLogDiagnostics) {
          console.log(`[BuildingProduction] ⚠️ 建筑 ${building.id} 定义未找到: ${building.definitionId}`);
        }
        continue;
      }
      
      // === 诊断日志：输出每个建筑的状态 ===
      if (shouldLogDiagnostics) {
        console.log(`[BuildingProduction] 建筑: ${building.name} (${building.id})`);
        console.log(`  - 状态: ${building.status}`);
        console.log(`  - 定义ID: ${building.definitionId}`);
        console.log(`  - 生产进度: ${building.productionProgress}`);
        console.log(`  - 效率: ${building.efficiency}, 利用率: ${building.utilization}`);
        if (building.constructionProgress !== undefined) {
          console.log(`  - 建造进度: ${building.constructionProgress}/${building.constructionTimeRequired}`);
        }
      }
      
      // 获取当前生产方式
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId)
                   ?? slot?.methods[0];
      
      if (!method) continue;
      
      const recipe = method.recipe;
      
      // 获取技术效果修饰符
      const techModifiers = technologyEffectManager.getBuildingModifiers(
        building.definitionId,
        def.category
      );
      
      // 获取聚合因子（默认为1）
      const aggregatedCount = building.aggregatedCount ?? 1;
      
      // 维护成本每 tick 都产生
      // 重要改进：停工建筑（no_input/no_power）只收取50%维护费
      // 等待材料状态收取25%维护费
      // 维护成本 × 聚合因子（代表多个工厂）
      let maintenanceMultiplier = 1.0;
      if (building.status === 'no_input' || building.status === 'no_power') {
        maintenanceMultiplier = 0.5;
      } else if (building.status === 'paused' || building.status === 'waiting_materials') {
        maintenanceMultiplier = 0.25;
      }
      const buildingMaintenance = (def.maintenanceCost / TICKS_PER_MONTH) * techModifiers.costMultiplier * maintenanceMultiplier * aggregatedCount;
      totalMaintenance += buildingMaintenance;
      
      let buildingIncome = 0;
      let buildingInputCost = 0;
      let produced = false;
      
      // 处理等待材料的建筑
      if (building.status === 'waiting_materials') {
        // 获取建造所需材料
        const constructionMaterials = building.requiredConstructionMaterials ?? getConstructionMaterials(def);
        const constructionTime = getConstructionTime(def);
        
        // 检查材料是否齐全，同时收集缺失材料
        let hasAllMaterials = true;
        const missingMaterialsList: Array<{ goodsId: string; needed: number; available: number }> = [];
        for (const material of constructionMaterials) {
          const available = inventoryManager.getAvailableQuantity(game.playerCompanyId, material.goodsId);
          if (available < material.amount) {
            hasAllMaterials = false;
            missingMaterialsList.push({
              goodsId: material.goodsId,
              needed: material.amount,
              available,
            });
          }
        }
        
        // 如果有缺失材料，触发自动采购
        if (!hasAllMaterials && missingMaterialsList.length > 0) {
          this.autoPurchaseConstructionMaterials(game, building, missingMaterialsList);
        }
        
        if (hasAllMaterials) {
          // 消耗材料
          for (const material of constructionMaterials) {
            inventoryManager.consumeGoods(
              game.playerCompanyId,
              material.goodsId,
              material.amount,
              game.currentTick,
              `construction-${building.id}`
            );
            // 增加市场需求
            this.addDemand(game, material.goodsId, material.amount);
          }
          
          // 转换为建造中状态
          building.status = 'under_construction';
          building.constructionProgress = 0;
          building.constructionTimeRequired = constructionTime;
          delete building.requiredConstructionMaterials;
          
          console.log(`[GameLoop] Building ${building.name} started construction - materials collected`);
        }
        
        // 等待材料状态：不产生收益，只收取25%维护费
        buildingProfits.push({
          buildingId: building.id,
          name: building.name + ' (等待材料)',
          income: 0,
          inputCost: 0,
          maintenance: buildingMaintenance,
          net: -buildingMaintenance,
          produced: false,
          avgNet: 0,
        });
        continue; // 跳过生产逻辑
      }
      
      // 处理建造中的建筑
      if (building.status === 'under_construction') {
        // 推进建造进度
        building.constructionProgress = (building.constructionProgress ?? 0) + 1;
        const constructionTimeRequired = building.constructionTimeRequired ?? 24;
        
        if (building.constructionProgress >= constructionTimeRequired) {
          // 建造完成，转为运营状态
          building.status = 'running';
          // 使用 delete 操作符移除可选属性，避免 exactOptionalPropertyTypes 错误
          delete building.constructionProgress;
          delete building.constructionTimeRequired;
          console.log(`[GameLoop] Building construction completed: ${building.name} (${building.id})`);
        }
        
        // 建造中不产生收益也不消耗资源（只收维护费的50%）
        buildingProfits.push({
          buildingId: building.id,
          name: building.name + ' (建造中)',
          income: 0,
          inputCost: 0,
          maintenance: buildingMaintenance,
          net: -buildingMaintenance,
          produced: false,
          avgNet: 0,
        });
        continue; // 跳过生产逻辑
      }
      
      // 只有 running 状态的建筑才进行生产
      if (building.status === 'running') {
        // === 诊断日志：running状态建筑的生产处理 ===
        if (shouldLogDiagnostics) {
          console.log(`[BuildingProduction] 🏭 ${building.name} 进入生产处理`);
          console.log(`  - 配方: ${recipe.inputs.length}输入 → ${recipe.outputs.length}输出, ${recipe.ticksRequired}tick/周期`);
        }
        // 检查原料是否充足
        let hasAllInputsForProduction = true;
        const missingInputsCheck: Array<{ goodsId: string; needed: number; available: number }> = [];
        
        for (const input of recipe.inputs) {
          // 原料消耗 × 聚合因子
          const adjustedAmount = input.amount * techModifiers.inputMultiplier * aggregatedCount;
          const available = inventoryManager.getAvailableQuantity(game.playerCompanyId, input.goodsId);
          if (available < adjustedAmount) {
            hasAllInputsForProduction = false;
            missingInputsCheck.push({
              goodsId: input.goodsId,
              needed: adjustedAmount,
              available,
            });
          }
        }
        
        // 如果原料不足，切换到 no_input 状态
        if (!hasAllInputsForProduction) {
          building.status = 'no_input';
          this.autoPurchaseMaterials(game, building, missingInputsCheck);
        } else {
          // 原料充足，推进生产进度
          const effectiveEfficiency = building.efficiency * building.utilization * techModifiers.efficiencyMultiplier;
          building.productionProgress += effectiveEfficiency;
          
          // 检查是否完成了一个生产周期
          if (building.productionProgress >= recipe.ticksRequired) {
            building.productionProgress -= recipe.ticksRequired;
            produced = true;
            
            // === 诊断日志：生产周期完成 ===
            console.log(`[BuildingProduction] ✅ ${building.name} 完成一个生产周期!`);
            
            // 再次检查并消耗库存中的原料
            let hasAllInputs = true;
            for (const input of recipe.inputs) {
              const adjustedAmount = input.amount * techModifiers.inputMultiplier;
              const available = inventoryManager.getAvailableQuantity(game.playerCompanyId, input.goodsId);
              if (available < adjustedAmount) {
                hasAllInputs = false;
                break;
              }
            }
            
            if (hasAllInputs) {
              // 消耗原料 × 聚合因子
              for (const input of recipe.inputs) {
                const price = this.getPrice(game, input.goodsId);
                const adjustedAmount = input.amount * techModifiers.inputMultiplier * aggregatedCount;
                inventoryManager.consumeGoods(
                  game.playerCompanyId,
                  input.goodsId,
                  adjustedAmount,
                  game.currentTick,
                  `production-${building.id}`
                );
                buildingInputCost += adjustedAmount * price;
                this.addDemand(game, input.goodsId, adjustedAmount);
              }
              
              // 添加产出到库存 × 聚合因子
              for (const output of recipe.outputs) {
                const price = this.getPrice(game, output.goodsId);
                const adjustedAmount = output.amount * techModifiers.outputMultiplier * aggregatedCount;
                const productionCost = buildingInputCost / recipe.outputs.length;
                
                // === 诊断日志：产出详情 ===
                console.log(`[BuildingProduction] 📦 产出: ${output.goodsId} x${adjustedAmount.toFixed(1)} (基础${output.amount} × 修饰符${techModifiers.outputMultiplier.toFixed(2)} × 聚合${aggregatedCount})`);
                
                inventoryManager.addGoods(
                  game.playerCompanyId,
                  output.goodsId,
                  adjustedAmount,
                  productionCost / adjustedAmount,
                  game.currentTick,
                  `production-${building.id}`
                );
                buildingIncome += adjustedAmount * price;
                this.addSupply(game, output.goodsId, adjustedAmount);
                
                // === 诊断日志：确认库存更新 ===
                const newQty = inventoryManager.getAvailableQuantity(game.playerCompanyId, output.goodsId);
                console.log(`[BuildingProduction] 📊 库存更新后: ${output.goodsId} = ${newQty.toFixed(1)}`);
              }
            } else {
              building.status = 'no_input';
              produced = false;
            }
          }
        }
      } else if (building.status === 'no_input') {
        // 尝试恢复：检查原料是否已经充足
        let hasAllInputs = true;
        const missingInputs: Array<{ goodsId: string; needed: number; available: number }> = [];
        
        for (const input of recipe.inputs) {
          // 原料检查也要 × 聚合因子
          const adjustedAmount = input.amount * techModifiers.inputMultiplier * aggregatedCount;
          const available = inventoryManager.getAvailableQuantity(game.playerCompanyId, input.goodsId);
          if (available < adjustedAmount) {
            hasAllInputs = false;
            missingInputs.push({
              goodsId: input.goodsId,
              needed: adjustedAmount,
              available,
            });
          }
        }
        
        if (hasAllInputs) {
          building.status = 'running';
        } else {
          this.autoPurchaseMaterials(game, building, missingInputs);
        }
      }
      // paused 状态不做处理
      
      totalIncome += buildingIncome;
      totalInputCost += buildingInputCost;
      
      // 计算当前周期的净利润
      const currentNet = buildingIncome - buildingInputCost - buildingMaintenance;
      
      // 获取或初始化该建筑的收益历史
      let gameHistory = this.buildingProfitHistory.get(game.id);
      if (!gameHistory) {
        gameHistory = new Map();
        this.buildingProfitHistory.set(game.id, gameHistory);
      }
      
      let history = gameHistory.get(building.id);
      if (!history) {
        history = { recentProfits: [], avgNet: 0 };
        gameHistory.set(building.id, history);
      }
      
      // 更新滚动平均：只在完成生产周期时才记录收益
      if (produced) {
        const cycleTotalNet = buildingIncome - buildingInputCost;
        const cycleMaintenanceCost = buildingMaintenance * recipe.ticksRequired;
        const fullCycleNet = cycleTotalNet - cycleMaintenanceCost;
        const avgPerTick = fullCycleNet / recipe.ticksRequired;
        history.recentProfits.push(avgPerTick);
        
        if (history.recentProfits.length > this.PROFIT_HISTORY_SIZE) {
          history.recentProfits.shift();
        }
        
        if (history.recentProfits.length > 0) {
          const sum = history.recentProfits.reduce((a, b) => a + b, 0);
          history.avgNet = sum / history.recentProfits.length;
        }
      }
      
      buildingProfits.push({
        buildingId: building.id,
        name: building.name,
        income: buildingIncome,
        inputCost: buildingInputCost,
        maintenance: buildingMaintenance,
        net: currentNet,
        produced,
        avgNet: history.avgNet,
      });
    }
    
    // 维护成本从库存现金中扣除
    if (totalMaintenance > 0) {
      inventoryManager.deductCash(
        game.playerCompanyId,
        totalMaintenance,
        game.currentTick,
        'maintenance'
      );
    }
    
    // 同步玩家现金
    const updatedInventory = inventoryManager.getInventory(game.playerCompanyId);
    if (updatedInventory) {
      game.playerCash = updatedInventory.cash;
    }
    
    return { totalIncome, totalInputCost, totalMaintenance, buildingProfits };
  }
  
  /**
   * 低频操作：建筑状态诊断日志
   */
  private logBuildingDiagnostics(game: GameState): void {
    console.log(`[GameLoop] 玩家建筑诊断 (tick=${game.currentTick}):`);
    for (const building of game.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) continue;
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      if (!method) continue;
      
      // 检查原料库存
      const inputStatus: string[] = [];
      for (const input of method.recipe.inputs) {
        const available = inventoryManager.getAvailableQuantity(game.playerCompanyId, input.goodsId);
        const needed = input.amount;
        const status = available >= needed ? '✓' : `✗(需${needed},有${available.toFixed(1)})`;
        inputStatus.push(`${input.goodsId}:${status}`);
      }
      
      console.log(`  - ${building.name}: 状态=${building.status}, 进度=${building.productionProgress.toFixed(1)}/${method.recipe.ticksRequired}, 原料=[${inputStatus.join(', ')}]`);
    }
  }
  
  /**
   * 处理基础消费需求 - 模拟城市POPs的持续消费
   * 使用 GoodsRegistry 自动获取消费需求配置
   *
   * 增加了周期性波动机制，模拟季节性需求变化
   * @param game 游戏状态
   * @param frequencyMultiplier 频率倍数（用于补偿中频执行时的需求量）
   */
  private processBasicConsumerDemand(game: GameState, frequencyMultiplier: number = 1): void {
    // 从注册表获取消费需求映射
    // consumerDemandRate 由 GoodsRegistry 根据商品类别和标签自动派生
    const goodsRegistry = getGoodsRegistry();
    const consumerDemandMap = goodsRegistry.getConsumerDemandMap();
    
    // 如果注册表未初始化或没有消费品，使用备用硬编码（向后兼容）
    if (consumerDemandMap.size === 0) {
      this.processBasicConsumerDemandLegacy(game);
      return;
    }
    
    // 需求波动参数
    const amplitude = MARKET_CONSTANTS?.DEMAND_FLUCTUATION_AMPLITUDE ?? 0.3;
    const cycleLength = MARKET_CONSTANTS?.DEMAND_FLUCTUATION_CYCLE ?? 30;
    
    // 为每种商品增加基础需求（带周期性波动）
    let phaseOffset = 0;
    const totalGoods = consumerDemandMap.size;
    
    for (const [goodsId, baseDemand] of consumerDemandMap) {
      // 计算周期性波动：使用正弦函数，每个商品有不同的相位偏移
      // 这样不同商品的需求高峰期不同，更加真实
      const phase = (game.currentTick + phaseOffset) / cycleLength * Math.PI * 2;
      const cyclicMultiplier = 1 + Math.sin(phase) * amplitude;
      
      // 添加小幅随机噪声 (±10%)
      const noise = 0.9 + Math.random() * 0.2;
      
      // 最终需求 = 基础需求 × 周期波动 × 随机噪声 × 频率补偿
      const demand = baseDemand * cyclicMultiplier * noise * frequencyMultiplier;
      this.addDemand(game, goodsId, demand);
      
      // 每个商品相位偏移，使波动交错
      phaseOffset += cycleLength / totalGoods;
    }
  }
  
  /**
   * 备用：处理基础消费需求（旧版硬编码，用于向后兼容）
   * @deprecated 应使用 GoodsRegistry 的消费需求配置
   */
  private processBasicConsumerDemandLegacy(game: GameState): void {
    // 基础消费需求配置 - 根据商品类型分配不同的基础需求量
    const BASE_CONSUMER_DEMAND: Record<string, number> = {
      // 原材料
      'iron-ore': 20, 'coal': 15, 'crude-oil': 25, 'copper-ore': 12,
      'natural-gas': 18, 'silica-sand': 10, 'bauxite': 8, 'rubber': 10,
      'rare-earth': 5, 'lithium': 8, 'grain': 30, 'vegetables': 25,
      'meat': 15, 'dairy': 20,
      // 加工品
      'steel': 30, 'aluminum': 25, 'glass': 20, 'cement': 15,
      'plastic': 25, 'chemicals': 20, 'copper': 18, 'refined-fuel': 30,
      'silicon-wafer': 15,
      // 服务
      'electricity': 50, 'computing-power': 20,
      // 中间产品
      'battery-pack': 15, 'battery-cell': 12, 'display-panel': 12,
      'semiconductor-chip': 20, 'advanced-chip': 5, 'pcb': 18,
      'electric-motor': 10, 'mechanical-parts': 15, 'sensors': 12,
      'engine': 8, 'auto-parts': 10,
      // 消费品
      'smartphone': 8, 'premium-smartphone': 3, 'personal-computer': 5,
      'smart-tv': 4, 'electric-vehicle': 2, 'premium-ev': 1,
      'gasoline-car': 3, 'household-goods': 10, 'home-appliance': 6,
      'gaming-console': 4, 'vr-headset': 2,
      // 食品
      'packaged-food': 25, 'processed-meat': 15, 'beverages': 30,
    };
    
    const amplitude = MARKET_CONSTANTS?.DEMAND_FLUCTUATION_AMPLITUDE ?? 0.3;
    const cycleLength = MARKET_CONSTANTS?.DEMAND_FLUCTUATION_CYCLE ?? 30;
    
    let phaseOffset = 0;
    for (const [goodsId, baseDemand] of Object.entries(BASE_CONSUMER_DEMAND)) {
      const phase = (game.currentTick + phaseOffset) / cycleLength * Math.PI * 2;
      const cyclicMultiplier = 1 + Math.sin(phase) * amplitude;
      const noise = 0.9 + Math.random() * 0.2;
      const demand = baseDemand * cyclicMultiplier * noise;
      this.addDemand(game, goodsId, demand);
      phaseOffset += cycleLength / Object.keys(BASE_CONSUMER_DEMAND).length;
    }
  }
  
  /**
   * 增加商品供给
   */
  private addSupply(game: GameState, goodsId: string, amount: number): void {
    let data = game.supplyDemand.get(goodsId);
    if (!data) {
      const basePrice = game.marketPrices.get(goodsId) ?? GOODS_BASE_PRICES.get(goodsId) ?? 1000;
      data = {
        supply: 1000,
        demand: 1000,
        lastPrice: basePrice,
        priceVelocity: 0,
      };
      game.supplyDemand.set(goodsId, data);
    }
    data.supply += amount;
  }
  
  /**
   * 自动采购建筑缺少的原料
   * 为每个缺少的原料提交市场买单
   * 带有订单追踪机制，防止重复提交
   *
   * 重要安全机制：
   * - 资金保护：现金低于初始资金的10%时暂停自动采购
   * - 单次采购不超过可用资金的30%
   * - 采购数量基于生产周期而非无限补货
   */
  private autoPurchaseMaterials(
    game: GameState,
    building: BuildingInstance,
    missingInputs: Array<{ goodsId: string; needed: number; available: number }>
  ): void {
    const playerInventory = inventoryManager.getInventory(game.playerCompanyId);
    if (!playerInventory) return;
    
    // ===== 资金保护机制 =====
    // 初始资金为5亿，10%阈值=5000万
    // 当现金低于此阈值时，暂停所有自动采购，防止资金链完全断裂
    const CASH_PROTECTION_THRESHOLD = 50000000; // 5000万
    if (playerInventory.cash < CASH_PROTECTION_THRESHOLD) {
      // 每100 tick输出一次警告，避免日志刷屏
      if (game.currentTick % 100 === 0) {
        console.log(`[GameLoop] ⚠️ 资金保护: 现金(${(playerInventory.cash / 1000000).toFixed(1)}M) < 阈值(${CASH_PROTECTION_THRESHOLD / 1000000}M)，暂停自动采购`);
      }
      return;
    }
    
    // 资金安全阈值：单次采购不超过可用资金的30%
    const MAX_SPEND_RATIO = 0.3;
    const maxSpendPerOrder = playerInventory.cash * MAX_SPEND_RATIO;
    
    // 计算每个缺少的原料需要购买多少
    for (const missing of missingInputs) {
      const shortage = missing.needed - missing.available;
      if (shortage <= 0) continue;
      
      // 生成追踪键
      const trackingKey = `${building.id}-${missing.goodsId}`;
      
      // 检查是否已有未成交的采购订单
      const existingOrderId = this.pendingPurchaseOrders.get(trackingKey);
      if (existingOrderId) {
        // 检查订单是否仍然有效
        const existingOrder = marketOrderBook.getOrder(existingOrderId);
        if (existingOrder && (existingOrder.status === 'open' || existingOrder.status === 'partial')) {
          // 订单仍在进行中，跳过
          continue;
        } else {
          // 订单已完成/过期/取消，清理追踪
          this.pendingPurchaseOrders.delete(trackingKey);
        }
      }
      
      // 获取当前市场价格
      const marketPrice = this.getPrice(game, missing.goodsId);
      
      // 使用市场价格的1.15倍作为最高愿意支付的价格（更容易成交）
      const maxPrice = marketPrice * 1.15;
      
      // 计算期望采购量（20个周期的量，确保充足库存）
      const desiredPurchaseAmount = Math.max(shortage * 20, 50);
      
      // 资金安全检查：限制单次采购不超过可用资金的30%
      const affordableByLimit = Math.floor(maxSpendPerOrder / maxPrice);
      
      // 取两者中较小的值
      const purchaseAmount = Math.min(desiredPurchaseAmount, affordableByLimit);
      
      // 至少要能买到1个单位
      if (purchaseAmount < 1) {
        console.log(`[GameLoop] 自动采购: 资金不足购买 ${missing.goodsId}, 最高可负担 ${affordableByLimit.toFixed(0)} 单位 (单价: ${maxPrice.toFixed(0)})`);
        continue;
      }
      
      // 最终资金检查
      const totalCost = maxPrice * purchaseAmount;
      if (playerInventory.cash < totalCost) {
        console.log(`[GameLoop] 自动采购: 资金不足购买 ${missing.goodsId}, 需要 ${totalCost.toFixed(0)}, 可用 ${playerInventory.cash.toFixed(0)}`);
        continue;
      }
      
      // 提交买单
      const result = economyManager.playerSubmitBuyOrder(
        game.playerCompanyId,
        missing.goodsId,
        purchaseAmount,
        maxPrice
      );
      
      if (result.success && result.order) {
        // 记录订单ID以追踪
        this.pendingPurchaseOrders.set(trackingKey, result.order.id);
        console.log(`[GameLoop] 自动采购: ${building.name} 购买 ${purchaseAmount.toFixed(0)} ${missing.goodsId} @ ${maxPrice.toFixed(0)} (限价${(purchaseAmount / desiredPurchaseAmount * 100).toFixed(0)}%)`);
      }
    }
  }
  
  /**
   * 自动采购建造材料
   * 为等待材料的建筑提交市场买单
   */
  private autoPurchaseConstructionMaterials(
    game: GameState,
    building: BuildingInstance,
    missingMaterials: Array<{ goodsId: string; needed: number; available: number }>
  ): void {
    const playerInventory = inventoryManager.getInventory(game.playerCompanyId);
    if (!playerInventory) return;
    
    // 资金保护机制
    const CASH_PROTECTION_THRESHOLD = 50000000; // 5000万
    if (playerInventory.cash < CASH_PROTECTION_THRESHOLD) {
      if (game.currentTick % 100 === 0) {
        console.log(`[GameLoop] ⚠️ 建造材料采购: 资金保护中，现金(${(playerInventory.cash / 1000000).toFixed(1)}M) < 阈值(${CASH_PROTECTION_THRESHOLD / 1000000}M)`);
      }
      return;
    }
    
    const MAX_SPEND_RATIO = 0.3;
    const maxSpendPerOrder = playerInventory.cash * MAX_SPEND_RATIO;
    
    for (const missing of missingMaterials) {
      const shortage = missing.needed - missing.available;
      if (shortage <= 0) continue;
      
      // 生成追踪键
      const trackingKey = `construction-${building.id}-${missing.goodsId}`;
      
      // 检查是否已有未成交的采购订单
      const existingOrderId = this.pendingPurchaseOrders.get(trackingKey);
      if (existingOrderId) {
        const existingOrder = marketOrderBook.getOrder(existingOrderId);
        if (existingOrder && (existingOrder.status === 'open' || existingOrder.status === 'partial')) {
          continue;
        } else {
          this.pendingPurchaseOrders.delete(trackingKey);
        }
      }
      
      const marketPrice = this.getPrice(game, missing.goodsId);
      const maxPrice = marketPrice * 1.20; // 建造材料溢价20%
      
      // 采购刚好需要的量
      const desiredPurchaseAmount = Math.ceil(shortage);
      const affordableByLimit = Math.floor(maxSpendPerOrder / maxPrice);
      const purchaseAmount = Math.min(desiredPurchaseAmount, affordableByLimit);
      
      if (purchaseAmount < 1) {
        console.log(`[GameLoop] 建造材料采购: 资金不足购买 ${missing.goodsId}`);
        continue;
      }
      
      const totalCost = maxPrice * purchaseAmount;
      if (playerInventory.cash < totalCost) continue;
      
      const result = economyManager.playerSubmitBuyOrder(
        game.playerCompanyId,
        missing.goodsId,
        purchaseAmount,
        maxPrice
      );
      
      if (result.success && result.order) {
        this.pendingPurchaseOrders.set(trackingKey, result.order.id);
        console.log(`[GameLoop] 建造材料采购: ${building.name} 购买 ${purchaseAmount} ${missing.goodsId} @ ${maxPrice.toFixed(0)}`);
      }
    }
  }
  
  /**
   * 增加商品需求
   */
  private addDemand(game: GameState, goodsId: string, amount: number): void {
    let data = game.supplyDemand.get(goodsId);
    if (!data) {
      const basePrice = game.marketPrices.get(goodsId) ?? GOODS_BASE_PRICES.get(goodsId) ?? 1000;
      data = {
        supply: 1000,
        demand: 1000,
        lastPrice: basePrice,
        priceVelocity: 0,
      };
      game.supplyDemand.set(goodsId, data);
    }
    data.demand += amount;
  }
  
  /**
   * Reset a game to initial state
   */
  resetGame(gameId: string): GameState | undefined {
    const existingGame = this.games.get(gameId);
    if (!existingGame) return undefined;
    
    // Stop the current loop
    this.stopGameLoop(gameId);
    
    // Delete the old game
    this.games.delete(gameId);
    
    // 重置经济系统
    economyManager.reset();
    
    // 重置股票市场
    stockMarketService.reset();
    
    // 重置AI股票交易服务
    aiStockTradingService.reset();
    
    // Create a fresh game
    const newGame = this.getOrCreateGame(gameId, existingGame.playerCompanyId);
    
    console.log(`[GameLoop] Game ${gameId} has been reset`);
    
    this.emit('gameReset', { gameId });
    
    return newGame;
  }
  
  /**
   * Clean up when a game is no longer needed
   */
  destroyGame(gameId: string): void {
    this.stopGameLoop(gameId);
    this.games.delete(gameId);
  }
  
  /**
   * 批量生成市场事件（异步，使用LLM一次生成3个事件）
   * 事件会在接下来200 tick内随机时间触发
   */
  private async generateMarketEventsBatch(game: GameState): Promise<void> {
    // 收集当前市场状态
    const marketConditions: string[] = [];
    const playerDominance: Record<string, number> = {};
    
    // 分析玩家市场份额
    for (const building of game.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (def?.category) {
        playerDominance[def.category] = (playerDominance[def.category] ?? 0) + 1;
      }
    }
    
    // 分析市场条件
    for (const [goodsId, data] of game.supplyDemand) {
      const ratio = data.supply > 0 ? data.demand / data.supply : 2;
      if (ratio > 1.5) {
        marketConditions.push(`${goodsId}供不应求`);
      } else if (ratio < 0.6) {
        marketConditions.push(`${goodsId}供过于求`);
      }
    }
    
    try {
      console.log(`[GameLoop] 正在批量生成市场事件 (tick=${game.currentTick})...`);
      
      const eventsResult = await llmService.generateMarketEventsBatch({
        currentTick: game.currentTick,
        marketConditions: marketConditions.slice(0, 3).join(', ') || '市场平稳',
        playerDominance,
        eventCount: 3,
      });
      
      if (eventsResult && eventsResult.length > 0) {
        const scheduled = this.scheduledMarketEvents.get(game.id) ?? [];
        
        for (let i = 0; i < eventsResult.length; i++) {
          const eventResult = eventsResult[i];
          if (!eventResult) continue;
          
          const effects: MarketEventGenerated['effects'] = {};
          if (eventResult.effects.priceChanges) {
            effects.priceChanges = eventResult.effects.priceChanges;
          }
          if (eventResult.effects.supplyChanges) {
            effects.supplyChanges = eventResult.effects.supplyChanges;
          }
          
          // 在200 tick内随机分布触发时间
          const randomOffset = Math.floor(Math.random() * this.marketEventGenerationInterval);
          const triggerTick = game.currentTick + 10 + randomOffset; // 至少等10 tick后触发
          
          // Generate a more unique ID using crypto
          const uniqueId = crypto.randomUUID();
          const marketEvent: MarketEventGenerated = {
            id: `market-event-${uniqueId}`,
            tick: triggerTick,
            type: eventResult.type as MarketEventGenerated['type'],
            severity: eventResult.severity as MarketEventGenerated['severity'],
            title: eventResult.title,
            description: eventResult.description,
            effects,
          };
          
          scheduled.push({ event: marketEvent, triggerTick });
          console.log(`[GameLoop] 市场事件预定: ${marketEvent.title} (tick=${triggerTick}, ${marketEvent.severity})`);
        }
        
        this.scheduledMarketEvents.set(game.id, scheduled);
        console.log(`[GameLoop] 批量生成完成，共${eventsResult.length}个事件已预定`);
      } else {
        console.log(`[GameLoop] 本轮无市场事件生成`);
      }
    } catch (error) {
      console.error(`[GameLoop] 市场事件生成失败:`, error);
    }
  }
  
  /**
   * 应用副作用后果
   */
  private applySideEffectConsequences(game: GameState, sideEffect: {
    type: string;
    severity: number;
    effect: { type: string };
  }): void {
    // 根据副作用类型和严重程度对游戏产生影响
    const severityMultiplier = sideEffect.severity * 0.05; // 1级=5%, 5级=25%
    
    switch (sideEffect.type) {
      case 'health':
        // 健康副作用：可能导致劳动力成本上升
        // 暂时通过降低资金来模拟
        const healthPenalty = Math.round(game.playerCash * severityMultiplier * 0.1);
        game.playerCash -= healthPenalty;
        console.log(`[GameLoop] Health side effect: -${healthPenalty} cash (severity ${sideEffect.severity})`);
        break;
        
      case 'environment':
        // 环境副作用：可能导致罚款或生产限制
        const envPenalty = Math.round(game.playerCash * severityMultiplier * 0.15);
        game.playerCash -= envPenalty;
        console.log(`[GameLoop] Environment side effect: -${envPenalty} cash (severity ${sideEffect.severity})`);
        break;
        
      case 'social':
        // 社会副作用：可能影响声誉和销售
        const socialPenalty = Math.round(game.playerCash * severityMultiplier * 0.08);
        game.playerCash -= socialPenalty;
        console.log(`[GameLoop] Social side effect: -${socialPenalty} cash (severity ${sideEffect.severity})`);
        break;
        
      case 'economic':
        // 经济副作用：直接影响成本
        const econPenalty = Math.round(game.playerCash * severityMultiplier * 0.12);
        game.playerCash -= econPenalty;
        console.log(`[GameLoop] Economic side effect: -${econPenalty} cash (severity ${sideEffect.severity})`);
        break;
        
      default:
        console.log(`[GameLoop] Unknown side effect type: ${sideEffect.type}`);
    }
  }
  
  /**
   * 应用市场事件效果
   */
  private applyMarketEventEffects(game: GameState, event: MarketEventGenerated): void {
    // 应用价格变化
    if (event.effects.priceChanges) {
      for (const [goodsId, changePercent] of Object.entries(event.effects.priceChanges)) {
        const currentPrice = game.marketPrices.get(goodsId);
        if (currentPrice !== undefined) {
          const newPrice = Math.round(currentPrice * (1 + changePercent));
          const basePrice = GOODS_BASE_PRICES.get(goodsId) ?? currentPrice;
          const minMultiplier = ECONOMY_CONSTANTS?.MIN_PRICE_MULTIPLIER ?? 0.2;
          const maxMultiplier = ECONOMY_CONSTANTS?.MAX_PRICE_MULTIPLIER ?? 5;
          
          // 限制价格范围
          const clampedPrice = Math.max(
            basePrice * minMultiplier,
            Math.min(basePrice * maxMultiplier, newPrice)
          );
          game.marketPrices.set(goodsId, clampedPrice);
          console.log(`[GameLoop] 事件影响: ${goodsId} 价格 ${currentPrice} -> ${clampedPrice} (${changePercent > 0 ? '+' : ''}${(changePercent * 100).toFixed(1)}%)`);
        }
      }
    }
    
    // 应用供给变化
    if (event.effects.supplyChanges) {
      for (const [goodsId, changePercent] of Object.entries(event.effects.supplyChanges)) {
        const data = game.supplyDemand.get(goodsId);
        if (data) {
          data.supply = Math.max(100, data.supply * (1 + changePercent));
          console.log(`[GameLoop] 事件影响: ${goodsId} 供给变化 ${(changePercent * 100).toFixed(1)}%`);
        }
      }
    }
  }

  /**
   * 输出经济循环诊断日志
   * 帮助识别供应链瓶颈和市场问题
   */
  private logEconomicDiagnostics(
    game: GameState,
    economyResult: { trades: TradeRecord[]; stats: { totalNPCCompanies: number; totalActiveOrders: number; totalTradesThisTick: number } }
  ): void {
    const playerInventory = inventoryManager.getInventory(game.playerCompanyId);
    if (!playerInventory) return;
    
    console.log(`\n========== 经济诊断 (tick=${game.currentTick}) ==========`);
    
    // Worker 池状态
    const workerPool = getPriceWorkerPool();
    if (workerPool) {
      const stats = workerPool.getStats();
      console.log(`🧵 Worker Pool: ${stats.totalWorkers} workers (${stats.busyWorkers} busy), 队列=${stats.queueLength}, 任务统计: 总${this.workerTaskCount}/成功${this.workerSuccessCount}/失败${this.workerFailCount}`);
    } else {
      console.log(`🧵 Worker Pool: 未启用（使用主线程计算）`);
    }
    
    // 1. 玩家财务状态
    console.log(`📊 玩家财务: 现金=$${(playerInventory.cash / 100).toFixed(2)}`);
    
    // 2. 玩家库存概览
    const stockSummary: string[] = [];
    for (const [goodsId, stock] of Object.entries(playerInventory.stocks)) {
      if (stock.quantity > 0) {
        stockSummary.push(`${goodsId}:${stock.quantity.toFixed(0)}`);
      }
    }
    console.log(`📦 玩家库存: ${stockSummary.length > 0 ? stockSummary.join(', ') : '无'}`);
    
    // 3. 建筑状态统计
    const statusCounts = { running: 0, paused: 0, no_input: 0, no_power: 0, under_construction: 0 };
    for (const building of game.buildings) {
      if (building.status in statusCounts) {
        statusCounts[building.status as keyof typeof statusCounts]++;
      }
    }
    console.log(`🏭 建筑状态: 运行=${statusCounts.running}, 缺料=${statusCounts.no_input}, 暂停=${statusCounts.paused}, 缺电=${statusCounts.no_power}, 建造中=${statusCounts.under_construction}`);
    
    // 4. 市场订单统计
    const orderStats = marketOrderBook.getOrderBookStats();
    console.log(`📈 市场订单: 总买单=${orderStats.totalBuyOrders}, 总卖单=${orderStats.totalSellOrders}, 本轮成交=${economyResult.stats.totalTradesThisTick}`);
    
    // 5. 检查玩家建筑需要的原料是否市场有卖
    if (game.buildings.length > 0) {
      const neededGoods = new Set<string>();
      for (const building of game.buildings) {
        const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
        if (!def) continue;
        const slot = def.productionSlots[0];
        const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
        if (!method) continue;
        for (const input of method.recipe.inputs) {
          neededGoods.add(input.goodsId);
        }
      }
      
      const supplyIssues: string[] = [];
      for (const goodsId of neededGoods) {
        const orderBook = marketOrderBook.getOrderBook(goodsId);
        const sellOrders = orderBook?.sellOrders.filter(o => o.status === 'open' || o.status === 'partial') ?? [];
        const totalAvailable = sellOrders.reduce((sum, o) => sum + o.remainingQuantity, 0);
        const bestAsk = orderBook?.bestAsk;
        
        if (sellOrders.length === 0 || totalAvailable < 10) {
          supplyIssues.push(`${goodsId}:无卖单`);
        } else {
          supplyIssues.push(`${goodsId}:${sellOrders.length}单,可用${totalAvailable.toFixed(0)},最低价$${bestAsk ? (bestAsk / 100).toFixed(2) : '?'}`);
        }
      }
      console.log(`🔍 需求原料供给: ${supplyIssues.join(' | ')}`);
    }
    
    // 6. 检查玩家产品是否有买家
    const producedGoods = new Set<string>();
    for (const building of game.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) continue;
      const slot = def.productionSlots[0];
      const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
      if (!method) continue;
      for (const output of method.recipe.outputs) {
        producedGoods.add(output.goodsId);
      }
    }
    
    if (producedGoods.size > 0) {
      const demandIssues: string[] = [];
      for (const goodsId of producedGoods) {
        const orderBook = marketOrderBook.getOrderBook(goodsId);
        const buyOrders = orderBook?.buyOrders.filter(o => o.status === 'open' || o.status === 'partial') ?? [];
        const totalDemand = buyOrders.reduce((sum, o) => sum + o.remainingQuantity, 0);
        const bestBid = orderBook?.bestBid;
        
        if (buyOrders.length === 0 || totalDemand < 10) {
          demandIssues.push(`${goodsId}:无买单`);
        } else {
          demandIssues.push(`${goodsId}:${buyOrders.length}单,需求${totalDemand.toFixed(0)},最高价$${bestBid ? (bestBid / 100).toFixed(2) : '?'}`);
        }
      }
      console.log(`🛒 产品市场需求: ${demandIssues.join(' | ')}`);
    }
    
    console.log(`===========================================\n`);
  }
  
  /**
   * Clean up all games
   */
  shutdown(): void {
    for (const gameId of this.games.keys()) {
      this.destroyGame(gameId);
    }
  }
}

// Singleton instance
export const gameLoop = new GameLoop();