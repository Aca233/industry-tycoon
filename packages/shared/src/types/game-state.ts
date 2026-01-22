/**
 * Game state and save/load types
 */

import { type EntityId, type GameTick, type Timestamp, type Zone } from './common.js';
import { type Company } from './company.js';
import { type GameEvent } from './events.js';
import { type GoodsDefinition, type MarketListing, type PriceRecord } from './goods.js';
import { type Contract, type MarketTrend, type NeedGroup, type PopGroup } from './market.js';
import { type BuildingDefinition, type BuildingInstance } from './production.js';
import { type Technology, type ResearchProject, type Patent, type TechConstellationNode } from './technology.js';

/** Game difficulty settings */
export enum Difficulty {
  Sandbox = 'sandbox',
  Easy = 'easy',
  Normal = 'normal',
  Hard = 'hard',
  Brutal = 'brutal',
}

/** Game speed settings */
export enum GameSpeed {
  Paused = 0,
  Slow = 1,
  Normal = 2,
  Fast = 3,
  VeryFast = 4,
}

/** City configuration */
export interface CityConfig {
  id: EntityId;
  name: string;
  nameZh: string;
  population: number;
  zones: Zone[];
  
  // Economic parameters
  baseTaxRate: number;
  baseInterestRate: number;
  regulationLevel: number; // 0-1
  
  // Starting conditions
  initialGoods: EntityId[];
  initialTechnologies: EntityId[];
  initialCompanies: EntityId[];
}

/** Complete game state */
export interface GameState {
  // Meta
  id: EntityId;
  version: string;
  createdAt: Timestamp;
  lastSavedAt: Timestamp;
  
  // Time
  currentTick: GameTick;
  gameSpeed: GameSpeed;
  ticksPerSecond: number;
  
  // Settings
  difficulty: Difficulty;
  city: CityConfig;
  
  // Player
  playerCompanyId: EntityId;
  
  // Definitions (static data)
  definitions: {
    goods: Map<EntityId, GoodsDefinition>;
    buildings: Map<EntityId, BuildingDefinition>;
    technologies: Map<EntityId, Technology>;
    needGroups: Map<EntityId, NeedGroup>;
  };
  
  // Entities (dynamic data)
  entities: {
    companies: Map<EntityId, Company>;
    buildings: Map<EntityId, BuildingInstance>;
    contracts: Map<EntityId, Contract>;
    popGroups: Map<EntityId, PopGroup>;
  };
  
  // Market state
  market: {
    listings: MarketListing[];
    priceHistory: Map<EntityId, PriceRecord[]>;
    activeTrends: MarketTrend[];
    supplyDemand: Map<EntityId, { supply: number; demand: number }>;
  };
  
  // Events
  events: {
    active: GameEvent[];
    history: GameEvent[];
    scheduled: ScheduledEvent[];
  };
  
  // Research system
  research: {
    projects: Map<EntityId, ResearchProject>;
    discoveredTechnologies: Map<EntityId, Technology>;
    patents: Map<EntityId, Patent>;
    constellation: TechConstellationNode[];
    activeSideEffects: ActiveSideEffect[];
  };
  
  // Statistics
  statistics: GameStatistics;
}

export interface ScheduledEvent {
  eventId: EntityId;
  triggerTick: GameTick;
  condition?: string;
}

export interface GameStatistics {
  totalTicks: number;
  
  // Economic
  totalGDPHistory: number[];
  inflationRate: number;
  unemploymentRate: number;
  
  // Player specific
  playerNetWorthHistory: number[];
  playerMarketShareHistory: Record<EntityId, number[]>;
  
  // Market
  totalTradeVolume: number;
  averagePriceIndex: number;
  
  // Events
  totalEventsGenerated: number;
  playerEventResponses: number;
  
  // Research
  technologiesDiscovered: number;
  researchProjectsCompleted: number;
  researchProjectsFailed: number;
  patentsGranted: number;
  sideEffectsTriggered: number;
}

/** Active side effect that has been triggered */
export interface ActiveSideEffect {
  id: EntityId;
  technologyId: EntityId;
  sideEffectId: EntityId;
  triggeredAt: GameTick;
  effectAppliedAt?: GameTick;
  resolved: boolean;
  resolvedAt?: GameTick;
  impactSummary?: string;
}

/** Save game metadata */
export interface SaveGameMeta {
  id: EntityId;
  name: string;
  createdAt: Timestamp;
  lastPlayedAt: Timestamp;
  
  // Preview info
  playerCompanyName: string;
  playerNetWorth: number;
  currentTick: GameTick;
  difficulty: Difficulty;
  cityName: string;
  
  // File info
  fileSize: number;
  version: string;
  
  // Screenshot/preview
  thumbnailUrl?: string;
}

/** Game session info */
export interface GameSession {
  id: EntityId;
  gameStateId: EntityId;
  
  // Connection
  isOnline: boolean;
  connectedAt: Timestamp;
  
  // Autosave
  lastAutosave: Timestamp;
  autosaveInterval: number;
  
  // Performance
  averageTickTime: number;
  llmCallsThisSession: number;
  llmTokensUsed: number;
}

/** Partial state update for real-time sync */
export interface StateUpdate {
  tick: GameTick;
  timestamp: Timestamp;
  
  // What changed
  type: UpdateType;
  entityType?: string;
  entityId?: EntityId;
  
  // The change
  path: string[];
  previousValue?: unknown;
  newValue: unknown;
}

export enum UpdateType {
  EntityCreated = 'entity_created',
  EntityUpdated = 'entity_updated',
  EntityDeleted = 'entity_deleted',
  MarketTransaction = 'market_transaction',
  EventTriggered = 'event_triggered',
  TickAdvanced = 'tick_advanced',
}

/** Delta for efficient state sync */
export interface StateDelta {
  fromTick: GameTick;
  toTick: GameTick;
  updates: StateUpdate[];
  compressed?: boolean;
}