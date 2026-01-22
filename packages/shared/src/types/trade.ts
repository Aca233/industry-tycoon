/**
 * 交易记录类型定义
 * 记录市场上的所有交易历史
 */

import type { EntityId } from './common.js';

/**
 * 交易记录
 */
export interface TradeRecord {
  /** 交易ID */
  id: EntityId;
  /** 商品ID */
  goodsId: EntityId;
  /** 买方公司ID */
  buyerCompanyId: EntityId;
  /** 卖方公司ID */
  sellerCompanyId: EntityId;
  /** 买单ID */
  buyOrderId: EntityId;
  /** 卖单ID */
  sellOrderId: EntityId;
  /** 成交数量 */
  quantity: number;
  /** 成交单价 */
  pricePerUnit: number;
  /** 成交总额 */
  totalValue: number;
  /** 成交时间 */
  tick: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 交易摘要（用于UI显示）
 */
export interface TradeSummary {
  goodsId: EntityId;
  goodsName: string;
  totalVolume: number;
  totalTurnover: number;
  avgPrice: number;
  highPrice: number;
  lowPrice: number;
  tradeCount: number;
  lastTradePrice: number;
  lastTradeTick: number;
}

/**
 * 公司交易历史
 */
export interface CompanyTradeHistory {
  companyId: EntityId;
  /** 作为买方的交易 */
  purchases: TradeRecord[];
  /** 作为卖方的交易 */
  sales: TradeRecord[];
  /** 总采购额 */
  totalPurchaseValue: number;
  /** 总销售额 */
  totalSalesValue: number;
  /** 净交易额（销售 - 采购） */
  netTradeValue: number;
}

/**
 * 价格历史数据点（OHLCV格式，用于K线图）
 */
export interface PriceHistoryPointOHLCV {
  tick: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

/**
 * 价格历史数据点（简化格式，用于价格发现）
 */
export interface PriceHistoryPoint {
  tick: number;
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

/**
 * 商品价格历史
 */
export interface GoodsPriceHistory {
  goodsId: EntityId;
  /** 按时间排序的价格数据 */
  data: PriceHistoryPoint[];
  /** 移动平均线 */
  ma5?: number;
  ma10?: number;
  ma20?: number;
}

/**
 * 市场交易统计
 */
export interface MarketTradeStats {
  /** 统计周期开始tick */
  startTick: number;
  /** 统计周期结束tick */
  endTick: number;
  /** 各商品的交易摘要 */
  goodsSummaries: Record<EntityId, TradeSummary>;
  /** 总成交笔数 */
  totalTradeCount: number;
  /** 总成交量 */
  totalVolume: number;
  /** 总成交额 */
  totalTurnover: number;
  /** 活跃商品数量 */
  activeGoodsCount: number;
  /** 最活跃商品 */
  mostActiveGoods: EntityId | null;
}