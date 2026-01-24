/**
 * 粒子系统核心
 * 使用PixiJS实现高性能粒子效果
 */

import * as PIXI from 'pixi.js';

// 粒子类型
export type ParticleType = 
  | 'data-flow'      // 数据流粒子
  | 'profit-sparkle' // 利润闪光
  | 'loss-spark'     // 亏损火花
  | 'energy-pulse'   // 能量脉冲
  | 'circuit-trace'  // 电路轨迹
  | 'money-float'    // 金钱飘浮
  | 'warning-flash'  // 警告闪烁
  | 'explosion'      // 爆炸效果
  | 'trail';         // 拖尾效果

// 单个粒子
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  sizeDecay: number;
  alpha: number;
  alphaDecay: number;
  color: number;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  friction: number;
  type: ParticleType;
  sprite?: PIXI.Sprite;
}

// 粒子发射器配置
export interface EmitterConfig {
  type: ParticleType;
  x: number;
  y: number;
  count?: number;          // 粒子数量
  spread?: number;         // 发射角度范围 (弧度)
  angle?: number;          // 发射方向 (弧度)
  speed?: [number, number]; // 速度范围
  life?: [number, number];  // 生命周期范围 (帧)
  size?: [number, number];  // 尺寸范围
  color?: number | number[]; // 颜色或颜色数组
  gravity?: number;
  friction?: number;
  continuous?: boolean;    // 是否持续发射
  emitRate?: number;       // 每帧发射数量
  onComplete?: () => void;
}

// 预定义颜色
export const PARTICLE_COLORS = {
  cyan: 0x00f5ff,
  magenta: 0xff00ff,
  profit: 0x00ff88,
  loss: 0xff4444,
  warning: 0xffaa00,
  energy: 0x8b5cf6,
  gold: 0xffd700,
  white: 0xffffff,
};

/**
 * 粒子系统类
 */
export class ParticleSystem {
  private app: PIXI.Application | null = null;
  private container: PIXI.Container;
  private particles: Particle[] = [];
  private emitters: Map<string, { config: EmitterConfig; active: boolean; accumulator: number }> = new Map();
  private textureCache: Map<string, PIXI.Texture> = new Map();
  private maxParticles: number = 1000;
  private isRunning: boolean = false;
  private updateBound: () => void;

  constructor() {
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    this.updateBound = this.update.bind(this);
  }

  /**
   * 初始化粒子系统
   */
  async init(app: PIXI.Application): Promise<void> {
    this.app = app;
    this.app.stage.addChild(this.container);
    this.createTextures();
    this.start();
  }

  /**
   * 创建粒子纹理
   */
  private createTextures(): void {
    // 圆形粒子
    const circleGraphics = new PIXI.Graphics();
    circleGraphics.circle(0, 0, 8);
    circleGraphics.fill({ color: 0xffffff });
    const circleTexture = this.app!.renderer.generateTexture(circleGraphics);
    this.textureCache.set('circle', circleTexture);

    // 方形粒子
    const squareGraphics = new PIXI.Graphics();
    squareGraphics.rect(-4, -4, 8, 8);
    squareGraphics.fill({ color: 0xffffff });
    const squareTexture = this.app!.renderer.generateTexture(squareGraphics);
    this.textureCache.set('square', squareTexture);

    // 菱形粒子
    const diamondGraphics = new PIXI.Graphics();
    diamondGraphics.moveTo(0, -6);
    diamondGraphics.lineTo(6, 0);
    diamondGraphics.lineTo(0, 6);
    diamondGraphics.lineTo(-6, 0);
    diamondGraphics.closePath();
    diamondGraphics.fill({ color: 0xffffff });
    const diamondTexture = this.app!.renderer.generateTexture(diamondGraphics);
    this.textureCache.set('diamond', diamondTexture);

    // 星形粒子
    const starGraphics = new PIXI.Graphics();
    const starPoints = 5;
    const outerRadius = 8;
    const innerRadius = 4;
    for (let i = 0; i < starPoints * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / starPoints - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        starGraphics.moveTo(x, y);
      } else {
        starGraphics.lineTo(x, y);
      }
    }
    starGraphics.closePath();
    starGraphics.fill({ color: 0xffffff });
    const starTexture = this.app!.renderer.generateTexture(starGraphics);
    this.textureCache.set('star', starTexture);

    // 光晕粒子 (渐变圆)
    const glowGraphics = new PIXI.Graphics();
    const glowGradient = new PIXI.FillGradient(0, -16, 0, 16);
    glowGradient.addColorStop(0, 0xffffff);
    glowGradient.addColorStop(1, 0x000000);
    glowGraphics.circle(0, 0, 16);
    glowGraphics.fill({ color: 0xffffff, alpha: 0.8 });
    const glowTexture = this.app!.renderer.generateTexture(glowGraphics);
    this.textureCache.set('glow', glowTexture);
  }

  /**
   * 获取粒子纹理
   */
  private getTexture(type: ParticleType): PIXI.Texture {
    switch (type) {
      case 'profit-sparkle':
      case 'money-float':
        return this.textureCache.get('star')!;
      case 'data-flow':
      case 'circuit-trace':
        return this.textureCache.get('square')!;
      case 'energy-pulse':
      case 'warning-flash':
        return this.textureCache.get('diamond')!;
      case 'explosion':
        return this.textureCache.get('glow')!;
      default:
        return this.textureCache.get('circle')!;
    }
  }

  /**
   * 创建粒子
   */
  private createParticle(config: EmitterConfig): Particle | null {
    if (this.particles.length >= this.maxParticles) {
      return null;
    }

    const {
      type,
      x,
      y,
      spread = Math.PI * 2,
      angle = 0,
      speed = [2, 5],
      life = [30, 60],
      size = [4, 8],
      color = PARTICLE_COLORS.cyan,
      gravity = 0,
      friction = 0.98,
    } = config;

    const direction = angle + (Math.random() - 0.5) * spread;
    const particleSpeed = speed[0] + Math.random() * (speed[1] - speed[0]);
    const particleLife = Math.floor(life[0] + Math.random() * (life[1] - life[0]));
    const particleSize = size[0] + Math.random() * (size[1] - size[0]);
    const particleColor = Array.isArray(color) 
      ? color[Math.floor(Math.random() * color.length)]
      : color;

    const sprite = new PIXI.Sprite(this.getTexture(type));
    sprite.anchor.set(0.5);
    sprite.x = x;
    sprite.y = y;
    sprite.scale.set(particleSize / 8);
    sprite.tint = particleColor;
    sprite.alpha = 1;
    sprite.blendMode = 'add';
    this.container.addChild(sprite);

    const particle: Particle = {
      x,
      y,
      vx: Math.cos(direction) * particleSpeed,
      vy: Math.sin(direction) * particleSpeed,
      life: particleLife,
      maxLife: particleLife,
      size: particleSize,
      sizeDecay: 0.02,
      alpha: 1,
      alphaDecay: 1 / particleLife,
      color: particleColor,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      gravity,
      friction,
      type,
      sprite,
    };

    this.particles.push(particle);
    return particle;
  }

  /**
   * 发射粒子
   */
  emit(config: EmitterConfig): void {
    const count = config.count ?? 10;
    for (let i = 0; i < count; i++) {
      this.createParticle(config);
    }
    
    if (!config.continuous && config.onComplete) {
      // 延迟执行完成回调
      const maxLife = config.life?.[1] ?? 60;
      setTimeout(() => config.onComplete?.(), (maxLife / 60) * 1000);
    }
  }

  /**
   * 创建持续发射器
   */
  createEmitter(id: string, config: EmitterConfig): void {
    this.emitters.set(id, {
      config: { ...config, continuous: true },
      active: true,
      accumulator: 0,
    });
  }

  /**
   * 停止发射器
   */
  stopEmitter(id: string): void {
    const emitter = this.emitters.get(id);
    if (emitter) {
      emitter.active = false;
    }
  }

  /**
   * 移除发射器
   */
  removeEmitter(id: string): void {
    this.emitters.delete(id);
  }

  /**
   * 更新所有发射器
   */
  private updateEmitters(): void {
    this.emitters.forEach((emitter) => {
      if (!emitter.active) return;

      const { config } = emitter;
      const rate = config.emitRate ?? 1;
      
      emitter.accumulator += rate;
      while (emitter.accumulator >= 1) {
        this.createParticle(config);
        emitter.accumulator -= 1;
      }
    });
  }

  /**
   * 更新粒子
   */
  private update(): void {
    if (!this.isRunning) return;

    // 更新发射器
    this.updateEmitters();

    // 更新粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // 更新生命周期
      particle.life--;
      
      // 移除死亡粒子
      if (particle.life <= 0) {
        if (particle.sprite) {
          this.container.removeChild(particle.sprite);
          particle.sprite.destroy();
        }
        this.particles.splice(i, 1);
        continue;
      }

      // 更新物理
      particle.vx *= particle.friction;
      particle.vy *= particle.friction;
      particle.vy += particle.gravity;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;
      
      // 更新透明度
      particle.alpha = particle.life / particle.maxLife;
      
      // 更新精灵
      if (particle.sprite) {
        particle.sprite.x = particle.x;
        particle.sprite.y = particle.y;
        particle.sprite.rotation = particle.rotation;
        particle.sprite.alpha = particle.alpha;
        
        // 特殊效果
        if (particle.type === 'energy-pulse') {
          const pulse = Math.sin(particle.life * 0.2) * 0.3 + 1;
          particle.sprite.scale.set((particle.size / 8) * pulse);
        }
      }
    }

    // 请求下一帧
    if (this.isRunning) {
      requestAnimationFrame(this.updateBound);
    }
  }

  /**
   * 启动粒子系统
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    requestAnimationFrame(this.updateBound);
  }

  /**
   * 停止粒子系统
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * 清理所有粒子
   */
  clear(): void {
    for (const particle of this.particles) {
      if (particle.sprite) {
        this.container.removeChild(particle.sprite);
        particle.sprite.destroy();
      }
    }
    this.particles = [];
    this.emitters.clear();
  }

  /**
   * 销毁粒子系统
   */
  destroy(): void {
    this.stop();
    this.clear();
    
    // 销毁纹理
    this.textureCache.forEach((texture) => texture.destroy());
    this.textureCache.clear();
    
    // 移除容器
    if (this.app && this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy();
  }

  /**
   * 设置最大粒子数量
   */
  setMaxParticles(max: number): void {
    this.maxParticles = max;
  }

  /**
   * 获取当前粒子数量
   */
  getParticleCount(): number {
    return this.particles.length;
  }

  /**
   * 获取容器 (用于添加到自定义舞台)
   */
  getContainer(): PIXI.Container {
    return this.container;
  }
}

// 单例
let particleSystemInstance: ParticleSystem | null = null;

export function getParticleSystem(): ParticleSystem {
  if (!particleSystemInstance) {
    particleSystemInstance = new ParticleSystem();
  }
  return particleSystemInstance;
}

export function destroyParticleSystem(): void {
  if (particleSystemInstance) {
    particleSystemInstance.destroy();
    particleSystemInstance = null;
  }
}