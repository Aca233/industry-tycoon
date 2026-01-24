# 供应链指挥官 - 性能优化方案

## 📊 性能分析摘要

基于5000 tick性能测试结果（当前进度~3380 tick）：

### 当前性能指标
| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| 平均Tick耗时 | 320.2ms | <50ms | ❌ 严重超标 |
| P50 | 246ms | <30ms | ❌ 严重超标 |
| P95 | 794ms | <100ms | ❌ 严重超标 |
| P99 | 1391ms | <200ms | ❌ 严重超标 |
| 超50ms阈值 | 100% | <10% | ❌ 严重超标 |

### 性能热点分析
```
economyUpdate:     285ms (89.0%) ⬅️ 主要瓶颈
aiCompanyDecision: 175ms (54.5%) ⬅️ 次要瓶颈  
stockMarket:       0.54ms (0.17%)
buildingProduction: 0.007ms (0.002%)
```

---

## 🎯 优化目标

### 核心原则
1. **保持经济体系准确性** - 不改变市场供需计算逻辑
2. **降低计算复杂度** - 通过算法优化而非逻辑简化
3. **分散计算负载** - 避免单tick内过多计算
4. **增量计算** - 利用缓存和增量更新

### 目标指标
- 平均Tick耗时: <50ms
- P95 耗时: <100ms
- 超50ms比例: <10%

---

## 📋 优化方案

### 第一阶段: economyUpdate 优化（预期提升60%）

#### 1.1 订单生成批量优化

**问题**: 每个商品每tick都生成多个订单，导致大量重复计算

**当前代码模式**:
```typescript
// 每tick为每个商品生成20+订单
for (const good of goods) {
  for (let i = 0; i < orderCount; i++) {
    submitOrder(calculatePrice(), calculateQuantity());
  }
}
```

**优化方案**:
```typescript
// 方案1: 订单聚合 - 合并相似价格的订单
class OrderAggregator {
  private pendingOrders: Map<string, AggregatedOrder> = new Map();
  
  addOrder(goodId: string, price: number, quantity: number, side: 'buy' | 'sell') {
    const key = `${goodId}-${side}-${this.getPriceBucket(price)}`;
    const existing = this.pendingOrders.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.totalValue += price * quantity;
    } else {
      this.pendingOrders.set(key, { goodId, side, quantity, totalValue: price * quantity });
    }
  }
  
  flush(): Order[] {
    const orders = [...this.pendingOrders.values()].map(agg => ({
      goodId: agg.goodId,
      side: agg.side,
      quantity: agg.quantity,
      price: agg.totalValue / agg.quantity  // 加权平均价格
    }));
    this.pendingOrders.clear();
    return orders;
  }
  
  private getPriceBucket(price: number): number {
    // 价格桶宽度1%，相近价格合并
    return Math.floor(price / (price * 0.01));
  }
}
```

**预期效果**: 减少80%的订单对象创建

#### 1.2 需求计算缓存

**问题**: 每tick重新计算所有人口的需求

**优化方案**:
```typescript
class DemandCache {
  private demandCache: Map<string, CachedDemand> = new Map();
  private cacheValidTicks = 5;  // 缓存有效期5 tick
  
  getDemand(popGroup: PopGroup, currentTick: number): DemandResult {
    const key = `${popGroup.id}-${popGroup.size}-${popGroup.wealth}`;
    const cached = this.demandCache.get(key);
    
    if (cached && currentTick - cached.tick < this.cacheValidTicks) {
      // 缓存命中，应用小幅随机波动
      return this.applyVolatility(cached.demand, 0.02);
    }
    
    // 缓存失效，重新计算
    const demand = this.calculateDemand(popGroup);
    this.demandCache.set(key, { demand, tick: currentTick });
    return demand;
  }
  
  private applyVolatility(demand: DemandResult, volatility: number): DemandResult {
    return {
      ...demand,
      quantity: demand.quantity * (1 + (Math.random() - 0.5) * volatility)
    };
  }
}
```

**预期效果**: 减少80%的需求计算

#### 1.3 建筑生产批量处理

**问题**: 每个建筑独立计算生产

**优化方案**:
```typescript
class BatchProductionProcessor {
  processProduction(buildings: Building[]): ProductionResult[] {
    // 按建筑类型分组
    const buildingsByType = this.groupByType(buildings);
    
    return Object.entries(buildingsByType).flatMap(([type, buildings]) => {
      // 同类型建筑批量计算
      return this.batchCalculate(type, buildings);
    });
  }
  
  private batchCalculate(type: string, buildings: Building[]): ProductionResult[] {
    const definition = getBuildingDefinition(type);
    
    // 预计算共享参数
    const baseCosts = this.calculateBaseCosts(definition);
    const baseOutput = this.calculateBaseOutput(definition);
    
    // 只对每个建筑计算差异部分
    return buildings.map(building => ({
      buildingId: building.id,
      output: baseOutput * building.efficiency,
      costs: this.applyBuildingModifiers(baseCosts, building)
    }));
  }
}
```

**预期效果**: 减少40%的生产计算时间

#### 1.4 价格计算优化

**问题**: 价格发现算法复杂度高

**优化方案**:
```typescript
class OptimizedPriceDiscovery {
  private priceCache: Map<string, PriceCache> = new Map();
  
  discoverPrice(goodId: string, orderBook: OrderBook): number {
    const cache = this.priceCache.get(goodId);
    const orderBookHash = this.hashOrderBook(orderBook);
    
    // 订单簿无变化时使用缓存
    if (cache && cache.hash === orderBookHash) {
      return cache.price;
    }
    
    // 使用优化的算法
    const price = this.calculateEquilibriumPrice(orderBook);
    this.priceCache.set(goodId, { price, hash: orderBookHash });
    return price;
  }
  
  private hashOrderBook(orderBook: OrderBook): string {
    // 快速哈希：只考虑前10个买卖订单
    const topBuys = orderBook.bids.slice(0, 10);
    const topSells = orderBook.asks.slice(0, 10);
    return `${topBuys.length}-${topSells.length}-${topBuys[0]?.price}-${topSells[0]?.price}`;
  }
  
  private calculateEquilibriumPrice(orderBook: OrderBook): number {
    // 二分查找均衡价格，复杂度 O(log n)
    let low = orderBook.asks[0]?.price || 0;
    let high = orderBook.bids[0]?.price || low * 2;
    
    for (let i = 0; i < 20; i++) {  // 最多20次迭代
      const mid = (low + high) / 2;
      const { supply, demand } = this.calculateSupplyDemand(orderBook, mid);
      
      if (Math.abs(supply - demand) < 0.01 * demand) {
        return mid;
      }
      
      if (supply > demand) {
        high = mid;
      } else {
        low = mid;
      }
    }
    
    return (low + high) / 2;
  }
}
```

**预期效果**: 减少50%的价格计算时间

---

### 第二阶段: aiCompanyDecision 优化（预期提升70%）

#### 2.1 AI决策频率分散

**问题**: 所有AI公司同一tick决策，造成计算尖峰

**优化方案**:
```typescript
class AIDecisionScheduler {
  private schedules: Map<string, number> = new Map();
  private baseInterval = 5;  // 基础决策间隔
  
  shouldMakeDecision(companyId: string, currentTick: number): boolean {
    const lastDecision = this.schedules.get(companyId) || 0;
    const interval = this.getDecisionInterval(companyId);
    
    return currentTick - lastDecision >= interval;
  }
  
  private getDecisionInterval(companyId: string): number {
    // 根据公司ID生成不同的决策间隔
    const hash = this.hashCompanyId(companyId);
    // 间隔在5-10 tick之间分散
    return this.baseInterval + (hash % 6);
  }
  
  recordDecision(companyId: string, currentTick: number) {
    this.schedules.set(companyId, currentTick);
  }
}

// 在gameLoop中使用
async processAIDecisions(companies: AICompany[], currentTick: number) {
  const scheduler = this.aiDecisionScheduler;
  
  // 只处理本tick需要决策的公司
  const companiesToProcess = companies.filter(c => 
    scheduler.shouldMakeDecision(c.id, currentTick)
  );
  
  // 每tick最多处理3家公司
  const batch = companiesToProcess.slice(0, 3);
  
  for (const company of batch) {
    await this.processCompanyDecision(company);
    scheduler.recordDecision(company.id, currentTick);
  }
}
```

**预期效果**: 将峰值负载分散到多个tick

#### 2.2 简化已达上限公司的处理

**问题**: 已达建筑上限的公司仍进行完整决策流程

**优化方案**:
```typescript
class AICompanyManager {
  async makeDecision(company: AICompany): Promise<void> {
    // 快速路径：已达建筑上限且现金充足
    if (company.buildings.length >= 30) {
      // 只执行简单的方法切换检查
      await this.checkMethodOptimization(company);
      return;
    }
    
    // 完整决策流程
    await this.fullDecisionProcess(company);
  }
  
  private async checkMethodOptimization(company: AICompany): Promise<void> {
    // 每10 tick检查一次方法优化
    if (company.lastMethodCheck && 
        Date.now() - company.lastMethodCheck < 10000) {
      return;
    }
    
    // 简化的方法优化逻辑
    const inefficientBuildings = company.buildings.filter(b => 
      b.efficiency < 0.7
    );
    
    if (inefficientBuildings.length > 0) {
      await this.optimizeMethod(inefficientBuildings[0]);
    }
    
    company.lastMethodCheck = Date.now();
  }
}
```

**预期效果**: 减少90%已达上限公司的决策时间

#### 2.3 LLM调用优化

**问题**: LLM调用阻塞主线程

**优化方案**:
```typescript
class AsyncLLMDecisionMaker {
  private pendingDecisions: Map<string, Promise<Decision>> = new Map();
  private decisionCache: Map<string, CachedDecision> = new Map();
  
  async getDecision(company: AICompany, context: DecisionContext): Promise<Decision> {
    // 检查缓存
    const cacheKey = this.getCacheKey(company, context);
    const cached = this.decisionCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached.decision;
    }
    
    // 检查是否有pending的决策
    const pending = this.pendingDecisions.get(company.id);
    if (pending) {
      return pending;
    }
    
    // 使用性格决策作为快速fallback
    if (!context.requiresLLM) {
      return this.personalityBasedDecision(company);
    }
    
    // 异步请求LLM（不阻塞主循环）
    const promise = this.requestLLMDecision(company, context);
    this.pendingDecisions.set(company.id, promise);
    
    // 返回临时决策，等待LLM结果
    return this.personalityBasedDecision(company);
  }
  
  // 后台处理LLM结果
  async processCompletedDecisions(): Promise<void> {
    for (const [companyId, promise] of this.pendingDecisions) {
      if (await this.isResolved(promise)) {
        const decision = await promise;
        this.decisionCache.set(companyId, {
          decision,
          timestamp: Date.now()
        });
        this.pendingDecisions.delete(companyId);
      }
    }
  }
}
```

**预期效果**: 消除LLM调用对主循环的阻塞

---

### 第三阶段: 订单撮合优化（预期提升20%）

#### 3.1 增量订单簿更新

**优化方案**:
```typescript
class IncrementalOrderBook {
  private bids: SortedArray<Order>;
  private asks: SortedArray<Order>;
  private dirty: boolean = false;
  
  addOrder(order: Order): void {
    if (order.side === 'buy') {
      this.bids.insert(order);  // O(log n) 插入
    } else {
      this.asks.insert(order);  // O(log n) 插入
    }
    this.dirty = true;
  }
  
  removeOrder(orderId: string): void {
    // O(log n) 删除
    this.bids.removeById(orderId);
    this.asks.removeById(orderId);
    this.dirty = true;
  }
  
  match(): Trade[] {
    if (!this.dirty) {
      return [];  // 无变化，跳过撮合
    }
    
    const trades: Trade[] = [];
    
    // 只撮合到价格不再交叉
    while (this.canMatch()) {
      const trade = this.executeTopMatch();
      trades.push(trade);
    }
    
    this.dirty = false;
    return trades;
  }
  
  private canMatch(): boolean {
    return this.bids.length > 0 && 
           this.asks.length > 0 && 
           this.bids[0].price >= this.asks[0].price;
  }
}
```

**预期效果**: 减少50%的订单簿操作时间

#### 3.2 过期订单批量清理

**优化方案**:
```typescript
class OrderCleanupManager {
  private expirationQueue: PriorityQueue<ExpiringOrder>;
  
  scheduleExpiration(order: Order, expireTick: number): void {
    this.expirationQueue.push({ order, expireTick });
  }
  
  cleanupExpired(currentTick: number): string[] {
    const expired: string[] = [];
    
    // 批量清理，一次最多清理100个
    let count = 0;
    while (!this.expirationQueue.isEmpty() && count < 100) {
      const top = this.expirationQueue.peek();
      if (top.expireTick <= currentTick) {
        this.expirationQueue.pop();
        expired.push(top.order.id);
        count++;
      } else {
        break;
      }
    }
    
    return expired;
  }
}
```

**预期效果**: 减少订单清理的CPU开销

---

### 第四阶段: 内存优化

#### 4.1 对象池复用

**优化方案**:
```typescript
class OrderPool {
  private pool: Order[] = [];
  private maxSize = 10000;
  
  acquire(): Order {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createNew();
  }
  
  release(order: Order): void {
    if (this.pool.length < this.maxSize) {
      this.resetOrder(order);
      this.pool.push(order);
    }
  }
  
  private resetOrder(order: Order): void {
    order.id = '';
    order.goodId = '';
    order.price = 0;
    order.quantity = 0;
    order.side = 'buy';
    order.timestamp = 0;
  }
}
```

**预期效果**: 减少GC压力，内存增长速度降低50%

#### 4.2 历史数据压缩

**优化方案**:
```typescript
class CompressedPriceHistory {
  private data: Float32Array;  // 使用TypedArray减少内存
  private timestamps: Uint32Array;
  private capacity: number;
  private length: number = 0;
  
  constructor(capacity: number = 10000) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity);
    this.timestamps = new Uint32Array(capacity);
  }
  
  add(price: number, timestamp: number): void {
    if (this.length >= this.capacity) {
      this.compact();  // 压缩旧数据
    }
    this.data[this.length] = price;
    this.timestamps[this.length] = timestamp;
    this.length++;
  }
  
  private compact(): void {
    // 保留最近50%的数据，其余采样压缩
    const keepCount = Math.floor(this.capacity * 0.5);
    const compressCount = this.capacity - keepCount;
    
    // 压缩旧数据：每2个采样1个
    const sampledLength = Math.floor(compressCount / 2);
    for (let i = 0; i < sampledLength; i++) {
      this.data[i] = this.data[i * 2];
      this.timestamps[i] = this.timestamps[i * 2];
    }
    
    // 复制保留的数据
    for (let i = 0; i < keepCount; i++) {
      this.data[sampledLength + i] = this.data[compressCount + i];
      this.timestamps[sampledLength + i] = this.timestamps[compressCount + i];
    }
    
    this.length = sampledLength + keepCount;
  }
}
```

**预期效果**: 减少60%的历史数据内存占用

---

## 📅 实施计划

### Week 1: economyUpdate 核心优化
| 任务 | 预计耗时 | 优先级 |
|------|---------|--------|
| 订单聚合器实现 | 4h | P0 |
| 需求计算缓存 | 3h | P0 |
| 价格计算优化 | 4h | P0 |
| 测试验证 | 2h | P0 |

### Week 2: aiCompanyDecision 优化
| 任务 | 预计耗时 | 优先级 |
|------|---------|--------|
| AI决策分散调度 | 3h | P0 |
| 已达上限公司快速路径 | 2h | P0 |
| LLM异步处理 | 4h | P1 |
| 测试验证 | 2h | P0 |

### Week 3: 订单撮合与内存优化
| 任务 | 预计耗时 | 优先级 |
|------|---------|--------|
| 增量订单簿 | 4h | P1 |
| 过期订单优化 | 2h | P1 |
| 对象池实现 | 3h | P1 |
| 历史数据压缩 | 3h | P2 |

---

## 🔧 快速修复方案（可立即实施）

### Quick Fix 1: 降低订单生成频率

修改 `packages/server/src/services/economyManager.ts`:

```typescript
// 当前：每tick每商品生成20+订单
// 修改为：每tick每商品最多生成5个聚合订单

const MAX_ORDERS_PER_GOOD = 5;
const PRICE_BUCKET_WIDTH = 0.02;  // 2%价格桶

function generateAggregatedOrders(demand: number, basePrice: number): Order[] {
  const orders: Order[] = [];
  const buckets: Map<number, { quantity: number; priceSum: number }> = new Map();
  
  // 将需求分配到价格桶
  for (let i = 0; i < demand; i++) {
    const variance = (Math.random() - 0.5) * 0.1;  // ±5%
    const price = basePrice * (1 + variance);
    const bucket = Math.floor(price / (basePrice * PRICE_BUCKET_WIDTH));
    
    const existing = buckets.get(bucket) || { quantity: 0, priceSum: 0 };
    existing.quantity += 1;
    existing.priceSum += price;
    buckets.set(bucket, existing);
  }
  
  // 只生成聚合订单
  for (const [_, data] of buckets) {
    if (orders.length >= MAX_ORDERS_PER_GOOD) break;
    orders.push({
      price: data.priceSum / data.quantity,
      quantity: data.quantity
    });
  }
  
  return orders;
}
```

### Quick Fix 2: AI决策节流

修改 `packages/server/src/services/aiCompanyManager.ts`:

```typescript
// 添加决策节流
private decisionThrottles: Map<string, number> = new Map();
private readonly DECISION_INTERVAL = 5;  // 每5 tick决策一次

async processAICompanies(companies: AICompany[], currentTick: number): Promise<void> {
  // 过滤需要决策的公司
  const needDecision = companies.filter(company => {
    const lastTick = this.decisionThrottles.get(company.id) || 0;
    return currentTick - lastTick >= this.DECISION_INTERVAL;
  });
  
  // 每tick最多处理2家公司
  const batch = needDecision.slice(0, 2);
  
  for (const company of batch) {
    // 已达建筑上限的快速处理
    if (company.buildings.length >= 30) {
      await this.quickMethodCheck(company);
    } else {
      await this.fullDecision(company);
    }
    this.decisionThrottles.set(company.id, currentTick);
  }
}
```

### Quick Fix 3: 减少日志输出

修改各服务的日志输出：

```typescript
// 将频繁日志改为采样输出
class SampledLogger {
  private counter = 0;
  private sampleRate = 10;  // 每10次输出1次
  
  log(message: string): void {
    this.counter++;
    if (this.counter % this.sampleRate === 0) {
      console.log(message);
    }
  }
}

// 使用
const orderLogger = new SampledLogger();
orderLogger.log(`[MarketOrderBook] Buy order submitted...`);
```

---

## 📊 预期优化效果

| 优化项 | 当前耗时 | 优化后 | 改善幅度 |
|--------|---------|--------|---------|
| economyUpdate | 285ms | ~60ms | 78% ⬇️ |
| aiCompanyDecision | 175ms | ~30ms | 83% ⬇️ |
| 总tick耗时 | 320ms | ~50ms | 84% ⬇️ |
| P95 | 794ms | ~100ms | 87% ⬇️ |
| 内存增长 | +112MB/3000tick | +30MB | 73% ⬇️ |

---

## ⚠️ 注意事项

### 保持市场准确性
1. 订单聚合不改变总需求量
2. 价格发现算法结果保持一致
3. AI决策分散不影响长期战略

### 测试验证
1. 对比优化前后的市场价格分布
2. 验证AI公司资产增长曲线一致
3. 确认玩家游戏体验无变化

### 回滚计划
1. 保留优化开关
2. 性能异常自动禁用优化
3. 日志记录优化影响

---

## 🔍 监控指标

```typescript
// 添加优化效果监控
interface OptimizationMetrics {
  orderAggregationRatio: number;     // 订单聚合率
  cacheHitRate: number;              // 缓存命中率
  aiDecisionBatchSize: number;       // AI批处理大小
  avgTickTime: number;               // 平均tick时间
  gcFrequency: number;               // GC频率
}