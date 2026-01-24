/**
 * SimplePriceChart - 轻量级价格走势图
 * 使用原生 Canvas API 实现，高性能实时更新
 * 支持鼠标滚轮缩放和拖拽平移
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { PriceHistoryEntry } from '../../stores';

// 游戏开始日期（作为时间基准）
const GAME_START_DATE = new Date('2025-01-01');

// 将 tick 转换为日期
function tickToDate(tick: number): Date {
  const date = new Date(GAME_START_DATE);
  date.setDate(date.getDate() + tick);
  return date;
}

// 格式化日期显示
function formatDate(date: Date, showYear: boolean = false): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  if (showYear) {
    return `${date.getFullYear()}-${month}-${day}`;
  }
  return `${month}-${day}`;
}

interface SimplePriceChartProps {
  data: PriceHistoryEntry[];
  width: number;
  height: number;
  lineColor?: string;
  fillColor?: string;
  gridColor?: string;
  textColor?: string;
  showGrid?: boolean;
  showLabels?: boolean;
}

export function SimplePriceChart({
  data,
  width,
  height,
  lineColor = '#00d4ff',
  fillColor = 'rgba(0, 212, 255, 0.1)',
  gridColor = 'rgba(255, 255, 255, 0.1)',
  textColor = '#888',
  showGrid = true,
  showLabels = true,
}: SimplePriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  // 视窗状态：显示数据的起始索引和结束索引
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(data.length);
  
  // 拖拽状态
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartViewRef = useRef({ start: 0, end: 0 });
  
  // 当数据长度变化时，更新视窗以显示最新数据
  useEffect(() => {
    const viewLength = viewEnd - viewStart;
    // 如果视窗结束位置接近之前的数据末尾，保持跟随最新数据
    if (viewEnd >= data.length - 5 || viewEnd === 0) {
      const newEnd = data.length;
      const newStart = Math.max(0, newEnd - viewLength);
      setViewEnd(newEnd);
      setViewStart(newStart > 0 ? newStart : 0);
    }
  }, [data.length]);
  
  // 获取当前视窗内的数据
  const visibleData = data.slice(
    Math.max(0, Math.floor(viewStart)),
    Math.min(data.length, Math.ceil(viewEnd))
  );
  
  // 绘制函数
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    if (visibleData.length < 2) {
      // 数据不足时显示提示
      ctx.fillStyle = textColor;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('等待数据...', width / 2, height / 2);
      return;
    }
    
    // 计算价格范围（单位：分）
    const prices = visibleData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    
    // 添加边距
    const padding = { top: 20, right: 55, bottom: 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // 扩展价格范围 5%
    const expandedMin = minPrice - priceRange * 0.05;
    const expandedMax = maxPrice + priceRange * 0.05;
    const expandedRange = expandedMax - expandedMin;
    
    // 坐标转换函数
    const xScale = (index: number) => padding.left + (index / (visibleData.length - 1)) * chartWidth;
    const yScale = (price: number) => padding.top + (1 - (price - expandedMin) / expandedRange) * chartHeight;
    
    // 绘制网格
    if (showGrid) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      
      // 横向网格线（5条）
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (i / 4) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }
      
      // 纵向网格线（根据数据量）
      const xGridCount = Math.min(6, visibleData.length - 1);
      for (let i = 0; i <= xGridCount; i++) {
        const x = padding.left + (i / xGridCount) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
      }
    }
    
    // 绘制填充区域
    ctx.beginPath();
    ctx.moveTo(xScale(0), height - padding.bottom);
    for (let i = 0; i < visibleData.length; i++) {
      ctx.lineTo(xScale(i), yScale(visibleData[i].price));
    }
    ctx.lineTo(xScale(visibleData.length - 1), height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    
    // 绘制折线
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(visibleData[0].price));
    for (let i = 1; i < visibleData.length; i++) {
      ctx.lineTo(xScale(i), yScale(visibleData[i].price));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 绘制最新价格点
    const lastIndex = visibleData.length - 1;
    const lastPrice = visibleData[lastIndex].price;
    const lastX = xScale(lastIndex);
    const lastY = yScale(lastPrice);
    
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    
    // 绘制标签
    if (showLabels) {
      ctx.fillStyle = textColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      
      // Y轴标签（价格，分转元）
      for (let i = 0; i <= 4; i++) {
        const price = expandedMax - (i / 4) * expandedRange;
        const y = padding.top + (i / 4) * chartHeight;
        ctx.fillText(`¥${(price / 100).toFixed(1)}`, width - 5, y + 3);
      }
      
      // X轴标签（标准日期格式）
      ctx.textAlign = 'center';
      const labelCount = Math.min(5, visibleData.length);
      const timeSpan = visibleData.length > 0
        ? visibleData[visibleData.length - 1].tick - visibleData[0].tick
        : 0;
      const showYear = timeSpan > 90; // 超过90天显示年份
      
      for (let i = 0; i < labelCount; i++) {
        const dataIndex = Math.floor((i / (labelCount - 1)) * (visibleData.length - 1));
        const x = xScale(dataIndex);
        const tick = visibleData[dataIndex].tick;
        const date = tickToDate(tick);
        ctx.fillText(formatDate(date, showYear), x, height - 10);
      }
      
      // 当前价格标签
      ctx.fillStyle = lineColor;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`¥${(lastPrice / 100).toFixed(2)}`, lastX + 8, lastY + 4);
    }
  }, [visibleData, width, height, lineColor, fillColor, gridColor, textColor, showGrid, showLabels]);
  
  // 处理鼠标滚轮缩放
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    if (data.length < 2) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const chartLeft = 10;
    const chartRight = width - 55;
    const chartWidth = chartRight - chartLeft;
    
    // 计算鼠标在图表中的相对位置 (0-1)
    const mouseRatio = Math.max(0, Math.min(1, (mouseX - chartLeft) / chartWidth));
    
    // 当前视窗范围
    const currentRange = viewEnd - viewStart;
    
    // 缩放因子：向上滚动放大，向下滚动缩小
    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
    const newRange = Math.max(10, Math.min(data.length, currentRange * zoomFactor));
    
    // 以鼠标位置为中心进行缩放
    const mouseDataPos = viewStart + mouseRatio * currentRange;
    const newStart = mouseDataPos - mouseRatio * newRange;
    const newEnd = mouseDataPos + (1 - mouseRatio) * newRange;
    
    // 边界检查
    let adjustedStart = Math.max(0, newStart);
    let adjustedEnd = Math.min(data.length, newEnd);
    
    // 如果到达边界，调整另一端
    if (adjustedStart === 0) {
      adjustedEnd = Math.min(data.length, adjustedStart + newRange);
    }
    if (adjustedEnd === data.length) {
      adjustedStart = Math.max(0, adjustedEnd - newRange);
    }
    
    setViewStart(adjustedStart);
    setViewEnd(adjustedEnd);
  }, [data.length, viewStart, viewEnd, width]);
  
  // 处理鼠标拖拽
  const handleMouseDown = useCallback((e: MouseEvent) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartViewRef.current = { start: viewStart, end: viewEnd };
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'grabbing';
    }
  }, [viewStart, viewEnd]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const chartWidth = width - 65; // padding.left + padding.right
    const deltaX = e.clientX - dragStartXRef.current;
    const currentRange = dragStartViewRef.current.end - dragStartViewRef.current.start;
    
    // 将像素移动转换为数据索引移动
    const deltaData = -(deltaX / chartWidth) * currentRange;
    
    let newStart = dragStartViewRef.current.start + deltaData;
    let newEnd = dragStartViewRef.current.end + deltaData;
    
    // 边界检查
    if (newStart < 0) {
      newStart = 0;
      newEnd = currentRange;
    }
    if (newEnd > data.length) {
      newEnd = data.length;
      newStart = data.length - currentRange;
    }
    
    setViewStart(Math.max(0, newStart));
    setViewEnd(Math.min(data.length, newEnd));
  }, [data.length, width]);
  
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'grab';
    }
  }, []);
  
  // 绑定事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // 设置初始光标
    canvas.style.cursor = 'grab';
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);
  
  // 当数据变化时重绘
  useEffect(() => {
    // 取消之前的动画帧
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // 使用 requestAnimationFrame 确保平滑渲染
    animationRef.current = requestAnimationFrame(draw);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);
  
  // 处理高 DPI 显示
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    
    draw();
  }, [width, height, draw]);
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
      }}
    />
  );
}

export default SimplePriceChart;