/**
 * @scc/shared - Shared types and constants for Supply Chain Commander
 */

// Types
export * from './types/index.js';

// Constants
export * from './constants/index.js';

// Game Data
export * from './data/index.js';

// Registry System
export { initializeRegistries, isRegistryInitialized, resetRegistries } from './registry/initRegistry.js';
export { GoodsRegistry, getGoodsRegistry } from './registry/GoodsRegistry.js';
export { BuildingRegistry, getBuildingRegistry } from './registry/BuildingRegistry.js';
export { SupplyChainRegistry, getSupplyChainRegistry } from './registry/SupplyChainRegistry.js';
export {
  getDataValidator,
  validateGameData,
  isGameDataValid,
  type ValidationIssue,
  type ValidationResult,
  type ValidationConfig,
  type ValidationSeverity,
  type ValidationCategory
} from './registry/DataValidator.js';