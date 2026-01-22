/**
 * Production system types - Victoria 3 style production methods
 */

import { type EntityId, type Money, type Percentage, type Position } from './common.js';
import { type GoodsInstance, type QualityLevel } from './goods.js';

/** Building type classification */
export enum BuildingType {
  Factory = 'factory',
  Warehouse = 'warehouse',
  Office = 'office',
  Laboratory = 'laboratory',
  PowerPlant = 'power_plant',
  Refinery = 'refinery',
  Farm = 'farm',
  Mine = 'mine',
  Port = 'port',
}

/** Production method slot type */
export enum ProductionSlotType {
  Process = 'process', // Basic manufacturing process
  Automation = 'automation', // Automation level
  Materials = 'materials', // Material quality/source
  Energy = 'energy', // Power source
  Labor = 'labor', // Workforce type
}

/** A single production method option */
export interface ProductionMethod {
  id: EntityId;
  name: string;
  nameZh: string;
  description: string;
  slotType: ProductionSlotType;
  
  // Input requirements per production cycle
  inputs: ProductionIO[];
  
  // Output per production cycle
  outputs: ProductionIO[];
  
  // Modifiers when this method is active
  modifiers: ProductionModifier[];
  
  // Requirements to unlock this method
  requirements: MethodRequirement[];
  
  // Base upkeep cost per tick
  upkeepCost: Money;
  
  icon: string;
}

/** Input or output specification */
export interface ProductionIO {
  goodsId: EntityId;
  quantity: number;
  minQuality?: QualityLevel;
  outputQuality?: QualityLevel;
}

/** Modifier applied by a production method */
export interface ProductionModifier {
  type: ModifierType;
  value: number;
  isMultiplier: boolean; // true = multiply, false = add
}

export enum ModifierType {
  Throughput = 'throughput',
  Quality = 'quality',
  LabourRequired = 'labour_required',
  EnergyRequired = 'energy_required',
  MaintenanceCost = 'maintenance_cost',
  PollutionOutput = 'pollution_output',
  WorkerSatisfaction = 'worker_satisfaction',
}

/** Requirement to unlock a production method */
export interface MethodRequirement {
  type: 'technology' | 'resource' | 'reputation' | 'license';
  targetId: EntityId;
  minValue?: number;
}

/** Building definition */
export interface BuildingDefinition {
  id: EntityId;
  name: string;
  nameZh: string;
  description: string;
  type: BuildingType;
  
  // Available production method slots
  slots: ProductionSlotConfig[];
  
  // Base properties
  maxThroughput: number;
  baseMaintenance: Money;
  constructionCost: Money;
  constructionTicks: number;
  
  // Size and zoning
  footprint: { width: number; height: number };
  allowedZones: string[];
  
  icon: string;
  model3d?: string;
}

/** Configuration for a production slot in a building */
export interface ProductionSlotConfig {
  slotType: ProductionSlotType;
  availableMethods: EntityId[]; // Production method IDs
  defaultMethodId: EntityId;
}

/** Instance of a building owned by a company */
export interface BuildingInstance {
  id: EntityId;
  definitionId: EntityId;
  ownerId: EntityId;
  name: string;
  position: Position;
  zoneId: EntityId;
  
  // Current production configuration
  activeMethodIds: Record<ProductionSlotType, EntityId>;
  
  // Operational state
  operationalStatus: OperationalStatus;
  efficiency: Percentage;
  utilizationRate: Percentage;
  
  // Inventory
  inputInventory: GoodsInstance[];
  outputInventory: GoodsInstance[];
  inputCapacity: number;
  outputCapacity: number;
  
  // Workforce
  currentWorkers: number;
  requiredWorkers: number;
  workerSatisfaction: Percentage;
  
  // Financials
  lastTickRevenue: Money;
  lastTickCosts: Money;
  
  constructionProgress?: Percentage;
  createdAt: number;
  updatedAt: number;
}

export enum OperationalStatus {
  UnderConstruction = 'under_construction',
  Operational = 'operational',
  Paused = 'paused',
  LackingInputs = 'lacking_inputs',
  LackingWorkers = 'lacking_workers',
  LackingEnergy = 'lacking_energy',
  Upgrading = 'upgrading',
  Demolished = 'demolished',
}

/** Production cycle result */
export interface ProductionResult {
  buildingId: EntityId;
  tick: number;
  inputsConsumed: GoodsInstance[];
  outputsProduced: GoodsInstance[];
  efficiency: Percentage;
  revenue: Money;
  costs: Money;
  profit: Money;
  issues: ProductionIssue[];
}

export interface ProductionIssue {
  type: 'shortage' | 'quality' | 'capacity' | 'workforce' | 'energy';
  severity: 'warning' | 'critical';
  message: string;
  affectedGoodsId?: EntityId;
}