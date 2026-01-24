/**
 * 霓虹发光按钮组件
 * 赛博朋克风格的交互按钮
 */

import React, { forwardRef, useCallback } from 'react';
import { useUISound } from '../../audio';

// 按钮变体
type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';

// 按钮尺寸
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface NeonButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  glow?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  soundEnabled?: boolean;
}

// 尺寸样式映射
const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
  xl: 'px-6 py-3 text-lg',
};

// 变体样式映射
const variantStyles: Record<ButtonVariant, {
  base: string;
  hover: string;
  active: string;
  glow: string;
}> = {
  primary: {
    base: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-500/50',
    hover: 'hover:from-cyan-500 hover:to-blue-500 hover:border-cyan-400/70',
    active: 'active:from-cyan-700 active:to-blue-700',
    glow: 'hover:shadow-[0_0_20px_rgba(0,245,255,0.4)]',
  },
  secondary: {
    base: 'bg-slate-700/80 text-gray-200 border-slate-600/50',
    hover: 'hover:bg-slate-600/80 hover:border-slate-500/70',
    active: 'active:bg-slate-800',
    glow: 'hover:shadow-[0_0_15px_rgba(100,116,139,0.3)]',
  },
  success: {
    base: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-500/50',
    hover: 'hover:from-emerald-500 hover:to-green-500 hover:border-emerald-400/70',
    active: 'active:from-emerald-700 active:to-green-700',
    glow: 'hover:shadow-[0_0_20px_rgba(0,255,136,0.4)]',
  },
  danger: {
    base: 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-500/50',
    hover: 'hover:from-red-500 hover:to-rose-500 hover:border-red-400/70',
    active: 'active:from-red-700 active:to-rose-700',
    glow: 'hover:shadow-[0_0_20px_rgba(255,68,68,0.4)]',
  },
  warning: {
    base: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-500/50',
    hover: 'hover:from-amber-500 hover:to-orange-500 hover:border-amber-400/70',
    active: 'active:from-amber-700 active:to-orange-700',
    glow: 'hover:shadow-[0_0_20px_rgba(255,170,0,0.4)]',
  },
  ghost: {
    base: 'bg-transparent text-cyan-400 border-cyan-500/30',
    hover: 'hover:bg-cyan-500/10 hover:border-cyan-400/50',
    active: 'active:bg-cyan-500/20',
    glow: 'hover:shadow-[0_0_15px_rgba(0,245,255,0.2)]',
  },
};

/**
 * 霓虹发光按钮
 */
export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  glow = true,
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  soundEnabled = true,
  className = '',
  onClick,
  disabled,
  ...props
}, ref) => {
  const { playClick } = useUISound();
  
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    
    if (soundEnabled) {
      playClick();
    }
    
    onClick?.(e);
  }, [disabled, loading, soundEnabled, playClick, onClick]);

  const styles = variantStyles[variant];
  
  const buttonClassName = [
    // 基础样式
    'relative inline-flex items-center justify-center gap-2',
    'font-medium rounded-lg border',
    'transition-all duration-200 ease-out',
    'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900',
    'overflow-hidden',
    
    // 尺寸
    sizeStyles[size],
    
    // 变体样式
    styles.base,
    !disabled && !loading && styles.hover,
    !disabled && !loading && styles.active,
    glow && !disabled && !loading && styles.glow,
    
    // 宽度
    fullWidth && 'w-full',
    
    // 禁用状态
    (disabled || loading) && 'opacity-50 cursor-not-allowed',
    
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      className={buttonClassName}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {/* 扫描光效果 */}
      {!disabled && !loading && (
        <span 
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <span 
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            }}
          />
        </span>
      )}
      
      {/* 加载指示器 */}
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </span>
      )}
      
      {/* 内容 */}
      <span className={`relative z-10 flex items-center gap-2 ${loading ? 'invisible' : ''}`}>
        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </span>
    </button>
  );
});

NeonButton.displayName = 'NeonButton';

/**
 * 图标按钮 - 只有图标的圆形按钮
 */
interface IconButtonProps extends Omit<NeonButtonProps, 'leftIcon' | 'rightIcon' | 'fullWidth'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({
  icon,
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const sizeMap: Record<ButtonSize, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14',
  };

  return (
    <NeonButton
      ref={ref}
      size={size}
      className={`!p-0 ${sizeMap[size]} rounded-full ${className}`}
      {...props}
    >
      {icon}
    </NeonButton>
  );
});

IconButton.displayName = 'IconButton';

/**
 * 链接样式按钮
 */
export const LinkButton = forwardRef<HTMLButtonElement, NeonButtonProps>(({
  className = '',
  ...props
}, ref) => {
  return (
    <NeonButton
      ref={ref}
      variant="ghost"
      glow={false}
      className={`!border-0 !bg-transparent underline-offset-4 hover:underline ${className}`}
      {...props}
    />
  );
});

LinkButton.displayName = 'LinkButton';

export default NeonButton;