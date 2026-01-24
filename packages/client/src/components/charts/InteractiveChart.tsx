/**
 * 交互式图表组件
 * 支持折线图和K线图两种模式
 * 包含缩放、拖拽、悬浮提示等交互功能
 */

import { useRef, useEffect, useMemo, useState, memo, useCallback } from 'react';
import type {
  ChartConfig,
  ChartDimensions,
  TooltipData,
  CandleData,
} from './types';
import { DEFAULT_COLORS } from './types';
import { ChartTooltip } from './ChartTooltip';
import {
  setupCanvas,
  clearCanvas,
  drawGrid,
  drawYAxis,
  drawXAxis,
  calculateYTicks,
  calculateXTicks,
  drawSmoothLine,
  drawGradientArea,
  drawCandle,
  drawVolumeBar,
  drawCrosshair,
  drawPriceLabel,
  drawCurrentPriceLine,
  calculatePriceRange,
  calculateCandleLayout,
  downsampleData,
} from './utils';
// PERIOD_CONFIGS 已内置在 DEFAULT_TIMEFRAMES 中

/** 图表模式 */
export type ChartMode = 'line' | 'candle';

/** 时间周期选项 */
export interface TimeframeOption {
  label: string;
  value: number;  // tick数 (聚合周期)
  maxCandles: number;  // 最大显示蜡烛数
}

/** 默认时间周期选项（1 tick = 1天）*/
export const DEFAULT_TIMEFRAMES: TimeframeOption[] = [
  { label: '1D', value: 1, maxCandles: 200 },     // 1天周期，显示200根
  { label: '3D', value: 3, maxCandles: 150 },     // 3天周期，显示150根
  { label: '1W', value: 7, maxCandles: 120 },     // 1周周期，显示120根
  { label: '2W', value: 14, maxCandles: 90 },     // 2周周期，显示90根
  { label: '1M', value: 30, maxCandles: 60 },     // 1月周期，显示60根
];

/** 价格数据（折线图用） */
export interface PriceData {
  tick: number;
  price: number;
  volume?: number;
  buyVolume?: number;
  sellVolume?: number;
}

/** K线数据聚合 */
function aggregateToCandles(data: PriceData[], period: number): CandleData[] {
  if (!data || data.length === 0) return [];
  if (period <= 1) {
    return data.map(d => ({
      tick: d.tick,
      open: d.price,
      high: d.price,
      low: d.price,
      close: d.price,
      volume: d.volume || 0,
    }));
  }

  const candles: CandleData[] = [];
  let currentCandle: CandleData | null = null;

  for (const point of data) {
    const periodIndex = Math.floor(point.tick / period);
    
    if (!currentCandle || Math.floor(currentCandle.tick / period) !== periodIndex) {
      if (currentCandle) {
        candles.push(currentCandle);
      }
      currentCandle = {
        tick: periodIndex * period,
        open: point.price,
        high: point.price,
        low: point.price,
        close: point.price,
        volume: point.volume || 0,
      };
    } else {
      currentCandle.high = Math.max(currentCandle.high, point.price);
      currentCandle.low = Math.min(currentCandle.low, point.price);
      currentCandle.close = point.price;
      currentCandle.volume = (currentCandle.volume || 0) + (point.volume || 0);
    }
  }
  
  if (currentCandle) {
    candles.push(currentCandle);
  }
  
  return candles;
}

interface InteractiveChartProps {
  /** 原始价格数据 */
  data: PriceData[];
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 初始模式 */
  initialMode?: ChartMode;
  /** 是否显示成交量 */
  showVolume?: boolean;
  /** 是否显示均线 */
  showMA?: boolean;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 时间周期选项 */
  timeframes?: TimeframeOption[];
  /** 初始时间周期 */
  initialTimeframe?: number;
  /** 配置 */
  config?: Partial<ChartConfig>;
  /** 价格格式化函数 */
  formatPrice?: (value: number) => string;
  /** 类名 */
  className?: string;
}

export const InteractiveChart = memo(function InteractiveChart({
  data,
  width = 600,
  height = 300,
  initialMode = 'line',
  showVolume = true,
  showMA = true,
  showToolbar = true,
  timeframes = DEFAULT_TIMEFRAMES,
  initialTimeframe = 60,
  config: configOverride,
  formatPrice = (v) => `¥${(v / 100).toFixed(2)}`,
  className = '',
}: InteractiveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 状态
  const [mode, setMode] = useState<ChartMode>(initialMode);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [showMAState, setShowMAState] = useState(showMA);
  const [showVolumeState, setShowVolumeState] = useState(showVolume);
  
  // 使用 ref 存储 tooltip 数据，避免频繁状态更新导致重绘
  const tooltipRef = useRef<TooltipData>({
    x: 0,
    y: 0,
    visible: false,
    data: null,
  });
  const [tooltipVersion, setTooltipVersion] = useState(0);

  // 合并配置
  const config: ChartConfig = useMemo(() => ({
    enableZoom: true,
    enablePan: true,
    showCrosshair: true,
    showGrid: true,
    minVisibleCandles: 10,
    maxVisibleCandles: 500,
    colors: DEFAULT_COLORS,
    ...configOverride,
  }), [configOverride]);

  // 工具栏高度
  const toolbarHeight = showToolbar ? 36 : 0;
  const volumeHeight = showVolumeState ? 50 : 0;

  // 图表尺寸 - 增加左边距以容纳Y轴标签
  const dimensions: ChartDimensions = useMemo(() => ({
    width,
    height: height - toolbarHeight,
    margin: { top: 10, right: 55, bottom: 25, left: 50 },
  }), [width, height, toolbarHeight]);

  // 获取当前周期配置
  const currentPeriodConfig = useMemo(() => {
    return timeframes.find(tf => tf.value === timeframe) || timeframes[0];
  }, [timeframe, timeframes]);

  // 处理数据
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    if (mode === 'candle') {
      // K线模式：聚合数据
      const candles = aggregateToCandles(data, timeframe);
      // 使用周期配置的 maxCandles
      const maxCandles = currentPeriodConfig.maxCandles;
      return candles.slice(-maxCandles);
    } else {
      // 折线模式：显示所有数据（Canvas 可以轻松处理 1000+ 个点）
      // 仅在超过 2000 点时才进行轻微下采样
      if (data.length > 2000) {
        const targetPoints = Math.max(1500, Math.floor(width));
        return downsampleData(data, targetPoints);
      }
      return data;
    }
  }, [data, mode, timeframe, width, currentPeriodConfig]);

  // 不使用交互钩子，直接显示所有数据（避免无限循环）
  const visibleData = chartData;
  
  // 简单的十字光标状态 - 使用 ref 避免频繁状态更新
  const crosshairRef = useRef({ x: 0, y: 0, visible: false });
  const [crosshairVersion, setCrosshairVersion] = useState(0);
  
  // RAF ID 用于节流
  const rafIdRef = useRef<number>(0);
  
  // 鼠标事件处理 - 使用 useCallback 避免重新创建
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const margin = { left: 50, right: 55, top: 10, bottom: 25 };
    const w = rect.width;
    const h = rect.height;
    
    const visible = x >= margin.left && x <= w - margin.right &&
                   y >= margin.top && y <= h - margin.bottom;
    
    const prev = crosshairRef.current;
    // 只在位置变化超过阈值或可见性变化时更新
    const shouldUpdate = prev.visible !== visible ||
                        (visible && (Math.abs(prev.x - x) > 2 || Math.abs(prev.y - y) > 2));
    
    if (shouldUpdate) {
      crosshairRef.current = { x, y, visible };
      
      // 使用 RAF 节流更新
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        setCrosshairVersion(n => n + 1);
      });
    }
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    if (crosshairRef.current.visible) {
      crosshairRef.current = { ...crosshairRef.current, visible: false };
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      setCrosshairVersion(n => n + 1);
      setTooltipVersion(n => n + 1);
    }
  }, []);
  
  // 清理 RAF
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // 计算价格范围 - 使用智能范围计算
  const priceRange = useMemo(() => {
    if (visibleData.length === 0) return { min: 0, max: 100, step: 20 };
    
    if (mode === 'candle') {
      return calculatePriceRange(visibleData as CandleData[], {
        paddingPercent: 0.08,
        minRangePercent: 0.05,
        roundToNice: true
      });
    } else {
      const prices = (visibleData as PriceData[]).map(d => ({ value: d.price }));
      return calculatePriceRange(prices, {
        paddingPercent: 0.08,
        minRangePercent: 0.03,
        roundToNice: true
      });
    }
  }, [visibleData, mode]);

  // 计算Y轴刻度
  const yTicks = useMemo(() => {
    const chartHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom - volumeHeight;
    return calculateYTicks(
      priceRange.min,
      priceRange.max,
      chartHeight,
      dimensions.margin.top,
      5,
      formatPrice
    );
  }, [priceRange, dimensions, volumeHeight, formatPrice]);

  // 计算X轴刻度
  const xTicks = useMemo(() => {
    const chartWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    return calculateXTicks(
      visibleData,
      0,
      visibleData.length,
      chartWidth,
      dimensions.margin.left,
      6,
      timeframe  // 传入周期以优化标签格式
    );
  }, [visibleData, dimensions, timeframe]);

  // 使用 ref 追踪上次绘制的数据长度和时间，避免频繁重绘
  const lastDrawnDataLengthRef = useRef(0);
  const drawThrottleTimeRef = useRef(0);
  const DRAW_THROTTLE_MS = 100; // 最小绘制间隔 100ms
  
  // 绘制图表
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || visibleData.length === 0) return;

    // 节流：避免过于频繁的重绘
    const now = Date.now();
    const timeSinceLastDraw = now - drawThrottleTimeRef.current;
    
    // 如果数据长度没有显著变化（新增 1-2 个点），且距离上次绘制时间不足，跳过本次绘制
    const dataLengthDiff = Math.abs(visibleData.length - lastDrawnDataLengthRef.current);
    if (dataLengthDiff <= 2 && timeSinceLastDraw < DRAW_THROTTLE_MS) {
      return;
    }
    
    lastDrawnDataLengthRef.current = visibleData.length;
    drawThrottleTimeRef.current = now;

    const ctx = setupCanvas(canvas, dimensions.width, dimensions.height);
    if (!ctx) return;

    // 清除画布
    clearCanvas(ctx, dimensions.width, dimensions.height);

    const chartWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    const chartHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom - volumeHeight;

    // 绘制网格
    if (config.showGrid) {
      drawGrid(ctx, dimensions, yTicks, config.colors.grid);
    }

    // 绘制Y轴
    drawYAxis(ctx, dimensions, yTicks, config.colors.text);

    // 绘制X轴
    drawXAxis(ctx, dimensions, xTicks, config.colors.text);

    // 坐标转换函数
    const xScale = (i: number) => dimensions.margin.left + (i / (visibleData.length - 1 || 1)) * chartWidth;
    const yScale = (price: number) => dimensions.margin.top + (1 - (price - priceRange.min) / (priceRange.max - priceRange.min)) * chartHeight;

    if (mode === 'line') {
      // 绘制折线图
      const points = (visibleData as PriceData[]).map((d, i) => ({
        x: xScale(i),
        y: yScale(d.price),
      }));

      // 绘制渐变区域
      drawGradientArea(
        ctx,
        points,
        dimensions.margin.top + chartHeight,
        config.colors.lineGradientStart,
        config.colors.lineGradientEnd
      );

      // 绘制均线
      if (showMAState && visibleData.length > 5) {
        const prices = (visibleData as PriceData[]).map(d => d.price);
        
        // MA5
        const ma5Points: { x: number; y: number }[] = [];
        for (let i = 4; i < prices.length; i++) {
          const ma = prices.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5;
          ma5Points.push({ x: xScale(i), y: yScale(ma) });
        }
        if (ma5Points.length > 1) {
          ctx.setLineDash([3, 2]);
          drawSmoothLine(ctx, ma5Points, '#f59e0b', 1, 0.2);
          ctx.setLineDash([]);
        }

        // MA10
        if (visibleData.length > 10) {
          const ma10Points: { x: number; y: number }[] = [];
          for (let i = 9; i < prices.length; i++) {
            const ma = prices.slice(i - 9, i + 1).reduce((a, b) => a + b, 0) / 10;
            ma10Points.push({ x: xScale(i), y: yScale(ma) });
          }
          if (ma10Points.length > 1) {
            ctx.setLineDash([3, 2]);
            drawSmoothLine(ctx, ma10Points, '#ec4899', 1, 0.2);
            ctx.setLineDash([]);
          }
        }
      }

      // 绘制主曲线
      drawSmoothLine(ctx, points, config.colors.line, 2, 0.25);

      // 当前价格点
      if (points.length > 0) {
        const lastPoint = points[points.length - 1];
        const lastData = visibleData[visibleData.length - 1] as PriceData;
        
        ctx.fillStyle = config.colors.line;
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // 价格标签
        drawPriceLabel(
          ctx,
          lastData.price,
          lastPoint.y,
          dimensions.width - dimensions.margin.right + 2,
          true,
          config.colors.upCandle,
          config.colors.downCandle,
          formatPrice
        );
      }

    } else {
      // 绘制K线图
      const candleData = visibleData as CandleData[];
      
      // 使用智能布局计算蜡烛宽度和间距
      const layout = calculateCandleLayout(chartWidth, candleData.length, {
        minGap: 1,
        minWidth: 3,
        maxWidth: 14,
        widthRatio: 0.65
      });

      candleData.forEach((d, i) => {
        // 使用布局计算精确位置
        const x = dimensions.margin.left + layout.offset + i * (layout.candleWidth + layout.gap);
        
        drawCandle(
          ctx,
          x,
          layout.candleWidth,
          yScale(d.open),
          yScale(d.high),
          yScale(d.low),
          yScale(d.close),
          config.colors.upCandle,
          config.colors.downCandle,
          {
            hollowUp: layout.candleWidth > 6,  // 宽蜡烛时使用空心阳线
            borderRadius: layout.candleWidth > 4 ? 1 : 0
          }
        );
      });

      // 绘制当前价格水平线
      if (candleData.length > 0) {
        const lastCandle = candleData[candleData.length - 1];
        const isUp = lastCandle.close >= lastCandle.open;
        const lastY = yScale(lastCandle.close);
        
        drawCurrentPriceLine(
          ctx,
          lastY,
          dimensions.margin.left,
          dimensions.width - dimensions.margin.right,
          dimensions.width - dimensions.margin.right + 2,
          lastCandle.close,
          isUp,
          config.colors.upCandle,
          config.colors.downCandle,
          formatPrice
        );
      }
    }

    // 绘制成交量
    if (showVolumeState && volumeHeight > 0) {
      const volumeY = dimensions.margin.top + chartHeight + 10;
      
      // 折线图模式使用 buyVolume + sellVolume，K线模式使用 volume
      const volumes = visibleData.map(d => {
        if (mode === 'line') {
          const pd = d as PriceData;
          return (pd.buyVolume || 0) + (pd.sellVolume || 0) + (pd.volume || 0);
        }
        return d.volume || 0;
      });
      const maxVolume = Math.max(...volumes, 1);

      // 绘制成交量标签
      ctx.fillStyle = '#64748b';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('VOL', dimensions.margin.left, volumeY + 8);

      visibleData.forEach((d, i) => {
        const vol = volumes[i];
        if (vol === 0) return;

        const x = xScale(i);
        const barWidth = Math.max(2, (chartWidth / visibleData.length) * 0.6);
        const barHeight = (vol / maxVolume) * (volumeHeight - 15);
        
        // 确定涨跌颜色
        let isUp = true;
        if (mode === 'candle') {
          const candle = d as CandleData;
          isUp = candle.close >= candle.open;
        } else {
          const pd = d as PriceData;
          isUp = (pd.buyVolume || 0) >= (pd.sellVolume || 0);
        }

        drawVolumeBar(
          ctx,
          x - barWidth / 2,
          volumeY + volumeHeight - barHeight,
          barWidth,
          barHeight,
          isUp,
          config.colors.upCandle,
          config.colors.downCandle,
          0.6
        );
      });
    }

    // 绘制十字光标 - 不再在这里更新 tooltip 状态
    const crosshair = crosshairRef.current;
    if (crosshair.visible) {
      drawCrosshair(ctx, crosshair.x, crosshair.y, dimensions, config.colors.crosshair);
    }

  }, [visibleData, mode, dimensions, config, priceRange, yTicks, xTicks, showMAState, showVolumeState, volumeHeight, formatPrice, crosshairVersion]);

  // 单独处理 tooltip 更新，避免触发图表重绘
  useEffect(() => {
    const crosshair = crosshairRef.current;
    if (!crosshair.visible) {
      if (tooltipRef.current.visible) {
        tooltipRef.current = { ...tooltipRef.current, visible: false };
        setTooltipVersion(n => n + 1);
      }
      return;
    }
    
    const cw = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    const ratio = (crosshair.x - dimensions.margin.left) / cw;
    const index = Math.max(0, Math.min(visibleData.length - 1, Math.floor(ratio * visibleData.length)));
    const dataPoint = visibleData[index];
    
    if (dataPoint) {
      if (mode === 'candle') {
        const candle = dataPoint as CandleData;
        tooltipRef.current = {
          x: crosshair.x,
          y: crosshair.y,
          visible: true,
          data: {
            tick: candle.tick,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            change: candle.close - candle.open,
            changePercent: ((candle.close - candle.open) / candle.open) * 100,
          },
        };
      } else {
        const price = dataPoint as PriceData;
        tooltipRef.current = {
          x: crosshair.x,
          y: crosshair.y,
          visible: true,
          data: {
            tick: price.tick,
            price: price.price,
            volume: price.volume,
          },
        };
      }
      setTooltipVersion(n => n + 1);
    }
  }, [crosshairVersion, visibleData, mode, dimensions]);

  // 空数据提示
  if (!data || data.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-800/50 rounded-lg ${className}`}
        style={{ width, height }}
      >
        <span className="text-slate-500 text-sm">暂无数据</span>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900/50 rounded-lg ${className}`} ref={containerRef}>
      {/* 工具栏 */}
      {showToolbar && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-700/50">
          {/* 模式切换 */}
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

          {/* 均线 */}
          <button
            onClick={() => setShowMAState(!showMAState)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              showMAState
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            }`}
          >
            MA
          </button>

          {/* 成交量 */}
          <button
            onClick={() => setShowVolumeState(!showVolumeState)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              showVolumeState
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            }`}
          >
            VOL
          </button>

          <div className="w-px h-4 bg-slate-600 mx-1" />

          {/* 时间周期 - 始终显示 */}
          {timeframes.map((tf, index) => (
            <button
              key={`${tf.label}-${tf.value}-${index}`}
              onClick={() => setTimeframe(tf.value)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                timeframe === tf.value
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
              }`}
            >
              {tf.label}
            </button>
          ))}

          <div className="flex-1" />

          {/* 数据信息 */}
          <span className="text-xs text-slate-500">
            {visibleData.length}/{chartData.length}
          </span>
        </div>
      )}

      {/* 图例 */}
      {showMAState && mode === 'line' && (
        <div className="absolute top-8 left-2 flex gap-2 text-[9px] z-10">
          <span className="text-orange-400">— MA5</span>
          <span className="text-pink-400">— MA10</span>
        </div>
      )}

      {/* Canvas */}
      <div className="relative p-1">
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          className="block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* 悬浮提示 - 使用 ref 数据避免重绘 */}
        <ChartTooltip
          data={tooltipRef.current}
          colors={config.colors.tooltip}
          formatPrice={formatPrice}
          showVolume={showVolumeState}
          key={tooltipVersion}
        />
      </div>
    </div>
  );
});

export default InteractiveChart;