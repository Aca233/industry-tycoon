/**
 * 粒子系统 React Hooks
 * 提供在React组件中使用粒子效果的便捷方法
 */

import { useCallback, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { 
  getParticleSystem, 
  destroyParticleSystem,
  ParticleSystem,
  EmitterConfig 
} from './ParticleSystem';
import * as effects from './effects';

/**
 * 粒子系统初始化Hook
 * 在应用最顶层使用一次
 */
export function useParticleSystem(app: PIXI.Application | null): ParticleSystem | null {
  const systemRef = useRef<ParticleSystem | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (app && !initializedRef.current) {
      const system = getParticleSystem();
      system.init(app).then(() => {
        systemRef.current = system;
        initializedRef.current = true;
      });
    }

    return () => {
      if (initializedRef.current) {
        destroyParticleSystem();
        systemRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [app]);

  return systemRef.current;
}

/**
 * 粒子发射Hook
 * 返回发射粒子的函数
 */
export function useParticleEmit() {
  const emit = useCallback((config: EmitterConfig) => {
    const system = getParticleSystem();
    system.emit(config);
  }, []);

  return emit;
}

/**
 * 预定义特效Hook
 * 返回所有预定义的特效函数
 */
export function useParticleEffects() {
  return {
    // 经济效果
    profitSparkle: useCallback((x: number, y: number, intensity?: number) => {
      effects.profitSparkle(x, y, intensity);
    }, []),
    
    lossSpark: useCallback((x: number, y: number, intensity?: number) => {
      effects.lossSpark(x, y, intensity);
    }, []),
    
    moneyFloat: useCallback((x: number, y: number, amount: number) => {
      effects.moneyFloat(x, y, amount);
    }, []),
    
    // 数据效果
    dataFlow: useCallback((x: number, y: number, direction?: 'left' | 'right') => {
      effects.dataFlow(x, y, direction);
    }, []),
    
    // 能量效果
    energyPulse: useCallback((x: number, y: number, color?: number) => {
      effects.energyPulse(x, y, color);
    }, []),
    
    // 警告效果
    warningFlash: useCallback((x: number, y: number) => {
      effects.warningFlash(x, y);
    }, []),
    
    // 爆炸效果
    explosion: useCallback((x: number, y: number, size?: number) => {
      effects.explosion(x, y, size);
    }, []),
    
    // 游戏事件效果
    purchaseSuccess: useCallback((x: number, y: number) => {
      effects.purchaseSuccess(x, y);
    }, []),
    
    researchComplete: useCallback((x: number, y: number) => {
      effects.researchComplete(x, y);
    }, []),
    
    buildingConstruct: useCallback((x: number, y: number, width?: number, height?: number) => {
      effects.buildingConstruct(x, y, width, height);
    }, []),
    
    productionComplete: useCallback((x: number, y: number) => {
      effects.productionComplete(x, y);
    }, []),
    
    circuitTrace: useCallback((x: number, y: number, width: number, height: number) => {
      effects.circuitTrace(x, y, width, height);
    }, []),
  };
}

/**
 * 环境粒子发射器Hook
 * 用于创建和管理持续的背景粒子效果
 */
export function useAmbientEmitter(
  id: string,
  x: number,
  y: number,
  type: 'data' | 'energy' | 'money',
  enabled: boolean = true
) {
  const activeRef = useRef(false);

  useEffect(() => {
    if (enabled && !activeRef.current) {
      effects.createAmbientEmitter(id, x, y, type);
      activeRef.current = true;
    } else if (!enabled && activeRef.current) {
      effects.stopAmbientEmitter(id);
      activeRef.current = false;
    }

    return () => {
      if (activeRef.current) {
        effects.removeAmbientEmitter(id);
        activeRef.current = false;
      }
    };
  }, [id, x, y, type, enabled]);

  const stop = useCallback(() => {
    effects.stopAmbientEmitter(id);
    activeRef.current = false;
  }, [id]);

  const start = useCallback(() => {
    effects.createAmbientEmitter(id, x, y, type);
    activeRef.current = true;
  }, [id, x, y, type]);

  return { stop, start, isActive: activeRef.current };
}

/**
 * 元素位置粒子效果Hook
 * 在指定DOM元素位置触发粒子效果
 */
export function useElementParticles() {
  const triggerAtElement = useCallback((
    element: HTMLElement | null,
    effect: keyof ReturnType<typeof useParticleEffects>,
    ...args: any[]
  ) => {
    if (!element) return;
    
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    const effectFunctions = {
      profitSparkle: () => effects.profitSparkle(x, y, args[0]),
      lossSpark: () => effects.lossSpark(x, y, args[0]),
      moneyFloat: () => effects.moneyFloat(x, y, args[0] ?? 100),
      dataFlow: () => effects.dataFlow(x, y, args[0]),
      energyPulse: () => effects.energyPulse(x, y, args[0]),
      warningFlash: () => effects.warningFlash(x, y),
      explosion: () => effects.explosion(x, y, args[0]),
      purchaseSuccess: () => effects.purchaseSuccess(x, y),
      researchComplete: () => effects.researchComplete(x, y),
      buildingConstruct: () => effects.buildingConstruct(x, y, args[0], args[1]),
      productionComplete: () => effects.productionComplete(x, y),
      circuitTrace: () => effects.circuitTrace(x, y, args[0] ?? 100, args[1] ?? 80),
    };
    
    effectFunctions[effect]?.();
  }, []);

  return triggerAtElement;
}

/**
 * 鼠标跟随粒子效果Hook
 */
export function useMouseTrailParticles(
  enabled: boolean = false,
  type: 'data' | 'energy' = 'data'
) {
  const lastEmitTime = useRef(0);
  const emitInterval = 50; // 毫秒

  useEffect(() => {
    if (!enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastEmitTime.current < emitInterval) return;
      lastEmitTime.current = now;

      const system = getParticleSystem();
      
      if (type === 'data') {
        system.emit({
          type: 'data-flow',
          x: e.clientX,
          y: e.clientY,
          count: 2,
          angle: Math.random() * Math.PI * 2,
          spread: Math.PI / 4,
          speed: [1, 3],
          life: [15, 25],
          size: [2, 4],
          color: 0x00f5ff,
          friction: 0.95,
        });
      } else {
        system.emit({
          type: 'energy-pulse',
          x: e.clientX,
          y: e.clientY,
          count: 1,
          angle: Math.random() * Math.PI * 2,
          spread: Math.PI * 2,
          speed: [0.5, 1.5],
          life: [20, 30],
          size: [3, 5],
          color: 0x8b5cf6,
          friction: 0.9,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, type]);
}

/**
 * 交易粒子效果Hook
 * 根据交易类型和金额触发相应效果
 */
export function useTradeParticles() {
  const triggerTradeEffect = useCallback((
    x: number,
    y: number,
    type: 'buy' | 'sell',
    amount: number,
    profit?: number
  ) => {
    // 基础交易效果
    effects.moneyFloat(x, y, type === 'buy' ? -amount : amount);
    
    // 如果有利润信息
    if (profit !== undefined) {
      if (profit > 0) {
        effects.profitSparkle(x, y, Math.min(profit / 1000, 2));
      } else if (profit < 0) {
        effects.lossSpark(x, y, Math.min(Math.abs(profit) / 1000, 2));
      }
    }
  }, []);

  return triggerTradeEffect;
}

/**
 * 股价变化粒子效果Hook
 */
export function usePriceChangeParticles() {
  const triggerPriceChange = useCallback((
    x: number,
    y: number,
    changePercent: number
  ) => {
    const absChange = Math.abs(changePercent);
    
    if (absChange < 1) return; // 忽略微小变化
    
    const intensity = Math.min(absChange / 5, 2);
    
    if (changePercent > 0) {
      effects.profitSparkle(x, y, intensity);
    } else {
      effects.lossSpark(x, y, intensity);
    }
  }, []);

  return triggerPriceChange;
}