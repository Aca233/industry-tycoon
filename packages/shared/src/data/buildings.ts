/**
 * 建筑定义数据 - 兼容层
 * 
 * 此文件从新的声明式配置系统 (buildingDefinitions.ts) 自动生成传统格式数据。
 * 所有建筑定义已迁移到 buildingDefinitions.ts。
 */

import type { EntityId } from '../types/common.js';
import {
  BUILDING_DEFINITIONS,
  type BuildingDef,
  type ProductionMethodDefinition,
  type ProductionSlotDefinition,
  type BuildingGoodsRelation,
  getBuildingsProducingGoods,
  getBuildingsConsumingGoods
} from './buildingDefinitions.js';

export interface ProductionRecipe {
  inputs: Array<{ goodsId: EntityId; amount: number }>;
  outputs: Array<{ goodsId: EntityId; amount: number }>;
  ticksRequired: number;
}

export interface ProductionMethodData {
  id: EntityId;
  name: string;
  nameZh: string;
  description: string;
  recipe: ProductionRecipe;
  laborRequired: number;
  powerRequired: number;
  efficiency: number; // 基础效率 0-2
}

export interface ProductionSlotData {
  type: 'process' | 'automation' | 'energy' | 'labor';
  name: string;
  methods: ProductionMethodData[];
  defaultMethodId: EntityId;
}

/** 建筑类别 - 兼容新架构的 'energy' 类别 */
export type LegacyBuildingCategory = 'extraction' | 'processing' | 'manufacturing' | 'service' | 'logistics' | 'retail' | 'agriculture' | 'energy';

export interface BuildingData {
  id: EntityId;
  name: string;
  nameZh: string;
  category: LegacyBuildingCategory;
  subcategory: string;
  description: string;
  icon: string;
  size: 'small' | 'medium' | 'large' | 'huge';
  baseCost: number; // 建造成本（分）
  maintenanceCost: number; // 每tick维护成本
  maxWorkers: number;
  productionSlots: ProductionSlotData[];
}

// ============ 兼容层：从新格式生成传统格式 ============

/**
 * 将新格式的 ProductionMethodDefinition 转换为传统格式
 */
function convertMethodToLegacy(method: ProductionMethodDefinition): ProductionMethodData {
  return {
    id: method.id as EntityId,
    name: method.name || method.id,
    nameZh: method.nameZh,
    description: method.description || '',
    recipe: {
      inputs: method.recipe.inputs.map(i => ({
        goodsId: i.goodsId as EntityId,
        amount: i.amount
      })),
      outputs: method.recipe.outputs.map(o => ({
        goodsId: o.goodsId as EntityId,
        amount: o.amount
      })),
      ticksRequired: method.recipe.ticksRequired,
    },
    laborRequired: method.laborRequired,
    powerRequired: method.powerRequired,
    efficiency: method.efficiency,
  };
}

/**
 * 将新格式的 ProductionSlotDefinition 转换为传统格式
 */
function convertSlotToLegacy(slot: ProductionSlotDefinition): ProductionSlotData {
  return {
    type: slot.type === 'quality' ? 'process' : slot.type, // quality 映射到 process
    name: slot.name,
    methods: slot.methods.map(convertMethodToLegacy),
    defaultMethodId: slot.defaultMethodId as EntityId,
  };
}

/**
 * 将新格式的 BuildingDef 转换为传统格式
 */
function convertBuildingToLegacy(id: string, def: BuildingDef): BuildingData {
  return {
    id: id as EntityId,
    name: def.name || id,
    nameZh: def.nameZh,
    category: def.category,
    subcategory: def.subcategory || '',
    description: def.description || '',
    icon: def.icon,
    size: def.size,
    baseCost: def.baseCost,
    maintenanceCost: def.maintenanceCost,
    maxWorkers: def.maxWorkers,
    productionSlots: def.productionSlots.map(convertSlotToLegacy),
  };
}

/**
 * 从 BUILDING_DEFINITIONS 自动生成 BUILDINGS_DATA
 */
function generateBuildingsData(): BuildingData[] {
  return Object.entries(BUILDING_DEFINITIONS).map(([id, def]) => 
    convertBuildingToLegacy(id, def)
  );
}

/**
 * 第一批建筑数据 - 从新格式自动生成
 */
export const BUILDINGS_DATA: BuildingData[] = generateBuildingsData();

// 按类别分组
export const BUILDINGS_BY_CATEGORY = {
  extraction: BUILDINGS_DATA.filter(b => b.category === 'extraction'),
  processing: BUILDINGS_DATA.filter(b => b.category === 'processing'),
  manufacturing: BUILDINGS_DATA.filter(b => b.category === 'manufacturing'),
  service: BUILDINGS_DATA.filter(b => b.category === 'service'),
  logistics: BUILDINGS_DATA.filter(b => b.category === 'logistics'),
  retail: BUILDINGS_DATA.filter(b => b.category === 'retail'),
  agriculture: BUILDINGS_DATA.filter(b => b.category === 'agriculture'),
  energy: BUILDINGS_DATA.filter(b => b.category === 'energy'),
};

// 建筑ID到数据的映射
export const BUILDINGS_MAP = new Map(BUILDINGS_DATA.map(b => [b.id, b]));

// ============ 辅助函数 ============

/**
 * 获取建筑数据（从新格式转换）
 */
export function getBuilding(id: EntityId): BuildingData | undefined {
  const newDef = BUILDING_DEFINITIONS[id];
  if (newDef) {
    return convertBuildingToLegacy(id, newDef);
  }
  return undefined;
}

/**
 * 检查建筑是否存在
 */
export function isBuildingMigrated(id: EntityId): boolean {
  return id in BUILDING_DEFINITIONS;
}

/**
 * 获取所有建筑ID
 */
export function getMigratedBuildingIds(): string[] {
  return Object.keys(BUILDING_DEFINITIONS);
}

/**
 * 获取所有建筑ID（别名，保持兼容）
 */
export function getUnmigratedBuildingIds(): EntityId[] {
  // 所有建筑都已迁移，返回空数组
  return [];
}

// ============ 商品-建筑关联查询（代理到新格式） ============

/**
 * 从新格式搜索生产指定商品的建筑
 */
export function getBuildingsProducingGoodsFromData(goodsId: string): BuildingGoodsRelation[] {
  return getBuildingsProducingGoods(goodsId);
}

/**
 * 从新格式搜索消耗指定商品的建筑
 */
export function getBuildingsConsumingGoodsFromData(goodsId: string): BuildingGoodsRelation[] {
  return getBuildingsConsumingGoods(goodsId);
}