/**
 * 图表组件类型定义
 */

/** 数据点基础类型 */
export interface DataPoint {
  tick: number;
  value: number;
}

/** K线数据点 */
export interface CandleData {
  tick: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** 图表尺寸 */
export interface ChartDimensions {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/** 图表视口（用于缩放和平移） */
export interface ChartViewport {
  startIndex: number;  // 显示数据的起始索引
  endIndex: number;    // 显示数据的结束索引
  scaleY: number;      // Y轴缩放比例
}

/** 悬浮提示数据 */
export interface TooltipData {
  x: number;
  y: number;
  visible: boolean;
  data: {
    tick: number;
    price?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    change?: number;
    changePercent?: number;
  } | null;
}

/** 十字光标数据 */
export interface CrosshairData {
  x: number;
  y: number;
  visible: boolean;
  price: number;
  tick: number;
}

/** 图表交互状态 */
export interface ChartInteractionState {
  isDragging: boolean;
  dragStartX: number;
  dragStartViewport: ChartViewport | null;
  isPinching: boolean;
  lastTouchDistance: number;
}

/** 图表配置 */
export interface ChartConfig {
  /** 是否启用缩放 */
  enableZoom: boolean;
  /** 是否启用拖拽 */
  enablePan: boolean;
  /** 是否显示十字光标 */
  showCrosshair: boolean;
  /** 是否显示网格线 */
  showGrid: boolean;
  /** 最小可见K线数量 */
  minVisibleCandles: number;
  /** 最大可见K线数量 */
  maxVisibleCandles: number;
  /** 颜色配置 */
  colors: ChartColors;
}

/** 图表颜色配置 */
export interface ChartColors {
  background: string;
  grid: string;
  text: string;
  axis: string;
  upCandle: string;
  downCandle: string;
  line: string;
  lineGradientStart: string;
  lineGradientEnd: string;
  volume: string;
  crosshair: string;
  tooltip: {
    background: string;
    border: string;
    text: string;
  };
}

/** 默认颜色配置 */
export const DEFAULT_COLORS: ChartColors = {
  background: 'transparent',
  grid: '#1e293b',
  text: '#64748b',
  axis: '#475569',
  upCandle: '#22c55e',
  downCandle: '#ef4444',
  line: '#22d3ee',
  lineGradientStart: 'rgba(34, 211, 238, 0.25)',
  lineGradientEnd: 'rgba(34, 211, 238, 0)',
  volume: 'rgba(100, 116, 139, 0.5)',
  crosshair: '#94a3b8',
  tooltip: {
    background: '#1e293b',
    border: '#334155',
    text: '#e2e8f0',
  },
};

/** 默认图表配置 */
export const DEFAULT_CHART_CONFIG: ChartConfig = {
  enableZoom: true,
  enablePan: true,
  showCrosshair: true,
  showGrid: true,
  minVisibleCandles: 10,
  maxVisibleCandles: 500,
  colors: DEFAULT_COLORS,
};

/** Y轴刻度数据 */
export interface YAxisTick {
  value: number;
  y: number;
  label: string;
}

/** X轴刻度数据 */
export interface XAxisTick {
  tick: number;
  x: number;
  label: string;
}

/** 蜡烛布局计算结果 */
export interface CandleLayoutResult {
  candleWidth: number;   // 蜡烛宽度
  gap: number;           // 蜡烛间距
  offset: number;        // 居中偏移
  totalWidth: number;    // 总宽度
}

/** 周期配置 */
export interface PeriodConfig {
  period: number;        // 聚合周期 (ticks)
  maxCandles: number;    // 最大显示蜡烛数
  label: string;         // 显示标签
}

/** 预定义周期配置 */
export const PERIOD_CONFIGS: PeriodConfig[] = [
  { period: 1, maxCandles: 200, label: '1H' },
  { period: 3, maxCandles: 150, label: '3H' },
  { period: 6, maxCandles: 100, label: '6H' },
  { period: 12, maxCandles: 80, label: '12H' },
  { period: 24, maxCandles: 90, label: '1D' },
];