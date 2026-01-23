/**
 * 盘口深度组件
 * 显示买卖五档挂单数据
 */

import React from 'react';
import type { Money } from '@scc/shared';

interface DepthLevel {
  price: Money;
  volume: number;
}

interface MarketDepthProps {
  stockId: string;
  ticker: string;
  currentPrice: Money;
  bids: DepthLevel[];  // 买单（出价）
  asks: DepthLevel[];  // 卖单（要价）
  className?: string;
}

export const MarketDepth: React.FC<MarketDepthProps> = ({
  ticker,
  currentPrice,
  bids,
  asks,
  className = '',
}) => {
  // 计算最大成交量用于条形图比例
  const maxVolume = Math.max(
    ...bids.map(b => b.volume),
    ...asks.map(a => a.volume),
    1
  );
  
  // 格式化价格
  const formatPrice = (price: Money) => `$${(price / 100).toFixed(2)}`;
  
  // 格式化成交量
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };
  
  // 填充到5档
  const paddedAsks = [...asks];
  while (paddedAsks.length < 5) {
    paddedAsks.push({ price: 0, volume: 0 });
  }
  
  const paddedBids = [...bids];
  while (paddedBids.length < 5) {
    paddedBids.push({ price: 0, volume: 0 });
  }
  
  // 卖单按价格降序排列（卖五在上）
  const sortedAsks = [...paddedAsks].reverse();
  
  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-sm font-medium">盘口 · {ticker}</span>
        <span className="text-cyan-400 font-mono text-sm">
          {formatPrice(currentPrice)}
        </span>
      </div>
      
      <div className="space-y-0.5">
        {/* 卖单（红色） */}
        {sortedAsks.map((ask, index) => (
          <div key={`ask-${index}`} className="relative flex items-center h-6 text-xs">
            {/* 背景条 */}
            {ask.volume > 0 && (
              <div
                className="absolute right-0 h-full bg-red-500/20"
                style={{ width: `${(ask.volume / maxVolume) * 100}%` }}
              />
            )}
            
            {/* 档位标签 */}
            <span className="w-8 text-slate-500 z-10">卖{5 - index}</span>
            
            {/* 价格 */}
            <span className={`flex-1 text-right font-mono z-10 ${
              ask.price > 0 ? 'text-red-400' : 'text-slate-600'
            }`}>
              {ask.price > 0 ? formatPrice(ask.price) : '--'}
            </span>
            
            {/* 数量 */}
            <span className={`w-16 text-right font-mono z-10 ${
              ask.volume > 0 ? 'text-slate-300' : 'text-slate-600'
            }`}>
              {ask.volume > 0 ? formatVolume(ask.volume) : '--'}
            </span>
          </div>
        ))}
        
        {/* 分隔线 - 当前价 */}
        <div className="flex items-center h-8 my-1 border-y border-slate-600/50">
          <span className="flex-1 text-center font-mono text-lg font-bold text-cyan-400">
            {formatPrice(currentPrice)}
          </span>
        </div>
        
        {/* 买单（绿色） */}
        {paddedBids.map((bid, index) => (
          <div key={`bid-${index}`} className="relative flex items-center h-6 text-xs">
            {/* 背景条 */}
            {bid.volume > 0 && (
              <div
                className="absolute right-0 h-full bg-green-500/20"
                style={{ width: `${(bid.volume / maxVolume) * 100}%` }}
              />
            )}
            
            {/* 档位标签 */}
            <span className="w-8 text-slate-500 z-10">买{index + 1}</span>
            
            {/* 价格 */}
            <span className={`flex-1 text-right font-mono z-10 ${
              bid.price > 0 ? 'text-green-400' : 'text-slate-600'
            }`}>
              {bid.price > 0 ? formatPrice(bid.price) : '--'}
            </span>
            
            {/* 数量 */}
            <span className={`w-16 text-right font-mono z-10 ${
              bid.volume > 0 ? 'text-slate-300' : 'text-slate-600'
            }`}>
              {bid.volume > 0 ? formatVolume(bid.volume) : '--'}
            </span>
          </div>
        ))}
      </div>
      
      {/* 委托汇总 */}
      <div className="flex justify-between mt-3 pt-2 border-t border-slate-700 text-xs">
        <div className="text-green-400">
          <span className="text-slate-500 mr-2">买入</span>
          {formatVolume(bids.reduce((sum, b) => sum + b.volume, 0))}
        </div>
        <div className="text-red-400">
          <span className="text-slate-500 mr-2">卖出</span>
          {formatVolume(asks.reduce((sum, a) => sum + a.volume, 0))}
        </div>
      </div>
    </div>
  );
};

export default MarketDepth;