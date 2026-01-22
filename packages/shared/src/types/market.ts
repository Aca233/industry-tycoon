/**
 * Market and trading system types
 */

import { type EntityId, type Money, type Percentage, type Timestamp } from './common.js';
import { type QualityLevel } from './goods.js';

/** Need group categories - what POPs actually want */
export enum NeedCategory {
  BasicMetabolism = 'basic_metabolism', // Food, water
  Stimulants = 'stimulants', // Coffee, entertainment
  SocialStatus = 'social_status', // Luxury goods
  Mobility = 'mobility', // Transportation
  Shelter = 'shelter', // Housing
  Healthcare = 'healthcare', // Medical
  Education = 'education', // Learning
  Communication = 'communication', // Phones, internet
}

/** Definition of a need group */
export interface NeedGroup {
  id: EntityId;
  category: NeedCategory;
  name: string;
  nameZh: string;
  description: string;
  baseDemand: number; // Base units demanded per POP
  elasticity: number; // Price elasticity (-1 to 1)
  satisfactionDecay: number; // How fast satisfaction decreases
}

/** Mapping of goods to need groups (can change dynamically via LLM) */
export interface GoodsNeedMapping {
  goodsId: EntityId;
  needGroupId: EntityId;
  baseUtility: number;
  currentUtility: number; // Can be modified by LLM events
  utilityModifiers: UtilityModifier[];
}

export interface UtilityModifier {
  source: 'tag' | 'trend' | 'event' | 'technology';
  sourceId: EntityId;
  value: number;
  expiresAt?: number;
}

/** Contract types for B2B trading */
export enum ContractType {
  SpotMarket = 'spot', // Immediate delivery at current price
  Forward = 'forward', // Future delivery at agreed price
  LongTerm = 'long_term', // Recurring delivery over time
  Exclusive = 'exclusive', // Exclusive supplier agreement
}

/** B2B contract between companies */
export interface Contract {
  id: EntityId;
  type: ContractType;
  buyerId: EntityId;
  sellerId: EntityId;
  goodsId: EntityId;
  
  // Terms
  pricePerUnit: Money;
  quantityPerDelivery: number;
  minQuality: QualityLevel;
  
  // Schedule (for recurring contracts)
  deliveryIntervalTicks?: number;
  totalDeliveries?: number;
  completedDeliveries: number;
  
  // Penalties
  latePenaltyPercent: Percentage;
  qualityPenaltyPercent: Percentage;
  breakPenalty: Money;
  
  // Status
  status: ContractStatus;
  negotiatedAt: Timestamp;
  startsAt: Timestamp;
  expiresAt?: Timestamp;
  
  // Negotiation history (for LLM context)
  negotiationLog?: NegotiationMessage[];
}

export enum ContractStatus {
  Negotiating = 'negotiating',
  PendingApproval = 'pending_approval',
  Active = 'active',
  Completed = 'completed',
  Breached = 'breached',
  Cancelled = 'cancelled',
}

export interface NegotiationMessage {
  senderId: EntityId;
  message: string;
  timestamp: Timestamp;
  proposedTerms?: Partial<Contract>;
}

/** Market trend detected by LLM */
export interface MarketTrend {
  id: EntityId;
  name: string;
  description: string;
  
  // Affected goods and needs
  affectedGoodsIds: EntityId[];
  affectedNeedGroupIds: EntityId[];
  
  // Impact
  demandMultiplier: number;
  priceMultiplier: number;
  newTags?: { goodsId: EntityId; tagId: EntityId }[];
  removedTags?: { goodsId: EntityId; tagId: EntityId }[];
  
  // Timing
  startTick: number;
  peakTick: number;
  endTick?: number;
  intensity: number; // 0-1
  
  // Source
  sourceEventId?: EntityId;
  llmGenerated: boolean;
}

/** Pop group representing city inhabitants */
export interface PopGroup {
  id: EntityId;
  name: string;
  population: number;
  
  // Demographics
  wealthLevel: 'poor' | 'middle' | 'wealthy' | 'elite';
  ageGroup: 'young' | 'adult' | 'senior';
  
  // Preferences (modified by LLM)
  needPriorities: Record<NeedCategory, number>;
  brandLoyalty: Record<EntityId, number>; // Company ID -> loyalty
  tagPreferences: Record<EntityId, number>; // Tag ID -> preference
  
  // Satisfaction
  needSatisfaction: Record<NeedCategory, Percentage>;
  overallHappiness: Percentage;
  
  // Consumption
  weeklyBudget: Money;
  consumptionHistory: ConsumptionRecord[];
}

export interface ConsumptionRecord {
  tick: number;
  goodsId: EntityId;
  quantity: number;
  totalSpent: Money;
  satisfaction: number;
}