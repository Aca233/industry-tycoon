/**
 * 统一注册表系统 - 导出入口
 */

// 核心类型
export * from './types.js';

// 商品注册表
export { GoodsRegistry, getGoodsRegistry } from './GoodsRegistry.js';

// 建筑注册表
export { BuildingRegistry, getBuildingRegistry } from './BuildingRegistry.js';

// 产业链注册表
export { SupplyChainRegistry, getSupplyChainRegistry } from './SupplyChainRegistry.js';

// 初始化函数
export {
  initializeRegistries,
  resetRegistries,
  isRegistryInitialized
} from './initRegistry.js';