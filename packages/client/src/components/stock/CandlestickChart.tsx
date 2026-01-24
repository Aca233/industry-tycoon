/**
 * K线图表组件
 * 使用 KLineChart 实现的股票K线图
 */

import { useMemo, memo } from 'react';
import type { StockPriceHistory } from '@scc/shared';
import { StockChart } from '../charts-v2';
import type { StockPriceHistoryEntry } from '../charts-v2';

interface CandlestickChartProps {
  data: StockPriceHistory[];
  width?: number;
  height?: number;
  showVolume?: boolean;
  className?: string;
}

// 转换数据格式为 StockChart 需要的格式
function convertToStockData(data: StockPriceHistory[]): StockPriceHistoryEntry[] {
  if (!data || data.length === 0) return [];
  
  return data.map(d => ({
    tick: d.tick,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume,
    turnover: d.turnover,
  }));
}

export const CandlestickChart = memo(function CandlestickChart({
  data,
  width = 600,
  height = 300,
  showVolume = true,
  className = '',
}: CandlestickChartProps) {
  // 转换数据格式
  const stockData = useMemo(() => convertToStockData(data), [data]);
  
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-slate-800/50 rounded-lg ${className}`}
           style={{ width, height }}>
        <span className="text-slate-500 text-sm">暂无数据</span>
      </div>
    );
  }
  
  return (
    <StockChart
      data={stockData}
      width={width}
      height={height}
      showVolume={showVolume}
      showToolbar={true}
      className={className}
    />
  );
});

export default CandlestickChart;