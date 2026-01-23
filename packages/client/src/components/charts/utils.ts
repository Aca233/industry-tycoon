/**
 * 图表绘图工具函数
 */

import type { YAxisTick, XAxisTick, ChartDimensions } from './types';
import { formatGameTime } from '../../utils/formatters';

/**
 * 设置 Canvas 高 DPI 支持
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  return ctx;
}

/**
 * 清除画布
 */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string = 'transparent'
): void {
  if (color === 'transparent') {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * 绘制网格线
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  dimensions: ChartDimensions,
  yTicks: YAxisTick[],
  color: string
): void {
  const { width, margin } = dimensions;

  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 2]);

  yTicks.forEach(tick => {
    ctx.beginPath();
    ctx.moveTo(margin.left, tick.y);
    ctx.lineTo(width - margin.right, tick.y);
    ctx.stroke();
  });

  ctx.setLineDash([]);
}

/**
 * 绘制Y轴
 */
export function drawYAxis(
  ctx: CanvasRenderingContext2D,
  dimensions: ChartDimensions,
  yTicks: YAxisTick[],
  textColor: string
): void {
  const { margin } = dimensions;

  ctx.fillStyle = textColor;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  yTicks.forEach(tick => {
    ctx.fillText(tick.label, margin.left - 5, tick.y);
  });
}

/**
 * 绘制X轴
 */
export function drawXAxis(
  ctx: CanvasRenderingContext2D,
  dimensions: ChartDimensions,
  xTicks: XAxisTick[],
  textColor: string
): void {
  const { height, margin } = dimensions;
  const chartHeight = height - margin.top - margin.bottom;

  ctx.fillStyle = textColor;
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  xTicks.forEach(tick => {
    ctx.fillText(tick.label, tick.x, margin.top + chartHeight + 5);
  });
}

/**
 * 计算Y轴刻度
 */
export function calculateYTicks(
  minValue: number,
  maxValue: number,
  chartHeight: number,
  marginTop: number,
  tickCount: number = 5,
  formatter?: (value: number) => string
): YAxisTick[] {
  const range = maxValue - minValue;
  const step = range / tickCount;
  const ticks: YAxisTick[] = [];

  for (let i = 0; i <= tickCount; i++) {
    const value = maxValue - step * i;
    const y = marginTop + (i / tickCount) * chartHeight;
    ticks.push({
      value,
      y,
      label: formatter ? formatter(value) : value.toFixed(2),
    });
  }

  return ticks;
}

/**
 * 计算X轴刻度
 */
export function calculateXTicks(
  data: { tick: number }[],
  startIndex: number,
  endIndex: number,
  chartWidth: number,
  marginLeft: number,
  tickCount: number = 6
): XAxisTick[] {
  const visibleData = data.slice(startIndex, endIndex);
  if (visibleData.length === 0) return [];

  const step = Math.ceil(visibleData.length / tickCount);
  const ticks: XAxisTick[] = [];

  for (let i = 0; i < visibleData.length; i += step) {
    const item = visibleData[i];
    const x = marginLeft + (i / (visibleData.length - 1)) * chartWidth;
    ticks.push({
      tick: item.tick,
      x,
      label: formatGameTime(item.tick, 'chart', visibleData.length),
    });
  }

  // 确保最后一个点
  if (visibleData.length > 1) {
    const lastItem = visibleData[visibleData.length - 1];
    const lastX = marginLeft + chartWidth;
    if (!ticks.some(t => t.tick === lastItem.tick)) {
      ticks.push({
        tick: lastItem.tick,
        x: lastX,
        label: formatGameTime(lastItem.tick, 'chart', visibleData.length),
      });
    }
  }

  return ticks;
}

/**
 * 绘制平滑曲线（贝塞尔曲线插值）
 */
export function drawSmoothLine(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  lineWidth: number = 2,
  tension: number = 0.25
): void {
  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  ctx.stroke();
}

/**
 * 绘制渐变区域
 */
export function drawGradientArea(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  baseY: number,
  gradientStart: string,
  gradientEnd: string,
  tension: number = 0.25
): void {
  if (points.length < 2) return;

  const gradient = ctx.createLinearGradient(0, points[0].y, 0, baseY);
  gradient.addColorStop(0, gradientStart);
  gradient.addColorStop(1, gradientEnd);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(points[0].x, baseY);
  ctx.lineTo(points[0].x, points[0].y);

  // 使用贝塞尔曲线
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.lineTo(points[points.length - 1].x, baseY);
  ctx.closePath();
  ctx.fill();
}

/**
 * 绘制蜡烛图
 */
export function drawCandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  open: number,
  high: number,
  low: number,
  close: number,
  upColor: string,
  downColor: string
): void {
  const isUp = close >= open;
  const color = isUp ? upColor : downColor;
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);

  // 绘制影线
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + width / 2, high);
  ctx.lineTo(x + width / 2, low);
  ctx.stroke();

  // 绘制实体
  ctx.fillStyle = color;
  ctx.fillRect(x, bodyTop, width, bodyHeight);
}

/**
 * 绘制成交量柱
 */
export function drawVolumeBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isUp: boolean,
  upColor: string,
  downColor: string,
  opacity: number = 0.6
): void {
  ctx.globalAlpha = opacity;
  ctx.fillStyle = isUp ? upColor : downColor;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 1;
}

/**
 * 绘制十字光标
 */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dimensions: ChartDimensions,
  color: string
): void {
  const { width, height, margin } = dimensions;

  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 2]);

  // 水平线
  ctx.beginPath();
  ctx.moveTo(margin.left, y);
  ctx.lineTo(width - margin.right, y);
  ctx.stroke();

  // 垂直线
  ctx.beginPath();
  ctx.moveTo(x, margin.top);
  ctx.lineTo(x, height - margin.bottom);
  ctx.stroke();

  ctx.setLineDash([]);
}

/**
 * 绘制当前价格标签
 */
export function drawPriceLabel(
  ctx: CanvasRenderingContext2D,
  price: number,
  y: number,
  x: number,
  isUp: boolean,
  upColor: string,
  downColor: string,
  formatter?: (value: number) => string
): void {
  const color = isUp ? upColor : downColor;
  const label = formatter ? formatter(price) : price.toFixed(2);
  const padding = 4;
  const textWidth = ctx.measureText(label).width;
  const boxWidth = textWidth + padding * 2;
  const boxHeight = 16;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y - boxHeight / 2, boxWidth, boxHeight, 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + padding, y);
}

/**
 * 数据下采样（用于大数据量优化）
 */
export function downsampleData<T extends { tick: number }>(
  data: T[],
  targetPoints: number
): T[] {
  if (data.length <= targetPoints) return data;

  const result: T[] = [];
  const step = data.length / targetPoints;

  // 始终包含第一个点
  result.push(data[0]);

  for (let i = 1; i < targetPoints - 1; i++) {
    const index = Math.floor(i * step);
    result.push(data[index]);
  }

  // 始终包含最后一个点
  result.push(data[data.length - 1]);

  return result;
}

/**
 * 计算价格范围（含边距）
 */
export function calculatePriceRange(
  data: { high?: number; low?: number; value?: number }[],
  paddingPercent: number = 0.05
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  data.forEach(d => {
    if (d.high !== undefined) max = Math.max(max, d.high);
    if (d.low !== undefined) min = Math.min(min, d.low);
    if (d.value !== undefined) {
      max = Math.max(max, d.value);
      min = Math.min(min, d.value);
    }
  });

  const range = max - min;
  const padding = range * paddingPercent;

  return {
    min: min - padding,
    max: max + padding,
  };
}

/**
 * 将屏幕坐标转换为数据索引
 */
export function screenToDataIndex(
  screenX: number,
  marginLeft: number,
  chartWidth: number,
  dataLength: number
): number {
  const ratio = (screenX - marginLeft) / chartWidth;
  return Math.floor(ratio * (dataLength - 1));
}

/**
 * 将数据索引转换为屏幕坐标
 */
export function dataIndexToScreen(
  index: number,
  marginLeft: number,
  chartWidth: number,
  dataLength: number
): number {
  return marginLeft + (index / (dataLength - 1)) * chartWidth;
}