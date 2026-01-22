/**
 * 游戏数据导出索引
 */

// 传统数据（待迁移）
export * from './goods.js';
export * from './buildings.js';
export * from './ai-companies.js';

// 公司信息映射表（用于UI显示）
export * from './company-info.js';

// 新架构：声明式配置
export * from './goodsDefinitions.js';
export * from './buildingDefinitions.js';

// POPs 需求系统配置
export * from './popsConfig.js';