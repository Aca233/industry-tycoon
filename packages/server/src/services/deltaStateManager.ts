/**
 * Delta State Manager - 增量状态管理器
 * 
 * 优化WebSocket推送，只发送状态变化的部分，而非完整状态
 * 
 * 核心功能：
 * 1. 跟踪上一次推送的状态
 * 2. 比较当前状态与上一次状态
 * 3. 只发送差异部分（delta）
 * 4. 定期发送完整状态（校验/同步）
 */

import type { TickUpdate } from './gameLoop.js';

/**
 * 增量更新结构
 */
export interface DeltaUpdate {
  /** 更新类型 */
  type: 'delta' | 'full';
  /** 游戏ID */
  gameId: string;
  /** 当前tick */
  tick: number;
  /** 时间戳 */
  timestamp: number;
  
  // === 以下字段只在变化时发送 ===
  
  /** 玩家现金（只在变化时发送） */
  playerCash?: number;
  /** 建筑数量（只在变化时发送） */
  buildingCount?: number;
  /** 财务摘要（只在有生产收益时发送） */
  financials?: TickUpdate['financials'];
  
  /** 完整市场价格快照（每次full更新必须发送，delta更新定期发送） */
  marketPrices?: Record<string, number>;
  /** 市场价格变化（只发送有变化的商品） */
  priceChanges?: Array<{ goodsId: string; price: number; change: number }>;
  
  /** 事件列表（只在有事件时发送） */
  events?: TickUpdate['events'];
  
  /** AI公司状态（只在有变化时发送） */
  aiCompanies?: TickUpdate['aiCompanies'];
  
  /** 竞争事件（只在有事件时发送） */
  competitionEvents?: TickUpdate['competitionEvents'];
  
  /** 研发更新（只在有更新时发送） */
  researchUpdates?: TickUpdate['researchUpdates'];
  
  /** 交易记录（只在有交易时发送） */
  trades?: TickUpdate['trades'];
  
  /** 库存快照（只在有变化时发送） */
  inventory?: TickUpdate['inventory'];
  
  /** 建筑短缺（只在状态变化时发送） */
  buildingShortages?: TickUpdate['buildingShortages'];
  
  /** 成交量数据（只在有成交时发送） */
  tickVolumes?: TickUpdate['tickVolumes'];
  
  /** 市场事件（只在有事件时发送） */
  marketEvents?: TickUpdate['marketEvents'];
  
  /** 经济系统统计（定期发送） */
  economyStats?: TickUpdate['economyStats'];
}

/**
 * 状态快照（用于增量计算）
 */
interface StateSnapshot {
  tick: number;
  playerCash: number;
  buildingCount: number;
  /** 商品价格Map */
  marketPrices: Map<string, number>;
  /** 库存商品数量Map */
  inventoryQuantities: Map<string, number>;
  /** 建筑状态Map */
  buildingStatuses: Map<string, string>;
  /** AI公司现金Map */
  aiCompanyCash: Map<string, number>;
}

/**
 * 增量管理配置
 */
const DELTA_CONFIG = {
  /** 每N个tick发送一次完整状态（用于校验/同步） */
  FULL_SYNC_INTERVAL: 100,
  /** 价格变化阈值（小于此值不发送） */
  PRICE_CHANGE_THRESHOLD: 0.001,  // 0.1%
  /** 现金变化阈值 */
  CASH_CHANGE_THRESHOLD: 100,  // $1
  /** 库存变化阈值 */
  INVENTORY_CHANGE_THRESHOLD: 0.01,  // 1%
};

/**
 * 增量状态管理器
 */
export class DeltaStateManager {
  /** 每个游戏的上一次状态快照 */
  private lastSnapshots: Map<string, StateSnapshot> = new Map();
  
  /** 每个游戏的上一次完整同步tick */
  private lastFullSyncTick: Map<string, number> = new Map();
  
  constructor() {}
  
  /**
   * 处理tick更新，生成增量或完整更新
   */
  processUpdate(update: TickUpdate): DeltaUpdate {
    const gameId = update.gameId;
    const lastSnapshot = this.lastSnapshots.get(gameId);
    const lastFullSync = this.lastFullSyncTick.get(gameId) ?? 0;
    
    // 判断是否需要发送完整状态
    const needsFullSync = 
      !lastSnapshot || 
      (update.tick - lastFullSync >= DELTA_CONFIG.FULL_SYNC_INTERVAL);
    
    if (needsFullSync) {
      // 发送完整状态
      this.lastFullSyncTick.set(gameId, update.tick);
      this.updateSnapshot(gameId, update);
      return this.createFullUpdate(update);
    }
    
    // 生成增量更新
    const delta = this.createDeltaUpdate(update, lastSnapshot);
    this.updateSnapshot(gameId, update);
    return delta;
  }
  
  /**
   * 创建完整更新
   */
  private createFullUpdate(update: TickUpdate): DeltaUpdate {
    const delta: DeltaUpdate = {
      type: 'full',
      gameId: update.gameId,
      tick: update.tick,
      timestamp: update.timestamp,
    };
    
    // 只添加有值的字段
    if (update.playerCash !== undefined) delta.playerCash = update.playerCash;
    if (update.buildingCount !== undefined) delta.buildingCount = update.buildingCount;
    if (update.financials) delta.financials = update.financials;
    // ★ 完整更新必须发送 marketPrices，这是价格图表的数据来源
    if (update.marketPrices) delta.marketPrices = update.marketPrices;
    if (update.marketChanges && update.marketChanges.length > 0) delta.priceChanges = update.marketChanges;
    if (update.events && update.events.length > 0) delta.events = update.events;
    if (update.aiCompanies && update.aiCompanies.length > 0) delta.aiCompanies = update.aiCompanies;
    if (update.competitionEvents && update.competitionEvents.length > 0) delta.competitionEvents = update.competitionEvents;
    if (update.researchUpdates) delta.researchUpdates = update.researchUpdates;
    if (update.trades && update.trades.length > 0) delta.trades = update.trades;
    if (update.inventory) delta.inventory = update.inventory;
    if (update.buildingShortages && update.buildingShortages.length > 0) delta.buildingShortages = update.buildingShortages;
    if (update.tickVolumes) delta.tickVolumes = update.tickVolumes;
    if (update.marketEvents && update.marketEvents.length > 0) delta.marketEvents = update.marketEvents;
    if (update.economyStats) delta.economyStats = update.economyStats;
    
    return delta;
  }
  
  /**
   * 创建增量更新
   */
  private createDeltaUpdate(update: TickUpdate, lastSnapshot: StateSnapshot): DeltaUpdate {
    const delta: DeltaUpdate = {
      type: 'delta',
      gameId: update.gameId,
      tick: update.tick,
      timestamp: update.timestamp,
    };
    
    // 检查现金变化
    if (update.playerCash !== undefined) {
      const cashChange = Math.abs((update.playerCash ?? 0) - lastSnapshot.playerCash);
      if (cashChange >= DELTA_CONFIG.CASH_CHANGE_THRESHOLD) {
        delta.playerCash = update.playerCash;
      }
    }
    
    // 检查建筑数量变化
    if (update.buildingCount !== undefined && update.buildingCount !== lastSnapshot.buildingCount) {
      delta.buildingCount = update.buildingCount;
    }
    
    // 财务摘要（只在有生产收益时发送）
    if (update.financials && update.financials.netProfit !== 0) {
      delta.financials = update.financials;
    }
    
    // ★ 每个tick都发送 marketPrices，因为客户端需要用它来更新价格历史
    // 这是价格图表正常工作的必要条件
    if (update.marketPrices) {
      delta.marketPrices = update.marketPrices;
    }
    
    // 价格变化（只发送有显著变化的商品，用于价格变动提示）
    if (update.marketChanges && update.marketChanges.length > 0) {
      const significantChanges = update.marketChanges.filter(change => {
        const lastPrice = lastSnapshot.marketPrices.get(change.goodsId) ?? change.price;
        const changePercent = Math.abs(change.change) / lastPrice;
        return changePercent >= DELTA_CONFIG.PRICE_CHANGE_THRESHOLD;
      });
      
      if (significantChanges.length > 0) {
        delta.priceChanges = significantChanges;
      }
    }
    
    // 事件（总是发送，如果有）
    if (update.events && update.events.length > 0) {
      delta.events = update.events;
    }
    
    // 竞争事件
    if (update.competitionEvents && update.competitionEvents.length > 0) {
      delta.competitionEvents = update.competitionEvents;
    }
    
    // 研发更新
    if (update.researchUpdates && 
        (update.researchUpdates.completedProjects.length > 0 || 
         update.researchUpdates.newTechnologies.length > 0)) {
      delta.researchUpdates = update.researchUpdates;
    }
    
    // 交易记录
    if (update.trades && update.trades.length > 0) {
      delta.trades = update.trades;
    }
    
    // 建筑短缺（只在状态有变化时发送）
    if (update.buildingShortages) {
      const hasStatusChange = update.buildingShortages.some(shortage => {
        const lastStatus = lastSnapshot.buildingStatuses.get(shortage.buildingId);
        return lastStatus !== shortage.status;
      });
      
      if (hasStatusChange || lastSnapshot.buildingStatuses.size !== (update.buildingShortages?.length ?? 0)) {
        delta.buildingShortages = update.buildingShortages;
      }
    }
    
    // 成交量数据（有成交时发送）
    if (update.tickVolumes && Object.keys(update.tickVolumes).length > 0) {
      delta.tickVolumes = update.tickVolumes;
    }
    
    // 市场事件
    if (update.marketEvents && update.marketEvents.length > 0) {
      delta.marketEvents = update.marketEvents;
    }
    
    // AI公司状态（每10个tick检查一次变化）
    if (update.tick % 10 === 0 && update.aiCompanies) {
      const hasAIChange = update.aiCompanies.some(ai => {
        const lastCash = lastSnapshot.aiCompanyCash.get(ai.id) ?? 0;
        const cashChange = Math.abs(ai.cash - lastCash) / (lastCash || 1);
        return cashChange >= 0.01; // 1%变化
      });
      
      if (hasAIChange) {
        delta.aiCompanies = update.aiCompanies;
      }
    }
    
    // 经济统计（每20个tick发送一次）
    if (update.tick % 20 === 0 && update.economyStats) {
      delta.economyStats = update.economyStats;
    }
    
    // 库存快照（每5个tick检查一次变化，或有显著变化时发送）
    if (update.tick % 5 === 0 && update.inventory) {
      const hasInventoryChange = update.inventory.stocks.some(stock => {
        const lastQty = lastSnapshot.inventoryQuantities.get(stock.goodsId) ?? 0;
        const change = Math.abs(stock.quantity - lastQty) / (lastQty || 1);
        return change >= DELTA_CONFIG.INVENTORY_CHANGE_THRESHOLD;
      });
      
      if (hasInventoryChange) {
        delta.inventory = update.inventory;
      }
    }
    
    return delta;
  }
  
  /**
   * 更新状态快照
   */
  private updateSnapshot(gameId: string, update: TickUpdate): void {
    const snapshot: StateSnapshot = {
      tick: update.tick,
      playerCash: update.playerCash ?? 0,
      buildingCount: update.buildingCount ?? 0,
      marketPrices: new Map(),
      inventoryQuantities: new Map(),
      buildingStatuses: new Map(),
      aiCompanyCash: new Map(),
    };
    
    // 更新价格快照
    if (update.marketPrices) {
      for (const [goodsId, price] of Object.entries(update.marketPrices)) {
        snapshot.marketPrices.set(goodsId, price);
      }
    }
    
    // 更新库存快照
    if (update.inventory) {
      for (const stock of update.inventory.stocks) {
        snapshot.inventoryQuantities.set(stock.goodsId, stock.quantity);
      }
    }
    
    // 更新建筑状态快照
    if (update.buildingShortages) {
      for (const shortage of update.buildingShortages) {
        snapshot.buildingStatuses.set(shortage.buildingId, shortage.status);
      }
    }
    
    // 更新AI公司现金快照
    if (update.aiCompanies) {
      for (const ai of update.aiCompanies) {
        snapshot.aiCompanyCash.set(ai.id, ai.cash);
      }
    }
    
    this.lastSnapshots.set(gameId, snapshot);
  }
  
  /**
   * 清除游戏的状态快照
   */
  clearGameState(gameId: string): void {
    this.lastSnapshots.delete(gameId);
    this.lastFullSyncTick.delete(gameId);
  }
  
  /**
   * 重置所有状态
   */
  reset(): void {
    this.lastSnapshots.clear();
    this.lastFullSyncTick.clear();
  }
  
  /**
   * 获取增量更新的大小估算（用于统计）
   */
  estimateUpdateSize(update: DeltaUpdate): number {
    // 简单估算JSON大小
    return JSON.stringify(update).length;
  }
}

// 单例导出
export const deltaStateManager = new DeltaStateManager();