/**
 * 自动交易管理器
 * Auto Trade Manager - 管理玩家的自动采购和销售
 */

import type { BuildingInstance, GameState } from '@scc/shared';
import {
  BUILDINGS_DATA,
  type BuildingData,
  type ProductionMethodData,
  getBuildingRegistry,
  isRegistryInitialized
} from '@scc/shared';
import { economyManager } from './economyManager.js';
import { inventoryManager } from './inventoryManager.js';
import { priceDiscoveryService } from './priceDiscovery.js';
import { marketOrderBook } from './marketOrderBook.js';

// ============ 类型定义 ============

/** 自动采购配置 */
interface AutoBuyConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 库存低于此数量时触发采购 */
  triggerThreshold: number;
  /** 采购目标库存量 */
  targetStock: number;
  /** 最高接受价格（市场价的倍数） */
  maxPriceMultiplier: number;
}

/** 自动销售配置 */
interface AutoSellConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 库存超过此数量时触发销售 */
  triggerThreshold: number;
  /** 保留库存量（不出售） */
  reserveStock: number;
  /** 最低接受价格（市场价的倍数） */
  minPriceMultiplier: number;
}

/** 商品自动交易配置 */
interface GoodsAutoTradeConfig {
  goodsId: string;
  autoBuy: AutoBuyConfig;
  autoSell: AutoSellConfig;
}

/** 总体自动交易配置 */
interface AutoTradeConfig {
  /** 全局开关 */
  enabled: boolean;
  /** 订单刷新间隔（tick） */
  orderRefreshInterval: number;
  /** 各商品配置 */
  goodsConfigs: Record<string, GoodsAutoTradeConfig>;
}

/** 订单追踪 */
interface AutoTradeOrder {
  orderId: string;
  goodsId: string;
  orderType: 'buy' | 'sell';
  quantity: number;
  price: number;
  createdTick: number;
  originalMarketPrice: number;
}

/** 交易动作 */
interface AutoTradeAction {
  type: 'buy' | 'sell';
  goodsId: string;
  quantity: number;
  price: number;
  success: boolean;
  message?: string;
}

/** 处理结果 */
interface AutoTradeResult {
  actions: AutoTradeAction[];
  cancelledOrders: string[];
}

/** 状态 */
interface AutoTradeStatus {
  enabled: boolean;
  goodsConfigs: GoodsAutoTradeConfig[];
  activeOrders: {
    buyOrders: number;
    sellOrders: number;
    totalValue: number;
  };
  lastActions: AutoTradeAction[];
  lastProcessedTick: number;
}

// 默认配置
const DEFAULT_AUTO_BUY_CONFIG: AutoBuyConfig = {
  enabled: false,
  triggerThreshold: 100,
  targetStock: 500,
  maxPriceMultiplier: 1.1,
};

const DEFAULT_AUTO_SELL_CONFIG: AutoSellConfig = {
  enabled: false,
  triggerThreshold: 10,    // 降低阈值，有少量库存就开始销售
  reserveStock: 5,         // 降低保留库存
  minPriceMultiplier: 0.85, // 可以接受更低的价格促进成交
};

const DEFAULT_AUTO_TRADE_CONFIG: AutoTradeConfig = {
  enabled: true,
  orderRefreshInterval: 10,
  goodsConfigs: {},
};

function createDefaultGoodsConfig(goodsId: string): GoodsAutoTradeConfig {
  return {
    goodsId,
    autoBuy: { ...DEFAULT_AUTO_BUY_CONFIG },
    autoSell: { ...DEFAULT_AUTO_SELL_CONFIG },
  };
}

class AutoTradeManager {
  /** 每个公司的配置 */
  private configs: Map<string, AutoTradeConfig> = new Map();
  
  /** 每个公司的活跃订单 */
  private activeOrders: Map<string, AutoTradeOrder[]> = new Map();
  
  /** 上次处理的 tick */
  private lastProcessTick: Map<string, number> = new Map();
  
  /** 最近的动作记录（用于状态显示） */
  private recentActions: Map<string, AutoTradeAction[]> = new Map();

  /**
   * 初始化公司的自动交易配置
   */
  initialize(companyId: string): void {
    if (!this.configs.has(companyId)) {
      this.configs.set(companyId, { ...DEFAULT_AUTO_TRADE_CONFIG });
      this.activeOrders.set(companyId, []);
      this.lastProcessTick.set(companyId, 0);
      this.recentActions.set(companyId, []);
    }
  }

  /**
   * 获取公司的自动交易配置
   */
  getConfig(companyId: string): AutoTradeConfig {
    this.initialize(companyId);
    return this.configs.get(companyId)!;
  }

  /**
   * 设置全局开关
   */
  setEnabled(companyId: string, enabled: boolean): void {
    this.initialize(companyId);
    const config = this.configs.get(companyId)!;
    config.enabled = enabled;
    console.log(`[AutoTrade] ${companyId} 自动交易已${enabled ? '开启' : '关闭'}`);
  }

  /**
   * 更新商品配置
   */
  updateGoodsConfig(
    companyId: string,
    goodsId: string,
    partialConfig: {
      autoBuy?: Partial<AutoBuyConfig> | undefined;
      autoSell?: Partial<AutoSellConfig> | undefined;
    }
  ): void {
    this.initialize(companyId);
    const config = this.configs.get(companyId)!;
    
    if (!config.goodsConfigs[goodsId]) {
      config.goodsConfigs[goodsId] = createDefaultGoodsConfig(goodsId);
    }
    
    const goodsConfig = config.goodsConfigs[goodsId];
    
    if (partialConfig.autoBuy) {
      // 过滤掉 undefined 值
      const cleanBuyConfig: Partial<AutoBuyConfig> = {};
      for (const [key, value] of Object.entries(partialConfig.autoBuy)) {
        if (value !== undefined) {
          (cleanBuyConfig as Record<string, unknown>)[key] = value;
        }
      }
      Object.assign(goodsConfig.autoBuy, cleanBuyConfig);
    }
    if (partialConfig.autoSell) {
      // 过滤掉 undefined 值
      const cleanSellConfig: Partial<AutoSellConfig> = {};
      for (const [key, value] of Object.entries(partialConfig.autoSell)) {
        if (value !== undefined) {
          (cleanSellConfig as Record<string, unknown>)[key] = value;
        }
      }
      Object.assign(goodsConfig.autoSell, cleanSellConfig);
    }
  }

  /**
   * 获取建筑定义（优先从注册表，回退到 BUILDINGS_DATA）
   */
  private getBuildingDefinition(definitionId: string): BuildingData | undefined {
    // 优先尝试从注册表获取
    if (isRegistryInitialized()) {
      const registry = getBuildingRegistry();
      const regDef = registry.get(definitionId);
      if (regDef) {
        // 注册表返回的是 BuildingDefinition，需要转换为兼容格式
        // 由于注册表数据结构与 BuildingData 兼容，可以直接使用
        return regDef as unknown as BuildingData;
      }
    }
    
    // 回退到传统数据
    return BUILDINGS_DATA.find((b: BuildingData) => b.id === definitionId);
  }

  /**
   * 根据建筑自动生成配置
   * 使用 BuildingRegistry 或 BUILDINGS_DATA 获取配方信息
   */
  autoConfigureFromBuildings(
    companyId: string,
    buildings: BuildingInstance[],
    _game: GameState
  ): void {
    this.initialize(companyId);
    const config = this.configs.get(companyId)!;
    
    // 只处理玩家的建筑
    const playerBuildings = buildings.filter((b: BuildingInstance) => b.ownerId === companyId);
    
    // 分析每个建筑的输入/输出需求
    const consumptionRates: Map<string, number> = new Map();
    const productionRates: Map<string, number> = new Map();
    
    for (const building of playerBuildings) {
      // 使用新的获取方法（优先注册表）
      const def = this.getBuildingDefinition(building.definitionId);
      if (!def) continue;
      
      // 找到当前使用的生产方法
      for (const slot of def.productionSlots) {
        // 从 activeMethodIds 中获取当前槽位使用的方法ID
        // 注意：slot.type 对应 ProductionSlotType，但 BuildingData 中的 slot.type 是字符串
        const activeMethodId = Object.values(building.activeMethodIds || {}).find(id =>
          slot.methods.some((m: ProductionMethodData) => m.id === id)
        );
        
        const method = slot.methods.find((m: ProductionMethodData) => m.id === (activeMethodId || slot.defaultMethodId));
        if (!method) continue;
        
        // 统一时间体系：1 tick = 1天
        const ticksPerDay = 1;
        const cyclesPerDay = ticksPerDay / method.recipe.ticksRequired;
        
        // 计算每日消耗
        for (const input of method.recipe.inputs) {
          const dailyAmount = input.amount * cyclesPerDay;
          const current = consumptionRates.get(input.goodsId) || 0;
          consumptionRates.set(input.goodsId, current + dailyAmount);
        }
        
        // 计算每日产出
        for (const output of method.recipe.outputs) {
          const dailyAmount = output.amount * cyclesPerDay;
          const current = productionRates.get(output.goodsId) || 0;
          productionRates.set(output.goodsId, current + dailyAmount);
        }
      }
    }
    
    // 生成配置
    const newConfigs: Record<string, GoodsAutoTradeConfig> = {};
    
    // 为消耗品配置自动采购
    for (const [goodsId, dailyConsumption] of consumptionRates) {
      const conf = createDefaultGoodsConfig(goodsId);
      
      // 触发阈值：2天的消耗量
      conf.autoBuy.triggerThreshold = Math.ceil(dailyConsumption * 2);
      // 目标库存：5天的消耗量
      conf.autoBuy.targetStock = Math.ceil(dailyConsumption * 5);
      conf.autoBuy.enabled = true;
      conf.autoBuy.maxPriceMultiplier = 1.15; // 最高溢价15%
      
      newConfigs[goodsId] = conf;
    }
    
    // 为产出品配置自动销售
    for (const [goodsId, dailyProduction] of productionRates) {
      if (!newConfigs[goodsId]) {
        newConfigs[goodsId] = createDefaultGoodsConfig(goodsId);
      }
      
      const conf = newConfigs[goodsId];
      
      // 触发阈值：3天的产量
      conf.autoSell.triggerThreshold = Math.ceil(dailyProduction * 3);
      // 保留库存：1天的产量
      conf.autoSell.reserveStock = Math.ceil(dailyProduction * 1);
      conf.autoSell.enabled = true;
      conf.autoSell.minPriceMultiplier = 0.9; // 最低折价10%
    }
    
    config.goodsConfigs = newConfigs;
    
    console.log(`[AutoTrade] ${companyId} 根据建筑自动配置了 ${Object.keys(newConfigs).length} 种商品`);
  }

  /**
   * 每 tick 处理自动交易
   */
  processTick(
    companyId: string,
    currentTick: number,
    game: GameState
  ): AutoTradeResult {
    const result: AutoTradeResult = { actions: [], cancelledOrders: [] };
    
    this.initialize(companyId);
    const config = this.configs.get(companyId)!;
    
    // 如果未启用，直接返回
    if (!config.enabled) {
      return result;
    }
    
    // 检查处理间隔（避免每tick都处理，降低性能消耗）
    const lastTick = this.lastProcessTick.get(companyId) || 0;
    if (currentTick - lastTick < config.orderRefreshInterval) {
      return result;
    }
    this.lastProcessTick.set(companyId, currentTick);
    
    // ===== 关键修复：如果商品配置为空但有建筑，自动重新配置 =====
    // 这解决了服务器重启后配置丢失的问题
    // 注意：game 对象可能是服务端内部格式（有 buildings 数组）
    const gameAny = game as unknown as { buildings?: Array<{ definitionId: string; currentMethodId: string }> };
    if (Object.keys(config.goodsConfigs).length === 0 && gameAny.buildings && gameAny.buildings.length > 0) {
      console.log(`[AutoTrade] ${companyId} 检测到配置为空，正在根据 ${gameAny.buildings.length} 个建筑重新配置...`);
      this.reconfigureFromGameBuildings(companyId, gameAny.buildings);
    }
    
    // 获取库存
    const inventory = inventoryManager.getInventory(companyId);
    if (!inventory) {
      return result;
    }
    
    // 清理过期订单
    this.cleanupStaleOrders(companyId, currentTick, result);
    
    // 获取当前活跃订单
    const orders = this.activeOrders.get(companyId) || [];
    
    // 处理每种商品
    for (const [goodsId, goodsConfig] of Object.entries(config.goodsConfigs)) {
      // 自动采购
      if (goodsConfig.autoBuy.enabled) {
        const action = this.processAutoBuy(
          companyId,
          goodsId,
          goodsConfig,
          inventory,
          orders,
          currentTick,
          game
        );
        if (action) {
          result.actions.push(action);
        }
      }
      
      // 自动销售
      if (goodsConfig.autoSell.enabled) {
        const action = this.processAutoSell(
          companyId,
          goodsId,
          goodsConfig,
          inventory,
          orders,
          currentTick,
          game
        );
        if (action) {
          result.actions.push(action);
        }
      }
    }
    
    // 记录最近的动作
    if (result.actions.length > 0) {
      const recent = this.recentActions.get(companyId) || [];
      recent.push(...result.actions);
      // 只保留最近10个
      if (recent.length > 10) {
        recent.splice(0, recent.length - 10);
      }
      this.recentActions.set(companyId, recent);
    }
    
    return result;
  }

  /**
   * 处理自动采购
   */
  private processAutoBuy(
    companyId: string,
    goodsId: string,
    config: GoodsAutoTradeConfig,
    inventory: ReturnType<typeof inventoryManager.getInventory>,
    orders: AutoTradeOrder[],
    currentTick: number,
    _game: GameState
  ): AutoTradeAction | null {
    if (!inventory) return null;
    
    const stock = inventory.stocks[goodsId];
    const currentQuantity = stock?.quantity || 0;
    
    // 检查是否需要采购
    if (currentQuantity >= config.autoBuy.triggerThreshold) {
      return null;
    }
    
    // 检查是否已有该商品的买单
    const hasBuyOrder = orders.some(o => o.goodsId === goodsId && o.orderType === 'buy');
    if (hasBuyOrder) {
      return null;
    }
    
    // 计算采购量
    const buyAmount = config.autoBuy.targetStock - currentQuantity;
    if (buyAmount <= 0) {
      return null;
    }
    
    // 获取市场价格
    const marketPrice = priceDiscoveryService.getPrice(goodsId);
    const maxPrice = marketPrice * config.autoBuy.maxPriceMultiplier;
    
    // 提交买单
    const result = economyManager.playerSubmitBuyOrder(
      companyId,
      goodsId,
      buyAmount,
      maxPrice
    );
    
    const action: AutoTradeAction = {
      type: 'buy',
      goodsId,
      quantity: buyAmount,
      price: maxPrice,
      success: result.success,
      ...(result.success ? {} : { message: (result as { success: false; error: string }).error }),
    };
    
    if (result.success && result.order) {
      // 记录活跃订单
      orders.push({
        orderId: result.order.id,
        goodsId,
        orderType: 'buy',
        quantity: buyAmount,
        price: maxPrice,
        createdTick: currentTick,
        originalMarketPrice: marketPrice,
      });
      
      console.log(`[AutoTrade] ${companyId} 自动采购 ${buyAmount} ${goodsId} @ ${maxPrice.toFixed(2)}`);
    }
    
    return action;
  }

  /**
   * 处理自动销售
   */
  private processAutoSell(
    companyId: string,
    goodsId: string,
    config: GoodsAutoTradeConfig,
    inventory: ReturnType<typeof inventoryManager.getInventory>,
    orders: AutoTradeOrder[],
    currentTick: number,
    _game: GameState
  ): AutoTradeAction | null {
    if (!inventory) return null;
    
    const stock = inventory.stocks[goodsId];
    const currentQuantity = stock?.quantity || 0;
    const reservedForProduction = stock?.reservedForProduction || 0;
    const reservedForSale = stock?.reservedForSale || 0;
    
    // 可用于销售的数量
    const availableToSell = currentQuantity - reservedForProduction - reservedForSale;
    
    // 检查是否需要销售
    if (availableToSell <= config.autoSell.triggerThreshold) {
      return null;
    }
    
    // 检查是否已有该商品的卖单（需验证订单仍在市场中有效）
    const existingSellOrderIndex = orders.findIndex(o => o.goodsId === goodsId && o.orderType === 'sell');
    if (existingSellOrderIndex >= 0) {
      const existingOrder = orders[existingSellOrderIndex]!;
      // 验证订单是否仍然有效
      const marketOrder = marketOrderBook.getOrder(existingOrder.orderId);
      if (marketOrder && (marketOrder.status === 'open' || marketOrder.status === 'partial')) {
        // 订单仍有效，跳过
        return null;
      } else {
        // 订单已完成或失效，从追踪中移除
        orders.splice(existingSellOrderIndex, 1);
        console.log(`[AutoTrade] 清理失效卖单追踪: ${existingOrder.orderId} (${goodsId})`);
      }
    }
    
    // 计算销售量（超出部分减去保留量）
    // 修复：当库存远超阈值时，增加销售量以加快出货
    let sellAmount = availableToSell - config.autoSell.reserveStock;
    
    // 如果库存超过阈值的10倍，视为积压，加大销售力度
    if (availableToSell > config.autoSell.triggerThreshold * 10) {
      // 尝试卖掉80%的可用库存
      sellAmount = Math.floor(availableToSell * 0.8);
      console.log(`[AutoTrade] 检测到库存积压 ${goodsId}: ${availableToSell}件, 加大销售量至 ${sellAmount}`);
    }
    
    if (sellAmount <= 0) {
      return null;
    }
    
    // 获取市场价格
    const marketPrice = priceDiscoveryService.getPrice(goodsId);
    // 库存积压时，降低价格以促成交易
    let priceMultiplier = config.autoSell.minPriceMultiplier;
    if (availableToSell > config.autoSell.triggerThreshold * 20) {
      // 严重积压，进一步降价
      priceMultiplier = Math.max(0.7, priceMultiplier - 0.1);
    }
    const minPrice = marketPrice * priceMultiplier;
    
    // 提交卖单
    const result = economyManager.playerSubmitSellOrder(
      companyId,
      goodsId,
      sellAmount,
      minPrice
    );
    
    const action: AutoTradeAction = {
      type: 'sell',
      goodsId,
      quantity: sellAmount,
      price: minPrice,
      success: result.success,
      ...(result.success ? {} : { message: (result as { success: false; error: string }).error }),
    };
    
    if (result.success && result.order) {
      // 记录活跃订单
      orders.push({
        orderId: result.order.id,
        goodsId,
        orderType: 'sell',
        quantity: sellAmount,
        price: minPrice,
        createdTick: currentTick,
        originalMarketPrice: marketPrice,
      });
      
      console.log(`[AutoTrade] ${companyId} 自动销售 ${sellAmount} ${goodsId} @ ${minPrice.toFixed(2)} (库存: ${currentQuantity})`);
    } else {
      console.log(`[AutoTrade] ${companyId} 自动销售失败 ${goodsId}: ${(result as { success: false; error: string }).error || '未知错误'}`);
    }
    
    return action;
  }

  /**
   * 清理过期或已完成的订单
   */
  private cleanupStaleOrders(
    companyId: string,
    currentTick: number,
    result: AutoTradeResult
  ): void {
    const orders = this.activeOrders.get(companyId) || [];
    const config = this.configs.get(companyId)!;
    
    const newOrders: AutoTradeOrder[] = [];
    
    for (const order of orders) {
      // 订单存在时间（tick）
      const age = currentTick - order.createdTick;
      
      // 如果订单太老（超过30个刷新周期），取消它
      const maxAge = config.orderRefreshInterval * 30;
      if (age > maxAge) {
        // 尝试取消订单
        const cancelResult = economyManager.playerCancelOrder(companyId, order.orderId);
        if (cancelResult.success) {
          result.cancelledOrders.push(order.orderId);
          console.log(`[AutoTrade] ${companyId} 取消过期订单 ${order.orderId}`);
        }
        continue;
      }
      
      // 检查市场价格是否有大幅变化（超过20%），如果有则取消重新下单
      const currentPrice = priceDiscoveryService.getPrice(order.goodsId);
      const priceChange = Math.abs(currentPrice - order.originalMarketPrice) / order.originalMarketPrice;
      
      if (priceChange > 0.2) {
        const cancelResult = economyManager.playerCancelOrder(companyId, order.orderId);
        if (cancelResult.success) {
          result.cancelledOrders.push(order.orderId);
          console.log(`[AutoTrade] ${companyId} 因价格变化取消订单 ${order.orderId}`);
        }
        continue;
      }
      
      newOrders.push(order);
    }
    
    this.activeOrders.set(companyId, newOrders);
  }

  /**
   * 获取自动交易状态
   */
  getStatus(companyId: string): AutoTradeStatus {
    this.initialize(companyId);
    
    const config = this.configs.get(companyId)!;
    const orders = this.activeOrders.get(companyId) || [];
    const recentActions = this.recentActions.get(companyId) || [];
    const lastTick = this.lastProcessTick.get(companyId) || 0;
    
    // 统计活跃订单
    let buyOrders = 0;
    let sellOrders = 0;
    let totalValue = 0;
    
    for (const order of orders) {
      if (order.orderType === 'buy') {
        buyOrders++;
      } else {
        sellOrders++;
      }
      totalValue += order.quantity * order.price;
    }
    
    return {
      enabled: config.enabled,
      goodsConfigs: Object.values(config.goodsConfigs),
      activeOrders: {
        buyOrders,
        sellOrders,
        totalValue,
      },
      lastActions: recentActions.slice(-5), // 最近5个动作
      lastProcessedTick: lastTick,
    };
  }

  /**
   * 当订单成交时更新记录
   */
  onOrderFilled(companyId: string, orderId: string): void {
    const orders = this.activeOrders.get(companyId);
    if (!orders) return;
    
    const index = orders.findIndex(o => o.orderId === orderId);
    if (index >= 0) {
      orders.splice(index, 1);
    }
  }

  /**
   * 当订单被取消时更新记录
   */
  onOrderCancelled(companyId: string, orderId: string): void {
    this.onOrderFilled(companyId, orderId); // 同样的处理
  }

  /**
   * 根据游戏中的建筑重新配置自动交易
   * 用于服务器重启后恢复配置
   */
  private reconfigureFromGameBuildings(
    companyId: string,
    buildings: Array<{ definitionId: string; currentMethodId: string }>
  ): void {
    const config = this.configs.get(companyId);
    if (!config) return;
    
    for (const building of buildings) {
      // 获取建筑定义
      const def = this.getBuildingDefinition(building.definitionId);
      if (!def || !def.productionSlots || def.productionSlots.length === 0) continue;
      
      const slot = def.productionSlots[0];
      if (!slot || !slot.methods || slot.methods.length === 0) continue;
      
      // 查找当前使用的生产方法
      const method = slot.methods.find(m => m.id === building.currentMethodId) ?? slot.methods[0];
      if (!method || !method.recipe) continue;
      
      const recipe = method.recipe;
      // ticksRequired 用于未来可能的按周期优化
      // const ticksRequired = recipe.ticksRequired || 1;
      
      // 为每个输入商品配置自动采购
      for (const input of recipe.inputs) {
        const cycleConsumption = input.amount;
        const triggerThreshold = Math.max(1, Math.ceil(cycleConsumption * 10));
        const targetStock = Math.ceil(cycleConsumption * 50);
        
        this.updateGoodsConfig(companyId, input.goodsId, {
          autoBuy: {
            enabled: true,
            triggerThreshold,
            targetStock,
            maxPriceMultiplier: 1.15,
          },
        });
      }
      
      // 为每个输出商品配置自动销售
      for (const output of recipe.outputs) {
        const cycleProduction = output.amount;
        const triggerThreshold = Math.max(1, Math.ceil(cycleProduction * 0.5));
        const reserveStock = Math.max(0, Math.ceil(cycleProduction * 0.1));
        
        this.updateGoodsConfig(companyId, output.goodsId, {
          autoSell: {
            enabled: true,
            triggerThreshold,
            reserveStock,
            minPriceMultiplier: 0.85,
          },
        });
      }
    }
    
    console.log(`[AutoTrade] ${companyId} 已根据建筑重新配置 ${Object.keys(config.goodsConfigs).length} 种商品`);
  }
}

// 单例导出
export const autoTradeManager = new AutoTradeManager();