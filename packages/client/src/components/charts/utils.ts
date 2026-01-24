/**
 * 图表绘图工具函数
 */

import type { YAxisTick, XAxisTick, ChartDimensions, CandleLayoutResult } from './types';

// TICKS_PER_DAY 在新时间体系中不再需要（1 tick = 1 天）

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
 * 计算蜡烛最佳布局
 * 根据图表宽度和数据量自动计算蜡烛宽度和间距
 */
export function calculateCandleLayout(
  chartWidth: number,
  dataCount: number,
  options: {
    minGap?: number;      // 最小间距
    minWidth?: number;    // 最小蜡烛宽度
    maxWidth?: number;    // 最大蜡烛宽度
    widthRatio?: number;  // 蜡烛占比 (0-1)
  } = {}
): CandleLayoutResult {
  const {
    minGap = 1,
    minWidth = 3,
    maxWidth = 14,
    widthRatio = 0.65
  } = options;

  if (dataCount <= 0) {
    return { candleWidth: minWidth, gap: minGap, offset: 0, totalWidth: 0 };
  }

  // 每个数据点的槽宽度
  const slotWidth = chartWidth / dataCount;
  
  // 计算理想的蜡烛宽度
  let candleWidth = slotWidth * widthRatio;
  
  // 应用宽度限制
  candleWidth = Math.max(minWidth, Math.min(maxWidth, candleWidth));
  
  // 计算间距
  const gap = Math.max(minGap, slotWidth - candleWidth);
  
  // 计算总宽度和居中偏移
  const totalWidth = candleWidth * dataCount + gap * (dataCount - 1);
  const offset = Math.max(0, (chartWidth - totalWidth) / 2);

  return { candleWidth, gap, offset, totalWidth };
}

/**
 * 智能格式化图表时间轴标签
 * 根据时间跨度和数据周期选择最佳格式
 * 新时间体系：1 tick = 1 天
 */
export function formatChartAxisTime(
  tick: number,
  period: number,
  timeSpan: number  // 总时间跨度 (ticks/天)
): string {
  const day = tick + 1; // tick 0 = 第1天
  const week = Math.floor(tick / 7) + 1;
  const month = Math.floor(tick / 30) + 1;
  
  // 短周期 (1-3天): 显示天数
  if (period <= 3) {
    if (timeSpan <= 7) {
      // 1周内: 显示所有天
      return `D${day}`;
    } else if (timeSpan <= 30) {
      // 1月内: 每周显示周标记，其他显示天
      if (tick % 7 === 0) return `W${week}`;
      return `D${day}`;
    } else {
      // 1月以上: 只在每周开始显示
      if (tick % 7 === 0) return `W${week}`;
      return '';
    }
  }
  
  // 中周期 (7天/周): 显示周
  if (period <= 7) {
    if (timeSpan <= 90) {
      return `W${week}`;
    }
    // 3月以上: 每月显示月标记
    if (tick % 30 === 0) return `M${month}`;
    return `W${week}`;
  }
  
  // 长周期 (30天/月): 显示月
  if (period <= 30) {
    return `M${month}`;
  }
  
  // 超长周期 (>30天): 显示年
  const year = Math.floor(tick / 365) + 1;
  return `Y${year}`;
}

/**
 * 计算X轴刻度
 * 使用固定的时间间隔来计算刻度位置，避免数据量变化时刻度位置跳动
 */
export function calculateXTicks(
  data: { tick: number }[],
  startIndex: number,
  endIndex: number,
  chartWidth: number,
  marginLeft: number,
  tickCount: number = 6,
  period: number = 1  // 数据周期
): XAxisTick[] {
  const visibleData = data.slice(startIndex, endIndex);
  if (visibleData.length === 0) return [];

  const firstTick = visibleData[0].tick;
  const lastTick = visibleData[visibleData.length - 1].tick;
  const tickRange = lastTick - firstTick;
  
  // 如果范围太小，直接返回首尾刻度
  if (tickRange <= 0) {
    return [{
      tick: firstTick,
      x: marginLeft,
      label: formatChartAxisTime(firstTick, period, tickRange),
    }];
  }

  // 根据周期选择合适的刻度间隔
  // 目标：产生 4-8 个刻度
  // 新时间体系: 1 tick = 1 天
  const possibleIntervals = [
    1,                       // 1天
    3,                       // 3天
    7,                       // 1周
    14,                      // 2周
    30,                      // 1月
    90,                      // 1季度
    365                      // 1年
  ];
  
  let interval = 7; // 默认1周间隔
  
  // 选择能产生合适数量刻度的间隔
  for (const pi of possibleIntervals) {
    const count = tickRange / pi;
    if (count >= 3 && count <= tickCount + 2) {
      interval = pi;
      break;
    }
  }
  
  // 如果数据范围太大，使用更大的间隔
  if (tickRange / interval > tickCount + 2) {
    for (const pi of possibleIntervals) {
      if (tickRange / pi <= tickCount + 2) {
        interval = pi;
        break;
      }
    }
  }
  
  // 如果数据范围太小，使用更小的间隔
  if (tickRange / interval < 2) {
    interval = Math.max(1, Math.floor(tickRange / 4));
  }

  const ticks: XAxisTick[] = [];
  
  // 找到第一个对齐到间隔的刻度
  const firstAlignedTick = Math.ceil(firstTick / interval) * interval;
  
  // 生成对齐的刻度
  for (let t = firstAlignedTick; t <= lastTick; t += interval) {
    // 计算此 tick 在 x 轴上的位置
    const ratio = (t - firstTick) / tickRange;
    const x = marginLeft + ratio * chartWidth;
    
    const label = formatChartAxisTime(t, period, tickRange);
    if (label) {  // 只添加有标签的刻度
      ticks.push({ tick: t, x, label });
    }
  }

  // 如果没有生成任何刻度，至少显示首尾
  if (ticks.length === 0) {
    ticks.push({
      tick: firstTick,
      x: marginLeft,
      label: formatChartAxisTime(firstTick, period, tickRange),
    });
    if (tickRange > 0) {
      ticks.push({
        tick: lastTick,
        x: marginLeft + chartWidth,
        label: formatChartAxisTime(lastTick, period, tickRange),
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
 * 绘制专业K线蜡烛图
 * 支持圆角、影线细节、可选空心阳线
 */
export function drawCandle(
  ctx: CanvasRenderingContext2D,
  x: number,           // 蜡烛左边缘X坐标
  width: number,
  open: number,        // Y坐标
  high: number,        // Y坐标
  low: number,         // Y坐标
  close: number,       // Y坐标
  upColor: string,
  downColor: string,
  options: {
    wickColor?: string;      // 影线颜色（可选）
    hollowUp?: boolean;      // 阳线是否空心
    borderRadius?: number;   // 圆角半径
  } = {}
): void {
  const {
    wickColor,
    hollowUp = false,
    borderRadius = 1
  } = options;

  const isUp = close <= open;  // Y轴向下，close < open 表示涨
  const color = isUp ? upColor : downColor;
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);
  const centerX = x + width / 2;

  // 1. 绘制影线 (wick/shadow)
  const wickLineWidth = Math.max(1, Math.min(2, width * 0.15));
  ctx.strokeStyle = wickColor || color;
  ctx.lineWidth = wickLineWidth;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  // 上影线
  if (high < bodyTop - 1) {
    ctx.moveTo(centerX, high);
    ctx.lineTo(centerX, bodyTop);
  }
  // 下影线
  if (low > bodyBottom + 1) {
    ctx.moveTo(centerX, bodyBottom);
    ctx.lineTo(centerX, low);
  }
  ctx.stroke();

  // 2. 绘制实体
  const radius = Math.min(borderRadius, width / 4, bodyHeight / 4);
  
  if (hollowUp && isUp && width > 5) {
    // 空心阳线
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, width * 0.15);
    ctx.beginPath();
    if (radius > 0 && bodyHeight > 2) {
      ctx.roundRect(x, bodyTop, width, bodyHeight, radius);
    } else {
      ctx.rect(x, bodyTop, width, bodyHeight);
    }
    ctx.stroke();
  } else {
    // 实心蜡烛
    ctx.fillStyle = color;
    ctx.beginPath();
    if (radius > 0 && bodyHeight > 2) {
      ctx.roundRect(x, bodyTop, width, bodyHeight, radius);
    } else {
      ctx.rect(x, bodyTop, width, bodyHeight);
    }
    ctx.fill();
  }
}

/**
 * 绘制当前价格水平线
 */
export function drawCurrentPriceLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  startX: number,
  _endX: number,  // 保留参数以备将来使用
  labelX: number,
  price: number,
  isUp: boolean,
  upColor: string,
  downColor: string,
  formatPrice: (v: number) => string
): void {
  const color = isUp ? upColor : downColor;
  
  // 绘制虚线
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.globalAlpha = 0.6;
  
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(labelX - 5, y);
  ctx.stroke();
  
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  
  // 绘制价格标签
  drawPriceLabel(ctx, price, y, labelX, isUp, upColor, downColor, formatPrice);
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
 * 计算价格范围（含智能边距和最小范围限制）
 */
export function calculatePriceRange(
  data: { high?: number; low?: number; value?: number; open?: number; close?: number }[],
  options: {
    paddingPercent?: number;   // 边距百分比
    minRangePercent?: number;  // 最小范围百分比（相对于中心价格）
    roundToNice?: boolean;     // 是否圆整到"好看"的数字
  } = {}
): { min: number; max: number; step?: number } {
  const {
    paddingPercent = 0.08,
    minRangePercent = 0.05,  // 至少 5% 的价格范围
    roundToNice = true
  } = options;

  let dataMin = Infinity;
  let dataMax = -Infinity;

  data.forEach(d => {
    if (d.high !== undefined) dataMax = Math.max(dataMax, d.high);
    if (d.low !== undefined) dataMin = Math.min(dataMin, d.low);
    if (d.value !== undefined) {
      dataMax = Math.max(dataMax, d.value);
      dataMin = Math.min(dataMin, d.value);
    }
    if (d.open !== undefined) {
      dataMax = Math.max(dataMax, d.open);
      dataMin = Math.min(dataMin, d.open);
    }
    if (d.close !== undefined) {
      dataMax = Math.max(dataMax, d.close);
      dataMin = Math.min(dataMin, d.close);
    }
  });

  // 处理空数据或无效数据
  if (!isFinite(dataMin) || !isFinite(dataMax)) {
    return { min: 0, max: 100, step: 20 };
  }

  const dataRange = dataMax - dataMin;
  const centerPrice = (dataMax + dataMin) / 2;
  
  // 确保最小范围（避免过于扁平的图表）
  const minRange = centerPrice * minRangePercent;
  const effectiveRange = Math.max(dataRange, minRange);
  
  // 添加边距
  const padding = effectiveRange * paddingPercent;
  
  let min = centerPrice - effectiveRange / 2 - padding;
  let max = centerPrice + effectiveRange / 2 + padding;
  
  // 确保 min 不为负（价格不能为负）
  if (min < 0 && dataMin >= 0) {
    min = 0;
    max = effectiveRange * (1 + paddingPercent * 2);
  }
  
  // 圆整到"好看"的数字
  if (roundToNice) {
    const step = calculateNiceStep(max - min, 5);
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    return { min, max, step };
  }

  return { min, max };
}

/**
 * 计算"好看"的刻度间隔
 */
export function calculateNiceStep(range: number, targetTicks: number): number {
  if (range <= 0 || targetTicks <= 0) return 1;
  
  const roughStep = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  
  let niceStep: number;
  if (normalized <= 1) niceStep = 1;
  else if (normalized <= 2) niceStep = 2;
  else if (normalized <= 5) niceStep = 5;
  else niceStep = 10;
  
  return niceStep * magnitude;
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