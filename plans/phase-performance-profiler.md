# 游戏性能测试系统设计方案

## 1. 系统概述

### 1.1 设计目标

构建一个全面的性能分析系统，用于：
- 识别游戏循环中的性能瓶颈
- 监控关键服务的延迟和吞吐量
- 追踪内存使用和GC压力
- 提供可视化的性能仪表板

### 1.2 分析范围

```
┌─────────────────────────────────────────────────────────────────┐
│                       游戏系统架构                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  GameLoop   │───▶│ Tick Cycle  │───▶│  WebSocket  │─────▶ UI│
│  │  (入口)     │    │  (核心)     │    │  (输出)     │         │
│  └─────────────┘    └──────┬──────┘    └─────────────┘         │
│                            │                                    │
│           ┌────────────────┼────────────────┐                   │
│           ▼                ▼                ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 建筑生产    │  │ 经济系统    │  │ AI系统      │             │
│  │ Production  │  │ Economy     │  │ Competitor  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 库存管理    │  │ 订单撮合    │  │ 价格发现    │             │
│  │ Inventory   │  │ Matching    │  │ PriceDisc   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ LLM事件     │  │ 研发系统    │  │ 股票市场    │             │
│  │ MarketEvent │  │ Research    │  │ StockMkt    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 性能监控架构

### 2.1 分层采样策略

```typescript
// 性能采样配置
interface PerformanceConfig {
  // 采样级别
  samplingLevel: 'minimal' | 'standard' | 'detailed' | 'full';
  
  // 采样率（每N个tick采样一次）
  tickSamplingRate: number;
  
  // 是否启用各层监控
  layers: {
    tickLevel: boolean;      // tick 总耗时
    serviceLevel: boolean;   // 各服务耗时
    operationLevel: boolean; // 操作级别细分
    memoryLevel: boolean;    // 内存追踪
  };
  
  // 历史数据保留
  historySize: number;       // 保留多少条历史记录
  aggregationWindow: number; // 聚合窗口（tick数）
}

// 默认配置
const DEFAULT_CONFIG: PerformanceConfig = {
  samplingLevel: 'standard',
  tickSamplingRate: 10,  // 每10个tick采样一次
  layers: {
    tickLevel: true,
    serviceLevel: true,
    operationLevel: false,  // 默认关闭细粒度
    memoryLevel: false,
  },
  historySize: 1000,
  aggregationWindow: 50,
};
```

### 2.2 采样数据结构

```typescript
/** 单次 Tick 性能采样 */
interface TickSample {
  tick: number;
  timestamp: number;
  
  // 总耗时
  totalMs: number;
  
  // 各阶段耗时
  phases: {
    // 高频操作
    economyUpdate: number;      // 经济系统更新
    buildingProduction: number; // 建筑生产
    priceSync: number;          // 价格同步
    
    // 中频操作
    aiCompanyDecision: number;  // AI公司决策
    stockMarket: number;        // 股票市场
    autoTrade: number;          // 自动交易
    consumerDemand: number;     // 消费需求
    researchProgress: number;   // 研发进度
    
    // 低频操作
    marketEventGeneration: number; // LLM事件生成
    diagnosticLog: number;         // 诊断日志
  };
  
  // 子系统详细耗时（可选）
  subsystems?: {
    orderMatching: number;
    priceDiscovery: number;
    inventoryUpdate: number;
    marketOrderBook: number;
    popsConsumption: number;
  };
  
  // 内存使用
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  
  // 统计数据
  stats: {
    buildingCount: number;
    activeOrders: number;
    tradesThisTick: number;
    aiCompanyCount: number;
  };
}

/** 聚合性能报告 */
interface PerformanceReport {
  window: {
    startTick: number;
    endTick: number;
    sampleCount: number;
  };
  
  // 总体统计
  tick: {
    avgMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    stdDev: number;
  };
  
  // 各阶段统计
  phases: Record<string, {
    avgMs: number;
    maxMs: number;
    percentage: number;  // 占总耗时百分比
  }>;
  
  // 性能热点排名
  hotspots: Array<{
    name: string;
    avgMs: number;
    percentage: number;
    trend: 'stable' | 'increasing' | 'decreasing';
  }>;
  
  // 内存趋势
  memory?: {
    heapUsedTrend: 'stable' | 'growing' | 'shrinking';
    avgHeapUsed: number;
    peakHeapUsed: number;
    gcPressure: 'low' | 'medium' | 'high';
  };
  
  // 警告和建议
  warnings: Array<{
    level: 'info' | 'warning' | 'critical';
    message: string;
    suggestion: string;
  }>;
}
```

---

## 3. 实现方案

### 3.1 性能监控服务

```typescript
// packages/server/src/services/performanceProfiler.ts

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

/**
 * 性能分析器服务
 * 用于收集、分析和报告游戏循环性能数据
 */
export class PerformanceProfiler extends EventEmitter {
  private config: PerformanceConfig;
  private samples: TickSample[] = [];
  private currentSample: Partial<TickSample> | null = null;
  private phaseTimers: Map<string, number> = new Map();
  
  // 环形缓冲区，避免内存持续增长
  private readonly MAX_SAMPLES = 1000;
  
  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 开始一个 tick 的性能采样
   */
  startTick(tick: number): void {
    if (tick % this.config.tickSamplingRate !== 0) return;
    
    this.currentSample = {
      tick,
      timestamp: Date.now(),
      phases: {} as TickSample['phases'],
      stats: {} as TickSample['stats'],
    };
    
    this.phaseTimers.set('tick', performance.now());
  }
  
  /**
   * 开始测量某个阶段
   */
  startPhase(phaseName: string): void {
    if (!this.currentSample) return;
    this.phaseTimers.set(phaseName, performance.now());
  }
  
  /**
   * 结束测量某个阶段
   */
  endPhase(phaseName: string): number {
    if (!this.currentSample) return 0;
    
    const startTime = this.phaseTimers.get(phaseName);
    if (startTime === undefined) return 0;
    
    const elapsed = performance.now() - startTime;
    (this.currentSample.phases as Record<string, number>)[phaseName] = elapsed;
    
    return elapsed;
  }
  
  /**
   * 结束一个 tick 的性能采样
   */
  endTick(stats: TickSample['stats']): TickSample | null {
    if (!this.currentSample) return null;
    
    const tickStartTime = this.phaseTimers.get('tick');
    if (tickStartTime === undefined) return null;
    
    this.currentSample.totalMs = performance.now() - tickStartTime;
    this.currentSample.stats = stats;
    
    // 采集内存数据
    if (this.config.layers.memoryLevel) {
      const memUsage = process.memoryUsage();
      this.currentSample.memory = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      };
    }
    
    const sample = this.currentSample as TickSample;
    
    // 环形缓冲
    if (this.samples.length >= this.MAX_SAMPLES) {
      this.samples.shift();
    }
    this.samples.push(sample);
    
    // 重置
    this.currentSample = null;
    this.phaseTimers.clear();
    
    // 触发慢tick警告
    if (sample.totalMs > 50) {
      this.emit('slowTick', sample);
    }
    
    return sample;
  }
  
  /**
   * 生成性能报告
   */
  generateReport(windowSize?: number): PerformanceReport {
    const window = windowSize ?? this.config.aggregationWindow;
    const recentSamples = this.samples.slice(-window);
    
    if (recentSamples.length === 0) {
      return this.emptyReport();
    }
    
    // 计算总体统计
    const tickTimes = recentSamples.map(s => s.totalMs);
    const tickStats = this.calculateStats(tickTimes);
    
    // 计算各阶段统计
    const phaseStats: Record<string, { avgMs: number; maxMs: number; percentage: number }> = {};
    const allPhaseNames = new Set<string>();
    
    for (const sample of recentSamples) {
      for (const phase of Object.keys(sample.phases)) {
        allPhaseNames.add(phase);
      }
    }
    
    for (const phase of allPhaseNames) {
      const times = recentSamples
        .map(s => (s.phases as Record<string, number>)[phase] ?? 0)
        .filter(t => t > 0);
      
      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        phaseStats[phase] = {
          avgMs: avg,
          maxMs: Math.max(...times),
          percentage: (avg / tickStats.avgMs) * 100,
        };
      }
    }
    
    // 生成热点排名
    const hotspots = Object.entries(phaseStats)
      .map(([name, stats]) => ({
        name,
        avgMs: stats.avgMs,
        percentage: stats.percentage,
        trend: this.analyzeTrend(name, recentSamples),
      }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10);
    
    // 生成警告
    const warnings = this.generateWarnings(tickStats, phaseStats, recentSamples);
    
    return {
      window: {
        startTick: recentSamples[0].tick,
        endTick: recentSamples[recentSamples.length - 1].tick,
        sampleCount: recentSamples.length,
      },
      tick: tickStats,
      phases: phaseStats,
      hotspots,
      warnings,
    };
  }
  
  /**
   * 计算统计数据
   */
  private calculateStats(values: number[]): PerformanceReport['tick'] {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const variance = sorted.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / sorted.length;
    
    return {
      avgMs: avg,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      p50Ms: sorted[Math.floor(sorted.length * 0.5)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      p99Ms: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(variance),
    };
  }
  
  /**
   * 分析趋势
   */
  private analyzeTrend(
    phase: string,
    samples: TickSample[]
  ): 'stable' | 'increasing' | 'decreasing' {
    if (samples.length < 10) return 'stable';
    
    const halfIndex = Math.floor(samples.length / 2);
    const firstHalf = samples.slice(0, halfIndex);
    const secondHalf = samples.slice(halfIndex);
    
    const firstAvg = firstHalf
      .map(s => (s.phases as Record<string, number>)[phase] ?? 0)
      .reduce((a, b) => a + b, 0) / firstHalf.length;
    
    const secondAvg = secondHalf
      .map(s => (s.phases as Record<string, number>)[phase] ?? 0)
      .reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 20) return 'increasing';
    if (changePercent < -20) return 'decreasing';
    return 'stable';
  }
  
  /**
   * 生成警告
   */
  private generateWarnings(
    tickStats: PerformanceReport['tick'],
    phaseStats: Record<string, { avgMs: number; maxMs: number; percentage: number }>,
    samples: TickSample[]
  ): PerformanceReport['warnings'] {
    const warnings: PerformanceReport['warnings'] = [];
    
    // Tick 总耗时警告
    if (tickStats.avgMs > 20) {
      warnings.push({
        level: 'warning',
        message: `平均 tick 耗时 ${tickStats.avgMs.toFixed(1)}ms 偏高`,
        suggestion: '检查高耗时阶段，考虑降低 AI 复杂度或减少订单撮合频率',
      });
    }
    
    if (tickStats.p95Ms > 50) {
      warnings.push({
        level: 'critical',
        message: `P95 tick 耗时 ${tickStats.p95Ms.toFixed(1)}ms，可能导致卡顿`,
        suggestion: '识别并优化性能热点，考虑启用 Worker 池',
      });
    }
    
    // 单阶段占比过高警告
    for (const [phase, stats] of Object.entries(phaseStats)) {
      if (stats.percentage > 40) {
        warnings.push({
          level: 'warning',
          message: `${phase} 占总耗时 ${stats.percentage.toFixed(1)}%`,
          suggestion: `考虑优化 ${phase} 或降低其执行频率`,
        });
      }
    }
    
    // 内存警告
    if (samples[0]?.memory && samples[samples.length - 1]?.memory) {
      const firstHeap = samples[0].memory.heapUsed;
      const lastHeap = samples[samples.length - 1].memory.heapUsed;
      const growthMB = (lastHeap - firstHeap) / 1024 / 1024;
      
      if (growthMB > 50) {
        warnings.push({
          level: 'warning',
          message: `内存增长 ${growthMB.toFixed(1)}MB`,
          suggestion: '检查是否有内存泄漏，考虑优化数据结构',
        });
      }
    }
    
    return warnings;
  }
  
  /**
   * 空报告
   */
  private emptyReport(): PerformanceReport {
    return {
      window: { startTick: 0, endTick: 0, sampleCount: 0 },
      tick: { avgMs: 0, minMs: 0, maxMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, stdDev: 0 },
      phases: {},
      hotspots: [],
      warnings: [],
    };
  }
  
  /**
   * 获取原始样本
   */
  getSamples(count?: number): TickSample[] {
    return count ? this.samples.slice(-count) : this.samples;
  }
  
  /**
   * 重置
   */
  reset(): void {
    this.samples = [];
    this.currentSample = null;
    this.phaseTimers.clear();
  }
}

// 单例
export const performanceProfiler = new PerformanceProfiler();
```

### 3.2 集成到 GameLoop

```typescript
// 在 gameLoop.ts 的 processTick 方法中集成性能采样

private processTick(gameId: string): void {
  const game = this.games.get(gameId);
  if (!game) return;
  
  // 开始性能采样
  performanceProfiler.startTick(game.currentTick);
  
  game.currentTick++;
  game.lastUpdate = Date.now();
  
  // ===== 高频操作 =====
  performanceProfiler.startPhase('economyUpdate');
  const economyResult = this.processHighFrequencyOperations(game, scheduler);
  performanceProfiler.endPhase('economyUpdate');
  
  // ===== 建筑生产 =====
  performanceProfiler.startPhase('buildingProduction');
  const productionResult = this.processBuildingProduction(game, scheduler);
  performanceProfiler.endPhase('buildingProduction');
  
  // ===== 中频操作 =====
  if (scheduler.shouldExecute(game.currentTick, 'AI_COMPANY_DECISION')) {
    performanceProfiler.startPhase('aiCompanyDecision');
    aiResult = aiCompanyManager.processTick(aiContext);
    performanceProfiler.endPhase('aiCompanyDecision');
  }
  
  if (scheduler.shouldExecute(game.currentTick, 'STOCK_MARKET_UPDATE')) {
    performanceProfiler.startPhase('stockMarket');
    stockMarketService.processTick(game.currentTick, companyFinancials);
    performanceProfiler.endPhase('stockMarket');
  }
  
  // ... 其他阶段
  
  // 结束性能采样
  performanceProfiler.endTick({
    buildingCount: game.buildings.length,
    activeOrders: economyResult.stats.totalActiveOrders,
    tradesThisTick: economyResult.stats.totalTradesThisTick,
    aiCompanyCount: aiCompanyManager.getCompanies().size,
  });
  
  // 定期输出性能报告
  if (game.currentTick % 500 === 0) {
    const report = performanceProfiler.generateReport();
    this.logPerformanceReport(report);
  }
}
```

### 3.3 API 端点

```typescript
// packages/server/src/routes/performance.ts

import { Router } from 'express';
import { performanceProfiler } from '../services/performanceProfiler.js';

const router = Router();

/**
 * GET /api/performance/report
 * 获取性能报告
 */
router.get('/report', (req, res) => {
  const windowSize = parseInt(req.query.window as string) || 100;
  const report = performanceProfiler.generateReport(windowSize);
  res.json(report);
});

/**
 * GET /api/performance/samples
 * 获取原始采样数据
 */
router.get('/samples', (req, res) => {
  const count = parseInt(req.query.count as string) || 50;
  const samples = performanceProfiler.getSamples(count);
  res.json(samples);
});

/**
 * GET /api/performance/realtime
 * SSE 实时推送性能数据
 */
router.get('/realtime', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const listener = (sample: TickSample) => {
    res.write(`data: ${JSON.stringify(sample)}\n\n`);
  };
  
  performanceProfiler.on('tickSampled', listener);
  
  req.on('close', () => {
    performanceProfiler.off('tickSampled', listener);
  });
});

/**
 * POST /api/performance/config
 * 更新性能采样配置
 */
router.post('/config', (req, res) => {
  const config = req.body;
  performanceProfiler.updateConfig(config);
  res.json({ success: true });
});

export default router;
```

---

## 4. 性能可视化面板

### 4.1 组件结构

```
PerformancePanel/
├── PerformancePanel.tsx       # 主容器
├── TickTimeChart.tsx          # Tick 耗时图表
├── PhaseBreakdown.tsx         # 阶段耗时分解
├── HotspotsTable.tsx          # 热点排名表
├── MemoryUsageChart.tsx       # 内存使用图表
├── WarningsPanel.tsx          # 警告面板
└── RealtimeMetrics.tsx        # 实时指标显示
```

### 4.2 主面板设计

```
┌─────────────────────────────────────────────────────────────────┐
│  性能分析仪表板                               [刷新] [设置]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Tick 耗时趋势 (最近 100 次采样)              │   │
│  │                                                         │   │
│  │  50ms ┼─────────────────────────────────────────────── │   │
│  │       │                              ╱╲                 │   │
│  │  25ms ┼──────────────────────────╱──────╲───────────── │   │
│  │       │        ╱╲╱╲           ╱╲╱        ╲╱╲           │   │
│  │   0ms ┼╱╲╱╲╱╲╱────╲╱╲╱╲╱╲╱╲╱──────────────────╲╱╲╱╲── │   │
│  │       └────────────────────────────────────────────────│   │
│  │       tick 500                                  tick 600 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌───────────────────────┐  ┌───────────────────────────────┐  │
│  │  阶段耗时分解         │  │  性能热点 TOP 5               │  │
│  │                       │  │                               │  │
│  │  经济系统   ████ 35%  │  │  1. aiCompanyDecision  8.2ms │  │
│  │  建筑生产   ███  25%  │  │  2. orderMatching      5.1ms │  │
│  │  AI决策     ██   15%  │  │  3. buildingProduction 4.8ms │  │
│  │  订单撮合   ██   12%  │  │  4. priceDiscovery     3.2ms │  │
│  │  其他       █     8%  │  │  5. stockMarket        2.1ms │  │
│  │                       │  │                               │  │
│  └───────────────────────┘  └───────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⚠️ 警告                                                 │   │
│  │                                                         │   │
│  │  [!] P95 tick 耗时 52ms，可能导致卡顿                    │   │
│  │      建议：识别并优化性能热点，考虑启用 Worker 池         │   │
│  │                                                         │   │
│  │  [i] aiCompanyDecision 占总耗时 35%                      │   │
│  │      建议：考虑优化 AI 决策算法或降低执行频率             │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌───────────────────────┐  ┌───────────────────────────────┐  │
│  │  实时指标             │  │  内存使用                     │  │
│  │                       │  │                               │  │
│  │  当前 tick: 623       │  │  ████████░░ 280MB / 512MB     │  │
│  │  平均耗时: 18.5ms     │  │  趋势: 稳定                   │  │
│  │  游戏速度: 4x         │  │  GC压力: 低                   │  │
│  │  建筑数量: 45         │  │                               │  │
│  │  活跃订单: 1,234      │  │                               │  │
│  │                       │  │                               │  │
│  └───────────────────────┘  └───────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. 实现步骤

### Phase 1: 核心监控服务
1. 创建 `performanceProfiler.ts` 性能采样服务
2. 在 `gameLoop.ts` 中集成性能采样点
3. 实现性能报告生成逻辑

### Phase 2: API 和数据传输
4. 添加 `/api/performance` 路由
5. 实现 SSE 实时推送
6. 配置动态调整接口

### Phase 3: 可视化面板
7. 创建 `PerformancePanel` 组件
8. 实现 Tick 耗时图表
9. 实现阶段分解和热点表

### Phase 4: 高级功能
10. 内存追踪和 GC 分析
11. Worker 池性能监控
12. 性能基准测试工具

---

## 6. 预期收益

| 指标 | 当前状态 | 目标 |
|------|----------|------|
| 瓶颈识别 | 依赖猜测 | 数据驱动 |
| 优化验证 | 手动测试 | 自动对比 |
| 性能回归 | 无预警 | 实时告警 |
| 调试效率 | 低 | 提升 5x |

---

## 7. 代码变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `performanceProfiler.ts` | 新建 | 核心性能采样服务 |
| `gameLoop.ts` | 修改 | 集成性能采样点 |
| `routes/performance.ts` | 新建 | API 端点 |
| `routes/index.ts` | 修改 | 注册 performance 路由 |
| `PerformancePanel.tsx` | 新建 | 可视化面板 |
| `TickTimeChart.tsx` | 新建 | 耗时图表组件 |
| `types/performance.ts` | 新建 | 类型定义 |