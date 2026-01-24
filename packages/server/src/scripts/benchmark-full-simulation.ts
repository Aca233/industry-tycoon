/**
 * 完整游戏循环性能基准测试
 * 
 * 使用真实的 GameLoop 服务运行3000 tick
 * 运行方式: npx tsx packages/server/src/scripts/benchmark-full-simulation.ts
 */

import { performance } from 'perf_hooks';
import { gameLoop, type TickUpdate } from '../services/gameLoop.js';
import { performanceProfiler } from '../services/performanceProfiler.js';

interface BenchmarkConfig {
  targetTicks: number;
  warmupTicks: number;
  reportIntervalTicks: number;
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  targetTicks: 3000,
  warmupTicks: 100,
  reportIntervalTicks: 300,
};

async function runFullSimulationBenchmark(config: BenchmarkConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('🎮 完整游戏循环性能基准测试');
  console.log('='.repeat(70));
  console.log(`配置: 目标=${config.targetTicks} ticks, 预热=${config.warmupTicks} ticks\n`);
  
  const gameId = 'benchmark-game';
  const playerCompanyId = 'benchmark-player';
  
  // 创建游戏实例
  console.log('🔧 初始化游戏...');
  const game = gameLoop.getOrCreateGame(gameId, playerCompanyId);
  console.log(`   ✅ 游戏已创建: ${gameId}`);
  console.log(`   📊 初始商品数量: ${game.marketPrices.size}`);
  console.log(`   🏭 初始建筑数量: ${game.buildings.length}`);
  
  // 添加一些测试建筑以增加负载
  console.log('\n🏗️ 添加测试建筑...');
  const testBuildings = [
    'iron-mine', 'coal-mine', 'steel-mill', 'electronics-factory',
    'power-plant', 'oil-refinery', 'chemical-plant', 'auto-factory'
  ];
  
  for (const buildingId of testBuildings) {
    const result = gameLoop.purchaseBuilding(gameId, buildingId);
    if (result.success) {
      console.log(`   ✅ 建造: ${result.building?.name}`);
    } else {
      console.log(`   ⚠️ 无法建造 ${buildingId}: ${result.error}`);
    }
  }
  
  console.log(`   📊 当前建筑数量: ${game.buildings.length}`);
  
  // 性能数据收集
  const tickTimes: number[] = [];
  const phaseData: Map<string, number[]> = new Map();
  const memorySnapshots: number[] = [];
  let tickCount = 0;
  let isWarmup = true;
  
  // 监听tick事件
  const tickHandler = (update: TickUpdate) => {
    tickCount++;
    
    // 收集性能采样数据
    const sample = performanceProfiler.getLatestSample();
    if (sample) {
      if (!isWarmup) {
        tickTimes.push(sample.totalMs);
        
        for (const [phase, time] of Object.entries(sample.phases)) {
          if (!phaseData.has(phase)) {
            phaseData.set(phase, []);
          }
          phaseData.get(phase)!.push(time);
        }
        
        if (sample.memory) {
          memorySnapshots.push(sample.memory.heapUsed / 1024 / 1024);
        }
      }
    }
    
    // 进度报告
    if (tickCount % config.reportIntervalTicks === 0) {
      const phase = isWarmup ? '预热' : '测试';
      const targetTick = isWarmup ? config.warmupTicks : config.targetTicks;
      const currentTick = isWarmup ? tickCount : tickCount - config.warmupTicks;
      const progress = ((currentTick / targetTick) * 100).toFixed(0);
      
      const recentTimes = tickTimes.slice(-config.reportIntervalTicks);
      const avgMs = recentTimes.length > 0 
        ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length 
        : 0;
      
      console.log(`   📊 [${phase}] ${progress}% (${currentTick}/${targetTick}) - 最近平均: ${avgMs.toFixed(2)}ms`);
    }
    
    // 预热结束
    if (isWarmup && tickCount >= config.warmupTicks) {
      isWarmup = false;
      console.log('\n🔥 预热完成，开始正式测试...\n');
      tickTimes.length = 0;
      phaseData.clear();
      memorySnapshots.length = 0;
    }
    
    // 测试结束
    if (!isWarmup && tickCount >= config.warmupTicks + config.targetTicks) {
      gameLoop.setSpeed(gameId, 0);
      gameLoop.removeListener('tick', tickHandler);
      
      // 生成报告
      generateReport(tickTimes, phaseData, memorySnapshots, config.targetTicks);
    }
  };
  
  gameLoop.on('tick', tickHandler);
  
  // 开始测试
  console.log('\n🚀 开始运行游戏循环...');
  console.log('   速度: 4x (最高速度)\n');
  
  const startTime = performance.now();
  gameLoop.setSpeed(gameId, 4);
  
  // 等待测试完成
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (tickCount >= config.warmupTicks + config.targetTicks) {
        clearInterval(checkInterval);
        const endTime = performance.now();
        const totalRealTime = endTime - startTime;
        console.log(`\n⏱️ 实际运行时间: ${(totalRealTime / 1000).toFixed(2)}s`);
        console.log(`   实际吞吐量: ${((config.warmupTicks + config.targetTicks) / (totalRealTime / 1000)).toFixed(1)} ticks/sec`);
        resolve();
      }
    }, 100);
  });
  
  // 清理
  gameLoop.destroyGame(gameId);
  console.log('\n✅ 测试完成，游戏已销毁');
}

function generateReport(
  tickTimes: number[],
  phaseData: Map<string, number[]>,
  memorySnapshots: number[],
  targetTicks: number
): void {
  console.log('\n' + '='.repeat(70));
  console.log('📊 完整模拟性能报告');
  console.log('='.repeat(70));
  
  if (tickTimes.length === 0) {
    console.log('❌ 没有收集到足够的性能数据');
    return;
  }
  
  // Tick延迟统计
  const sortedTimes = [...tickTimes].sort((a, b) => a - b);
  const sum = tickTimes.reduce((a, b) => a + b, 0);
  const avg = sum / tickTimes.length;
  const variance = tickTimes.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / tickTimes.length;
  
  console.log(`\n📈 总体统计:`);
  console.log(`   采集样本数: ${tickTimes.length} / ${targetTicks} (${(tickTimes.length / targetTicks * 100).toFixed(1)}%)`);
  
  console.log(`\n⏱️ Tick延迟统计:`);
  console.log(`   平均: ${avg.toFixed(3)}ms`);
  console.log(`   最小: ${sortedTimes[0]?.toFixed(3) ?? 'N/A'}ms`);
  console.log(`   最大: ${sortedTimes[sortedTimes.length - 1]?.toFixed(3) ?? 'N/A'}ms`);
  console.log(`   P50:  ${sortedTimes[Math.floor(sortedTimes.length * 0.5)]?.toFixed(3) ?? 'N/A'}ms`);
  console.log(`   P95:  ${sortedTimes[Math.floor(sortedTimes.length * 0.95)]?.toFixed(3) ?? 'N/A'}ms`);
  console.log(`   P99:  ${sortedTimes[Math.floor(sortedTimes.length * 0.99)]?.toFixed(3) ?? 'N/A'}ms`);
  console.log(`   标准差: ${Math.sqrt(variance).toFixed(3)}ms`);
  
  // 慢tick统计
  const slowThreshold = 50;
  const slowCount = tickTimes.filter(t => t > slowThreshold).length;
  console.log(`\n⚠️ 慢Tick统计 (阈值: ${slowThreshold}ms):`);
  console.log(`   数量: ${slowCount}`);
  console.log(`   占比: ${(slowCount / tickTimes.length * 100).toFixed(2)}%`);
  
  // 各阶段分析
  if (phaseData.size > 0) {
    console.log(`\n🔥 各阶段耗时分析:`);
    
    const phaseStats: Array<{
      name: string;
      avg: number;
      max: number;
      percentage: number;
    }> = [];
    
    const totalAvgTime = avg;
    
    for (const [phase, times] of phaseData) {
      if (times.length === 0) continue;
      const phaseSum = times.reduce((a, b) => a + b, 0);
      const phaseAvg = phaseSum / times.length;
      const phaseMax = Math.max(...times);
      
      phaseStats.push({
        name: phase,
        avg: phaseAvg,
        max: phaseMax,
        percentage: (phaseAvg / totalAvgTime) * 100,
      });
    }
    
    // 按占比排序
    phaseStats.sort((a, b) => b.percentage - a.percentage);
    
    for (const stat of phaseStats) {
      console.log(`   ${stat.name}:`);
      console.log(`      平均: ${stat.avg.toFixed(3)}ms, 最大: ${stat.max.toFixed(3)}ms (${stat.percentage.toFixed(1)}%)`);
    }
  }
  
  // 内存分析
  if (memorySnapshots.length > 0) {
    const memStart = memorySnapshots[0] ?? 0;
    const memEnd = memorySnapshots[memorySnapshots.length - 1] ?? 0;
    const memPeak = Math.max(...memorySnapshots);
    const memAvg = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
    
    console.log(`\n💾 内存使用:`);
    console.log(`   起始: ${memStart.toFixed(1)}MB`);
    console.log(`   结束: ${memEnd.toFixed(1)}MB`);
    console.log(`   峰值: ${memPeak.toFixed(1)}MB`);
    console.log(`   平均: ${memAvg.toFixed(1)}MB`);
    console.log(`   增长: ${(memEnd - memStart).toFixed(1)}MB`);
  }
  
  // 性能评估
  console.log(`\n📋 性能评估:`);
  
  if (avg < 5) {
    console.log(`   ✅ 平均延迟优秀 (<5ms): ${avg.toFixed(2)}ms`);
  } else if (avg < 20) {
    console.log(`   ⚠️ 平均延迟正常 (5-20ms): ${avg.toFixed(2)}ms`);
  } else {
    console.log(`   ❌ 平均延迟过高 (>20ms): ${avg.toFixed(2)}ms`);
  }
  
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] ?? 0;
  if (p99 < 50) {
    console.log(`   ✅ P99延迟优秀 (<50ms): ${p99.toFixed(2)}ms`);
  } else if (p99 < 100) {
    console.log(`   ⚠️ P99延迟正常 (50-100ms): ${p99.toFixed(2)}ms`);
  } else {
    console.log(`   ❌ P99延迟过高 (>100ms): ${p99.toFixed(2)}ms`);
  }
  
  const slowPercentage = (slowCount / tickTimes.length) * 100;
  if (slowPercentage < 1) {
    console.log(`   ✅ 慢tick占比优秀 (<1%): ${slowPercentage.toFixed(2)}%`);
  } else if (slowPercentage < 5) {
    console.log(`   ⚠️ 慢tick占比正常 (1-5%): ${slowPercentage.toFixed(2)}%`);
  } else {
    console.log(`   ❌ 慢tick占比过高 (>5%): ${slowPercentage.toFixed(2)}%`);
  }
  
  // 游戏速度建议
  console.log(`\n🎮 游戏速度建议:`);
  const baseTickMs = 200; // 1x速度下200ms/tick
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] ?? avg;
  const maxSafeSpeed = Math.floor(baseTickMs / p95);
  console.log(`   理论最高安全速度: ${Math.min(maxSafeSpeed, 4)}x (基于P95延迟)`);
  
  if (p95 < 50) {
    console.log(`   4x速度: ✅ 流畅`);
  } else if (p95 < 100) {
    console.log(`   4x速度: ⚠️ 可能偶尔卡顿`);
  } else {
    console.log(`   4x速度: ❌ 不推荐`);
  }
  
  // 使用内置性能报告
  console.log('\n' + '='.repeat(70));
  console.log('📊 内置性能分析器报告');
  console.log('='.repeat(70));
  performanceProfiler.logReport(tickTimes.length);
  
  // 输出JSON结果
  console.log('\n📄 JSON汇总:');
  const jsonResult = {
    totalSamples: tickTimes.length,
    targetTicks,
    tickMetrics: {
      avgMs: avg,
      minMs: sortedTimes[0] ?? 0,
      maxMs: sortedTimes[sortedTimes.length - 1] ?? 0,
      p50Ms: sortedTimes[Math.floor(sortedTimes.length * 0.5)] ?? 0,
      p95Ms: p95,
      p99Ms: p99,
      stdDev: Math.sqrt(variance),
    },
    slowTicks: {
      count: slowCount,
      percentage: slowPercentage,
      threshold: slowThreshold,
    },
    memory: memorySnapshots.length > 0 ? {
      startMB: memorySnapshots[0],
      endMB: memorySnapshots[memorySnapshots.length - 1],
      peakMB: Math.max(...memorySnapshots),
      growthMB: (memorySnapshots[memorySnapshots.length - 1] ?? 0) - (memorySnapshots[0] ?? 0),
    } : null,
  };
  console.log(JSON.stringify(jsonResult, null, 2));
  
  console.log('\n' + '='.repeat(70) + '\n');
}

// 主函数
async function main() {
  try {
    await runFullSimulationBenchmark({
      targetTicks: 3000,
      warmupTicks: 100,
      reportIntervalTicks: 300,
    });
  } catch (error) {
    console.error('❌ 基准测试失败:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();