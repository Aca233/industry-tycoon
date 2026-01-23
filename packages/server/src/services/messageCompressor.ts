/**
 * Message Compressor - 消息压缩服务
 * 
 * 功能：
 * 1. 消息批量合并 - 将多个小消息合并为一个大消息
 * 2. 数据压缩 - 使用短键名和数值压缩
 * 3. 重复数据消除 - 避免发送重复的市场价格等
 */

import { DeltaUpdate } from './deltaStateManager.js';

/** 压缩后的消息格式（使用短键名） */
interface CompressedUpdate {
  /** type */
  t: 'd' | 'f';  // delta | full
  /** gameId - 省略（通过连接已知） */
  /** tick */
  k: number;
  /** timestamp - 省略（客户端使用接收时间） */
  
  // === 以下字段使用短键名 ===
  /** playerCash */
  c?: number;
  /** buildingCount */
  b?: number;
  /** financials: { revenue, costs, netProfit } */
  f?: [number, number, number];
  /** priceChanges: [[goodsId, price, changePercent], ...] */
  p?: Array<[string, number, number]>;
  /** events count */
  e?: number;
  /** aiCompanies: [[id, cash, buildingCount], ...] */
  a?: Array<[string, number, number]>;
  /** competitionEvents count */
  ce?: number;
  /** trades count */
  tr?: number;
  /** economyStats */
  es?: {
    /** totalGoodsValue */
    tv: number;
    /** marketActivity */
    ma: number;
    /** avgPriceLevel */
    ap: number;
  };
}

/** 批量消息 */
interface BatchedMessage {
  type: 'batch';
  messages: Array<{ type: string; payload: unknown }>;
  count: number;
}

/** 压缩统计 */
interface CompressionStats {
  messagesCompressed: number;
  bytesOriginal: number;
  bytesCompressed: number;
  batchesSent: number;
  averageBatchSize: number;
}

/**
 * 消息压缩器
 */
export class MessageCompressor {
  private stats: CompressionStats = {
    messagesCompressed: 0,
    bytesOriginal: 0,
    bytesCompressed: 0,
    batchesSent: 0,
    averageBatchSize: 0,
  };

  /** 待批量发送的消息队列（每个游戏一个队列） */
  private messageQueues: Map<string, Array<{ type: string; payload: unknown }>> = new Map();
  
  /** 批量发送定时器 */
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  
  /** 批量发送间隔 (ms) */
  private readonly BATCH_INTERVAL = 50;
  
  /** 最大批量大小 */
  private readonly MAX_BATCH_SIZE = 10;

  /**
   * 压缩 Delta 更新
   */
  compressDeltaUpdate(update: DeltaUpdate): CompressedUpdate {
    const originalSize = JSON.stringify(update).length;
    
    const compressed: CompressedUpdate = {
      t: update.type === 'delta' ? 'd' : 'f',
      k: update.tick,
    };
    
    // 只添加有值的字段，使用短键名
    if (update.playerCash !== undefined) {
      compressed.c = Math.round(update.playerCash * 100) / 100; // 保留2位小数
    }
    
    if (update.buildingCount !== undefined) {
      compressed.b = update.buildingCount;
    }
    
    if (update.financials) {
      compressed.f = [
        Math.round(update.financials.totalIncome * 100) / 100,
        Math.round(update.financials.totalInputCost * 100) / 100,
        Math.round(update.financials.netProfit * 100) / 100,
      ];
    }
    
    if (update.priceChanges && update.priceChanges.length > 0) {
      compressed.p = update.priceChanges.map(pc => [
        this.shortenGoodsId(pc.goodsId),
        Math.round(pc.price * 100) / 100,
        Math.round(pc.change * 10000) / 10000, // 保留4位小数（百分比）
      ]);
    }
    
    if (update.events && update.events.length > 0) {
      compressed.e = update.events.length;
    }
    
    if (update.aiCompanies && update.aiCompanies.length > 0) {
      compressed.a = update.aiCompanies.map(ai => [
        ai.id.substring(0, 8), // 截断ID
        Math.round(ai.cash),
        ai.buildingCount,
      ]);
    }
    
    if (update.competitionEvents && update.competitionEvents.length > 0) {
      compressed.ce = update.competitionEvents.length;
    }
    
    if (update.trades && update.trades.length > 0) {
      compressed.tr = update.trades.length;
    }
    
    if (update.economyStats) {
      compressed.es = {
        tv: update.economyStats.totalNPCCompanies,
        ma: update.economyStats.totalActiveOrders,
        ap: update.economyStats.totalTradesThisTick,
      };
    }
    
    const compressedSize = JSON.stringify(compressed).length;
    
    this.stats.messagesCompressed++;
    this.stats.bytesOriginal += originalSize;
    this.stats.bytesCompressed += compressedSize;
    
    return compressed;
  }

  /**
   * 缩短商品ID
   */
  private shortenGoodsId(goodsId: string): string {
    // 使用预定义的短映射
    const shortMap: Record<string, string> = {
      'iron-ore': 'io',
      'coal': 'co',
      'steel': 'st',
      'copper': 'cu',
      'electricity': 'el',
      'natural_gas': 'ng',
      'oil': 'oi',
      'chips': 'ch',
      'electronics': 'ec',
      'chemicals': 'cm',
      'food': 'fd',
      'lumber': 'lb',
      'computing-power': 'cp',
    };
    return shortMap[goodsId] ?? goodsId.substring(0, 4);
  }

  /**
   * 将消息加入批量队列
   */
  queueMessage(gameId: string, message: { type: string; payload: unknown }): void {
    let queue = this.messageQueues.get(gameId);
    if (!queue) {
      queue = [];
      this.messageQueues.set(gameId, queue);
    }
    
    queue.push(message);
    
    // 如果队列达到最大大小，立即发送
    if (queue.length >= this.MAX_BATCH_SIZE) {
      this.flushQueue(gameId);
      return;
    }
    
    // 设置定时器延迟发送
    if (!this.batchTimers.has(gameId)) {
      const timer = setTimeout(() => {
        this.flushQueue(gameId);
      }, this.BATCH_INTERVAL);
      this.batchTimers.set(gameId, timer);
    }
  }

  /**
   * 刷新队列，返回批量消息
   */
  flushQueue(gameId: string): BatchedMessage | null {
    const queue = this.messageQueues.get(gameId);
    if (!queue || queue.length === 0) {
      return null;
    }
    
    // 清除定时器
    const timer = this.batchTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(gameId);
    }
    
    // 取出队列中的所有消息
    const messages = [...queue];
    queue.length = 0;
    
    // 如果只有一条消息，不需要批量
    if (messages.length === 1) {
      return null;
    }
    
    this.stats.batchesSent++;
    this.stats.averageBatchSize = 
      (this.stats.averageBatchSize * (this.stats.batchesSent - 1) + messages.length) / 
      this.stats.batchesSent;
    
    return {
      type: 'batch',
      messages,
      count: messages.length,
    };
  }

  /**
   * 获取压缩统计
   */
  getStats(): CompressionStats & { compressionRatio: string } {
    const ratio = this.stats.bytesOriginal > 0
      ? ((1 - this.stats.bytesCompressed / this.stats.bytesOriginal) * 100).toFixed(1)
      : '0';
    
    return {
      ...this.stats,
      compressionRatio: `${ratio}%`,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      messagesCompressed: 0,
      bytesOriginal: 0,
      bytesCompressed: 0,
      batchesSent: 0,
      averageBatchSize: 0,
    };
  }

  /**
   * 清理指定游戏的队列
   */
  clearQueue(gameId: string): void {
    this.messageQueues.delete(gameId);
    const timer = this.batchTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(gameId);
    }
  }
}

// 单例导出
export const messageCompressor = new MessageCompressor();