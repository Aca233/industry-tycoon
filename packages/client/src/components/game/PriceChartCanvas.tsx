/**
 * PriceChartCanvas - 使用新的交互式图表组件
 * 包装 InteractiveChart 实现价格走势图
 */

import { useRef, useEffect, useMemo, useState, memo } from 'react';
import type { PriceHistoryEntry } from '../../stores';
import { InteractiveChart } from '../charts';
import type { PriceData } from '../charts';

// 时间范围选项
type TimeRange = '30m' | '1h' | '3h' | '6h' | '12h' | '1d';
const TIME_RANGES: { value: TimeRange; label: string; ticks: number }[] = [
  { value: '30m', label: '30分', ticks: 30 },
  { value: '1h', label: '1小时', ticks: 60 },
  { value: '3h', label: '3小时', ticks: 180 },
  { value: '6h', label: '6小时', ticks: 360 },
  { value: '12h', label: '12小时', ticks: 720 },
  { value: '1d', label: '1天', ticks: 1440 },
];

interface PriceChartCanvasProps {
  history: PriceHistoryEntry[];
  width?: number;
  height?: number;
}

// 转换数据格式
function convertToChartData(history: PriceHistoryEntry[]): PriceData[] {
  return history.map(h => ({
    tick: h.tick,
    price: h.price,
    volume: (h.buyVolume || 0) + (h.sellVolume || 0),
    buyVolume: h.buyVolume,
    sellVolume: h.sellVolume,
  }));
}

// Canvas 价格图表组件
const PriceChartCanvas = memo(function PriceChartCanvas({
  history,
  width = 400,
  height = 220,
}: PriceChartCanvasProps) {
  // 转换数据格式
  const chartData = useMemo(() => convertToChartData(history), [history]);

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center text-gray-500 text-sm" style={{ width, height }}>
        等待价格数据...
      </div>
    );
  }

  return (
    <InteractiveChart
      data={chartData}
      width={width}
      height={height}
      initialMode="line"
      showVolume={true}
      showMA={true}
      showToolbar={true}
      formatPrice={(cents) => `¥${(cents / 100).toFixed(1)}`}
    />
  );
});

// 响应式图表包装器
export const PriceChartWrapperCanvas = memo(function PriceChartWrapperCanvas({
  history
}: {
  history: PriceHistoryEntry[]
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('6h');

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          setDimensions({
            width: Math.max(300, rect.width - 24),
            height: 260,
          });
        }
      }
    };

    requestAnimationFrame(updateDimensions);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateDimensions);
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // 根据时间范围筛选数据
  const filteredHistory = useMemo(() => {
    const rangeConfig = TIME_RANGES.find(r => r.value === timeRange);
    if (!rangeConfig || rangeConfig.ticks === Infinity) {
      return history;
    }
    return history.slice(-rangeConfig.ticks);
  }, [history, timeRange]);

  return (
    <div
      ref={containerRef}
      className="bg-slate-800/50 rounded-lg p-3"
      style={{ minHeight: '290px' }}
    >
      {/* 时间范围选择器 */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-gray-500">
          数据点: {filteredHistory.length} / {history.length}
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                timeRange === range.value
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* 图表内容 */}
      {dimensions ? (
        <PriceChartCanvas
          history={filteredHistory}
          width={dimensions.width}
          height={dimensions.height - 30}
        />
      ) : (
        <div className="flex items-center justify-center" style={{ height: '220px' }}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-full h-32 bg-slate-700/30 rounded animate-pulse" style={{ width: '100%', minWidth: '300px' }} />
            <span className="text-xs text-gray-500">加载图表...</span>
          </div>
        </div>
      )}
    </div>
  );
});

export { PriceChartCanvas };