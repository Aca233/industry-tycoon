/**
 * ResearchLab - LLM-driven Research Laboratory UI
 * Phase 18: Technology Research System
 * 
 * Features:
 * - Natural language technology concept input
 * - Real-time LLM keyword analysis
 * - Project management (evaluate, start, invest)
 * - Technology blueprint display
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../stores';
import { api } from '../../api';

// Types for research data
interface ResearchProject {
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
    prerequisites?: string[];
    risks?: string[];
    keywordAnalysis?: string[];
    estimatedCost?: number;
    estimatedTicks?: number;
  };
  startedAt?: number;
  completedAt?: number;
}

interface Technology {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  category: string;
  tier: number;
  isLLMGenerated: boolean;
  patentHolderId?: string;
  isOwned?: boolean;
  canUse?: boolean;
  sideEffectCount?: number;
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
}

// Selected technology detail modal state
interface TechDetailModal {
  isOpen: boolean;
  technology: Technology | null;
}

// Technology effects summary
interface TechEffectsSummary {
  totalTechnologies: number;
  globalEfficiencyBonus: number;
  totalUnlockedMethods: number;
  modifiersByType: Record<string, number>;
}

interface ActiveTech {
  id: string;
  name: string;
  activatedAt: number;
  modifierCount: number;
  unlockedMethodCount: number;
}

// Risk level colors
const RISK_COLORS: Record<string, string> = {
  minimal: 'text-green-400 bg-green-500/20',
  low: 'text-lime-400 bg-lime-500/20',
  moderate: 'text-yellow-400 bg-yellow-500/20',
  high: 'text-orange-400 bg-orange-500/20',
  extreme: 'text-red-400 bg-red-500/20',
};

// Category icons
const CATEGORY_ICONS: Record<string, string> = {
  manufacturing: '🏭',
  materials: '🧱',
  energy: '⚡',
  computing: '💻',
  biotech: '🧬',
  logistics: '🚛',
  marketing: '📢',
  finance: '💰',
};

export function ResearchLab() {
  const gameId = useGameStore((state) => state.gameId);
  const playerCash = useGameStore((state) => state.playerCompany?.cash ?? 0);
  
  // Concept input state
  const [conceptName, setConceptName] = useState('');
  const [conceptDescription, setConceptDescription] = useState('');
  const [targetOutcome, setTargetOutcome] = useState('');
  const [constraints, setConstraints] = useState('');
  
  // UI state
  const [activeTab, setActiveTab] = useState<'concept' | 'projects' | 'technologies' | 'effects'>('concept');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  
  // Data state
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [techDetail, setTechDetail] = useState<TechDetailModal>({ isOpen: false, technology: null });
  const [effectsSummary, setEffectsSummary] = useState<TechEffectsSummary | null>(null);
  const [activeTechs, setActiveTechs] = useState<ActiveTech[]>([]);
  
  // Real-time keyword analysis (simulated LLM streaming)
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  
  // Load projects and technologies
  const loadData = useCallback(async () => {
    if (!gameId) return;
    
    try {
      const [projectsResult, techResult, effectsResult] = await Promise.all([
        api.getResearchProjects(gameId),
        api.getTechnologies(gameId),
        api.getTechnologyEffectsSummary(gameId),
      ]);
      
      if (projectsResult.data) {
        setProjects(projectsResult.data.projects as ResearchProject[]);
      }
      if (techResult.data) {
        setTechnologies(techResult.data.technologies as Technology[]);
      }
      if (effectsResult.data && effectsResult.data.success) {
        setEffectsSummary(effectsResult.data.summary);
        setActiveTechs(effectsResult.data.activeTechnologies);
      }
    } catch (err) {
      console.error('Failed to load research data:', err);
    }
  }, [gameId]);
  
  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Load only projects (faster, no technologies)
  const loadProjectsOnly = useCallback(async () => {
    if (!gameId) return;
    
    try {
      const projectsResult = await api.getResearchProjects(gameId);
      if (projectsResult.data) {
        setProjects(projectsResult.data.projects as ResearchProject[]);
      }
    } catch (err) {
      console.error('Failed to load research projects:', err);
    }
  }, [gameId]);
  
  // Poll for updates every 5 seconds when there are active projects
  useEffect(() => {
    const hasActiveProjects = projects.some(p => p.status === 'active');
    
    if (!hasActiveProjects || !gameId) return;
    
    const interval = setInterval(() => {
      loadProjectsOnly();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [projects, gameId, loadProjectsOnly]);
  
  // Simulate real-time keyword extraction as user types
  useEffect(() => {
    const description = conceptDescription.toLowerCase();
    const keywords: string[] = [];
    
    // Extract technology-related keywords
    const techKeywords = [
      { pattern: /廉价|低成本|便宜/g, tag: '成本: 低' },
      { pattern: /高效|效率/g, tag: '效率: 高' },
      { pattern: /环保|绿色|可持续/g, tag: '环保: 是' },
      { pattern: /核|放射性|辐射/g, tag: '风险: 高' },
      { pattern: /生物|基因|细胞/g, tag: '类型: 生物技术' },
      { pattern: /能源|电力|发电/g, tag: '类型: 能源' },
      { pattern: /自动|机器人|AI/g, tag: '类型: 自动化' },
      { pattern: /纳米|微米|精密/g, tag: '精度: 高' },
      { pattern: /快速|高速|极速/g, tag: '速度: 快' },
      { pattern: /海藻|草本|植物/g, tag: '来源: 自然' },
      { pattern: /合成|人工|化学/g, tag: '来源: 合成' },
    ];
    
    for (const { pattern, tag } of techKeywords) {
      if (pattern.test(description)) {
        keywords.push(tag);
      }
    }
    
    setExtractedKeywords(keywords);
  }, [conceptDescription]);
  
  // Create concept
  const handleCreateConcept = async () => {
    if (!gameId || !conceptName.trim() || !conceptDescription.trim()) {
      setError('请填写项目名称和描述');
      return;
    }
    
    // Validate description length (minimum 10 characters)
    if (conceptDescription.trim().length < 10) {
      setError('描述太短，请至少输入10个字符来详细说明您的研发概念');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await api.createResearchConcept(gameId, {
        name: conceptName.trim(),
        description: conceptDescription.trim(),
        targetOutcome: targetOutcome.trim() || undefined,
        constraints: constraints.trim() ? constraints.split('\n').filter(c => c.trim()) : undefined,
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Clear form and reload
      setConceptName('');
      setConceptDescription('');
      setTargetOutcome('');
      setConstraints('');
      setExtractedKeywords([]);
      
      await loadData();
      setActiveTab('projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建概念失败');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Evaluate project
  const handleEvaluate = async (projectId: string) => {
    if (!gameId) return;
    
    setIsEvaluating(true);
    setError(null);
    
    try {
      const result = await api.evaluateResearchProject(gameId, projectId);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      await loadData();
      
      // Update selected project with evaluation
      const updated = projects.find(p => p.id === projectId);
      if (updated) {
        setSelectedProject({
          ...updated,
          feasibility: result.data.feasibility as ResearchProject['feasibility'],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '评估失败');
    } finally {
      setIsEvaluating(false);
    }
  };
  
  // Start project
  const handleStart = async (projectId: string) => {
    if (!gameId) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await api.startResearchProject(gameId, projectId);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动项目失败');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Invest in project
  const handleInvest = async (projectId: string, amount: number) => {
    if (!gameId) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await api.investInResearch(gameId, projectId, amount);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '投资失败');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Format money
  const formatMoney = (amount: number | undefined | null): string => {
    // Handle undefined, null, or NaN values
    if (amount === undefined || amount === null || !Number.isFinite(amount)) {
      return '$0';
    }
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;
    return `$${amount.toFixed(0)}`;
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center">
            <span className="text-white text-lg">🔬</span>
          </div>
          <div>
            <div className="text-white font-medium text-sm">概念实验室</div>
            <div className="text-xs text-gray-400">LLM驱动的科技研发</div>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          预算: <span className="text-green-400">{formatMoney(playerCash)}</span>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('concept')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'concept'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          💡 新概念
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'projects'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📋 研发项目
          {projects.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full text-xs flex items-center justify-center text-white">
              {projects.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('technologies')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'technologies'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          🧪 已发明技术
          {technologies.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full text-xs flex items-center justify-center text-white">
              {technologies.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('effects')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'effects'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          ⚡ 技术效果
          {activeTechs.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full text-xs flex items-center justify-center text-white">
              {activeTechs.length}
            </span>
          )}
        </button>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Concept Tab */}
        {activeTab === 'concept' && (
          <div className="space-y-4">
            {/* Concept Input */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <span className="text-xl">✨</span>
                定义你的发明
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">项目名称</label>
                  <input
                    type="text"
                    value={conceptName}
                    onChange={(e) => setConceptName(e.target.value)}
                    placeholder="例如：蓝藻生物燃料工艺"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    描述你想要发明的技术 <span className="text-purple-400">（自然语言，尽量具体）</span>
                  </label>
                  <textarea
                    value={conceptDescription}
                    onChange={(e) => setConceptDescription(e.target.value)}
                    placeholder="我想研发一种基于海藻的生物燃料，用来替代石油，成本必须比石油低，但可以接受发电效率稍微低一点..."
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">期望成果（可选）</label>
                  <input
                    type="text"
                    value={targetOutcome}
                    onChange={(e) => setTargetOutcome(e.target.value)}
                    placeholder="例如：新的发电方式、降低生产成本50%"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">约束条件（可选，每行一条）</label>
                  <textarea
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    placeholder="不能使用稀土材料&#10;必须符合环保法规&#10;..."
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
              </div>
            </div>
            
            {/* Real-time Keyword Analysis */}
            {extractedKeywords.length > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-4 border border-purple-500/30">
                <h4 className="text-xs text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="animate-pulse">●</span>
                  AI 实时分析
                </h4>
                <div className="flex flex-wrap gap-2">
                  {extractedKeywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-purple-500/20 border border-purple-500/50 rounded text-purple-300 text-xs"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Warning about vague descriptions */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-yellow-400">⚠️</span>
                <div className="text-yellow-200/80">
                  <strong>灯神诅咒警告：</strong>描述越模糊，AI生成的技术可能带有更多意想不到的副作用。
                  请尽量详细描述你的需求和约束条件。
                </div>
              </div>
            </div>
            
            {/* Submit Button */}
            <button
              onClick={handleCreateConcept}
              disabled={isSubmitting || !conceptName.trim() || !conceptDescription.trim()}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  提交中...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  提交研发概念
                </>
              )}
            </button>
          </div>
        )}
        
        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            {projects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <span className="text-4xl mb-3 block">📭</span>
                <p>暂无研发项目</p>
                <p className="text-sm mt-1">在"新概念"标签页创建你的第一个研发项目</p>
              </div>
            ) : (
              projects.map((project) => {
                // Safety check for undefined concept
                const conceptName = project.concept?.name ?? '未命名项目';
                const conceptDescription = project.concept?.description ?? '';
                
                return (
                <div
                  key={project.id}
                  className={`bg-slate-800 rounded-lg p-4 border transition-colors cursor-pointer ${
                    selectedProject?.id === project.id
                      ? 'border-purple-500'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-white font-medium">{conceptName}</h4>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {conceptDescription}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        project.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : project.status === 'completed'
                          ? 'bg-blue-500/20 text-blue-400'
                          : project.status === 'planning'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {project.status === 'active' ? '研发中' :
                       project.status === 'completed' ? '已完成' :
                       project.status === 'planning' ? '规划中' :
                       project.status}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  {project.status === 'active' && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>研发进度</span>
                        <span>{project.progress.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>已投入: {formatMoney(project.investedFunds)}</span>
                        <span>目标: {formatMoney(project.targetCost)}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Feasibility (if evaluated) */}
                  {project.feasibility && (
                    <div className="mt-3 p-2 bg-slate-900/50 rounded">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-400">可行性:</span>
                        <span className={`font-medium ${
                          project.feasibility.score >= 70 ? 'text-green-400' :
                          project.feasibility.score >= 40 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {project.feasibility.score}分
                        </span>
                        <span className={`px-2 py-0.5 rounded ${RISK_COLORS[project.feasibility.riskLevel] || 'text-gray-400'}`}>
                          {project.feasibility.riskLevel}风险
                        </span>
                      </div>
                      {project.feasibility.scientistComment && (
                        <p className="text-xs text-gray-400 mt-2 italic">
                          "{project.feasibility.scientistComment}"
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="mt-3 flex gap-2">
                    {project.status === 'planning' && !project.feasibility && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEvaluate(project.id); }}
                        disabled={isEvaluating}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 text-white text-sm rounded transition-colors"
                      >
                        {isEvaluating ? '评估中...' : '🔍 AI评估可行性'}
                      </button>
                    )}
                    {project.status === 'planning' && project.feasibility && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStart(project.id); }}
                        disabled={isSubmitting}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white text-sm rounded transition-colors"
                      >
                        {isSubmitting ? '启动中...' : '▶️ 开始研发'}
                      </button>
                    )}
                    {project.status === 'active' && (
                        (() => {
                          const remaining = Math.max(0, project.targetCost - project.investedFunds);
                          const investAmount = Math.min(10000000, remaining);
                          const canInvest = remaining > 0 && playerCash >= investAmount;
                          return (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleInvest(project.id, investAmount); }}
                              disabled={isSubmitting || !canInvest}
                              className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white text-sm rounded transition-colors"
                            >
                              {remaining <= 0
                                ? '✅ 资金充足'
                                : `💰 追加投资 ${formatMoney(investAmount)}`}
                            </button>
                          );
                        })()
                      )}
                  </div>
                </div>
              );})
            )}
          </div>
        )}
        
        {/* Technologies Tab */}
        {activeTab === 'technologies' && (
          <div className="space-y-4">
            {technologies.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <span className="text-4xl mb-3 block">🔮</span>
                <p>暂无已发明技术</p>
                <p className="text-sm mt-1">完成研发项目后，技术将显示在这里</p>
              </div>
            ) : (
              technologies.map((tech) => (
                <div
                  key={tech.id}
                  className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-purple-500 transition-colors cursor-pointer"
                  onClick={() => setTechDetail({ isOpen: true, technology: tech })}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{CATEGORY_ICONS[tech.category?.toLowerCase()] || '🔬'}</span>
                      <div>
                        <h4 className="text-white font-medium">{tech.nameZh}</h4>
                        <p className="text-xs text-gray-500">{tech.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tech.isOwned && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
                          已拥有
                        </span>
                      )}
                      {tech.isLLMGenerated && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                          AI发明
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-slate-700 text-gray-300 text-xs rounded">
                        Tier {tech.tier}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">{tech.description}</p>
                  
                  {/* Quick stats */}
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    {tech.sideEffectCount !== undefined && tech.sideEffectCount > 0 && (
                      <span className="text-red-400">⚠️ {tech.sideEffectCount}个副作用</span>
                    )}
                    {!tech.canUse && !tech.isOwned && (
                      <span className="text-yellow-400">🔒 需要授权</span>
                    )}
                    <span className="text-gray-500">点击查看详情 →</span>
                  </div>
                  
                  {/* Patent Info */}
                  {tech.patentHolderId && (
                    <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                      <span>📜</span>
                      <span>专利保护中</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Effects Tab */}
        {activeTab === 'effects' && (
          <div className="space-y-4">
            {/* Effects Summary Card */}
            {effectsSummary ? (
              <div className="bg-gradient-to-br from-cyan-900/30 to-purple-900/30 rounded-lg p-4 border border-cyan-500/30">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  技术效果总览
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">激活技术</div>
                    <div className="text-2xl font-bold text-cyan-400">
                      {effectsSummary.totalTechnologies}
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">全局效率加成</div>
                    <div className="text-2xl font-bold text-green-400">
                      +{(effectsSummary.globalEfficiencyBonus * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">解锁生产方式</div>
                    <div className="text-2xl font-bold text-purple-400">
                      {effectsSummary.totalUnlockedMethods}
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">效果类型</div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {Object.keys(effectsSummary.modifiersByType).length}
                    </div>
                  </div>
                </div>
                
                {/* Modifiers by Type */}
                {Object.keys(effectsSummary.modifiersByType).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">效果明细</h4>
                    <div className="space-y-2">
                      {Object.entries(effectsSummary.modifiersByType).map(([type, value]) => {
                        // 效果类型名称映射
                        const getTypeName = (t: string): string => {
                          const typeMap: Record<string, string> = {
                            'efficiency_boost': '⚡ 效率提升',
                            'cost_reduction': '💰 成本降低',
                            'output_increase': '📈 产出增加',
                            'input_reduction': '📉 投入减少',
                          };
                          return typeMap[t] ?? `📊 ${t}`;
                        };
                        
                        return (
                          <div key={type} className="flex justify-between items-center bg-slate-800/50 rounded px-3 py-2">
                            <span className="text-gray-300 text-sm flex-shrink-0">
                              {getTypeName(type)}
                            </span>
                            <span className={`font-medium flex-shrink-0 ml-2 ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {value > 0 ? '+' : ''}{(value * 100).toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl mb-3 block">🔮</span>
                <p>暂无激活的技术效果</p>
                <p className="text-sm mt-1">完成研发项目后，技术效果将自动激活</p>
              </div>
            )}
            
            {/* Active Technologies List */}
            {activeTechs.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  已激活技术
                </h3>
                
                <div className="space-y-2">
                  {activeTechs.map((tech) => (
                    <div
                      key={tech.id}
                      className="bg-slate-900/50 rounded p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-white font-medium">{tech.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          激活于 Tick {tech.activatedAt}
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded">
                          {tech.modifierCount} 修饰符
                        </span>
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                          {tech.unlockedMethodCount} 新方法
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Effect Explanation */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <span>💡</span>
                效果说明
              </h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• <strong className="text-cyan-400">效率提升</strong>: 建筑生产速度提高</li>
                <li>• <strong className="text-green-400">成本降低</strong>: 维护费用减少</li>
                <li>• <strong className="text-purple-400">产出增加</strong>: 每次生产周期产量提升</li>
                <li>• <strong className="text-yellow-400">投入减少</strong>: 原料消耗降低</li>
              </ul>
            </div>
          </div>
        )}
        
        {/* Technology Detail Modal */}
        {techDetail.isOpen && techDetail.technology && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setTechDetail({ isOpen: false, technology: null })}>
            <div className="bg-slate-800 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto border border-purple-500/50" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{CATEGORY_ICONS[techDetail.technology.category?.toLowerCase()] || '🔬'}</span>
                  <div>
                    <h3 className="text-white font-bold text-lg">{techDetail.technology.nameZh}</h3>
                    <p className="text-sm text-gray-400">{techDetail.technology.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setTechDetail({ isOpen: false, technology: null })}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
              
              {/* Category and Tier */}
              <div className="flex gap-2 mb-4">
                <span className="px-2 py-1 bg-slate-700 text-gray-300 text-xs rounded">
                  {techDetail.technology.category}
                </span>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                  Tier {techDetail.technology.tier}
                </span>
                {techDetail.technology.isLLMGenerated && (
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                    AI发明
                  </span>
                )}
              </div>
              
              {/* Description */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-1">描述</h4>
                <p className="text-gray-400 text-sm">{techDetail.technology.description}</p>
              </div>
              
              {/* Unlocked Methods */}
              {techDetail.technology.unlockedMethods && techDetail.technology.unlockedMethods.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-green-400 mb-2">🔓 解锁的生产方式</h4>
                  <div className="space-y-2">
                    {techDetail.technology.unlockedMethods.map((method, idx) => (
                      <div key={idx} className="bg-green-500/10 border border-green-500/30 rounded p-2 text-sm">
                        <span className="text-green-300">{method.methodId}</span>
                        {method.description && (
                          <p className="text-gray-400 text-xs mt-1">{method.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Global Modifiers */}
              {techDetail.technology.globalModifiers && techDetail.technology.globalModifiers.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-cyan-400 mb-2">📊 全局效果</h4>
                  <div className="space-y-2">
                    {techDetail.technology.globalModifiers.map((mod, idx) => (
                      <div key={idx} className="bg-cyan-500/10 border border-cyan-500/30 rounded p-2 text-sm flex justify-between">
                        <span className="text-cyan-300">{mod.type}</span>
                        <span className={mod.value > 0 ? 'text-green-400' : 'text-red-400'}>
                          {mod.value > 0 ? '+' : ''}{(mod.value * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Side Effects */}
              {techDetail.technology.sideEffects && techDetail.technology.sideEffects.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2">⚠️ 副作用</h4>
                  <div className="space-y-2">
                    {techDetail.technology.sideEffects.map((effect) => (
                      <div key={effect.id} className="bg-red-500/10 border border-red-500/30 rounded p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-red-300 text-sm">
                            {effect.revealed ? effect.name : '??? (尚未发现)'}
                          </span>
                          <span className="text-xs">
                            {effect.triggered ? (
                              <span className="text-red-400">❌ 已触发</span>
                            ) : effect.revealed ? (
                              <span className="text-yellow-400">⏳ 潜伏中</span>
                            ) : (
                              <span className="text-gray-500">🔒 未知</span>
                            )}
                          </span>
                        </div>
                        {effect.revealed && effect.description && (
                          <p className="text-gray-400 text-xs mt-1">{effect.description}</p>
                        )}
                        {effect.revealed && (
                          <div className="mt-1 text-xs">
                            <span className="text-gray-500">类型: {effect.type}</span>
                            <span className="mx-2">|</span>
                            <span className="text-red-400">严重度: {'⬤'.repeat(effect.severity)}{'○'.repeat(5 - effect.severity)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Patent Status */}
              {techDetail.technology.patentHolderId && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <span>📜</span>
                    <span>专利保护中</span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">
                    {techDetail.technology.isOwned ? '您拥有此技术的专利' : '需要获取授权才能使用'}
                  </p>
                </div>
              )}
              
              {/* Close button */}
              <button
                onClick={() => setTechDetail({ isOpen: false, technology: null })}
                className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}