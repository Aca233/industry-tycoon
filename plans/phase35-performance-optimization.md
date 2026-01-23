# 第35阶段：大规模性能优化计划

## ✅ 实施进度

| 优化项 | 状态 | 文件 | 预期收益 |
|--------|------|------|----------|
| 35.1 分层tick处理 | ✅ 完成 | tickScheduler.ts, gameLoop.ts | 每tick操作数-60% |
| 35.2 订单簿优化 | ✅ 完成 | marketOrderBook.ts | 订单操作+70% |
| 35.3 估值缓存 | ✅ 完成 | stockMarket.ts | 估值计算-90% |
| 35.4 异步LLM处理 | ✅ 完成 | asyncLLMProcessor.ts | LLM阻塞-100% |
| 35.5 增量状态推送 | ✅ 完成 | deltaStateManager.ts, websocket.ts | 网络流量-80% |
| 35.6-35.7 消息压缩 | ✅ 完成 | messageCompressor.ts | 带宽-30% |
| 35.8 React组件优化 | ✅ 完成 | IndustryPanel, StockMarket, NeuralFeed | 渲染次数-50% |
| 35.9 虚拟化长列表 | ✅ 完成 | VirtualizedList.tsx | 列表渲染-80% |
| 35.10 图表优化 | ✅ 完成 | (集成在Worker中) | 图表计算-60% |
| 35.11 分层存储 | ✅ 完成 | historicalDataManager.ts | 内存-50% |
| 35.12 缓存层 | ✅ 完成 | cacheManager.ts | 计算缓存+90% |
| 35.13 Web Worker | ✅ 完成 | computeWorker.ts, workerManager.ts | 主线程解放 |

### 35.4-35.13 优化实现详情

#### 35.4 异步LLM处理
- `asyncLLMProcessor.ts`: LLM请求队列管理器
  - 优先级调度：玩家交互 > 市场分析 > AI决策 > 后台事件
  - 并发控制：最大3个并发请求
  - 结果缓存：5分钟策略缓存，1分钟市场分析缓存
  - 失败重试：最多2次重试

#### 35.6-35.7 消息压缩
- `messageCompressor.ts`: 消息压缩和批量发送
  - 短键名压缩：如 `playerCash` -> `c`
  - 商品ID缩写：如 `iron-ore` -> `io`
  - 批量合并：50ms内消息合并发送

#### 35.8 React组件优化
- `IndustryPanel.tsx`: memo包装子组件；移除调试console.log
- `StockMarket.tsx`: useMemo缓存计算；提取StockRow为memo组件
- `NeuralFeed.tsx`: 提取子组件为memo；useCallback缓存事件处理器

#### 35.9 虚拟化长列表
- `VirtualizedList.tsx`: 通用虚拟列表组件
  - 仅渲染可见项 + overscan缓冲区
  - 支持固定高度模式
  - 包含WindowedList渐进加载变体

#### 35.11 历史数据分层存储
- `historicalDataManager.ts`: OHLCV数据分层存储
  - Tier1：最近100 tick，全精度
  - Tier2：100-1000 tick，5tick聚合
  - Tier3：1000+ tick，20tick聚合
  - 自动聚合和清理机制

#### 35.12 缓存层实现
- `cacheManager.ts`: LRU+TTL通用缓存
  - 估值缓存：10秒TTL，500条上限
  - 策略缓存：5分钟TTL，100条上限
  - 计算缓存：5秒TTL，1000条上限
  - computeWithCache异步缓存API

#### 35.13 Web Worker分离计算
- `computeWorker.ts`: 计算密集型任务Worker
  - 价格统计计算
  - 数据采样（OHLC聚合）
  - 移动平均计算
  - 排序过滤
- `workerManager.ts`: Worker管理器
  - 自动初始化和消息传递
  - 超时处理（10秒）
  - 主线程回退机制

---

## 📊 项目当前状态分析

### 技术栈
- **前端**: React 19 + Vite 6 + Zustand 5 + TailwindCSS
- **后端**: Fastify 5 + TypeScript + Prisma + WebSocket
- **核心服务**: gameLoop（~2000行）、stockMarket（~1700行）、economyManager（~450行）

### 已识别的性能瓶颈

1. **每tick处理过重** - `gameLoop.processTick()` 约1000行，包含：
   - AI公司处理
   - 建筑生产循环
   - 市场订单撮合
   - 股票市场更新
   - 价格发现
   - POPs消费计算
   - LLM事件生成

2. **前端状态更新频繁** - 每tick通过WebSocket推送完整状态
3. **内存中存储所有历史数据** - 价格历史、交易记录、订单簿
4. **LLM调用阻塞** - 市场事件生成是同步批量处理

---

## 🚀 性能优化计划

### 第一阶段：服务端核心优化（高优先级）

#### 35.1 游戏循环重构 - 分层处理
**目标**: 将不同频率的操作分离，减少每tick负担

```
高频操作（每tick）:
- 订单撮合
- 价格更新
- 建筑进度

中频操作（每10-50 tick）:
- AI公司决策
- 股票价格计算
- 供需衰减

低频操作（每100+ tick）:
- 市场事件生成（LLM）
- 财务报表计算
- 经济健康检查
```

**修改文件**:
- `packages/server/src/services/gameLoop.ts` - 添加 tickFrequency 调度器
- 新建 `packages/server/src/services/tickScheduler.ts`

#### 35.2 订单簿优化 - 数据结构升级
**目标**: 用红黑树替代数组排序，O(log n) 插入/删除

**修改文件**:
- `packages/server/src/services/marketOrderBook.ts` - 引入有序数据结构
- 添加订单过期批量清理（而非每tick检查）

#### 35.3 股票市场计算优化
**目标**: 减少每tick的估值计算和历史记录操作

**优化点**:
- 缓存公允价值计算结果（有效期50 tick）
- 历史数据懒写入（每24 tick批量写入）
- 动量数据使用环形缓冲区

**修改文件**:
- `packages/server/src/services/stockMarket.ts`

#### 35.4 异步LLM处理
**目标**: 将LLM调用完全异步化，不阻塞游戏循环

**方案**:
- 使用事件队列模式
- LLM结果通过事件触发应用
- 添加重试和超时机制

**修改文件**:
- `packages/server/src/services/llm.ts`
- `packages/server/src/services/gameLoop.ts`

---

### 第二阶段：WebSocket通信优化

#### 35.5 增量状态推送
**目标**: 只推送变化的数据，而非完整状态

**实现**:
```typescript
interface DeltaUpdate {
  type: 'delta';
  changes: {
    prices?: Record<string, number>;  // 只有变化的价格
    cash?: number;                     // 只在变化时发送
    buildings?: BuildingDelta[];       // 只有状态变化的建筑
  };
  fullSyncEvery: 100;  // 每100tick发送一次完整状态
}
```

**修改文件**:
- `packages/server/src/websocket/gameHandler.ts`
- `packages/client/src/services/websocket.ts`
- `packages/client/src/stores/gameStore.ts`

#### 35.6 消息压缩
**目标**: 对大型消息进行压缩

**方案**:
- 使用 MessagePack 或 CBOR 替代 JSON
- 对超过 1KB 的消息启用 gzip 压缩

#### 35.7 批量更新
**目标**: 减少WebSocket消息频率

**实现**:
- 客户端可配置更新频率（1x/2x/4x对应1/0.5/0.25秒）
- 服务端缓冲多个tick更新，批量发送

---

### 第三阶段：前端渲染优化

#### 35.8 React组件优化
**目标**: 减少不必要的重渲染

**优化点**:
- 使用 `React.memo` 包装纯展示组件
- 使用 `useMemo` 缓存复杂计算
- 拆分大型组件（如 `NeuralFeed.tsx`、`StockMarket.tsx`）
- 使用 Zustand 选择器（selector）精确订阅

**修改文件**:
- `packages/client/src/components/game/*.tsx`
- `packages/client/src/stores/gameStore.ts`

#### 35.9 虚拟化长列表
**目标**: 对大型列表使用虚拟滚动

**应用场景**:
- 交易历史记录
- 订单列表
- 商品价格列表
- K线图数据

**方案**: 引入 `@tanstack/react-virtual`

#### 35.10 图表性能优化
**目标**: 优化K线图和市场图表性能

**优化点**:
- 限制可视数据点数量（最多显示100根K线）
- 使用 Canvas 替代 SVG（对于大量数据）
- 实现数据下采样

---

### 第四阶段：数据管理优化

#### 35.11 历史数据分层存储
**目标**: 减少内存占用

**方案**:
```
热数据（内存）: 最近100 tick的详细数据
温数据（压缩内存）: 最近720 tick的聚合数据
冷数据（SQLite/IndexedDB）: 更早的历史数据
```

**修改文件**:
- 新建 `packages/server/src/services/dataStorage.ts`
- 修改 `priceDiscovery.ts`、`matchingEngine.ts`

#### 35.12 缓存层实现
**目标**: 减少重复计算

**缓存策略**:
| 数据类型 | TTL | 失效条件 |
|---------|-----|---------|
| 公司估值 | 50 tick | 财务数据变化 |
| 市场深度 | 5 tick | 订单变化 |
| AI决策 | 10 tick | 市场状态大幅变化 |

---

### 第五阶段：架构级优化

#### 35.13 Web Worker 分离计算
**目标**: 将重计算移至后台线程

**适用场景**:
- K线图数据处理
- 市场统计计算
- 价格历史分析

**修改文件**:
- 新建 `packages/client/src/workers/chartWorker.ts`

#### 35.14 服务拆分（未来考虑）
**目标**: 将重负载服务拆分为独立进程

**潜在拆分**:
- 股票市场服务（单独进程）
- LLM网关服务（单独进程）
- 价格发现服务（单独进程）

---

## 📋 实施计划

### 快速胜利（1-2天）
| 任务 | 预期收益 | 风险 |
|------|---------|-----|
| 35.1 分层tick处理 | 减少50%每tick负担 | 低 |
| 35.8 React.memo优化 | 减少30%重渲染 | 低 |
| 35.3 估值缓存 | 减少股市计算量 | 低 |

### 中期优化（3-5天）
| 任务 | 预期收益 | 风险 |
|------|---------|-----|
| 35.5 增量状态推送 | 减少60%网络流量 | 中 |
| 35.4 异步LLM | 消除tick阻塞 | 中 |
| 35.9 虚拟化列表 | 大幅提升列表性能 | 低 |

### 深度优化（1-2周）
| 任务 | 预期收益 | 风险 |
|------|---------|-----|
| 35.2 订单簿重构 | 大规模订单性能 | 高 |
| 35.11 分层存储 | 降低内存占用50% | 高 |
| 35.13 Web Worker | 前端流畅度提升 | 中 |

---

## 📈 性能指标目标

| 指标 | 当前估计 | 优化目标 |
|------|---------|---------|
| 每tick处理时间 | ~100ms | <20ms |
| WebSocket消息大小 | ~50KB | <5KB（增量）|
| 前端帧率 | ~30fps | 60fps |
| 内存占用（服务端） | ~500MB | <200MB |
| 内存占用（客户端） | ~200MB | <100MB |

---

## 🔧 工具和监控

### 性能分析工具
- **服务端**: `clinic.js`、Node.js Profiler
- **前端**: React DevTools Profiler、Chrome Performance
- **网络**: WebSocket Inspector、Network Tab

### 新增监控
```typescript
// 新建 packages/server/src/services/performanceMonitor.ts
interface PerformanceMetrics {
  tickProcessingTime: number[];
  wsMessageSize: number[];
  memoryUsage: NodeJS.MemoryUsage;
  activeOrders: number;
  aiCompanyCount: number;
}
```

---

## ⚠️ 注意事项

1. **向后兼容**: 所有优化必须保持API兼容
2. **渐进式**: 一次只优化一个模块，验证后再继续
3. **可回滚**: 每次优化都应可以独立回滚
4. **测试覆盖**: 性能优化后需验证功能正确性

---

## 📁 新增文件列表

```
packages/server/src/services/
├── tickScheduler.ts        # 分层tick调度器
├── performanceMonitor.ts   # 性能监控服务
├── dataStorage.ts          # 分层数据存储
└── cacheManager.ts         # 缓存管理器

packages/client/src/
├── workers/
│   └── chartWorker.ts      # 图表计算Worker
└── utils/
    └── deltaUpdate.ts      # 增量更新处理
```

---

## 开始实施

建议从 **35.1 游戏循环重构** 开始，这是收益最高、风险最低的优化点。

```mermaid
graph TD
    A[35.1 分层tick处理] --> B[35.3 估值缓存]
    A --> C[35.8 React.memo]
    B --> D[35.5 增量推送]
    C --> D
    D --> E[35.4 异步LLM]
    D --> F[35.9 虚拟列表]
    E --> G[35.11 分层存储]
    F --> H[35.13 Web Worker]