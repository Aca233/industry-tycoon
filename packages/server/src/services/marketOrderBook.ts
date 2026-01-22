/**
 * 市场订单簿
 * 管理所有商品的买卖订单
 */

import { EventEmitter } from 'events';
import type {
  MarketOrder,
  GoodsOrderBook,
  MarketDepth,
} from '@scc/shared';
import { GOODS_DATA } from '@scc/shared';

/**
 * 订单簿管理器 - 单例
 */
export class MarketOrderBook extends EventEmitter {
  /** 订单簿 Map<goodsId, GoodsOrderBook> */
  private orderBooks: Map<string, GoodsOrderBook> = new Map();
  /** 所有订单索引 Map<orderId, MarketOrder> */
  private orders: Map<string, MarketOrder> = new Map();
  /** 订单ID计数器 */
  private orderIdCounter: number = 0;
  /** 默认订单有效期（tick数） */
  private readonly DEFAULT_VALIDITY_TICKS = 720; // 1个月
  
  constructor() {
    super();
    this.initializeOrderBooks();
  }
  
  /**
   * 初始化所有商品的订单簿
   */
  private initializeOrderBooks(): void {
    for (const goods of GOODS_DATA) {
      this.orderBooks.set(goods.id, {
        goodsId: goods.id,
        buyOrders: [],
        sellOrders: [],
        bestBid: null,
        bestAsk: null,
        spread: null,
      });
    }
    console.log(`[MarketOrderBook] Initialized order books for ${GOODS_DATA.length} goods`);
  }
  
  /**
   * 生成唯一订单ID
   */
  private generateOrderId(): string {
    this.orderIdCounter++;
    return `order-${Date.now()}-${this.orderIdCounter}`;
  }
  
  /**
   * 提交买单
   */
  submitBuyOrder(
    companyId: string,
    goodsId: string,
    quantity: number,
    maxPrice: number,
    currentTick: number,
    validityTicks: number = this.DEFAULT_VALIDITY_TICKS
  ): MarketOrder {
    const orderId = this.generateOrderId();
    
    const order: MarketOrder = {
      id: orderId,
      companyId,
      goodsId,
      orderType: 'buy',
      quantity,
      remainingQuantity: quantity,
      pricePerUnit: maxPrice,
      status: 'open',
      createdTick: currentTick,
      expiryTick: currentTick + validityTicks,
      lastUpdateTick: currentTick,
    };
    
    // 添加到订单索引
    this.orders.set(orderId, order);
    
    // 添加到订单簿（按价格降序，价高者优先）
    const orderBook = this.orderBooks.get(goodsId);
    if (orderBook) {
      orderBook.buyOrders.push(order);
      orderBook.buyOrders.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
      this.updateBestPrices(goodsId);
    }
    
    this.emit('orderSubmitted', { order, type: 'buy' });
    console.log(`[MarketOrderBook] Buy order submitted: ${quantity} ${goodsId} @ ${maxPrice}`);
    
    return order;
  }
  
  /**
   * 提交卖单
   */
  submitSellOrder(
    companyId: string,
    goodsId: string,
    quantity: number,
    minPrice: number,
    currentTick: number,
    validityTicks: number = this.DEFAULT_VALIDITY_TICKS
  ): MarketOrder {
    const orderId = this.generateOrderId();
    
    const order: MarketOrder = {
      id: orderId,
      companyId,
      goodsId,
      orderType: 'sell',
      quantity,
      remainingQuantity: quantity,
      pricePerUnit: minPrice,
      status: 'open',
      createdTick: currentTick,
      expiryTick: currentTick + validityTicks,
      lastUpdateTick: currentTick,
    };
    
    // 添加到订单索引
    this.orders.set(orderId, order);
    
    // 添加到订单簿（按价格升序，价低者优先）
    const orderBook = this.orderBooks.get(goodsId);
    if (orderBook) {
      orderBook.sellOrders.push(order);
      orderBook.sellOrders.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
      this.updateBestPrices(goodsId);
    }
    
    this.emit('orderSubmitted', { order, type: 'sell' });
    console.log(`[MarketOrderBook] Sell order submitted: ${quantity} ${goodsId} @ ${minPrice}`);
    
    return order;
  }
  
  /**
   * 取消订单
   */
  cancelOrder(orderId: string, currentTick: number): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;
    
    if (order.status !== 'open' && order.status !== 'partial') {
      return false;
    }
    
    order.status = 'cancelled';
    order.lastUpdateTick = currentTick;
    
    // 从订单簿中移除
    const orderBook = this.orderBooks.get(order.goodsId);
    if (orderBook) {
      if (order.orderType === 'buy') {
        orderBook.buyOrders = orderBook.buyOrders.filter(o => o.id !== orderId);
      } else {
        orderBook.sellOrders = orderBook.sellOrders.filter(o => o.id !== orderId);
      }
      this.updateBestPrices(order.goodsId);
    }
    
    this.emit('orderCancelled', { order });
    console.log(`[MarketOrderBook] Order cancelled: ${orderId}`);
    
    return true;
  }
  
  /**
   * 获取订单
   */
  getOrder(orderId: string): MarketOrder | undefined {
    return this.orders.get(orderId);
  }
  
  /**
   * 获取商品订单簿
   */
  getOrderBook(goodsId: string): GoodsOrderBook | undefined {
    return this.orderBooks.get(goodsId);
  }
  
  /**
   * 获取最佳买价（最高买入价）
   */
  getBestBid(goodsId: string): number | null {
    const orderBook = this.orderBooks.get(goodsId);
    if (!orderBook || orderBook.buyOrders.length === 0) return null;
    return orderBook.buyOrders[0]?.pricePerUnit ?? null;
  }
  
  /**
   * 获取最佳卖价（最低卖出价）
   */
  getBestAsk(goodsId: string): number | null {
    const orderBook = this.orderBooks.get(goodsId);
    if (!orderBook || orderBook.sellOrders.length === 0) return null;
    return orderBook.sellOrders[0]?.pricePerUnit ?? null;
  }
  
  /**
   * 获取市场深度
   */
  getMarketDepth(goodsId: string, levels: number = 5): MarketDepth {
    const orderBook = this.orderBooks.get(goodsId);
    
    const result: MarketDepth = {
      goodsId,
      bids: [],
      asks: [],
      bestBid: null,
      bestAsk: null,
      spread: null,
      totalBuyVolume: 0,
      totalSellVolume: 0,
    };
    
    if (!orderBook) return result;
    
    // 聚合买单深度（包含公司信息）
    const bidMap = new Map<number, {
      quantity: number;
      orderCount: number;
      companies: Map<string, number>;
    }>();
    let totalBuyVolume = 0;
    for (const order of orderBook.buyOrders) {
      if (order.status !== 'open' && order.status !== 'partial') continue;
      totalBuyVolume += order.remainingQuantity;
      const existing = bidMap.get(order.pricePerUnit);
      if (existing) {
        existing.quantity += order.remainingQuantity;
        existing.orderCount++;
        const prevQty = existing.companies.get(order.companyId) ?? 0;
        existing.companies.set(order.companyId, prevQty + order.remainingQuantity);
      } else {
        const companies = new Map<string, number>();
        companies.set(order.companyId, order.remainingQuantity);
        bidMap.set(order.pricePerUnit, {
          quantity: order.remainingQuantity,
          orderCount: 1,
          companies
        });
      }
    }
    
    // 转换为数组并排序（价格降序）
    const bids = Array.from(bidMap.entries())
      .map(([price, data]) => ({
        price,
        quantity: data.quantity,
        orderCount: data.orderCount,
        companies: Array.from(data.companies.entries()).map(([companyId, qty]) => ({
          companyId,
          quantity: qty
        }))
      }))
      .sort((a, b) => b.price - a.price)
      .slice(0, levels);
    
    // 聚合卖单深度（包含公司信息）
    const askMap = new Map<number, {
      quantity: number;
      orderCount: number;
      companies: Map<string, number>;
    }>();
    let totalSellVolume = 0;
    for (const order of orderBook.sellOrders) {
      if (order.status !== 'open' && order.status !== 'partial') continue;
      totalSellVolume += order.remainingQuantity;
      const existing = askMap.get(order.pricePerUnit);
      if (existing) {
        existing.quantity += order.remainingQuantity;
        existing.orderCount++;
        const prevQty = existing.companies.get(order.companyId) ?? 0;
        existing.companies.set(order.companyId, prevQty + order.remainingQuantity);
      } else {
        const companies = new Map<string, number>();
        companies.set(order.companyId, order.remainingQuantity);
        askMap.set(order.pricePerUnit, {
          quantity: order.remainingQuantity,
          orderCount: 1,
          companies
        });
      }
    }
    
    // 转换为数组并排序（价格升序）
    const asks = Array.from(askMap.entries())
      .map(([price, data]) => ({
        price,
        quantity: data.quantity,
        orderCount: data.orderCount,
        companies: Array.from(data.companies.entries()).map(([companyId, qty]) => ({
          companyId,
          quantity: qty
        }))
      }))
      .sort((a, b) => a.price - b.price)
      .slice(0, levels);
    
    result.bids = bids;
    result.asks = asks;
    result.bestBid = orderBook.bestBid;
    result.bestAsk = orderBook.bestAsk;
    result.spread = orderBook.spread;
    result.totalBuyVolume = totalBuyVolume;
    result.totalSellVolume = totalSellVolume;
    
    return result;
  }
  
  /**
   * 获取可匹配的订单对
   * 返回买单价格 >= 卖单价格的订单对
   */
  getMatchableOrders(goodsId: string): Array<{ buyOrder: MarketOrder; sellOrder: MarketOrder }> {
    const orderBook = this.orderBooks.get(goodsId);
    if (!orderBook) return [];
    
    const matches: Array<{ buyOrder: MarketOrder; sellOrder: MarketOrder }> = [];
    
    // 遍历买单（价格高的优先）
    for (const buyOrder of orderBook.buyOrders) {
      if (buyOrder.status !== 'open' && buyOrder.status !== 'partial') continue;
      if (buyOrder.remainingQuantity <= 0) continue;
      
      // 找到可以匹配的卖单（价格低的优先）
      for (const sellOrder of orderBook.sellOrders) {
        if (sellOrder.status !== 'open' && sellOrder.status !== 'partial') continue;
        if (sellOrder.remainingQuantity <= 0) continue;
        if (sellOrder.companyId === buyOrder.companyId) continue; // 不能自成交
        
        // 买单价格 >= 卖单价格，可以成交
        if (buyOrder.pricePerUnit >= sellOrder.pricePerUnit) {
          matches.push({ buyOrder, sellOrder });
        }
      }
    }
    
    return matches;
  }
  
  /**
   * 更新订单状态（成交后调用）
   */
  updateOrderAfterTrade(orderId: string, tradedQuantity: number, currentTick: number): void {
    const order = this.orders.get(orderId);
    if (!order) return;
    
    order.remainingQuantity -= tradedQuantity;
    order.lastUpdateTick = currentTick;
    
    if (order.remainingQuantity <= 0) {
      order.status = 'filled';
      order.remainingQuantity = 0;
      
      // 从订单簿中移除
      const orderBook = this.orderBooks.get(order.goodsId);
      if (orderBook) {
        if (order.orderType === 'buy') {
          orderBook.buyOrders = orderBook.buyOrders.filter(o => o.id !== orderId);
        } else {
          orderBook.sellOrders = orderBook.sellOrders.filter(o => o.id !== orderId);
        }
        this.updateBestPrices(order.goodsId);
      }
    } else {
      order.status = 'partial';
    }
  }
  
  /**
   * 更新最佳买卖价
   */
  private updateBestPrices(goodsId: string): void {
    const orderBook = this.orderBooks.get(goodsId);
    if (!orderBook) return;
    
    // 更新最佳买价
    const activeBuyOrders = orderBook.buyOrders.filter(
      o => o.status === 'open' || o.status === 'partial'
    );
    orderBook.bestBid = activeBuyOrders.length > 0 
      ? activeBuyOrders[0]?.pricePerUnit ?? null
      : null;
    
    // 更新最佳卖价
    const activeSellOrders = orderBook.sellOrders.filter(
      o => o.status === 'open' || o.status === 'partial'
    );
    orderBook.bestAsk = activeSellOrders.length > 0 
      ? activeSellOrders[0]?.pricePerUnit ?? null
      : null;
    
    // 更新价差
    if (orderBook.bestBid !== null && orderBook.bestAsk !== null) {
      orderBook.spread = orderBook.bestAsk - orderBook.bestBid;
    } else {
      orderBook.spread = null;
    }
  }
  
  /**
   * 清理过期订单
   */
  cleanupExpiredOrders(currentTick: number): number {
    let cleanedCount = 0;
    
    for (const [orderId, order] of this.orders) {
      if (order.expiryTick > 0 && currentTick >= order.expiryTick) {
        if (order.status === 'open' || order.status === 'partial') {
          order.status = 'expired';
          order.lastUpdateTick = currentTick;
          
          // 从订单簿中移除
          const orderBook = this.orderBooks.get(order.goodsId);
          if (orderBook) {
            if (order.orderType === 'buy') {
              orderBook.buyOrders = orderBook.buyOrders.filter(o => o.id !== orderId);
            } else {
              orderBook.sellOrders = orderBook.sellOrders.filter(o => o.id !== orderId);
            }
            this.updateBestPrices(order.goodsId);
          }
          
          this.emit('orderExpired', { order });
          cleanedCount++;
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[MarketOrderBook] Cleaned up ${cleanedCount} expired orders`);
    }
    
    return cleanedCount;
  }
  
  /**
   * 获取公司的所有订单
   */
  getCompanyOrders(companyId: string): MarketOrder[] {
    const orders: MarketOrder[] = [];
    for (const order of this.orders.values()) {
      if (order.companyId === companyId) {
        orders.push(order);
      }
    }
    return orders;
  }
  
  /**
   * 获取公司的活跃订单
   */
  getCompanyActiveOrders(companyId: string): MarketOrder[] {
    return this.getCompanyOrders(companyId).filter(
      o => o.status === 'open' || o.status === 'partial'
    );
  }
  
  /**
   * 获取订单簿统计信息
   * 用于经济诊断日志
   */
  getOrderBookStats(): {
    totalBuyOrders: number;
    totalSellOrders: number;
    totalActiveOrders: number;
    goodsWithBuyOrders: number;
    goodsWithSellOrders: number;
  } {
    let totalBuyOrders = 0;
    let totalSellOrders = 0;
    let goodsWithBuyOrders = 0;
    let goodsWithSellOrders = 0;
    
    for (const orderBook of this.orderBooks.values()) {
      const activeBuys = orderBook.buyOrders.filter(
        o => o.status === 'open' || o.status === 'partial'
      );
      const activeSells = orderBook.sellOrders.filter(
        o => o.status === 'open' || o.status === 'partial'
      );
      
      totalBuyOrders += activeBuys.length;
      totalSellOrders += activeSells.length;
      
      if (activeBuys.length > 0) goodsWithBuyOrders++;
      if (activeSells.length > 0) goodsWithSellOrders++;
    }
    
    return {
      totalBuyOrders,
      totalSellOrders,
      totalActiveOrders: totalBuyOrders + totalSellOrders,
      goodsWithBuyOrders,
      goodsWithSellOrders,
    };
  }
  
  /**
   * 重置订单簿
   */
  reset(): void {
    this.orders.clear();
    this.orderIdCounter = 0;
    this.initializeOrderBooks();
    console.log('[MarketOrderBook] Reset all order books');
  }
}

// 单例实例
export const marketOrderBook = new MarketOrderBook();