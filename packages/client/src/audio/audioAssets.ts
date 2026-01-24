/**
 * 音效资源配置
 * 定义游戏中所有音效的配置信息
 */

import { SoundConfig } from './AudioManager';

// 音效资源基础路径
const AUDIO_BASE_PATH = '/audio';

/**
 * 背景音乐配置
 * 适合不同游戏场景的赛博朋克风格音乐
 */
export const BGM_CONFIGS: Record<string, SoundConfig> = {
  // 主菜单/标题画面
  'bgm-menu': {
    src: [`${AUDIO_BASE_PATH}/bgm/menu-theme.mp3`, `${AUDIO_BASE_PATH}/bgm/menu-theme.ogg`],
    volume: 0.5,
    loop: true,
    category: 'bgm',
    preload: true,
  },
  
  // 主游戏循环 - 平静状态
  'bgm-gameplay-calm': {
    src: [`${AUDIO_BASE_PATH}/bgm/gameplay-calm.mp3`, `${AUDIO_BASE_PATH}/bgm/gameplay-calm.ogg`],
    volume: 0.4,
    loop: true,
    category: 'bgm',
    preload: true,
  },
  
  // 主游戏循环 - 紧张状态 (市场波动大)
  'bgm-gameplay-intense': {
    src: [`${AUDIO_BASE_PATH}/bgm/gameplay-intense.mp3`, `${AUDIO_BASE_PATH}/bgm/gameplay-intense.ogg`],
    volume: 0.45,
    loop: true,
    category: 'bgm',
  },
  
  // 研究/科技树界面
  'bgm-research': {
    src: [`${AUDIO_BASE_PATH}/bgm/research-lab.mp3`, `${AUDIO_BASE_PATH}/bgm/research-lab.ogg`],
    volume: 0.35,
    loop: true,
    category: 'bgm',
  },
  
  // 市场交易界面
  'bgm-trading': {
    src: [`${AUDIO_BASE_PATH}/bgm/trading-floor.mp3`, `${AUDIO_BASE_PATH}/bgm/trading-floor.ogg`],
    volume: 0.4,
    loop: true,
    category: 'bgm',
  },
  
  // 胜利/成就达成
  'bgm-victory': {
    src: [`${AUDIO_BASE_PATH}/bgm/victory.mp3`, `${AUDIO_BASE_PATH}/bgm/victory.ogg`],
    volume: 0.6,
    loop: false,
    category: 'bgm',
  },
};

/**
 * UI 音效配置
 * 界面交互反馈音效
 */
export const UI_SFX_CONFIGS: Record<string, SoundConfig> = {
  // 按钮点击
  'ui-click': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/click.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/click.ogg`],
    volume: 0.6,
    category: 'ui',
    preload: true,
  },
  
  // 按钮悬停
  'ui-hover': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/hover.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/hover.ogg`],
    volume: 0.3,
    category: 'ui',
    preload: true,
  },
  
  // 面板打开
  'ui-panel-open': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/panel-open.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/panel-open.ogg`],
    volume: 0.5,
    category: 'ui',
    preload: true,
  },
  
  // 面板关闭
  'ui-panel-close': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/panel-close.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/panel-close.ogg`],
    volume: 0.4,
    category: 'ui',
    preload: true,
  },
  
  // 标签切换
  'ui-tab-switch': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/tab-switch.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/tab-switch.ogg`],
    volume: 0.4,
    category: 'ui',
  },
  
  // 开关切换
  'ui-toggle': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/toggle.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/toggle.ogg`],
    volume: 0.5,
    category: 'ui',
  },
  
  // 滑块调整
  'ui-slider': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/slider.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/slider.ogg`],
    volume: 0.3,
    category: 'ui',
  },
  
  // 输入确认
  'ui-confirm': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/confirm.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/confirm.ogg`],
    volume: 0.6,
    category: 'ui',
  },
  
  // 输入取消
  'ui-cancel': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/cancel.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/cancel.ogg`],
    volume: 0.5,
    category: 'ui',
  },
  
  // 错误提示
  'ui-error': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/error.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/error.ogg`],
    volume: 0.6,
    category: 'ui',
  },
  
  // 成功提示
  'ui-success': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/success.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/success.ogg`],
    volume: 0.6,
    category: 'ui',
  },
  
  // 警告提示
  'ui-warning': {
    src: [`${AUDIO_BASE_PATH}/sfx/ui/warning.mp3`, `${AUDIO_BASE_PATH}/sfx/ui/warning.ogg`],
    volume: 0.6,
    category: 'ui',
  },
};

/**
 * 游戏事件音效配置
 */
export const GAME_SFX_CONFIGS: Record<string, SoundConfig> = {
  // ===== 交易相关 =====
  // 买入成功
  'trade-buy': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/trade-buy.mp3`, `${AUDIO_BASE_PATH}/sfx/game/trade-buy.ogg`],
    volume: 0.6,
    category: 'sfx',
    preload: true,
  },
  
  // 卖出成功
  'trade-sell': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/trade-sell.mp3`, `${AUDIO_BASE_PATH}/sfx/game/trade-sell.ogg`],
    volume: 0.6,
    category: 'sfx',
    preload: true,
  },
  
  // 大额交易
  'trade-big': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/trade-big.mp3`, `${AUDIO_BASE_PATH}/sfx/game/trade-big.ogg`],
    volume: 0.7,
    category: 'sfx',
  },
  
  // 交易失败
  'trade-fail': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/trade-fail.mp3`, `${AUDIO_BASE_PATH}/sfx/game/trade-fail.ogg`],
    volume: 0.5,
    category: 'sfx',
  },
  
  // ===== 生产相关 =====
  // 生产完成
  'production-complete': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/production-complete.mp3`, `${AUDIO_BASE_PATH}/sfx/game/production-complete.ogg`],
    volume: 0.5,
    category: 'sfx',
  },
  
  // 建筑建造
  'building-construct': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/building-construct.mp3`, `${AUDIO_BASE_PATH}/sfx/game/building-construct.ogg`],
    volume: 0.6,
    category: 'sfx',
  },
  
  // 建筑升级
  'building-upgrade': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/building-upgrade.mp3`, `${AUDIO_BASE_PATH}/sfx/game/building-upgrade.ogg`],
    volume: 0.6,
    category: 'sfx',
  },
  
  // 建筑拆除
  'building-demolish': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/building-demolish.mp3`, `${AUDIO_BASE_PATH}/sfx/game/building-demolish.ogg`],
    volume: 0.5,
    category: 'sfx',
  },
  
  // ===== 研究相关 =====
  // 研究开始
  'research-start': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/research-start.mp3`, `${AUDIO_BASE_PATH}/sfx/game/research-start.ogg`],
    volume: 0.5,
    category: 'sfx',
  },
  
  // 研究完成
  'research-complete': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/research-complete.mp3`, `${AUDIO_BASE_PATH}/sfx/game/research-complete.ogg`],
    volume: 0.7,
    category: 'sfx',
  },
  
  // 科技解锁
  'tech-unlock': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/tech-unlock.mp3`, `${AUDIO_BASE_PATH}/sfx/game/tech-unlock.ogg`],
    volume: 0.7,
    category: 'sfx',
  },
  
  // ===== 经济相关 =====
  // 获得金币
  'money-gain': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/money-gain.mp3`, `${AUDIO_BASE_PATH}/sfx/game/money-gain.ogg`],
    volume: 0.4,
    category: 'sfx',
    preload: true,
  },
  
  // 大额收入
  'money-jackpot': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/money-jackpot.mp3`, `${AUDIO_BASE_PATH}/sfx/game/money-jackpot.ogg`],
    volume: 0.6,
    category: 'sfx',
  },
  
  // 破产警告
  'bankruptcy-warning': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/bankruptcy-warning.mp3`, `${AUDIO_BASE_PATH}/sfx/game/bankruptcy-warning.ogg`],
    volume: 0.7,
    category: 'sfx',
  },
  
  // ===== 市场事件 =====
  // 价格上涨
  'market-price-up': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/price-up.mp3`, `${AUDIO_BASE_PATH}/sfx/game/price-up.ogg`],
    volume: 0.4,
    category: 'sfx',
  },
  
  // 价格下跌
  'market-price-down': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/price-down.mp3`, `${AUDIO_BASE_PATH}/sfx/game/price-down.ogg`],
    volume: 0.4,
    category: 'sfx',
  },
  
  // 市场波动警报
  'market-alert': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/market-alert.mp3`, `${AUDIO_BASE_PATH}/sfx/game/market-alert.ogg`],
    volume: 0.6,
    category: 'sfx',
  },
  
  // ===== 通知相关 =====
  // 新消息
  'notification-new': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/notification.mp3`, `${AUDIO_BASE_PATH}/sfx/game/notification.ogg`],
    volume: 0.5,
    category: 'sfx',
    preload: true,
  },
  
  // 成就解锁
  'achievement-unlock': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/achievement.mp3`, `${AUDIO_BASE_PATH}/sfx/game/achievement.ogg`],
    volume: 0.7,
    category: 'sfx',
  },
  
  // 回合结束
  'turn-end': {
    src: [`${AUDIO_BASE_PATH}/sfx/game/turn-end.mp3`, `${AUDIO_BASE_PATH}/sfx/game/turn-end.ogg`],
    volume: 0.4,
    category: 'sfx',
  },
};

/**
 * 环境音效配置
 * 背景环境音营造氛围
 */
export const AMBIENT_CONFIGS: Record<string, SoundConfig> = {
  // 城市街道环境音
  'ambient-city': {
    src: [`${AUDIO_BASE_PATH}/ambient/city-traffic.mp3`, `${AUDIO_BASE_PATH}/ambient/city-traffic.ogg`],
    volume: 0.25,
    loop: true,
    category: 'ambient',
    preload: true,
  },
  
  // 数据中心环境音
  'ambient-datacenter': {
    src: [`${AUDIO_BASE_PATH}/ambient/datacenter-hum.mp3`, `${AUDIO_BASE_PATH}/ambient/datacenter-hum.ogg`],
    volume: 0.2,
    loop: true,
    category: 'ambient',
  },
  
  // 工厂环境音
  'ambient-factory': {
    src: [`${AUDIO_BASE_PATH}/ambient/factory-machinery.mp3`, `${AUDIO_BASE_PATH}/ambient/factory-machinery.ogg`],
    volume: 0.2,
    loop: true,
    category: 'ambient',
  },
  
  // 交易所环境音
  'ambient-exchange': {
    src: [`${AUDIO_BASE_PATH}/ambient/stock-exchange.mp3`, `${AUDIO_BASE_PATH}/ambient/stock-exchange.ogg`],
    volume: 0.2,
    loop: true,
    category: 'ambient',
  },
  
  // 雨天环境音
  'ambient-rain': {
    src: [`${AUDIO_BASE_PATH}/ambient/rain.mp3`, `${AUDIO_BASE_PATH}/ambient/rain.ogg`],
    volume: 0.3,
    loop: true,
    category: 'ambient',
  },
  
  // 电子氛围音
  'ambient-electronic': {
    src: [`${AUDIO_BASE_PATH}/ambient/electronic-atmosphere.mp3`, `${AUDIO_BASE_PATH}/ambient/electronic-atmosphere.ogg`],
    volume: 0.15,
    loop: true,
    category: 'ambient',
  },
};

/**
 * 所有音效配置的合并对象
 */
export const ALL_SOUND_CONFIGS: Record<string, SoundConfig> = {
  ...BGM_CONFIGS,
  ...UI_SFX_CONFIGS,
  ...GAME_SFX_CONFIGS,
  ...AMBIENT_CONFIGS,
};

/**
 * 需要预加载的关键音效列表
 */
export const PRELOAD_SOUNDS: string[] = Object.entries(ALL_SOUND_CONFIGS)
  .filter(([_, config]) => config.preload)
  .map(([key]) => key);

/**
 * 获取分类下的所有音效键
 */
export const getSoundKeysByCategory = (category: SoundConfig['category']): string[] => {
  return Object.entries(ALL_SOUND_CONFIGS)
    .filter(([_, config]) => config.category === category)
    .map(([key]) => key);
};

/**
 * BGM 列表（用于随机播放或循环）
 */
export const GAMEPLAY_BGM_LIST = [
  'bgm-gameplay-calm',
  'bgm-gameplay-intense',
];

/**
 * 根据游戏状态获取推荐的 BGM
 */
export const getRecommendedBGM = (context: {
  inMenu?: boolean;
  inResearch?: boolean;
  inTrading?: boolean;
  marketVolatility?: 'low' | 'medium' | 'high';
}): string => {
  if (context.inMenu) return 'bgm-menu';
  if (context.inResearch) return 'bgm-research';
  if (context.inTrading) return 'bgm-trading';
  
  if (context.marketVolatility === 'high') {
    return 'bgm-gameplay-intense';
  }
  
  return 'bgm-gameplay-calm';
};

export default ALL_SOUND_CONFIGS;