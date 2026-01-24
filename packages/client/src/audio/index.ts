/**
 * 音效系统模块导出
 */

export { 
  AudioManager, 
  getAudioManager,
  type SoundConfig,
  type SoundCategory,
  type VolumeSettings,
  type AudioEvent,
} from './AudioManager';

export {
  ALL_SOUND_CONFIGS,
  BGM_CONFIGS,
  UI_SFX_CONFIGS,
  GAME_SFX_CONFIGS,
  AMBIENT_CONFIGS,
  PRELOAD_SOUNDS,
  getSoundKeysByCategory,
  GAMEPLAY_BGM_LIST,
  getRecommendedBGM,
} from './audioAssets';

export {
  useAudio,
  useUISound,
  useGameSound,
  useBGM,
  useAmbient,
  useVolumeSettings,
  useSoundOnClick,
  useWithSound,
} from './hooks';