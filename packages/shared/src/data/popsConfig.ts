/**
 * Victoria 3 风格 POPs 需求系统配置
 * 
 * 包含:
 * - 人口阶层 (POPGroups): 工薪/中产/富裕
 * - 需求组 (NeedGroups): 基础代谢/精神刺激/社会地位/出行/居住/信息
 * - 替代组 (SubstitutionGroups): 同需求组内可互替的商品
 */

import type { POPGroupConfig, NeedGroupConfig, SubstitutionGroup, POPsConfig } from '../types/pops.js';

// ============ 人口阶层配置 ============

/**
 * 工薪阶层
 * 占人口大多数，收入较低，主要消费基础生活用品
 */
export const WORKING_CLASS: POPGroupConfig = {
  id: 'working-class',
  name: 'Working Class',
  nameZh: '工薪阶层',
  population: 5000000,  // 500万人
  monthlyIncome: 300000, // $3000/月 (分)
  needBudgets: {
    'basic-metabolism': 0.45,   // 45% 用于食品饮料
    'stimulants': 0.10,          // 10% 精神刺激
    'mobility': 0.10,            // 10% 出行
    'housing': 0.15,             // 15% 居住
    'information': 0.15,         // 15% 信息获取
    'social-status': 0.05,       // 5% 社会地位
  },
  preferences: {
    premiumBonus: 0.8,           // 对高端商品效用打8折
    priceSensitivity: 1.3,       // 价格敏感度高
  },
};

/**
 * 中产阶级
 * 收入中等，消费均衡，既关注性价比也追求品质
 */
export const MIDDLE_CLASS: POPGroupConfig = {
  id: 'middle-class',
  name: 'Middle Class',
  nameZh: '中产阶级',
  population: 3000000,  // 300万人
  monthlyIncome: 800000, // $8000/月 (分)
  needBudgets: {
    'basic-metabolism': 0.30,   // 30% 食品饮料
    'stimulants': 0.15,          // 15% 精神刺激
    'mobility': 0.15,            // 15% 出行
    'housing': 0.15,             // 15% 居住
    'information': 0.15,         // 15% 信息获取
    'social-status': 0.10,       // 10% 社会地位
  },
  preferences: {
    premiumBonus: 1.0,           // 对高端商品正常效用
    priceSensitivity: 1.0,       // 价格敏感度中等
  },
};

/**
 * 富裕阶层
 * 高收入人群，追求品质和社会地位，价格不敏感
 */
export const WEALTHY_CLASS: POPGroupConfig = {
  id: 'wealthy-class',
  name: 'Wealthy Class',
  nameZh: '富裕阶层',
  population: 1000000,  // 100万人
  monthlyIncome: 3000000, // $30000/月 (分)
  needBudgets: {
    'basic-metabolism': 0.15,   // 15% 食品饮料
    'stimulants': 0.15,          // 15% 精神刺激
    'mobility': 0.20,            // 20% 出行 (豪车)
    'housing': 0.15,             // 15% 居住
    'information': 0.10,         // 10% 信息获取
    'social-status': 0.25,       // 25% 社会地位
  },
  preferences: {
    premiumBonus: 1.3,           // 对高端商品效用加成30%
    priceSensitivity: 0.5,       // 价格敏感度低
  },
};

export const POP_GROUPS: POPGroupConfig[] = [
  WORKING_CLASS,
  MIDDLE_CLASS,
  WEALTHY_CLASS,
];

// ============ 需求组配置 ============

/**
 * 基础代谢需求
 * 最高优先级，包括食品、饮料等生存必需品
 */
export const BASIC_METABOLISM: NeedGroupConfig = {
  id: 'basic-metabolism',
  name: 'Basic Metabolism',
  nameZh: '基础代谢',
  priority: 1,
  satisfactionDecay: 0.05, // 每tick衰减5%
  eligibleGoods: [
    'packaged-food',
    'processed-meat',
    'beverages',
  ],
  description: '食物、饮料等基础生存需求',
};

/**
 * 精神刺激需求
 * 娱乐、咖啡因等精神层面的满足
 */
export const STIMULANTS: NeedGroupConfig = {
  id: 'stimulants',
  name: 'Stimulants',
  nameZh: '精神刺激',
  priority: 2,
  satisfactionDecay: 0.03,
  eligibleGoods: [
    'beverages',        // 饮料也可满足精神刺激
    'gaming-console',
    'smart-tv',
    'vr-headset',
  ],
  description: '娱乐、咖啡因等精神层面需求',
};

/**
 * 出行效率需求
 * 汽车等交通工具
 */
export const MOBILITY: NeedGroupConfig = {
  id: 'mobility',
  name: 'Mobility',
  nameZh: '出行效率',
  priority: 3,
  satisfactionDecay: 0.01, // 汽车满足度衰减慢
  eligibleGoods: [
    'electric-vehicle',
    'gasoline-car',
    'premium-ev',
  ],
  description: '交通出行需求',
};

/**
 * 居住品质需求
 * 家电、日用品等
 */
export const HOUSING: NeedGroupConfig = {
  id: 'housing',
  name: 'Housing Quality',
  nameZh: '居住品质',
  priority: 4,
  satisfactionDecay: 0.02,
  eligibleGoods: [
    'home-appliance',
    'household-goods',
  ],
  description: '家居用品和生活品质需求',
};

/**
 * 信息获取需求
 * 电子产品、通讯设备等
 */
export const INFORMATION: NeedGroupConfig = {
  id: 'information',
  name: 'Information Access',
  nameZh: '信息获取',
  priority: 4,
  satisfactionDecay: 0.02,
  eligibleGoods: [
    'smartphone',
    'personal-computer',
    'smart-tv',
  ],
  description: '电子设备和信息获取需求',
};

/**
 * 社会地位需求
 * 奢侈品、高端产品等
 */
export const SOCIAL_STATUS: NeedGroupConfig = {
  id: 'social-status',
  name: 'Social Status',
  nameZh: '社会地位',
  priority: 5,
  satisfactionDecay: 0.02,
  eligibleGoods: [
    'premium-smartphone',
    'premium-ev',
    'vr-headset',
    'home-appliance',
  ],
  description: '奢侈品和社会地位象征',
};

export const NEED_GROUPS: NeedGroupConfig[] = [
  BASIC_METABOLISM,
  STIMULANTS,
  MOBILITY,
  HOUSING,
  INFORMATION,
  SOCIAL_STATUS,
];

// ============ 替代组配置 ============

/**
 * 食品类替代组
 * packaged-food 和 processed-meat 可互相替代
 */
export const FOOD_SUBSTITUTION: SubstitutionGroup = {
  id: 'food-basic',
  needGroup: 'basic-metabolism',
  nameZh: '食品类',
  tier: 1,
  products: [
    { goodsId: 'packaged-food', baseUtility: 50, substitutionPenalty: 0.0 },
    { goodsId: 'processed-meat', baseUtility: 60, substitutionPenalty: 0.0 },
  ],
};

/**
 * 饮品类替代组
 */
export const BEVERAGE_SUBSTITUTION: SubstitutionGroup = {
  id: 'beverages-basic',
  needGroup: 'basic-metabolism',
  nameZh: '饮品类',
  tier: 1,
  products: [
    { goodsId: 'beverages', baseUtility: 40, substitutionPenalty: 0.0 },
  ],
};

/**
 * 娱乐设备替代组
 */
export const ENTERTAINMENT_SUBSTITUTION: SubstitutionGroup = {
  id: 'entertainment-devices',
  needGroup: 'stimulants',
  nameZh: '娱乐设备',
  tier: 1,
  products: [
    { goodsId: 'smart-tv', baseUtility: 70, substitutionPenalty: 0.0 },
    { goodsId: 'gaming-console', baseUtility: 80, substitutionPenalty: 0.05 },
    { goodsId: 'vr-headset', baseUtility: 90, substitutionPenalty: 0.10 },
  ],
};

/**
 * 汽车类替代组
 * 电动车和燃油车可互相替代
 */
export const VEHICLE_SUBSTITUTION: SubstitutionGroup = {
  id: 'vehicles',
  needGroup: 'mobility',
  nameZh: '汽车类',
  tier: 1,
  products: [
    { goodsId: 'electric-vehicle', baseUtility: 100, substitutionPenalty: 0.0 },
    { goodsId: 'gasoline-car', baseUtility: 90, substitutionPenalty: 0.05 },
    { goodsId: 'premium-ev', baseUtility: 150, substitutionPenalty: 0.0 },
  ],
};

/**
 * 家电类替代组
 */
export const APPLIANCE_SUBSTITUTION: SubstitutionGroup = {
  id: 'home-appliances',
  needGroup: 'housing',
  nameZh: '家电类',
  tier: 1,
  products: [
    { goodsId: 'home-appliance', baseUtility: 60, substitutionPenalty: 0.0 },
    { goodsId: 'household-goods', baseUtility: 30, substitutionPenalty: 0.15 },
  ],
};

/**
 * 通讯设备替代组
 */
export const COMMUNICATION_SUBSTITUTION: SubstitutionGroup = {
  id: 'communication-devices',
  needGroup: 'information',
  nameZh: '通讯设备',
  tier: 1,
  products: [
    { goodsId: 'smartphone', baseUtility: 80, substitutionPenalty: 0.0 },
    { goodsId: 'personal-computer', baseUtility: 70, substitutionPenalty: 0.10 },
    { goodsId: 'smart-tv', baseUtility: 50, substitutionPenalty: 0.20 },
  ],
};

/**
 * 高端电子类替代组
 */
export const LUXURY_ELECTRONICS_SUBSTITUTION: SubstitutionGroup = {
  id: 'luxury-electronics',
  needGroup: 'social-status',
  nameZh: '高端电子',
  tier: 1,
  products: [
    { goodsId: 'premium-smartphone', baseUtility: 100, substitutionPenalty: 0.0 },
    { goodsId: 'vr-headset', baseUtility: 90, substitutionPenalty: 0.10 },
  ],
};

/**
 * 高端出行类替代组
 */
export const LUXURY_MOBILITY_SUBSTITUTION: SubstitutionGroup = {
  id: 'luxury-mobility',
  needGroup: 'social-status',
  nameZh: '高端出行',
  tier: 2,
  products: [
    { goodsId: 'premium-ev', baseUtility: 150, substitutionPenalty: 0.0 },
  ],
};

export const SUBSTITUTION_GROUPS: SubstitutionGroup[] = [
  FOOD_SUBSTITUTION,
  BEVERAGE_SUBSTITUTION,
  ENTERTAINMENT_SUBSTITUTION,
  VEHICLE_SUBSTITUTION,
  APPLIANCE_SUBSTITUTION,
  COMMUNICATION_SUBSTITUTION,
  LUXURY_ELECTRONICS_SUBSTITUTION,
  LUXURY_MOBILITY_SUBSTITUTION,
];

// ============ 汇总配置 ============

export const POPS_CONFIG: POPsConfig = {
  popGroups: POP_GROUPS,
  needGroups: NEED_GROUPS,
  substitutionGroups: SUBSTITUTION_GROUPS,
};

// ============ 工具函数 ============

/**
 * 根据ID获取POPGroup
 */
export function getPOPGroup(id: string): POPGroupConfig | undefined {
  return POP_GROUPS.find(p => p.id === id);
}

/**
 * 根据ID获取NeedGroup
 */
export function getNeedGroup(id: string): NeedGroupConfig | undefined {
  return NEED_GROUPS.find(n => n.id === id);
}

/**
 * 根据商品ID查找其所属的替代组
 */
export function getSubstitutionGroupForGoods(goodsId: string): SubstitutionGroup | undefined {
  return SUBSTITUTION_GROUPS.find(sg => 
    sg.products.some(p => p.goodsId === goodsId)
  );
}

/**
 * 查找商品的替代品列表 (按效用排序)
 */
export function getSubstitutes(goodsId: string): SubstitutionGroup['products'] {
  const group = getSubstitutionGroupForGoods(goodsId);
  if (!group) return [];
  
  // 返回除了自身以外的所有替代品，按效用降序
  return group.products
    .filter(p => p.goodsId !== goodsId)
    .sort((a, b) => b.baseUtility - a.baseUtility);
}

/**
 * 获取商品在替代组中的基础效用
 */
export function getGoodsBaseUtility(goodsId: string): number {
  for (const sg of SUBSTITUTION_GROUPS) {
    const product = sg.products.find(p => p.goodsId === goodsId);
    if (product) {
      return product.baseUtility;
    }
  }
  // 默认效用
  return 50;
}

/**
 * 获取商品的替代惩罚
 */
export function getSubstitutionPenalty(goodsId: string): number {
  for (const sg of SUBSTITUTION_GROUPS) {
    const product = sg.products.find(p => p.goodsId === goodsId);
    if (product) {
      return product.substitutionPenalty;
    }
  }
  return 0;
}

/**
 * 获取需求组可用商品的效用排序列表
 */
export function getGoodsForNeedGroupSorted(needGroupId: string): Array<{
  goodsId: string;
  baseUtility: number;
  substitutionPenalty: number;
}> {
  const result: Array<{
    goodsId: string;
    baseUtility: number;
    substitutionPenalty: number;
  }> = [];
  
  for (const sg of SUBSTITUTION_GROUPS) {
    if (sg.needGroup === needGroupId) {
      for (const product of sg.products) {
        result.push({
          goodsId: product.goodsId,
          baseUtility: product.baseUtility,
          substitutionPenalty: product.substitutionPenalty,
        });
      }
    }
  }
  
  // 按效用降序排列
  return result.sort((a, b) => b.baseUtility - a.baseUtility);
}

/**
 * 计算城市总人口
 */
export function getTotalPopulation(): number {
  return POP_GROUPS.reduce((sum, pg) => sum + pg.population, 0);
}

/**
 * 计算城市总月消费预算
 */
export function getTotalMonthlyBudget(): number {
  return POP_GROUPS.reduce((sum, pg) => sum + pg.population * pg.monthlyIncome, 0);
}