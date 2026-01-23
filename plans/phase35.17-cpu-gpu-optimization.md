# Phase 35.17: CPU/GPU 优化方案

**状态**: 全部完成 ✅ + Worker 池已集成

## 如何验证并行计算是否生效

### 方法 1: 查看服务器启动日志
启动服务器时会看到：
```
✅ Worker Pool initialized: 1 workers ready for parallel computing
```

如果看到：
```
⚠️ Worker Pool not available, using main thread for calculations
```
说明 Worker 池未能初始化（可能是 TypeScript 编译问题）。

### 方法 2: 查看游戏运行时日志
游戏运行时，每 50 tick 会输出经济诊断日志，包含 Worker 统计：
```
🧵 Worker Pool: 1 workers (0 busy), 队列=0, 任务统计: 总10/成功10/失败0
```

- **totalWorkers**: Worker 线程数量
- **busyWorkers**: 正在执行任务的 Worker 数量
- **queueLength**: 等待执行的任务数量
- **任务统计**: 总任务数/成功数/失败数

### 方法 3: 查看计算任务日志
每 100 tick 会输出：
```
[GameLoop] Worker 计算完成: 50 个商品价格
```

## 实现进度

### 阶段 1 - 快速优化 ✅ 完成
- [x] 创建 RingBuffer 工具类（`packages/server/src/utils/RingBuffer.ts`）
- [x] 实现 WebSocket 增量价格更新（服务端 `gameLoop.ts`）
- [x] 客户端支持增量更新合并（`gameStore.ts`）
- [x] EconomyCenter 组件 React.memo 优化
- [x] NeuralFeed 组件已有 React.memo 优化
- [x] IndustryPanel 组件已有 React.memo 优化

### 阶段 2 - Canvas 图表 + 虚拟列表 ✅ 完成
- [x] Canvas 替代 SVG 图表 (`PriceChartCanvas.tsx`)
  - 创建 `PriceChartCanvas` 组件使用 Canvas 2D API
  - 支持高 DPI 屏幕（devicePixelRatio）
  - 支持折线图/K线图切换
  - 支持 MA5/MA10 移动平均线
  - 支持成交量柱状图
  - 支持买卖压力条
  - 响应式容器 `PriceChartWrapperCanvas`
- [x] 虚拟列表组件 (`VirtualizedList.tsx`)
  - 通用虚拟列表实现
  - 支持固定高度项目
  - 支持缓冲区 (overscan)
  - 当前项目列表数量较少，暂无需强制应用

### 阶段 3 - Worker Threads ✅ 完成
- [x] Worker 池基础架构 (`packages/server/src/workers/workerPool.ts`)
  - 通用 WorkerPool 类
  - 自动创建/销毁 Worker
  - 任务队列和超时机制
  - 错误处理和恢复
- [x] 价格计算 Worker (`packages/server/src/workers/priceWorker.ts`)
  - 加权平均价格计算
  - 供需均衡价格计算
  - 移动平均/EMA 计算
  - 波动率计算
  - 批量价格计算
- [x] 客户端计算 Worker (`packages/client/src/workers/computeWorker.ts`)
  - 价格统计计算
  - 数据采样
  - 移动平均计算
  - 排序和过滤

---

## 概述

本文档详细说明通过优化 CPU 和 GPU 使用来提升游戏性能的技术方案。

## 一、服务端 CPU 优化

### 1.1 Worker Threads 并行计算

**问题**: Node.js 单线程执行所有游戏逻辑，tick 执行时间累积

**方案**: 使用 Worker Threads 将计算密集型任务并行化

```
主线程 (gameLoop.ts)
├── 高频操作: 建筑生产、状态同步
└── 调度其他线程

Worker 1: 订单撮合 (matchingWorker)
├── 接收: 订单队列
├── 执行: 价格优先撮合
└── 返回: 成交记录

Worker 2: AI 决策 (aiWorker)
├── 接收: 市场数据
├── 执行: AI公司策略计算
└── 返回: 决策结果

Worker 3: 价格计算 (priceWorker)
├── 接收: 供需数据
├── 执行: 价格调整公式
└── 返回: 新价格Map
```

**预期收益**:
- tick 执行时间减少 50-70%
- 更好利用多核 CPU

**实现文件**:
- `packages/server/src/workers/matchingWorker.ts`
- `packages/server/src/workers/aiDecisionWorker.ts`
- `packages/server/src/workers/priceCalculationWorker.ts`
- `packages/server/src/services/workerPool.ts`

### 1.2 数据结构优化

**问题**: Map 遍历和 Array slice 操作频繁

**方案**:
1. 使用 TypedArray 替代普通数组存储价格历史
2. 使用 SharedArrayBuffer 在主线程和 Worker 间共享数据
3. 环形缓冲区替代 slice 操作

```typescript
// 替代 history.push() + slice()
class PriceRingBuffer {
  private buffer: Float64Array;
  private head: number = 0;
  private size: number = 0;
  
  constructor(capacity: number = 1440) {
    this.buffer = new Float64Array(capacity);
  }
  
  push(price: number): void {
    this.buffer[this.head] = price;
    this.head = (this.head + 1) % this.buffer.length;
    if (this.size < this.buffer.length) this.size++;
  }
  
  // O(1) 不需要 slice
}
```

---

## 二、客户端 GPU 优化

### 2.1 Canvas 替代 SVG 图表

**问题**: D3 + SVG 渲染不利用 GPU 硬件加速

**方案**: 使用 Canvas 2D 或 WebGL 渲染价格图表

**对比**:
| 特性 | SVG (当前) | Canvas 2D | WebGL |
|------|----------|-----------|-------|
| GPU加速 | ❌ 无 | ⚠️ 部分 | ✅ 完全 |
| 复杂度 | 低 | 中 | 高 |
| 性能 | 慢 | 快 | 最快 |
| 交互 | 原生支持 | 需手动 | 需手动 |

**推荐**: 使用 Canvas 2D API，平衡性能与开发复杂度

```typescript
// packages/client/src/components/game/PriceChartCanvas.tsx
function PriceChartCanvas({ history, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    // 清除并重绘
    ctx.clearRect(0, 0, width, height);
    
    // 绘制价格线（GPU加速）
    ctx.beginPath();
    history.forEach((point, i) => {
      const x = (i / history.length) * width;
      const y = height - (point.price / maxPrice) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [history, width, height]);
  
  return <canvas ref={canvasRef} width={width} height={height} />;
}
```

**高性能图表库选项**:
1. **lightweight-charts** (TradingView) - 专为金融图表优化
2. **uPlot** - 极轻量高性能
3. **Recharts** + Canvas renderer

### 2.2 OffscreenCanvas 后台渲染

**方案**: 使用 Web Worker + OffscreenCanvas 在后台线程渲染

```typescript
// 主线程
const offscreen = canvas.transferControlToOffscreen();
worker.postMessage({ canvas: offscreen }, [offscreen]);

// Worker 线程
self.onmessage = ({ data }) => {
  const ctx = data.canvas.getContext('2d');
  // 渲染不阻塞主线程
};
```

---

## 三、React 渲染优化

### 3.1 组件 Memoization

**问题**: 每tick触发大量组件重渲染

**方案**:
```typescript
// 使用 React.memo 包装纯组件
const PriceDisplay = React.memo(function PriceDisplay({
  goodsId,
  price
}: { goodsId: string; price: number }) {
  return <span>{formatPrice(price)}</span>;
}, (prev, next) => {
  // 只有价格变化才重渲染
  return prev.price === next.price;
});

// 使用 useMemo 缓存计算
const filteredHistory = useMemo(() => {
  return history.slice(-timeRange);
}, [history, timeRange]);
```

### 3.2 虚拟列表

**问题**: 商品列表渲染 70+ 项目

**方案**: 使用 react-window 或 react-virtualized
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={goods.length}
  itemSize={40}
  width="100%"
>
  {({ index, style }) => (
    <GoodsRow style={style} goods={goods[index]} />
  )}
</FixedSizeList>
```

### 3.3 State 分片

**问题**: 单一大 store 导致频繁整体更新

**方案**: 将 priceHistory 分离到独立 store
```typescript
// 价格历史独立 store，减少主 store 更新频率
const usePriceHistoryStore = create<PriceHistoryState>((set) => ({
  histories: new Map(),
  updatePrice: (goodsId, price) => {
    set((state) => {
      // 细粒度更新
    });
  }
}));
```

---

## 四、WebSocket 优化

### 4.1 增量更新

**问题**: 每tick推送完整价格快照（~10KB）

**方案**: 只推送发生变化的价格
```typescript
// 服务端
function buildDeltaUpdate(prev: Map<string, number>, curr: Map<string, number>) {
  const delta: Record<string, number> = {};
  for (const [id, price] of curr) {
    if (prev.get(id) !== price) {
      delta[id] = price;
    }
  }
  return delta; // 通常只有5-10个变化
}

// 客户端
gameWebSocket.on('tickDelta', (msg) => {
  const { priceDelta } = msg.payload;
  set((state) => {
    // 增量合并
    state.marketPrices = { ...state.marketPrices, ...priceDelta };
  });
});
```

### 4.2 消息节流

**方案**: 合并多个tick的更新
```typescript
// 服务端
class TickBatcher {
  private buffer: TickUpdate[] = [];
  
  add(update: TickUpdate) {
    this.buffer.push(update);
    if (this.buffer.length >= 3 || Date.now() - this.lastFlush > 500) {
      this.flush();
    }
  }
  
  flush() {
    const merged = this.mergeUpdates(this.buffer);
    ws.send(JSON.stringify(merged));
    this.buffer = [];
    this.lastFlush = Date.now();
  }
}
```

---

## 五、实施优先级

### 阶段 1 - 快速收益 (1-2天)
1. ✅ React.memo 包装关键组件
2. ✅ WebSocket 增量更新
3. ✅ 价格历史环形缓冲区

### 阶段 2 - 中等收益 (2-3天)  
4. ⬜ Canvas 图表替代 SVG
5. ⬜ 虚拟列表优化商品列表
6. ⬜ State 分片

### 阶段 3 - 高级优化 (3-5天)
7. ⬜ Worker Threads 并行计算
8. ⬜ OffscreenCanvas 后台渲染
9. ⬜ SharedArrayBuffer 共享内存

---

## 六、性能监控

### 添加性能指标追踪
```typescript
// 服务端
const tickMetrics = {
  tickDuration: new Histogram('tick_duration_ms'),
  ordersProcessed: new Counter('orders_processed'),
  workersActive: new Gauge('workers_active'),
};

// 客户端
const renderMetrics = {
  fps: new FPSMonitor(),
  frameTime: new FrameTimeMonitor(),
};

// 在开发工具中显示
if (import.meta.env.DEV) {
  window.__PERF_METRICS__ = { tickMetrics, renderMetrics };
}
```

---

## 七、预期效果

| 指标 | 当前 | 优化后 |
|------|------|--------|
| Tick 执行时间 | 50-200ms | 10-30ms |
| 客户端 FPS | 30-40 | 60 |
| WebSocket 数据量 | ~10KB/tick | ~1KB/tick |
| 内存使用 | 200MB | 150MB |
| CPU 使用率 | 单核100% | 多核30% |