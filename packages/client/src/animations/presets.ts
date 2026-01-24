/**
 * Framer Motion 动画预设
 * 统一管理游戏的动画效果
 */

import { Variants, Transition, TargetAndTransition } from 'framer-motion';

// ==================== 过渡配置 ====================

export const TRANSITION_PRESETS = {
  // 弹性效果 - 用于按钮、卡片
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 25,
  } as Transition,
  
  // 快速弹性 - 用于快速响应
  snappy: {
    type: 'spring',
    stiffness: 500,
    damping: 30,
  } as Transition,
  
  // 柔和弹性 - 用于大型元素
  gentle: {
    type: 'spring',
    stiffness: 200,
    damping: 20,
  } as Transition,
  
  // 平滑过渡 - 通用
  smooth: {
    type: 'tween',
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1],
  } as Transition,
  
  // 快速过渡 - 即时反馈
  fast: {
    type: 'tween',
    duration: 0.15,
    ease: 'easeOut',
  } as Transition,
  
  // 缓慢过渡 - 装饰性动画
  slow: {
    type: 'tween',
    duration: 0.6,
    ease: 'easeInOut',
  } as Transition,
  
  // 极慢过渡 - 背景动画
  verySlow: {
    type: 'tween',
    duration: 1,
    ease: 'linear',
  } as Transition,
};

// ==================== 页面/面板切换 ====================

export const PAGE_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TRANSITION_PRESETS.smooth,
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: { duration: 0.2 },
  },
};

export const PAGE_SLIDE_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    x: 40,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: TRANSITION_PRESETS.spring,
  },
  exit: {
    opacity: 0,
    x: -40,
    transition: { duration: 0.2 },
  },
};

// ==================== 模态框 ====================

export const MODAL_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
    y: 40,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: TRANSITION_PRESETS.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 },
  },
};

export const MODAL_OVERLAY_VARIANTS: Variants = {
  initial: { 
    opacity: 0,
    backdropFilter: 'blur(0px)',
  },
  animate: { 
    opacity: 1,
    backdropFilter: 'blur(8px)',
    transition: { duration: 0.2 },
  },
  exit: { 
    opacity: 0,
    backdropFilter: 'blur(0px)',
    transition: { duration: 0.15 },
  },
};

// ==================== 侧边栏/抽屉 ====================

export const DRAWER_VARIANTS: Variants = {
  initial: {
    x: '100%',
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: TRANSITION_PRESETS.spring,
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.25 },
  },
};

export const DRAWER_LEFT_VARIANTS: Variants = {
  initial: {
    x: '-100%',
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: TRANSITION_PRESETS.spring,
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: { duration: 0.25 },
  },
};

// ==================== 列表项 ====================

export const LIST_CONTAINER_VARIANTS: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

export const LIST_ITEM_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    x: -20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: TRANSITION_PRESETS.snappy,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.15 },
  },
};

export const LIST_ITEM_FADE_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: TRANSITION_PRESETS.smooth,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.15 },
  },
};

// ==================== 卡片 ====================

export const CARD_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TRANSITION_PRESETS.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

export const CARD_HOVER_VARIANTS: Variants = {
  initial: {
    scale: 1,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 8px 24px rgba(0, 245, 255, 0.2)',
    transition: TRANSITION_PRESETS.snappy,
  },
  tap: {
    scale: 0.98,
  },
};

// ==================== 按钮 ====================

export const BUTTON_VARIANTS: Variants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: { duration: 0.15 },
  },
  tap: {
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

export const BUTTON_GLOW_VARIANTS: Variants = {
  initial: { 
    scale: 1,
    boxShadow: '0 0 0 rgba(0, 245, 255, 0)',
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 0 20px rgba(0, 245, 255, 0.4)',
    transition: { duration: 0.2 },
  },
  tap: {
    scale: 0.98,
    boxShadow: '0 0 10px rgba(0, 245, 255, 0.3)',
  },
};

// ==================== 通知/Toast ====================

export const TOAST_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    x: 100,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: TRANSITION_PRESETS.spring,
  },
  exit: {
    opacity: 0,
    x: 50,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

export const TOAST_TOP_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: -50,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TRANSITION_PRESETS.spring,
  },
  exit: {
    opacity: 0,
    y: -30,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

// ==================== 弹出菜单 ====================

export const POPUP_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
    y: -10,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: TRANSITION_PRESETS.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -5,
    transition: { duration: 0.15 },
  },
};

export const DROPDOWN_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },
  animate: {
    opacity: 1,
    height: 'auto',
    transition: {
      height: TRANSITION_PRESETS.spring,
      opacity: { duration: 0.2 },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.15 },
    },
  },
};

// ==================== 工具提示 ====================

export const TOOLTIP_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.1 },
  },
};

// ==================== 数字变化 ====================

export const NUMBER_CHANGE_VARIANTS: Variants = {
  initial: { opacity: 0, y: -10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.2 },
  },
  exit: { 
    opacity: 0, 
    y: 10,
    transition: { duration: 0.15 },
  },
};

export const NUMBER_INCREASE_VARIANTS: Variants = {
  initial: { opacity: 0, y: 20, color: '#00ff88' },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: TRANSITION_PRESETS.spring,
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.15 },
  },
};

export const NUMBER_DECREASE_VARIANTS: Variants = {
  initial: { opacity: 0, y: -20, color: '#ff4444' },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: TRANSITION_PRESETS.spring,
  },
  exit: { 
    opacity: 0, 
    y: 10,
    transition: { duration: 0.15 },
  },
};

// ==================== 霓虹效果 ====================

export const NEON_FLICKER_VARIANTS: Variants = {
  animate: {
    opacity: [1, 0.8, 1, 0.9, 1],
    textShadow: [
      '0 0 10px rgba(0, 245, 255, 0.8)',
      '0 0 20px rgba(0, 245, 255, 0.4)',
      '0 0 10px rgba(0, 245, 255, 0.8)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatType: 'mirror' as const,
    },
  },
};

export const PULSE_GLOW_VARIANTS: Variants = {
  animate: {
    boxShadow: [
      '0 0 20px rgba(0, 245, 255, 0.3)',
      '0 0 40px rgba(0, 245, 255, 0.6)',
      '0 0 20px rgba(0, 245, 255, 0.3)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const BORDER_GLOW_VARIANTS: Variants = {
  animate: {
    borderColor: [
      'rgba(0, 245, 255, 0.3)',
      'rgba(0, 245, 255, 0.6)',
      'rgba(0, 245, 255, 0.3)',
    ],
    boxShadow: [
      '0 0 10px rgba(0, 245, 255, 0.2)',
      '0 0 20px rgba(0, 245, 255, 0.4)',
      '0 0 10px rgba(0, 245, 255, 0.2)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ==================== 进度条 ====================

export const PROGRESS_BAR_VARIANTS: Variants = {
  initial: { width: 0 },
  animate: (custom: number) => ({
    width: `${Math.min(100, Math.max(0, custom))}%`,
    transition: { duration: 0.5, ease: 'easeOut' },
  }),
};

export const PROGRESS_SHIMMER_VARIANTS: Variants = {
  animate: {
    x: ['-100%', '200%'],
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatDelay: 1,
      ease: 'linear',
    },
  },
};

// ==================== 加载状态 ====================

export const LOADING_SPIN_VARIANTS: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const LOADING_PULSE_VARIANTS: Variants = {
  animate: {
    scale: [1, 1.1, 1],
    opacity: [1, 0.7, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const LOADING_DOTS_VARIANTS: Variants = {
  animate: {
    opacity: [0.3, 1, 0.3],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ==================== 扫描线效果 ====================

export const SCANLINE_VARIANTS: Variants = {
  animate: {
    y: ['0%', '100%'],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ==================== 状态指示器 ====================

export const STATUS_PULSE_VARIANTS: Variants = {
  animate: {
    scale: [1, 1.2, 1],
    opacity: [1, 0.7, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const STATUS_BLINK_VARIANTS: Variants = {
  animate: {
    opacity: [1, 0.4, 1],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ==================== 辅助函数 ====================

/**
 * 创建延迟动画变体
 */
export function createDelayedVariants(delay: number): Variants {
  return {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        ...TRANSITION_PRESETS.spring,
        delay,
      },
    },
  };
}

/**
 * 创建交错动画容器变体
 */
export function createStaggerVariants(staggerDelay: number = 0.05): Variants {
  return {
    initial: {},
    animate: {
      transition: {
        staggerChildren: staggerDelay,
      },
    },
    exit: {
      transition: {
        staggerChildren: staggerDelay / 2,
        staggerDirection: -1,
      },
    },
  };
}

/**
 * 创建自定义悬停效果
 */
export function createHoverEffect(scale: number = 1.02, glowColor: string = '0, 245, 255'): TargetAndTransition {
  return {
    scale,
    boxShadow: `0 0 20px rgba(${glowColor}, 0.4)`,
    transition: TRANSITION_PRESETS.snappy,
  };
}

// ==================== 数据流动效果 ====================

export const DATA_STREAM_VARIANTS: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.5, ease: 'easeInOut' },
      opacity: { duration: 0.3 },
    },
  },
  exit: {
    pathLength: 0,
    opacity: 0,
    transition: { duration: 0.3 },
  },
};

export const DATA_POINT_VARIANTS: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: TRANSITION_PRESETS.spring,
  },
  highlight: {
    scale: 1.5,
    boxShadow: '0 0 20px rgba(0, 245, 255, 0.8)',
    transition: { duration: 0.2 },
  },
};

// ==================== 全息出现效果 ====================

export const HOLOGRAM_APPEAR_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scaleY: 0.1,
    filter: 'blur(10px) brightness(2)',
  },
  animate: {
    opacity: 1,
    scaleY: 1,
    filter: 'blur(0px) brightness(1)',
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    scaleY: 0.1,
    filter: 'blur(10px) brightness(2)',
    transition: { duration: 0.3 },
  },
};

export const HOLOGRAM_FLICKER_VARIANTS: Variants = {
  animate: {
    opacity: [1, 0.8, 1, 0.9, 1, 0.85, 1],
    filter: [
      'hue-rotate(0deg)',
      'hue-rotate(5deg)',
      'hue-rotate(-5deg)',
      'hue-rotate(0deg)',
    ],
    transition: {
      duration: 4,
      repeat: Infinity,
      repeatType: 'mirror' as const,
    },
  },
};

// ==================== 能量脉冲效果 ====================

export const ENERGY_PULSE_VARIANTS: Variants = {
  animate: {
    scale: [1, 1.02, 1],
    boxShadow: [
      '0 0 10px rgba(0, 245, 255, 0.3), inset 0 0 10px rgba(0, 245, 255, 0.1)',
      '0 0 30px rgba(0, 245, 255, 0.6), inset 0 0 20px rgba(0, 245, 255, 0.2)',
      '0 0 10px rgba(0, 245, 255, 0.3), inset 0 0 10px rgba(0, 245, 255, 0.1)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const ENERGY_CHARGE_VARIANTS: Variants = {
  initial: {
    scaleX: 0,
    originX: 0,
  },
  animate: (custom: number) => ({
    scaleX: Math.min(1, Math.max(0, custom)),
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  }),
};

// ==================== 警报闪烁效果 ====================

export const ALERT_FLASH_VARIANTS: Variants = {
  animate: {
    backgroundColor: [
      'rgba(255, 68, 68, 0)',
      'rgba(255, 68, 68, 0.2)',
      'rgba(255, 68, 68, 0)',
    ],
    borderColor: [
      'rgba(255, 68, 68, 0.3)',
      'rgba(255, 68, 68, 0.8)',
      'rgba(255, 68, 68, 0.3)',
    ],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const ALERT_SHAKE_VARIANTS: Variants = {
  animate: {
    x: [0, -5, 5, -5, 5, 0],
    transition: {
      duration: 0.5,
      repeat: 2,
    },
  },
};

// ==================== 交易动画效果 ====================

export const TRADE_BUY_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TRANSITION_PRESETS.spring,
  },
  success: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderColor: 'rgba(0, 255, 136, 0.5)',
    boxShadow: '0 0 20px rgba(0, 255, 136, 0.4)',
    transition: { duration: 0.3 },
  },
};

export const TRADE_SELL_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: -20,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TRANSITION_PRESETS.spring,
  },
  success: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderColor: 'rgba(255, 68, 68, 0.5)',
    boxShadow: '0 0 20px rgba(255, 68, 68, 0.4)',
    transition: { duration: 0.3 },
  },
};

// ==================== 成就解锁效果 ====================

export const ACHIEVEMENT_UNLOCK_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scale: 0.5,
    y: 50,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
    },
  },
  celebrate: {
    scale: [1, 1.1, 1],
    rotate: [0, -5, 5, 0],
    transition: {
      duration: 0.5,
      times: [0, 0.25, 0.75, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: -30,
    transition: { duration: 0.3 },
  },
};

// ==================== 图表动画效果 ====================

export const CHART_LINE_VARIANTS: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 2, ease: 'easeInOut' },
      opacity: { duration: 0.5 },
    },
  },
};

export const CHART_BAR_VARIANTS: Variants = {
  initial: {
    scaleY: 0,
    originY: 1,
  },
  animate: {
    scaleY: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
};

export const CHART_CANDLESTICK_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scaleY: 0,
    originY: 0.5,
  },
  animate: {
    opacity: 1,
    scaleY: 1,
    transition: {
      type: 'spring',
      stiffness: 150,
      damping: 12,
    },
  },
};

// ==================== 粒子动画效果 ====================

export const PARTICLE_BURST_VARIANTS: Variants = {
  initial: {
    scale: 0,
    opacity: 1,
  },
  animate: {
    scale: [0, 1.5, 0],
    opacity: [1, 1, 0],
    transition: {
      duration: 0.8,
      times: [0, 0.3, 1],
      ease: 'easeOut',
    },
  },
};

export const PARTICLE_FLOAT_VARIANTS: Variants = {
  animate: {
    y: [0, -30, 0],
    x: [0, 10, -10, 0],
    opacity: [0, 1, 1, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ==================== 建筑动画效果 ====================

export const BUILDING_CONSTRUCT_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 12,
    },
  },
  working: {
    boxShadow: [
      '0 0 10px rgba(0, 245, 255, 0.3)',
      '0 0 20px rgba(0, 245, 255, 0.5)',
      '0 0 10px rgba(0, 245, 255, 0.3)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  idle: {
    boxShadow: '0 0 5px rgba(0, 245, 255, 0.2)',
  },
};

export const BUILDING_UPGRADE_VARIANTS: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    boxShadow: [
      '0 0 10px rgba(139, 92, 246, 0.3)',
      '0 0 40px rgba(139, 92, 246, 0.8)',
      '0 0 10px rgba(139, 92, 246, 0.3)',
    ],
    transition: {
      duration: 1,
      times: [0, 0.5, 1],
    },
  },
};

// ==================== 研究进度动画 ====================

export const RESEARCH_PROGRESS_VARIANTS: Variants = {
  initial: {
    scaleX: 0,
    originX: 0,
  },
  animate: (custom: number) => ({
    scaleX: custom,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  }),
  complete: {
    backgroundColor: '#00ff88',
    boxShadow: '0 0 20px rgba(0, 255, 136, 0.6)',
  },
};

export const RESEARCH_COMPLETE_VARIANTS: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: [0, 1.2, 1],
    opacity: 1,
    transition: {
      scale: { times: [0, 0.6, 1], duration: 0.5 },
    },
  },
};

// ==================== 金钱动画效果 ====================

export const MONEY_GAIN_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 0,
    scale: 0.5,
  },
  animate: {
    opacity: [0, 1, 1, 0],
    y: -40,
    scale: 1,
    transition: {
      duration: 1.5,
      times: [0, 0.2, 0.8, 1],
    },
  },
};

export const MONEY_LOSS_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 0,
    scale: 0.5,
  },
  animate: {
    opacity: [0, 1, 1, 0],
    y: 40,
    scale: 1,
    transition: {
      duration: 1.5,
      times: [0, 0.2, 0.8, 1],
    },
  },
};

// ==================== 涟漪点击效果 ====================

export const RIPPLE_VARIANTS: Variants = {
  initial: {
    scale: 0,
    opacity: 0.6,
  },
  animate: {
    scale: 4,
    opacity: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
};

// ==================== 标签切换效果 ====================

export const TAB_INDICATOR_VARIANTS: Variants = {
  animate: (custom: { x: number; width: number }) => ({
    x: custom.x,
    width: custom.width,
    transition: TRANSITION_PRESETS.snappy,
  }),
};

export const TAB_CONTENT_VARIANTS: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: TRANSITION_PRESETS.smooth,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.15 },
  },
};

// ==================== 通知计数器动画 ====================

export const NOTIFICATION_BADGE_VARIANTS: Variants = {
  initial: { scale: 0 },
  animate: {
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 15,
    },
  },
  update: {
    scale: [1, 1.3, 1],
    transition: { duration: 0.3 },
  },
  exit: {
    scale: 0,
    transition: { duration: 0.15 },
  },
};

// ==================== 滑块动画 ====================

export const SLIDER_THUMB_VARIANTS: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.2 },
  drag: {
    scale: 1.3,
    boxShadow: '0 0 15px rgba(0, 245, 255, 0.6)',
  },
};

// ==================== 折叠展开动画 ====================

export const COLLAPSE_VARIANTS: Variants = {
  initial: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  animate: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.3, ease: 'easeOut' },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.1 },
    },
  },
};

// ==================== 导出 ====================

export default {
  transitions: TRANSITION_PRESETS,
  page: PAGE_VARIANTS,
  pageSlide: PAGE_SLIDE_VARIANTS,
  modal: MODAL_VARIANTS,
  modalOverlay: MODAL_OVERLAY_VARIANTS,
  drawer: DRAWER_VARIANTS,
  drawerLeft: DRAWER_LEFT_VARIANTS,
  listContainer: LIST_CONTAINER_VARIANTS,
  listItem: LIST_ITEM_VARIANTS,
  listItemFade: LIST_ITEM_FADE_VARIANTS,
  card: CARD_VARIANTS,
  cardHover: CARD_HOVER_VARIANTS,
  button: BUTTON_VARIANTS,
  buttonGlow: BUTTON_GLOW_VARIANTS,
  toast: TOAST_VARIANTS,
  toastTop: TOAST_TOP_VARIANTS,
  popup: POPUP_VARIANTS,
  dropdown: DROPDOWN_VARIANTS,
  tooltip: TOOLTIP_VARIANTS,
  numberChange: NUMBER_CHANGE_VARIANTS,
  neonFlicker: NEON_FLICKER_VARIANTS,
  pulseGlow: PULSE_GLOW_VARIANTS,
  borderGlow: BORDER_GLOW_VARIANTS,
  progressBar: PROGRESS_BAR_VARIANTS,
  loadingSpin: LOADING_SPIN_VARIANTS,
  loadingPulse: LOADING_PULSE_VARIANTS,
  scanline: SCANLINE_VARIANTS,
  statusPulse: STATUS_PULSE_VARIANTS,
  statusBlink: STATUS_BLINK_VARIANTS,
  // 新增动画
  dataStream: DATA_STREAM_VARIANTS,
  dataPoint: DATA_POINT_VARIANTS,
  hologramAppear: HOLOGRAM_APPEAR_VARIANTS,
  hologramFlicker: HOLOGRAM_FLICKER_VARIANTS,
  energyPulse: ENERGY_PULSE_VARIANTS,
  energyCharge: ENERGY_CHARGE_VARIANTS,
  alertFlash: ALERT_FLASH_VARIANTS,
  alertShake: ALERT_SHAKE_VARIANTS,
  tradeBuy: TRADE_BUY_VARIANTS,
  tradeSell: TRADE_SELL_VARIANTS,
  achievementUnlock: ACHIEVEMENT_UNLOCK_VARIANTS,
  chartLine: CHART_LINE_VARIANTS,
  chartBar: CHART_BAR_VARIANTS,
  chartCandlestick: CHART_CANDLESTICK_VARIANTS,
  particleBurst: PARTICLE_BURST_VARIANTS,
  particleFloat: PARTICLE_FLOAT_VARIANTS,
  buildingConstruct: BUILDING_CONSTRUCT_VARIANTS,
  buildingUpgrade: BUILDING_UPGRADE_VARIANTS,
  researchProgress: RESEARCH_PROGRESS_VARIANTS,
  researchComplete: RESEARCH_COMPLETE_VARIANTS,
  moneyGain: MONEY_GAIN_VARIANTS,
  moneyLoss: MONEY_LOSS_VARIANTS,
  ripple: RIPPLE_VARIANTS,
  tabIndicator: TAB_INDICATOR_VARIANTS,
  tabContent: TAB_CONTENT_VARIANTS,
  notificationBadge: NOTIFICATION_BADGE_VARIANTS,
  sliderThumb: SLIDER_THUMB_VARIANTS,
  collapse: COLLAPSE_VARIANTS,
};