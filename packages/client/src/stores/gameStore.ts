/**
 * Game State Store - Zustand store for game state management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable MapSet plugin for Immer to work with Map and Set
enableMapSet();
import {
  type EntityId,
  type GameTick,
  type GameSpeed,
  type Company,
  type BuildingInstance,
  type GoodsDefinition,
  type MarketSummary,
  type GameEvent,
  CompanyType,
  OperationalStatus,
} from '@scc/shared';
import { api } from '../api';
import { gameWebSocket, type WSMessage, type TickPayload, type ResearchUpdatePayload } from '../services/websocket';

/** 建筑收益明细 */
export interface BuildingProfit {
  buildingId: string;
  name: string;
  /** 产出商品的销售收入 */
  income: number;
  /** 投入商品的采购成本 */
  inputCost: number;
  /** 维护成本 */
  maintenance: number;
  /** 净利润 = 收入 - 投入成本 - 维护 */
  net: number;
  /** 本 tick 是否完成了一个生产周期 */
  produced: boolean;
  /** 滚动平均净利润（按生产周期平滑） */
  avgNet: number;
}

/** 财务摘要 */
export interface FinancialSummary {
  /** 总销售收入 */
  totalIncome: number;
  /** 总投入成本 */
  totalInputCost: number;
  /** 总维护成本 */
  totalMaintenance: number;
  /** 净利润 */
  netProfit: number;
  /** 滚动平均净利润（按生产周期平滑） */
  avgNetProfit: number;
  buildingProfits: BuildingProfit[];
}

/** 价格历史条目 - 扩展为包含成交量数据 */
export interface PriceHistoryEntry {
  tick: number;
  price: number;
  volume?: number;      // 总成交量
  buyVolume?: number;   // 买入成交量
  sellVolume?: number;  // 卖出成交量
}

/** 建筑财务历史条目 */
export interface BuildingFinanceEntry {
  tick: number;
  income: number;
  inputCost: number;
  maintenance: number;
  net: number;
}

/** AI公司状态 */
export interface AICompanyClient {
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
export interface CompetitionEventClient {
  id: string;
  tick: number;
  type: string;
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  affectedGoods?: string[];
  severity: 'minor' | 'moderate' | 'major';
  /** LLM生成的战略理由（仅strategy_change类型有） */
  reasoning?: string;
}

/** LLM生成的市场事件 */
export interface MarketEventClient {
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

/** 新发明的技术 */
export interface InventedTechClient {
  id: string;
  name: string;
  category: string;
  inventedAt: number;
}

/** 库存项目 */
export interface InventoryStockItem {
  goodsId: string;
  goodsName: string;
  quantity: number;
  reservedForSale: number;
  reservedForProduction: number;
  avgCost: number;
  marketValue: number;
}

/** 库存快照 */
export interface InventorySnapshot {
  stocks: InventoryStockItem[];
  totalValue: number;
}

/** 建筑短缺信息 */
export interface BuildingShortage {
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

/** Simplified game state for frontend */
export interface ClientGameState {
  // Meta
  gameId: EntityId | null;
  isLoading: boolean;
  error: string | null;
  
  // Time
  currentTick: GameTick;
  gameSpeed: GameSpeed;
  isPaused: boolean;
  
  // Player
  playerCompanyId: EntityId | null;
  playerCompany: Company | null;
  
  // Financials
  financials: FinancialSummary | null;
  showFinancialReport: boolean;
  
  // Buildings
  buildings: Map<EntityId, BuildingInstance>;
  selectedBuildingId: EntityId | null;
  
  // Market
  marketSummaries: Map<EntityId, MarketSummary>;
  goodsDefinitions: Map<EntityId, GoodsDefinition>;
  marketPrices: Record<string, number>; // 当前商品价格
  priceHistory: Map<string, PriceHistoryEntry[]>; // 价格历史
  
  // Building finance history
  buildingFinanceHistory: Map<EntityId, BuildingFinanceEntry[]>; // 建筑财务历史
  
  // AI Competitors
  aiCompanies: AICompanyClient[];
  recentCompetitionEvents: CompetitionEventClient[];
  
  // LLM市场事件
  recentMarketEvents: MarketEventClient[];
  
  // Research
  inventedTechnologies: InventedTechClient[];
  
  // Inventory
  inventory: InventorySnapshot | null;
  
  // Building Shortages
  buildingShortages: BuildingShortage[];
  
  // Events
  activeEvents: GameEvent[];
  newsItems: Array<{ id: string; headline: string; timestamp: number; companyId?: string }>;
  
  // AI Assistant
  chatMessages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  isAssistantTyping: boolean;
  
  // UI State
  activePanel: 'industries' | 'market' | 'research' | 'diplomacy' | 'economy' | 'stocks';
  showProductionCard: boolean;
  selectedGoodsId: EntityId | null;
  
  // Economy Center selected goods (for cross-panel navigation)
  economySelectedGoodsId: string | null;
}

/** Actions for the game store */
export interface GameStoreActions {
  // Initialization
  initializeGame: (gameId: EntityId) => Promise<void>;
  resetGame: () => void;
  disconnectGame: () => void;
  
  // Time control (now communicates via WebSocket)
  setGameSpeed: (speed: GameSpeed) => void;
  togglePause: () => void;
  advanceTick: (tick: GameTick) => void;
  
  // WebSocket handlers
  handleTickUpdate: (payload: TickPayload) => void;
  handleSpeedChange: (speed: number, isPaused: boolean) => void;
  
  // Building management
  selectBuilding: (buildingId: EntityId | null) => void;
  updateBuilding: (building: BuildingInstance) => void;
  switchProductionMethod: (buildingId: EntityId, slotType: string, methodId: EntityId) => void;
  
  // Market
  updateMarketSummary: (summary: MarketSummary) => void;
  selectGoods: (goodsId: EntityId | null) => void;
  
  // Events
  addEvent: (event: GameEvent) => void;
  dismissEvent: (eventId: EntityId) => void;
  addNewsItem: (headline: string) => void;
  
  // AI Assistant
  sendMessage: (content: string) => Promise<void>;
  addAssistantMessage: (content: string) => void;
  setAssistantTyping: (typing: boolean) => void;
  
  // UI
  setActivePanel: (panel: ClientGameState['activePanel']) => void;
  setShowProductionCard: (show: boolean) => void;
  setShowFinancialReport: (show: boolean) => void;
  
  // Economy navigation
  setEconomySelectedGoodsId: (goodsId: string | null) => void;
  navigateToEconomyGoods: (goodsId: string) => void;
}

type GameStore = ClientGameState & GameStoreActions;

const initialState: ClientGameState = {
  gameId: null,
  isLoading: false,
  error: null,
  
  currentTick: 0,
  gameSpeed: 0 as GameSpeed,
  isPaused: true,
  
  playerCompanyId: null,
  playerCompany: null,
  
  financials: null,
  showFinancialReport: false,
  
  buildings: new Map(),
  selectedBuildingId: null,
  
  marketSummaries: new Map(),
  goodsDefinitions: new Map(),
  marketPrices: {},
  priceHistory: new Map(),
  buildingFinanceHistory: new Map(),
  
  aiCompanies: [],
  recentCompetitionEvents: [],
  recentMarketEvents: [],
  
  inventedTechnologies: [],
  
  inventory: null,
  
  buildingShortages: [],
  
  activeEvents: [],
  newsItems: [],
  
  chatMessages: [
    {
      id: '1',
      role: 'assistant',
      content: '欢迎回来，指挥官。市场显示能源板块活跃度正在上升。需要我分析潜在的投资机会吗？',
      timestamp: Date.now(),
    },
  ],
  isAssistantTyping: false,
  
  activePanel: 'industries',
  showProductionCard: false,
  selectedGoodsId: null,
  economySelectedGoodsId: null,
};

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    ...initialState,
    
    // Initialization
    initializeGame: async (gameId: EntityId) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
        state.gameId = gameId;
      });
      
      try {
        // Connect to WebSocket first
        await gameWebSocket.connect(gameId);
        
        // Set up WebSocket message handlers
        gameWebSocket.on('init', (msg: WSMessage) => {
          const payload = msg.payload as {
            currentTick: number;
            speed: number;
            isPaused: boolean;
            playerCash?: number;
            buildingCount?: number;
          };
          set((state) => {
            state.currentTick = payload.currentTick;
            state.gameSpeed = payload.speed as GameSpeed;
            state.isPaused = payload.isPaused;
            
            // Update playerCash from init message for immediate UI sync
            if (payload.playerCash !== undefined) {
              // Initialize playerCompany if not exists
              if (!state.playerCompany) {
                state.playerCompany = {
                  id: state.playerCompanyId ?? 'player-company-1',
                  name: '我的公司',
                  type: CompanyType.Player,
                  cash: payload.playerCash,
                  debt: 0,
                  creditRating: 'A',
                  stockPrice: 10000,
                  sharesOutstanding: 1000000,
                  marketCap: 10000000000,
                  publicReputation: 75,
                  supplierReputation: 80,
                  employeeReputation: 70,
                  relationships: [],
                  interactionHistory: [],
                  createdAt: Date.now(),
                };
              } else {
                state.playerCompany.cash = payload.playerCash;
              }
            }
          });
        });
        
        gameWebSocket.on('tick', (msg: WSMessage) => {
          const payload = msg.payload as unknown as TickPayload;
          if (payload) {
            get().handleTickUpdate(payload);
          }
        });
        
        // 处理增量更新（delta update）- 与完整 tick 使用相同的处理逻辑
        // 服务端在使用增量推送优化时会发送 tickDelta 而不是 tick
        gameWebSocket.on('tickDelta', (msg: WSMessage) => {
          const payload = msg.payload as unknown as TickPayload;
          if (payload) {
            get().handleTickUpdate(payload);
          }
        });
        
        gameWebSocket.on('speedChange', (msg: WSMessage) => {
          const payload = msg.payload as { speed: number; isPaused: boolean };
          get().handleSpeedChange(payload.speed, payload.isPaused);
        });
        
        gameWebSocket.on('pauseChange', (msg: WSMessage) => {
          const payload = msg.payload as { speed: number; isPaused: boolean };
          get().handleSpeedChange(payload.speed, payload.isPaused);
        });
        
        gameWebSocket.on('buildingAdded', (msg: WSMessage) => {
          const payload = msg.payload as {
            building: {
              id: string;
              definitionId: string;
              name: string;
              position: { x: number; y: number };
              efficiency: number;
              utilization: number;
              status: string;
              constructionProgress?: number;
              constructionTimeRequired?: number;
              productionProgress?: number;
            };
            playerCash: number;
          };
          set((state) => {
            // 根据服务端状态确定 operationalStatus
            const serverStatus = payload.building.status;
            let operationalStatus: string;
            switch (serverStatus) {
              case 'running':
                operationalStatus = OperationalStatus.Operational;
                break;
              case 'paused':
                operationalStatus = OperationalStatus.Paused;
                break;
              case 'no_input':
                operationalStatus = OperationalStatus.LackingInputs;
                break;
              case 'no_power':
                operationalStatus = OperationalStatus.LackingEnergy;
                break;
              case 'under_construction':
                operationalStatus = 'under_construction'; // 建造中
                break;
              case 'waiting_materials':
                operationalStatus = 'waiting_materials'; // 等待材料
                break;
              default:
                operationalStatus = OperationalStatus.Operational;
            }
            
            // Add building to map
            state.buildings.set(payload.building.id, {
              id: payload.building.id,
              definitionId: payload.building.definitionId,
              ownerId: state.playerCompanyId ?? '',
              name: payload.building.name,
              zoneId: 'default',
              position: payload.building.position,
              activeMethodIds: {},
              efficiency: payload.building.efficiency,
              condition: 1,
              utilizationRate: payload.building.utilization,
              inputInventory: [],
              outputInventory: [],
              createdAt: Date.now(),
              operationalStatus: operationalStatus as 'running' | 'paused' | 'maintenance' | 'disabled',
              inputCapacity: 1000,
              outputCapacity: 1000,
              currentWorkers: 10,
              maxWorkers: 20,
              maintenanceCost: 1000,
              lastMaintenanceTick: 0,
              productionQueue: [],
              // 保存服务端的原始状态供前端显示使用
              serverStatus: serverStatus,
              productionProgress: payload.building.productionProgress ?? 0,
              constructionProgress: payload.building.constructionProgress,
              constructionTimeRequired: payload.building.constructionTimeRequired,
            } as unknown as BuildingInstance);
            
            // Update player cash
            if (state.playerCompany) {
              state.playerCompany.cash = payload.playerCash;
            }
          });
        });
        
        // Handle production method change
        gameWebSocket.on('methodChanged', (msg: WSMessage) => {
          const payload = msg.payload as { buildingId: string; methodId: string };
          set((state) => {
            const building = state.buildings.get(payload.buildingId);
            if (building) {
              // Update activeMethodIds with the new method
              building.activeMethodIds = { ...building.activeMethodIds, process: payload.methodId };
              // Also update currentMethodId for ProductionCard to read
              (building as unknown as { currentMethodId: string }).currentMethodId = payload.methodId;
            }
          });
        });
        
        // Fetch game state from server
        const gameResult = await api.getGame(gameId);
        
        if (gameResult.error) {
          throw new Error(gameResult.error);
        }
        
        const gameData = gameResult.data;
        
        set((state) => {
          state.isLoading = false;
          state.currentTick = gameData.currentTick;
          state.gameSpeed = gameData.speed as GameSpeed;
          state.isPaused = gameData.isPaused;
          state.playerCompanyId = gameData.playerCompanyId;
          // Use playerCash from server, fallback to default if not provided
          const serverCash = gameData.playerCash ?? 500000000;
          state.playerCompany = {
            id: gameData.playerCompanyId,
            name: '我的公司',
            type: CompanyType.Player,
            cash: serverCash,
            debt: 0,
            creditRating: 'A',
            stockPrice: 10000,
            sharesOutstanding: 1000000,
            marketCap: 10000000000,
            publicReputation: 75,
            supplierReputation: 80,
            employeeReputation: 70,
            relationships: [],
            interactionHistory: [],
            createdAt: Date.now(),
          };
        });
        
        // Load buildings
        const buildingsResult = await api.getBuildings(gameId);
        if (buildingsResult.data) {
          set((state) => {
            buildingsResult.data.buildings.forEach((b) => {
              // Extract currentMethodId from activeMethodIds or use the first slot's method
              const currentMethodId = (b as { currentMethodId?: string }).currentMethodId
                || (b.activeMethodIds as Record<string, string>)?.process
                || '';
              
              // 从服务端获取建筑状态，映射到 operationalStatus
              const serverStatus = (b as { status?: string }).status;
              let operationalStatus: string;
              switch (serverStatus) {
                case 'running':
                  operationalStatus = OperationalStatus.Operational;
                  break;
                case 'paused':
                  operationalStatus = OperationalStatus.Paused;
                  break;
                case 'no_input':
                  operationalStatus = OperationalStatus.LackingInputs;
                  break;
                case 'no_power':
                  operationalStatus = OperationalStatus.LackingEnergy;
                  break;
                case 'under_construction':
                  operationalStatus = 'under_construction'; // 建造中
                  break;
                case 'waiting_materials':
                  operationalStatus = 'waiting_materials'; // 等待材料
                  break;
                default:
                  operationalStatus = OperationalStatus.Operational;
              }
              
              state.buildings.set(b.id, {
                id: b.id,
                definitionId: b.type,
                ownerId: b.companyId,
                name: b.name,
                zoneId: b.zoneId,
                position: b.position,
                activeMethodIds: b.activeMethodIds as Record<string, string>,
                currentMethodId,
                efficiency: b.efficiency,
                condition: 1,
                utilizationRate: b.utilization,
                inputInventory: [],
                outputInventory: [],
                createdAt: Date.now(),
                operationalStatus: operationalStatus as 'running' | 'paused' | 'maintenance' | 'disabled',
                inputCapacity: 1000,
                outputCapacity: 1000,
                currentWorkers: 10,
                maxWorkers: 20,
                maintenanceCost: 1000,
                lastMaintenanceTick: 0,
                productionQueue: [],
                // 保存服务端的原始状态供前端显示使用
                serverStatus: serverStatus,
                productionProgress: (b as { productionProgress?: number }).productionProgress ?? 0,
                constructionProgress: (b as { constructionProgress?: number }).constructionProgress,
                constructionTimeRequired: (b as { constructionTimeRequired?: number }).constructionTimeRequired,
              } as unknown as BuildingInstance);
            });
          });
        }
      } catch (error) {
        set((state) => {
          state.isLoading = false;
          state.error = error instanceof Error ? error.message : '加载游戏失败';
        });
      }
    },
    
    resetGame: () => {
      gameWebSocket.disconnect();
      set(initialState);
    },
    
    disconnectGame: () => {
      gameWebSocket.disconnect();
    },
    
    // Time control - now sends commands via WebSocket
    setGameSpeed: (speed: GameSpeed) => {
      gameWebSocket.setSpeed(speed);
      // Optimistic update
      set((state) => {
        state.gameSpeed = speed;
        state.isPaused = speed === 0;
      });
    },
    
    togglePause: () => {
      gameWebSocket.togglePause();
      // Optimistic update
      set((state) => {
        state.isPaused = !state.isPaused;
        if (state.isPaused) {
          state.gameSpeed = 0 as GameSpeed;
        } else if (state.gameSpeed === 0) {
          state.gameSpeed = 1 as GameSpeed;
        }
      });
    },
    
    advanceTick: (tick: GameTick) => {
      set((state) => {
        state.currentTick = tick;
      });
    },
    
    // WebSocket handlers
    handleTickUpdate: (payload: TickPayload) => {
      set((state) => {
        state.currentTick = payload.tick;
        
        // Update player cash from tick if provided
        if (payload.playerCash !== undefined && state.playerCompany) {
          state.playerCompany.cash = payload.playerCash;
        }
        
        // Update financials from tick if provided
        if (payload.financials) {
          state.financials = payload.financials as FinancialSummary;
          
          // Track building finance history
          const MAX_BUILDING_HISTORY = 100;
          for (const bp of (payload.financials as FinancialSummary).buildingProfits) {
            let history = state.buildingFinanceHistory.get(bp.buildingId);
            if (!history) {
              history = [];
              state.buildingFinanceHistory.set(bp.buildingId, history);
            }
            history.push({
              tick: payload.tick,
              income: bp.income,
              inputCost: bp.inputCost,
              maintenance: bp.maintenance,
              net: bp.net,
            });
            
            // Keep only last 100 entries
            if (history.length > MAX_BUILDING_HISTORY) {
              state.buildingFinanceHistory.set(bp.buildingId, history.slice(-MAX_BUILDING_HISTORY));
            }
          }
        }
        
        // Update market prices and build history (with volume data if available)
        // 支持增量更新优化：服务端可能发送完整快照(marketPrices)或增量(priceDelta)
        const tickPayloadWithDelta = payload as unknown as {
          marketPrices?: Record<string, number>;
          priceDelta?: Record<string, number>;
          isFullSnapshot?: boolean;
          tickVolumes?: Record<string, { total: number; buy: number; sell: number }>;
        };
        
        // 更新当前价格状态
        if (tickPayloadWithDelta.isFullSnapshot && tickPayloadWithDelta.marketPrices) {
          // 完整快照：直接替换
          state.marketPrices = tickPayloadWithDelta.marketPrices;
        } else if (tickPayloadWithDelta.priceDelta) {
          // 增量更新：合并变化到现有价格
          state.marketPrices = { ...state.marketPrices, ...tickPayloadWithDelta.priceDelta };
        } else if (payload.marketPrices) {
          // 兼容旧版：没有 isFullSnapshot 标记时当作完整快照处理
          state.marketPrices = payload.marketPrices;
        }
        
        // ===== 关键修复：每个 tick 都记录所有商品的价格历史 =====
        // 之前的问题：只有收到增量更新的商品才记录历史
        // 这导致价格没有变化的商品会缺失数据点，造成图表稀疏
        // 现在：遍历所有已知价格，确保每个 tick 都有完整记录
        const tickVolumes = tickPayloadWithDelta.tickVolumes;
        // 1 tick = 1 day，保留3650天（10年）的数据点
        const MAX_HISTORY = 3650;
        const CLEANUP_THRESHOLD = 4000;
        
        // 只有在有价格数据时才记录历史
        if (Object.keys(state.marketPrices).length > 0) {
          for (const [goodsId, price] of Object.entries(state.marketPrices)) {
            let history = state.priceHistory.get(goodsId);
            if (!history) {
              history = [];
              state.priceHistory.set(goodsId, history);
            }
            
            // 优化：检查是否已经有这个 tick 的记录（避免重复）
            // 这在快速重连或数据同步时可能发生
            const lastEntry = history.length > 0 ? history[history.length - 1] : null;
            if (lastEntry && lastEntry.tick === payload.tick) {
              // 更新最后一条记录的价格（可能有更新）
              lastEntry.price = price;
              const vol = tickVolumes?.[goodsId];
              if (vol) {
                lastEntry.volume = vol.total;
                lastEntry.buyVolume = vol.buy;
                lastEntry.sellVolume = vol.sell;
              }
            } else {
              // 添加新记录
              const vol = tickVolumes?.[goodsId];
              history.push({
                tick: payload.tick,
                price,
                volume: vol?.total,
                buyVolume: vol?.buy,
                sellVolume: vol?.sell,
              });
            }
            
            // 使用延迟清理策略：只有超过阈值才触发 slice
            if (history.length > CLEANUP_THRESHOLD) {
              state.priceHistory.set(goodsId, history.slice(-MAX_HISTORY));
            }
          }
        }
        
        // Handle events from tick - 只处理非AI公司相关的系统事件
        // AI公司相关事件不再添加到newsItems
        if (payload.events && payload.events.length > 0) {
          for (const event of payload.events) {
            // 跳过AI活动类型的事件
            if (event.type === 'ai_activity') {
              continue;
            }
            state.newsItems.unshift({
              id: event.id,
              headline: event.message,
              timestamp: payload.timestamp,
            });
          }
        }
        
        // Handle AI companies
        if (payload.aiCompanies) {
          state.aiCompanies = payload.aiCompanies as AICompanyClient[];
        }
        
        // Handle competition events - accumulate history instead of replacing
        // 竞争事件只显示在CompetitorPanel的"竞争情报"区域，不添加到实时动态
        if (payload.competitionEvents && payload.competitionEvents.length > 0) {
          // Add new events to the beginning
          const newEvents = payload.competitionEvents as CompetitionEventClient[];
          const existingIds = new Set(state.recentCompetitionEvents.map(e => e.id));
          
          for (const event of newEvents) {
            if (!existingIds.has(event.id)) {
              state.recentCompetitionEvents.unshift(event);
            }
          }
          
          // Keep only last 100 competition events
          if (state.recentCompetitionEvents.length > 100) {
            state.recentCompetitionEvents = state.recentCompetitionEvents.slice(0, 100);
          }
          
          // 注意：不再添加到newsItems，竞争事件只在CompetitorPanel显示
        }
        
        // Handle AI news - 不再添加到newsItems，这些只显示在CompetitorPanel
        // AI公司新闻不再污染实时动态区域
        
        // Handle LLM market events
        if (payload.marketEvents && payload.marketEvents.length > 0) {
          const newMarketEvents = payload.marketEvents as MarketEventClient[];
          const existingMarketIds = new Set(state.recentMarketEvents.map(e => e.id));
          const existingNewsIds = new Set(state.newsItems.map(n => n.id));
          
          for (const event of newMarketEvents) {
            if (!existingMarketIds.has(event.id)) {
              state.recentMarketEvents.unshift(event);
              
              // 添加到新闻流，带有严重程度标记
              // 使用带前缀的ID以避免与其他来源的事件冲突
              const newsId = `market-news-${event.id}`;
              if (!existingNewsIds.has(newsId)) {
                const severityEmoji = event.severity === 'critical' ? '🚨' :
                                     event.severity === 'major' ? '⚠️' :
                                     event.severity === 'moderate' ? '📊' : '📰';
                state.newsItems.unshift({
                  id: newsId,
                  headline: `${severityEmoji} ${event.title}`,
                  timestamp: payload.timestamp,
                });
                existingNewsIds.add(newsId);
              }
            }
          }
          
          // Keep only last 50 market events
          if (state.recentMarketEvents.length > 50) {
            state.recentMarketEvents = state.recentMarketEvents.slice(0, 50);
          }
        }
        
        // Handle inventory update
        if (payload.inventory) {
          state.inventory = payload.inventory as InventorySnapshot;
        }
        
        // Handle building shortages and update building operational status
        if (payload.buildingShortages) {
          state.buildingShortages = payload.buildingShortages as BuildingShortage[];
          
          // Update building operational status based on shortages
          // First, reset all buildings to 'operational'
          for (const [, building] of state.buildings) {
            building.operationalStatus = OperationalStatus.Operational;
          }
          
          // Then mark buildings with shortages
          for (const shortage of payload.buildingShortages as BuildingShortage[]) {
            const building = state.buildings.get(shortage.buildingId);
            if (building) {
              // Map shortage status to operationalStatus
              switch (shortage.status) {
                case 'no_input':
                  building.operationalStatus = OperationalStatus.LackingInputs;
                  break;
                case 'no_power':
                  building.operationalStatus = OperationalStatus.LackingEnergy;
                  break;
                case 'paused':
                  building.operationalStatus = OperationalStatus.Paused;
                  break;
                default:
                  building.operationalStatus = OperationalStatus.Operational;
              }
            }
          }
        } else {
          // Clear shortages if none reported - all buildings are operational
          state.buildingShortages = [];
          for (const [, building] of state.buildings) {
            building.operationalStatus = OperationalStatus.Operational;
          }
        }
        
        // Handle buildings progress (construction progress, status updates)
        const buildingsProgressPayload = (payload as unknown as {
          buildingsProgress?: Array<{
            buildingId: string;
            status: 'under_construction' | 'waiting_materials' | 'running' | 'no_input';
            constructionProgress?: number;
            constructionTimeRequired?: number;
            productionProgress?: number;
          }>;
        }).buildingsProgress;
        
        if (buildingsProgressPayload && buildingsProgressPayload.length > 0) {
          for (const progress of buildingsProgressPayload) {
            const building = state.buildings.get(progress.buildingId);
            if (building) {
              // Update construction progress
              if (progress.constructionProgress !== undefined) {
                (building as unknown as { constructionProgress?: number }).constructionProgress = progress.constructionProgress;
              }
              if (progress.constructionTimeRequired !== undefined) {
                (building as unknown as { constructionTimeRequired?: number }).constructionTimeRequired = progress.constructionTimeRequired;
              }
              if (progress.productionProgress !== undefined) {
                (building as unknown as { productionProgress?: number }).productionProgress = progress.productionProgress;
              }
              
              // Update status and operationalStatus
              (building as unknown as { serverStatus: string }).serverStatus = progress.status;
              
              switch (progress.status) {
                case 'under_construction':
                  building.operationalStatus = 'under_construction' as unknown as typeof OperationalStatus.Operational;
                  break;
                case 'waiting_materials':
                  building.operationalStatus = 'waiting_materials' as unknown as typeof OperationalStatus.Operational;
                  break;
                case 'running':
                  building.operationalStatus = OperationalStatus.Operational;
                  break;
                case 'no_input':
                  building.operationalStatus = OperationalStatus.LackingInputs;
                  break;
              }
            }
          }
        }
        
        // Handle research updates
        if (payload.researchUpdates) {
          const updates = payload.researchUpdates as ResearchUpdatePayload;
          
          // Add newly invented technologies
          if (updates.newTechnologies && updates.newTechnologies.length > 0) {
            for (const tech of updates.newTechnologies) {
              // Check if already exists
              if (!state.inventedTechnologies.find(t => t.id === tech.id)) {
                state.inventedTechnologies.unshift({
                  id: tech.id,
                  name: tech.name,
                  category: tech.category,
                  inventedAt: payload.tick,
                });
                
                // Add to news
                state.newsItems.unshift({
                  id: `tech-${tech.id}`,
                  headline: `🔬 新技术发明：${tech.name}`,
                  timestamp: payload.timestamp,
                });
              }
            }
          }
        }
        
        // Keep only last 30 news items
        if (state.newsItems.length > 30) {
          state.newsItems = state.newsItems.slice(0, 30);
        }
      });
    },
    
    handleSpeedChange: (speed: number, isPaused: boolean) => {
      set((state) => {
        state.gameSpeed = speed as GameSpeed;
        state.isPaused = isPaused;
      });
    },
    
    // Building management
    selectBuilding: (buildingId: EntityId | null) => {
      set((state) => {
        state.selectedBuildingId = buildingId;
        state.showProductionCard = buildingId !== null;
      });
    },
    
    updateBuilding: (building: BuildingInstance) => {
      set((state) => {
        state.buildings.set(building.id, building);
      });
    },
    
    switchProductionMethod: (buildingId: EntityId, slotType: string, methodId: EntityId) => {
      const gameId = get().gameId;
      
      set((state) => {
        const building = state.buildings.get(buildingId);
        if (building) {
          building.activeMethodIds[slotType as keyof typeof building.activeMethodIds] = methodId;
        }
      });
      
      // Send to server
      if (gameId) {
        api.updateBuildingMethod(gameId, buildingId, slotType, methodId)
          .catch((err) => console.error('Failed to update production method:', err));
      }
    },
    
    // Market
    updateMarketSummary: (summary: MarketSummary) => {
      set((state) => {
        state.marketSummaries.set(summary.goodsId, summary);
      });
    },
    
    selectGoods: (goodsId: EntityId | null) => {
      set((state) => {
        state.selectedGoodsId = goodsId;
      });
    },
    
    // Events
    addEvent: (event: GameEvent) => {
      set((state) => {
        state.activeEvents.push(event);
      });
    },
    
    dismissEvent: (eventId: EntityId) => {
      set((state) => {
        state.activeEvents = state.activeEvents.filter((e) => e.id !== eventId);
      });
    },
    
    addNewsItem: (headline: string) => {
      set((state) => {
        state.newsItems.unshift({
          id: Date.now().toString(),
          headline,
          timestamp: Date.now(),
        });
        // Keep only last 20 news items
        if (state.newsItems.length > 20) {
          state.newsItems = state.newsItems.slice(0, 20);
        }
      });
    },
    
    // AI Assistant
    sendMessage: async (content: string) => {
      const gameId = get().gameId;
      
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content,
        timestamp: Date.now(),
      };
      
      set((state) => {
        state.chatMessages.push(userMessage);
        state.isAssistantTyping = true;
      });
      
      try {
        if (gameId) {
          const result = await api.sendChatMessage(gameId, content, 'assistant');
          
          if (result.data) {
            set((state) => {
              state.chatMessages.push({
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: result.data.content,
                timestamp: result.data.timestamp,
              });
              state.isAssistantTyping = false;
            });
          } else {
            throw new Error(result.error || '获取回复失败');
          }
        } else {
          // Fallback for no game connection
          await new Promise((resolve) => setTimeout(resolve, 500));
          set((state) => {
            state.chatMessages.push({
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `我理解您在询问关于"${content}"的问题。请连接游戏服务器以获得完整的AI助手支持。`,
              timestamp: Date.now(),
            });
            state.isAssistantTyping = false;
          });
        }
      } catch (error) {
        set((state) => {
          state.chatMessages.push({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '抱歉，处理您的请求时遇到了错误。请重试。',
            timestamp: Date.now(),
          });
          state.isAssistantTyping = false;
        });
      }
    },
    
    addAssistantMessage: (content: string) => {
      set((state) => {
        state.chatMessages.push({
          id: Date.now().toString(),
          role: 'assistant',
          content,
          timestamp: Date.now(),
        });
      });
    },
    
    setAssistantTyping: (typing: boolean) => {
      set((state) => {
        state.isAssistantTyping = typing;
      });
    },
    
    // UI
    setActivePanel: (panel: ClientGameState['activePanel']) => {
      set((state) => {
        state.activePanel = panel;
      });
    },
    
    setShowProductionCard: (show: boolean) => {
      set((state) => {
        state.showProductionCard = show;
        if (!show) {
          state.selectedBuildingId = null;
        }
      });
    },
    
    setShowFinancialReport: (show: boolean) => {
      set((state) => {
        state.showFinancialReport = show;
      });
    },
    
    setEconomySelectedGoodsId: (goodsId: string | null) => {
      set((state) => {
        state.economySelectedGoodsId = goodsId;
      });
    },
    
    navigateToEconomyGoods: (goodsId: string) => {
      set((state) => {
        state.activePanel = 'economy';
        state.economySelectedGoodsId = goodsId;
      });
    },
  }))
);

// Selectors
export const usePlayerCompany = () => useGameStore((state) => state.playerCompany);
export const useCurrentTick = () => useGameStore((state) => state.currentTick);
export const useGameSpeed = () => useGameStore((state) => state.gameSpeed);
export const useIsPaused = () => useGameStore((state) => state.isPaused);
export const useActivePanel = () => useGameStore((state) => state.activePanel);
export const useChatMessages = () => useGameStore((state) => state.chatMessages);
export const useIsAssistantTyping = () => useGameStore((state) => state.isAssistantTyping);
export const useFinancials = () => useGameStore((state) => state.financials);
export const useShowFinancialReport = () => useGameStore((state) => state.showFinancialReport);
export const useMarketPrices = () => useGameStore((state) => state.marketPrices);
export const usePriceHistory = () => useGameStore((state) => state.priceHistory);
export const useBuildingFinanceHistory = () => useGameStore((state) => state.buildingFinanceHistory);
export const useInventory = () => useGameStore((state) => state.inventory);
export const useBuildingShortages = () => useGameStore((state) => state.buildingShortages);
export const useEconomySelectedGoodsId = () => useGameStore((state) => state.economySelectedGoodsId);
export const useNavigateToEconomyGoods = () => useGameStore((state) => state.navigateToEconomyGoods);