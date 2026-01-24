/**
 * GlitchText - 故障艺术文字效果组件
 * 赛博朋克风格的故障闪烁文字
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export interface GlitchTextProps {
  /** 显示的文字 */
  text: string;
  /** 自定义类名 */
  className?: string;
  /** 是否启用故障效果 */
  enabled?: boolean;
  /** 故障强度 (0-1) */
  intensity?: number;
  /** 主色调 */
  primaryColor?: string;
  /** 偏移色1 */
  glitchColor1?: string;
  /** 偏移色2 */
  glitchColor2?: string;
  /** 是否持续故障 */
  continuous?: boolean;
  /** 点击事件 */
  onClick?: () => void;
}

/**
 * 故障文字组件
 */
export const GlitchText: React.FC<GlitchTextProps> = ({
  text,
  className = '',
  enabled = true,
  intensity = 0.5,
  primaryColor = '#00f5ff',
  glitchColor1 = '#ff00ff',
  glitchColor2 = '#00ff00',
  continuous = true,
  onClick,
}) => {
  // 生成随机偏移量
  const glitchOffset = useMemo(() => {
    return {
      x1: 2 * intensity,
      x2: -2 * intensity,
      y1: 1 * intensity,
      y2: -1 * intensity,
    };
  }, [intensity]);
  
  // 连续故障动画变体
  const continuousVariants = {
    animate: {
      textShadow: [
        `${glitchOffset.x1}px ${glitchOffset.y1}px 0 ${glitchColor1}, ${glitchOffset.x2}px ${glitchOffset.y2}px 0 ${glitchColor2}`,
        `${-glitchOffset.x1}px ${-glitchOffset.y1}px 0 ${glitchColor1}, ${-glitchOffset.x2}px ${-glitchOffset.y2}px 0 ${glitchColor2}`,
        `${glitchOffset.x2}px ${-glitchOffset.y1}px 0 ${glitchColor1}, ${glitchOffset.x1}px ${glitchOffset.y2}px 0 ${glitchColor2}`,
        `0 0 0 transparent, 0 0 0 transparent`,
        `${glitchOffset.x1}px ${glitchOffset.y1}px 0 ${glitchColor1}, ${glitchOffset.x2}px ${glitchOffset.y2}px 0 ${glitchColor2}`,
      ],
      x: [0, -2 * intensity, 2 * intensity, 0, 0],
      transition: {
        duration: 0.5,
        repeat: Infinity,
        repeatDelay: 3,
        times: [0, 0.2, 0.4, 0.6, 1],
      },
    },
  };
  
  if (!enabled) {
    return (
      <span 
        className={className} 
        style={{ color: primaryColor }}
        onClick={onClick}
      >
        {text}
      </span>
    );
  }
  
  return (
    <motion.span
      className={`relative inline-block ${className}`}
      style={{ color: primaryColor }}
      variants={continuous ? continuousVariants : undefined}
      animate={continuous ? 'animate' : undefined}
      whileHover={!continuous ? {
        textShadow: `${glitchOffset.x1}px ${glitchOffset.y1}px 0 ${glitchColor1}, ${glitchOffset.x2}px ${glitchOffset.y2}px 0 ${glitchColor2}`,
        x: [-1, 1, -1, 0],
        transition: { duration: 0.2 },
      } : undefined}
      onClick={onClick}
      data-text={text}
    >
      {text}
    </motion.span>
  );
};

/**
 * 强烈故障效果文字 - 带有剪切遮罩
 */
export const GlitchTextIntense: React.FC<GlitchTextProps> = ({
  text,
  className = '',
  enabled = true,
  intensity = 1,
  primaryColor = '#ffffff',
  glitchColor1 = '#ff00ff',
  glitchColor2 = '#00f5ff',
}) => {
  if (!enabled) {
    return <span className={className} style={{ color: primaryColor }}>{text}</span>;
  }
  
  return (
    <div className={`relative ${className}`}>
      {/* 主文字 */}
      <span 
        className="relative z-10"
        style={{ color: primaryColor }}
      >
        {text}
      </span>
      
      {/* 故障层1 */}
      <motion.span
        className="absolute top-0 left-0 z-20"
        style={{ 
          color: glitchColor1,
          clipPath: 'polygon(0 0, 100% 0, 100% 35%, 0 35%)',
          opacity: 0.8,
        }}
        animate={{
          x: [0, -2 * intensity, 2 * intensity, 0],
          opacity: [0, 0.8, 0.8, 0],
        }}
        transition={{
          duration: 0.3,
          repeat: Infinity,
          repeatDelay: 2,
        }}
      >
        {text}
      </motion.span>
      
      {/* 故障层2 */}
      <motion.span
        className="absolute top-0 left-0 z-20"
        style={{ 
          color: glitchColor2,
          clipPath: 'polygon(0 65%, 100% 65%, 100% 100%, 0 100%)',
          opacity: 0.8,
        }}
        animate={{
          x: [0, 2 * intensity, -2 * intensity, 0],
          opacity: [0, 0.8, 0.8, 0],
        }}
        transition={{
          duration: 0.3,
          repeat: Infinity,
          repeatDelay: 2,
          delay: 0.1,
        }}
      >
        {text}
      </motion.span>
    </div>
  );
};

export default GlitchText;