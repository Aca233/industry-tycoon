/**
 * Cache Manager - 通用缓存管理器
 * 
 * 功能：
 * 1. LRU缓存策略
 * 2. TTL过期机制
 * 3. 按类别分区
 * 4. 缓存命中率统计
 */

/** 缓存条目 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccess: number;
}

/** 缓存统计 */
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  hitRate: number;
}

/** 缓存配置 */
interface CacheConfig {
  /** 最大条目数 */
  maxSize: number;
  /** 默认TTL（毫秒） */
  defaultTTL: number;
  /** 是否启用LRU淘汰 */
  enableLRU: boolean;
}

/**
 * 通用LRU+TTL缓存
 */
export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    hitRate: 0,
  };

  constructor(private config: CacheConfig) {
    // 定期清理过期条目
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // 更新访问信息
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    this.stats.hits++;
    this.updateHitRate();
    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T, ttl?: number): void {
    // 如果超过最大大小，执行LRU淘汰
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + (ttl ?? this.config.defaultTTL),
      accessCount: 1,
      lastAccess: Date.now(),
    };

    this.cache.set(key, entry);
    this.stats.sets++;
  }

  /**
   * 检查键是否存在且未过期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 删除缓存条目
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      hitRate: 0,
    };
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats & { size: number; maxSize: number } {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.config.maxSize,
    };
  }

  /**
   * LRU淘汰策略
   */
  private evictLRU(): void {
    if (!this.config.enableLRU || this.cache.size === 0) return;

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * 游戏专用缓存管理器
 * 管理多个分区的缓存
 */
export class GameCacheManager {
  /** 估值缓存 */
  private valuationCache: Cache<number>;
  
  /** AI战略缓存 */
  private strategyCache: Cache<unknown>;
  
  /** 市场分析缓存 */
  private marketAnalysisCache: Cache<unknown>;
  
  /** 计算结果缓存 */
  private computeCache: Cache<unknown>;

  constructor() {
    this.valuationCache = new Cache({
      maxSize: 500,
      defaultTTL: 10000, // 10秒
      enableLRU: true,
    });

    this.strategyCache = new Cache({
      maxSize: 100,
      defaultTTL: 300000, // 5分钟
      enableLRU: true,
    });

    this.marketAnalysisCache = new Cache({
      maxSize: 200,
      defaultTTL: 60000, // 1分钟
      enableLRU: true,
    });

    this.computeCache = new Cache({
      maxSize: 1000,
      defaultTTL: 5000, // 5秒
      enableLRU: true,
    });
  }

  // ===== 估值缓存 =====
  
  /**
   * 获取公司估值缓存
   */
  getValuation(companyId: string): number | undefined {
    return this.valuationCache.get(`valuation:${companyId}`);
  }

  /**
   * 设置公司估值缓存
   */
  setValuation(companyId: string, value: number, ttl?: number): void {
    this.valuationCache.set(`valuation:${companyId}`, value, ttl);
  }

  // ===== AI战略缓存 =====

  /**
   * 获取AI战略缓存
   */
  getStrategy<T>(companyId: string): T | undefined {
    return this.strategyCache.get(`strategy:${companyId}`) as T | undefined;
  }

  /**
   * 设置AI战略缓存
   */
  setStrategy<T>(companyId: string, strategy: T, ttl?: number): void {
    this.strategyCache.set(`strategy:${companyId}`, strategy, ttl);
  }

  // ===== 市场分析缓存 =====

  /**
   * 获取市场分析缓存
   */
  getMarketAnalysis<T>(key: string): T | undefined {
    return this.marketAnalysisCache.get(`market:${key}`) as T | undefined;
  }

  /**
   * 设置市场分析缓存
   */
  setMarketAnalysis<T>(key: string, analysis: T, ttl?: number): void {
    this.marketAnalysisCache.set(`market:${key}`, analysis, ttl);
  }

  // ===== 通用计算缓存 =====

  /**
   * 带缓存的计算
   * 如果缓存存在则返回缓存值，否则执行计算并缓存
   */
  computeWithCache<T>(
    key: string,
    compute: () => T,
    ttl?: number
  ): T {
    const cached = this.computeCache.get(`compute:${key}`) as T | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const result = compute();
    this.computeCache.set(`compute:${key}`, result, ttl);
    return result;
  }

  /**
   * 异步带缓存的计算
   */
  async computeWithCacheAsync<T>(
    key: string,
    compute: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.computeCache.get(`compute:${key}`) as T | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const result = await compute();
    this.computeCache.set(`compute:${key}`, result, ttl);
    return result;
  }

  // ===== 管理方法 =====

  /**
   * 获取所有缓存统计
   */
  getAllStats(): {
    valuation: ReturnType<Cache<unknown>['getStats']>;
    strategy: ReturnType<Cache<unknown>['getStats']>;
    marketAnalysis: ReturnType<Cache<unknown>['getStats']>;
    compute: ReturnType<Cache<unknown>['getStats']>;
  } {
    return {
      valuation: this.valuationCache.getStats(),
      strategy: this.strategyCache.getStats(),
      marketAnalysis: this.marketAnalysisCache.getStats(),
      compute: this.computeCache.getStats(),
    };
  }

  /**
   * 清空所有缓存
   */
  clearAll(): void {
    this.valuationCache.clear();
    this.strategyCache.clear();
    this.marketAnalysisCache.clear();
    this.computeCache.clear();
  }

  /**
   * 使公司相关缓存失效
   */
  invalidateCompany(companyId: string): void {
    this.valuationCache.delete(`valuation:${companyId}`);
    this.strategyCache.delete(`strategy:${companyId}`);
  }
}

// 单例导出
export const gameCacheManager = new GameCacheManager();