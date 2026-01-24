/**
 * SharedPriceBuffer - 共享价格数据缓冲区
 * 
 * 使用 SharedArrayBuffer 在主线程和 Worker 线程之间共享价格数据
 * 避免每次通信都需要序列化/反序列化
 * 
 * 内存布局 (每个商品 16 字节):
 * - bytes 0-7: 当前价格 (Float64)
 * - bytes 8-15: 供需比率 (Float64)
 * 
 * 总大小: 商品数量 × 16 字节
 * 例如 51 个商品 = 816 字节
 */

import { GOODS_DATA } from '@scc/shared';

// 每个商品占用的字节数
const BYTES_PER_GOODS = 16;

// 商品ID到索引的映射
const GOODS_INDEX_MAP = new Map<string, number>();
const INDEX_TO_GOODS_MAP = new Map<number, string>();

// 初始化映射
GOODS_DATA.forEach((goods, index) => {
  GOODS_INDEX_MAP.set(goods.id, index);
  INDEX_TO_GOODS_MAP.set(index, goods.id);
});

/**
 * 共享价格缓冲区管理器
 */
export class SharedPriceBufferManager {
  private buffer: SharedArrayBuffer | null = null;
  private priceView: Float64Array | null = null;
  private ratioView: Float64Array | null = null;
  
  private readonly goodsCount: number;
  private readonly bufferSize: number;
  
  private initialized = false;
  
  constructor() {
    this.goodsCount = GOODS_DATA.length;
    this.bufferSize = this.goodsCount * BYTES_PER_GOODS;
  }
  
  /**
   * 初始化共享缓冲区
   * 注意: SharedArrayBuffer 在某些环境需要特殊的 HTTP 头
   */
  initialize(): boolean {
    try {
      // 检查 SharedArrayBuffer 是否可用
      if (typeof SharedArrayBuffer === 'undefined') {
        console.warn('[SharedPriceBuffer] SharedArrayBuffer not available in this environment');
        return false;
      }
      
      // 创建共享缓冲区
      this.buffer = new SharedArrayBuffer(this.bufferSize);
      
      // 创建视图
      // 价格: 从偏移量 0 开始，每个价格占 8 字节
      this.priceView = new Float64Array(this.buffer, 0, this.goodsCount);
      
      // 供需比率: 从偏移量 goodsCount * 8 开始
      // 注意: 我们的布局是交错的，所以需要重新设计
      // 实际上我们用 2 个 Float64Array，每个商品有 2 个 Float64 值
      
      // 简化: 直接用两个连续的区域
      // [价格数组][比率数组]
      const halfBuffer = new SharedArrayBuffer(this.goodsCount * 8 * 2);
      this.buffer = halfBuffer;
      this.priceView = new Float64Array(halfBuffer, 0, this.goodsCount);
      this.ratioView = new Float64Array(halfBuffer, this.goodsCount * 8, this.goodsCount);
      
      // 初始化为基础价格
      for (let i = 0; i < GOODS_DATA.length; i++) {
        this.priceView[i] = GOODS_DATA[i]?.basePrice ?? 1000;
        this.ratioView[i] = 1.0; // 初始供需平衡
      }
      
      this.initialized = true;
      console.log(`[SharedPriceBuffer] Initialized with ${this.goodsCount} goods (${this.bufferSize} bytes)`);
      
      return true;
    } catch (error) {
      console.error('[SharedPriceBuffer] Failed to initialize:', error);
      return false;
    }
  }
  
  /**
   * 获取共享缓冲区（用于传递给 Worker）
   */
  getBuffer(): SharedArrayBuffer | null {
    return this.buffer;
  }
  
  /**
   * 获取商品价格
   */
  getPrice(goodsId: string): number | null {
    if (!this.initialized || !this.priceView) return null;
    
    const index = GOODS_INDEX_MAP.get(goodsId);
    if (index === undefined) return null;
    
    return this.priceView[index] ?? null;
  }
  
  /**
   * 设置商品价格
   */
  setPrice(goodsId: string, price: number): boolean {
    if (!this.initialized || !this.priceView) return false;
    
    const index = GOODS_INDEX_MAP.get(goodsId);
    if (index === undefined) return false;
    
    this.priceView[index] = price;
    return true;
  }
  
  /**
   * 获取供需比率
   */
  getSupplyDemandRatio(goodsId: string): number | null {
    if (!this.initialized || !this.ratioView) return null;
    
    const index = GOODS_INDEX_MAP.get(goodsId);
    if (index === undefined) return null;
    
    return this.ratioView[index] ?? null;
  }
  
  /**
   * 设置供需比率
   */
  setSupplyDemandRatio(goodsId: string, ratio: number): boolean {
    if (!this.initialized || !this.ratioView) return false;
    
    const index = GOODS_INDEX_MAP.get(goodsId);
    if (index === undefined) return false;
    
    this.ratioView[index] = ratio;
    return true;
  }
  
  /**
   * 批量更新价格
   */
  batchUpdatePrices(prices: Map<string, number>): number {
    if (!this.initialized || !this.priceView) return 0;
    
    let count = 0;
    for (const [goodsId, price] of prices) {
      if (this.setPrice(goodsId, price)) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * 批量更新供需比率
   */
  batchUpdateRatios(ratios: Map<string, number>): number {
    if (!this.initialized || !this.ratioView) return 0;
    
    let count = 0;
    for (const [goodsId, ratio] of ratios) {
      if (this.setSupplyDemandRatio(goodsId, ratio)) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * 获取所有价格（返回普通对象）
   */
  getAllPrices(): Record<string, number> {
    const result: Record<string, number> = {};
    
    if (!this.initialized || !this.priceView) return result;
    
    for (let i = 0; i < this.goodsCount; i++) {
      const goodsId = INDEX_TO_GOODS_MAP.get(i);
      if (goodsId) {
        result[goodsId] = this.priceView[i] ?? 0;
      }
    }
    
    return result;
  }
  
  /**
   * 获取所有供需比率
   */
  getAllRatios(): Record<string, number> {
    const result: Record<string, number> = {};
    
    if (!this.initialized || !this.ratioView) return result;
    
    for (let i = 0; i < this.goodsCount; i++) {
      const goodsId = INDEX_TO_GOODS_MAP.get(i);
      if (goodsId) {
        result[goodsId] = this.ratioView[i] ?? 1;
      }
    }
    
    return result;
  }
  
  /**
   * 获取用于传递给 Worker 的数据包
   */
  getWorkerData(): {
    buffer: SharedArrayBuffer;
    goodsCount: number;
    indexMap: Array<[string, number]>;
  } | null {
    if (!this.buffer) return null;
    
    return {
      buffer: this.buffer,
      goodsCount: this.goodsCount,
      indexMap: Array.from(GOODS_INDEX_MAP.entries()),
    };
  }
  
  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    initialized: boolean;
    goodsCount: number;
    bufferSize: number;
    avgPrice: number;
    avgRatio: number;
  } {
    let avgPrice = 0;
    let avgRatio = 0;
    
    if (this.initialized && this.priceView && this.ratioView) {
      let priceSum = 0;
      let ratioSum = 0;
      
      for (let i = 0; i < this.goodsCount; i++) {
        priceSum += this.priceView[i] ?? 0;
        ratioSum += this.ratioView[i] ?? 0;
      }
      
      avgPrice = priceSum / this.goodsCount;
      avgRatio = ratioSum / this.goodsCount;
    }
    
    return {
      initialized: this.initialized,
      goodsCount: this.goodsCount,
      bufferSize: this.bufferSize,
      avgPrice,
      avgRatio,
    };
  }
}

// 单例导出
export const sharedPriceBuffer = new SharedPriceBufferManager();