/**
 * Historical Data Manager - 历史数据分层存储管理器
 * 
 * 优化策略：
 * 1. 短期数据（最近100 tick）：全精度存储
 * 2. 中期数据（100-1000 tick）：5tick聚合
 * 3. 长期数据（1000+ tick）：20tick聚合
 * 
 * 这大幅减少内存占用同时保持数据可用性
 */

/** OHLCV 数据结构 */
export interface OHLCVData {
  /** 开始tick */
  tick: number;
  /** 结束tick（聚合数据才有意义） */
  tickEnd?: number;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 收盘价 */
  close: number;
  /** 成交量 */
  volume: number;
  /** 买入成交量 */
  buyVolume: number;
  /** 卖出成交量 */
  sellVolume: number;
}

/** 分层配置 */
interface TierConfig {
  /** 该层的tick范围（相对于当前tick的距离） */
  maxAge: number;
  /** 聚合粒度（多少tick合并为一个数据点） */
  aggregationSize: number;
  /** 最大保留数据点数 */
  maxPoints: number;
}

/**
 * 历史数据分层存储管理器
 */
export class HistoricalDataManager {
  /** 每个商品的分层数据：goodsId -> { tier1: [], tier2: [], tier3: [] } */
  private dataStore: Map<string, {
    tier1: OHLCVData[];  // 短期：全精度
    tier2: OHLCVData[];  // 中期：5tick聚合
    tier3: OHLCVData[];  // 长期：20tick聚合
  }> = new Map();

  /** 分层配置 */
  private readonly tiers: TierConfig[] = [
    { maxAge: 100, aggregationSize: 1, maxPoints: 100 },     // 短期
    { maxAge: 1000, aggregationSize: 5, maxPoints: 180 },    // 中期
    { maxAge: Infinity, aggregationSize: 20, maxPoints: 500 }, // 长期
  ];

  /** 待聚合的缓冲区 */
  private aggregationBuffers: Map<string, {
    tier2Buffer: OHLCVData[];
    tier3Buffer: OHLCVData[];
  }> = new Map();

  /**
   * 添加新的价格数据点
   */
  addDataPoint(
    goodsId: string,
    tick: number,
    price: number,
    volume: number = 0,
    buyVolume: number = 0,
    sellVolume: number = 0
  ): void {
    // 确保数据存储存在
    if (!this.dataStore.has(goodsId)) {
      this.dataStore.set(goodsId, {
        tier1: [],
        tier2: [],
        tier3: [],
      });
      this.aggregationBuffers.set(goodsId, {
        tier2Buffer: [],
        tier3Buffer: [],
      });
    }

    const store = this.dataStore.get(goodsId)!;
    const buffers = this.aggregationBuffers.get(goodsId)!;

    // 创建新数据点
    const dataPoint: OHLCVData = {
      tick,
      open: price,
      high: price,
      low: price,
      close: price,
      volume,
      buyVolume,
      sellVolume,
    };

    // 添加到短期存储
    store.tier1.push(dataPoint);

    // 添加到聚合缓冲区
    buffers.tier2Buffer.push(dataPoint);
    buffers.tier3Buffer.push(dataPoint);

    // 检查是否需要聚合
    if (buffers.tier2Buffer.length >= this.tiers[1]!.aggregationSize) {
      const aggregated = this.aggregateDataPoints(buffers.tier2Buffer);
      store.tier2.push(aggregated);
      buffers.tier2Buffer = [];
      
      // 限制中期数据量
      if (store.tier2.length > this.tiers[1]!.maxPoints) {
        store.tier2.shift();
      }
    }

    if (buffers.tier3Buffer.length >= this.tiers[2]!.aggregationSize) {
      const aggregated = this.aggregateDataPoints(buffers.tier3Buffer);
      store.tier3.push(aggregated);
      buffers.tier3Buffer = [];
      
      // 限制长期数据量
      if (store.tier3.length > this.tiers[2]!.maxPoints) {
        store.tier3.shift();
      }
    }

    // 清理过期的短期数据
    const tier1MaxAge = this.tiers[0]!.maxAge;
    while (store.tier1.length > 0 && tick - store.tier1[0]!.tick > tier1MaxAge) {
      store.tier1.shift();
    }
  }

  /**
   * 聚合多个数据点为一个OHLCV
   */
  private aggregateDataPoints(points: OHLCVData[]): OHLCVData {
    if (points.length === 0) {
      throw new Error('Cannot aggregate empty data points');
    }

    const first = points[0]!;
    const last = points[points.length - 1]!;

    return {
      tick: first.tick,
      tickEnd: last.tick,
      open: first.open,
      high: Math.max(...points.map(p => p.high)),
      low: Math.min(...points.map(p => p.low)),
      close: last.close,
      volume: points.reduce((sum, p) => sum + p.volume, 0),
      buyVolume: points.reduce((sum, p) => sum + p.buyVolume, 0),
      sellVolume: points.reduce((sum, p) => sum + p.sellVolume, 0),
    };
  }

  /**
   * 获取指定时间范围的历史数据
   * 自动选择合适的精度层
   */
  getHistoricalData(
    goodsId: string,
    _currentTick: number,
    requestedPoints: number = 100
  ): OHLCVData[] {
    const store = this.dataStore.get(goodsId);
    if (!store) {
      return [];
    }

    const result: OHLCVData[] = [];
    let remainingPoints = requestedPoints;

    // 优先使用短期高精度数据
    const tier1Points = store.tier1.slice(-remainingPoints);
    result.push(...tier1Points);
    remainingPoints -= tier1Points.length;

    // 如果需要更多数据，使用中期数据
    if (remainingPoints > 0) {
      const tier2Points = store.tier2.slice(-remainingPoints);
      result.unshift(...tier2Points);
      remainingPoints -= tier2Points.length;
    }

    // 如果还需要更多，使用长期数据
    if (remainingPoints > 0) {
      const tier3Points = store.tier3.slice(-remainingPoints);
      result.unshift(...tier3Points);
    }

    return result;
  }

  /**
   * 获取K线数据（适用于图表显示）
   * @param granularity 期望的K线粒度（tick数）
   */
  getCandlestickData(
    goodsId: string,
    granularity: number,
    maxCandles: number = 100
  ): OHLCVData[] {
    const store = this.dataStore.get(goodsId);
    if (!store) {
      return [];
    }

    // 根据粒度选择数据源
    if (granularity <= 1) {
      return store.tier1.slice(-maxCandles);
    } else if (granularity <= 5) {
      return store.tier2.slice(-maxCandles);
    } else {
      return store.tier3.slice(-maxCandles);
    }
  }

  /**
   * 获取存储统计
   */
  getStorageStats(): {
    totalGoods: number;
    totalDataPoints: number;
    memoryEstimateKB: number;
    tierBreakdown: { tier1: number; tier2: number; tier3: number };
  } {
    let tier1Total = 0;
    let tier2Total = 0;
    let tier3Total = 0;

    for (const store of this.dataStore.values()) {
      tier1Total += store.tier1.length;
      tier2Total += store.tier2.length;
      tier3Total += store.tier3.length;
    }

    const totalPoints = tier1Total + tier2Total + tier3Total;
    // 粗略估算每个数据点约100字节
    const memoryEstimateKB = Math.round(totalPoints * 100 / 1024);

    return {
      totalGoods: this.dataStore.size,
      totalDataPoints: totalPoints,
      memoryEstimateKB,
      tierBreakdown: {
        tier1: tier1Total,
        tier2: tier2Total,
        tier3: tier3Total,
      },
    };
  }

  /**
   * 清除指定商品的历史数据
   */
  clearGoodsData(goodsId: string): void {
    this.dataStore.delete(goodsId);
    this.aggregationBuffers.delete(goodsId);
  }

  /**
   * 重置所有历史数据
   */
  reset(): void {
    this.dataStore.clear();
    this.aggregationBuffers.clear();
  }
}

// 单例导出
export const historicalDataManager = new HistoricalDataManager();