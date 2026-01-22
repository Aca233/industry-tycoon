/**
 * WebSocket Service for real-time game communication
 */

export interface WSMessage {
  type: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
}

/** 建筑收益明细 */
export interface BuildingProfitPayload {
  buildingId: string;
  name: string;
  income: number;
  maintenance: number;
  net: number;
}

/** 财务摘要 */
export interface FinancialSummaryPayload {
  totalIncome: number;
  totalMaintenance: number;
  netProfit: number;
  buildingProfits: BuildingProfitPayload[];
}

/** AI公司摘要 */
export interface AICompanySummaryPayload {
  id: string;
  name: string;
  cash: number;
  buildingCount: number;
  personality: string;
  color: string;
  icon: string;
  trustWithPlayer: number;
  hostilityToPlayer: number;
  recentAction: string | undefined;
}

/** 竞争事件 */
export interface CompetitionEventPayload {
  id: string;
  tick: number;
  type: string;
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  affectedGoods?: string[];
  severity: 'minor' | 'moderate' | 'major';
}

/** LLM市场事件 */
export interface MarketEventPayload {
  id: string;
  tick: number;
  type: 'market_shift' | 'regulation' | 'disaster' | 'technology' | 'social';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  title: string;
  description: string;
  effects: {
    priceChanges?: Record<string, number>;
    supplyChanges?: Record<string, number>;
  };
}

/** 研发进度更新 */
export interface ResearchUpdatePayload {
  completedProjects: string[];
  newTechnologies: Array<{
    id: string;
    name: string;
    category: string;
  }>;
}

/** 库存项目 */
export interface InventoryStockItemPayload {
  goodsId: string;
  goodsName: string;
  quantity: number;
  reservedForSale: number;
  reservedForProduction: number;
  avgCost: number;
  marketValue: number;
}

/** 库存快照 */
export interface InventorySnapshotPayload {
  stocks: InventoryStockItemPayload[];
  totalValue: number;
}

/** 建筑短缺信息 */
export interface BuildingShortagePayload {
  buildingId: string;
  buildingName: string;
  status: 'no_input' | 'no_power' | 'paused';
  missingInputs: Array<{
    goodsId: string;
    goodsName: string;
    needed: number;
    available: number;
  }>;
}

export interface TickPayload {
  gameId: string;
  tick: number;
  timestamp: number;
  playerCash?: number;
  buildingCount?: number;
  /** 当前所有商品价格快照 */
  marketPrices?: Record<string, number>;
  marketChanges?: Array<{
    goodsId: string;
    price: number;
    change: number;
  }>;
  events?: Array<{
    id: string;
    type: string;
    message: string;
  }>;
  financials?: FinancialSummaryPayload;
  /** AI公司摘要 */
  aiCompanies?: AICompanySummaryPayload[];
  /** 竞争事件 */
  competitionEvents?: CompetitionEventPayload[];
  /** AI新闻 */
  aiNews?: Array<{
    companyId: string;
    headline: string;
  }>;
  /** LLM生成的市场事件 */
  marketEvents?: MarketEventPayload[];
  /** 研发进度更新 */
  researchUpdates?: ResearchUpdatePayload;
  /** 玩家库存快照 */
  inventory?: InventorySnapshotPayload;
  /** 建筑短缺信息 */
  buildingShortages?: BuildingShortagePayload[];
}

type MessageHandler = (message: WSMessage) => void;

class GameWebSocket {
  private socket: WebSocket | null = null;
  private gameId: string | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  
  /**
   * Connect to game WebSocket
   */
  connect(gameId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        if (this.gameId === gameId) {
          resolve();
          return;
        }
        this.disconnect();
      }
      
      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }
      
      this.isConnecting = true;
      this.gameId = gameId;
      
      const wsUrl = `ws://localhost:3002/ws/game/${gameId}`;
      console.log(`[WS] Connecting to ${wsUrl}`);
      
      try {
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
          console.log('[WS] Connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WSMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error('[WS] Error parsing message:', error);
          }
        };
        
        this.socket.onclose = (event) => {
          console.log('[WS] Disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.attemptReconnect();
        };
        
        this.socket.onerror = (error) => {
          console.error('[WS] Error:', error);
          this.isConnecting = false;
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.gameId = null;
    this.reconnectAttempts = 0;
  }
  
  /**
   * Send a message to the server
   */
  send(type: string, payload?: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send, socket not open');
      return;
    }
    
    const message: WSMessage = { type, payload };
    this.socket.send(JSON.stringify(message));
  }
  
  /**
   * Send game control commands
   */
  setSpeed(speed: number): void {
    this.send('setSpeed', { speed });
  }
  
  togglePause(): void {
    this.send('togglePause');
  }
  
  resetGame(): void {
    this.send('resetGame');
  }
  
  /**
   * Switch building production method
   */
  switchMethod(buildingId: string, methodId: string): void {
    this.send('switchMethod', { buildingId, methodId });
  }
  
  /**
   * Purchase a new building
   */
  purchaseBuilding(buildingDefId: string): void {
    this.send('purchaseBuilding', { buildingDefId });
  }
  
  /**
   * Subscribe to message types
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }
  
  /**
   * Handle incoming messages
   */
  private handleMessage(message: WSMessage): void {
    console.log('[WS] Received:', message.type);
    
    // Call type-specific handlers
    const typeHandlers = this.handlers.get(message.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(message);
        } catch (error) {
          console.error(`[WS] Handler error for ${message.type}:`, error);
        }
      }
    }
    
    // Call wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(message);
        } catch (error) {
          console.error('[WS] Wildcard handler error:', error);
        }
      }
    }
  }
  
  /**
   * Attempt to reconnect after disconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      return;
    }
    
    if (!this.gameId) {
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.gameId) {
        this.connect(this.gameId).catch(console.error);
      }
    }, delay);
  }
  
  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const gameWebSocket = new GameWebSocket();