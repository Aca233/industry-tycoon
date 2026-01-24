/**
 * 性能分析器服务
 * 用于收集、分析和报告游戏循环性能数据
 * 
 * 功能：
 * - 采样每个 tick 的执行时间
 * - 分阶段计时（AI决策、订单撮合、建筑生产等）
 * - 生成性能报告（P50/P95/P99 延迟、热点排名）
 * - 实时告警（当 tick 耗时超标时）
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

/** 性能采样配置 */
export interface PerformanceConfig {
  /** 采样级别 */
  samplingLevel: 'minimal' | 'standard' | 'detailed' | 'full';
  /** 采样率（每N个tick采样一次） */
  tickSamplingRate: number;
  /** 是否启用各层监控 */
  layers: {
    tickLevel: boolean;      // tick 总耗时
    serviceLevel: boolean;   // 各服务耗时
    operationLevel: boolean; // 操作级别细分
    memoryLevel: boolean;    // 内存追踪
  };
  /** 历史数据保留数量 */
  historySize: number;
  /** 聚合窗口（tick数） */
  aggregationWindow: number;
  /** 慢tick阈值（ms） */
  slowTickThresholdMs: number;
}

/** 默认配置 */
const DEFAULT_CONFIG: PerformanceConfig = {
  samplingLevel: 'standard',
  tickSamplingRate: 1,  // 每个tick都采样（可调整为10以降低开销）
  layers: {
    tickLevel: true,
    serviceLevel: true,
    operationLevel: false,  // 默认关闭细粒度
    memoryLevel: true,
  },
  historySize: 1000,
  aggregationWindow: 100,
  slowTickThresholdMs: 50,
};

/** 单次 Tick 性能采样 */
export interface TickSample {
  tick: number;
  timestamp: number;
  /** 总耗时（ms） */
  totalMs: number;
  /** 各阶段耗时 */
  phases: Record<string, number>;
  /** 内存使用 */
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    rss: number;
  };
  /** 统计数据 */
  stats: {
    buildingCount: number;
    activeOrders: number;
    tradesThisTick: number;
    aiCompanyCount: number;
  };
}

/** 阶段统计 */
interface PhaseStats {
  avgMs: number;
  maxMs: number;
  minMs: number;
  totalMs: number;
  percentage: number;
  samples: number;
}

/** 聚合性能报告 */
export interface PerformanceReport {
  /** 采样窗口 */
  window: {
    startTick: number;
    endTick: number;
    sampleCount: number;
    durationMs: number;
  };
  /** tick 总体统计 */
  tick: {
    avgMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    stdDev: number;
    slowTickCount: number;
  };
  /** 各阶段统计 */
  phases: Record<string, PhaseStats>;
  /** 性能热点排名（按平均耗时降序） */
  hotspots: Array<{
    name: string;
    avgMs: number;
    maxMs: number;
    percentage: number;
    trend: 'stable' | 'increasing' | 'decreasing';
  }>;
  /** 内存趋势 */
  memory?: {
    avgHeapUsedMB: number;
    peakHeapUsedMB: number;
    heapGrowthMB: number;
    trend: 'stable' | 'growing' | 'shrinking';
    gcPressure: 'low' | 'medium' | 'high';
  };
  /** 警告和建议 */
  warnings: Array<{
    level: 'info' | 'warning' | 'critical';
    message: string;
    suggestion: string;
  }>;
  /** 生成时间 */
  generatedAt: number;
}

/**
 * 性能分析器类
 */
export class PerformanceProfiler extends EventEmitter {
  private config: PerformanceConfig;
  private samples: TickSample[] = [];
  private currentSample: Partial<TickSample> | null = null;
  private phaseTimers: Map<string, number> = new Map();
  private enabled: boolean = true;
  
  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 启用/禁用性能采样
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[PerformanceProfiler] ${enabled ? '已启用' : '已禁用'}`);
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[PerformanceProfiler] 配置已更新');
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }
  
  /**
   * 开始一个 tick 的性能采样
   * @param tick tick 号
   * @param initialStats 可选的初始统计数据
   */
  startTick(tick: number, initialStats?: Partial<TickSample['stats']>): void {
    if (!this.enabled) return;
    if (tick % this.config.tickSamplingRate !== 0) return;
    
    this.currentSample = {
      tick,
      timestamp: Date.now(),
      phases: {},
      stats: {
        buildingCount: initialStats?.buildingCount ?? 0,
        activeOrders: initialStats?.activeOrders ?? 0,
        tradesThisTick: initialStats?.tradesThisTick ?? 0,
        aiCompanyCount: initialStats?.aiCompanyCount ?? 0,
      },
    };
    
    this.phaseTimers.clear();
    this.phaseTimers.set('__tick__', performance.now());
  }
  
  /**
   * 开始测量某个阶段
   */
  startPhase(phaseName: string): void {
    if (!this.enabled || !this.currentSample) return;
    this.phaseTimers.set(phaseName, performance.now());
  }
  
  /**
   * 结束测量某个阶段
   * @returns 该阶段的耗时（ms）
   */
  endPhase(phaseName: string): number {
    if (!this.enabled || !this.currentSample) return 0;
    
    const startTime = this.phaseTimers.get(phaseName);
    if (startTime === undefined) return 0;
    
    const elapsed = performance.now() - startTime;
    this.currentSample.phases![phaseName] = elapsed;
    
    return elapsed;
  }
  
  /**
   * 结束一个 tick 的性能采样
   * @param stats 可选的最终统计数据，如果不提供则使用 startTick 时设置的数据
   */
  endTick(stats?: Partial<TickSample['stats']>): TickSample | null {
    if (!this.enabled || !this.currentSample) return null;
    
    const tickStartTime = this.phaseTimers.get('__tick__');
    if (tickStartTime === undefined) return null;
    
    this.currentSample.totalMs = performance.now() - tickStartTime;
    
    // 合并传入的 stats 到现有 stats（如果提供）
    if (stats) {
      this.currentSample.stats = {
        ...this.currentSample.stats!,
        ...stats,
      };
    }
    
    // 采集内存数据
    if (this.config.layers.memoryLevel) {
      const memUsage = process.memoryUsage();
      this.currentSample.memory = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
        rss: memUsage.rss,
      };
    }
    
    const sample = this.currentSample as TickSample;
    
    // 环形缓冲
    if (this.samples.length >= this.config.historySize) {
      this.samples.shift();
    }
    this.samples.push(sample);
    
    // 重置
    this.currentSample = null;
    this.phaseTimers.clear();
    
    // 触发采样事件
    this.emit('tickSampled', sample);
    
    // 触发慢tick警告
    if (sample.totalMs > this.config.slowTickThresholdMs) {
      this.emit('slowTick', sample);
      console.warn(`[PerformanceProfiler] ⚠️ 慢tick警告: tick=${sample.tick}, 耗时=${sample.totalMs.toFixed(1)}ms (阈值: ${this.config.slowTickThresholdMs}ms)`);
    }
    
    return sample;
  }
  
  /**
   * 快捷方法：测量一个操作的执行时间
   */
  measure<T>(phaseName: string, fn: () => T): T {
    this.startPhase(phaseName);
    try {
      return fn();
    } finally {
      this.endPhase(phaseName);
    }
  }
  
  /**
   * 快捷方法：测量一个异步操作的执行时间
   */
  async measureAsync<T>(phaseName: string, fn: () => Promise<T>): Promise<T> {
    this.startPhase(phaseName);
    try {
      return await fn();
    } finally {
      this.endPhase(phaseName);
    }
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
    const tickStats = this.calculateTickStats(tickTimes);
    
    // 计算各阶段统计
    const phaseStats = this.calculatePhaseStats(recentSamples, tickStats.avgMs);
    
    // 生成热点排名
    const hotspots = this.generateHotspots(phaseStats, recentSamples);
    
    // 计算内存趋势
    const memoryStats = this.calculateMemoryStats(recentSamples);
    
    // 生成警告
    const warnings = this.generateWarnings(tickStats, phaseStats, memoryStats, recentSamples);
    
    // 计算采样窗口持续时间
    const firstSample = recentSamples[0]!;
    const lastSample = recentSamples[recentSamples.length - 1]!;
    const durationMs = lastSample.timestamp - firstSample.timestamp;
    
    // 使用条件展开语法避免将 undefined 赋值给可选属性
    return {
      window: {
        startTick: firstSample.tick,
        endTick: lastSample.tick,
        sampleCount: recentSamples.length,
        durationMs,
      },
      tick: tickStats,
      phases: phaseStats,
      hotspots,
      ...(memoryStats ? { memory: memoryStats } : {}),
      warnings,
      generatedAt: Date.now(),
    };
  }
  
  /**
   * 计算 tick 统计数据
   */
  private calculateTickStats(values: number[]): PerformanceReport['tick'] {
    if (values.length === 0) {
      return { avgMs: 0, minMs: 0, maxMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, stdDev: 0, slowTickCount: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const variance = sorted.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / sorted.length;
    const slowTickCount = values.filter(v => v > this.config.slowTickThresholdMs).length;
    
    const minMs = sorted[0] ?? 0;
    const maxMs = sorted[sorted.length - 1] ?? 0;
    
    return {
      avgMs: avg,
      minMs,
      maxMs,
      p50Ms: sorted[Math.floor(sorted.length * 0.5)] ?? minMs,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? maxMs,
      p99Ms: sorted[Math.floor(sorted.length * 0.99)] ?? maxMs,
      stdDev: Math.sqrt(variance),
      slowTickCount,
    };
  }
  
  /**
   * 计算各阶段统计
   */
  private calculatePhaseStats(
    samples: TickSample[],
    avgTickMs: number
  ): Record<string, PhaseStats> {
    const phaseStats: Record<string, PhaseStats> = {};
    const allPhaseNames = new Set<string>();
    
    for (const sample of samples) {
      for (const phase of Object.keys(sample.phases)) {
        allPhaseNames.add(phase);
      }
    }
    
    for (const phase of allPhaseNames) {
      const times = samples
        .map(s => s.phases[phase] ?? 0)
        .filter(t => t > 0);
      
      if (times.length > 0) {
        const sum = times.reduce((a, b) => a + b, 0);
        const avg = sum / times.length;
        phaseStats[phase] = {
          avgMs: avg,
          maxMs: Math.max(...times),
          minMs: Math.min(...times),
          totalMs: sum,
          percentage: avgTickMs > 0 ? (avg / avgTickMs) * 100 : 0,
          samples: times.length,
        };
      }
    }
    
    return phaseStats;
  }
  
  /**
   * 生成热点排名
   */
  private generateHotspots(
    phaseStats: Record<string, PhaseStats>,
    samples: TickSample[]
  ): PerformanceReport['hotspots'] {
    return Object.entries(phaseStats)
      .map(([name, stats]) => ({
        name,
        avgMs: stats.avgMs,
        maxMs: stats.maxMs,
        percentage: stats.percentage,
        trend: this.analyzeTrend(name, samples),
      }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10);
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
    
    const getAvg = (arr: TickSample[]) => {
      const times = arr.map(s => s.phases[phase] ?? 0).filter(t => t > 0);
      return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    };
    
    const firstAvg = getAvg(firstHalf);
    const secondAvg = getAvg(secondHalf);
    
    if (firstAvg === 0) return 'stable';
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 20) return 'increasing';
    if (changePercent < -20) return 'decreasing';
    return 'stable';
  }
  
  /**
   * 计算内存统计
   */
  private calculateMemoryStats(samples: TickSample[]): PerformanceReport['memory'] | undefined {
    const samplesWithMemory = samples.filter(s => s.memory);
    if (samplesWithMemory.length < 2) return undefined;
    
    const heapUsedValues = samplesWithMemory.map(s => s.memory!.heapUsed);
    const avgHeapUsed = heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length;
    const peakHeapUsed = Math.max(...heapUsedValues);
    
    const firstHeap = heapUsedValues[0] ?? 0;
    const lastHeap = heapUsedValues[heapUsedValues.length - 1] ?? 0;
    const heapGrowth = lastHeap - firstHeap;
    
    // 判断趋势
    let trend: 'stable' | 'growing' | 'shrinking' = 'stable';
    const growthPercent = firstHeap > 0 ? (heapGrowth / firstHeap) * 100 : 0;
    if (growthPercent > 10) trend = 'growing';
    else if (growthPercent < -10) trend = 'shrinking';
    
    // 判断 GC 压力
    let gcPressure: 'low' | 'medium' | 'high' = 'low';
    const avgHeapTotalRatio = samplesWithMemory.reduce(
      (sum, s) => sum + s.memory!.heapUsed / s.memory!.heapTotal, 0
    ) / samplesWithMemory.length;
    
    if (avgHeapTotalRatio > 0.85) gcPressure = 'high';
    else if (avgHeapTotalRatio > 0.7) gcPressure = 'medium';
    
    return {
      avgHeapUsedMB: avgHeapUsed / 1024 / 1024,
      peakHeapUsedMB: peakHeapUsed / 1024 / 1024,
      heapGrowthMB: heapGrowth / 1024 / 1024,
      trend,
      gcPressure,
    };
  }
  
  /**
   * 生成警告
   */
  private generateWarnings(
    tickStats: PerformanceReport['tick'],
    phaseStats: Record<string, PhaseStats>,
    memoryStats: PerformanceReport['memory'] | undefined,
    _samples: TickSample[]
  ): PerformanceReport['warnings'] {
    const warnings: PerformanceReport['warnings'] = [];
    
    // Tick 总耗时警告
    if (tickStats.avgMs > 30) {
      warnings.push({
        level: 'warning',
        message: `平均 tick 耗时 ${tickStats.avgMs.toFixed(1)}ms 偏高`,
        suggestion: '检查高耗时阶段，考虑降低 AI 复杂度或减少订单撮合频率',
      });
    }
    
    if (tickStats.p95Ms > this.config.slowTickThresholdMs) {
      warnings.push({
        level: 'critical',
        message: `P95 tick 耗时 ${tickStats.p95Ms.toFixed(1)}ms，可能导致卡顿`,
        suggestion: '识别并优化性能热点，考虑启用 Worker 池或降低游戏速度',
      });
    }
    
    if (tickStats.slowTickCount > 0) {
      const slowTickPercent = (tickStats.slowTickCount / this.config.aggregationWindow) * 100;
      if (slowTickPercent > 5) {
        warnings.push({
          level: 'warning',
          message: `${slowTickPercent.toFixed(1)}% 的 tick 超过 ${this.config.slowTickThresholdMs}ms 阈值`,
          suggestion: '频繁的慢 tick 会影响游戏体验，请检查性能热点',
        });
      }
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
      
      if (stats.maxMs > 100) {
        warnings.push({
          level: 'warning',
          message: `${phase} 最大耗时 ${stats.maxMs.toFixed(1)}ms，存在性能尖峰`,
          suggestion: `检查 ${phase} 是否有复杂操作或 I/O 阻塞`,
        });
      }
    }
    
    // 内存警告
    if (memoryStats) {
      if (memoryStats.heapGrowthMB > 50) {
        warnings.push({
          level: 'warning',
          message: `内存增长 ${memoryStats.heapGrowthMB.toFixed(1)}MB`,
          suggestion: '检查是否有内存泄漏，考虑优化数据结构或增加清理频率',
        });
      }
      
      if (memoryStats.gcPressure === 'high') {
        warnings.push({
          level: 'warning',
          message: 'GC 压力较高，堆内存使用率 > 85%',
          suggestion: '考虑增加 Node.js 堆内存限制或优化内存使用',
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
      window: { startTick: 0, endTick: 0, sampleCount: 0, durationMs: 0 },
      tick: { avgMs: 0, minMs: 0, maxMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, stdDev: 0, slowTickCount: 0 },
      phases: {},
      hotspots: [],
      warnings: [],
      generatedAt: Date.now(),
    };
  }
  
  /**
   * 获取原始样本
   */
  getSamples(count?: number): TickSample[] {
    return count ? this.samples.slice(-count) : [...this.samples];
  }
  
  /**
   * 获取最新样本
   */
  getLatestSample(): TickSample | null {
    return this.samples.length > 0 ? this.samples[this.samples.length - 1] ?? null : null;
  }
  
  /**
   * 获取样本数量
   */
  getSampleCount(): number {
    return this.samples.length;
  }
  
  /**
   * 重置所有数据
   */
  reset(): void {
    this.samples = [];
    this.currentSample = null;
    this.phaseTimers.clear();
    console.log('[PerformanceProfiler] 已重置');
  }
  
  /**
   * 输出性能报告到控制台
   */
  logReport(windowSize?: number): void {
    const report = this.generateReport(windowSize);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 性能分析报告');
    console.log('='.repeat(60));
    
    console.log(`\n📈 采样窗口: tick ${report.window.startTick} - ${report.window.endTick} (${report.window.sampleCount} 个样本, ${(report.window.durationMs / 1000).toFixed(1)}s)`);
    
    console.log('\n⏱️ Tick 耗时统计:');
    console.log(`   平均: ${report.tick.avgMs.toFixed(2)}ms`);
    console.log(`   最小: ${report.tick.minMs.toFixed(2)}ms`);
    console.log(`   最大: ${report.tick.maxMs.toFixed(2)}ms`);
    console.log(`   P50:  ${report.tick.p50Ms.toFixed(2)}ms`);
    console.log(`   P95:  ${report.tick.p95Ms.toFixed(2)}ms`);
    console.log(`   P99:  ${report.tick.p99Ms.toFixed(2)}ms`);
    console.log(`   慢tick: ${report.tick.slowTickCount} 次`);
    
    if (report.hotspots.length > 0) {
      console.log('\n🔥 性能热点 TOP 5:');
      const topHotspots = report.hotspots.slice(0, 5);
      for (let i = 0; i < topHotspots.length; i++) {
        const h = topHotspots[i]!;
        const trend = h.trend === 'increasing' ? '📈' : h.trend === 'decreasing' ? '📉' : '➡️';
        console.log(`   ${i + 1}. ${h.name}: ${h.avgMs.toFixed(2)}ms (${h.percentage.toFixed(1)}%) ${trend}`);
      }
    }
    
    if (report.memory) {
      console.log('\n💾 内存使用:');
      console.log(`   平均堆: ${report.memory.avgHeapUsedMB.toFixed(1)}MB`);
      console.log(`   峰值堆: ${report.memory.peakHeapUsedMB.toFixed(1)}MB`);
      console.log(`   增长: ${report.memory.heapGrowthMB.toFixed(1)}MB (${report.memory.trend})`);
      console.log(`   GC压力: ${report.memory.gcPressure}`);
    }
    
    if (report.warnings.length > 0) {
      console.log('\n⚠️ 警告:');
      for (const w of report.warnings) {
        const icon = w.level === 'critical' ? '🔴' : w.level === 'warning' ? '🟡' : '🔵';
        console.log(`   ${icon} ${w.message}`);
        console.log(`      → ${w.suggestion}`);
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// 单例实例
export const performanceProfiler = new PerformanceProfiler();