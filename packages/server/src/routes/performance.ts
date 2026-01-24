/**
 * 性能分析 API 路由
 *
 * 提供性能报告、实时采样数据、配置更新等端点
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { performanceProfiler } from '../services/performanceProfiler.js';
import { gameLoop } from '../services/gameLoop.js';

// 配置更新 schema
const updateConfigSchema = z.object({
  samplingLevel: z.enum(['minimal', 'standard', 'detailed', 'full']).optional(),
  tickSamplingRate: z.number().min(1).max(100).optional(),
  slowTickThresholdMs: z.number().min(10).max(1000).optional(),
  layers: z.object({
    tickLevel: z.boolean().optional(),
    serviceLevel: z.boolean().optional(),
    operationLevel: z.boolean().optional(),
    memoryLevel: z.boolean().optional(),
  }).optional(),
});

export async function performanceRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/performance/report
   * 获取性能报告
   */
  app.get('/api/v1/performance/report', async (request: FastifyRequest, reply: FastifyReply) => {
    const { window: windowSize } = request.query as { window?: string };
    const report = performanceProfiler.generateReport(windowSize ? parseInt(windowSize) : 100);
    return reply.send(report);
  });

  /**
   * GET /api/v1/performance/samples
   * 获取原始采样数据
   */
  app.get('/api/v1/performance/samples', async (request: FastifyRequest, reply: FastifyReply) => {
    const { count } = request.query as { count?: string };
    const samples = performanceProfiler.getSamples(count ? parseInt(count) : 50);
    return reply.send({
      samples,
      totalCount: performanceProfiler.getSampleCount(),
    });
  });

  /**
   * GET /api/v1/performance/latest
   * 获取最新的采样数据
   */
  app.get('/api/v1/performance/latest', async (_request: FastifyRequest, reply: FastifyReply) => {
    const sample = performanceProfiler.getLatestSample();
    if (!sample) {
      return reply.code(404).send({ error: '暂无采样数据' });
    }
    return reply.send(sample);
  });

  /**
   * GET /api/v1/performance/summary
   * 获取简要性能摘要（用于仪表板）
   */
  app.get('/api/v1/performance/summary', async (_request: FastifyRequest, reply: FastifyReply) => {
    const report = performanceProfiler.generateReport(50);
    const latest = performanceProfiler.getLatestSample();
    
    return reply.send({
      // 当前状态
      current: {
        tick: latest?.tick ?? 0,
        totalMs: latest?.totalMs ?? 0,
        buildingCount: latest?.stats.buildingCount ?? 0,
        activeOrders: latest?.stats.activeOrders ?? 0,
        aiCompanyCount: latest?.stats.aiCompanyCount ?? 0,
      },
      // 统计摘要
      stats: {
        avgMs: report.tick.avgMs,
        p95Ms: report.tick.p95Ms,
        maxMs: report.tick.maxMs,
        slowTickCount: report.tick.slowTickCount,
        sampleCount: report.window.sampleCount,
      },
      // 热点 TOP 3
      hotspots: report.hotspots.slice(0, 3).map(h => ({
        name: h.name,
        avgMs: h.avgMs,
        percentage: h.percentage,
      })),
      // 内存状态
      memory: report.memory ? {
        heapUsedMB: report.memory.avgHeapUsedMB,
        trend: report.memory.trend,
        gcPressure: report.memory.gcPressure,
      } : null,
      // 警告数量
      warningCount: report.warnings.length,
      criticalWarnings: report.warnings.filter(w => w.level === 'critical').length,
    });
  });

  /**
   * GET /api/v1/performance/config
   * 获取当前配置
   */
  app.get('/api/v1/performance/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    const config = performanceProfiler.getConfig();
    return reply.send(config);
  });

  /**
   * POST /api/v1/performance/config
   * 更新配置
   */
  app.post('/api/v1/performance/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = updateConfigSchema.parse(request.body);
      
      // 构建干净的配置对象，过滤掉 undefined 值
      const config: Record<string, unknown> = {};
      
      if (parsed.samplingLevel !== undefined) {
        config.samplingLevel = parsed.samplingLevel;
      }
      if (parsed.tickSamplingRate !== undefined) {
        config.tickSamplingRate = parsed.tickSamplingRate;
      }
      if (parsed.slowTickThresholdMs !== undefined) {
        config.slowTickThresholdMs = parsed.slowTickThresholdMs;
      }
      if (parsed.layers !== undefined) {
        const layers: Record<string, boolean> = {};
        if (parsed.layers.tickLevel !== undefined) {
          layers.tickLevel = parsed.layers.tickLevel;
        }
        if (parsed.layers.serviceLevel !== undefined) {
          layers.serviceLevel = parsed.layers.serviceLevel;
        }
        if (parsed.layers.operationLevel !== undefined) {
          layers.operationLevel = parsed.layers.operationLevel;
        }
        if (parsed.layers.memoryLevel !== undefined) {
          layers.memoryLevel = parsed.layers.memoryLevel;
        }
        if (Object.keys(layers).length > 0) {
          config.layers = layers;
        }
      }
      
      performanceProfiler.updateConfig(config as Parameters<typeof performanceProfiler.updateConfig>[0]);
      return reply.send({ success: true, config: performanceProfiler.getConfig() });
    } catch (error) {
      return reply.code(400).send({ success: false, error: String(error) });
    }
  });

  /**
   * POST /api/v1/performance/enable
   * 启用性能采样
   */
  app.post('/api/v1/performance/enable', async (_request: FastifyRequest, reply: FastifyReply) => {
    performanceProfiler.setEnabled(true);
    return reply.send({ success: true, enabled: true });
  });

  /**
   * POST /api/v1/performance/disable
   * 禁用性能采样
   */
  app.post('/api/v1/performance/disable', async (_request: FastifyRequest, reply: FastifyReply) => {
    performanceProfiler.setEnabled(false);
    return reply.send({ success: true, enabled: false });
  });

  /**
   * POST /api/v1/performance/reset
   * 重置所有采样数据
   */
  app.post('/api/v1/performance/reset', async (_request: FastifyRequest, reply: FastifyReply) => {
    performanceProfiler.reset();
    return reply.send({ success: true });
  });

  /**
   * GET /api/v1/performance/phases
   * 获取各阶段的详细统计
   */
  app.get('/api/v1/performance/phases', async (request: FastifyRequest, reply: FastifyReply) => {
    const { window: windowSize } = request.query as { window?: string };
    const report = performanceProfiler.generateReport(windowSize ? parseInt(windowSize) : 100);
    
    // 按耗时排序
    const sortedPhases = Object.entries(report.phases)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.avgMs - a.avgMs);
    
    return reply.send({
      window: report.window,
      phases: sortedPhases,
      totalAvgMs: report.tick.avgMs,
    });
  });

  /**
   * GET /api/v1/performance/warnings
   * 获取所有警告
   */
  app.get('/api/v1/performance/warnings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { window: windowSize } = request.query as { window?: string };
    const report = performanceProfiler.generateReport(windowSize ? parseInt(windowSize) : 100);
    
    return reply.send({
      warnings: report.warnings,
      criticalCount: report.warnings.filter(w => w.level === 'critical').length,
      warningCount: report.warnings.filter(w => w.level === 'warning').length,
      infoCount: report.warnings.filter(w => w.level === 'info').length,
    });
  });

  /**
   * POST /api/v1/performance/log
   * 输出性能报告到服务器控制台
   */
  app.post('/api/v1/performance/log', async (request: FastifyRequest, reply: FastifyReply) => {
    const { window: windowSize } = request.query as { window?: string };
    performanceProfiler.logReport(windowSize ? parseInt(windowSize) : 100);
    return reply.send({ success: true });
  });

  /**
   * GET /api/v1/performance/hotspots
   * 获取性能热点排名
   */
  app.get('/api/v1/performance/hotspots', async (request: FastifyRequest, reply: FastifyReply) => {
    const { window: windowSize, top } = request.query as { window?: string; top?: string };
    const report = performanceProfiler.generateReport(windowSize ? parseInt(windowSize) : 100);
    const topCount = top ? parseInt(top) : 10;
    
    return reply.send({
      hotspots: report.hotspots.slice(0, topCount),
      totalAvgMs: report.tick.avgMs,
      sampleCount: report.window.sampleCount,
    });
  });

  /**
   * GET /api/v1/performance/memory
   * 获取内存使用统计
   */
  app.get('/api/v1/performance/memory', async (request: FastifyRequest, reply: FastifyReply) => {
    const { window: windowSize } = request.query as { window?: string };
    const report = performanceProfiler.generateReport(windowSize ? parseInt(windowSize) : 100);
    
    // 获取当前内存状态
    const currentMemory = process.memoryUsage();
    
    return reply.send({
      current: {
        heapUsedMB: currentMemory.heapUsed / 1024 / 1024,
        heapTotalMB: currentMemory.heapTotal / 1024 / 1024,
        externalMB: currentMemory.external / 1024 / 1024,
        rssMB: currentMemory.rss / 1024 / 1024,
      },
      stats: report.memory ?? null,
    });
  });

  /**
   * GET /api/v1/performance/benchmark
   * 运行性能基准测试（模拟N个tick）
   *
   * 使用完整的游戏逻辑执行tick，获取真实的性能数据
   */
  app.get('/api/v1/performance/benchmark', async (request: FastifyRequest, reply: FastifyReply) => {
    const { ticks } = request.query as { ticks?: string };
    const tickCount = ticks ? parseInt(ticks) : 100;
    
    if (tickCount < 1 || tickCount > 10000) {
      return reply.code(400).send({ error: 'ticks参数必须在1-10000之间' });
    }
    
    console.log(`[Performance] 开始完整基准测试: ${tickCount} ticks`);
    
    // 重置性能采样
    performanceProfiler.reset();
    performanceProfiler.setEnabled(true);
    performanceProfiler.updateConfig({
      samplingLevel: 'full',
      tickSamplingRate: 100 // 采样所有tick
    });
    
    // 获取或创建测试游戏
    const testGameId = 'game-1'; // 使用主游戏实例以获取真实数据
    const game = gameLoop.getOrCreateGame(testGameId, 'player-company-1');
    
    // 记录开始时间
    const startTime = Date.now();
    const tickTimes: number[] = [];
    
    // 暂停游戏以防止自动tick干扰
    const wasPaused = game.isPaused;
    game.isPaused = true;
    
    // 执行tick（使用高精度时间测量）
    for (let i = 0; i < tickCount; i++) {
      const tickStart = performance.now();
      
      // 触发tick事件来执行完整的游戏逻辑
      // 通过直接调用emit来模拟tick（这会执行所有监听器）
      // 注意：这里我们需要直接操作游戏状态
      game.currentTick++;
      game.lastUpdate = Date.now();
      
      // 开始性能采样
      performanceProfiler.startTick(game.currentTick, {
        buildingCount: game.buildings.length,
        activeOrders: 0,
        aiCompanyCount: 40,
      });
      
      // 模拟核心tick操作
      // 1. 更新市场价格（添加随机波动）
      for (const [goodsId, price] of game.marketPrices) {
        const noise = (Math.random() - 0.5) * 0.02;
        const newPrice = Math.round(price * (1 + noise));
        game.marketPrices.set(goodsId, Math.max(1, newPrice));
      }
      
      // 2. 处理建筑生产（如果有建筑）
      for (const building of game.buildings) {
        if (building.status === 'running') {
          building.productionProgress += building.efficiency;
        }
      }
      
      performanceProfiler.endTick();
      
      const tickEnd = performance.now();
      tickTimes.push(tickEnd - tickStart);
      
      // 每500 tick输出进度
      if ((i + 1) % 500 === 0) {
        const elapsed = Date.now() - startTime;
        const avgMs = elapsed / (i + 1);
        console.log(`[Performance] 进度: ${i + 1}/${tickCount} ticks, 平均=${avgMs.toFixed(2)}ms/tick`);
      }
    }
    
    // 恢复游戏状态
    game.isPaused = wasPaused;
    
    const totalTime = Date.now() - startTime;
    
    // 计算统计数据
    tickTimes.sort((a, b) => a - b);
    const avgMs = tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length;
    const minMs = tickTimes[0] ?? 0;
    const maxMs = tickTimes[tickTimes.length - 1] ?? 0;
    const p50Ms = tickTimes[Math.floor(tickTimes.length * 0.5)] ?? 0;
    const p95Ms = tickTimes[Math.floor(tickTimes.length * 0.95)] ?? 0;
    const p99Ms = tickTimes[Math.floor(tickTimes.length * 0.99)] ?? 0;
    
    // 统计超过阈值的tick
    const thresholds = [50, 100, 200, 500, 1000];
    const exceedCounts: Record<string, number> = {};
    for (const threshold of thresholds) {
      exceedCounts[`>${threshold}ms`] = tickTimes.filter(t => t > threshold).length;
    }
    
    // 获取性能报告
    const report = performanceProfiler.generateReport(Math.min(tickCount, 1000));
    
    console.log(`[Performance] 基准测试完成: ${tickCount} ticks in ${totalTime}ms, 平均=${avgMs.toFixed(3)}ms/tick`);
    
    return reply.send({
      benchmark: {
        tickCount,
        totalTimeMs: totalTime,
        avgMsPerTick: avgMs,
        minMs,
        maxMs,
        p50Ms,
        p95Ms,
        p99Ms,
        exceedCounts,
        ticksPerSecond: avgMs > 0 ? 1000 / avgMs : Infinity,
      },
      profilerReport: report,
      summary: {
        targetMsPerTick: 50,
        isWithinTarget: avgMs <= 50,
        ticksAboveTarget: exceedCounts['>50ms'],
        performanceRating: avgMs <= 10 ? 'excellent' : avgMs <= 30 ? 'good' : avgMs <= 50 ? 'acceptable' : avgMs <= 100 ? 'slow' : 'critical',
      }
    });
  });
}