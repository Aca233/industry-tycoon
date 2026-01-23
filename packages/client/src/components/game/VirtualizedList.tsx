/**
 * VirtualizedList - 虚拟列表组件
 * 
 * 用于渲染大量列表项时的性能优化
 * 只渲染可见区域内的项目，减少 DOM 节点数量
 * 
 * 性能优化：
 * - 只渲染可见项 + 缓冲区
 * - 使用 memo 避免不必要的重渲染
 * - 支持固定高度项目
 */

import { useRef, useState, useCallback, memo, type ReactNode, type CSSProperties } from 'react';

interface VirtualizedListProps<T> {
  /** 数据列表 */
  items: T[];
  /** 每项的固定高度 */
  itemHeight: number;
  /** 容器高度 */
  containerHeight: number;
  /** 渲染单个项目 */
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode;
  /** 缓冲区大小（上下各渲染多少额外项） */
  overscan?: number;
  /** 容器样式类名 */
  className?: string;
  /** 唯一键提取函数 */
  getKey?: (item: T, index: number) => string | number;
}

// 虚拟列表组件
function VirtualizedListInner<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
  getKey = (_, index) => index,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // 计算可见范围
  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length - 1, Math.floor(scrollTop / itemHeight) + visibleCount + overscan);

  // 滚动处理
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 渲染可见项
  const visibleItems: ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const item = items[i];
    if (item !== undefined) {
      const style: CSSProperties = {
        position: 'absolute',
        top: i * itemHeight,
        left: 0,
        right: 0,
        height: itemHeight,
      };
      visibleItems.push(
        <div key={getKey(item, i)} style={style}>
          {renderItem(item, i, style)}
        </div>
      );
    }
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto relative ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
}

// 使用 memo 包装以优化性能
export const VirtualizedList = memo(VirtualizedListInner) as typeof VirtualizedListInner;

// 简化版虚拟列表（用于新闻列表等）
interface SimpleVirtualListProps {
  items: Array<{ id: string; content: ReactNode }>;
  itemHeight: number;
  maxHeight: number;
  className?: string;
}

export const SimpleVirtualList = memo(function SimpleVirtualList({
  items,
  itemHeight,
  maxHeight,
  className = '',
}: SimpleVirtualListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const containerHeight = Math.min(maxHeight, items.length * itemHeight);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const overscan = 2;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length - 1, Math.floor(scrollTop / itemHeight) + visibleCount + overscan);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 如果项目少于 20 个，不使用虚拟化
  if (items.length < 20) {
    return (
      <div className={`overflow-auto ${className}`} style={{ maxHeight }}>
        {items.map(item => (
          <div key={item.id} style={{ height: itemHeight }}>
            {item.content}
          </div>
        ))}
      </div>
    );
  }

  const visibleItems: ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const item = items[i];
    if (item) {
      visibleItems.push(
        <div
          key={item.id}
          style={{
            position: 'absolute',
            top: i * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
          }}
        >
          {item.content}
        </div>
      );
    }
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto relative ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
});

export default VirtualizedList;