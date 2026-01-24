/**
 * Workers 模块导出
 *
 * 提供多线程计算支持：
 * - priceWorker: 价格计算
 * - consumptionWorker: 消费需求计算
 * - orderWorker: 订单处理
 * - aiDecisionWorker: AI决策计算
 */

export {
  WorkerPool,
  getPriceWorkerPool,
  initializePriceWorkerPool,
  shutdownWorkerPools
} from './workerPool.js';

// Worker 类型定义
export type PriceWorkerTaskType =
  | 'WEIGHTED_AVERAGE'
  | 'EQUILIBRIUM_PRICE'
  | 'MOVING_AVERAGE'
  | 'EMA'
  | 'VOLATILITY'
  | 'BATCH_CALCULATE'
  | 'PRICE_STATS';

export type ConsumptionWorkerTaskType =
  | 'CALCULATE_CONSUMPTION'
  | 'SCORE_GOODS';

export type OrderWorkerTaskType =
  | 'VALIDATE_ORDERS'
  | 'FIND_MATCHES'
  | 'BATCH_FIND_MATCHES'
  | 'ANALYZE_DEPTH'
  | 'SORT_ORDERS'
  | 'BINARY_SEARCH_INSERT';

export type AIDecisionWorkerTaskType =
  | 'GENERATE_DECISIONS'
  | 'BATCH_GENERATE_DECISIONS'
  | 'ANALYZE_PRICE_TREND'
  | 'ANALYZE_SUPPLY_DEMAND'
  | 'EVALUATE_INVESTMENT';