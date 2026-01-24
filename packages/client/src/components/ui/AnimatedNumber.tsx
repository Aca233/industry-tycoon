/**
 * 动画数字组件
 * 用于显示带动画效果的数值变化
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { NEON_PALETTE } from '../../styles/theme';

interface AnimatedNumberProps {
  value: number;
  duration?: number;  // 动画持续时间(ms)
  delay?: number;     // 延迟开始(ms)
  decimals?: number;  // 小数位数
  prefix?: string;    // 前缀 (如 $, ¥)
  suffix?: string;    // 后缀 (如 %, 个)
  separator?: string; // 千位分隔符
  className?: string;
  showChange?: boolean;      // 显示变化指示
  changeColor?: boolean;     // 变化时改变颜色
  easing?: 'linear' | 'easeOut' | 'easeInOut' | 'spring';
  onComplete?: () => void;
}

// 缓动函数
const easingFunctions = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  spring: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

/**
 * 格式化数字
 */
function formatNumber(
  value: number,
  decimals: number,
  separator: string,
  prefix: string,
  suffix: string
): string {
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  
  // 添加千位分隔符
  const formattedInt = separator
    ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
    : intPart;
  
  const formattedNumber = decPart ? `${formattedInt}.${decPart}` : formattedInt;
  
  return `${prefix}${formattedNumber}${suffix}`;
}

/**
 * 动画数字组件
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 500,
  delay = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = ',',
  className = '',
  showChange = false,
  changeColor = true,
  easing = 'easeOut',
  onComplete,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [changeDirection, setChangeDirection] = useState<'up' | 'down' | null>(null);
  
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startValueRef = useRef<number>(value);

  // 清理动画
  const cancelAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // 动画帧
  const animate = useCallback((timestamp: number) => {
    if (startTimeRef.current === 0) {
      startTimeRef.current = timestamp;
    }
    
    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easingFunctions[easing](progress);
    
    const currentValue = startValueRef.current + (value - startValueRef.current) * easedProgress;
    setDisplayValue(currentValue);
    
    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setDisplayValue(value);
      setIsAnimating(false);
      
      // 清除变化方向指示
      setTimeout(() => {
        setChangeDirection(null);
      }, 1000);
      
      onComplete?.();
    }
  }, [value, duration, easing, onComplete]);

  // 启动动画
  const startAnimation = useCallback(() => {
    cancelAnimation();
    
    startTimeRef.current = 0;
    startValueRef.current = displayValue;
    setIsAnimating(true);
    
    // 设置变化方向
    if (value > previousValue.current) {
      setChangeDirection('up');
    } else if (value < previousValue.current) {
      setChangeDirection('down');
    }
    previousValue.current = value;
    
    animationRef.current = requestAnimationFrame(animate);
  }, [value, displayValue, animate, cancelAnimation]);

  // 值变化时触发动画
  useEffect(() => {
    if (value !== displayValue) {
      if (delay > 0) {
        const timer = setTimeout(startAnimation, delay);
        return () => clearTimeout(timer);
      } else {
        startAnimation();
      }
    }
    
    return cancelAnimation;
  }, [value]);

  // 清理
  useEffect(() => {
    return cancelAnimation;
  }, [cancelAnimation]);

  // 格式化显示值
  const formattedValue = useMemo(
    () => formatNumber(displayValue, decimals, separator, prefix, suffix),
    [displayValue, decimals, separator, prefix, suffix]
  );

  // 变化颜色
  const colorStyle = useMemo(() => {
    if (!changeColor || !changeDirection) return {};
    
    return {
      color: changeDirection === 'up' 
        ? NEON_PALETTE.status.profit 
        : NEON_PALETTE.status.loss,
      textShadow: changeDirection === 'up'
        ? `0 0 10px ${NEON_PALETTE.status.profit}60`
        : `0 0 10px ${NEON_PALETTE.status.loss}60`,
    };
  }, [changeColor, changeDirection]);

  return (
    <span 
      className={`inline-flex items-center gap-1 transition-colors duration-300 ${className}`}
      style={colorStyle}
    >
      <span className={isAnimating ? 'tabular-nums' : ''}>
        {formattedValue}
      </span>
      
      {/* 变化指示器 */}
      {showChange && changeDirection && (
        <span 
          className={`inline-flex transition-opacity duration-500 ${
            changeDirection ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {changeDirection === 'up' ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </span>
      )}
    </span>
  );
};

/**
 * 货币显示组件
 */
interface CurrencyDisplayProps extends Omit<AnimatedNumberProps, 'prefix' | 'decimals'> {
  currency?: 'USD' | 'CNY' | 'EUR' | 'GBP';
}

const currencyConfig = {
  USD: { prefix: '$', decimals: 2 },
  CNY: { prefix: '¥', decimals: 2 },
  EUR: { prefix: '€', decimals: 2 },
  GBP: { prefix: '£', decimals: 2 },
};

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  currency = 'USD',
  ...props
}) => {
  const config = currencyConfig[currency];
  return (
    <AnimatedNumber
      prefix={config.prefix}
      decimals={config.decimals}
      {...props}
    />
  );
};

/**
 * 百分比显示组件
 */
interface PercentageDisplayProps extends Omit<AnimatedNumberProps, 'suffix' | 'decimals'> {
  decimals?: number;
  showSign?: boolean;
}

export const PercentageDisplay: React.FC<PercentageDisplayProps> = ({
  value,
  decimals = 1,
  showSign = true,
  ...props
}) => {
  const displayPrefix = showSign && value > 0 ? '+' : '';
  return (
    <AnimatedNumber
      value={value}
      prefix={displayPrefix}
      suffix="%"
      decimals={decimals}
      changeColor={true}
      showChange={true}
      {...props}
    />
  );
};

/**
 * 计数器组件 - 整数计数
 */
export const Counter: React.FC<Omit<AnimatedNumberProps, 'decimals'>> = (props) => {
  return (
    <AnimatedNumber
      decimals={0}
      duration={800}
      easing="spring"
      {...props}
    />
  );
};

/**
 * 倒计时组件
 */
interface CountdownProps {
  targetTime: number;  // 目标时间戳
  onComplete?: () => void;
  format?: 'HH:MM:SS' | 'MM:SS' | 'SS';
  className?: string;
}

export const Countdown: React.FC<CountdownProps> = ({
  targetTime,
  onComplete,
  format = 'MM:SS',
  className = '',
}) => {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, targetTime - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, targetTime - Date.now());
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [targetTime, onComplete]);

  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');

    switch (format) {
      case 'HH:MM:SS':
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      case 'MM:SS':
        return `${pad(minutes)}:${pad(seconds)}`;
      case 'SS':
        return pad(seconds);
      default:
        return `${pad(minutes)}:${pad(seconds)}`;
    }
  }, [format]);

  const isUrgent = timeLeft < 10000; // 少于10秒

  return (
    <span 
      className={`font-mono tabular-nums ${className} ${
        isUrgent ? 'text-red-400 animate-pulse' : ''
      }`}
    >
      {formatTime(timeLeft)}
    </span>
  );
};

export default AnimatedNumber;