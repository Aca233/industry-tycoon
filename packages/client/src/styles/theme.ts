/**
 * 赛博朋克霓虹配色主题系统
 * 统一管理游戏的视觉配色方案
 */

// ==================== 主色板 ====================

export const NEON_PALETTE = {
  // 主色调
  primary: {
    cyan: '#00f5ff',
    cyanLight: '#66f9ff',
    cyanDark: '#00b8c4',
    cyanGlow: 'rgba(0, 245, 255, 0.6)',
    cyanGlowStrong: 'rgba(0, 245, 255, 0.8)',
    cyanGlowSubtle: 'rgba(0, 245, 255, 0.3)',
    blue: '#007bff',
    blueLight: '#4da3ff',
    blueDark: '#0056b3',
    blueGlow: 'rgba(0, 123, 255, 0.6)',
  },
  
  // 霓虹强调色
  accent: {
    magenta: '#ff00ff',
    magentaLight: '#ff66ff',
    magentaDark: '#cc00cc',
    magentaGlow: 'rgba(255, 0, 255, 0.5)',
    amber: '#ffa500',
    amberLight: '#ffc04d',
    amberDark: '#cc8400',
    amberGlow: 'rgba(255, 165, 0, 0.5)',
    lime: '#00ff00',
    limeLight: '#66ff66',
    limeDark: '#00cc00',
    limeGlow: 'rgba(0, 255, 0, 0.5)',
    purple: '#8b5cf6',
    purpleGlow: 'rgba(139, 92, 246, 0.5)',
  },
  
  // 状态色
  status: {
    profit: '#00ff88',
    profitLight: '#66ffb3',
    profitDark: '#00cc6d',
    profitGlow: 'rgba(0, 255, 136, 0.5)',
    loss: '#ff4444',
    lossLight: '#ff7777',
    lossDark: '#cc3636',
    lossGlow: 'rgba(255, 68, 68, 0.5)',
    warning: '#ffaa00',
    warningLight: '#ffcc4d',
    warningDark: '#cc8800',
    warningGlow: 'rgba(255, 170, 0, 0.5)',
    neutral: '#888888',
    neutralLight: '#aaaaaa',
    neutralDark: '#666666',
  },
  
  // 背景层级
  background: {
    deep: '#050510',
    deepRgb: '5, 5, 16',
    base: '#0d1117',
    baseRgb: '13, 17, 23',
    elevated: '#161b22',
    elevatedRgb: '22, 27, 34',
    surface: '#21262d',
    surfaceRgb: '33, 38, 45',
    overlay: 'rgba(13, 17, 23, 0.95)',
    overlayLight: 'rgba(22, 27, 34, 0.9)',
    card: 'rgba(22, 27, 34, 0.8)',
    modal: 'rgba(5, 5, 16, 0.95)',
  },
  
  // 文字层级
  text: {
    primary: '#ffffff',
    secondary: '#e2e8f0',
    muted: '#64748b',
    disabled: '#475569',
    inverse: '#0d1117',
  },
  
  // 边框色
  border: {
    default: 'rgba(255, 255, 255, 0.1)',
    subtle: 'rgba(255, 255, 255, 0.05)',
    strong: 'rgba(255, 255, 255, 0.2)',
    glow: 'rgba(0, 245, 255, 0.3)',
    glowStrong: 'rgba(0, 245, 255, 0.5)',
  },
};

// ==================== 产业类别配色 ====================

export const CATEGORY_COLORS = {
  extraction: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
    glow: 'rgba(245, 158, 11, 0.5)',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    bgGlow: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.3) 0%, transparent 70%)',
  },
  processing: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
    glow: 'rgba(59, 130, 246, 0.5)',
    gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    bgGlow: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
  },
  manufacturing: {
    main: '#8b5cf6',
    light: '#a78bfa',
    dark: '#7c3aed',
    glow: 'rgba(139, 92, 246, 0.5)',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    bgGlow: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
  },
  service: {
    main: '#10b981',
    light: '#34d399',
    dark: '#059669',
    glow: 'rgba(16, 185, 129, 0.5)',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    bgGlow: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.3) 0%, transparent 70%)',
  },
  retail: {
    main: '#ec4899',
    light: '#f472b6',
    dark: '#db2777',
    glow: 'rgba(236, 72, 153, 0.5)',
    gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
    bgGlow: 'radial-gradient(ellipse at center, rgba(236, 72, 153, 0.3) 0%, transparent 70%)',
  },
  agriculture: {
    main: '#84cc16',
    light: '#a3e635',
    dark: '#65a30d',
    glow: 'rgba(132, 204, 22, 0.5)',
    gradient: 'linear-gradient(135deg, #84cc16, #65a30d)',
    bgGlow: 'radial-gradient(ellipse at center, rgba(132, 204, 22, 0.3) 0%, transparent 70%)',
  },
};

// ==================== 霓虹发光效果 ====================

export const NEON_GLOW = {
  // 文字发光
  textCyan: `
    0 0 5px rgba(0, 245, 255, 0.5),
    0 0 10px rgba(0, 245, 255, 0.4),
    0 0 20px rgba(0, 245, 255, 0.3),
    0 0 40px rgba(0, 245, 255, 0.2)
  `,
  textMagenta: `
    0 0 5px rgba(255, 0, 255, 0.5),
    0 0 10px rgba(255, 0, 255, 0.4),
    0 0 20px rgba(255, 0, 255, 0.3),
    0 0 40px rgba(255, 0, 255, 0.2)
  `,
  textProfit: `
    0 0 5px rgba(0, 255, 136, 0.5),
    0 0 10px rgba(0, 255, 136, 0.4),
    0 0 20px rgba(0, 255, 136, 0.3)
  `,
  textLoss: `
    0 0 5px rgba(255, 68, 68, 0.5),
    0 0 10px rgba(255, 68, 68, 0.4),
    0 0 20px rgba(255, 68, 68, 0.3)
  `,
  
  // 盒子发光
  boxCyan: `
    0 0 20px rgba(0, 245, 255, 0.3),
    0 0 40px rgba(0, 245, 255, 0.15)
  `,
  boxCyanStrong: `
    0 0 20px rgba(0, 245, 255, 0.5),
    0 0 40px rgba(0, 245, 255, 0.3),
    0 0 60px rgba(0, 245, 255, 0.15)
  `,
  boxMagenta: `
    0 0 20px rgba(255, 0, 255, 0.3),
    0 0 40px rgba(255, 0, 255, 0.15)
  `,
  boxProfit: `
    0 0 15px rgba(0, 255, 136, 0.4),
    0 0 30px rgba(0, 255, 136, 0.2)
  `,
  boxLoss: `
    0 0 15px rgba(255, 68, 68, 0.4),
    0 0 30px rgba(255, 68, 68, 0.2)
  `,
  
  // 按钮悬停发光
  buttonHover: `
    0 0 20px rgba(0, 245, 255, 0.4),
    0 8px 24px rgba(0, 0, 0, 0.3)
  `,
};

// ==================== 玻璃态效果 ====================

export const GLASS_EFFECTS = {
  // 基础玻璃态
  default: {
    background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.8) 0%, rgba(22, 27, 34, 0.6) 100%)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  
  // 提升层级玻璃态
  elevated: {
    background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.9) 0%, rgba(33, 38, 45, 0.7) 100%)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
  },
  
  // 内嵌玻璃态
  inset: {
    background: 'linear-gradient(135deg, rgba(5, 5, 16, 0.6) 0%, rgba(13, 17, 23, 0.4) 100%)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 -1px 0 rgba(255, 255, 255, 0.03)',
  },
  
  // 全息投影效果
  holographic: {
    background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.05) 0%, rgba(255, 0, 255, 0.03) 50%, rgba(0, 123, 255, 0.05) 100%)',
    backdropFilter: 'blur(16px) saturate(180%)',
    border: '1px solid rgba(0, 245, 255, 0.2)',
    boxShadow: '0 0 40px rgba(0, 245, 255, 0.1), 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  },
  
  // 警告玻璃态
  warning: {
    background: 'linear-gradient(135deg, rgba(255, 170, 0, 0.1) 0%, rgba(255, 68, 68, 0.05) 100%)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 170, 0, 0.3)',
    boxShadow: '0 0 30px rgba(255, 170, 0, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  
  // 成功玻璃态
  success: {
    background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(0, 255, 136, 0.3)',
    boxShadow: '0 0 30px rgba(0, 255, 136, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4)',
  },
};

// ==================== 渐变效果 ====================

export const GRADIENTS = {
  // 主题渐变
  primary: 'linear-gradient(135deg, #00f5ff 0%, #007bff 100%)',
  secondary: 'linear-gradient(135deg, #ff00ff 0%, #8b5cf6 100%)',
  profit: 'linear-gradient(135deg, #00ff88 0%, #00f5ff 100%)',
  loss: 'linear-gradient(135deg, #ff4444 0%, #ff00ff 100%)',
  warning: 'linear-gradient(135deg, #ffaa00 0%, #ff6600 100%)',
  
  // 按钮渐变
  buttonPrimary: 'linear-gradient(135deg, #00b8c4 0%, #007bff 100%)',
  buttonSuccess: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  buttonDanger: 'linear-gradient(135deg, #cc3636 0%, #ff4444 100%)',
  
  // 背景渐变
  bgRadial: 'radial-gradient(ellipse at center, rgba(0, 245, 255, 0.1) 0%, transparent 50%)',
  bgDark: 'linear-gradient(180deg, #050510 0%, #0d1117 50%, #161b22 100%)',
  bgPanel: 'linear-gradient(180deg, rgba(22, 27, 34, 0.95) 0%, rgba(13, 17, 23, 0.95) 100%)',
  
  // 扫描线效果用
  scanline: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 245, 255, 0.03) 2px, rgba(0, 245, 255, 0.03) 4px)',
};

// ==================== 动画时长 ====================

export const TIMING = {
  // 快速响应
  instant: '50ms',
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
  
  // 特效动画
  glow: '2s',
  pulse: '1.5s',
  scanline: '8s',
  flicker: '3s',
};

// ==================== 模糊程度 ====================

export const BLUR = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
};

// ==================== 辅助函数 ====================

/**
 * 获取产业类别颜色
 */
export function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.service;
}

/**
 * 根据利润率获取颜色
 */
export function getProfitColor(profitMargin: number): { color: string; glow: string } {
  if (profitMargin > 0.1) {
    return { color: NEON_PALETTE.status.profit, glow: NEON_PALETTE.status.profitGlow };
  } else if (profitMargin > 0) {
    return { color: NEON_PALETTE.status.profit, glow: 'transparent' };
  } else if (profitMargin > -0.1) {
    return { color: NEON_PALETTE.status.warning, glow: 'transparent' };
  } else {
    return { color: NEON_PALETTE.status.loss, glow: NEON_PALETTE.status.lossGlow };
  }
}

/**
 * HEX 转 RGB (通用辅助函数)
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255, 255, 255';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

/**
 * 生成霓虹发光CSS
 */
export function createNeonGlow(color: string, intensity: number = 1): string {
  const baseAlpha = 0.5 * intensity;
  return `
    0 0 ${5 * intensity}px rgba(${hexToRgb(color)}, ${baseAlpha}),
    0 0 ${10 * intensity}px rgba(${hexToRgb(color)}, ${baseAlpha * 0.8}),
    0 0 ${20 * intensity}px rgba(${hexToRgb(color)}, ${baseAlpha * 0.6}),
    0 0 ${40 * intensity}px rgba(${hexToRgb(color)}, ${baseAlpha * 0.4})
  `;
}

// ==================== 主题变体 ====================

export const THEME_VARIANTS = {
  // 默认赛博青色主题
  cyberpunk: {
    primary: NEON_PALETTE.primary.cyan,
    secondary: NEON_PALETTE.accent.magenta,
    accent: NEON_PALETTE.accent.amber,
    background: NEON_PALETTE.background.base,
    surface: NEON_PALETTE.background.elevated,
  },
  
  // 终端绿主题
  terminal: {
    primary: '#00ff00',
    secondary: '#00cc00',
    accent: '#66ff66',
    background: '#0a0a0a',
    surface: '#1a1a1a',
  },
  
  // 赛博紫主题
  synthwave: {
    primary: '#ff00ff',
    secondary: '#8b5cf6',
    accent: '#f472b6',
    background: '#0f0020',
    surface: '#1a0030',
  },
  
  // 血橙主题
  bloodOrange: {
    primary: '#ff6600',
    secondary: '#ff4444',
    accent: '#ffaa00',
    background: '#1a0a00',
    surface: '#2a1500',
  },
  
  // 冰霜蓝主题
  frostBlue: {
    primary: '#00bfff',
    secondary: '#87ceeb',
    accent: '#ffffff',
    background: '#001020',
    surface: '#002040',
  },
};

// ==================== 视觉强度设置 ====================

export const VISUAL_INTENSITY = {
  // 低强度 - 减少眼睛疲劳
  low: {
    glowOpacity: 0.2,
    animationSpeed: 1.5,
    scanlineOpacity: 0.05,
    borderGlowStrength: 0.3,
  },
  
  // 中等强度 - 默认
  medium: {
    glowOpacity: 0.4,
    animationSpeed: 1,
    scanlineOpacity: 0.1,
    borderGlowStrength: 0.5,
  },
  
  // 高强度 - 最大视觉效果
  high: {
    glowOpacity: 0.6,
    animationSpeed: 0.75,
    scanlineOpacity: 0.15,
    borderGlowStrength: 0.8,
  },
};

// ==================== 动画曲线 ====================

export const EASING = {
  // 弹性曲线
  spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  // 平滑曲线
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // 快速启动
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  // 慢速启动
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  // 霓虹闪烁
  neonFlicker: 'steps(3, end)',
  // 电子脉冲
  pulse: 'cubic-bezier(0.4, 0, 0.6, 1)',
};

// ==================== 阴影预设 ====================

export const SHADOWS = {
  // 霓虹发光阴影
  neonCyan: `
    0 0 5px rgba(0, 245, 255, 0.5),
    0 0 10px rgba(0, 245, 255, 0.3),
    0 0 20px rgba(0, 245, 255, 0.2)
  `,
  neonMagenta: `
    0 0 5px rgba(255, 0, 255, 0.5),
    0 0 10px rgba(255, 0, 255, 0.3),
    0 0 20px rgba(255, 0, 255, 0.2)
  `,
  neonGreen: `
    0 0 5px rgba(0, 255, 136, 0.5),
    0 0 10px rgba(0, 255, 136, 0.3),
    0 0 20px rgba(0, 255, 136, 0.2)
  `,
  neonRed: `
    0 0 5px rgba(255, 68, 68, 0.5),
    0 0 10px rgba(255, 68, 68, 0.3),
    0 0 20px rgba(255, 68, 68, 0.2)
  `,
  
  // 深度阴影
  depth1: '0 2px 4px rgba(0, 0, 0, 0.3)',
  depth2: '0 4px 8px rgba(0, 0, 0, 0.3)',
  depth3: '0 8px 16px rgba(0, 0, 0, 0.3)',
  depth4: '0 16px 32px rgba(0, 0, 0, 0.4)',
  depth5: '0 24px 48px rgba(0, 0, 0, 0.5)',
  
  // 内阴影
  inset: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
  insetDeep: 'inset 0 4px 8px rgba(0, 0, 0, 0.4)',
};

// ==================== 粒子效果配置 ====================

export const PARTICLE_CONFIGS = {
  // 金币粒子
  money: {
    color: '#ffd700',
    secondaryColor: '#ffaa00',
    size: { min: 2, max: 6 },
    speed: { min: 2, max: 5 },
    life: { min: 500, max: 1500 },
    gravity: 0.1,
    spread: 45,
  },
  
  // 能量粒子
  energy: {
    color: '#00f5ff',
    secondaryColor: '#00b8c4',
    size: { min: 1, max: 4 },
    speed: { min: 1, max: 3 },
    life: { min: 800, max: 2000 },
    gravity: -0.05,
    spread: 360,
  },
  
  // 火花粒子
  spark: {
    color: '#ffaa00',
    secondaryColor: '#ff6600',
    size: { min: 1, max: 3 },
    speed: { min: 3, max: 8 },
    life: { min: 200, max: 600 },
    gravity: 0.2,
    spread: 60,
  },
  
  // 成功粒子
  success: {
    color: '#00ff88',
    secondaryColor: '#00cc6d',
    size: { min: 3, max: 8 },
    speed: { min: 2, max: 6 },
    life: { min: 600, max: 1200 },
    gravity: 0.15,
    spread: 90,
  },
  
  // 烟花粒子
  firework: {
    color: '#ff00ff',
    secondaryColor: '#00f5ff',
    size: { min: 2, max: 5 },
    speed: { min: 5, max: 12 },
    life: { min: 400, max: 1000 },
    gravity: 0.08,
    spread: 360,
  },
};

// ==================== 更多辅助函数 ====================

/**
 * 根据健康状态获取颜色
 */
export function getHealthColor(health: number): { color: string; glow: string } {
  if (health >= 80) {
    return { color: NEON_PALETTE.status.profit, glow: NEON_PALETTE.status.profitGlow };
  } else if (health >= 50) {
    return { color: NEON_PALETTE.status.warning, glow: NEON_PALETTE.status.warningGlow };
  } else if (health >= 25) {
    return { color: '#ff6600', glow: 'rgba(255, 102, 0, 0.5)' };
  } else {
    return { color: NEON_PALETTE.status.loss, glow: NEON_PALETTE.status.lossGlow };
  }
}

/**
 * 根据效率获取颜色渐变
 */
export function getEfficiencyGradient(efficiency: number): string {
  if (efficiency >= 90) {
    return GRADIENTS.profit;
  } else if (efficiency >= 70) {
    return 'linear-gradient(135deg, #00f5ff 0%, #10b981 100%)';
  } else if (efficiency >= 50) {
    return GRADIENTS.warning;
  } else {
    return GRADIENTS.loss;
  }
}

/**
 * 创建自定义霓虹渐变
 */
export function createNeonGradient(
  color1: string,
  color2: string,
  angle: number = 135
): string {
  return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
}

/**
 * 创建径向发光效果
 */
export function createRadialGlow(color: string, intensity: number = 1): string {
  const rgb = hexToRgb(color);
  return `radial-gradient(ellipse at center, rgba(${rgb}, ${0.3 * intensity}) 0%, transparent 70%)`;
}

/**
 * 获取脉冲动画样式
 */
export function getPulseAnimation(color: string, duration: number = 2): string {
  return `pulse-${color.replace('#', '')} ${duration}s ease-in-out infinite`;
}

/**
 * 计算对比色
 */
export function getContrastColor(hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  const [r, g, b] = rgb.split(',').map(n => parseInt(n.trim()));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#0d1117' : '#ffffff';
}

/**
 * 混合两种颜色
 */
export function blendColors(color1: string, color2: string, ratio: number = 0.5): string {
  const rgb1 = hexToRgb(color1).split(',').map(n => parseInt(n.trim()));
  const rgb2 = hexToRgb(color2).split(',').map(n => parseInt(n.trim()));
  
  const r = Math.round(rgb1[0] * (1 - ratio) + rgb2[0] * ratio);
  const g = Math.round(rgb1[1] * (1 - ratio) + rgb2[1] * ratio);
  const b = Math.round(rgb1[2] * (1 - ratio) + rgb2[2] * ratio);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * 创建CSS变量对象
 */
export function createCSSVariables(theme: keyof typeof THEME_VARIANTS): Record<string, string> {
  const variant = THEME_VARIANTS[theme];
  return {
    '--color-primary': variant.primary,
    '--color-secondary': variant.secondary,
    '--color-accent': variant.accent,
    '--color-background': variant.background,
    '--color-surface': variant.surface,
  };
}

// ==================== 响应式断点 ====================

export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

// ==================== Z-Index层级 ====================

export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  notification: 80,
  maximum: 9999,
};

// ==================== 默认导出 ====================

export default {
  palette: NEON_PALETTE,
  category: CATEGORY_COLORS,
  glow: NEON_GLOW,
  glass: GLASS_EFFECTS,
  gradients: GRADIENTS,
  timing: TIMING,
  blur: BLUR,
  themes: THEME_VARIANTS,
  intensity: VISUAL_INTENSITY,
  easing: EASING,
  shadows: SHADOWS,
  particles: PARTICLE_CONFIGS,
  breakpoints: BREAKPOINTS,
  zIndex: Z_INDEX,
};