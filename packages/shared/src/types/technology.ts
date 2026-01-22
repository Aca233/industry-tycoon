/**
 * Technology and research system types
 * Extended for Phase 18: LLM-driven Research System
 */

import { type EntityId, type GameTick, type Money, type Timestamp } from './common.js';
import { type ProductionMethod } from './production.js';

// ============================================
// Risk and Side Effect Types
// ============================================

/** Risk level for research projects */
export type RiskLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';

/** Side effect type categories */
export type SideEffectType = 'health' | 'environment' | 'social' | 'economic';

/** Side effect severity (1 = minor, 5 = catastrophic) */
export type SideEffectSeverity = 1 | 2 | 3 | 4 | 5;

/** Technology status */
export enum TechnologyStatus {
  Unknown = 'unknown', // Not yet conceived
  Conceptualized = 'conceptualized', // Someone has the idea
  Researching = 'researching', // Actively being researched
  Discovered = 'discovered', // Research complete
  Patented = 'patented', // Has patent protection
  PublicDomain = 'public_domain', // Anyone can use
  Obsolete = 'obsolete', // Replaced by better tech
}

/** Technology definition - can be LLM generated */
export interface Technology {
  id: EntityId;
  name: string;
  nameZh: string;
  description: string;
  
  // Generation info
  isLLMGenerated: boolean;
  generatedFromPrompt?: string;
  generatedAt?: Timestamp;
  
  // Research requirements
  researchCost: Money;
  researchTicks: number;
  prerequisites: EntityId[]; // Other tech IDs needed first
  
  // What it unlocks
  unlockedMethods: ProductionMethod[];
  unlockedBuildings: EntityId[];
  unlockedGoods: EntityId[];
  
  // Effects when researched
  globalModifiers: TechnologyModifier[];
  
  // Patent info
  patentHolderId?: EntityId;
  patentExpiresAt?: Timestamp;
  licenseFee?: Money;
  
  // Side effects (LLM can add these)
  sideEffects?: TechnologySideEffect[];
  
  // Metadata
  category: TechnologyCategory;
  tier: number; // 1-5, higher = more advanced
  icon: string;
}

export enum TechnologyCategory {
  Manufacturing = 'manufacturing',
  Materials = 'materials',
  Energy = 'energy',
  Computing = 'computing',
  Biotech = 'biotech',
  Logistics = 'logistics',
  Marketing = 'marketing',
  Finance = 'finance',
}

export interface TechnologyModifier {
  targetType: 'building' | 'goods' | 'production_method' | 'global';
  targetId?: EntityId;
  modifierType: string;
  value: number;
  isMultiplier: boolean;
}

export interface TechnologySideEffect {
  id: EntityId;
  name: string;
  description: string;
  
  // Categorization
  type: SideEffectType;
  severity: SideEffectSeverity;
  
  // Trigger mechanism
  triggerCondition: string; // LLM evaluates this
  probability: number; // 0-1
  delayTicks: GameTick; // How many ticks after tech is used before it triggers
  
  // State
  triggered: boolean;
  triggeredAt?: GameTick;
  revealed: boolean; // Whether the side effect has been discovered
  revealedAt?: Timestamp;
  
  // Effects when triggered
  effect: SideEffectOutcome;
}

export interface SideEffectOutcome {
  type: 'positive' | 'negative' | 'mixed';
  
  // Market impacts
  affectedGoods?: EntityId[];
  affectedPopGroups?: EntityId[];
  marketImpact?: {
    goodsId: EntityId;
    demandChange: number; // percentage
    priceChange: number; // percentage
  }[];
  
  // Company impacts
  reputationImpact?: number; // -100 to 100
  lawsuitRisk?: number; // 0-1 probability
  lawsuitCost?: Money; // potential lawsuit cost
  
  // Event generation
  newsHeadline?: string;
  newsDescription?: string;
  
  // Regulatory response
  regulatoryFine?: Money;
  productRecall?: boolean; // forces recall of products using this tech
}

/** Research project being conducted */
export interface ResearchProject {
  id: EntityId;
  companyId: EntityId;
  technologyId?: EntityId; // If researching existing tech
  
  // Concept definition (for custom/LLM research)
  concept: ResearchConcept;
  
  // Feasibility evaluation (from LLM)
  feasibility?: FeasibilityEvaluation;
  
  // Progress
  status: ResearchStatus;
  progress: number; // 0-100
  investedFunds: Money;
  targetCost: Money; // Total cost needed
  startedAt?: GameTick;
  completedAt?: GameTick;
  
  // Team
  leadScientistId?: EntityId;
  researcherCount: number;
  
  // LLM feedback during research
  llmPredictions?: ResearchPrediction[];
  
  // Result
  resultTechnologyId?: EntityId;
}

/** Concept description for a research project */
export interface ResearchConcept {
  name: string;
  description: string;
  targetOutcome?: string | undefined;
  constraints?: string[] | undefined;
  originalPrompt: string;
}

/** LLM evaluation of research feasibility */
export interface FeasibilityEvaluation {
  score: number; // 0-100
  estimatedCost: Money;
  estimatedTicks: GameTick;
  prerequisites: string[];
  risks: string[];
  riskLevel: RiskLevel;
  scientistComment: string;
  keywordAnalysis: string[];
  evaluatedAt: Timestamp;
}

export enum ResearchStatus {
  Planning = 'planning',
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export interface ResearchPrediction {
  tick: GameTick;
  prediction: string;
  confidence: number;
  warnings: string[];
  breakthroughChance?: number; // chance of early completion
}

// ============================================
// Production Method Unlocks
// ============================================

/** Defines a new production method unlocked by technology */
export interface ProductionMethodUnlock {
  buildingType: EntityId;
  slotName: string;
  newOption: {
    id: EntityId;
    name: string;
    nameZh: string;
    description: string;
    inputs: Record<EntityId, number>;
    outputs: Record<EntityId, number>;
    modifiers: {
      throughput?: number;
      quality?: number;
      efficiency?: number;
      laborMultiplier?: number;
      energyMultiplier?: number;
    };
  };
}

// ============================================
// LLM Generation Types
// ============================================

/** Request for LLM to evaluate a research concept */
export interface ResearchEvaluationRequest {
  projectName: string;
  description: string;
  constraints?: string[] | undefined;
  companyContext?: {
    existingTechnologies: string[];
    cash: Money;
    researchCapacity: number;
  } | undefined;
  gameContext?: {
    currentYear: number;
    marketTrends: string[];
  } | undefined;
}

/** Response from LLM for research evaluation */
export interface ResearchEvaluationResponse {
  feasibilityScore: number;
  estimatedCost: number;
  estimatedMonths: number;
  prerequisites: string[];
  risks: string[];
  scientistComment: string;
  keywordAnalysis: string[];
  riskLevel: RiskLevel;
}

/** Request for LLM to generate a completed technology */
export interface TechnologyGenerationRequest {
  concept: ResearchConcept;
  feasibility: FeasibilityEvaluation;
  investedFunds: Money;
  researchDuration: GameTick;
  breakthroughs?: string[];
}

/** Response from LLM for technology generation */
export interface TechnologyGenerationResponse {
  name: string;
  nameZh: string;
  description: string;
  category: TechnologyCategory;
  tier: number;
  
  productionMethods: ProductionMethodUnlock[];
  
  sideEffects: Array<{
    type: SideEffectType;
    description: string;
    severity: SideEffectSeverity;
    triggerCondition: string;
    delayMonths: number;
    probability: number;
  }>;
  
  marketTags: string[];
  globalModifiers?: TechnologyModifier[];
}

/** Blueprint generated from completed research */
export interface Blueprint {
  id: EntityId;
  technologyId: EntityId;
  ownerId: EntityId;
  
  // What this blueprint enables
  type: 'building' | 'production_method' | 'goods';
  targetDefinition: unknown; // The actual definition object
  
  // Usage rights
  isExclusive: boolean;
  licensees: EntityId[];
  
  createdAt: Timestamp;
}

/** Technology constellation node for visualization */
export interface TechConstellationNode {
  technologyId: EntityId;
  position: { x: number; y: number; z: number };
  discovered: boolean;
  discoveredBy?: EntityId;
  discoveredAt?: GameTick;
  connections: EntityId[]; // Connected tech IDs
  brightness: number; // 0-1, how "lit up" it appears
  isPlayerInvented: boolean;
}

// ============================================
// Patent System Types
// ============================================

/** Patent information for a technology */
export interface Patent {
  id: EntityId;
  technologyId: EntityId;
  holderId: EntityId;
  
  // Timeline
  grantedAt: GameTick;
  expiresAt: GameTick;
  
  // Licensing
  isExclusive: boolean;
  licensees: EntityId[];
  licenseFee: Money; // per-use fee
  
  // Status
  status: PatentStatus;
  challengedBy?: EntityId[];
}

export enum PatentStatus {
  Active = 'active',
  Expired = 'expired',
  Challenged = 'challenged',
  Invalidated = 'invalidated',
}

/** Request to license a patented technology */
export interface LicenseRequest {
  id: EntityId;
  patentId: EntityId;
  requesterId: EntityId;
  proposedFee?: Money;
  proposedTerms?: string;
  status: LicenseRequestStatus;
  createdAt: GameTick;
  respondedAt?: GameTick;
}

export enum LicenseRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Negotiating = 'negotiating',
  Withdrawn = 'withdrawn',
}

// ============================================
// Research Events
// ============================================

/** Events that can occur during research */
export interface ResearchEvent {
  id: EntityId;
  projectId: EntityId;
  tick: GameTick;
  type: ResearchEventType;
  title: string;
  description: string;
  effect?: {
    progressBonus?: number;
    costReduction?: number;
    riskChange?: number;
    newPrediction?: ResearchPrediction;
  };
}

export enum ResearchEventType {
  Breakthrough = 'breakthrough',
  Setback = 'setback',
  Discovery = 'discovery',
  Complication = 'complication',
  Milestone = 'milestone',
  ResourceShortage = 'resource_shortage',
}