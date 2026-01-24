/**
 * EnergyMeter - 能量表/进度表组件
 * 赛博朋克风格的能量显示器
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ENERGY_CHARGE_VARIANTS } from '../../animations';

export interface EnergyMeterProps {
  /** 当前值 (0-100) */
  value: number;
  /** 最大值 */
  max?: number;
  /** 标签 */
  label?: string;
  /** 显示数值 */
  showValue?: boolean;
  /** 单位 */
  unit?: string;
  /** 自定义类名 */
  className?: string;
  /** 颜色主题 */
  color?: 'cyan' | 'magenta' | 'green' | 'amber' | 'red' | 'auto';
  /** 样式变体 */
  variant?: 'bar' | 'arc' | 'segments' | 'wave';
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否显示发光效果 */
  glow?: boolean;
  /** 是否显示动画 */
  animated?: boolean;
  /** 警告阈值 */
  warningThreshold?: number;
  /** 危险阈值 */
  dangerThreshold?: number;
}

// 颜色配置
const colorConfig = {
  cyan: { primary: '#00f5ff', glow: 'rgba(0, 245, 255, 0.5)' },
  magenta: { primary: '#ff00ff', glow: 'rgba(255, 0, 255, 0.5)' },
  green: { primary: '#00ff88', glow: 'rgba(0, 255, 136, 0.5)' },
  amber: { primary: '#ffaa00', glow: 'rgba(255, 170, 0, 0.5)' },
  red: { primary: '#ff4444', glow: 'rgba(255, 68, 68, 0.5)' },
};

// 尺寸配置
const sizeConfig = {
  sm: { height: 8, fontSize: 'text-xs', labelSize: 'text-xs' },
  md: { height: 12, fontSize: 'text-sm', labelSize: 'text-sm' },
  lg: { height: 16, fontSize: 'text-base', labelSize: 'text-base' },
};

/**
 * 获取自动颜色
 */
function getAutoColor(percentage: number, warningThreshold: number, dangerThreshold: number) {
  if (percentage <= dangerThreshold) return colorConfig.red;
  if (percentage <= warningThreshold) return colorConfig.amber;
  return colorConfig.green;
}

/**
 * 条形能量表
 */
export const EnergyMeter: React.FC<EnergyMeterProps> = ({
  value,
  max = 100,
  label,
  showValue = true,
  unit = '%',
  className = '',
  color = 'cyan',
  variant = 'bar',
  size = 'md',
  glow = true,
  animated = true,
  warningThreshold = 30,
  dangerThreshold = 15,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const sizes = sizeConfig[size];
  
  // 确定颜色
  const colors = color === 'auto' 
    ? getAutoColor(percentage, warningThreshold, dangerThreshold)
    : colorConfig[color];
  
  // 根据变体渲染不同样式
  switch (variant) {
    case 'segments':
      return (
        <SegmentedMeter
          percentage={percentage}
          value={value}
          max={max}
          label={label}
          showValue={showValue}
          unit={unit}
          className={className}
          colors={colors}
          sizes={sizes}
          glow={glow}
          animated={animated}
        />
      );
    case 'arc':
      return (
        <ArcMeter
          percentage={percentage}
          value={value}
          max={max}
          label={label}
          showValue={showValue}
          unit={unit}
          className={className}
          colors={colors}
          size={size}
          glow={glow}
          animated={animated}
        />
      );
    case 'wave':
      return (
        <WaveMeter
          percentage={percentage}
          value={value}
          label={label}
          showValue={showValue}
          unit={unit}
          className={className}
          colors={colors}
          sizes={sizes}
          glow={glow}
        />
      );
    default:
      return (
        <BarMeter
          percentage={percentage}
          value={value}
          max={max}
          label={label}
          showValue={showValue}
          unit={unit}
          className={className}
          colors={colors}
          sizes={sizes}
          glow={glow}
          animated={animated}
        />
      );
  }
};

// 条形仪表
interface MeterProps {
  percentage: number;
  value: number;
  max?: number;
  label?: string;
  showValue: boolean;
  unit: string;
  className: string;
  colors: { primary: string; glow: string };
  sizes: { height: number; fontSize: string; labelSize: string };
  glow: boolean;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const BarMeter: React.FC<MeterProps> = ({
  percentage,
  value,
  label,
  showValue,
  unit,
  className,
  colors,
  sizes,
  glow,
  animated,
}) => {
  return (
    <div className={`w-full ${className}`}>
      {/* 标签和数值 */}
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className={`${sizes.labelSize} text-gray-400`}>{label}</span>
          )}
          {showValue && (
            <span 
              className={`${sizes.fontSize} font-mono`}
              style={{ color: colors.primary }}
            >
              {Math.round(value)}{unit}
            </span>
          )}
        </div>
      )}
      
      {/* 进度条容器 */}
      <div 
        className="relative overflow-hidden rounded-full bg-slate-800"
        style={{ height: sizes.height }}
      >
        {/* 背景网格 */}
        <div 
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 8px,
              rgba(255,255,255,0.05) 8px,
              rgba(255,255,255,0.05) 10px
            )`,
          }}
        />
        
        {/* 进度条 */}
        <motion.div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${colors.primary}80, ${colors.primary})`,
            boxShadow: glow ? `0 0 10px ${colors.glow}` : 'none',
          }}
          variants={animated ? ENERGY_CHARGE_VARIANTS : undefined}
          animate={animated ? 'animate' : undefined}
          custom={percentage / 100}
          initial={false}
        />
        
        {/* 高光效果 */}
        <div 
          className="absolute top-0 left-0 right-0 h-1/2 rounded-t-full"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
};

// 分段仪表
const SegmentedMeter: React.FC<MeterProps> = ({
  percentage,
  value,
  label,
  showValue,
  unit,
  className,
  colors,
  sizes,
  glow,
  animated,
}) => {
  const segments = 10;
  const activeSegments = Math.ceil((percentage / 100) * segments);
  
  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className={`${sizes.labelSize} text-gray-400`}>{label}</span>
          )}
          {showValue && (
            <span 
              className={`${sizes.fontSize} font-mono`}
              style={{ color: colors.primary }}
            >
              {Math.round(value)}{unit}
            </span>
          )}
        </div>
      )}
      
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-sm"
            style={{ 
              height: sizes.height,
              backgroundColor: i < activeSegments ? colors.primary : 'rgba(100,100,100,0.3)',
              boxShadow: i < activeSegments && glow ? `0 0 8px ${colors.glow}` : 'none',
            }}
            initial={animated ? { opacity: 0, scaleY: 0 } : false}
            animate={{ 
              opacity: 1, 
              scaleY: 1,
              backgroundColor: i < activeSegments ? colors.primary : 'rgba(100,100,100,0.3)',
            }}
            transition={{ 
              delay: animated ? i * 0.05 : 0,
              duration: 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// 弧形仪表
const ArcMeter: React.FC<Omit<MeterProps, 'sizes'> & { size: 'sm' | 'md' | 'lg' }> = ({
  percentage,
  value,
  label,
  showValue,
  unit,
  className,
  colors,
  size,
  glow,
  animated,
}) => {
  const sizeMap = { sm: 80, md: 120, lg: 160 };
  const strokeMap = { sm: 6, md: 8, lg: 10 };
  const diameter = sizeMap[size];
  const stroke = strokeMap[size];
  const radius = (diameter - stroke) / 2;
  const circumference = radius * Math.PI; // 半圆
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: diameter, height: diameter / 2 + 20 }}>
        <svg 
          width={diameter} 
          height={diameter / 2 + stroke}
          className="transform -rotate-180"
        >
          {/* 背景弧 */}
          <path
            d={`M ${stroke / 2} ${diameter / 2} A ${radius} ${radius} 0 0 1 ${diameter - stroke / 2} ${diameter / 2}`}
            fill="none"
            stroke="rgba(100,100,100,0.3)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          
          {/* 进度弧 */}
          <motion.path
            d={`M ${stroke / 2} ${diameter / 2} A ${radius} ${radius} 0 0 1 ${diameter - stroke / 2} ${diameter / 2}`}
            fill="none"
            stroke={colors.primary}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{
              filter: glow ? `drop-shadow(0 0 6px ${colors.glow})` : 'none',
            }}
            initial={animated ? { strokeDashoffset: circumference } : false}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        
        {/* 中心数值 */}
        {showValue && (
          <div 
            className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center"
          >
            <span 
              className="text-xl font-bold font-mono"
              style={{ color: colors.primary }}
            >
              {Math.round(value)}
            </span>
            <span className="text-xs text-gray-400 ml-0.5">{unit}</span>
          </div>
        )}
      </div>
      
      {label && (
        <span className="text-sm text-gray-400 mt-1">{label}</span>
      )}
    </div>
  );
};

// 波浪仪表
const WaveMeter: React.FC<MeterProps> = ({
  percentage,
  value,
  label,
  showValue,
  unit,
  className,
  colors,
  sizes,
  glow,
}) => {
  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className={`${sizes.labelSize} text-gray-400`}>{label}</span>
          )}
          {showValue && (
            <span 
              className={`${sizes.fontSize} font-mono`}
              style={{ color: colors.primary }}
            >
              {Math.round(value)}{unit}
            </span>
          )}
        </div>
      )}
      
      <div 
        className="relative overflow-hidden rounded-full bg-slate-800"
        style={{ height: sizes.height * 2 }}
      >
        {/* 波浪效果 */}
        <motion.div
          className="absolute bottom-0 left-0 w-[200%]"
          style={{
            height: `${percentage}%`,
            background: `linear-gradient(180deg, ${colors.primary}60, ${colors.primary})`,
            boxShadow: glow ? `0 0 15px ${colors.glow}` : 'none',
          }}
          animate={{
            x: [0, '-50%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <svg 
            viewBox="0 0 200 20" 
            preserveAspectRatio="none"
            className="absolute top-0 left-0 w-full h-4 -translate-y-1/2"
          >
            <path
              d="M0,10 C50,0 50,20 100,10 C150,0 150,20 200,10 L200,20 L0,20 Z"
              fill={colors.primary}
            />
          </svg>
        </motion.div>
      </div>
    </div>
  );
};

export default EnergyMeter;