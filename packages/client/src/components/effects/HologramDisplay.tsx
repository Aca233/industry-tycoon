/**
 * HologramDisplay - 全息投影显示效果组件
 * 赛博朋克风格的全息显示界面
 */

import React from 'react';
import { motion } from 'framer-motion';
import { HOLOGRAM_APPEAR_VARIANTS, HOLOGRAM_FLICKER_VARIANTS } from '../../animations';

export interface HologramDisplayProps {
  /** 子元素 */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 是否启用效果 */
  enabled?: boolean;
  /** 是否显示 */
  visible?: boolean;
  /** 全息颜色 */
  color?: 'cyan' | 'magenta' | 'green' | 'amber';
  /** 是否显示扫描线 */
  scanlines?: boolean;
  /** 是否显示边框 */
  border?: boolean;
  /** 是否闪烁 */
  flicker?: boolean;
  /** 大小变体 */
  size?: 'sm' | 'md' | 'lg';
}

// 颜色配置
const colorConfig = {
  cyan: {
    primary: '#00f5ff',
    glow: 'rgba(0, 245, 255, 0.3)',
    border: 'rgba(0, 245, 255, 0.5)',
    scanline: 'rgba(0, 245, 255, 0.03)',
  },
  magenta: {
    primary: '#ff00ff',
    glow: 'rgba(255, 0, 255, 0.3)',
    border: 'rgba(255, 0, 255, 0.5)',
    scanline: 'rgba(255, 0, 255, 0.03)',
  },
  green: {
    primary: '#00ff88',
    glow: 'rgba(0, 255, 136, 0.3)',
    border: 'rgba(0, 255, 136, 0.5)',
    scanline: 'rgba(0, 255, 136, 0.03)',
  },
  amber: {
    primary: '#ffaa00',
    glow: 'rgba(255, 170, 0, 0.3)',
    border: 'rgba(255, 170, 0, 0.5)',
    scanline: 'rgba(255, 170, 0, 0.03)',
  },
};

// 大小配置
const sizeConfig = {
  sm: { padding: '8px', borderRadius: '4px' },
  md: { padding: '16px', borderRadius: '8px' },
  lg: { padding: '24px', borderRadius: '12px' },
};

/**
 * 全息显示组件
 */
export const HologramDisplay: React.FC<HologramDisplayProps> = ({
  children,
  className = '',
  enabled = true,
  visible = true,
  color = 'cyan',
  scanlines = true,
  border = true,
  flicker = true,
  size = 'md',
}) => {
  const colors = colorConfig[color];
  const sizes = sizeConfig[size];
  
  if (!enabled || !visible) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={`relative ${className}`}
      variants={HOLOGRAM_APPEAR_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* 外发光层 */}
      <div 
        className="absolute -inset-1 rounded-lg opacity-50 blur-sm"
        style={{
          background: `radial-gradient(ellipse at center, ${colors.glow}, transparent 70%)`,
        }}
      />
      
      {/* 主容器 */}
      <motion.div
        className="relative overflow-hidden"
        style={{
          padding: sizes.padding,
          borderRadius: sizes.borderRadius,
          background: `linear-gradient(135deg, ${colors.glow}, rgba(0,0,0,0.8))`,
          border: border ? `1px solid ${colors.border}` : 'none',
          boxShadow: `0 0 20px ${colors.glow}, inset 0 0 30px rgba(0,0,0,0.5)`,
        }}
        variants={flicker ? HOLOGRAM_FLICKER_VARIANTS : undefined}
        animate={flicker ? 'animate' : undefined}
      >
        {/* 扫描线效果 */}
        {scanlines && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                ${colors.scanline} 2px,
                ${colors.scanline} 4px
              )`,
              animation: 'scanline-move 8s linear infinite',
            }}
          />
        )}
        
        {/* 顶部高光 */}
        <div 
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
          }}
        />
        
        {/* 内容 */}
        <div className="relative z-10">
          {children}
        </div>
        
        {/* 边角装饰 */}
        {border && (
          <>
            <div 
              className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2"
              style={{ borderColor: colors.primary }}
            />
            <div 
              className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2"
              style={{ borderColor: colors.primary }}
            />
            <div 
              className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2"
              style={{ borderColor: colors.primary }}
            />
            <div 
              className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2"
              style={{ borderColor: colors.primary }}
            />
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

/**
 * 全息文字显示
 */
export const HologramText: React.FC<{
  text: string;
  className?: string;
  color?: 'cyan' | 'magenta' | 'green' | 'amber';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  glow?: boolean;
}> = ({ text, className = '', color = 'cyan', size = 'md', glow = true }) => {
  const colors = colorConfig[color];
  
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-3xl',
  };
  
  return (
    <motion.span
      className={`font-mono ${sizeClasses[size]} ${className}`}
      style={{
        color: colors.primary,
        textShadow: glow 
          ? `0 0 10px ${colors.primary}, 0 0 20px ${colors.glow}, 0 0 30px ${colors.glow}`
          : 'none',
      }}
      animate={{
        opacity: [1, 0.9, 1, 0.95, 1],
        textShadow: glow ? [
          `0 0 10px ${colors.primary}, 0 0 20px ${colors.glow}`,
          `0 0 15px ${colors.primary}, 0 0 30px ${colors.glow}`,
          `0 0 10px ${colors.primary}, 0 0 20px ${colors.glow}`,
        ] : undefined,
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {text}
    </motion.span>
  );
};

/**
 * 全息数据显示
 */
export const HologramData: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
  color?: 'cyan' | 'magenta' | 'green' | 'amber';
  trend?: 'up' | 'down' | 'neutral';
}> = ({ label, value, unit, className = '', color = 'cyan', trend }) => {
  const colors = colorConfig[color];
  
  const trendColors = {
    up: '#00ff88',
    down: '#ff4444',
    neutral: colors.primary,
  };
  
  const trendIcons = {
    up: '▲',
    down: '▼',
    neutral: '●',
  };
  
  return (
    <div className={`flex flex-col ${className}`}>
      <span 
        className="text-xs uppercase tracking-wider opacity-70"
        style={{ color: colors.primary }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <HologramText 
          text={String(value)} 
          color={color} 
          size="lg" 
        />
        {unit && (
          <span 
            className="text-sm opacity-60"
            style={{ color: colors.primary }}
          >
            {unit}
          </span>
        )}
        {trend && (
          <motion.span
            className="text-sm ml-2"
            style={{ color: trendColors[trend] }}
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {trendIcons[trend]}
          </motion.span>
        )}
      </div>
    </div>
  );
};

export default HologramDisplay;