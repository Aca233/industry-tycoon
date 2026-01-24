/**
 * 股票K线图组件
 * 基于 KLineChart 的股票专用图表
 */

import { useState, memo } from 'react';
import { KLineChartWrapper } from '../core/KLineChartWrapper';
import type { ChartMode } from '../core/types';
import type { StockPriceHistoryEntry } from '../core/chartAdapter';

interface StockChartProps {
  /** 股票价格历史数据 */
  data: StockPriceHistoryEntry[];
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 是否显示成交量 */
  showVolume?: boolean;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 类名 */
  className?: string;
}

export const StockChart = memo(function StockChart({
  data,
  width,
  height = 280,
  showVolume = true,
  showToolbar = true,
  className = '',
}: StockChartProps) {
  const [mode, setMode] = useState<ChartMode>('candle');
  const [showMA, setShowMA] = useState(true);
  const [volumeVisible, setVolumeVisible] = useState(showVolume);

  const toolbarHeight = showToolbar ? 36 : 0;
  const chartHeight = height - toolbarHeight;

  // 转换为 PriceHistoryEntry 格式，使用 close 作为 price
  const priceData = data.map((d) => ({
    tick: d.tick,
    price: d.close,
    volume: d.volume,
  }));

  return (
    <div className={`bg-slate-900/50 rounded-lg overflow-hidden ${className}`}>
      {/* 工具栏 */}
      {showToolbar && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-700/50">
          {/* 图表类型切换 */}
          <button
            onClick={() => setMode(mode === 'line' ? 'candle' : 'line')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              mode === 'candle'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            }`}
          >
            {mode === 'line' ? '📈' : '📊'}
          </button>

          {/* 均线开关 */}
          <button
            onClick={() => setShowMA(!showMA)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              showMA
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            }`}
          >
            MA
          </button>

          {/* 成交量开关 */}
          <button
            onClick={() => setVolumeVisible(!volumeVisible)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              volumeVisible
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            }`}
          >
            VOL
          </button>

          <div className="flex-1" />

          {/* 数据统计 */}
          <span className="text-xs text-slate-500">{data.length} 天</span>
        </div>
      )}

      {/* KLineChart 图表 */}
      <KLineChartWrapper
        data={priceData}
        width={width}
        height={chartHeight}
        theme="cyberpunk"
        options={{
          mode,
          showMA,
          showVolume: volumeVisible,
          maPeriods: [5, 10, 20],
          formatPrice: (v) => `$${(v / 100).toFixed(2)}`,
          formatTime: (tick) => `D${tick + 1}`,
        }}
      />
    </div>
  );
});

export default StockChart;