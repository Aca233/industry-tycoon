/**
 * ProductionCalculator - Calculates production output based on building configuration
 * Implements Victoria 3-style production method system
 */

import {
  type EntityId,
  type GameTick,
  type BuildingInstance,
  type BuildingDefinition,
  type ProductionMethod,
  type ProductionResult,
  type ProductionIssue,
  type GoodsInstance,
  type ProductionModifier,
  ModifierType,
  OperationalStatus,
  QualityLevel,
  PRODUCTION_CONSTANTS,
} from '@scc/shared';
import { type GameSubsystem, type GameEngine } from '../engine/GameEngine.js';

/** Input for production calculation */
export interface ProductionInput {
  building: BuildingInstance;
  definition: BuildingDefinition;
  activeMethods: ProductionMethod[];
  availableInputs: Map<EntityId, GoodsInstance>;
  energyAvailable: number;
  workerSatisfaction: number;
}

/** Aggregated modifiers from all active production methods */
interface AggregatedModifiers {
  throughputMultiplier: number;
  qualityBonus: number;
  labourRequired: number;
  energyRequired: number;
  maintenanceCost: number;
  pollutionOutput: number;
}

/**
 * Production Calculator subsystem
 * Handles all production logic for buildings
 */
export class ProductionCalculator implements GameSubsystem {
  readonly name = 'ProductionCalculator';
  
  private engine: GameEngine | null = null;
  private buildingDefinitions: Map<EntityId, BuildingDefinition> = new Map();
  private productionMethods: Map<EntityId, ProductionMethod> = new Map();

  async initialize(engine: GameEngine): Promise<void> {
    this.engine = engine;
    // Load definitions from game state
    const state = engine.getState();
    if (state) {
      this.buildingDefinitions = state.definitions.buildings;
      // Production methods would be loaded from definitions
    }
  }

  update(_tick: GameTick, _deltaTime: number): void {
    // Production is calculated on-demand, not every tick
    // This method could be used for batch processing if needed
  }

  cleanup(): void {
    this.engine = null;
    this.buildingDefinitions.clear();
    this.productionMethods.clear();
  }

  /**
   * Calculate production output for a building
   */
  calculateProduction(input: ProductionInput): ProductionResult {
    const { building, activeMethods, availableInputs } = input;
    const issues: ProductionIssue[] = [];
    
    // Check if building is operational
    if (building.operationalStatus !== OperationalStatus.Operational) {
      return this.createEmptyResult(building.id, issues, building.operationalStatus);
    }

    // Aggregate modifiers from all active production methods
    const modifiers = this.aggregateModifiers(activeMethods);
    
    // Calculate effective efficiency
    const efficiency = this.calculateEfficiency(input, modifiers, issues);
    
    // Calculate required inputs
    const requiredInputs = this.calculateRequiredInputs(activeMethods, efficiency);
    
    // Check input availability and consume
    const { consumedInputs, inputSatisfaction } = this.consumeInputs(
      requiredInputs,
      availableInputs,
      issues
    );
    
    // Calculate outputs based on efficiency and input satisfaction
    const actualEfficiency = efficiency * inputSatisfaction;
    const outputs = this.calculateOutputs(activeMethods, actualEfficiency, modifiers);
    
    // Calculate costs and revenue
    const costs = this.calculateCosts(building, modifiers, consumedInputs);
    const revenue = this.calculateRevenue(outputs);
    
    return {
      buildingId: building.id,
      tick: this.engine?.getCurrentTick() ?? 0,
      inputsConsumed: consumedInputs,
      outputsProduced: outputs,
      efficiency: actualEfficiency * 100,
      revenue,
      costs,
      profit: revenue - costs,
      issues,
    };
  }

  /**
   * Aggregate modifiers from all active production methods
   */
  private aggregateModifiers(methods: ProductionMethod[]): AggregatedModifiers {
    const result: AggregatedModifiers = {
      throughputMultiplier: 1,
      qualityBonus: 0,
      labourRequired: 1,
      energyRequired: 1,
      maintenanceCost: 1,
      pollutionOutput: 1,
    };

    for (const method of methods) {
      for (const modifier of method.modifiers) {
        this.applyModifier(result, modifier);
      }
    }

    return result;
  }

  /**
   * Apply a single modifier to the aggregated modifiers
   */
  private applyModifier(target: AggregatedModifiers, modifier: ProductionModifier): void {
    const key = this.modifierTypeToKey(modifier.type);
    if (!key) return;

    if (modifier.isMultiplier) {
      target[key] *= modifier.value;
    } else {
      target[key] += modifier.value;
    }
  }

  /**
   * Map modifier type to aggregated modifier key
   */
  private modifierTypeToKey(type: ModifierType): keyof AggregatedModifiers | null {
    switch (type) {
      case ModifierType.Throughput:
        return 'throughputMultiplier';
      case ModifierType.Quality:
        return 'qualityBonus';
      case ModifierType.LabourRequired:
        return 'labourRequired';
      case ModifierType.EnergyRequired:
        return 'energyRequired';
      case ModifierType.MaintenanceCost:
        return 'maintenanceCost';
      case ModifierType.PollutionOutput:
        return 'pollutionOutput';
      default:
        return null;
    }
  }

  /**
   * Calculate overall production efficiency
   */
  private calculateEfficiency(
    input: ProductionInput,
    modifiers: AggregatedModifiers,
    issues: ProductionIssue[]
  ): number {
    let efficiency = PRODUCTION_CONSTANTS.BASE_EFFICIENCY;
    
    // Apply throughput modifier
    efficiency *= modifiers.throughputMultiplier;
    
    // Worker satisfaction impact
    const workerImpact = input.workerSatisfaction / 100;
    efficiency *= 1 - (1 - workerImpact) * PRODUCTION_CONSTANTS.SATISFACTION_EFFICIENCY_WEIGHT;
    
    // Check workforce
    const workforceRatio = input.building.currentWorkers / input.building.requiredWorkers;
    if (workforceRatio < 1) {
      efficiency *= workforceRatio;
      issues.push({
        type: 'workforce',
        severity: workforceRatio < 0.5 ? 'critical' : 'warning',
        message: `Workforce shortage: ${Math.round(workforceRatio * 100)}% staffed`,
      });
    }
    
    // Check energy
    const energyRequired = PRODUCTION_CONSTANTS.BASE_ENERGY_COST * modifiers.energyRequired;
    if (input.energyAvailable < energyRequired) {
      const energyRatio = input.energyAvailable / energyRequired;
      efficiency *= energyRatio;
      issues.push({
        type: 'energy',
        severity: energyRatio < 0.5 ? 'critical' : 'warning',
        message: `Energy shortage: ${Math.round(energyRatio * 100)}% power`,
      });
    }
    
    // Clamp efficiency
    return Math.max(
      PRODUCTION_CONSTANTS.MIN_EFFICIENCY,
      Math.min(PRODUCTION_CONSTANTS.MAX_EFFICIENCY, efficiency)
    );
  }

  /**
   * Calculate required inputs for production
   */
  private calculateRequiredInputs(
    methods: ProductionMethod[],
    efficiency: number
  ): Map<EntityId, number> {
    const required = new Map<EntityId, number>();
    
    for (const method of methods) {
      for (const input of method.inputs) {
        const current = required.get(input.goodsId) ?? 0;
        required.set(input.goodsId, current + input.quantity * efficiency);
      }
    }
    
    return required;
  }

  /**
   * Consume inputs from available inventory
   */
  private consumeInputs(
    required: Map<EntityId, number>,
    available: Map<EntityId, GoodsInstance>,
    issues: ProductionIssue[]
  ): { consumedInputs: GoodsInstance[]; inputSatisfaction: number } {
    const consumedInputs: GoodsInstance[] = [];
    let totalRequired = 0;
    let totalSatisfied = 0;
    
    for (const [goodsId, requiredQty] of required) {
      totalRequired += requiredQty;
      const availableGoods = available.get(goodsId);
      
      if (!availableGoods || availableGoods.quantity < requiredQty) {
        const availableQty = availableGoods?.quantity ?? 0;
        const consumedQty = Math.min(availableQty, requiredQty);
        totalSatisfied += consumedQty;
        
        if (availableGoods && consumedQty > 0) {
          consumedInputs.push({
            ...availableGoods,
            quantity: consumedQty,
          });
        }
        
        issues.push({
          type: 'shortage',
          severity: availableQty === 0 ? 'critical' : 'warning',
          message: `Shortage of input materials: need ${requiredQty.toFixed(1)}, have ${availableQty.toFixed(1)}`,
          affectedGoodsId: goodsId,
        });
      } else {
        totalSatisfied += requiredQty;
        consumedInputs.push({
          ...availableGoods,
          quantity: requiredQty,
        });
      }
    }
    
    const inputSatisfaction = totalRequired > 0 ? totalSatisfied / totalRequired : 1;
    return { consumedInputs, inputSatisfaction };
  }

  /**
   * Calculate outputs based on production methods and efficiency
   */
  private calculateOutputs(
    methods: ProductionMethod[],
    efficiency: number,
    modifiers: AggregatedModifiers
  ): GoodsInstance[] {
    const outputs: GoodsInstance[] = [];
    const outputMap = new Map<EntityId, { quantity: number; quality: QualityLevel }>();
    
    for (const method of methods) {
      for (const output of method.outputs) {
        const existing = outputMap.get(output.goodsId);
        const quantity = output.quantity * efficiency;
        const baseQuality = output.outputQuality ?? QualityLevel.Standard;
        const qualityBonus = Math.floor(modifiers.qualityBonus);
        const quality = Math.min(
          QualityLevel.Luxury,
          Math.max(QualityLevel.Poor, baseQuality + qualityBonus)
        ) as QualityLevel;
        
        if (existing) {
          existing.quantity += quantity;
          // Take higher quality
          if (quality > existing.quality) {
            existing.quality = quality;
          }
        } else {
          outputMap.set(output.goodsId, { quantity, quality });
        }
      }
    }
    
    for (const [goodsId, { quantity, quality }] of outputMap) {
      if (quantity > 0) {
        outputs.push({
          definitionId: goodsId,
          quantity,
          quality,
          producerId: '', // Will be set by the building
          producedAt: this.engine?.getCurrentTick() ?? 0,
        });
      }
    }
    
    return outputs;
  }

  /**
   * Calculate production costs
   */
  private calculateCosts(
    building: BuildingInstance,
    modifiers: AggregatedModifiers,
    consumedInputs: GoodsInstance[]
  ): number {
    // Base maintenance
    let costs = building.requiredWorkers * 100 * modifiers.maintenanceCost;
    
    // Energy costs
    costs += PRODUCTION_CONSTANTS.BASE_ENERGY_COST * modifiers.energyRequired * 10;
    
    // Input costs would be calculated from market prices
    // For now, use a placeholder
    for (const input of consumedInputs) {
      costs += input.quantity * 50; // Placeholder price
    }
    
    return Math.round(costs);
  }

  /**
   * Calculate revenue from outputs
   */
  private calculateRevenue(outputs: GoodsInstance[]): number {
    // Revenue would be calculated from market prices
    // For now, use a placeholder
    let revenue = 0;
    for (const output of outputs) {
      const basePrice = 100; // Placeholder
      const qualityMultiplier = 1 + (output.quality - QualityLevel.Standard) * 0.2;
      revenue += output.quantity * basePrice * qualityMultiplier;
    }
    return Math.round(revenue);
  }

  /**
   * Create an empty production result
   */
  private createEmptyResult(
    buildingId: EntityId,
    issues: ProductionIssue[],
    status: OperationalStatus
  ): ProductionResult {
    issues.push({
      type: 'capacity',
      severity: 'critical',
      message: `Building not operational: ${status}`,
    });
    
    return {
      buildingId,
      tick: this.engine?.getCurrentTick() ?? 0,
      inputsConsumed: [],
      outputsProduced: [],
      efficiency: 0,
      revenue: 0,
      costs: 0,
      profit: 0,
      issues,
    };
  }

  /**
   * Preview production output without consuming inputs
   * Useful for UI to show expected output
   */
  previewProduction(input: ProductionInput): ProductionResult {
    const preview = this.calculateProduction({
      ...input,
      availableInputs: new Map(input.availableInputs), // Clone to prevent modification
    });
    return preview;
  }

  /**
   * Calculate the optimal production method combination
   * Based on current market prices and available inputs
   */
  suggestOptimalMethods(
    building: BuildingInstance,
    definition: BuildingDefinition,
    _marketPrices: Map<EntityId, number>
  ): Map<string, EntityId> {
    // For each slot, find the method that maximizes profit
    const suggestions = new Map<string, EntityId>();
    
    for (const slotConfig of definition.slots) {
      // Default to current or first available method
      const currentMethodId = building.activeMethodIds[slotConfig.slotType];
      suggestions.set(slotConfig.slotType, currentMethodId ?? slotConfig.defaultMethodId);
      
      // TODO: Implement actual optimization based on:
      // - Input costs from market prices
      // - Output values from market prices
      // - Efficiency changes from method combinations
    }
    
    return suggestions;
  }
}