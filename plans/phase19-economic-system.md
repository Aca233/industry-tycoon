# Phase 19: 完整经济系统设计

## 一、系统概述

本阶段实现了一个完整的基于订单撮合的经济系统，取代了原有的简化供需模型。新系统实现了：

1. **库存管理** - 每个公司（玩家、AI、NPC）都有独立的库存
2. **订单簿交易** - 买卖双方通过订单簿进行匹配交易
3. **价格发现** - 价格由实际成交价决定，而非模拟的供需比例
4. **NPC经济** - 虚拟公司群模拟城市经济的供给和需求

## 二、核心组件

### 2.1 库存管理器 (InventoryManager)

**文件**: `packages/server/src/services/inventoryManager.ts`

管理所有公司的商品库存和现金：

```typescript
interface GoodsStock {
  goodsId: string;
  quantity: number;           // 可用数量
  reservedForSale: number;    // 已挂卖单的预留
  reservedForProduction: number; // 生产锁定
  avgCost: number;            // 加权平均成本
  lastUpdateTick: number;
}

interface CompanyInventory {
  companyId: string;
  companyType: CompanyType;   // Player | AICompetitor | NPC
  companyName: string;
  cash: number;
  stocks: Record<string, GoodsStock>;
  createdTick: number;
}
```

**核心功能**：
- `initializeCompany()` - 初始化公司库存
- `addGoods()` - 添加商品（生产完成）
- `consumeGoods()` - 消耗商品（生产投入）
- `reserveForSale()` / `unreserveForSale()` - 销售预留管理
- `completeSale()` / `completePurchase()` - 完成交易

### 2.2 订单簿 (MarketOrderBook)

**文件**: `packages/server/src/services/marketOrderBook.ts`

管理所有商品的买卖订单：

```typescript
interface MarketOrder {
  id: string;
  companyId: string;
  goodsId: string;
  orderType: 'buy' | 'sell';
  quantity: number;
  remainingQuantity: number;
  pricePerUnit: number;       // 买单：最高可接受价，卖单：最低可接受价
  status: 'open' | 'partial' | 'filled' | 'cancelled' | 'expired';
  createdTick: number;
  expiryTick: number;
}

interface GoodsOrderBook {
  goodsId: string;
  buyOrders: MarketOrder[];   // 按价格降序排列
  sellOrders: MarketOrder[];  // 按价格升序排列
  bestBid: number | null;     // 最佳买价
  bestAsk: number | null;     // 最佳卖价
  spread: number | null;      // 买卖价差
}
```

**核心功能**：
- `submitBuyOrder()` / `submitSellOrder()` - 提交订单
- `cancelOrder()` - 取消订单
- `getMatchableOrders()` - 获取可匹配的订单对
- `getMarketDepth()` - 获取市场深度
- `cleanupExpiredOrders()` - 清理过期订单

### 2.3 撮合引擎 (MatchingEngine)

**文件**: `packages/server/src/services/matchingEngine.ts`

匹配买卖订单并执行交易：

```typescript
interface TradeRecord {
  id: string;
  goodsId: string;
  buyerCompanyId: string;
  sellerCompanyId: string;
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  pricePerUnit: number;
  totalValue: number;
  tick: number;
  timestamp: number;
}
```

**撮合规则**：
1. 买单价格 >= 卖单价格时可成交
2. 成交价使用卖价（对买方有利）
3. 同价优先时间优先
4. 不允许自成交（同一公司）

**核心功能**：
- `processAllMatches()` - 处理所有商品的订单撮合
- `executeTrade()` - 执行单笔交易
- `getTradeHistory()` - 获取交易历史
- `getVWAP()` - 获取成交量加权平均价

### 2.4 价格发现服务 (PriceDiscoveryService)

**文件**: `packages/server/src/services/priceDiscovery.ts`

基于成交价和订单簿信息确定市场价格：

**价格计算信号**（按权重）：
1. 最近成交价 (50%)
2. 买卖价中间价 (30%)
3. 供需压力调整 (10%)
4. 当前价格惯性 (10%)

**核心功能**：
- `updateAllPrices()` - 更新所有商品价格
- `getPrice()` - 获取商品当前价格
- `getPriceHistory()` - 获取价格历史
- `getVolatility()` - 获取价格波动率
- `getMarketOverview()` - 获取市场总览

### 2.5 NPC公司管理器 (NPCCompanyManager)

**文件**: `packages/server/src/services/npcCompanies.ts`

模拟城市经济中的虚拟公司：

**NPC公司类型**：
1. **供应商 (Supplier)** - 生产原材料，无限供给源
2. **消费者 (Consumer)** - 城市居民群体，产生最终需求
3. **加工商 (Processor)** - 中间环节，采购原料生产产品

**行为模式**：
- 定期生产商品并添加到库存
- 定期发布买卖订单
- 消费者每天获得收入（模拟工资）
- 根据库存和市场价格动态调整订单

### 2.6 经济管理器 (EconomyManager)

**文件**: `packages/server/src/services/economyManager.ts`

统一协调所有经济子系统：

```typescript
class EconomyManager {
  // 每tick更新经济系统
  update(currentTick: number): { trades: TradeRecord[]; stats: EconomyStats }
  
  // 玩家操作
  playerSubmitBuyOrder(companyId, goodsId, quantity, maxPrice)
  playerSubmitSellOrder(companyId, goodsId, quantity, minPrice)
  playerCancelOrder(companyId, orderId)
  
  // 查询接口
  getMarketPrice(goodsId): number
  getOrderBook(goodsId): GoodsOrderBook
  getMarketDepth(goodsId): MarketDepth
  getTradeHistory(goodsId): TradeRecord[]
}
```

## 三、数据流

```
┌──────────────────────────────────────────────────────────────────┐
│                         每tick更新流程                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. NPC公司更新                                                  │
│     ├─ 生产商品 → 添加到库存                                     │
│     ├─ 消费者获得收入                                            │
│     └─ 发布买卖订单 → 订单簿                                     │
│                                                                  │
│  2. 清理过期订单                                                 │
│     └─ 释放预留的库存/资金                                       │
│                                                                  │
│  3. 订单撮合                                                     │
│     ├─ 匹配买卖订单                                              │
│     ├─ 执行交易                                                  │
│     │   ├─ 买方支付货款 → 获得商品                               │
│     │   └─ 卖方交付商品 → 获得货款                               │
│     └─ 记录交易历史                                              │
│                                                                  │
│  4. 价格发现                                                     │
│     ├─ 收集最新成交价                                            │
│     ├─ 分析订单簿深度                                            │
│     └─ 计算新的市场价格                                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 四、与现有系统的集成

### 4.1 与 GameLoop 的集成

```typescript
// gameLoop.ts 中添加
import { economyManager } from './economyManager.js';

// 在 processTick() 中
private processTick(gameId: string): void {
  // ... 现有逻辑 ...
  
  // 更新经济系统
  const { trades, stats } = economyManager.update(game.currentTick);
  
  // 使用新的价格系统
  for (const [goodsId] of game.marketPrices) {
    game.marketPrices.set(goodsId, economyManager.getMarketPrice(goodsId));
  }
}
```

### 4.2 建筑生产逻辑修改

```typescript
// 生产完成时，不再直接增加现金，而是添加到库存
if (produced) {
  for (const output of recipe.outputs) {
    inventoryManager.addGoods(
      game.playerCompanyId,
      output.goodsId,
      output.amount,
      calculateProductionCost(recipe),
      currentTick
    );
  }
  // 玩家需要手动或自动挂卖单来销售
}

// 生产开始时，从库存消耗原料
for (const input of recipe.inputs) {
  inventoryManager.consumeGoods(
    game.playerCompanyId,
    input.goodsId,
    input.amount,
    currentTick
  );
}
```

## 五、API 接口

### 5.1 市场查询

```typescript
// 获取商品价格
GET /api/game/market/price/:goodsId

// 获取订单簿
GET /api/game/market/orderbook/:goodsId

// 获取市场深度
GET /api/game/market/depth/:goodsId

// 获取交易历史
GET /api/game/market/trades/:goodsId

// 获取市场总览
GET /api/game/market/overview
```

### 5.2 交易操作

```typescript
// 提交买单
POST /api/game/order/buy
{
  goodsId: string,
  quantity: number,
  maxPrice: number
}

// 提交卖单
POST /api/game/order/sell
{
  goodsId: string,
  quantity: number,
  minPrice: number
}

// 取消订单
DELETE /api/game/order/:orderId

// 获取我的订单
GET /api/game/orders
```

### 5.3 库存查询

```typescript
// 获取玩家库存
GET /api/game/inventory

// 获取特定商品库存
GET /api/game/inventory/:goodsId
```

## 六、UI 组件设计

### 6.1 市场界面 (MarketPanel)

```tsx
<MarketPanel>
  <MarketOverview>          {/* 市场总览：涨跌幅、成交量 */}
  <GoodsSelector>           {/* 商品选择器 */}
  <PriceChart>              {/* 价格走势图 */}
  <OrderBook>               {/* 订单簿深度 */}
    <BuyOrders />
    <SellOrders />
  </OrderBook>
  <TradeHistory>            {/* 最近成交 */}
  <OrderForm>               {/* 下单表单 */}
  <MyOrders>                {/* 我的挂单 */}
</MarketPanel>
```

### 6.2 库存界面 (InventoryPanel)

```tsx
<InventoryPanel>
  <CashDisplay>             {/* 现金余额 */}
  <InventoryGrid>           {/* 库存网格 */}
    <GoodsItem>
      <Icon />
      <Name />
      <Quantity />
      <Reserved />          {/* 预留数量 */}
      <AvgCost />
      <MarketValue />
      <Actions>             {/* 快速卖出按钮 */}
    </GoodsItem>
  </InventoryGrid>
  <TotalValue>              {/* 资产总值 */}
</InventoryPanel>
```

## 七、配置参数

```typescript
// 经济系统配置
const ECONOMY_CONFIG = {
  // 订单配置
  defaultOrderValidity: 720,     // 默认订单有效期（tick）
  maxOrdersPerCompany: 100,      // 每公司最大订单数
  
  // 价格发现配置
  maxPriceChange: 0.1,           // 每tick最大价格变化 10%
  minPrice: 0.1,                 // 最低价格
  
  // NPC配置
  npcOrderInterval: 24,          // NPC下单间隔
  npcProductionInterval: 1,      // NPC生产间隔
  populationGroups: 50,          // 消费者群体数量
  
  // 历史记录配置
  maxTradeHistory: 10000,        // 最大交易记录数
  maxPriceHistory: 1000,         // 最大价格历史点数
};
```

## 八、后续优化方向

1. **期货合约** - 实现远期交易和价格锁定
2. **批量交易** - 支持一次性处理大量订单
3. **市价单** - 支持以市价立即成交的订单类型
4. **交易费用** - 增加手续费和税收机制
5. **信用系统** - 根据交易历史建立公司信誉
6. **垄断检测** - 监测市场垄断行为并触发事件

## 九、文件清单

**新增类型定义**:
- `packages/shared/src/types/inventory.ts`
- `packages/shared/src/types/market-order.ts`
- `packages/shared/src/types/trade.ts`

**新增服务**:
- `packages/server/src/services/inventoryManager.ts`
- `packages/server/src/services/marketOrderBook.ts`
- `packages/server/src/services/matchingEngine.ts`
- `packages/server/src/services/priceDiscovery.ts`
- `packages/server/src/services/npcCompanies.ts`
- `packages/server/src/services/economyManager.ts`