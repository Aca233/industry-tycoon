# Phase 22: 市场活力与性能优化方案

## 问题诊断

### 问题1：市场没有活力（成交量为0）

**根本原因：供应链完全断裂**

```
📈 市场订单: 总买单=810, 总卖单=456, 本轮成交=0
🛒 产品市场需求: iron-ore:无买单
```

**供需错配分析：**

| 角色 | 生产/需求 | 问题 |
|------|-----------|------|
| 消费者POPs | 需求14种终端消费品（beverages, smartphone, electric-vehicle等） | 没有人生产这些商品 |
| 玩家 | 生产iron-ore（铁矿石） | 没有下游工厂采购iron-ore |
| AI公司 | 生产coal, silica-sand, crude-oil等原材料 | 同样无人采购 |
| 中间环节 | 钢铁厂需要iron-ore → 汽车厂需要steel | 供应链断裂 |

**核心问题：**
1. POPs只购买**终端消费品**，但市场上无人生产
2. 玩家和AI公司生产**原材料**，但无下游工厂消费
3. AI公司多数**濒临破产**（"预算不足，无可购买建筑"）

### 问题2：性能问题

```
[PerformanceProfiler] ⚠️ 慢tick警告: tick=5994, 耗时=178.7ms (阈值: 50ms)
```

**性能瓶颈：**
- 每tick提交14个消费者买单 × 无成交 = 订单累积
- 40+家AI公司每tick决策，大部分无有效动作
- 订单簿膨胀（买单810+卖单456=1266个活跃订单）

---

## 解决方案

### 方案A：增加市场活力（核心改进）

#### A1. 添加NPC工业消费者
**目标：为原材料创造需求**

```typescript
// 新增文件: packages/server/src/services/industrialDemand.ts
/**
 * NPC工业消费者 - 模拟中间工厂的原料采购
 * 这些虚拟工厂不生产商品，只消费原材料
 */

const INDUSTRIAL_DEMAND_CONFIG = {
  // 原材料需求（每tick）
  'iron-ore': { dailyDemand: 500, buyerName: '钢铁工业联盟' },
  'coal': { dailyDemand: 400, buyerName: '能源消费联合体' },
  'copper-ore': { dailyDemand: 200, buyerName: '电子工业协会' },
  'silica-sand': { dailyDemand: 300, buyerName: '玻璃陶瓷联盟' },
  'crude-oil': { dailyDemand: 250, buyerName: '石化工业集团' },
  'natural-gas': { dailyDemand: 200, buyerName: '天然气消费联盟' },
  'bauxite': { dailyDemand: 150, buyerName: '铝业工业协会' },
  // 中间产品需求
  'steel': { dailyDemand: 200, buyerName: '机械制造联盟' },
  'aluminum': { dailyDemand: 100, buyerName: '航空工业集团' },
  'plastic': { dailyDemand: 150, buyerName: '日用品制造联盟' },
  'glass': { dailyDemand: 100, buyerName: '建材工业协会' },
};
```

**实现要点：**
- 创建虚拟NPC公司，每日自动采购原材料
- 采购价格 = 市场价 × (1.0 ~ 1.05)，确保能与AI卖单成交
- 采购量随供应量动态调整（供应多时多买）

#### A2. 修复AI公司破产问题
**目标：让AI公司有钱参与市场**

```typescript
// 修改: packages/server/src/services/aiCompanyManager.ts

// 在 processCompanyProduction() 中增加破产救济
private processCompanyProduction(company: AICompanyState, context: GameContext): void {
  // ... 现有逻辑 ...
  
  // 增强版破产救济
  // 原来：company.cash < 0 时救济1000万
  // 改进：company.cash < 建筑维护成本×30 时救济
  const monthlyMaintenance = this.calculateMonthlyMaintenance(company);
  if (company.cash < monthlyMaintenance * 30) {
    const bailoutAmount = Math.max(50_000_000, monthlyMaintenance * 60);
    inventoryManager.addCash(company.id, bailoutAmount, context.currentTick, 'bailout');
    company.cash += bailoutAmount;
    console.log(`[AIManager] ${company.name} 获得救济 ${(bailoutAmount/10000).toFixed(0)}万`);
  }
}
```

#### A3. 优化价格匹配
**目标：让买单和卖单能够成交**

当前问题：
- 消费者买单价格：`5089.717463811608`（beverages）
- AI卖单价格可能差异过大

```typescript
// 修改: packages/server/src/services/popsConsumption.ts

// 提高消费者愿意支付的价格倍数
const DEFAULT_CONFIG: POPsConsumptionConfig = {
  // 原来：maxPriceMultiplier: 1.1
  maxPriceMultiplier: 1.2,  // 提高到20%溢价
  orderSamplingRate: 0.005, // 从0.1%提高到0.5%
  maxOrderQuantityPerGoods: 2000, // 从1000提高到2000
};
```

#### A4. 添加市场做市商
**目标：保证每种商品都有买卖双向订单**

```typescript
// 新增文件: packages/server/src/services/marketMaker.ts
/**
 * 市场做市商 - 确保市场流动性
 * 在市场价格附近同时挂买单和卖单
 */

class MarketMaker {
  private readonly SPREAD_PERCENT = 0.03; // 买卖价差3%
  
  processTick(currentTick: number): void {
    for (const goods of GOODS_DATA) {
      const marketPrice = priceDiscoveryService.getPrice(goods.id);
      const orderBook = marketOrderBook.getOrderBook(goods.id);
      
      // 如果买单太少，添加买单
      if (orderBook.buyOrders.length < 5) {
        const buyPrice = marketPrice * (1 - this.SPREAD_PERCENT);
        marketOrderBook.submitBuyOrder(
          'market-maker',
          goods.id,
          100,
          buyPrice,
          currentTick,
          10
        );
      }
      
      // 如果卖单太少，添加卖单（无限供应的"进口商"）
      if (orderBook.sellOrders.length < 5) {
        const sellPrice = marketPrice * (1 + this.SPREAD_PERCENT);
        // 做市商可以"凭空"创造商品供应
        marketOrderBook.submitSellOrder(
          'market-maker',
          goods.id,
          100,
          sellPrice,
          currentTick,
          10
        );
      }
    }
  }
}
```

### 方案B：性能优化

#### B1. 降低消费者订单频率

```typescript
// 修改: packages/server/src/services/popsConsumption.ts

class POPsConsumptionManager {
  // 原来：每tick处理一次
  // 改进：每3 tick处理一次
  private readonly PROCESS_INTERVAL = 3;
  
  // 进一步合并订单，减少每次提交数量
  private readonly MAX_ORDERS_PER_TICK = 20; // 从50减少到20
}
```

#### B2. AI公司决策频率降低

```typescript
// 修改: packages/server/src/services/aiCompanyManager.ts

// 增加决策间隔
private readonly DECISION_INTERVAL_MIN = 20;  // 从10改为20
private readonly DECISION_INTERVAL_MAX = 40;  // 从25改为40

// 战略刷新间隔延长
strategyRefreshInterval: 2000, // 从1000改为2000 tick
```

#### B3. 订单簿自动清理增强

```typescript
// 修改: packages/server/src/services/marketOrderBook.ts

// 降低订单有效期，加速清理
private readonly DEFAULT_VALIDITY_TICKS = 12; // 从24改为12

// 增加积极清理机制
private readonly MAX_ORDERS_PER_GOODS = 50; // 从100降到50
```

#### B4. 批量订单提交优化

```typescript
// 修改: packages/server/src/services/popsConsumption.ts

// 使用批量提交代替单个提交
submitBatchOrders(orders: Order[]): void {
  // 一次性处理多个订单，减少函数调用开销
  for (const order of orders) {
    this.orderBook.set(order.id, order);
  }
  // 批量触发撮合
  matchingEngine.markGoodsForMatching(orders.map(o => o.goodsId));
}
```

---

## 实施计划

### 第1步：添加NPC工业消费者（优先级最高）
- [ ] 创建 `industrialDemand.ts` 服务
- [ ] 在 `economyManager.ts` 中集成
- [ ] 测试iron-ore是否能成交

### 第2步：修复AI公司破产问题
- [ ] 修改 `aiCompanyManager.ts` 破产救济逻辑
- [ ] 增加bailout金额和触发阈值

### 第3步：添加市场做市商
- [ ] 创建 `marketMaker.ts` 服务
- [ ] 确保每种商品都有流动性

### 第4步：性能优化
- [ ] 降低POPs订单频率
- [ ] 增加AI决策间隔
- [ ] 缩短订单有效期
- [ ] 减少订单簿上限

---

## 预期效果

### 市场活力
- iron-ore等原材料将有NPC工业消费者采购
- AI公司有足够资金参与市场竞争
- 订单成交量从0提升到每tick 50-100笔

### 性能改进
- Tick耗时从170-200ms降到50-80ms
- 活跃订单数从1200+降到300-500
- 游戏运行平滑度大幅提升

---

## 风险和注意事项

1. **NPC消费者可能导致玩家太容易赚钱**
   - 解决：设置采购量上限，价格不超过市价5%

2. **做市商可能破坏价格发现机制**
   - 解决：只在订单过少时介入，不主导市场

3. **AI救济可能导致通货膨胀**
   - 解决：救济金额与维护成本挂钩，不是固定值