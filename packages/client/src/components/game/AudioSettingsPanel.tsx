/**
 * 音效设置面板组件
 * 提供音量控制和静音功能
 */

import React, { useCallback } from 'react';
import { useVolumeSettings, useUISound } from '../../audio';

interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon: React.ReactNode;
  disabled?: boolean;
}

/**
 * 音量滑块组件
 */
const VolumeSlider: React.FC<VolumeSliderProps> = ({
  label,
  value,
  onChange,
  icon,
  disabled = false,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange]
  );

  const percentage = Math.round(value * 100);

  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="w-6 text-cyan-400 flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-sm text-gray-300">{label}</span>
          <span className="text-sm text-cyan-400 font-mono">{percentage}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer 
                     accent-cyan-500 
                     [&::-webkit-slider-thumb]:appearance-none 
                     [&::-webkit-slider-thumb]:w-4 
                     [&::-webkit-slider-thumb]:h-4 
                     [&::-webkit-slider-thumb]:rounded-full 
                     [&::-webkit-slider-thumb]:bg-cyan-400 
                     [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,245,255,0.5)]
                     [&::-webkit-slider-thumb]:transition-shadow
                     [&::-webkit-slider-thumb]:hover:shadow-[0_0_15px_rgba(0,245,255,0.8)]
                     disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
};

// 图标组件
const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

const MusicIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
  </svg>
);

const SoundEffectIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M7.58 4.08L6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2c.15-2.65 1.51-4.97 3.55-6.42zm12.39 6.42h2c-.15-3.2-1.73-6.02-4.12-7.85l-1.42 1.43c2.02 1.45 3.39 3.77 3.54 6.42zM18 11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2v-5zm-6 11c.14 0 .27-.01.4-.04.65-.14 1.18-.58 1.44-1.18.1-.24.15-.5.15-.78h-4c.01 1.1.9 2 2.01 2z" />
  </svg>
);

const AmbientIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
  </svg>
);

const UIIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
  </svg>
);

const MuteIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);

const UnmuteIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

/**
 * 音效设置面板组件
 */
export const AudioSettingsPanel: React.FC = () => {
  const {
    settings,
    setMaster,
    setBGM,
    setSFX,
    setAmbient,
    setUI,
    toggleMute,
  } = useVolumeSettings();

  const { playToggle } = useUISound();

  const handleMuteToggle = useCallback(() => {
    playToggle();
    toggleMute();
  }, [playToggle, toggleMute]);

  const handleSliderChange = useCallback(
    (setter: (v: number) => void) => (value: number) => {
      setter(value);
      // 可以在这里添加滑块调整音效
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* 标题和静音按钮 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
          <SpeakerIcon />
          音效设置
        </h3>
        <button
          onClick={handleMuteToggle}
          className={`p-2 rounded-lg transition-all duration-200 ${
            settings.muted
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
          }`}
          title={settings.muted ? '取消静音' : '静音'}
        >
          {settings.muted ? <MuteIcon /> : <UnmuteIcon />}
        </button>
      </div>

      {/* 提示文字 */}
      {settings.muted && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          🔇 音效已静音，点击右上角按钮取消静音
        </div>
      )}

      {/* 音量控制 */}
      <div className="space-y-4 bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        {/* 主音量 */}
        <VolumeSlider
          label="主音量"
          value={settings.master}
          onChange={handleSliderChange(setMaster)}
          icon={<SpeakerIcon />}
          disabled={settings.muted}
        />

        <div className="border-t border-gray-700/50 my-3" />

        {/* 背景音乐 */}
        <VolumeSlider
          label="背景音乐"
          value={settings.bgm}
          onChange={handleSliderChange(setBGM)}
          icon={<MusicIcon />}
          disabled={settings.muted}
        />

        {/* 音效 */}
        <VolumeSlider
          label="游戏音效"
          value={settings.sfx}
          onChange={handleSliderChange(setSFX)}
          icon={<SoundEffectIcon />}
          disabled={settings.muted}
        />

        {/* 环境音 */}
        <VolumeSlider
          label="环境音效"
          value={settings.ambient}
          onChange={handleSliderChange(setAmbient)}
          icon={<AmbientIcon />}
          disabled={settings.muted}
        />

        {/* UI音效 */}
        <VolumeSlider
          label="界面音效"
          value={settings.ui}
          onChange={handleSliderChange(setUI)}
          icon={<UIIcon />}
          disabled={settings.muted}
        />
      </div>

      {/* 音效测试按钮 */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <p className="text-sm text-gray-400 mb-3">测试音效</p>
        <div className="flex flex-wrap gap-2">
          <TestSoundButton label="点击" soundKey="ui-click" />
          <TestSoundButton label="成功" soundKey="ui-success" />
          <TestSoundButton label="警告" soundKey="ui-warning" />
          <TestSoundButton label="交易" soundKey="trade-buy" />
          <TestSoundButton label="通知" soundKey="notification-new" />
        </div>
      </div>

      {/* 说明文字 */}
      <p className="text-xs text-gray-500 text-center">
        音量设置会自动保存到本地
      </p>
    </div>
  );
};

/**
 * 测试音效按钮
 */
const TestSoundButton: React.FC<{ label: string; soundKey: string }> = ({
  label,
  soundKey,
}) => {
  const handleClick = useCallback(() => {
    // 使用 AudioManager 直接播放
    import('../../audio').then(({ getAudioManager }) => {
      getAudioManager().playSFX(soundKey);
    });
  }, [soundKey]);

  return (
    <button
      onClick={handleClick}
      className="px-3 py-1.5 text-sm bg-gray-700/50 hover:bg-gray-600/50 
                 text-gray-300 hover:text-white rounded-lg transition-all duration-200
                 border border-gray-600/50 hover:border-cyan-500/50
                 hover:shadow-[0_0_10px_rgba(0,245,255,0.2)]"
    >
      {label}
    </button>
  );
};

export default AudioSettingsPanel;