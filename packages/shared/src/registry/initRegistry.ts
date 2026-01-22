/**
 * 注册表初始化模块
 * 负责加载所有定义并初始化各注册表
 */

import { GoodsRegistry, getGoodsRegistry } from './GoodsRegistry.js';
import { BuildingRegistry, getBuildingRegistry } from './BuildingRegistry.js';
import { SupplyChainRegistry, getSupplyChainRegistry } from './SupplyChainRegistry.js';
import { GOODS_DEFINITIONS } from '../data/goodsDefinitions.js';
import { BUILDING_DEFINITIONS } from '../data/buildingDefinitions.js';

let initialized = false;

/**
 * 初始化所有注册表
 * 按顺序加载：商品 -> 建筑 -> 产业链
 */
export function initializeRegistries(): void {
  if (initialized) {
    console.log('[Registry] 注册表已初始化，跳过');
    return;
  }
  
  console.log('[Registry] 开始初始化注册表...');
  
  // 1. 初始化商品注册表
  initializeGoodsRegistry();
  
  // 2. 初始化建筑注册表（依赖商品注册表）
  initializeBuildingRegistry();
  
  // 3. 初始化产业链注册表（依赖商品和建筑注册表）
  initializeSupplyChainRegistry();
  
  initialized = true;
  console.log('[Registry] 注册表初始化完成');
}

/**
 * 初始化商品注册表
 */
function initializeGoodsRegistry(): void {
  console.log('[Registry] 初始化商品注册表...');
  const goodsRegistry = getGoodsRegistry();
  
  // 注册所有商品
  goodsRegistry.registerAll(GOODS_DEFINITIONS);
  
  // 输出统计信息
  const stats = goodsRegistry.getStats();
  console.log(`[Registry] 商品注册完成: 总计 ${stats.totalCount} 种商品`);
  console.log(`[Registry]   - 消费品: ${stats.consumerGoodsCount} 种`);
  console.log(`[Registry]   - 标签数: ${stats.tagCount} 个`);
}

/**
 * 初始化建筑注册表
 */
function initializeBuildingRegistry(): void {
  console.log('[Registry] 初始化建筑注册表...');
  const buildingRegistry = getBuildingRegistry();
  
  // 注册建筑模板
  registerBuildingTemplates(buildingRegistry);
  
  // 从 buildingDefinitions.ts 加载建筑配置
  buildingRegistry.registerAllFromDefinitions(BUILDING_DEFINITIONS);
  
  console.log(`[Registry] 建筑注册表初始化完成，共 ${buildingRegistry.getAll().length} 个建筑`);
}

/**
 * 注册建筑模板
 */
function registerBuildingTemplates(registry: BuildingRegistry): void {
  // 采掘业模板
  registry.registerTemplate('EXTRACTION', {
    category: 'extraction',
    baseWorkers: 20,
    baseCost: 5000000,
    baseMaintenance: 50000,
    slotTemplates: [
      {
        type: 'process',
        nameZh: '采掘工艺',
      },
      {
        type: 'automation',
        nameZh: '自动化等级',
        commonMethods: [
          {
            id: 'manual',
            nameZh: '人工采掘',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 1.0,
            efficiencyMultiplier: 1.0,
          },
          {
            id: 'semi-auto',
            nameZh: '半自动化',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 0.7,
            efficiencyMultiplier: 1.2,
            requiresTech: 'automation-1',
          },
          {
            id: 'full-auto',
            nameZh: '全自动化',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 0.3,
            efficiencyMultiplier: 1.5,
            requiresTech: 'automation-2',
          },
        ],
      },
    ],
  });
  
  // 加工业模板
  registry.registerTemplate('PROCESSING', {
    category: 'processing',
    baseWorkers: 50,
    baseCost: 15000000,
    baseMaintenance: 100000,
    slotTemplates: [
      {
        type: 'process',
        nameZh: '加工工艺',
      },
      {
        type: 'automation',
        nameZh: '自动化等级',
        commonMethods: [
          {
            id: 'basic',
            nameZh: '基础加工',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 1.0,
            efficiencyMultiplier: 1.0,
          },
          {
            id: 'advanced',
            nameZh: '高级加工',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 0.6,
            efficiencyMultiplier: 1.4,
            requiresTech: 'processing-upgrade',
          },
        ],
      },
      {
        type: 'quality',
        nameZh: '质量控制',
        commonMethods: [
          {
            id: 'standard',
            nameZh: '标准质检',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            qualityMultiplier: 1.0,
          },
          {
            id: 'enhanced',
            nameZh: '强化质检',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            qualityMultiplier: 1.2,
            efficiencyMultiplier: 0.9,
          },
        ],
      },
    ],
  });
  
  // 制造业模板
  registry.registerTemplate('MANUFACTURING', {
    category: 'manufacturing',
    baseWorkers: 100,
    baseCost: 50000000,
    baseMaintenance: 300000,
    slotTemplates: [
      {
        type: 'process',
        nameZh: '生产工艺',
      },
      {
        type: 'automation',
        nameZh: '自动化等级',
        commonMethods: [
          {
            id: 'assembly-line',
            nameZh: '流水线生产',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 1.0,
            efficiencyMultiplier: 1.0,
          },
          {
            id: 'robotic',
            nameZh: '机器人生产',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 0.4,
            efficiencyMultiplier: 1.6,
            requiresTech: 'robotics',
          },
          {
            id: 'ai-assisted',
            nameZh: 'AI智造',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 0.2,
            efficiencyMultiplier: 2.0,
            requiresTech: 'ai-manufacturing',
          },
        ],
      },
      {
        type: 'quality',
        nameZh: '质量控制',
      },
    ],
  });
  
  // 能源模板
  registry.registerTemplate('ENERGY', {
    category: 'energy',
    baseWorkers: 30,
    baseCost: 30000000,
    baseMaintenance: 150000,
    slotTemplates: [
      {
        type: 'process',
        nameZh: '发电方式',
      },
      {
        type: 'energy',
        nameZh: '能源效率',
        commonMethods: [
          {
            id: 'standard',
            nameZh: '标准效率',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            powerMultiplier: 1.0,
          },
          {
            id: 'high-efficiency',
            nameZh: '高效模式',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            powerMultiplier: 1.3,
            requiresTech: 'energy-efficiency',
          },
        ],
      },
    ],
  });
  
  // 零售模板
  registry.registerTemplate('RETAIL', {
    category: 'retail',
    baseWorkers: 15,
    baseCost: 2000000,
    baseMaintenance: 30000,
    slotTemplates: [
      {
        type: 'process',
        nameZh: '销售模式',
      },
    ],
  });
  
  // 农业模板
  registry.registerTemplate('AGRICULTURE', {
    category: 'agriculture',
    baseWorkers: 10,
    baseCost: 3000000,
    baseMaintenance: 20000,
    slotTemplates: [
      {
        type: 'process',
        nameZh: '种植方式',
      },
      {
        type: 'automation',
        nameZh: '自动化等级',
        commonMethods: [
          {
            id: 'traditional',
            nameZh: '传统耕作',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 1.0,
            efficiencyMultiplier: 1.0,
          },
          {
            id: 'mechanized',
            nameZh: '机械化',
            recipe: { inputs: [], outputs: [], ticksRequired: 1 },
            laborMultiplier: 0.5,
            efficiencyMultiplier: 1.5,
            requiresTech: 'mechanized-farming',
          },
        ],
      },
    ],
  });
  
  console.log('[Registry] 已注册 6 个建筑模板');
}

/**
 * 初始化产业链注册表
 */
function initializeSupplyChainRegistry(): void {
  console.log('[Registry] 初始化产业链注册表...');
  const supplyChainRegistry = getSupplyChainRegistry();
  
  // 构建产业链图
  supplyChainRegistry.buildGraph();
  
  console.log('[Registry] 产业链注册表初始化完成');
}

/**
 * 检查注册表是否已初始化
 */
export function isRegistryInitialized(): boolean {
  return initialized;
}

/**
 * 重置所有注册表（仅用于测试）
 */
export function resetRegistries(): void {
  GoodsRegistry.resetInstance();
  BuildingRegistry.resetInstance();
  SupplyChainRegistry.resetInstance();
  initialized = false;
  console.log('[Registry] 注册表已重置');
}