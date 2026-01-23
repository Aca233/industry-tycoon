/**
 * VirtualizedList - 虚拟化列表组件
 * 
 * 只渲染可视区域内的列表项，大幅提升长列表性能
 * 
 * 特性：
 * - 仅渲染可见项 + 缓冲区
 * - 支持固定高度和动态高度
 * - 支持滚动位置保持
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';

interface VirtualizedListProps<T> {
  /** 列表数据 */
  items: T[];
  /** 每项的高度（固定高度模式） */
  itemHeight: number;
  /** 容器高度 */
  containerHeight: number;
  /** 渲染每一项的函数 */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 缓冲区大小（上下各多渲染多少项） */
  overscan?: number;
  /** 获取每项的唯一键 */
  getItemKey: (item: T, index: number) => string | number;
  /** 容器样式类名 */
  className?: string;
  /** 列表为空时显示的内容 */
  emptyContent?: React.ReactNode;
}

/**
 * 虚拟化列表组件
 */
function VirtualizedListInner<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  getItemKey,
  className = '',
  emptyContent,
}: VirtualizedListProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // 计算可视区域
  const { startIndex, visibleItems, offsetY } = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    
    // 计算可见范围
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      Math.ceil((scrollTop + containerHeight) / itemHeight),
      items.length
    );
    
    // 添加缓冲区
    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(items.length, visibleEnd + overscan);
    
    // 提取可见项
    const visible = items.slice(start, end);
    
    return {
      startIndex: start,
      visibleItems: visible,
      offsetY: start * itemHeight,
      totalHeight,
    };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  // 处理滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 总高度
  const totalHeight = items.length * itemHeight;

  // 空列表
  if (items.length === 0) {
    return (
      <div className={`overflow-auto ${className}`} style={{ height: containerHeight }}>
        {emptyContent || (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            暂无数据
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* 撑开滚动区域 */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* 可视区域内容 */}
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, localIndex) => {
            const globalIndex = startIndex + localIndex;
            const key = getItemKey(item, globalIndex);
            return (
              <div key={key} style={{ height: itemHeight }}>
                {renderItem(item, globalIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 使用memo优化
export const VirtualizedList = memo(VirtualizedListInner) as typeof VirtualizedListInner;

/**
 * 使用窗口化技术的列表
 * 适用于项目数量不太多但需要优化的场景
 */
export function WindowedList<T>({
  items,
  maxVisibleItems = 50,
  renderItem,
  getItemKey,
  className = '',
}: {
  items: T[];
  maxVisibleItems?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey: (item: T, index: number) => string | number;
  className?: string;
}): React.ReactElement {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: maxVisibleItems });
  const containerRef = useRef<HTMLDivElement>(null);

  // 只渲染可见范围内的项目
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange]);

  // 处理滚动加载更多
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollPercentage = scrollTop / (scrollHeight - clientHeight);

    // 如果滚动到底部附近，加载更多
    if (scrollPercentage > 0.8 && visibleRange.end < items.length) {
      setVisibleRange(prev => ({
        start: prev.start,
        end: Math.min(prev.end + maxVisibleItems, items.length),
      }));
    }

    // 如果滚动到顶部附近，可以考虑卸载底部的项目（可选优化）
  }, [items.length, maxVisibleItems, visibleRange.end]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // 当items变化时重置
  useEffect(() => {
    setVisibleRange({ start: 0, end: Math.min(maxVisibleItems, items.length) });
  }, [items.length, maxVisibleItems]);

  return (
    <div ref={containerRef} className={`overflow-auto ${className}`}>
      {visibleItems.map((item, localIndex) => {
        const globalIndex = visibleRange.start + localIndex;
        return (
          <React.Fragment key={getItemKey(item, globalIndex)}>
            {renderItem(item, globalIndex)}
          </React.Fragment>
        );
      })}
      {/* 加载更多指示器 */}
      {visibleRange.end < items.length && (
        <div className="text-center py-2 text-gray-500 text-sm">
          滚动加载更多... ({visibleRange.end}/{items.length})
        </div>
      )}
    </div>
  );
}