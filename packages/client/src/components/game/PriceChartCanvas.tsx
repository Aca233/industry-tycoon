/**
 * PriceChartCanvas - 价格走势图组件
 * 使用轻量级 Canvas 实现，高性能实时更新
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import type { PriceHistoryEntry } from '../../stores';
import { useGameStore } from '../../stores';
import { SimplePriceChart } from './SimplePriceChart';

interface PriceChartCanvasProps {
  history: PriceHistoryEntry[];
  goodsId?: string;  // 商品ID，用于区分不同图表
  tick?: number;     // 当前 tick，用于触发更新
  width?: number;
  height?: number;
}

// Canvas 价格图表组件
function PriceChartCanvas({
  history,
  goodsId,
  tick,
  width = 400,
  height = 220,
}: PriceChartCanvasProps) {
  if (history.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-gray-500 text-sm"
        style={{ width, height }}
      >
        等待价格数据...
      </div>
    );
  }

  const toolbarHeight = 32;
  const chartHeight = height - toolbarHeight;
  
  return (
    <div className="bg-slate-900/50 rounded-lg overflow-hidden">
      {/* 简化的工具栏 - 只显示标题和数据统计 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-700/50">
        <span className="text-xs text-cyan-400">📈 价格走势</span>
        <div className="flex-1" />
        <span className="text-xs text-slate-500">{history.length}/{history.length}</span>
      </div>

      {/* 使用轻量级 Canvas 图表 */}
      <SimplePriceChart
        data={history}
        width={width}
        height={chartHeight}
        lineColor="#00d4ff"
        fillColor="rgba(0, 212, 255, 0.15)"
        gridColor="rgba(100, 116, 139, 0.2)"
        textColor="#94a3b8"
      />
    </div>
  );
}

// 响应式图表包装器 - 直接从 store 获取数据，确保实时更新
export function PriceChartWrapperCanvas({
  goodsId,
}: {
  history?: PriceHistoryEntry[];  // 保留参数兼容性，但不再使用
  goodsId?: string;
}) {
  // 分别订阅原子值，避免选择器返回对象导致的无限循环
  const currentTick = useGameStore((state) => state.currentTick);
  const priceHistoryMap = useGameStore((state) => state.priceHistory);
  
  // 使用 useMemo 计算 history，依赖 currentTick 触发更新
  const history = useMemo(() => {
    if (!goodsId) return [];
    return priceHistoryMap.get(goodsId) ?? [];
  }, [goodsId, priceHistoryMap, currentTick]);
  
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          setDimensions({
            width: Math.max(300, rect.width - 24),
            height: 280,
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

  return (
    <div
      ref={containerRef}
      className="bg-slate-800/50 rounded-lg p-3"
      style={{ minHeight: '280px' }}
    >
      {/* 图表内容 - 基于 KLineChart */}
      {dimensions ? (
        <PriceChartCanvas
          history={history}
          goodsId={goodsId}
          tick={currentTick}
          width={dimensions.width}
          height={dimensions.height}
        />
      ) : (
        <div className="flex items-center justify-center" style={{ height: '240px' }}>
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-full h-32 bg-slate-700/30 rounded animate-pulse"
              style={{ width: '100%', minWidth: '300px' }}
            />
            <span className="text-xs text-gray-500">加载图表...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { PriceChartCanvas };