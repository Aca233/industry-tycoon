/**
 * Async LLM Processor - 异步LLM请求处理器
 * 
 * 功能：
 * 1. 请求队列管理 - 避免并发过多请求
 * 2. 优先级调度 - 玩家交互优先于AI决策
 * 3. 请求合并 - 相似请求可以合并处理
 * 4. 失败重试 - 自动重试失败的请求
 * 5. 结果缓存 - 避免重复请求
 */

import { LLMService, llmService } from './llm.js';
import type {
  ChatContext,
  MarketAnalysisRequest,
  StrategicAnalysisRequest,
  StrategicPlan
} from './llm.js';

/** 请求优先级 */
export enum LLMPriority {
  CRITICAL = 0,    // 玩家直接交互（聊天）
  HIGH = 1,        // 实时市场分析
  MEDIUM = 2,      // AI决策
  LOW = 3,         // 背景事件生成
}

/** 请求类型 */
export type LLMRequestType = 
  | 'chat' 
  | 'market_analysis' 
  | 'strategic_plan' 
  | 'market_events'
  | 'tech_effects'
  | 'negotiation';

/** 队列中的请求 */
interface QueuedRequest {
  id: string;
  type: LLMRequestType;
  priority: LLMPriority;
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  createdAt: number;
  retryCount: number;
  cacheKey: string | undefined;
}

/** 处理器配置 */
interface ProcessorConfig {
  maxConcurrent: number;       // 最大并发请求数
  maxQueueSize: number;        // 最大队列长度
  requestTimeout: number;      // 请求超时时间(ms)
  maxRetries: number;          // 最大重试次数
  cacheExpiry: number;         // 缓存过期时间(ms)
}

/** 处理器统计 */
interface ProcessorStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  cacheHits: number;
  currentQueueSize: number;
  activeRequests: number;
  averageLatency: number;
}

/**
 * 异步LLM处理器类
 */
export class AsyncLLMProcessor {
  private queue: QueuedRequest[] = [];
  private activeCount = 0;
  private cache = new Map<string, { result: unknown; expiresAt: number }>();
  private stats: ProcessorStats = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    currentQueueSize: 0,
    activeRequests: 0,
    averageLatency: 0,
  };
  private latencies: number[] = [];
  private processing = false;
  
  private config: ProcessorConfig = {
    maxConcurrent: 3,
    maxQueueSize: 50,
    requestTimeout: 30000,
    maxRetries: 2,
    cacheExpiry: 60000, // 1分钟缓存
  };
  
  constructor(private llm: LLMService = llmService) {
    // 定期清理过期缓存
    setInterval(() => this.cleanupCache(), 60000);
  }

  /**
   * 提交聊天请求（最高优先级）
   */
  async chat(message: string, context: ChatContext): Promise<string> {
    return this.enqueue<string>('chat', LLMPriority.CRITICAL, { message, context });
  }

  /**
   * 提交市场分析请求
   */
  async analyzeMarket(request: MarketAnalysisRequest): Promise<{
    summary: string;
    trends: Array<{ goodsId: string; trend: string; confidence: number }>;
    recommendations: string[];
  }> {
    const cacheKey = `market_${JSON.stringify(request.currentPrices).substring(0, 100)}`;
    return this.enqueue('market_analysis', LLMPriority.HIGH, request, cacheKey);
  }

  /**
   * 提交AI战略计划请求（可合并）
   */
  async generateStrategicPlan(request: StrategicAnalysisRequest): Promise<StrategicPlan> {
    const cacheKey = `strategy_${request.companyId}_${Math.floor(Date.now() / 300000)}`; // 5分钟缓存
    return this.enqueue('strategic_plan', LLMPriority.MEDIUM, request, cacheKey);
  }

  /**
   * 提交市场事件生成请求（最低优先级）
   */
  async generateMarketEvents(gameState: {
    currentTick: number;
    marketConditions: string;
    playerDominance: Record<string, number>;
    eventCount: number;
  }): Promise<Array<{
    type: string;
    severity: 'minor' | 'moderate' | 'major' | 'critical';
    title: string;
    description: string;
    effects: {
      priceChanges?: Record<string, number>;
      supplyChanges?: Record<string, number>;
    };
  }>> {
    return this.enqueue('market_events', LLMPriority.LOW, gameState);
  }

  /**
   * 将请求加入队列
   */
  private async enqueue<T>(
    type: LLMRequestType,
    priority: LLMPriority,
    payload: unknown,
    cacheKey?: string
  ): Promise<T> {
    // 检查缓存
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.stats.cacheHits++;
        return cached.result as T;
      }
    }

    // 检查队列是否已满
    if (this.queue.length >= this.config.maxQueueSize) {
      // 移除最低优先级的请求
      const lowestPriority = Math.max(...this.queue.map(r => r.priority));
      if (priority >= lowestPriority) {
        throw new Error('LLM queue is full');
      }
      // 移除一个低优先级请求
      const idx = this.queue.findIndex(r => r.priority === lowestPriority);
      if (idx >= 0) {
        const removed = this.queue.splice(idx, 1)[0];
        removed?.reject(new Error('Request preempted by higher priority'));
      }
    }

    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type,
        priority,
        payload,
        resolve: resolve as (value: unknown) => void,
        reject,
        createdAt: Date.now(),
        retryCount: 0,
        cacheKey: cacheKey ?? undefined,
      };

      // 按优先级插入队列
      const insertIdx = this.queue.findIndex(r => r.priority > priority);
      if (insertIdx === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIdx, 0, request);
      }

      this.stats.totalRequests++;
      this.stats.currentQueueSize = this.queue.length;

      // 触发处理
      this.processQueue();
    });
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeCount < this.config.maxConcurrent) {
      const request = this.queue.shift();
      if (!request) continue;

      this.activeCount++;
      this.stats.activeRequests = this.activeCount;
      this.stats.currentQueueSize = this.queue.length;

      this.processRequest(request).finally(() => {
        this.activeCount--;
        this.stats.activeRequests = this.activeCount;
      });
    }

    this.processing = false;
  }

  /**
   * 处理单个请求
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    const startTime = Date.now();

    try {
      // 添加超时控制
      const result = await Promise.race([
        this.executeRequest(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), this.config.requestTimeout)
        ),
      ]);

      // 记录延迟
      const latency = Date.now() - startTime;
      this.recordLatency(latency);

      // 缓存结果
      if (request.cacheKey) {
        this.cache.set(request.cacheKey, {
          result,
          expiresAt: Date.now() + this.config.cacheExpiry,
        });
      }

      this.stats.completedRequests++;
      request.resolve(result);
    } catch (error) {
      // 重试逻辑
      if (request.retryCount < this.config.maxRetries) {
        request.retryCount++;
        console.log(`[AsyncLLM] Retrying request ${request.id}, attempt ${request.retryCount}`);
        // 降低优先级后重新入队
        request.priority = Math.min(LLMPriority.LOW, request.priority + 1);
        this.queue.push(request);
        this.stats.currentQueueSize = this.queue.length;
      } else {
        this.stats.failedRequests++;
        request.reject(error);
      }
    }

    // 继续处理队列
    this.processQueue();
  }

  /**
   * 执行LLM请求
   */
  private async executeRequest(request: QueuedRequest): Promise<unknown> {
    switch (request.type) {
      case 'chat': {
        const { message, context } = request.payload as { message: string; context: ChatContext };
        return this.llm.chat(message, context);
      }
      case 'market_analysis': {
        const marketReq = request.payload as MarketAnalysisRequest;
        return this.llm.analyzeMarket(marketReq);
      }
      case 'strategic_plan': {
        const stratReq = request.payload as StrategicAnalysisRequest;
        return this.llm.generateStrategicPlan(stratReq);
      }
      case 'market_events': {
        const eventReq = request.payload as Parameters<typeof this.llm.generateMarketEventsBatch>[0];
        return this.llm.generateMarketEventsBatch(eventReq);
      }
      default:
        throw new Error(`Unknown request type: ${request.type}`);
    }
  }

  /**
   * 记录延迟
   */
  private recordLatency(latency: number): void {
    this.latencies.push(latency);
    // 只保留最近100条记录
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
    this.stats.averageLatency = 
      this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取处理器统计信息
   */
  getStats(): ProcessorStats {
    return { ...this.stats };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 清空队列（用于游戏重置）
   */
  clearQueue(): void {
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue = [];
    this.stats.currentQueueSize = 0;
  }
}

// 导出单例
export const asyncLLMProcessor = new AsyncLLMProcessor();