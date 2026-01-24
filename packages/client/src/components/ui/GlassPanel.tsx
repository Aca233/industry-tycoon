/**
 * 玻璃态面板组件
 * 提供赛博朋克风格的半透明面板效果
 */

import React from 'react';
import { GLASS_EFFECTS } from '../../styles/theme';

// 面板变体类型
type GlassPanelVariant = 'default' | 'elevated' | 'inset' | 'holographic' | 'warning' | 'success';

// 边框发光颜色
type BorderGlow = 'none' | 'cyan' | 'magenta' | 'profit' | 'loss' | 'warning';

interface GlassPanelProps {
  children: React.ReactNode;
  variant?: GlassPanelVariant;
  borderGlow?: BorderGlow;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  scanlines?: boolean;
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

// 内边距映射
const paddingMap = {
  none: '',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

// 圆角映射
const roundedMap = {
  none: 'rounded-none',
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
};

// 边框发光样式
const borderGlowStyles: Record<BorderGlow, string> = {
  none: '',
  cyan: 'border-cyan-400/50 shadow-[0_0_20px_rgba(0,245,255,0.2)]',
  magenta: 'border-pink-400/50 shadow-[0_0_20px_rgba(255,0,255,0.2)]',
  profit: 'border-green-400/50 shadow-[0_0_20px_rgba(0,255,136,0.2)]',
  loss: 'border-red-400/50 shadow-[0_0_20px_rgba(255,68,68,0.2)]',
  warning: 'border-amber-400/50 shadow-[0_0_20px_rgba(255,170,0,0.2)]',
};

/**
 * 玻璃态面板组件
 */
export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  variant = 'default',
  borderGlow = 'none',
  className = '',
  padding = 'md',
  rounded = 'lg',
  scanlines = false,
  hover = false,
  onClick,
  style,
}) => {
  // 获取变体样式
  const variantStyle = GLASS_EFFECTS[variant] || GLASS_EFFECTS.default;
  
  // 组合类名
  const combinedClassName = [
    'relative overflow-hidden',
    paddingMap[padding],
    roundedMap[rounded],
    borderGlowStyles[borderGlow],
    hover && 'transition-all duration-300 hover:scale-[1.01] hover:shadow-lg cursor-pointer',
    onClick && 'cursor-pointer',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={combinedClassName}
      style={{
        ...variantStyle,
        ...style,
      }}
      onClick={onClick}
    >
      {/* 扫描线效果 */}
      {scanlines && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 245, 255, 0.03) 2px, rgba(0, 245, 255, 0.03) 4px)',
            animation: 'scanline-move 8s linear infinite',
          }}
        />
      )}
      
      {/* 内容 */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

/**
 * 全息面板 - 预设的全息投影效果
 */
export const HolographicPanel: React.FC<Omit<GlassPanelProps, 'variant'>> = (props) => (
  <GlassPanel {...props} variant="holographic" scanlines />
);

/**
 * 卡片面板 - 用于内容卡片
 */
export const CardPanel: React.FC<Omit<GlassPanelProps, 'variant' | 'hover'>> = (props) => (
  <GlassPanel {...props} variant="elevated" hover />
);

/**
 * 内嵌面板 - 用于表单输入区域等
 */
export const InsetPanel: React.FC<Omit<GlassPanelProps, 'variant'>> = (props) => (
  <GlassPanel {...props} variant="inset" />
);

/**
 * 状态面板 - 带状态指示的面板
 */
interface StatusPanelProps extends Omit<GlassPanelProps, 'variant' | 'borderGlow'> {
  status: 'success' | 'warning' | 'error' | 'info';
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ status, ...props }) => {
  const statusMap: Record<string, { variant: GlassPanelVariant; borderGlow: BorderGlow }> = {
    success: { variant: 'success', borderGlow: 'profit' },
    warning: { variant: 'warning', borderGlow: 'warning' },
    error: { variant: 'default', borderGlow: 'loss' },
    info: { variant: 'holographic', borderGlow: 'cyan' },
  };
  
  const config = statusMap[status] || statusMap.info;
  
  return (
    <GlassPanel {...props} variant={config.variant} borderGlow={config.borderGlow} />
  );
};

/**
 * 弹出面板 - 用于模态框、弹出菜单等
 */
export const PopupPanel: React.FC<GlassPanelProps> = (props) => (
  <GlassPanel
    {...props}
    variant="elevated"
    className={`shadow-2xl ${props.className || ''}`}
    style={{
      ...props.style,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 245, 255, 0.1)',
    }}
  />
);

/**
 * 工具栏面板 - 紧凑的工具栏样式
 */
export const ToolbarPanel: React.FC<Omit<GlassPanelProps, 'padding' | 'rounded'>> = (props) => (
  <GlassPanel {...props} padding="sm" rounded="md" variant="default" />
);

export default GlassPanel;