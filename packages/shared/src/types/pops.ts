/**
 * Victoria 3 风格 POPs (人口群体) 需求系统类型定义
 *
 * 核心概念:
 * - POPGroupConfig: 人口阶层配置 (工薪/中产/富裕)
 * - NeedGroupConfig: 需求组配置 (基础代谢/精神刺激/社会地位等)
 * - SubstitutionGroup: 平替组 (同需求组内可互相替代的商品)
 *
 * 注意: 使用 Config 后缀以避免与 market.ts 中的类型冲突
 */

/**
 * 人口阶层配置定义
 */
export interface POPGroupConfig {
  /** 唯一标识符 */
  id: string;
  /** 阶层名称 */
  name: string;
  /** 中文名称 */
  nameZh: string;
  /** 人口数量 (人) */
  population: number;
  /** 月收入 (分) */
  monthlyIncome: number;
  /** 各需求组的预算分配比例 (总和应为1.0) */
  needBudgets: Record<string, number>;
  /** 消费偏好修正 (影响效用计算) */
  preferences?: {
    /** 偏好高端商品 (效用加成) */
    premiumBonus?: number;
    /** 价格敏感度 (价格在效用计算中的权重) */
    priceSensitivity?: number;
  };
}

/**
 * 需求组配置定义
 */
export interface NeedGroupConfig {
  /** 唯一标识符 */
  id: string;
  /** 需求组名称 */
  name: string;
  /** 中文名称 */
  nameZh: string;
  /** 优先级 (1最高, 越大越低) */
  priority: number;
  /** 满足度衰减率 (每tick衰减的百分比) */
  satisfactionDecay: number;
  /** 可满足该需求的商品ID列表 */
  eligibleGoods: string[];
  /** 描述 */
  description?: string;
}

/**
 * 替代组内的商品配置
 */
export interface SubstitutionProduct {
  /** 商品ID */
  goodsId: string;
  /** 基础效用值 */
  baseUtility: number;
  /** 作为替代品时的效用惩罚 (0.0-1.0, 例如0.15表示效用降低15%) */
  substitutionPenalty: number;
}

/**
 * 替代组定义
 * 同一替代组内的商品可以互相替代
 */
export interface SubstitutionGroup {
  /** 唯一标识符 */
  id: string;
  /** 所属需求组 */
  needGroup: string;
  /** 中文名称 */
  nameZh: string;
  /** 替代层级 (同层级可互替) */
  tier: number;
  /** 组内商品列表 */
  products: SubstitutionProduct[];
}

/**
 * POPs消费决策结果
 */
export interface ConsumptionDecision {
  /** POPGroup ID */
  popGroupId: string;
  /** 需求组ID */
  needGroupId: string;
  /** 选择的商品ID */
  goodsId: string;
  /** 购买数量 */
  quantity: number;
  /** 期望单价 */
  maxPrice: number;
  /** 是否为替代选择 */
  isSubstitute: boolean;
  /** 原始首选商品 (如果是替代) */
  originalPreference?: string;
  /** 计算的效用值 */
  utility: number;
  /** 效用/价格比 */
  utilityPriceRatio: number;
}

/**
 * POPs满足度状态
 */
export interface POPSatisfaction {
  /** POPGroup ID */
  popGroupId: string;
  /** 各需求组的满足度 (0-100) */
  needSatisfaction: Record<string, number>;
  /** 总体幸福度 (加权平均) */
  overallHappiness: number;
  /** 上次更新时间 */
  lastUpdated: number;
}

/**
 * 商品的需求组属性扩展
 */
export interface GoodsNeedProperties {
  /** 所属需求组列表 (一个商品可属于多个需求组) */
  needGroups: string[];
  /** 基础效用值 */
  baseUtility: number;
  /** 替代组ID */
  substitutionGroupId?: string;
  /** 替代层级 */
  substitutionTier?: number;
  /** 作为替代品时的惩罚 */
  substitutionPenalty?: number;
}

/**
 * 市场价格信息 (用于消费决策)
 */
export interface MarketPriceInfo {
  goodsId: string;
  currentPrice: number;
  available: boolean;
  availableQuantity: number;
}

/**
 * 消费预算分配
 */
export interface BudgetAllocation {
  needGroupId: string;
  budget: number;
  spent: number;
  remaining: number;
}

/**
 * POPs配置汇总
 */
export interface POPsConfig {
  popGroups: POPGroupConfig[];
  needGroups: NeedGroupConfig[];
  substitutionGroups: SubstitutionGroup[];
}