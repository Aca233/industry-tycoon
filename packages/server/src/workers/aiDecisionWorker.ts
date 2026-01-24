/**
 * AI Decision Worker - AI公司决策 Worker 线程
 * 
 * 在独立线程中执行AI公司的决策计算：
 * 1. 生产决策（产能规划）
 * 2. 交易决策（买卖时机）
 * 3. 投资决策（建筑购买）
 */

import { parentPort, workerData } from 'worker_threads';

// Worker ID
const workerId = workerData?.workerId ?? 0;
console.log(`[AIDecisionWorker ${workerId}] Starting...`);

// 消息类型定义
interface WorkerMessage {
  taskId: string;
  type: string;
  data: unknown;
}

interface WorkerResponse {
  taskId: string;
  result?: unknown;
  error?: string;
}

// ===== AI决策数据结构 =====

/**
 * AI公司个性类型
 */
type AIPersonality = 'aggressive' | 'conservative' | 'balanced' | 'innovative' | 'opportunist';

/**
 * 简化的AI公司数据
 */
interface AICompanyData {
  id: string;
  name: string;
  personality: AIPersonality;
  cash: number;
  buildings: Array<{
    id: string;
    definitionId: string;
    status: string;
    productionProgress: number;
    aggregatedCount: number;
  }>;
  focusIndustry: string;
  trustWithPlayer: number;
  hostilityToPlayer: number;
}

/**
 * 市场上下文
 */
interface MarketContext {
  prices: Record<string, number>;
  supplyDemand: Record<string, { supply: number; demand: number }>;
  priceHistory: Record<string, Array<{ tick: number; price: number }>>;
}

/**
 * 决策结果
 */
interface DecisionResult {
  companyId: string;
  actions: Array<{
    type: 'buy' | 'sell' | 'produce' | 'invest' | 'wait';
    goodsId?: string;
    quantity?: number;
    price?: number;
    buildingId?: string;
    reason: string;
  }>;
  mood: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

// ===== AI决策函数 =====

/**
 * 分析价格趋势
 */
function analyzePriceTrend(
  priceHistory: Array<{ tick: number; price: number }>,
  lookbackTicks: number = 10
): {
  trend: 'up' | 'down' | 'stable';
  strength: number;
  volatility: number;
} {
  if (priceHistory.length < 2) {
    return { trend: 'stable', strength: 0, volatility: 0 };
  }
  
  const recentPrices = priceHistory.slice(-lookbackTicks);
  
  if (recentPrices.length < 2) {
    return { trend: 'stable', strength: 0, volatility: 0 };
  }
  
  // 计算价格变化
  const firstPrice = recentPrices[0]?.price ?? 0;
  const lastPrice = recentPrices[recentPrices.length - 1]?.price ?? 0;
  
  if (firstPrice === 0) {
    return { trend: 'stable', strength: 0, volatility: 0 };
  }
  
  const change = (lastPrice - firstPrice) / firstPrice;
  
  // 计算波动率
  const returns: number[] = [];
  for (let i = 1; i < recentPrices.length; i++) {
    const prev = recentPrices[i - 1]?.price ?? 1;
    const curr = recentPrices[i]?.price ?? 1;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }
  
  let volatility = 0;
  if (returns.length > 0) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.map(r => Math.pow(r - mean, 2)).reduce((a, b) => a + b, 0) / returns.length;
    volatility = Math.sqrt(variance);
  }
  
  // 判断趋势
  let trend: 'up' | 'down' | 'stable';
  if (change > 0.02) {
    trend = 'up';
  } else if (change < -0.02) {
    trend = 'down';
  } else {
    trend = 'stable';
  }
  
  return {
    trend,
    strength: Math.abs(change),
    volatility,
  };
}

/**
 * 分析供需状况
 */
function analyzeSupplyDemand(
  supplyDemand: { supply: number; demand: number }
): {
  ratio: number;
  imbalance: 'oversupply' | 'undersupply' | 'balanced';
  severity: number;
} {
  const supply = supplyDemand.supply || 1;
  const demand = supplyDemand.demand || 1;
  const ratio = demand / supply;
  
  let imbalance: 'oversupply' | 'undersupply' | 'balanced';
  let severity: number;
  
  if (ratio > 1.2) {
    imbalance = 'undersupply';
    severity = Math.min(1, (ratio - 1) / 2);
  } else if (ratio < 0.8) {
    imbalance = 'oversupply';
    severity = Math.min(1, (1 - ratio) / 0.5);
  } else {
    imbalance = 'balanced';
    severity = 0;
  }
  
  return { ratio, imbalance, severity };
}

/**
 * 根据个性调整决策参数
 */
function getPersonalityParameters(personality: AIPersonality): {
  riskTolerance: number;
  priceFlexibility: number;
  inventoryTarget: number;
  reactionSpeed: number;
} {
  switch (personality) {
    case 'aggressive':
      return {
        riskTolerance: 0.8,
        priceFlexibility: 1.2,
        inventoryTarget: 0.5,
        reactionSpeed: 1.5,
      };
    case 'conservative':
      return {
        riskTolerance: 0.3,
        priceFlexibility: 0.9,
        inventoryTarget: 2.0,
        reactionSpeed: 0.5,
      };
    case 'balanced':
      return {
        riskTolerance: 0.5,
        priceFlexibility: 1.0,
        inventoryTarget: 1.0,
        reactionSpeed: 1.0,
      };
    case 'innovative':
      return {
        riskTolerance: 0.7,
        priceFlexibility: 1.1,
        inventoryTarget: 0.8,
        reactionSpeed: 1.2,
      };
    case 'opportunist':
      return {
        riskTolerance: 0.6,
        priceFlexibility: 1.3,
        inventoryTarget: 0.6,
        reactionSpeed: 2.0,
      };
    default:
      return {
        riskTolerance: 0.5,
        priceFlexibility: 1.0,
        inventoryTarget: 1.0,
        reactionSpeed: 1.0,
      };
  }
}

/**
 * 生成交易决策
 */
function generateTradingDecisions(
  company: AICompanyData,
  goodsId: string,
  marketContext: MarketContext,
  personalityParams: ReturnType<typeof getPersonalityParameters>
): Array<{
  type: 'buy' | 'sell' | 'wait';
  quantity: number;
  price: number;
  reason: string;
}> {
  const decisions: Array<{
    type: 'buy' | 'sell' | 'wait';
    quantity: number;
    price: number;
    reason: string;
  }> = [];
  
  const currentPrice = marketContext.prices[goodsId] ?? 0;
  if (currentPrice === 0) return [];
  
  const priceHistory = marketContext.priceHistory[goodsId] ?? [];
  const supplyDemand = marketContext.supplyDemand[goodsId] ?? { supply: 1000, demand: 1000 };
  
  // 分析市场状况
  const priceTrend = analyzePriceTrend(priceHistory);
  const sdAnalysis = analyzeSupplyDemand(supplyDemand);
  
  // 根据趋势和供需决定动作
  if (priceTrend.trend === 'up' && sdAnalysis.imbalance === 'undersupply') {
    // 价格上涨且供不应求 - 卖出获利
    const quantity = Math.floor(100 * personalityParams.reactionSpeed);
    const sellPrice = currentPrice * (1 + 0.05 * personalityParams.priceFlexibility);
    
    decisions.push({
      type: 'sell',
      quantity,
      price: sellPrice,
      reason: '价格上涨趋势，供不应求，获利卖出',
    });
  } else if (priceTrend.trend === 'down' && sdAnalysis.imbalance === 'oversupply') {
    // 价格下跌且供过于求 - 谨慎观望或抄底
    if (personalityParams.riskTolerance > 0.6) {
      const quantity = Math.floor(50 * personalityParams.reactionSpeed);
      const buyPrice = currentPrice * (1 - 0.1 * personalityParams.priceFlexibility);
      
      decisions.push({
        type: 'buy',
        quantity,
        price: buyPrice,
        reason: '低价抄底机会',
      });
    } else {
      decisions.push({
        type: 'wait',
        quantity: 0,
        price: 0,
        reason: '市场低迷，观望等待',
      });
    }
  } else if (sdAnalysis.imbalance === 'balanced') {
    // 市场平衡 - 根据个性决定
    if (company.personality === 'aggressive') {
      decisions.push({
        type: 'buy',
        quantity: Math.floor(30 * personalityParams.reactionSpeed),
        price: currentPrice * 0.98,
        reason: '积极建仓',
      });
    }
  }
  
  return decisions;
}

/**
 * 为单个AI公司生成决策
 */
function generateCompanyDecisions(
  company: AICompanyData,
  marketContext: MarketContext,
  currentTick: number
): DecisionResult {
  const personalityParams = getPersonalityParameters(company.personality);
  const actions: DecisionResult['actions'] = [];
  
  // 分析重点产业的相关商品
  const focusGoods = Object.keys(marketContext.prices).filter(goodsId => {
    // 简单匹配：根据商品ID包含产业关键词
    return goodsId.includes(company.focusIndustry) || 
           company.focusIndustry === 'general';
  });
  
  // 为每个相关商品生成交易决策
  for (const goodsId of focusGoods.slice(0, 3)) {
    const tradingDecisions = generateTradingDecisions(
      company,
      goodsId,
      marketContext,
      personalityParams
    );
    
    for (const decision of tradingDecisions) {
      actions.push({
        type: decision.type,
        goodsId,
        quantity: decision.quantity,
        price: decision.price,
        reason: decision.reason,
      });
    }
  }
  
  // 决定整体情绪
  let mood: DecisionResult['mood'] = 'neutral';
  const buyActions = actions.filter(a => a.type === 'buy').length;
  const sellActions = actions.filter(a => a.type === 'sell').length;
  
  if (buyActions > sellActions) {
    mood = 'bullish';
  } else if (sellActions > buyActions) {
    mood = 'bearish';
  }
  
  // 计算信心度
  const confidence = Math.min(1, (buyActions + sellActions) / 5 * personalityParams.riskTolerance);
  
  return {
    companyId: company.id,
    actions,
    mood,
    confidence,
  };
}

/**
 * 批量处理多个AI公司的决策
 */
function batchGenerateDecisions(
  companies: AICompanyData[],
  marketContext: MarketContext,
  currentTick: number
): DecisionResult[] {
  const results: DecisionResult[] = [];
  
  for (const company of companies) {
    const decision = generateCompanyDecisions(company, marketContext, currentTick);
    results.push(decision);
  }
  
  return results;
}

/**
 * 评估投资机会
 */
function evaluateInvestmentOpportunity(
  company: AICompanyData,
  buildingCost: number,
  expectedReturn: number,
  marketConditions: {
    priceTrend: 'up' | 'down' | 'stable';
    competitorCount: number;
  }
): {
  shouldInvest: boolean;
  score: number;
  reason: string;
} {
  const personalityParams = getPersonalityParameters(company.personality);
  
  // 计算投资回报率
  const roi = (expectedReturn - buildingCost) / buildingCost;
  
  // 计算得分
  let score = roi * 100;
  
  // 根据市场条件调整
  if (marketConditions.priceTrend === 'up') {
    score *= 1.2;
  } else if (marketConditions.priceTrend === 'down') {
    score *= 0.8;
  }
  
  // 根据竞争者数量调整
  if (marketConditions.competitorCount > 5) {
    score *= 0.9;
  }
  
  // 根据个性调整
  score *= personalityParams.riskTolerance + 0.5;
  
  // 检查资金是否充足
  const cashThreshold = buildingCost * (2 - personalityParams.riskTolerance);
  const hasSufficientCash = company.cash > cashThreshold;
  
  const shouldInvest = score > 50 && hasSufficientCash;
  
  let reason: string;
  if (!hasSufficientCash) {
    reason = `资金不足 (${company.cash} < ${cashThreshold})`;
  } else if (score > 70) {
    reason = `投资机会优秀 (得分: ${score.toFixed(1)})`;
  } else if (score > 50) {
    reason = `投资机会良好 (得分: ${score.toFixed(1)})`;
  } else {
    reason = `投资机会不佳 (得分: ${score.toFixed(1)})`;
  }
  
  return { shouldInvest, score, reason };
}

// ===== 消息处理 =====

parentPort?.on('message', (message: WorkerMessage) => {
  const { taskId, type, data } = message;
  
  try {
    let result: unknown;
    
    switch (type) {
      case 'GENERATE_DECISIONS': {
        const { company, marketContext, currentTick } = data as {
          company: AICompanyData;
          marketContext: MarketContext;
          currentTick: number;
        };
        result = generateCompanyDecisions(company, marketContext, currentTick);
        break;
      }
      
      case 'BATCH_GENERATE_DECISIONS': {
        const { companies, marketContext, currentTick } = data as {
          companies: AICompanyData[];
          marketContext: MarketContext;
          currentTick: number;
        };
        result = batchGenerateDecisions(companies, marketContext, currentTick);
        break;
      }
      
      case 'ANALYZE_PRICE_TREND': {
        const { priceHistory, lookbackTicks } = data as {
          priceHistory: Array<{ tick: number; price: number }>;
          lookbackTicks?: number;
        };
        result = analyzePriceTrend(priceHistory, lookbackTicks);
        break;
      }
      
      case 'ANALYZE_SUPPLY_DEMAND': {
        const supplyDemand = data as { supply: number; demand: number };
        result = analyzeSupplyDemand(supplyDemand);
        break;
      }
      
      case 'EVALUATE_INVESTMENT': {
        const { company, buildingCost, expectedReturn, marketConditions } = data as {
          company: AICompanyData;
          buildingCost: number;
          expectedReturn: number;
          marketConditions: {
            priceTrend: 'up' | 'down' | 'stable';
            competitorCount: number;
          };
        };
        result = evaluateInvestmentOpportunity(
          company,
          buildingCost,
          expectedReturn,
          marketConditions
        );
        break;
      }
      
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
    
    const response: WorkerResponse = { taskId, result };
    parentPort?.postMessage(response);
    
  } catch (error) {
    const response: WorkerResponse = {
      taskId,
      error: error instanceof Error ? error.message : String(error),
    };
    parentPort?.postMessage(response);
  }
});

console.log(`[AIDecisionWorker ${workerId}] Ready`);