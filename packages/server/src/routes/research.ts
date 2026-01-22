/**
 * Research API Routes - 研发系统API
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { researchService } from '../services/researchService.js';
import { gameLoop } from '../services/gameLoop.js';
import { technologyEffectManager } from '../services/technologyEffectManager.js';

// Request schemas
const createConceptSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(2000),
  constraints: z.array(z.string()).optional(),
});

const evaluateConceptSchema = z.object({
  existingTechnologies: z.array(z.string()).optional(),
  cash: z.number().optional(),
  researchCapacity: z.number().optional(),
});

const investFundsSchema = z.object({
  amount: z.number().positive(),
});

export async function researchRoutes(app: FastifyInstance) {
  // ====================================
  // 研发项目管理
  // ====================================

  /**
   * 创建研发概念
   * POST /api/v1/games/:gameId/research/concepts
   */
  app.post('/api/v1/games/:gameId/research/concepts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    const body = createConceptSchema.parse(request.body);
    
    // 获取游戏状态以确定玩家公司ID
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    
    const project = researchService.createConcept({
      companyId: gameState.playerCompanyId,
      name: body.name,
      description: body.description,
      constraints: body.constraints ?? [],
    });
    
    app.log.info({ gameId, projectId: project.id }, 'Research concept created');
    
    return reply.code(201).send({
      success: true,
      project: {
        id: project.id,
        name: project.concept.name,
        description: project.concept.description,
        status: project.status,
      },
    });
  });

  /**
   * 评估研发概念可行性（调用LLM）
   * POST /api/v1/games/:gameId/research/projects/:projectId/evaluate
   */
  app.post('/api/v1/games/:gameId/research/projects/:projectId/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, projectId } = request.params as { gameId: string; projectId: string };
    const body = evaluateConceptSchema.parse(request.body);
    
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    
    const result = await researchService.evaluateConcept(projectId, {
      existingTechnologies: body.existingTechnologies ?? [],
      cash: body.cash ?? gameState.playerCash,
      researchCapacity: body.researchCapacity ?? 1,
    });
    
    if (!result.success) {
      return reply.code(400).send({
        success: false,
        error: result.error,
      });
    }
    
    app.log.info({ gameId, projectId, feasibility: result.feasibility?.score }, 'Research concept evaluated');
    
    return reply.send({
      success: true,
      feasibility: result.feasibility,
    });
  });

  /**
   * 启动研发项目
   * POST /api/v1/games/:gameId/research/projects/:projectId/start
   */
  app.post('/api/v1/games/:gameId/research/projects/:projectId/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, projectId } = request.params as { gameId: string; projectId: string };
    
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    
    const success = researchService.startResearch(projectId, gameState.currentTick);
    
    if (!success) {
      return reply.code(400).send({
        success: false,
        error: 'Cannot start research. Project may not exist or not evaluated.',
      });
    }
    
    app.log.info({ gameId, projectId }, 'Research project started');
    
    return reply.send({
      success: true,
      message: '研发项目已启动',
    });
  });

  /**
   * 投入资金到研发项目
   * POST /api/v1/games/:gameId/research/projects/:projectId/invest
   */
  app.post('/api/v1/games/:gameId/research/projects/:projectId/invest', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, projectId } = request.params as { gameId: string; projectId: string };
    const body = investFundsSchema.parse(request.body);
    
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    
    // 获取项目状态，检查投资是否超过目标
    const state = researchService.getState();
    const project = state.projects.get(projectId);
    
    if (!project) {
      return reply.code(400).send({
        success: false,
        error: '项目不存在',
      });
    }
    
    // 计算还需要多少投资
    const remainingNeeded = Math.max(0, project.targetCost - project.investedFunds);
    if (remainingNeeded <= 0) {
      return reply.code(400).send({
        success: false,
        error: '投资已达目标，无需追加',
      });
    }
    
    // 限制投资金额不超过剩余需求
    const actualAmount = Math.min(body.amount, remainingNeeded);
    
    // 检查玩家是否有足够资金
    if (gameState.playerCash < actualAmount) {
      return reply.code(400).send({
        success: false,
        error: `资金不足，需要 ${actualAmount}，当前只有 ${gameState.playerCash}`,
      });
    }
    
    // 先扣除玩家资金
    const deducted = gameLoop.deductPlayerCash(gameId, actualAmount);
    if (!deducted) {
      return reply.code(400).send({
        success: false,
        error: '资金扣除失败',
      });
    }
    
    // 然后投入到项目
    const success = researchService.investFunds(projectId, actualAmount);
    
    if (!success) {
      // 投资失败，退还资金
      gameLoop.addPlayerCash(gameId, actualAmount);
      return reply.code(400).send({
        success: false,
        error: '投资失败，资金已退还',
      });
    }
    
    app.log.info({ gameId, projectId, amount: actualAmount }, 'Funds invested in research');
    
    return reply.send({
      success: true,
      investedAmount: actualAmount,
      newPlayerCash: gameState.playerCash,
      projectInvestedFunds: project.investedFunds + actualAmount,
      targetCost: project.targetCost,
    });
  });

  /**
   * 取消研发项目
   * POST /api/v1/games/:gameId/research/projects/:projectId/cancel
   */
  app.post('/api/v1/games/:gameId/research/projects/:projectId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, projectId } = request.params as { gameId: string; projectId: string };
    
    const success = researchService.cancelProject(projectId);
    
    if (!success) {
      return reply.code(400).send({
        success: false,
        error: '无法取消项目，项目可能不存在',
      });
    }
    
    app.log.info({ gameId, projectId }, 'Research project cancelled');
    
    return reply.send({
      success: true,
      message: '研发项目已取消',
    });
  });

  /**
   * 获取公司的所有研发项目
   * GET /api/v1/games/:gameId/research/projects
   */
  app.get('/api/v1/games/:gameId/research/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    const projects = researchService.getProjectsByCompany(gameState.playerCompanyId);
    
    return reply.send({
      projects: projects.map(p => ({
        id: p.id,
        concept: {
          name: p.concept.name,
          description: p.concept.description,
          originalPrompt: p.concept.originalPrompt,
        },
        status: String(p.status).toLowerCase(), // Ensure lowercase status
        progress: p.progress,
        investedFunds: p.investedFunds,
        targetCost: p.targetCost,
        startedAt: p.startedAt,
        completedAt: p.completedAt,
        feasibility: p.feasibility ? {
          score: p.feasibility.score,
          riskLevel: p.feasibility.riskLevel,
          estimatedCost: p.feasibility.estimatedCost,
          scientistComment: p.feasibility.scientistComment,
          prerequisites: p.feasibility.prerequisites,
          risks: p.feasibility.risks,
          keywordAnalysis: p.feasibility.keywordAnalysis,
        } : null,
      })),
      count: projects.length,
    });
  });

  /**
   * 获取单个研发项目详情
   * GET /api/v1/games/:gameId/research/projects/:projectId
   */
  app.get('/api/v1/games/:gameId/research/projects/:projectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId: _gameId, projectId } = request.params as { gameId: string; projectId: string };
    
    const state = researchService.getState();
    const project = state.projects.get(projectId);
    
    if (!project) {
      return reply.code(404).send({
        success: false,
        error: '项目不存在',
      });
    }
    
    return reply.send({
      success: true,
      project: {
        id: project.id,
        concept: project.concept,
        status: project.status,
        progress: project.progress,
        investedFunds: project.investedFunds,
        targetCost: project.targetCost,
        feasibility: project.feasibility,
        startedAt: project.startedAt,
        completedAt: project.completedAt,
        resultTechnologyId: project.resultTechnologyId,
      },
    });
  });

  // ====================================
  // 技术管理
  // ====================================

  /**
   * 获取所有已发明的技术
   * GET /api/v1/games/:gameId/research/technologies
   */
  app.get('/api/v1/games/:gameId/research/technologies', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    const technologies = researchService.getAllTechnologies();
    
    return reply.send({
      technologies: technologies.map(t => {
        // Only show revealed side effects
        const revealedSideEffects = t.sideEffects?.filter(se => se.revealed) ?? [];
        
        return {
          id: t.id,
          name: t.name,
          nameZh: t.nameZh,
          description: t.description,
          category: t.category,
          tier: t.tier,
          isLLMGenerated: t.isLLMGenerated ?? false,
          isOwned: t.patentHolderId === gameState.playerCompanyId,
          canUse: researchService.canUseTechnology(t.id, gameState.playerCompanyId, gameState.currentTick),
          sideEffectCount: t.sideEffects?.length ?? 0,
          patentHolderId: t.patentHolderId,
          unlockedMethods: t.unlockedMethods ?? [],
          globalModifiers: t.globalModifiers ?? [],
          sideEffects: revealedSideEffects.map(se => ({
            id: se.id,
            name: se.name,
            description: se.description,
            type: se.type,
            severity: se.severity as number,
            triggered: se.triggered,
            revealed: se.revealed,
          })),
        };
      }),
      count: technologies.length,
    });
  });

  /**
   * 获取单个技术详情
   * GET /api/v1/games/:gameId/research/technologies/:techId
   */
  app.get('/api/v1/games/:gameId/research/technologies/:techId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, techId } = request.params as { gameId: string; techId: string };
    
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    const state = researchService.getState();
    const technology = state.technologies.get(techId);
    
    if (!technology) {
      return reply.code(404).send({
        success: false,
        error: '技术不存在',
      });
    }
    
    // 只显示已揭示的副作用
    const revealedSideEffects = technology.sideEffects?.filter(se => se.revealed) ?? [];
    
    return reply.send({
      success: true,
      technology: {
        id: technology.id,
        name: technology.name,
        nameZh: technology.nameZh,
        description: technology.description,
        category: technology.category,
        tier: technology.tier,
        isOwned: technology.patentHolderId === gameState.playerCompanyId,
        canUse: researchService.canUseTechnology(techId, gameState.playerCompanyId, gameState.currentTick),
        unlockedMethods: technology.unlockedMethods,
        globalModifiers: technology.globalModifiers,
        sideEffects: revealedSideEffects.map(se => ({
          id: se.id,
          name: se.name,
          description: se.description,
          type: se.type,
          severity: se.severity,
          triggered: se.triggered,
        })),
        patentHolderId: technology.patentHolderId,
        patentExpiresAt: technology.patentExpiresAt,
      },
    });
  });

  // ====================================
  // 专利管理
  // ====================================

  /**
   * 获取所有专利
   * GET /api/v1/games/:gameId/research/patents
   */
  app.get('/api/v1/games/:gameId/research/patents', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    const state = researchService.getState();
    
    const patents = Array.from(state.patents.values()).map(p => ({
      id: p.id,
      technologyId: p.technologyId,
      holderId: p.holderId,
      isOwned: p.holderId === gameState.playerCompanyId,
      status: p.status,
      grantedAt: p.grantedAt,
      expiresAt: p.expiresAt,
      licenseFee: p.licenseFee,
      licenseeCount: p.licensees.length,
    }));
    
    return reply.send({ patents });
  });

  /**
   * 请求专利授权
   * POST /api/v1/games/:gameId/research/patents/:patentId/license
   */
  app.post('/api/v1/games/:gameId/research/patents/:patentId/license', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, patentId } = request.params as { gameId: string; patentId: string };
    
    const gameState = gameLoop.getOrCreateGame(gameId, 'player-company-1');
    const state = researchService.getState();
    const patent = state.patents.get(patentId);
    
    if (!patent) {
      return reply.code(404).send({
        success: false,
        error: '专利不存在',
      });
    }
    
    // 检查是否已经拥有授权
    if (patent.holderId === gameState.playerCompanyId || 
        patent.licensees.includes(gameState.playerCompanyId)) {
      return reply.code(400).send({
        success: false,
        error: '您已拥有此专利或授权',
      });
    }
    
    // 检查资金
    if (gameState.playerCash < patent.licenseFee) {
      return reply.code(400).send({
        success: false,
        error: '资金不足以支付授权费',
      });
    }
    
    // 扣除授权费
    // Note: 资金扣除将在后续版本中通过gameLoop实现
    // gameLoop.deductPlayerCash(gameId, patent.licenseFee);
    
    // 授予授权
    const success = researchService.grantLicense(patentId, gameState.playerCompanyId);
    
    if (!success) {
      return reply.code(400).send({
        success: false,
        error: '无法获取授权',
      });
    }
    
    app.log.info({ gameId, patentId, fee: patent.licenseFee }, 'Patent license granted');
    
    return reply.send({
      success: true,
      message: '专利授权成功',
      licenseFee: patent.licenseFee,
    });
  });

  // ====================================
  // 技术效果管理
  // ====================================

  /**
   * 获取已激活技术效果摘要
   * GET /api/v1/games/:gameId/research/effects/summary
   */
  app.get('/api/v1/games/:gameId/research/effects/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId } = request.params as { gameId: string };
    
    // 确保游戏存在
    gameLoop.getOrCreateGame(gameId, 'player-company-1');
    
    const summary = technologyEffectManager.getEffectsSummary();
    const activeTechnologies = technologyEffectManager.getActiveTechnologies();
    
    return reply.send({
      success: true,
      summary: {
        totalTechnologies: summary.totalTechnologies,
        globalEfficiencyBonus: summary.globalEfficiencyBonus,
        totalUnlockedMethods: summary.totalUnlockedMethods,
        modifiersByType: summary.modifiersByType,
      },
      activeTechnologies: activeTechnologies.map(t => ({
        id: t.id,
        name: t.name,
        activatedAt: t.activatedAt,
        modifierCount: t.globalModifiers.length,
        unlockedMethodCount: t.unlockedMethods.length,
      })),
    });
  });

  /**
   * 获取特定建筑的技术加成
   * GET /api/v1/games/:gameId/research/effects/building/:buildingId
   */
  app.get('/api/v1/games/:gameId/research/effects/building/:buildingId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gameId, buildingId } = request.params as { gameId: string; buildingId: string };
    
    // 确保游戏存在
    gameLoop.getOrCreateGame(gameId, 'player-company-1');
    
    const modifiers = technologyEffectManager.getBuildingModifiers(buildingId);
    const unlockedMethods = technologyEffectManager.getAvailableMethods(buildingId);
    
    return reply.send({
      success: true,
      buildingId,
      modifiers: {
        efficiencyMultiplier: modifiers.efficiencyMultiplier,
        costMultiplier: modifiers.costMultiplier,
        outputMultiplier: modifiers.outputMultiplier,
        inputMultiplier: modifiers.inputMultiplier,
      },
      unlockedMethods: unlockedMethods.map(m => ({
        id: m.id,
        name: m.name,
        nameZh: m.nameZh,
        description: m.description,
        isFromTech: technologyEffectManager.isMethodUnlockedByTech(buildingId, m.id),
      })),
    });
  });
}