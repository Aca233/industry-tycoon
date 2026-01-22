/**
 * 统一数据架构 - 核心类型定义
 * 这是所有注册表的基础类型
 */

import { EntityId } from '../types/common.js';

// ============ 商品相关类型 ============

/** 商品类别 */
export type GoodsCategory = 
  | 'raw_material'      // 原材料
  | 'basic_processed'   // 基础加工品
  | 'intermediate'      // 中间产品
  | 'consumer_good'     // 消费品
  | 'service';          // 服务

/** 商品子类别 */
export type GoodsSubcategory =
  | 'metal_ore'         // 金属矿石
  | 'energy_resource'   // 能源资源
  | 'mineral'           // 矿物
  | 'agricultural'      // 农产品
  | 'metal'             // 金属
  | 'chemical'          // 化工品
  | 'textile'           // 纺织品
  | 'component'         // 零部件
  | 'electronics'       // 电子产品
  | 'vehicle'           // 车辆
  | 'food'              // 食品
  | 'household'         // 家居用品
  | 'luxury'            // 奢侈品
  | 'utility';          // 公用事业

/** 消费需求等级 */
export type ConsumerDemandLevel = 'none' | 'low' | 'medium' | 'high' | 'very_high';

/** 价格波动性 */
export type PriceVolatility = 'stable' | 'low' | 'medium' | 'high' | 'extreme';

/** 商品声明式定义 - 用户只需填写这些核心属性 */
export interface GoodsDefinition {
  nameZh: string;
  name?: string;                    // 可选，自动从 nameZh 生成拼音
  category: GoodsCategory;
  subcategory?: GoodsSubcategory;   // 可选，自动推断
  tier: number;                      // 产业链层级 (0=原材料, 1=一次加工, 2=二次加工...)
  basePrice: number;
  icon: string;
  tags: string[];
  description?: string;              // 可选，自动生成
  
  // 可选的派生属性（如果不填则自动计算）
  consumerDemand?: ConsumerDemandLevel;
  priceVolatility?: PriceVolatility;
}

/** 完整的商品数据 - 包含派生属性 */
export interface GoodsData {
  id: EntityId;
  name: string;
  nameZh: string;
  category: GoodsCategory;
  subcategory: GoodsSubcategory;
  tier: number;
  basePrice: number;
  icon: string;
  tags: string[];
  description: string;
  
  // 派生的运行时属性
  consumerDemandRate: number;       // 基础消费需求量 (每tick)
  priceVolatilityFactor: number;    // 价格波动系数
}

// ============ 建筑相关类型 ============

/** 建筑类别 */
export type BuildingCategory =
  | 'extraction'        // 采掘业
  | 'processing'        // 加工业
  | 'manufacturing'     // 制造业
  | 'service'           // 服务业
  | 'logistics'         // 物流
  | 'retail'            // 零售
  | 'agriculture'       // 农业
  | 'energy';           // 能源

/** 生产槽位类型 */
export type ProductionSlotType =
  | 'process'           // 主生产工艺
  | 'automation'        // 自动化等级
  | 'energy'            // 能源供应
  | 'labor'             // 劳动力供应
  | 'quality';          // 质量控制

/** 生产配方 */
export interface ProductionRecipe {
  inputs: Array<{ goodsId: EntityId; amount: number }>;
  outputs: Array<{ goodsId: EntityId; amount: number }>;
  ticksRequired: number;
}

/** 生产方式定义 */
export interface ProductionMethodDefinition {
  id: string;
  nameZh: string;
  name?: string;
  description?: string;
  recipe: ProductionRecipe;
  
  // 修正系数
  efficiencyMultiplier?: number;    // 效率倍数 (默认 1.0)
  laborMultiplier?: number;         // 劳动力倍数 (默认 1.0)
  powerMultiplier?: number;         // 能耗倍数 (默认 1.0)
  qualityMultiplier?: number;       // 质量倍数 (默认 1.0)
  
  // 前置条件
  requiresTech?: string;            // 需要的科技
  requiresUpgrade?: string;         // 需要的建筑升级
}

/** 生产槽位定义 */
export interface ProductionSlotDefinition {
  type: ProductionSlotType;
  nameZh: string;
  methods: ProductionMethodDefinition[];
  defaultMethodId?: string;
}

/** 建筑模板 - 定义一类建筑的共同结构 */
export interface BuildingTemplate {
  category: BuildingCategory;
  baseWorkers: number;
  baseCost: number;
  baseMaintenance: number;
  
  // 槽位模板（方法内容由具体建筑填充）
  slotTemplates: Array<{
    type: ProductionSlotType;
    nameZh: string;
    // 通用方法（如自动化等级），适用于所有使用此模板的建筑
    commonMethods?: ProductionMethodDefinition[];
  }>;
  
  // 默认属性
  defaultEfficiency?: number;
  maxUpgradeLevel?: number;
}

/** 建筑配置 - 使用模板快速定义具体建筑 */
export interface BuildingConfig {
  id: string;
  template: string;                  // 模板名称，如 'EXTRACTION', 'PROCESSING'
  nameZh: string;
  name?: string;
  icon?: string;
  description?: string;
  
  // 具体的输入/输出配置
  primaryInputs?: Array<{ goodsId: EntityId; amount: number }>;
  primaryOutputs: Array<{ goodsId: EntityId; amount: number }>;
  
  // 成本和属性倍数
  costMultiplier?: number;           // 成本倍数 (默认 1.0)
  workerMultiplier?: number;         // 工人倍数 (默认 1.0)
  maintenanceMultiplier?: number;    // 维护倍数 (默认 1.0)
  
  // 额外的生产方式（追加到模板定义的方法）
  additionalMethods?: ProductionMethodDefinition[];
  
  // 位置加成
  locationBonuses?: {
    nearPort?: number;
    nearRailway?: number;
    industrial?: number;
  };
}

/** 完整的建筑数据 - 合并模板和配置后的结果 */
export interface BuildingData {
  id: string;
  name: string;
  nameZh: string;
  icon: string;
  description: string;
  category: BuildingCategory;
  
  // 成本和运营
  baseCost: number;
  maintenanceCost: number;
  maxWorkers: number;
  
  // 生产槽位
  productionSlots: Array<{
    type: ProductionSlotType;
    nameZh: string;
    methods: ProductionMethodDefinition[];
    defaultMethodId: string;
  }>;
  
  // 元数据
  tier: number;                      // 从输出商品推断
  templateId: string;                // 使用的模板ID
}

// ============ 产业链相关类型 ============

/** 产业链节点 */
export interface SupplyChainNode {
  goodsId: EntityId;
  tier: number;
  producers: string[];               // 生产此商品的建筑ID列表
  consumers: string[];               // 消耗此商品的建筑ID列表
  isRawMaterial: boolean;
  isFinalProduct: boolean;
}

/** 产业链边（转换关系） */
export interface SupplyChainEdge {
  fromGoodsId: EntityId;
  toGoodsId: EntityId;
  viaBuilding: string;
  viaMethods: string[];              // 可以实现此转换的方法ID列表
  conversionRatio: number;           // 转换比例 (output / input)
}

// ============ 验证相关类型 ============

/** 验证结果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** 验证规则 */
export interface ValidationRule {
  name: string;
  validate: () => ValidationResult;
}