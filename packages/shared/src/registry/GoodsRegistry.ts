/**
 * 商品注册表 - 单例模式
 * 统一管理所有商品定义，自动派生价格、消费需求等属性
 */

import type { EntityId } from '../types/common.js';
import type {
  GoodsCategory,
  GoodsSubcategory,
  GoodsDefinition,
  GoodsData,
  ConsumerDemandLevel,
  PriceVolatility,
} from './types.js';

/**
 * 商品注册表配置
 */
interface GoodsRegistryConfig {
  /** 基础价格波动系数 */
  basePriceVolatility: number;
  /** 各层级价格乘数 */
  tierPriceMultipliers: Record<number, number>;
  /** 消费需求等级对应的基础消费率 */
  demandLevelRates: Record<ConsumerDemandLevel, number>;
  /** 价格波动等级对应的系数 */
  volatilityFactors: Record<PriceVolatility, number>;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: GoodsRegistryConfig = {
  basePriceVolatility: 0.1,
  tierPriceMultipliers: {
    0: 1.0,
    1: 2.0,
    2: 4.0,
    3: 8.0,
    4: 16.0,
    5: 32.0,
  },
  demandLevelRates: {
    none: 0,
    low: 5,
    medium: 15,
    high: 30,
    very_high: 50,
  },
  volatilityFactors: {
    stable: 0.02,
    low: 0.05,
    medium: 0.10,
    high: 0.20,
    extreme: 0.35,
  },
};

/**
 * 从类别推断子类别
 */
function inferSubcategory(category: GoodsCategory, tags: string[]): GoodsSubcategory {
  // 根据标签推断
  if (tags.includes('metal') || tags.includes('ore')) return 'metal_ore';
  if (tags.includes('energy') || tags.includes('fuel')) return 'energy_resource';
  if (tags.includes('mineral')) return 'mineral';
  if (tags.includes('agricultural') || tags.includes('crop')) return 'agricultural';
  if (tags.includes('processed_metal')) return 'metal';
  if (tags.includes('chemical')) return 'chemical';
  if (tags.includes('textile')) return 'textile';
  if (tags.includes('component') || tags.includes('part')) return 'component';
  if (tags.includes('electronics')) return 'electronics';
  if (tags.includes('vehicle')) return 'vehicle';
  if (tags.includes('food')) return 'food';
  if (tags.includes('household')) return 'household';
  if (tags.includes('luxury')) return 'luxury';
  if (tags.includes('utility')) return 'utility';
  
  // 根据类别推断默认值
  const categoryDefaults: Record<GoodsCategory, GoodsSubcategory> = {
    raw_material: 'mineral',
    basic_processed: 'metal',
    intermediate: 'component',
    consumer_good: 'household',
    service: 'utility',
  };
  
  return categoryDefaults[category];
}

/**
 * 从类别推断默认消费需求等级
 */
function inferDemandLevel(category: GoodsCategory): ConsumerDemandLevel {
  const defaults: Record<GoodsCategory, ConsumerDemandLevel> = {
    raw_material: 'none',
    basic_processed: 'none',
    intermediate: 'none',
    consumer_good: 'medium',
    service: 'medium',
  };
  return defaults[category];
}

/**
 * 从类别推断默认价格波动性
 */
function inferVolatility(category: GoodsCategory, tier: number): PriceVolatility {
  // 原材料波动大，高级产品波动小
  if (category === 'raw_material') {
    return tier === 0 ? 'high' : 'medium';
  }
  if (category === 'basic_processed') {
    return 'medium';
  }
  if (category === 'consumer_good' || category === 'service') {
    return 'low';
  }
  return 'medium';
}

/**
 * 生成英文名（从中文名或ID转换）
 */
function generateEnglishName(id: string, _nameZh: string): string {
  // 简单转换：将id中的连字符替换为空格，首字母大写
  return id.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * 生成描述
 */
function generateDescription(nameZh: string, category: GoodsCategory): string {
  const categoryNames: Record<GoodsCategory, string> = {
    raw_material: '原材料',
    basic_processed: '基础加工品',
    intermediate: '中间产品',
    consumer_good: '消费品',
    service: '服务',
  };
  return `${nameZh}是一种${categoryNames[category]}。`;
}

/**
 * 商品注册表类
 * 使用声明式配置定义商品，自动派生运行时所需的所有属性
 */
export class GoodsRegistry {
  private static instance: GoodsRegistry | null = null;
  
  private definitions: Map<string, GoodsDefinition> = new Map();
  private derivedData: Map<string, GoodsData> = new Map();
  private config: GoodsRegistryConfig;
  private initialized = false;
  
  // 索引
  private byCategory: Map<GoodsCategory, string[]> = new Map();
  private bySubcategory: Map<GoodsSubcategory, string[]> = new Map();
  private byTier: Map<number, string[]> = new Map();
  private byTag: Map<string, string[]> = new Map();
  private consumerGoods: string[] = [];
  
  private constructor(config?: Partial<GoodsRegistryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<GoodsRegistryConfig>): GoodsRegistry {
    if (!GoodsRegistry.instance) {
      GoodsRegistry.instance = new GoodsRegistry(config);
    }
    return GoodsRegistry.instance;
  }
  
  /**
   * 重置实例（仅用于测试）
   */
  static resetInstance(): void {
    GoodsRegistry.instance = null;
  }
  
  /**
   * 批量注册商品定义
   */
  registerAll(definitions: Record<string, GoodsDefinition>): void {
    for (const [id, def] of Object.entries(definitions)) {
      this.register(id, def);
    }
    this.initialized = true;
    this.buildIndices();
  }
  
  /**
   * 注册单个商品
   */
  register(id: string, definition: GoodsDefinition): void {
    // 验证必需字段
    this.validateDefinition(id, definition);
    
    // 存储原始定义
    this.definitions.set(id, definition);
    
    // 派生运行时数据
    const derived = this.deriveGoodsData(id, definition);
    this.derivedData.set(id, derived);
  }
  
  /**
   * 验证商品定义
   */
  private validateDefinition(id: string, def: GoodsDefinition): void {
    if (!def.nameZh) {
      throw new Error(`[GoodsRegistry] 商品 ${id} 缺少 nameZh`);
    }
    if (!def.category) {
      throw new Error(`[GoodsRegistry] 商品 ${id} 缺少 category`);
    }
    if (def.tier < 0 || def.tier > 5) {
      throw new Error(`[GoodsRegistry] 商品 ${id} tier 必须在 0-5 之间`);
    }
    if (def.basePrice <= 0) {
      throw new Error(`[GoodsRegistry] 商品 ${id} basePrice 必须大于 0`);
    }
  }
  
  /**
   * 从定义派生运行时数据
   */
  private deriveGoodsData(id: string, def: GoodsDefinition): GoodsData {
    // 确定子类别
    const subcategory = def.subcategory ?? inferSubcategory(def.category, def.tags);
    
    // 确定消费需求等级
    const demandLevel = def.consumerDemand ?? inferDemandLevel(def.category);
    
    // 确定价格波动性
    const volatility = def.priceVolatility ?? inferVolatility(def.category, def.tier);
    
    // 计算消费需求率
    const consumerDemandRate = this.config.demandLevelRates[demandLevel];
    
    // 计算价格波动系数
    const priceVolatilityFactor = this.config.volatilityFactors[volatility];
    
    // 生成英文名
    const name = def.name ?? generateEnglishName(id, def.nameZh);
    
    // 生成描述
    const description = def.description ?? generateDescription(def.nameZh, def.category);
    
    return {
      id: id as EntityId,
      name,
      nameZh: def.nameZh,
      category: def.category,
      subcategory,
      tier: def.tier,
      basePrice: def.basePrice,
      icon: def.icon,
      tags: def.tags,
      description,
      consumerDemandRate,
      priceVolatilityFactor,
    };
  }
  
  /**
   * 构建查询索引
   */
  private buildIndices(): void {
    // 清空索引
    this.byCategory.clear();
    this.bySubcategory.clear();
    this.byTier.clear();
    this.byTag.clear();
    this.consumerGoods = [];
    
    for (const [id, data] of this.derivedData) {
      // 按类别索引
      if (!this.byCategory.has(data.category)) {
        this.byCategory.set(data.category, []);
      }
      this.byCategory.get(data.category)!.push(id);
      
      // 按子类别索引
      if (!this.bySubcategory.has(data.subcategory)) {
        this.bySubcategory.set(data.subcategory, []);
      }
      this.bySubcategory.get(data.subcategory)!.push(id);
      
      // 按层级索引
      if (!this.byTier.has(data.tier)) {
        this.byTier.set(data.tier, []);
      }
      this.byTier.get(data.tier)!.push(id);
      
      // 按标签索引
      for (const tag of data.tags) {
        if (!this.byTag.has(tag)) {
          this.byTag.set(tag, []);
        }
        this.byTag.get(tag)!.push(id);
      }
      
      // 消费品索引
      if (data.consumerDemandRate > 0) {
        this.consumerGoods.push(id);
      }
    }
  }
  
  // ==================== 查询方法 ====================
  
  /**
   * 获取商品数据
   */
  get(id: string): GoodsData | undefined {
    return this.derivedData.get(id);
  }
  
  /**
   * 获取商品数据（必须存在）
   */
  getOrThrow(id: string): GoodsData {
    const data = this.derivedData.get(id);
    if (!data) {
      throw new Error(`[GoodsRegistry] 商品 ${id} 不存在`);
    }
    return data;
  }
  
  /**
   * 获取原始定义
   */
  getDefinition(id: string): GoodsDefinition | undefined {
    return this.definitions.get(id);
  }
  
  /**
   * 检查商品是否存在
   */
  has(id: string): boolean {
    return this.derivedData.has(id);
  }
  
  /**
   * 获取所有商品 ID
   */
  getAllIds(): string[] {
    return Array.from(this.derivedData.keys());
  }
  
  /**
   * 获取所有商品数据
   */
  getAll(): GoodsData[] {
    return Array.from(this.derivedData.values());
  }
  
  /**
   * 按类别获取商品
   */
  getByCategory(category: GoodsCategory): GoodsData[] {
    const ids = this.byCategory.get(category) ?? [];
    return ids.map(id => this.derivedData.get(id)!);
  }
  
  /**
   * 按子类别获取商品
   */
  getBySubcategory(subcategory: GoodsSubcategory): GoodsData[] {
    const ids = this.bySubcategory.get(subcategory) ?? [];
    return ids.map(id => this.derivedData.get(id)!);
  }
  
  /**
   * 按层级获取商品
   */
  getByTier(tier: number): GoodsData[] {
    const ids = this.byTier.get(tier) ?? [];
    return ids.map(id => this.derivedData.get(id)!);
  }
  
  /**
   * 按标签获取商品
   */
  getByTag(tag: string): GoodsData[] {
    const ids = this.byTag.get(tag) ?? [];
    return ids.map(id => this.derivedData.get(id)!);
  }
  
  /**
   * 获取所有消费品（有消费需求的商品）
   */
  getConsumerGoods(): GoodsData[] {
    return this.consumerGoods.map(id => this.derivedData.get(id)!);
  }
  
  /**
   * 获取消费品ID和消费率的映射（用于gameLoop）
   */
  getConsumerDemandMap(): Map<string, number> {
    const map = new Map<string, number>();
    for (const id of this.consumerGoods) {
      const data = this.derivedData.get(id);
      if (data) {
        map.set(id, data.consumerDemandRate);
      }
    }
    return map;
  }
  
  /**
   * 搜索商品
   */
  search(query: string): GoodsData[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(data =>
      data.id.toLowerCase().includes(lowerQuery) ||
      data.name.toLowerCase().includes(lowerQuery) ||
      data.nameZh.includes(query) ||
      data.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
  
  // ==================== 统计方法 ====================
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalCount: number;
    byCategory: Record<string, number>;
    byTier: Record<number, number>;
    consumerGoodsCount: number;
    tagCount: number;
  } {
    const byCategory: Record<string, number> = {};
    const byTier: Record<number, number> = {};
    
    for (const [cat, ids] of this.byCategory) {
      byCategory[cat] = ids.length;
    }
    for (const [tier, ids] of this.byTier) {
      byTier[tier] = ids.length;
    }
    
    return {
      totalCount: this.derivedData.size,
      byCategory,
      byTier,
      consumerGoodsCount: this.consumerGoods.length,
      tagCount: this.byTag.size,
    };
  }
  
  /**
   * 导出为 JSON（用于调试）
   */
  toJSON(): Record<string, GoodsData> {
    const result: Record<string, GoodsData> = {};
    for (const [id, data] of this.derivedData) {
      result[id] = data;
    }
    return result;
  }
  
  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * 便捷函数：获取全局商品注册表实例
 */
export function getGoodsRegistry(): GoodsRegistry {
  return GoodsRegistry.getInstance();
}