# Phase 41: 服务端性能优化计划

## 当前性能状况分析

### 性能报告摘要（tick 3800-3960）
```
⏱️ Tick 耗时统计:
   平均: 254ms - 468ms
   最大: 1030ms
   P95:  530ms - 630ms
   目标: 50ms

🔥 性能热点分布:
   1. economyUpdate: 233ms (93%) ← 主要瓶颈
   2. aiCompanyDecision: 101ms (40%) ← 次要瓶颈
   3. stockMarket: 0.45ms (0.2%)
   4. buildingProduction: 0.01ms (0%)

💾 内存使用:
   平均堆: 267MB
   峰值堆: 416MB
   GC压力: low
```

### 问题诊断

1. **economyUpdate耗时过长（93%）**
   - 每tick处理39个AI公司的订单
   - 大量订单提交（每tick 100-300个订单）
   - 订单簿操作（插入、排序、清理）
   - 价格发现更新

2. **aiCompanyDecision消耗40%**
   - AI决策逻辑复杂
   - LLM策略刷新
   - 市场分析计算

3. **订单雪崩效应**
   - AI公司每3-5 tick提交订单
   - 每个建筑生成买入+卖出订单
   - 订单累积速度 > 清理速度

---

## 优化方案设计

### 设计原则
- ✅ 不影响市场经济模拟的真实性
- ✅ 保持AI公司的智能决策能力
- ✅ 维持市场流动性和价格发现机制
- ✅ 渐进式优化，可随时回滚

---

## Phase 41.1: 订单系统优化

### 41.1.1 订单合并策略
**目标**: 减少订单数量，提高撮合效率

```typescript
// 当前问题：每个建筑每3-5 tick提交独立订单
// 建筑1: buy 1000 coal @ 3600
// 建筑2: buy 1500 coal @ 3580
// 建筑3: buy 800 coal @ 3620

// 优化后：公司级订单合并
// 公司A: buy 3300 coal @ 3600 (VWAP加权平均价)
```

**实现方案**:
```typescript
// packages/server/src/services/aiCompanyManager.ts

/**
 * 订单合并器
 * 将同一公司、同一商品的多个订单合并为单一订单
 */
class OrderAggregator {
  private pendingOrders: Map<string, Map<string, AggregatedOrder>> = new Map();
  
  addOrder(companyId: string, goodsId: string, type: 'buy' | 'sell', quantity: number, price: number) {
    const key = `${companyId}-${type}`;
    if (!this.pendingOrders.has(key)) {
      this.pendingOrders.set(key, new Map());
    }
    const goods = this.pendingOrders.get(key)!;
    
    if (goods.has(goodsId)) {
      const existing = goods.get(goodsId)!;
      // VWAP计算
      const totalValue = existing.totalValue + quantity * price;
      const totalQty = existing.quantity + quantity;
      existing.quantity = totalQty;
      existing.totalValue = totalValue;
      existing.avgPrice = totalValue / totalQty;
    } else {
      goods.set(goodsId, { quantity, totalValue: quantity * price, avgPrice: price, type });
    }
  }
  
  flush(currentTick: number): void {
    for (const [key, orders] of this.pendingOrders) {
      const [companyId, type] = key.split('-');
      for (const [goodsId, order] of orders) {
        if (order.quantity > 10) { // 最小订单阈值
          if (type === 'buy') {
            marketOrderBook.submitBuyOrder(companyId, goodsId, order.quantity, order.avgPrice, currentTick, 30);
          } else {
            marketOrderBook.submitSellOrder(companyId, goodsId, order.quantity, order.avgPrice, currentTick, 30);
          }
        }
      }
    }
    this.pendingOrders.clear();
  }
}
```

**预期效果**: 订单数量减少60-70%

---

### 41.1.2 批量订单提交
**目标**: 减少订单簿操作次数

```typescript
// packages/server/src/services/marketOrderBook.ts

/**
 * 批量提交订单（单次索引重建）
 */
submitBatchOrders(orders: BatchOrderRequest[], currentTick: number): MarketOrder[] {
  const results: MarketOrder[] = [];
  
  // 按商品分组
  const grouped = this.groupByGoods(orders);
  
  for (const [goodsId, orderBatch] of grouped) {
    const orderBook = this.orderBooks.get(goodsId);
    if (!orderBook) continue;
    
    // 批量插入，最后统一重建索引
    for (const order of orderBatch) {
      const newOrder = this.createOrder(order, currentTick);
      this.orders.set(newOrder.id, newOrder);
      
      if (order.type === 'buy') {
        orderBook.buyOrders.push(newOrder);
      } else {
        orderBook.sellOrders.push(newOrder);
      }
      results.push(newOrder);
    }
    
    // 批量排序（比逐个二分插入更快）
    orderBook.buyOrders.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
    orderBook.sellOrders.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
    
    // 一次性重建索引
    this.rebuildBuyOrderIndex(orderBook);
    this.rebuildSellOrderIndex(orderBook);
    this.updateBestPricesOptimized(orderBook);
  }
  
  return results;
}
```

**预期效果**: 订单提交耗时减少40%

---

### 41.1.3 订单簿清理优化
**目标**: 降低清理频率，采用惰性删除

```typescript
// 当前：每tick清理过期订单
// 优化：每10 tick批量清理，使用标记删除

/**
 * 惰性删除策略
 * - 不立即从数组移除已成交/过期订单
 * - 标记为inactive状态
 * - 定期批量清理
 */
cleanupExpiredOrders(currentTick: number): number {
  // 每10 tick才执行一次批量清理
  if (currentTick % 10 !== 0) return 0;
  
  let cleanedCount = 0;
  
  for (const orderBook of this.orderBooks.values()) {
    // 过滤而非splice，O(n)一次遍历
    const activeBuys = orderBook.buyOrders.filter(o => {
      if (o.status === 'open' || o.status === 'partial') {
        if (o.expiryTick > 0 && currentTick >= o.expiryTick) {
          o.status = 'expired';
          cleanedCount++;
          return false;
        }
        return true;
      }
      return false;
    });
    
    const activeSells = orderBook.sellOrders.filter(o => {
      if (o.status === 'open' || o.status === 'partial') {
        if (o.expiryTick > 0 && currentTick >= o.expiryTick) {
          o.status = 'expired';
          cleanedCount++;
          return false;
        }
        return true;
      }
      return false;
    });
    
    if (activeBuys.length !== orderBook.buyOrders.length) {
      orderBook.buyOrders = activeBuys;
      orderBook.activeBuyCount = activeBuys.length;
      this.rebuildBuyOrderIndex(orderBook);
    }
    
    if (activeSells.length !== orderBook.sellOrders.length) {
      orderBook.sellOrders = activeSells;
      orderBook.activeSellCount = activeSells.length;
      this.rebuildSellOrderIndex(orderBook);
    }
    
    this.updateBestPricesOptimized(orderBook);
  }
  
  return cleanedCount;
}
```

**预期效果**: 清理开销减少80%

---

## Phase 41.2: AI公司决策优化

### 41.2.1 决策批次分离
**目标**: 将AI公司分成多个批次，分散处理负载

```typescript
// packages/server/src/services/aiCompanyManager.ts

// 当前配置
private readonly BATCH_SIZE = 10;
private readonly MAX_DECISIONS_PER_TICK = 3;

// 优化配置：增加决策间隔，减少单tick决策数
private readonly DECISION_INTERVAL_MIN = 10;  // 从5改为10
private readonly DECISION_INTERVAL_MAX = 25;  // 从15改为25
private readonly MAX_DECISIONS_PER_TICK = 2;  // 从3改为2

/**
 * 决策批次调度器
 * 将39个AI公司分成5批，每批每5 tick处理一次
 */
private readonly DECISION_BATCHES = 5;
private decisionBatchIndex = 0;

processTick(context: GameContext) {
  const companies = Array.from(this.companies.values());
  
  // 只处理当前批次的公司决策
  const batchSize = Math.ceil(companies.length / this.DECISION_BATCHES);
  const batchStart = this.decisionBatchIndex * batchSize;
  const batchEnd = Math.min(batchStart + batchSize, companies.length);
  
  for (let i = batchStart; i < batchEnd; i++) {
    const company = companies[i];
    this.processCompanyDecision(company, context);
  }
  
  // 轮转批次
  this.decisionBatchIndex = (this.decisionBatchIndex + 1) % this.DECISION_BATCHES;
  
  // 生产和订单仍然每tick处理（使用现有分批逻辑）
  // ...
}
```

**预期效果**: AI决策耗时减少50%

---

### 41.2.2 缓存市场分析结果
**目标**: 避免重复计算市场状态

```typescript
// packages/server/src/services/aiCompanyManager.ts

interface MarketAnalysisCache {
  tick: number;
  marketGaps: MarketGap[];
  playerDependencies: string[];
  priceVolatility: Map<string, number>;
}

private marketAnalysisCache: MarketAnalysisCache | null = null;
private readonly CACHE_TTL = 5; // 缓存5 tick

private getMarketAnalysis(context: GameContext): MarketAnalysisCache {
  const currentTick = context.currentTick;
  
  // 检查缓存有效性
  if (this.marketAnalysisCache && 
      currentTick - this.marketAnalysisCache.tick < this.CACHE_TTL) {
    return this.marketAnalysisCache;
  }
  
  // 计算并缓存
  this.marketAnalysisCache = {
    tick: currentTick,
    marketGaps: this.analyzeMarketGaps(context),
    playerDependencies: this.analyzePlayerDependencies(context),
    priceVolatility: this.calculatePriceVolatility(context),
  };
  
  return this.marketAnalysisCache;
}
```

**预期效果**: 市场分析开销减少80%

---

### 41.2.3 LLM调用节流
**目标**: 减少LLM API调用频率

```typescript
// 当前：每1000 tick刷新一次战略
// 优化：延长到2000 tick，且错开各公司的刷新时机

strategyRefreshInterval: 2000, // 从1000改为2000

// 在初始化时设置随机偏移，避免同时刷新
lastStrategyTick: -Math.floor(Math.random() * 2000),
```

**预期效果**: LLM调用减少50%，分散调用时机

---

## Phase 41.3: 生产系统优化

### 41.3.1 生产批量计算
**目标**: 合并多个建筑的生产计算

```typescript
// packages/server/src/services/aiCompanyManager.ts

/**
 * 批量生产处理
 * 将同类型建筑的生产合并计算
 */
private processCompanyProductionBatched(company: AICompanyState, context: GameContext): void {
  // 按建筑类型分组
  const buildingGroups = new Map<string, BuildingInstance[]>();
  
  for (const building of company.buildings) {
    if (building.status !== 'running') continue;
    
    const key = `${building.definitionId}-${building.currentMethodId}`;
    if (!buildingGroups.has(key)) {
      buildingGroups.set(key, []);
    }
    buildingGroups.get(key)!.push(building);
  }
  
  // 批量计算每组的总产出/消耗
  for (const [key, buildings] of buildingGroups) {
    const def = BUILDINGS_DATA.find(b => b.id === buildings[0].definitionId);
    if (!def) continue;
    
    const slot = def.productionSlots[0];
    const method = slot?.methods.find(m => m.id === buildings[0].currentMethodId);
    if (!method) continue;
    
    // 计算组合的效率和产能
    let totalAggregatedCount = 0;
    let avgEfficiency = 0;
    let completedCycles = 0;
    
    for (const building of buildings) {
      const aggCount = building.aggregatedCount ?? 1;
      totalAggregatedCount += aggCount;
      avgEfficiency += building.efficiency * aggCount;
      
      // 推进进度
      building.productionProgress += building.efficiency * building.utilization;
      if (building.productionProgress >= method.recipe.ticksRequired) {
        building.productionProgress -= method.recipe.ticksRequired;
        completedCycles += aggCount;
      }
    }
    
    avgEfficiency /= totalAggregatedCount;
    
    // 批量处理完成的生产周期
    if (completedCycles > 0) {
      for (const input of method.recipe.inputs) {
        inventoryManager.consumeGoods(
          company.id, 
          input.goodsId, 
          input.amount * completedCycles, 
          context.currentTick, 
          'production'
        );
      }
      
      for (const output of method.recipe.outputs) {
        const price = context.marketPrices.get(output.goodsId) ?? 1000;
        inventoryManager.addGoods(
          company.id,
          output.goodsId,
          output.amount * completedCycles,
          price,
          context.currentTick,
          'production'
        );
      }
    }
  }
}
```

**预期效果**: 生产计算耗时减少30%

---

## Phase 41.4: 撮合引擎优化

### 41.4.1 增量撮合
**目标**: 只处理新订单的撮合

```typescript
// packages/server/src/services/matchingEngine.ts

private lastProcessedBuyIdx: Map<string, number> = new Map();
private lastProcessedSellIdx: Map<string, number> = new Map();

/**
 * 增量撮合
 * 只处理上次撮合后新增的订单
 */
processIncrementalMatches(goodsId: string, currentTick: number): TradeRecord[] {
  const orderBook = marketOrderBook.getOrderBook(goodsId);
  if (!orderBook) return [];
  
  const lastBuyIdx = this.lastProcessedBuyIdx.get(goodsId) ?? 0;
  const lastSellIdx = this.lastProcessedSellIdx.get(goodsId) ?? 0;
  
  // 只检查新订单与所有对手方的匹配
  const trades: TradeRecord[] = [];
  
  // 新买单 vs 所有卖单
  for (let i = lastBuyIdx; i < orderBook.buyOrders.length; i++) {
    const buyOrder = orderBook.buyOrders[i];
    if (!this.isActiveOrder(buyOrder)) continue;
    
    for (const sellOrder of orderBook.sellOrders) {
      if (sellOrder.pricePerUnit > buyOrder.pricePerUnit) break;
      if (!this.isActiveOrder(sellOrder)) continue;
      
      const trade = this.executeTrade(buyOrder, sellOrder, currentTick);
      if (trade) trades.push(trade);
    }
  }
  
  // 新卖单 vs 已有买单
  for (let i = lastSellIdx; i < orderBook.sellOrders.length; i++) {
    const sellOrder = orderBook.sellOrders[i];
    if (!this.isActiveOrder(sellOrder)) continue;
    
    for (let j = 0; j < lastBuyIdx; j++) {
      const buyOrder = orderBook.buyOrders[j];
      if (sellOrder.pricePerUnit > buyOrder.pricePerUnit) break;
      if (!this.isActiveOrder(buyOrder)) continue;
      
      const trade = this.executeTrade(buyOrder, sellOrder, currentTick);
      if (trade) trades.push(trade);
    }
  }
  
  // 更新索引
  this.lastProcessedBuyIdx.set(goodsId, orderBook.buyOrders.length);
  this.lastProcessedSellIdx.set(goodsId, orderBook.sellOrders.length);
  
  return trades;
}
```

**预期效果**: 撮合时间复杂度从O(n²)降至O(n*m)（n为新订单数）

---

### 41.4.2 优先队列撮合
**目标**: 使用堆结构加速最优匹配

```typescript
// 使用最小/最大堆实现订单簿
import { MinHeap, MaxHeap } from './datastructures';

class OptimizedOrderBook {
  buyHeap: MaxHeap<MarketOrder>;  // 按价格降序
  sellHeap: MinHeap<MarketOrder>; // 按价格升序
  
  constructor() {
    this.buyHeap = new MaxHeap((a, b) => a.pricePerUnit - b.pricePerUnit);
    this.sellHeap = new MinHeap((a, b) => a.pricePerUnit - b.pricePerUnit);
  }
  
  getBestMatch(): { buy: MarketOrder; sell: MarketOrder } | null {
    const bestBuy = this.buyHeap.peek();
    const bestSell = this.sellHeap.peek();
    
    if (!bestBuy || !bestSell) return null;
    if (bestBuy.pricePerUnit < bestSell.pricePerUnit) return null;
    
    return { buy: bestBuy, sell: bestSell };
  }
}
```

**预期效果**: 最优匹配查找从O(1)保持，但插入从O(n)降至O(log n)

---

## Phase 41.5: 内存优化

### 41.5.1 订单历史压缩
**目标**: 减少历史订单的内存占用

```typescript
// 只保留活跃订单的完整信息
// 历史订单只保留摘要

interface OrderSummary {
  id: string;
  goodsId: string;
  companyId: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: OrderStatus;
  createdTick: number;
}

// 定期压缩已完成订单
compactOrders(maxAge: number = 1000): void {
  const cutoffTick = this.currentTick - maxAge;
  
  for (const [orderId, order] of this.orders) {
    if (order.lastUpdateTick < cutoffTick && 
        (order.status === 'filled' || order.status === 'cancelled' || order.status === 'expired')) {
      // 移除完整订单，保留摘要
      this.orderSummaries.set(orderId, this.summarize(order));
      this.orders.delete(orderId);
    }
  }
}
```

### 41.5.2 对象池复用
**目标**: 减少GC压力

```typescript
class OrderPool {
  private pool: MarketOrder[] = [];
  private readonly MAX_POOL_SIZE = 1000;
  
  acquire(): MarketOrder {
    return this.pool.pop() ?? this.createNew();
  }
  
  release(order: MarketOrder): void {
    if (this.pool.length < this.MAX_POOL_SIZE) {
      this.reset(order);
      this.pool.push(order);
    }
  }
  
  private reset(order: MarketOrder): void {
    order.id = '';
    order.companyId = '';
    order.goodsId = '';
    order.quantity = 0;
    order.remainingQuantity = 0;
    order.pricePerUnit = 0;
    order.status = 'open';
  }
}
```

---

## 实施计划

### 第一阶段：低风险优化（立即实施）
| 优化项 | 预期效果 | 风险 | 工时 |
|--------|----------|------|------|
| 订单清理频率降低 | 减少10-15ms | 低 | 0.5h |
| AI决策间隔增加 | 减少20-30ms | 低 | 0.5h |
| 市场分析缓存 | 减少10-20ms | 低 | 1h |
| LLM调用节流 | 减少API成本 | 低 | 0.5h |

### 第二阶段：中风险优化（测试后实施）
| 优化项 | 预期效果 | 风险 | 工时 |
|--------|----------|------|------|
| 订单合并策略 | 减少40-60ms | 中 | 2h |
| 批量订单提交 | 减少20-30ms | 中 | 1.5h |
| 生产批量计算 | 减少10-15ms | 中 | 1.5h |

### 第三阶段：高风险优化（充分测试）
| 优化项 | 预期效果 | 风险 | 工时 |
|--------|----------|------|------|
| 增量撮合引擎 | 减少30-50ms | 高 | 3h |
| 优先队列订单簿 | 减少20-30ms | 高 | 4h |
| 内存压缩 | 减少内存50MB | 中 | 2h |

---

## 监控指标

### 性能KPI
```
目标 tick 耗时: < 100ms (当前254ms)
目标 P95: < 200ms (当前530ms)
目标订单数: < 300/tick (当前600+)
```

### 经济健康KPI
```
市场成交率: > 30% (监控交易是否正常)
价格波动: < 10%/tick (监控市场稳定性)
AI公司存活率: 100% (监控破产情况)
```

---

## 回滚计划

每个优化都设计为可独立开关的特性：

```typescript
// packages/server/src/config/performanceConfig.ts

export const PERFORMANCE_FLAGS = {
  ORDER_AGGREGATION: true,       // 订单合并
  BATCH_ORDER_SUBMIT: true,      // 批量提交
  LAZY_CLEANUP: true,            // 惰性清理
  AI_DECISION_THROTTLE: true,    // AI决策节流
  MARKET_ANALYSIS_CACHE: true,   // 市场分析缓存
  INCREMENTAL_MATCHING: false,   // 增量撮合（默认关闭）
  HEAP_ORDER_BOOK: false,        // 堆订单簿（默认关闭）
};
```

如果优化导致问题，可以通过配置快速关闭。

---

## 总结

通过以上优化，预期可以将平均tick耗时从**254ms降至<100ms**：

| 优化类别 | 预期减少 |
|----------|----------|
| 订单系统 | 80-100ms |
| AI决策 | 50-60ms |
| 生产系统 | 10-15ms |
| 撮合引擎 | 30-50ms |

**总计预期减少**: 170-225ms

**优化后目标**: 50-80ms/tick，满足50ms目标帧率