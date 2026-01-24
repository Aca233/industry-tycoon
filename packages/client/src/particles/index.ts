/**
 * 粒子特效系统模块导出
 */

export {
  ParticleEngine,
  createParticleEngine,
  type Particle,
  type EmitterConfig,
  type ParticlePreset,
} from './ParticleEngine';

export {
  ParticleCanvas,
  useParticles,
  useGlobalParticles,
  ParticleProvider,
  PresetEffect,
  type ParticleCanvasProps,
  type ParticleCanvasRef,
} from './ParticleCanvas';