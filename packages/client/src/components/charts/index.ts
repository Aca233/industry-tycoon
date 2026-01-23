/**
 * 图表组件库
 * 提供统一的高性能图表解决方案
 */

// 类型定义
export type {
  CandleData,
  DataPoint,
  ChartViewport,
  CrosshairData,
  TooltipData,
  ChartDimensions,
  ChartConfig,
  ChartColors,
} from './types';

export { DEFAULT_COLORS, DEFAULT_CHART_CONFIG } from './types';

// 工具函数
export {
  setupCanvas,
  clearCanvas,
  drawGrid,
  drawYAxis,
  drawXAxis,
  drawSmoothLine,
  drawGradientArea,
  drawCandle,
  drawVolumeBar,
  drawCrosshair,
  drawPriceLabel,
  calculateYTicks,
  calculateXTicks,
  calculatePriceRange,
  downsampleData,
} from './utils';

// 组件
export { ChartTooltip, PriceLabel, TimeLabel } from './ChartTooltip';
export { InteractiveChart, DEFAULT_TIMEFRAMES } from './InteractiveChart';
export type { ChartMode, TimeframeOption, PriceData } from './InteractiveChart';