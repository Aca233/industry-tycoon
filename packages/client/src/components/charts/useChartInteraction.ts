/**
 * 图表交互钩子
 * 提供缩放、拖拽、悬浮等交互功能
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChartViewport, CrosshairData, ChartConfig, ChartDimensions } from './types';

interface UseChartInteractionOptions {
  dataLength: number;
  dimensions: ChartDimensions;
  config: ChartConfig;
  onViewportChange?: (viewport: ChartViewport) => void;
}

interface UseChartInteractionReturn {
  viewport: ChartViewport;
  crosshair: CrosshairData;
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  setViewport: (viewport: ChartViewport) => void;
  resetViewport: () => void;
}

export function useChartInteraction({
  dataLength,
  dimensions,
  config,
  onViewportChange,
}: UseChartInteractionOptions): UseChartInteractionReturn {
  // 初始视口：显示所有数据
  const [viewport, setViewportState] = useState<ChartViewport>(() => ({
    startIndex: 0,
    endIndex: dataLength,
    scaleY: 1,
  }));
  
  const [crosshair, setCrosshair] = useState<CrosshairData>({
    x: 0,
    y: 0,
    visible: false,
    price: 0,
    tick: 0,
  });

  // 交互状态
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, startIndex: 0 });
  const lastTouchDistance = useRef(0);
  const prevDataLengthRef = useRef(dataLength);

  // 更新视口（带边界检查）
  const setViewport = useCallback((newViewport: ChartViewport) => {
    setViewportState(prev => {
      // 边界检查
      const validViewport: ChartViewport = {
        startIndex: Math.max(0, Math.min(newViewport.startIndex, dataLength - config.minVisibleCandles)),
        endIndex: Math.min(dataLength, Math.max(newViewport.endIndex, config.minVisibleCandles)),
        scaleY: newViewport.scaleY,
      };

      // 确保可见范围在限制内
      const visibleCount = validViewport.endIndex - validViewport.startIndex;
      if (visibleCount < config.minVisibleCandles) {
        validViewport.endIndex = validViewport.startIndex + config.minVisibleCandles;
      }
      if (visibleCount > config.maxVisibleCandles) {
        validViewport.startIndex = validViewport.endIndex - config.maxVisibleCandles;
      }

      // 检查是否真的变化了
      if (prev.startIndex === validViewport.startIndex &&
          prev.endIndex === validViewport.endIndex &&
          prev.scaleY === validViewport.scaleY) {
        return prev;
      }

      onViewportChange?.(validViewport);
      return validViewport;
    });
  }, [dataLength, config.minVisibleCandles, config.maxVisibleCandles, onViewportChange]);

  // 重置视口
  const resetViewport = useCallback(() => {
    setViewportState({
      startIndex: 0,
      endIndex: dataLength,
      scaleY: 1,
    });
  }, [dataLength]);

  // 当数据长度变化时，更新视口（只在真正变化时触发）
  useEffect(() => {
    if (prevDataLengthRef.current !== dataLength) {
      prevDataLengthRef.current = dataLength;
      
      // 使用函数式更新避免依赖 viewport
      setViewportState(prev => {
        // 如果当前视口已经超出范围，调整到有效范围
        if (prev.endIndex > dataLength || prev.startIndex >= dataLength) {
          const visibleCount = prev.endIndex - prev.startIndex;
          return {
            ...prev,
            startIndex: Math.max(0, dataLength - visibleCount),
            endIndex: dataLength,
          };
        }
        return prev;
      });
    }
  }, [dataLength]);

  // 计算图表区域宽度
  const chartWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;

  // 鼠标按下
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!config.enablePan) return;
    
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      startIndex: viewport.startIndex,
    };
  }, [config.enablePan, viewport.startIndex]);

  // 鼠标移动
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 更新十字光标
    if (config.showCrosshair && 
        x >= dimensions.margin.left && 
        x <= dimensions.width - dimensions.margin.right &&
        y >= dimensions.margin.top && 
        y <= dimensions.height - dimensions.margin.bottom) {
      
      const visibleCount = viewport.endIndex - viewport.startIndex;
      const indexRatio = (x - dimensions.margin.left) / chartWidth;
      const dataIndex = Math.floor(viewport.startIndex + indexRatio * visibleCount);
      
      setCrosshair({
        x,
        y,
        visible: true,
        price: 0, // 需要由父组件计算
        tick: dataIndex,
      });
    } else {
      setCrosshair(prev => ({ ...prev, visible: false }));
    }

    // 拖拽平移
    if (isDragging.current && config.enablePan) {
      const deltaX = e.clientX - dragStart.current.x;
      const dataPerPixel = (viewport.endIndex - viewport.startIndex) / chartWidth;
      const indexDelta = Math.round(-deltaX * dataPerPixel);
      
      const newStartIndex = dragStart.current.startIndex + indexDelta;
      const visibleCount = viewport.endIndex - viewport.startIndex;
      
      setViewport({
        ...viewport,
        startIndex: newStartIndex,
        endIndex: newStartIndex + visibleCount,
      });
    }
  }, [config.showCrosshair, config.enablePan, dimensions, chartWidth, viewport, setViewport]);

  // 鼠标抬起
  const onMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // 鼠标离开
  const onMouseLeave = useCallback(() => {
    isDragging.current = false;
    setCrosshair(prev => ({ ...prev, visible: false }));
  }, []);

  // 滚轮缩放
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!config.enableZoom) return;
    
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = (mouseX - dimensions.margin.left) / chartWidth;
    
    const visibleCount = viewport.endIndex - viewport.startIndex;
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9; // 放大或缩小
    const newVisibleCount = Math.round(visibleCount * zoomFactor);
    
    // 以鼠标位置为中心缩放
    const centerIndex = viewport.startIndex + Math.floor(visibleCount * ratio);
    const newStartIndex = centerIndex - Math.floor(newVisibleCount * ratio);
    const newEndIndex = newStartIndex + newVisibleCount;
    
    setViewport({
      ...viewport,
      startIndex: newStartIndex,
      endIndex: newEndIndex,
    });
  }, [config.enableZoom, dimensions.margin.left, chartWidth, viewport, setViewport]);

  // 触摸开始
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && config.enablePan) {
      // 单指拖拽
      isDragging.current = true;
      dragStart.current = {
        x: e.touches[0].clientX,
        startIndex: viewport.startIndex,
      };
    } else if (e.touches.length === 2 && config.enableZoom) {
      // 双指缩放
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = distance;
    }
  }, [config.enablePan, config.enableZoom, viewport.startIndex]);

  // 触摸移动
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging.current && config.enablePan) {
      // 单指拖拽
      const deltaX = e.touches[0].clientX - dragStart.current.x;
      const dataPerPixel = (viewport.endIndex - viewport.startIndex) / chartWidth;
      const indexDelta = Math.round(-deltaX * dataPerPixel);
      
      const newStartIndex = dragStart.current.startIndex + indexDelta;
      const visibleCount = viewport.endIndex - viewport.startIndex;
      
      setViewport({
        ...viewport,
        startIndex: newStartIndex,
        endIndex: newStartIndex + visibleCount,
      });
    } else if (e.touches.length === 2 && config.enableZoom) {
      // 双指缩放
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      if (lastTouchDistance.current > 0) {
        const scale = lastTouchDistance.current / distance;
        const visibleCount = viewport.endIndex - viewport.startIndex;
        const newVisibleCount = Math.round(visibleCount * scale);
        
        // 以中心点为基准缩放
        const centerIndex = viewport.startIndex + Math.floor(visibleCount / 2);
        const newStartIndex = centerIndex - Math.floor(newVisibleCount / 2);
        const newEndIndex = newStartIndex + newVisibleCount;
        
        setViewport({
          ...viewport,
          startIndex: newStartIndex,
          endIndex: newEndIndex,
        });
      }
      
      lastTouchDistance.current = distance;
    }
  }, [config.enablePan, config.enableZoom, chartWidth, viewport, setViewport]);

  // 触摸结束
  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    lastTouchDistance.current = 0;
  }, []);

  return {
    viewport,
    crosshair,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onWheel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    setViewport,
    resetViewport,
  };
}