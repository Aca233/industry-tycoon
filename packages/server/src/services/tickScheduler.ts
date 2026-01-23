/**
 * Tick调度器 - 分层tick处理
 * 
 * 将不同频率的操作分离，减少每tick负担
 * 
 * 高频操作（每tick）:
 * - 建筑生产进度
 * - 订单撮合
 * 
 * 中频操作（每5-20 tick）:
 * - AI公司决策
 * - 股票价格更新
 * - 自动交易
 * - 供需衰减
 * 
 * 低频操作（每50-200 tick）:
 * - LLM市场事件生成
 * - 财务报表计算
 * - 经济健康检查
 * - 诊断日志
 */

import type { GameTick } from '@scc/shared';

/**
 * 操作频率配置
 */
export const TICK_FREQUENCY = {
  // 高频（每tick）
  HIGH: {
    BUILDING_PRODUCTION: 1,      // 建筑生产进度
    ORDER_MATCHING: 1,           // 订单撮合
    PRICE_SYNC: 1,               // 价格同步
  },
  
  // 中频
  MEDIUM: {
    AI_COMPANY_DECISION: 5,      // AI公司决策（每5 tick）
    STOCK_MARKET_UPDATE: 3,      // 股票市场更新（每3 tick）
    AUTO_TRADE: 5,               // 自动交易（每5 tick）
    AI_STOCK_TRADING: 10,        // AI股票交易（每10 tick）
    SUPPLY_DEMAND_DECAY: 5,      // 供需衰减（每5 tick）
    CONSUMER_DEMAND: 10,         // 消费需求处理（每10 tick）
    RESEARCH_PROGRESS: 5,        // 研发进度（每5 tick）
  },
  
  // 低频
  LOW: {
    DIAGNOSTIC_LOG: 50,          // 诊断日志（每50 tick）
    BUILDING_DIAGNOSTIC: 100,    // 建筑状态诊断（每100 tick）
    ECONOMY_HEALTH_CHECK: 50,    // 经济健康检查（每50 tick）
    MARKET_EVENT_GENERATION: 200, // 市场事件生成（每200 tick）
    PATENT_EXPIRY_CHECK: 100,    // 专利过期检查（每100 tick）
    SIDE_EFFECT_PROCESS: 50,     // 副作用处理（每50 tick）
  },
} as const;

/**
 * 检查是否应该执行某个操作
 * @param currentTick 当前tick
 * @param frequency 操作频率
 * @param offset 可选的偏移量（用于分散操作到不同tick）
 */
export function shouldExecute(
  currentTick: GameTick,
  frequency: number,
  offset: number = 0
): boolean {
  if (frequency <= 1) return true;
  return (currentTick + offset) % frequency === 0;
}

/**
 * 操作类型枚举
 */
export type OperationType = 
  // 高频
  | 'BUILDING_PRODUCTION'
  | 'ORDER_MATCHING'
  | 'PRICE_SYNC'
  // 中频
  | 'AI_COMPANY_DECISION'
  | 'STOCK_MARKET_UPDATE'
  | 'AUTO_TRADE'
  | 'AI_STOCK_TRADING'
  | 'SUPPLY_DEMAND_DECAY'
  | 'CONSUMER_DEMAND'
  | 'RESEARCH_PROGRESS'
  // 低频
  | 'DIAGNOSTIC_LOG'
  | 'BUILDING_DIAGNOSTIC'
  | 'ECONOMY_HEALTH_CHECK'
  | 'MARKET_EVENT_GENERATION'
  | 'PATENT_EXPIRY_CHECK'
  | 'SIDE_EFFECT_PROCESS';

/**
 * 获取操作的执行频率
 */
export function getFrequency(operationType: OperationType): number {
  switch (operationType) {
    // 高频
    case 'BUILDING_PRODUCTION':
      return TICK_FREQUENCY.HIGH.BUILDING_PRODUCTION;
    case 'ORDER_MATCHING':
      return TICK_FREQUENCY.HIGH.ORDER_MATCHING;
    case 'PRICE_SYNC':
      return TICK_FREQUENCY.HIGH.PRICE_SYNC;
    
    // 中频
    case 'AI_COMPANY_DECISION':
      return TICK_FREQUENCY.MEDIUM.AI_COMPANY_DECISION;
    case 'STOCK_MARKET_UPDATE':
      return TICK_FREQUENCY.MEDIUM.STOCK_MARKET_UPDATE;
    case 'AUTO_TRADE':
      return TICK_FREQUENCY.MEDIUM.AUTO_TRADE;
    case 'AI_STOCK_TRADING':
      return TICK_FREQUENCY.MEDIUM.AI_STOCK_TRADING;
    case 'SUPPLY_DEMAND_DECAY':
      return TICK_FREQUENCY.MEDIUM.SUPPLY_DEMAND_DECAY;
    case 'CONSUMER_DEMAND':
      return TICK_FREQUENCY.MEDIUM.CONSUMER_DEMAND;
    case 'RESEARCH_PROGRESS':
      return TICK_FREQUENCY.MEDIUM.RESEARCH_PROGRESS;
    
    // 低频
    case 'DIAGNOSTIC_LOG':
      return TICK_FREQUENCY.LOW.DIAGNOSTIC_LOG;
    case 'BUILDING_DIAGNOSTIC':
      return TICK_FREQUENCY.LOW.BUILDING_DIAGNOSTIC;
    case 'ECONOMY_HEALTH_CHECK':
      return TICK_FREQUENCY.LOW.ECONOMY_HEALTH_CHECK;
    case 'MARKET_EVENT_GENERATION':
      return TICK_FREQUENCY.LOW.MARKET_EVENT_GENERATION;
    case 'PATENT_EXPIRY_CHECK':
      return TICK_FREQUENCY.LOW.PATENT_EXPIRY_CHECK;
    case 'SIDE_EFFECT_PROCESS':
      return TICK_FREQUENCY.LOW.SIDE_EFFECT_PROCESS;
    
    default:
      return 1;
  }
}

/**
 * Tick调度器类 - 用于追踪和优化tick操作
 */
export class TickScheduler {
  private gameId: string;
  
  /** 性能追踪：每个操作的执行时间（ms） */
  private operationTimes: Map<OperationType, number[]> = new Map();
  private readonly MAX_SAMPLES = 100;
  
  constructor(gameId: string) {
    this.gameId = gameId;
  }
  
  /**
   * 检查是否应该执行操作
   */
  shouldExecute(currentTick: GameTick, operationType: OperationType, offset: number = 0): boolean {
    const frequency = getFrequency(operationType);
    return shouldExecute(currentTick, frequency, offset);
  }
  
  /**
   * 记录操作执行时间
   */
  recordOperationTime(operationType: OperationType, timeMs: number): void {
    let times = this.operationTimes.get(operationType);
    if (!times) {
      times = [];
      this.operationTimes.set(operationType, times);
    }
    
    times.push(timeMs);
    
    // 保持样本数量限制
    if (times.length > this.MAX_SAMPLES) {
      times.shift();
    }
  }
  
  /**
   * 获取操作的平均执行时间
   */
  getAverageTime(operationType: OperationType): number {
    const times = this.operationTimes.get(operationType);
    if (!times || times.length === 0) return 0;
    
    const sum = times.reduce((a, b) => a + b, 0);
    return sum / times.length;
  }
  
  /**
   * 获取所有操作的性能摘要
   */
  getPerformanceSummary(): Record<string, { avgMs: number; samples: number }> {
    const summary: Record<string, { avgMs: number; samples: number }> = {};
    
    for (const [op, times] of this.operationTimes) {
      summary[op] = {
        avgMs: this.getAverageTime(op),
        samples: times.length,
      };
    }
    
    return summary;
  }
  
  /**
   * 输出性能报告
   */
  logPerformanceReport(): void {
    const summary = this.getPerformanceSummary();
    const totalAvg = Object.values(summary).reduce((sum, s) => sum + s.avgMs, 0);
    
    console.log(`\n[TickScheduler] 性能报告 (游戏: ${this.gameId})`);
    console.log(`总平均tick时间: ${totalAvg.toFixed(2)}ms`);
    console.log('各操作耗时:');
    
    // 按耗时排序
    const sorted = Object.entries(summary)
      .sort(([, a], [, b]) => b.avgMs - a.avgMs);
    
    for (const [op, data] of sorted) {
      if (data.avgMs > 0.1) { // 只显示耗时超过0.1ms的
        console.log(`  ${op}: ${data.avgMs.toFixed(2)}ms (${data.samples} samples)`);
      }
    }
  }
  
  /**
   * 重置性能数据
   */
  reset(): void {
    this.operationTimes.clear();
  }
}

/**
 * 调度器工厂 - 为每个游戏创建调度器
 */
class TickSchedulerFactory {
  private schedulers: Map<string, TickScheduler> = new Map();
  
  getScheduler(gameId: string): TickScheduler {
    let scheduler = this.schedulers.get(gameId);
    if (!scheduler) {
      scheduler = new TickScheduler(gameId);
      this.schedulers.set(gameId, scheduler);
    }
    return scheduler;
  }
  
  removeScheduler(gameId: string): void {
    this.schedulers.delete(gameId);
  }
}

export const tickSchedulerFactory = new TickSchedulerFactory();