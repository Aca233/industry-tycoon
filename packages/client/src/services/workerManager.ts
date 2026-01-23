/**
 * Worker Manager - Web Worker管理器
 * 
 * 提供简单的API来调用Web Worker进行计算
 * 自动处理Worker的创建、消息传递和结果回调
 */

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
};

/**
 * Worker管理器类
 */
class WorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter = 0;
  private isSupported = typeof Worker !== 'undefined';

  /**
   * 初始化Worker
   */
  private initWorker(): Worker | null {
    if (!this.isSupported) {
      console.warn('[WorkerManager] Web Workers not supported');
      return null;
    }

    if (this.worker) {
      return this.worker;
    }

    try {
      // 使用Vite的Worker导入语法
      this.worker = new Worker(
        new URL('../workers/computeWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event) => {
        const { id, result, error } = event.data;
        const pending = this.pendingRequests.get(id);
        
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(id);
          
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(result);
          }
        }
      };

      this.worker.onerror = (error) => {
        console.error('[WorkerManager] Worker error:', error);
        // 拒绝所有pending请求
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Worker error'));
          this.pendingRequests.delete(id);
        }
      };

      console.log('[WorkerManager] Worker initialized');
      return this.worker;
    } catch (error) {
      console.error('[WorkerManager] Failed to create worker:', error);
      return null;
    }
  }

  /**
   * 发送消息到Worker
   */
  private sendMessage<T>(type: string, payload: unknown, timeout = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.initWorker();
      
      if (!worker) {
        // 如果Worker不可用，在主线程执行（回退机制）
        reject(new Error('Worker not available'));
        return;
      }

      const id = `${type}_${this.requestCounter++}`;
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Worker request timeout'));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutId,
      });

      worker.postMessage({ type, id, payload });
    });
  }

  // ===== 公共API =====

  /**
   * 计算价格统计
   */
  async calculatePriceStats(prices: Array<{ tick: number; price: number; volume?: number }>): Promise<{
    min: number;
    max: number;
    avg: number;
    stdDev: number;
    change: number;
    changePercent: number;
    volatility: number;
  }> {
    try {
      return await this.sendMessage('CALCULATE_PRICE_STATS', prices);
    } catch {
      // 回退到主线程计算
      return this.calculatePriceStatsFallback(prices);
    }
  }

  /**
   * 采样价格数据
   */
  async samplePriceData(
    prices: Array<{ tick: number; price: number; volume?: number }>,
    targetPoints: number
  ): Promise<Array<{
    tick: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>> {
    try {
      return await this.sendMessage('SAMPLE_PRICE_DATA', { prices, targetPoints });
    } catch {
      // 回退到主线程计算
      return this.samplePriceDataFallback(prices, targetPoints);
    }
  }

  /**
   * 计算移动平均
   */
  async calculateMovingAverage(prices: number[], period: number): Promise<number[]> {
    try {
      return await this.sendMessage('CALCULATE_MOVING_AVERAGE', { prices, period });
    } catch {
      // 回退到主线程计算
      return this.calculateMovingAverageFallback(prices, period);
    }
  }

  /**
   * 排序和过滤数据
   */
  async sortAndFilter<T extends Record<string, unknown>>(
    data: T[],
    options: {
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filterConditions?: Record<string, unknown>;
    }
  ): Promise<T[]> {
    try {
      return await this.sendMessage('SORT_AND_FILTER', {
        data,
        options: {
          ...options,
          filterFn: options.filterConditions ? JSON.stringify(options.filterConditions) : undefined,
        },
      });
    } catch {
      // 回退到主线程
      return this.sortAndFilterFallback(data, options);
    }
  }

  // ===== 回退实现（主线程） =====

  private calculatePriceStatsFallback(prices: Array<{ tick: number; price: number }>): {
    min: number;
    max: number;
    avg: number;
    stdDev: number;
    change: number;
    changePercent: number;
    volatility: number;
  } {
    if (prices.length === 0) {
      return { min: 0, max: 0, avg: 0, stdDev: 0, change: 0, changePercent: 0, volatility: 0 };
    }
    const priceValues = prices.map(p => p.price);
    const min = Math.min(...priceValues);
    const max = Math.max(...priceValues);
    const avg = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
    const variance = priceValues.map(p => Math.pow(p - avg, 2)).reduce((a, b) => a + b, 0) / priceValues.length;
    const stdDev = Math.sqrt(variance);
    const change = prices[prices.length - 1]!.price - prices[0]!.price;
    const changePercent = prices[0]!.price > 0 ? (change / prices[0]!.price) * 100 : 0;
    return { min, max, avg, stdDev, change, changePercent, volatility: stdDev / avg * 100 };
  }

  private samplePriceDataFallback(
    prices: Array<{ tick: number; price: number; volume?: number }>,
    targetPoints: number
  ): Array<{ tick: number; open: number; high: number; low: number; close: number; volume: number }> {
    if (prices.length <= targetPoints) {
      return prices.map(p => ({
        tick: p.tick,
        open: p.price,
        high: p.price,
        low: p.price,
        close: p.price,
        volume: p.volume ?? 0,
      }));
    }
    const groupSize = Math.ceil(prices.length / targetPoints);
    const result: Array<{ tick: number; open: number; high: number; low: number; close: number; volume: number }> = [];
    for (let i = 0; i < prices.length; i += groupSize) {
      const group = prices.slice(i, Math.min(i + groupSize, prices.length));
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

  private calculateMovingAverageFallback(prices: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      const start = Math.max(0, i - period + 1);
      const slice = prices.slice(start, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
    return result;
  }

  private sortAndFilterFallback<T extends Record<string, unknown>>(
    data: T[],
    options: { sortBy?: string; sortOrder?: 'asc' | 'desc'; filterConditions?: Record<string, unknown> }
  ): T[] {
    let result = [...data];
    if (options.filterConditions) {
      result = result.filter(item => {
        for (const [key, value] of Object.entries(options.filterConditions!)) {
          if (item[key] !== value) return false;
        }
        return true;
      });
    }
    if (options.sortBy) {
      const order = options.sortOrder === 'desc' ? -1 : 1;
      result.sort((a, b) => {
        const aVal = a[options.sortBy!];
        const bVal = b[options.sortBy!];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * order;
        }
        return String(aVal).localeCompare(String(bVal)) * order;
      });
    }
    return result;
  }

  /**
   * 终止Worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      
      // 拒绝所有pending请求
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Worker terminated'));
        this.pendingRequests.delete(id);
      }
    }
  }
}

// 单例导出
export const workerManager = new WorkerManager();