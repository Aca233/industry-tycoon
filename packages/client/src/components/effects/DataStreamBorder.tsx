/**
 * DataStreamBorder - 数据流动边框效果组件
 * 赛博朋克风格的流动数据边框
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface DataStreamBorderProps {
  /** 子元素 */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 是否启用效果 */
  enabled?: boolean;
  /** 边框颜色 */
  color?: 'cyan' | 'magenta' | 'green' | 'amber' | 'rainbow';
  /** 流动速度 (秒) */
  speed?: number;
  /** 边框宽度 */
  borderWidth?: number;
  /** 是否显示边角装饰 */
  corners?: boolean;
  /** 圆角大小 */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

// 颜色配置
const colorConfig = {
  cyan: ['#00f5ff', '#00b8c4'],
  magenta: ['#ff00ff', '#cc00cc'],
  green: ['#00ff88', '#00cc6d'],
  amber: ['#ffaa00', '#cc8800'],
  rainbow: ['#ff00ff', '#00f5ff', '#00ff88', '#ffaa00', '#ff00ff'],
};

// 圆角配置
const roundedConfig = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
};

/**
 * 数据流边框组件
 */
export const DataStreamBorder: React.FC<DataStreamBorderProps> = ({
  children,
  className = '',
  enabled = true,
  color = 'cyan',
  speed = 3,
  borderWidth = 2,
  corners = true,
  rounded = 'md',
}) => {
  const colors = colorConfig[color];
  const borderRadius = roundedConfig[rounded];
  
  if (!enabled) {
    return <div className={className}>{children}</div>;
  }
  
  // 创建渐变字符串
  const gradientColors = colors.join(', ');
  
  return (
    <div 
      className={`relative ${className}`}
      style={{ padding: borderWidth }}
    >
      {/* 流动边框背景 */}
      <motion.div
        className="absolute inset-0"
        style={{
          borderRadius,
          background: `linear-gradient(90deg, ${gradientColors})`,
          backgroundSize: '200% 100%',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '200% 50%'],
        }}
        transition={{
          duration: speed,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      
      {/* 内容容器 */}
      <div 
        className="relative bg-slate-900"
        style={{ borderRadius: `calc(${borderRadius} - ${borderWidth}px)` }}
      >
        {children}
      </div>
      
      {/* 边角装饰 */}
      {corners && (
        <>
          {/* 左上角 */}
          <div 
            className="absolute -top-1 -left-1 w-3 h-3"
            style={{
              borderTop: `2px solid ${colors[0]}`,
              borderLeft: `2px solid ${colors[0]}`,
              boxShadow: `0 0 10px ${colors[0]}`,
            }}
          />
          {/* 右上角 */}
          <div 
            className="absolute -top-1 -right-1 w-3 h-3"
            style={{
              borderTop: `2px solid ${colors[0]}`,
              borderRight: `2px solid ${colors[0]}`,
              boxShadow: `0 0 10px ${colors[0]}`,
            }}
          />
          {/* 左下角 */}
          <div 
            className="absolute -bottom-1 -left-1 w-3 h-3"
            style={{
              borderBottom: `2px solid ${colors[0]}`,
              borderLeft: `2px solid ${colors[0]}`,
              boxShadow: `0 0 10px ${colors[0]}`,
            }}
          />
          {/* 右下角 */}
          <div 
            className="absolute -bottom-1 -right-1 w-3 h-3"
            style={{
              borderBottom: `2px solid ${colors[0]}`,
              borderRight: `2px solid ${colors[0]}`,
              boxShadow: `0 0 10px ${colors[0]}`,
            }}
          />
        </>
      )}
    </div>
  );
};

/**
 * 脉冲边框组件
 */
export const PulseBorder: React.FC<DataStreamBorderProps> = ({
  children,
  className = '',
  enabled = true,
  color = 'cyan',
  speed = 2,
  borderWidth = 1,
  rounded = 'md',
}) => {
  const colors = colorConfig[color];
  const borderRadius = roundedConfig[rounded];
  
  if (!enabled) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={`relative ${className}`}
      style={{
        borderRadius,
        border: `${borderWidth}px solid ${colors[0]}`,
      }}
      animate={{
        boxShadow: [
          `0 0 5px ${colors[0]}40, 0 0 10px ${colors[0]}20`,
          `0 0 20px ${colors[0]}80, 0 0 40px ${colors[0]}40`,
          `0 0 5px ${colors[0]}40, 0 0 10px ${colors[0]}20`,
        ],
        borderColor: [colors[0], colors[1] || colors[0], colors[0]],
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * 扫描边框组件
 */
export const ScanBorder: React.FC<DataStreamBorderProps & { direction?: 'horizontal' | 'vertical' }> = ({
  children,
  className = '',
  enabled = true,
  color = 'cyan',
  speed = 2,
  borderWidth = 1,
  rounded = 'md',
  direction = 'horizontal',
}) => {
  const colors = colorConfig[color];
  const borderRadius = roundedConfig[rounded];
  
  if (!enabled) {
    return <div className={className}>{children}</div>;
  }
  
  const isHorizontal = direction === 'horizontal';
  
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius,
        border: `${borderWidth}px solid ${colors[0]}40`,
      }}
    >
      {/* 扫描线 */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          ...(isHorizontal 
            ? { top: 0, bottom: 0, width: '50%' }
            : { left: 0, right: 0, height: '50%' }
          ),
          background: isHorizontal
            ? `linear-gradient(90deg, transparent, ${colors[0]}80, transparent)`
            : `linear-gradient(180deg, transparent, ${colors[0]}80, transparent)`,
        }}
        animate={isHorizontal
          ? { left: ['-50%', '150%'] }
          : { top: ['-50%', '150%'] }
        }
        transition={{
          duration: speed,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      
      {children}
    </div>
  );
};

/**
 * 电路边框组件
 */
export const CircuitBorder: React.FC<DataStreamBorderProps> = ({
  children,
  className = '',
  enabled = true,
  color = 'cyan',
  borderWidth = 2,
  rounded = 'md',
}) => {
  const colors = colorConfig[color];
  const borderRadius = roundedConfig[rounded];
  
  if (!enabled) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <div
      className={`relative ${className}`}
      style={{
        borderRadius,
        border: `${borderWidth}px solid ${colors[0]}50`,
      }}
    >
      {/* 电路节点 */}
      <div 
        className="absolute top-0 left-1/4 w-2 h-2 -translate-y-1/2 rounded-full"
        style={{ 
          backgroundColor: colors[0],
          boxShadow: `0 0 10px ${colors[0]}`,
        }}
      />
      <div 
        className="absolute top-0 right-1/4 w-2 h-2 -translate-y-1/2 rounded-full"
        style={{ 
          backgroundColor: colors[0],
          boxShadow: `0 0 10px ${colors[0]}`,
        }}
      />
      <div 
        className="absolute bottom-0 left-1/3 w-2 h-2 translate-y-1/2 rounded-full"
        style={{ 
          backgroundColor: colors[0],
          boxShadow: `0 0 10px ${colors[0]}`,
        }}
      />
      <div 
        className="absolute bottom-0 right-1/3 w-2 h-2 translate-y-1/2 rounded-full"
        style={{ 
          backgroundColor: colors[0],
          boxShadow: `0 0 10px ${colors[0]}`,
        }}
      />
      
      {/* 脉冲动画节点 */}
      <motion.div 
        className="absolute -top-1 left-1/2 w-2 h-2 -translate-x-1/2 rounded-full"
        style={{ backgroundColor: colors[0] }}
        animate={{
          boxShadow: [
            `0 0 5px ${colors[0]}`,
            `0 0 20px ${colors[0]}`,
            `0 0 5px ${colors[0]}`,
          ],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {children}
    </div>
  );
};

export default DataStreamBorder;