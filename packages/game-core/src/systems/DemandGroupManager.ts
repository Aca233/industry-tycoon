/**
 * DemandGroupManager - Manages population needs and consumption
 * Implements the Victoria 3-style "Need Groups" system
 */

import {
  type EntityId,
  type GameTick,
  type Money,
  type NeedGroup,
  type PopGroup,
  type GoodsDefinition,
  type ConsumptionRecord,
  NeedCategory,
  QualityLevel,
} from '@scc/shared';
import { type GameSubsystem, GameEngine } from '../engine/GameEngine.js';
import { type MarketSimulator } from './MarketSimulator.js';

/** Consumption calculation result */
export interface ConsumptionResult {
  popGroupId: EntityId;
  tick: GameTick;
  needSatisfaction: Record<NeedCategory, number>;
  totalSpent: Money;
  goodsConsumed: Array<{
    goodsId: EntityId;
    quantity: number;
    price: Money;
    satisfaction: number;
  }>;
  unmetNeeds: NeedCategory[];
}

/** Pop consumption preferences */
interface ConsumptionPreference {
  goodsId: EntityId;
  weight: number;
  utility: number;
}

/**
 * Demand Group Manager subsystem
 * Calculates POP demand and consumption patterns
 */
export class DemandGroupManager implements GameSubsystem {
  readonly name = 'DemandGroupManager';
  
  private marketSimulator: MarketSimulator | null = null;
  
  // Data
  private needGroups: Map<EntityId, NeedGroup> = new Map();
  private popGroups: Map<EntityId, PopGroup> = new Map();
  private goodsDefinitions: Map<EntityId, GoodsDefinition> = new Map();
  
  // Cache for consumption preferences (recalculated periodically)
  private preferenceCache: Map<EntityId, Map<NeedCategory, ConsumptionPreference[]>> = new Map();
  private lastPreferenceUpdate: GameTick = 0;
  private readonly PREFERENCE_UPDATE_INTERVAL = 24; // Update daily

  async initialize(engine: GameEngine): Promise<void> {
    this.marketSimulator = engine.getSubsystem<MarketSimulator>('MarketSimulator') ?? null;
    
    const state = engine.getState();
    if (state) {
      this.needGroups = state.definitions.needGroups;
      this.goodsDefinitions = state.definitions.goods;
      this.popGroups = state.entities.popGroups;
    }
  }

  update(tick: GameTick, _deltaTime: number): void {
    // Update preference cache periodically
    if (tick - this.lastPreferenceUpdate >= this.PREFERENCE_UPDATE_INTERVAL) {
      this.updatePreferenceCache();
      this.lastPreferenceUpdate = tick;
    }
    
    // Process consumption for all pop groups (weekly)
    if (tick % 168 === 0) {
      for (const popGroup of this.popGroups.values()) {
        this.processConsumption(popGroup, tick);
      }
    }
  }

  cleanup(): void {
    this.marketSimulator = null;
    this.needGroups.clear();
    this.popGroups.clear();
    this.goodsDefinitions.clear();
    this.preferenceCache.clear();
  }

  /**
   * Update the consumption preference cache for all pop groups
   */
  private updatePreferenceCache(): void {
    this.preferenceCache.clear();
    
    for (const popGroup of this.popGroups.values()) {
      const groupPreferences = new Map<NeedCategory, ConsumptionPreference[]>();
      
      for (const [_needId, needGroup] of this.needGroups) {
        const preferences = this.calculatePreferencesForNeed(popGroup, needGroup);
        groupPreferences.set(needGroup.category, preferences);
      }
      
      this.preferenceCache.set(popGroup.id, groupPreferences);
    }
  }

  /**
   * Calculate consumption preferences for a pop group and need
   */
  private calculatePreferencesForNeed(
    popGroup: PopGroup,
    needGroup: NeedGroup
  ): ConsumptionPreference[] {
    const preferences: ConsumptionPreference[] = [];
    
    if (!this.marketSimulator) return preferences;
    
    // Get all goods that can satisfy this need
    const goodsForNeed = this.marketSimulator.getGoodsForNeed(needGroup.id);
    
    for (const goodsId of goodsForNeed) {
      const goods = this.goodsDefinitions.get(goodsId);
      if (!goods) continue;
      
      // Calculate weight based on utility, price, and pop preferences
      const weight = this.marketSimulator.calculatePurchaseWeight(
        goodsId,
        needGroup.id,
        this.getPopQualityPreference(popGroup),
        new Map(Object.entries(popGroup.tagPreferences))
      );
      
      const utility = goods.baseUtility[needGroup.id] ?? 0;
      
      if (weight > 0) {
        preferences.push({
          goodsId,
          weight,
          utility,
        });
      }
    }
    
    // Sort by weight (highest first)
    preferences.sort((a, b) => b.weight - a.weight);
    
    return preferences;
  }

  /**
   * Get quality preference based on pop wealth level
   */
  private getPopQualityPreference(popGroup: PopGroup): number {
    switch (popGroup.wealthLevel) {
      case 'poor':
        return QualityLevel.Poor;
      case 'middle':
        return QualityLevel.Standard;
      case 'wealthy':
        return QualityLevel.Good;
      case 'elite':
        return QualityLevel.Luxury;
      default:
        return QualityLevel.Standard;
    }
  }

  /**
   * Process consumption for a pop group
   */
  private processConsumption(popGroup: PopGroup, tick: GameTick): ConsumptionResult {
    const result: ConsumptionResult = {
      popGroupId: popGroup.id,
      tick,
      needSatisfaction: {} as Record<NeedCategory, number>,
      totalSpent: 0,
      goodsConsumed: [],
      unmetNeeds: [],
    };
    
    let remainingBudget = popGroup.weeklyBudget;
    const preferences = this.preferenceCache.get(popGroup.id);
    
    if (!preferences || !this.marketSimulator) {
      return result;
    }
    
    // Process each need category in priority order
    const sortedNeeds = this.getSortedNeeds(popGroup);
    
    for (const needCategory of sortedNeeds) {
      const needGroup = this.findNeedGroupByCategory(needCategory);
      if (!needGroup) continue;
      
      const categoryPreferences = preferences.get(needCategory) ?? [];
      const baseDemand = needGroup.baseDemand * popGroup.population;
      
      let satisfactionGained = 0;
      let demandRemaining = baseDemand;
      
      // Try to fulfill demand with preferred goods
      for (const pref of categoryPreferences) {
        if (demandRemaining <= 0 || remainingBudget <= 0) break;
        
        const price = this.marketSimulator.getPrice(pref.goodsId);
        if (price <= 0) continue;
        
        // Calculate how much we can afford/need
        const affordableQuantity = Math.floor(remainingBudget / price);
        const neededQuantity = Math.ceil(demandRemaining / pref.utility);
        const purchaseQuantity = Math.min(affordableQuantity, neededQuantity);
        
        if (purchaseQuantity > 0) {
          const cost = purchaseQuantity * price;
          const satisfaction = (purchaseQuantity * pref.utility) / baseDemand;
          
          result.goodsConsumed.push({
            goodsId: pref.goodsId,
            quantity: purchaseQuantity,
            price: cost,
            satisfaction,
          });
          
          // Update market demand
          this.marketSimulator.addDemand(pref.goodsId, purchaseQuantity);
          
          remainingBudget -= cost;
          result.totalSpent += cost;
          demandRemaining -= purchaseQuantity * pref.utility;
          satisfactionGained += satisfaction;
        }
      }
      
      // Record satisfaction for this need
      result.needSatisfaction[needCategory] = Math.min(1, satisfactionGained);
      
      if (satisfactionGained < 0.5) {
        result.unmetNeeds.push(needCategory);
      }
      
      // Update pop group satisfaction
      popGroup.needSatisfaction[needCategory] = Math.min(100, satisfactionGained * 100);
    }
    
    // Update overall happiness
    this.updatePopHappiness(popGroup, result);
    
    // Record consumption history
    this.recordConsumption(popGroup, result, tick);
    
    return result;
  }

  /**
   * Get needs sorted by pop priority
   */
  private getSortedNeeds(popGroup: PopGroup): NeedCategory[] {
    const priorities = popGroup.needPriorities;
    const categories = Object.values(NeedCategory);
    
    return categories.sort((a, b) => {
      const priorityA = priorities[a] ?? 1;
      const priorityB = priorities[b] ?? 1;
      return priorityB - priorityA;
    });
  }

  /**
   * Find a need group by category
   */
  private findNeedGroupByCategory(category: NeedCategory): NeedGroup | undefined {
    for (const needGroup of this.needGroups.values()) {
      if (needGroup.category === category) {
        return needGroup;
      }
    }
    return undefined;
  }

  /**
   * Update pop group happiness based on need satisfaction
   */
  private updatePopHappiness(popGroup: PopGroup, result: ConsumptionResult): void {
    let totalSatisfaction = 0;
    let totalWeight = 0;
    
    for (const [category, satisfaction] of Object.entries(result.needSatisfaction)) {
      const priority = popGroup.needPriorities[category as NeedCategory] ?? 1;
      totalSatisfaction += satisfaction * priority;
      totalWeight += priority;
    }
    
    const averageSatisfaction = totalWeight > 0 ? totalSatisfaction / totalWeight : 0.5;
    
    // Smooth happiness changes
    const oldHappiness = popGroup.overallHappiness;
    popGroup.overallHappiness = Math.round(oldHappiness * 0.7 + averageSatisfaction * 100 * 0.3);
  }

  /**
   * Record consumption in pop group history
   */
  private recordConsumption(
    popGroup: PopGroup,
    result: ConsumptionResult,
    tick: GameTick
  ): void {
    for (const consumed of result.goodsConsumed) {
      const record: ConsumptionRecord = {
        tick,
        goodsId: consumed.goodsId,
        quantity: consumed.quantity,
        totalSpent: consumed.price,
        satisfaction: consumed.satisfaction,
      };
      
      popGroup.consumptionHistory.push(record);
    }
    
    // Trim old history (keep last 4 weeks)
    const maxRecords = 4 * result.goodsConsumed.length;
    if (popGroup.consumptionHistory.length > maxRecords) {
      popGroup.consumptionHistory = popGroup.consumptionHistory.slice(-maxRecords);
    }
  }

  /**
   * Calculate total demand for a good across all pop groups
   */
  calculateTotalDemand(goodsId: EntityId): number {
    let totalDemand = 0;
    
    for (const popGroup of this.popGroups.values()) {
      const goods = this.goodsDefinitions.get(goodsId);
      if (!goods) continue;
      
      // Sum demand from all needs this good satisfies
      for (const [needId, _utility] of Object.entries(goods.baseUtility)) {
        const needGroup = this.needGroups.get(needId);
        if (!needGroup) continue;
        
        const baseDemand = needGroup.baseDemand * popGroup.population;
        const preference = this.getPreferenceWeight(popGroup.id, needGroup.category, goodsId);
        
        // Demand is weighted by preference share
        totalDemand += baseDemand * preference;
      }
    }
    
    return totalDemand;
  }

  /**
   * Get preference weight for a goods in a need category
   */
  private getPreferenceWeight(
    popGroupId: EntityId,
    needCategory: NeedCategory,
    goodsId: EntityId
  ): number {
    const preferences = this.preferenceCache.get(popGroupId)?.get(needCategory);
    if (!preferences) return 0;
    
    const totalWeight = preferences.reduce((sum, p) => sum + p.weight, 0);
    const goodsPreference = preferences.find((p) => p.goodsId === goodsId);
    
    if (!goodsPreference || totalWeight <= 0) return 0;
    
    return goodsPreference.weight / totalWeight;
  }

  /**
   * Get pop groups with unmet needs
   */
  getUnhappyPopGroups(): PopGroup[] {
    return Array.from(this.popGroups.values()).filter(
      (pop) => pop.overallHappiness < 50
    );
  }

  /**
   * Get demand forecast for a need category
   */
  getDemandForecast(needCategory: NeedCategory): {
    totalDemand: number;
    topGoods: Array<{ goodsId: EntityId; demandShare: number }>;
  } {
    let totalDemand = 0;
    const goodsDemand = new Map<EntityId, number>();
    
    const needGroup = this.findNeedGroupByCategory(needCategory);
    if (!needGroup) {
      return { totalDemand: 0, topGoods: [] };
    }
    
    for (const popGroup of this.popGroups.values()) {
      const baseDemand = needGroup.baseDemand * popGroup.population;
      totalDemand += baseDemand;
      
      const preferences = this.preferenceCache.get(popGroup.id)?.get(needCategory);
      if (preferences) {
        for (const pref of preferences) {
          const current = goodsDemand.get(pref.goodsId) ?? 0;
          const prefWeight = this.getPreferenceWeight(popGroup.id, needCategory, pref.goodsId);
          goodsDemand.set(pref.goodsId, current + baseDemand * prefWeight);
        }
      }
    }
    
    const topGoods = Array.from(goodsDemand.entries())
      .map(([goodsId, demand]) => ({
        goodsId,
        demandShare: totalDemand > 0 ? demand / totalDemand : 0,
      }))
      .sort((a, b) => b.demandShare - a.demandShare)
      .slice(0, 5);
    
    return { totalDemand, topGoods };
  }

  /**
   * Simulate how demand would change if a trend affected goods tags
   */
  simulateTrendImpact(
    affectedGoodsIds: EntityId[],
    demandMultiplier: number
  ): Map<NeedCategory, number> {
    const impactByCategory = new Map<NeedCategory, number>();
    
    for (const goodsId of affectedGoodsIds) {
      const goods = this.goodsDefinitions.get(goodsId);
      if (!goods) continue;
      
      for (const [needId] of Object.entries(goods.baseUtility)) {
        const needGroup = this.needGroups.get(needId);
        if (!needGroup) continue;
        
        const currentImpact = impactByCategory.get(needGroup.category) ?? 1;
        impactByCategory.set(needGroup.category, currentImpact * demandMultiplier);
      }
    }
    
    return impactByCategory;
  }
}