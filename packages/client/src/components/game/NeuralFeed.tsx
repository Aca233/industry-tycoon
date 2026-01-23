/**
 * NeuralFeed - AI Assistant and News Feed panel
 * Right side panel with LLM chat and market news
 *
 * 性能优化：
 * - 使用 React.memo 包装子组件避免不必要的重渲染
 * - 使用 useMemo 缓存计算结果
 * - 使用 useCallback 缓存回调函数
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useGameStore, useChatMessages, useIsAssistantTyping } from '../../stores';
import { getCompanyInfo, isAICompetitor } from '@scc/shared';

// 类型配置移到组件外部避免每次渲染创建
const typeConfig: Record<string, { icon: string; color: string; bgColor: string }> = {
  'price_war_start': { icon: '💥', color: 'text-red-400', bgColor: 'bg-red-500/10' },
  'supply_block': { icon: '🚫', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  'market_entry': { icon: '🚀', color: 'text-green-400', bgColor: 'bg-green-500/10' },
  'expansion': { icon: '🏗️', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  'media_attack': { icon: '📢', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  'strategy_change': { icon: '🎯', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
};

// 新闻项组件
const NewsItem = memo(function NewsItem({ news }: { news: { id: string; headline: string } }) {
  // 根据标题中的emoji判断严重程度
  const isCritical = news.headline.startsWith('🚨');
  const isMajor = news.headline.startsWith('⚠️');
  const isModerate = news.headline.startsWith('📊');
  
  const colorClass = isCritical ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                    isMajor ? 'text-orange-400 bg-orange-500/10 border-orange-500/30' :
                    isModerate ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                    'text-cyan-300 bg-transparent border-transparent';
  
  return (
    <div
      className={`text-sm px-2 py-1 rounded border cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
    >
      {news.headline}
    </div>
  );
});

// 竞争事件项组件
const CompetitionEventItem = memo(function CompetitionEventItem({
  event
}: {
  event: {
    id: string;
    companyId: string;
    type: string;
    title: string;
    description: string;
    severity: string;
    reasoning?: string;
  }
}) {
  const companyInfo = getCompanyInfo(event.companyId);
  const isAI = isAICompetitor(event.companyId);
  
  const config = typeConfig[event.type] || { icon: '📋', color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
  
  // 严重程度样式
  const severityBorder = event.severity === 'major' ? 'border-l-red-500' :
                        event.severity === 'moderate' ? 'border-l-yellow-500' :
                        'border-l-gray-500';
  
  return (
    <div
      className={`${config.bgColor} rounded-lg p-2 border-l-2 ${severityBorder} hover:opacity-90 transition-opacity cursor-pointer`}
    >
      <div className="flex items-start gap-2">
        {/* 公司图标 */}
        <div className="flex-shrink-0">
          <span className="text-lg">{isAI ? companyInfo.icon : '🏢'}</span>
        </div>
        
        {/* 事件内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-xs font-medium truncate"
              style={{ color: isAI ? companyInfo.color : '#9ca3af' }}
            >
              {companyInfo.name}
            </span>
            <span className="text-xs">{config.icon}</span>
          </div>
          <div className={`text-xs ${config.color} font-medium mb-0.5`}>
            {event.title}
          </div>
          <div className="text-xs text-gray-400 line-clamp-2">
            {event.description}
          </div>
          {/* 战略理由（仅 strategy_change 类型显示） */}
          {event.type === 'strategy_change' && event.reasoning && (
            <div className="mt-1 text-xs text-purple-300/80 italic border-l border-purple-500/50 pl-2">
              💭 {event.reasoning}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// 聊天消息组件
const ChatMessage = memo(function ChatMessage({ message }: {
  message: { id: string; role: string; content: string; timestamp: number }
}) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          message.role === 'user'
            ? 'bg-cyan-600 text-white'
            : 'bg-slate-800 text-gray-200 border border-slate-700'
        }`}
      >
        {message.role === 'user' ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // 自定义渲染样式
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-cyan-300">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-cyan-300">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-cyan-300">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-gray-300">{children}</li>,
                strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                em: ({ children }) => <em className="italic text-cyan-200">{children}</em>,
                code: ({ children }) => (
                  <code className="bg-slate-700 px-1 py-0.5 rounded text-xs text-green-400">{children}</code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-slate-700 p-2 rounded my-2 overflow-x-auto text-xs">{children}</pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-cyan-500 pl-2 my-2 italic text-gray-400">{children}</blockquote>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{children}</a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        <p className="text-xs opacity-50 mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
});

export const NeuralFeed = memo(function NeuralFeed() {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const chatMessages = useChatMessages();
  const isTyping = useIsAssistantTyping();
  const sendMessage = useGameStore((state) => state.sendMessage);
  const newsItems = useGameStore((state) => state.newsItems);
  const recentMarketEvents = useGameStore((state) => state.recentMarketEvents);
  const recentCompetitionEvents = useGameStore((state) => state.recentCompetitionEvents);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, sendMessage]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  // 缓存快捷操作按钮回调
  const handleMarketAnalysis = useCallback(() => sendMessage('分析当前市场趋势'), [sendMessage]);
  const handleFactoryReport = useCallback(() => sendMessage('我最赚钱的工厂有哪些？'), [sendMessage]);
  const handleCompetitorInfo = useCallback(() => sendMessage('显示竞争对手动向'), [sendMessage]);

  // 缓存新闻列表
  const displayedNews = useMemo(() => newsItems.slice(0, 5), [newsItems]);
  const displayedCompetitionEvents = useMemo(() => recentCompetitionEvents.slice(0, 5), [recentCompetitionEvents]);

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* News ticker - 显示LLM生成的市场事件 */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-400 animate-pulse">●</span>
          <span className="text-xs text-gray-400 uppercase tracking-wide">实时动态</span>
          {recentMarketEvents.length > 0 && (
            <span className="text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">
              {recentMarketEvents.length}
            </span>
          )}
        </div>
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {newsItems.length === 0 ? (
            <div className="text-xs text-gray-500 italic">等待市场动态...</div>
          ) : (
            displayedNews.map((news) => (
              <NewsItem key={news.id} news={news} />
            ))
          )}
        </div>
      </div>

      {/* 商战情报 - 显示AI公司的竞争事件 */}
      {recentCompetitionEvents.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900/30 to-slate-800 border-b border-purple-600/30 px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-purple-400">⚔️</span>
            <span className="text-xs text-purple-300 uppercase tracking-wide font-medium">商战情报</span>
            <span className="text-xs bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded">
              {recentCompetitionEvents.length}
            </span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {displayedCompetitionEvents.map((event) => (
              <CompetitionEventItem key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Chat header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <span className="text-white text-sm">AI</span>
          </div>
          <div>
            <div className="text-white font-medium text-sm">AI 智能助手</div>
            <div className="text-xs text-green-400">在线</div>
          </div>
        </div>
        <button className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        
        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="px-4 py-2 border-t border-slate-700 flex gap-2 overflow-x-auto">
        <button
          onClick={handleMarketAnalysis}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs rounded-full whitespace-nowrap border border-slate-700"
        >
          📊 市场分析
        </button>
        <button
          onClick={handleFactoryReport}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs rounded-full whitespace-nowrap border border-slate-700"
        >
          🏭 工厂报告
        </button>
        <button
          onClick={handleCompetitorInfo}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs rounded-full whitespace-nowrap border border-slate-700"
        >
          🕵️ 竞争情报
        </button>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="向 AI 助手提问..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
});