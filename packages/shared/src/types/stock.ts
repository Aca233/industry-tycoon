/**
 * Stock Market Types
 * 股票市场相关类型定义
 */

import type { EntityId, Money, GameTick, Percentage } from './common.js';

/**
 * 股票基本信息
 */
export interface Stock {
  /** 公司ID（等于股票代码） */
  companyId: EntityId;
  
  /** 股票代码（用于显示，如 "TQZ" 铁拳重工） */
  ticker: string;
  
  /** 总股本（发行股份总数） */
  totalShares: number;
  
  /** 流通股（可在市场交易的股份） */
  floatingShares: number;
  
  /** 当前股价 */
  currentPrice: Money;
  
  /** 开盘价（当日） */
  openPrice: Money;
  
  /** 最高价（当日） */
  highPrice: Money;
  
  /** 最低价（当日） */
  lowPrice: Money;
  
  /** 昨收价 */
  previousClose: Money;
  
  /** 市值 = 股价 × 总股本 */
  marketCap: Money;
  
  /** 市盈率 (P/E) = 股价 / 每股收益 */
  peRatio: number;
  
  /** 市净率 (P/B) = 市值 / 净资产 */
  pbRatio: number;
  
  /** 每股收益 (EPS) = 净利润 / 总股本 */
  eps: Money;
  
  /** 每股净资产 */
  bookValuePerShare: Money;
  
  /** 股息率（年化） */
  dividendYield: Percentage;
  
  /** 上次分红时间 */
  lastDividendTick: GameTick;
  
  /** 股价变化率（当日） */
  priceChangePercent: Percentage;
  
  /** 成交量（当日） */
  volume: number;
  
  /** 成交额（当日） */
  turnover: Money;
  
  /** 股票状态 */
  status: StockStatus;
  
  /** 上市时间 */
  listedTick: GameTick;
}

/**
 * 股票状态
 */
export enum StockStatus {
  /** 正常交易 */
  Trading = 'trading',
  /** 停牌 */
  Suspended = 'suspended',
  /** 涨停 */
  LimitUp = 'limit_up',
  /** 跌停 */
  LimitDown = 'limit_down',
  /** 退市 */
  Delisted = 'delisted',
}

/**
 * 股价历史记录（K线数据）
 */
export interface StockPriceHistory {
  tick: GameTick;
  open: Money;
  high: Money;
  low: Money;
  close: Money;
  volume: number;
  turnover: Money;
}

/**
 * 股东持股信息
 */
export interface Shareholding {
  /** 持股公司/个人ID */
  holderId: EntityId;
  
  /** 被持股公司ID */
  companyId: EntityId;
  
  /** 持股数量 */
  shares: number;
  
  /** 持股比例 */
  sharePercent: Percentage;
  
  /** 持仓成本 */
  costBasis: Money;
  
  /** 平均成本价 */
  avgCostPrice: Money;
  
  /** 首次持股时间 */
  firstAcquiredTick: GameTick;
  
  /** 持股类型 */
  type: ShareholdingType;
  
  /** 锁定期结束时间（如有） */
  lockupEndTick?: GameTick;
}

/**
 * 持股类型
 */
export enum ShareholdingType {
  /** 创始人股份 */
  Founder = 'founder',
  /** 战略投资 */
  Strategic = 'strategic',
  /** 公开市场买入 */
  Market = 'market',
  /** 收购获得 */
  Acquisition = 'acquisition',
}

/**
 * 股票订单
 */
export interface StockOrder {
  id: EntityId;
  
  /** 下单公司ID */
  companyId: EntityId;
  
  /** 股票代码（目标公司ID） */
  stockId: EntityId;
  
  /** 订单类型 */
  orderType: StockOrderType;
  
  /** 买/卖方向 */
  side: StockOrderSide;
  
  /** 委托数量 */
  quantity: number;
  
  /** 已成交数量 */
  filledQuantity: number;
  
  /** 剩余数量 */
  remainingQuantity: number;
  
  /** 限价（限价单有效，市价单时为 undefined） */
  limitPrice: Money | undefined;
  
  /** 订单状态 */
  status: StockOrderStatus;
  
  /** 下单时间 */
  createdTick: GameTick;
  
  /** 过期时间 */
  expiryTick: GameTick;
  
  /** 成交均价 */
  avgFillPrice?: Money;
  
  /** 总成交金额 */
  totalValue?: Money;
}

/**
 * 股票订单类型
 */
export enum StockOrderType {
  /** 市价单 - 立即以市价成交 */
  Market = 'market',
  /** 限价单 - 指定价格成交 */
  Limit = 'limit',
  /** 收购要约 - 公开收购要约 */
  TenderOffer = 'tender_offer',
}

/**
 * 订单方向
 */
export enum StockOrderSide {
  Buy = 'buy',
  Sell = 'sell',
}

/**
 * 订单状态
 */
export enum StockOrderStatus {
  Open = 'open',
  Partial = 'partial',
  Filled = 'filled',
  Cancelled = 'cancelled',
  Expired = 'expired',
  Rejected = 'rejected',
}

/**
 * 股票成交记录
 */
export interface StockTrade {
  id: EntityId;
  
  /** 股票代码（目标公司ID） */
  stockId: EntityId;
  
  /** 买方ID */
  buyerId: EntityId;
  
  /** 卖方ID */
  sellerId: EntityId;
  
  /** 成交价格 */
  price: Money;
  
  /** 成交数量 */
  quantity: number;
  
  /** 成交金额 */
  value: Money;
  
  /** 成交时间 */
  tick: GameTick;
  
  /** 买方订单ID */
  buyOrderId: EntityId;
  
  /** 卖方订单ID */
  sellOrderId: EntityId;
}

/**
 * 股息分红记录
 */
export interface DividendPayment {
  id: EntityId;
  
  /** 发放公司ID */
  companyId: EntityId;
  
  /** 每股股息 */
  dividendPerShare: Money;
  
  /** 总分红金额 */
  totalAmount: Money;
  
  /** 分红类型 */
  type: DividendType;
  
  /** 记录日（持股截止日） */
  recordTick: GameTick;
  
  /** 发放日 */
  paymentTick: GameTick;
  
  /** 分红来源 */
  source: 'profit' | 'reserve';
}

/**
 * 分红类型
 */
export enum DividendType {
  /** 现金分红 */
  Cash = 'cash',
  /** 送股（股票股利） */
  Stock = 'stock',
  /** 混合分红 */
  Mixed = 'mixed',
}

/**
 * 收购要约
 */
export interface TakeoverBid {
  id: EntityId;
  
  /** 收购方ID */
  acquirerId: EntityId;
  
  /** 目标公司ID */
  targetId: EntityId;
  
  /** 要约价格（每股） */
  offerPrice: Money;
  
  /** 溢价率（相对当前股价） */
  premium: Percentage;
  
  /** 目标股份数（0表示全额收购） */
  targetShares: number;
  
  /** 已获得承诺股份 */
  pledgedShares: number;
  
  /** 要约状态 */
  status: TakeoverStatus;
  
  /** 发起时间 */
  initiatedTick: GameTick;
  
  /** 截止时间 */
  expiryTick: GameTick;
  
  /** 收购理由（LLM生成） */
  rationale: string;
  
  /** 是否敌意收购 */
  hostile: boolean;
  
  /** 防御措施启动 */
  defenseActivated: boolean;
}

/**
 * 收购状态
 */
export enum TakeoverStatus {
  /** 要约中 */
  Pending = 'pending',
  /** 成功 */
  Successful = 'successful',
  /** 失败 */
  Failed = 'failed',
  /** 被拒绝 */
  Rejected = 'rejected',
  /** 撤回 */
  Withdrawn = 'withdrawn',
  /** 被白衣骑士击败 */
  DefendedByWhiteKnight = 'defended_by_white_knight',
}

/**
 * 公司财务指标（用于估值）
 */
export interface CompanyFinancials {
  companyId: EntityId;
  
  /** 报告期间 */
  period: { startTick: GameTick; endTick: GameTick };
  
  /** 总收入 */
  totalRevenue: Money;
  
  /** 总成本 */
  totalCost: Money;
  
  /** 净利润 */
  netIncome: Money;
  
  /** 总资产 */
  totalAssets: Money;
  
  /** 总负债 */
  totalLiabilities: Money;
  
  /** 净资产（股东权益） */
  netAssets: Money;
  
  /** 现金及等价物 */
  cashAndEquivalents: Money;
  
  /** 存货价值 */
  inventoryValue: Money;
  
  /** 建筑/设备价值 */
  fixedAssets: Money;
  
  /** 负债率 */
  debtRatio: Percentage;
  
  /** ROE（净资产收益率） */
  roe: Percentage;
  
  /** ROA（总资产收益率） */
  roa: Percentage;
}

/**
 * 股市整体状态
 */
export interface StockMarketState {
  /** 市场指数（综合指数） */
  marketIndex: number;
  
  /** 指数基准值 */
  indexBase: number;
  
  /** 市场情绪 */
  sentiment: MarketSentiment;
  
  /** 当日总成交额 */
  dailyTurnover: Money;
  
  /** 上涨股票数 */
  advancers: number;
  
  /** 下跌股票数 */
  decliners: number;
  
  /** 平盘股票数 */
  unchanged: number;
  
  /** 涨停股票 */
  limitUpStocks: EntityId[];
  
  /** 跌停股票 */
  limitDownStocks: EntityId[];
  
  /** 市场是否开放 */
  isOpen: boolean;
  
  /** 开盘时间（tick） */
  openTick: GameTick;
  
  /** 收盘时间（tick） */
  closeTick: GameTick;
}

/**
 * 市场情绪
 */
export enum MarketSentiment {
  /** 极度恐慌 */
  ExtremeFear = 'extreme_fear',
  /** 恐慌 */
  Fear = 'fear',
  /** 谨慎 */
  Cautious = 'cautious',
  /** 中性 */
  Neutral = 'neutral',
  /** 乐观 */
  Optimistic = 'optimistic',
  /** 贪婪 */
  Greedy = 'greedy',
  /** 极度贪婪 */
  ExtremeGreed = 'extreme_greed',
}

/**
 * 估值常量配置
 */
export const VALUATION_CONSTANTS = {
  /** 账面价值权重 */
  BOOK_VALUE_WEIGHT: 0.3,
  
  /** 盈利能力权重 */
  EARNINGS_WEIGHT: 0.7,
  
  /** 行业平均市盈率 */
  AVERAGE_PE_RATIO: 15,
  
  /** 最低市盈率 */
  MIN_PE_RATIO: 5,
  
  /** 最高市盈率 */
  MAX_PE_RATIO: 50,
  
  /** 价格波动限制（每tick） */
  PRICE_CHANGE_LIMIT: 0.02, // 2%
  
  /** 涨跌停限制（每日） */
  DAILY_LIMIT: 0.10, // 10%
  
  /** 情绪影响衰减率 */
  SENTIMENT_DECAY: 0.05,
  
  /** 成交量平滑系数 */
  VOLUME_SMOOTHING: 0.1,
  
  /** 分红频率（tick数，每月一次） */
  DIVIDEND_FREQUENCY: 720,
  
  /** 分红比例上限 */
  MAX_DIVIDEND_PAYOUT: 0.5, // 净利润的50%
  
  /** 收购触发持股比例 */
  TAKEOVER_THRESHOLD: 0.30, // 30%
  
  /** 控股比例 */
  CONTROL_THRESHOLD: 0.51, // 51%
  
  /** 绝对控制比例 */
  ABSOLUTE_CONTROL: 0.67, // 67%
  
  /** 股票订单默认过期时间（tick数） */
  DEFAULT_ORDER_EXPIRY: 48, // 2天
  
  /** 初始股价基数 */
  INITIAL_STOCK_PRICE_BASE: 10000, // ¥100.00 (以分为单位)
  
  /** 初始总股本 */
  DEFAULT_TOTAL_SHARES: 10000000, // 1000万股
  
  /** 流通股比例 */
  FLOATING_SHARES_RATIO: 0.4, // 40%流通
} as const;

/**
 * 防御措施类型
 */
export enum DefenseMeasure {
  /** 毒丸计划 - 大量增发股份稀释收购方持股 */
  PoisonPill = 'poison_pill',
  
  /** 白衣骑士 - 引入友好的收购方 */
  WhiteKnight = 'white_knight',
  
  /** 焦土策略 - 出售核心资产降低吸引力 */
  ScorchedEarth = 'scorched_earth',
  
  /** 金降落伞 - 高额离职补偿增加成本 */
  GoldenParachute = 'golden_parachute',
  
  /** 反诉 - 发起反向收购 */
  PacManDefense = 'pac_man',
  
  /** 政府求助 - 申请反垄断审查 */
  RegulatoryAppeal = 'regulatory_appeal',
}

/**
 * 股票市场更新事件
 */
export interface StockMarketUpdate {
  tick: GameTick;
  stocks: Map<EntityId, Stock>;
  trades: StockTrade[];
  marketState: StockMarketState;
  dividends: DividendPayment[] | undefined;
  takeoverUpdates: TakeoverBid[] | undefined;
}

/**
 * 股票订单请求
 */
export interface StockOrderRequest {
  companyId: EntityId;
  stockId: EntityId;
  orderType: StockOrderType;
  side: StockOrderSide;
  quantity: number;
  limitPrice: Money | undefined;
}

/**
 * 股票订单结果
 */
export interface StockOrderResult {
  success: boolean;
  order?: StockOrder;
  error?: string;
  immediatelyFilled?: boolean;
  fillPrice?: Money;
}

/**
 * 公司估值结果
 */
export interface CompanyValuation {
  companyId: EntityId;
  tick: GameTick;
  
  /** 基于资产的估值 */
  assetBasedValue: Money;
  
  /** 基于盈利的估值 */
  earningsBasedValue: Money;
  
  /** 综合估值 */
  fairValue: Money;
  
  /** 当前市价 */
  marketPrice: Money;
  
  /** 高估/低估百分比 */
  premiumDiscount: Percentage;
  
  /** 估值评级 */
  rating: 'undervalued' | 'fair' | 'overvalued';
}