/**
 * 粒子特效预设
 * 为游戏中各种场景提供预定义的粒子效果
 */

import { EmitterConfig, PARTICLE_COLORS, getParticleSystem } from './ParticleSystem';

/**
 * 利润效果 - 绿色上升的闪光
 */
export function profitSparkle(x: number, y: number, intensity: number = 1): void {
  const system = getParticleSystem();
  system.emit({
    type: 'profit-sparkle',
    x,
    y,
    count: Math.ceil(15 * intensity),
    angle: -Math.PI / 2,  // 向上
    spread: Math.PI / 3,
    speed: [3, 6],
    life: [40, 80],
    size: [4, 10],
    color: [PARTICLE_COLORS.profit, PARTICLE_COLORS.gold],
    gravity: -0.05,  // 轻微向上
    friction: 0.97,
  });
}

/**
 * 亏损效果 - 红色下落的火花
 */
export function lossSpark(x: number, y: number, intensity: number = 1): void {
  const system = getParticleSystem();
  system.emit({
    type: 'loss-spark',
    x,
    y,
    count: Math.ceil(20 * intensity),
    angle: Math.PI / 2,  // 向下
    spread: Math.PI / 2,
    speed: [2, 5],
    life: [30, 60],
    size: [3, 8],
    color: [PARTICLE_COLORS.loss, 0xff6600],
    gravity: 0.1,
    friction: 0.95,
  });
}

/**
 * 数据流效果 - 水平流动的数据粒子
 */
export function dataFlow(x: number, y: number, direction: 'left' | 'right' = 'right'): void {
  const system = getParticleSystem();
  const angle = direction === 'right' ? 0 : Math.PI;
  
  system.emit({
    type: 'data-flow',
    x,
    y,
    count: 8,
    angle,
    spread: Math.PI / 6,
    speed: [4, 8],
    life: [20, 40],
    size: [2, 4],
    color: [PARTICLE_COLORS.cyan, PARTICLE_COLORS.white],
    gravity: 0,
    friction: 0.99,
  });
}

/**
 * 能量脉冲效果 - 圆形扩散
 */
export function energyPulse(x: number, y: number, color: number = PARTICLE_COLORS.energy): void {
  const system = getParticleSystem();
  system.emit({
    type: 'energy-pulse',
    x,
    y,
    count: 24,
    angle: 0,
    spread: Math.PI * 2,
    speed: [2, 5],
    life: [30, 50],
    size: [4, 8],
    color,
    gravity: 0,
    friction: 0.96,
  });
}

/**
 * 金钱飘浮效果 - 交易成功
 */
export function moneyFloat(x: number, y: number, amount: number): void {
  const system = getParticleSystem();
  const count = Math.min(30, Math.ceil(Math.abs(amount) / 100) + 5);
  const color = amount >= 0 ? PARTICLE_COLORS.gold : PARTICLE_COLORS.loss;
  
  system.emit({
    type: 'money-float',
    x,
    y,
    count,
    angle: -Math.PI / 2,
    spread: Math.PI / 2,
    speed: [1, 3],
    life: [60, 100],
    size: [5, 10],
    color: [color, PARTICLE_COLORS.white],
    gravity: -0.02,
    friction: 0.98,
  });
}

/**
 * 警告闪烁效果
 */
export function warningFlash(x: number, y: number): void {
  const system = getParticleSystem();
  system.emit({
    type: 'warning-flash',
    x,
    y,
    count: 12,
    angle: 0,
    spread: Math.PI * 2,
    speed: [1, 3],
    life: [20, 40],
    size: [6, 12],
    color: PARTICLE_COLORS.warning,
    gravity: 0,
    friction: 0.9,
  });
}

/**
 * 爆炸效果
 */
export function explosion(x: number, y: number, size: number = 1): void {
  const system = getParticleSystem();
  
  // 核心爆炸
  system.emit({
    type: 'explosion',
    x,
    y,
    count: Math.ceil(30 * size),
    angle: 0,
    spread: Math.PI * 2,
    speed: [5 * size, 12 * size],
    life: [20, 50],
    size: [8, 20],
    color: [PARTICLE_COLORS.magenta, PARTICLE_COLORS.cyan, PARTICLE_COLORS.white],
    gravity: 0.05,
    friction: 0.92,
  });
  
  // 外围火花
  system.emit({
    type: 'loss-spark',
    x,
    y,
    count: Math.ceil(20 * size),
    angle: 0,
    spread: Math.PI * 2,
    speed: [3 * size, 8 * size],
    life: [30, 60],
    size: [3, 6],
    color: [0xff6600, PARTICLE_COLORS.warning],
    gravity: 0.1,
    friction: 0.95,
  });
}

/**
 * 电路轨迹效果 - 建筑建造
 */
export function circuitTrace(x: number, y: number, width: number, height: number): void {
  const system = getParticleSystem();
  const points = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  
  // 在四条边上生成粒子
  for (let i = 0; i < 4; i++) {
    const start = points[i];
    const end = points[(i + 1) % 4];
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    
    for (let j = 0; j < 5; j++) {
      const t = j / 4;
      system.emit({
        type: 'circuit-trace',
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        count: 2,
        angle,
        spread: Math.PI / 8,
        speed: [2, 4],
        life: [20, 30],
        size: [2, 4],
        color: PARTICLE_COLORS.cyan,
        gravity: 0,
        friction: 0.95,
      });
    }
  }
}

/**
 * 购买成功效果
 */
export function purchaseSuccess(x: number, y: number): void {
  const system = getParticleSystem();
  
  // 绿色上升
  profitSparkle(x, y, 0.5);
  
  // 金色闪光
  system.emit({
    type: 'profit-sparkle',
    x,
    y,
    count: 8,
    angle: 0,
    spread: Math.PI * 2,
    speed: [2, 4],
    life: [30, 50],
    size: [6, 10],
    color: PARTICLE_COLORS.gold,
    gravity: 0,
    friction: 0.95,
  });
}

/**
 * 研究完成效果
 */
export function researchComplete(x: number, y: number): void {
  const system = getParticleSystem();
  
  // 能量爆发
  energyPulse(x, y, PARTICLE_COLORS.energy);
  
  // 上升光点
  system.emit({
    type: 'data-flow',
    x,
    y,
    count: 20,
    angle: -Math.PI / 2,
    spread: Math.PI / 4,
    speed: [2, 5],
    life: [40, 80],
    size: [3, 6],
    color: [PARTICLE_COLORS.energy, PARTICLE_COLORS.cyan, PARTICLE_COLORS.magenta],
    gravity: -0.03,
    friction: 0.98,
  });
}

/**
 * 建筑建造效果
 */
export function buildingConstruct(x: number, y: number, width: number = 100, height: number = 80): void {
  // 电路轨迹
  circuitTrace(x - width / 2, y - height / 2, width, height);
  
  // 能量点
  energyPulse(x, y, PARTICLE_COLORS.cyan);
}

/**
 * 生产完成效果
 */
export function productionComplete(x: number, y: number): void {
  const system = getParticleSystem();
  
  // 绿色确认
  system.emit({
    type: 'profit-sparkle',
    x,
    y,
    count: 12,
    angle: -Math.PI / 2,
    spread: Math.PI / 3,
    speed: [2, 4],
    life: [30, 50],
    size: [4, 8],
    color: PARTICLE_COLORS.profit,
    gravity: -0.02,
    friction: 0.97,
  });
}

/**
 * 创建持续的环境效果发射器
 */
export function createAmbientEmitter(id: string, x: number, y: number, type: 'data' | 'energy' | 'money'): void {
  const system = getParticleSystem();
  
  const configs: Record<string, Omit<EmitterConfig, 'x' | 'y'>> = {
    data: {
      type: 'data-flow',
      count: 1,
      angle: 0,
      spread: Math.PI / 4,
      speed: [2, 4],
      life: [30, 50],
      size: [2, 3],
      color: [PARTICLE_COLORS.cyan, 0x0088ff],
      emitRate: 0.5,
    },
    energy: {
      type: 'energy-pulse',
      count: 1,
      angle: 0,
      spread: Math.PI * 2,
      speed: [1, 2],
      life: [40, 60],
      size: [3, 5],
      color: PARTICLE_COLORS.energy,
      emitRate: 0.3,
    },
    money: {
      type: 'money-float',
      count: 1,
      angle: -Math.PI / 2,
      spread: Math.PI / 3,
      speed: [0.5, 1.5],
      life: [60, 100],
      size: [3, 5],
      color: PARTICLE_COLORS.gold,
      gravity: -0.01,
      emitRate: 0.2,
    },
  };
  
  system.createEmitter(id, {
    ...configs[type],
    x,
    y,
  });
}

/**
 * 停止环境效果发射器
 */
export function stopAmbientEmitter(id: string): void {
  const system = getParticleSystem();
  system.stopEmitter(id);
}

/**
 * 移除环境效果发射器
 */
export function removeAmbientEmitter(id: string): void {
  const system = getParticleSystem();
  system.removeEmitter(id);
}