/**
 * K线图表组件
 * 使用新的 InteractiveChart 组件实现
 * 支持数据聚合和时间周期选择
 */

import React, { useMemo, memo } from 'react';
import type { StockPriceHistory } from '@scc/shared';
import { InteractiveChart } from '../charts';
import type { PriceData } from '../charts';

interface CandlestickChartProps {
  data: StockPriceHistory[];
  width?: number;
  height?: number;
  showVolume?: boolean;
  className?: string;
  /** 初始聚合周期（tick数），默认60（1小时） */
  initialTimeframe?: number;
}

// 转换数据格式
function convertToChartData(data: StockPriceHistory[]): PriceData[] {
  if (!data || data.length === 0) return [];
  
  return data.map(d => ({
    tick: d.tick,
    price: d.close,  // 使用收盘价作为主价格
    volume: d.volume,
  }));
}

export const CandlestickChart: React.FC<CandlestickChartProps> = memo(function CandlestickChart({
  data,
  width = 600,
  height = 300,
  showVolume = true,
  className = '',
  initialTimeframe = 60,
}) {
  // 转换数据格式
  const chartData = useMemo(() => convertToChartData(data), [data]);
  
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-slate-800/50 rounded-lg ${className}`}
           style={{ width, height }}>
        <span className="text-slate-500 text-sm">暂无数据</span>
      </div>
    );
  }
  
  return (
    <InteractiveChart
      data={chartData}
      width={width}
      height={height}
      initialMode="candle"
      showVolume={showVolume}
      showMA={true}
      showToolbar={true}
      initialTimeframe={initialTimeframe}
      formatPrice={(cents) => `$${(cents / 100).toFixed(2)}`}
      className={className}
    />
  );
});

export default CandlestickChart;