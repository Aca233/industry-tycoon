/**
 * Settings routes - LLM API configuration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { llmService, type LLMConfig } from '../services/llm.js';

const llmConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
});

export async function settingsRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/settings/llm - 获取当前LLM配置
   */
  app.get('/api/v1/settings/llm', async (_request: FastifyRequest, reply: FastifyReply) => {
    const config = llmService.getConfig();
    // 返回配置，但隐藏完整的API Key
    return reply.send({
      apiKey: config.apiKeyMasked, // 只返回掩码后的key
      baseUrl: config.baseUrl,
      model: config.model,
    });
  });

  /**
   * POST /api/v1/settings/llm - 更新LLM配置
   */
  app.post('/api/v1/settings/llm', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = llmConfigSchema.parse(request.body);
      
      // 更新配置
      llmService.updateConfig(body as Partial<LLMConfig>);
      
      // 返回更新后的配置
      const newConfig = llmService.getConfig();
      return reply.send({
        success: true,
        config: {
          apiKey: newConfig.apiKeyMasked,
          baseUrl: newConfig.baseUrl,
          model: newConfig.model,
        },
      });
    } catch (error) {
      console.error('[Settings] Failed to update LLM config:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid configuration', details: error.errors });
      }
      return reply.code(500).send({ error: 'Failed to update configuration' });
    }
  });

  /**
   * POST /api/v1/settings/llm/test - 测试LLM连接（使用当前保存的配置）
   */
  app.post('/api/v1/settings/llm/test', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await llmService.testConnection();
      return reply.send(result);
    } catch (error) {
      console.error('[Settings] LLM test error:', error);
      return reply.send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/settings/llm/test-temp - 测试临时配置（不保存）
   */
  app.post('/api/v1/settings/llm/test-temp', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = llmConfigSchema.parse(request.body);
      const result = await llmService.testConnectionWithConfig(body as Partial<LLMConfig>);
      return reply.send(result);
    } catch (error) {
      console.error('[Settings] LLM temp test error:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, message: 'Invalid configuration' });
      }
      return reply.send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/settings/llm/models-temp - 使用临时配置获取模型列表
   */
  app.post('/api/v1/settings/llm/models-temp', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = llmConfigSchema.parse(request.body);
      const result = await llmService.getAvailableModelsWithConfig(body as Partial<LLMConfig>);
      return reply.send(result);
    } catch (error) {
      console.error('[Settings] Get temp models error:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, models: [], message: 'Invalid configuration' });
      }
      return reply.send({
        success: false,
        models: [],
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/settings/llm/models - 获取可用模型列表
   */
  app.get('/api/v1/settings/llm/models', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await llmService.getAvailableModels();
      return reply.send(result);
    } catch (error) {
      console.error('[Settings] Get models error:', error);
      return reply.send({
        success: false,
        models: [],
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}