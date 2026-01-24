/**
 * AudioManager - 游戏音效管理器
 * 基于 Howler.js 的单例模式音效管理系统
 */

import { Howl, Howler } from 'howler';

// 音效类别
export type SoundCategory = 'bgm' | 'sfx' | 'ambient' | 'ui';

// 音效配置接口
export interface SoundConfig {
  src: string[];
  volume?: number;
  loop?: boolean;
  category: SoundCategory;
  preload?: boolean;
  sprite?: Record<string, [number, number] | [number, number, boolean]>;
}

// 音量设置接口
export interface VolumeSettings {
  master: number;
  bgm: number;
  sfx: number;
  ambient: number;
  ui: number;
  muted: boolean;
}

// 音效事件类型
export type AudioEvent = 
  | 'volumeChange'
  | 'bgmChange'
  | 'sfxPlay'
  | 'ambientChange'
  | 'muteChange';

type AudioEventListener = (data: unknown) => void;

// 默认音量设置
const DEFAULT_VOLUME_SETTINGS: VolumeSettings = {
  master: 0.7,
  bgm: 0.5,
  sfx: 0.8,
  ambient: 0.4,
  ui: 0.6,
  muted: false,
};

// 本地存储键
const STORAGE_KEY = 'scc-audio-settings';

/**
 * AudioManager 单例类
 * 管理所有游戏音效、背景音乐和环境音
 */
export class AudioManager {
  private static instance: AudioManager | null = null;
  
  // 音效缓存
  private soundCache: Map<string, Howl> = new Map();
  
  // 当前播放的BGM
  private currentBGM: { key: string; howl: Howl } | null = null;
  
  // 当前播放的环境音
  private activeAmbients: Map<string, Howl> = new Map();
  
  // 音量设置
  private volumeSettings: VolumeSettings;
  
  // 事件监听器
  private eventListeners: Map<AudioEvent, Set<AudioEventListener>> = new Map();
  
  // 是否已初始化
  private initialized: boolean = false;
  
  // 音效配置注册表
  private soundConfigs: Map<string, SoundConfig> = new Map();
  
  // 淡入淡出持续时间(ms)
  private fadeDuration: number = 1000;

  private constructor() {
    this.volumeSettings = this.loadVolumeSettings();
    this.applyMasterVolume();
  }

  /**
   * 获取 AudioManager 单例实例
   */
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * 初始化音效系统
   * @param configs 音效配置映射
   */
  public init(configs: Record<string, SoundConfig>): void {
    if (this.initialized) {
      console.warn('[AudioManager] 已经初始化');
      return;
    }

    // 注册所有音效配置
    Object.entries(configs).forEach(([key, config]) => {
      this.soundConfigs.set(key, config);
      
      // 预加载标记为需要预加载的音效
      if (config.preload) {
        this.loadSound(key);
      }
    });

    this.initialized = true;
    console.log('[AudioManager] 初始化完成，已注册', this.soundConfigs.size, '个音效配置');
  }

  /**
   * 加载音效到缓存
   */
  private loadSound(key: string): Howl | null {
    // 如果已缓存，直接返回
    if (this.soundCache.has(key)) {
      return this.soundCache.get(key)!;
    }

    const config = this.soundConfigs.get(key);
    if (!config) {
      console.warn(`[AudioManager] 未找到音效配置: ${key}`);
      return null;
    }

    const howl = new Howl({
      src: config.src,
      volume: this.getEffectiveVolume(config.category, config.volume),
      loop: config.loop ?? false,
      sprite: config.sprite,
      preload: true,
      onloaderror: (_id, error) => {
        console.error(`[AudioManager] 加载音效失败 ${key}:`, error);
      },
      onplayerror: (_id, error) => {
        console.error(`[AudioManager] 播放音效失败 ${key}:`, error);
        // 尝试解锁音频上下文
        howl.once('unlock', () => {
          howl.play();
        });
      },
    });

    this.soundCache.set(key, howl);
    return howl;
  }

  /**
   * 计算有效音量（考虑主音量和分类音量）
   */
  private getEffectiveVolume(category: SoundCategory, baseVolume: number = 1): number {
    if (this.volumeSettings.muted) return 0;
    
    const categoryVolume = this.volumeSettings[category] ?? 1;
    return this.volumeSettings.master * categoryVolume * baseVolume;
  }

  /**
   * 应用主音量到全局
   */
  private applyMasterVolume(): void {
    Howler.volume(this.volumeSettings.muted ? 0 : this.volumeSettings.master);
  }

  /**
   * 更新特定类别的所有音效音量
   */
  private updateCategoryVolume(category: SoundCategory): void {
    this.soundCache.forEach((howl, key) => {
      const config = this.soundConfigs.get(key);
      if (config?.category === category) {
        howl.volume(this.getEffectiveVolume(category, config.volume));
      }
    });
  }

  // ==================== 播放控制 ====================

  /**
   * 播放音效 (一次性)
   */
  public playSFX(key: string, spriteKey?: string): number | null {
    const howl = this.loadSound(key);
    if (!howl) return null;

    const config = this.soundConfigs.get(key);
    howl.volume(this.getEffectiveVolume(config?.category ?? 'sfx', config?.volume));
    
    const id = spriteKey ? howl.play(spriteKey) : howl.play();
    this.emit('sfxPlay', { key, id });
    return id;
  }

  /**
   * 播放UI音效
   */
  public playUI(key: string): number | null {
    return this.playSFX(key);
  }

  /**
   * 播放背景音乐（带淡入淡出）
   */
  public playBGM(key: string, fadeIn: boolean = true): void {
    // 如果是同一首BGM，忽略
    if (this.currentBGM?.key === key) return;

    // 淡出当前BGM
    if (this.currentBGM) {
      const oldBGM = this.currentBGM.howl;
      oldBGM.fade(oldBGM.volume(), 0, this.fadeDuration);
      oldBGM.once('fade', () => {
        oldBGM.stop();
      });
    }

    // 加载并播放新BGM
    const howl = this.loadSound(key);
    if (!howl) return;

    const config = this.soundConfigs.get(key);
    const targetVolume = this.getEffectiveVolume('bgm', config?.volume);

    if (fadeIn) {
      howl.volume(0);
      howl.play();
      howl.fade(0, targetVolume, this.fadeDuration);
    } else {
      howl.volume(targetVolume);
      howl.play();
    }

    // 确保循环
    howl.loop(true);

    this.currentBGM = { key, howl };
    this.emit('bgmChange', { key });
  }

  /**
   * 停止背景音乐
   */
  public stopBGM(fadeOut: boolean = true): void {
    if (!this.currentBGM) return;

    const { howl } = this.currentBGM;
    
    if (fadeOut) {
      howl.fade(howl.volume(), 0, this.fadeDuration);
      howl.once('fade', () => {
        howl.stop();
      });
    } else {
      howl.stop();
    }

    this.currentBGM = null;
    this.emit('bgmChange', { key: null });
  }

  /**
   * 暂停背景音乐
   */
  public pauseBGM(): void {
    this.currentBGM?.howl.pause();
  }

  /**
   * 恢复背景音乐
   */
  public resumeBGM(): void {
    this.currentBGM?.howl.play();
  }

  /**
   * 开始播放环境音
   */
  public startAmbient(key: string, fadeIn: boolean = true): void {
    // 如果已在播放，忽略
    if (this.activeAmbients.has(key)) return;

    const howl = this.loadSound(key);
    if (!howl) return;

    const config = this.soundConfigs.get(key);
    const targetVolume = this.getEffectiveVolume('ambient', config?.volume);

    if (fadeIn) {
      howl.volume(0);
      howl.play();
      howl.fade(0, targetVolume, this.fadeDuration);
    } else {
      howl.volume(targetVolume);
      howl.play();
    }

    howl.loop(true);
    this.activeAmbients.set(key, howl);
    this.emit('ambientChange', { key, action: 'start' });
  }

  /**
   * 停止环境音
   */
  public stopAmbient(key: string, fadeOut: boolean = true): void {
    const howl = this.activeAmbients.get(key);
    if (!howl) return;

    if (fadeOut) {
      howl.fade(howl.volume(), 0, this.fadeDuration);
      howl.once('fade', () => {
        howl.stop();
      });
    } else {
      howl.stop();
    }

    this.activeAmbients.delete(key);
    this.emit('ambientChange', { key, action: 'stop' });
  }

  /**
   * 停止所有环境音
   */
  public stopAllAmbients(fadeOut: boolean = true): void {
    this.activeAmbients.forEach((_, key) => {
      this.stopAmbient(key, fadeOut);
    });
  }

  // ==================== 音量控制 ====================

  /**
   * 设置主音量
   */
  public setMasterVolume(volume: number): void {
    this.volumeSettings.master = Math.max(0, Math.min(1, volume));
    this.applyMasterVolume();
    this.saveVolumeSettings();
    this.emit('volumeChange', { category: 'master', volume: this.volumeSettings.master });
  }

  /**
   * 设置分类音量
   */
  public setCategoryVolume(category: SoundCategory, volume: number): void {
    this.volumeSettings[category] = Math.max(0, Math.min(1, volume));
    this.updateCategoryVolume(category);
    this.saveVolumeSettings();
    this.emit('volumeChange', { category, volume: this.volumeSettings[category] });
  }

  /**
   * 获取音量设置
   */
  public getVolumeSettings(): VolumeSettings {
    return { ...this.volumeSettings };
  }

  /**
   * 设置静音状态
   */
  public setMuted(muted: boolean): void {
    this.volumeSettings.muted = muted;
    this.applyMasterVolume();
    
    // 更新所有活动音效的音量
    if (muted) {
      this.soundCache.forEach(howl => howl.mute(true));
    } else {
      this.soundCache.forEach((howl, key) => {
        howl.mute(false);
        const config = this.soundConfigs.get(key);
        if (config) {
          howl.volume(this.getEffectiveVolume(config.category, config.volume));
        }
      });
    }
    
    this.saveVolumeSettings();
    this.emit('muteChange', { muted });
  }

  /**
   * 切换静音状态
   */
  public toggleMute(): boolean {
    this.setMuted(!this.volumeSettings.muted);
    return this.volumeSettings.muted;
  }

  /**
   * 检查是否静音
   */
  public isMuted(): boolean {
    return this.volumeSettings.muted;
  }

  // ==================== 持久化 ====================

  /**
   * 从本地存储加载音量设置
   */
  private loadVolumeSettings(): VolumeSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<VolumeSettings>;
        return { ...DEFAULT_VOLUME_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.warn('[AudioManager] 加载音量设置失败:', error);
    }
    return { ...DEFAULT_VOLUME_SETTINGS };
  }

  /**
   * 保存音量设置到本地存储
   */
  private saveVolumeSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.volumeSettings));
    } catch (error) {
      console.warn('[AudioManager] 保存音量设置失败:', error);
    }
  }

  // ==================== 事件系统 ====================

  /**
   * 添加事件监听器
   */
  public on(event: AudioEvent, listener: AudioEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * 移除事件监听器
   */
  public off(event: AudioEvent, listener: AudioEventListener): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  /**
   * 触发事件
   */
  private emit(event: AudioEvent, data: unknown): void {
    this.eventListeners.get(event)?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`[AudioManager] 事件处理器错误 ${event}:`, error);
      }
    });
  }

  // ==================== 工具方法 ====================

  /**
   * 预加载一组音效
   */
  public preload(keys: string[]): Promise<void> {
    const promises = keys.map(key => {
      return new Promise<void>((resolve, reject) => {
        const howl = this.loadSound(key);
        if (!howl) {
          reject(new Error(`音效不存在: ${key}`));
          return;
        }
        
        if (howl.state() === 'loaded') {
          resolve();
        } else {
          howl.once('load', () => resolve());
          howl.once('loaderror', () => reject(new Error(`加载失败: ${key}`)));
        }
      });
    });

    return Promise.all(promises).then(() => {
      console.log('[AudioManager] 预加载完成:', keys.length, '个音效');
    });
  }

  /**
   * 卸载音效释放内存
   */
  public unload(key: string): void {
    const howl = this.soundCache.get(key);
    if (howl) {
      howl.unload();
      this.soundCache.delete(key);
    }
  }

  /**
   * 卸载所有音效
   */
  public unloadAll(): void {
    this.stopBGM(false);
    this.stopAllAmbients(false);
    this.soundCache.forEach(howl => howl.unload());
    this.soundCache.clear();
  }

  /**
   * 获取当前BGM键
   */
  public getCurrentBGMKey(): string | null {
    return this.currentBGM?.key ?? null;
  }

  /**
   * 获取活动环境音键列表
   */
  public getActiveAmbientKeys(): string[] {
    return Array.from(this.activeAmbients.keys());
  }

  /**
   * 设置淡入淡出持续时间
   */
  public setFadeDuration(duration: number): void {
    this.fadeDuration = Math.max(0, duration);
  }

  /**
   * 恢复音频上下文（用于用户交互后解锁音频）
   */
  public async resumeAudioContext(): Promise<void> {
    const ctx = Howler.ctx;
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
      console.log('[AudioManager] 音频上下文已恢复');
    }
  }

  /**
   * 检查音效是否已加载
   */
  public isLoaded(key: string): boolean {
    const howl = this.soundCache.get(key);
    return howl?.state() === 'loaded';
  }

  /**
   * 获取音效加载状态
   */
  public getLoadState(key: string): 'unloaded' | 'loading' | 'loaded' {
    const howl = this.soundCache.get(key);
    if (!howl) return 'unloaded';
    return howl.state() as 'loading' | 'loaded';
  }
}

// 导出单例访问函数
export const getAudioManager = (): AudioManager => AudioManager.getInstance();

// 导出默认实例
export default AudioManager;