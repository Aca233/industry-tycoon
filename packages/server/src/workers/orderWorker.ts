/**
 * Order Worker - 订单处理 Worker 线程
 * 
 * 在独立线程中执行订单相关的计算密集型任务：
 * 1. 批量订单验证
 * 2. 订单匹配计算
 * 3. 订单簿分析
 */

import { parentPort, workerData } from 'worker_threads';

// Worker ID
const workerId = workerData?.workerId ?? 0;
console.log(`[OrderWorker ${workerId}] Starting...`);

// 消息类型定义
interface WorkerMessage {
  taskId: string;
  type: string;
  data: unknown;
}

interface WorkerResponse {
  taskId: string;
  result?: unknown;
  error?: string;
}

// ===== 订单数据结构 =====

interface OrderData {
  id: string;
  companyId: string;
  goodsId: string;
  orderType: 'buy' | 'sell';
  pricePerUnit: number;
  remainingQuantity: number;
  status: 'open' | 'partial' | 'filled' | 'cancelled' | 'expired';
}

interface OrderBookData {
  goodsId: string;
  buyOrders: OrderData[];
  sellOrders: OrderData[];
  bestBid: number | null;
  bestAsk: number | null;
}

interface MatchResult {
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  price: number;
  goodsId: string;
}

// ===== 订单处理函数 =====

/**
 * 二分查找插入位置（买单：价格降序）
 */
function binarySearchBuyInsert(orders: OrderData[], price: number): number {
  let left = 0;
  let right = orders.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
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
 */
function binarySearchSellInsert(orders: OrderData[], price: number): number {
  let left = 0;
  let right = orders.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
    if (orders[mid]!.pricePerUnit < price) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

/**
 * 验证订单是否有效
 */
function validateOrders(
  orders: Array<{
    companyId: string;
    goodsId: string;
    type: 'buy' | 'sell';
    quantity: number;
    price: number;
  }>,
  constraints: {
    maxOrdersPerCompanyGoods: number;
    maxOrdersPerGoods: number;
    minPrice: number;
    maxPrice: number;
    minQuantity: number;
    maxQuantity: number;
  }
): Array<{
  valid: boolean;
  order: typeof orders[0];
  errors: string[];
}> {
  const results: Array<{
    valid: boolean;
    order: typeof orders[0];
    errors: string[];
  }> = [];
  
  // 统计每个公司每个商品的订单数
  const companyGoodsCount = new Map<string, number>();
  // 统计每个商品的总订单数
  const goodsCount = new Map<string, number>();
  
  for (const order of orders) {
    const errors: string[] = [];
    
    // 价格验证
    if (order.price < constraints.minPrice) {
      errors.push(`价格低于最小值: ${order.price} < ${constraints.minPrice}`);
    }
    if (order.price > constraints.maxPrice) {
      errors.push(`价格高于最大值: ${order.price} > ${constraints.maxPrice}`);
    }
    
    // 数量验证
    if (order.quantity < constraints.minQuantity) {
      errors.push(`数量低于最小值: ${order.quantity} < ${constraints.minQuantity}`);
    }
    if (order.quantity > constraints.maxQuantity) {
      errors.push(`数量高于最大值: ${order.quantity} > ${constraints.maxQuantity}`);
    }
    
    // 公司商品订单数限制
    const companyGoodsKey = `${order.companyId}-${order.goodsId}`;
    const currentCompanyGoodsCount = companyGoodsCount.get(companyGoodsKey) ?? 0;
    if (currentCompanyGoodsCount >= constraints.maxOrdersPerCompanyGoods) {
      errors.push(`公司单商品订单数超限: ${currentCompanyGoodsCount} >= ${constraints.maxOrdersPerCompanyGoods}`);
    }
    
    // 商品总订单数限制
    const currentGoodsCount = goodsCount.get(order.goodsId) ?? 0;
    if (currentGoodsCount >= constraints.maxOrdersPerGoods) {
      errors.push(`商品总订单数超限: ${currentGoodsCount} >= ${constraints.maxOrdersPerGoods}`);
    }
    
    const valid = errors.length === 0;
    
    if (valid) {
      companyGoodsCount.set(companyGoodsKey, currentCompanyGoodsCount + 1);
      goodsCount.set(order.goodsId, currentGoodsCount + 1);
    }
    
    results.push({ valid, order, errors });
  }
  
  return results;
}

/**
 * 查找可匹配的订单对
 */
function findMatchableOrders(orderBook: OrderBookData): MatchResult[] {
  const matches: MatchResult[] = [];
  
  // 快速检查
  if (orderBook.buyOrders.length === 0 || orderBook.sellOrders.length === 0) {
    return [];
  }
  
  if (orderBook.bestBid !== null && orderBook.bestAsk !== null) {
    if (orderBook.bestBid < orderBook.bestAsk) {
      return [];
    }
  }
  
  // 遍历买单
  for (const buyOrder of orderBook.buyOrders) {
    if (buyOrder.status !== 'open' && buyOrder.status !== 'partial') continue;
    if (buyOrder.remainingQuantity <= 0) continue;
    
    // 遍历卖单
    for (const sellOrder of orderBook.sellOrders) {
      // 价格不匹配时提前终止
      if (sellOrder.pricePerUnit > buyOrder.pricePerUnit) break;
      
      if (sellOrder.status !== 'open' && sellOrder.status !== 'partial') continue;
      if (sellOrder.remainingQuantity <= 0) continue;
      if (sellOrder.companyId === buyOrder.companyId) continue;
      
      // 计算可成交数量
      const quantity = Math.min(buyOrder.remainingQuantity, sellOrder.remainingQuantity);
      
      matches.push({
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        quantity,
        price: sellOrder.pricePerUnit, // 使用卖价成交
        goodsId: orderBook.goodsId,
      });
    }
  }
  
  return matches;
}

/**
 * 批量处理多个商品的订单匹配
 */
function batchFindMatches(orderBooks: OrderBookData[]): {
  goodsId: string;
  matches: MatchResult[];
}[] {
  const results: { goodsId: string; matches: MatchResult[] }[] = [];
  
  for (const orderBook of orderBooks) {
    const matches = findMatchableOrders(orderBook);
    if (matches.length > 0) {
      results.push({
        goodsId: orderBook.goodsId,
        matches,
      });
    }
  }
  
  return results;
}

/**
 * 分析订单簿深度
 */
function analyzeOrderBookDepth(
  orderBook: OrderBookData,
  levels: number = 5
): {
  bids: Array<{ price: number; quantity: number; orderCount: number }>;
  asks: Array<{ price: number; quantity: number; orderCount: number }>;
  spread: number | null;
  totalBuyVolume: number;
  totalSellVolume: number;
} {
  // 聚合买单
  const bidMap = new Map<number, { quantity: number; orderCount: number }>();
  let totalBuyVolume = 0;
  
  for (const order of orderBook.buyOrders) {
    if (order.status !== 'open' && order.status !== 'partial') continue;
    totalBuyVolume += order.remainingQuantity;
    
    const existing = bidMap.get(order.pricePerUnit);
    if (existing) {
      existing.quantity += order.remainingQuantity;
      existing.orderCount++;
    } else {
      bidMap.set(order.pricePerUnit, {
        quantity: order.remainingQuantity,
        orderCount: 1,
      });
    }
  }
  
  // 聚合卖单
  const askMap = new Map<number, { quantity: number; orderCount: number }>();
  let totalSellVolume = 0;
  
  for (const order of orderBook.sellOrders) {
    if (order.status !== 'open' && order.status !== 'partial') continue;
    totalSellVolume += order.remainingQuantity;
    
    const existing = askMap.get(order.pricePerUnit);
    if (existing) {
      existing.quantity += order.remainingQuantity;
      existing.orderCount++;
    } else {
      askMap.set(order.pricePerUnit, {
        quantity: order.remainingQuantity,
        orderCount: 1,
      });
    }
  }
  
  // 转换为数组
  const bids = Array.from(bidMap.entries())
    .map(([price, data]) => ({ price, ...data }))
    .sort((a, b) => b.price - a.price)
    .slice(0, levels);
  
  const asks = Array.from(askMap.entries())
    .map(([price, data]) => ({ price, ...data }))
    .sort((a, b) => a.price - b.price)
    .slice(0, levels);
  
  // 计算价差
  let spread: number | null = null;
  if (orderBook.bestBid !== null && orderBook.bestAsk !== null) {
    spread = orderBook.bestAsk - orderBook.bestBid;
  }
  
  return {
    bids,
    asks,
    spread,
    totalBuyVolume,
    totalSellVolume,
  };
}

/**
 * 对订单进行排序（用于批量插入后的重排）
 */
function sortOrders(
  orders: OrderData[],
  type: 'buy' | 'sell'
): OrderData[] {
  if (type === 'buy') {
    // 买单按价格降序
    return [...orders].sort((a, b) => b.pricePerUnit - a.pricePerUnit);
  } else {
    // 卖单按价格升序
    return [...orders].sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  }
}

// ===== 消息处理 =====

parentPort?.on('message', (message: WorkerMessage) => {
  const { taskId, type, data } = message;
  
  try {
    let result: unknown;
    
    switch (type) {
      case 'VALIDATE_ORDERS': {
        const { orders, constraints } = data as {
          orders: Array<{
            companyId: string;
            goodsId: string;
            type: 'buy' | 'sell';
            quantity: number;
            price: number;
          }>;
          constraints: {
            maxOrdersPerCompanyGoods: number;
            maxOrdersPerGoods: number;
            minPrice: number;
            maxPrice: number;
            minQuantity: number;
            maxQuantity: number;
          };
        };
        result = validateOrders(orders, constraints);
        break;
      }
      
      case 'FIND_MATCHES': {
        const orderBook = data as OrderBookData;
        result = findMatchableOrders(orderBook);
        break;
      }
      
      case 'BATCH_FIND_MATCHES': {
        const orderBooks = data as OrderBookData[];
        result = batchFindMatches(orderBooks);
        break;
      }
      
      case 'ANALYZE_DEPTH': {
        const { orderBook, levels } = data as {
          orderBook: OrderBookData;
          levels?: number;
        };
        result = analyzeOrderBookDepth(orderBook, levels);
        break;
      }
      
      case 'SORT_ORDERS': {
        const { orders, orderType } = data as {
          orders: OrderData[];
          orderType: 'buy' | 'sell';
        };
        result = sortOrders(orders, orderType);
        break;
      }
      
      case 'BINARY_SEARCH_INSERT': {
        const { orders, price, orderType } = data as {
          orders: OrderData[];
          price: number;
          orderType: 'buy' | 'sell';
        };
        result = orderType === 'buy'
          ? binarySearchBuyInsert(orders, price)
          : binarySearchSellInsert(orders, price);
        break;
      }
      
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
    
    const response: WorkerResponse = { taskId, result };
    parentPort?.postMessage(response);
    
  } catch (error) {
    const response: WorkerResponse = {
      taskId,
      error: error instanceof Error ? error.message : String(error),
    };
    parentPort?.postMessage(response);
  }
});

console.log(`[OrderWorker ${workerId}] Ready`);