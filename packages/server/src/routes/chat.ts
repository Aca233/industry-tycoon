/**
 * Chat API Routes - LLM-powered chat endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { llmService } from '../services/llm.js';

// LLM 连接状态存储
interface LLMConnectionStatus {
  connected: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  testedAt?: string;
  error?: string;
  responseTime?: number;
}

let connectionStatus: LLMConnectionStatus = {
  connected: false,
  provider: process.env.LLM_PROVIDER ?? 'openai',
  baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
};

const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  role: z.enum(['assistant', 'competitor', 'market_analyst']).optional(),
  targetCompanyId: z.string().optional(),
});

const negotiationMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  sellerId: z.string(),
  goodsType: z.string(),
  proposedTerms: z.object({
    quantity: z.number().positive(),
    pricePerUnit: z.number().positive(),
    duration: z.number().optional(),
  }),
});

const researchRequestSchema = z.object({
  prompt: z.string().min(10).max(1000),
  budget: z.number().positive(),
});

export async function chatRoutes(app: FastifyInstance) {
  // LLM 连接测试端点
  app.get('/api/v1/llm/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(connectionStatus);
  });

  // LLM 连接测试
  app.post('/api/v1/llm/test', async (_request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    
    try {
      // 发送一个简单的测试请求
      const response = await llmService.chat('Say "LLM connection successful" in exactly those words.', {
        gameId: 'test',
        companyId: 'test',
        role: 'assistant',
      });
      
      const responseTime = Date.now() - startTime;
      
      // 判断是否是 LLM 真实响应（而非 fallback）
      const isRealLLM = response.toLowerCase().includes('llm connection successful') ||
                        response.toLowerCase().includes('connection successful') ||
                        !response.includes('Let me analyze'); // fallback 响应特征
      
      connectionStatus = {
        connected: isRealLLM,
        provider: process.env.LLM_PROVIDER ?? 'openai',
        baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        testedAt: new Date().toISOString(),
        responseTime,
      };
      if (!isRealLLM) {
        connectionStatus.error = 'Received fallback response - LLM connection may have failed';
      }
      
      return reply.send({
        success: isRealLLM,
        status: connectionStatus,
        response,
        message: isRealLLM
          ? '✅ LLM 连接成功！响应来自真实的 LLM API。'
          : '⚠️ 使用 fallback 响应。LLM API 连接可能失败，请检查配置。',
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      connectionStatus = {
        connected: false,
        provider: process.env.LLM_PROVIDER ?? 'openai',
        baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        testedAt: new Date().toISOString(),
        responseTime,
        error: errorMessage,
      };
      
      return reply.send({
        success: false,
        status: connectionStatus,
        message: `❌ LLM 连接失败: ${errorMessage}`,
      });
    }
  });

  // Chat with AI assistant
  app.post('/api/v1/games/:gameId/chat', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    const body = chatMessageSchema.parse(request.body);
    
    const response = await llmService.chat(body.message, {
      gameId,
      companyId: 'player-company', // TODO: Get from session
      role: body.role ?? 'assistant',
    });
    
    return reply.send({
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });
  });

  // Get market analysis
  app.post('/api/v1/games/:gameId/chat/analyze-market', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId: _gameId } = request.params as { gameId: string };
    
    // TODO: Fetch actual market data from game state
    const mockMarketData = {
      currentPrices: { steel: 500, chips: 2000, power: 50 },
      recentEvents: [
        { type: 'trend', description: 'Wellness movement growing' },
      ],
      playerActions: ['Upgraded factory', 'Signed steel contract'],
    };
    
    const analysis = await llmService.analyzeMarket(mockMarketData);
    
    return reply.send(analysis);
  });

  // Negotiate with AI competitor
  app.post('/api/v1/games/:gameId/chat/negotiate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId: _gameId } = request.params as { gameId: string };
    const body = negotiationMessageSchema.parse(request.body);
    
    // TODO: Fetch competitor personality and history from database
    const negotiationContext = {
      buyerId: 'player-company',
      sellerId: body.sellerId,
      goodsType: body.goodsType,
      proposedTerms: body.proposedTerms,
      sellerPersonality: 'old_money', // TODO: Fetch from competitor profile
      relationshipHistory: [], // TODO: Fetch from database
    };
    
    // TODO: Fetch chat history for this negotiation session
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    const result = await llmService.negotiate(body.message, negotiationContext, history);
    
    return reply.send({
      ...result,
      timestamp: Date.now(),
    });
  });

  // Evaluate research proposal
  app.post('/api/v1/games/:gameId/research/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId: _gameId } = request.params as { gameId: string };
    const body = researchRequestSchema.parse(request.body);
    
    // TODO: Fetch current tech and company profile from database
    const evaluation = await llmService.evaluateTechnology({
      prompt: body.prompt,
      currentTech: ['Basic Manufacturing', 'Flow Line Production'],
      budget: body.budget,
      companyProfile: 'Mid-sized manufacturer focusing on consumer goods',
    });
    
    return reply.send(evaluation);
  });

  // Trigger market event (for testing/admin)
  app.post('/api/v1/games/:gameId/events/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId: _gameId } = request.params as { gameId: string };
    
    // TODO: Fetch actual game state from database
    const events = await llmService.generateMarketEventsBatch({
      currentTick: 100,
      marketConditions: 'stable',
      playerDominance: { steel: 0.3, chips: 0.1 },
      eventCount: 1,
    });
    
    if (!events || events.length === 0) {
      return reply.send({ generated: false, message: 'No event generated this time' });
    }
    
    // TODO: Apply event to game state and save to database
    
    return reply.send({
      generated: true,
      event: events[0],
      totalEvents: events.length,
    });
  });
}