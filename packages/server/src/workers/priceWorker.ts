/**
 * Price Worker - 价格计算 Worker 线程
 * 
 * 在独立线程中执行计算密集型的价格计算任务：
 * 1. 价格发现算法
 * 2. 供需平衡计算
 * 3. 移动平均和技术指标
 */

import { parentPort, workerData } from 'worker_threads';

// Worker ID
const workerId = workerData?.workerId ?? 0;
console.log(`[PriceWorker ${workerId}] Starting...`);

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

// ===== 价格计算函数 =====

/**
 * 计算加权平均价格
 */
function calculateWeightedAveragePrice(
  prices: Array<{ price: number; weight: number }>
): number {
  if (prices.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const { price, weight } of prices) {
    weightedSum += price * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * 计算供需平衡价格
 */
function calculateEquilibriumPrice(
  basePrice: number,
  supply: number,
  demand: number,
  elasticity: number = 0.1
): number {
  if (supply <= 0 && demand <= 0) {
    return basePrice;
  }
  
  // 供需比率
  const ratio = supply > 0 ? demand / supply : (demand > 0 ? 2 : 1);
  
  // 价格调整
  // ratio > 1: 需求 > 供应，价格上涨
  // ratio < 1: 供应 > 需求，价格下跌
  const adjustment = Math.log(ratio) * elasticity;
  
  // 限制调整幅度
  const clampedAdjustment = Math.max(-0.5, Math.min(0.5, adjustment));
  
  return basePrice * (1 + clampedAdjustment);
}

/**
 * 计算移动平均
 */
function calculateMovingAverage(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  if (period <= 0) return prices;
  
  const result: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    const start = Math.max(0, i - period + 1);
    const slice = prices.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }
  
  return result;
}

/**
 * 计算指数移动平均
 */
function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  if (period <= 0) return prices;
  
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  
  // 第一个值使用简单平均
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      // 前 period-1 个点使用简单平均
      const slice = prices.slice(0, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    } else {
      ema = (prices[i]! - ema) * multiplier + ema;
      result.push(ema);
    }
  }
  
  return result;
}

/**
 * 计算波动率
 */
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  // 计算收益率
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!;
    if (prev > 0) {
      returns.push((prices[i]! - prev) / prev);
    }
  }
  
  if (returns.length === 0) return 0;
  
  // 计算标准差
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.map(r => Math.pow(r - mean, 2)).reduce((a, b) => a + b, 0) / returns.length;
  
  return Math.sqrt(variance);
}

/**
 * 批量计算多个商品的价格
 */
function batchCalculatePrices(
  goods: Array<{
    goodsId: string;
    basePrice: number;
    supply: number;
    demand: number;
    lastTradePrice?: number;
  }>,
  options: {
    elasticity?: number;
    useLastTradePrice?: boolean;
  } = {}
): Record<string, number> {
  const { elasticity = 0.1, useLastTradePrice = true } = options;
  const result: Record<string, number> = {};
  
  for (const item of goods) {
    // 计算均衡价格
    let price = calculateEquilibriumPrice(
      item.basePrice,
      item.supply,
      item.demand,
      elasticity
    );
    
    // 如果有最后交易价格，进行平滑
    if (useLastTradePrice && item.lastTradePrice && item.lastTradePrice > 0) {
      // 80% 均衡价格 + 20% 最后交易价格
      price = price * 0.8 + item.lastTradePrice * 0.2;
    }
    
    // 确保价格不为负
    result[item.goodsId] = Math.max(1, Math.round(price));
  }
  
  return result;
}

/**
 * 计算价格统计
 */
function calculatePriceStats(prices: number[]): {
  min: number;
  max: number;
  avg: number;
  stdDev: number;
  volatility: number;
} {
  if (prices.length === 0) {
    return { min: 0, max: 0, avg: 0, stdDev: 0, volatility: 0 };
  }
  
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  const variance = prices.map(p => Math.pow(p - avg, 2)).reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  
  const volatility = calculateVolatility(prices);
  
  return { min, max, avg, stdDev, volatility };
}

// ===== 消息处理 =====

parentPort?.on('message', (message: WorkerMessage) => {
  const { taskId, type, data } = message;
  
  try {
    let result: unknown;
    
    switch (type) {
      case 'WEIGHTED_AVERAGE':
        result = calculateWeightedAveragePrice(data as Array<{ price: number; weight: number }>);
        break;
        
      case 'EQUILIBRIUM_PRICE': {
        const { basePrice, supply, demand, elasticity } = data as {
          basePrice: number;
          supply: number;
          demand: number;
          elasticity?: number;
        };
        result = calculateEquilibriumPrice(basePrice, supply, demand, elasticity);
        break;
      }
      
      case 'MOVING_AVERAGE': {
        const { prices, period } = data as { prices: number[]; period: number };
        result = calculateMovingAverage(prices, period);
        break;
      }
      
      case 'EMA': {
        const { prices, period } = data as { prices: number[]; period: number };
        result = calculateEMA(prices, period);
        break;
      }
      
      case 'VOLATILITY':
        result = calculateVolatility(data as number[]);
        break;
        
      case 'BATCH_CALCULATE': {
        const { goods, options } = data as {
          goods: Array<{
            goodsId: string;
            basePrice: number;
            supply: number;
            demand: number;
            lastTradePrice?: number;
          }>;
          options?: { elasticity?: number; useLastTradePrice?: boolean };
        };
        result = batchCalculatePrices(goods, options);
        break;
      }
      
      case 'PRICE_STATS':
        result = calculatePriceStats(data as number[]);
        break;
        
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

console.log(`[PriceWorker ${workerId}] Ready`);