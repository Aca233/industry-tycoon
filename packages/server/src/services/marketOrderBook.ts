/**
 * 市场订单簿
 * 管理所有商品的买卖订单
 *
 * 性能优化 v2:
 * - 使用二分查找插入订单 O(log n)
 * - 使用索引直接删除订单 O(1)
 * - 缓存活跃订单数量避免重复遍历
 * - 优化订单匹配算法
 * - 增量式撮合：通知撮合引擎有新订单到达
 */

import { EventEmitter } from 'events';
import type {
  MarketOrder,
  GoodsOrderBook,
  MarketDepth,
} from '@scc/shared';
import { GOODS_DATA } from '@scc/shared';

/**
 * 二分查找插入位置（买单：价格降序）
 * 返回应该插入的索引位置
 */
function binarySearchBuyInsert(orders: MarketOrder[], price: number): number {
  let left = 0;
  let right = orders.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
    // 买单按价格降序，price高的在前
    if (orders[mid]!.pricePerUnit > price) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

/**
 * 二分查找插入位置（卖单：价格升序）
 * 返回应该插入的索引位置
 */
function binarySearchSellInsert(orders: MarketOrder[], price: number): number {
  let left = 0;
  let right = orders.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
    // 卖单按价格升序，price低的在前
    if (orders[mid]!.pricePerUnit < price) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

/**
 * 扩展的订单簿数据结构，包含索引
 */
interface OptimizedOrderBook extends GoodsOrderBook {
  /** 订单ID到数组索引的映射 */
  buyOrderIndex: Map<string, number>;
  sellOrderIndex: Map<string, number>;
  /** 活跃订单数量缓存 */
  activeBuyCount: number;
  activeSellCount: number;
}

/**
 * 订单簿管理器 - 单例
 */
export class MarketOrderBook extends EventEmitter {
  /** 订单簿 Map<goodsId, OptimizedOrderBook> */
  private orderBooks: Map<string, OptimizedOrderBook> = new Map();
  /** 所有订单索引 Map<orderId, MarketOrder> */
  private orders: Map<string, MarketOrder> = new Map();
  /** 订单ID计数器 */
  private orderIdCounter: number = 0;
  /** 默认订单有效期（tick数）- 缩短到24 ticks（1天）减少订单累积 */
  private readonly DEFAULT_VALIDITY_TICKS = 24; // 1天
  /** 每个商品最大订单数限制 */
  private readonly MAX_ORDERS_PER_GOODS = 100; // 降低限制
  /** 每家公司每种商品最大活跃订单数 */
  private readonly MAX_ORDERS_PER_COMPANY_GOODS = 3; // 降低限制
  /** 有活跃订单的商品ID缓存 */
  private activeGoodsSet: Set<string> = new Set();
  /** 新订单回调（用于增量式撮合） */
  private onNewOrderCallback: ((goodsId: string, orderId: string) => void) | null = null;
  
  constructor() {
    super();
    this.initializeOrderBooks();
  }
  
  /**
   * 设置新订单回调（供撮合引擎使用）
   */
  setNewOrderCallback(callback: (goodsId: string, orderId: string) => void): void {
    this.onNewOrderCallback = callback;
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
        // 扩展字段
        buyOrderIndex: new Map(),
        sellOrderIndex: new Map(),
        activeBuyCount: 0,
        activeSellCount: 0,
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
    
    // 检查该公司在该商品上的订单数是否超限
    const orderBook = this.orderBooks.get(goodsId);
    if (orderBook) {
      // 检查公司订单限制
      let companyOrderCount = 0;
      for (const o of orderBook.buyOrders) {
        if (o.companyId === companyId && (o.status === 'open' || o.status === 'partial')) {
          companyOrderCount++;
        }
      }
      if (companyOrderCount >= this.MAX_ORDERS_PER_COMPANY_GOODS) {
        // 取消最旧的订单以腾出空间
        for (const o of orderBook.buyOrders) {
          if (o.companyId === companyId && (o.status === 'open' || o.status === 'partial')) {
            o.status = 'cancelled';
            orderBook.activeBuyCount = Math.max(0, orderBook.activeBuyCount - 1);
            break; // 只取消一个
          }
        }
      }
      
      // 检查总订单限制
      if (orderBook.activeBuyCount >= this.MAX_ORDERS_PER_GOODS) {
        // 移除最旧的订单（数组末尾的是最旧的，因为按价格排序）
        const oldestIdx = orderBook.buyOrders.length - 1;
        if (oldestIdx >= 0) {
          const oldest = orderBook.buyOrders[oldestIdx];
          if (oldest) {
            oldest.status = 'cancelled';
            orderBook.buyOrders.pop();
            orderBook.activeBuyCount = Math.max(0, orderBook.activeBuyCount - 1);
          }
        }
      }
    }
    
    // 添加到订单索引
    this.orders.set(orderId, order);
    
    // 添加到订单簿（使用二分查找插入，保持价格降序）
    if (orderBook) {
      const insertIdx = binarySearchBuyInsert(orderBook.buyOrders, maxPrice);
      orderBook.buyOrders.splice(insertIdx, 0, order);
      // 增量更新索引（只更新插入点之后的索引）
      this.incrementalUpdateBuyIndex(orderBook, insertIdx);
      orderBook.activeBuyCount++;
      this.updateBestPricesOptimized(orderBook);
    }
    
    // 更新活跃商品缓存
    this.activeGoodsSet.add(goodsId);
    
    // 通知撮合引擎有新订单（增量撮合优化）
    if (this.onNewOrderCallback) {
      this.onNewOrderCallback(goodsId, orderId);
    }
    
    this.emit('orderSubmitted', { order, type: 'buy' });
    // 降低日志频率，只记录大额订单
    if (quantity > 100) {
      console.log(`[MarketOrderBook] Buy order submitted: ${quantity} ${goodsId} @ ${maxPrice}`);
    }
    
    return order;
  }
  
  /**
   * 批量提交买单（性能优化版）
   * 减少索引重建次数，提高批量操作效率
   */
  submitBuyOrdersBatch(
    orders: Array<{
      companyId: string;
      goodsId: string;
      quantity: number;
      price: number;
    }>,
    currentTick: number,
    validityTicks: number = this.DEFAULT_VALIDITY_TICKS
  ): MarketOrder[] {
    const results: MarketOrder[] = [];
    
    // 按商品分组
    const byGoods = new Map<string, Array<{
      companyId: string;
      quantity: number;
      price: number;
    }>>();
    
    for (const o of orders) {
      const existing = byGoods.get(o.goodsId);
      if (existing) {
        existing.push({ companyId: o.companyId, quantity: o.quantity, price: o.price });
      } else {
        byGoods.set(o.goodsId, [{ companyId: o.companyId, quantity: o.quantity, price: o.price }]);
      }
    }
    
    // 批量处理每个商品的订单
    for (const [goodsId, groupOrders] of byGoods) {
      const orderBook = this.orderBooks.get(goodsId);
      if (!orderBook) continue;
      
      const newOrders: MarketOrder[] = [];
      
      for (const o of groupOrders) {
        // 检查订单限制
        if (orderBook.activeBuyCount >= this.MAX_ORDERS_PER_GOODS) continue;
        
        const orderId = this.generateOrderId();
        const order: MarketOrder = {
          id: orderId,
          companyId: o.companyId,
          goodsId,
          orderType: 'buy',
          quantity: o.quantity,
          remainingQuantity: o.quantity,
          pricePerUnit: o.price,
          status: 'open',
          createdTick: currentTick,
          expiryTick: currentTick + validityTicks,
          lastUpdateTick: currentTick,
        };
        
        this.orders.set(orderId, order);
        newOrders.push(order);
        results.push(order);
      }
      
      if (newOrders.length > 0) {
        // 批量添加订单
        orderBook.buyOrders.push(...newOrders);
        // 只排序一次
        orderBook.buyOrders.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
        // 只重建一次索引
        this.rebuildBuyOrderIndex(orderBook);
        orderBook.activeBuyCount += newOrders.length;
        this.updateBestPricesOptimized(orderBook);
        this.activeGoodsSet.add(goodsId);
        
        // 通知撮合引擎有新订单（增量撮合优化）
        if (this.onNewOrderCallback) {
          for (const order of newOrders) {
            this.onNewOrderCallback(goodsId, order.id);
          }
        }
      }
    }
    
    return results;
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
    
    // 检查该公司在该商品上的订单数是否超限
    const orderBook = this.orderBooks.get(goodsId);
    if (orderBook) {
      // 检查公司订单限制
      let companyOrderCount = 0;
      for (const o of orderBook.sellOrders) {
        if (o.companyId === companyId && (o.status === 'open' || o.status === 'partial')) {
          companyOrderCount++;
        }
      }
      if (companyOrderCount >= this.MAX_ORDERS_PER_COMPANY_GOODS) {
        // 取消最旧的订单以腾出空间
        for (const o of orderBook.sellOrders) {
          if (o.companyId === companyId && (o.status === 'open' || o.status === 'partial')) {
            o.status = 'cancelled';
            orderBook.activeSellCount = Math.max(0, orderBook.activeSellCount - 1);
            break;
          }
        }
      }
      
      // 检查总订单限制
      if (orderBook.activeSellCount >= this.MAX_ORDERS_PER_GOODS) {
        // 移除最旧的卖单（末尾的是价格最高的，也可能是较旧的）
        const oldestIdx = orderBook.sellOrders.length - 1;
        if (oldestIdx >= 0) {
          const oldest = orderBook.sellOrders[oldestIdx];
          if (oldest) {
            oldest.status = 'cancelled';
            orderBook.sellOrders.pop();
            orderBook.activeSellCount = Math.max(0, orderBook.activeSellCount - 1);
          }
        }
      }
    }
    
    // 添加到订单索引
    this.orders.set(orderId, order);
    
    // 添加到订单簿（使用二分查找插入，保持价格升序）
    if (orderBook) {
      const insertIdx = binarySearchSellInsert(orderBook.sellOrders, minPrice);
      orderBook.sellOrders.splice(insertIdx, 0, order);
      // 增量更新索引
      this.incrementalUpdateSellIndex(orderBook, insertIdx);
      orderBook.activeSellCount++;
      this.updateBestPricesOptimized(orderBook);
    }
    
    // 更新活跃商品缓存
    this.activeGoodsSet.add(goodsId);
    
    // 通知撮合引擎有新订单（增量撮合优化）
    if (this.onNewOrderCallback) {
      this.onNewOrderCallback(goodsId, orderId);
    }
    
    this.emit('orderSubmitted', { order, type: 'sell' });
    // 降低日志频率
    if (quantity > 100) {
      console.log(`[MarketOrderBook] Sell order submitted: ${quantity} ${goodsId} @ ${minPrice}`);
    }
    
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
    
    // 从订单簿中移除（使用索引快速定位）
    const orderBook = this.orderBooks.get(order.goodsId);
    if (orderBook) {
      if (order.orderType === 'buy') {
        const idx = orderBook.buyOrderIndex.get(orderId);
        if (idx !== undefined) {
          orderBook.buyOrders.splice(idx, 1);
          this.rebuildBuyOrderIndex(orderBook);
          orderBook.activeBuyCount--;
        }
      } else {
        const idx = orderBook.sellOrderIndex.get(orderId);
        if (idx !== undefined) {
          orderBook.sellOrders.splice(idx, 1);
          this.rebuildSellOrderIndex(orderBook);
          orderBook.activeSellCount--;
        }
      }
      this.updateBestPricesOptimized(orderBook);
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
   * 获取可匹配的订单对（优化版）
   * 返回买单价格 >= 卖单价格的订单对
   *
   * 优化：利用排序特性，买单按价格降序，卖单按价格升序
   * 当最高买价 < 最低卖价时，不可能有匹配，立即返回
   */
  getMatchableOrders(goodsId: string): Array<{ buyOrder: MarketOrder; sellOrder: MarketOrder }> {
    const orderBook = this.orderBooks.get(goodsId);
    if (!orderBook) return [];
    
    // 快速检查：如果没有活跃订单或者价格不匹配，直接返回
    if (orderBook.activeBuyCount === 0 || orderBook.activeSellCount === 0) {
      return [];
    }
    
    // 快速检查：最高买价 < 最低卖价，不可能有匹配
    if (orderBook.bestBid !== null && orderBook.bestAsk !== null) {
      if (orderBook.bestBid < orderBook.bestAsk) {
        return [];
      }
    }
    
    const matches: Array<{ buyOrder: MarketOrder; sellOrder: MarketOrder }> = [];
    
    // 遍历买单（价格高的优先）
    for (const buyOrder of orderBook.buyOrders) {
      if (buyOrder.status !== 'open' && buyOrder.status !== 'partial') continue;
      if (buyOrder.remainingQuantity <= 0) continue;
      
      // 优化：因为卖单按价格升序排列，一旦遇到价格超过买价的卖单，后面都不可能匹配
      for (const sellOrder of orderBook.sellOrders) {
        // 提前终止：卖价超过买价
        if (sellOrder.pricePerUnit > buyOrder.pricePerUnit) break;
        
        if (sellOrder.status !== 'open' && sellOrder.status !== 'partial') continue;
        if (sellOrder.remainingQuantity <= 0) continue;
        if (sellOrder.companyId === buyOrder.companyId) continue; // 不能自成交
        
        // 买单价格 >= 卖单价格，可以成交
        matches.push({ buyOrder, sellOrder });
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
      
      // 从订单簿中移除（使用索引快速定位）
      const orderBook = this.orderBooks.get(order.goodsId);
      if (orderBook) {
        if (order.orderType === 'buy') {
          const idx = orderBook.buyOrderIndex.get(orderId);
          if (idx !== undefined) {
            orderBook.buyOrders.splice(idx, 1);
            this.rebuildBuyOrderIndex(orderBook);
            orderBook.activeBuyCount = Math.max(0, orderBook.activeBuyCount - 1);
          }
        } else {
          const idx = orderBook.sellOrderIndex.get(orderId);
          if (idx !== undefined) {
            orderBook.sellOrders.splice(idx, 1);
            this.rebuildSellOrderIndex(orderBook);
            orderBook.activeSellCount = Math.max(0, orderBook.activeSellCount - 1);
          }
        }
        this.updateBestPricesOptimized(orderBook);
      }
    } else {
      order.status = 'partial';
    }
  }
  
  /**
   * 重建买单索引映射
   */
  private rebuildBuyOrderIndex(orderBook: OptimizedOrderBook): void {
    orderBook.buyOrderIndex.clear();
    for (let i = 0; i < orderBook.buyOrders.length; i++) {
      orderBook.buyOrderIndex.set(orderBook.buyOrders[i]!.id, i);
    }
  }
  
  /**
   * 重建卖单索引映射
   */
  private rebuildSellOrderIndex(orderBook: OptimizedOrderBook): void {
    orderBook.sellOrderIndex.clear();
    for (let i = 0; i < orderBook.sellOrders.length; i++) {
      orderBook.sellOrderIndex.set(orderBook.sellOrders[i]!.id, i);
    }
  }
  
  /**
   * 增量更新买单索引（插入后只更新受影响的索引）
   */
  private incrementalUpdateBuyIndex(orderBook: OptimizedOrderBook, insertIdx: number): void {
    // 新插入的订单设置索引
    const newOrder = orderBook.buyOrders[insertIdx];
    if (newOrder) {
      orderBook.buyOrderIndex.set(newOrder.id, insertIdx);
    }
    // 更新插入点之后的所有订单索引（+1）
    for (let i = insertIdx + 1; i < orderBook.buyOrders.length; i++) {
      const order = orderBook.buyOrders[i];
      if (order) {
        orderBook.buyOrderIndex.set(order.id, i);
      }
    }
  }
  
  /**
   * 增量更新卖单索引（插入后只更新受影响的索引）
   */
  private incrementalUpdateSellIndex(orderBook: OptimizedOrderBook, insertIdx: number): void {
    const newOrder = orderBook.sellOrders[insertIdx];
    if (newOrder) {
      orderBook.sellOrderIndex.set(newOrder.id, insertIdx);
    }
    for (let i = insertIdx + 1; i < orderBook.sellOrders.length; i++) {
      const order = orderBook.sellOrders[i];
      if (order) {
        orderBook.sellOrderIndex.set(order.id, i);
      }
    }
  }
  
  /**
   * 更新最佳买卖价（优化版，利用排序特性）
   */
  private updateBestPricesOptimized(orderBook: OptimizedOrderBook): void {
    // 买单按价格降序，第一个活跃订单就是最高价
    orderBook.bestBid = null;
    for (const order of orderBook.buyOrders) {
      if (order.status === 'open' || order.status === 'partial') {
        orderBook.bestBid = order.pricePerUnit;
        break;
      }
    }
    
    // 卖单按价格升序，第一个活跃订单就是最低价
    orderBook.bestAsk = null;
    for (const order of orderBook.sellOrders) {
      if (order.status === 'open' || order.status === 'partial') {
        orderBook.bestAsk = order.pricePerUnit;
        break;
      }
    }
    
    // 更新价差
    if (orderBook.bestBid !== null && orderBook.bestAsk !== null) {
      orderBook.spread = orderBook.bestAsk - orderBook.bestBid;
    } else {
      orderBook.spread = null;
    }
  }
  
  /** 上次清理的tick */
  private lastCleanupTick: number = 0;
  /** 清理间隔（每10 tick清理一次，减少开销） */
  private readonly CLEANUP_INTERVAL = 10;
  
  /**
   * 清理过期订单（节流版）
   * 每10 tick执行一次，降低清理开销
   */
  cleanupExpiredOrders(currentTick: number): number {
    // 节流：每10 tick才清理一次
    if (currentTick - this.lastCleanupTick < this.CLEANUP_INTERVAL) {
      return 0;
    }
    this.lastCleanupTick = currentTick;
    
    let cleanedCount = 0;
    
    for (const [orderId, order] of this.orders) {
      if (order.expiryTick > 0 && currentTick >= order.expiryTick) {
        if (order.status === 'open' || order.status === 'partial') {
          order.status = 'expired';
          order.lastUpdateTick = currentTick;
          
          // 从订单簿中移除（使用索引快速定位）
          const orderBook = this.orderBooks.get(order.goodsId);
          if (orderBook) {
            if (order.orderType === 'buy') {
              const idx = orderBook.buyOrderIndex.get(orderId);
              if (idx !== undefined) {
                orderBook.buyOrders.splice(idx, 1);
                orderBook.activeBuyCount = Math.max(0, orderBook.activeBuyCount - 1);
              }
            } else {
              const idx = orderBook.sellOrderIndex.get(orderId);
              if (idx !== undefined) {
                orderBook.sellOrders.splice(idx, 1);
                orderBook.activeSellCount = Math.max(0, orderBook.activeSellCount - 1);
              }
            }
          }
          
          this.emit('orderExpired', { order });
          cleanedCount++;
        }
      }
    }
    
    // 批量重建索引（比逐个删除更高效）
    if (cleanedCount > 0) {
      for (const orderBook of this.orderBooks.values()) {
        this.rebuildBuyOrderIndex(orderBook);
        this.rebuildSellOrderIndex(orderBook);
        this.updateBestPricesOptimized(orderBook);
      }
      console.log(`[MarketOrderBook] Cleaned up ${cleanedCount} expired orders`);
    }
    
    return cleanedCount;
  }
  
  /**
   * 获取有活跃订单的商品列表（性能优化）
   * 使用缓存避免每次遍历所有订单簿
   */
  getGoodsWithActiveOrders(): string[] {
    return Array.from(this.activeGoodsSet);
  }
  
  /**
   * 刷新活跃商品缓存（在清理订单后调用）
   */
  private refreshActiveGoodsCache(): void {
    this.activeGoodsSet.clear();
    for (const [goodsId, orderBook] of this.orderBooks) {
      if (orderBook.activeBuyCount > 0 || orderBook.activeSellCount > 0) {
        this.activeGoodsSet.add(goodsId);
      }
    }
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
      // 使用缓存的活跃订单数量，避免遍历
      totalBuyOrders += orderBook.activeBuyCount;
      totalSellOrders += orderBook.activeSellCount;
      
      if (orderBook.activeBuyCount > 0) goodsWithBuyOrders++;
      if (orderBook.activeSellCount > 0) goodsWithSellOrders++;
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