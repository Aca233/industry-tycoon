/**
 * AI Stock Trading System
 * AI公司股票交易系统 - 让AI公司自动买卖股票，提供市场流动性
 */

import type {
  EntityId,
  Money,
  GameTick,
  Stock,
  StockOrder,
  StockOrderType,
  StockOrderSide,
} from '@scc/shared';
import {
  StockOrderType as OrderType,
  StockOrderSide as OrderSide,
  AI_COMPANIES_CONFIG,
} from '@scc/shared';
import { stockMarketService } from './stockMarket.js';
import { inventoryManager } from './inventoryManager.js';

/**
 * AI交易策略类型
 */
export type AITradingPersonality = 
  | 'conservative'    // 保守型：低频、低仓位、偏好蓝筹
  | 'aggressive'      // 激进型：高频、高仓位、追涨杀跌
  | 'trend_follower'  // 趋势跟随：顺势交易
  | 'contrarian'      // 逆向投资：低买高卖
  | 'market_maker';   // 做市商：双边挂单赚差价

/**
 * AI交易策略配置
 */
interface AITradingStrategy {
  personality: AITradingPersonality;
  /** 风险容忍度 0-1 */
  riskTolerance: number;
  /** 交易频率（每N个tick尝试交易一次） */
  tradingFrequency: number;
  /** 最大持仓比例（占总资产） */
  maxPositionRatio: number;
  /** 单笔交易最大比例（占可用资金/持股） */
  maxTradeRatio: number;
  /** 价格容忍度（相对公允价值的偏离） */
  priceTolerance: number;
}

/**
 * AI交易决策
 */
interface AITradingDecision {
  companyId: EntityId;
  stockId: EntityId;
  side: StockOrderSide;
  orderType: StockOrderType;
  quantity: number;
  limitPrice: Money | undefined;
  confidence: number;
  reasoning: string;
}

/**
 * 根据AI公司性格获取交易策略
 */
function getStrategyForPersonality(personality: string): AITradingStrategy {
  switch (personality) {
    case 'monopolist':
      return {
        personality: 'aggressive',
        riskTolerance: 0.8,
        tradingFrequency: 3,
        maxPositionRatio: 0.4,
        maxTradeRatio: 0.2,
        priceTolerance: 0.15,
      };
    case 'trend_surfer':
      return {
        personality: 'trend_follower',
        riskTolerance: 0.6,
        tradingFrequency: 2,
        maxPositionRatio: 0.3,
        maxTradeRatio: 0.15,
        priceTolerance: 0.1,
      };
    case 'old_money':
      return {
        personality: 'conservative',
        riskTolerance: 0.3,
        tradingFrequency: 12,
        maxPositionRatio: 0.2,
        maxTradeRatio: 0.05,
        priceTolerance: 0.05,
      };
    case 'innovator':
      return {
        personality: 'contrarian',
        riskTolerance: 0.5,
        tradingFrequency: 6,
        maxPositionRatio: 0.25,
        maxTradeRatio: 0.1,
        priceTolerance: 0.12,
      };
    default:
      return {
        personality: 'market_maker',
        riskTolerance: 0.4,
        tradingFrequency: 4,
        maxPositionRatio: 0.25,
        maxTradeRatio: 0.1,
        priceTolerance: 0.08,
      };
  }
}

/**
 * AI股票交易服务
 */
export class AIStockTradingService {
  /** 上次交易时间记录 */
  private lastTradeTick: Map<EntityId, GameTick> = new Map();
  
  /** 交易冷却时间的随机偏移（避免所有AI同时交易） */
  private tradingOffsets: Map<EntityId, number> = new Map();
  
  constructor() {
    // 为每个AI公司设置随机交易偏移
    for (const config of AI_COMPANIES_CONFIG) {
      this.tradingOffsets.set(config.id, Math.floor(Math.random() * 10));
    }
  }
  
  /**
   * 每tick处理AI交易
   */
  processTick(currentTick: GameTick): StockOrder[] {
    const orders: StockOrder[] = [];
    const stocks = stockMarketService.getAllStocks();
    
    if (stocks.length === 0) {
      if (currentTick % 100 === 0) {
        console.log(`[AIStockTrading] 无股票可交易`);
      }
      return orders;
    }
    
    // 每100 tick输出一次诊断信息
    const shouldLog = currentTick % 100 === 0;
    
    for (const config of AI_COMPANIES_CONFIG) {
      const strategy = getStrategyForPersonality(config.personality);
      const offset = this.tradingOffsets.get(config.id) ?? 0;
      
      // 检查是否到了交易时间
      const lastTrade = this.lastTradeTick.get(config.id) ?? 0;
      if ((currentTick + offset) % strategy.tradingFrequency !== 0) {
        continue;
      }
      if (currentTick - lastTrade < strategy.tradingFrequency) {
        continue;
      }
      
      // 生成交易决策
      const decisions = this.generateTradingDecisions(
        config.id,
        strategy,
        stocks,
        currentTick
      );
      
      if (shouldLog && decisions.length === 0) {
        // 诊断：为什么没有生成交易决策
        const inventory = inventoryManager.getInventory(config.id);
        if (!inventory) {
          console.log(`[AIStockTrading] ${config.name} 无库存数据`);
        } else {
          console.log(`[AIStockTrading] ${config.name} 现金=${(inventory.cash / 100).toFixed(0)} 无交易决策`);
        }
      }
      
      // 执行决策
      for (const decision of decisions) {
        const result = stockMarketService.submitOrder({
          companyId: decision.companyId,
          stockId: decision.stockId,
          orderType: decision.orderType,
          side: decision.side,
          quantity: decision.quantity,
          limitPrice: decision.limitPrice,
        });
        
        if (result.success && result.order) {
          orders.push(result.order);
          console.log(`[AIStockTrading] ${config.name} ${decision.side} ${decision.quantity} shares of ${decision.stockId} @ ${decision.limitPrice ?? 'market'}`);
        } else if (result.error) {
          console.log(`[AIStockTrading] ${config.name} 订单失败: ${result.error}`);
        }
      }
      
      this.lastTradeTick.set(config.id, currentTick);
    }
    
    return orders;
  }
  
  /**
   * 生成交易决策
   */
  private generateTradingDecisions(
    companyId: EntityId,
    strategy: AITradingStrategy,
    stocks: Stock[],
    _currentTick: GameTick
  ): AITradingDecision[] {
    const decisions: AITradingDecision[] = [];
    const inventory = inventoryManager.getInventory(companyId);
    
    if (!inventory) {
      return decisions;
    }
    
    const cash = inventory.cash;
    
    // 确保有足够的现金进行交易（至少100元）
    if (cash < 10000) {
      return decisions;
    }
    
    const holdings = stockMarketService.getShareholdings(companyId);
    
    // 计算当前总资产价值
    let totalAssets = cash;
    for (const holding of holdings) {
      const stock = stocks.find(s => s.companyId === holding.companyId);
      if (stock) {
        totalAssets += holding.shares * stock.currentPrice;
      }
    }
    
    // 确保 totalAssets 有意义的值
    if (totalAssets < 10000) {
      totalAssets = cash + 10000000; // 假设有1000万的其他资产
    }
    
    // 遍历所有股票，评估交易机会
    for (const stock of stocks) {
      // 不交易自己公司的股票
      if (stock.companyId === companyId) continue;
      
      // 获取公司估值
      const valuation = stockMarketService.calculateValuation(stock.companyId);
      if (!valuation) continue;
      
      // 计算价格偏离度
      const priceDeviation = (stock.currentPrice - valuation.fairValue) / valuation.fairValue;
      
      // 获取当前持仓
      const holding = holdings.find(h => h.companyId === stock.companyId);
      const currentShares = holding?.shares ?? 0;
      const currentValue = currentShares * stock.currentPrice;
      const positionRatio = currentValue / totalAssets;
      
      // 根据策略类型决定交易方向
      const decision = this.evaluateTradeOpportunity(
        companyId,
        stock,
        strategy,
        priceDeviation,
        positionRatio,
        cash,
        currentShares,
        totalAssets
      );
      
      if (decision) {
        decisions.push(decision);
      }
    }
    
    // 限制每次最多产生2个订单
    return decisions.slice(0, 2);
  }
  
  /**
   * 评估单个股票的交易机会
   */
  private evaluateTradeOpportunity(
    companyId: EntityId,
    stock: Stock,
    strategy: AITradingStrategy,
    priceDeviation: number,
    positionRatio: number,
    cash: Money,
    currentShares: number,
    _totalAssets: Money
  ): AITradingDecision | null {
    // 随机因素（增加市场不确定性）
    const randomFactor = Math.random();
    
    // 提高交易意愿概率，让市场更活跃
    // 基础概率60% + 策略调整（最高90%）
    if (randomFactor > 0.6 + strategy.riskTolerance * 0.3) {
      return null;
    }
    
    let shouldBuy = false;
    let shouldSell = false;
    let confidence = 0;
    let reasoning = '';
    
    switch (strategy.personality) {
      case 'conservative':
        // 保守型：只在明显低估时买入，高估时卖出
        if (priceDeviation < -strategy.priceTolerance * 2 && positionRatio < strategy.maxPositionRatio) {
          shouldBuy = true;
          confidence = Math.min(0.9, Math.abs(priceDeviation) * 2);
          reasoning = '股价明显低于公允价值，低风险买入';
        } else if (priceDeviation > strategy.priceTolerance * 1.5 && currentShares > 0) {
          shouldSell = true;
          confidence = Math.min(0.8, priceDeviation * 1.5);
          reasoning = '股价高估，保守获利了结';
        }
        break;
        
      case 'aggressive':
        // 激进型：追涨杀跌
        if (stock.priceChangePercent > 0.02 && positionRatio < strategy.maxPositionRatio) {
          shouldBuy = true;
          confidence = Math.min(0.9, stock.priceChangePercent * 10);
          reasoning = '价格上涨势头强劲，追涨买入';
        } else if (stock.priceChangePercent < -0.02 && currentShares > 0) {
          shouldSell = true;
          confidence = Math.min(0.9, Math.abs(stock.priceChangePercent) * 10);
          reasoning = '价格下跌，止损卖出';
        } else if (randomFactor < strategy.riskTolerance * 0.3 && positionRatio < strategy.maxPositionRatio) {
          shouldBuy = true;
          confidence = 0.3;
          reasoning = '激进策略：随机建仓';
        }
        break;
        
      case 'trend_follower':
        // 趋势跟随：持续上涨则买，持续下跌则卖
        if (stock.currentPrice > stock.previousClose && stock.priceChangePercent > 0) {
          if (positionRatio < strategy.maxPositionRatio) {
            shouldBuy = true;
            confidence = 0.4 + stock.priceChangePercent * 5;
            reasoning = '趋势向上，跟随买入';
          }
        } else if (stock.currentPrice < stock.previousClose && stock.priceChangePercent < 0) {
          if (currentShares > 0) {
            shouldSell = true;
            confidence = 0.4 + Math.abs(stock.priceChangePercent) * 5;
            reasoning = '趋势向下，跟随卖出';
          }
        }
        break;
        
      case 'contrarian':
        // 逆向投资：低买高卖
        if (priceDeviation < -strategy.priceTolerance && positionRatio < strategy.maxPositionRatio) {
          shouldBuy = true;
          confidence = Math.min(0.9, Math.abs(priceDeviation) * 3);
          reasoning = '股价低估，逆向买入';
        } else if (priceDeviation > strategy.priceTolerance && currentShares > 0) {
          shouldSell = true;
          confidence = Math.min(0.9, priceDeviation * 3);
          reasoning = '股价高估，逆向卖出';
        }
        break;
        
      case 'market_maker':
        // 做市商：双边挂单
        if (randomFactor < 0.5) {
          if (positionRatio < strategy.maxPositionRatio * 0.8) {
            shouldBuy = true;
            confidence = 0.5;
            reasoning = '做市买入，提供流动性';
          }
        } else {
          if (currentShares > 0 && positionRatio > strategy.maxPositionRatio * 0.2) {
            shouldSell = true;
            confidence = 0.5;
            reasoning = '做市卖出，平衡持仓';
          }
        }
        break;
    }
    
    if (!shouldBuy && !shouldSell) {
      return null;
    }
    
    // 计算交易数量
    let quantity = 0;
    let limitPrice: Money | undefined = undefined;
    
    if (shouldBuy) {
      // 买入数量：可用资金的一定比例
      // 提高交易比例，让市场更活跃
      const tradeRatio = strategy.maxTradeRatio * 2; // 增加交易比例
      const maxBuyValue = cash * tradeRatio;
      quantity = Math.floor(maxBuyValue / stock.currentPrice);
      
      // 调整最小交易量（根据股价动态调整）
      const minQuantity = stock.currentPrice > 10000 ? 10 : 100; // 高价股降低最小单位
      quantity = Math.max(minQuantity, Math.floor(quantity / minQuantity) * minQuantity);
      
      // 设置限价（比当前价高一点，确保能成交）
      // 提高溢价范围，更容易成交
      limitPrice = Math.round(stock.currentPrice * (1 + 0.02 + Math.random() * 0.03));
    } else if (shouldSell) {
      // 卖出数量：持仓的一定比例
      const tradeRatio = strategy.maxTradeRatio * 2; // 增加交易比例
      quantity = Math.floor(currentShares * tradeRatio);
      
      // 调整最小交易量
      const minQuantity = stock.currentPrice > 10000 ? 10 : 100;
      quantity = Math.max(minQuantity, Math.floor(quantity / minQuantity) * minQuantity);
      // 不能卖超过持有的
      quantity = Math.min(quantity, currentShares);
      
      // 设置限价（比当前价低一点，确保能成交）
      // 提高折价范围，更容易成交
      limitPrice = Math.round(stock.currentPrice * (1 - 0.02 - Math.random() * 0.03));
    }
    
    // 降低最小交易量限制
    if (quantity < 10) {
      return null;
    }
    
    return {
      companyId,
      stockId: stock.companyId,
      side: shouldBuy ? OrderSide.Buy : OrderSide.Sell,
      orderType: OrderType.Limit,
      quantity,
      limitPrice,
      confidence,
      reasoning,
    };
  }
  
  /**
   * 重置状态
   */
  reset(): void {
    this.lastTradeTick.clear();
    // 重新设置随机偏移
    for (const config of AI_COMPANIES_CONFIG) {
      this.tradingOffsets.set(config.id, Math.floor(Math.random() * 10));
    }
    console.log('[AIStockTrading] Reset complete');
  }
}

// 单例导出
export const aiStockTradingService = new AIStockTradingService();