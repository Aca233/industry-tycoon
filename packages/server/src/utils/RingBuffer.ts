/**
 * 环形缓冲区 - 高性能替代数组 push + slice 操作
 * 
 * 避免频繁的数组重分配，O(1) 的插入和固定内存占用
 * 用于价格历史等需要保留最近N条记录的场景
 */

/**
 * 泛型环形缓冲区
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;  // 下一个写入位置
  private _size: number = 0; // 当前有效元素数量
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('RingBuffer capacity must be positive');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * 添加元素（O(1)）
   */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) {
      this._size++;
    }
  }

  /**
   * 获取当前有效元素数量
   */
  get size(): number {
    return this._size;
  }

  /**
   * 获取缓冲区容量
   */
  get maxCapacity(): number {
    return this.capacity;
  }

  /**
   * 缓冲区是否已满
   */
  get isFull(): boolean {
    return this._size === this.capacity;
  }

  /**
   * 获取最后（最新）的元素
   */
  getLast(): T | undefined {
    if (this._size === 0) return undefined;
    const lastIndex = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[lastIndex];
  }

  /**
   * 获取第一个（最旧）的元素
   */
  getFirst(): T | undefined {
    if (this._size === 0) return undefined;
    if (this._size < this.capacity) {
      return this.buffer[0];
    }
    // 如果已满，head指向的就是最旧的元素
    return this.buffer[this.head];
  }

  /**
   * 按索引获取元素（0 = 最旧，size-1 = 最新）
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this._size) {
      return undefined;
    }
    
    let actualIndex: number;
    if (this._size < this.capacity) {
      // 未满时，从0开始
      actualIndex = index;
    } else {
      // 已满时，从head开始（head是最旧的位置）
      actualIndex = (this.head + index) % this.capacity;
    }
    
    return this.buffer[actualIndex];
  }

  /**
   * 转换为数组（按时间顺序，最旧到最新）
   * 注意：这会创建新数组，用于需要完整历史的场景
   */
  toArray(): T[] {
    if (this._size === 0) return [];
    
    const result: T[] = new Array(this._size);
    
    if (this._size < this.capacity) {
      // 未满时，直接复制
      for (let i = 0; i < this._size; i++) {
        result[i] = this.buffer[i]!;
      }
    } else {
      // 已满时，从head（最旧）开始复制
      for (let i = 0; i < this._size; i++) {
        const actualIndex = (this.head + i) % this.capacity;
        result[i] = this.buffer[actualIndex]!;
      }
    }
    
    return result;
  }

  /**
   * 获取最近N个元素（最新的在最后）
   */
  getLastN(n: number): T[] {
    if (n <= 0 || this._size === 0) return [];
    
    const count = Math.min(n, this._size);
    const result: T[] = new Array(count);
    
    // 从最新的往前取
    for (let i = 0; i < count; i++) {
      const offset = count - 1 - i;
      const actualIndex = (this.head - 1 - offset + this.capacity * 2) % this.capacity;
      result[i] = this.buffer[actualIndex]!;
    }
    
    return result;
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this._size = 0;
  }

  /**
   * 迭代器 - 支持 for...of 循环
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this._size; i++) {
      yield this.get(i)!;
    }
  }

  /**
   * forEach 遍历（按时间顺序）
   */
  forEach(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this._size; i++) {
      callback(this.get(i)!, i);
    }
  }

  /**
   * map 转换
   */
  map<U>(callback: (item: T, index: number) => U): U[] {
    const result: U[] = new Array(this._size);
    for (let i = 0; i < this._size; i++) {
      result[i] = callback(this.get(i)!, i);
    }
    return result;
  }

  /**
   * 查找最后一个满足条件的元素
   */
  findLast(predicate: (item: T) => boolean): T | undefined {
    for (let i = this._size - 1; i >= 0; i--) {
      const item = this.get(i)!;
      if (predicate(item)) {
        return item;
      }
    }
    return undefined;
  }

  /**
   * reduce 累积
   */
  reduce<U>(callback: (acc: U, item: T, index: number) => U, initialValue: U): U {
    let acc = initialValue;
    for (let i = 0; i < this._size; i++) {
      acc = callback(acc, this.get(i)!, i);
    }
    return acc;
  }
}

/**
 * 价格历史专用环形缓冲区
 * 带有额外的统计方法
 */
export interface PricePoint {
  tick: number;
  price: number;
  volume?: number;
  buyVolume?: number;
  sellVolume?: number;
  open?: number;
  high?: number;
  low?: number;
}

export class PriceHistoryBuffer extends RingBuffer<PricePoint> {
  // 1 tick = 1 day，默认保留365天（1年）的数据点
  constructor(capacity: number = 365) {
    super(capacity);
  }

  /**
   * 获取最新价格
   */
  getLastPrice(): number | undefined {
    return this.getLast()?.price;
  }

  /**
   * 获取最新tick
   */
  getLastTick(): number | undefined {
    return this.getLast()?.tick;
  }

  /**
   * 计算指定时间范围内的成交量
   */
  getVolumeInRange(fromTick: number, toTick: number): number {
    let total = 0;
    this.forEach((point) => {
      if (point.tick >= fromTick && point.tick <= toTick) {
        total += point.volume ?? 0;
      }
    });
    return total;
  }

  /**
   * 获取最近N个tick的价格数组（用于图表）
   */
  getPricesForChart(count: number): PricePoint[] {
    return this.getLastN(count);
  }

  /**
   * 计算简单移动平均
   */
  calculateSMA(period: number): number | undefined {
    if (this.size < period) return undefined;
    
    let sum = 0;
    const points = this.getLastN(period);
    for (const point of points) {
      sum += point.price;
    }
    return sum / period;
  }

  /**
   * 获取最高价（指定范围内）
   */
  getHighInLastN(n: number): number | undefined {
    const points = this.getLastN(n);
    if (points.length === 0) return undefined;
    
    const firstPoint = points[0];
    if (!firstPoint) return undefined;
    
    let high = firstPoint.price;
    for (const point of points) {
      if (point.price > high) high = point.price;
    }
    return high;
  }

  /**
   * 获取最低价（指定范围内）
   */
  getLowInLastN(n: number): number | undefined {
    const points = this.getLastN(n);
    if (points.length === 0) return undefined;
    
    const firstPoint = points[0];
    if (!firstPoint) return undefined;
    
    let low = firstPoint.price;
    for (const point of points) {
      if (point.price < low) low = point.price;
    }
    return low;
  }
}

export default RingBuffer;