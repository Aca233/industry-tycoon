/**
 * Research Service - 研发系统服务
 * 处理研发项目的创建、评估、进度推进和完成
 */

import { llmService } from './llm.js';
import { BUILDINGS_DATA } from '@scc/shared';

// ============================================
// Local Type Definitions (避免类型导出问题)
// ============================================

/** Risk level for research projects */
type RiskLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';

/** Side effect type categories */
type SideEffectType = 'health' | 'environment' | 'social' | 'economic';

/** Side effect severity (1 = minor, 5 = catastrophic) */
type SideEffectSeverity = 1 | 2 | 3 | 4 | 5;

/** Technology category */
type TechnologyCategory = 'Manufacturing' | 'Materials' | 'Energy' | 'Computing' | 'Biotech' | 'Logistics' | 'Marketing' | 'Finance';

/** Research status */
type ResearchStatus = 'Planning' | 'Active' | 'Paused' | 'Completed' | 'Failed' | 'Cancelled';

/** Patent status */
type PatentStatus = 'Active' | 'Expired' | 'Challenged' | 'Invalidated';

/** Research concept */
interface ResearchConcept {
  name: string;
  description: string;
  targetOutcome?: string;
  constraints?: string[];
  originalPrompt: string;
}

/** Feasibility evaluation */
interface FeasibilityEvaluation {
  score: number;
  estimatedCost: number;
  estimatedTicks: number;
  prerequisites: string[];
  risks: string[];
  riskLevel: RiskLevel;
  scientistComment: string;
  keywordAnalysis: string[];
  evaluatedAt: number;
}

/** Research project */
interface ResearchProject {
  id: string;
  companyId: string;
  technologyId?: string;
  concept: ResearchConcept;
  feasibility?: FeasibilityEvaluation;
  status: ResearchStatus;
  progress: number;
  investedFunds: number;
  targetCost: number;
  startedAt?: number;
  completedAt?: number;
  researcherCount: number;
  resultTechnologyId?: string;
}

/** Technology side effect */
interface TechnologySideEffect {
  id: string;
  name: string;
  description: string;
  type: SideEffectType;
  severity: SideEffectSeverity;
  triggerCondition: string;
  probability: number;
  delayTicks: number;
  triggered: boolean;
  revealed: boolean;
  triggeredAt?: number;
  revealedAt?: number;
  effect: {
    type: 'positive' | 'negative' | 'mixed';
    newsHeadline?: string;
    newsDescription?: string;
  };
}

/** Technology modifier */
interface TechnologyModifier {
  targetType: 'building' | 'goods' | 'production_method' | 'global';
  targetId?: string | undefined;
  modifierType: string;
  value: number;
  isMultiplier: boolean;
}

/** Technology */
interface Technology {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  isLLMGenerated: boolean;
  generatedFromPrompt?: string;
  generatedAt?: number;
  researchCost: number;
  researchTicks: number;
  prerequisites: string[];
  unlockedMethods: unknown[];
  unlockedBuildings: string[];
  unlockedGoods: string[];
  globalModifiers: TechnologyModifier[];
  /** 生产方式解锁（用于TechnologyEffectManager） */
  productionMethodUnlocks?: ProductionMethodUnlock[];
  patentHolderId?: string;
  patentExpiresAt?: number;
  sideEffects?: TechnologySideEffect[];
  category: TechnologyCategory;
  tier: number;
  icon: string;
}

/** Patent */
interface Patent {
  id: string;
  technologyId: string;
  holderId: string;
  grantedAt: number;
  expiresAt: number;
  isExclusive: boolean;
  licensees: string[];
  licenseFee: number;
  status: PatentStatus;
}

/** Production method unlock */
interface ProductionMethodUnlock {
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

/** Research evaluation request */
interface ResearchEvaluationRequest {
  projectName: string;
  description: string;
  constraints?: string[] | undefined;
  companyContext?: {
    existingTechnologies: string[];
    cash: number;
    researchCapacity: number;
  } | undefined;
  gameContext?: {
    currentYear: number;
    marketTrends: string[];
  } | undefined;
}

/** Research evaluation response */
interface ResearchEvaluationResponse {
  feasibilityScore: number;
  estimatedCost: number;
  estimatedMonths: number;
  prerequisites: string[];
  risks: string[];
  scientistComment: string;
  keywordAnalysis: string[];
  riskLevel: RiskLevel;
}

/** Technology generation request */
interface TechnologyGenerationRequest {
  concept: ResearchConcept;
  feasibility: FeasibilityEvaluation;
  investedFunds: number;
  researchDuration: number;
}

/** Technology generation response */
interface TechnologyGenerationResponse {
  name: string;
  nameZh: string;
  description: string;
  category: TechnologyCategory;
  tier: number;
  productionMethods: ProductionMethodUnlock[];
  sideEffects: Array<{
    type: SideEffectType;
    description: string;
    severity: SideEffectSeverity;
    triggerCondition: string;
    delayMonths: number;
    probability: number;
  }>;
  marketTags: string[];
  globalModifiers?: TechnologyModifier[];
}

/** 研发项目状态 */
export interface ResearchState {
  projects: Map<string, ResearchProject>;
  technologies: Map<string, Technology>;
  patents: Map<string, Patent>;
}

/** 创建研发项目的请求 */
export interface CreateResearchRequest {
  companyId: string;
  name: string;
  description: string;
  constraints?: string[];
}

/** 评估结果 */
export interface EvaluationResult {
  success: boolean;
  feasibility?: FeasibilityEvaluation;
  error?: string;
}

/** 技术生成结果 */
export interface TechnologyResult {
  success: boolean;
  technology?: Technology;
  patent?: Patent;
  error?: string;
}

/**
 * 研发服务类
 */
export class ResearchService {
  private state: ResearchState = {
    projects: new Map(),
    technologies: new Map(),
    patents: new Map(),
  };

  // 专利有效期（tick数，1天=1tick，5年=1825tick）
  private readonly PATENT_DURATION = 1825;
  
  // 每tick的进度比例（基于投入资金）
  // 调整为更快的进度：资金充足时每tick增加0.5%，约200 tick (~3分钟)完成
  private readonly PROGRESS_PER_TICK_BASE = 0.5;

  /**
   * 初始化研发状态
   */
  initialize(): void {
    this.state = {
      projects: new Map(),
      technologies: new Map(),
      patents: new Map(),
    };
    console.log('[ResearchService] Initialized');
  }

  /**
   * 获取当前研发状态
   */
  getState(): ResearchState {
    return this.state;
  }

  /**
   * 获取公司的所有研发项目
   */
  getProjectsByCompany(companyId: string): ResearchProject[] {
    return Array.from(this.state.projects.values())
      .filter(p => p.companyId === companyId);
  }

  /**
   * 获取所有已发现的技术
   */
  getAllTechnologies(): Technology[] {
    return Array.from(this.state.technologies.values());
  }

  /**
   * 获取公司发明的技术
   */
  getTechnologiesByCompany(companyId: string): Technology[] {
    return Array.from(this.state.technologies.values())
      .filter(t => t.patentHolderId === companyId);
  }

  /**
   * 创建新的研发概念
   */
  createConcept(request: CreateResearchRequest): ResearchProject {
    const concept: ResearchConcept = {
      name: request.name,
      description: request.description,
      targetOutcome: request.description,
      constraints: request.constraints ?? [],
      originalPrompt: request.description,
    };

    const project: ResearchProject = {
      id: crypto.randomUUID(),
      companyId: request.companyId,
      concept,
      status: 'Planning' as unknown as ResearchStatus,
      progress: 0,
      investedFunds: 0,
      targetCost: 0,
      researcherCount: 1,
    };

    this.state.projects.set(project.id, project);
    console.log(`[ResearchService] Created concept: ${project.id} - ${concept.name}`);
    return project;
  }

  /**
   * 评估研发概念的可行性（调用LLM）
   */
  async evaluateConcept(
    projectId: string,
    companyContext?: {
      existingTechnologies: string[];
      cash: number;
      researchCapacity: number;
    }
  ): Promise<EvaluationResult> {
    const project = this.state.projects.get(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    try {
      // 调用LLM进行评估
      const evaluationRequest: ResearchEvaluationRequest = {
        projectName: project.concept.name,
        description: project.concept.description,
        constraints: project.concept.constraints ?? [],
        companyContext: companyContext ?? undefined,
        gameContext: {
          currentYear: 2045,
          marketTrends: ['automation', 'sustainability'],
        },
      };

      const response = await this.callLLMForEvaluation(evaluationRequest);

      const feasibility: FeasibilityEvaluation = {
        score: response.feasibilityScore,
        estimatedCost: response.estimatedCost,
        estimatedTicks: response.estimatedMonths * 30, // 月转tick（1 tick = 1天）
        prerequisites: response.prerequisites,
        risks: response.risks,
        riskLevel: response.riskLevel,
        scientistComment: response.scientistComment,
        keywordAnalysis: response.keywordAnalysis,
        evaluatedAt: Date.now(),
      };

      // 更新项目
      project.feasibility = feasibility;
      project.targetCost = feasibility.estimatedCost;
      this.state.projects.set(projectId, project);

      console.log(`[ResearchService] Evaluated project ${projectId}: feasibility=${feasibility.score}`);
      return { success: true, feasibility };
    } catch (error) {
      console.error('[ResearchService] Evaluation error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 启动研发项目
   */
  startResearch(projectId: string, currentTick: number): boolean {
    const project = this.state.projects.get(projectId);
    if (!project) {
      console.error('[ResearchService] Project not found:', projectId);
      return false;
    }

    if (!project.feasibility) {
      console.error('[ResearchService] Project not evaluated:', projectId);
      return false;
    }

    project.status = 'Active' as unknown as ResearchStatus;
    project.startedAt = currentTick;
    this.state.projects.set(projectId, project);

    console.log(`[ResearchService] Started research: ${projectId}`);
    return true;
  }

  /**
   * 投入资金到研发项目
   */
  investFunds(projectId: string, amount: number): boolean {
    const project = this.state.projects.get(projectId);
    if (!project) {
      return false;
    }

    project.investedFunds += amount;
    this.state.projects.set(projectId, project);
    return true;
  }

  /**
   * 每tick推进研发进度
   * 返回完成的项目ID列表
   */
  progressResearch(currentTick: number): string[] {
    const completedProjects: string[] = [];
    const projectCount = this.state.projects.size;

    // 每100 tick输出总状态
    if (currentTick % 100 === 0 && projectCount > 0) {
      console.log(`[ResearchService] Tick ${currentTick}: Processing ${projectCount} projects`);
    }

    for (const [projectId, project] of this.state.projects) {
      // 使用字符串比较以确保状态正确匹配
      const statusStr = String(project.status).toLowerCase();
      
      // 每100 tick输出项目状态
      if (currentTick % 100 === 0) {
        console.log(`[ResearchService] Project ${project.concept?.name || projectId}: status=${statusStr}, progress=${project.progress.toFixed(2)}%`);
      }
      
      if (statusStr !== 'active') {
        continue;
      }

      // 计算进度增量
      // 进度基于已投入资金占目标成本的比例
      const fundingRatio = project.investedFunds / Math.max(project.targetCost, 1);
      const progressIncrement = this.PROGRESS_PER_TICK_BASE * Math.min(fundingRatio, 1);
      
      const oldProgress = project.progress;
      project.progress = Math.min(100, project.progress + progressIncrement);

      // Debug log every 20 ticks for active projects
      if (currentTick % 20 === 0) {
        console.log(`[ResearchService] ACTIVE Project ${project.concept?.name}: ${oldProgress.toFixed(2)}% -> ${project.progress.toFixed(2)}%, funding ratio=${fundingRatio.toFixed(2)}`);
      }

      // 检查是否完成
      if (project.progress >= 100 && project.investedFunds >= project.targetCost * 0.9) {
        project.status = 'Completed' as unknown as ResearchStatus;
        project.completedAt = currentTick;
        completedProjects.push(projectId);
        console.log(`[ResearchService] Project completed: ${projectId}`);
      }

      this.state.projects.set(projectId, project);
    }

    return completedProjects;
  }

  /**
   * 完成研发并生成技术
   */
  async completeResearch(projectId: string, currentTick: number): Promise<TechnologyResult> {
    const project = this.state.projects.get(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    if (!project.feasibility) {
      return { success: false, error: 'Project not evaluated' };
    }

    try {
      // 调用LLM生成技术
      const generationRequest: TechnologyGenerationRequest = {
        concept: project.concept,
        feasibility: project.feasibility,
        investedFunds: project.investedFunds,
        researchDuration: (project.completedAt ?? currentTick) - (project.startedAt ?? 0),
      };

      const response = await this.callLLMForGeneration(generationRequest);

      // 创建技术
      const technology = this.createTechnologyFromResponse(
        response,
        project,
        currentTick
      );

      // 创建专利
      const patent = this.createPatent(technology, project.companyId, currentTick);

      // 保存
      this.state.technologies.set(technology.id, technology);
      this.state.patents.set(patent.id, patent);

      // 更新项目
      project.resultTechnologyId = technology.id;
      this.state.projects.set(projectId, project);

      console.log(`[ResearchService] Technology created: ${technology.id} - ${technology.name}`);
      return { success: true, technology, patent };
    } catch (error) {
      console.error('[ResearchService] Technology generation error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 调用LLM进行可行性评估
   */
  private async callLLMForEvaluation(
    request: ResearchEvaluationRequest
  ): Promise<ResearchEvaluationResponse> {
    // 使用现有的evaluateTechnology方法，或者创建新的专用方法
    const result = await llmService.evaluateTechnology({
      prompt: `项目名称: ${request.projectName}\n描述: ${request.description}\n${request.constraints ? `约束: ${request.constraints.join(', ')}` : ''}`,
      currentTech: request.companyContext?.existingTechnologies ?? [],
      budget: request.companyContext?.cash ?? 100000000,
      companyProfile: '标准供应链企业',
    });

    // 根据风险评估确定风险等级
    const riskLevel = this.calculateRiskLevel(result.risks, result.sideEffects);

    return {
      feasibilityScore: Math.round(result.feasibility * 100),
      estimatedCost: result.estimatedCost,
      estimatedMonths: Math.ceil(result.estimatedTicks / 30), // tick转月（1 tick = 1天）
      prerequisites: [],
      risks: result.risks,
      scientistComment: `可行性评估完成。${result.potentialEffects.join(' ')}`,
      keywordAnalysis: this.extractKeywords(request.description),
      riskLevel,
    };
  }

  /**
   * 调用LLM生成技术（含效果生成）
   */
  private async callLLMForGeneration(
    request: TechnologyGenerationRequest
  ): Promise<TechnologyGenerationResponse> {
    const category = this.inferCategory(request.concept.description);
    const tier = Math.min(5, Math.ceil(request.feasibility.score / 20));
    const sideEffects = this.generateSideEffects(request);

    // 获取现有建筑ID列表
    const existingBuildings = BUILDINGS_DATA.map(b => b.id);

    // 调用LLM生成技术效果
    const techEffects = await llmService.generateTechnologyEffects({
      conceptName: request.concept.name,
      conceptDescription: request.concept.description,
      category: String(category),
      tier,
      existingBuildings,
    });

    // 转换全局修饰符为TechnologyModifier格式
    const globalModifiers: TechnologyModifier[] = techEffects.globalModifiers.map(mod => ({
      targetType: mod.target === 'all' ? 'global' : 'building',
      targetId: mod.target === 'all' ? undefined : mod.target,
      modifierType: mod.type,
      value: mod.value,
      isMultiplier: true,
    }));

    // 转换生产方式解锁
    const productionMethods: ProductionMethodUnlock[] = techEffects.productionMethodUnlocks.map(unlock => ({
      buildingId: unlock.buildingId,
      method: {
        id: unlock.method.id,
        name: unlock.method.name,
        nameZh: unlock.method.nameZh,
        description: unlock.method.description,
        recipe: unlock.method.recipe,
        laborRequired: unlock.method.laborRequired,
        powerRequired: unlock.method.powerRequired,
        efficiency: unlock.method.efficiency,
      },
    }));

    console.log(`[ResearchService] Generated tech effects: ${globalModifiers.length} modifiers, ${productionMethods.length} methods`);

    return {
      name: request.concept.name,
      nameZh: request.concept.name,
      description: `基于${request.concept.description}的创新技术`,
      category,
      tier,
      productionMethods,
      sideEffects: sideEffects.map(se => ({
        type: se.type,
        description: se.description,
        severity: se.severity,
        triggerCondition: se.triggerCondition,
        delayMonths: se.delayMonths,
        probability: se.probability,
      })),
      marketTags: this.generateMarketTags(request.concept.description),
      globalModifiers,
    };
  }

  /**
   * 从LLM响应创建Technology对象
   */
  private createTechnologyFromResponse(
    response: TechnologyGenerationResponse,
    project: ResearchProject,
    currentTick: number
  ): Technology {
    const sideEffects: TechnologySideEffect[] = response.sideEffects.map(se => ({
      id: crypto.randomUUID(),
      name: `${se.type}风险`,
      description: se.description,
      type: se.type as SideEffectType,
      severity: se.severity as SideEffectSeverity,
      triggerCondition: se.triggerCondition,
      probability: se.probability,
      delayTicks: se.delayMonths * 30, // 月转tick（1 tick = 1天）
      triggered: false,
      revealed: false,
      effect: {
        type: 'negative',
        newsHeadline: `${response.name}出现意外问题`,
        newsDescription: se.description,
      },
    }));

    return {
      id: crypto.randomUUID(),
      name: response.name,
      nameZh: response.nameZh,
      description: response.description,
      isLLMGenerated: true,
      generatedFromPrompt: project.concept.originalPrompt,
      generatedAt: Date.now(),
      researchCost: project.investedFunds,
      researchTicks: (project.completedAt ?? currentTick) - (project.startedAt ?? 0),
      prerequisites: [],
      unlockedMethods: [],
      unlockedBuildings: [],
      unlockedGoods: [],
      globalModifiers: response.globalModifiers ?? [],
      productionMethodUnlocks: response.productionMethods ?? [],
      patentHolderId: project.companyId,
      patentExpiresAt: Date.now() + this.PATENT_DURATION * 1000 * 3600,
      sideEffects,
      category: response.category as TechnologyCategory,
      tier: response.tier,
      icon: '🔬',
    };
  }

  /**
   * 创建专利
   */
  private createPatent(
    technology: Technology,
    holderId: string,
    currentTick: number
  ): Patent {
    return {
      id: crypto.randomUUID(),
      technologyId: technology.id,
      holderId,
      grantedAt: currentTick,
      expiresAt: currentTick + this.PATENT_DURATION,
      isExclusive: true,
      licensees: [],
      licenseFee: Math.round(technology.researchCost * 0.1),
      status: 'Active' as unknown as PatentStatus,
    };
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(risks: string[], sideEffects: string[]): RiskLevel {
    const riskScore = risks.length + sideEffects.length * 2;
    if (riskScore <= 2) return 'minimal';
    if (riskScore <= 4) return 'low';
    if (riskScore <= 6) return 'moderate';
    if (riskScore <= 8) return 'high';
    return 'extreme';
  }

  /**
   * 提取关键词
   */
  private extractKeywords(description: string): string[] {
    const keywords: string[] = [];
    const techTerms = [
      '能源', '电力', '太阳能', '核能', '生物',
      '自动化', 'AI', '机器人', '芯片', '半导体',
      '材料', '合金', '塑料', '化学', '环保',
      '高效', '低成本', '创新', '突破',
    ];

    for (const term of techTerms) {
      if (description.includes(term)) {
        keywords.push(term);
      }
    }

    return keywords;
  }

  /**
   * 推断技术类别
   */
  private inferCategory(description: string): TechnologyCategory {
    const lower = description.toLowerCase();
    if (lower.includes('能源') || lower.includes('电力') || lower.includes('发电')) {
      return 'Energy' as unknown as TechnologyCategory;
    }
    if (lower.includes('材料') || lower.includes('合金') || lower.includes('塑料')) {
      return 'Materials' as unknown as TechnologyCategory;
    }
    if (lower.includes('自动化') || lower.includes('机器人') || lower.includes('ai')) {
      return 'Computing' as unknown as TechnologyCategory;
    }
    if (lower.includes('生物') || lower.includes('基因') || lower.includes('有机')) {
      return 'Biotech' as unknown as TechnologyCategory;
    }
    return 'Manufacturing' as unknown as TechnologyCategory;
  }

  /**
   * 生成副作用
   */
  private generateSideEffects(request: TechnologyGenerationRequest): Array<{
    type: SideEffectType;
    description: string;
    severity: SideEffectSeverity;
    triggerCondition: string;
    delayMonths: number;
    probability: number;
  }> {
    const sideEffects: Array<{
      type: SideEffectType;
      description: string;
      severity: SideEffectSeverity;
      triggerCondition: string;
      delayMonths: number;
      probability: number;
    }> = [];

    // 根据风险等级生成副作用
    const riskLevel = request.feasibility.riskLevel;
    const description = request.concept.description.toLowerCase();

    // 描述越模糊，副作用越多
    const vagueness = this.calculateVagueness(request.concept.description);
    const sideEffectCount = Math.min(3, Math.ceil(vagueness * 3));

    for (let i = 0; i < sideEffectCount; i++) {
      const type = this.pickSideEffectType(description);
      sideEffects.push({
        type,
        description: this.generateSideEffectDescription(type, request.concept.name),
        severity: this.pickSeverity(riskLevel, i),
        triggerCondition: '大规模使用后',
        delayMonths: 3 + Math.floor(Math.random() * 9),
        probability: 0.3 + Math.random() * 0.4,
      });
    }

    return sideEffects;
  }

  /**
   * 计算描述的模糊程度
   */
  private calculateVagueness(description: string): number {
    // 描述越短、约束越少，越模糊
    const lengthScore = Math.max(0, 1 - description.length / 200);
    const hasNumbers = /\d/.test(description) ? 0 : 0.2;
    const hasSpecifics = /(必须|需要|不能|限制|要求)/.test(description) ? 0 : 0.3;
    
    return Math.min(1, lengthScore + hasNumbers + hasSpecifics);
  }

  /**
   * 选择副作用类型
   */
  private pickSideEffectType(description: string): SideEffectType {
    if (description.includes('生物') || description.includes('食品')) {
      return 'health';
    }
    if (description.includes('能源') || description.includes('化学')) {
      return 'environment';
    }
    if (description.includes('自动化') || description.includes('ai')) {
      return 'social';
    }
    return 'economic';
  }

  /**
   * 选择严重程度
   */
  private pickSeverity(riskLevel: RiskLevel, index: number): SideEffectSeverity {
    const baseLevel: Record<RiskLevel, number> = {
      minimal: 1,
      low: 1,
      moderate: 2,
      high: 3,
      extreme: 4,
    };
    
    return Math.min(5, baseLevel[riskLevel] + index) as SideEffectSeverity;
  }

  /**
   * 生成副作用描述
   */
  private generateSideEffectDescription(type: SideEffectType, techName: string): string {
    const descriptions: Record<SideEffectType, string[]> = {
      health: [
        `使用${techName}的产品可能引发过敏反应`,
        `长期接触${techName}相关材料可能影响健康`,
        `${techName}的副产物具有潜在毒性`,
      ],
      environment: [
        `${techName}的废弃物难以降解`,
        `${techName}生产过程产生有害排放`,
        `大规模使用${techName}可能影响当地生态`,
      ],
      social: [
        `${techName}的普及导致相关岗位减少`,
        `${techName}引发隐私和伦理争议`,
        `公众对${techName}的安全性产生质疑`,
      ],
      economic: [
        `${techName}对特定原材料的需求激增`,
        `${techName}维护成本超出预期`,
        `${techName}专利纠纷可能影响生产`,
      ],
    };

    const options = descriptions[type];
    return options[Math.floor(Math.random() * options.length)] ?? options[0] ?? '';
  }

  /**
   * 生成市场标签
   */
  private generateMarketTags(description: string): string[] {
    const tags: string[] = [];
    const lower = description.toLowerCase();

    if (lower.includes('环保') || lower.includes('绿色') || lower.includes('可持续')) {
      tags.push('环保');
    }
    if (lower.includes('高效') || lower.includes('节能')) {
      tags.push('高效');
    }
    if (lower.includes('创新') || lower.includes('突破')) {
      tags.push('创新');
    }
    if (lower.includes('低成本') || lower.includes('便宜')) {
      tags.push('经济型');
    }
    if (lower.includes('高端') || lower.includes('premium')) {
      tags.push('高端');
    }

    return tags.length > 0 ? tags : ['新技术'];
  }

  /**
   * 取消研发项目
   */
  cancelProject(projectId: string): boolean {
    const project = this.state.projects.get(projectId);
    if (!project) {
      return false;
    }

    project.status = 'Cancelled' as unknown as ResearchStatus;
    this.state.projects.set(projectId, project);
    console.log(`[ResearchService] Project cancelled: ${projectId}`);
    return true;
  }

  /**
   * 每tick检查并触发副作用
   * 返回本轮触发的副作用事件列表
   */
  processSideEffects(currentTick: number): Array<{
    technologyId: string;
    technologyName: string;
    sideEffect: TechnologySideEffect;
  }> {
    const triggeredEffects: Array<{
      technologyId: string;
      technologyName: string;
      sideEffect: TechnologySideEffect;
    }> = [];

    for (const [techId, technology] of this.state.technologies) {
      if (!technology.sideEffects) continue;

      for (const sideEffect of technology.sideEffects) {
        // 跳过已触发的副作用
        if (sideEffect.triggered) continue;

        // 计算距离技术发明已经过去的tick数
        const completedTick = this.getCompletedTickForTechnology(techId);
        if (completedTick === undefined) continue;
        
        const ticksSinceCompletion = currentTick - completedTick;
        
        // 检查是否超过延迟时间
        if (ticksSinceCompletion < sideEffect.delayTicks) continue;

        // 概率检查是否触发
        if (Math.random() > sideEffect.probability) {
          // 这次没触发，继续等待（可以在后续tick再检查）
          // 但为了避免无限等待，每次过了delay后都有概率触发
          // 如果概率检查失败，可以增加一个"累积触发机会"
          continue;
        }

        // 触发副作用
        sideEffect.triggered = true;
        sideEffect.triggeredAt = currentTick;
        sideEffect.revealed = true; // 触发后自动揭示
        sideEffect.revealedAt = currentTick;

        triggeredEffects.push({
          technologyId: techId,
          technologyName: technology.nameZh,
          sideEffect,
        });

        console.log(`[ResearchService] Side effect triggered: ${sideEffect.name} for ${technology.nameZh}`);
      }

      // 更新技术
      this.state.technologies.set(techId, technology);
    }

    return triggeredEffects;
  }

  /**
   * 获取技术完成的tick
   */
  private getCompletedTickForTechnology(technologyId: string): number | undefined {
    for (const [, project] of this.state.projects) {
      if (project.resultTechnologyId === technologyId) {
        return project.completedAt;
      }
    }
    return undefined;
  }

  /**
   * 获取即将触发的副作用（预警）
   */
  getUpcomingSideEffects(currentTick: number, lookaheadTicks: number = 1000): Array<{
    technologyId: string;
    technologyName: string;
    sideEffect: TechnologySideEffect;
    estimatedTriggerTick: number;
  }> {
    const upcoming: Array<{
      technologyId: string;
      technologyName: string;
      sideEffect: TechnologySideEffect;
      estimatedTriggerTick: number;
    }> = [];

    for (const [techId, technology] of this.state.technologies) {
      if (!technology.sideEffects) continue;

      const completedTick = this.getCompletedTickForTechnology(techId);
      if (completedTick === undefined) continue;

      for (const sideEffect of technology.sideEffects) {
        if (sideEffect.triggered || sideEffect.revealed) continue;

        const estimatedTriggerTick = completedTick + sideEffect.delayTicks;
        
        // 检查是否在预警范围内
        if (estimatedTriggerTick > currentTick &&
            estimatedTriggerTick <= currentTick + lookaheadTicks) {
          upcoming.push({
            technologyId: techId,
            technologyName: technology.nameZh,
            sideEffect,
            estimatedTriggerTick,
          });
        }
      }
    }

    return upcoming;
  }

  /**
   * 检查专利是否过期
   */
  checkPatentExpiry(currentTick: number): void {
    for (const [patentId, patent] of this.state.patents) {
      if (patent.status === ('Active' as unknown as PatentStatus) && 
          currentTick >= patent.expiresAt) {
        patent.status = 'Expired' as unknown as PatentStatus;
        this.state.patents.set(patentId, patent);
        console.log(`[ResearchService] Patent expired: ${patentId}`);
      }
    }
  }

  /**
   * 授权专利给其他公司
   */
  grantLicense(patentId: string, licenseeId: string): boolean {
    const patent = this.state.patents.get(patentId);
    if (!patent || patent.status !== ('Active' as unknown as PatentStatus)) {
      return false;
    }

    if (!patent.licensees.includes(licenseeId)) {
      patent.licensees.push(licenseeId);
      this.state.patents.set(patentId, patent);
      console.log(`[ResearchService] License granted: ${patentId} to ${licenseeId}`);
    }
    return true;
  }

  /**
   * 检查公司是否可以使用某技术
   */
  canUseTechnology(technologyId: string, companyId: string, currentTick: number): boolean {
    const technology = this.state.technologies.get(technologyId);
    if (!technology) {
      return false;
    }

    // 检查专利
    const patent = Array.from(this.state.patents.values())
      .find(p => p.technologyId === technologyId);

    if (!patent) {
      return true; // 没有专利，公开技术
    }

    if (patent.status === ('Expired' as unknown as PatentStatus)) {
      return true; // 专利已过期
    }

    if (currentTick >= patent.expiresAt) {
      return true; // 专利已过期
    }

    // 检查是否是专利持有者或获得授权
    return patent.holderId === companyId || patent.licensees.includes(companyId);
  }
}

// 导出单例
export const researchService = new ResearchService();