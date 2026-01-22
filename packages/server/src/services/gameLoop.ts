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
} from '@scc/shared';
import { aiCompanyManager, type CompetitionEvent } from './aiCompanyManager.js';
import { llmService } from './llm.js';
import { researchService } from './researchService.js';
import { technologyEffectManager } from './technologyEffectManager.js';
import { economyManager } from './economyManager.js';
import { inventoryManager } from './inventoryManager.js';
import { autoTradeManager } from './autoTradeManager.js';
import { marketOrderBook } from './marketOrderBook.js';

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
  status: 'running' | 'paused' | 'no_input' | 'no_power';
  /** 当前生产进度 (0 到 ticksRequired) */
  productionProgress: number;
  /** 当前使用的生产方式 ID */
  currentMethodId: string;
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
  /** 当前所有商品价格快照 */
  marketPrices?: Record<string, number>;
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
    status: 'no_input' | 'no_power' | 'paused';
    missingInputs: Array<{
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
  private readonly BASE_TICK_MS = 1000;
  
  // 建筑收益历史（用于计算滚动平均）
  private buildingProfitHistory: Map<string, Map<string, BuildingProfitHistory>> = new Map();
  // 滚动平均的窗口大小（保留最近N个生产周期）
  private readonly PROFIT_HISTORY_SIZE = 5;
  
  // 市场事件生成 - 批量预生成模式
  private lastMarketEventGenerationTick: Map<string, number> = new Map();
  private marketEventGenerationInterval = 200; // 每200 tick生成一批事件
  private scheduledMarketEvents: Map<string, Array<{ event: MarketEventGenerated; triggerTick: number }>> = new Map();
  private pendingMarketEvents: Map<string, MarketEventGenerated[]> = new Map();
  
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
      
      // 初始化经济系统
      economyManager.initialize(0);
      console.log('[GameLoop] Economy system initialized');
      
      // 初始化自动交易管理器
      autoTradeManager.initialize(playerCompanyId);
      console.log('[GameLoop] Auto trade manager initialized');
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
   */
  private startGameLoop(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game || game.isPaused) return;
    
    // Clear any existing interval
    this.stopGameLoop(gameId);
    
    // Calculate interval based on speed
    const tickInterval = this.BASE_TICK_MS / game.speed;
    
    const interval = setInterval(() => {
      this.processTick(gameId);
    }, tickInterval);
    
    this.intervals.set(gameId, interval);
    console.log(`[GameLoop] Started game ${gameId} at ${game.speed}x speed`);
  }
  
  /**
   * Stop the game loop for a specific game
   */
  private stopGameLoop(gameId: string): void {
    const interval = this.intervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(gameId);
      console.log(`[GameLoop] Stopped game ${gameId}`);
    }
  }
  
  /**
   * Purchase a building
   * 支持从 BUILDINGS_DATA 和 BUILDING_DEFINITIONS 两个数据源查找建筑
   */
  purchaseBuilding(gameId: string, buildingDefId: string): { success: boolean; building?: BuildingInstance; error?: string; newCash?: number } {
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
    
    if (currentCash < buildingDef.baseCost) {
      return { success: false, error: '资金不足' };
    }
    
    // 同时从游戏状态和库存系统扣减成本
    game.playerCash -= buildingDef.baseCost;
    if (playerInventory) {
      inventoryManager.deductCash(
        game.playerCompanyId,
        buildingDef.baseCost,
        game.currentTick,
        `purchase-building-${buildingDefId}`
      );
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
      status: 'running',
      productionProgress: 0,
      currentMethodId: defaultMethodId,
    };
    
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
    
    // 同步玩家现金
    const updatedInventory = inventoryManager.getInventory(game.playerCompanyId);
    if (updatedInventory) {
      game.playerCash = updatedInventory.cash;
    }
    
    console.log(`[GameLoop] Building purchased: ${buildingDef.nameZh}, new cash: ${game.playerCash}`);
    
    return { success: true, building, newCash: game.playerCash };
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
   */
  private processTick(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    
    // Advance tick
    game.currentTick++;
    game.lastUpdate = Date.now();
    
    // ===== 更新经济系统（NPC交易、订单撮合、价格发现）=====
    const economyResult = economyManager.update(game.currentTick);
    
    // 同步经济系统的价格到游戏状态
    const economyPrices = economyManager.getAllMarketPrices();
    for (const [goodsId, price] of economyPrices) {
      game.marketPrices.set(goodsId, price);
    }
    
    // ===== 经济循环诊断日志（每50 tick输出一次）=====
    if (game.currentTick % 50 === 0) {
      this.logEconomicDiagnostics(game, economyResult);
    }
    
    // 同步玩家库存中的现金到游戏状态
    const playerInventory = inventoryManager.getInventory(game.playerCompanyId);
    if (playerInventory) {
      game.playerCash = playerInventory.cash;
    }
    
    // ===== 基于配方的经济计算 =====
    // 每个建筑的生产周期由 ticksRequired 决定
    // 每次完成周期时：收入 = 产出 × 价格，成本 = 投入 × 价格
    // 维护成本每 tick 都产生（按月分摊）
    
    let totalIncome = 0;
    let totalInputCost = 0;
    let totalMaintenance = 0;
    const buildingProfits: BuildingProfit[] = [];
    
    const TICKS_PER_MONTH = 720; // 30天 × 24小时
    
    // 每100 tick输出玩家建筑状态诊断（帮助调试）
    if (game.currentTick % 100 === 0 && game.buildings.length > 0) {
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
    
    for (const building of game.buildings) {
      const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
      if (!def) continue;
      
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
      
      // 维护成本每 tick 都产生
      // 重要改进：停工建筑（no_input/no_power）只收取50%维护费
      // 这减轻了玩家在原料短缺时的财务压力
      let maintenanceMultiplier = 1.0;
      if (building.status === 'no_input' || building.status === 'no_power') {
        maintenanceMultiplier = 0.5; // 停工时只收50%维护费
      } else if (building.status === 'paused') {
        maintenanceMultiplier = 0.25; // 主动暂停时只收25%维护费
      }
      const buildingMaintenance = (def.maintenanceCost / TICKS_PER_MONTH) * techModifiers.costMultiplier * maintenanceMultiplier;
      totalMaintenance += buildingMaintenance;
      
      let buildingIncome = 0;
      let buildingInputCost = 0;
      let produced = false;
      
      // 只有 running 状态的建筑才进行生产
      if (building.status === 'running') {
        // *** 重要修复：在推进生产进度前，先检查原料是否充足 ***
        // 这样可以确保缺料时立即显示正确状态，而不是等到周期结束
        let hasAllInputsForProduction = true;
        const missingInputsCheck: Array<{ goodsId: string; needed: number; available: number }> = [];
        
        for (const input of recipe.inputs) {
          const adjustedAmount = input.amount * techModifiers.inputMultiplier;
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
        
        // 如果原料不足，立即切换到 no_input 状态，并触发自动采购
        if (!hasAllInputsForProduction) {
          building.status = 'no_input';
          // 触发自动采购
          this.autoPurchaseMaterials(game, building, missingInputsCheck);
        } else {
          // 原料充足，推进生产进度（应用效率修饰符）
          const effectiveEfficiency = building.efficiency * building.utilization * techModifiers.efficiencyMultiplier;
          building.productionProgress += effectiveEfficiency;
          
          // 检查是否完成了一个生产周期
          if (building.productionProgress >= recipe.ticksRequired) {
            building.productionProgress -= recipe.ticksRequired;
            produced = true;
            
            // 再次检查并消耗库存中的原料（双重检查，确保安全）
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
              // 消耗原料
              for (const input of recipe.inputs) {
                const price = this.getPrice(game, input.goodsId);
                const adjustedAmount = input.amount * techModifiers.inputMultiplier;
                inventoryManager.consumeGoods(
                  game.playerCompanyId,
                  input.goodsId,
                  adjustedAmount,
                  game.currentTick,
                  `production-${building.id}`
                );
                buildingInputCost += adjustedAmount * price;
                // 增加该商品的需求（消耗 = 需求）
                this.addDemand(game, input.goodsId, adjustedAmount);
              }
              
              // 添加产出到库存
              for (const output of recipe.outputs) {
                const price = this.getPrice(game, output.goodsId);
                const adjustedAmount = output.amount * techModifiers.outputMultiplier;
                // 计算生产成本（用于库存成本追踪）
                const productionCost = buildingInputCost / recipe.outputs.length;
                inventoryManager.addGoods(
                  game.playerCompanyId,
                  output.goodsId,
                  adjustedAmount,
                  productionCost / adjustedAmount, // 每单位成本
                  game.currentTick,
                  `production-${building.id}`
                );
                buildingIncome += adjustedAmount * price;
                // 增加该商品的供给（产出 = 供给）
                this.addSupply(game, output.goodsId, adjustedAmount);
              }
            } else {
              // 原料不足，标记建筑状态
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
          const adjustedAmount = input.amount * techModifiers.inputMultiplier;
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
          // 原料已充足，恢复运行状态
          building.status = 'running';
        } else {
          // 自动采购缺少的原料
          this.autoPurchaseMaterials(game, building, missingInputs);
        }
      } else if (building.status === 'paused') {
        // 暂停状态不做处理
      }
      
      totalIncome += buildingIncome;
      totalInputCost += buildingInputCost;
      
      // 计算当前周期的净利润
      const currentNet = buildingIncome - buildingInputCost - buildingMaintenance;
      
      // 获取或初始化该建筑的收益历史
      let gameHistory = this.buildingProfitHistory.get(gameId);
      if (!gameHistory) {
        gameHistory = new Map();
        this.buildingProfitHistory.set(gameId, gameHistory);
      }
      
      let history = gameHistory.get(building.id);
      if (!history) {
        history = { recentProfits: [], avgNet: 0 };
        gameHistory.set(building.id, history);
      }
      
      // 更新滚动平均：只在完成生产周期时才记录收益
      if (produced) {
        // 计算完整周期的收益（包含生产收入）
        const cycleTotalNet = buildingIncome - buildingInputCost;
        // 加上周期内所有tick的维护成本（近似值：维护成本 × 周期长度）
        const recipe = method.recipe;
        const cycleMaintenanceCost = buildingMaintenance * recipe.ticksRequired;
        const fullCycleNet = cycleTotalNet - cycleMaintenanceCost;
        
        // 记录完整周期的每tick平均利润
        const avgPerTick = fullCycleNet / recipe.ticksRequired;
        history.recentProfits.push(avgPerTick);
        
        // 保持历史记录在窗口大小内
        if (history.recentProfits.length > this.PROFIT_HISTORY_SIZE) {
          history.recentProfits.shift();
        }
        
        // 重新计算滚动平均
        if (history.recentProfits.length > 0) {
          const sum = history.recentProfits.reduce((a, b) => a + b, 0);
          history.avgNet = sum / history.recentProfits.length;
        }
      }
      
      // 记录每个建筑的收益明细（显示滚动平均值）
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
    const MAX_HISTORY_LENGTH = 1440; // 保留最近1440个tick的历史（24小时 = 1天）
    
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
      
      // 保留最近100个记录
      if (history.length > MAX_HISTORY_LENGTH) {
        game.priceHistory.set(goodsId, history.slice(-MAX_HISTORY_LENGTH));
      }
      
      if (Math.abs(change) > 0) {
        marketChanges.push({ goodsId, price: newPrice, change });
      }
    }
    
    // ===== 处理基础消费需求（POPs简化版）=====
    // 模拟城市居民对各类商品的持续消费需求
    this.processBasicConsumerDemand(game);
    
    // ===== 处理自动交易 =====
    // 根据配置自动采购和销售商品
    const autoTradeResult = autoTradeManager.processTick(
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
    
    // ===== 处理AI公司 =====
    const aiContext = {
      currentTick: game.currentTick,
      marketPrices: game.marketPrices,
      supplyDemand: game.supplyDemand,
      playerBuildings: game.buildings,
      playerCash: game.playerCash,
    };
    
    const aiResult = aiCompanyManager.processTick(aiContext);
    
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
          // AI生产也增加供需
          for (const input of method.recipe.inputs) {
            this.addDemand(game, input.goodsId, input.amount * 0.5); // AI需求权重稍低
          }
          for (const output of method.recipe.outputs) {
            this.addSupply(game, output.goodsId, output.amount * 0.5); // AI供给权重稍低
          }
        }
      }
    }
    
    // ===== 处理研发进度 =====
    // 每100 tick输出调试信息
    if (game.currentTick % 100 === 0) {
      console.log(`[GameLoop] Tick ${game.currentTick}: Processing research...`);
    }
    const completedProjects = researchService.progressResearch(game.currentTick);
    const newTechnologies: Array<{ id: string; name: string; category: string }> = [];
    
    // 处理完成的研发项目（异步，不阻塞tick）
    if (completedProjects.length > 0) {
      this.processCompletedResearch(completedProjects, game.currentTick, newTechnologies);
    }
    
    // 检查专利过期
    researchService.checkPatentExpiry(game.currentTick);
    
    // Generate random events occasionally (1% chance per tick)
    const events: Array<{ id: string; type: string; message: string }> = [];
    
    // 处理副作用触发
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
    
    // 添加AI新闻作为事件
    for (const news of aiResult.news) {
      events.push({
        id: `ai-news-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'ai_activity',
        message: news.headline,
      });
    }
    
    // 处理LLM市场事件批量生成
    // 初始值为-200，确保游戏开始时立即生成第一批事件
    const lastGenTick = this.lastMarketEventGenerationTick.get(gameId) ?? -this.marketEventGenerationInterval;
    if (game.currentTick - lastGenTick >= this.marketEventGenerationInterval) {
      this.lastMarketEventGenerationTick.set(gameId, game.currentTick);
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
    
    // 构建当前价格快照
    const marketPricesSnapshot: Record<string, number> = {};
    for (const [goodsId, price] of game.marketPrices) {
      marketPricesSnapshot[goodsId] = price;
    }
    
    // 获取AI公司摘要
    const aiCompaniesSummary = aiCompanyManager.getCompaniesSummary();
    
    // 获取玩家库存快照
    const inventorySnapshot = inventoryManager.getInventorySnapshot(
      game.playerCompanyId,
      game.marketPrices
    );
    
    // 收集建筑短缺信息
    const buildingShortages: TickUpdate['buildingShortages'] = [];
    for (const building of game.buildings) {
      if (building.status === 'no_input' || building.status === 'no_power' || building.status === 'paused') {
        const def = BUILDINGS_DATA.find(b => b.id === building.definitionId);
        if (!def) continue;
        
        const slot = def.productionSlots[0];
        const method = slot?.methods.find(m => m.id === building.currentMethodId) ?? slot?.methods[0];
        if (!method) continue;
        
        // 获取技术效果修饰符
        const techModifiers = technologyEffectManager.getBuildingModifiers(
          building.definitionId,
          def.category
        );
        
        // 检查缺少的原料
        const missingInputs: Array<{
          goodsId: string;
          goodsName: string;
          needed: number;
          available: number;
        }> = [];
        
        for (const input of method.recipe.inputs) {
          const adjustedAmount = input.amount * techModifiers.inputMultiplier;
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
        
        // 只有确实缺少原料时才记录
        if (missingInputs.length > 0 || building.status === 'no_power' || building.status === 'paused') {
          buildingShortages.push({
            buildingId: building.id,
            buildingName: building.name,
            status: building.status as 'no_input' | 'no_power' | 'paused',
            missingInputs,
          });
        }
      }
    }
    
    // 将成交量数据转换为Record格式
    const tickVolumesRecord: Record<string, { total: number; buy: number; sell: number }> = {};
    for (const [goodsId, vol] of tickVolumeByGoods) {
      tickVolumesRecord[goodsId] = vol;
    }
    
    // Emit tick update
    const update: TickUpdate = {
      gameId,
      tick: game.currentTick,
      timestamp: game.lastUpdate,
      playerCash: game.playerCash,
      buildingCount: game.buildings.length,
      financials,
      marketPrices: marketPricesSnapshot,
      marketChanges: marketChanges.length > 0 ? marketChanges : undefined,
      events: events.length > 0 ? events : undefined,
      aiCompanies: aiCompaniesSummary,
      competitionEvents: aiResult.events.length > 0 ? aiResult.events : undefined,
      aiNews: aiResult.news.length > 0 ? aiResult.news : undefined,
      marketEvents: pendingEvents.length > 0 ? pendingEvents : undefined,
      researchUpdates: (completedProjects.length > 0 || newTechnologies.length > 0) ? {
        completedProjects,
        newTechnologies,
      } : undefined,
      trades: economyResult.trades.length > 0 ? economyResult.trades : undefined,
      economyStats: {
        totalNPCCompanies: economyResult.stats.totalNPCCompanies,
        totalActiveOrders: economyResult.stats.totalActiveOrders,
        totalTradesThisTick: economyResult.stats.totalTradesThisTick,
      },
      inventory: inventorySnapshot ?? undefined,
      buildingShortages: buildingShortages.length > 0 ? buildingShortages : undefined,
      tickVolumes: Object.keys(tickVolumesRecord).length > 0 ? tickVolumesRecord : undefined,
    };
    
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
   * 处理基础消费需求 - 模拟城市POPs的持续消费
   * 使用 GoodsRegistry 自动获取消费需求配置
   *
   * 增加了周期性波动机制，模拟季节性需求变化
   */
  private processBasicConsumerDemand(game: GameState): void {
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
    const cycleLength = MARKET_CONSTANTS?.DEMAND_FLUCTUATION_CYCLE ?? 720;
    
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
      
      // 最终需求 = 基础需求 × 周期波动 × 随机噪声
      const demand = baseDemand * cyclicMultiplier * noise;
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
    const cycleLength = MARKET_CONSTANTS?.DEMAND_FLUCTUATION_CYCLE ?? 720;
    
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
    const statusCounts = { running: 0, paused: 0, no_input: 0, no_power: 0 };
    for (const building of game.buildings) {
      statusCounts[building.status]++;
    }
    console.log(`🏭 建筑状态: 运行=${statusCounts.running}, 缺料=${statusCounts.no_input}, 暂停=${statusCounts.paused}, 缺电=${statusCounts.no_power}`);
    
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