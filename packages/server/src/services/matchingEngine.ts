/**
 * 订单撮合引擎
 * 匹配买卖订单并执行交易
 */

import { EventEmitter } from 'events';
import type { TradeRecord, MarketOrder } from '@scc/shared';
import { GOODS_DATA } from '@scc/shared';
import { marketOrderBook } from './marketOrderBook.js';
import { inventoryManager } from './inventoryManager.js';

/**
 * 单个公司的市场份额数据
 */
export interface CompanyShare {
  companyId: string;
  quantity: number;
  turnover: number;
  quantityShare: number;  // 销售量占比 0-100%
  turnoverShare: number;  // 销售额占比 0-100%
}

/**
 * 市场占比统计数据
 */
export interface MarketShareData {
  goodsId: string;
  periodTicks: number;
  totalQuantity: number;
  totalTurnover: number;
  tradeCount: number;
  shares: CompanyShare[];
}

/**
 * 撮合引擎 - 单例
 */
export class MatchingEngine extends EventEmitter {
  /** 交易ID计数器 */
  private tradeIdCounter: number = 0;
  /** 交易历史 */
  private tradeHistory: TradeRecord[] = [];
  /** 历史记录保留数量 */
  private readonly MAX_HISTORY_SIZE = 10000;
  
  constructor() {
    super();
  }
  
  /**
   * 生成唯一交易ID
   */
  private generateTradeId(): string {
    this.tradeIdCounter++;
    return `trade-${Date.now()}-${this.tradeIdCounter}`;
  }
  
  /**
   * 执行单笔交易
   */
  executeTrade(
    buyOrder: MarketOrder,
    sellOrder: MarketOrder,
    quantity: number,
    price: number,
    currentTick: number
  ): TradeRecord | null {
    // 验证可成交
    if (buyOrder.pricePerUnit < sellOrder.pricePerUnit) {
      console.warn('[MatchingEngine] Cannot execute trade: buy price < sell price');
      return null;
    }
    
    if (buyOrder.companyId === sellOrder.companyId) {
      console.warn('[MatchingEngine] Cannot execute trade: same company');
      return null;
    }
    
    const actualQuantity = Math.min(
      quantity,
      buyOrder.remainingQuantity,
      sellOrder.remainingQuantity
    );
    
    if (actualQuantity <= 0) {
      return null;
    }
    
    const tradeId = this.generateTradeId();
    const totalValue = price * actualQuantity;
    
    // 1. 买方支付货款并获得商品
    const purchaseResult = inventoryManager.completePurchase(
      buyOrder.companyId,
      buyOrder.goodsId,
      actualQuantity,
      price,
      currentTick,
      tradeId
    );
    
    if (!purchaseResult.success) {
      console.warn(`[MatchingEngine] Purchase failed: ${purchaseResult.error}`);
      return null;
    }
    
    // 2. 卖方交付商品并获得货款
    const saleResult = inventoryManager.completeSale(
      sellOrder.companyId,
      sellOrder.goodsId,
      actualQuantity,
      price,
      currentTick,
      tradeId
    );
    
    if (!saleResult.success) {
      // 回滚买方交易（这是简化处理，实际应该有更完善的回滚机制）
      console.warn(`[MatchingEngine] Sale failed for ${sellOrder.companyId}: ${saleResult.error}`);
      // TODO: 需要实现回滚机制，目前买方已经付款并获得商品，但卖方没有收到钱
      return null;
    }
    
    // 3. 更新订单状态
    marketOrderBook.updateOrderAfterTrade(buyOrder.id, actualQuantity, currentTick);
    marketOrderBook.updateOrderAfterTrade(sellOrder.id, actualQuantity, currentTick);
    
    // 4. 创建交易记录
    const trade: TradeRecord = {
      id: tradeId,
      goodsId: buyOrder.goodsId,
      buyerCompanyId: buyOrder.companyId,
      sellerCompanyId: sellOrder.companyId,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      quantity: actualQuantity,
      pricePerUnit: price,
      totalValue,
      tick: currentTick,
      timestamp: Date.now(),
    };
    
    // 5. 记录交易
    this.recordTrade(trade);
    
    // 详细的交易日志
    const buyerIsPlayer = buyOrder.companyId.includes('player');
    const sellerIsPlayer = sellOrder.companyId.includes('player');
    
    if (buyerIsPlayer || sellerIsPlayer) {
      console.log(`[MatchingEngine] 💰 玩家参与交易:`);
      console.log(`  商品: ${buyOrder.goodsId}, 数量: ${actualQuantity}, 单价: ${price.toFixed(2)}`);
      console.log(`  买方: ${buyOrder.companyId}${buyerIsPlayer ? ' (玩家)' : ''}`);
      console.log(`  卖方: ${sellOrder.companyId}${sellerIsPlayer ? ' (玩家)' : ''}`);
      console.log(`  总额: $${totalValue.toFixed(2)}`);
    } else {
      console.log(`[MatchingEngine] Trade executed: ${actualQuantity} ${buyOrder.goodsId} @ ${price}`);
    }
    
    this.emit('tradeExecuted', trade);
    
    return trade;
  }
  
  /**
   * 处理单个商品的订单撮合
   */
  matchOrdersForGoods(goodsId: string, currentTick: number): TradeRecord[] {
    const trades: TradeRecord[] = [];
    let matchedCount = 0;
    const maxMatches = 100; // 防止无限循环
    
    while (matchedCount < maxMatches) {
      const matches = marketOrderBook.getMatchableOrders(goodsId);
      if (matches.length === 0) break;
      
      // 取第一个可匹配的订单对
      const match = matches[0];
      if (!match) break;
      
      const { buyOrder, sellOrder } = match;
      
      // 确定成交价格（使用卖价，对买方有利）
      const tradePrice = sellOrder.pricePerUnit;
      
      // 确定成交数量
      const tradeQuantity = Math.min(
        buyOrder.remainingQuantity,
        sellOrder.remainingQuantity
      );
      
      if (tradeQuantity <= 0) break;
      
      // 执行交易
      const trade = this.executeTrade(
        buyOrder,
        sellOrder,
        tradeQuantity,
        tradePrice,
        currentTick
      );
      
      if (trade) {
        trades.push(trade);
        matchedCount++;
      } else {
        // 如果交易失败，跳过这个订单对
        break;
      }
    }
    
    // 撮合完成后，检查是否有玩家订单未被匹配（每10 tick输出一次，避免日志过多）
    if (currentTick % 10 === 0) {
      this.logUnmatchedPlayerOrders(goodsId);
    }
    
    return trades;
  }
  
  /**
   * 输出未匹配的玩家订单警告
   */
  private logUnmatchedPlayerOrders(goodsId: string): void {
    const orderBook = marketOrderBook.getOrderBook(goodsId);
    if (!orderBook) return;
    
    const playerBuyOrders = orderBook.buyOrders.filter(o =>
      o.companyId.includes('player') &&
      (o.status === 'open' || o.status === 'partial') &&
      o.remainingQuantity > 0
    );
    const playerSellOrders = orderBook.sellOrders.filter(o =>
      o.companyId.includes('player') &&
      (o.status === 'open' || o.status === 'partial') &&
      o.remainingQuantity > 0
    );
    
    if (playerBuyOrders.length === 0 && playerSellOrders.length === 0) return;
    
    const bestAsk = orderBook.bestAsk;
    const bestBid = orderBook.bestBid;
    
    for (const order of playerBuyOrders) {
      if (bestAsk && order.pricePerUnit < bestAsk) {
        console.log(`[MatchingEngine] ⚠️ 玩家买单无法匹配: ${goodsId} 买价=${order.pricePerUnit.toFixed(2)} < 最低卖价=${bestAsk.toFixed(2)} (剩余${order.remainingQuantity})`);
      } else if (!bestAsk) {
        console.log(`[MatchingEngine] ⚠️ 玩家买单等待卖方: ${goodsId} 买价=${order.pricePerUnit.toFixed(2)} (市场无卖单)`);
      }
    }
    
    for (const order of playerSellOrders) {
      if (bestBid && order.pricePerUnit > bestBid) {
        console.log(`[MatchingEngine] ⚠️ 玩家卖单无法匹配: ${goodsId} 卖价=${order.pricePerUnit.toFixed(2)} > 最高买价=${bestBid.toFixed(2)} (剩余${order.remainingQuantity})`);
      } else if (!bestBid) {
        console.log(`[MatchingEngine] ⚠️ 玩家卖单等待买方: ${goodsId} 卖价=${order.pricePerUnit.toFixed(2)} (市场无买单)`);
      }
    }
  }
  
  /**
   * 处理所有商品的订单撮合
   */
  processAllMatches(currentTick: number): TradeRecord[] {
    const allTrades: TradeRecord[] = [];
    
    for (const goods of GOODS_DATA) {
      const trades = this.matchOrdersForGoods(goods.id, currentTick);
      allTrades.push(...trades);
    }
    
    if (allTrades.length > 0) {
      console.log(`[MatchingEngine] Processed ${allTrades.length} trades this tick`);
    }
    
    return allTrades;
  }
  
  /**
   * 记录交易
   */
  private recordTrade(trade: TradeRecord): void {
    this.tradeHistory.push(trade);
    
    // 限制历史记录大小
    if (this.tradeHistory.length > this.MAX_HISTORY_SIZE) {
      this.tradeHistory = this.tradeHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }
  
  /**
   * 获取交易历史
   */
  getTradeHistory(goodsId?: string, limit: number = 100): TradeRecord[] {
    let history = this.tradeHistory;
    
    if (goodsId) {
      history = history.filter(t => t.goodsId === goodsId);
    }
    
    return history.slice(-limit);
  }
  
  /**
   * 获取商品的最近成交价
   */
  getLastTradePrice(goodsId: string): number | null {
    const trades = this.tradeHistory.filter(t => t.goodsId === goodsId);
    if (trades.length === 0) return null;
    return trades[trades.length - 1]?.pricePerUnit ?? null;
  }
  
  /**
   * 获取商品的成交量（指定tick范围）
   */
  getVolume(goodsId: string, startTick: number, endTick: number): number {
    return this.tradeHistory
      .filter(t => t.goodsId === goodsId && t.tick >= startTick && t.tick <= endTick)
      .reduce((sum, t) => sum + t.quantity, 0);
  }
  
  /**
   * 获取商品的成交额（指定tick范围）
   */
  getTurnover(goodsId: string, startTick: number, endTick: number): number {
    return this.tradeHistory
      .filter(t => t.goodsId === goodsId && t.tick >= startTick && t.tick <= endTick)
      .reduce((sum, t) => sum + t.totalValue, 0);
  }
  
  /**
   * 获取成交量加权平均价 VWAP
   */
  getVWAP(goodsId: string, ticks: number, currentTick: number): number | null {
    const startTick = currentTick - ticks;
    const trades = this.tradeHistory.filter(
      t => t.goodsId === goodsId && t.tick >= startTick
    );
    
    if (trades.length === 0) return null;
    
    const totalValue = trades.reduce((sum, t) => sum + t.totalValue, 0);
    const totalVolume = trades.reduce((sum, t) => sum + t.quantity, 0);
    
    return totalVolume > 0 ? totalValue / totalVolume : null;
  }
  
  /**
   * 获取特定商品的市场占比数据
   * @param goodsId 商品ID
   * @param ticks 统计周期（tick数），默认720（约1个月）
   * @param currentTick 当前tick
   */
  getMarketShare(goodsId: string, ticks: number = 720, currentTick: number = 0): MarketShareData {
    const startTick = ticks > 0 ? currentTick - ticks : 0;
    const trades = this.tradeHistory.filter(
      t => t.goodsId === goodsId && (ticks <= 0 || t.tick >= startTick)
    );
    
    // 统计各公司的销售量和销售额
    const sellerStats = new Map<string, { quantity: number; turnover: number }>();
    let totalQuantity = 0;
    let totalTurnover = 0;
    
    for (const trade of trades) {
      totalQuantity += trade.quantity;
      totalTurnover += trade.totalValue;
      
      const existing = sellerStats.get(trade.sellerCompanyId) || { quantity: 0, turnover: 0 };
      existing.quantity += trade.quantity;
      existing.turnover += trade.totalValue;
      sellerStats.set(trade.sellerCompanyId, existing);
    }
    
    // 转换为占比数据
    const shares: CompanyShare[] = [];
    for (const [companyId, stats] of sellerStats) {
      shares.push({
        companyId,
        quantity: stats.quantity,
        turnover: stats.turnover,
        quantityShare: totalQuantity > 0 ? (stats.quantity / totalQuantity) * 100 : 0,
        turnoverShare: totalTurnover > 0 ? (stats.turnover / totalTurnover) * 100 : 0,
      });
    }
    
    // 按销售量降序排序
    shares.sort((a, b) => b.quantity - a.quantity);
    
    return {
      goodsId,
      periodTicks: ticks,
      totalQuantity,
      totalTurnover,
      tradeCount: trades.length,
      shares,
    };
  }
  
  /**
   * 获取特定公司在特定商品的市场占比
   */
  getCompanyMarketShare(goodsId: string, companyId: string, ticks: number = 720, currentTick: number = 0): CompanyShare | null {
    const marketShare = this.getMarketShare(goodsId, ticks, currentTick);
    return marketShare.shares.find(s => s.companyId === companyId) || null;
  }
  
  /**
   * 重置撮合引擎
   */
  reset(): void {
    this.tradeHistory = [];
    this.tradeIdCounter = 0;
    console.log('[MatchingEngine] Reset');
  }
}

// 单例实例
export const matchingEngine = new MatchingEngine();