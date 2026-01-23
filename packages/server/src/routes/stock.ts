/**
 * Stock Market API Routes
 * 股票市场相关API路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { stockMarketService } from '../services/stockMarket.js';
import { StockOrderType, StockOrderSide } from '@scc/shared';

export async function stockRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/stocks
   * 获取所有股票列表
   */
  app.get('/api/v1/stocks', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stocks = stockMarketService.getAllStocks();
      const marketState = stockMarketService.getMarketState();
      
      return reply.send({
        success: true,
        data: {
          stocks,
          marketState,
        },
      });
    } catch (error) {
      console.error('[StockAPI] Error getting stocks:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get stocks',
      });
    }
  });

  /**
   * GET /api/v1/stocks/market/state
   * 获取市场状态
   */
  app.get('/api/v1/stocks/market/state', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const marketState = stockMarketService.getMarketState();
      
      return reply.send({
        success: true,
        data: marketState,
      });
    } catch (error) {
      console.error('[StockAPI] Error getting market state:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get market state',
      });
    }
  });

  /**
   * GET /api/v1/stocks/trades/recent
   * 获取最近成交记录
   */
  app.get('/api/v1/stocks/trades/recent', async (request: FastifyRequest<{
    Querystring: { limit?: string; stockId?: string };
  }>, reply: FastifyReply) => {
    try {
      const limit = parseInt(request.query.limit || '50');
      const stockId = request.query.stockId;
      
      const trades = stockMarketService.getRecentTrades(stockId, limit);
      
      return reply.send({
        success: true,
        data: trades,
      });
    } catch (error) {
      console.error('[StockAPI] Error getting recent trades:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get recent trades',
      });
    }
  });

  /**
   * GET /api/v1/stocks/holdings/:holderId
   * 获取某公司/个人的持股列表
   */
  app.get('/api/v1/stocks/holdings/:holderId', async (request: FastifyRequest<{
    Params: { holderId: string };
  }>, reply: FastifyReply) => {
    try {
      const { holderId } = request.params;
      const shareholdings = stockMarketService.getShareholdings(holderId);
      
      // 计算每个持股的当前市值
      const holdingsWithValue = shareholdings.map(holding => {
        const stock = stockMarketService.getStock(holding.companyId);
        const marketValue = stock ? stock.currentPrice * holding.shares : 0;
        const unrealizedPnL = marketValue - holding.costBasis;
        const pnLPercent = holding.costBasis > 0 ? unrealizedPnL / holding.costBasis : 0;
        
        return {
          ...holding,
          currentPrice: stock?.currentPrice ?? 0,
          marketValue,
          unrealizedPnL,
          pnLPercent,
          ticker: stock?.ticker ?? '',
        };
      });
      
      return reply.send({
        success: true,
        data: holdingsWithValue,
      });
    } catch (error) {
      console.error('[StockAPI] Error getting holdings:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get holdings',
      });
    }
  });

  /**
   * GET /api/v1/stocks/:stockId
   * 获取单个股票详情
   */
  app.get('/api/v1/stocks/:stockId', async (request: FastifyRequest<{
    Params: { stockId: string };
  }>, reply: FastifyReply) => {
    try {
      const { stockId } = request.params;
      const stock = stockMarketService.getStock(stockId);
      
      if (!stock) {
        return reply.code(404).send({
          success: false,
          error: 'Stock not found',
        });
      }
      
      const priceHistory = stockMarketService.getPriceHistory(stockId);
      const stockholders = stockMarketService.getStockholders(stockId);
      const recentTrades = stockMarketService.getRecentTrades(stockId, 20);
      const valuation = stockMarketService.calculateValuation(stockId);
      
      return reply.send({
        success: true,
        data: {
          stock,
          priceHistory: priceHistory.slice(-100), // 最近100条
          stockholders,
          recentTrades,
          valuation,
        },
      });
    } catch (error) {
      console.error('[StockAPI] Error getting stock:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get stock',
      });
    }
  });

  /**
   * GET /api/v1/stocks/:stockId/history
   * 获取股价历史
   */
  app.get('/api/v1/stocks/:stockId/history', async (request: FastifyRequest<{
    Params: { stockId: string };
    Querystring: { limit?: string };
  }>, reply: FastifyReply) => {
    try {
      const { stockId } = request.params;
      const limit = parseInt(request.query.limit || '100');
      
      const priceHistory = stockMarketService.getPriceHistory(stockId);
      
      return reply.send({
        success: true,
        data: priceHistory.slice(-limit),
      });
    } catch (error) {
      console.error('[StockAPI] Error getting price history:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get price history',
      });
    }
  });

  /**
   * GET /api/v1/stocks/:stockId/depth
   * 获取市场深度（盘口买卖五档）
   */
  app.get('/api/v1/stocks/:stockId/depth', async (request: FastifyRequest<{
    Params: { stockId: string };
    Querystring: { levels?: string };
  }>, reply: FastifyReply) => {
    try {
      const { stockId } = request.params;
      const levels = parseInt(request.query.levels || '5');
      
      const stock = stockMarketService.getStock(stockId);
      if (!stock) {
        return reply.code(404).send({
          success: false,
          error: 'Stock not found',
        });
      }
      
      const depth = stockMarketService.getMarketDepth(stockId, levels);
      
      return reply.send({
        success: true,
        data: {
          stockId,
          ticker: stock.ticker,
          currentPrice: stock.currentPrice,
          ...depth,
        },
      });
    } catch (error) {
      console.error('[StockAPI] Error getting market depth:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get market depth',
      });
    }
  });

  /**
   * POST /api/v1/stocks/order
   * 提交股票订单
   */
  app.post('/api/v1/stocks/order', async (request: FastifyRequest<{
    Body: {
      companyId: string;
      stockId: string;
      orderType: string;
      side: string;
      quantity: number;
      limitPrice?: number;
    };
  }>, reply: FastifyReply) => {
    try {
      const { companyId, stockId, orderType, side, quantity, limitPrice } = request.body;
      
      // 验证参数
      if (!companyId || !stockId || !orderType || !side || !quantity) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required parameters',
        });
      }
      
      if (!Object.values(StockOrderType).includes(orderType as StockOrderType)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid order type',
        });
      }
      
      if (!Object.values(StockOrderSide).includes(side as StockOrderSide)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid order side',
        });
      }
      
      if (quantity <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'Quantity must be positive',
        });
      }
      
      // 提交订单
      const result = stockMarketService.submitOrder({
        companyId,
        stockId,
        orderType: orderType as StockOrderType,
        side: side as StockOrderSide,
        quantity,
        limitPrice,
      });
      
      if (result.success) {
        return reply.send({
          success: true,
          data: result,
        });
      } else {
        return reply.code(400).send({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error('[StockAPI] Error submitting order:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to submit order',
      });
    }
  });

  /**
   * GET /api/v1/stocks/orders/:companyId
   * 获取某公司的所有挂单
   */
  app.get('/api/v1/stocks/orders/:companyId', async (request: FastifyRequest<{
    Params: { companyId: string };
  }>, reply: FastifyReply) => {
    try {
      const { companyId } = request.params;
      const orders = stockMarketService.getOrdersByCompany(companyId);
      
      // 附加股票信息
      const ordersWithStock = orders.map(order => {
        const stock = stockMarketService.getStock(order.stockId);
        return {
          ...order,
          ticker: stock?.ticker ?? '',
          currentPrice: stock?.currentPrice ?? 0,
        };
      });
      
      return reply.send({
        success: true,
        data: ordersWithStock,
      });
    } catch (error) {
      console.error('[StockAPI] Error getting orders:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get orders',
      });
    }
  });

  /**
   * DELETE /api/v1/stocks/order/:stockId/:orderId
   * 取消订单
   */
  app.delete('/api/v1/stocks/order/:stockId/:orderId', async (request: FastifyRequest<{
    Params: { stockId: string; orderId: string };
  }>, reply: FastifyReply) => {
    try {
      const { stockId, orderId } = request.params;
      
      const success = stockMarketService.cancelOrder(stockId, orderId);
      
      if (success) {
        return reply.send({
          success: true,
          message: 'Order cancelled',
        });
      } else {
        return reply.code(400).send({
          success: false,
          error: 'Failed to cancel order',
        });
      }
    } catch (error) {
      console.error('[StockAPI] Error cancelling order:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to cancel order',
      });
    }
  });

  /**
   * POST /api/v1/stocks/takeover
   * 发起收购要约
   */
  app.post('/api/v1/stocks/takeover', async (request: FastifyRequest<{
    Body: {
      acquirerId: string;
      targetId: string;
      offerPrice: number;
      rationale?: string;
    };
  }>, reply: FastifyReply) => {
    try {
      const { acquirerId, targetId, offerPrice, rationale } = request.body;
      
      if (!acquirerId || !targetId || !offerPrice) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required parameters',
        });
      }
      
      // TODO: 获取当前tick
      const currentTick = 0;
      
      const result = stockMarketService.initiateTakeover(
        acquirerId,
        targetId,
        offerPrice,
        rationale || '战略收购',
        currentTick
      );
      
      if (result.success) {
        return reply.send({
          success: true,
          data: result.bid,
        });
      } else {
        return reply.code(400).send({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error('[StockAPI] Error initiating takeover:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to initiate takeover',
      });
    }
  });
}