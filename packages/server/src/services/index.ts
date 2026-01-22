/**
 * Service exports
 */

export { LLMService, llmService } from './llm.js';
export type {
  ChatContext,
  MarketAnalysisRequest,
  TechnologyEvaluationRequest,
  NegotiationContext,
  StrategicPlan,
  StrategicAnalysisRequest,
} from './llm.js';

export { AICompanyManager, aiCompanyManager } from './aiCompanyManager.js';
export type {
  AICompanyState,
  AIGoal,
  AIInteractionRecord,
  AIActionRecord,
  CompetitionEvent,
  GameContext,
} from './aiCompanyManager.js';

export { ResearchService, researchService } from './researchService.js';
export type {
  ResearchState,
  CreateResearchRequest,
  EvaluationResult,
  TechnologyResult,
} from './researchService.js';

export { gameLoop } from './gameLoop.js';
export type {
  GameState,
  BuildingInstance,
  SupplyDemandData,
  PriceHistoryEntry,
  BuildingProfit,
  FinancialSummary,
  TickUpdate,
} from './gameLoop.js';

export { TechnologyEffectManager, technologyEffectManager } from './technologyEffectManager.js';
export type {
  TechnologyModifier,
  ProductionMethodUnlock,
  ActiveTechnology,
  BuildingModifiers,
} from './technologyEffectManager.js';