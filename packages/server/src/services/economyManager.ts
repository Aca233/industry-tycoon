/**
 * 经济系统管理器
 * 协调库存、订单、撮合、价格发现和AI竞争对手等子系统
 *
 * 重构说明：删除了NPC公司系统，所有公司（包括AI竞争对手）都通过建筑公平竞争
 */

import { EventEmitter } from 'events';
import type { TradeRecord } from '@scc/shared';
import { GOODS_DATA } from '@scc/shared';
import { inventoryManager } from './inventoryManager.js';
import { marketOrderBook } from './marketOrderBook.js';
import { matchingEngine, type MarketShareData, type CompanyShare } from './matchingEngine.js';
import { priceDiscoveryService } from './priceDiscovery.js';
import { aiCompanyManager } from './aiCompanyManager.js';
import { popsConsumptionManager } from './popsConsumption.js';

// 重新导出类型供外部使用
export type { MarketShareData, CompanyShare };

/**
 * 经济系统统计
 */
interface EconomyStats {
  totalCompanies: number;
  totalNPCCompanies: number;  // 保留字段名以兼容，实际统计AI公司数量
  totalActiveOrders: number;
  totalTradesThisTick: number;
  totalTradeVolume: number;
  totalTradeTurnover: number;
  avgMarketVolatility: number;
}

/** AI公司统计结果 */
interface AICompanyStats {
  totalCompanies: number;
  activeOrders: number;
  totalCash: number;
  totalBuildings: number;
}

/**
 * 经济系统管理器 - 单例
 */
export class EconomyManager extends EventEmitter {
  private initialized: boolean = false;
  private currentTick: number = 0;
  private lastStats: EconomyStats | null = null;
  
  constructor() {
    super();
  }
  
  /**
   * 初始化经济系统
   */
  initialize(currentTick: number = 0): void {
    if (this.initialized) return;
    
    this.currentTick = currentTick;
    
    // AI公司由 gameLoop 中的 aiCompanyManager.initializeCompanies() 负责初始化
    // 这里只需确保 AI 公司开始参与市场交易
    
    // 立即执行第一次更新，确保订单簿有初始订单
    const aiContext = this.buildAIContext(currentTick);
    aiCompanyManager.processTick(aiContext);
    matchingEngine.processAllMatches(currentTick);
    
    this.initialized = true;
    console.log('[EconomyManager] Economic system initialized (using AI companies)');
  }
  
  /**
   * 构建AI公司上下文
   */
  private buildAIContext(currentTick: number) {
    const marketPrices = new Map<string, number>();
    for (const goods of GOODS_DATA) {
      marketPrices.set(goods.id, priceDiscoveryService.getPrice(goods.id));
    }
    
    return {
      currentTick,
      marketPrices,
      supplyDemand: new Map(), // AI公司不需要这个，使用 priceDiscoveryService
      playerBuildings: [],     // 玩家建筑信息由 gameLoop 传递
      playerCash: 0,           // 玩家现金由 gameLoop 传递
    };
  }
  
  /**
   * 每tick更新经济系统
   * 这是主要的更新循环
   */
  update(currentTick: number): { trades: TradeRecord[]; stats: EconomyStats } {
    if (!this.initialized) {
      this.initialize(currentTick);
    }
    
    this.currentTick = currentTick;
    
    // 1. 更新AI竞争对手公司（生产、发布订单）
    const aiContext = this.buildAIContext(currentTick);
    aiCompanyManager.processTick(aiContext);
    
    // 2. 更新POPs消费需求（Victoria 3 风格）
    popsConsumptionManager.update(currentTick);
    
    // 3. 清理过期订单
    marketOrderBook.cleanupExpiredOrders(currentTick);
    
    // 4. 执行订单撮合
    const trades = matchingEngine.processAllMatches(currentTick);
    
    // 5. 更新价格发现
    priceDiscoveryService.updateAllPrices(currentTick);
    
    // 5.5 经济健康检查（每50 tick检查一次）
    if (currentTick % 50 === 0) {
      this.checkEconomicHealth(currentTick);
    }
    
    // 6. 计算统计数据
    const stats = this.calculateStats(trades);
    this.lastStats = stats;
    
    // 触发更新事件
    this.emit('economyUpdated', { tick: currentTick, trades, stats });
    
    return { trades, stats };
  }
  
  /**
   * 获取AI公司统计数据
   */
  private getAICompanyStats(): AICompanyStats {
    const companies = aiCompanyManager.getCompanies();
    let totalCash = 0;
    let totalBuildings = 0;
    let activeOrders = 0;
    
    for (const [companyId, company] of companies) {
      totalCash += company.cash;
      totalBuildings += company.buildings.length;
      
      // 统计活跃订单
      const companyOrders = marketOrderBook.getCompanyActiveOrders(companyId);
      activeOrders += companyOrders.length;
    }
    
    return {
      totalCompanies: companies.size,
      activeOrders,
      totalCash,
      totalBuildings,
    };
  }
  
  /**
   * 计算经济统计数据
   */
  private calculateStats(trades: TradeRecord[]): EconomyStats {
    const aiStats = this.getAICompanyStats();
    
    // 计算交易统计
    const totalTradeVolume = trades.reduce((sum, t) => sum + t.quantity, 0);
    const totalTradeTurnover = trades.reduce((sum, t) => sum + t.totalValue, 0);
    
    // 计算平均市场波动率
    const priceOverview = priceDiscoveryService.getMarketOverview();
    const volatilities = priceOverview.map(p => p.volatility);
    const avgMarketVolatility = volatilities.length > 0
      ? volatilities.reduce((a, b) => a + b, 0) / volatilities.length
      : 0;
    
    return {
      totalCompanies: 1 + aiStats.totalCompanies, // 玩家公司 + AI公司
      totalNPCCompanies: aiStats.totalCompanies,  // 实际是AI公司数量
      totalActiveOrders: aiStats.activeOrders,
      totalTradesThisTick: trades.length,
      totalTradeVolume,
      totalTradeTurnover,
      avgMarketVolatility,
    };
  }
  
  /**
   * 获取商品当前市场价格
   */
  getMarketPrice(goodsId: string): number {
    return priceDiscoveryService.getPrice(goodsId);
  }
  
  /**
   * 获取所有商品价格
   */
  getAllMarketPrices(): Map<string, number> {
    return priceDiscoveryService.getAllPrices();
  }
  
  /**
   * 获取市场概况
   */
  getMarketOverview() {
    return priceDiscoveryService.getMarketOverview();
  }
  
  /**
   * 获取商品订单簿
   */
  getOrderBook(goodsId: string) {
    return marketOrderBook.getOrderBook(goodsId);
  }
  
  /**
   * 获取市场深度
   */
  getMarketDepth(goodsId: string, levels: number = 5) {
    return marketOrderBook.getMarketDepth(goodsId, levels);
  }
  
  /**
   * 获取交易历史
   */
  getTradeHistory(goodsId?: string, limit: number = 100) {
    return matchingEngine.getTradeHistory(goodsId, limit);
  }
  
  /**
   * 获取价格历史
   */
  getPriceHistory(goodsId: string, limit?: number) {
    return priceDiscoveryService.getPriceHistory(goodsId, limit);
  }
  
  /**
   * 获取最新统计数据
   */
  getStats(): EconomyStats | null {
    return this.lastStats;
  }
  
  /**
   * 获取市场占比数据
   * @param goodsId 商品ID
   * @param ticks 统计周期（tick数），默认720（约1个月）
   */
  getMarketShare(goodsId: string, ticks: number = 720): MarketShareData {
    return matchingEngine.getMarketShare(goodsId, ticks, this.currentTick);
  }
  
  /**
   * 获取玩家在特定商品的市场占比
   */
  getPlayerMarketShare(companyId: string, goodsId: string, ticks: number = 720): CompanyShare | null {
    return matchingEngine.getCompanyMarketShare(goodsId, companyId, ticks, this.currentTick);
  }
  
  /**
   * 玩家提交买单
   */
  playerSubmitBuyOrder(
    companyId: string,
    goodsId: string,
    quantity: number,
    maxPrice: number
  ) {
    // 检查资金是否足够
    const inventory = inventoryManager.getInventory(companyId);
    if (!inventory) {
      return { success: false, error: '公司不存在' };
    }
    
    const totalCost = maxPrice * quantity;
    if (inventory.cash < totalCost) {
      return { success: false, error: '现金不足' };
    }
    
    const order = marketOrderBook.submitBuyOrder(
      companyId,
      goodsId,
      quantity,
      maxPrice,
      this.currentTick
    );
    
    return { success: true, order };
  }
  
  /**
   * 玩家提交卖单
   */
  playerSubmitSellOrder(
    companyId: string,
    goodsId: string,
    quantity: number,
    minPrice: number
  ) {
    // 检查库存是否足够
    const available = inventoryManager.getAvailableQuantity(companyId, goodsId);
    if (available < quantity) {
      return { success: false, error: '可用库存不足' };
    }
    
    // 预留库存
    const reserveResult = inventoryManager.reserveForSale(
      companyId,
      goodsId,
      quantity,
      this.currentTick
    );
    
    if (!reserveResult.success) {
      return { success: false, error: reserveResult.error };
    }
    
    const order = marketOrderBook.submitSellOrder(
      companyId,
      goodsId,
      quantity,
      minPrice,
      this.currentTick
    );
    
    return { success: true, order };
  }
  
  /**
   * 玩家取消订单
   */
  playerCancelOrder(companyId: string, orderId: string) {
    const order = marketOrderBook.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    if (order.companyId !== companyId) {
      return { success: false, error: '无权取消此订单' };
    }
    
    // 如果是卖单，释放预留库存
    if (order.orderType === 'sell' && order.remainingQuantity > 0) {
      inventoryManager.unreserveForSale(
        companyId,
        order.goodsId,
        order.remainingQuantity,
        this.currentTick
      );
    }
    
    const result = marketOrderBook.cancelOrder(orderId, this.currentTick);
    
    return { success: result };
  }
  
  /**
   * 获取玩家的活跃订单
   */
  getPlayerActiveOrders(companyId: string) {
    return marketOrderBook.getCompanyActiveOrders(companyId);
  }
  
  /**
   * 获取玩家的库存快照
   */
  getPlayerInventory(companyId: string) {
    const prices = this.getAllMarketPrices();
    return inventoryManager.getInventorySnapshot(companyId, prices);
  }
  
  /**
   * 经济健康检查
   * 当价格偏离基准价过大时强制回归
   *
   * 修复：降低阈值从300%到100%，更积极地稳定价格
   */
  private checkEconomicHealth(currentTick: number): void {
    const MAX_DEVIATION = 1.0; // 价格偏离超过100%时修正（即超过2倍或低于0.5倍）
    let correctionCount = 0;
    
    for (const goods of GOODS_DATA) {
      const currentPrice = priceDiscoveryService.getPrice(goods.id);
      const basePrice = goods.basePrice;
      
      if (basePrice <= 0) continue;
      
      const deviation = Math.abs(currentPrice - basePrice) / basePrice;
      
      // 如果价格偏离超过 100%，强制回归
      if (deviation > MAX_DEVIATION) {
        // 修正到基准价的1.5倍或0.7倍（更温和的回归）
        const correctedPrice = currentPrice > basePrice
          ? basePrice * 1.5
          : basePrice * 0.7;
        
        priceDiscoveryService.forceSetPrice(goods.id, correctedPrice);
        correctionCount++;
        
        // 输出详细日志以便调试
        console.log(`[Economy] 价格修正: ${goods.id} 从 ${currentPrice.toFixed(0)} 到 ${correctedPrice.toFixed(0)} (偏离${(deviation * 100).toFixed(1)}%)`);
      }
    }
    
    if (correctionCount > 0) {
      console.log(`[Economy] 价格健康检查: tick=${currentTick}, 修正了 ${correctionCount} 个商品价格`);
    }
  }
  
  /**
   * 获取POPs满足度（Victoria 3 风格）
   */
  getPOPsSatisfaction(): Map<string, Record<string, number>> {
    return popsConsumptionManager.getAllSatisfaction();
  }
  
  /**
   * 获取POPs需求预测
   */
  getPOPsDemandForecast(): Record<string, number> {
    return popsConsumptionManager.getDemandForecast();
  }
  
  /**
   * 重置经济系统
   */
  reset(): void {
    inventoryManager.reset();
    marketOrderBook.reset();
    matchingEngine.reset();
    priceDiscoveryService.reset();
    popsConsumptionManager.reset();
    // 注意：aiCompanyManager 由 gameLoop 管理，不在这里重置
    
    this.initialized = false;
    this.currentTick = 0;
    this.lastStats = null;
    
    console.log('[EconomyManager] Economic system reset');
  }
}

// 单例实例
export const economyManager = new EconomyManager();