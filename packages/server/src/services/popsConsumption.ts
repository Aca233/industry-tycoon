/**
 * POPs 消费决策服务
 * 
 * 实现 Victoria 3 风格的人口消费系统:
 * - 按需求组优先级分配预算
 * - 计算商品效用/价格比
 * - 处理商品平替逻辑
 * - 生成购买订单
 */

import { EventEmitter } from 'events';
import type { 
  POPGroupConfig, 
  NeedGroupConfig, 
  ConsumptionDecision,
  MarketPriceInfo,
} from '@scc/shared';
import {
  POP_GROUPS,
  NEED_GROUPS,
  getGoodsForNeedGroupSorted,
  GOODS_DATA,
} from '@scc/shared';
import { priceDiscoveryService } from './priceDiscovery.js';
import { marketOrderBook } from './marketOrderBook.js';

/**
 * POPs消费服务配置
 */
interface POPsConsumptionConfig {
  /** 订单有效期 (ticks) */
  orderExpiry: number;
  /** 每个tick处理的消费决策数量 */
  decisionsPerTick: number;
  /** 最大愿意支付的价格倍数 (相对于市价) */
  maxPriceMultiplier: number;
}

const DEFAULT_CONFIG: POPsConsumptionConfig = {
  orderExpiry: 48, // 2天
  decisionsPerTick: 100,
  maxPriceMultiplier: 1.1, // 降低到1.1防止价格被推高（原来是1.5）
};

/**
 * POPs消费管理器
 */
export class POPsConsumptionManager extends EventEmitter {
  private config: POPsConsumptionConfig;
  private initialized: boolean = false;
  
  /** 每个POPGroup的当前满足度 */
  private satisfaction: Map<string, Record<string, number>> = new Map();
  
  /** 上次处理tick */
  private lastProcessTick: number = -24; // 每24tick处理一次
  
  /** 处理间隔 */
  private readonly PROCESS_INTERVAL = 24; // 每天处理一次
  
  constructor(config: Partial<POPsConsumptionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 初始化服务
   */
  initialize(): void {
    if (this.initialized) return;
    
    // 初始化每个POPGroup的满足度
    for (const popGroup of POP_GROUPS) {
      const needSatisfaction: Record<string, number> = {};
      for (const needGroup of NEED_GROUPS) {
        needSatisfaction[needGroup.id] = 50; // 初始满足度50%
      }
      this.satisfaction.set(popGroup.id, needSatisfaction);
    }
    
    this.initialized = true;
    console.log('[POPsConsumption] Initialized');
  }
  
  /**
   * 每tick更新
   */
  update(currentTick: number): ConsumptionDecision[] {
    if (!this.initialized) {
      this.initialize();
    }
    
    // 每天处理一次消费决策
    if (currentTick - this.lastProcessTick < this.PROCESS_INTERVAL) {
      return [];
    }
    
    this.lastProcessTick = currentTick;
    
    // 衰减满足度
    this.decaySatisfaction();
    
    // 生成所有POPGroup的消费决策
    const allDecisions: ConsumptionDecision[] = [];
    
    for (const popGroup of POP_GROUPS) {
      const decisions = this.generateDecisionsForPOPGroup(popGroup, currentTick);
      allDecisions.push(...decisions);
    }
    
    // 提交订单
    this.submitOrders(allDecisions, currentTick);
    
    return allDecisions;
  }
  
  /**
   * 衰减满足度
   */
  private decaySatisfaction(): void {
    for (const popGroup of POP_GROUPS) {
      const satisfaction = this.satisfaction.get(popGroup.id);
      if (!satisfaction) continue;
      
      for (const needGroup of NEED_GROUPS) {
        const current = satisfaction[needGroup.id] ?? 50;
        const decay = needGroup.satisfactionDecay * 100; // 转换为百分比
        satisfaction[needGroup.id] = Math.max(0, current - decay);
      }
    }
  }
  
  /**
   * 为单个POPGroup生成消费决策
   */
  private generateDecisionsForPOPGroup(
    popGroup: POPGroupConfig, 
    currentTick: number
  ): ConsumptionDecision[] {
    const decisions: ConsumptionDecision[] = [];
    
    // 计算每日预算 (月预算 / 30)
    const dailyBudget = (popGroup.population * popGroup.monthlyIncome) / 30;
    
    // 按需求组优先级排序
    const sortedNeedGroups = [...NEED_GROUPS].sort((a, b) => a.priority - b.priority);
    
    // 为每个需求组分配预算并生成决策
    for (const needGroup of sortedNeedGroups) {
      const budgetRatio = popGroup.needBudgets[needGroup.id] ?? 0;
      if (budgetRatio <= 0) continue;
      
      const needBudget = dailyBudget * budgetRatio;
      
      // 获取当前满足度
      const satisfaction = this.satisfaction.get(popGroup.id)?.[needGroup.id] ?? 50;
      
      // 满足度高时减少消费欲望
      const consumptionMultiplier = this.calculateConsumptionMultiplier(satisfaction);
      const effectiveBudget = needBudget * consumptionMultiplier;
      
      if (effectiveBudget <= 0) continue;
      
      // 生成该需求组的消费决策
      const needDecisions = this.generateDecisionsForNeedGroup(
        popGroup,
        needGroup,
        effectiveBudget,
        currentTick
      );
      
      decisions.push(...needDecisions);
    }
    
    return decisions;
  }
  
  /**
   * 根据满足度计算消费倍数
   * 满足度低时消费欲望高，满足度高时消费欲望低
   */
  private calculateConsumptionMultiplier(satisfaction: number): number {
    if (satisfaction < 30) return 1.5;  // 极度不满，大量消费
    if (satisfaction < 50) return 1.2;  // 不满，增加消费
    if (satisfaction < 70) return 1.0;  // 正常
    if (satisfaction < 90) return 0.7;  // 满意，减少消费
    return 0.3; // 非常满意，很少消费
  }
  
  /**
   * 为单个需求组生成消费决策
   */
  private generateDecisionsForNeedGroup(
    popGroup: POPGroupConfig,
    needGroup: NeedGroupConfig,
    budget: number,
    _currentTick: number
  ): ConsumptionDecision[] {
    const decisions: ConsumptionDecision[] = [];
    
    // 获取该需求组的可选商品 (按效用排序)
    const eligibleGoods = getGoodsForNeedGroupSorted(needGroup.id);
    
    if (eligibleGoods.length === 0) return [];
    
    // 获取市场价格信息
    const priceInfos: MarketPriceInfo[] = eligibleGoods.map((g: { goodsId: string; baseUtility: number; substitutionPenalty: number }) => ({
      goodsId: g.goodsId,
      currentPrice: priceDiscoveryService.getPrice(g.goodsId),
      available: true, // TODO: 检查实际库存
      availableQuantity: 1000000, // 假设充足
    }));
    
    // 计算每个商品的效用/价格比
    const scoredGoods = this.scoreGoods(popGroup, eligibleGoods, priceInfos);
    
    // 按分数排序
    scoredGoods.sort((a, b) => b.score - a.score);
    
    // 分配预算购买商品
    let remainingBudget = budget;
    
    for (const scored of scoredGoods) {
      if (remainingBudget <= 0) break;
      
      const priceInfo = priceInfos.find(p => p.goodsId === scored.goodsId);
      if (!priceInfo || priceInfo.currentPrice <= 0) continue;
      
      // 获取商品基准价格，确保不超过合理范围
      const goodsData = GOODS_DATA.find(g => g.id === scored.goodsId);
      const basePrice = goodsData?.basePrice ?? priceInfo.currentPrice;
      // 绝对上限：基准价的3倍，防止推高价格
      const absoluteMaxPrice = basePrice * 3;
      // 计算可购买数量
      const maxPrice = Math.min(
        priceInfo.currentPrice * this.config.maxPriceMultiplier,
        absoluteMaxPrice
      );
      const affordableQuantity = Math.floor(remainingBudget / maxPrice);
      
      if (affordableQuantity <= 0) continue;
      
      // 根据人口规模和效用确定购买数量
      // 效用高的商品购买更多
      // 修复：移除 0.1 系数，大幅增加购买量以确保市场有足够需求
      const utilityFactor = scored.baseUtility / 100;
      const populationFactor = popGroup.population / 1000000; // 每百万人
      const quantity = Math.max(5, Math.floor(affordableQuantity * utilityFactor * populationFactor));
      
      const actualQuantity = Math.min(quantity, affordableQuantity);
      const cost = actualQuantity * maxPrice;
      
      const decision: ConsumptionDecision = {
        popGroupId: popGroup.id,
        needGroupId: needGroup.id,
        goodsId: scored.goodsId,
        quantity: actualQuantity,
        maxPrice: maxPrice,
        isSubstitute: scored.isSubstitute,
        utility: scored.adjustedUtility,
        utilityPriceRatio: scored.score,
      };
      
      // 仅在有原始偏好时添加
      if (scored.originalPreference) {
        decision.originalPreference = scored.originalPreference;
      }
      
      decisions.push(decision);
      
      remainingBudget -= cost;
    }
    
    return decisions;
  }
  
  /**
   * 为商品评分 (效用/价格比)
   */
  private scoreGoods(
    popGroup: POPGroupConfig,
    goods: Array<{ goodsId: string; baseUtility: number; substitutionPenalty: number }>,
    priceInfos: MarketPriceInfo[]
  ): Array<{
    goodsId: string;
    baseUtility: number;
    adjustedUtility: number;
    score: number;
    isSubstitute: boolean;
    originalPreference?: string;
  }> {
    const result: Array<{
      goodsId: string;
      baseUtility: number;
      adjustedUtility: number;
      score: number;
      isSubstitute: boolean;
      originalPreference?: string;
    }> = [];
    
    const premiumBonus = popGroup.preferences?.premiumBonus ?? 1.0;
    const priceSensitivity = popGroup.preferences?.priceSensitivity ?? 1.0;
    
    for (const good of goods) {
      const priceInfo = priceInfos.find(p => p.goodsId === good.goodsId);
      if (!priceInfo || priceInfo.currentPrice <= 0) continue;
      
      // 计算调整后效用
      // 1. 应用替代惩罚
      let adjustedUtility = good.baseUtility * (1 - good.substitutionPenalty);
      
      // 2. 应用阶层偏好 (高端商品对富裕阶层效用更高)
      if (good.baseUtility > 80) {
        adjustedUtility *= premiumBonus;
      }
      
      // 3. 计算效用/价格比 (考虑价格敏感度)
      const priceWeight = Math.pow(priceInfo.currentPrice, priceSensitivity);
      const score = adjustedUtility / (priceWeight / 10000); // 归一化
      
      const scoredGood: {
        goodsId: string;
        baseUtility: number;
        adjustedUtility: number;
        score: number;
        isSubstitute: boolean;
        originalPreference?: string;
      } = {
        goodsId: good.goodsId,
        baseUtility: good.baseUtility,
        adjustedUtility,
        score,
        isSubstitute: good.substitutionPenalty > 0,
      };
      
      // 仅在是替代品时设置原始偏好
      if (good.substitutionPenalty > 0 && goods[0]) {
        scoredGood.originalPreference = goods[0].goodsId;
      }
      
      result.push(scoredGood);
    }
    
    return result;
  }
  
  /**
   * 提交购买订单
   */
  private submitOrders(decisions: ConsumptionDecision[], currentTick: number): void {
    for (const decision of decisions) {
      if (decision.quantity <= 0) continue;
      
      // 创建虚拟消费者ID
      const consumerId = `pop-${decision.popGroupId}`;
      
      try {
        const order = marketOrderBook.submitBuyOrder(
          consumerId,
          decision.goodsId,
          decision.quantity,
          decision.maxPrice,
          currentTick,
          this.config.orderExpiry
        );
        
        if (order) {
          // 更新满足度 (订单提交成功视为部分满足)
          this.updateSatisfaction(decision.popGroupId, decision.needGroupId, 5);
        }
      } catch (error) {
        console.error(`[POPsConsumption] Failed to submit order:`, error);
      }
    }
  }
  
  /**
   * 更新满足度
   */
  private updateSatisfaction(popGroupId: string, needGroupId: string, delta: number): void {
    const satisfaction = this.satisfaction.get(popGroupId);
    if (!satisfaction) return;
    
    const current = satisfaction[needGroupId] ?? 50;
    satisfaction[needGroupId] = Math.max(0, Math.min(100, current + delta));
  }
  
  /**
   * 订单成交回调 (由撮合引擎调用)
   */
  onOrderFilled(consumerId: string, goodsId: string, quantity: number): void {
    // 解析POPGroup ID
    if (!consumerId.startsWith('pop-')) return;
    
    const popGroupId = consumerId.replace('pop-', '');
    
    // 查找该商品属于哪个需求组
    for (const needGroup of NEED_GROUPS) {
      if (needGroup.eligibleGoods.includes(goodsId)) {
        // 增加满足度
        const satisfactionGain = Math.min(20, quantity * 2);
        this.updateSatisfaction(popGroupId, needGroup.id, satisfactionGain);
        break;
      }
    }
  }
  
  /**
   * 获取POPGroup的满足度
   */
  getSatisfaction(popGroupId: string): Record<string, number> | undefined {
    return this.satisfaction.get(popGroupId);
  }
  
  /**
   * 获取所有POPGroup的满足度汇总
   */
  getAllSatisfaction(): Map<string, Record<string, number>> {
    return new Map(this.satisfaction);
  }
  
  /**
   * 获取市场需求预测
   */
  getDemandForecast(): Record<string, number> {
    const forecast: Record<string, number> = {};
    
    for (const popGroup of POP_GROUPS) {
      const dailyBudget = (popGroup.population * popGroup.monthlyIncome) / 30;
      
      for (const needGroup of NEED_GROUPS) {
        const budgetRatio = popGroup.needBudgets[needGroup.id] ?? 0;
        const needBudget = dailyBudget * budgetRatio;
        
        const eligibleGoods = getGoodsForNeedGroupSorted(needGroup.id);
        
        for (const good of eligibleGoods) {
          const currentPrice = priceDiscoveryService.getPrice(good.goodsId);
          if (currentPrice <= 0) continue;
          
          const estimatedQuantity = needBudget / currentPrice / eligibleGoods.length;
          
          const currentForecast = forecast[good.goodsId] ?? 0;
          forecast[good.goodsId] = currentForecast + estimatedQuantity;
        }
      }
    }
    
    return forecast;
  }
  
  /**
   * 重置服务
   */
  reset(): void {
    this.satisfaction.clear();
    this.lastProcessTick = -24;
    this.initialized = false;
    console.log('[POPsConsumption] Reset');
  }
}

// 单例导出
export const popsConsumptionManager = new POPsConsumptionManager();