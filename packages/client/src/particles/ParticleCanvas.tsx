/**
 * ParticleCanvas - 粒子特效React组件
 * 封装ParticleEngine，提供声明式的粒子效果接口
 */

import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ParticleEngine, ParticlePreset, EmitterConfig } from './ParticleEngine';

// 组件属性
export interface ParticleCanvasProps {
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 是否启用粒子效果 */
  enabled?: boolean;
  /** 质量级别 (0.5 - 2) */
  quality?: number;
  /** 最大粒子数 */
  maxParticles?: number;
  /** 是否全屏覆盖 */
  fullscreen?: boolean;
}

// 暴露给外部的方法
export interface ParticleCanvasRef {
  /** 发射预设粒子效果 */
  emitPreset: (preset: ParticlePreset, x: number, y: number) => void;
  /** 发射自定义粒子效果 */
  emit: (config: EmitterConfig) => void;
  /** 清除所有粒子 */
  clear: () => void;
  /** 获取当前粒子数量 */
  getParticleCount: () => number;
}

/**
 * ParticleCanvas组件
 */
export const ParticleCanvas = forwardRef<ParticleCanvasRef, ParticleCanvasProps>(({
  className = '',
  style,
  enabled = true,
  quality = 1,
  maxParticles = 1000,
  fullscreen = false,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  
  // 初始化粒子引擎
  useEffect(() => {
    if (!canvasRef.current || !enabled) return;
    
    const engine = new ParticleEngine(canvasRef.current);
    engine.setQuality(quality);
    engine.setMaxParticles(maxParticles);
    engineRef.current = engine;
    
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [enabled]);
  
  // 更新质量设置
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setQuality(quality);
    }
  }, [quality]);
  
  // 更新最大粒子数
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setMaxParticles(maxParticles);
    }
  }, [maxParticles]);
  
  // 发射预设效果
  const emitPreset = useCallback((preset: ParticlePreset, x: number, y: number) => {
    if (engineRef.current && enabled) {
      engineRef.current.emitPreset(preset, x, y);
    }
  }, [enabled]);
  
  // 发射自定义效果
  const emit = useCallback((config: EmitterConfig) => {
    if (engineRef.current && enabled) {
      engineRef.current.emit(config);
    }
  }, [enabled]);
  
  // 清除粒子
  const clear = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.clear();
    }
  }, []);
  
  // 获取粒子数量
  const getParticleCount = useCallback(() => {
    return engineRef.current?.getParticleCount() ?? 0;
  }, []);
  
  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    emitPreset,
    emit,
    clear,
    getParticleCount,
  }), [emitPreset, emit, clear, getParticleCount]);
  
  if (!enabled) return null;
  
  const canvasStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9998,
        ...style,
      }
    : {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      };
  
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={canvasStyle}
    />
  );
});

ParticleCanvas.displayName = 'ParticleCanvas';

// ==================== 便捷Hook ====================

/**
 * 使用粒子效果的Hook
 */
export function useParticles() {
  const canvasRef = useRef<ParticleCanvasRef>(null);
  
  const emitPreset = useCallback((preset: ParticlePreset, x: number, y: number) => {
    canvasRef.current?.emitPreset(preset, x, y);
  }, []);
  
  const emit = useCallback((config: EmitterConfig) => {
    canvasRef.current?.emit(config);
  }, []);
  
  const clear = useCallback(() => {
    canvasRef.current?.clear();
  }, []);
  
  const emitAtElement = useCallback((preset: ParticlePreset, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    emitPreset(preset, x, y);
  }, [emitPreset]);
  
  const emitAtMouse = useCallback((preset: ParticlePreset, event: React.MouseEvent) => {
    emitPreset(preset, event.clientX, event.clientY);
  }, [emitPreset]);
  
  return {
    canvasRef,
    emitPreset,
    emit,
    clear,
    emitAtElement,
    emitAtMouse,
  };
}

// ==================== 预设效果组件 ====================

interface PresetEffectProps {
  /** 效果类型 */
  preset: ParticlePreset;
  /** 触发条件 */
  trigger?: boolean;
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** 触发后回调 */
  onComplete?: () => void;
}

/**
 * 预设效果组件 - 当trigger变为true时发射粒子
 */
export const PresetEffect: React.FC<PresetEffectProps & { canvasRef: React.RefObject<ParticleCanvasRef> }> = ({
  preset,
  trigger,
  x,
  y,
  onComplete,
  canvasRef,
}) => {
  const prevTrigger = useRef(trigger);
  
  useEffect(() => {
    // 检测trigger从false变为true
    if (trigger && !prevTrigger.current) {
      canvasRef.current?.emitPreset(preset, x, y);
      onComplete?.();
    }
    prevTrigger.current = trigger;
  }, [trigger, preset, x, y, onComplete, canvasRef]);
  
  return null;
};

// ==================== 全局粒子上下文 ====================

import { createContext, useContext } from 'react';

interface ParticleContextValue {
  emitPreset: (preset: ParticlePreset, x: number, y: number) => void;
  emit: (config: EmitterConfig) => void;
  clear: () => void;
  emitAtElement: (preset: ParticlePreset, element: HTMLElement) => void;
}

const ParticleContext = createContext<ParticleContextValue | null>(null);

/**
 * 粒子效果Provider
 */
export const ParticleProvider: React.FC<{
  children: React.ReactNode;
  enabled?: boolean;
  quality?: number;
  maxParticles?: number;
}> = ({ children, enabled = true, quality = 1, maxParticles = 1000 }) => {
  const { canvasRef, emitPreset, emit, clear, emitAtElement } = useParticles();
  
  return (
    <ParticleContext.Provider value={{ emitPreset, emit, clear, emitAtElement }}>
      {children}
      <ParticleCanvas
        ref={canvasRef}
        enabled={enabled}
        quality={quality}
        maxParticles={maxParticles}
        fullscreen
      />
    </ParticleContext.Provider>
  );
};

/**
 * 使用全局粒子效果
 */
export function useGlobalParticles(): ParticleContextValue {
  const context = useContext(ParticleContext);
  if (!context) {
    throw new Error('useGlobalParticles必须在ParticleProvider内部使用');
  }
  return context;
}

export default ParticleCanvas;