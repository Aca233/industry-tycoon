/**
 * LLM Service - OpenAI integration for game AI
 * 支持 OpenAI 官方 API 和第三方兼容 API（如中转站）
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** LLM配置接口 */
export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

// 配置文件路径 - 存储在服务器数据目录
const CONFIG_FILE_PATH = path.join(__dirname, '../../data/llm-config.json');

/** 从环境变量加载默认配置 */
function getDefaultConfig(): LLMConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  };
}

/** 加载配置（优先从文件，否则从环境变量） */
function loadConfig(): LLMConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const savedConfig = JSON.parse(content) as LLMConfig;
      console.log('[LLM] Loaded config from file');
      return savedConfig;
    }
  } catch (error) {
    console.warn('[LLM] Failed to load config file, using defaults:', error);
  }
  return getDefaultConfig();
}

/** 保存配置到文件 */
function saveConfig(config: LLMConfig): void {
  try {
    // 确保目录存在
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
    console.log('[LLM] Config saved to file');
  } catch (error) {
    console.error('[LLM] Failed to save config:', error);
    throw error;
  }
}

// 当前运行时配置
let currentConfig = loadConfig();

/** LLM是否启用（API Key有效时启用）*/
let llmEnabled = !!(currentConfig.apiKey && currentConfig.apiKey.length > 10);

/** API调用连续失败次数 */
let consecutiveFailures = 0;

/** 失败次数阈值：超过此值自动禁用LLM */
const FAILURE_THRESHOLD = 3;

/** 自动禁用冷却时间（毫秒）- 10分钟 */
const AUTO_DISABLE_COOLDOWN = 10 * 60 * 1000;

/** 上次自动禁用的时间 */
let lastAutoDisableTime = 0;

// 创建 OpenAI 客户端
let openai = new OpenAI({
  apiKey: currentConfig.apiKey || 'sk-placeholder',
  baseURL: currentConfig.baseUrl,
});

console.log(`[LLM] Initializing with base URL: ${currentConfig.baseUrl}`);
console.log(`[LLM] Using model: ${currentConfig.model}`);
console.log(`[LLM] LLM enabled: ${llmEnabled} (API Key ${currentConfig.apiKey ? 'provided' : 'missing'})`);

export interface ChatContext {
  gameId: string;
  companyId: string;
  role: 'assistant' | 'competitor' | 'market_analyst';
  personality?: string;
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

export interface MarketAnalysisRequest {
  currentPrices: Record<string, number>;
  recentEvents: Array<{ type: string; description: string }>;
  playerActions: string[];
}

export interface TechnologyEvaluationRequest {
  prompt: string;
  currentTech: string[];
  budget: number;
  companyProfile: string;
}

export interface NegotiationContext {
  buyerId: string;
  sellerId: string;
  goodsType: string;
  proposedTerms: {
    quantity: number;
    pricePerUnit: number;
    duration?: number | undefined;
  };
  sellerPersonality: string;
  relationshipHistory: string[];
}

/** AI公司战略计划 */
export interface StrategicPlan {
  /** 优先发展的行业 */
  priorityIndustry: string;
  /** 次要关注的行业 */
  secondaryIndustry: string;
  /** 市场立场: aggressive=积极扩张, defensive=防守, neutral=中立 */
  marketStance: 'aggressive' | 'defensive' | 'neutral';
  /** 是否针对玩家 */
  targetPlayer: boolean;
  /** 投资重点: expand_capacity=扩张产能, reduce_cost=降低成本, diversify=多元化 */
  investmentFocus: 'expand_capacity' | 'reduce_cost' | 'diversify';
  /** 风险承受度 0-1 */
  riskLevel: number;
  /** LLM给出的战略理由 */
  reasoning: string;
  /** 生成该战略的tick */
  generatedAt: number;
}

/** 战略生成请求上下文 */
export interface StrategicAnalysisRequest {
  companyId: string;
  companyName: string;
  personality: string;
  currentCash: number;
  buildingCount: number;
  ownedIndustries: string[];
  marketPrices: Record<string, number>;
  priceChanges: Record<string, number>; // 最近的价格变化百分比
  playerIndustries: string[];
  playerBuildingCount: number;
  relationshipWithPlayer: {
    trust: number;
    hostility: number;
  };
}

/**
 * LLM Service class for all AI-related operations
 */
export class LLMService {
  /**
   * 检查LLM是否启用
   */
  isEnabled(): boolean {
    return llmEnabled;
  }
  
  /**
   * 手动禁用LLM（用于性能优化或API Key无效时）
   */
  disable(): void {
    llmEnabled = false;
    consecutiveFailures = 0;
    console.log('[LLM] LLM service disabled manually');
  }
  
  /**
   * 手动启用LLM
   */
  enable(): void {
    if (currentConfig.apiKey && currentConfig.apiKey.length > 10) {
      llmEnabled = true;
      consecutiveFailures = 0;
      lastAutoDisableTime = 0;
      console.log('[LLM] LLM service enabled');
    } else {
      console.log('[LLM] Cannot enable LLM: API Key not configured');
    }
  }
  
  /**
   * 获取失败统计信息
   */
  getFailureStats(): { consecutiveFailures: number; isAutoDisabled: boolean; cooldownRemaining: number } {
    const now = Date.now();
    const cooldownRemaining = lastAutoDisableTime > 0
      ? Math.max(0, AUTO_DISABLE_COOLDOWN - (now - lastAutoDisableTime))
      : 0;
    return {
      consecutiveFailures,
      isAutoDisabled: lastAutoDisableTime > 0 && cooldownRemaining > 0,
      cooldownRemaining,
    };
  }
  
  /**
   * 记录API调用成功
   */
  private recordSuccess(): void {
    consecutiveFailures = 0;
  }
  
  /**
   * 记录API调用失败，如果连续失败超过阈值则自动禁用
   */
  private recordFailure(error: Error): void {
    consecutiveFailures++;
    
    // 检查是否是认证错误（401）
    const isAuthError = error.message.includes('401') ||
                        error.message.includes('authentication') ||
                        error.message.includes('API 密钥');
    
    if (isAuthError || consecutiveFailures >= FAILURE_THRESHOLD) {
      llmEnabled = false;
      lastAutoDisableTime = Date.now();
      console.log(`[LLM] Auto-disabled after ${consecutiveFailures} consecutive failures. Will retry after ${AUTO_DISABLE_COOLDOWN / 60000} minutes.`);
      console.log(`[LLM] Last error: ${error.message}`);
    }
  }
  
  /**
   * 检查是否应该尝试API调用（考虑自动禁用冷却期）
   */
  private shouldAttemptApiCall(): boolean {
    if (!llmEnabled) {
      // 检查冷却期是否已过
      if (lastAutoDisableTime > 0) {
        const now = Date.now();
        if (now - lastAutoDisableTime >= AUTO_DISABLE_COOLDOWN) {
          // 冷却期已过，重新启用并尝试
          llmEnabled = true;
          consecutiveFailures = 0;
          console.log('[LLM] Cooldown period ended, re-enabling LLM service');
          return true;
        }
      }
      return false;
    }
    return true;
  }

  /**
   * 获取当前配置（隐藏API Key的大部分内容）
   */
  getConfig(): LLMConfig & { apiKeyMasked: string; enabled: boolean } {
    return {
      apiKey: currentConfig.apiKey,
      baseUrl: currentConfig.baseUrl,
      model: currentConfig.model,
      apiKeyMasked: this.maskApiKey(currentConfig.apiKey),
      enabled: llmEnabled,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<LLMConfig & { enabled?: boolean }>): void {
    // 合并配置
    if (newConfig.apiKey !== undefined) {
      currentConfig.apiKey = newConfig.apiKey;
    }
    if (newConfig.baseUrl !== undefined) {
      currentConfig.baseUrl = newConfig.baseUrl;
    }
    if (newConfig.model !== undefined) {
      currentConfig.model = newConfig.model;
    }
    
    // 更新启用状态
    if (newConfig.enabled !== undefined) {
      llmEnabled = newConfig.enabled;
    } else {
      // 根据API Key自动更新启用状态
      llmEnabled = !!(currentConfig.apiKey && currentConfig.apiKey.length > 10);
    }

    // 重新创建 OpenAI 客户端
    openai = new OpenAI({
      apiKey: currentConfig.apiKey || 'sk-placeholder',
      baseURL: currentConfig.baseUrl,
    });

    // 保存到文件
    saveConfig(currentConfig);

    console.log(`[LLM] Config updated - baseUrl: ${currentConfig.baseUrl}, model: ${currentConfig.model}, enabled: ${llmEnabled}`);
  }

  /**
   * 测试当前配置是否有效（带超时）
   */
  async testConnection(): Promise<{ success: boolean; message: string; model?: string }> {
    const timeoutMs = 15000; // 15秒超时
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await openai.chat.completions.create({
        model: currentConfig.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const content = response.choices[0]?.message?.content ?? '';
      return {
        success: true,
        message: `连接成功！模型响应: "${content.substring(0, 50)}"`,
        model: response.model,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          message: `连接超时（${timeoutMs / 1000}秒）`,
        };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `连接失败: ${errorMessage}`,
      };
    }
  }

  /**
   * 使用临时配置测试连接（不保存配置）
   */
  async testConnectionWithConfig(tempConfig: Partial<LLMConfig>): Promise<{ success: boolean; message: string; model?: string }> {
    const timeoutMs = 15000;
    
    // 合并临时配置
    const testApiKey = tempConfig.apiKey || currentConfig.apiKey;
    const testBaseUrl = tempConfig.baseUrl || currentConfig.baseUrl;
    const testModel = tempConfig.model || currentConfig.model;
    
    if (!testApiKey) {
      return { success: false, message: '请提供 API Key' };
    }
    
    // 创建临时客户端
    const tempClient = new OpenAI({
      apiKey: testApiKey,
      baseURL: testBaseUrl,
    });
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await tempClient.chat.completions.create({
        model: testModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const content = response.choices[0]?.message?.content ?? '';
      return {
        success: true,
        message: `连接成功！模型响应: "${content.substring(0, 50)}"`,
        model: response.model,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          message: `连接超时（${timeoutMs / 1000}秒）`,
        };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `连接失败: ${errorMessage}`,
      };
    }
  }

  /**
   * 获取可用的模型列表
   */
  async getAvailableModels(): Promise<{ success: boolean; models: string[]; message?: string }> {
    const timeoutMs = 10000; // 10秒超时
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await openai.models.list({
        signal: controller.signal,
      } as any);
      
      clearTimeout(timeoutId);
      
      // 提取模型ID列表
      const models: string[] = [];
      for await (const model of response) {
        models.push(model.id);
      }
      
      // 排序：常用模型优先
      const priorityModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'claude', 'gemini'];
      models.sort((a, b) => {
        const aPriority = priorityModels.findIndex(p => a.toLowerCase().includes(p));
        const bPriority = priorityModels.findIndex(p => b.toLowerCase().includes(p));
        if (aPriority >= 0 && bPriority >= 0) return aPriority - bPriority;
        if (aPriority >= 0) return -1;
        if (bPriority >= 0) return 1;
        return a.localeCompare(b);
      });
      
      return {
        success: true,
        models,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          models: [],
          message: `获取模型列表超时`,
        };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        models: [],
        message: `获取模型列表失败: ${errorMessage}`,
      };
    }
  }

  /**
   * 使用临时配置获取模型列表（不保存配置）
   */
  async getAvailableModelsWithConfig(tempConfig: Partial<LLMConfig>): Promise<{ success: boolean; models: string[]; message?: string }> {
    const timeoutMs = 10000;
    
    // 合并临时配置
    const testApiKey = tempConfig.apiKey || currentConfig.apiKey;
    const testBaseUrl = tempConfig.baseUrl || currentConfig.baseUrl;
    
    if (!testApiKey) {
      return { success: false, models: [], message: '请提供 API Key' };
    }
    
    // 创建临时客户端
    const tempClient = new OpenAI({
      apiKey: testApiKey,
      baseURL: testBaseUrl,
    });
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await tempClient.models.list({
        signal: controller.signal,
      } as any);
      
      clearTimeout(timeoutId);
      
      // 提取模型ID列表
      const models: string[] = [];
      for await (const model of response) {
        models.push(model.id);
      }
      
      // 排序：常用模型优先
      const priorityModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'claude', 'gemini'];
      models.sort((a, b) => {
        const aPriority = priorityModels.findIndex(p => a.toLowerCase().includes(p));
        const bPriority = priorityModels.findIndex(p => b.toLowerCase().includes(p));
        if (aPriority >= 0 && bPriority >= 0) return aPriority - bPriority;
        if (aPriority >= 0) return -1;
        if (bPriority >= 0) return 1;
        return a.localeCompare(b);
      });
      
      return {
        success: true,
        models,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          models: [],
          message: `获取模型列表超时`,
        };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        models: [],
        message: `获取模型列表失败: ${errorMessage}`,
      };
    }
  }

  /**
   * 掩码API Key
   */
  private maskApiKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }

  private get defaultModel() {
    return currentConfig.model;
  }

  /**
   * Chat with AI assistant
   */
  async chat(message: string, context: ChatContext): Promise<string> {
    const systemPrompt = this.buildAssistantPrompt(context);
    
    try {
      const response = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(context.history ?? []),
          { role: 'user', content: message },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content ?? '抱歉，我无法生成回复。';
    } catch (error) {
      console.error('LLM chat error:', error);
      return this.generateFallbackResponse(message, context);
    }
  }

  /**
   * Generate market analysis report
   */
  async analyzeMarket(request: MarketAnalysisRequest): Promise<{
    summary: string;
    trends: Array<{ goodsId: string; trend: string; confidence: number }>;
    recommendations: string[];
  }> {
    const prompt = `作为供应链模拟游戏中的市场分析师，请分析以下市场数据：

当前价格: ${JSON.stringify(request.currentPrices)}
近期事件: ${request.recentEvents.map(e => `- ${e.type}: ${e.description}`).join('\n')}
玩家近期操作: ${request.playerActions.join(', ')}

请提供简要的市场分析：
1. 用2-3句话总结当前市场状况
2. 预测每种商品的趋势（上涨/下跌/稳定，置信度0-1）
3. 给玩家2-3条可操作的建议

请用中文回复，使用JSON格式:
{
  "summary": "...",
  "trends": [{"goodsId": "...", "trend": "rising|falling|stable", "confidence": 0.8}],
  "recommendations": ["...", "..."]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      return JSON.parse(content);
    } catch (error) {
      console.error('Market analysis error:', error);
      return {
        summary: '当前市场状况稳定，活跃度适中。',
        trends: [],
        recommendations: ['密切关注市场动态', '考虑多元化供应来源'],
      };
    }
  }

  /**
   * Evaluate technology research proposal
   */
  async evaluateTechnology(request: TechnologyEvaluationRequest): Promise<{
    feasibility: number;
    estimatedCost: number;
    estimatedTicks: number;
    risks: string[];
    potentialEffects: string[];
    sideEffects: string[];
  }> {
    const prompt = `作为未来供应链游戏中的首席科学家，请评估这个研发提案：

研发请求: "${request.prompt}"
现有技术: ${request.currentTech.join(', ')}
可用预算: ¥${request.budget}
公司概况: ${request.companyProfile}

请从以下角度评估：
1. 可行性（0-1）
2. 预估成本（元）
3. 研发周期（游戏刻度，1刻度=1天）
4. 潜在风险
5. 对生产/市场的预期影响
6. 可能在后期出现的隐藏副作用（发挥创意，保持现实）

请用中文回复，使用JSON格式:
{
  "feasibility": 0.7,
  "estimatedCost": 50000000,
  "estimatedTicks": 30,
  "risks": ["..."],
  "potentialEffects": ["..."],
  "sideEffects": ["..."]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      return JSON.parse(content);
    } catch (error) {
      console.error('Technology evaluation error:', error);
      return {
        feasibility: 0.5,
        estimatedCost: request.budget * 0.8,
        estimatedTicks: 30,
        risks: ['市场接受度不确定', '技术挑战'],
        potentialEffects: ['解锁新的生产方式'],
        sideEffects: ['长期影响未知'],
      };
    }
  }

  /**
   * Simulate AI competitor negotiation
   */
  async negotiate(
    playerMessage: string,
    context: NegotiationContext,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{
    response: string;
    decision: 'accept' | 'reject' | 'counter' | 'continue';
    counterOffer?: {
      quantity?: number;
      pricePerUnit?: number;
      duration?: number;
    };
    emotionalState: 'friendly' | 'neutral' | 'hostile' | 'suspicious';
  }> {
    const personalityPrompts: Record<string, string> = {
      monopolist: '你是一个激进、贪婪的商业巨头，追求市场垄断。你喜欢挤压竞争对手，很少给出公平交易。你尊重强者，鄙视弱者。',
      trend_surfer: '你是一个时髦、冲动的CEO，喜欢追逐市场热点。你容易被新机会吸引，可能很快改变主意。你重视创新形象。',
      old_money: '你是一个保守、老派的实业家，最看重传统和声誉。你偏好长期合作关系，厌恶草率决定或低质量交易。',
      innovator: '你是一个有远见的科技CEO，总是展望未来。你重视创新，愿意为潜在突破承担风险。你可能提出不寻常的条款。',
      cost_leader: '你是一个痴迷效率的运营高管。每一分钱对你都很重要。你会狠狠砍价，但只要数字合理就会公平交易。',
    };

    const systemPrompt = `你是供应链商业模拟游戏中的AI竞争对手CEO。请用中文回复。
${personalityPrompts[context.sellerPersonality] ?? personalityPrompts.old_money}

当前谈判背景:
- 你是卖方，销售: ${context.goodsType}
- 买方提议: ${context.proposedTerms.quantity} 单位，单价 ¥${context.proposedTerms.pricePerUnit}
${context.proposedTerms.duration ? `- 合同期限: ${context.proposedTerms.duration} 刻度` : ''}
- 你们的合作历史: ${context.relationshipHistory.length > 0 ? context.relationshipHistory.join('; ') : '无历史交易'}

回应买方的消息。你必须:
1. 保持角色性格
2. 考虑合作历史
3. 做出有利于公司的决策
4. 像真实商业谈判一样自然回应

在回复后，提供JSON元数据:
---METADATA---
{
  "decision": "accept|reject|counter|continue",
  "counterOffer": {"quantity": null, "pricePerUnit": null, "duration": null},
  "emotionalState": "friendly|neutral|hostile|suspicious"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: playerMessage },
        ],
        max_tokens: 1500,
        temperature: 0.8,
      });

      const fullResponse = response.choices[0]?.message?.content ?? '';
      
      // Parse response and metadata
      const metadataMatch = fullResponse.match(/---METADATA---\s*(\{[\s\S]*\})/);
      let decision: 'accept' | 'reject' | 'counter' | 'continue' = 'continue';
      let counterOffer: { quantity?: number; pricePerUnit?: number; duration?: number } | undefined;
      let emotionalState: 'friendly' | 'neutral' | 'hostile' | 'suspicious' = 'neutral';
      
      if (metadataMatch && metadataMatch[1]) {
        try {
          const parsed = JSON.parse(metadataMatch[1]) as {
            decision?: string;
            counterOffer?: { quantity?: number; pricePerUnit?: number; duration?: number };
            emotionalState?: string;
          };
          if (parsed.decision === 'accept' || parsed.decision === 'reject' ||
              parsed.decision === 'counter' || parsed.decision === 'continue') {
            decision = parsed.decision;
          }
          if (parsed.counterOffer) {
            counterOffer = parsed.counterOffer;
          }
          if (parsed.emotionalState === 'friendly' || parsed.emotionalState === 'neutral' ||
              parsed.emotionalState === 'hostile' || parsed.emotionalState === 'suspicious') {
            emotionalState = parsed.emotionalState;
          }
        } catch {
          // Use default metadata
        }
      }

      const textResponse = fullResponse.replace(/---METADATA---[\s\S]*$/, '').trim();

      const result: {
        response: string;
        decision: 'accept' | 'reject' | 'counter' | 'continue';
        counterOffer?: { quantity?: number; pricePerUnit?: number; duration?: number };
        emotionalState: 'friendly' | 'neutral' | 'hostile' | 'suspicious';
      } = {
        response: textResponse || '让我考虑一下这个提案...',
        decision,
        emotionalState,
      };
      
      if (counterOffer) {
        result.counterOffer = counterOffer;
      }
      
      return result;
    } catch (error) {
      console.error('Negotiation error:', error);
      return {
        response: '我需要一些时间考虑这个提案。我们稍后继续讨论吧。',
        decision: 'continue',
        emotionalState: 'neutral',
      };
    }
  }

  /**
   * Generate strategic plan for AI company (大决策)
   * 这个方法只在每100 tick调用一次，用于制定战略方向
   *
   * 性能优化：如果LLM未启用，直接返回基于性格的默认战略，避免无效API调用
   */
  async generateStrategicPlan(request: StrategicAnalysisRequest): Promise<StrategicPlan> {
    // 性能优化：检查是否应该尝试API调用
    if (!this.shouldAttemptApiCall()) {
      // 不打印日志，避免日志洪泛
      return this.getDefaultStrategicPlan(request);
    }
    
    // 极简prompt，确保LLM能完整返回JSON
    const industries = request.ownedIndustries.slice(0, 2).join(',') || 'none';
    const playerInd = request.playerIndustries.slice(0, 2).join(',') || 'none';
    const cashM = Math.floor(request.currentCash / 1000000);
    
    // 使用非常简短的prompt
    const prompt = `You are AI strategist for "${request.companyName}".
Company: ${cashM}M cash, ${request.buildingCount} buildings, industries: ${industries}
Competitor: ${request.playerBuildingCount} buildings, industries: ${playerInd}
Personality hint: ${request.personality.substring(0, 30)}

Return ONLY a single line JSON (no markdown, no explanation):
{"priorityIndustry":"steel","secondaryIndustry":"energy","marketStance":"neutral","targetPlayer":false,"investmentFocus":"expand_capacity","riskLevel":0.5,"reasoning":"short reason"}

Choose priorityIndustry from: steel, energy, semiconductor, chemicals, food, retail
Choose marketStance from: aggressive, defensive, neutral
Choose investmentFocus from: expand_capacity, reduce_cost, diversify`;

    try {
      console.log(`[LLM] Generating strategic plan for ${request.companyName}...`);
      
      const response = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: 'You are a JSON generator. Return only valid JSON, no markdown, no explanation.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      console.log(`[LLM] Raw response for ${request.companyName}:`, content.substring(0, 200));
      
      // 尝试提取JSON（有时候LLM会返回带有额外文本的JSON）
      const jsonContent = this.extractJSON(content);
      const parsed = JSON.parse(jsonContent) as Partial<StrategicPlan>;
      
      const plan = {
        priorityIndustry: parsed.priorityIndustry ?? 'steel',
        secondaryIndustry: parsed.secondaryIndustry ?? 'energy',
        marketStance: this.validateMarketStance(parsed.marketStance),
        targetPlayer: parsed.targetPlayer ?? false,
        investmentFocus: this.validateInvestmentFocus(parsed.investmentFocus),
        riskLevel: Math.max(0, Math.min(1, parsed.riskLevel ?? 0.5)),
        reasoning: parsed.reasoning ?? '维持稳定发展',
        generatedAt: Date.now(),
      };
      
      console.log(`[LLM] Strategic plan generated for ${request.companyName}:`, {
        priorityIndustry: plan.priorityIndustry,
        marketStance: plan.marketStance,
        reasoning: plan.reasoning.substring(0, 50),
      });
      
      // 记录成功
      this.recordSuccess();
      
      return plan;
    } catch (error) {
      // 记录失败（可能触发自动禁用）
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      
      console.error('[LLM] Strategic plan generation error:', error);
      console.log(`[LLM] Falling back to personality-based plan for ${request.companyName}`);
      // 返回基于性格的默认战略
      return this.getDefaultStrategicPlan(request);
    }
  }

  /**
   * 尝试从可能包含额外文本或截断的内容中提取和修复JSON
   */
  private extractJSON(content: string): string {
    let trimmed = content.trim();
    
    // 移除可能的markdown标记
    if (trimmed.startsWith('```json')) {
      trimmed = trimmed.slice(7);
    }
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.slice(3);
    }
    if (trimmed.endsWith('```')) {
      trimmed = trimmed.slice(0, -3);
    }
    trimmed = trimmed.trim();
    
    // 如果内容不以{开头，尝试找到JSON对象
    if (!trimmed.startsWith('{')) {
      const jsonMatch = content.match(/\{[\s\S]*\}?/);
      if (jsonMatch) {
        trimmed = jsonMatch[0];
      } else {
        return '{}';
      }
    }
    
    // 尝试直接解析，如果成功就返回
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // 继续尝试修复
    }
    
    // 尝试修复截断的JSON
    // 1. 如果字符串在值中间被截断，尝试补全引号
    let fixed = trimmed;
    
    // 统计未闭合的括号
    let braceCount = 0;
    let inString = false;
    let lastChar = '';
    
    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i] ?? '';
      if (char === '"' && lastChar !== '\\') {
        inString = !inString;
      }
      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      lastChar = char;
    }
    
    // 如果在字符串中截断，添加闭合引号
    if (inString) {
      fixed += '"';
    }
    
    // 添加缺少的闭合括号
    while (braceCount > 0) {
      fixed += '}';
      braceCount--;
    }
    
    // 再次尝试解析
    try {
      JSON.parse(fixed);
      return fixed;
    } catch {
      // 尝试更激进的修复：截断到最后一个完整的键值对
      const lastValidPos = this.findLastValidJsonPosition(trimmed);
      if (lastValidPos > 0) {
        const truncated = trimmed.slice(0, lastValidPos) + '}';
        try {
          JSON.parse(truncated);
          return truncated;
        } catch {
          // 放弃，返回空对象
        }
      }
    }
    
    return '{}';
  }
  
  /**
   * 找到最后一个可能有效的JSON结束位置
   */
  private findLastValidJsonPosition(content: string): number {
    // 找到最后一个完整的键值对结束位置
    // 模式: "key":value, 或 "key":value}
    const patterns = [
      /,\s*"[^"]+"\s*:\s*(?:"[^"]*"|[\d.]+|true|false|null|\{[^{}]*\}|\[[^\[\]]*\])\s*$/,
      /\{\s*"[^"]+"\s*:\s*(?:"[^"]*"|[\d.]+|true|false|null|\{[^{}]*\}|\[[^\[\]]*\])\s*$/,
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match.index !== undefined) {
        return match.index + match[0].length;
      }
    }
    
    // 尝试找到最后一个完整的值
    const lastCompleteValue = content.lastIndexOf('",');
    if (lastCompleteValue > 0) {
      return lastCompleteValue + 2;
    }
    
    const lastCompleteNumber = content.match(/.*?(\d+\.?\d*),/);
    if (lastCompleteNumber) {
      return lastCompleteNumber[0].length;
    }
    
    return -1;
  }

  /**
   * 验证市场立场
   */
  private validateMarketStance(stance: string | undefined): 'aggressive' | 'defensive' | 'neutral' {
    if (stance === 'aggressive' || stance === 'defensive' || stance === 'neutral') {
      return stance;
    }
    return 'neutral';
  }

  /**
   * 验证投资重点
   */
  private validateInvestmentFocus(focus: string | undefined): 'expand_capacity' | 'reduce_cost' | 'diversify' {
    if (focus === 'expand_capacity' || focus === 'reduce_cost' || focus === 'diversify') {
      return focus;
    }
    return 'expand_capacity';
  }

  /**
   * 根据公司性格生成默认战略（LLM失败时的回退）
   */
  private getDefaultStrategicPlan(request: StrategicAnalysisRequest): StrategicPlan {
    const personality = request.personality.toLowerCase();
    
    if (personality.includes('垄断') || personality.includes('激进')) {
      return {
        priorityIndustry: 'steel',
        secondaryIndustry: 'energy',
        marketStance: 'aggressive',
        targetPlayer: true,
        investmentFocus: 'expand_capacity',
        riskLevel: 0.8,
        reasoning: '基于公司激进性格，采取扩张战略',
        generatedAt: Date.now(),
      };
    } else if (personality.includes('保守') || personality.includes('老派')) {
      return {
        priorityIndustry: 'energy',
        secondaryIndustry: 'chemicals',
        marketStance: 'defensive',
        targetPlayer: false,
        investmentFocus: 'reduce_cost',
        riskLevel: 0.3,
        reasoning: '基于公司保守性格，采取稳健战略',
        generatedAt: Date.now(),
      };
    } else {
      return {
        priorityIndustry: 'semiconductor',
        secondaryIndustry: 'electronics',
        marketStance: 'neutral',
        targetPlayer: false,
        investmentFocus: 'diversify',
        riskLevel: 0.5,
        reasoning: '采取平衡发展战略',
        generatedAt: Date.now(),
      };
    }
  }

  /**
   * 批量生成市场事件（一次调用生成3个事件）
   * 用于减少API调用次数并使事件更自然分布
   */
  async generateMarketEventsBatch(gameState: {
    currentTick: number;
    marketConditions: string;
    playerDominance: Record<string, number>;
    eventCount: number;
  }): Promise<Array<{
    type: string;
    severity: 'minor' | 'moderate' | 'major' | 'critical';
    title: string;
    description: string;
    effects: {
      priceChanges?: Record<string, number>;
      supplyChanges?: Record<string, number>;
    };
  }>> {
    const goods = ['steel', 'coal', 'copper', 'electricity', 'chips', 'oil', 'food', 'natural_gas'];
    
    const prompt = `Generate ${gameState.eventCount} different market events for a supply chain simulation game.
Current tick: ${gameState.currentTick}
Market conditions: ${gameState.marketConditions}

Return ONLY a valid JSON array with ${gameState.eventCount} events (no markdown, no explanation):
[
  {"type":"regulation","severity":"moderate","title":"简短中文标题1","description":"简短中文描述1","effects":{"priceChanges":{"steel":0.15}}},
  {"type":"disaster","severity":"major","title":"简短中文标题2","description":"简短中文描述2","effects":{"priceChanges":{"coal":-0.2}}},
  {"type":"social","severity":"minor","title":"简短中文标题3","description":"简短中文描述3","effects":{"priceChanges":{"food":0.1}}}
]

Rules:
- Types: market_shift, regulation, disaster, technology, social
- Severity: minor, moderate, major, critical
- PriceChanges values: -0.3 to 0.3 (percent change, not absolute)
- Goods: ${goods.join(', ')}
- Each event should affect different goods
- Make events realistic and interesting for gameplay`;

    try {
      console.log(`[LLM] Generating ${gameState.eventCount} market events batch...`);
      
      const response = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: 'You are a JSON generator. Return only valid JSON arrays, no markdown, no explanation.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.8,
      });

      const content = response.choices[0]?.message?.content ?? '[]';
      console.log(`[LLM] Raw batch response:`, content.substring(0, 300));
      
      // 尝试提取和修复JSON数组
      const jsonContent = this.extractJSONArray(content);
      const parsed = JSON.parse(jsonContent);
      
      if (!Array.isArray(parsed)) {
        console.log('[LLM] Response is not an array, wrapping');
        return parsed.type ? [parsed] : [];
      }
      
      // 过滤掉无效事件
      const validEvents = parsed.filter((event: { type?: string; severity?: string; title?: string }) =>
        event && event.type && event.severity && event.title
      );
      
      console.log(`[LLM] Generated ${validEvents.length} valid events`);
      return validEvents;
    } catch (error) {
      console.error('[LLM] Batch event generation error:', error);
      return [];
    }
  }
  
  /**
   * 从内容中提取JSON数组，处理截断情况
   */
  private extractJSONArray(content: string): string {
    let trimmed = content.trim();
    
    // 移除可能的markdown标记
    if (trimmed.startsWith('```json')) {
      trimmed = trimmed.slice(7);
    }
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.slice(3);
    }
    if (trimmed.endsWith('```')) {
      trimmed = trimmed.slice(0, -3);
    }
    trimmed = trimmed.trim();
    
    // 如果不以[开头，尝试找到数组
    if (!trimmed.startsWith('[')) {
      const arrayMatch = trimmed.match(/\[[\s\S]*/);
      if (arrayMatch) {
        trimmed = arrayMatch[0];
      } else {
        return '[]';
      }
    }
    
    // 先尝试直接解析
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // 需要修复
    }
    
    // 尝试找到已完成的对象并提取
    const completedObjects: string[] = [];
    let depth = 0;
    let objectStart = -1;
    let inString = false;
    let lastChar = '';
    let inArray = false;
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i] ?? '';
      
      if (char === '"' && lastChar !== '\\') {
        inString = !inString;
      }
      
      if (!inString) {
        if (char === '[' && !inArray) {
          inArray = true;
        } else if (char === '{') {
          if (depth === 0) {
            objectStart = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && objectStart >= 0) {
            // 提取完整的对象
            const objStr = trimmed.slice(objectStart, i + 1);
            try {
              JSON.parse(objStr);
              completedObjects.push(objStr);
            } catch {
              // 对象不完整，跳过
            }
            objectStart = -1;
          }
        }
      }
      lastChar = char;
    }
    
    // 如果找到了完整的对象，构建数组
    if (completedObjects.length > 0) {
      const result = '[' + completedObjects.join(',') + ']';
      try {
        JSON.parse(result);
        console.log(`[LLM] Recovered ${completedObjects.length} complete objects from truncated array`);
        return result;
      } catch {
        // 返回空数组
      }
    }
    
    return '[]';
  }

  /**
   * Build system prompt for assistant
   */
  private buildAssistantPrompt(context: ChatContext): string {
    const assistantPrompt = `你是供应链模拟游戏《供应链指挥官：算法都市》中的AI商业顾问。请用中文回复。
你帮助玩家进行市场分析、战略决策，以及理解游戏机制。
保持简洁但信息丰富。恰当使用商业术语。
你可以访问实时市场数据，并提供可操作的洞察。`;

    const competitorPrompt = `你是商业模拟游戏中竞争公司的AI CEO。请用中文回复。
你的性格: ${context.personality ?? '中立的商人'}
进行真实的商业谈判和互动。`;

    const marketAnalystPrompt = `你是供应链模拟游戏中提供经济洞察的市场分析师AI。请用中文回复。
专注于趋势、预测和数据驱动的建议。`;

    switch (context.role) {
      case 'assistant':
        return assistantPrompt;
      case 'competitor':
        return competitorPrompt;
      case 'market_analyst':
        return marketAnalystPrompt;
      default:
        return assistantPrompt;
    }
  }

  /**
   * Generate fallback response when API fails
   */
  private generateFallbackResponse(message: string, _context: ChatContext): string {
    const keywords = message.toLowerCase();
    
    if (keywords.includes('市场') || keywords.includes('价格') || keywords.includes('market') || keywords.includes('price')) {
      return '根据当前市场状况，我建议密切关注半导体和能源板块。近期价格波动较大。';
    }
    if (keywords.includes('工厂') || keywords.includes('生产') || keywords.includes('factory') || keywords.includes('production')) {
      return '您的生产设施正在以最佳产能运行。考虑升级到AI辅助制造以获得更高产能。';
    }
    if (keywords.includes('竞争') || keywords.includes('对手') || keywords.includes('competitor')) {
      return '您的竞争对手近期在钢铁市场非常活跃。我建议签订长期合同来保护您的供应链。';
    }
    
    return '我理解您的问题。让我分析当前市场数据，稍后为您提供战略建议。';
  }

  /**
   * 生成技术效果（全局修饰符和生产方式解锁）
   * 根据研发概念生成有意义的游戏效果
   */
  async generateTechnologyEffects(request: TechEffectGenerationRequest): Promise<TechEffectGenerationResponse> {
    const prompt = `你是一个游戏设计师，需要为供应链模拟游戏《供应链指挥官：算法都市》生成技术效果。

研发概念：
- 名称：${request.conceptName}
- 描述：${request.conceptDescription}
- 类别：${request.category}
- 等级：${request.tier}/5

可以解锁生产方式的建筑ID列表：
${request.existingBuildings.slice(0, 10).join(', ')}

请生成合理的技术效果，返回JSON格式（不要markdown）：
{
  "globalModifiers": [
    {
      "type": "efficiency_boost" 或 "cost_reduction" 或 "output_increase" 或 "input_reduction",
      "target": "all" 或 具体建筑类别(extraction/processing/manufacturing/service),
      "value": 0.05到0.30之间的数值,
      "description": "效果的中文描述"
    }
  ],
  "productionMethodUnlocks": [
    {
      "buildingId": "适用的建筑ID（从上面列表选择）",
      "method": {
        "id": "唯一ID（英文小写加连字符）",
        "name": "英文名",
        "nameZh": "中文名",
        "description": "方法描述",
        "recipe": {
          "inputs": [{"goodsId": "商品ID", "amount": 数量}],
          "outputs": [{"goodsId": "商品ID", "amount": 数量}],
          "ticksRequired": 1到5
        },
        "laborRequired": 50到300,
        "powerRequired": 50到500,
        "efficiency": 1.0到2.0
      }
    }
  ]
}

规则：
1. tier越高效果越强（tier 1: 5-10%, tier 5: 25-30%）
2. 效果应与概念描述的领域相关
3. 至少生成1个全局修饰符
4. 如果概念与特定建筑相关，可生成对应的生产方式解锁
5. 生产方式的recipe要合理（可用商品ID：iron-ore, steel, copper, electricity, coal, chemicals, computing-power等）
6. 不要生成超过2个全局修饰符和1个生产方式解锁`;

    try {
      console.log(`[LLM] Generating technology effects for: ${request.conceptName}`);
      
      const response = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: 'You are a JSON generator. Return only valid JSON, no markdown, no explanation.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      console.log(`[LLM] Raw tech effects response:`, content.substring(0, 300));
      
      // 提取JSON
      const jsonContent = this.extractJSON(content);
      const parsed = JSON.parse(jsonContent) as Partial<TechEffectGenerationResponse>;
      
      // 验证和规范化响应
      const result: TechEffectGenerationResponse = {
        globalModifiers: this.normalizeGlobalModifiers(parsed.globalModifiers ?? [], request.tier),
        productionMethodUnlocks: this.normalizeProductionMethods(parsed.productionMethodUnlocks ?? [], request.existingBuildings),
      };
      
      console.log(`[LLM] Generated ${result.globalModifiers.length} modifiers and ${result.productionMethodUnlocks.length} method unlocks`);
      return result;
    } catch (error) {
      console.error('[LLM] Technology effects generation error:', error);
      // 返回基于tier的默认效果
      return this.getDefaultTechEffects(request);
    }
  }

  /**
   * 规范化全局修饰符
   */
  private normalizeGlobalModifiers(
    modifiers: TechEffectModifier[],
    tier: number
  ): TechEffectModifier[] {
    const validTypes = ['efficiency_boost', 'cost_reduction', 'output_increase', 'input_reduction'];
    const validTargets = ['all', 'extraction', 'processing', 'manufacturing', 'service', 'agriculture', 'retail'];
    
    // 根据tier计算合理的效果范围
    const minValue = 0.05 + (tier - 1) * 0.03;
    const maxValue = 0.10 + (tier - 1) * 0.05;
    
    const normalized = modifiers
      .filter(m => m && m.type && m.target)
      .map(m => ({
        type: validTypes.includes(m.type) ? m.type : 'efficiency_boost',
        target: validTargets.includes(m.target) ? m.target : 'all',
        value: Math.max(minValue, Math.min(maxValue, m.value ?? minValue)),
        description: m.description ?? `提升${m.type === 'efficiency_boost' ? '效率' : '产出'}`,
      }))
      .slice(0, 2); // 最多2个修饰符
    
    // 确保至少有1个修饰符
    if (normalized.length === 0) {
      normalized.push({
        type: 'efficiency_boost',
        target: 'all',
        value: minValue,
        description: `技术升级带来${Math.round(minValue * 100)}%效率提升`,
      });
    }
    
    return normalized;
  }

  /**
   * 规范化生产方式解锁
   */
  private normalizeProductionMethods(
    unlocks: TechEffectMethodUnlock[],
    existingBuildings: string[]
  ): TechEffectMethodUnlock[] {
    return unlocks
      .filter(u => u && u.buildingId && existingBuildings.includes(u.buildingId) && u.method)
      .map(u => ({
        buildingId: u.buildingId,
        method: {
          id: u.method.id ?? `tech-method-${Date.now()}`,
          name: u.method.name ?? 'Technology Enhanced',
          nameZh: u.method.nameZh ?? '技术增强',
          description: u.method.description ?? '技术研发解锁的新方法',
          recipe: {
            inputs: Array.isArray(u.method.recipe?.inputs) ? u.method.recipe.inputs : [],
            outputs: Array.isArray(u.method.recipe?.outputs) ? u.method.recipe.outputs : [],
            ticksRequired: Math.max(1, Math.min(10, u.method.recipe?.ticksRequired ?? 2)),
          },
          laborRequired: Math.max(10, Math.min(500, u.method.laborRequired ?? 100)),
          powerRequired: Math.max(10, Math.min(1000, u.method.powerRequired ?? 100)),
          efficiency: Math.max(1.0, Math.min(2.5, u.method.efficiency ?? 1.2)),
        },
      }))
      .slice(0, 1); // 最多1个生产方式解锁
  }

  /**
   * 获取默认技术效果（LLM失败时使用）
   */
  private getDefaultTechEffects(request: TechEffectGenerationRequest): TechEffectGenerationResponse {
    const tierBonus = 0.05 + (request.tier - 1) * 0.05;
    
    // 根据类别确定目标
    const categoryTargetMap: Record<string, string> = {
      'Manufacturing': 'manufacturing',
      'Materials': 'processing',
      'Energy': 'service',
      'Computing': 'manufacturing',
      'Biotech': 'agriculture',
      'Logistics': 'all',
      'Marketing': 'retail',
      'Finance': 'all',
    };
    
    const target = categoryTargetMap[request.category] ?? 'all';
    
    return {
      globalModifiers: [
        {
          type: 'efficiency_boost',
          target,
          value: tierBonus,
          description: `${request.conceptName}技术使${target === 'all' ? '所有' : target}类建筑效率提升${Math.round(tierBonus * 100)}%`,
        },
      ],
      productionMethodUnlocks: [],
    };
  }
}

/** 技术效果生成请求 */
export interface TechEffectGenerationRequest {
  conceptName: string;
  conceptDescription: string;
  category: string;
  tier: number;
  existingBuildings: string[];
}

/** 技术效果修饰符 */
export interface TechEffectModifier {
  type: 'efficiency_boost' | 'cost_reduction' | 'output_increase' | 'input_reduction';
  target: string;
  value: number;
  description: string;
}

/** 生产方式解锁 */
export interface TechEffectMethodUnlock {
  buildingId: string;
  method: {
    id: string;
    name: string;
    nameZh: string;
    description: string;
    recipe: {
      inputs: Array<{ goodsId: string; amount: number }>;
      outputs: Array<{ goodsId: string; amount: number }>;
      ticksRequired: number;
    };
    laborRequired: number;
    powerRequired: number;
    efficiency: number;
  };
}

/** 技术效果生成响应 */
export interface TechEffectGenerationResponse {
  globalModifiers: TechEffectModifier[];
  productionMethodUnlocks: TechEffectMethodUnlock[];
}

// Export singleton instance
export const llmService = new LLMService();