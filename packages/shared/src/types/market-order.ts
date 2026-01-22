/**
 * 市场订单系统类型定义
 * 管理买卖订单、订单簿和市场状态
 */

import type { EntityId } from './common.js';

/**
 * 订单类型
 */
export type OrderType = 'buy' | 'sell';

/**
 * 订单状态
 */
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled' | 'expired';

/**
 * 市场订单
 */
export interface MarketOrder {
  /** 订单ID */
  id: EntityId;
  /** 公司ID */
  companyId: EntityId;
  /** 商品ID */
  goodsId: EntityId;
  /** 订单类型 */
  orderType: OrderType;
  /** 原始数量 */
  quantity: number;
  /** 剩余数量 */
  remainingQuantity: number;
  /** 价格（买单为最高可接受价，卖单为最低可接受价） */
  pricePerUnit: number;
  /** 订单状态 */
  status: OrderStatus;
  /** 创建时间 */
  createdTick: number;
  /** 过期时间（0表示永不过期） */
  expiryTick: number;
  /** 最后更新时间 */
  lastUpdateTick: number;
}

/**
 * 订单创建请求
 */
export interface CreateOrderRequest {
  companyId: EntityId;
  goodsId: EntityId;
  orderType: OrderType;
  quantity: number;
  pricePerUnit: number;
  /** 有效期（tick数，0表示当日有效） */
  validityTicks?: number;
}

/**
 * 单个商品的订单簿
 */
export interface GoodsOrderBook {
  /** 商品ID */
  goodsId: EntityId;
  /** 买单（按价格降序排列，价高者优先） */
  buyOrders: MarketOrder[];
  /** 卖单（按价格升序排列，价低者优先） */
  sellOrders: MarketOrder[];
  /** 最佳买价（最高买入价） */
  bestBid: number | null;
  /** 最佳卖价（最低卖出价） */
  bestAsk: number | null;
  /** 买卖价差 */
  spread: number | null;
}

/**
 * 市场深度档位
 */
export interface MarketDepthLevel {
  price: number;
  quantity: number;
  orderCount: number;
  /** 该价格档位的公司列表 (公司ID -> 数量) */
  companies?: Array<{
    companyId: EntityId;
    quantity: number;
  }>;
}

/**
 * 市场深度数据
 */
export interface MarketDepth {
  goodsId: EntityId;
  bids: MarketDepthLevel[];
  asks: MarketDepthLevel[];
  /** 最佳买价（最高买入价） */
  bestBid: number | null;
  /** 最佳卖价（最低卖出价） */
  bestAsk: number | null;
  /** 买卖价差 */
  spread: number | null;
  /** 买单总量 */
  totalBuyVolume: number;
  /** 卖单总量 */
  totalSellVolume: number;
}

/**
 * 单个商品的市场状态
 */
export interface GoodsMarketState {
  /** 商品ID */
  goodsId: EntityId;
  /** 当前市场价格（最近成交价） */
  currentPrice: number;
  /** 基准价格 */
  basePrice: number;
  /** 开盘价（24h内第一笔成交） */
  openPrice: number;
  /** 最高价（24h） */
  highPrice: number;
  /** 最低价（24h） */
  lowPrice: number;
  /** 收盘价（上一个24h的最后成交价） */
  closePrice: number;
  /** 24h成交量 */
  volume24h: number;
  /** 24h成交额 */
  turnover24h: number;
  /** 价格变化百分比 */
  priceChangePercent: number;
  /** 未成交订单总量 */
  openInterest: number;
  /** 最后成交时间 */
  lastTradeTick: number;
}

/**
 * 市场整体状态
 */
export interface MarketState {
  /** 所有商品的市场状态 */
  goods: Record<EntityId, GoodsMarketState>;
  /** 当前tick */
  currentTick: number;
  /** 总成交量（所有商品） */
  totalVolume24h: number;
  /** 总成交额 */
  totalTurnover24h: number;
}

/**
 * 价格报价
 */
export interface PriceQuote {
  goodsId: EntityId;
  bid: number | null;
  ask: number | null;
  last: number;
  change: number;
  changePercent: number;
  volume: number;
}