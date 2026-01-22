/**
 * 公司/实体信息映射表
 * 用于客户端UI显示公司名称、图标、颜色等信息
 * 支持：玩家公司、AI竞争对手、POPs（人口群体消费者）
 */

import { AI_COMPANIES_CONFIG, type AICompanyConfig } from './ai-companies.js';
import { POP_GROUPS } from './popsConfig.js';
import { AIPersonality } from '../types/company.js';

/** 实体类型（公司或人口群体） */
export type CompanyCategory = 'player' | 'ai_competitor' | 'pop_consumer';

/** 公司信息（用于UI显示） */
export interface CompanyInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  icon: string;
  personality: AIPersonality | null;
  category: CompanyCategory;
  description: string;
}

/** 玩家公司信息 */
const PLAYER_COMPANY: CompanyInfo = {
  id: 'player-company-1',
  name: '玩家公司',
  shortName: '玩家',
  color: '#10b981',  // 绿色
  icon: '🏢',
  personality: null,
  category: 'player',
  description: '你的商业帝国',
};

/** 将AI公司配置转换为CompanyInfo */
function configToCompanyInfo(config: AICompanyConfig): CompanyInfo {
  // 生成短名称（取前2-3个字符）
  const shortName = config.name.length <= 4 
    ? config.name 
    : config.name.substring(0, 2);
  
  return {
    id: config.id,
    name: config.name,
    shortName,
    color: config.color,
    icon: config.icon,
    personality: config.personality,
    category: 'ai_competitor',
    description: config.llmPrompt,
  };
}

/** 公司信息缓存Map */
const companyInfoCache: Map<string, CompanyInfo> = new Map();

/** POPs（人口群体）的颜色和图标配置 */
const POP_DISPLAY_CONFIG: Record<string, { color: string; icon: string }> = {
  'working-class': { color: '#f97316', icon: '👷' },    // 橙色 - 工薪阶层
  'middle-class': { color: '#8b5cf6', icon: '👔' },     // 紫色 - 中产阶级
  'wealthy-class': { color: '#eab308', icon: '💎' },    // 金色 - 富裕阶层
};

/** 初始化缓存 */
function initializeCache(): void {
  if (companyInfoCache.size > 0) return;
  
  // 添加玩家公司
  companyInfoCache.set(PLAYER_COMPANY.id, PLAYER_COMPANY);
  
  // 添加所有AI公司
  for (const config of AI_COMPANIES_CONFIG) {
    companyInfoCache.set(config.id, configToCompanyInfo(config));
  }
  
  // 添加POPs（人口群体）作为消费者实体
  for (const popGroup of POP_GROUPS) {
    const popId = `pop-${popGroup.id}`;
    const displayConfig = POP_DISPLAY_CONFIG[popGroup.id] || { color: '#94a3b8', icon: '👥' };
    
    companyInfoCache.set(popId, {
      id: popId,
      name: popGroup.nameZh,
      shortName: popGroup.nameZh.substring(0, 2),
      color: displayConfig.color,
      icon: displayConfig.icon,
      personality: null,
      category: 'pop_consumer',
      description: `${popGroup.nameZh} - 城市消费者群体`,
    });
  }
}

/**
 * 获取公司/实体信息
 * @param companyId 公司ID或POPs ID（如 pop-wealthy-class）
 * @returns 实体信息，如果未找到则返回默认信息
 */
export function getCompanyInfo(companyId: string): CompanyInfo {
  initializeCache();
  
  // 优先从缓存获取（包含玩家、AI公司和POPs）
  const cached = companyInfoCache.get(companyId);
  if (cached) return cached;
  
  // 检查是否是未缓存的POPs格式（pop-xxx）
  if (companyId.startsWith('pop-')) {
    const popName = companyId.replace('pop-', '');
    return {
      id: companyId,
      name: popName,
      shortName: '消费',
      color: '#94a3b8',
      icon: '👥',
      personality: null,
      category: 'pop_consumer',
      description: '城市消费者群体',
    };
  }
  
  // 未知公司（不应该发生，所有公司都应该在配置中定义）
  console.warn(`Unknown company ID: ${companyId}`);
  return {
    id: companyId,
    name: companyId,
    shortName: companyId.substring(0, 4),
    color: '#71717a',
    icon: '❓',
    personality: null,
    category: 'ai_competitor',
    description: '未知公司',
  };
}

/**
 * 获取所有AI竞争对手公司信息
 */
export function getAllAICompanies(): CompanyInfo[] {
  initializeCache();
  return Array.from(companyInfoCache.values())
    .filter(c => c.category === 'ai_competitor');
}

/**
 * 获取公司显示名称
 * @param companyId 公司ID
 * @param useShort 是否使用短名称
 */
export function getCompanyDisplayName(companyId: string, useShort: boolean = false): string {
  const info = getCompanyInfo(companyId);
  return useShort ? info.shortName : info.name;
}

/**
 * 获取公司颜色
 * @param companyId 公司ID
 */
export function getCompanyColor(companyId: string): string {
  return getCompanyInfo(companyId).color;
}

/**
 * 获取公司图标
 * @param companyId 公司ID
 */
export function getCompanyIcon(companyId: string): string {
  return getCompanyInfo(companyId).icon;
}

/**
 * 判断是否为AI竞争对手
 * @param companyId 公司ID
 */
export function isAICompetitor(companyId: string): boolean {
  return getCompanyInfo(companyId).category === 'ai_competitor';
}

/**
 * 判断是否为玩家公司
 * @param companyId 公司ID
 */
export function isPlayerCompany(companyId: string): boolean {
  return getCompanyInfo(companyId).category === 'player';
}

/**
 * 判断是否为POPs消费者群体
 * @param entityId 实体ID
 */
export function isPOPConsumer(entityId: string): boolean {
  return getCompanyInfo(entityId).category === 'pop_consumer';
}

/**
 * 获取人格类型的中文名称
 */
export function getPersonalityName(personality: AIPersonality | null): string {
  if (!personality) return '无';
  
  const names: Record<AIPersonality, string> = {
    [AIPersonality.Monopolist]: '垄断者',
    [AIPersonality.OldMoney]: '旧日贵族',
    [AIPersonality.TrendSurfer]: '趋势追逐者',
    [AIPersonality.Innovator]: '创新者',
    [AIPersonality.CostLeader]: '成本领袖',
  };
  
  return names[personality] ?? personality;
}

/**
 * 获取人格类型的描述
 */
export function getPersonalityDescription(personality: AIPersonality | null): string {
  if (!personality) return '';
  
  const descriptions: Record<AIPersonality, string> = {
    [AIPersonality.Monopolist]: '激进扩张，打压竞争对手，追求市场控制',
    [AIPersonality.OldMoney]: '保守稳健，注重信誉和质量，维持高端定位',
    [AIPersonality.TrendSurfer]: '紧跟市场热点，快速切换产品线',
    [AIPersonality.Innovator]: '专注研发和创新，追求技术领先',
    [AIPersonality.CostLeader]: '低成本运营，薄利多销，价格竞争力强',
  };
  
  return descriptions[personality] ?? '';
}

/** 导出人格枚举以便使用 */
export { AIPersonality };