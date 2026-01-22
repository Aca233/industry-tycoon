/**
 * 商品定义数据 - 兼容层
 *
 * 此文件提供向后兼容的 GOODS_DATA、GOODS_MAP、GOODS_BY_CATEGORY 导出
 * 数据源已迁移至 goodsDefinitions.ts 中的声明式配置
 *
 * 新代码应该使用:
 * - GoodsRegistry 单例获取商品数据
 * - GOODS_DEFINITIONS 声明式配置
 */

import type { EntityId } from '../types/common.js';
import { GOODS_DEFINITIONS } from './goodsDefinitions.js';

/**
 * 传统商品数据接口 (保持向后兼容)
 */
export interface GoodsData {
  id: EntityId;
  name: string;
  nameZh: string;
  category: 'raw_material' | 'basic_processed' | 'intermediate' | 'consumer_good' | 'service';
  subcategory: string;
  basePrice: number; // 分为单位
  icon: string;
  tags: string[];
  description: string;
}

/**
 * 子类别映射表：将新的 subcategory 代码转换为传统的中文子类别名称
 */
const SUBCATEGORY_DISPLAY_MAP: Record<string, string> = {
  // 原材料子类别
  'metal_ore': '矿产资源',
  'energy_resource': '矿产资源',
  'mineral': '矿产资源',
  'agricultural': '农产品',
  
  // 基础加工品子类别
  'metal': '金属材料',
  'chemical': '化工材料',
  'electronics': '电子材料',
  
  // 中间产品子类别
  'component': '机械部件',
  
  // 消费品子类别
  'vehicle': '交通工具',
  'household': '家电产品',
  'food': '食品',
  
  // 服务子类别
  'utility': '基础服务',
};

/**
 * 将 kebab-case ID 转换为 Title Case 英文名
 * 例如: 'iron-ore' -> 'Iron Ore'
 */
function idToEnglishName(id: string): string {
  return id
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * 从 GOODS_DEFINITIONS 生成传统格式的 GOODS_DATA
 * 这是兼容层的核心转换逻辑
 */
function generateGoodsData(): GoodsData[] {
  return Object.entries(GOODS_DEFINITIONS).map(([id, def]) => {
    // 获取子类别，如果未定义则根据 category 推断
    const subcategory = def.subcategory || 'general';
    
    // 确定显示用的子类别名称
    let displaySubcategory = SUBCATEGORY_DISPLAY_MAP[subcategory] || subcategory;
    
    // 特殊处理：根据 tags 微调子类别显示
    if (def.category === 'raw_material') {
      if (def.tags.includes('畜牧')) {
        displaySubcategory = '畜牧产品';
      } else if (def.tags.includes('agricultural') && !subcategory.includes('metal')) {
        if (id === 'rubber') {
          displaySubcategory = '农林产品';
        }
      }
    } else if (def.category === 'intermediate') {
      if (subcategory === 'electronics') {
        displaySubcategory = '电子元件';
      } else if (subcategory === 'component') {
        displaySubcategory = '机械部件';
      }
    } else if (def.category === 'consumer_good') {
      if (subcategory === 'electronics') {
        displaySubcategory = '电子产品';
      } else if (subcategory === 'household') {
        if (def.tags.includes('家电')) {
          displaySubcategory = '家电产品';
        } else {
          displaySubcategory = '日用';
        }
      }
    } else if (def.category === 'service') {
      if (id === 'electricity') {
        displaySubcategory = '能源服务';
      } else if (id === 'computing-power') {
        displaySubcategory = '数字服务';
      } else if (id === 'retail-revenue') {
        displaySubcategory = '零售';
      }
    }
    
    return {
      id: id as EntityId,
      name: def.name || idToEnglishName(id),
      nameZh: def.nameZh,
      category: def.category,
      subcategory: displaySubcategory,
      basePrice: def.basePrice,
      icon: def.icon,
      tags: def.tags,
      description: def.description || `${def.nameZh}的描述`,
    };
  });
}

/**
 * 商品数据数组 (从声明式配置自动生成)
 * @deprecated 新代码应使用 GoodsRegistry.getInstance()
 */
export const GOODS_DATA: GoodsData[] = generateGoodsData();

/**
 * 按类别分组的商品
 * @deprecated 新代码应使用 GoodsRegistry.getInstance().getByCategory()
 */
export const GOODS_BY_CATEGORY = {
  raw_material: GOODS_DATA.filter(g => g.category === 'raw_material'),
  basic_processed: GOODS_DATA.filter(g => g.category === 'basic_processed'),
  intermediate: GOODS_DATA.filter(g => g.category === 'intermediate'),
  consumer_good: GOODS_DATA.filter(g => g.category === 'consumer_good'),
  service: GOODS_DATA.filter(g => g.category === 'service'),
};

/**
 * 商品ID到数据的映射
 * @deprecated 新代码应使用 GoodsRegistry.getInstance().get()
 */
export const GOODS_MAP = new Map(GOODS_DATA.map(g => [g.id, g]));

/**
 * 获取商品数量统计
 */
export function getGoodsStats(): {
  total: number;
  byCategory: Record<string, number>;
} {
  return {
    total: GOODS_DATA.length,
    byCategory: {
      raw_material: GOODS_BY_CATEGORY.raw_material.length,
      basic_processed: GOODS_BY_CATEGORY.basic_processed.length,
      intermediate: GOODS_BY_CATEGORY.intermediate.length,
      consumer_good: GOODS_BY_CATEGORY.consumer_good.length,
      service: GOODS_BY_CATEGORY.service.length,
    },
  };
}