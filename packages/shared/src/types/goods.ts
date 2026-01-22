/**
 * Goods and commodity types
 */

import { type EntityId, type Money, type Percentage } from './common.js';

/** Category of goods */
export enum GoodsCategory {
  RawMaterial = 'raw_material',
  IntermediateGood = 'intermediate_good',
  ConsumerGood = 'consumer_good',
  CapitalGood = 'capital_good',
  Service = 'service',
}

/** Quality level of goods */
export enum QualityLevel {
  Poor = 1,
  Standard = 2,
  Good = 3,
  Excellent = 4,
  Luxury = 5,
}

/** Tag that can be applied to goods dynamically by LLM */
export interface GoodsTag {
  id: EntityId;
  name: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  strength: number; // 0-1, how strong the tag effect is
  expiresAt?: number; // Optional expiration tick
}

/** Definition of a type of goods */
export interface GoodsDefinition {
  id: EntityId;
  name: string;
  nameZh: string;
  description: string;
  category: GoodsCategory;
  basePrice: Money;
  baseUtility: Record<string, number>; // Need group ID -> utility value
  tags: GoodsTag[];
  perishable: boolean;
  perishTicks?: number; // How many ticks until it spoils
  stackSize: number;
  icon: string;
}

/** Instance of goods in inventory/market */
export interface GoodsInstance {
  definitionId: EntityId;
  quantity: number;
  quality: QualityLevel;
  producerId: EntityId;
  producedAt: number;
  customTags?: GoodsTag[];
}

/** Market listing for goods */
export interface MarketListing {
  id: EntityId;
  goodsDefinitionId: EntityId;
  sellerId: EntityId;
  quantity: number;
  quality: QualityLevel;
  pricePerUnit: Money;
  listedAt: number;
  expiresAt?: number;
}

/** Price history record */
export interface PriceRecord {
  goodsId: EntityId;
  tick: number;
  averagePrice: Money;
  volume: number;
  high: Money;
  low: Money;
}

/** Market supply/demand summary */
export interface MarketSummary {
  goodsId: EntityId;
  currentPrice: Money;
  priceChange24h: Percentage;
  totalSupply: number;
  totalDemand: number;
  supplyDemandRatio: number;
}