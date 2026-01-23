/**
 * CompetitorPanel - AI竞争对手面板
 * 显示所有AI公司列表和关系状态
 */

import { useState } from 'react';
import { useGameStore, type AICompanyClient, type CompetitionEventClient } from '../../stores';
import { formatGameTime } from '../../utils/formatters';

/** 人格类型中文映射 */
const personalityLabels: Record<string, { label: string; desc: string }> = {
  monopolist: { label: '垄断者', desc: '激进、贪婪，追求市场垄断' },
  trend_surfer: { label: '潮流追逐者', desc: '敏感、多变，追逐市场热点' },
  old_money: { label: '老派贵族', desc: '保守、稳健，注重声誉' },
  innovator: { label: '创新者', desc: '有远见，追求技术突破' },
  cost_leader: { label: '成本领导者', desc: '效率至上，极致压缩成本' },
};

/** 关系等级 */
function getRelationshipLevel(trust: number, hostility: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (hostility > 70) {
    return { label: '敌对', color: 'text-red-400', bg: 'bg-red-500/20' };
  }
  if (hostility > 40) {
    return { label: '紧张', color: 'text-orange-400', bg: 'bg-orange-500/20' };
  }
  if (trust > 50) {
    return { label: '友好', color: 'text-green-400', bg: 'bg-green-500/20' };
  }
  if (trust > 20) {
    return { label: '合作', color: 'text-blue-400', bg: 'bg-blue-500/20' };
  }
  return { label: '中立', color: 'text-gray-400', bg: 'bg-gray-500/20' };
}

/** 格式化金额 */
function formatCash(amount: number | undefined | null): string {
  // Handle undefined, null, or NaN values
  if (amount === undefined || amount === null || !Number.isFinite(amount)) {
    return '¥0';
  }
  if (amount >= 100000000) {
    return `¥${(amount / 100000000).toFixed(1)}亿`;
  }
  if (amount >= 10000) {
    return `¥${Math.round(amount / 10000)}万`;
  }
  return `¥${amount}`;
}

/** 单个AI公司行 - 紧凑列表样式 */
function CompetitorRow({ company, isExpanded, onToggle }: {
  company: AICompanyClient;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const personality = personalityLabels[company.personality] ?? { label: '未知', desc: '' };
  const relationship = getRelationshipLevel(company.trustWithPlayer, company.hostilityToPlayer);
  
  return (
    <div
      className="border-l-2 hover:bg-slate-700/30 transition-colors"
      style={{ borderLeftColor: company.color }}
    >
      {/* 主行 - 点击展开/收起 */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
        onClick={onToggle}
      >
        {/* 图标 */}
        <span className="text-base">{company.icon}</span>
        {/* 名称 */}
        <span className="text-sm text-white font-medium flex-1 truncate">{company.name}</span>
        {/* 人格 */}
        <span className="text-[10px] text-gray-500 hidden sm:block">{personality.label}</span>
        {/* 关系 */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${relationship.bg} ${relationship.color}`}>
          {relationship.label}
        </span>
        {/* 资金 */}
        <span className="text-xs text-green-400 font-mono w-16 text-right">{formatCash(company.cash)}</span>
        {/* 展开指示器 */}
        <span className="text-gray-500 text-xs">{isExpanded ? '▼' : '▶'}</span>
      </div>
      
      {/* 展开详情 */}
      {isExpanded && (
        <div className="bg-slate-800/50 px-3 py-2 border-t border-slate-700/50">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">建筑</span>
              <span className="text-blue-400">{company.buildingCount}座</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">信任</span>
              <span className={company.trustWithPlayer > 0 ? 'text-green-400' : 'text-red-400'}>
                {company.trustWithPlayer}
              </span>
            </div>
          </div>
          {/* 关系条 */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-green-500"
                style={{ width: `${Math.max(0, (company.trustWithPlayer + 100) / 2)}%` }}
              />
            </div>
            <div
              className="h-1 bg-red-500 rounded-full"
              style={{ width: `${company.hostilityToPlayer / 2}%`, minWidth: company.hostilityToPlayer > 0 ? '2px' : '0' }}
            />
          </div>
          {company.recentAction && (
            <div className="text-[10px] text-gray-400 mt-1 truncate">
              {company.recentAction}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 格式化竞争事件时间 - 使用共享格式化函数 */
function formatEventTime(tick: number): string {
  return formatGameTime(tick, 'full');
}

/** 历史消息面板 - 只显示LLM战略决策 */
function HistoryPanel({
  isOpen,
  onClose,
  events
}: {
  isOpen: boolean;
  onClose: () => void;
  events: CompetitionEventClient[];
}) {
  if (!isOpen) return null;
  
  // 只筛选战略变更事件
  const strategyEvents = events.filter(e => e.type === 'strategy_change');
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div className="text-white font-medium">AI战略决策记录</div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {strategyEvents.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">🤖</div>
              <div>等待AI生成战略决策...</div>
            </div>
          ) : (
            strategyEvents.map((event) => (
              <div
                key={event.id}
                className={`p-3 rounded-lg border ${
                  event.severity === 'major'
                    ? 'bg-red-500/10 border-red-500/30'
                    : event.severity === 'moderate'
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-green-500/10 border-green-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-white">{event.companyName}</div>
                    <div className="text-xs text-gray-400 mt-1">{event.description}</div>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {formatEventTime(event.tick)}
                  </div>
                </div>
                {/* 显示LLM生成的战略理由 */}
                {(event as CompetitionEventClient & { reasoning?: string }).reasoning && (
                  <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-gray-300 italic">
                    "{(event as CompetitionEventClient & { reasoning?: string }).reasoning}"
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {/* 底部 */}
        <div className="border-t border-slate-700 p-4 text-center text-xs text-gray-500">
          共 {strategyEvents.length} 条AI战略记录
        </div>
      </div>
    </div>
  );
}

export function CompetitorPanel() {
  const aiCompanies = useGameStore((state) => state.aiCompanies);
  const recentCompetitionEvents = useGameStore((state) => state.recentCompetitionEvents);
  
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // 只使用实时的竞争事件（已经在gameStore中累积）
  // 筛选出战略变更事件用于计数
  const strategyEvents = recentCompetitionEvents.filter(e => e.type === 'strategy_change');
  
  // 按资金排序
  const sortedCompanies = [...aiCompanies].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0));
  
  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
      {/* 标题 */}
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏢</span>
          <div>
            <div className="text-white font-medium text-sm">AI竞争对手</div>
            <div className="text-[10px] text-gray-400">{aiCompanies.length} 家公司 · 点击展开详情</div>
          </div>
        </div>
      </div>
      
      {/* 公司列表 - 紧凑表格风格 */}
      <div className="flex-1 overflow-y-auto">
        {/* 表头 */}
        <div className="sticky top-0 bg-slate-800 px-2 py-1 text-[10px] text-gray-500 flex items-center gap-2 border-b border-slate-700">
          <span className="w-5"></span>
          <span className="flex-1">公司</span>
          <span className="hidden sm:block w-14">人格</span>
          <span className="w-10">关系</span>
          <span className="w-16 text-right">资金</span>
          <span className="w-4"></span>
        </div>
        
        {aiCompanies.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-2xl mb-1">🏗️</div>
            <div className="text-xs">正在加载...</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {sortedCompanies.map((company) => (
              <CompetitorRow
                key={company.id}
                company={company}
                isExpanded={expandedId === company.id}
                onToggle={() => setExpandedId(expandedId === company.id ? null : company.id)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* 竞争动态 */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            最近竞争动态
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            <span>🤖 AI战略记录</span>
            <span className="bg-blue-500/20 px-1.5 py-0.5 rounded">
              {strategyEvents.length}
            </span>
          </button>
        </div>
        
        {recentCompetitionEvents.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recentCompetitionEvents.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className={`text-xs p-2 rounded ${
                  event.severity === 'major' ? 'bg-red-500/10 text-red-300' :
                  event.severity === 'moderate' ? 'bg-orange-500/10 text-orange-300' :
                  'bg-slate-700/50 text-gray-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium flex-1">{event.title}</div>
                  <div className="text-gray-500 text-[10px] whitespace-nowrap">
                    {formatEventTime(event.tick)}
                  </div>
                </div>
                <div className="text-gray-500 mt-0.5">{event.description}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 text-center py-4">
            暂无竞争动态
          </div>
        )}
      </div>
      
      {/* 历史面板 - 只显示战略事件 */}
      <HistoryPanel
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        events={recentCompetitionEvents}
      />
    </div>
  );
}