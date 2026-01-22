/**
 * 商品声明式定义 - 使用 GoodsRegistry 系统
 * 
 * 这是新的商品配置格式，只需定义核心属性：
 * - nameZh: 中文名称（必需）
 * - category: 类别（必需）
 * - tier: 产业链层级 0-5（必需）
 * - basePrice: 基础价格，单位：分（必需）
 * - icon: 图标 emoji（必需）
 * - tags: 标签数组（必需）
 * 
 * 以下属性会自动派生：
 * - name: 从 id 生成英文名
 * - subcategory: 从 category 和 tags 推断
 * - description: 自动生成描述
 * - consumerDemand: 从 category 推断消费需求等级
 * - priceVolatility: 从 category 和 tier 推断价格波动性
 */

import type { GoodsDefinition } from '../registry/types.js';

/**
 * 商品定义配置
 * 格式: { [商品ID]: GoodsDefinition }
 */
export const GOODS_DEFINITIONS: Record<string, GoodsDefinition> = {
  // ============ 原材料 (Raw Materials) - Tier 0 ============
  
  'iron-ore': {
    nameZh: '铁矿石',
    name: 'Iron Ore',
    category: 'raw_material',
    subcategory: 'metal_ore',
    tier: 0,
    basePrice: 5000,
    icon: '🪨',
    tags: ['矿产', 'metal', 'ore', '重工业'],
    description: '钢铁工业的基础原料',
    priceVolatility: 'high',
  },
  
  'coal': {
    nameZh: '煤炭',
    name: 'Coal',
    category: 'raw_material',
    subcategory: 'energy_resource',
    tier: 0,
    basePrice: 3000,
    icon: '⚫',
    tags: ['矿产', 'energy', 'fuel', '燃料'],
    description: '传统能源和炼钢的重要原料',
    priceVolatility: 'high',
  },
  
  'crude-oil': {
    nameZh: '原油',
    name: 'Crude Oil',
    category: 'raw_material',
    subcategory: 'energy_resource',
    tier: 0,
    basePrice: 8000,
    icon: '🛢️',
    tags: ['energy', 'fuel', '石化', '战略资源'],
    description: '石油化工产业的命脉',
    priceVolatility: 'extreme',
  },
  
  'natural-gas': {
    nameZh: '天然气',
    name: 'Natural Gas',
    category: 'raw_material',
    subcategory: 'energy_resource',
    tier: 0,
    basePrice: 4000,
    icon: '💨',
    tags: ['energy', '清洁', 'chemical', '化工原料'],
    description: '清洁能源和化工原料',
    priceVolatility: 'high',
  },
  
  'copper-ore': {
    nameZh: '铜矿石',
    name: 'Copper Ore',
    category: 'raw_material',
    subcategory: 'metal_ore',
    tier: 0,
    basePrice: 6000,
    icon: '🟤',
    tags: ['矿产', 'metal', 'ore', 'electronics'],
    description: '电子工业的重要金属原料',
    priceVolatility: 'high',
  },
  
  'rare-earth': {
    nameZh: '稀土',
    name: 'Rare Earth',
    category: 'raw_material',
    subcategory: 'mineral',
    tier: 0,
    basePrice: 50000,
    icon: '💎',
    tags: ['稀有', '高科技', '战略资源', 'mineral'],
    description: '高科技产业的关键原料',
    priceVolatility: 'extreme',
  },
  
  'silica-sand': {
    nameZh: '硅砂',
    name: 'Silica Sand',
    category: 'raw_material',
    subcategory: 'mineral',
    tier: 0,
    basePrice: 2000,
    icon: '🏖️',
    tags: ['矿产', 'mineral', '半导体', '玻璃'],
    description: '半导体和玻璃制造的原料',
    priceVolatility: 'medium',
  },
  
  'lithium': {
    nameZh: '锂矿',
    name: 'Lithium',
    category: 'raw_material',
    subcategory: 'mineral',
    tier: 0,
    basePrice: 80000,
    icon: '🔋',
    tags: ['稀有', 'mineral', '电池', '新能源'],
    description: '电池产业的核心原料',
    priceVolatility: 'extreme',
  },
  
  'bauxite': {
    nameZh: '铝土矿',
    name: 'Bauxite',
    category: 'raw_material',
    subcategory: 'metal_ore',
    tier: 0,
    basePrice: 4000,
    icon: '⬜',
    tags: ['矿产', 'metal', 'ore', '轻量化'],
    description: '铝金属的主要来源',
    priceVolatility: 'medium',
  },
  
  'rubber': {
    nameZh: '天然橡胶',
    name: 'Natural Rubber',
    category: 'raw_material',
    subcategory: 'agricultural',
    tier: 0,
    basePrice: 15000,
    icon: '🌳',
    tags: ['agricultural', '工业原料', '轮胎'],
    description: '轮胎和橡胶制品的原料',
    priceVolatility: 'high',
  },
  
  // ============ 农产品 (Agricultural) - Tier 0 ============
  
  'grain': {
    nameZh: '粮食',
    name: 'Grain',
    category: 'raw_material',
    subcategory: 'agricultural',
    tier: 0,
    basePrice: 1000,
    icon: '🌾',
    tags: ['agricultural', 'food', '基础', 'crop'],
    description: '小麦、玉米等粮食作物',
    priceVolatility: 'medium',
  },
  
  'vegetables': {
    nameZh: '蔬菜',
    name: 'Vegetables',
    category: 'raw_material',
    subcategory: 'agricultural',
    tier: 0,
    basePrice: 2000,
    icon: '🥬',
    tags: ['agricultural', 'food', '新鲜', 'crop'],
    description: '各类新鲜蔬菜',
    priceVolatility: 'high',
  },
  
  'meat': {
    nameZh: '肉类',
    name: 'Meat',
    category: 'raw_material',
    subcategory: 'agricultural',
    tier: 0,
    basePrice: 8000,
    icon: '🥩',
    tags: ['畜牧', 'food', '蛋白质'],
    description: '牛肉、猪肉等',
    priceVolatility: 'medium',
  },
  
  'dairy': {
    nameZh: '乳制品',
    name: 'Dairy Products',
    category: 'raw_material',
    subcategory: 'agricultural',
    tier: 0,
    basePrice: 5000,
    icon: '🥛',
    tags: ['畜牧', 'food', '营养'],
    description: '牛奶、奶酪等',
    priceVolatility: 'medium',
  },
  
  // ============ 基础加工品 (Basic Processed) - Tier 1 ============
  
  'steel': {
    nameZh: '钢材',
    name: 'Steel',
    category: 'basic_processed',
    subcategory: 'metal',
    tier: 1,
    basePrice: 12000,
    icon: '🔩',
    tags: ['processed_metal', '建材', '制造业'],
    description: '工业制造的基础材料',
    priceVolatility: 'medium',
  },
  
  'copper': {
    nameZh: '精铜',
    name: 'Refined Copper',
    category: 'basic_processed',
    subcategory: 'metal',
    tier: 1,
    basePrice: 18000,
    icon: '🟠',
    tags: ['processed_metal', 'electronics', '导电'],
    description: '电子和电气工业的重要材料',
    priceVolatility: 'medium',
  },
  
  'aluminum': {
    nameZh: '铝材',
    name: 'Aluminum',
    category: 'basic_processed',
    subcategory: 'metal',
    tier: 1,
    basePrice: 16000,
    icon: '🪙',
    tags: ['processed_metal', '轻量', '航空'],
    description: '轻量化制造的首选材料',
    priceVolatility: 'medium',
  },
  
  'plastic': {
    nameZh: '塑料',
    name: 'Plastic',
    category: 'basic_processed',
    subcategory: 'chemical',
    tier: 1,
    basePrice: 8000,
    icon: '🧴',
    tags: ['chemical', '轻工', '包装'],
    description: '现代工业不可或缺的材料',
    priceVolatility: 'low',
  },
  
  'refined-fuel': {
    nameZh: '精炼燃油',
    name: 'Refined Fuel',
    category: 'basic_processed',
    subcategory: 'chemical',
    tier: 1,
    basePrice: 10000,
    icon: '⛽',
    tags: ['energy', 'chemical', '交通'],
    description: '交通运输的主要燃料',
    priceVolatility: 'high',
  },
  
  'chemicals': {
    nameZh: '化工原料',
    name: 'Industrial Chemicals',
    category: 'basic_processed',
    subcategory: 'chemical',
    tier: 1,
    basePrice: 15000,
    icon: '🧪',
    tags: ['chemical', '工业', '原料'],
    description: '各类化工产品的基础',
    priceVolatility: 'medium',
  },
  
  'silicon-wafer': {
    nameZh: '硅晶圆',
    name: 'Silicon Wafer',
    category: 'basic_processed',
    subcategory: 'electronics',
    tier: 1,
    basePrice: 100000,
    icon: '💿',
    tags: ['electronics', '半导体', '高科技'],
    description: '芯片制造的核心材料',
    priceVolatility: 'medium',
  },
  
  'glass': {
    nameZh: '工业玻璃',
    name: 'Industrial Glass',
    category: 'basic_processed',
    subcategory: 'chemical',
    tier: 1,
    basePrice: 5000,
    icon: '🪟',
    tags: ['建材', '光学', '包装'],
    description: '建筑和电子产品的重要材料',
    priceVolatility: 'low',
  },
  
  'cement': {
    nameZh: '水泥',
    name: 'Cement',
    category: 'basic_processed',
    subcategory: 'chemical',
    tier: 1,
    basePrice: 3000,
    icon: '🧱',
    tags: ['建材', '基建', '房地产'],
    description: '建筑业的基础材料',
    priceVolatility: 'low',
  },
  
  // ============ 中间产品 (Intermediate Products) - Tier 2 ============
  
  'semiconductor-chip': {
    nameZh: '半导体芯片',
    name: 'Semiconductor Chip',
    category: 'intermediate',
    subcategory: 'electronics',
    tier: 2,
    basePrice: 500000,
    icon: '🔲',
    tags: ['electronics', '高科技', '核心部件'],
    description: '电子设备的大脑',
    priceVolatility: 'medium',
  },
  
  'advanced-chip': {
    nameZh: '高端芯片',
    name: 'Advanced Chip',
    category: 'intermediate',
    subcategory: 'electronics',
    tier: 3,
    basePrice: 2000000,
    icon: '💠',
    tags: ['electronics', '前沿', 'AI', '高科技'],
    description: '高性能计算的核心',
    priceVolatility: 'medium',
  },
  
  'battery-cell': {
    nameZh: '电池电芯',
    name: 'Battery Cell',
    category: 'intermediate',
    subcategory: 'component',
    tier: 2,
    basePrice: 80000,
    icon: '🔋',
    tags: ['component', '新能源', '储能', '电动车'],
    description: '储能设备的核心组件',
    priceVolatility: 'medium',
  },
  
  'battery-pack': {
    nameZh: '电池组',
    name: 'Battery Pack',
    category: 'intermediate',
    subcategory: 'component',
    tier: 3,
    basePrice: 300000,
    icon: '🔌',
    tags: ['component', '新能源', '电动车', '储能'],
    description: '电动汽车的动力来源',
    priceVolatility: 'medium',
  },
  
  'display-panel': {
    nameZh: '显示面板',
    name: 'Display Panel',
    category: 'intermediate',
    subcategory: 'electronics',
    tier: 2,
    basePrice: 150000,
    icon: '📺',
    tags: ['electronics', '显示', '消费品'],
    description: '各类显示设备的核心',
    priceVolatility: 'medium',
  },
  
  'pcb': {
    nameZh: '电路板',
    name: 'PCB Circuit Board',
    category: 'intermediate',
    subcategory: 'electronics',
    tier: 2,
    basePrice: 30000,
    icon: '📟',
    tags: ['electronics', 'part', '制造', '基础件'],
    description: '电子产品的神经网络',
    priceVolatility: 'low',
  },
  
  'engine': {
    nameZh: '内燃机',
    name: 'Combustion Engine',
    category: 'intermediate',
    subcategory: 'component',
    tier: 2,
    basePrice: 200000,
    icon: '⚙️',
    tags: ['component', '机械', '汽车', '传统动力'],
    description: '传统汽车的心脏',
    priceVolatility: 'low',
  },
  
  'electric-motor': {
    nameZh: '电动机',
    name: 'Electric Motor',
    category: 'intermediate',
    subcategory: 'component',
    tier: 2,
    basePrice: 120000,
    icon: '🔄',
    tags: ['component', '电力', '新能源', '电动车'],
    description: '电动汽车的动力核心',
    priceVolatility: 'low',
  },
  
  'mechanical-parts': {
    nameZh: '机械零件',
    name: 'Mechanical Parts',
    category: 'intermediate',
    subcategory: 'component',
    tier: 2,
    basePrice: 25000,
    icon: '🔧',
    tags: ['component', 'part', '机械', '制造', '通用'],
    description: '各类机械设备的基础',
    priceVolatility: 'low',
  },
  
  'auto-parts': {
    nameZh: '汽车零部件',
    name: 'Auto Parts',
    category: 'intermediate',
    subcategory: 'component',
    tier: 2,
    basePrice: 50000,
    icon: '🚗',
    tags: ['component', 'part', 'vehicle', '汽车', '零配件'],
    description: '汽车制造的关键组件',
    priceVolatility: 'low',
  },
  
  'sensors': {
    nameZh: '传感器',
    name: 'Sensors',
    category: 'intermediate',
    subcategory: 'electronics',
    tier: 2,
    basePrice: 40000,
    icon: '📡',
    tags: ['electronics', 'component', '智能', '自动化'],
    description: '智能设备的感知器官',
    priceVolatility: 'medium',
  },
  
  // ============ 消费品 - 电子产品 (Consumer Electronics) - Tier 3-4 ============
  
  'smartphone': {
    nameZh: '智能手机',
    name: 'Smartphone',
    category: 'consumer_good',
    subcategory: 'electronics',
    tier: 3,
    basePrice: 600000,
    icon: '📱',
    tags: ['electronics', '消费品', '通讯'],
    description: '现代生活必需品',
    consumerDemand: 'high',
    priceVolatility: 'low',
  },
  
  'premium-smartphone': {
    nameZh: '高端智能手机',
    name: 'Premium Smartphone',
    category: 'consumer_good',
    subcategory: 'electronics',
    tier: 4,
    basePrice: 1200000,
    icon: '📲',
    tags: ['electronics', 'luxury', '高端'],
    description: '旗舰级智能手机',
    consumerDemand: 'medium',
    priceVolatility: 'low',
  },
  
  'personal-computer': {
    nameZh: '个人电脑',
    name: 'Personal Computer',
    category: 'consumer_good',
    subcategory: 'electronics',
    tier: 3,
    basePrice: 800000,
    icon: '💻',
    tags: ['electronics', '办公', '娱乐'],
    description: '工作和娱乐的核心设备',
    consumerDemand: 'medium',
    priceVolatility: 'low',
  },
  
  'smart-tv': {
    nameZh: '智能电视',
    name: 'Smart TV',
    category: 'consumer_good',
    subcategory: 'electronics',
    tier: 3,
    basePrice: 500000,
    icon: '📺',
    tags: ['electronics', 'household', '家电', '娱乐'],
    description: '家庭娱乐中心',
    consumerDemand: 'medium',
    priceVolatility: 'low',
  },
  
  'gaming-console': {
    nameZh: '游戏主机',
    name: 'Gaming Console',
    category: 'consumer_good',
    subcategory: 'electronics',
    tier: 3,
    basePrice: 400000,
    icon: '🎮',
    tags: ['electronics', '娱乐', '游戏'],
    description: '游戏娱乐设备',
    consumerDemand: 'medium',
    priceVolatility: 'low',
  },
  
  'vr-headset': {
    nameZh: 'VR头显',
    name: 'VR Headset',
    category: 'consumer_good',
    subcategory: 'electronics',
    tier: 4,
    basePrice: 350000,
    icon: '🥽',
    tags: ['electronics', 'VR', '娱乐', '前沿'],
    description: '虚拟现实体验设备',
    consumerDemand: 'low',
    priceVolatility: 'medium',
  },
  
  // ============ 消费品 - 汽车 (Vehicles) - Tier 4 ============
  
  'electric-vehicle': {
    nameZh: '电动汽车',
    name: 'Electric Vehicle',
    category: 'consumer_good',
    subcategory: 'vehicle',
    tier: 4,
    basePrice: 3000000,
    icon: '🚙',
    tags: ['vehicle', '汽车', '新能源', '环保'],
    description: '未来出行的选择',
    consumerDemand: 'medium',
    priceVolatility: 'low',
  },
  
  'premium-ev': {
    nameZh: '豪华电动汽车',
    name: 'Premium Electric Vehicle',
    category: 'consumer_good',
    subcategory: 'vehicle',
    tier: 4,
    basePrice: 8000000,
    icon: '🏎️',
    tags: ['vehicle', '汽车', 'luxury', '高端'],
    description: '高端电动出行',
    consumerDemand: 'low',
    priceVolatility: 'low',
  },
  
  'gasoline-car': {
    nameZh: '燃油汽车',
    name: 'Gasoline Car',
    category: 'consumer_good',
    subcategory: 'vehicle',
    tier: 4,
    basePrice: 2500000,
    icon: '🚗',
    tags: ['vehicle', '汽车', '传统', '交通'],
    description: '传统动力汽车',
    consumerDemand: 'medium',
    priceVolatility: 'low',
  },
  
  // ============ 消费品 - 家电和日用品 (Household) - Tier 2-3 ============
  
  'home-appliance': {
    nameZh: '家用电器',
    name: 'Home Appliance',
    category: 'consumer_good',
    subcategory: 'household',
    tier: 3,
    basePrice: 300000,
    icon: '🏠',
    tags: ['household', '家电', '消费品', '家庭'],
    description: '提升生活品质的电器',
    consumerDemand: 'medium',
    priceVolatility: 'low',
  },
  
  'household-goods': {
    nameZh: '日用品',
    name: 'Household Goods',
    category: 'consumer_good',
    subcategory: 'household',
    tier: 2,
    basePrice: 8000,
    icon: '🧴',
    tags: ['household', '日用', '消费品', '家庭'],
    description: '清洁用品、纸品等',
    consumerDemand: 'very_high',
    priceVolatility: 'stable',
  },
  
  // ============ 消费品 - 食品 (Food) - Tier 2 ============
  
  'packaged-food': {
    nameZh: '包装食品',
    name: 'Packaged Food',
    category: 'consumer_good',
    subcategory: 'food',
    tier: 2,
    basePrice: 5000,
    icon: '🥫',
    tags: ['food', '消费品', '便利'],
    description: '罐头、方便食品等',
    consumerDemand: 'very_high',
    priceVolatility: 'stable',
  },
  
  'processed-meat': {
    nameZh: '肉制品',
    name: 'Processed Meat',
    category: 'consumer_good',
    subcategory: 'food',
    tier: 2,
    basePrice: 12000,
    icon: '🍖',
    tags: ['food', '消费品', '加工'],
    description: '香肠、培根等',
    consumerDemand: 'high',
    priceVolatility: 'low',
  },
  
  'beverages': {
    nameZh: '饮料',
    name: 'Beverages',
    category: 'consumer_good',
    subcategory: 'food',
    tier: 2,
    basePrice: 3000,
    icon: '🥤',
    tags: ['food', '消费品', '饮品'],
    description: '软饮料、果汁等',
    consumerDemand: 'very_high',
    priceVolatility: 'stable',
  },
  
  // ============ 服务类 (Services) ============
  
  'electricity': {
    nameZh: '电力',
    name: 'Electricity',
    category: 'service',
    subcategory: 'utility',
    tier: 1,
    basePrice: 500,
    icon: '⚡',
    tags: ['utility', 'energy', '基础设施', '必需品'],
    description: '一切工业活动的基础',
    consumerDemand: 'high',
    priceVolatility: 'medium',
  },
  
  'computing-power': {
    nameZh: '算力',
    name: 'Computing Power',
    category: 'service',
    subcategory: 'utility',
    tier: 2,
    basePrice: 2000,
    icon: '🖥️',
    tags: ['utility', '科技', 'AI', '云计算'],
    description: 'AI时代的核心资源',
    consumerDemand: 'medium',
    priceVolatility: 'medium',
  },
  
  'retail-revenue': {
    nameZh: '零售收入',
    name: 'Retail Revenue',
    category: 'service',
    subcategory: 'utility',
    tier: 1,
    basePrice: 100,
    icon: '💰',
    tags: ['utility', '收入', '零售', '服务'],
    description: '零售服务产生的收入',
    consumerDemand: 'none',
    priceVolatility: 'stable',
  },
};

/**
 * 获取所有商品ID列表
 */
export function getGoodsIds(): string[] {
  return Object.keys(GOODS_DEFINITIONS);
}

/**
 * 获取商品定义
 */
export function getGoodsDefinition(id: string): GoodsDefinition | undefined {
  return GOODS_DEFINITIONS[id];
}

/**
 * 按类别获取商品ID
 */
export function getGoodsIdsByCategory(category: string): string[] {
  return Object.entries(GOODS_DEFINITIONS)
    .filter(([, def]) => def.category === category)
    .map(([id]) => id);
}

/**
 * 按层级获取商品ID
 */
export function getGoodsIdsByTier(tier: number): string[] {
  return Object.entries(GOODS_DEFINITIONS)
    .filter(([, def]) => def.tier === tier)
    .map(([id]) => id);
}