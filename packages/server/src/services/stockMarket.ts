/**
 * Stock Market Service
 * 股票市场服务 - 负责股价计算、订单撮合、分红处理
 */

import { EventEmitter } from 'events';
import type {
  Stock,
  StockOrder,
  StockTrade,
  Shareholding,
  DividendPayment,
  TakeoverBid,
  CompanyFinancials,
  StockMarketState,
  StockPriceHistory,
  StockOrderRequest,
  StockOrderResult,
  CompanyValuation,
  StockMarketUpdate,
  EntityId,
  Money,
  GameTick,
} from '@scc/shared';
import {
  StockStatus,
  StockOrderType,
  StockOrderSide,
  StockOrderStatus,
  ShareholdingType,
  DividendType,
  TakeoverStatus,
  MarketSentiment,
  VALUATION_CONSTANTS,
  AI_COMPANIES_CONFIG,
} from '@scc/shared';
import { inventoryManager } from './inventoryManager.js';

/**
 * 价格形成机制参数
 */
const PRICE_FORMATION = {
  // 订单流驱动参数
  ORDER_FLOW_WEIGHT: 0.4,           // 订单流对价格的影响权重（主要驱动力）
  ORDER_IMBALANCE_THRESHOLD: 0.3,   // 订单失衡阈值（提高，减少小波动）
  MAX_ORDER_FLOW_IMPACT: 0.015,     // 单次最大订单流冲击 1.5%
  
  // 动量效应参数
  MOMENTUM_WEIGHT: 0.25,            // 动量对价格的影响权重
  MOMENTUM_LOOKBACK: 10,            // 动量回看周期（tick数）
  MOMENTUM_DECAY: 0.95,             // 动量衰减系数
  MAX_MOMENTUM_IMPACT: 0.01,        // 单次最大动量冲击 1%
  
  // 均值回归参数（大幅降低，避免开局跌停）
  MEAN_REVERSION_WEIGHT: 0.05,      // 均值回归权重（从0.25降到0.05）
  REVERSION_SPEED: 0.005,           // 回归速度（每tick，从0.02降到0.005）
  DEVIATION_THRESHOLD: 0.30,        // 触发回归的偏离阈值 30%（从15%提高）
  
  // 基本面驱动参数（降低权重，避免开局数据不足导致问题）
  FUNDAMENTAL_WEIGHT: 0.05,         // 基本面对价格的影响权重（从0.15降到0.05）
  FUNDAMENTAL_ADJUSTMENT_SPEED: 0.003, // 基本面调整速度（更慢）
  
  // 随机波动参数
  NOISE_WEIGHT: 0.25,               // 噪音权重（增加随机性，市场更有活力）
  BASE_VOLATILITY: 0.003,           // 基础波动率 0.3%
  
  // 成交量影响
  VOLUME_IMPACT_FACTOR: 0.0001,     // 成交量对波动的放大系数
  
  // 新上市股票保护期（tick数）
  IPO_GRACE_PERIOD: 30,             // 30天保护期（1 tick = 1天）
  IPO_VOLATILITY_DAMPENER: 0.3,     // 保护期内波动率降低为30%
  
  // 稳定期要求（需要多少tick的财务数据才启用估值）
  MIN_FINANCIAL_HISTORY: 30,        // 30天财务历史（1 tick = 1天）
};

/**
 * 动量数据结构
 */
interface MomentumData {
  priceChanges: number[];  // 历史价格变化率
  cumulativeMomentum: number;  // 累积动量
}

/**
 * 估值缓存结构（性能优化）
 */
interface ValuationCache {
  valuation: CompanyValuation;
  lastCalculatedTick: GameTick;
  lastFinancialsHash: string;  // 财务数据hash，用于判断是否需要重新计算
}

/**
 * 估值缓存配置
 */
const VALUATION_CACHE_CONFIG = {
  /** 估值计算间隔（tick数），在此间隔内使用缓存值 */
  RECALCULATION_INTERVAL: 10,
  /** 财务数据变化阈值，变化超过此比例才触发重新计算 */
  FINANCIALS_CHANGE_THRESHOLD: 0.05,  // 5%
};

/**
 * 股票订单簿 - 管理单只股票的买卖订单
 */
class StockOrderBook {
  private buyOrders: StockOrder[] = [];
  private sellOrders: StockOrder[] = [];
  
  submitBuyOrder(order: StockOrder): void {
    this.buyOrders.push(order);
    // 按价格降序排列（买单价格高的优先）
    this.buyOrders.sort((a, b) => (b.limitPrice ?? 0) - (a.limitPrice ?? 0));
  }
  
  submitSellOrder(order: StockOrder): void {
    this.sellOrders.push(order);
    // 按价格升序排列（卖单价格低的优先）
    this.sellOrders.sort((a, b) => (a.limitPrice ?? Infinity) - (b.limitPrice ?? Infinity));
  }
  
  getBestBid(): Money | undefined {
    const openBuy = this.buyOrders.find(o => o.status === StockOrderStatus.Open || o.status === StockOrderStatus.Partial);
    return openBuy?.limitPrice;
  }
  
  getBestAsk(): Money | undefined {
    const openSell = this.sellOrders.find(o => o.status === StockOrderStatus.Open || o.status === StockOrderStatus.Partial);
    return openSell?.limitPrice;
  }
  
  getOrderVolumes(): { buyVolume: number; sellVolume: number } {
    let buyVolume = 0;
    let sellVolume = 0;
    
    for (const order of this.buyOrders) {
      if (order.status === StockOrderStatus.Open || order.status === StockOrderStatus.Partial) {
        buyVolume += order.remainingQuantity;
      }
    }
    
    for (const order of this.sellOrders) {
      if (order.status === StockOrderStatus.Open || order.status === StockOrderStatus.Partial) {
        sellVolume += order.remainingQuantity;
      }
    }
    
    return { buyVolume, sellVolume };
  }
  
  getOpenBuyOrders(): StockOrder[] {
    return this.buyOrders.filter(o => o.status === StockOrderStatus.Open || o.status === StockOrderStatus.Partial);
  }
  
  getOpenSellOrders(): StockOrder[] {
    return this.sellOrders.filter(o => o.status === StockOrderStatus.Open || o.status === StockOrderStatus.Partial);
  }
  
  /**
   * 获取某公司的所有挂单
   */
  getOrdersByCompany(companyId: EntityId): StockOrder[] {
    const buyOrders = this.buyOrders.filter(o =>
      o.companyId === companyId &&
      (o.status === StockOrderStatus.Open || o.status === StockOrderStatus.Partial)
    );
    const sellOrders = this.sellOrders.filter(o =>
      o.companyId === companyId &&
      (o.status === StockOrderStatus.Open || o.status === StockOrderStatus.Partial)
    );
    return [...buyOrders, ...sellOrders];
  }
  
  /**
   * 获取所有订单（包括已完成的）
   */
  getAllOrders(): StockOrder[] {
    return [...this.buyOrders, ...this.sellOrders];
  }
  
  cancelOrder(orderId: EntityId): boolean {
    let found = false;
    for (const order of this.buyOrders) {
      if (order.id === orderId && (order.status === StockOrderStatus.Open || order.status === StockOrderStatus.Partial)) {
        order.status = StockOrderStatus.Cancelled;
        found = true;
        break;
      }
    }
    if (!found) {
      for (const order of this.sellOrders) {
        if (order.id === orderId && (order.status === StockOrderStatus.Open || order.status === StockOrderStatus.Partial)) {
          order.status = StockOrderStatus.Cancelled;
          found = true;
          break;
        }
      }
    }
    return found;
  }
  
  /**
   * 清理过期订单
   */
  cleanupExpiredOrders(currentTick: GameTick): void {
    for (const order of this.buyOrders) {
      if (order.status === StockOrderStatus.Open || order.status === StockOrderStatus.Partial) {
        if (order.expiryTick <= currentTick) {
          order.status = StockOrderStatus.Expired;
        }
      }
    }
    for (const order of this.sellOrders) {
      if (order.status === StockOrderStatus.Open || order.status === StockOrderStatus.Partial) {
        if (order.expiryTick <= currentTick) {
          order.status = StockOrderStatus.Expired;
        }
      }
    }
  }
}

/**
 * 股票市场服务
 */
export class StockMarketService extends EventEmitter {
  /** 股票数据 */
  private stocks: Map<EntityId, Stock> = new Map();
  
  /** 股东持股表 */
  private shareholdings: Map<EntityId, Shareholding[]> = new Map();
  
  /** 订单簿（每只股票一个） */
  private orderBooks: Map<EntityId, StockOrderBook> = new Map();
  
  /** 成交记录 */
  private trades: StockTrade[] = [];
  
  /** 市场状态 */
  private marketState: StockMarketState;
  
  /** 财务数据缓存 */
  private financialsCache: Map<EntityId, CompanyFinancials> = new Map();
  
  /** 股价历史 */
  private priceHistory: Map<EntityId, StockPriceHistory[]> = new Map();
  
  /** 动量数据 */
  private momentumData: Map<EntityId, MomentumData> = new Map();
  
  /** 估值缓存（性能优化）*/
  private valuationCache: Map<EntityId, ValuationCache> = new Map();
  
  /** 收购要约 */
  private takeoverBids: Map<EntityId, TakeoverBid> = new Map();
  
  /** 分红记录 */
  private dividends: DividendPayment[] = [];
  
  /** 上一交易日开盘tick */
  private lastTradingDayStart: GameTick = 0;
  
  /** 每日tick数（1 tick = 1天） */
  private readonly TICKS_PER_DAY = 1;
  
  constructor() {
    super();
    this.marketState = this.createInitialMarketState();
  }
  
  /**
   * 创建初始市场状态
   */
  private createInitialMarketState(): StockMarketState {
    return {
      marketIndex: 1000,
      indexBase: 1000,
      sentiment: MarketSentiment.Neutral,
      dailyTurnover: 0,
      advancers: 0,
      decliners: 0,
      unchanged: 0,
      limitUpStocks: [],
      limitDownStocks: [],
      isOpen: true,
      openTick: 0,
      closeTick: 0,
    };
  }
  
  /**
   * 初始化股票市场
   * 为玩家公司和AI公司创建股票
   *
   * 差异化初始价格：
   * - 根据公司初始现金估算其规模
   * - 不同规模的公司有不同的初始股价
   */
  initialize(playerCompanyId: EntityId, currentTick: GameTick): void {
    // 清空现有数据
    this.stocks.clear();
    this.shareholdings.clear();
    this.orderBooks.clear();
    this.trades = [];
    this.priceHistory.clear();
    this.momentumData.clear();
    this.valuationCache.clear();
    
    // 创建玩家公司股票（玩家公司初始资金5亿）
    const playerInitialPrice = this.calculateInitialPrice(500000000, 'player');
    this.createStock(playerCompanyId, 'PLAY', '玩家公司', currentTick, playerInitialPrice);
    
    // 为玩家创建创始人持股（100%）
    this.createFounderShareholding(playerCompanyId, playerCompanyId, currentTick);
    
    // 创建AI公司股票（差异化初始价格）
    for (const config of AI_COMPANIES_CONFIG) {
      const ticker = this.generateTicker(config.name);
      // 根据AI公司初始资金计算初始股价
      const initialPrice = this.calculateInitialPrice(config.initialCash, config.personality);
      this.createStock(config.id, ticker, config.name, currentTick, initialPrice);
      
      // AI公司创始人持股（60%，40%流通）
      this.createFounderShareholding(config.id, config.id, currentTick, 0.6);
    }
    
    // 为每家 AI 公司分配一些初始现金用于股票交易
    // 这确保 AI 公司能参与股票市场
    this.initializeAIStockTradingCapacity(currentTick);
    
    console.log(`[StockMarket] Initialized with ${this.stocks.size} stocks`);
  }
  
  /**
   * 初始化 AI 公司的股票交易能力
   * 为每家 AI 公司分配一些其他公司的股票，提供初始流动性
   */
  private initializeAIStockTradingCapacity(currentTick: GameTick): void {
    const allStocks = Array.from(this.stocks.values());
    
    for (const config of AI_COMPANIES_CONFIG) {
      // 为每家 AI 公司分配少量其他公司的股票
      // 这样他们可以参与买卖
      for (const stock of allStocks) {
        // 不持有自己公司的股票（已经有创始人持股）
        if (stock.companyId === config.id) continue;
        
        // 随机决定是否持有这只股票（50%概率）
        if (Math.random() > 0.5) continue;
        
        // 持有 0.1% - 0.5% 的流通股
        const holdingRatio = 0.001 + Math.random() * 0.004;
        const shares = Math.floor(stock.floatingShares * holdingRatio);
        
        if (shares > 0) {
          // 创建市场持股
          const holding: Shareholding = {
            holderId: config.id,
            companyId: stock.companyId,
            shares,
            sharePercent: shares / stock.totalShares,
            costBasis: stock.currentPrice * shares,
            avgCostPrice: stock.currentPrice,
            firstAcquiredTick: currentTick,
            type: ShareholdingType.Market,
          };
          
          const holdings = this.shareholdings.get(config.id) ?? [];
          holdings.push(holding);
          this.shareholdings.set(config.id, holdings);
          
          console.log(`[StockMarket] ${config.name} 获得 ${shares} 股 ${stock.ticker}`);
        }
      }
    }
  }
  
  /**
   * 计算公司初始股价
   * 基于公司规模（初始资金）和个性进行差异化
   */
  private calculateInitialPrice(initialCash: number, personality: string): number {
    // 基础价格（10000 = ¥100.00）
    const basePrice = VALUATION_CONSTANTS.INITIAL_STOCK_PRICE_BASE;
    
    // 规模系数：初始资金越多，初始股价越高
    // 以5亿为基准（系数=1.0），1亿=0.7，10亿=1.3
    const scaleFactor = Math.pow(initialCash / 500000000, 0.3);
    
    // 个性系数：不同个性的公司有不同的市场溢价
    let personalityFactor = 1.0;
    switch (personality) {
      case 'monopolist':
        personalityFactor = 1.2; // 垄断者溢价
        break;
      case 'old_money':
        personalityFactor = 1.15; // 老牌公司溢价
        break;
      case 'innovator':
        personalityFactor = 1.1; // 创新者溢价
        break;
      case 'trend_surfer':
        personalityFactor = 0.95; // 追风者折价
        break;
      case 'cost_leader':
        personalityFactor = 0.9; // 成本领先者折价（薄利）
        break;
      case 'player':
        personalityFactor = 1.0; // 玩家公司标准
        break;
      default:
        personalityFactor = 0.95 + Math.random() * 0.1; // 其他公司随机
    }
    
    // 添加小幅随机差异（±5%）
    const randomFactor = 0.95 + Math.random() * 0.1;
    
    // 最终价格
    const finalPrice = Math.round(basePrice * scaleFactor * personalityFactor * randomFactor);
    
    console.log(`[StockMarket] 初始股价计算: 规模系数=${scaleFactor.toFixed(2)}, 个性系数=${personalityFactor.toFixed(2)}, 最终价格=${finalPrice}`);
    
    return finalPrice;
  }
  
  /**
   * 从公司名称生成股票代码
   */
  private generateTicker(name: string): string {
    // 简单逻辑：取名字首字母
    const chars = name.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').slice(0, 4);
    return chars.toUpperCase() || 'XXX';
  }
  
  /**
   * 创建股票
   * @param companyId 公司ID
   * @param ticker 股票代码
   * @param _name 公司名称（用于日志）
   * @param currentTick 当前tick
   * @param customInitialPrice 自定义初始价格（可选，默认使用基础价格）
   */
  private createStock(
    companyId: EntityId,
    ticker: string,
    _name: string,
    currentTick: GameTick,
    customInitialPrice?: number
  ): Stock {
    const totalShares = VALUATION_CONSTANTS.DEFAULT_TOTAL_SHARES;
    const floatingShares = Math.floor(totalShares * VALUATION_CONSTANTS.FLOATING_SHARES_RATIO);
    const initialPrice = customInitialPrice ?? VALUATION_CONSTANTS.INITIAL_STOCK_PRICE_BASE;
    
    const stock: Stock = {
      companyId,
      ticker,
      totalShares,
      floatingShares,
      currentPrice: initialPrice,
      openPrice: initialPrice,
      highPrice: initialPrice,
      lowPrice: initialPrice,
      previousClose: initialPrice,
      marketCap: initialPrice * totalShares,
      peRatio: VALUATION_CONSTANTS.AVERAGE_PE_RATIO,
      pbRatio: 1.0,
      eps: initialPrice / VALUATION_CONSTANTS.AVERAGE_PE_RATIO,
      bookValuePerShare: initialPrice,
      dividendYield: 0,
      lastDividendTick: 0,
      priceChangePercent: 0,
      volume: 0,
      turnover: 0,
      status: StockStatus.Trading,
      listedTick: currentTick,
    };
    
    this.stocks.set(companyId, stock);
    this.orderBooks.set(companyId, new StockOrderBook());
    this.priceHistory.set(companyId, [{
      tick: currentTick,
      open: initialPrice,
      high: initialPrice,
      low: initialPrice,
      close: initialPrice,
      volume: 0,
      turnover: 0,
    }]);
    
    return stock;
  }
  
  /**
   * 创建创始人持股
   */
  private createFounderShareholding(
    companyId: EntityId,
    holderId: EntityId,
    currentTick: GameTick,
    sharePercent: number = 1.0
  ): void {
    const stock = this.stocks.get(companyId);
    if (!stock) return;
    
    const shares = Math.floor(stock.totalShares * sharePercent);
    
    const shareholding: Shareholding = {
      holderId,
      companyId,
      shares,
      sharePercent,
      costBasis: 0, // 创始人成本为0
      avgCostPrice: 0,
      firstAcquiredTick: currentTick,
      type: ShareholdingType.Founder,
    };
    
    const holderShares = this.shareholdings.get(holderId) ?? [];
    holderShares.push(shareholding);
    this.shareholdings.set(holderId, holderShares);
  }
  
  /**
   * 每tick更新
   */
  processTick(
    currentTick: GameTick,
    companyFinancials: Map<EntityId, { cash: number; netIncome: number; totalAssets: number }>
  ): StockMarketUpdate {
    // 检查是否新的一天
    const isNewDay = Math.floor(currentTick / this.TICKS_PER_DAY) > Math.floor(this.lastTradingDayStart / this.TICKS_PER_DAY);
    if (isNewDay) {
      this.startNewTradingDay(currentTick);
    }
    
    // 更新财务数据缓存
    this.updateFinancialsCache(companyFinancials, currentTick);
    
    // 清理过期订单
    for (const [, orderBook] of this.orderBooks) {
      orderBook.cleanupExpiredOrders(currentTick);
    }
    
    // 撮合订单
    const newTrades: StockTrade[] = [];
    for (const [stockId] of this.stocks) {
      const trades = this.matchOrders(stockId, currentTick);
      newTrades.push(...trades);
    }
    
    // 更新股价
    for (const [stockId] of this.stocks) {
      this.updateStockPrice(stockId, currentTick);
    }
    
    // 更新市场状态
    this.updateMarketState(currentTick);
    
    // 处理分红（每月检查一次）
    const dividendPayments: DividendPayment[] = [];
    if (currentTick % VALUATION_CONSTANTS.DIVIDEND_FREQUENCY === 0 && currentTick > 0) {
      const payments = this.processDividends(currentTick);
      dividendPayments.push(...payments);
    }
    
    // 处理收购
    const takeoverUpdates = this.processTakeovers(currentTick);
    
    return {
      tick: currentTick,
      stocks: new Map(this.stocks),
      trades: newTrades,
      marketState: { ...this.marketState },
      dividends: dividendPayments.length > 0 ? dividendPayments : undefined,
      takeoverUpdates: takeoverUpdates.length > 0 ? takeoverUpdates : undefined,
    };
  }
  
  /**
   * 开始新交易日
   */
  private startNewTradingDay(currentTick: GameTick): void {
    this.lastTradingDayStart = currentTick;
    
    // 重置每日数据
    this.marketState.dailyTurnover = 0;
    this.marketState.advancers = 0;
    this.marketState.decliners = 0;
    this.marketState.unchanged = 0;
    this.marketState.limitUpStocks = [];
    this.marketState.limitDownStocks = [];
    
    // 记录昨收价，重置当日高低价
    for (const [, stock] of this.stocks) {
      stock.previousClose = stock.currentPrice;
      stock.openPrice = stock.currentPrice;
      stock.highPrice = stock.currentPrice;
      stock.lowPrice = stock.currentPrice;
      stock.volume = 0;
      stock.turnover = 0;
      stock.priceChangePercent = 0;
      stock.status = StockStatus.Trading;
    }
    
    console.log(`[StockMarket] New trading day started at tick ${currentTick}`);
  }
  
  /**
   * 更新财务数据缓存
   */
  private updateFinancialsCache(
    companyFinancials: Map<EntityId, { cash: number; netIncome: number; totalAssets: number }>,
    currentTick: GameTick
  ): void {
    for (const [companyId, data] of companyFinancials) {
      const inventory = inventoryManager.getInventory(companyId);
      const cash = inventory?.cash ?? data.cash;
      
      // 计算库存价值
      let inventoryValue = 0;
      if (inventory) {
        for (const [, stock] of Object.entries(inventory.stocks)) {
          inventoryValue += stock.quantity * stock.avgCost;
        }
      }
      
      const financials: CompanyFinancials = {
        companyId,
        period: { startTick: currentTick - 30, endTick: currentTick },
        totalRevenue: Math.max(0, data.netIncome * 1.5), // 估算
        totalCost: Math.max(0, data.netIncome * 0.5),
        netIncome: data.netIncome,
        totalAssets: data.totalAssets + inventoryValue,
        totalLiabilities: 0,
        netAssets: cash + inventoryValue + data.totalAssets,
        cashAndEquivalents: cash,
        inventoryValue,
        fixedAssets: data.totalAssets,
        debtRatio: 0,
        roe: 0,
        roa: 0,
      };
      
      this.financialsCache.set(companyId, financials);
    }
  }
  
  /**
   * 撮合订单
   */
  private matchOrders(stockId: EntityId, currentTick: GameTick): StockTrade[] {
    const orderBook = this.orderBooks.get(stockId);
    const stock = this.stocks.get(stockId);
    if (!orderBook || !stock) return [];
    
    if (stock.status === StockStatus.Suspended) return [];
    
    const trades: StockTrade[] = [];
    const buyOrders = orderBook.getOpenBuyOrders();
    const sellOrders = orderBook.getOpenSellOrders();
    
    // 尝试撮合
    for (const buyOrder of buyOrders) {
      if (buyOrder.remainingQuantity <= 0) continue;
      
      for (const sellOrder of sellOrders) {
        if (sellOrder.remainingQuantity <= 0) continue;
        if (buyOrder.companyId === sellOrder.companyId) continue; // 不能自买自卖
        
        // 检查价格匹配
        const buyPrice = buyOrder.orderType === StockOrderType.Market ? Infinity : (buyOrder.limitPrice ?? 0);
        const sellPrice = sellOrder.orderType === StockOrderType.Market ? 0 : (sellOrder.limitPrice ?? Infinity);
        
        if (buyPrice >= sellPrice) {
          // 可以成交
          const tradeQuantity = Math.min(buyOrder.remainingQuantity, sellOrder.remainingQuantity);
          const tradePrice = sellOrder.orderType === StockOrderType.Market ? buyOrder.limitPrice! : sellOrder.limitPrice!;
          
          // 检查涨跌停
          if (this.wouldExceedDailyLimit(stock, tradePrice)) {
            continue;
          }
          
          // 检查买方资金
          const buyerInventory = inventoryManager.getInventory(buyOrder.companyId);
          if (!buyerInventory || buyerInventory.cash < tradePrice * tradeQuantity) {
            continue;
          }
          
          // 检查卖方持股
          const sellerShares = this.getShareholding(sellOrder.companyId, stockId);
          if (!sellerShares || sellerShares.shares < tradeQuantity) {
            continue;
          }
          
          // 执行交易
          const trade = this.executeTrade(
            stockId,
            buyOrder,
            sellOrder,
            tradePrice,
            tradeQuantity,
            currentTick
          );
          
          if (trade) {
            trades.push(trade);
            this.trades.push(trade);
          }
        }
      }
    }
    
    return trades;
  }
  
  /**
   * 检查交易是否会导致涨跌停突破
   */
  private wouldExceedDailyLimit(stock: Stock, tradePrice: Money): boolean {
    const changePercent = (tradePrice - stock.openPrice) / stock.openPrice;
    return Math.abs(changePercent) > VALUATION_CONSTANTS.DAILY_LIMIT;
  }
  
  /**
   * 执行交易
   */
  private executeTrade(
    stockId: EntityId,
    buyOrder: StockOrder,
    sellOrder: StockOrder,
    price: Money,
    quantity: number,
    currentTick: GameTick
  ): StockTrade | null {
    const value = price * quantity;
    
    // 扣除买方资金
    const deductResult = inventoryManager.deductCash(
      buyOrder.companyId,
      value,
      currentTick,
      `stock_purchase_${stockId}`
    );
    if (!deductResult.success) return null;
    
    // 增加卖方资金
    inventoryManager.addCash(
      sellOrder.companyId,
      value,
      currentTick,
      `stock_sale_${stockId}`
    );
    
    // 更新持股
    this.transferShares(sellOrder.companyId, buyOrder.companyId, stockId, quantity, price, currentTick);
    
    // 更新订单状态
    buyOrder.filledQuantity += quantity;
    buyOrder.remainingQuantity -= quantity;
    if (buyOrder.remainingQuantity <= 0) {
      buyOrder.status = StockOrderStatus.Filled;
    } else {
      buyOrder.status = StockOrderStatus.Partial;
    }
    buyOrder.avgFillPrice = price;
    buyOrder.totalValue = (buyOrder.totalValue ?? 0) + value;
    
    sellOrder.filledQuantity += quantity;
    sellOrder.remainingQuantity -= quantity;
    if (sellOrder.remainingQuantity <= 0) {
      sellOrder.status = StockOrderStatus.Filled;
    } else {
      sellOrder.status = StockOrderStatus.Partial;
    }
    sellOrder.avgFillPrice = price;
    sellOrder.totalValue = (sellOrder.totalValue ?? 0) + value;
    
    // 更新股票数据
    const stock = this.stocks.get(stockId);
    if (stock) {
      stock.currentPrice = price;
      stock.highPrice = Math.max(stock.highPrice, price);
      stock.lowPrice = Math.min(stock.lowPrice, price);
      stock.volume += quantity;
      stock.turnover += value;
      stock.priceChangePercent = (price - stock.previousClose) / stock.previousClose;
      
      // 检查涨跌停
      if (stock.priceChangePercent >= VALUATION_CONSTANTS.DAILY_LIMIT) {
        stock.status = StockStatus.LimitUp;
      } else if (stock.priceChangePercent <= -VALUATION_CONSTANTS.DAILY_LIMIT) {
        stock.status = StockStatus.LimitDown;
      }
    }
    
    // 更新市场成交额
    this.marketState.dailyTurnover += value;
    
    // 创建成交记录
    const trade: StockTrade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      stockId,
      buyerId: buyOrder.companyId,
      sellerId: sellOrder.companyId,
      price,
      quantity,
      value,
      tick: currentTick,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
    };
    
    console.log(`[StockMarket] Trade executed: ${quantity} shares of ${stockId} @ ${price / 100}`);
    
    this.emit('trade', trade);
    
    return trade;
  }
  
  /**
   * 转移股份
   */
  private transferShares(
    fromId: EntityId,
    toId: EntityId,
    stockId: EntityId,
    quantity: number,
    price: Money,
    currentTick: GameTick
  ): void {
    const stock = this.stocks.get(stockId);
    if (!stock) return;
    
    // 减少卖方持股
    const fromShares = this.shareholdings.get(fromId) ?? [];
    const fromHolding = fromShares.find(s => s.companyId === stockId);
    if (fromHolding) {
      fromHolding.shares -= quantity;
      fromHolding.sharePercent = fromHolding.shares / stock.totalShares;
      if (fromHolding.shares <= 0) {
        this.shareholdings.set(fromId, fromShares.filter(s => s.companyId !== stockId));
      }
    }
    
    // 增加买方持股
    const toShares = this.shareholdings.get(toId) ?? [];
    let toHolding = toShares.find(s => s.companyId === stockId);
    
    if (toHolding) {
      // 更新加权平均成本
      const totalCost = toHolding.costBasis + price * quantity;
      const totalShares = toHolding.shares + quantity;
      toHolding.avgCostPrice = totalCost / totalShares;
      toHolding.costBasis = totalCost;
      toHolding.shares = totalShares;
      toHolding.sharePercent = totalShares / stock.totalShares;
    } else {
      // 新建持股记录
      toHolding = {
        holderId: toId,
        companyId: stockId,
        shares: quantity,
        sharePercent: quantity / stock.totalShares,
        costBasis: price * quantity,
        avgCostPrice: price,
        firstAcquiredTick: currentTick,
        type: ShareholdingType.Market,
      };
      toShares.push(toHolding);
    }
    
    this.shareholdings.set(toId, toShares);
  }
  
  /**
   * 更新股价 - 使用多因子价格形成模型
   *
   * 价格变化 = 订单流驱动 + 动量效应 + 均值回归 + 基本面调整 + 随机噪音
   *
   * 设计原则：
   * 1. 订单流是主要驱动力（有买卖才有价格变化）
   * 2. 动量使趋势延续
   * 3. 均值回归和基本面只在有充足历史数据后才生效
   * 4. 噪音提供随机性，使市场更有活力
   */
  private updateStockPrice(stockId: EntityId, currentTick: GameTick): void {
    const stock = this.stocks.get(stockId);
    const orderBook = this.orderBooks.get(stockId);
    const financials = this.financialsCache.get(stockId);
    
    if (!stock || !orderBook) return;
    
    // 检查是否在新上市保护期内
    const ticksSinceListing = currentTick - stock.listedTick;
    const isInGracePeriod = ticksSinceListing < PRICE_FORMATION.IPO_GRACE_PERIOD;
    
    // 检查是否有足够的财务历史数据来进行估值
    const hasEnoughFinancialHistory = ticksSinceListing >= PRICE_FORMATION.MIN_FINANCIAL_HISTORY;
    
    // 获取或初始化动量数据
    let momentum = this.momentumData.get(stockId);
    if (!momentum) {
      momentum = { priceChanges: [], cumulativeMomentum: 0 };
      this.momentumData.set(stockId, momentum);
    }
    
    // 计算各个价格驱动因子
    const orderFlowImpact = this.calculateOrderFlowImpact(orderBook, stock);
    const momentumImpact = this.calculateMomentumImpact(momentum);
    
    // 只有在有足够财务历史数据后才应用均值回归和基本面因子
    // 这避免了开局时因为财务数据不足导致的错误估值
    let meanReversionImpact = 0;
    let fundamentalImpact = 0;
    if (hasEnoughFinancialHistory && financials && this.isFinancialsReliable(financials)) {
      meanReversionImpact = this.calculateMeanReversionImpact(stock, financials);
      fundamentalImpact = this.calculateFundamentalImpact(stock, financials);
    }
    
    const noiseImpact = this.calculateNoiseImpact(stock);
    
    // 综合价格变化率
    let totalPriceChange =
      orderFlowImpact * PRICE_FORMATION.ORDER_FLOW_WEIGHT +
      momentumImpact * PRICE_FORMATION.MOMENTUM_WEIGHT +
      meanReversionImpact * PRICE_FORMATION.MEAN_REVERSION_WEIGHT +
      fundamentalImpact * PRICE_FORMATION.FUNDAMENTAL_WEIGHT +
      noiseImpact * PRICE_FORMATION.NOISE_WEIGHT;
    
    // 新上市保护期内，降低波动率
    if (isInGracePeriod) {
      totalPriceChange *= PRICE_FORMATION.IPO_VOLATILITY_DAMPENER;
    }
    
    // 计算新价格
    let newPrice = stock.currentPrice * (1 + totalPriceChange);
    
    // 限制每tick波动幅度
    const maxChange = stock.currentPrice * VALUATION_CONSTANTS.PRICE_CHANGE_LIMIT;
    newPrice = Math.max(
      stock.currentPrice - maxChange,
      Math.min(stock.currentPrice + maxChange, newPrice)
    );
    
    // 限制涨跌停
    const dailyChange = (newPrice - stock.openPrice) / stock.openPrice;
    if (dailyChange >= VALUATION_CONSTANTS.DAILY_LIMIT) {
      newPrice = stock.openPrice * (1 + VALUATION_CONSTANTS.DAILY_LIMIT);
      stock.status = StockStatus.LimitUp;
    } else if (dailyChange <= -VALUATION_CONSTANTS.DAILY_LIMIT) {
      newPrice = stock.openPrice * (1 - VALUATION_CONSTANTS.DAILY_LIMIT);
      stock.status = StockStatus.LimitDown;
    }
    
    // 确保价格为正
    newPrice = Math.max(1, newPrice);
    
    // 记录价格变化用于动量计算
    const priceChange = (newPrice - stock.currentPrice) / stock.currentPrice;
    this.updateMomentumData(momentum, priceChange);
    
    // 更新股票价格数据
    stock.currentPrice = Math.round(newPrice);
    stock.highPrice = Math.max(stock.highPrice, stock.currentPrice);
    stock.lowPrice = Math.min(stock.lowPrice, stock.currentPrice);
    stock.priceChangePercent = (stock.currentPrice - stock.previousClose) / stock.previousClose;
    stock.marketCap = stock.currentPrice * stock.totalShares;
    
    // 更新财务比率
    if (financials) {
      if (financials.netIncome > 0) {
        stock.eps = financials.netIncome / stock.totalShares;
        stock.peRatio = stock.currentPrice / stock.eps;
      }
      stock.bookValuePerShare = financials.netAssets / stock.totalShares;
      if (stock.bookValuePerShare > 0) {
        stock.pbRatio = stock.currentPrice / stock.bookValuePerShare;
      }
    }
    
    // 记录价格历史
    this.recordPriceHistory(stockId, stock, currentTick);
  }
  
  /**
   * 计算订单流冲击
   * 买卖盘失衡会推动价格变化
   */
  private calculateOrderFlowImpact(orderBook: StockOrderBook, stock: Stock): number {
    const { buyVolume, sellVolume } = orderBook.getOrderVolumes();
    const totalVolume = buyVolume + sellVolume;
    
    if (totalVolume === 0) {
      return 0;
    }
    
    // 计算订单失衡度 (-1 到 1)
    const imbalance = (buyVolume - sellVolume) / totalVolume;
    
    // 只有超过阈值才产生影响
    if (Math.abs(imbalance) < PRICE_FORMATION.ORDER_IMBALANCE_THRESHOLD) {
      return 0;
    }
    
    // 计算成交量加权的冲击
    const volumeRatio = totalVolume / stock.floatingShares;
    const volumeAmplifier = Math.min(1 + volumeRatio * PRICE_FORMATION.VOLUME_IMPACT_FACTOR * 1000, 2);
    
    // 限制最大冲击
    const impact = imbalance * volumeAmplifier;
    return Math.max(-PRICE_FORMATION.MAX_ORDER_FLOW_IMPACT,
                    Math.min(PRICE_FORMATION.MAX_ORDER_FLOW_IMPACT, impact));
  }
  
  /**
   * 计算动量效应
   * 价格趋势具有自我强化特性
   */
  private calculateMomentumImpact(momentum: MomentumData): number {
    if (momentum.priceChanges.length === 0) {
      return 0;
    }
    
    // 使用累积动量
    const impact = momentum.cumulativeMomentum;
    
    // 限制最大动量冲击
    return Math.max(-PRICE_FORMATION.MAX_MOMENTUM_IMPACT,
                    Math.min(PRICE_FORMATION.MAX_MOMENTUM_IMPACT, impact));
  }
  
  /**
   * 检查财务数据是否可靠（用于估值）
   * 开局时财务数据可能不完整，需要检查
   */
  private isFinancialsReliable(financials: CompanyFinancials): boolean {
    // 必须有正的净资产
    if (financials.netAssets <= 0) return false;
    
    // 净资产必须大于一定阈值（至少1000万）
    if (financials.netAssets < 10000000) return false;
    
    // 总资产必须大于净资产（合理的资产结构）
    if (financials.totalAssets < financials.netAssets) return false;
    
    return true;
  }
  
  /**
   * 计算均值回归效应
   * 价格偏离公允价值太多时会回归
   *
   * 注意：这个函数只在有充足财务历史后才会被调用
   */
  private calculateMeanReversionImpact(
    stock: Stock,
    financials: CompanyFinancials | undefined
  ): number {
    if (!financials) {
      return 0;
    }
    
    // 计算公允价值
    const valuation = this.calculateValuation(stock.companyId);
    if (!valuation) {
      return 0;
    }
    
    const fairValue = valuation.fairValue;
    
    // 防止除零
    if (fairValue <= 0) {
      return 0;
    }
    
    const deviation = (stock.currentPrice - fairValue) / fairValue;
    
    // 只有偏离超过阈值才触发回归
    if (Math.abs(deviation) < PRICE_FORMATION.DEVIATION_THRESHOLD) {
      return 0;
    }
    
    // 回归力度与偏离程度成正比，但非常缓慢
    // 负偏离时回归为正（价格上涨），正偏离时回归为负（价格下跌）
    const reversionForce = -deviation * PRICE_FORMATION.REVERSION_SPEED;
    
    // 限制最大回归力度，避免剧烈波动
    const maxReversion = 0.01; // 最大1%
    return Math.max(-maxReversion, Math.min(maxReversion, reversionForce));
  }
  
  /**
   * 计算基本面驱动效应
   * 股价向公允价值缓慢趋近
   */
  private calculateFundamentalImpact(
    stock: Stock,
    financials: CompanyFinancials | undefined
  ): number {
    if (!financials) {
      return 0;
    }
    
    const valuation = this.calculateValuation(stock.companyId);
    if (!valuation) {
      return 0;
    }
    
    const fairValue = valuation.fairValue;
    const priceDiff = (fairValue - stock.currentPrice) / stock.currentPrice;
    
    // 缓慢向公允价值调整
    return priceDiff * PRICE_FORMATION.FUNDAMENTAL_ADJUSTMENT_SPEED;
  }
  
  /**
   * 计算随机噪音
   * 模拟市场微结构噪音
   */
  private calculateNoiseImpact(stock: Stock): number {
    // 基础随机波动 (正态分布近似)
    const u1 = Math.random();
    const u2 = Math.random();
    const normalRandom = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    // 波动率根据市场状态调整
    let volatilityMultiplier = 1;
    if (stock.status === StockStatus.LimitUp || stock.status === StockStatus.LimitDown) {
      volatilityMultiplier = 0.1; // 涨跌停时波动很小
    }
    
    return normalRandom * PRICE_FORMATION.BASE_VOLATILITY * volatilityMultiplier;
  }
  
  /**
   * 更新动量数据
   */
  private updateMomentumData(momentum: MomentumData, priceChange: number): void {
    // 添加新的价格变化
    momentum.priceChanges.push(priceChange);
    
    // 保持回看周期内的数据
    if (momentum.priceChanges.length > PRICE_FORMATION.MOMENTUM_LOOKBACK) {
      momentum.priceChanges.shift();
    }
    
    // 计算累积动量（指数加权）
    momentum.cumulativeMomentum = 0;
    let weight = 1;
    for (let i = momentum.priceChanges.length - 1; i >= 0; i--) {
      const change = momentum.priceChanges[i];
      if (change !== undefined) {
        momentum.cumulativeMomentum += change * weight;
      }
      weight *= PRICE_FORMATION.MOMENTUM_DECAY;
    }
  }
  
  /**
   * 记录价格历史
   */
  private recordPriceHistory(stockId: EntityId, stock: Stock, currentTick: GameTick): void {
    const history = this.priceHistory.get(stockId) ?? [];
    history.push({
      tick: currentTick,
      open: stock.openPrice,
      high: stock.highPrice,
      low: stock.lowPrice,
      close: stock.currentPrice,
      volume: stock.volume,
      turnover: stock.turnover,
    });
    
    // 保留最近1000条记录
    if (history.length > 1000) {
      this.priceHistory.set(stockId, history.slice(-1000));
    } else {
      this.priceHistory.set(stockId, history);
    }
  }
  
  /**
   * 计算公司估值（带缓存优化）
   *
   * 估值策略：
   * 1. 如果没有可靠财务数据，公允价值=当前股价（不产生压力）
   * 2. 如果有财务数据，综合资产估值和盈利估值
   * 3. 设置多重保护，确保公允价值不会远低于当前股价
   *
   * 性能优化：
   * - 缓存估值结果，在间隔期内直接返回缓存
   * - 只有财务数据显著变化时才重新计算
   */
  calculateValuation(companyId: EntityId, currentTick?: GameTick): CompanyValuation | null {
    const stock = this.stocks.get(companyId);
    const financials = this.financialsCache.get(companyId);
    
    if (!stock) return null;
    
    const tick = currentTick ?? 0;
    
    // 检查缓存是否可用
    const cached = this.valuationCache.get(companyId);
    if (cached) {
      const ticksSinceLastCalc = tick - cached.lastCalculatedTick;
      
      // 在缓存有效期内，且财务数据未显著变化
      if (ticksSinceLastCalc < VALUATION_CACHE_CONFIG.RECALCULATION_INTERVAL) {
        const currentHash = this.calculateFinancialsHash(financials);
        if (currentHash === cached.lastFinancialsHash) {
          // 只更新市价相关的数据，估值保持缓存
          return {
            ...cached.valuation,
            marketPrice: stock.currentPrice,
            premiumDiscount: (stock.currentPrice - cached.valuation.fairValue) / cached.valuation.fairValue,
          };
        }
      }
    }
    
    // 需要重新计算
    const valuation = this.calculateValuationInternal(companyId, stock, financials);
    
    if (valuation) {
      // 更新缓存
      this.valuationCache.set(companyId, {
        valuation,
        lastCalculatedTick: tick,
        lastFinancialsHash: this.calculateFinancialsHash(financials),
      });
    }
    
    return valuation;
  }
  
  /**
   * 计算财务数据hash（用于判断是否需要重新估值）
   */
  private calculateFinancialsHash(financials: CompanyFinancials | undefined): string {
    if (!financials) return 'null';
    // 使用关键财务指标生成简单hash
    return `${Math.round(financials.netAssets / 10000)}-${Math.round(financials.netIncome / 10000)}`;
  }
  
  /**
   * 内部估值计算方法（不带缓存）
   */
  private calculateValuationInternal(
    companyId: EntityId,
    stock: Stock,
    financials: CompanyFinancials | undefined
  ): CompanyValuation | null {
    // 如果没有财务数据或数据不可靠，使用当前股价作为公允价值
    if (!financials || !this.isFinancialsReliable(financials)) {
      return {
        companyId,
        tick: 0,
        assetBasedValue: stock.currentPrice,
        earningsBasedValue: stock.currentPrice,
        fairValue: stock.currentPrice,
        marketPrice: stock.currentPrice,
        premiumDiscount: 0, // 无溢价/折价
        rating: 'fair',
      };
    }
    
    // 基于资产的估值
    let assetBasedValue = financials.netAssets / stock.totalShares;
    
    // 资产估值保护：不能低于当前股价的50%
    if (assetBasedValue < stock.currentPrice * 0.5) {
      assetBasedValue = stock.currentPrice * 0.5;
    }
    
    // 基于盈利的估值
    let earningsBasedValue: Money;
    if (financials.netIncome > 0) {
      const eps = financials.netIncome / stock.totalShares;
      // 年化EPS（假设当前是月度数据，×12）
      const annualizedEps = eps * 12;
      earningsBasedValue = annualizedEps * VALUATION_CONSTANTS.AVERAGE_PE_RATIO;
      
      // 盈利估值也需要保护
      if (earningsBasedValue < stock.currentPrice * 0.5) {
        earningsBasedValue = stock.currentPrice * 0.5;
      }
    } else {
      // 亏损时使用资产估值
      earningsBasedValue = assetBasedValue;
    }
    
    // 综合估值
    let fairValue = Math.round(
      assetBasedValue * VALUATION_CONSTANTS.BOOK_VALUE_WEIGHT +
      earningsBasedValue * VALUATION_CONSTANTS.EARNINGS_WEIGHT
    );
    
    // 最终保护：公允价值不能低于当前股价的85%
    // 这确保即使有均值回归，也不会造成大幅下跌
    const minFairValue = Math.round(stock.currentPrice * 0.85);
    if (fairValue < minFairValue) {
      fairValue = minFairValue;
    }
    
    // 计算溢价/折价
    const premiumDiscount = (stock.currentPrice - fairValue) / fairValue;
    
    // 评级（使用更宽松的标准）
    let rating: 'undervalued' | 'fair' | 'overvalued';
    if (premiumDiscount < -0.3) {
      rating = 'undervalued';
    } else if (premiumDiscount > 0.3) {
      rating = 'overvalued';
    } else {
      rating = 'fair';
    }
    
    return {
      companyId,
      tick: 0, // 将在调用处设置
      assetBasedValue,
      earningsBasedValue,
      fairValue,
      marketPrice: stock.currentPrice,
      premiumDiscount,
      rating,
    };
  }
  
  /**
   * 使估值缓存失效（在财务数据显著变化时调用）
   */
  invalidateValuationCache(companyId?: EntityId): void {
    if (companyId) {
      this.valuationCache.delete(companyId);
    } else {
      this.valuationCache.clear();
    }
  }
  
  /**
   * 更新市场状态
   */
  private updateMarketState(_currentTick: GameTick): void {
    let advancers = 0;
    let decliners = 0;
    let unchanged = 0;
    const limitUpStocks: EntityId[] = [];
    const limitDownStocks: EntityId[] = [];
    let totalMarketCap = 0;
    
    for (const [companyId, stock] of this.stocks) {
      totalMarketCap += stock.marketCap;
      
      if (stock.priceChangePercent > 0.001) {
        advancers++;
      } else if (stock.priceChangePercent < -0.001) {
        decliners++;
      } else {
        unchanged++;
      }
      
      if (stock.status === StockStatus.LimitUp) {
        limitUpStocks.push(companyId);
      } else if (stock.status === StockStatus.LimitDown) {
        limitDownStocks.push(companyId);
      }
    }
    
    this.marketState.advancers = advancers;
    this.marketState.decliners = decliners;
    this.marketState.unchanged = unchanged;
    this.marketState.limitUpStocks = limitUpStocks;
    this.marketState.limitDownStocks = limitDownStocks;
    
    // 计算综合指数（市值加权）
    let indexValue = 0;
    for (const [, stock] of this.stocks) {
      const weight = stock.marketCap / totalMarketCap;
      indexValue += (stock.currentPrice / stock.previousClose) * weight * this.marketState.indexBase;
    }
    this.marketState.marketIndex = Math.round(indexValue);
    
    // 更新市场情绪
    if (advancers > decliners * 2) {
      this.marketState.sentiment = MarketSentiment.Greedy;
    } else if (decliners > advancers * 2) {
      this.marketState.sentiment = MarketSentiment.Fear;
    } else if (advancers > decliners) {
      this.marketState.sentiment = MarketSentiment.Optimistic;
    } else if (decliners > advancers) {
      this.marketState.sentiment = MarketSentiment.Cautious;
    } else {
      this.marketState.sentiment = MarketSentiment.Neutral;
    }
    
    this.marketState.openTick = this.lastTradingDayStart;
    this.marketState.closeTick = this.lastTradingDayStart + this.TICKS_PER_DAY;
  }
  
  /**
   * 处理分红
   */
  processDividends(currentTick: GameTick): DividendPayment[] {
    const payments: DividendPayment[] = [];
    
    for (const [companyId, stock] of this.stocks) {
      const financials = this.financialsCache.get(companyId);
      if (!financials || financials.netIncome <= 0) continue;
      
      // 检查是否该分红了
      if (currentTick - stock.lastDividendTick < VALUATION_CONSTANTS.DIVIDEND_FREQUENCY) {
        continue;
      }
      
      // 计算分红金额（净利润的30%）
      const payoutRatio = 0.3;
      const totalDividend = financials.netIncome * payoutRatio;
      const dividendPerShare = totalDividend / stock.totalShares;
      
      // 分发给所有股东
      for (const [holderId, holdings] of this.shareholdings) {
        const holding = holdings.find(h => h.companyId === companyId);
        if (!holding || holding.shares <= 0) continue;
        
        const dividendAmount = dividendPerShare * holding.shares;
        if (dividendAmount > 0) {
          inventoryManager.addCash(holderId, dividendAmount, currentTick, `dividend_${companyId}`);
        }
      }
      
      // 更新股票数据
      stock.lastDividendTick = currentTick;
      stock.dividendYield = (dividendPerShare * 12) / stock.currentPrice; // 年化股息率
      
      const payment: DividendPayment = {
        id: `dividend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        companyId,
        dividendPerShare,
        totalAmount: totalDividend,
        type: DividendType.Cash,
        recordTick: currentTick,
        paymentTick: currentTick,
        source: 'profit',
      };
      
      payments.push(payment);
      this.dividends.push(payment);
      
      console.log(`[StockMarket] Dividend paid: ${companyId} - ${dividendPerShare / 100} per share`);
    }
    
    return payments;
  }
  
  /**
   * 处理收购
   */
  processTakeovers(currentTick: GameTick): TakeoverBid[] {
    const updates: TakeoverBid[] = [];
    
    for (const [_bidId, bid] of this.takeoverBids) {
      if (bid.status !== TakeoverStatus.Pending) continue;
      
      // 检查是否过期
      if (currentTick >= bid.expiryTick) {
        bid.status = TakeoverStatus.Failed;
        updates.push(bid);
        continue;
      }
      
      // 检查是否达到控股比例
      const acquirerShares = this.getShareholding(bid.acquirerId, bid.targetId);
      if (acquirerShares && acquirerShares.sharePercent >= VALUATION_CONSTANTS.CONTROL_THRESHOLD) {
        bid.status = TakeoverStatus.Successful;
        updates.push(bid);
        
        console.log(`[StockMarket] Takeover successful: ${bid.acquirerId} acquired control of ${bid.targetId}`);
        
        this.emit('takeoverComplete', bid);
      }
    }
    
    return updates;
  }
  
  /**
   * 提交股票订单
   */
  submitOrder(request: StockOrderRequest): StockOrderResult {
    const stock = this.stocks.get(request.stockId);
    if (!stock) {
      return { success: false, error: '股票不存在' };
    }
    
    if (stock.status === StockStatus.Suspended || stock.status === StockStatus.Delisted) {
      return { success: false, error: '股票已停牌' };
    }
    
    const orderBook = this.orderBooks.get(request.stockId);
    if (!orderBook) {
      return { success: false, error: '订单簿不存在' };
    }
    
    // 检查买卖条件
    if (request.side === StockOrderSide.Buy) {
      const inventory = inventoryManager.getInventory(request.companyId);
      const price = request.limitPrice ?? stock.currentPrice;
      const totalCost = price * request.quantity;
      
      if (!inventory || inventory.cash < totalCost) {
        return { success: false, error: '资金不足' };
      }
    } else {
      const holding = this.getShareholding(request.companyId, request.stockId);
      if (!holding || holding.shares < request.quantity) {
        return { success: false, error: '持股不足' };
      }
    }
    
    // 创建订单
    const order: StockOrder = {
      id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      companyId: request.companyId,
      stockId: request.stockId,
      orderType: request.orderType,
      side: request.side,
      quantity: request.quantity,
      filledQuantity: 0,
      remainingQuantity: request.quantity,
      limitPrice: request.limitPrice,
      status: StockOrderStatus.Open,
      createdTick: 0, // 将在处理时设置
      expiryTick: VALUATION_CONSTANTS.DEFAULT_ORDER_EXPIRY,
    };
    
    if (request.side === StockOrderSide.Buy) {
      orderBook.submitBuyOrder(order);
    } else {
      orderBook.submitSellOrder(order);
    }
    
    console.log(`[StockMarket] Order submitted: ${request.side} ${request.quantity} ${request.stockId} @ ${request.limitPrice ?? 'market'}`);
    
    return { success: true, order };
  }
  
  /**
   * 取消订单
   */
  cancelOrder(stockId: EntityId, orderId: EntityId): boolean {
    const orderBook = this.orderBooks.get(stockId);
    if (!orderBook) return false;
    return orderBook.cancelOrder(orderId);
  }
  
  /**
   * 获取股票信息
   */
  getStock(stockId: EntityId): Stock | undefined {
    return this.stocks.get(stockId);
  }
  
  /**
   * 获取所有股票
   */
  getAllStocks(): Stock[] {
    return Array.from(this.stocks.values());
  }
  
  /**
   * 获取持股信息
   */
  getShareholding(holderId: EntityId, companyId: EntityId): Shareholding | undefined {
    const holdings = this.shareholdings.get(holderId);
    return holdings?.find(h => h.companyId === companyId);
  }
  
  /**
   * 获取某公司/个人的所有持股
   */
  getShareholdings(holderId: EntityId): Shareholding[] {
    return this.shareholdings.get(holderId) ?? [];
  }
  
  /**
   * 获取公司股东列表
   */
  getStockholders(companyId: EntityId): Shareholding[] {
    const stockholders: Shareholding[] = [];
    
    for (const [, holdings] of this.shareholdings) {
      const holding = holdings.find(h => h.companyId === companyId);
      if (holding && holding.shares > 0) {
        stockholders.push(holding);
      }
    }
    
    // 按持股比例排序
    stockholders.sort((a, b) => b.sharePercent - a.sharePercent);
    
    return stockholders;
  }
  
  /**
   * 获取市场状态
   */
  getMarketState(): StockMarketState {
    return { ...this.marketState };
  }
  
  /**
   * 获取股价历史
   */
  getPriceHistory(stockId: EntityId): StockPriceHistory[] {
    return this.priceHistory.get(stockId) ?? [];
  }
  
  /**
   * 获取某公司的所有挂单
   */
  getOrdersByCompany(companyId: EntityId): StockOrder[] {
    const allOrders: StockOrder[] = [];
    
    for (const [, orderBook] of this.orderBooks) {
      const orders = orderBook.getOrdersByCompany(companyId);
      for (const order of orders) {
        allOrders.push(order);
      }
    }
    
    // 按创建时间排序（最新的在前）
    allOrders.sort((a, b) => b.createdTick - a.createdTick);
    
    return allOrders;
  }
  
  /**
   * 获取某股票的所有挂单
   */
  getOrdersByStock(stockId: EntityId): StockOrder[] {
    const orderBook = this.orderBooks.get(stockId);
    if (!orderBook) return [];
    
    return orderBook.getAllOrders().filter(o =>
      o.status === StockOrderStatus.Open || o.status === StockOrderStatus.Partial
    );
  }
  
  /**
   * 获取最近成交记录
   */
  getRecentTrades(stockId?: EntityId, limit: number = 50): StockTrade[] {
    let trades = this.trades;
    if (stockId) {
      trades = trades.filter(t => t.stockId === stockId);
    }
    return trades.slice(-limit);
  }
  
  /**
   * 发起收购要约
   */
  initiateTakeover(
    acquirerId: EntityId,
    targetId: EntityId,
    offerPrice: Money,
    rationale: string,
    currentTick: GameTick
  ): { success: boolean; bid?: TakeoverBid; error?: string } {
    const targetStock = this.stocks.get(targetId);
    if (!targetStock) {
      return { success: false, error: '目标公司不存在' };
    }
    
    // 检查是否已有进行中的收购
    for (const [, bid] of this.takeoverBids) {
      if (bid.targetId === targetId && bid.status === TakeoverStatus.Pending) {
        return { success: false, error: '该公司已有进行中的收购要约' };
      }
    }
    
    // 检查持股比例
    const acquirerShares = this.getShareholding(acquirerId, targetId);
    if (!acquirerShares || acquirerShares.sharePercent < VALUATION_CONSTANTS.TAKEOVER_THRESHOLD) {
      return { success: false, error: `需持有至少${VALUATION_CONSTANTS.TAKEOVER_THRESHOLD * 100}%股份才能发起收购` };
    }
    
    const premium = (offerPrice - targetStock.currentPrice) / targetStock.currentPrice;
    
    const bid: TakeoverBid = {
      id: `takeover-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      acquirerId,
      targetId,
      offerPrice,
      premium,
      targetShares: 0, // 全额收购
      pledgedShares: 0,
      status: TakeoverStatus.Pending,
      initiatedTick: currentTick,
      expiryTick: currentTick + 30, // 30天有效期（1 tick = 1天）
      rationale,
      hostile: true, // 默认为敌意收购
      defenseActivated: false,
    };
    
    this.takeoverBids.set(bid.id, bid);
    
    console.log(`[StockMarket] Takeover bid initiated: ${acquirerId} -> ${targetId} @ ${offerPrice / 100} (${(premium * 100).toFixed(1)}% premium)`);
    
    this.emit('takeoverInitiated', bid);
    
    return { success: true, bid };
  }
  
  /**
   * 获取市场深度（盘口）
   */
  getMarketDepth(stockId: EntityId, levels: number = 5): {
    bids: Array<{ price: Money; volume: number }>;
    asks: Array<{ price: Money; volume: number }>;
  } {
    const orderBook = this.orderBooks.get(stockId);
    if (!orderBook) {
      return { bids: [], asks: [] };
    }
    
    // 聚合买单
    const bidPrices = new Map<Money, number>();
    for (const order of orderBook.getOpenBuyOrders()) {
      if (order.limitPrice) {
        const existing = bidPrices.get(order.limitPrice) ?? 0;
        bidPrices.set(order.limitPrice, existing + order.remainingQuantity);
      }
    }
    
    // 聚合卖单
    const askPrices = new Map<Money, number>();
    for (const order of orderBook.getOpenSellOrders()) {
      if (order.limitPrice) {
        const existing = askPrices.get(order.limitPrice) ?? 0;
        askPrices.set(order.limitPrice, existing + order.remainingQuantity);
      }
    }
    
    // 排序并取前N档
    const bids = Array.from(bidPrices.entries())
      .map(([price, volume]) => ({ price, volume }))
      .sort((a, b) => b.price - a.price)
      .slice(0, levels);
    
    const asks = Array.from(askPrices.entries())
      .map(([price, volume]) => ({ price, volume }))
      .sort((a, b) => a.price - b.price)
      .slice(0, levels);
    
    return { bids, asks };
  }
  
  /**
   * 重置股市
   */
  reset(): void {
    this.stocks.clear();
    this.shareholdings.clear();
    this.orderBooks.clear();
    this.trades = [];
    this.priceHistory.clear();
    this.takeoverBids.clear();
    this.dividends = [];
    this.financialsCache.clear();
    this.momentumData.clear();
    this.valuationCache.clear();
    this.marketState = this.createInitialMarketState();
    console.log('[StockMarket] Reset complete');
  }
}

// 单例导出
export const stockMarketService = new StockMarketService();