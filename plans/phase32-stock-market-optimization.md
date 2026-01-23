# Phase 32: 股票市场机制优化计划

## 一、当前实现状态回顾

### 已完成功能
1. ✅ 类型定义（Stock, StockOrder, StockTrade, Shareholding等）
2. ✅ 股价计算服务（基于资产、利润的基础估值）
3. ✅ 订单簿系统（买卖订单队列管理）
4. ✅ 订单撮合引擎（市价单/限价单匹配）
5. ✅ 股份持有追踪系统
6. ✅ 公司估值算法
7. ✅ 股市面板UI组件
8. ✅ 股票交易API路由
9. ✅ 股息分红机制
10. ✅ 收购与控股机制

## 二、需要优化的问题

### A. 后端服务层 - 核心问题

#### A.1 AI公司交易行为缺失
**现状**: AI公司没有自动交易逻辑，导致市场缺乏流动性
**问题影响**: 
- 玩家提交订单后可能无法成交
- 市场看起来没有活力

**优化方案**:
```typescript
// 新增 AIStockTradingSystem
interface AITradingStrategy {
  personality: 'conservative' | 'aggressive' | 'trend_follower' | 'contrarian';
  riskTolerance: number;      // 风险容忍度 0-1
  tradingFrequency: number;   // 每多少tick交易一次
  preferredHoldings: string[]; // 偏好持有的股票类型
}

// AI交易决策
function generateAIOrders(
  aiCompany: AICompany,
  marketState: StockMarketState,
  stocks: Stock[]
): StockOrder[];
```

#### A.2 市场深度数据缺失
**现状**: 订单簿没有暴露买卖盘口深度
**问题影响**: 玩家无法看到市场买卖力量分布

**优化方案**:
```typescript
interface MarketDepth {
  stockId: EntityId;
  bids: Array<{ price: Money; quantity: number; orderCount: number }>;
  asks: Array<{ price: Money; quantity: number; orderCount: number }>;
  spread: Money;       // 买卖价差
  midPrice: Money;     // 中间价
  imbalance: number;   // 买卖失衡度 -1到1
}
```

#### A.3 价格形成机制过于简单
**现状**: 价格主要基于财务数据+小幅随机波动
**问题影响**: 价格变化不够真实，缺乏市场动力学

**优化方案**:
- 引入「订单流不平衡」驱动价格
- 添加「动量效应」（价格趋势延续）
- 添加「均值回归」（价格向公允价值回归）
- 引入「波动率聚集」（大波动后容易继续大波动）

#### A.4 新闻/事件对股价影响
**现状**: LLM生成的市场事件没有直接影响股价
**优化方案**:
```typescript
interface StockPriceImpact {
  stockId: EntityId;
  eventId: string;
  impactPercent: number;  // 预期涨跌幅
  duration: number;       // 影响持续tick数
  decayType: 'linear' | 'exponential';
}
```

### B. 前端UI层 - 用户体验问题

#### B.1 缺少K线图表
**现状**: 只有数字列表，没有可视化图表
**优化方案**: 集成轻量级图表库（如 lightweight-charts）显示K线

#### B.2 缺少盘口深度显示
**现状**: 无法看到买卖五档
**优化方案**: 添加买卖五档深度展示

#### B.3 订单管理功能不完整
**现状**: 可以下单但看不到挂单、无法撤单
**优化方案**: 添加「我的订单」面板，支持查看和撤销

#### B.4 缺少交易历史
**现状**: 无法查看成交记录
**优化方案**: 添加成交明细列表

#### B.5 缺少股票详情面板
**现状**: 选中股票后只显示基础信息
**优化方案**: 展开详情页显示公司信息、财务数据、股东列表

### C. 游戏机制层 - 玩法深度

#### C.1 收购机制未完全打通
**现状**: 收购要约只是状态变更，没有实际控制权转移效果
**优化方案**:
- 收购成功后，被收购公司建筑归入收购方
- 子公司管理界面

#### C.2 缺少IPO机制
**现状**: 公司一开始就有股票
**优化方案**:
- 新公司可以选择上市时机
- IPO定价机制

#### C.3 缺少股票融资功能
**现状**: 公司无法通过增发股票筹资
**优化方案**:
- 定向增发
- 公开增发

## 三、优化任务分解

### Phase 32.A: 后端核心优化

#### 33.1 实现AI公司交易系统
- 设计AI交易策略框架
- 实现不同性格的AI交易行为
- 集成到游戏循环

#### 33.2 添加市场深度数据
- 扩展订单簿，暴露盘口深度
- 添加获取市场深度的API
- 计算买卖失衡度

#### 33.3 优化价格形成机制
- 引入订单流驱动的价格变化
- 添加动量和均值回归因子
- 实现波动率聚集效应

#### 33.4 实现新闻/事件对股价的影响
- 扩展事件系统，包含股价影响参数
- 在价格更新时应用事件冲击
- 事件衰减机制

### Phase 32.B: 前端UI增强

#### 33.5 添加K线图表组件
- 集成 lightweight-charts 库
- 实现日K/周K/分时图切换
- 技术指标叠加（MA、MACD等）

#### 33.6 实现盘口深度展示
- 买卖五档显示
- 实时更新深度数据
- 深度图可视化

#### 33.7 完善订单管理
- 我的挂单列表
- 撤单功能
- 订单状态实时更新

#### 33.8 添加成交历史
- 当日成交明细
- 历史成交查询
- 买卖方标识

#### 33.9 创建股票详情面板
- 公司基本信息
- 财务指标展示
- 十大股东列表
- 历史分红记录

### Phase 32.C: 游戏机制增强

#### 33.10 完善收购控制权机制
- 收购成功后的公司合并逻辑
- 子公司管理界面
- 被收购公司继续独立运营或整合

#### 33.11 实现IPO机制
- 公司上市申请流程
- IPO定价与配售
- 锁定期管理

#### 33.12 添加股票融资功能
- 定向增发给特定投资者
- 公开增发流程
- 融资对股价的稀释效应

## 四、优先级排序

### 高优先级（立即实施）
1. **33.1 AI公司交易系统** - 没有这个，市场毫无流动性
2. **33.3 优化价格形成机制** - 提升真实感
3. **33.5 K线图表** - 基础可视化需求

### 中优先级（次要实施）
4. **33.2 市场深度数据** - 提供交易决策信息
5. **33.6 盘口深度展示** - 配合后端深度数据
6. **33.7 订单管理** - 完善交易体验
7. **33.8 成交历史** - 记录追踪

### 低优先级（后续实施）
8. **33.4 新闻事件影响** - 增加动态性
9. **33.9 股票详情** - 信息完整性
10. **33.10 收购控制权** - 高级玩法
11. **33.11 IPO机制** - 高级玩法
12. **33.12 股票融资** - 高级玩法

## 五、技术架构变更

### 服务层新增
```
packages/server/src/services/
├── stockMarket.ts           # 现有，需扩展
├── aiStockTrading.ts        # 新增：AI交易决策
└── marketDepth.ts           # 新增：市场深度计算
```

### 类型新增
```typescript
// packages/shared/src/types/stock.ts 扩展

interface MarketDepth {
  stockId: EntityId;
  timestamp: GameTick;
  bids: PriceLevel[];     // 买盘
  asks: PriceLevel[];     // 卖盘
  spread: Money;
  midPrice: Money;
}

interface PriceLevel {
  price: Money;
  quantity: number;
  orderCount: number;
}

interface AITradingDecision {
  companyId: EntityId;
  action: 'buy' | 'sell' | 'hold';
  stockId: EntityId;
  quantity: number;
  limitPrice: Money | undefined;
  confidence: number;     // 0-1
  reasoning: string;      // LLM生成的理由
}

interface StockEvent {
  id: string;
  type: 'earnings_surprise' | 'news' | 'regulation' | 'market_crash';
  affectedStocks: EntityId[];
  priceImpact: Record<EntityId, number>;  // 百分比影响
  duration: number;
}
```

### 前端组件新增
```
packages/client/src/components/game/
├── StockMarket.tsx           # 现有，需拆分优化
├── StockChart.tsx            # 新增：K线图表
├── MarketDepthPanel.tsx      # 新增：盘口深度
├── OrderBook.tsx             # 新增：订单管理
├── TradeHistory.tsx          # 新增：成交历史
└── StockDetail.tsx           # 新增：股票详情
```

## 六、实施时间估算

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 33.1 AI交易系统 | 中 | 无 |
| 33.2 市场深度 | 小 | 无 |
| 33.3 价格机制 | 中 | 无 |
| 33.4 事件影响 | 小 | 33.3 |
| 33.5 K线图表 | 中 | 无 |
| 33.6 盘口显示 | 小 | 33.2 |
| 33.7 订单管理 | 小 | 无 |
| 33.8 成交历史 | 小 | 无 |
| 33.9 股票详情 | 中 | 无 |
| 33.10 收购控制 | 大 | 无 |
| 33.11 IPO机制 | 大 | 无 |
| 33.12 股票融资 | 中 | 33.11 |

## 七、下一步行动

建议从高优先级任务开始实施：
1. **首先实现 33.1 AI交易系统** - 让市场活起来
2. **然后优化 33.3 价格形成机制** - 让价格变化更真实
3. **同步开发 33.5 K线图表** - 提供基础可视化

这三个任务完成后，股市机制将具备基本可玩性。