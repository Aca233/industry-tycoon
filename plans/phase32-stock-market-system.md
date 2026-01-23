# Phase 32: 股市机制设计文档

## Stock Market System Design Document

### 版本: 1.0
### 日期: 2026-01-23
### 状态: 设计中

---

## 1. 概述

本文档定义《供应链指挥官：算法都市》的股票市场系统。根据GDD第六章第6.5节的设计：

> "股票市场：每家公司（包括你）都有股价。股价由当前利润和LLM生成的未来预期决定。恶意收购：当对手因为一次错误的 LLM 事件判断导致亏损时，股价下跌。你可以趁机发起收购。"

### 1.1 核心目标

1. **公司估值系统** - 基于资产、利润、市场份额计算合理股价
2. **股票交易市场** - 玩家和AI可以买卖公司股份
3. **股息分红机制** - 持股者获得公司利润分红
4. **收购控股系统** - 通过股份积累控制其他公司

### 1.2 设计原则

- **经济一致性**: 股价反映真实的公司价值
- **策略深度**: 投资决策影响长期发展
- **对抗性**: 恶意收购和防御机制创造博弈
- **可读性**: 清晰的UI展示股市状态

---

## 2. 数据类型定义

### 2.1 股票基础类型

```typescript
// packages/shared/src/types/stock.ts

import { EntityId, Money, GameTick, Percentage, Timestamp } from './common';

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
  
  /** 限价（限价单有效） */
  limitPrice?: Money;
  
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
```

### 2.2 股市状态类型

```typescript
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
```

---

## 3. 股价计算模型

### 3.1 基础估值公式

股价由以下因素综合决定：

```
股价 = 基础价值 × 市场乘数 × 情绪乘数 × 流动性乘数

其中：
- 基础价值 = (净资产/股本) × 账面价值权重 + (净利润/股本) × P/E × 盈利权重
- 市场乘数 = 1 + 供需偏差 × 调整系数
- 情绪乘数 = 0.8 ~ 1.5 (根据LLM事件和市场情绪)
- 流动性乘数 = 0.9 ~ 1.1 (根据成交量)
```

### 3.2 估值参数

```typescript
/**
 * 估值参数配置
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
};
```

### 3.3 股价更新流程

```
每 tick 执行:
1. 计算各公司财务指标
2. 计算基础估值
3. 处理股票订单撮合
4. 更新供需关系
5. 应用市场情绪影响
6. 限制价格波动范围
7. 更新股价和K线数据
8. 检查涨跌停
9. 广播价格更新
```

---

## 4. 服务层设计

### 4.1 StockMarketService

```typescript
// packages/server/src/services/stockMarket.ts

/**
 * 股票市场服务
 * 负责股价计算、订单撮合、分红处理
 */
export class StockMarketService {
  // 股票数据
  private stocks: Map<EntityId, Stock>;
  
  // 股东持股表
  private shareholdings: Map<EntityId, Shareholding[]>;
  
  // 订单簿（每只股票一个）
  private orderBooks: Map<EntityId, StockOrderBook>;
  
  // 成交记录
  private trades: StockTrade[];
  
  // 市场状态
  private marketState: StockMarketState;
  
  // 财务数据缓存
  private financialsCache: Map<EntityId, CompanyFinancials>;
  
  /**
   * 初始化股票市场
   */
  initialize(companies: Company[]): void;
  
  /**
   * 每tick更新
   */
  processTick(context: GameContext): StockMarketUpdate;
  
  /**
   * 计算公司估值
   */
  calculateValuation(companyId: EntityId): CompanyValuation;
  
  /**
   * 提交股票订单
   */
  submitOrder(order: StockOrderRequest): StockOrderResult;
  
  /**
   * 撮合订单
   */
  matchOrders(stockId: EntityId): StockTrade[];
  
  /**
   * 更新股价
   */
  updateStockPrice(stockId: EntityId): void;
  
  /**
   * 处理分红
   */
  processDividends(tick: GameTick): DividendPayment[];
  
  /**
   * 发起收购要约
   */
  initiateTakeover(bid: TakeoverBidRequest): TakeoverBidResult;
  
  /**
   * 处理收购
   */
  processTakeovers(tick: GameTick): TakeoverOutcome[];
  
  /**
   * 获取股票信息
   */
  getStock(stockId: EntityId): Stock | undefined;
  
  /**
   * 获取持股信息
   */
  getShareholdings(holderId: EntityId): Shareholding[];
  
  /**
   * 获取公司股东列表
   */
  getStockholders(companyId: EntityId): Shareholding[];
  
  /**
   * 获取市场状态
   */
  getMarketState(): StockMarketState;
}
```

### 4.2 股价计算核心逻辑

```typescript
/**
 * 计算股票价格
 */
private calculateStockPrice(
  companyId: EntityId,
  financials: CompanyFinancials,
  orderBook: StockOrderBook,
  sentiment: number
): Money {
  const stock = this.stocks.get(companyId);
  if (!stock) throw new Error('Stock not found');
  
  // 1. 计算基础价值
  const bookValue = financials.netAssets / stock.totalShares;
  const earningsValue = financials.netIncome > 0
    ? (financials.netIncome / stock.totalShares) * VALUATION_CONSTANTS.AVERAGE_PE_RATIO
    : bookValue * 0.5; // 亏损时用折价账面价值
  
  const baseValue = 
    bookValue * VALUATION_CONSTANTS.BOOK_VALUE_WEIGHT +
    earningsValue * VALUATION_CONSTANTS.EARNINGS_WEIGHT;
  
  // 2. 计算供需乘数
  const { buyVolume, sellVolume } = orderBook.getOrderVolumes();
  const supplyDemandRatio = buyVolume / (sellVolume + 1);
  const marketMultiplier = 1 + (supplyDemandRatio - 1) * 0.1; // 限制影响
  
  // 3. 情绪乘数
  const sentimentMultiplier = 0.8 + sentiment * 0.4; // 0.8 ~ 1.2
  
  // 4. 流动性乘数
  const avgVolume = this.getAverageVolume(companyId);
  const currentVolume = stock.volume;
  const liquidityMultiplier = currentVolume > avgVolume * 0.5 ? 1.05 : 0.95;
  
  // 5. 计算新价格
  let newPrice = baseValue * marketMultiplier * sentimentMultiplier * liquidityMultiplier;
  
  // 6. 限制价格波动
  const priceChange = (newPrice - stock.currentPrice) / stock.currentPrice;
  if (Math.abs(priceChange) > VALUATION_CONSTANTS.PRICE_CHANGE_LIMIT) {
    const sign = priceChange > 0 ? 1 : -1;
    newPrice = stock.currentPrice * (1 + sign * VALUATION_CONSTANTS.PRICE_CHANGE_LIMIT);
  }
  
  // 7. 检查涨跌停
  const dailyChange = (newPrice - stock.openPrice) / stock.openPrice;
  if (dailyChange >= VALUATION_CONSTANTS.DAILY_LIMIT) {
    newPrice = stock.openPrice * (1 + VALUATION_CONSTANTS.DAILY_LIMIT);
    stock.status = StockStatus.LimitUp;
  } else if (dailyChange <= -VALUATION_CONSTANTS.DAILY_LIMIT) {
    newPrice = stock.openPrice * (1 - VALUATION_CONSTANTS.DAILY_LIMIT);
    stock.status = StockStatus.LimitDown;
  }
  
  return Math.round(newPrice);
}
```

---

## 5. UI设计

### 5.1 股市面板布局

在左侧导航栏添加"📈 股票市场"入口，点击后在中央区域显示：

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📈 股票市场                                          市场状态: 交易中   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ 综合指数                     │  │ 市场概况                         │  │
│  │     ▲ 1,245.67 (+2.3%)      │  │ 上涨: 5  下跌: 2  平盘: 1        │  │
│  │  [指数K线图]                 │  │ 成交额: ¥45.2亿                  │  │
│  │                              │  │ 情绪: 🟢 乐观                    │  │
│  └─────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 股票列表                                                          │   │
│  │ ─────────────────────────────────────────────────────────────── │   │
│  │ 代码    公司名        股价       涨跌%    市值       市盈率  操作  │   │
│  │ ─────────────────────────────────────────────────────────────── │   │
│  │ PLAY   玩家公司     ¥45.00    +5.2%   ¥4.5亿     12.5   [交易]   │   │
│  │ TQZ    铁拳重工     ¥38.50    -2.1%   ¥3.85亿    15.2   [交易]   │   │
│  │ XCD    星辰电子     ¥52.30    +3.8%   ¥5.23亿    18.7   [交易]   │   │
│  │ LKJ    蓝科基因     ¥28.90    +1.2%   ¥2.89亿    22.4   [交易]   │   │
│  │ DYN    德源能源     ¥41.20    -0.5%   ¥4.12亿    10.8   [交易]   │   │
│  │ ...                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ 我的持仓                        │  │ 交易面板                      │  │
│  │ ────────────────────────────── │  │ 股票: [TQZ 铁拳重工 ▾]        │  │
│  │ TQZ 铁拳重工                   │  │ 方向: [买入] [卖出]            │  │
│  │   持股: 50,000股 (5.0%)       │  │ 数量: [______] 股              │  │
│  │   成本: ¥35.00 → 现价: ¥38.50 │  │ 价格: [______] ¥/股            │  │
│  │   盈亏: +¥17.5万 (+10.0%)     │  │ 总额: ¥0                       │  │
│  │ XCD 星辰电子                   │  │                                │  │
│  │   持股: 20,000股 (2.0%)       │  │ [提交订单]                      │  │
│  │   ...                          │  │                                │  │
│  └────────────────────────────────┘  └──────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 股票详情弹窗

点击"交易"按钮后弹出：

```
┌─────────────────────────────────────────────────────────────────┐
│  TQZ 铁拳重工                                           [X]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    [K线图区域]                           │   │
│  │     $42 ┤    ╱╲                                         │   │
│  │     $40 ┤   ╱  ╲    ╱╲                                  │   │
│  │     $38 ┤──╱────╲──╱──╲───────── 当前: $38.50           │   │
│  │     $36 ┤ ╱      ╲╱                                     │   │
│  │         └──────────────────────────────────────────>     │   │
│  │              [1小时] [1天] [1周] [1月]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐   │
│  │ 基本信息              │  │ 财务数据                      │   │
│  │ 股价: ¥38.50         │  │ 净利润: ¥2,450万/月           │   │
│  │ 涨跌: -2.1%          │  │ 净资产: ¥3.2亿               │   │
│  │ 市值: ¥3.85亿        │  │ ROE: 18.5%                   │   │
│  │ 流通股: 1000万股     │  │ 负债率: 32%                  │   │
│  │ 市盈率: 15.2         │  │ 股息率: 3.5%                 │   │
│  │ 市净率: 1.2          │  │                              │   │
│  └──────────────────────┘  └──────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐   │
│  │ 股东结构              │  │ 交易                          │   │
│  │ 🔷 创始人: 60%       │  │ 买入数量: [____] 股           │   │
│  │ 🔷 玩家: 5%          │  │ 买入价格: [____] ¥            │   │
│  │ 🔷 其他: 35%         │  │ 可用资金: ¥1.2亿              │   │
│  │                      │  │ [买入] [卖出] [发起收购]       │   │
│  └──────────────────────┘  └──────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 收购与控股机制

### 6.1 收购流程

```
1. 发起收购要约
   - 持股比例达到30%时可发起全面收购
   - 需支付溢价（通常10-30%）
   - 需准备足够资金

2. 目标公司防御
   - 寻找白衣骑士（友好收购方）
   - 启动毒丸计划（大量增发股份稀释）
   - 提高分红消耗现金储备
   - 寻求政府干预（反垄断审查）

3. 股东投票
   - 持股超过50%即可控制公司
   - LLM生成股东态度（基于价格和公司未来）

4. 收购完成
   - 获得目标公司控制权
   - 可选择整合、保持自治或拆分
```

### 6.2 防御机制

```typescript
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
```

---

## 7. 与现有系统集成

### 7.1 与GameLoop集成

在 `gameLoop.processTick()` 中添加：
```typescript
// 处理股票市场
const stockMarketUpdate = stockMarketService.processTick(context);

// 同步股价到公司对象
for (const [companyId, stock] of stockMarketUpdate.stocks) {
  const company = companies.get(companyId);
  if (company) {
    company.stockPrice = stock.currentPrice;
    company.marketCap = stock.marketCap;
  }
}
```

### 7.2 与InventoryManager集成

股票交易的资金流转：
```typescript
// 买入股票时
inventoryManager.deductCash(buyerId, totalCost, tick, 'stock_purchase');

// 卖出股票时
inventoryManager.addCash(sellerId, totalValue, tick, 'stock_sale');

// 收到股息时
inventoryManager.addCash(holderId, dividendAmount, tick, 'dividend');
```

### 7.3 与AI公司集成

AI公司的股票交易决策：
```typescript
// 在 aiCompanyManager 中添加
private evaluateStockInvestments(company: AICompanyState, context: GameContext): void {
  // 基于战略计划决定是否投资其他公司
  if (company.strategicPlan?.investmentFocus === 'expansion') {
    const undervaluedStocks = this.findUndervaluedStocks();
    for (const stock of undervaluedStocks) {
      this.submitBuyOrder(company.id, stock.companyId, quantity, price);
    }
  }
  
  // 检测收购机会
  if (company.personality === AIPersonality.Monopolist) {
    const acquisitionTargets = this.identifyAcquisitionTargets(company);
    // ...
  }
}
```

---

## 8. 实现步骤

### Phase 32.1: 数据类型定义 ✓ (本文档)
- 创建 `packages/shared/src/types/stock.ts`
- 定义所有股票相关类型

### Phase 32.2: 股价计算服务
- 创建 `packages/server/src/services/stockMarket.ts`
- 实现估值算法
- 实现股价更新逻辑

### Phase 32.3: 股票交易服务
- 实现 StockOrderBook
- 实现订单撮合引擎
- 集成到 GameLoop

### Phase 32.4: 股份持有系统
- 实现 Shareholding 追踪
- 实现持股变更事件

### Phase 32.5: 股息分红机制
- 实现分红计算
- 实现分红分发

### Phase 32.6: UI组件
- 创建 StockMarket.tsx
- 创建 StockDetail.tsx
- 创建 TradingPanel.tsx

### Phase 32.7: API路由
- 添加 `/api/stocks` 路由
- 添加 WebSocket 股价推送

### Phase 32.8: 收购机制
- 实现 TakeoverBid 系统
- 实现防御措施
- AI收购决策

---

## 9. 测试场景

### 9.1 功能测试
1. 股票价格随公司利润变化
2. 买卖订单正确撮合
3. 股息按时发放
4. 收购流程完整

### 9.2 边界测试
1. 涨跌停限制
2. 资金不足时无法买入
3. 持股不足时无法卖出
4. 收购资金校验

### 9.3 压力测试
1. 大量订单并发处理
2. 频繁价格更新
3. 多公司同时收购

---

## 10. 扩展考虑

### 10.1 未来功能
- 做空机制
- 期权交易
- 债券市场
- IPO机制（新公司上市）

### 10.2 LLM增强
- 分析师报告生成
- 股价预测
- 收购谈判对话
- 市场事件对股价影响

---

*文档结束*