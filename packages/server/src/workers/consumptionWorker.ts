/**
 * Consumption Worker - 消费需求计算 Worker 线程
 * 
 * 在独立线程中执行计算密集型的消费需求计算任务：
 * 1. POP群体消费决策
 * 2. 效用/价格比计算
 * 3. 需求订单生成
 */

import { parentPort, workerData } from 'worker_threads';

// Worker ID
const workerId = workerData?.workerId ?? 0;
console.log(`[ConsumptionWorker ${workerId}] Starting...`);

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

// ===== 消费计算函数 =====

/**
 * POP群体配置（简化版，用于Worker）
 */
interface POPGroupData {
  id: string;
  population: number;
  monthlyIncome: number;
  needBudgets: Record<string, number>;
  preferences?: {
    premiumBonus?: number;
    priceSensitivity?: number;
  };
}

/**
 * 需求组配置（简化版）
 */
interface NeedGroupData {
  id: string;
  priority: number;
  satisfactionDecay: number;
  eligibleGoods: Array<{
    goodsId: string;
    baseUtility: number;
    substitutionPenalty: number;
  }>;
}

/**
 * 消费决策结果
 */
interface ConsumptionDecisionResult {
  popGroupId: string;
  needGroupId: string;
  goodsId: string;
  quantity: number;
  maxPrice: number;
  utility: number;
  utilityPriceRatio: number;
  isSubstitute: boolean;
}

/**
 * 计算消费倍数
 */
function calculateConsumptionMultiplier(satisfaction: number): number {
  if (satisfaction < 30) return 1.5;
  if (satisfaction < 50) return 1.2;
  if (satisfaction < 70) return 1.0;
  if (satisfaction < 90) return 0.7;
  return 0.3;
}

/**
 * 为商品评分
 */
function scoreGoods(
  popGroup: POPGroupData,
  goods: Array<{ goodsId: string; baseUtility: number; substitutionPenalty: number }>,
  prices: Record<string, number>
): Array<{
  goodsId: string;
  baseUtility: number;
  adjustedUtility: number;
  score: number;
  isSubstitute: boolean;
}> {
  const result: Array<{
    goodsId: string;
    baseUtility: number;
    adjustedUtility: number;
    score: number;
    isSubstitute: boolean;
  }> = [];
  
  const premiumBonus = popGroup.preferences?.premiumBonus ?? 1.0;
  const priceSensitivity = popGroup.preferences?.priceSensitivity ?? 1.0;
  
  for (const good of goods) {
    const price = prices[good.goodsId];
    if (!price || price <= 0) continue;
    
    // 计算调整后效用
    let adjustedUtility = good.baseUtility * (1 - good.substitutionPenalty);
    
    // 高端商品对富裕阶层效用更高
    if (good.baseUtility > 80) {
      adjustedUtility *= premiumBonus;
    }
    
    // 计算效用/价格比
    const priceWeight = Math.pow(price, priceSensitivity);
    const score = adjustedUtility / (priceWeight / 10000);
    
    result.push({
      goodsId: good.goodsId,
      baseUtility: good.baseUtility,
      adjustedUtility,
      score,
      isSubstitute: good.substitutionPenalty > 0,
    });
  }
  
  return result;
}

/**
 * 为单个需求组生成消费决策
 */
function generateDecisionsForNeedGroup(
  popGroup: POPGroupData,
  needGroup: NeedGroupData,
  budget: number,
  prices: Record<string, number>,
  config: {
    maxPriceMultiplier: number;
    orderSamplingRate: number;
    maxOrderQuantityPerGoods: number;
  }
): ConsumptionDecisionResult[] {
  const decisions: ConsumptionDecisionResult[] = [];
  
  if (needGroup.eligibleGoods.length === 0) return [];
  
  // 为商品评分
  const scoredGoods = scoreGoods(popGroup, needGroup.eligibleGoods, prices);
  scoredGoods.sort((a, b) => b.score - a.score);
  
  let remainingBudget = budget;
  
  for (const scored of scoredGoods) {
    if (remainingBudget <= 0) break;
    
    const currentPrice = prices[scored.goodsId];
    if (!currentPrice || currentPrice <= 0) continue;
    
    // 计算最高愿意支付价格
    const maxPrice = currentPrice * config.maxPriceMultiplier;
    const affordableQuantity = Math.floor(remainingBudget / maxPrice);
    
    if (affordableQuantity <= 0) continue;
    
    // 根据人口规模和效用确定购买数量
    const utilityFactor = scored.baseUtility / 100;
    const populationFactor = popGroup.population / 100000;
    
    // 计算理论需求量
    const theoreticalQuantity = Math.floor(affordableQuantity * utilityFactor * populationFactor * 10);
    
    // 应用采样率
    const sampledQuantity = Math.max(1, Math.floor(theoreticalQuantity * config.orderSamplingRate));
    
    // 限制单商品订单量
    const quantity = Math.min(sampledQuantity, config.maxOrderQuantityPerGoods);
    const actualQuantity = Math.min(quantity, affordableQuantity);
    const cost = actualQuantity * maxPrice;
    
    decisions.push({
      popGroupId: popGroup.id,
      needGroupId: needGroup.id,
      goodsId: scored.goodsId,
      quantity: actualQuantity,
      maxPrice: maxPrice,
      utility: scored.adjustedUtility,
      utilityPriceRatio: scored.score,
      isSubstitute: scored.isSubstitute,
    });
    
    remainingBudget -= cost;
  }
  
  return decisions;
}

/**
 * 批量计算所有POP群体的消费决策
 */
function batchCalculateConsumption(
  popGroups: POPGroupData[],
  needGroups: NeedGroupData[],
  prices: Record<string, number>,
  satisfaction: Record<string, Record<string, number>>,
  config: {
    maxPriceMultiplier: number;
    orderSamplingRate: number;
    maxOrderQuantityPerGoods: number;
  }
): {
  decisions: ConsumptionDecisionResult[];
  updatedSatisfaction: Record<string, Record<string, number>>;
} {
  const allDecisions: ConsumptionDecisionResult[] = [];
  const updatedSatisfaction: Record<string, Record<string, number>> = {};
  
  // 按需求组优先级排序
  const sortedNeedGroups = [...needGroups].sort((a, b) => a.priority - b.priority);
  
  for (const popGroup of popGroups) {
    // 计算每日预算
    const dailyBudget = (popGroup.population * popGroup.monthlyIncome) / 30;
    
    // 初始化满足度
    const popSatisfaction = satisfaction[popGroup.id] ?? {};
    updatedSatisfaction[popGroup.id] = { ...popSatisfaction };
    
    for (const needGroup of sortedNeedGroups) {
      const budgetRatio = popGroup.needBudgets[needGroup.id] ?? 0;
      if (budgetRatio <= 0) continue;
      
      const needBudget = dailyBudget * budgetRatio;
      const currentSatisfaction = popSatisfaction[needGroup.id] ?? 50;
      
      // 根据满足度调整消费欲望
      const consumptionMultiplier = calculateConsumptionMultiplier(currentSatisfaction);
      const effectiveBudget = needBudget * consumptionMultiplier;
      
      if (effectiveBudget <= 0) continue;
      
      // 生成消费决策
      const decisions = generateDecisionsForNeedGroup(
        popGroup,
        needGroup,
        effectiveBudget,
        prices,
        config
      );
      
      allDecisions.push(...decisions);
      
      // 更新满足度（衰减）
      const decay = needGroup.satisfactionDecay * 100;
      updatedSatisfaction[popGroup.id]![needGroup.id] = Math.max(0, currentSatisfaction - decay);
    }
  }
  
  return {
    decisions: allDecisions,
    updatedSatisfaction,
  };
}

// ===== 消息处理 =====

parentPort?.on('message', (message: WorkerMessage) => {
  const { taskId, type, data } = message;
  
  try {
    let result: unknown;
    
    switch (type) {
      case 'CALCULATE_CONSUMPTION': {
        const {
          popGroups,
          needGroups,
          prices,
          satisfaction,
          config,
        } = data as {
          popGroups: POPGroupData[];
          needGroups: NeedGroupData[];
          prices: Record<string, number>;
          satisfaction: Record<string, Record<string, number>>;
          config: {
            maxPriceMultiplier: number;
            orderSamplingRate: number;
            maxOrderQuantityPerGoods: number;
          };
        };
        
        result = batchCalculateConsumption(
          popGroups,
          needGroups,
          prices,
          satisfaction,
          config
        );
        break;
      }
      
      case 'SCORE_GOODS': {
        const { popGroup, goods, prices } = data as {
          popGroup: POPGroupData;
          goods: Array<{ goodsId: string; baseUtility: number; substitutionPenalty: number }>;
          prices: Record<string, number>;
        };
        result = scoreGoods(popGroup, goods, prices);
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

console.log(`[ConsumptionWorker ${workerId}] Ready`);