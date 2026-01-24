/**
 * 性能基准测试脚本 - 测量3000 tick的性能与延迟
 * 
 * 运行方式: npx tsx packages/server/src/scripts/benchmark-3000-ticks.ts
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

// 模拟最小化的游戏循环性能测试
// 不依赖完整的服务初始化，专注于核心性能测量

interface TickMetrics {
  tick: number;
  totalMs: number;
  phases: Record<string, number>;
  memoryMB: number;
}

interface BenchmarkResult {
  totalTicks: number;
  totalTimeMs: number;
  ticksPerSecond: number;
  tickMetrics: {
    avgMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    stdDev: number;
  };
  phaseBreakdown: Record<string, {
    avgMs: number;
    maxMs: number;
    percentage: number;
  }>;
  memoryUsage: {
    startMB: number;
    endMB: number;
    peakMB: number;
    growthMB: number;
  };
  slowTicks: {
    count: number;
    percentage: number;
    threshold: number;
  };
}

class GameLoopBenchmark extends EventEmitter {
  private metrics: TickMetrics[] = [];
  private startMemory: number = 0;
  private peakMemory: number = 0;
  
  constructor() {
    super();
  }
  
  /**
   * 模拟一个tick的各个阶段
   */
  private simulateTick(tickNumber: number): TickMetrics {
    const tickStart = performance.now();
    const phases: Record<string, number> = {};
    
    // 模拟经济系统更新 (高频操作)
    const economyStart = performance.now();
    this.simulateEconomyUpdate();
    phases['economyUpdate'] = performance.now() - economyStart;
    
    // 模拟建筑生产 (高频操作)
    const buildingStart = performance.now();
    this.simulateBuildingProduction();
    phases['buildingProduction'] = performance.now() - buildingStart;
    
    // 模拟AI公司决策 (每5 tick)
    if (tickNumber % 5 === 0) {
      const aiStart = performance.now();
      this.simulateAIDecision();
      phases['aiCompanyDecision'] = performance.now() - aiStart;
    }
    
    // 模拟股票市场 (每3 tick)
    if (tickNumber % 3 === 0) {
      const stockStart = performance.now();
      this.simulateStockMarket();
      phases['stockMarket'] = performance.now() - stockStart;
    }
    
    // 模拟价格计算
    const priceStart = performance.now();
    this.simulatePriceCalculation();
    phases['priceCalculation'] = performance.now() - priceStart;
    
    // 模拟消费需求 (每10 tick)
    if (tickNumber % 10 === 0) {
      const demandStart = performance.now();
      this.simulateConsumerDemand();
      phases['consumerDemand'] = performance.now() - demandStart;
    }
    
    // 模拟事件广播
    const eventStart = performance.now();
    this.simulateEventBroadcast();
    phases['eventBroadcast'] = performance.now() - eventStart;
    
    const totalMs = performance.now() - tickStart;
    const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
    
    if (memoryMB > this.peakMemory) {
      this.peakMemory = memoryMB;
    }
    
    return {
      tick: tickNumber,
      totalMs,
      phases,
      memoryMB,
    };
  }
  
  // 模拟各个子系统的计算负载
  
  private simulateEconomyUpdate(): void {
    // 模拟订单簿操作 - 50个商品，每个商品100个订单
    const orders: Array<{ price: number; quantity: number }> = [];
    for (let i = 0; i < 5000; i++) {
      orders.push({
        price: Math.random() * 1000,
        quantity: Math.random() * 100,
      });
    }
    // 模拟排序（订单撮合核心操作）
    orders.sort((a, b) => a.price - b.price);
    
    // 模拟撮合
    let matched = 0;
    for (let i = 0; i < orders.length - 1; i++) {
      if (Math.random() > 0.8) matched++;
    }
  }
  
  private simulateBuildingProduction(): void {
    // 模拟50个建筑的生产计算
    const buildings: Array<{ progress: number; efficiency: number }> = [];
    for (let i = 0; i < 50; i++) {
      buildings.push({
        progress: Math.random() * 100,
        efficiency: 0.8 + Math.random() * 0.2,
      });
    }
    
    // 模拟生产进度更新
    for (const building of buildings) {
      building.progress += building.efficiency;
      if (building.progress >= 100) {
        building.progress = 0;
        // 模拟产出计算
        const output = Math.random() * 100;
        const cost = Math.random() * 50;
      }
    }
  }
  
  private simulateAIDecision(): void {
    // 模拟10个AI公司的决策
    for (let company = 0; company < 10; company++) {
      // 模拟市场分析
      const marketData: number[] = [];
      for (let i = 0; i < 100; i++) {
        marketData.push(Math.random() * 1000);
      }
      
      // 模拟决策计算
      const avg = marketData.reduce((a, b) => a + b, 0) / marketData.length;
      const variance = marketData.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / marketData.length;
      
      // 模拟策略选择
      const decision = Math.random() > 0.5 ? 'expand' : 'conserve';
    }
  }
  
  private simulateStockMarket(): void {
    // 模拟20只股票的价格更新
    const stocks: Array<{ price: number; volume: number }> = [];
    for (let i = 0; i < 20; i++) {
      stocks.push({
        price: 100 + Math.random() * 900,
        volume: Math.random() * 10000,
      });
    }
    
    // 模拟价格计算
    for (const stock of stocks) {
      const change = (Math.random() - 0.5) * 0.02;
      stock.price *= (1 + change);
    }
  }
  
  private simulatePriceCalculation(): void {
    // 模拟50种商品的价格计算
    const prices: Map<string, number> = new Map();
    const supplyDemand: Map<string, { supply: number; demand: number }> = new Map();
    
    for (let i = 0; i < 50; i++) {
      const goodsId = `goods-${i}`;
      prices.set(goodsId, 100 + Math.random() * 900);
      supplyDemand.set(goodsId, {
        supply: 1000 + Math.random() * 5000,
        demand: 1000 + Math.random() * 5000,
      });
    }
    
    // 模拟供需驱动的价格调整
    for (const [goodsId, price] of prices) {
      const sd = supplyDemand.get(goodsId)!;
      const ratio = sd.demand / sd.supply;
      const adjustment = (ratio - 1) * 0.02;
      prices.set(goodsId, price * (1 + adjustment));
    }
  }
  
  private simulateConsumerDemand(): void {
    // 模拟消费者需求处理
    const consumers = 1000;
    const demandByGoods: Map<string, number> = new Map();
    
    for (let i = 0; i < consumers; i++) {
      const goodsId = `goods-${Math.floor(Math.random() * 50)}`;
      const current = demandByGoods.get(goodsId) ?? 0;
      demandByGoods.set(goodsId, current + Math.random() * 10);
    }
  }
  
  private simulateEventBroadcast(): void {
    // 模拟事件数据构建
    const eventData = {
      tick: Date.now(),
      prices: new Map<string, number>(),
      buildings: [] as Array<{ id: string; status: string }>,
      financials: {
        income: Math.random() * 10000,
        cost: Math.random() * 8000,
        profit: 0,
      },
    };
    
    // 填充价格数据
    for (let i = 0; i < 50; i++) {
      eventData.prices.set(`goods-${i}`, Math.random() * 1000);
    }
    
    // 填充建筑数据
    for (let i = 0; i < 50; i++) {
      eventData.buildings.push({
        id: `building-${i}`,
        status: Math.random() > 0.1 ? 'running' : 'paused',
      });
    }
    
    eventData.financials.profit = eventData.financials.income - eventData.financials.cost;
    
    // 模拟JSON序列化（实际会通过WebSocket发送）
    const serialized = JSON.stringify({
      ...eventData,
      prices: Object.fromEntries(eventData.prices),
    });
  }
  
  /**
   * 运行基准测试
   */
  async runBenchmark(tickCount: number = 3000): Promise<BenchmarkResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 开始性能基准测试: ${tickCount} ticks`);
    console.log(`${'='.repeat(60)}\n`);
    
    this.startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    this.peakMemory = this.startMemory;
    this.metrics = [];
    
    const overallStart = performance.now();
    
    // 进度报告间隔
    const reportInterval = Math.floor(tickCount / 10);
    
    for (let tick = 1; tick <= tickCount; tick++) {
      const metric = this.simulateTick(tick);
      this.metrics.push(metric);
      
      // 进度报告
      if (tick % reportInterval === 0) {
        const elapsed = performance.now() - overallStart;
        const tps = tick / (elapsed / 1000);
        const progress = (tick / tickCount * 100).toFixed(0);
        console.log(`  📊 进度: ${progress}% (${tick}/${tickCount}) - ${tps.toFixed(1)} ticks/sec`);
      }
    }
    
    const overallEnd = performance.now();
    const totalTimeMs = overallEnd - overallStart;
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // 分析结果
    const result = this.analyzeResults(tickCount, totalTimeMs, endMemory);
    
    // 打印报告
    this.printReport(result);
    
    return result;
  }
  
  private analyzeResults(tickCount: number, totalTimeMs: number, endMemory: number): BenchmarkResult {
    const tickTimes = this.metrics.map(m => m.totalMs);
    const sortedTimes = [...tickTimes].sort((a, b) => a - b);
    
    // 基础统计
    const sum = tickTimes.reduce((a, b) => a + b, 0);
    const avg = sum / tickTimes.length;
    const variance = tickTimes.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / tickTimes.length;
    
    // 阶段分析
    const phaseBreakdown: Record<string, { times: number[]; total: number }> = {};
    for (const metric of this.metrics) {
      for (const [phase, time] of Object.entries(metric.phases)) {
        if (!phaseBreakdown[phase]) {
          phaseBreakdown[phase] = { times: [], total: 0 };
        }
        phaseBreakdown[phase].times.push(time);
        phaseBreakdown[phase].total += time;
      }
    }
    
    const phaseStats: Record<string, { avgMs: number; maxMs: number; percentage: number }> = {};
    const totalPhaseTime = Object.values(phaseBreakdown).reduce((sum, p) => sum + p.total, 0);
    
    for (const [phase, data] of Object.entries(phaseBreakdown)) {
      const phaseAvg = data.total / data.times.length;
      phaseStats[phase] = {
        avgMs: phaseAvg,
        maxMs: Math.max(...data.times),
        percentage: (data.total / totalPhaseTime) * 100,
      };
    }
    
    // 慢tick统计
    const slowThreshold = 50; // 50ms
    const slowCount = tickTimes.filter(t => t > slowThreshold).length;
    
    return {
      totalTicks: tickCount,
      totalTimeMs,
      ticksPerSecond: tickCount / (totalTimeMs / 1000),
      tickMetrics: {
        avgMs: avg,
        minMs: sortedTimes[0] ?? 0,
        maxMs: sortedTimes[sortedTimes.length - 1] ?? 0,
        p50Ms: sortedTimes[Math.floor(sortedTimes.length * 0.5)] ?? 0,
        p95Ms: sortedTimes[Math.floor(sortedTimes.length * 0.95)] ?? 0,
        p99Ms: sortedTimes[Math.floor(sortedTimes.length * 0.99)] ?? 0,
        stdDev: Math.sqrt(variance),
      },
      phaseBreakdown: phaseStats,
      memoryUsage: {
        startMB: this.startMemory,
        endMB: endMemory,
        peakMB: this.peakMemory,
        growthMB: endMemory - this.startMemory,
      },
      slowTicks: {
        count: slowCount,
        percentage: (slowCount / tickCount) * 100,
        threshold: slowThreshold,
      },
    };
  }
  
  private printReport(result: BenchmarkResult): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 性能基准测试报告`);
    console.log(`${'='.repeat(60)}`);
    
    console.log(`\n📈 总体性能:`);
    console.log(`   总tick数: ${result.totalTicks}`);
    console.log(`   总耗时: ${(result.totalTimeMs / 1000).toFixed(2)}s`);
    console.log(`   吞吐量: ${result.ticksPerSecond.toFixed(1)} ticks/sec`);
    
    console.log(`\n⏱️ Tick延迟统计:`);
    console.log(`   平均: ${result.tickMetrics.avgMs.toFixed(3)}ms`);
    console.log(`   最小: ${result.tickMetrics.minMs.toFixed(3)}ms`);
    console.log(`   最大: ${result.tickMetrics.maxMs.toFixed(3)}ms`);
    console.log(`   P50:  ${result.tickMetrics.p50Ms.toFixed(3)}ms`);
    console.log(`   P95:  ${result.tickMetrics.p95Ms.toFixed(3)}ms`);
    console.log(`   P99:  ${result.tickMetrics.p99Ms.toFixed(3)}ms`);
    console.log(`   标准差: ${result.tickMetrics.stdDev.toFixed(3)}ms`);
    
    console.log(`\n🔥 各阶段耗时占比:`);
    const sortedPhases = Object.entries(result.phaseBreakdown)
      .sort((a, b) => b[1].percentage - a[1].percentage);
    for (const [phase, stats] of sortedPhases) {
      console.log(`   ${phase}: ${stats.avgMs.toFixed(3)}ms avg, ${stats.maxMs.toFixed(3)}ms max (${stats.percentage.toFixed(1)}%)`);
    }
    
    console.log(`\n💾 内存使用:`);
    console.log(`   起始: ${result.memoryUsage.startMB.toFixed(1)}MB`);
    console.log(`   结束: ${result.memoryUsage.endMB.toFixed(1)}MB`);
    console.log(`   峰值: ${result.memoryUsage.peakMB.toFixed(1)}MB`);
    console.log(`   增长: ${result.memoryUsage.growthMB.toFixed(1)}MB`);
    
    console.log(`\n⚠️ 慢Tick统计 (阈值: ${result.slowTicks.threshold}ms):`);
    console.log(`   数量: ${result.slowTicks.count}`);
    console.log(`   占比: ${result.slowTicks.percentage.toFixed(2)}%`);
    
    // 性能评估
    console.log(`\n📋 性能评估:`);
    if (result.tickMetrics.avgMs < 5) {
      console.log(`   ✅ 平均延迟优秀 (<5ms)`);
    } else if (result.tickMetrics.avgMs < 20) {
      console.log(`   ⚠️ 平均延迟正常 (5-20ms)`);
    } else {
      console.log(`   ❌ 平均延迟过高 (>20ms)`);
    }
    
    if (result.tickMetrics.p99Ms < 50) {
      console.log(`   ✅ P99延迟优秀 (<50ms)`);
    } else if (result.tickMetrics.p99Ms < 100) {
      console.log(`   ⚠️ P99延迟正常 (50-100ms)`);
    } else {
      console.log(`   ❌ P99延迟过高 (>100ms), 可能导致卡顿`);
    }
    
    if (result.slowTicks.percentage < 1) {
      console.log(`   ✅ 慢tick占比优秀 (<1%)`);
    } else if (result.slowTicks.percentage < 5) {
      console.log(`   ⚠️ 慢tick占比正常 (1-5%)`);
    } else {
      console.log(`   ❌ 慢tick占比过高 (>5%)`);
    }
    
    if (result.memoryUsage.growthMB < 50) {
      console.log(`   ✅ 内存增长正常 (<50MB)`);
    } else if (result.memoryUsage.growthMB < 100) {
      console.log(`   ⚠️ 内存增长偏高 (50-100MB)`);
    } else {
      console.log(`   ❌ 内存增长过高 (>100MB), 可能存在泄漏`);
    }
    
    // 游戏速度建议
    console.log(`\n🎮 游戏速度建议:`);
    const baseTickMs = 200; // 1x速度下每tick 200ms
    const maxSafeSpeed = Math.floor(baseTickMs / result.tickMetrics.p95Ms);
    console.log(`   最高安全速度: ${Math.min(maxSafeSpeed, 4)}x (基于P95延迟)`);
    
    if (result.tickMetrics.p95Ms < 50) {
      console.log(`   4x速度: ✅ 流畅`);
    } else if (result.tickMetrics.p95Ms < 100) {
      console.log(`   4x速度: ⚠️ 可能偶尔卡顿`);
    } else {
      console.log(`   4x速度: ❌ 不推荐`);
    }
    
    console.log(`\n${'='.repeat(60)}\n`);
  }
}

// 运行基准测试
async function main() {
  const benchmark = new GameLoopBenchmark();
  
  try {
    // 预热
    console.log('🔥 预热中...');
    await benchmark.runBenchmark(100);
    
    // 正式测试
    console.log('\n📊 开始正式基准测试...\n');
    const result = await benchmark.runBenchmark(3000);
    
    // 输出JSON结果（便于自动化分析）
    console.log('\n📄 JSON结果:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ 基准测试失败:', error);
    process.exit(1);
  }
}

main();