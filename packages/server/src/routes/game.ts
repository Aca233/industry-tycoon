/**
 * Game API Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { gameLoop, type BuildingInstance } from '../services/gameLoop.js';
import { economyManager } from '../services/economyManager.js';
import { autoTradeManager } from '../services/autoTradeManager.js';

// Request schemas
const createGameSchema = z.object({
  name: z.string().min(1).max(100),
  playerCompanyName: z.string().min(1).max(100),
});

const updateBuildingMethodSchema = z.object({
  slotType: z.string(),
  methodId: z.string(),
});

const setGameSpeedSchema = z.object({
  speed: z.number().min(0).max(4),
  isPaused: z.boolean().optional(),
});

export async function gameRoutes(app: FastifyInstance) {
  // Create new game
  app.post('/api/v1/games', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createGameSchema.parse(request.body);
    
    // TODO: Create game in database with Prisma
    const game = {
      id: `game-${Date.now()}`,
      name: body.name,
      currentTick: 0,
      speed: 1,
      isPaused: true,
      playerCompany: {
        id: `company-${Date.now()}`,
        name: body.playerCompanyName,
        type: 'player',
        cash: 500000000,
        debt: 0,
        creditRating: 'A',
        stockPrice: 10000,
        sharesOutstanding: 1000000,
        marketCap: 10000000000,
        publicReputation: 75,
        supplierReputation: 80,
        employeeReputation: 70,
      },
      createdAt: new Date().toISOString(),
    };
    
    return reply.code(201).send(game);
  });

  // Get game state
  app.get('/api/v1/games/:gameId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    // Get or create game from gameLoop
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    
    const game = {
      id: gameState.id,
      name: 'Test Game',
      currentTick: gameState.currentTick,
      speed: gameState.speed,
      isPaused: gameState.isPaused,
      playerCompanyId: gameState.playerCompanyId,
      playerCash: gameState.playerCash,
      buildingCount: gameState.buildings.length,
      buildings: [],
      companies: [],
      marketSummaries: {},
    };
    
    return reply.send(game);
  });

  // Update game speed/pause
  app.patch('/api/v1/games/:gameId/control', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    const body = setGameSpeedSchema.parse(request.body);
    
    // 确保游戏存在
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    // 根据 isPaused 参数决定操作
    if (body.isPaused === false) {
      // 取消暂停，开始游戏
      gameLoop.setSpeed(gameId, body.speed as import('@scc/shared').GameSpeed);
    } else if (body.isPaused === true || body.speed === 0) {
      // 暂停游戏
      gameLoop.setSpeed(gameId, 0 as import('@scc/shared').GameSpeed);
    } else {
      // 仅改变速度
      gameLoop.setSpeed(gameId, body.speed as import('@scc/shared').GameSpeed);
    }
    
    // 获取更新后的状态
    const updatedState = gameLoop.getGame(gameId);
    
    app.log.info({ gameId, ...body }, 'Game control updated');
    
    return reply.send({
      gameId,
      speed: updatedState?.speed ?? body.speed,
      isPaused: updatedState?.isPaused ?? (body.speed === 0)
    });
  });

  // Get all buildings for a game
  app.get('/api/v1/games/:gameId/buildings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    // Get buildings from gameLoop
    const gameBuildings = gameLoop.getBuildings(gameId);
    
    app.log.info({ gameId, buildingCount: gameBuildings.length }, 'Getting buildings for game');
    
    const buildings = gameBuildings.map((b: BuildingInstance) => ({
      id: b.id,
      name: b.name,
      type: b.definitionId,
      companyId: 'player-company-1',
      zoneId: 'default',
      position: b.position,
      activeMethodIds: { process: b.currentMethodId },
      currentMethodId: b.currentMethodId,
      efficiency: b.efficiency,
      utilization: b.utilization,
      status: b.status, // 关键：包含建筑状态
      productionProgress: b.productionProgress,
      constructionProgress: b.constructionProgress,
      constructionTimeRequired: b.constructionTimeRequired,
    }));
    
    return reply.send({ buildings });
  });

  // Create a new building (purchase)
  app.post('/api/v1/games/:gameId/buildings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const createBuildingSchema = z.object({
      buildingType: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }).optional(),
    });
    
    const body = createBuildingSchema.parse(request.body);
    
    // 确保游戏存在
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    // 调用 gameLoop 的购买建筑方法
    const result = gameLoop.purchaseBuilding(gameId, body.buildingType);
    
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    
    // 如果提供了位置，更新建筑位置
    if (result.building && body.position) {
      result.building.position = body.position;
    }
    
    app.log.info({ gameId, buildingType: body.buildingType, buildingId: result.building?.id }, 'Building purchased');
    
    return reply.code(201).send({
      success: true,
      building: result.building,
      newCash: result.newCash,
    });
  });

  // Update building production method
  app.put('/api/v1/games/:gameId/buildings/:buildingId/methods', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, buildingId } = request.params as { gameId: string; buildingId: string };
    const body = updateBuildingMethodSchema.parse(request.body);
    
    // TODO: Update in database and recalculate
    app.log.info({ gameId, buildingId, ...body }, 'Production method updated');
    
    return reply.send({
      buildingId,
      activeMethodIds: { [body.slotType]: body.methodId },
      updated: true,
    });
  });

  // Get market data with current prices
  app.get('/api/v1/games/:gameId/market', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    // Get real market prices from gameLoop
    const prices = gameLoop.getMarketPrices(gameId);
    
    const goods = Object.entries(prices).map(([id, price]) => ({
      id,
      name: id,
      price,
      trend: 'stable',
      volume: 1000,
    }));
    
    return reply.send({
      goods,
      prices,
      defcon: 1, // Market stability level
    });
  });
  
  // Get price history for goods
  app.get('/api/v1/games/:gameId/market/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    const { goodsId } = request.query as { goodsId?: string };
    
    if (goodsId) {
      // Get history for specific goods
      const history = gameLoop.getPriceHistory(gameId, goodsId);
      return reply.send({ goodsId, history });
    } else {
      // Get all price histories
      const allHistory = gameLoop.getPriceHistory(gameId) as Map<string, Array<{ tick: number; price: number }>>;
      const historyObj: Record<string, Array<{ tick: number; price: number }>> = {};
      
      if (allHistory instanceof Map) {
        for (const [id, entries] of allHistory) {
          historyObj[id] = entries;
        }
      }
      
      return reply.send({ history: historyObj });
    }
  });

  // Get active events
  app.get('/api/v1/games/:gameId/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId: _gameId } = request.params as { gameId: string };
    
    // TODO: Fetch from database
    const events = [
      {
        id: 'event-1',
        type: 'market_shift',
        severity: 'moderate',
        title: 'Wellness Trend Rising',
        description: 'Consumer preference shifting towards health products.',
        tick: 100,
        isResolved: false,
      },
    ];
    
    return reply.send({ events });
  });

  // Get contracts
  app.get('/api/v1/games/:gameId/contracts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId: _gameId } = request.params as { gameId: string };
    const { companyId: _companyId } = request.query as { companyId?: string };
    
    // TODO: Fetch from database
    const contracts: Array<{ id: string; status: string }> = [];
    
    return reply.send({ contracts });
  });

  // Create contract proposal
  app.post('/api/v1/games/:gameId/contracts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId: _gameId } = request.params as { gameId: string };
    
    const contractSchema = z.object({
      sellerId: z.string(),
      buyerId: z.string(),
      goodsId: z.string(),
      quantity: z.number().positive(),
      pricePerUnit: z.number().positive(),
      type: z.enum(['spot', 'long_term']),
      durationTicks: z.number().optional(),
    });
    
    const body = contractSchema.parse(request.body);
    
    // TODO: Create contract, possibly involving AI negotiation
    const contract = {
      id: `contract-${Date.now()}`,
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    return reply.code(201).send(contract);
  });

  // ========== 经济系统API ==========

  // 获取玩家库存
  app.get('/api/v1/games/:gameId/inventory', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    // 使用 getOrCreateGame 确保游戏和库存已初始化
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    
    try {
      const inventory = economyManager.getPlayerInventory(gameState.playerCompanyId);
      if (!inventory) {
        return reply.send({ stocks: [], totalValue: 0 });
      }
      
      return reply.send(inventory);
    } catch (error) {
      app.log.error({ error, gameId }, 'Failed to get player inventory');
      return reply.send({ stocks: [], totalValue: 0 });
    }
  });

  // 获取市场订单簿
  app.get('/api/v1/games/:gameId/market/orderbook/:goodsId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, goodsId } = request.params as { gameId: string; goodsId: string };
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const orderBook = economyManager.getOrderBook(goodsId);
    const depth = economyManager.getMarketDepth(goodsId, 10);
    
    return reply.send({ orderBook, depth });
  });

  // 获取市场概况（包括价格、交易量等）
  app.get('/api/v1/games/:gameId/market/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const overview = economyManager.getMarketOverview();
    const stats = economyManager.getStats();
    
    return reply.send({ overview, stats });
  });

  // 获取交易历史
  app.get('/api/v1/games/:gameId/market/trades', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    const { goodsId, limit } = request.query as { goodsId?: string; limit?: string };
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const trades = economyManager.getTradeHistory(goodsId, limit ? parseInt(limit) : 100);
    
    return reply.send({ trades });
  });

  // 提交买单
  app.post('/api/v1/games/:gameId/orders/buy', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const buyOrderSchema = z.object({
      goodsId: z.string(),
      quantity: z.number().positive(),
      maxPrice: z.number().positive(),
    });
    
    const body = buyOrderSchema.parse(request.body);
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const result = economyManager.playerSubmitBuyOrder(
      gameState.playerCompanyId,
      body.goodsId,
      body.quantity,
      body.maxPrice
    );
    
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    
    return reply.code(201).send({ order: result.order });
  });

  // 提交卖单
  app.post('/api/v1/games/:gameId/orders/sell', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const sellOrderSchema = z.object({
      goodsId: z.string(),
      quantity: z.number().positive(),
      minPrice: z.number().positive(),
    });
    
    const body = sellOrderSchema.parse(request.body);
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const result = economyManager.playerSubmitSellOrder(
      gameState.playerCompanyId,
      body.goodsId,
      body.quantity,
      body.minPrice
    );
    
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    
    return reply.code(201).send({ order: result.order });
  });

  // 取消订单
  app.delete('/api/v1/games/:gameId/orders/:orderId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, orderId } = request.params as { gameId: string; orderId: string };
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const result = economyManager.playerCancelOrder(gameState.playerCompanyId, orderId);
    
    if (!result.success) {
      return reply.code(400).send({ error: result.error });
    }
    
    return reply.send({ success: true });
  });

  // 获取玩家活跃订单
  app.get('/api/v1/games/:gameId/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const orders = economyManager.getPlayerActiveOrders(gameState.playerCompanyId);
    
    return reply.send({ orders });
  });

  // 获取价格历史（经济系统版本）
  app.get('/api/v1/games/:gameId/market/price-history/:goodsId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, goodsId } = request.params as { gameId: string; goodsId: string };
    const { limit } = request.query as { limit?: string };
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const history = economyManager.getPriceHistory(goodsId, limit ? parseInt(limit) : undefined);
    const currentPrice = economyManager.getMarketPrice(goodsId);
    
    return reply.send({ goodsId, currentPrice, history });
  });

  // 获取市场占比数据
  app.get('/api/v1/games/:gameId/market/share/:goodsId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, goodsId } = request.params as { gameId: string; goodsId: string };
    const { ticks } = request.query as { ticks?: string };
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const tickCount = ticks ? parseInt(ticks) : 30; // 默认统计最近30天（30 tick，1 tick = 1天）
    const marketShare = economyManager.getMarketShare(goodsId, tickCount);
    const playerShare = economyManager.getPlayerMarketShare(gameState.playerCompanyId, goodsId, tickCount);
    
    return reply.send({
      marketShare,
      playerShare,
      playerCompanyId: gameState.playerCompanyId,
    });
  });

  // ========== 自动交易API ==========

  // 获取自动交易状态
  app.get('/api/v1/games/:gameId/auto-trade', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    const status = autoTradeManager.getStatus(gameState.playerCompanyId);
    return reply.send(status);
  });

  // 开关自动交易
  app.post('/api/v1/games/:gameId/auto-trade/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const toggleSchema = z.object({
      enabled: z.boolean(),
    });
    
    const body = toggleSchema.parse(request.body);
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    autoTradeManager.setEnabled(gameState.playerCompanyId, body.enabled);
    const status = autoTradeManager.getStatus(gameState.playerCompanyId);
    
    return reply.send({ success: true, status });
  });

  // 根据建筑自动配置
  app.post('/api/v1/games/:gameId/auto-trade/auto-configure', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    // 转换建筑类型以匹配 BuildingInstance 接口
    const buildings = gameState.buildings.map(b => ({
      id: b.id,
      definitionId: b.definitionId,
      ownerId: gameState.playerCompanyId,
      activeMethodIds: { process: b.currentMethodId } as Record<string, string>,
      inputInventory: [],
      outputInventory: [],
      status: b.status,
      efficiency: b.efficiency,
      productionProgress: b.productionProgress,
    }));
    
    autoTradeManager.autoConfigureFromBuildings(
      gameState.playerCompanyId,
      buildings as unknown as import('@scc/shared').BuildingInstance[],
      gameState as unknown as import('@scc/shared').GameState
    );
    
    const status = autoTradeManager.getStatus(gameState.playerCompanyId);
    return reply.send({ success: true, status });
  });

  // 更新商品配置
  app.put('/api/v1/games/:gameId/auto-trade/goods/:goodsId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, goodsId } = request.params as { gameId: string; goodsId: string };
    
    const updateConfigSchema = z.object({
      autoBuy: z.object({
        enabled: z.boolean().optional(),
        triggerThreshold: z.number().positive().optional(),
        targetStock: z.number().positive().optional(),
        maxPriceMultiplier: z.number().positive().optional(),
      }).optional(),
      autoSell: z.object({
        enabled: z.boolean().optional(),
        triggerThreshold: z.number().positive().optional(),
        reserveStock: z.number().nonnegative().optional(),
        minPriceMultiplier: z.number().positive().optional(),
      }).optional(),
    });
    
    const body = updateConfigSchema.parse(request.body);
    
    const gameState = gameLoop.getGame(gameId);
    if (!gameState) {
      return reply.code(404).send({ error: '游戏不存在' });
    }
    
    // 过滤掉undefined值，构建干净的配置对象
    const cleanConfig: {
      autoBuy?: Record<string, boolean | number>;
      autoSell?: Record<string, boolean | number>;
    } = {};
    
    if (body.autoBuy) {
      cleanConfig.autoBuy = {};
      for (const [key, value] of Object.entries(body.autoBuy)) {
        if (value !== undefined) {
          cleanConfig.autoBuy[key] = value;
        }
      }
    }
    
    if (body.autoSell) {
      cleanConfig.autoSell = {};
      for (const [key, value] of Object.entries(body.autoSell)) {
        if (value !== undefined) {
          cleanConfig.autoSell[key] = value;
        }
      }
    }
    
    autoTradeManager.updateGoodsConfig(gameState.playerCompanyId, goodsId, cleanConfig);
    const status = autoTradeManager.getStatus(gameState.playerCompanyId);
    
    return reply.send({ success: true, status });
  });
}