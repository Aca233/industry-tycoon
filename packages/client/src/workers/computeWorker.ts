/**
 * Compute Worker - 计算密集型任务的Web Worker
 * 
 * 将以下计算任务从主线程分离：
 * 1. 价格历史统计计算
 * 2. 图表数据采样
 * 3. 大量数据的排序和过滤
 */

// Worker消息类型
interface WorkerMessage {
  type: string;
  id: string;
  payload: unknown;
}

interface WorkerResponse {
  type: string;
  id: string;
  result?: unknown;
  error?: string;
}

// ===== 价格统计计算 =====
interface PriceData {
  tick: number;
  price: number;
  volume?: number;
}

interface PriceStats {
  min: number;
  max: number;
  avg: number;
  stdDev: number;
  change: number;
  changePercent: number;
  volatility: number;
}

function calculatePriceStats(prices: PriceData[]): PriceStats {
  if (prices.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      stdDev: 0,
      change: 0,
      changePercent: 0,
      volatility: 0,
    };
  }

  const priceValues = prices.map(p => p.price);
  const min = Math.min(...priceValues);
  const max = Math.max(...priceValues);
  const avg = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
  
  // 计算标准差
  const squaredDiffs = priceValues.map(p => Math.pow(p - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / priceValues.length;
  const stdDev = Math.sqrt(variance);
  
  // 计算变化
  const firstPrice = prices[0]!.price;
  const lastPrice = prices[prices.length - 1]!.price;
  const change = lastPrice - firstPrice;
  const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;
  
  // 计算波动率（使用价格变化的标准差）
  const returns: number[] = [];
  for (let i = 1; i < priceValues.length; i++) {
    const prevPrice = priceValues[i - 1]!;
    if (prevPrice > 0) {
      returns.push((priceValues[i]! - prevPrice) / prevPrice);
    }
  }
  const returnAvg = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const returnVariance = returns.length > 0 
    ? returns.map(r => Math.pow(r - returnAvg, 2)).reduce((a, b) => a + b, 0) / returns.length 
    : 0;
  const volatility = Math.sqrt(returnVariance) * 100;

  return {
    min,
    max,
    avg,
    stdDev,
    change,
    changePercent,
    volatility,
  };
}

// ===== 数据采样 =====
interface OHLCData {
  tick: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function samplePriceData(prices: PriceData[], targetPoints: number): OHLCData[] {
  if (prices.length <= targetPoints) {
    // 不需要采样，转换为OHLC格式
    return prices.map(p => ({
      tick: p.tick,
      open: p.price,
      high: p.price,
      low: p.price,
      close: p.price,
      volume: p.volume ?? 0,
    }));
  }

  // 每组包含多少个原始数据点
  const groupSize = Math.ceil(prices.length / targetPoints);
  const result: OHLCData[] = [];

  for (let i = 0; i < prices.length; i += groupSize) {
    const group = prices.slice(i, Math.min(i + groupSize, prices.length));
    if (group.length === 0) continue;

    const priceValues = group.map(p => p.price);
    result.push({
      tick: group[0]!.tick,
      open: group[0]!.price,
      high: Math.max(...priceValues),
      low: Math.min(...priceValues),
      close: group[group.length - 1]!.price,
      volume: group.reduce((sum, p) => sum + (p.volume ?? 0), 0),
    });
  }

  return result;
}

// ===== 排序和过滤 =====
interface SortFilterOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterFn?: string; // JSON序列化的过滤条件
}

function sortAndFilter<T extends Record<string, unknown>>(
  data: T[],
  options: SortFilterOptions
): T[] {
  let result = [...data];

  // 过滤
  if (options.filterFn) {
    try {
      const filterConditions = JSON.parse(options.filterFn) as Record<string, unknown>;
      result = result.filter(item => {
        for (const [key, value] of Object.entries(filterConditions)) {
          if (item[key] !== value) return false;
        }
        return true;
      });
    } catch {
      // 忽略无效的过滤条件
    }
  }

  // 排序
  if (options.sortBy) {
    const sortKey = options.sortBy;
    const order = options.sortOrder === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * order;
      }
      return String(aVal).localeCompare(String(bVal)) * order;
    });
  }

  return result;
}

// ===== 移动平均计算 =====
function calculateMovingAverage(prices: number[], period: number): number[] {
  if (prices.length < period) {
    return prices.map(() => prices.reduce((a, b) => a + b, 0) / prices.length);
  }

  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      // 前period-1个点使用可用数据的平均值
      const slice = prices.slice(0, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

// ===== 消息处理 =====
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, id, payload } = event.data;
  
  try {
    let result: unknown;

    switch (type) {
      case 'CALCULATE_PRICE_STATS':
        result = calculatePriceStats(payload as PriceData[]);
        break;

      case 'SAMPLE_PRICE_DATA': {
        const { prices, targetPoints } = payload as { prices: PriceData[]; targetPoints: number };
        result = samplePriceData(prices, targetPoints);
        break;
      }

      case 'SORT_AND_FILTER': {
        const { data, options } = payload as { data: Record<string, unknown>[]; options: SortFilterOptions };
        result = sortAndFilter(data, options);
        break;
      }

      case 'CALCULATE_MOVING_AVERAGE': {
        const { prices, period } = payload as { prices: number[]; period: number };
        result = calculateMovingAverage(prices, period);
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const response: WorkerResponse = { type, id, result };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      type,
      id,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};

// 导出空对象以满足模块系统
export {};