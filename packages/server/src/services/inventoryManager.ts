/**
 * 库存管理器
 * 管理所有公司的商品库存
 */

import { EventEmitter } from 'events';
import type { GoodsStock, CompanyInventory, InventoryChange } from '@scc/shared';
import { CompanyType, GOODS_DATA } from '@scc/shared';

/**
 * 库存变更结果
 */
export interface InventoryResult {
  success: boolean;
  error?: string;
  newQuantity?: number;
}

/**
 * 库存管理器 - 单例
 */
export class InventoryManager extends EventEmitter {
  /** 所有公司的库存 Map<companyId, CompanyInventory> */
  private inventories: Map<string, CompanyInventory> = new Map();
  /** 库存变更历史 */
  private changeHistory: InventoryChange[] = [];
  /** 历史记录保留数量 */
  private readonly MAX_HISTORY_SIZE = 1000;
  
  constructor() {
    super();
  }
  
  /**
   * 初始化公司库存
   */
  initializeCompany(
    companyId: string,
    companyName: string,
    companyType: CompanyType,
    initialCash: number,
    currentTick: number
  ): CompanyInventory {
    if (this.inventories.has(companyId)) {
      return this.inventories.get(companyId)!;
    }
    
    const inventory: CompanyInventory = {
      companyId,
      companyType,
      companyName,
      cash: initialCash,
      stocks: {},
      createdTick: currentTick,
    };
    
    this.inventories.set(companyId, inventory);
    console.log(`[InventoryManager] Initialized inventory for ${companyName} (${companyId})`);
    
    return inventory;
  }
  
  /**
   * 获取公司库存
   */
  getInventory(companyId: string): CompanyInventory | undefined {
    return this.inventories.get(companyId);
  }
  
  /**
   * 获取商品库存状态
   */
  getGoodsStock(companyId: string, goodsId: string): GoodsStock | undefined {
    const inventory = this.inventories.get(companyId);
    if (!inventory) return undefined;
    return inventory.stocks[goodsId];
  }
  
  /**
   * 获取可用库存数量（未被预留的）
   */
  getAvailableQuantity(companyId: string, goodsId: string): number {
    const stock = this.getGoodsStock(companyId, goodsId);
    if (!stock) return 0;
    return stock.quantity;
  }
  
  /**
   * 获取总库存数量（包括预留的）
   */
  getTotalQuantity(companyId: string, goodsId: string): number {
    const stock = this.getGoodsStock(companyId, goodsId);
    if (!stock) return 0;
    return stock.quantity + stock.reservedForSale + stock.reservedForProduction;
  }
  
  /**
   * 添加商品到库存（生产完成时调用）
   */
  addGoods(
    companyId: string,
    goodsId: string,
    quantity: number,
    cost: number,
    currentTick: number,
    reason: string = 'production'
  ): InventoryResult {
    const inventory = this.inventories.get(companyId);
    if (!inventory) {
      return { success: false, error: '公司不存在' };
    }
    
    if (quantity <= 0) {
      return { success: false, error: '数量必须大于0' };
    }
    
    let stock = inventory.stocks[goodsId];
    if (!stock) {
      stock = {
        goodsId,
        quantity: 0,
        reservedForSale: 0,
        reservedForProduction: 0,
        avgCost: 0,
        lastUpdateTick: currentTick,
      };
      inventory.stocks[goodsId] = stock;
    }
    
    // 更新加权平均成本
    const totalExisting = stock.quantity + stock.reservedForSale + stock.reservedForProduction;
    const totalValue = totalExisting * stock.avgCost + quantity * cost;
    const newTotal = totalExisting + quantity;
    stock.avgCost = newTotal > 0 ? totalValue / newTotal : cost;
    
    // 添加到可用库存
    stock.quantity += quantity;
    stock.lastUpdateTick = currentTick;
    
    // 记录变更
    this.recordChange(companyId, goodsId, 'add', quantity, reason, currentTick);
    
    this.emit('goodsAdded', { companyId, goodsId, quantity, newQuantity: stock.quantity });
    
    return { success: true, newQuantity: stock.quantity };
  }
  
  /**
   * 消耗商品（生产消耗时调用）
   * 优先消耗预留的，然后消耗可用的
   */
  consumeGoods(
    companyId: string,
    goodsId: string,
    quantity: number,
    currentTick: number,
    reason: string = 'production'
  ): InventoryResult {
    const inventory = this.inventories.get(companyId);
    if (!inventory) {
      return { success: false, error: '公司不存在' };
    }
    
    const stock = inventory.stocks[goodsId];
    if (!stock) {
      return { success: false, error: '没有该商品库存' };
    }
    
    // 优先消耗预留的生产用料
    let remaining = quantity;
    
    if (stock.reservedForProduction >= remaining) {
      stock.reservedForProduction -= remaining;
      remaining = 0;
    } else {
      remaining -= stock.reservedForProduction;
      stock.reservedForProduction = 0;
    }
    
    // 然后消耗可用库存
    if (remaining > 0) {
      if (stock.quantity < remaining) {
        return { success: false, error: '库存不足' };
      }
      stock.quantity -= remaining;
    }
    
    stock.lastUpdateTick = currentTick;
    
    // 记录变更
    this.recordChange(companyId, goodsId, 'consume', -quantity, reason, currentTick);
    
    this.emit('goodsConsumed', { companyId, goodsId, quantity, newQuantity: stock.quantity });
    
    return { success: true, newQuantity: stock.quantity };
  }
  
  /**
   * 预留商品用于销售（挂卖单时调用）
   */
  reserveForSale(
    companyId: string,
    goodsId: string,
    quantity: number,
    currentTick: number
  ): InventoryResult {
    const inventory = this.inventories.get(companyId);
    if (!inventory) {
      return { success: false, error: '公司不存在' };
    }
    
    const stock = inventory.stocks[goodsId];
    if (!stock || stock.quantity < quantity) {
      return { success: false, error: '可用库存不足' };
    }
    
    stock.quantity -= quantity;
    stock.reservedForSale += quantity;
    stock.lastUpdateTick = currentTick;
    
    this.recordChange(companyId, goodsId, 'reserve_sale', quantity, 'reserve_for_sale', currentTick);
    
    return { success: true, newQuantity: stock.quantity };
  }
  
  /**
   * 取消销售预留（卖单取消时调用）
   */
  unreserveForSale(
    companyId: string,
    goodsId: string,
    quantity: number,
    currentTick: number
  ): InventoryResult {
    const inventory = this.inventories.get(companyId);
    if (!inventory) {
      return { success: false, error: '公司不存在' };
    }
    
    const stock = inventory.stocks[goodsId];
    if (!stock || stock.reservedForSale < quantity) {
      return { success: false, error: '预留数量不足' };
    }
    
    stock.reservedForSale -= quantity;
    stock.quantity += quantity;
    stock.lastUpdateTick = currentTick;
    
    this.recordChange(companyId, goodsId, 'unreserve_sale', -quantity, 'cancel_sell_order', currentTick);
    
    return { success: true, newQuantity: stock.quantity };
  }
  
  /**
   * 预留商品用于生产（生产开始时调用）
   */
  reserveForProduction(
    companyId: string,
    goodsId: string,
    quantity: number,
    currentTick: number
  ): InventoryResult {
    const inventory = this.inventories.get(companyId);
    if (!inventory) {
      return { success: false, error: '公司不存在' };
    }
    
    const stock = inventory.stocks[goodsId];
    if (!stock || stock.quantity < quantity) {
      return { success: false, error: '可用库存不足' };
    }
    
    stock.quantity -= quantity;
    stock.reservedForProduction += quantity;
    stock.lastUpdateTick = currentTick;
    
    this.recordChange(companyId, goodsId, 'reserve_production', quantity, 'reserve_for_production', currentTick);
    
    return { success: true, newQuantity: stock.quantity };
  }
  
  /**
   * 取消生产预留
   */
  unreserveForProduction(
    companyId: string,
    goodsId: string,
    quantity: number,
    currentTick: number
  ): InventoryResult {
    const inventory = this.inventories.get(companyId);
    if (!inventory) {
      return { success: false, error: '公司不存在' };
    }
    
    const stock = inventory.stocks[goodsId];
    if (!stock || stock.reservedForProduction < quantity) {
      return { success: false, error: '预留数量不足' };
    }
    
    stock.reservedForProduction -= quantity;
    stock.quantity += quantity;
    stock.lastUpdateTick = currentTick;
    
    this.recordChange(companyId, goodsId, 'unreserve_production', -quantity, 'cancel_production', currentTick);
    
    return { success: true, newQuantity: stock.quantity };
  }
  
  /**
   * 完成销售交易（成交时调用）
   * 从卖方的销售预留中移除
   */
  completeSale(
    sellerCompanyId: string,
    goodsId: string,
    quantity: number,
    salePrice: number,
    currentTick: number,
    tradeId?: string
  ): InventoryResult {
    const inventory = this.inventories.get(sellerCompanyId);
    if (!inventory) {
      console.error(`[InventoryManager] completeSale failed: 卖方公司 ${sellerCompanyId} 不存在`);
      return { success: false, error: '卖方公司不存在' };
    }
    
    const stock = inventory.stocks[goodsId];
    if (!stock || stock.reservedForSale < quantity) {
      console.error(`[InventoryManager] completeSale failed: ${sellerCompanyId} 的 ${goodsId} 销售预留不足 (预留=${stock?.reservedForSale ?? 0}, 需要=${quantity})`);
      return { success: false, error: '销售预留不足' };
    }
    
    // 从预留中移除
    stock.reservedForSale -= quantity;
    stock.lastUpdateTick = currentTick;
    
    // 增加现金
    const cashReceived = salePrice * quantity;
    const previousCash = inventory.cash;
    inventory.cash += cashReceived;
    
    // 玩家公司的交易记录详细日志
    if (sellerCompanyId.startsWith('player') || inventory.companyType === CompanyType.Player) {
      console.log(`[InventoryManager] 💰 玩家销售成功: ${quantity.toFixed(2)} ${goodsId} @ ¥${(salePrice / 10000).toFixed(2)}万 = +¥${(cashReceived / 10000).toFixed(2)}万 (现金: ¥${(previousCash / 10000).toFixed(2)}万 -> ¥${(inventory.cash / 10000).toFixed(2)}万)`);
    }
    
    this.recordChange(sellerCompanyId, goodsId, 'trade', -quantity, `sold_${tradeId ?? 'unknown'}`, currentTick, tradeId);
    
    this.emit('saleCompleted', { companyId: sellerCompanyId, goodsId, quantity, totalValue: cashReceived });
    
    return { success: true, newQuantity: stock.quantity };
  }
  
  /**
   * 完成采购交易（成交时调用）
   * 向买方库存中添加商品
   */
  completePurchase(
    buyerCompanyId: string,
    goodsId: string,
    quantity: number,
    purchasePrice: number,
    currentTick: number,
    tradeId?: string
  ): InventoryResult {
    const inventory = this.inventories.get(buyerCompanyId);
    if (!inventory) {
      return { success: false, error: '买方公司不存在' };
    }
    
    const totalCost = purchasePrice * quantity;
    if (inventory.cash < totalCost) {
      return { success: false, error: '现金不足' };
    }
    
    // 扣除现金
    inventory.cash -= totalCost;
    
    // 添加到库存
    const result = this.addGoods(buyerCompanyId, goodsId, quantity, purchasePrice, currentTick, `purchased_${tradeId ?? 'unknown'}`);
    
    if (result.success) {
      this.emit('purchaseCompleted', { companyId: buyerCompanyId, goodsId, quantity, totalValue: totalCost });
    }
    
    return result;
  }
  
  /**
   * 获取公司现金
   */
  getCash(companyId: string): number {
    const inventory = this.inventories.get(companyId);
    return inventory?.cash ?? 0;
  }
  
  /**
   * 增加公司现金
   */
  addCash(companyId: string, amount: number, _currentTick: number, reason: string = 'income'): InventoryResult {
    const inventory = this.inventories.get(companyId);
    if (!inventory) {
      return { success: false, error: '公司不存在' };
    }
    
    inventory.cash += amount;
    
    this.emit('cashChanged', { companyId, change: amount, newCash: inventory.cash, reason });
    
    return { success: true };
  }
  
  /**
   * 扣除公司现金
   */
  deductCash(companyId: string, amount: number, _currentTick: number, reason: string = 'expense'): InventoryResult {
    const inventory = this.inventories.get(companyId);
    if (!inventory) {
      return { success: false, error: '公司不存在' };
    }
    
    if (inventory.cash < amount) {
      return { success: false, error: '现金不足' };
    }
    
    inventory.cash -= amount;
    
    this.emit('cashChanged', { companyId, change: -amount, newCash: inventory.cash, reason });
    
    return { success: true };
  }
  
  /**
   * 获取库存快照（用于UI）
   */
  getInventorySnapshot(companyId: string, marketPrices: Map<string, number>): {
    stocks: Array<{
      goodsId: string;
      goodsName: string;
      quantity: number;
      reservedForSale: number;
      reservedForProduction: number;
      avgCost: number;
      marketValue: number;
    }>;
    totalValue: number;
  } | null {
    const inventory = this.inventories.get(companyId);
    if (!inventory) return null;
    
    const stocks: Array<{
      goodsId: string;
      goodsName: string;
      quantity: number;
      reservedForSale: number;
      reservedForProduction: number;
      avgCost: number;
      marketValue: number;
    }> = [];
    
    let totalValue = 0;
    
    for (const [goodsId, stock] of Object.entries(inventory.stocks)) {
      const goodsData = GOODS_DATA.find(g => g.id === goodsId);
      const marketPrice = marketPrices.get(goodsId) ?? 0;
      const totalQty = stock.quantity + stock.reservedForSale + stock.reservedForProduction;
      const marketValue = totalQty * marketPrice;
      
      stocks.push({
        goodsId,
        goodsName: goodsData?.nameZh ?? goodsId,
        quantity: stock.quantity,
        reservedForSale: stock.reservedForSale,
        reservedForProduction: stock.reservedForProduction,
        avgCost: stock.avgCost,
        marketValue,
      });
      
      totalValue += marketValue;
    }
    
    return { stocks, totalValue };
  }
  
  /**
   * 记录库存变更
   */
  private recordChange(
    companyId: string,
    goodsId: string,
    changeType: InventoryChange['changeType'],
    quantity: number,
    reason: string,
    tick: number,
    tradeId?: string
  ): void {
    const change: InventoryChange = {
      companyId,
      goodsId,
      changeType,
      quantity,
      reason,
      tick,
      ...(tradeId !== undefined && { tradeId }),
    };
    
    this.changeHistory.push(change);
    
    // 限制历史记录大小
    if (this.changeHistory.length > this.MAX_HISTORY_SIZE) {
      this.changeHistory = this.changeHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }
  
  /**
   * 获取库存变更历史
   */
  getChangeHistory(companyId?: string, goodsId?: string, limit: number = 100): InventoryChange[] {
    let history = this.changeHistory;
    
    if (companyId) {
      history = history.filter(c => c.companyId === companyId);
    }
    
    if (goodsId) {
      history = history.filter(c => c.goodsId === goodsId);
    }
    
    return history.slice(-limit);
  }
  
  /**
   * 重置所有库存
   */
  reset(): void {
    this.inventories.clear();
    this.changeHistory = [];
    console.log('[InventoryManager] Reset all inventories');
  }
}

// 单例实例
export const inventoryManager = new InventoryManager();