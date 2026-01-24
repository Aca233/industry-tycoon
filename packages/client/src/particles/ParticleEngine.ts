/**
 * 粒子引擎 - 高性能粒子特效系统
 * 使用Canvas 2D实现流畅的粒子动画
 */

// 粒子接口
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  friction: number;
  shape: 'circle' | 'square' | 'star' | 'glow';
}

// 发射器配置
export interface EmitterConfig {
  x: number;
  y: number;
  count: number;
  spread: number; // 角度范围 (0-360)
  direction: number; // 发射方向角度
  speed: { min: number; max: number };
  size: { min: number; max: number };
  life: { min: number; max: number };
  colors: string[];
  gravity?: number;
  friction?: number;
  shape?: 'circle' | 'square' | 'star' | 'glow';
  rotationSpeed?: { min: number; max: number };
}

// 预设效果类型
export type ParticlePreset = 
  | 'money-burst'
  | 'money-rain'
  | 'production-spark'
  | 'trade-success'
  | 'trade-fail'
  | 'level-up'
  | 'firework'
  | 'energy-field'
  | 'data-stream'
  | 'confetti';

// 粒子引擎类
export class ParticleEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animationId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  
  // 性能配置
  private maxParticles: number = 1000;
  private qualityMultiplier: number = 1;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取Canvas 2D上下文');
    }
    this.ctx = ctx;
    
    // 设置Canvas尺寸
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
  }
  
  /**
   * 调整Canvas尺寸
   */
  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }
  
  /**
   * 设置质量级别 (0.5 - 2)
   */
  setQuality(quality: number): void {
    this.qualityMultiplier = Math.max(0.5, Math.min(2, quality));
  }
  
  /**
   * 设置最大粒子数
   */
  setMaxParticles(max: number): void {
    this.maxParticles = max;
  }
  
  /**
   * 发射粒子
   */
  emit(config: EmitterConfig): void {
    const count = Math.floor(config.count * this.qualityMultiplier);
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        // 移除最老的粒子
        this.particles.shift();
      }
      
      const angle = (config.direction + (Math.random() - 0.5) * config.spread) * (Math.PI / 180);
      const speed = this.randomRange(config.speed.min, config.speed.max);
      const life = this.randomRange(config.life.min, config.life.max);
      
      const particle: Particle = {
        x: config.x,
        y: config.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life,
        maxLife: life,
        size: this.randomRange(config.size.min, config.size.max),
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        alpha: 1,
        rotation: Math.random() * 360,
        rotationSpeed: config.rotationSpeed 
          ? this.randomRange(config.rotationSpeed.min, config.rotationSpeed.max)
          : 0,
        gravity: config.gravity ?? 0,
        friction: config.friction ?? 0.98,
        shape: config.shape ?? 'circle',
      };
      
      this.particles.push(particle);
    }
    
    if (!this.isRunning) {
      this.start();
    }
  }
  
  /**
   * 发射预设效果
   */
  emitPreset(preset: ParticlePreset, x: number, y: number): void {
    const configs = this.getPresetConfig(preset, x, y);
    configs.forEach(config => this.emit(config));
  }
  
  /**
   * 获取预设配置
   */
  private getPresetConfig(preset: ParticlePreset, x: number, y: number): EmitterConfig[] {
    switch (preset) {
      case 'money-burst':
        return [{
          x, y,
          count: 30,
          spread: 90,
          direction: -90,
          speed: { min: 3, max: 8 },
          size: { min: 4, max: 8 },
          life: { min: 800, max: 1500 },
          colors: ['#ffd700', '#ffaa00', '#fff5b3'],
          gravity: 0.15,
          friction: 0.98,
          shape: 'star',
        }];
        
      case 'money-rain':
        return [{
          x, y,
          count: 15,
          spread: 30,
          direction: 90,
          speed: { min: 2, max: 4 },
          size: { min: 3, max: 6 },
          life: { min: 1000, max: 2000 },
          colors: ['#ffd700', '#ffcc00'],
          gravity: 0.05,
          friction: 0.99,
          shape: 'circle',
        }];
        
      case 'production-spark':
        return [{
          x, y,
          count: 10,
          spread: 60,
          direction: -90,
          speed: { min: 2, max: 5 },
          size: { min: 2, max: 4 },
          life: { min: 300, max: 600 },
          colors: ['#00f5ff', '#00b8c4', '#ffffff'],
          gravity: 0.1,
          friction: 0.95,
          shape: 'circle',
        }];
        
      case 'trade-success':
        return [{
          x, y,
          count: 40,
          spread: 360,
          direction: 0,
          speed: { min: 3, max: 7 },
          size: { min: 3, max: 6 },
          life: { min: 600, max: 1200 },
          colors: ['#00ff88', '#00cc6d', '#66ffb3'],
          gravity: 0.08,
          friction: 0.97,
          shape: 'star',
        }];
        
      case 'trade-fail':
        return [{
          x, y,
          count: 20,
          spread: 360,
          direction: 0,
          speed: { min: 2, max: 5 },
          size: { min: 2, max: 5 },
          life: { min: 500, max: 1000 },
          colors: ['#ff4444', '#cc3636', '#ff7777'],
          gravity: 0.1,
          friction: 0.96,
          shape: 'circle',
        }];
        
      case 'level-up':
        return [
          {
            x, y,
            count: 60,
            spread: 360,
            direction: 0,
            speed: { min: 4, max: 10 },
            size: { min: 4, max: 8 },
            life: { min: 800, max: 1500 },
            colors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ffffff'],
            gravity: 0.05,
            friction: 0.98,
            shape: 'star',
            rotationSpeed: { min: -5, max: 5 },
          },
          {
            x, y,
            count: 30,
            spread: 360,
            direction: 0,
            speed: { min: 2, max: 4 },
            size: { min: 6, max: 12 },
            life: { min: 1000, max: 2000 },
            colors: ['#00f5ff', '#ff00ff'],
            gravity: -0.02,
            friction: 0.99,
            shape: 'glow',
          },
        ];
        
      case 'firework':
        return [
          {
            x, y,
            count: 80,
            spread: 360,
            direction: 0,
            speed: { min: 5, max: 12 },
            size: { min: 2, max: 5 },
            life: { min: 600, max: 1200 },
            colors: ['#ff00ff', '#00f5ff', '#ffd700', '#ff4444', '#00ff88'],
            gravity: 0.08,
            friction: 0.97,
            shape: 'glow',
          },
        ];
        
      case 'energy-field':
        return [{
          x, y,
          count: 8,
          spread: 360,
          direction: 0,
          speed: { min: 0.5, max: 1.5 },
          size: { min: 2, max: 4 },
          life: { min: 1500, max: 3000 },
          colors: ['#00f5ff', '#00b8c4'],
          gravity: -0.01,
          friction: 0.995,
          shape: 'glow',
        }];
        
      case 'data-stream':
        return [{
          x, y,
          count: 5,
          spread: 15,
          direction: 90,
          speed: { min: 3, max: 6 },
          size: { min: 2, max: 3 },
          life: { min: 500, max: 1000 },
          colors: ['#00f5ff', '#00ff88'],
          gravity: 0,
          friction: 1,
          shape: 'square',
        }];
        
      case 'confetti':
        return [{
          x, y,
          count: 50,
          spread: 60,
          direction: -90,
          speed: { min: 5, max: 12 },
          size: { min: 4, max: 8 },
          life: { min: 1500, max: 3000 },
          colors: ['#ff4444', '#ffd700', '#00ff88', '#00f5ff', '#ff00ff', '#8b5cf6'],
          gravity: 0.1,
          friction: 0.98,
          shape: 'square',
          rotationSpeed: { min: -10, max: 10 },
        }];
        
      default:
        return [];
    }
  }
  
  /**
   * 更新所有粒子
   */
  private update(deltaTime: number): void {
    const dt = deltaTime / 16.67; // 归一化到60fps
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // 更新生命周期
      p.life -= deltaTime;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      // 更新透明度
      p.alpha = Math.max(0, p.life / p.maxLife);
      
      // 应用重力
      p.vy += p.gravity * dt;
      
      // 应用摩擦力
      p.vx *= p.friction;
      p.vy *= p.friction;
      
      // 更新位置
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      // 更新旋转
      p.rotation += p.rotationSpeed * dt;
    }
    
    // 如果没有粒子了，停止动画
    if (this.particles.length === 0) {
      this.stop();
    }
  }
  
  /**
   * 渲染所有粒子
   */
  private render(): void {
    // 清除画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      
      switch (p.shape) {
        case 'circle':
          this.drawCircle(p);
          break;
        case 'square':
          this.drawSquare(p);
          break;
        case 'star':
          this.drawStar(p);
          break;
        case 'glow':
          this.drawGlow(p);
          break;
      }
      
      this.ctx.restore();
    }
  }
  
  /**
   * 绘制圆形粒子
   */
  private drawCircle(p: Particle): void {
    this.ctx.beginPath();
    this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    this.ctx.fillStyle = p.color;
    this.ctx.fill();
  }
  
  /**
   * 绘制方形粒子
   */
  private drawSquare(p: Particle): void {
    const half = p.size / 2;
    this.ctx.fillStyle = p.color;
    this.ctx.fillRect(-half, -half, p.size, p.size);
  }
  
  /**
   * 绘制星形粒子
   */
  private drawStar(p: Particle): void {
    const spikes = 5;
    const outerRadius = p.size;
    const innerRadius = p.size / 2;
    
    this.ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.fillStyle = p.color;
    this.ctx.fill();
  }
  
  /**
   * 绘制发光粒子
   */
  private drawGlow(p: Particle): void {
    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2);
    gradient.addColorStop(0, p.color);
    gradient.addColorStop(0.5, this.adjustColorAlpha(p.color, 0.5));
    gradient.addColorStop(1, this.adjustColorAlpha(p.color, 0));
    
    this.ctx.beginPath();
    this.ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
  }
  
  /**
   * 调整颜色透明度
   */
  private adjustColorAlpha(color: string, alpha: number): string {
    // 处理hex颜色
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }
  
  /**
   * 随机范围值
   */
  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
  
  /**
   * 动画循环
   */
  private animate = (currentTime: number): void => {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    this.update(deltaTime);
    this.render();
    
    if (this.isRunning) {
      this.animationId = requestAnimationFrame(this.animate);
    }
  };
  
  /**
   * 开始动画
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.animate);
  }
  
  /**
   * 停止动画
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * 清除所有粒子
   */
  clear(): void {
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  /**
   * 获取当前粒子数量
   */
  getParticleCount(): number {
    return this.particles.length;
  }
  
  /**
   * 销毁引擎
   */
  destroy(): void {
    this.stop();
    this.clear();
    window.removeEventListener('resize', this.resize.bind(this));
  }
}

// 导出单例实例创建函数
export function createParticleEngine(canvas: HTMLCanvasElement): ParticleEngine {
  return new ParticleEngine(canvas);
}

export default ParticleEngine;