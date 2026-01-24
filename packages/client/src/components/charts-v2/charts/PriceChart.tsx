/**
 * 价格走势图组件
 * 基于 KLineChart 的业务组件
 */

import { useState } from 'react';
import { KLineChartWrapper } from '../core/KLineChartWrapper';
import type { PriceHistoryEntry, ChartMode } from '../core/types';

interface PriceChartProps {
  /** 价格历史数据 */
  history: PriceHistoryEntry[];
  /** 图表唯一标识（用于区分不同商品） */
  chartId?: string;
  /** 当前 tick（用于触发更新） */
  tick?: number;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 类名 */
  className?: string;
}

// 不使用 memo，确保数据能实时更新
export function PriceChart({
  history,
  chartId,
  tick,
  width,
  height = 280,
  showToolbar = true,
  className = '',
}: PriceChartProps) {
  const [mode, setMode] = useState<ChartMode>('line');

  const toolbarHeight = showToolbar ? 36 : 0;
  const chartHeight = height - toolbarHeight;

  return (
    <div className={`bg-slate-900/50 rounded-lg overflow-hidden ${className}`}>
      {/* 工具栏 */}
      {showToolbar && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-700/50">
          {/* K线图/折线图 切换按钮 */}
          <button
            onClick={() => setMode(mode === 'line' ? 'candle' : 'line')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              mode === 'candle'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            }`}
            title={mode === 'line' ? '切换到K线图' : '切换到折线图'}
          >
            K
          </button>

          <div className="flex-1" />

          {/* 数据统计 */}
          <span className="text-xs text-slate-500">{history.length}/{history.length}</span>
        </div>
      )}

      {/* KLineChart 图表 - 使用 key 强制在 mode 变化时重建 */}
      <KLineChartWrapper
        key={`${chartId}-${mode}`}
        data={history}
        chartId={chartId}
        tick={tick}
        width={width}
        height={chartHeight}
        theme="cyberpunk"
        options={{
          mode,
          showMA: false,
          showVolume: false,
          maPeriods: [],
          formatPrice: (v) => `¥${(v / 100).toFixed(1)}`,
          formatTime: (t) => `D${t + 1}`,
        }}
      />
    </div>
  );
}

export default PriceChart;