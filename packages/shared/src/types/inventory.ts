/**
 * 库存系统类型定义
 * 管理公司的商品库存、预留和成本追踪
 */

import type { EntityId } from './common.js';
import { CompanyType } from './company.js';

/**
 * 单个商品的库存状态
 */
export interface GoodsStock {
  /** 商品ID */
  goodsId: EntityId;
  /** 可用数量（未被预留的库存） */
  quantity: number;
  /** 已预留用于销售（挂卖单） */
  reservedForSale: number;
  /** 已预留用于生产（原料锁定） */
  reservedForProduction: number;
  /** 加权平均成本（用于计算利润） */
  avgCost: number;
  /** 最后更新时间（tick） */
  lastUpdateTick: number;
}

/**
 * 公司库存
 */
export interface CompanyInventory {
  /** 公司ID */
  companyId: EntityId;
  /** 公司类型 */
  companyType: CompanyType;
  /** 公司名称 */
  companyName: string;
  /** 现金余额 */
  cash: number;
  /** 商品库存 Map<goodsId, GoodsStock> */
  stocks: Record<EntityId, GoodsStock>;
  /** 创建时间 */
  createdTick: number;
}

/**
 * 库存变更记录
 */
export interface InventoryChange {
  /** 公司ID */
  companyId: EntityId;
  /** 商品ID */
  goodsId: EntityId;
  /** 变更类型 */
  changeType: 'add' | 'consume' | 'reserve_sale' | 'unreserve_sale' | 'reserve_production' | 'unreserve_production' | 'trade';
  /** 变更数量（正为增加，负为减少） */
  quantity: number;
  /** 变更原因 */
  reason: string;
  /** 相关交易ID（如果是交易引起的） */
  tradeId?: EntityId;
  /** 发生时间 */
  tick: number;
}

/**
 * 库存快照（用于UI显示）
 */
export interface InventorySnapshot {
  companyId: EntityId;
  companyName: string;
  cash: number;
  stocks: Array<{
    goodsId: EntityId;
    goodsName: string;
    quantity: number;
    reservedForSale: number;
    reservedForProduction: number;
    totalQuantity: number;
    avgCost: number;
    marketValue: number;
  }>;
  totalValue: number;
}