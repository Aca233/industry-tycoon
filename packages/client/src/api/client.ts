/**
 * API Client for communicating with the backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        data: null as unknown as T,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Game endpoints
  async createGame(name: string, playerCompanyName: string) {
    return this.request<{
      id: string;
      name: string;
      playerCompany: { id: string; name: string };
    }>('/api/v1/games', {
      method: 'POST',
      body: JSON.stringify({ name, playerCompanyName }),
    });
  }

  async getGame(gameId: string) {
    return this.request<{
      id: string;
      name: string;
      currentTick: number;
      speed: number;
      isPaused: boolean;
      playerCompanyId: string;
      playerCash: number;
      buildingCount: number;
      buildings: Array<{
        id: string;
        name: string;
        type: string;
        position: { x: number; y: number };
        activeMethodIds: Record<string, string>;
      }>;
    }>(`/api/v1/games/${gameId}`);
  }

  async setGameControl(gameId: string, speed: number, isPaused?: boolean) {
    return this.request<{ gameId: string; speed: number; isPaused: boolean }>(
      `/api/v1/games/${gameId}/control`,
      {
        method: 'PATCH',
        body: JSON.stringify({ speed, isPaused }),
      }
    );
  }

  async getBuildings(gameId: string) {
    return this.request<{
      buildings: Array<{
        id: string;
        name: string;
        type: string;
        companyId: string;
        zoneId: string;
        position: { x: number; y: number };
        activeMethodIds: Record<string, string>;
        efficiency: number;
        utilization: number;
      }>;
    }>(`/api/v1/games/${gameId}/buildings`);
  }

  async updateBuildingMethod(
    gameId: string,
    buildingId: string,
    slotType: string,
    methodId: string
  ) {
    return this.request<{
      buildingId: string;
      activeMethodIds: Record<string, string>;
      updated: boolean;
    }>(`/api/v1/games/${gameId}/buildings/${buildingId}/methods`, {
      method: 'PUT',
      body: JSON.stringify({ slotType, methodId }),
    });
  }

  async getMarket(gameId: string) {
    return this.request<{
      goods: Array<{
        id: string;
        name: string;
        price: number;
        trend: 'rising' | 'falling' | 'stable';
        volume: number;
      }>;
      defcon: number;
    }>(`/api/v1/games/${gameId}/market`);
  }

  async getEvents(gameId: string) {
    return this.request<{
      events: Array<{
        id: string;
        type: string;
        severity: string;
        title: string;
        description: string;
        tick: number;
        isResolved: boolean;
      }>;
    }>(`/api/v1/games/${gameId}/events`);
  }

  async getContracts(gameId: string, companyId?: string) {
    const query = companyId ? `?companyId=${companyId}` : '';
    return this.request<{
      contracts: Array<{
        id: string;
        sellerId: string;
        buyerId: string;
        goodsId: string;
        quantity: number;
        pricePerUnit: number;
        type: string;
        status: string;
      }>;
    }>(`/api/v1/games/${gameId}/contracts${query}`);
  }

  async createContract(
    gameId: string,
    contract: {
      sellerId: string;
      buyerId: string;
      goodsId: string;
      quantity: number;
      pricePerUnit: number;
      type: 'spot' | 'long_term';
      durationTicks?: number;
    }
  ) {
    return this.request<{
      id: string;
      status: string;
      createdAt: string;
    }>(`/api/v1/games/${gameId}/contracts`, {
      method: 'POST',
      body: JSON.stringify(contract),
    });
  }

  // Chat endpoints
  async sendChatMessage(
    gameId: string,
    message: string,
    role?: 'assistant' | 'competitor' | 'market_analyst'
  ) {
    return this.request<{
      role: string;
      content: string;
      timestamp: number;
    }>(`/api/v1/games/${gameId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, role }),
    });
  }

  async analyzeMarket(gameId: string) {
    return this.request<{
      summary: string;
      trends: Array<{ goodsId: string; trend: string; confidence: number }>;
      recommendations: string[];
    }>(`/api/v1/games/${gameId}/chat/analyze-market`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async negotiate(
    gameId: string,
    message: string,
    sellerId: string,
    goodsType: string,
    proposedTerms: {
      quantity: number;
      pricePerUnit: number;
      duration?: number;
    }
  ) {
    return this.request<{
      response: string;
      decision: 'accept' | 'reject' | 'counter' | 'continue';
      counterOffer?: {
        quantity?: number;
        pricePerUnit?: number;
        duration?: number;
      };
      emotionalState: string;
      timestamp: number;
    }>(`/api/v1/games/${gameId}/chat/negotiate`, {
      method: 'POST',
      body: JSON.stringify({ message, sellerId, goodsType, proposedTerms }),
    });
  }

  async evaluateResearch(gameId: string, prompt: string, budget: number) {
    return this.request<{
      feasibility: number;
      estimatedCost: number;
      estimatedTicks: number;
      risks: string[];
      potentialEffects: string[];
      sideEffects: string[];
    }>(`/api/v1/games/${gameId}/research/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ prompt, budget }),
    });
  }

  // ============================================
  // Research System API (Phase 18)
  // ============================================

  /** Create a new research concept */
  async createResearchConcept(
    gameId: string,
    concept: {
      name: string;
      description: string;
      targetOutcome?: string;
      constraints?: string[];
    }
  ) {
    return this.request<{
      projectId: string;
      concept: {
        name: string;
        description: string;
        originalPrompt: string;
      };
      status: string;
      message: string;
    }>(`/api/v1/games/${gameId}/research/concepts`, {
      method: 'POST',
      body: JSON.stringify(concept),
    });
  }

  /** Evaluate a research project concept via LLM */
  async evaluateResearchProject(gameId: string, projectId: string) {
    return this.request<{
      projectId: string;
      feasibility: {
        score: number;
        estimatedCost: number;
        estimatedTicks: number;
        prerequisites: string[];
        risks: string[];
        riskLevel: string;
        scientistComment: string;
        keywordAnalysis: string[];
      };
      status: string;
    }>(`/api/v1/games/${gameId}/research/projects/${projectId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /** Start a research project */
  async startResearchProject(gameId: string, projectId: string, initialBudget?: number) {
    return this.request<{
      projectId: string;
      status: string;
      startedAt: number;
      targetCost: number;
      investedFunds: number;
      message: string;
    }>(`/api/v1/games/${gameId}/research/projects/${projectId}/start`, {
      method: 'POST',
      body: JSON.stringify({ initialBudget }),
    });
  }

  /** Add investment to a research project */
  async investInResearch(gameId: string, projectId: string, amount: number) {
    return this.request<{
      projectId: string;
      investedFunds: number;
      targetCost: number;
      progress: number;
      message: string;
    }>(`/api/v1/games/${gameId}/research/projects/${projectId}/invest`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  /** Get all research projects */
  async getResearchProjects(gameId: string, status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request<{
      projects: Array<{
        id: string;
        concept: {
          name: string;
          description: string;
          originalPrompt: string;
        };
        status: string;
        progress: number;
        investedFunds: number;
        targetCost: number;
        feasibility?: {
          score: number;
          riskLevel: string;
          scientistComment: string;
        };
        startedAt?: number;
        completedAt?: number;
      }>;
      count: number;
    }>(`/api/v1/games/${gameId}/research/projects${query}`);
  }

  /** Get discovered technologies */
  async getTechnologies(gameId: string) {
    return this.request<{
      technologies: Array<{
        id: string;
        name: string;
        nameZh: string;
        description: string;
        category: string;
        tier: number;
        isLLMGenerated: boolean;
        isOwned?: boolean;
        canUse?: boolean;
        sideEffectCount?: number;
        patentHolderId?: string;
        unlockedMethods?: Array<{
          buildingId: string;
          methodId: string;
          description?: string;
        }>;
        globalModifiers?: Array<{
          type: string;
          value: number;
          description?: string;
        }>;
        sideEffects?: Array<{
          id: string;
          name: string;
          description?: string;
          type: string;
          severity: number;
          triggered: boolean;
          revealed: boolean;
        }>;
      }>;
      count: number;
    }>(`/api/v1/games/${gameId}/research/technologies`);
  }

  /** Get technology detail */
  async getTechnologyDetail(gameId: string, techId: string) {
    return this.request<{
      success: boolean;
      technology: {
        id: string;
        name: string;
        nameZh: string;
        description: string;
        category: string;
        tier: number;
        isLLMGenerated: boolean;
        isOwned: boolean;
        canUse: boolean;
        unlockedMethods?: Array<{
          buildingId: string;
          methodId: string;
          description?: string;
        }>;
        globalModifiers?: Array<{
          type: string;
          value: number;
          description?: string;
        }>;
        sideEffects?: Array<{
          id: string;
          name: string;
          description?: string;
          type: string;
          severity: number;
          triggered: boolean;
          revealed: boolean;
        }>;
        patentHolderId?: string;
        patentExpiresAt?: number;
      };
    }>(`/api/v1/games/${gameId}/research/technologies/${techId}`);
  }

  /** Request a patent license */
  async requestPatentLicense(
    gameId: string,
    patentId: string,
    proposedFee?: number,
    proposedTerms?: string
  ) {
    return this.request<{
      requestId: string;
      patentId: string;
      status: string;
      message: string;
    }>(`/api/v1/games/${gameId}/research/patents/${patentId}/license`, {
      method: 'POST',
      body: JSON.stringify({ proposedFee, proposedTerms }),
    });
  }

  /** Get technology effects summary */
  async getTechnologyEffectsSummary(gameId: string) {
    return this.request<{
      success: boolean;
      summary: {
        totalTechnologies: number;
        globalEfficiencyBonus: number;
        totalUnlockedMethods: number;
        modifiersByType: Record<string, number>;
      };
      activeTechnologies: Array<{
        id: string;
        name: string;
        activatedAt: number;
        modifierCount: number;
        unlockedMethodCount: number;
      }>;
    }>(`/api/v1/games/${gameId}/research/effects/summary`);
  }

  /** Get building technology modifiers */
  async getBuildingTechEffects(gameId: string, buildingId: string) {
    return this.request<{
      success: boolean;
      buildingId: string;
      modifiers: {
        efficiencyMultiplier: number;
        costMultiplier: number;
        outputMultiplier: number;
        inputMultiplier: number;
      };
      unlockedMethods: Array<{
        id: string;
        name: string;
        nameZh: string;
        description: string;
        isFromTech: boolean;
      }>;
    }>(`/api/v1/games/${gameId}/research/effects/building/${buildingId}`);
  }

  async generateEvent(gameId: string) {
    return this.request<{
      generated: boolean;
      event?: {
        type: string;
        severity: string;
        title: string;
        description: string;
        effects: Record<string, unknown>;
      };
      message?: string;
    }>(`/api/v1/games/${gameId}/events/generate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // ============================================
  // Auto Trade API
  // ============================================

  /** Get auto trade status */
  async getAutoTradeStatus(gameId: string) {
    return this.request<{
      enabled: boolean;
      goodsConfigs: Array<{
        goodsId: string;
        autoBuy: {
          enabled: boolean;
          triggerThreshold: number;
          targetStock: number;
          maxPriceMultiplier: number;
        };
        autoSell: {
          enabled: boolean;
          triggerThreshold: number;
          reserveStock: number;
          minPriceMultiplier: number;
        };
      }>;
      activeOrders: {
        buyOrders: number;
        sellOrders: number;
        totalValue: number;
      };
      lastActions: Array<{
        type: 'buy' | 'sell';
        goodsId: string;
        quantity: number;
        price: number;
        success: boolean;
        message?: string;
      }>;
      lastProcessedTick: number;
    }>(`/api/v1/games/${gameId}/auto-trade`);
  }

  /** Toggle auto trade */
  async toggleAutoTrade(gameId: string, enabled: boolean) {
    return this.request<{
      success: boolean;
      status: {
        enabled: boolean;
        goodsConfigs: Array<{
          goodsId: string;
          autoBuy: {
            enabled: boolean;
            triggerThreshold: number;
            targetStock: number;
            maxPriceMultiplier: number;
          };
          autoSell: {
            enabled: boolean;
            triggerThreshold: number;
            reserveStock: number;
            minPriceMultiplier: number;
          };
        }>;
        activeOrders: {
          buyOrders: number;
          sellOrders: number;
          totalValue: number;
        };
        lastActions: Array<{
          type: 'buy' | 'sell';
          goodsId: string;
          quantity: number;
          price: number;
          success: boolean;
          message?: string;
        }>;
        lastProcessedTick: number;
      };
    }>(`/api/v1/games/${gameId}/auto-trade/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  /** Auto configure from buildings */
  async autoConfigureAutoTrade(gameId: string) {
    return this.request<{
      success: boolean;
      status: {
        enabled: boolean;
        goodsConfigs: Array<{
          goodsId: string;
          autoBuy: {
            enabled: boolean;
            triggerThreshold: number;
            targetStock: number;
            maxPriceMultiplier: number;
          };
          autoSell: {
            enabled: boolean;
            triggerThreshold: number;
            reserveStock: number;
            minPriceMultiplier: number;
          };
        }>;
        activeOrders: {
          buyOrders: number;
          sellOrders: number;
          totalValue: number;
        };
        lastActions: Array<{
          type: 'buy' | 'sell';
          goodsId: string;
          quantity: number;
          price: number;
          success: boolean;
          message?: string;
        }>;
        lastProcessedTick: number;
      };
    }>(`/api/v1/games/${gameId}/auto-trade/auto-configure`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /** Update goods auto trade config */
  async updateAutoTradeGoodsConfig(
    gameId: string,
    goodsId: string,
    config: {
      autoBuy?: {
        enabled?: boolean;
        triggerThreshold?: number;
        targetStock?: number;
        maxPriceMultiplier?: number;
      };
      autoSell?: {
        enabled?: boolean;
        triggerThreshold?: number;
        reserveStock?: number;
        minPriceMultiplier?: number;
      };
    }
  ) {
    return this.request<{
      success: boolean;
      status: {
        enabled: boolean;
        goodsConfigs: Array<{
          goodsId: string;
          autoBuy: {
            enabled: boolean;
            triggerThreshold: number;
            targetStock: number;
            maxPriceMultiplier: number;
          };
          autoSell: {
            enabled: boolean;
            triggerThreshold: number;
            reserveStock: number;
            minPriceMultiplier: number;
          };
        }>;
        activeOrders: {
          buyOrders: number;
          sellOrders: number;
          totalValue: number;
        };
        lastActions: Array<{
          type: 'buy' | 'sell';
          goodsId: string;
          quantity: number;
          price: number;
          success: boolean;
          message?: string;
        }>;
        lastProcessedTick: number;
      };
    }>(`/api/v1/games/${gameId}/auto-trade/goods/${goodsId}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // Health check
  async getStatus() {
    return this.request<{
      version: string;
      gameEngine: string;
      llmProvider: string;
    }>('/api/v1/status');
  }

  // ============================================
  // Settings API
  // ============================================

  /** Get LLM configuration */
  async getLLMConfig() {
    return this.request<{
      apiKey: string;
      baseUrl: string;
      model: string;
    }>('/api/v1/settings/llm');
  }

  /** Update LLM configuration */
  async updateLLMConfig(config: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) {
    return this.request<{
      success: boolean;
      config: {
        apiKey: string;
        baseUrl: string;
        model: string;
      };
    }>('/api/v1/settings/llm', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  /** Test LLM connection (saved config) */
  async testLLMConnection() {
    return this.request<{
      success: boolean;
      message: string;
      model?: string;
    }>('/api/v1/settings/llm/test', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /** Test LLM connection with temporary config (without saving) */
  async testLLMConnectionTemp(config: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) {
    return this.request<{
      success: boolean;
      message: string;
      model?: string;
    }>('/api/v1/settings/llm/test-temp', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  /** Get available models (saved config) */
  async getAvailableModels() {
    return this.request<{
      success: boolean;
      models: string[];
      message?: string;
    }>('/api/v1/settings/llm/models');
  }

  /** Get available models with temporary config (without saving) */
  async getAvailableModelsTemp(config: {
    apiKey?: string;
    baseUrl?: string;
  }) {
    return this.request<{
      success: boolean;
      models: string[];
      message?: string;
    }>('/api/v1/settings/llm/models-temp', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // ============================================
  // Stock Market API (Phase 32)
  // ============================================

  /** Get all stocks */
  async getStocks() {
    return this.request<{
      success: boolean;
      data: {
        stocks: Array<{
          companyId: string;
          ticker: string;
          totalShares: number;
          floatingShares: number;
          currentPrice: number;
          openPrice: number;
          highPrice: number;
          lowPrice: number;
          previousClose: number;
          marketCap: number;
          peRatio: number;
          pbRatio: number;
          eps: number;
          bookValuePerShare: number;
          dividendYield: number;
          priceChangePercent: number;
          volume: number;
          turnover: number;
          status: string;
          listedTick: number;
        }>;
        marketState: {
          marketIndex: number;
          indexBase: number;
          sentiment: string;
          dailyTurnover: number;
          advancers: number;
          decliners: number;
          unchanged: number;
          limitUpStocks: string[];
          limitDownStocks: string[];
          isOpen: boolean;
          openTick: number;
          closeTick: number;
        };
      };
    }>('/api/v1/stocks');
  }

  /** Get single stock details */
  async getStockDetail(stockId: string) {
    return this.request<{
      success: boolean;
      data: {
        stock: {
          companyId: string;
          ticker: string;
          totalShares: number;
          floatingShares: number;
          currentPrice: number;
          openPrice: number;
          highPrice: number;
          lowPrice: number;
          previousClose: number;
          marketCap: number;
          peRatio: number;
          pbRatio: number;
          eps: number;
          bookValuePerShare: number;
          dividendYield: number;
          priceChangePercent: number;
          volume: number;
          turnover: number;
          status: string;
          listedTick: number;
        };
        priceHistory: Array<{
          tick: number;
          open: number;
          high: number;
          low: number;
          close: number;
          volume: number;
          turnover: number;
        }>;
        stockholders: Array<{
          holderId: string;
          companyId: string;
          shares: number;
          sharePercent: number;
          costBasis: number;
          avgCostPrice: number;
          type: string;
        }>;
        recentTrades: Array<{
          id: string;
          stockId: string;
          buyerId: string;
          sellerId: string;
          price: number;
          quantity: number;
          value: number;
          tick: number;
        }>;
        valuation: {
          companyId: string;
          assetBasedValue: number;
          earningsBasedValue: number;
          fairValue: number;
          marketPrice: number;
          premiumDiscount: number;
          rating: string;
        } | null;
      };
    }>(`/api/v1/stocks/${stockId}`);
  }

  /** Get stock price history */
  async getStockPriceHistory(stockId: string, limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<{
      success: boolean;
      data: Array<{
        tick: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        turnover: number;
      }>;
    }>(`/api/v1/stocks/${stockId}/history${query}`);
  }

  /** Get stockholdings for a company */
  async getStockHoldings(holderId: string) {
    return this.request<{
      success: boolean;
      data: Array<{
        holderId: string;
        companyId: string;
        shares: number;
        sharePercent: number;
        costBasis: number;
        avgCostPrice: number;
        type: string;
        currentPrice: number;
        marketValue: number;
        unrealizedPnL: number;
        pnLPercent: number;
        ticker: string;
      }>;
    }>(`/api/v1/stocks/holdings/${holderId}`);
  }

  /** Submit stock order */
  async submitStockOrder(
    companyId: string,
    stockId: string,
    orderType: 'market' | 'limit',
    side: 'buy' | 'sell',
    quantity: number,
    limitPrice?: number
  ) {
    return this.request<{
      success: boolean;
      data: {
        success: boolean;
        order?: {
          id: string;
          companyId: string;
          stockId: string;
          orderType: string;
          side: string;
          quantity: number;
          filledQuantity: number;
          remainingQuantity: number;
          limitPrice?: number;
          status: string;
          createdTick: number;
          expiryTick: number;
        };
        error?: string;
      };
    }>('/api/v1/stocks/order', {
      method: 'POST',
      body: JSON.stringify({ companyId, stockId, orderType, side, quantity, limitPrice }),
    });
  }

  /** Cancel stock order */
  async cancelStockOrder(stockId: string, orderId: string) {
    return this.request<{
      success: boolean;
      message?: string;
      error?: string;
    }>(`/api/v1/stocks/order/${stockId}/${orderId}`, {
      method: 'DELETE',
    });
  }

  /** Get market state */
  async getMarketState() {
    return this.request<{
      success: boolean;
      data: {
        marketIndex: number;
        indexBase: number;
        sentiment: string;
        dailyTurnover: number;
        advancers: number;
        decliners: number;
        unchanged: number;
        limitUpStocks: string[];
        limitDownStocks: string[];
        isOpen: boolean;
        openTick: number;
        closeTick: number;
      };
    }>('/api/v1/stocks/market/state');
  }

  /** Get recent stock trades */
  async getRecentStockTrades(stockId?: string, limit?: number) {
    const params = new URLSearchParams();
    if (stockId) params.append('stockId', stockId);
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{
      success: boolean;
      data: Array<{
        id: string;
        stockId: string;
        buyerId: string;
        sellerId: string;
        price: number;
        quantity: number;
        value: number;
        tick: number;
      }>;
    }>(`/api/v1/stocks/trades/recent${query}`);
  }

  /** Get market depth (order book) */
  async getMarketDepth(stockId: string, levels: number = 5) {
    return this.request<{
      success: boolean;
      data: {
        stockId: string;
        ticker: string;
        currentPrice: number;
        bids: Array<{ price: number; volume: number }>;
        asks: Array<{ price: number; volume: number }>;
      };
    }>(`/api/v1/stocks/${stockId}/depth?levels=${levels}`);
  }

  /** Get orders for a company */
  async getOrders(companyId: string) {
    return this.request<{
      success: boolean;
      data: Array<{
        id: string;
        companyId: string;
        stockId: string;
        orderType: string;
        side: string;
        quantity: number;
        filledQuantity: number;
        remainingQuantity: number;
        limitPrice?: number;
        status: string;
        createdTick: number;
        expiryTick: number;
        ticker: string;
        currentPrice: number;
      }>;
    }>(`/api/v1/stocks/orders/${companyId}`);
  }

  /** Initiate takeover bid */
  async initiateTakeover(acquirerId: string, targetId: string, offerPrice: number, rationale?: string) {
    return this.request<{
      success: boolean;
      data?: {
        id: string;
        acquirerId: string;
        targetId: string;
        offerPrice: number;
        premium: number;
        status: string;
        initiatedTick: number;
        expiryTick: number;
        rationale: string;
        hostile: boolean;
        defenseActivated: boolean;
      };
      error?: string;
    }>('/api/v1/stocks/takeover', {
      method: 'POST',
      body: JSON.stringify({ acquirerId, targetId, offerPrice, rationale }),
    });
  }
}

// WebSocket connection manager
export class GameWebSocket {
  private ws: WebSocket | null = null;
  private gameId: string;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_BASE_URL}/ws/game/${this.gameId}`);

      this.ws.onopen = () => {
        console.log(`WebSocket connected for game: ${this.gameId}`);
        this.reconnectAttempts = 0;
        this.send({ type: 'subscribe' });
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type: string; [key: string]: unknown };
          this.emit(data.type, data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.attemptReconnect();
      };
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Attempting reconnect in ${delay}ms...`);
      setTimeout(() => this.connect().catch(console.error), delay);
    }
  }

  send(data: { type: string; payload?: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(eventType: string, callback: (data: unknown) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  off(eventType: string, callback: (data: unknown) => void) {
    this.listeners.get(eventType)?.delete(callback);
  }

  private emit(eventType: string, data: unknown) {
    this.listeners.get(eventType)?.forEach((callback) => callback(data));
    this.listeners.get('*')?.forEach((callback) => callback(data));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  ping() {
    this.send({ type: 'ping' });
  }
}

// Export singleton API client
export const api = new ApiClient(API_BASE_URL);