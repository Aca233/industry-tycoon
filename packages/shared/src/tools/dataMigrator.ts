/**
 * 数据迁移工具
 * 将旧格式的 goods.ts 和 buildings.ts 数据转换为新架构格式
 */

import type { GoodsDefinition, GoodsCategory, GoodsSubcategory, ConsumerDemandLevel } from '../registry/types.js';

// ============ 旧数据格式（用于解析） ============

interface LegacyGoodsData {
  id: string;
  name: string;
  nameZh: string;
  category: string;
  tier: number;
  basePrice: number;
  icon: string;
  description?: string;
}

interface LegacyBuildingData {
  id: string;
  name?: string;
  nameZh: string;
  category: string;
  baseCost: number;
  maintenanceCost: number;
  maxWorkers: number;
  icon?: string;
  description?: string;
  productionSlots: Array<{
    type: string;
    nameZh: string;
    methods: Array<{
      id: string;
      nameZh: string;
      name?: string;
      recipe: {
        inputs: Array<{ goodsId: string; amount: number }>;
        outputs: Array<{ goodsId: string; amount: number }>;
        ticksRequired: number;
      };
      efficiencyMultiplier?: number;
      laborMultiplier?: number;
    }>;
    defaultMethodId?: string;
  }>;
}

// ============ 类别映射 ============

const CATEGORY_MAP: Record<string, GoodsCategory> = {
  'raw_material': 'raw_material',
  'basic_processed': 'basic_processed',
  'intermediate': 'intermediate',
  'intermediate_good': 'intermediate',
  'consumer_good': 'consumer_good',
  'consumer': 'consumer_good',
  'service': 'service',
  // 兼容其他可能的变体
  'raw': 'raw_material',
  'processed': 'basic_processed',
};

const SUBCATEGORY_INFERENCE: Record<string, GoodsSubcategory> = {
  // 原材料
  'iron-ore': 'metal_ore',
  'copper-ore': 'metal_ore',
  'bauxite': 'metal_ore',
  'coal': 'energy_resource',
  'crude-oil': 'energy_resource',
  'natural-gas': 'energy_resource',
  'silica-sand': 'mineral',
  'rare-earth': 'mineral',
  'lithium': 'mineral',
  'grain': 'agricultural',
  'vegetables': 'agricultural',
  'meat': 'agricultural',
  'dairy': 'agricultural',
  'rubber': 'agricultural',
  
  // 金属
  'steel': 'metal',
  'aluminum': 'metal',
  'copper': 'metal',
  
  // 化工
  'plastic': 'chemical',
  'chemicals': 'chemical',
  'glass': 'chemical',
  'cement': 'chemical',
  'refined-fuel': 'chemical',
  
  // 零部件
  'mechanical-parts': 'component',
  'battery-cell': 'component',
  'battery-pack': 'component',
  'electric-motor': 'component',
  'engine': 'component',
  'auto-parts': 'component',
  'pcb': 'component',
  'sensors': 'component',
  
  // 电子
  'silicon-wafer': 'electronics',
  'semiconductor-chip': 'electronics',
  'advanced-chip': 'electronics',
  'display-panel': 'electronics',
  'smartphone': 'electronics',
  'premium-smartphone': 'electronics',
  'personal-computer': 'electronics',
  'smart-tv': 'electronics',
  'gaming-console': 'electronics',
  'vr-headset': 'electronics',
  
  // 车辆
  'electric-vehicle': 'vehicle',
  'premium-ev': 'vehicle',
  'gasoline-car': 'vehicle',
  
  // 食品
  'packaged-food': 'food',
  'processed-meat': 'food',
  'beverages': 'food',
  
  // 家居
  'household-goods': 'household',
  'home-appliance': 'household',
  
  // 服务
  'electricity': 'utility',
  'computing-power': 'utility',
};

const CONSUMER_DEMAND_INFERENCE: Record<string, ConsumerDemandLevel> = {
  // 高需求 - 必需品
  'electricity': 'very_high',
  'packaged-food': 'very_high',
  'beverages': 'high',
  
  // 中高需求 - 常用消费品
  'smartphone': 'high',
  'household-goods': 'medium',
  'home-appliance': 'medium',
  
  // 中需求 - 可选消费品
  'personal-computer': 'medium',
  'smart-tv': 'medium',
  'gasoline-car': 'low',
  
  // 低需求 - 奢侈品
  'premium-smartphone': 'low',
  'electric-vehicle': 'low',
  'premium-ev': 'low',
  'vr-headset': 'low',
  'gaming-console': 'low',
};

// ============ 迁移工具类 ============

export class DataMigrator {
  /**
   * 将旧格式商品数据转换为新格式
   */
  migrateGoods(legacyGoods: LegacyGoodsData[]): Record<string, GoodsDefinition> {
    const result: Record<string, GoodsDefinition> = {};
    
    for (const goods of legacyGoods) {
      const category = this.inferGoodsCategory(goods);
      const subcategory = this.inferGoodsSubcategory(goods.id, category);
      const consumerDemand = this.inferConsumerDemand(goods.id, category);
      
      const definition: GoodsDefinition = {
        nameZh: goods.nameZh,
        name: goods.name,
        category,
        subcategory,
        tier: goods.tier,
        basePrice: goods.basePrice,
        icon: goods.icon,
        tags: this.generateTags(goods, category),
        consumerDemand,
      };
      
      // 仅在有描述时添加
      if (goods.description) {
        definition.description = goods.description;
      }
      
      result[goods.id] = definition;
    }
    
    return result;
  }

  /**
   * 推断商品类别
   */
  private inferGoodsCategory(goods: LegacyGoodsData): GoodsCategory {
    // 先尝试直接映射
    const mapped = CATEGORY_MAP[goods.category];
    if (mapped) return mapped;
    
    // 根据 tier 推断
    if (goods.tier === 0) return 'raw_material';
    if (goods.tier === 1) return 'basic_processed';
    if (goods.tier <= 3) return 'intermediate';
    return 'consumer_good';
  }

  /**
   * 推断商品子类别
   */
  private inferGoodsSubcategory(id: string, category: GoodsCategory): GoodsSubcategory {
    // 优先使用预定义映射
    const mapped = SUBCATEGORY_INFERENCE[id];
    if (mapped) return mapped;
    
    // 根据类别默认值
    switch (category) {
      case 'raw_material': return 'mineral';
      case 'basic_processed': return 'metal';
      case 'intermediate': return 'component';
      case 'consumer_good': return 'household';
      case 'service': return 'utility';
      default: return 'component';
    }
  }

  /**
   * 推断消费需求等级
   */
  private inferConsumerDemand(id: string, category: GoodsCategory): ConsumerDemandLevel {
    // 优先使用预定义映射
    const mapped = CONSUMER_DEMAND_INFERENCE[id];
    if (mapped) return mapped;
    
    // 根据类别推断
    if (category === 'raw_material') return 'none';
    if (category === 'basic_processed') return 'none';
    if (category === 'intermediate') return 'low';
    if (category === 'consumer_good') return 'medium';
    if (category === 'service') return 'high';
    
    return 'none';
  }

  /**
   * 生成标签
   */
  private generateTags(goods: LegacyGoodsData, category: GoodsCategory): string[] {
    const tags: string[] = [];
    
    // 基于类别
    if (category === 'raw_material') tags.push('extractable');
    if (category === 'consumer_good') tags.push('consumer');
    if (category === 'service') tags.push('intangible');
    
    // 基于 tier
    if (goods.tier === 0) tags.push('primary');
    if (goods.tier >= 4) tags.push('high_tech');
    
    // 基于名称关键词
    if (goods.id.includes('premium')) tags.push('luxury');
    if (goods.id.includes('electric')) tags.push('electric');
    if (goods.id.includes('chip') || goods.id.includes('semiconductor')) tags.push('electronic');
    
    return tags;
  }

  /**
   * 生成迁移代码
   */
  generateMigrationCode(legacyGoods: LegacyGoodsData[]): string {
    const migrated = this.migrateGoods(legacyGoods);
    
    let code = `/**
 * 商品定义 - 由 DataMigrator 自动生成
 * 生成时间: ${new Date().toISOString()}
 */

import type { GoodsDefinition } from '../registry/types.js';

export const GOODS_DEFINITIONS: Record<string, GoodsDefinition> = {\n`;
    
    for (const [id, def] of Object.entries(migrated)) {
      code += `  '${id}': {\n`;
      code += `    nameZh: '${def.nameZh}',\n`;
      if (def.name) code += `    name: '${def.name}',\n`;
      code += `    category: '${def.category}',\n`;
      if (def.subcategory) code += `    subcategory: '${def.subcategory}',\n`;
      code += `    tier: ${def.tier},\n`;
      code += `    basePrice: ${def.basePrice},\n`;
      code += `    icon: '${def.icon}',\n`;
      code += `    tags: [${def.tags.map(t => `'${t}'`).join(', ')}],\n`;
      if (def.consumerDemand && def.consumerDemand !== 'none') {
        code += `    consumerDemand: '${def.consumerDemand}',\n`;
      }
      code += `  },\n`;
    }
    
    code += `};\n`;
    return code;
  }

  /**
   * 分析旧数据并生成迁移报告
   */
  generateMigrationReport(legacyGoods: LegacyGoodsData[], legacyBuildings: LegacyBuildingData[]): string {
    let report = `# 数据迁移报告\n\n`;
    report += `生成时间: ${new Date().toISOString()}\n\n`;
    
    // 商品统计
    report += `## 商品统计\n\n`;
    report += `- 总数: ${legacyGoods.length}\n`;
    
    const categoryCount: Record<string, number> = {};
    const tierCount: Record<number, number> = {};
    
    for (const goods of legacyGoods) {
      const category = this.inferGoodsCategory(goods);
      categoryCount[category] = (categoryCount[category] || 0) + 1;
      tierCount[goods.tier] = (tierCount[goods.tier] || 0) + 1;
    }
    
    report += `\n### 按类别:\n`;
    for (const [cat, count] of Object.entries(categoryCount)) {
      report += `- ${cat}: ${count}\n`;
    }
    
    report += `\n### 按层级:\n`;
    for (const [tier, count] of Object.entries(tierCount).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      report += `- Tier ${tier}: ${count}\n`;
    }
    
    // 建筑统计
    report += `\n## 建筑统计\n\n`;
    report += `- 总数: ${legacyBuildings.length}\n`;
    
    const buildingCategoryCount: Record<string, number> = {};
    let totalRecipes = 0;
    const usedGoods = new Set<string>();
    
    for (const building of legacyBuildings) {
      buildingCategoryCount[building.category] = (buildingCategoryCount[building.category] || 0) + 1;
      
      for (const slot of building.productionSlots) {
        totalRecipes += slot.methods.length;
        for (const method of slot.methods) {
          for (const input of method.recipe.inputs) usedGoods.add(input.goodsId);
          for (const output of method.recipe.outputs) usedGoods.add(output.goodsId);
        }
      }
    }
    
    report += `\n### 按类别:\n`;
    for (const [cat, count] of Object.entries(buildingCategoryCount)) {
      report += `- ${cat}: ${count}\n`;
    }
    
    report += `\n### 配方统计:\n`;
    report += `- 总配方数: ${totalRecipes}\n`;
    report += `- 涉及商品数: ${usedGoods.size}\n`;
    
    // 缺失检查
    const orphanGoods = legacyGoods.filter(g => !usedGoods.has(g.id));
    if (orphanGoods.length > 0) {
      report += `\n## ⚠️ 未使用的商品 (${orphanGoods.length})\n\n`;
      for (const goods of orphanGoods) {
        report += `- ${goods.id} (${goods.nameZh})\n`;
      }
    }
    
    return report;
  }
}

// ============ 便捷函数 ============

let migrator: DataMigrator | null = null;

export function getDataMigrator(): DataMigrator {
  if (!migrator) {
    migrator = new DataMigrator();
  }
  return migrator;
}

/**
 * 快速迁移商品数据
 */
export function migrateGoodsData(legacyGoods: LegacyGoodsData[]): Record<string, GoodsDefinition> {
  return getDataMigrator().migrateGoods(legacyGoods);
}

/**
 * 生成迁移代码
 */
export function generateGoodsMigrationCode(legacyGoods: LegacyGoodsData[]): string {
  return getDataMigrator().generateMigrationCode(legacyGoods);
}