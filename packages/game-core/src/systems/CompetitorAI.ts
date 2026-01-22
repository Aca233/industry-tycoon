/**
 * CompetitorAI - AI competitor system using GOAP (Goal-Oriented Action Planning)
 * Implements AI personalities and decision-making
 */

import {
  type EntityId,
  type GameTick,
  type Company,
  type InteractionRecord,
  AIPersonality,
  CompanyType,
  InteractionType,
  AI_CONSTANTS,
} from '@scc/shared';
import { type GameSubsystem, GameEngine } from '../engine/GameEngine.js';

/** AI Goal types */
export enum AIGoalType {
  MaximizeProfit = 'maximize_profit',
  IncreaseMarketShare = 'increase_market_share',
  ReduceCosts = 'reduce_costs',
  AcquireResources = 'acquire_resources',
  DefendPosition = 'defend_position',
  AttackCompetitor = 'attack_competitor',
  ResearchTechnology = 'research_technology',
  ImproveReputation = 'improve_reputation',
}

/** AI Goal with priority and progress */
export interface AIGoal {
  type: AIGoalType;
  priority: number;
  targetValue?: number;
  currentValue?: number;
  targetEntityId?: EntityId;
  deadline?: GameTick;
}

/** Action that AI can take */
export interface AIAction {
  type: AIActionType;
  cost: number;
  benefit: number;
  preconditions: AICondition[];
  effects: AIEffect[];
  targetEntityId?: EntityId;
  parameters?: Record<string, unknown>;
}

export enum AIActionType {
  // Production
  ExpandProduction = 'expand_production',
  SwitchProductionMethod = 'switch_production_method',
  BuildNewFactory = 'build_new_factory',
  CloseFactory = 'close_factory',
  ReduceCosts = 'reduce_costs',
  
  // Market
  LowerPrices = 'lower_prices',
  RaisePrices = 'raise_prices',
  CreateListing = 'create_listing',
  SignContract = 'sign_contract',
  BreakContract = 'break_contract',
  
  // Competition
  StartPriceWar = 'start_price_war',
  BuyOutCompetitor = 'buy_out_competitor',
  PoachEmployee = 'poach_employee',
  LaunchMediaCampaign = 'launch_media_campaign',
  
  // Resources
  SecureSupply = 'secure_supply',
  StockpileResources = 'stockpile_resources',
  
  // Research
  InvestInResearch = 'invest_in_research',
  LicenseTechnology = 'license_technology',
  
  // Finance
  TakeLoan = 'take_loan',
  PayDividend = 'pay_dividend',
  
  // Reputation
  ImproveReputation = 'improve_reputation',
}

/** Condition for action to be available */
interface AICondition {
  type: 'has_cash' | 'has_building' | 'has_reputation' | 'market_condition' | 'relationship';
  value: number | string;
  operator: '>' | '<' | '=' | '>=' | '<=';
}

/** Effect of an action */
interface AIEffect {
  type: 'cash' | 'reputation' | 'market_share' | 'relationship' | 'production';
  change: number;
  targetId?: EntityId;
}

/** AI decision result */
export interface AIDecision {
  companyId: EntityId;
  tick: GameTick;
  goal: AIGoal;
  action: AIAction;
  reasoning: string;
  expectedOutcome: string;
}

/**
 * Competitor AI subsystem
 * Uses GOAP to plan and execute AI company strategies
 */
export class CompetitorAI implements GameSubsystem {
  readonly name = 'CompetitorAI';
  
  private engine: GameEngine | null = null;
  
  // AI state
  private companies: Map<EntityId, Company> = new Map();
  private aiGoals: Map<EntityId, AIGoal[]> = new Map();
  private pendingDecisions: AIDecision[] = [];
  private lastDecisionTick: Map<EntityId, GameTick> = new Map();

  async initialize(engine: GameEngine): Promise<void> {
    this.engine = engine;
    
    const state = engine.getState();
    if (state) {
      // Filter only AI companies
      for (const [id, company] of state.entities.companies) {
        if (company.type === CompanyType.AICompetitor) {
          this.companies.set(id, company);
          this.initializeAIGoals(company);
        }
      }
    }
  }

  update(tick: GameTick, _deltaTime: number): void {
    // Process each AI company
    for (const [companyId, company] of this.companies) {
      const lastTick = this.lastDecisionTick.get(companyId) ?? 0;
      
      // Make decisions at intervals based on personality
      const decisionInterval = this.getDecisionInterval(company.personality);
      if (tick - lastTick >= decisionInterval) {
        this.processAITurn(company, tick);
        this.lastDecisionTick.set(companyId, tick);
      }
    }
    
    // Execute pending decisions
    this.executePendingDecisions(tick);
  }

  cleanup(): void {
    this.engine = null;
    this.companies.clear();
    this.aiGoals.clear();
    this.pendingDecisions = [];
    this.lastDecisionTick.clear();
  }

  /**
   * Initialize goals based on AI personality
   */
  private initializeAIGoals(company: Company): void {
    const goals: AIGoal[] = [];
    
    switch (company.personality) {
      case AIPersonality.Monopolist:
        goals.push(
          { type: AIGoalType.IncreaseMarketShare, priority: 10 },
          { type: AIGoalType.AcquireResources, priority: 8 },
          { type: AIGoalType.AttackCompetitor, priority: 6 }
        );
        break;
        
      case AIPersonality.TrendSurfer:
        goals.push(
          { type: AIGoalType.MaximizeProfit, priority: 8 },
          { type: AIGoalType.ResearchTechnology, priority: 7 },
          { type: AIGoalType.ImproveReputation, priority: 5 }
        );
        break;
        
      case AIPersonality.OldMoney:
        goals.push(
          { type: AIGoalType.DefendPosition, priority: 10 },
          { type: AIGoalType.ImproveReputation, priority: 8 },
          { type: AIGoalType.MaximizeProfit, priority: 6 }
        );
        break;
        
      case AIPersonality.Innovator:
        goals.push(
          { type: AIGoalType.ResearchTechnology, priority: 10 },
          { type: AIGoalType.IncreaseMarketShare, priority: 7 },
          { type: AIGoalType.MaximizeProfit, priority: 5 }
        );
        break;
        
      case AIPersonality.CostLeader:
        goals.push(
          { type: AIGoalType.ReduceCosts, priority: 10 },
          { type: AIGoalType.IncreaseMarketShare, priority: 8 },
          { type: AIGoalType.MaximizeProfit, priority: 7 }
        );
        break;
        
      default:
        goals.push(
          { type: AIGoalType.MaximizeProfit, priority: 8 },
          { type: AIGoalType.DefendPosition, priority: 6 }
        );
    }
    
    this.aiGoals.set(company.id, goals);
  }

  /**
   * Get decision interval based on personality
   */
  private getDecisionInterval(personality?: AIPersonality): number {
    switch (personality) {
      case AIPersonality.TrendSurfer:
        return AI_CONSTANTS.AI_DECISION_INTERVAL / 2; // More reactive
      case AIPersonality.OldMoney:
        return AI_CONSTANTS.AI_DECISION_INTERVAL * 2; // More deliberate
      default:
        return AI_CONSTANTS.AI_DECISION_INTERVAL;
    }
  }

  /**
   * Process AI turn - select and queue action
   */
  private processAITurn(company: Company, tick: GameTick): void {
    const goals = this.aiGoals.get(company.id) ?? [];
    if (goals.length === 0) return;
    
    // Update goal progress
    this.updateGoalProgress(company, goals);
    
    // Select highest priority unfulfilled goal
    const sortedGoals = [...goals].sort((a, b) => {
      const progressA = this.calculateGoalProgress(a);
      const progressB = this.calculateGoalProgress(b);
      // Prioritize goals that are less complete and higher priority
      return (b.priority * (1 - progressB)) - (a.priority * (1 - progressA));
    });
    
    const targetGoal = sortedGoals[0];
    if (!targetGoal) return;
    
    // Generate possible actions using GOAP
    const possibleActions = this.generateActionsForGoal(company, targetGoal);
    
    // Select best action
    const bestAction = this.selectBestAction(company, possibleActions);
    
    if (bestAction) {
      const decision: AIDecision = {
        companyId: company.id,
        tick,
        goal: targetGoal,
        action: bestAction,
        reasoning: this.generateReasoning(company, targetGoal, bestAction),
        expectedOutcome: this.generateExpectedOutcome(bestAction),
      };
      
      this.pendingDecisions.push(decision);
    }
  }

  /**
   * Update goal progress based on current state
   */
  private updateGoalProgress(company: Company, goals: AIGoal[]): void {
    for (const goal of goals) {
      switch (goal.type) {
        case AIGoalType.MaximizeProfit:
          goal.currentValue = company.cash;
          goal.targetValue = goal.targetValue ?? company.cash * 1.5;
          break;
          
        case AIGoalType.ImproveReputation:
          goal.currentValue = company.publicReputation;
          goal.targetValue = 90;
          break;
          
        case AIGoalType.ReduceCosts:
          // Would need building data
          goal.currentValue = 0;
          goal.targetValue = goal.targetValue ?? 0;
          break;
          
        // Other goals would need more context
      }
    }
  }

  /**
   * Calculate goal completion progress (0-1)
   */
  private calculateGoalProgress(goal: AIGoal): number {
    if (!goal.targetValue || !goal.currentValue) return 0;
    return Math.min(1, goal.currentValue / goal.targetValue);
  }

  /**
   * Generate possible actions for a goal using GOAP
   */
  private generateActionsForGoal(company: Company, goal: AIGoal): AIAction[] {
    const actions: AIAction[] = [];
    
    switch (goal.type) {
      case AIGoalType.MaximizeProfit:
        actions.push(
          this.createAction(AIActionType.RaisePrices, 0, 1000, company),
          this.createAction(AIActionType.ExpandProduction, 50000, 5000, company),
          this.createAction(AIActionType.ReduceCosts, 0, 2000, company)
        );
        break;
        
      case AIGoalType.IncreaseMarketShare:
        actions.push(
          this.createAction(AIActionType.LowerPrices, 2000, 3000, company),
          this.createAction(AIActionType.BuildNewFactory, 100000, 8000, company),
          this.createAction(AIActionType.StartPriceWar, 10000, 5000, company)
        );
        break;
        
      case AIGoalType.AttackCompetitor:
        actions.push(
          this.createAction(AIActionType.StartPriceWar, 10000, 4000, company),
          this.createAction(AIActionType.PoachEmployee, 20000, 3000, company),
          this.createAction(AIActionType.LaunchMediaCampaign, 15000, 2000, company)
        );
        break;
        
      case AIGoalType.DefendPosition:
        actions.push(
          this.createAction(AIActionType.SecureSupply, 30000, 4000, company),
          this.createAction(AIActionType.SignContract, 0, 3000, company),
          this.createAction(AIActionType.ImproveReputation, 5000, 2000, company)
        );
        break;
        
      case AIGoalType.ResearchTechnology:
        actions.push(
          this.createAction(AIActionType.InvestInResearch, 50000, 6000, company),
          this.createAction(AIActionType.LicenseTechnology, 30000, 4000, company)
        );
        break;
        
      case AIGoalType.ReduceCosts:
        actions.push(
          this.createAction(AIActionType.SwitchProductionMethod, 5000, 3000, company),
          this.createAction(AIActionType.CloseFactory, 0, 2000, company)
        );
        break;
    }
    
    // Filter by preconditions
    return actions.filter((action) => this.checkPreconditions(company, action));
  }

  /**
   * Create an action with cost/benefit analysis
   */
  private createAction(
    type: AIActionType,
    cost: number,
    benefit: number,
    company: Company
  ): AIAction {
    return {
      type,
      cost,
      benefit,
      preconditions: this.getActionPreconditions(type, company),
      effects: this.getActionEffects(type),
    };
  }

  /**
   * Get preconditions for an action
   */
  private getActionPreconditions(type: AIActionType, _company: Company): AICondition[] {
    const conditions: AICondition[] = [];
    
    switch (type) {
      case AIActionType.BuildNewFactory:
        conditions.push({ type: 'has_cash', value: 100000, operator: '>=' });
        break;
        
      case AIActionType.BuyOutCompetitor:
        conditions.push({ type: 'has_cash', value: 500000, operator: '>=' });
        conditions.push({ type: 'has_reputation', value: 50, operator: '>=' });
        break;
        
      case AIActionType.TakeLoan:
        conditions.push({ type: 'has_reputation', value: 30, operator: '>=' });
        break;
        
      case AIActionType.LaunchMediaCampaign:
        conditions.push({ type: 'has_cash', value: 15000, operator: '>=' });
        break;
    }
    
    return conditions;
  }

  /**
   * Get effects of an action
   */
  private getActionEffects(type: AIActionType): AIEffect[] {
    const effects: AIEffect[] = [];
    
    switch (type) {
      case AIActionType.LowerPrices:
        effects.push({ type: 'market_share', change: 5 });
        effects.push({ type: 'cash', change: -2000 });
        break;
        
      case AIActionType.RaisePrices:
        effects.push({ type: 'market_share', change: -2 });
        effects.push({ type: 'cash', change: 3000 });
        break;
        
      case AIActionType.LaunchMediaCampaign:
        effects.push({ type: 'reputation', change: 10 });
        effects.push({ type: 'cash', change: -15000 });
        break;
        
      case AIActionType.StartPriceWar:
        effects.push({ type: 'market_share', change: 10 });
        effects.push({ type: 'cash', change: -20000 });
        effects.push({ type: 'relationship', change: -30 });
        break;
    }
    
    return effects;
  }

  /**
   * Check if action preconditions are met
   */
  private checkPreconditions(company: Company, action: AIAction): boolean {
    for (const condition of action.preconditions) {
      let value: number;
      
      switch (condition.type) {
        case 'has_cash':
          value = company.cash;
          break;
        case 'has_reputation':
          value = company.publicReputation;
          break;
        default:
          continue;
      }
      
      const target = typeof condition.value === 'number' ? condition.value : 0;
      
      switch (condition.operator) {
        case '>':
          if (!(value > target)) return false;
          break;
        case '>=':
          if (!(value >= target)) return false;
          break;
        case '<':
          if (!(value < target)) return false;
          break;
        case '<=':
          if (!(value <= target)) return false;
          break;
        case '=':
          if (!(value === target)) return false;
          break;
      }
    }
    
    return true;
  }

  /**
   * Select best action based on cost/benefit and personality
   */
  private selectBestAction(company: Company, actions: AIAction[]): AIAction | null {
    if (actions.length === 0) return null;
    
    // Score each action
    const scored = actions.map((action) => {
      let score = action.benefit - action.cost * 0.5;
      
      // Personality adjustments
      switch (company.personality) {
        case AIPersonality.Monopolist:
          if (action.type === AIActionType.StartPriceWar) score *= 1.5;
          if (action.type === AIActionType.BuyOutCompetitor) score *= 2;
          break;
          
        case AIPersonality.OldMoney:
          if (action.type === AIActionType.StartPriceWar) score *= 0.3;
          if (action.type === AIActionType.LaunchMediaCampaign) score *= 0.5;
          break;
          
        case AIPersonality.Innovator:
          if (action.type === AIActionType.InvestInResearch) score *= 2;
          break;
          
        case AIPersonality.CostLeader:
          if (action.type === AIActionType.ReduceCosts) score *= 1.5;
          if (action.type === AIActionType.LowerPrices) score *= 1.3;
          break;
      }
      
      return { action, score };
    });
    
    // Sort by score and return best
    scored.sort((a, b) => b.score - a.score);
    
    // Add some randomness (20% chance to pick second best)
    if (scored.length > 1 && Math.random() < 0.2) {
      return scored[1]?.action ?? scored[0]?.action ?? null;
    }
    
    return scored[0]?.action ?? null;
  }

  /**
   * Generate reasoning text for decision (for LLM/UI)
   */
  private generateReasoning(company: Company, goal: AIGoal, action: AIAction): string {
    const personalityDesc = this.getPersonalityDescription(company.personality);
    const goalDesc = this.getGoalDescription(goal.type);
    const actionDesc = this.getActionDescription(action.type);
    
    return `As a ${personalityDesc} company, our primary focus is ${goalDesc}. ` +
           `After analyzing the market conditions, we decided to ${actionDesc}.`;
  }

  /**
   * Generate expected outcome text
   */
  private generateExpectedOutcome(action: AIAction): string {
    const effects = action.effects.map((e) => {
      const sign = e.change >= 0 ? '+' : '';
      return `${e.type}: ${sign}${e.change}`;
    });
    
    return `Expected effects: ${effects.join(', ')}`;
  }

  /**
   * Get personality description
   */
  private getPersonalityDescription(personality?: AIPersonality): string {
    switch (personality) {
      case AIPersonality.Monopolist:
        return 'aggressive market-dominating';
      case AIPersonality.TrendSurfer:
        return 'trend-following adaptive';
      case AIPersonality.OldMoney:
        return 'conservative quality-focused';
      case AIPersonality.Innovator:
        return 'innovation-driven';
      case AIPersonality.CostLeader:
        return 'efficiency-obsessed';
      default:
        return 'balanced';
    }
  }

  /**
   * Get goal description
   */
  private getGoalDescription(type: AIGoalType): string {
    switch (type) {
      case AIGoalType.MaximizeProfit:
        return 'maximizing profits';
      case AIGoalType.IncreaseMarketShare:
        return 'growing market share';
      case AIGoalType.ReduceCosts:
        return 'reducing operational costs';
      case AIGoalType.AttackCompetitor:
        return 'weakening competitors';
      case AIGoalType.DefendPosition:
        return 'defending our market position';
      case AIGoalType.ResearchTechnology:
        return 'technological advancement';
      case AIGoalType.ImproveReputation:
        return 'building our reputation';
      default:
        return 'strategic growth';
    }
  }

  /**
   * Get action description
   */
  private getActionDescription(type: AIActionType): string {
    switch (type) {
      case AIActionType.LowerPrices:
        return 'lower our prices to attract more customers';
      case AIActionType.RaisePrices:
        return 'increase our prices to improve margins';
      case AIActionType.BuildNewFactory:
        return 'construct a new production facility';
      case AIActionType.StartPriceWar:
        return 'initiate aggressive price competition';
      case AIActionType.InvestInResearch:
        return 'increase R&D spending';
      case AIActionType.LaunchMediaCampaign:
        return 'launch a public relations campaign';
      default:
        return 'take strategic action';
    }
  }

  /**
   * Execute pending decisions
   */
  private executePendingDecisions(tick: GameTick): void {
    for (const decision of this.pendingDecisions) {
      // Execute the action
      this.executeAction(decision);
      
      // Record interaction
      const company = this.companies.get(decision.companyId);
      if (company) {
        const interaction: InteractionRecord = {
          tick,
          type: this.actionToInteractionType(decision.action.type),
          description: decision.reasoning,
          outcome: 'neutral',
        };
        company.interactionHistory.push(interaction);
        
        // Trim history
        if (company.interactionHistory.length > AI_CONSTANTS.AI_MEMORY_SIZE) {
          company.interactionHistory = company.interactionHistory.slice(-AI_CONSTANTS.AI_MEMORY_SIZE);
        }
      }
    }
    
    this.pendingDecisions = [];
  }

  /**
   * Execute a specific action
   */
  private executeAction(decision: AIDecision): void {
    const company = this.companies.get(decision.companyId);
    if (!company) return;
    
    // Apply action effects
    for (const effect of decision.action.effects) {
      switch (effect.type) {
        case 'cash':
          company.cash += effect.change;
          break;
        case 'reputation':
          company.publicReputation = Math.max(0, Math.min(100, 
            company.publicReputation + effect.change));
          break;
        // Other effects would need more complex handling
      }
    }
    
    // Deduct action cost
    company.cash -= decision.action.cost;
  }

  /**
   * Map action type to interaction type
   */
  private actionToInteractionType(actionType: AIActionType): InteractionType {
    switch (actionType) {
      case AIActionType.SignContract:
        return InteractionType.ContractSigned;
      case AIActionType.BreakContract:
        return InteractionType.ContractBreached;
      case AIActionType.StartPriceWar:
        return InteractionType.PriceWar;
      case AIActionType.BuyOutCompetitor:
        return InteractionType.Acquisition;
      case AIActionType.PoachEmployee:
        return InteractionType.TalentPoaching;
      case AIActionType.LaunchMediaCampaign:
        return InteractionType.MediaAttack;
      default:
        return InteractionType.Negotiation;
    }
  }

  /**
   * Get recent decisions for a company (for UI/debugging)
   */
  getRecentDecisions(companyId: EntityId, count: number = 10): AIDecision[] {
    return this.pendingDecisions
      .filter((d) => d.companyId === companyId)
      .slice(-count);
  }

  /**
   * Get AI goals for a company
   */
  getCompanyGoals(companyId: EntityId): AIGoal[] {
    return this.aiGoals.get(companyId) ?? [];
  }

  /**
   * Adjust relationship based on player action
   */
  adjustRelationship(
    companyId: EntityId,
    targetCompanyId: EntityId,
    change: number,
    reason: string
  ): void {
    const company = this.companies.get(companyId);
    if (!company) return;
    
    const relationship = company.relationships.find(
      (r) => r.targetCompanyId === targetCompanyId
    );
    
    if (relationship) {
      relationship.trust = Math.max(-100, Math.min(100, relationship.trust + change));
      relationship.notes.push(reason);
      relationship.lastInteraction = this.engine?.getCurrentTick() ?? 0;
    }
  }
}