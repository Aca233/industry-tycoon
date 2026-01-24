/**
 * 音效系统 React Hooks
 * 提供在 React 组件中使用音效系统的便捷方式
 */

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { VolumeSettings, SoundCategory, getAudioManager } from './AudioManager';
import { ALL_SOUND_CONFIGS, getRecommendedBGM, PRELOAD_SOUNDS } from './audioAssets';

/**
 * 主音效 Hook
 * 提供完整的音效系统访问
 */
export function useAudio() {
  const audioManager = useMemo(() => getAudioManager(), []);
  const [isInitialized, setIsInitialized] = useState(false);
  const [volumeSettings, setVolumeSettings] = useState<VolumeSettings>(
    audioManager.getVolumeSettings()
  );

  // 初始化音效系统
  useEffect(() => {
    if (!isInitialized) {
      audioManager.init(ALL_SOUND_CONFIGS);
      setIsInitialized(true);
      
      // 预加载关键音效
      audioManager.preload(PRELOAD_SOUNDS).catch(console.warn);
    }

    // 监听音量变化
    const handleVolumeChange = () => {
      setVolumeSettings(audioManager.getVolumeSettings());
    };

    const handleMuteChange = () => {
      setVolumeSettings(audioManager.getVolumeSettings());
    };

    audioManager.on('volumeChange', handleVolumeChange);
    audioManager.on('muteChange', handleMuteChange);

    return () => {
      audioManager.off('volumeChange', handleVolumeChange);
      audioManager.off('muteChange', handleMuteChange);
    };
  }, [audioManager, isInitialized]);

  // 播放 SFX
  const playSFX = useCallback((key: string) => {
    audioManager.playSFX(key);
  }, [audioManager]);

  // 播放 UI 音效
  const playUI = useCallback((key: string) => {
    audioManager.playUI(key);
  }, [audioManager]);

  // 播放 BGM
  const playBGM = useCallback((key: string, fadeIn?: boolean) => {
    audioManager.playBGM(key, fadeIn);
  }, [audioManager]);

  // 停止 BGM
  const stopBGM = useCallback((fadeOut?: boolean) => {
    audioManager.stopBGM(fadeOut);
  }, [audioManager]);

  // 暂停/恢复 BGM
  const pauseBGM = useCallback(() => audioManager.pauseBGM(), [audioManager]);
  const resumeBGM = useCallback(() => audioManager.resumeBGM(), [audioManager]);

  // 环境音控制
  const startAmbient = useCallback((key: string, fadeIn?: boolean) => {
    audioManager.startAmbient(key, fadeIn);
  }, [audioManager]);

  const stopAmbient = useCallback((key: string, fadeOut?: boolean) => {
    audioManager.stopAmbient(key, fadeOut);
  }, [audioManager]);

  const stopAllAmbients = useCallback((fadeOut?: boolean) => {
    audioManager.stopAllAmbients(fadeOut);
  }, [audioManager]);

  // 音量控制
  const setMasterVolume = useCallback((volume: number) => {
    audioManager.setMasterVolume(volume);
  }, [audioManager]);

  const setCategoryVolume = useCallback((category: SoundCategory, volume: number) => {
    audioManager.setCategoryVolume(category, volume);
  }, [audioManager]);

  const setMuted = useCallback((muted: boolean) => {
    audioManager.setMuted(muted);
  }, [audioManager]);

  const toggleMute = useCallback(() => {
    return audioManager.toggleMute();
  }, [audioManager]);

  // 恢复音频上下文（用户交互后调用）
  const resumeAudioContext = useCallback(() => {
    audioManager.resumeAudioContext();
  }, [audioManager]);

  return {
    isInitialized,
    volumeSettings,
    
    // 播放控制
    playSFX,
    playUI,
    playBGM,
    stopBGM,
    pauseBGM,
    resumeBGM,
    startAmbient,
    stopAmbient,
    stopAllAmbients,
    
    // 音量控制
    setMasterVolume,
    setCategoryVolume,
    setMuted,
    toggleMute,
    isMuted: volumeSettings.muted,
    
    // 工具
    resumeAudioContext,
    audioManager,
  };
}

/**
 * UI 音效 Hook
 * 专门用于 UI 交互音效
 */
export function useUISound() {
  const audioManager = useMemo(() => getAudioManager(), []);
  
  const playClick = useCallback(() => {
    audioManager.playSFX('ui-click');
  }, [audioManager]);

  const playHover = useCallback(() => {
    audioManager.playSFX('ui-hover');
  }, [audioManager]);

  const playPanelOpen = useCallback(() => {
    audioManager.playSFX('ui-panel-open');
  }, [audioManager]);

  const playPanelClose = useCallback(() => {
    audioManager.playSFX('ui-panel-close');
  }, [audioManager]);

  const playTabSwitch = useCallback(() => {
    audioManager.playSFX('ui-tab-switch');
  }, [audioManager]);

  const playToggle = useCallback(() => {
    audioManager.playSFX('ui-toggle');
  }, [audioManager]);

  const playConfirm = useCallback(() => {
    audioManager.playSFX('ui-confirm');
  }, [audioManager]);

  const playCancel = useCallback(() => {
    audioManager.playSFX('ui-cancel');
  }, [audioManager]);

  const playError = useCallback(() => {
    audioManager.playSFX('ui-error');
  }, [audioManager]);

  const playSuccess = useCallback(() => {
    audioManager.playSFX('ui-success');
  }, [audioManager]);

  const playWarning = useCallback(() => {
    audioManager.playSFX('ui-warning');
  }, [audioManager]);

  return {
    playClick,
    playHover,
    playPanelOpen,
    playPanelClose,
    playTabSwitch,
    playToggle,
    playConfirm,
    playCancel,
    playError,
    playSuccess,
    playWarning,
  };
}

/**
 * 游戏音效 Hook
 * 用于游戏事件音效
 */
export function useGameSound() {
  const audioManager = useMemo(() => getAudioManager(), []);

  // 交易音效
  const playTradeBuy = useCallback(() => {
    audioManager.playSFX('trade-buy');
  }, [audioManager]);

  const playTradeSell = useCallback(() => {
    audioManager.playSFX('trade-sell');
  }, [audioManager]);

  const playTradeBig = useCallback(() => {
    audioManager.playSFX('trade-big');
  }, [audioManager]);

  const playTradeFail = useCallback(() => {
    audioManager.playSFX('trade-fail');
  }, [audioManager]);

  // 生产音效
  const playProductionComplete = useCallback(() => {
    audioManager.playSFX('production-complete');
  }, [audioManager]);

  const playBuildingConstruct = useCallback(() => {
    audioManager.playSFX('building-construct');
  }, [audioManager]);

  const playBuildingUpgrade = useCallback(() => {
    audioManager.playSFX('building-upgrade');
  }, [audioManager]);

  // 研究音效
  const playResearchStart = useCallback(() => {
    audioManager.playSFX('research-start');
  }, [audioManager]);

  const playResearchComplete = useCallback(() => {
    audioManager.playSFX('research-complete');
  }, [audioManager]);

  const playTechUnlock = useCallback(() => {
    audioManager.playSFX('tech-unlock');
  }, [audioManager]);

  // 经济音效
  const playMoneyGain = useCallback(() => {
    audioManager.playSFX('money-gain');
  }, [audioManager]);

  const playMoneyJackpot = useCallback(() => {
    audioManager.playSFX('money-jackpot');
  }, [audioManager]);

  // 通知音效
  const playNotification = useCallback(() => {
    audioManager.playSFX('notification-new');
  }, [audioManager]);

  const playAchievement = useCallback(() => {
    audioManager.playSFX('achievement-unlock');
  }, [audioManager]);

  // 市场音效
  const playPriceUp = useCallback(() => {
    audioManager.playSFX('market-price-up');
  }, [audioManager]);

  const playPriceDown = useCallback(() => {
    audioManager.playSFX('market-price-down');
  }, [audioManager]);

  const playMarketAlert = useCallback(() => {
    audioManager.playSFX('market-alert');
  }, [audioManager]);

  return {
    // 交易
    playTradeBuy,
    playTradeSell,
    playTradeBig,
    playTradeFail,
    
    // 生产
    playProductionComplete,
    playBuildingConstruct,
    playBuildingUpgrade,
    
    // 研究
    playResearchStart,
    playResearchComplete,
    playTechUnlock,
    
    // 经济
    playMoneyGain,
    playMoneyJackpot,
    
    // 通知
    playNotification,
    playAchievement,
    
    // 市场
    playPriceUp,
    playPriceDown,
    playMarketAlert,
  };
}

/**
 * BGM 管理 Hook
 * 根据游戏状态自动管理背景音乐
 */
export function useBGM(options?: {
  autoPlay?: boolean;
  defaultBGM?: string;
}) {
  const audioManager = useMemo(() => getAudioManager(), []);
  const [currentBGM, setCurrentBGM] = useState<string | null>(null);
  const autoPlayRef = useRef(options?.autoPlay ?? true);

  useEffect(() => {
    const handleBGMChange = (data: unknown) => {
      const { key } = data as { key: string | null };
      setCurrentBGM(key);
    };

    audioManager.on('bgmChange', handleBGMChange);
    
    // 初始化时检查当前BGM
    setCurrentBGM(audioManager.getCurrentBGMKey());

    return () => {
      audioManager.off('bgmChange', handleBGMChange);
    };
  }, [audioManager]);

  // 自动播放默认BGM
  useEffect(() => {
    if (autoPlayRef.current && options?.defaultBGM && !currentBGM) {
      // 延迟播放以确保用户已交互
      const handleFirstInteraction = () => {
        audioManager.resumeAudioContext();
        audioManager.playBGM(options.defaultBGM!);
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('keydown', handleFirstInteraction);
      };

      document.addEventListener('click', handleFirstInteraction);
      document.addEventListener('keydown', handleFirstInteraction);

      return () => {
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('keydown', handleFirstInteraction);
      };
    }
  }, [audioManager, options?.defaultBGM, currentBGM]);

  const play = useCallback((key: string, fadeIn?: boolean) => {
    audioManager.playBGM(key, fadeIn);
  }, [audioManager]);

  const stop = useCallback((fadeOut?: boolean) => {
    audioManager.stopBGM(fadeOut);
  }, [audioManager]);

  const pause = useCallback(() => {
    audioManager.pauseBGM();
  }, [audioManager]);

  const resume = useCallback(() => {
    audioManager.resumeBGM();
  }, [audioManager]);

  // 根据游戏上下文切换BGM
  const switchByContext = useCallback((context: Parameters<typeof getRecommendedBGM>[0]) => {
    const recommended = getRecommendedBGM(context);
    if (recommended !== currentBGM) {
      audioManager.playBGM(recommended);
    }
  }, [audioManager, currentBGM]);

  return {
    currentBGM,
    play,
    stop,
    pause,
    resume,
    switchByContext,
  };
}

/**
 * 环境音 Hook
 */
export function useAmbient() {
  const audioManager = useMemo(() => getAudioManager(), []);
  const [activeAmbients, setActiveAmbients] = useState<string[]>([]);

  useEffect(() => {
    const handleAmbientChange = () => {
      setActiveAmbients(audioManager.getActiveAmbientKeys());
    };

    audioManager.on('ambientChange', handleAmbientChange);
    setActiveAmbients(audioManager.getActiveAmbientKeys());

    return () => {
      audioManager.off('ambientChange', handleAmbientChange);
    };
  }, [audioManager]);

  const start = useCallback((key: string, fadeIn?: boolean) => {
    audioManager.startAmbient(key, fadeIn);
  }, [audioManager]);

  const stop = useCallback((key: string, fadeOut?: boolean) => {
    audioManager.stopAmbient(key, fadeOut);
  }, [audioManager]);

  const stopAll = useCallback((fadeOut?: boolean) => {
    audioManager.stopAllAmbients(fadeOut);
  }, [audioManager]);

  const isPlaying = useCallback((key: string) => {
    return activeAmbients.includes(key);
  }, [activeAmbients]);

  return {
    activeAmbients,
    start,
    stop,
    stopAll,
    isPlaying,
  };
}

/**
 * 音量设置 Hook
 * 专门用于音量控制UI
 */
export function useVolumeSettings() {
  const audioManager = useMemo(() => getAudioManager(), []);
  const [settings, setSettings] = useState<VolumeSettings>(
    audioManager.getVolumeSettings()
  );

  useEffect(() => {
    const handleChange = () => {
      setSettings(audioManager.getVolumeSettings());
    };

    audioManager.on('volumeChange', handleChange);
    audioManager.on('muteChange', handleChange);

    return () => {
      audioManager.off('volumeChange', handleChange);
      audioManager.off('muteChange', handleChange);
    };
  }, [audioManager]);

  const setMaster = useCallback((volume: number) => {
    audioManager.setMasterVolume(volume);
  }, [audioManager]);

  const setBGM = useCallback((volume: number) => {
    audioManager.setCategoryVolume('bgm', volume);
  }, [audioManager]);

  const setSFX = useCallback((volume: number) => {
    audioManager.setCategoryVolume('sfx', volume);
  }, [audioManager]);

  const setAmbient = useCallback((volume: number) => {
    audioManager.setCategoryVolume('ambient', volume);
  }, [audioManager]);

  const setUI = useCallback((volume: number) => {
    audioManager.setCategoryVolume('ui', volume);
  }, [audioManager]);

  const setMuted = useCallback((muted: boolean) => {
    audioManager.setMuted(muted);
  }, [audioManager]);

  const toggleMute = useCallback(() => {
    return audioManager.toggleMute();
  }, [audioManager]);

  return {
    settings,
    setMaster,
    setBGM,
    setSFX,
    setAmbient,
    setUI,
    setMuted,
    toggleMute,
  };
}

/**
 * 带音效的按钮点击处理器
 * 包装现有的点击处理器，添加音效
 */
export function useSoundOnClick<T extends (...args: unknown[]) => void>(
  handler: T,
  soundKey: string = 'ui-click'
): T {
  const audioManager = useMemo(() => getAudioManager(), []);
  
  return useCallback((...args: unknown[]) => {
    audioManager.playSFX(soundKey);
    handler(...args);
  }, [audioManager, handler, soundKey]) as T;
}

/**
 * 创建带音效的事件处理器工厂
 */
export function useWithSound() {
  const audioManager = useMemo(() => getAudioManager(), []);

  const withSound = useCallback(<T extends (...args: unknown[]) => void>(
    handler: T,
    soundKey: string
  ): T => {
    return ((...args: unknown[]) => {
      audioManager.playSFX(soundKey);
      handler(...args);
    }) as T;
  }, [audioManager]);

  return withSound;
}