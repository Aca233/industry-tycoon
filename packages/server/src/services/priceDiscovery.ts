/**
 * 价格发现机制
 * 基于成交价和订单簿深度来确定市场价格
 */

import { EventEmitter } from 'events';
import { GOODS_DATA } from '@scc/shared';
import type { PriceHistoryPoint, MarketDepth } from '@scc/shared';
import { matchingEngine } from './matchingEngine.js';
import { marketOrderBook } from './marketOrderBook.js';

interface GoodsPriceState {
  /** 商品ID */
  goodsId: string;
  /** 当前市场价格 */
  currentPrice: number;
  /** 基准价格（初始价格） */
  basePrice: number;
  /** 最近成交价 */
  lastTradePrice: number | null;
  /** 最高买价 (Bid) */
  bestBid: number | null;
  /** 最低卖价 (Ask) */
  bestAsk: number | null;
  /** 价格历史 */
  priceHistory: PriceHistoryPoint[];
  /** 上一次更新的tick */
  lastUpdateTick: number;
}

/**
 * 价格发现服务 - 单例
 *
 * 性能优化：
 * - 延迟清理价格历史，减少 slice 操作频率
 * - 使用清理阈值避免每次添加都触发清理
 */
export class PriceDiscoveryService extends EventEmitter {
  /** 商品价格状态 */
  private priceStates: Map<string, GoodsPriceState> = new Map();
  /** 历史记录保留点数 */
  private readonly MAX_HISTORY_POINTS = 1000;
  /** 历史记录清理阈值（超过此值才触发清理） */
  private readonly CLEANUP_THRESHOLD = 1200;
  /** 最大价格波动比例（每tick） - 降低到2%防止价格暴涨 */
  private readonly MAX_PRICE_CHANGE = 0.02; // 2% per tick (was 10%)
  /** 价格最高为基准价的5倍 */
  private readonly MAX_PRICE_MULTIPLIER = 5.0;
  /** 价格最低为基准价的20% */
  private readonly MIN_PRICE_MULTIPLIER = 0.2;
  
  constructor() {
    super();
    this.initializePrices();
  }
  
  /**
   * 初始化所有商品价格
   */
  private initializePrices(): void {
    for (const goods of GOODS_DATA) {
      const basePrice = goods.basePrice;
      this.priceStates.set(goods.id, {
        goodsId: goods.id,
        currentPrice: basePrice,
        basePrice,
        lastTradePrice: null,
        bestBid: null,
        bestAsk: null,
        priceHistory: [],
        lastUpdateTick: 0,
      });
    }
    console.log(`[PriceDiscovery] Initialized ${this.priceStates.size} goods prices`);
  }
  
  /**
   * 更新单个商品的价格
   */
  updatePrice(goodsId: string, currentTick: number): void {
    const state = this.priceStates.get(goodsId);
    if (!state) return;
    
    // 获取最新成交价
    const lastTradePrice = matchingEngine.getLastTradePrice(goodsId);
    state.lastTradePrice = lastTradePrice;
    
    // 获取订单簿深度信息
    const depth = marketOrderBook.getMarketDepth(goodsId);
    state.bestBid = depth.bestBid;
    state.bestAsk = depth.bestAsk;
    
    // 计算新价格
    const newPrice = this.calculatePrice(state, depth);
    
    // 应用价格变化限制
    const maxChange = state.currentPrice * this.MAX_PRICE_CHANGE;
    const priceDiff = newPrice - state.currentPrice;
    const clampedDiff = Math.max(-maxChange, Math.min(maxChange, priceDiff));
    
    // 计算新价格，并应用基于 basePrice 的上下限
    const minPrice = state.basePrice * this.MIN_PRICE_MULTIPLIER;
    const maxPrice = state.basePrice * this.MAX_PRICE_MULTIPLIER;
    const finalPrice = Math.max(minPrice, Math.min(maxPrice, state.currentPrice + clampedDiff));
    
    // 只有价格变化时才记录
    if (Math.abs(finalPrice - state.currentPrice) > 0.001) {
      state.currentPrice = finalPrice;
      
      // 记录价格历史
      this.recordPricePoint(state, currentTick, depth);
      
      this.emit('priceUpdated', {
        goodsId,
        price: finalPrice,
        tick: currentTick,
      });
    }
    
    state.lastUpdateTick = currentTick;
  }
  
  /**
   * 计算价格
   * 使用多种信号加权平均
   */
  private calculatePrice(state: GoodsPriceState, depth: MarketDepth): number {
    const signals: { price: number; weight: number }[] = [];
    
    // 信号1: 最近成交价（权重最高）
    if (state.lastTradePrice !== null) {
      signals.push({ price: state.lastTradePrice, weight: 0.5 });
    }
    
    // 信号2: 买卖价中间价
    if (state.bestBid !== null && state.bestAsk !== null) {
      const midPrice = (state.bestBid + state.bestAsk) / 2;
      signals.push({ price: midPrice, weight: 0.3 });
    } else if (state.bestBid !== null) {
      // 只有买单，价格略高于最高买价
      signals.push({ price: state.bestBid * 1.05, weight: 0.2 });
    } else if (state.bestAsk !== null) {
      // 只有卖单，价格略低于最低卖价
      signals.push({ price: state.bestAsk * 0.95, weight: 0.2 });
    }
    
    // 信号3: 供需压力
    const supplyPressure = this.calculateSupplyPressure(depth);
    const pressureAdjustedPrice = state.currentPrice * (1 + supplyPressure * 0.05);
    signals.push({ price: pressureAdjustedPrice, weight: 0.1 });
    
    // 信号4: 当前价格惯性
    signals.push({ price: state.currentPrice, weight: 0.1 });
    
    // 信号5: 基准价格回归（当价格偏离过大时增加权重）
    // 这可以防止价格无限偏离基准价
    const deviation = Math.abs(state.currentPrice - state.basePrice) / state.basePrice;
    const regressionWeight = Math.min(0.3, deviation * 0.1); // 偏离越大，回归权重越高
    signals.push({ price: state.basePrice, weight: 0.05 + regressionWeight });
    
    // 加权平均
    if (signals.length === 0) {
      return state.currentPrice;
    }
    
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const weightedSum = signals.reduce((sum, s) => sum + s.price * s.weight, 0);
    
    return weightedSum / totalWeight;
  }
  
  /**
   * 计算供需压力
   * 返回 -1 到 1 之间的值，正值表示需求大于供给（价格应上涨）
   */
  private calculateSupplyPressure(depth: MarketDepth): number {
    if (depth.totalBuyVolume === 0 && depth.totalSellVolume === 0) {
      return 0;
    }
    
    // 使用买卖量差异计算压力
    const totalVolume = depth.totalBuyVolume + depth.totalSellVolume;
    if (totalVolume === 0) return 0;
    
    const pressure = (depth.totalBuyVolume - depth.totalSellVolume) / totalVolume;
    return Math.max(-1, Math.min(1, pressure));
  }
  
  /**
   * 记录价格历史点
   *
   * 性能优化：延迟清理，只有超过阈值才执行 slice
   */
  private recordPricePoint(state: GoodsPriceState, tick: number, depth: MarketDepth): void {
    // 获取成交量（现在使用缓存，O(1)）
    const volume = matchingEngine.getVolume(state.goodsId, tick - 1, tick);
    
    const point: PriceHistoryPoint = {
      tick,
      price: state.currentPrice,
      volume,
      buyVolume: depth.totalBuyVolume,
      sellVolume: depth.totalSellVolume,
    };
    
    state.priceHistory.push(point);
    
    // 延迟清理：只有超过阈值才触发，减少 slice 频率
    if (state.priceHistory.length > this.CLEANUP_THRESHOLD) {
      state.priceHistory = state.priceHistory.slice(-this.MAX_HISTORY_POINTS);
    }
  }
  
  /**
   * 更新所有商品价格
   */
  updateAllPrices(currentTick: number): void {
    for (const goodsId of this.priceStates.keys()) {
      this.updatePrice(goodsId, currentTick);
    }
  }
  
  /**
   * 获取商品当前价格
   */
  getPrice(goodsId: string): number {
    const state = this.priceStates.get(goodsId);
    if (!state) {
      const goods = GOODS_DATA.find(g => g.id === goodsId);
      return goods?.basePrice ?? 10;
    }
    return state.currentPrice;
  }
  
  /**
   * 获取所有商品价格
   */
  getAllPrices(): Map<string, number> {
    const prices = new Map<string, number>();
    for (const [goodsId, state] of this.priceStates) {
      prices.set(goodsId, state.currentPrice);
    }
    return prices;
  }
  
  /**
   * 获取商品价格状态
   */
  getPriceState(goodsId: string): GoodsPriceState | null {
    return this.priceStates.get(goodsId) ?? null;
  }
  
  /**
   * 获取价格历史
   */
  getPriceHistory(goodsId: string, limit?: number): PriceHistoryPoint[] {
    const state = this.priceStates.get(goodsId);
    if (!state) return [];
    
    if (limit) {
      return state.priceHistory.slice(-limit);
    }
    return [...state.priceHistory];
  }
  
  /**
   * 获取价格变化率
   */
  getPriceChange(goodsId: string, ticks: number = 10): number {
    const state = this.priceStates.get(goodsId);
    if (!state || state.priceHistory.length < 2) return 0;
    
    const history = state.priceHistory;
    const currentPrice = state.currentPrice;
    
    // 找到ticks之前的价格
    const targetIndex = Math.max(0, history.length - ticks);
    const pastPrice = history[targetIndex]?.price ?? currentPrice;
    
    if (pastPrice === 0) return 0;
    return (currentPrice - pastPrice) / pastPrice;
  }
  
  /**
   * 获取价格波动率（标准差）
   */
  getVolatility(goodsId: string, ticks: number = 20): number {
    const state = this.priceStates.get(goodsId);
    if (!state || state.priceHistory.length < 2) return 0;
    
    const prices = state.priceHistory.slice(-ticks).map(p => p.price);
    if (prices.length < 2) return 0;
    
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    
    return Math.sqrt(variance) / mean; // 返回相对波动率
  }
  
  /**
   * 获取市场概况
   */
  getMarketOverview(): Array<{
    goodsId: string;
    name: string;
    currentPrice: number;
    basePrice: number;
    priceChange: number;
    volatility: number;
    bestBid: number | null;
    bestAsk: number | null;
    spread: number | null;
  }> {
    const overview = [];
    
    for (const [goodsId, state] of this.priceStates) {
      const goods = GOODS_DATA.find(g => g.id === goodsId);
      const priceChange = this.getPriceChange(goodsId, 10);
      const volatility = this.getVolatility(goodsId, 20);
      
      let spread: number | null = null;
      if (state.bestBid !== null && state.bestAsk !== null) {
        spread = (state.bestAsk - state.bestBid) / state.currentPrice;
      }
      
      overview.push({
        goodsId,
        name: goods?.name ?? goodsId,
        currentPrice: state.currentPrice,
        basePrice: state.basePrice,
        priceChange,
        volatility,
        bestBid: state.bestBid,
        bestAsk: state.bestAsk,
        spread,
      });
    }
    
    return overview;
  }
  
  /**
   * 重置价格发现服务
   */
  reset(): void {
    this.priceStates.clear();
    this.initializePrices();
    console.log('[PriceDiscovery] Reset');
  }
  
  /**
   * 强制设置价格（用于经济健康检查）
   */
  forceSetPrice(goodsId: string, price: number): void {
    const state = this.priceStates.get(goodsId);
    if (state) {
      const oldPrice = state.currentPrice;
      // 确保价格在合理范围内
      const minPrice = state.basePrice * this.MIN_PRICE_MULTIPLIER;
      const maxPrice = state.basePrice * this.MAX_PRICE_MULTIPLIER;
      state.currentPrice = Math.max(minPrice, Math.min(maxPrice, price));
      state.lastTradePrice = null; // 重置最近成交价避免污染
      console.log(`[PriceDiscovery] Force set ${goodsId} price: ${oldPrice.toFixed(2)} -> ${state.currentPrice.toFixed(2)}`);
    }
  }
  
  /**
   * 获取商品基准价格
   */
  getBasePrice(goodsId: string): number {
    const state = this.priceStates.get(goodsId);
    if (!state) {
      const goods = GOODS_DATA.find(g => g.id === goodsId);
      return goods?.basePrice ?? 10;
    }
    return state.basePrice;
  }
}

// 单例实例
export const priceDiscoveryService = new PriceDiscoveryService();