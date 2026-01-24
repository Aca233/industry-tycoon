/**
 * CyberProgress - 赛博朋克进度条组件
 * 多种风格的进度显示组件
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface CyberProgressProps {
  /** 进度值 (0-100) */
  value: number;
  /** 标签 */
  label?: string;
  /** 是否显示百分比 */
  showPercent?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 颜色主题 */
  color?: 'cyan' | 'magenta' | 'green' | 'amber' | 'gradient';
  /** 尺寸 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 是否显示条纹动画 */
  striped?: boolean;
  /** 是否显示发光效果 */
  glow?: boolean;
  /** 是否不确定状态 */
  indeterminate?: boolean;
}

// 颜色配置
const colorConfig = {
  cyan: {
    primary: '#00f5ff',
    secondary: '#00b8c4',
    glow: 'rgba(0, 245, 255, 0.5)',
  },
  magenta: {
    primary: '#ff00ff',
    secondary: '#cc00cc',
    glow: 'rgba(255, 0, 255, 0.5)',
  },
  green: {
    primary: '#00ff88',
    secondary: '#00cc6d',
    glow: 'rgba(0, 255, 136, 0.5)',
  },
  amber: {
    primary: '#ffaa00',
    secondary: '#cc8800',
    glow: 'rgba(255, 170, 0, 0.5)',
  },
  gradient: {
    primary: 'linear-gradient(90deg, #00f5ff, #ff00ff)',
    secondary: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.5)',
  },
};

// 尺寸配置
const sizeConfig = {
  xs: { height: 4, fontSize: 'text-xs' },
  sm: { height: 6, fontSize: 'text-xs' },
  md: { height: 8, fontSize: 'text-sm' },
  lg: { height: 12, fontSize: 'text-base' },
};

/**
 * 赛博进度条组件
 */
export const CyberProgress: React.FC<CyberProgressProps> = ({
  value,
  label,
  showPercent = true,
  className = '',
  color = 'cyan',
  size = 'md',
  striped = false,
  glow = true,
  indeterminate = false,
}) => {
  const colors = colorConfig[color];
  const sizes = sizeConfig[size];
  const percentage = Math.min(100, Math.max(0, value));
  
  return (
    <div className={`w-full ${className}`}>
      {/* 标签和百分比 */}
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className={`${sizes.fontSize} text-gray-400`}>{label}</span>
          )}
          {showPercent && !indeterminate && (
            <span 
              className={`${sizes.fontSize} font-mono`}
              style={{ color: typeof colors.primary === 'string' && !colors.primary.includes('gradient') ? colors.primary : '#00f5ff' }}
            >
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      
      {/* 进度条容器 */}
      <div 
        className="relative overflow-hidden rounded-full"
        style={{ 
          height: sizes.height,
          backgroundColor: 'rgba(30, 41, 59, 0.8)',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* 进度条 */}
        {indeterminate ? (
          // 不确定状态动画
          <motion.div
            className="absolute top-0 h-full rounded-full"
            style={{
              width: '30%',
              background: colors.primary,
              boxShadow: glow ? `0 0 10px ${colors.glow}` : 'none',
            }}
            animate={{
              left: ['-30%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ) : (
          <motion.div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              background: colors.primary,
              boxShadow: glow ? `0 0 10px ${colors.glow}` : 'none',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* 条纹效果 */}
            {striped && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `repeating-linear-gradient(
                    -45deg,
                    transparent,
                    transparent 8px,
                    rgba(255, 255, 255, 0.1) 8px,
                    rgba(255, 255, 255, 0.1) 16px
                  )`,
                }}
                animate={{
                  backgroundPosition: ['0 0', '32px 0'],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            )}
            
            {/* 高光 */}
            <div 
              className="absolute top-0 left-0 right-0 h-1/2 rounded-t-full"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)',
              }}
            />
          </motion.div>
        )}
        
        {/* 刻度线 */}
        <div className="absolute inset-0 flex justify-between px-0.5">
          {[...Array(10)].map((_, i) => (
            <div 
              key={i}
              className="w-px h-full"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 圆形进度组件
 */
export interface CircularProgressProps {
  /** 进度值 (0-100) */
  value: number;
  /** 尺寸 */
  size?: number;
  /** 描边宽度 */
  strokeWidth?: number;
  /** 颜色 */
  color?: 'cyan' | 'magenta' | 'green' | 'amber';
  /** 是否显示数值 */
  showValue?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 中心内容 */
  children?: React.ReactNode;
  /** 是否发光 */
  glow?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 80,
  strokeWidth = 6,
  color = 'cyan',
  showValue = true,
  className = '',
  children,
  glow = true,
}) => {
  const colors = colorConfig[color];
  const percentage = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* 背景圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(100, 100, 100, 0.3)"
          strokeWidth={strokeWidth}
        />
        
        {/* 进度圆环 */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.primary as string}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{
            filter: glow ? `drop-shadow(0 0 6px ${colors.glow})` : 'none',
          }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      
      {/* 中心内容 */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (showValue && (
          <span 
            className="text-lg font-bold font-mono"
            style={{ color: colors.primary as string }}
          >
            {Math.round(percentage)}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * 步骤进度组件
 */
export interface StepProgressProps {
  /** 当前步骤 (从0开始) */
  current: number;
  /** 步骤列表 */
  steps: string[];
  /** 颜色 */
  color?: 'cyan' | 'magenta' | 'green' | 'amber';
  /** 自定义类名 */
  className?: string;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  current,
  steps,
  color = 'cyan',
  className = '',
}) => {
  const colors = colorConfig[color];
  
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            {/* 步骤点 */}
            <motion.div
              className="relative flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{
                  backgroundColor: index <= current 
                    ? colors.primary as string
                    : 'rgba(100, 100, 100, 0.3)',
                  color: index <= current ? '#0d1117' : '#888',
                  boxShadow: index <= current 
                    ? `0 0 15px ${colors.glow}`
                    : 'none',
                }}
                animate={index === current ? {
                  boxShadow: [
                    `0 0 10px ${colors.glow}`,
                    `0 0 20px ${colors.glow}`,
                    `0 0 10px ${colors.glow}`,
                  ],
                } : {}}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                }}
              >
                {index < current ? '✓' : index + 1}
              </motion.div>
              
              {/* 步骤标签 */}
              <span 
                className="absolute -bottom-6 text-xs whitespace-nowrap"
                style={{ 
                  color: index <= current ? colors.primary as string : '#888',
                }}
              >
                {step}
              </span>
            </motion.div>
            
            {/* 连接线 */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 bg-slate-700 relative overflow-hidden">
                <motion.div
                  className="absolute top-0 left-0 h-full"
                  style={{ backgroundColor: colors.primary as string }}
                  initial={{ width: 0 }}
                  animate={{ 
                    width: index < current ? '100%' : '0%',
                  }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/**
 * 加载进度组件
 */
export interface LoadingProgressProps {
  /** 加载文本 */
  text?: string;
  /** 颜色 */
  color?: 'cyan' | 'magenta' | 'green' | 'amber';
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 自定义类名 */
  className?: string;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({
  text = 'Loading...',
  color = 'cyan',
  size = 'md',
  className = '',
}) => {
  const colors = colorConfig[color];
  const sizes = sizeConfig[size];
  
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* 加载条 */}
      <div 
        className="relative overflow-hidden rounded-full w-48"
        style={{ 
          height: sizes.height,
          backgroundColor: 'rgba(30, 41, 59, 0.8)',
        }}
      >
        <motion.div
          className="absolute top-0 h-full rounded-full"
          style={{
            width: '40%',
            background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
            boxShadow: `0 0 10px ${colors.glow}`,
          }}
          animate={{
            left: ['-40%', '100%'],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
      
      {/* 加载文本 */}
      <motion.span
        className={`${sizes.fontSize} font-mono`}
        style={{ color: colors.primary as string }}
        animate={{
          opacity: [1, 0.5, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
        }}
      >
        {text}
      </motion.span>
    </div>
  );
};

export default CyberProgress;