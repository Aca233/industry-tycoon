/**
 * 状态指示器组件
 * 用于显示各种状态的霓虹风格指示器
 */

import React from 'react';
import { NEON_PALETTE } from '../../styles/theme';

// 状态类型
type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'processing';

// 尺寸
type StatusSize = 'xs' | 'sm' | 'md' | 'lg';

interface StatusIndicatorProps {
  status: StatusType;
  size?: StatusSize;
  pulse?: boolean;
  label?: string;
  className?: string;
}

// 状态颜色映射
const statusColors: Record<StatusType, {
  bg: string;
  border: string;
  glow: string;
  text: string;
}> = {
  success: {
    bg: 'bg-emerald-500',
    border: 'border-emerald-400',
    glow: 'shadow-[0_0_8px_rgba(0,255,136,0.6)]',
    text: 'text-emerald-400',
  },
  warning: {
    bg: 'bg-amber-500',
    border: 'border-amber-400',
    glow: 'shadow-[0_0_8px_rgba(255,170,0,0.6)]',
    text: 'text-amber-400',
  },
  error: {
    bg: 'bg-red-500',
    border: 'border-red-400',
    glow: 'shadow-[0_0_8px_rgba(255,68,68,0.6)]',
    text: 'text-red-400',
  },
  info: {
    bg: 'bg-cyan-500',
    border: 'border-cyan-400',
    glow: 'shadow-[0_0_8px_rgba(0,245,255,0.6)]',
    text: 'text-cyan-400',
  },
  neutral: {
    bg: 'bg-slate-500',
    border: 'border-slate-400',
    glow: 'shadow-[0_0_8px_rgba(100,116,139,0.4)]',
    text: 'text-slate-400',
  },
  processing: {
    bg: 'bg-violet-500',
    border: 'border-violet-400',
    glow: 'shadow-[0_0_8px_rgba(139,92,246,0.6)]',
    text: 'text-violet-400',
  },
};

// 尺寸映射
const sizeStyles: Record<StatusSize, {
  dot: string;
  text: string;
  gap: string;
}> = {
  xs: { dot: 'w-1.5 h-1.5', text: 'text-xs', gap: 'gap-1' },
  sm: { dot: 'w-2 h-2', text: 'text-sm', gap: 'gap-1.5' },
  md: { dot: 'w-2.5 h-2.5', text: 'text-sm', gap: 'gap-2' },
  lg: { dot: 'w-3 h-3', text: 'text-base', gap: 'gap-2' },
};

/**
 * 状态指示点
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  pulse = true,
  label,
  className = '',
}) => {
  const colors = statusColors[status];
  const sizes = sizeStyles[size];

  return (
    <span className={`inline-flex items-center ${sizes.gap} ${className}`}>
      <span className="relative inline-flex">
        {/* 主要指示点 */}
        <span 
          className={`${sizes.dot} rounded-full ${colors.bg} ${colors.glow}`}
        />
        
        {/* 脉冲效果 */}
        {pulse && (
          <span 
            className={`absolute inset-0 ${sizes.dot} rounded-full ${colors.bg} animate-ping opacity-75`}
          />
        )}
      </span>
      
      {/* 标签 */}
      {label && (
        <span className={`${sizes.text} ${colors.text}`}>
          {label}
        </span>
      )}
    </span>
  );
};

/**
 * 状态徽章
 */
interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  size = 'md',
  className = '',
}) => {
  const colors = statusColors[status];
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 
        rounded-full border ${colors.border} ${colors.glow}
        bg-slate-800/80 backdrop-blur-sm
        ${sizeClasses[size]}
        ${colors.text}
        ${className}
      `}
    >
      <StatusIndicator status={status} size="xs" pulse={false} />
      {children}
    </span>
  );
};

/**
 * 进度条组件
 */
interface ProgressBarProps {
  value: number;  // 0-100
  max?: number;
  status?: StatusType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  striped?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  status = 'info',
  size = 'md',
  showLabel = false,
  animated = true,
  striped = false,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = statusColors[status];
  
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`w-full ${className}`}>
      {/* 进度条容器 */}
      <div 
        className={`
          w-full ${heightClasses[size]} 
          rounded-full overflow-hidden
          bg-slate-700/50 border border-slate-600/50
        `}
      >
        {/* 进度填充 */}
        <div
          className={`
            h-full rounded-full
            ${colors.bg} ${colors.glow}
            transition-all duration-300 ease-out
            ${striped ? 'bg-stripes' : ''}
            ${animated && striped ? 'animate-stripes' : ''}
          `}
          style={{ 
            width: `${percentage}%`,
            backgroundImage: striped 
              ? 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)'
              : undefined,
            backgroundSize: striped ? '1rem 1rem' : undefined,
          }}
        />
      </div>
      
      {/* 标签 */}
      {showLabel && (
        <div className={`mt-1 text-xs ${colors.text} text-right`}>
          {value.toFixed(0)} / {max}
        </div>
      )}
    </div>
  );
};

/**
 * 环形进度指示器
 */
interface CircularProgressProps {
  value: number;  // 0-100
  size?: number;  // 像素
  strokeWidth?: number;
  status?: StatusType;
  showValue?: boolean;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 48,
  strokeWidth = 4,
  status = 'info',
  showValue = true,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const colors = statusColors[status];

  // 获取实际颜色值
  const getStrokeColor = () => {
    switch (status) {
      case 'success': return NEON_PALETTE.status.profit;
      case 'warning': return NEON_PALETTE.status.warning;
      case 'error': return NEON_PALETTE.status.loss;
      case 'info': return NEON_PALETTE.primary.cyan;
      case 'processing': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* 背景环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(100, 116, 139, 0.3)"
          strokeWidth={strokeWidth}
        />
        
        {/* 进度环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
          style={{
            filter: `drop-shadow(0 0 6px ${getStrokeColor()}80)`,
          }}
        />
      </svg>
      
      {/* 中心数值 */}
      {showValue && (
        <span 
          className={`absolute text-xs font-medium ${colors.text}`}
          style={{ fontSize: size * 0.25 }}
        >
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
};

/**
 * 加载指示器
 */
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: StatusType;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  status = 'info',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  };

  const colors = statusColors[status];

  return (
    <div 
      className={`
        ${sizeClasses[size]} 
        rounded-full 
        border-slate-600/50
        ${colors.border}
        border-t-transparent
        animate-spin
        ${colors.glow}
        ${className}
      `}
      style={{ borderTopColor: 'transparent' }}
    />
  );
};

/**
 * 数据加载骨架屏
 */
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  rounded = 'md',
  className = '',
}) => {
  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={`
        bg-gradient-to-r from-slate-700/50 via-slate-600/50 to-slate-700/50
        animate-pulse
        ${roundedClasses[rounded]}
        ${className}
      `}
      style={{ width, height }}
    />
  );
};

/**
 * 文本骨架屏
 */
interface TextSkeletonProps {
  lines?: number;
  lastLineWidth?: string;
  className?: string;
}

export const TextSkeleton: React.FC<TextSkeletonProps> = ({
  lines = 3,
  lastLineWidth = '60%',
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height="0.875rem"
        />
      ))}
    </div>
  );
};

export default StatusIndicator;