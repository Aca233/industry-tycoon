/**
 * MarketSimulator - Handles market dynamics, pricing, and supply/demand
 * Implements dynamic goods substitution system driven by LLM
 */

import {
  type EntityId,
  type GameTick,
  type Money,
  type GoodsDefinition,
  type MarketListing,
  type MarketTrend,
  type MarketSummary,
  type PriceRecord,
  type GoodsTag,
  MARKET_CONSTANTS,
  ECONOMY_CONSTANTS,
} from '@scc/shared';
import { type GameSubsystem, GameEngine } from '../engine/GameEngine.js';

/** Market transaction record */
export interface MarketTransaction {
  id: EntityId;
  tick: GameTick;
  goodsId: EntityId;
  buyerId: EntityId;
  sellerId: EntityId;
  quantity: number;
  pricePerUnit: Money;
  totalPrice: Money;
}

/** Supply/demand data for a good */
interface SupplyDemandData {
  supply: number;
  demand: number;
  lastPrice: Money;
  priceVelocity: number;
}

/**
 * Market Simulator subsystem
 * Manages pricing, supply/demand, and market dynamics
 */
export class MarketSimulator implements GameSubsystem {
  readonly name = 'MarketSimulator';
  
  private engine: GameEngine | null = null;
  
  // Market state
  private supplyDemand: Map<EntityId, SupplyDemandData> = new Map();
  private currentPrices: Map<EntityId, Money> = new Map();
  private priceHistory: Map<EntityId, PriceRecord[]> = new Map();
  private activeListings: MarketListing[] = [];
  private activeTrends: MarketTrend[] = [];
  private transactions: MarketTransaction[] = [];
  
  // Definitions
  private goodsDefinitions: Map<EntityId, GoodsDefinition> = new Map();

  async initialize(engine: GameEngine): Promise<void> {
    this.engine = engine;
    const state = engine.getState();
    if (state) {
      this.goodsDefinitions = state.definitions.goods;
      this.initializePrices();
    }
  }

  update(tick: GameTick, _deltaTime: number): void {
    // Update prices based on supply/demand
    this.updatePrices(tick);
    
    // Process active trends
    this.processTrends(tick);
    
    // Clean up expired listings
    this.cleanupExpiredListings(tick);
    
    // Record price history periodically
    if (tick % 24 === 0) { // Once per game day
      this.recordPriceHistory(tick);
    }
    
    // Clear old transactions
    this.cleanupOldTransactions(tick);
  }

  cleanup(): void {
    this.engine = null;
    this.supplyDemand.clear();
    this.currentPrices.clear();
    this.priceHistory.clear();
    this.activeListings = [];
    this.activeTrends = [];
    this.transactions = [];
  }

  /**
   * Initialize prices from goods definitions
   */
  private initializePrices(): void {
    for (const [id, goods] of this.goodsDefinitions) {
      this.currentPrices.set(id, goods.basePrice);
      this.supplyDemand.set(id, {
        supply: 1000, // Initial supply
        demand: 1000, // Initial demand
        lastPrice: goods.basePrice,
        priceVelocity: 0,
      });
      this.priceHistory.set(id, []);
    }
  }

  /**
   * Update prices based on supply and demand
   */
  private updatePrices(_tick: GameTick): void {
    for (const [goodsId, data] of this.supplyDemand) {
      const goods = this.goodsDefinitions.get(goodsId);
      if (!goods) continue;

      // Calculate supply/demand ratio
      const ratio = data.supply > 0 ? data.demand / data.supply : 2;
      const imbalance = ratio - 1; // Positive = excess demand, negative = excess supply
      
      // Only adjust if imbalance exceeds threshold
      if (Math.abs(imbalance) > MARKET_CONSTANTS.IMBALANCE_THRESHOLD) {
        const adjustment = imbalance * MARKET_CONSTANTS.PRICE_ADJUSTMENT_RATE;
        const currentPrice = this.currentPrices.get(goodsId) ?? goods.basePrice;
        
        // Apply adjustment with momentum
        data.priceVelocity = data.priceVelocity * 0.9 + adjustment * 0.1;
        let newPrice = currentPrice * (1 + data.priceVelocity);
        
        // Apply trend effects
        for (const trend of this.activeTrends) {
          if (trend.affectedGoodsIds.includes(goodsId)) {
            newPrice *= trend.priceMultiplier;
          }
        }
        
        // Clamp price to reasonable bounds
        newPrice = Math.max(
          goods.basePrice * ECONOMY_CONSTANTS.MIN_PRICE_MULTIPLIER,
          Math.min(goods.basePrice * ECONOMY_CONSTANTS.MAX_PRICE_MULTIPLIER, newPrice)
        );
        
        this.currentPrices.set(goodsId, Math.round(newPrice));
        data.lastPrice = Math.round(newPrice);
      }
    }
  }

  /**
   * Process active market trends
   */
  private processTrends(tick: GameTick): void {
    // Remove expired trends
    this.activeTrends = this.activeTrends.filter((trend) => {
      if (trend.endTick && tick >= trend.endTick) {
        // Trend ended, remove its effects
        this.removeTrendEffects(trend);
        return false;
      }
      
      // Update trend intensity based on lifecycle
      if (tick < trend.peakTick) {
        // Rising phase
        trend.intensity = (tick - trend.startTick) / (trend.peakTick - trend.startTick);
      } else if (trend.endTick) {
        // Falling phase
        trend.intensity = 1 - (tick - trend.peakTick) / (trend.endTick - trend.peakTick);
      }
      
      return true;
    });
  }

  /**
   * Remove effects when a trend ends
   */
  private removeTrendEffects(trend: MarketTrend): void {
    // Remove tags that were added by this trend
    if (trend.newTags) {
      for (const { goodsId, tagId } of trend.newTags) {
        const goods = this.goodsDefinitions.get(goodsId);
        if (goods) {
          goods.tags = goods.tags.filter((t) => t.id !== tagId);
        }
      }
    }
  }

  /**
   * Clean up expired listings
   */
  private cleanupExpiredListings(tick: GameTick): void {
    this.activeListings = this.activeListings.filter(
      (listing) => !listing.expiresAt || listing.expiresAt > tick
    );
  }

  /**
   * Record price history snapshot
   */
  private recordPriceHistory(tick: GameTick): void {
    for (const [goodsId, price] of this.currentPrices) {
      const history = this.priceHistory.get(goodsId) ?? [];
      const dailyTransactions = this.transactions.filter(
        (t) => t.goodsId === goodsId && t.tick >= tick - 24
      );
      
      const volume = dailyTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const prices = dailyTransactions.map((t) => t.pricePerUnit);
      
      const record: PriceRecord = {
        goodsId,
        tick,
        averagePrice: price,
        volume,
        high: prices.length > 0 ? Math.max(...prices) : price,
        low: prices.length > 0 ? Math.min(...prices) : price,
      };
      
      history.push(record);
      
      // Trim old history
      const maxHistory = MARKET_CONSTANTS.PRICE_HISTORY_RETENTION / 24;
      if (history.length > maxHistory) {
        history.splice(0, history.length - maxHistory);
      }
      
      this.priceHistory.set(goodsId, history);
    }
  }

  /**
   * Clean up old transactions
   */
  private cleanupOldTransactions(tick: GameTick): void {
    const retentionTicks = MARKET_CONSTANTS.PRICE_HISTORY_RETENTION;
    this.transactions = this.transactions.filter(
      (t) => tick - t.tick < retentionTicks
    );
  }

  /**
   * Get current price for a good
   */
  getPrice(goodsId: EntityId): Money {
    return this.currentPrices.get(goodsId) ?? 0;
  }

  /**
   * Get market summary for a good
   */
  getMarketSummary(goodsId: EntityId): MarketSummary | null {
    const price = this.currentPrices.get(goodsId);
    const data = this.supplyDemand.get(goodsId);
    const history = this.priceHistory.get(goodsId);
    
    if (!price || !data) return null;
    
    // Calculate 24h price change
    let priceChange24h = 0;
    if (history && history.length >= 2) {
      const oldPrice = history[history.length - 2]?.averagePrice ?? price;
      priceChange24h = ((price - oldPrice) / oldPrice) * 100;
    }
    
    return {
      goodsId,
      currentPrice: price,
      priceChange24h,
      totalSupply: data.supply,
      totalDemand: data.demand,
      supplyDemandRatio: data.supply > 0 ? data.demand / data.supply : 0,
    };
  }

  /**
   * Add supply to the market
   */
  addSupply(goodsId: EntityId, quantity: number): void {
    const data = this.supplyDemand.get(goodsId);
    if (data) {
      data.supply += quantity;
    }
  }

  /**
   * Add demand to the market
   */
  addDemand(goodsId: EntityId, quantity: number): void {
    const data = this.supplyDemand.get(goodsId);
    if (data) {
      data.demand += quantity;
    }
  }

  /**
   * Create a market listing
   */
  createListing(listing: Omit<MarketListing, 'id' | 'listedAt'>): MarketListing {
    const tick = this.engine?.getCurrentTick() ?? 0;
    const fullListing: MarketListing = {
      ...listing,
      id: GameEngine.generateId(),
      listedAt: tick,
      expiresAt: listing.expiresAt ?? tick + MARKET_CONSTANTS.DEFAULT_LISTING_EXPIRY_TICKS,
    };
    
    this.activeListings.push(fullListing);
    this.addSupply(listing.goodsDefinitionId, listing.quantity);
    
    return fullListing;
  }

  /**
   * Execute a market transaction
   */
  executePurchase(
    listingId: EntityId,
    buyerId: EntityId,
    quantity: number
  ): MarketTransaction | null {
    const listing = this.activeListings.find((l) => l.id === listingId);
    if (!listing || listing.quantity < quantity) {
      return null;
    }
    
    const tick = this.engine?.getCurrentTick() ?? 0;
    const totalPrice = listing.pricePerUnit * quantity;
    
    const transaction: MarketTransaction = {
      id: GameEngine.generateId(),
      tick,
      goodsId: listing.goodsDefinitionId,
      buyerId,
      sellerId: listing.sellerId,
      quantity,
      pricePerUnit: listing.pricePerUnit,
      totalPrice,
    };
    
    // Update listing
    listing.quantity -= quantity;
    if (listing.quantity <= 0) {
      this.activeListings = this.activeListings.filter((l) => l.id !== listingId);
    }
    
    // Update supply/demand
    const data = this.supplyDemand.get(listing.goodsDefinitionId);
    if (data) {
      data.supply -= quantity;
      data.demand -= quantity;
    }
    
    // Record transaction
    this.transactions.push(transaction);
    
    return transaction;
  }

  /**
   * Apply a market trend (typically from LLM)
   */
  applyTrend(trend: MarketTrend): void {
    this.activeTrends.push(trend);
    
    // Apply immediate tag changes
    if (trend.newTags) {
      for (const { goodsId, tagId } of trend.newTags) {
        const goods = this.goodsDefinitions.get(goodsId);
        if (goods) {
          const tag: GoodsTag = {
            id: tagId,
            name: trend.name,
            sentiment: 'neutral',
            strength: trend.intensity,
          };
          if (trend.endTick !== undefined) {
            tag.expiresAt = trend.endTick;
          }
          goods.tags.push(tag);
        }
      }
    }
    
    // Remove tags
    if (trend.removedTags) {
      for (const { goodsId, tagId } of trend.removedTags) {
        const goods = this.goodsDefinitions.get(goodsId);
        if (goods) {
          goods.tags = goods.tags.filter((t) => t.id !== tagId);
        }
      }
    }
    
    // Adjust demand for affected goods
    for (const goodsId of trend.affectedGoodsIds) {
      const data = this.supplyDemand.get(goodsId);
      if (data) {
        data.demand *= trend.demandMultiplier;
      }
    }
  }

  /**
   * Calculate purchase weight for a good (for POP consumption)
   * Based on utility, price, and quality
   */
  calculatePurchaseWeight(
    goodsId: EntityId,
    needGroupId: EntityId,
    quality: number,
    popTrends: Map<EntityId, number>
  ): number {
    const goods = this.goodsDefinitions.get(goodsId);
    const price = this.currentPrices.get(goodsId);
    
    if (!goods || !price) return 0;
    
    // Get base utility for this need
    const baseUtility = goods.baseUtility[needGroupId] ?? 0;
    if (baseUtility <= 0) return 0;
    
    // Apply tag modifiers
    let tagModifier = 1;
    for (const tag of goods.tags) {
      const popPreference = popTrends.get(tag.id) ?? 0;
      tagModifier *= 1 + (tag.sentiment === 'positive' ? 1 : -1) * tag.strength * popPreference;
    }
    
    // Calculate weight: (utility * quality) / price * trend modifier
    const weight = (baseUtility * quality) / (price / 100) * tagModifier;
    
    return Math.max(0, weight);
  }

  /**
   * Get goods that can satisfy a need group
   */
  getGoodsForNeed(needGroupId: EntityId): EntityId[] {
    const goods: EntityId[] = [];
    
    for (const [goodsId, definition] of this.goodsDefinitions) {
      if (definition.baseUtility[needGroupId] && definition.baseUtility[needGroupId] > 0) {
        goods.push(goodsId);
      }
    }
    
    return goods;
  }

  /**
   * Get all active listings for a good
   */
  getListings(goodsId: EntityId): MarketListing[] {
    return this.activeListings.filter((l) => l.goodsDefinitionId === goodsId);
  }

  /**
   * Get price history for charting
   */
  getPriceHistory(goodsId: EntityId, ticks?: number): PriceRecord[] {
    const history = this.priceHistory.get(goodsId) ?? [];
    if (ticks) {
      return history.slice(-ticks);
    }
    return history;
  }

  /**
   * Get all active trends
   */
  getActiveTrends(): MarketTrend[] {
    return [...this.activeTrends];
  }

  /**
   * Get market statistics
   */
  getMarketStats(): {
    totalListings: number;
    totalVolume24h: number;
    averagePriceIndex: number;
    volatilityIndex: number;
  } {
    const tick = this.engine?.getCurrentTick() ?? 0;
    const recentTransactions = this.transactions.filter((t) => tick - t.tick < 24);
    
    // Calculate average price index (weighted by volume)
    let totalValue = 0;
    let totalVolume = 0;
    for (const [goodsId, price] of this.currentPrices) {
      const goods = this.goodsDefinitions.get(goodsId);
      if (goods) {
        const weight = (price / goods.basePrice);
        totalValue += weight;
        totalVolume++;
      }
    }
    
    // Calculate volatility from price velocities
    let volatilitySum = 0;
    for (const data of this.supplyDemand.values()) {
      volatilitySum += Math.abs(data.priceVelocity);
    }
    
    return {
      totalListings: this.activeListings.length,
      totalVolume24h: recentTransactions.reduce((sum, t) => sum + t.totalPrice, 0),
      averagePriceIndex: totalVolume > 0 ? totalValue / totalVolume : 1,
      volatilityIndex: this.supplyDemand.size > 0 ? volatilitySum / this.supplyDemand.size : 0,
    };
  }
}