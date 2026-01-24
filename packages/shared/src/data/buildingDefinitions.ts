/**
 * 建筑声明式定义 - 使用 BuildingRegistry 系统
 * 
 * 这是新的建筑配置格式，核心设计原则：
 * 1. 只需定义核心属性，其他自动派生
 * 2. 使用模板系统减少重复
 * 3. 声明式配方定义
 */

import type {
  BuildingCategory,
  ProductionSlotType
} from '../registry/types.js';

// ============ 建筑定义接口 ============

/**
 * 生产配方定义
 */
export interface RecipeDefinition {
  inputs: Array<{ goodsId: string; amount: number }>;
  outputs: Array<{ goodsId: string; amount: number }>;
  ticksRequired: number;
}

/**
 * 生产方式定义
 */
export interface ProductionMethodDefinition {
  id: string;
  nameZh: string;
  name?: string;
  description?: string;
  recipe: RecipeDefinition;
  laborRequired: number;
  powerRequired: number;
  efficiency: number;
}

/**
 * 生产槽位定义
 */
export interface ProductionSlotDefinition {
  type: ProductionSlotType;
  name: string;
  defaultMethodId: string;
  methods: ProductionMethodDefinition[];
}

/**
 * 建造材料需求
 */
export interface ConstructionMaterial {
  goodsId: string;
  amount: number;
}

/**
 * 建筑定义（数据配置格式）
 * 注意：与 types/production.ts 中的 BuildingDefinition 不同
 * 这个接口用于声明式配置，不需要所有运行时属性
 */
export interface BuildingDef {
  nameZh: string;
  name?: string;
  category: BuildingCategory;
  subcategory?: string;
  description?: string;
  icon: string;
  size: 'small' | 'medium' | 'large' | 'huge';
  /** @deprecated 使用 calculateConstructionCost 动态计算成本 */
  baseCost: number;
  maintenanceCost: number;
  maxWorkers: number;
  productionSlots: ProductionSlotDefinition[];
  /** 使用的模板ID（可选，用于自动派生某些属性）*/
  templateId?: string;
  /** 建造所需时间（ticks，1 tick = 1天）- 如未指定则根据size自动派生 */
  constructionTime?: number;
  /** 建造所需材料 - 必须指定，定义真实的材料需求 */
  constructionMaterials?: ConstructionMaterial[];
  /** 劳动力复杂度因子 - 影响人工成本，默认根据category自动派生 */
  laborComplexityFactor?: number;
}

// ============ 建造系统配置 ============

/**
 * 根据建筑规模的默认建造时间（ticks，1 tick = 1天）
 *
 * 现实建造时间参考：
 * - 小型建筑（便利店、加油站）: 1-2个月
 * - 中型建筑（工厂、仓库）: 3-6个月
 * - 大型建筑（钢铁厂、化工厂）: 6-12个月
 * - 巨型建筑（芯片厂、炼油厂）: 1-3年
 *
 * 游戏中为了平衡性适当缩短，但保持相对比例
 */
export const CONSTRUCTION_TIME_BY_SIZE: Record<BuildingDef['size'], number> = {
  small: 30,    // 30天 (约1个月) - 便利店、小型零售店
  medium: 75,   // 75天 (约2.5个月) - 中型工厂、仓库
  large: 150,   // 150天 (约5个月) - 大型工厂、炼钢厂
  huge: 300,    // 300天 (约10个月) - 芯片厂、炼油厂、汽车工厂
};

/**
 * 根据建筑规模的劳动力成本系数
 */
export const LABOR_SIZE_FACTOR: Record<BuildingDef['size'], number> = {
  small: 0.5,
  medium: 1.0,
  large: 2.0,
  huge: 4.0,
};

/**
 * 根据建筑类别的劳动力复杂度系数
 */
export const LABOR_CATEGORY_FACTOR: Record<string, number> = {
  extraction: 1.0,      // 资源开采 - 基础难度
  agriculture: 0.6,     // 农业 - 较低难度
  processing: 1.5,      // 加工 - 中等难度
  manufacturing: 2.5,   // 制造 - 高难度
  service: 2.0,         // 服务 - 中高难度
  retail: 0.8,          // 零售 - 较低难度
};

/**
 * 基础人工成本（单位：分，100万 = 1000000分 = 1万元）
 */
export const BASE_LABOR_COST = 1000000; // 100万元

/**
 * 根据建筑规模的默认建造材料（仅作为后备，实际应使用每个建筑的自定义配置）
 */
export const CONSTRUCTION_MATERIALS_BY_SIZE: Record<BuildingDef['size'], ConstructionMaterial[]> = {
  small: [
    { goodsId: 'cement', amount: 100 },
    { goodsId: 'steel', amount: 50 },
  ],
  medium: [
    { goodsId: 'cement', amount: 300 },
    { goodsId: 'steel', amount: 150 },
    { goodsId: 'glass', amount: 100 },
  ],
  large: [
    { goodsId: 'cement', amount: 600 },
    { goodsId: 'steel', amount: 300 },
    { goodsId: 'glass', amount: 200 },
    { goodsId: 'aluminum', amount: 100 },
  ],
  huge: [
    { goodsId: 'cement', amount: 1200 },
    { goodsId: 'steel', amount: 600 },
    { goodsId: 'glass', amount: 400 },
    { goodsId: 'aluminum', amount: 200 },
  ],
};

/**
 * 获取建筑的建造时间（优先使用自定义值，否则使用规模默认值）
 */
export function getConstructionTime(building: BuildingDef): number {
  return building.constructionTime ?? CONSTRUCTION_TIME_BY_SIZE[building.size];
}

/**
 * 获取建筑的建造材料需求（优先使用自定义值，否则使用规模默认值）
 */
export function getConstructionMaterials(building: BuildingDef): ConstructionMaterial[] {
  return building.constructionMaterials ?? CONSTRUCTION_MATERIALS_BY_SIZE[building.size];
}

/**
 * 计算建筑的劳动力成本
 * 公式: baseLaborCost × sizeFactor × complexityFactor
 */
export function calculateLaborCost(building: BuildingDef): number {
  const sizeFactor = LABOR_SIZE_FACTOR[building.size];
  const complexityFactor = building.laborComplexityFactor ?? LABOR_CATEGORY_FACTOR[building.category] ?? 1.0;
  return Math.round(BASE_LABOR_COST * sizeFactor * complexityFactor);
}

/**
 * 建造成本计算结果
 */
export interface ConstructionCostResult {
  /** 材料总成本（分） */
  materialCost: number;
  /** 人工成本（分） */
  laborCost: number;
  /** 总成本（分） */
  totalCost: number;
  /** 材料明细 */
  materialDetails: Array<{
    goodsId: string;
    amount: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

/**
 * 计算建筑的建造总成本
 * @param building 建筑定义
 * @param marketPrices 市场价格表（goodsId => 单价，单位：分）
 * @returns 建造成本详情
 */
export function calculateConstructionCost(
  building: BuildingDef,
  marketPrices: Record<string, number>
): ConstructionCostResult {
  const materials = getConstructionMaterials(building);
  const materialDetails: ConstructionCostResult['materialDetails'] = [];
  let materialCost = 0;

  for (const mat of materials) {
    const unitPrice = marketPrices[mat.goodsId] ?? 0;
    const subtotal = Math.round(mat.amount * unitPrice);
    materialDetails.push({
      goodsId: mat.goodsId,
      amount: mat.amount,
      unitPrice,
      subtotal,
    });
    materialCost += subtotal;
  }

  const laborCost = calculateLaborCost(building);
  const totalCost = materialCost + laborCost;

  return {
    materialCost,
    laborCost,
    totalCost,
    materialDetails,
  };
}

// ============ 建筑定义配置 ============

/**
 * 建筑定义配置
 * 格式: { [建筑ID]: BuildingDefinition }
 */
export const BUILDING_DEFINITIONS: Record<string, BuildingDef> = {
  // ============ 资源开采类 (Extraction) ============
  
  'iron-mine': {
    nameZh: '铁矿场',
    name: 'Iron Mine',
    category: 'extraction',
    subcategory: '矿产开采',
    description: '开采铁矿石，钢铁工业的源头',
    icon: '⛏️',
    size: 'large',
    baseCost: 50000000,
    maintenanceCost: 100000,
    maxWorkers: 200,
    templateId: 'EXTRACTION',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2000 },      // 矿井巷道加固
      { goodsId: 'steel', amount: 1500 },       // 矿井支撑、提升设备
      { goodsId: 'mechanical-parts', amount: 200 }, // 采矿机械
      { goodsId: 'electric-motor', amount: 20 }, // 提升机、传送带
      { goodsId: 'copper', amount: 100 },       // 电气布线
      { goodsId: 'glass', amount: 50 },         // 控制室
    ],
    productionSlots: [
      {
        type: 'process',
        name: '开采工艺',
        defaultMethodId: 'basic-mining',
        methods: [
          {
            id: 'basic-mining',
            nameZh: '基础开采',
            name: 'Basic Mining',
            description: '传统采矿方式',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'iron-ore', amount: 100 }],
              ticksRequired: 1,
            },
            laborRequired: 100,
            powerRequired: 50,
            efficiency: 1.0,
          },
          {
            id: 'mechanized-mining',
            nameZh: '机械化开采',
            name: 'Mechanized Mining',
            description: '使用大型采矿设备',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'iron-ore', amount: 200 }],
              ticksRequired: 1,
            },
            laborRequired: 50,
            powerRequired: 150,
            efficiency: 1.5,
          },
          {
            id: 'automated-mining',
            nameZh: '自动化开采',
            name: 'Automated Mining',
            description: 'AI控制的全自动采矿',
            recipe: {
              inputs: [{ goodsId: 'computing-power', amount: 10 }],
              outputs: [{ goodsId: 'iron-ore', amount: 350 }],
              ticksRequired: 1,
            },
            laborRequired: 20,
            powerRequired: 300,
            efficiency: 2.0,
          },
        ],
      },
    ],
  },

  'copper-mine': {
    nameZh: '铜矿场',
    name: 'Copper Mine',
    category: 'extraction',
    subcategory: '矿产开采',
    description: '开采铜矿石，电子工业的基础',
    icon: '🟤',
    size: 'large',
    baseCost: 60000000,
    maintenanceCost: 120000,
    maxWorkers: 180,
    templateId: 'EXTRACTION',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2000 },
      { goodsId: 'steel', amount: 1500 },
      { goodsId: 'mechanical-parts', amount: 200 },
      { goodsId: 'electric-motor', amount: 20 },
      { goodsId: 'copper', amount: 100 },
      { goodsId: 'glass', amount: 50 },
    ],
    productionSlots: [
      {
        type: 'process',
        name: '开采工艺',
        defaultMethodId: 'basic-copper-mining',
        methods: [
          {
            id: 'basic-copper-mining',
            nameZh: '基础开采',
            name: 'Basic Mining',
            description: '传统采矿方式',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'copper-ore', amount: 80 }],
              ticksRequired: 1,
            },
            laborRequired: 100,
            powerRequired: 50,
            efficiency: 1.0,
          },
          {
            id: 'advanced-copper-mining',
            nameZh: '先进开采',
            name: 'Advanced Mining',
            description: '高效选矿技术',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'copper-ore', amount: 150 }],
              ticksRequired: 1,
            },
            laborRequired: 60,
            powerRequired: 120,
            efficiency: 1.5,
          },
        ],
      },
    ],
  },

  'rare-earth-mine': {
    nameZh: '稀土矿场',
    name: 'Rare Earth Mine',
    category: 'extraction',
    subcategory: '矿产开采',
    description: '开采稀土矿物，高科技产业命脉',
    icon: '💎',
    size: 'medium',
    baseCost: 200000000,
    maintenanceCost: 500000,
    maxWorkers: 150,
    templateId: 'EXTRACTION',
    constructionMaterials: [
      { goodsId: 'cement', amount: 800 },       // 特殊防腐蚀结构
      { goodsId: 'steel', amount: 600 },        // 耐腐蚀钢材
      { goodsId: 'chemicals', amount: 200 },    // 分离提取设备
      { goodsId: 'mechanical-parts', amount: 150 },
      { goodsId: 'sensors', amount: 50 },       // 精密检测设备
    ],
    productionSlots: [
      {
        type: 'process',
        name: '开采工艺',
        defaultMethodId: 'rare-earth-extraction',
        methods: [
          {
            id: 'rare-earth-extraction',
            nameZh: '标准提取',
            name: 'Standard Extraction',
            description: '复杂的稀土分离工艺',
            recipe: {
              inputs: [{ goodsId: 'chemicals', amount: 5 }],
              outputs: [{ goodsId: 'rare-earth', amount: 10 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 100,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'oil-field': {
    nameZh: '油田',
    name: 'Oil Field',
    category: 'extraction',
    subcategory: '能源开采',
    description: '开采原油，石化产业的源头',
    icon: '🛢️',
    size: 'huge',
    baseCost: 300000000,
    maintenanceCost: 800000,
    maxWorkers: 300,
    templateId: 'EXTRACTION',
    constructionMaterials: [
      { goodsId: 'cement', amount: 4000 },      // 钻井平台基础
      { goodsId: 'steel', amount: 3000 },       // 钻塔、管道
      { goodsId: 'mechanical-parts', amount: 400 }, // 钻井设备
      { goodsId: 'copper', amount: 200 },       // 电气系统
      { goodsId: 'sensors', amount: 100 },      // 监测系统
      { goodsId: 'chemicals', amount: 150 },    // 钻井液
    ],
    productionSlots: [
      {
        type: 'process',
        name: '开采工艺',
        defaultMethodId: 'standard-drilling',
        methods: [
          {
            id: 'standard-drilling',
            nameZh: '常规钻井',
            name: 'Standard Drilling',
            description: '传统石油开采',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'crude-oil', amount: 200 }],
              ticksRequired: 1,
            },
            laborRequired: 150,
            powerRequired: 200,
            efficiency: 1.0,
          },
          {
            id: 'enhanced-recovery',
            nameZh: '强化采油',
            name: 'Enhanced Oil Recovery',
            description: '注水/注气增产技术',
            recipe: {
              inputs: [{ goodsId: 'chemicals', amount: 10 }],
              outputs: [{ goodsId: 'crude-oil', amount: 400 }],
              ticksRequired: 1,
            },
            laborRequired: 100,
            powerRequired: 350,
            efficiency: 1.8,
          },
        ],
      },
    ],
  },

  'coal-mine': {
    nameZh: '煤矿',
    name: 'Coal Mine',
    category: 'extraction',
    subcategory: '矿产开采',
    description: '开采煤炭，传统能源和炼钢原料',
    icon: '⚫',
    size: 'large',
    baseCost: 40000000,
    maintenanceCost: 80000,
    maxWorkers: 250,
    templateId: 'EXTRACTION',
    constructionMaterials: [
      { goodsId: 'cement', amount: 1500 },      // 巷道支护
      { goodsId: 'steel', amount: 1200 },       // 支撑结构
      { goodsId: 'mechanical-parts', amount: 150 }, // 采煤机械
      { goodsId: 'electric-motor', amount: 15 }, // 传送带电机
    ],
    productionSlots: [
      {
        type: 'process',
        name: '开采工艺',
        defaultMethodId: 'underground-mining',
        methods: [
          {
            id: 'underground-mining',
            nameZh: '井下开采',
            name: 'Underground Mining',
            description: '传统煤矿开采',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'coal', amount: 300 }],
              ticksRequired: 1,
            },
            laborRequired: 200,
            powerRequired: 100,
            efficiency: 1.0,
          },
          {
            id: 'open-pit-mining',
            nameZh: '露天开采',
            name: 'Open Pit Mining',
            description: '大规模露天采矿',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'coal', amount: 600 }],
              ticksRequired: 1,
            },
            laborRequired: 100,
            powerRequired: 250,
            efficiency: 1.6,
          },
        ],
      },
    ],
  },

  'lithium-mine': {
    nameZh: '锂矿场',
    name: 'Lithium Mine',
    category: 'extraction',
    subcategory: '矿产开采',
    description: '开采锂矿，电池产业核心原料',
    icon: '🔋',
    size: 'medium',
    baseCost: 150000000,
    maintenanceCost: 400000,
    maxWorkers: 120,
    templateId: 'EXTRACTION',
    constructionMaterials: [
      { goodsId: 'cement', amount: 1000 },      // 蒸发池基础
      { goodsId: 'steel', amount: 800 },        // 管道系统
      { goodsId: 'chemicals', amount: 200 },    // 提锂化学品
      { goodsId: 'mechanical-parts', amount: 100 },
    ],
    productionSlots: [
      {
        type: 'process',
        name: '提取工艺',
        defaultMethodId: 'brine-extraction',
        methods: [
          {
            id: 'brine-extraction',
            nameZh: '盐湖提锂',
            name: 'Brine Extraction',
            description: '从盐湖卤水中提取锂',
            recipe: {
              inputs: [{ goodsId: 'chemicals', amount: 20 }],
              outputs: [{ goodsId: 'lithium', amount: 20 }],
              ticksRequired: 3,
            },
            laborRequired: 60,
            powerRequired: 150,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'natural-gas-well': {
    nameZh: '天然气井',
    name: 'Natural Gas Well',
    category: 'extraction',
    subcategory: '能源开采',
    description: '开采天然气，清洁能源和化工原料',
    icon: '💨',
    size: 'large',
    baseCost: 120000000,
    maintenanceCost: 250000,
    maxWorkers: 150,
    templateId: 'EXTRACTION',
    constructionMaterials: [
      { goodsId: 'cement', amount: 1500 },      // 井口基础
      { goodsId: 'steel', amount: 1200 },       // 管道、井架
      { goodsId: 'mechanical-parts', amount: 150 }, // 压缩设备
      { goodsId: 'sensors', amount: 80 },       // 压力监测
    ],
    productionSlots: [
      {
        type: 'process',
        name: '开采工艺',
        defaultMethodId: 'conventional-gas',
        methods: [
          {
            id: 'conventional-gas',
            nameZh: '常规开采',
            name: 'Conventional Extraction',
            description: '传统天然气开采',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'natural-gas', amount: 150 }],
              ticksRequired: 1,
            },
            laborRequired: 80,
            powerRequired: 100,
            efficiency: 1.0,
          },
          {
            id: 'shale-gas',
            nameZh: '页岩气开采',
            name: 'Shale Gas Extraction',
            description: '水力压裂技术开采页岩气',
            recipe: {
              inputs: [{ goodsId: 'chemicals', amount: 10 }],
              outputs: [{ goodsId: 'natural-gas', amount: 300 }],
              ticksRequired: 2,
            },
            laborRequired: 60,
            powerRequired: 200,
            efficiency: 1.5,
          },
        ],
      },
    ],
  },

  'silica-quarry': {
    nameZh: '硅砂矿',
    name: 'Silica Quarry',
    category: 'extraction',
    subcategory: '矿产开采',
    description: '开采硅砂，半导体和玻璃的原料',
    icon: '🏖️',
    size: 'medium',
    baseCost: 30000000,
    maintenanceCost: 60000,
    maxWorkers: 100,
    templateId: 'EXTRACTION',
    constructionMaterials: [
      { goodsId: 'cement', amount: 500 },       // 简单基础设施
      { goodsId: 'steel', amount: 400 },        // 筛分设备
      { goodsId: 'mechanical-parts', amount: 80 }, // 挖掘机械
    ],
    productionSlots: [
      {
        type: 'process',
        name: '开采工艺',
        defaultMethodId: 'open-pit-silica',
        methods: [
          {
            id: 'open-pit-silica',
            nameZh: '露天开采',
            name: 'Open Pit Mining',
            description: '露天硅砂矿开采',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'silica-sand', amount: 200 }],
              ticksRequired: 1,
            },
            laborRequired: 60,
            powerRequired: 80,
            efficiency: 1.0,
          },
          {
            id: 'refined-silica',
            nameZh: '精炼开采',
            name: 'Refined Silica Extraction',
            description: '高纯度硅砂开采',
            recipe: {
              inputs: [{ goodsId: 'chemicals', amount: 5 }],
              outputs: [{ goodsId: 'silica-sand', amount: 350 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 150,
            efficiency: 1.4,
          },
        ],
      },
    ],
  },

  'bauxite-mine': {
    nameZh: '铝土矿',
    name: 'Bauxite Mine',
    category: 'extraction',
    subcategory: '矿产开采',
    description: '开采铝土矿，铝金属的主要来源',
    icon: '⬜',
    size: 'large',
    baseCost: 70000000,
    maintenanceCost: 140000,
    maxWorkers: 200,
    templateId: 'EXTRACTION',
    constructionMaterials: [
      { goodsId: 'cement', amount: 1800 },      // 露天矿基础
      { goodsId: 'steel', amount: 1400 },       // 挖掘设备
      { goodsId: 'mechanical-parts', amount: 180 },
      { goodsId: 'electric-motor', amount: 18 },
    ],
    productionSlots: [
      {
        type: 'process',
        name: '开采工艺',
        defaultMethodId: 'surface-bauxite',
        methods: [
          {
            id: 'surface-bauxite',
            nameZh: '露天开采',
            name: 'Surface Mining',
            description: '露天铝土矿开采',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'bauxite', amount: 150 }],
              ticksRequired: 1,
            },
            laborRequired: 100,
            powerRequired: 80,
            efficiency: 1.0,
          },
          {
            id: 'mechanized-bauxite',
            nameZh: '机械化开采',
            name: 'Mechanized Mining',
            description: '大型机械化开采',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'bauxite', amount: 280 }],
              ticksRequired: 1,
            },
            laborRequired: 50,
            powerRequired: 180,
            efficiency: 1.5,
          },
        ],
      },
    ],
  },

  'rubber-plantation': {
    nameZh: '橡胶种植园',
    name: 'Rubber Plantation',
    category: 'agriculture',
    subcategory: '农林业',
    description: '种植橡胶树，生产天然橡胶',
    icon: '🌳',
    size: 'huge',
    baseCost: 80000000,
    maintenanceCost: 120000,
    maxWorkers: 150,
    templateId: 'AGRICULTURE',
    constructionMaterials: [
      { goodsId: 'cement', amount: 600 },       // 仓库、道路
      { goodsId: 'glass', amount: 200 },        // 育苗温室
      { goodsId: 'aluminum', amount: 50 },      // 灌溉系统
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'traditional-tapping',
        methods: [
          {
            id: 'traditional-tapping',
            nameZh: '传统割胶',
            name: 'Traditional Tapping',
            description: '传统人工割胶方式',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'rubber', amount: 50 }],
              ticksRequired: 2,
            },
            laborRequired: 120,
            powerRequired: 20,
            efficiency: 1.0,
          },
          {
            id: 'intensive-tapping',
            nameZh: '高产割胶',
            name: 'Intensive Tapping',
            description: '科学化高产割胶',
            recipe: {
              inputs: [{ goodsId: 'chemicals', amount: 5 }],
              outputs: [{ goodsId: 'rubber', amount: 100 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 50,
            efficiency: 1.6,
          },
        ],
      },
    ],
  },

  // ============ 基础加工类 (Processing) ============

  'steel-mill': {
    nameZh: '钢铁厂',
    name: 'Steel Mill',
    category: 'processing',
    subcategory: '金属冶炼',
    description: '将铁矿石冶炼成钢材',
    icon: '🏭',
    size: 'huge',
    baseCost: 200000000,
    maintenanceCost: 500000,
    maxWorkers: 500,
    templateId: 'PROCESSING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 8000 },      // 高炉基础
      { goodsId: 'steel', amount: 500 },        // 初始钢材（引导阶段）
      { goodsId: 'copper', amount: 400 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 500 }, // 轧钢机械
      { goodsId: 'electric-motor', amount: 40 }, // 大型电机
      { goodsId: 'sensors', amount: 100 },      // 温控监测
    ],
    productionSlots: [
      {
        type: 'process',
        name: '冶炼工艺',
        defaultMethodId: 'blast-furnace',
        methods: [
          {
            id: 'blast-furnace',
            nameZh: '高炉炼钢',
            name: 'Blast Furnace',
            description: '传统高炉冶炼工艺',
            recipe: {
              inputs: [
                { goodsId: 'iron-ore', amount: 100 },
                { goodsId: 'coal', amount: 50 },
              ],
              outputs: [{ goodsId: 'steel', amount: 60 }],
              ticksRequired: 2,
            },
            laborRequired: 200,
            powerRequired: 300,
            efficiency: 1.0,
          },
          {
            id: 'electric-arc-furnace',
            nameZh: '电弧炉炼钢',
            name: 'Electric Arc Furnace',
            description: '现代电炉炼钢，更环保',
            recipe: {
              inputs: [
                { goodsId: 'iron-ore', amount: 80 },
                { goodsId: 'electricity', amount: 100 },
              ],
              outputs: [{ goodsId: 'steel', amount: 70 }],
              ticksRequired: 1,
            },
            laborRequired: 100,
            powerRequired: 500,
            efficiency: 1.4,
          },
        ],
      },
    ],
  },

  'refinery': {
    nameZh: '炼油厂',
    name: 'Oil Refinery',
    category: 'processing',
    subcategory: '石油化工',
    description: '将原油精炼成燃油和化工原料',
    icon: '⛽',
    size: 'huge',
    baseCost: 500000000,
    maintenanceCost: 1000000,
    maxWorkers: 400,
    templateId: 'PROCESSING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 10000 },     // 储罐基础
      { goodsId: 'steel', amount: 8000 },       // 蒸馏塔、管道
      { goodsId: 'copper', amount: 500 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 600 }, // 泵、阀门
      { goodsId: 'sensors', amount: 200 },      // 安全监控
      { goodsId: 'chemicals', amount: 300 },    // 催化剂
    ],
    productionSlots: [
      {
        type: 'process',
        name: '精炼工艺',
        defaultMethodId: 'catalytic-cracking',
        methods: [
          {
            id: 'simple-distillation',
            nameZh: '简单蒸馏',
            name: 'Simple Distillation',
            description: '基础原油分馏',
            recipe: {
              inputs: [{ goodsId: 'crude-oil', amount: 100 }],
              outputs: [
                { goodsId: 'refined-fuel', amount: 40 },
                { goodsId: 'chemicals', amount: 20 },
              ],
              ticksRequired: 2,
            },
            laborRequired: 100,
            powerRequired: 200,
            efficiency: 1.0,
          },
          {
            id: 'catalytic-cracking',
            nameZh: '催化裂化',
            name: 'Catalytic Cracking',
            description: '深度加工，产出更多',
            recipe: {
              inputs: [{ goodsId: 'crude-oil', amount: 100 }],
              outputs: [
                { goodsId: 'refined-fuel', amount: 50 },
                { goodsId: 'plastic', amount: 30 },
                { goodsId: 'chemicals', amount: 25 },
              ],
              ticksRequired: 3,
            },
            laborRequired: 80,
            powerRequired: 350,
            efficiency: 1.5,
          },
        ],
      },
    ],
  },

  // ============ 更多加工类 (Processing) ============

  'copper-smelter': {
    nameZh: '铜冶炼厂',
    name: 'Copper Smelter',
    category: 'processing',
    subcategory: '金属冶炼',
    description: '将铜矿石冶炼成精铜',
    icon: '🟠',
    size: 'large',
    baseCost: 100000000,
    maintenanceCost: 250000,
    maxWorkers: 200,
    templateId: 'PROCESSING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 3000 },      // 电解槽基础
      { goodsId: 'steel', amount: 2000 },       // 结构框架
      { goodsId: 'copper', amount: 300 },       // 电极、电缆
      { goodsId: 'chemicals', amount: 200 },    // 电解液
      { goodsId: 'mechanical-parts', amount: 200 },
    ],
    productionSlots: [
      {
        type: 'process',
        name: '冶炼工艺',
        defaultMethodId: 'electrolytic-refining',
        methods: [
          {
            id: 'electrolytic-refining',
            nameZh: '电解精炼',
            name: 'Electrolytic Refining',
            description: '高纯度电解铜',
            recipe: {
              inputs: [{ goodsId: 'copper-ore', amount: 100 }],
              outputs: [{ goodsId: 'copper', amount: 50 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 250,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'silicon-plant': {
    nameZh: '硅材加工厂',
    name: 'Silicon Processing Plant',
    category: 'processing',
    subcategory: '电子材料',
    description: '将硅砂加工成硅晶圆',
    icon: '💿',
    size: 'large',
    baseCost: 300000000,
    maintenanceCost: 600000,
    maxWorkers: 300,
    templateId: 'PROCESSING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2500 },      // 洁净室基础
      { goodsId: 'steel', amount: 1500 },       // 结构框架
      { goodsId: 'glass', amount: 400 },        // 洁净室隔断
      { goodsId: 'aluminum', amount: 300 },     // 洁净室系统
      { goodsId: 'sensors', amount: 150 },      // 环境监控
      { goodsId: 'pcb', amount: 50 },           // 控制系统
    ],
    productionSlots: [
      {
        type: 'process',
        name: '加工工艺',
        defaultMethodId: 'czochralski-process',
        methods: [
          {
            id: 'czochralski-process',
            nameZh: '直拉法',
            name: 'Czochralski Process',
            description: '标准晶圆生产工艺',
            recipe: {
              inputs: [
                { goodsId: 'silica-sand', amount: 50 },
                { goodsId: 'chemicals', amount: 20 },
              ],
              outputs: [{ goodsId: 'silicon-wafer', amount: 10 }],
              ticksRequired: 4,
            },
            laborRequired: 150,
            powerRequired: 400,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'chemical-plant': {
    nameZh: '化工厂',
    name: 'Chemical Plant',
    category: 'processing',
    subcategory: '化学工业',
    description: '生产各类化工原料',
    icon: '🧪',
    size: 'large',
    baseCost: 150000000,
    maintenanceCost: 400000,
    maxWorkers: 250,
    templateId: 'PROCESSING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 3000 },      // 反应釜基础
      { goodsId: 'steel', amount: 2500 },       // 耐腐蚀容器
      { goodsId: 'copper', amount: 200 },       // 管道
      { goodsId: 'mechanical-parts', amount: 250 },
      { goodsId: 'sensors', amount: 120 },      // 安全监控
    ],
    productionSlots: [
      {
        type: 'process',
        name: '化工工艺',
        defaultMethodId: 'basic-chemicals',
        methods: [
          {
            id: 'basic-chemicals',
            nameZh: '基础化工',
            name: 'Basic Chemicals',
            description: '生产通用化工原料',
            recipe: {
              inputs: [
                { goodsId: 'crude-oil', amount: 30 },
                { goodsId: 'natural-gas', amount: 20 },
              ],
              outputs: [{ goodsId: 'chemicals', amount: 50 }],
              ticksRequired: 2,
            },
            laborRequired: 100,
            powerRequired: 200,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'aluminum-smelter': {
    nameZh: '铝冶炼厂',
    name: 'Aluminum Smelter',
    category: 'processing',
    subcategory: '金属冶炼',
    description: '将铝土矿冶炼成铝材',
    icon: '🪙',
    size: 'large',
    baseCost: 180000000,
    maintenanceCost: 400000,
    maxWorkers: 300,
    templateId: 'PROCESSING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 4000 },      // 电解槽基础
      { goodsId: 'steel', amount: 3000 },       // 结构框架
      { goodsId: 'copper', amount: 500 },       // 大功率电缆
      { goodsId: 'mechanical-parts', amount: 300 },
      { goodsId: 'electric-motor', amount: 30 },
    ],
    productionSlots: [
      {
        type: 'process',
        name: '冶炼工艺',
        defaultMethodId: 'hall-heroult',
        methods: [
          {
            id: 'hall-heroult',
            nameZh: '霍尔-埃鲁法',
            name: 'Hall-Héroult Process',
            description: '电解铝冶炼工艺',
            recipe: {
              inputs: [
                { goodsId: 'bauxite', amount: 100 },
                { goodsId: 'electricity', amount: 150 },
              ],
              outputs: [{ goodsId: 'aluminum', amount: 40 }],
              ticksRequired: 2,
            },
            laborRequired: 120,
            powerRequired: 400,
            efficiency: 1.0,
          },
          {
            id: 'inert-anode',
            nameZh: '惰性阳极法',
            name: 'Inert Anode Process',
            description: '新型环保冶炼工艺',
            recipe: {
              inputs: [
                { goodsId: 'bauxite', amount: 80 },
                { goodsId: 'electricity', amount: 120 },
              ],
              outputs: [{ goodsId: 'aluminum', amount: 50 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 350,
            efficiency: 1.4,
          },
        ],
      },
    ],
  },

  'glass-factory': {
    nameZh: '玻璃厂',
    name: 'Glass Factory',
    category: 'processing',
    subcategory: '建筑材料',
    description: '生产工业玻璃',
    icon: '🪟',
    size: 'medium',
    baseCost: 80000000,
    maintenanceCost: 180000,
    maxWorkers: 200,
    templateId: 'PROCESSING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 1500 },      // 熔炉基础
      { goodsId: 'steel', amount: 1000 },       // 结构框架
      { goodsId: 'mechanical-parts', amount: 150 },
      { goodsId: 'sensors', amount: 60 },       // 温控系统
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'float-glass',
        methods: [
          {
            id: 'float-glass',
            nameZh: '浮法玻璃',
            name: 'Float Glass Process',
            description: '标准平板玻璃生产',
            recipe: {
              inputs: [
                { goodsId: 'silica-sand', amount: 80 },
                { goodsId: 'chemicals', amount: 10 },
              ],
              outputs: [{ goodsId: 'glass', amount: 60 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 200,
            efficiency: 1.0,
          },
          {
            id: 'tempered-glass',
            nameZh: '钢化玻璃',
            name: 'Tempered Glass Process',
            description: '高强度钢化玻璃生产',
            recipe: {
              inputs: [
                { goodsId: 'silica-sand', amount: 60 },
                { goodsId: 'chemicals', amount: 20 },
              ],
              outputs: [{ goodsId: 'glass', amount: 50 }],
              ticksRequired: 3,
            },
            laborRequired: 100,
            powerRequired: 300,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  'cement-plant': {
    nameZh: '水泥厂',
    name: 'Cement Plant',
    category: 'processing',
    subcategory: '建筑材料',
    description: '生产水泥，建筑业基础材料',
    icon: '🧱',
    size: 'large',
    baseCost: 100000000,
    maintenanceCost: 200000,
    maxWorkers: 250,
    templateId: 'PROCESSING',
    constructionMaterials: [
      { goodsId: 'steel', amount: 3000 },       // 回转窑结构
      { goodsId: 'mechanical-parts', amount: 300 }, // 研磨设备
      { goodsId: 'electric-motor', amount: 25 }, // 驱动电机
      { goodsId: 'copper', amount: 150 },       // 电气系统
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'dry-process',
        methods: [
          {
            id: 'dry-process',
            nameZh: '干法生产',
            name: 'Dry Process',
            description: '现代干法水泥生产',
            recipe: {
              inputs: [
                { goodsId: 'coal', amount: 30 },
                { goodsId: 'silica-sand', amount: 20 },
              ],
              outputs: [{ goodsId: 'cement', amount: 100 }],
              ticksRequired: 2,
            },
            laborRequired: 100,
            powerRequired: 250,
            efficiency: 1.0,
          },
          {
            id: 'low-carbon-cement',
            nameZh: '低碳水泥',
            name: 'Low Carbon Cement',
            description: '环保低碳水泥生产',
            recipe: {
              inputs: [
                { goodsId: 'coal', amount: 20 },
                { goodsId: 'silica-sand', amount: 30 },
                { goodsId: 'chemicals', amount: 10 },
              ],
              outputs: [{ goodsId: 'cement', amount: 120 }],
              ticksRequired: 3,
            },
            laborRequired: 80,
            powerRequired: 200,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  'plastic-factory': {
    nameZh: '塑料工厂',
    name: 'Plastics Factory',
    category: 'processing',
    subcategory: '石油化工',
    description: '将石化原料加工成塑料制品',
    icon: '🧴',
    size: 'large',
    baseCost: 120000000,
    maintenanceCost: 280000,
    maxWorkers: 300,
    templateId: 'PROCESSING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2500 },      // 厂房基础
      { goodsId: 'steel', amount: 2000 },       // 注塑机框架
      { goodsId: 'mechanical-parts', amount: 250 },
      { goodsId: 'electric-motor', amount: 20 },
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'basic-plastic',
        methods: [
          {
            id: 'basic-plastic',
            nameZh: '基础塑料生产',
            name: 'Basic Plastic Production',
            description: '通用塑料颗粒生产',
            recipe: {
              inputs: [
                { goodsId: 'crude-oil', amount: 40 },
                { goodsId: 'chemicals', amount: 15 },
              ],
              outputs: [{ goodsId: 'plastic', amount: 80 }],
              ticksRequired: 2,
            },
            laborRequired: 100,
            powerRequired: 200,
            efficiency: 1.0,
          },
          {
            id: 'advanced-plastic',
            nameZh: '高性能塑料',
            name: 'Advanced Plastic Production',
            description: '工程塑料和特种塑料',
            recipe: {
              inputs: [
                { goodsId: 'crude-oil', amount: 30 },
                { goodsId: 'chemicals', amount: 25 },
                { goodsId: 'natural-gas', amount: 10 },
              ],
              outputs: [{ goodsId: 'plastic', amount: 100 }],
              ticksRequired: 3,
            },
            laborRequired: 120,
            powerRequired: 280,
            efficiency: 1.3,
          },
          {
            id: 'recycled-plastic',
            nameZh: '再生塑料',
            name: 'Recycled Plastic',
            description: '环保再生塑料生产',
            recipe: {
              inputs: [
                { goodsId: 'chemicals', amount: 20 },
              ],
              outputs: [{ goodsId: 'plastic', amount: 60 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 150,
            efficiency: 0.9,
          },
        ],
      },
    ],
  },

  // ============ 高端制造类 (Manufacturing) ============

  'chip-fab': {
    nameZh: '芯片工厂',
    name: 'Semiconductor Fab',
    category: 'manufacturing',
    subcategory: '半导体制造',
    description: '生产半导体芯片',
    icon: '🔲',
    size: 'huge',
    baseCost: 2000000000,
    maintenanceCost: 5000000,
    maxWorkers: 1000,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 15000 },     // 超大洁净室基础
      { goodsId: 'steel', amount: 10000 },      // 结构框架
      { goodsId: 'glass', amount: 2000 },       // 洁净室隔断
      { goodsId: 'aluminum', amount: 1500 },    // 洁净室系统
      { goodsId: 'copper', amount: 1000 },      // 电气系统
      { goodsId: 'sensors', amount: 500 },      // 环境监控
      { goodsId: 'pcb', amount: 200 },          // 控制系统
      { goodsId: 'semiconductor-chip', amount: 100 }, // 自动化控制
    ],
    productionSlots: [
      {
        type: 'process',
        name: '制程工艺',
        defaultMethodId: 'mature-node',
        methods: [
          {
            id: 'mature-node',
            nameZh: '成熟制程',
            name: 'Mature Process Node',
            description: '28nm及以上制程芯片',
            recipe: {
              inputs: [
                { goodsId: 'silicon-wafer', amount: 10 },
                { goodsId: 'chemicals', amount: 30 },
                { goodsId: 'rare-earth', amount: 2 },
              ],
              outputs: [{ goodsId: 'semiconductor-chip', amount: 100 }],
              ticksRequired: 5,
            },
            laborRequired: 300,
            powerRequired: 800,
            efficiency: 1.0,
          },
          {
            id: 'advanced-node',
            nameZh: '先进制程',
            name: 'Advanced Process Node',
            description: '7nm及以下制程芯片',
            recipe: {
              inputs: [
                { goodsId: 'silicon-wafer', amount: 20 },
                { goodsId: 'chemicals', amount: 50 },
                { goodsId: 'rare-earth', amount: 5 },
                { goodsId: 'computing-power', amount: 50 },
              ],
              outputs: [{ goodsId: 'advanced-chip', amount: 50 }],
              ticksRequired: 8,
            },
            laborRequired: 500,
            powerRequired: 1500,
            efficiency: 0.8,
          },
        ],
      },
    ],
  },

  'battery-factory': {
    nameZh: '电池工厂',
    name: 'Battery Factory',
    category: 'manufacturing',
    subcategory: '新能源制造',
    description: '生产锂离子电池',
    icon: '🔋',
    size: 'large',
    baseCost: 500000000,
    maintenanceCost: 1000000,
    maxWorkers: 400,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 4000 },      // 厂房基础
      { goodsId: 'steel', amount: 3000 },       // 结构框架
      { goodsId: 'aluminum', amount: 500 },     // 洁净环境
      { goodsId: 'copper', amount: 400 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 300 }, // 自动化设备
      { goodsId: 'sensors', amount: 150 },      // 质量监控
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'lfp-cell',
        methods: [
          {
            id: 'lfp-cell',
            nameZh: '磷酸铁锂电芯',
            name: 'LFP Cell Production',
            description: '安全性高，成本较低',
            recipe: {
              inputs: [
                { goodsId: 'lithium', amount: 20 },
                { goodsId: 'chemicals', amount: 30 },
                { goodsId: 'aluminum', amount: 10 },
              ],
              outputs: [{ goodsId: 'battery-cell', amount: 50 }],
              ticksRequired: 3,
            },
            laborRequired: 150,
            powerRequired: 300,
            efficiency: 1.0,
          },
          {
            id: 'ncm-cell',
            nameZh: '三元锂电芯',
            name: 'NCM Cell Production',
            description: '能量密度高，性能强',
            recipe: {
              inputs: [
                { goodsId: 'lithium', amount: 30 },
                { goodsId: 'rare-earth', amount: 5 },
                { goodsId: 'chemicals', amount: 40 },
                { goodsId: 'copper', amount: 15 },
              ],
              outputs: [{ goodsId: 'battery-cell', amount: 40 }],
              ticksRequired: 4,
            },
            laborRequired: 200,
            powerRequired: 400,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  'ev-factory': {
    nameZh: '电动汽车工厂',
    name: 'Electric Vehicle Factory',
    category: 'manufacturing',
    subcategory: '汽车制造',
    description: '生产电动汽车',
    icon: '🚙',
    size: 'huge',
    baseCost: 1000000000,
    maintenanceCost: 3000000,
    maxWorkers: 2000,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 12000 },     // 巨型厂房基础
      { goodsId: 'steel', amount: 8000 },       // 结构框架
      { goodsId: 'aluminum', amount: 1000 },    // 轻量化结构
      { goodsId: 'copper', amount: 600 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 800 }, // 生产线设备
      { goodsId: 'electric-motor', amount: 60 }, // 机器人
      { goodsId: 'sensors', amount: 300 },      // 自动化监控
      { goodsId: 'pcb', amount: 100 },          // 控制系统
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产线',
        defaultMethodId: 'standard-ev',
        methods: [
          {
            id: 'standard-ev',
            nameZh: '标准电动车',
            name: 'Standard EV Production',
            description: '大众市场电动车',
            recipe: {
              inputs: [
                { goodsId: 'steel', amount: 50 },
                { goodsId: 'aluminum', amount: 30 },
                { goodsId: 'battery-pack', amount: 1 },
                { goodsId: 'electric-motor', amount: 1 },
                { goodsId: 'semiconductor-chip', amount: 20 },
                { goodsId: 'display-panel', amount: 2 },
              ],
              outputs: [{ goodsId: 'electric-vehicle', amount: 1 }],
              ticksRequired: 8,
            },
            laborRequired: 500,
            powerRequired: 600,
            efficiency: 1.0,
          },
          {
            id: 'premium-ev',
            nameZh: '豪华电动车',
            name: 'Premium EV Production',
            description: '高端市场电动车',
            recipe: {
              inputs: [
                { goodsId: 'steel', amount: 40 },
                { goodsId: 'aluminum', amount: 60 },
                { goodsId: 'battery-pack', amount: 2 },
                { goodsId: 'electric-motor', amount: 2 },
                { goodsId: 'advanced-chip', amount: 10 },
                { goodsId: 'display-panel', amount: 5 },
                { goodsId: 'sensors', amount: 20 },
              ],
              outputs: [{ goodsId: 'premium-ev', amount: 1 }],
              ticksRequired: 12,
            },
            laborRequired: 800,
            powerRequired: 1000,
            efficiency: 0.9,
          },
        ],
      },
    ],
  },

  'electronics-factory': {
    nameZh: '电子产品工厂',
    name: 'Electronics Factory',
    category: 'manufacturing',
    subcategory: '电子制造',
    description: '生产智能手机和电脑',
    icon: '📱',
    size: 'large',
    baseCost: 300000000,
    maintenanceCost: 800000,
    maxWorkers: 600,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 3000 },      // 厂房基础
      { goodsId: 'steel', amount: 2000 },       // 结构框架
      { goodsId: 'glass', amount: 500 },        // 洁净室
      { goodsId: 'aluminum', amount: 400 },     // 洁净环境
      { goodsId: 'copper', amount: 300 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 250 }, // 组装线
      { goodsId: 'sensors', amount: 100 },      // 质量检测
    ],
    productionSlots: [
      {
        type: 'process',
        name: '产品线',
        defaultMethodId: 'smartphone-line',
        methods: [
          {
            id: 'smartphone-line',
            nameZh: '智能手机产线',
            name: 'Smartphone Line',
            description: '大规模手机组装',
            recipe: {
              inputs: [
                { goodsId: 'semiconductor-chip', amount: 5 },
                { goodsId: 'display-panel', amount: 1 },
                { goodsId: 'battery-cell', amount: 1 },
                { goodsId: 'pcb', amount: 1 },
                { goodsId: 'glass', amount: 2 },
                { goodsId: 'aluminum', amount: 1 },
              ],
              outputs: [{ goodsId: 'smartphone', amount: 10 }],
              ticksRequired: 2,
            },
            laborRequired: 200,
            powerRequired: 150,
            efficiency: 1.0,
          },
          {
            id: 'premium-phone-line',
            nameZh: '高端手机产线',
            name: 'Premium Phone Line',
            description: '旗舰手机生产',
            recipe: {
              inputs: [
                { goodsId: 'advanced-chip', amount: 3 },
                { goodsId: 'display-panel', amount: 2 },
                { goodsId: 'battery-cell', amount: 2 },
                { goodsId: 'pcb', amount: 2 },
                { goodsId: 'sensors', amount: 5 },
              ],
              outputs: [{ goodsId: 'premium-smartphone', amount: 5 }],
              ticksRequired: 3,
            },
            laborRequired: 300,
            powerRequired: 200,
            efficiency: 0.9,
          },
          {
            id: 'pc-line',
            nameZh: '电脑产线',
            name: 'PC Production Line',
            description: '个人电脑组装',
            recipe: {
              inputs: [
                { goodsId: 'semiconductor-chip', amount: 10 },
                { goodsId: 'display-panel', amount: 1 },
                { goodsId: 'pcb', amount: 3 },
                { goodsId: 'plastic', amount: 5 },
                { goodsId: 'steel', amount: 3 },
              ],
              outputs: [{ goodsId: 'personal-computer', amount: 5 }],
              ticksRequired: 3,
            },
            laborRequired: 150,
            powerRequired: 180,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'display-factory': {
    nameZh: '显示面板工厂',
    name: 'Display Panel Factory',
    category: 'manufacturing',
    subcategory: '电子制造',
    description: '生产LCD/OLED显示面板',
    icon: '📺',
    size: 'huge',
    baseCost: 800000000,
    maintenanceCost: 2000000,
    maxWorkers: 500,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 10000 },     // 超大洁净室基础
      { goodsId: 'steel', amount: 6000 },       // 结构框架
      { goodsId: 'glass', amount: 1500 },       // 洁净室
      { goodsId: 'aluminum', amount: 1000 },    // 洁净系统
      { goodsId: 'copper', amount: 500 },       // 电气系统
      { goodsId: 'chemicals', amount: 300 },    // 初始化学品
      { goodsId: 'sensors', amount: 250 },      // 精密监控
    ],
    productionSlots: [
      {
        type: 'process',
        name: '面板类型',
        defaultMethodId: 'lcd-panel',
        methods: [
          {
            id: 'lcd-panel',
            nameZh: 'LCD面板',
            name: 'LCD Panel',
            description: '液晶显示面板',
            recipe: {
              inputs: [
                { goodsId: 'glass', amount: 20 },
                { goodsId: 'chemicals', amount: 15 },
                { goodsId: 'pcb', amount: 5 },
              ],
              outputs: [{ goodsId: 'display-panel', amount: 20 }],
              ticksRequired: 3,
            },
            laborRequired: 200,
            powerRequired: 400,
            efficiency: 1.0,
          },
          {
            id: 'oled-panel',
            nameZh: 'OLED面板',
            name: 'OLED Panel',
            description: '有机发光显示面板',
            recipe: {
              inputs: [
                { goodsId: 'glass', amount: 15 },
                { goodsId: 'chemicals', amount: 30 },
                { goodsId: 'rare-earth', amount: 3 },
                { goodsId: 'pcb', amount: 8 },
              ],
              outputs: [{ goodsId: 'display-panel', amount: 15 }],
              ticksRequired: 4,
            },
            laborRequired: 300,
            powerRequired: 600,
            efficiency: 1.5,
          },
        ],
      },
    ],
  },

  'battery-pack-factory': {
    nameZh: '电池组装厂',
    name: 'Battery Pack Assembly',
    category: 'manufacturing',
    subcategory: '新能源制造',
    description: '将电池电芯组装成电池组',
    icon: '🔌',
    size: 'large',
    baseCost: 300000000,
    maintenanceCost: 600000,
    maxWorkers: 300,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2500 },      // 厂房基础
      { goodsId: 'steel', amount: 1800 },       // 结构框架
      { goodsId: 'aluminum', amount: 400 },     // 洁净环境
      { goodsId: 'copper', amount: 300 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 200 }, // 组装线
      { goodsId: 'sensors', amount: 120 },      // 安全监控
    ],
    productionSlots: [
      {
        type: 'process',
        name: '组装工艺',
        defaultMethodId: 'standard-pack',
        methods: [
          {
            id: 'standard-pack',
            nameZh: '标准电池组',
            name: 'Standard Pack Assembly',
            description: '标准电池组组装',
            recipe: {
              inputs: [
                { goodsId: 'battery-cell', amount: 100 },
                { goodsId: 'pcb', amount: 5 },
                { goodsId: 'aluminum', amount: 20 },
              ],
              outputs: [{ goodsId: 'battery-pack', amount: 5 }],
              ticksRequired: 3,
            },
            laborRequired: 150,
            powerRequired: 200,
            efficiency: 1.0,
          },
          {
            id: 'high-density-pack',
            nameZh: '高密度电池组',
            name: 'High Density Pack',
            description: '高能量密度电池组',
            recipe: {
              inputs: [
                { goodsId: 'battery-cell', amount: 80 },
                { goodsId: 'pcb', amount: 8 },
                { goodsId: 'aluminum', amount: 15 },
                { goodsId: 'sensors', amount: 5 },
              ],
              outputs: [{ goodsId: 'battery-pack', amount: 6 }],
              ticksRequired: 4,
            },
            laborRequired: 200,
            powerRequired: 300,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  'pcb-factory': {
    nameZh: 'PCB工厂',
    name: 'PCB Factory',
    category: 'manufacturing',
    subcategory: '电子制造',
    description: '生产印刷电路板',
    icon: '📟',
    size: 'large',
    baseCost: 200000000,
    maintenanceCost: 450000,
    maxWorkers: 350,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2000 },      // 厂房基础
      { goodsId: 'steel', amount: 1500 },       // 结构框架
      { goodsId: 'glass', amount: 300 },        // 洁净区域
      { goodsId: 'copper', amount: 400 },       // 电镀设备用
      { goodsId: 'chemicals', amount: 200 },    // 化学处理
      { goodsId: 'mechanical-parts', amount: 180 },
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'standard-pcb',
        methods: [
          {
            id: 'standard-pcb',
            nameZh: '标准电路板',
            name: 'Standard PCB',
            description: '多层印刷电路板生产',
            recipe: {
              inputs: [
                { goodsId: 'copper', amount: 30 },
                { goodsId: 'chemicals', amount: 20 },
                { goodsId: 'glass', amount: 10 },
              ],
              outputs: [{ goodsId: 'pcb', amount: 50 }],
              ticksRequired: 2,
            },
            laborRequired: 150,
            powerRequired: 250,
            efficiency: 1.0,
          },
          {
            id: 'hdi-pcb',
            nameZh: '高密度互连板',
            name: 'HDI PCB',
            description: '高密度互连电路板',
            recipe: {
              inputs: [
                { goodsId: 'copper', amount: 25 },
                { goodsId: 'chemicals', amount: 35 },
                { goodsId: 'glass', amount: 15 },
              ],
              outputs: [{ goodsId: 'pcb', amount: 40 }],
              ticksRequired: 3,
            },
            laborRequired: 200,
            powerRequired: 350,
            efficiency: 1.4,
          },
        ],
      },
    ],
  },

  'engine-factory': {
    nameZh: '发动机厂',
    name: 'Engine Factory',
    category: 'manufacturing',
    subcategory: '机械制造',
    description: '生产内燃机发动机',
    icon: '⚙️',
    size: 'huge',
    baseCost: 400000000,
    maintenanceCost: 900000,
    maxWorkers: 600,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 6000 },      // 重型厂房基础
      { goodsId: 'steel', amount: 5000 },       // 结构框架
      { goodsId: 'aluminum', amount: 500 },     // 轻量化结构
      { goodsId: 'copper', amount: 350 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 500 }, // 机加工设备
      { goodsId: 'electric-motor', amount: 50 }, // 大型机床
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'standard-engine',
        methods: [
          {
            id: 'standard-engine',
            nameZh: '标准发动机',
            name: 'Standard Engine',
            description: '传统内燃机生产',
            recipe: {
              inputs: [
                { goodsId: 'steel', amount: 80 },
                { goodsId: 'aluminum', amount: 40 },
                { goodsId: 'mechanical-parts', amount: 50 },
              ],
              outputs: [{ goodsId: 'engine', amount: 10 }],
              ticksRequired: 4,
            },
            laborRequired: 300,
            powerRequired: 400,
            efficiency: 1.0,
          },
          {
            id: 'turbo-engine',
            nameZh: '涡轮发动机',
            name: 'Turbo Engine',
            description: '高性能涡轮增压发动机',
            recipe: {
              inputs: [
                { goodsId: 'steel', amount: 60 },
                { goodsId: 'aluminum', amount: 60 },
                { goodsId: 'mechanical-parts', amount: 70 },
                { goodsId: 'sensors', amount: 10 },
              ],
              outputs: [{ goodsId: 'engine', amount: 8 }],
              ticksRequired: 5,
            },
            laborRequired: 400,
            powerRequired: 500,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  'electric-motor-factory': {
    nameZh: '电机厂',
    name: 'Electric Motor Factory',
    category: 'manufacturing',
    subcategory: '机械制造',
    description: '生产电动机',
    icon: '🔄',
    size: 'large',
    baseCost: 250000000,
    maintenanceCost: 500000,
    maxWorkers: 400,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 3000 },      // 厂房基础
      { goodsId: 'steel', amount: 2500 },       // 结构框架
      { goodsId: 'copper', amount: 500 },       // 绕线设备
      { goodsId: 'mechanical-parts', amount: 300 }, // 加工设备
      { goodsId: 'electric-motor', amount: 30 }, // 测试设备
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'induction-motor',
        methods: [
          {
            id: 'induction-motor',
            nameZh: '感应电机',
            name: 'Induction Motor',
            description: '交流感应电机生产',
            recipe: {
              inputs: [
                { goodsId: 'copper', amount: 50 },
                { goodsId: 'steel', amount: 30 },
                { goodsId: 'rare-earth', amount: 5 },
              ],
              outputs: [{ goodsId: 'electric-motor', amount: 15 }],
              ticksRequired: 3,
            },
            laborRequired: 180,
            powerRequired: 300,
            efficiency: 1.0,
          },
          {
            id: 'permanent-magnet-motor',
            nameZh: '永磁电机',
            name: 'Permanent Magnet Motor',
            description: '高效永磁同步电机',
            recipe: {
              inputs: [
                { goodsId: 'copper', amount: 40 },
                { goodsId: 'steel', amount: 25 },
                { goodsId: 'rare-earth', amount: 15 },
              ],
              outputs: [{ goodsId: 'electric-motor', amount: 12 }],
              ticksRequired: 4,
            },
            laborRequired: 220,
            powerRequired: 350,
            efficiency: 1.5,
          },
        ],
      },
    ],
  },

  'mechanical-parts-factory': {
    nameZh: '机械加工厂',
    name: 'Mechanical Parts Factory',
    category: 'manufacturing',
    subcategory: '机械制造',
    description: '生产各类机械零件',
    icon: '🔧',
    size: 'large',
    baseCost: 120000000,
    maintenanceCost: 280000,
    maxWorkers: 350,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2500 },      // 厂房基础
      { goodsId: 'steel', amount: 2000 },       // 结构框架
      { goodsId: 'copper', amount: 200 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 200 }, // CNC机床
      { goodsId: 'electric-motor', amount: 25 }, // 驱动电机
    ],
    productionSlots: [
      {
        type: 'process',
        name: '加工工艺',
        defaultMethodId: 'cnc-machining',
        methods: [
          {
            id: 'cnc-machining',
            nameZh: 'CNC加工',
            name: 'CNC Machining',
            description: '数控机床加工',
            recipe: {
              inputs: [
                { goodsId: 'steel', amount: 50 },
                { goodsId: 'aluminum', amount: 20 },
              ],
              outputs: [{ goodsId: 'mechanical-parts', amount: 80 }],
              ticksRequired: 2,
            },
            laborRequired: 120,
            powerRequired: 250,
            efficiency: 1.0,
          },
          {
            id: 'precision-machining',
            nameZh: '精密加工',
            name: 'Precision Machining',
            description: '高精度零件加工',
            recipe: {
              inputs: [
                { goodsId: 'steel', amount: 40 },
                { goodsId: 'aluminum', amount: 25 },
                { goodsId: 'computing-power', amount: 10 },
              ],
              outputs: [{ goodsId: 'mechanical-parts', amount: 100 }],
              ticksRequired: 3,
            },
            laborRequired: 150,
            powerRequired: 350,
            efficiency: 1.4,
          },
        ],
      },
    ],
  },

  'auto-parts-factory': {
    nameZh: '汽车零部件厂',
    name: 'Auto Parts Factory',
    category: 'manufacturing',
    subcategory: '汽车制造',
    description: '生产汽车零部件',
    icon: '🚗',
    size: 'large',
    baseCost: 200000000,
    maintenanceCost: 450000,
    maxWorkers: 500,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 3000 },      // 厂房基础
      { goodsId: 'steel', amount: 2500 },       // 结构框架
      { goodsId: 'aluminum', amount: 300 },     // 轻量化结构
      { goodsId: 'copper', amount: 250 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 300 }, // 生产设备
      { goodsId: 'rubber', amount: 100 },       // 密封材料
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'standard-parts',
        methods: [
          {
            id: 'standard-parts',
            nameZh: '标准零部件',
            name: 'Standard Auto Parts',
            description: '常规汽车零部件生产',
            recipe: {
              inputs: [
                { goodsId: 'mechanical-parts', amount: 50 },
                { goodsId: 'rubber', amount: 30 },
                { goodsId: 'plastic', amount: 40 },
              ],
              outputs: [{ goodsId: 'auto-parts', amount: 40 }],
              ticksRequired: 2,
            },
            laborRequired: 200,
            powerRequired: 300,
            efficiency: 1.0,
          },
          {
            id: 'precision-parts',
            nameZh: '精密零部件',
            name: 'Precision Auto Parts',
            description: '高精度汽车零部件',
            recipe: {
              inputs: [
                { goodsId: 'mechanical-parts', amount: 40 },
                { goodsId: 'rubber', amount: 25 },
                { goodsId: 'plastic', amount: 30 },
                { goodsId: 'sensors', amount: 10 },
              ],
              outputs: [{ goodsId: 'auto-parts', amount: 35 }],
              ticksRequired: 3,
            },
            laborRequired: 250,
            powerRequired: 400,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  'sensor-factory': {
    nameZh: '传感器厂',
    name: 'Sensor Factory',
    category: 'manufacturing',
    subcategory: '电子制造',
    description: '生产各类传感器',
    icon: '📡',
    size: 'medium',
    baseCost: 350000000,
    maintenanceCost: 700000,
    maxWorkers: 300,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 1500 },      // 洁净室基础
      { goodsId: 'steel', amount: 1000 },       // 结构框架
      { goodsId: 'glass', amount: 400 },        // 洁净室
      { goodsId: 'aluminum', amount: 300 },     // 洁净系统
      { goodsId: 'copper', amount: 200 },       // 电气系统
      { goodsId: 'sensors', amount: 80 },       // 校准设备
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产工艺',
        defaultMethodId: 'mems-sensor',
        methods: [
          {
            id: 'mems-sensor',
            nameZh: 'MEMS传感器',
            name: 'MEMS Sensor',
            description: '微机电系统传感器',
            recipe: {
              inputs: [
                { goodsId: 'silicon-wafer', amount: 5 },
                { goodsId: 'pcb', amount: 10 },
                { goodsId: 'chemicals', amount: 15 },
              ],
              outputs: [{ goodsId: 'sensors', amount: 50 }],
              ticksRequired: 3,
            },
            laborRequired: 150,
            powerRequired: 300,
            efficiency: 1.0,
          },
          {
            id: 'smart-sensor',
            nameZh: '智能传感器',
            name: 'Smart Sensor',
            description: '带处理芯片的智能传感器',
            recipe: {
              inputs: [
                { goodsId: 'silicon-wafer', amount: 8 },
                { goodsId: 'pcb', amount: 15 },
                { goodsId: 'semiconductor-chip', amount: 5 },
              ],
              outputs: [{ goodsId: 'sensors', amount: 40 }],
              ticksRequired: 4,
            },
            laborRequired: 200,
            powerRequired: 400,
            efficiency: 1.4,
          },
        ],
      },
    ],
  },

  'tv-factory': {
    nameZh: '电视机工厂',
    name: 'Television Factory',
    category: 'manufacturing',
    subcategory: '电子制造',
    description: '生产智能电视',
    icon: '📺',
    size: 'large',
    baseCost: 250000000,
    maintenanceCost: 500000,
    maxWorkers: 400,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2500 },      // 厂房基础
      { goodsId: 'steel', amount: 1800 },       // 结构框架
      { goodsId: 'glass', amount: 300 },        // 洁净区域
      { goodsId: 'aluminum', amount: 250 },     // 轻量化结构
      { goodsId: 'copper', amount: 200 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 200 }, // 组装线
    ],
    productionSlots: [
      {
        type: 'process',
        name: '产品线',
        defaultMethodId: 'standard-tv',
        methods: [
          {
            id: 'standard-tv',
            nameZh: '标准智能电视',
            name: 'Standard Smart TV',
            description: '大众市场智能电视',
            recipe: {
              inputs: [
                { goodsId: 'display-panel', amount: 10 },
                { goodsId: 'semiconductor-chip', amount: 8 },
                { goodsId: 'pcb', amount: 5 },
                { goodsId: 'plastic', amount: 20 },
              ],
              outputs: [{ goodsId: 'smart-tv', amount: 10 }],
              ticksRequired: 3,
            },
            laborRequired: 180,
            powerRequired: 250,
            efficiency: 1.0,
          },
          {
            id: 'premium-tv',
            nameZh: '高端智能电视',
            name: 'Premium Smart TV',
            description: '高端4K/8K智能电视',
            recipe: {
              inputs: [
                { goodsId: 'display-panel', amount: 8 },
                { goodsId: 'advanced-chip', amount: 3 },
                { goodsId: 'pcb', amount: 8 },
                { goodsId: 'aluminum', amount: 10 },
              ],
              outputs: [{ goodsId: 'smart-tv', amount: 5 }],
              ticksRequired: 4,
            },
            laborRequired: 220,
            powerRequired: 350,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  'gasoline-car-factory': {
    nameZh: '燃油汽车工厂',
    name: 'Gasoline Car Factory',
    category: 'manufacturing',
    subcategory: '汽车制造',
    description: '生产燃油汽车',
    icon: '🚗',
    size: 'huge',
    baseCost: 800000000,
    maintenanceCost: 2500000,
    maxWorkers: 1800,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 10000 },     // 巨型厂房基础
      { goodsId: 'steel', amount: 7000 },       // 结构框架
      { goodsId: 'aluminum', amount: 800 },     // 轻量化结构
      { goodsId: 'copper', amount: 500 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 700 }, // 生产线设备
      { goodsId: 'electric-motor', amount: 50 }, // 机器人
      { goodsId: 'sensors', amount: 200 },      // 自动化监控
    ],
    productionSlots: [
      {
        type: 'process',
        name: '生产线',
        defaultMethodId: 'standard-gasoline',
        methods: [
          {
            id: 'standard-gasoline',
            nameZh: '标准燃油车',
            name: 'Standard Gasoline Car',
            description: '大众市场燃油汽车',
            recipe: {
              inputs: [
                { goodsId: 'steel', amount: 80 },
                { goodsId: 'aluminum', amount: 30 },
                { goodsId: 'engine', amount: 1 },
                { goodsId: 'auto-parts', amount: 50 },
                { goodsId: 'semiconductor-chip', amount: 10 },
                { goodsId: 'rubber', amount: 20 },
              ],
              outputs: [{ goodsId: 'gasoline-car', amount: 1 }],
              ticksRequired: 6,
            },
            laborRequired: 450,
            powerRequired: 500,
            efficiency: 1.0,
          },
          {
            id: 'luxury-gasoline',
            nameZh: '豪华燃油车',
            name: 'Luxury Gasoline Car',
            description: '高端市场燃油汽车',
            recipe: {
              inputs: [
                { goodsId: 'steel', amount: 60 },
                { goodsId: 'aluminum', amount: 70 },
                { goodsId: 'engine', amount: 1 },
                { goodsId: 'auto-parts', amount: 80 },
                { goodsId: 'semiconductor-chip', amount: 25 },
                { goodsId: 'rubber', amount: 25 },
                { goodsId: 'display-panel', amount: 3 },
              ],
              outputs: [{ goodsId: 'gasoline-car', amount: 1 }],
              ticksRequired: 10,
            },
            laborRequired: 600,
            powerRequired: 700,
            efficiency: 0.9,
          },
        ],
      },
    ],
  },

  'appliance-factory': {
    nameZh: '家电工厂',
    name: 'Home Appliance Factory',
    category: 'manufacturing',
    subcategory: '电子制造',
    description: '生产家用电器和消费电子',
    icon: '🏠',
    size: 'large',
    baseCost: 180000000,
    maintenanceCost: 400000,
    maxWorkers: 450,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2500 },      // 厂房基础
      { goodsId: 'steel', amount: 2000 },       // 结构框架
      { goodsId: 'copper', amount: 250 },       // 电气系统
      { goodsId: 'mechanical-parts', amount: 250 }, // 组装线
      { goodsId: 'electric-motor', amount: 20 }, // 生产设备
    ],
    productionSlots: [
      {
        type: 'process',
        name: '产品线',
        defaultMethodId: 'home-appliance-line',
        methods: [
          {
            id: 'home-appliance-line',
            nameZh: '家电产线',
            name: 'Home Appliance Line',
            description: '生产冰箱、洗衣机等',
            recipe: {
              inputs: [
                { goodsId: 'steel', amount: 30 },
                { goodsId: 'plastic', amount: 40 },
                { goodsId: 'electric-motor', amount: 5 },
                { goodsId: 'pcb', amount: 5 },
              ],
              outputs: [{ goodsId: 'home-appliance', amount: 20 }],
              ticksRequired: 3,
            },
            laborRequired: 200,
            powerRequired: 280,
            efficiency: 1.0,
          },
          {
            id: 'gaming-console-line',
            nameZh: '游戏主机产线',
            name: 'Gaming Console Line',
            description: '生产游戏主机',
            recipe: {
              inputs: [
                { goodsId: 'advanced-chip', amount: 2 },
                { goodsId: 'pcb', amount: 3 },
                { goodsId: 'plastic', amount: 15 },
                { goodsId: 'semiconductor-chip', amount: 5 },
              ],
              outputs: [{ goodsId: 'gaming-console', amount: 10 }],
              ticksRequired: 3,
            },
            laborRequired: 150,
            powerRequired: 200,
            efficiency: 1.0,
          },
          {
            id: 'vr-headset-line',
            nameZh: 'VR头显产线',
            name: 'VR Headset Line',
            description: '生产VR设备',
            recipe: {
              inputs: [
                { goodsId: 'display-panel', amount: 2 },
                { goodsId: 'sensors', amount: 10 },
                { goodsId: 'advanced-chip', amount: 1 },
                { goodsId: 'plastic', amount: 10 },
              ],
              outputs: [{ goodsId: 'vr-headset', amount: 8 }],
              ticksRequired: 4,
            },
            laborRequired: 180,
            powerRequired: 250,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'household-goods-factory': {
    nameZh: '日用品工厂',
    name: 'Household Goods Factory',
    category: 'manufacturing',
    subcategory: '轻工业',
    description: '生产日用消费品',
    icon: '🧴',
    size: 'medium',
    baseCost: 60000000,
    maintenanceCost: 120000,
    maxWorkers: 250,
    templateId: 'MANUFACTURING',
    constructionMaterials: [
      { goodsId: 'cement', amount: 1000 },      // 厂房基础
      { goodsId: 'steel', amount: 800 },        // 结构框架
      { goodsId: 'plastic', amount: 200 },      // 模具材料
      { goodsId: 'mechanical-parts', amount: 150 }, // 生产线
    ],
    productionSlots: [
      {
        type: 'process',
        name: '产品线',
        defaultMethodId: 'basic-household',
        methods: [
          {
            id: 'basic-household',
            nameZh: '基础日用品',
            name: 'Basic Household Goods',
            description: '生产清洁用品、纸品等',
            recipe: {
              inputs: [
                { goodsId: 'chemicals', amount: 30 },
                { goodsId: 'plastic', amount: 40 },
              ],
              outputs: [{ goodsId: 'household-goods', amount: 100 }],
              ticksRequired: 2,
            },
            laborRequired: 120,
            powerRequired: 150,
            efficiency: 1.0,
          },
          {
            id: 'premium-household',
            nameZh: '高端日用品',
            name: 'Premium Household Goods',
            description: '生产高端护理产品',
            recipe: {
              inputs: [
                { goodsId: 'chemicals', amount: 50 },
                { goodsId: 'plastic', amount: 30 },
                { goodsId: 'glass', amount: 20 },
              ],
              outputs: [{ goodsId: 'household-goods', amount: 80 }],
              ticksRequired: 3,
            },
            laborRequired: 150,
            powerRequired: 200,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  // ============ 服务设施类 (Service) ============

  'power-plant-coal': {
    nameZh: '燃煤电厂',
    name: 'Coal Power Plant',
    category: 'service',
    subcategory: '能源设施',
    description: '燃烧煤炭发电',
    icon: '🏭',
    size: 'huge',
    baseCost: 200000000,
    maintenanceCost: 400000,
    maxWorkers: 200,
    templateId: 'SERVICE',
    productionSlots: [
      {
        type: 'process',
        name: '发电方式',
        defaultMethodId: 'steam-turbine',
        methods: [
          {
            id: 'steam-turbine',
            nameZh: '蒸汽轮机',
            name: 'Steam Turbine',
            description: '传统火力发电',
            recipe: {
              inputs: [{ goodsId: 'coal', amount: 100 }],
              outputs: [{ goodsId: 'electricity', amount: 500 }],
              ticksRequired: 1,
            },
            laborRequired: 100,
            powerRequired: 0,
            efficiency: 1.0,
          },
          {
            id: 'supercritical',
            nameZh: '超超临界锅炉',
            name: 'Supercritical Boiler',
            description: '高效清洁火电',
            recipe: {
              inputs: [{ goodsId: 'coal', amount: 80 }],
              outputs: [{ goodsId: 'electricity', amount: 600 }],
              ticksRequired: 1,
            },
            laborRequired: 80,
            powerRequired: 0,
            efficiency: 1.5,
          },
        ],
      },
    ],
  },

  'power-plant-gas': {
    nameZh: '燃气电厂',
    name: 'Gas Power Plant',
    category: 'service',
    subcategory: '能源设施',
    description: '燃烧天然气发电',
    icon: '💨',
    size: 'large',
    baseCost: 150000000,
    maintenanceCost: 300000,
    maxWorkers: 100,
    templateId: 'SERVICE',
    productionSlots: [
      {
        type: 'process',
        name: '发电方式',
        defaultMethodId: 'combined-cycle',
        methods: [
          {
            id: 'combined-cycle',
            nameZh: '联合循环',
            name: 'Combined Cycle',
            description: '高效燃气发电',
            recipe: {
              inputs: [{ goodsId: 'natural-gas', amount: 50 }],
              outputs: [{ goodsId: 'electricity', amount: 400 }],
              ticksRequired: 1,
            },
            laborRequired: 50,
            powerRequired: 0,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  'data-center': {
    nameZh: '数据中心',
    name: 'Data Center',
    category: 'service',
    subcategory: '数字基础设施',
    description: '提供云计算和AI算力服务',
    icon: '🖥️',
    size: 'large',
    baseCost: 500000000,
    maintenanceCost: 1500000,
    maxWorkers: 200,
    templateId: 'SERVICE',
    productionSlots: [
      {
        type: 'process',
        name: '算力类型',
        defaultMethodId: 'cloud-computing',
        methods: [
          {
            id: 'cloud-computing',
            nameZh: '云计算',
            name: 'Cloud Computing',
            description: '通用计算服务',
            recipe: {
              inputs: [
                { goodsId: 'electricity', amount: 200 },
                { goodsId: 'semiconductor-chip', amount: 1 },
              ],
              outputs: [{ goodsId: 'computing-power', amount: 100 }],
              ticksRequired: 1,
            },
            laborRequired: 50,
            powerRequired: 200,
            efficiency: 1.0,
          },
          {
            id: 'ai-training',
            nameZh: 'AI训练集群',
            name: 'AI Training Cluster',
            description: '高性能AI计算',
            recipe: {
              inputs: [
                { goodsId: 'electricity', amount: 500 },
                { goodsId: 'advanced-chip', amount: 1 },
              ],
              outputs: [{ goodsId: 'computing-power', amount: 300 }],
              ticksRequired: 1,
            },
            laborRequired: 80,
            powerRequired: 500,
            efficiency: 1.5,
          },
        ],
      },
    ],
  },

  // ============ 农业类 (Agriculture) ============

  'farm': {
    nameZh: '农场',
    name: 'Agricultural Farm',
    category: 'agriculture',
    subcategory: '农业生产',
    description: '种植粮食和蔬菜',
    icon: '🌾',
    size: 'large',
    baseCost: 30000000,
    maintenanceCost: 50000,
    maxWorkers: 100,
    templateId: 'AGRICULTURE',
    productionSlots: [
      {
        type: 'process',
        name: '种植类型',
        defaultMethodId: 'grain-farming',
        methods: [
          {
            id: 'grain-farming',
            nameZh: '粮食种植',
            name: 'Grain Farming',
            description: '生产小麦、玉米等粮食',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'grain', amount: 200 }],
              ticksRequired: 3,
            },
            laborRequired: 50,
            powerRequired: 20,
            efficiency: 1.0,
          },
          {
            id: 'vegetable-farming',
            nameZh: '蔬菜种植',
            name: 'Vegetable Farming',
            description: '生产蔬菜',
            recipe: {
              inputs: [],
              outputs: [{ goodsId: 'vegetables', amount: 150 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 30,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'livestock-farm': {
    nameZh: '畜牧场',
    name: 'Livestock Farm',
    category: 'agriculture',
    subcategory: '畜牧业',
    description: '养殖家畜',
    icon: '🐄',
    size: 'large',
    baseCost: 50000000,
    maintenanceCost: 80000,
    maxWorkers: 80,
    templateId: 'AGRICULTURE',
    productionSlots: [
      {
        type: 'process',
        name: '养殖类型',
        defaultMethodId: 'cattle-farming',
        methods: [
          {
            id: 'cattle-farming',
            nameZh: '牛牧场',
            name: 'Cattle Farming',
            description: '养殖肉牛和奶牛',
            recipe: {
              inputs: [{ goodsId: 'grain', amount: 50 }],
              outputs: [
                { goodsId: 'meat', amount: 30 },
                { goodsId: 'dairy', amount: 20 },
              ],
              ticksRequired: 4,
            },
            laborRequired: 40,
            powerRequired: 20,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'food-processing-plant': {
    nameZh: '食品加工厂',
    name: 'Food Processing Plant',
    category: 'processing',
    subcategory: '食品工业',
    description: '将农产品加工成食品',
    icon: '🥫',
    size: 'medium',
    baseCost: 80000000,
    maintenanceCost: 150000,
    maxWorkers: 200,
    templateId: 'PROCESSING',
    productionSlots: [
      {
        type: 'process',
        name: '产品类型',
        defaultMethodId: 'packaged-food',
        methods: [
          {
            id: 'packaged-food',
            nameZh: '包装食品',
            name: 'Packaged Food',
            description: '生产罐头、包装食品',
            recipe: {
              inputs: [
                { goodsId: 'grain', amount: 30 },
                { goodsId: 'vegetables', amount: 20 },
                { goodsId: 'plastic', amount: 10 },
              ],
              outputs: [{ goodsId: 'packaged-food', amount: 50 }],
              ticksRequired: 2,
            },
            laborRequired: 100,
            powerRequired: 80,
            efficiency: 1.0,
          },
          {
            id: 'processed-meat',
            nameZh: '肉类加工',
            name: 'Processed Meat',
            description: '生产肉制品',
            recipe: {
              inputs: [
                { goodsId: 'meat', amount: 30 },
                { goodsId: 'plastic', amount: 5 },
              ],
              outputs: [{ goodsId: 'processed-meat', amount: 25 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 100,
            efficiency: 1.0,
          },
          {
            id: 'dairy-products',
            nameZh: '乳制品加工',
            name: 'Dairy Processing',
            description: '生产奶制品和乳饮料',
            recipe: {
              inputs: [
                { goodsId: 'dairy', amount: 40 },
                { goodsId: 'plastic', amount: 8 },
              ],
              outputs: [{ goodsId: 'packaged-food', amount: 45 }],
              ticksRequired: 2,
            },
            laborRequired: 90,
            powerRequired: 90,
            efficiency: 1.1,
          },
        ],
      },
    ],
  },

  'beverage-factory': {
    nameZh: '饮料工厂',
    name: 'Beverage Factory',
    category: 'processing',
    subcategory: '食品工业',
    description: '生产各类饮料',
    icon: '🥤',
    size: 'medium',
    baseCost: 60000000,
    maintenanceCost: 100000,
    maxWorkers: 150,
    templateId: 'PROCESSING',
    productionSlots: [
      {
        type: 'process',
        name: '饮料类型',
        defaultMethodId: 'soft-drinks',
        methods: [
          {
            id: 'soft-drinks',
            nameZh: '软饮料',
            name: 'Soft Drinks',
            description: '生产碳酸饮料和果汁',
            recipe: {
              inputs: [
                { goodsId: 'chemicals', amount: 5 },
                { goodsId: 'plastic', amount: 20 },
              ],
              outputs: [{ goodsId: 'beverages', amount: 100 }],
              ticksRequired: 1,
            },
            laborRequired: 50,
            powerRequired: 60,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  // ============ 零售类 (Retail) ============

  'supermarket': {
    nameZh: '超市',
    name: 'Supermarket',
    category: 'retail',
    subcategory: '综合零售',
    description: '销售食品和日用品',
    icon: '🛒',
    size: 'large',
    baseCost: 100000000,
    maintenanceCost: 200000,
    maxWorkers: 300,
    templateId: 'RETAIL',
    productionSlots: [
      {
        type: 'process',
        name: '经营模式',
        defaultMethodId: 'standard-retail',
        methods: [
          {
            id: 'standard-retail',
            nameZh: '标准零售',
            name: 'Standard Retail',
            description: '综合商品销售',
            recipe: {
              inputs: [
                { goodsId: 'packaged-food', amount: 30 },
                { goodsId: 'beverages', amount: 20 },
                { goodsId: 'household-goods', amount: 15 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 100 }],
              ticksRequired: 1,
            },
            laborRequired: 200,
            powerRequired: 150,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },

  'convenience-store': {
    nameZh: '便利店',
    name: 'Convenience Store',
    category: 'retail',
    subcategory: '便利零售',
    description: '24小时营业的便利店',
    icon: '🏪',
    size: 'small',
    baseCost: 20000000,
    maintenanceCost: 40000,
    maxWorkers: 30,
    templateId: 'RETAIL',
    productionSlots: [
      {
        type: 'process',
        name: '经营模式',
        defaultMethodId: 'convenience-retail',
        methods: [
          {
            id: 'convenience-retail',
            nameZh: '便利零售',
            name: 'Convenience Retail',
            description: '高周转小型零售',
            recipe: {
              inputs: [
                { goodsId: 'packaged-food', amount: 10 },
                { goodsId: 'beverages', amount: 15 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 30 }],
              ticksRequired: 1,
            },
            laborRequired: 20,
            powerRequired: 30,
            efficiency: 1.2,
          },
        ],
      },
    ],
  },

  'electronics-mall': {
    nameZh: '电子商城',
    name: 'Electronics Mall',
    category: 'retail',
    subcategory: '电子零售',
    description: '销售电子产品和电器',
    icon: '📱',
    size: 'large',
    baseCost: 200000000,
    maintenanceCost: 400000,
    maxWorkers: 400,
    templateId: 'RETAIL',
    productionSlots: [
      {
        type: 'process',
        name: '经营模式',
        defaultMethodId: 'electronics-retail',
        methods: [
          {
            id: 'electronics-retail',
            nameZh: '电子产品零售',
            name: 'Electronics Retail',
            description: '销售手机、电脑等',
            recipe: {
              inputs: [
                { goodsId: 'smartphone', amount: 5 },
                { goodsId: 'personal-computer', amount: 3 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 200 }],
              ticksRequired: 1,
            },
            laborRequired: 150,
            powerRequired: 200,
            efficiency: 1.0,
          },
          {
            id: 'full-electronics-retail',
            nameZh: '全品类电子零售',
            name: 'Full Electronics Retail',
            description: '销售全线电子产品',
            recipe: {
              inputs: [
                { goodsId: 'smartphone', amount: 3 },
                { goodsId: 'premium-smartphone', amount: 2 },
                { goodsId: 'smart-tv', amount: 3 },
                { goodsId: 'gaming-console', amount: 2 },
                { goodsId: 'personal-computer', amount: 2 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 400 }],
              ticksRequired: 1,
            },
            laborRequired: 200,
            powerRequired: 280,
            efficiency: 1.2,
          },
          {
            id: 'premium-electronics-retail',
            nameZh: '高端电子产品零售',
            name: 'Premium Electronics Retail',
            description: '销售高端电子设备',
            recipe: {
              inputs: [
                { goodsId: 'premium-smartphone', amount: 3 },
                { goodsId: 'vr-headset', amount: 2 },
                { goodsId: 'smart-tv', amount: 2 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 350 }],
              ticksRequired: 1,
            },
            laborRequired: 180,
            powerRequired: 250,
            efficiency: 1.3,
          },
        ],
      },
    ],
  },

  'car-dealership': {
    nameZh: '汽车4S店',
    name: 'Car Dealership',
    category: 'retail',
    subcategory: '汽车零售',
    description: '销售汽车及维修服务',
    icon: '🚗',
    size: 'huge',
    baseCost: 300000000,
    maintenanceCost: 600000,
    maxWorkers: 200,
    templateId: 'RETAIL',
    productionSlots: [
      {
        type: 'process',
        name: '经营模式',
        defaultMethodId: 'ev-sales',
        methods: [
          {
            id: 'ev-sales',
            nameZh: '电动车销售',
            name: 'EV Sales',
            description: '销售电动汽车',
            recipe: {
              inputs: [{ goodsId: 'electric-vehicle', amount: 1 }],
              outputs: [{ goodsId: 'retail-revenue', amount: 500 }],
              ticksRequired: 2,
            },
            laborRequired: 50,
            powerRequired: 100,
            efficiency: 1.0,
          },
          {
            id: 'gasoline-car-sales',
            nameZh: '燃油车销售',
            name: 'Gasoline Car Sales',
            description: '销售燃油汽车',
            recipe: {
              inputs: [{ goodsId: 'gasoline-car', amount: 1 }],
              outputs: [{ goodsId: 'retail-revenue', amount: 400 }],
              ticksRequired: 2,
            },
            laborRequired: 50,
            powerRequired: 80,
            efficiency: 1.0,
          },
          {
            id: 'full-car-sales',
            nameZh: '综合汽车销售',
            name: 'Full Car Sales',
            description: '销售多种类型汽车',
            recipe: {
              inputs: [
                { goodsId: 'electric-vehicle', amount: 1 },
                { goodsId: 'gasoline-car', amount: 1 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 950 }],
              ticksRequired: 2,
            },
            laborRequired: 80,
            powerRequired: 150,
            efficiency: 1.1,
          },
          {
            id: 'luxury-car-sales',
            nameZh: '豪华车销售',
            name: 'Luxury Car Sales',
            description: '销售高端豪华汽车',
            recipe: {
              inputs: [{ goodsId: 'premium-ev', amount: 1 }],
              outputs: [{ goodsId: 'retail-revenue', amount: 1200 }],
              ticksRequired: 3,
            },
            laborRequired: 60,
            powerRequired: 120,
            efficiency: 1.2,
          },
        ],
      },
    ],
  },

  'restaurant': {
    nameZh: '餐厅',
    name: 'Restaurant',
    category: 'retail',
    subcategory: '餐饮服务',
    description: '提供餐饮服务',
    icon: '🍽️',
    size: 'medium',
    baseCost: 40000000,
    maintenanceCost: 80000,
    maxWorkers: 50,
    templateId: 'RETAIL',
    productionSlots: [
      {
        type: 'process',
        name: '经营模式',
        defaultMethodId: 'casual-dining',
        methods: [
          {
            id: 'casual-dining',
            nameZh: '休闲餐饮',
            name: 'Casual Dining',
            description: '大众餐饮',
            recipe: {
              inputs: [
                { goodsId: 'processed-meat', amount: 5 },
                { goodsId: 'vegetables', amount: 10 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 50 }],
              ticksRequired: 1,
            },
            laborRequired: 40,
            powerRequired: 50,
            efficiency: 1.0,
          },
          {
            id: 'dairy-cafe',
            nameZh: '奶茶咖啡厅',
            name: 'Dairy Cafe',
            description: '奶茶、咖啡等饮品',
            recipe: {
              inputs: [
                { goodsId: 'dairy', amount: 10 },
                { goodsId: 'beverages', amount: 5 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 40 }],
              ticksRequired: 1,
            },
            laborRequired: 30,
            powerRequired: 40,
            efficiency: 1.1,
          },
        ],
      },
    ],
  },

  // ============ 新增建筑 ============

  'gas-station': {
    nameZh: '加油站',
    name: 'Gas Station',
    category: 'retail',
    subcategory: '能源零售',
    description: '销售燃油和汽车服务',
    icon: '⛽',
    size: 'medium',
    baseCost: 50000000,
    maintenanceCost: 80000,
    maxWorkers: 30,
    templateId: 'RETAIL',
    productionSlots: [
      {
        type: 'process',
        name: '经营模式',
        defaultMethodId: 'fuel-retail',
        methods: [
          {
            id: 'fuel-retail',
            nameZh: '燃油零售',
            name: 'Fuel Retail',
            description: '销售汽油柴油',
            recipe: {
              inputs: [{ goodsId: 'refined-fuel', amount: 100 }],
              outputs: [{ goodsId: 'retail-revenue', amount: 150 }],
              ticksRequired: 1,
            },
            laborRequired: 20,
            powerRequired: 30,
            efficiency: 1.0,
          },
          {
            id: 'full-service-station',
            nameZh: '综合服务站',
            name: 'Full Service Station',
            description: '燃油+便利店',
            recipe: {
              inputs: [
                { goodsId: 'refined-fuel', amount: 80 },
                { goodsId: 'beverages', amount: 10 },
                { goodsId: 'packaged-food', amount: 5 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 180 }],
              ticksRequired: 1,
            },
            laborRequired: 30,
            powerRequired: 50,
            efficiency: 1.2,
          },
        ],
      },
    ],
  },

  'appliance-mall': {
    nameZh: '家电卖场',
    name: 'Appliance Mall',
    category: 'retail',
    subcategory: '家电零售',
    description: '销售家用电器和生活用品',
    icon: '🏠',
    size: 'large',
    baseCost: 150000000,
    maintenanceCost: 300000,
    maxWorkers: 250,
    templateId: 'RETAIL',
    constructionMaterials: [
      { goodsId: 'cement', amount: 2000 },      // 商场基础
      { goodsId: 'steel', amount: 1200 },       // 结构框架
      { goodsId: 'glass', amount: 600 },        // 展示窗
      { goodsId: 'aluminum', amount: 350 },     // 展柜
    ],
    productionSlots: [
      {
        type: 'process',
        name: '经营模式',
        defaultMethodId: 'appliance-retail',
        methods: [
          {
            id: 'appliance-retail',
            nameZh: '家电零售',
            name: 'Appliance Retail',
            description: '销售冰箱洗衣机等',
            recipe: {
              inputs: [
                { goodsId: 'home-appliance', amount: 10 },
                { goodsId: 'household-goods', amount: 30 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 180 }],
              ticksRequired: 1,
            },
            laborRequired: 120,
            powerRequired: 150,
            efficiency: 1.0,
          },
          {
            id: 'premium-appliance-retail',
            nameZh: '高端家电零售',
            name: 'Premium Appliance Retail',
            description: '销售智能家电',
            recipe: {
              inputs: [
                { goodsId: 'home-appliance', amount: 15 },
                { goodsId: 'smart-tv', amount: 3 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 280 }],
              ticksRequired: 1,
            },
            laborRequired: 150,
            powerRequired: 200,
            efficiency: 1.2,
          },
        ],
      },
    ],
  },

  'construction-supplier': {
    nameZh: '建材供应商',
    name: 'Construction Supplier',
    category: 'retail',
    subcategory: '建材零售',
    description: '销售建筑材料',
    icon: '🧱',
    size: 'large',
    baseCost: 80000000,
    maintenanceCost: 150000,
    maxWorkers: 100,
    templateId: 'RETAIL',
    constructionMaterials: [
      { goodsId: 'cement', amount: 1500 },      // 仓库基础
      { goodsId: 'steel', amount: 1000 },       // 仓库结构
      { goodsId: 'aluminum', amount: 200 },     // 货架
    ],
    productionSlots: [
      {
        type: 'process',
        name: '经营模式',
        defaultMethodId: 'construction-retail',
        methods: [
          {
            id: 'construction-retail',
            nameZh: '建材零售',
            name: 'Construction Materials Retail',
            description: '销售水泥钢材等建材',
            recipe: {
              inputs: [
                { goodsId: 'cement', amount: 100 },
                { goodsId: 'steel', amount: 30 },
                { goodsId: 'glass', amount: 20 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 120 }],
              ticksRequired: 1,
            },
            laborRequired: 60,
            powerRequired: 80,
            efficiency: 1.0,
          },
          {
            id: 'aluminum-supplier',
            nameZh: '铝材供应',
            name: 'Aluminum Supply',
            description: '供应铝材和轻量建材',
            recipe: {
              inputs: [
                { goodsId: 'aluminum', amount: 50 },
                { goodsId: 'glass', amount: 30 },
              ],
              outputs: [{ goodsId: 'retail-revenue', amount: 100 }],
              ticksRequired: 1,
            },
            laborRequired: 50,
            powerRequired: 60,
            efficiency: 1.0,
          },
        ],
      },
    ],
  },
};

/**
 * 获取所有建筑ID列表
 */
export function getBuildingIds(): string[] {
  return Object.keys(BUILDING_DEFINITIONS);
}

/**
 * 获取建筑定义
 */
export function getBuildingDef(id: string): BuildingDef | undefined {
  return BUILDING_DEFINITIONS[id];
}

/**
 * 按类别获取建筑ID
 */
export function getBuildingIdsByCategory(category: BuildingCategory): string[] {
  return Object.entries(BUILDING_DEFINITIONS)
    .filter(([, def]) => def.category === category)
    .map(([id]) => id);
}

/**
 * 获取建筑的主要生产商品ID
 */
export function getPrimaryOutputGoodsId(buildingId: string): string | undefined {
  const def = BUILDING_DEFINITIONS[buildingId];
  if (!def || !def.productionSlots || def.productionSlots.length === 0) return undefined;
  
  const firstSlot = def.productionSlots[0];
  if (!firstSlot || !firstSlot.methods) return undefined;
  
  const defaultMethod = firstSlot.methods.find(m => m.id === firstSlot.defaultMethodId);
  if (!defaultMethod || !defaultMethod.recipe.outputs || defaultMethod.recipe.outputs.length === 0) {
    return undefined;
  }
  
  const firstOutput = defaultMethod.recipe.outputs[0];
  return firstOutput ? firstOutput.goodsId : undefined;
}

/**
 * 根据商品ID获取可生产该商品的建筑列表
 */
export interface BuildingGoodsRelation {
  buildingId: string;
  buildingName: string;
  buildingIcon: string;
  buildingCost: number;
  amount: number;
  ticksRequired: number;
  methodName: string;
}

export function getBuildingsProducingGoods(goodsId: string): BuildingGoodsRelation[] {
  const result: BuildingGoodsRelation[] = [];
  
  for (const [buildingId, def] of Object.entries(BUILDING_DEFINITIONS)) {
    for (const slot of def.productionSlots) {
      for (const method of slot.methods) {
        for (const output of method.recipe.outputs) {
          if (output.goodsId === goodsId) {
            result.push({
              buildingId,
              buildingName: def.nameZh,
              buildingIcon: def.icon,
              buildingCost: def.baseCost,
              amount: output.amount,
              ticksRequired: method.recipe.ticksRequired,
              methodName: method.nameZh,
            });
          }
        }
      }
    }
  }
  
  return result;
}

/**
 * 根据商品ID获取消耗该商品的建筑列表
 */
export function getBuildingsConsumingGoods(goodsId: string): BuildingGoodsRelation[] {
  const result: BuildingGoodsRelation[] = [];
  
  for (const [buildingId, def] of Object.entries(BUILDING_DEFINITIONS)) {
    for (const slot of def.productionSlots) {
      for (const method of slot.methods) {
        for (const input of method.recipe.inputs) {
          if (input.goodsId === goodsId) {
            result.push({
              buildingId,
              buildingName: def.nameZh,
              buildingIcon: def.icon,
              buildingCost: def.baseCost,
              amount: input.amount,
              ticksRequired: method.recipe.ticksRequired,
              methodName: method.nameZh,
            });
          }
        }
      }
    }
  }
  
  return result;
}