# 美术与音乐系统大规模优化计划

## 执行摘要

本计划旨在为《供应链指挥官：算法都市》(Supply Chain Commander: Algo-City) 进行全面的美术和音乐效果优化，以提升游戏的视觉吸引力和沉浸感。

---

## 第一部分：美术系统优化

### 1.1 现状分析

当前游戏采用简约的赛博朋克工业风格，主要依赖 Tailwind CSS 和基础 Canvas 渲染。

**现有美术元素：**
- 城市地图 (CityMap.tsx) - 基础 Canvas 渲染
- K线价格图表 (PriceChartCanvas.tsx, CandlestickChart.tsx) - Canvas 绘制
- 建筑商店 (BuildingShop.tsx) - 纯 CSS 样式
- 市场银河可视化 (MarketGalaxy.tsx) - 基础图表
- UI 面板和模态框 - Tailwind 样式

**问题识别：**
1. 缺乏动画效果和视觉反馈
2. 建筑图标使用文字/emoji代替
3. 城市地图过于简单
4. 缺少粒子效果和氛围渲染
5. 配色方案不统一
6. 缺少主题切换能力

### 1.2 美术优化目标

| 优先级 | 目标 | 预期效果 |
|--------|------|----------|
| P0 | 建筑图标系统 | 使用 SVG/WebP 图标替代 emoji |
| P0 | 动画系统 | 添加过渡动画和微交互 |
| P1 | 粒子效果系统 | 生产烟雾、交易光效、资金流动 |
| P1 | 城市地图重构 | 等距视角 (Isometric) 2.5D 渲染 |
| P2 | 主题系统 | 深色/浅色/霓虹三套主题 |
| P2 | 天气与时间系统 | 昼夜循环、雨雪效果 |
| P3 | 3D 可视化 | Three.js 城市俯瞰视图（可选） |

### 1.3 建筑图标系统设计

#### 1.3.1 图标规格

```typescript
interface BuildingIcon {
  id: string;
  category: 'extraction' | 'processing' | 'manufacturing' | 'tech' | 'consumer' | 'energy';
  // SVG 图标（用于 UI）
  svg: string;
  // 建筑缩略图（48x48 WebP）
  thumbnail: string;
  // 大图预览（256x256 WebP）
  preview: string;
  // 动画帧（可选，用于运行状态）
  animationFrames?: string[];
  // 色调（用于状态指示）
  baseColor: string;
  accentColor: string;
}
```

#### 1.3.2 建筑图标清单

**提取类 (Extraction)**
- `iron-mine` - 铁矿场 🏭
- `coal-mine` - 煤矿 ⛏️
- `oil-rig` - 石油钻井 🛢️
- `copper-mine` - 铜矿
- `gas-well` - 天然气井
- `quarry` - 采石场
- `bauxite-mine` - 铝土矿
- `rare-earth-mine` - 稀土矿
- `lithium-mine` - 锂矿
- `farm` - 农场 🌾
- `ranch` - 牧场 🐄
- `dairy-farm` - 奶牛场

**加工类 (Processing)**
- `steel-mill` - 钢铁厂
- `refinery` - 炼油厂
- `chemical-plant` - 化工厂
- `aluminum-smelter` - 铝冶炼厂
- `glass-factory` - 玻璃厂
- `cement-plant` - 水泥厂
- `silicon-foundry` - 硅晶圆厂

**制造类 (Manufacturing)**
- `auto-factory` - 汽车工厂 🚗
- `ev-factory` - 电动车工厂 ⚡
- `electronics-factory` - 电子厂 📱
- `appliance-factory` - 家电厂
- `food-processing` - 食品加工厂

**科技类 (Tech)**
- `semiconductor-fab` - 半导体工厂
- `research-lab` - 研发中心
- `data-center` - 数据中心

**能源类 (Energy)**
- `power-plant` - 火力发电厂
- `solar-farm` - 太阳能电站
- `nuclear-plant` - 核电站
- `wind-farm` - 风力发电场

#### 1.3.3 图标生成方案

**方案 A：AI 生成 + 人工调整**
- 使用 Midjourney/DALL-E 生成基础图标
- 人工后处理确保风格统一
- 导出为 SVG + WebP

**方案 B：开源图标库 + 定制**
- 基于 Lucide/Heroicons 的工业图标
- 添加赛博朋克风格滤镜
- 自定义颜色方案

**方案 C：像素艺术风格**
- 32x32 像素艺术图标
- 复古工业风格
- 更小的文件体积

**推荐：方案 A（AI 生成 + 人工调整）**

### 1.4 动画系统设计

#### 1.4.1 动画框架

```typescript
// 使用 Framer Motion 作为动画引擎
interface AnimationConfig {
  // 过渡类型
  transition: 'spring' | 'tween' | 'inertia';
  // 持续时间 (ms)
  duration: number;
  // 缓动函数
  easing: 'easeIn' | 'easeOut' | 'easeInOut' | 'anticipate';
  // 延迟 (ms)
  delay?: number;
}

// 动画预设
const ANIMATION_PRESETS = {
  // 面板进入
  panelEnter: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 200, easing: 'easeOut' },
  },
  // 按钮悬停
  buttonHover: {
    scale: 1.05,
    boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
  },
  // 数字变化
  numberChange: {
    keyframes: [1, 1.2, 1],
    transition: { duration: 300 },
  },
  // 建筑放置
  buildingPlace: {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: 1, rotate: 0 },
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
};
```

#### 1.4.2 微交互清单

| 组件 | 交互 | 动画效果 |
|------|------|----------|
| 按钮 | 悬停 | 发光边框 + 微放大 |
| 按钮 | 点击 | 按压效果 + 涟漪 |
| 面板 | 打开 | 从下方滑入 + 淡入 |
| 面板 | 关闭 | 向上滑出 + 淡出 |
| 数字 | 增加 | 绿色闪烁 + 弹跳 |
| 数字 | 减少 | 红色闪烁 + 抖动 |
| 建筑 | 建造中 | 脉冲光效 + 进度环 |
| 建筑 | 生产中 | 烟雾粒子 + 闪烁灯 |
| 建筑 | 缺料 | 红色警告闪烁 |
| 订单 | 成交 | 绿色光线 + 音效 |
| 通知 | 出现 | 从右侧滑入 |
| 图表 | 数据更新 | 平滑过渡 |

### 1.5 粒子效果系统

#### 1.5.1 粒子引擎选择

**推荐：自定义 Canvas 粒子系统**
- 轻量级
- 完全可控
- 与现有 Canvas 渲染兼容

```typescript
interface ParticleConfig {
  type: 'smoke' | 'spark' | 'money' | 'data' | 'glow';
  // 发射器位置
  emitterPosition: { x: number; y: number };
  // 发射速率 (粒子/秒)
  emissionRate: number;
  // 粒子生命周期 (ms)
  lifetime: { min: number; max: number };
  // 初始速度
  velocity: { x: { min: number; max: number }; y: { min: number; max: number } };
  // 重力影响
  gravity: number;
  // 颜色
  color: string | string[];
  // 大小
  size: { min: number; max: number };
  // 透明度衰减
  fadeOut: boolean;
  // 混合模式
  blendMode: 'normal' | 'additive' | 'multiply';
}
```

#### 1.5.2 粒子效果清单

1. **工厂烟雾**
   - 灰色/白色烟雾上升
   - 受风力影响漂移
   - 污染严重时烟雾变黑

2. **电力火花**
   - 电厂周围的电弧效果
   - 蓝白色闪烁
   - 随机方向

3. **交易光束**
   - 买卖成交时的光线
   - 绿色（买入）/ 红色（卖出）
   - 从交易所向建筑发射

4. **资金流动**
   - 金币/数字粒子
   - 从收入源流向玩家账户
   - 正数为金色，负数为红色

5. **数据流**
   - 研发中心的数据粒子
   - 矩阵风格的数字流
   - 科技感十足

6. **建造尘埃**
   - 建筑建造时的灰尘
   - 棕色/灰色
   - 向四周散开

### 1.6 城市地图重构

#### 1.6.1 等距 (Isometric) 2.5D 渲染

```typescript
interface IsometricConfig {
  // 格子大小
  tileWidth: number;  // 64
  tileHeight: number; // 32
  // 视角角度
  angle: number; // 30度
  // 缩放范围
  zoomRange: { min: number; max: number };
  // 层级
  layers: Array<'terrain' | 'roads' | 'buildings' | 'effects' | 'ui'>;
}

// 坐标转换
function cartesianToIsometric(x: number, y: number): { screenX: number; screenY: number } {
  return {
    screenX: (x - y) * (tileWidth / 2),
    screenY: (x + y) * (tileHeight / 2),
  };
}

function isometricToCartesian(screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: (screenX / (tileWidth / 2) + screenY / (tileHeight / 2)) / 2,
    y: (screenY / (tileHeight / 2) - screenX / (tileWidth / 2)) / 2,
  };
}
```

#### 1.6.2 地图图层

1. **地形层**
   - 基础地面纹理
   - 水域、山地、平原
   - 区域高亮（工业区、商业区等）

2. **道路层**
   - 道路网络
   - 物流路线动画
   - 交通流量指示

3. **建筑层**
   - 建筑模型
   - 状态指示器
   - 选中高亮

4. **效果层**
   - 粒子效果
   - 天气效果
   - 光照效果

5. **UI层**
   - 悬浮信息
   - 快捷操作按钮
   - 选区框

### 1.7 主题系统设计

#### 1.7.1 主题定义

```typescript
interface GameTheme {
  id: 'dark' | 'light' | 'neon';
  name: string;
  colors: {
    // 主色调
    primary: string;
    secondary: string;
    accent: string;
    // 背景
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    // 文字
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    // 状态色
    success: string;
    warning: string;
    error: string;
    info: string;
    // 图表色
    chartUp: string;
    chartDown: string;
    chartVolume: string;
    // 边框
    border: string;
    borderHover: string;
    // 阴影
    shadow: string;
    glow: string;
  };
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
}
```

#### 1.7.2 预设主题

**深色模式 (Dark)**
```css
:root[data-theme="dark"] {
  --color-primary: #00d4ff;
  --color-secondary: #7c3aed;
  --color-accent: #ff6b6b;
  --color-bg-primary: #0a0a0f;
  --color-bg-secondary: #12121a;
  --color-bg-tertiary: #1a1a25;
  --color-text-primary: #ffffff;
  --color-text-secondary: #a0aec0;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
}
```

**霓虹模式 (Neon)**
```css
:root[data-theme="neon"] {
  --color-primary: #ff00ff;
  --color-secondary: #00ffff;
  --color-accent: #ffff00;
  --color-bg-primary: #0d0221;
  --color-bg-secondary: #1a0533;
  --color-bg-tertiary: #2a0845;
  --color-text-primary: #ffffff;
  --color-glow: 0 0 20px currentColor;
}
```

**浅色模式 (Light)**
```css
:root[data-theme="light"] {
  --color-primary: #2563eb;
  --color-secondary: #7c3aed;
  --color-accent: #dc2626;
  --color-bg-primary: #f8fafc;
  --color-bg-secondary: #ffffff;
  --color-bg-tertiary: #f1f5f9;
  --color-text-primary: #1e293b;
  --color-text-secondary: #64748b;
}
```

### 1.8 天气与时间系统

#### 1.8.1 昼夜循环

```typescript
interface DayNightCycle {
  // 游戏内时间（0-24）
  gameHour: number;
  // 时间段
  period: 'dawn' | 'day' | 'dusk' | 'night';
  // 环境光颜色
  ambientColor: string;
  // 环境光强度 (0-1)
  ambientIntensity: number;
  // 天空颜色
  skyGradient: string[];
  // 阴影长度 (0-2)
  shadowLength: number;
  // 灯光开启
  lightsOn: boolean;
}

const TIME_PERIODS = {
  dawn: { start: 5, end: 7 },   // 黎明
  day: { start: 7, end: 17 },   // 白天
  dusk: { start: 17, end: 19 }, // 黄昏
  night: { start: 19, end: 5 }, // 夜晚
};
```

#### 1.8.2 天气效果

```typescript
interface WeatherEffect {
  type: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';
  intensity: number; // 0-1
  // 粒子配置
  particles?: ParticleConfig;
  // 滤镜效果
  filter?: {
    brightness: number;
    contrast: number;
    saturation: number;
    blur: number;
  };
  // 音效
  ambientSound?: string;
}
```

---

## 第二部分：音乐系统优化

### 2.1 现状分析

当前游戏没有音乐和音效系统。

### 2.2 音频系统架构

#### 2.2.1 音频管理器

```typescript
interface AudioManager {
  // 背景音乐
  bgm: {
    current: string | null;
    volume: number;
    fadeTime: number;
  };
  // 环境音
  ambient: {
    tracks: Map<string, HTMLAudioElement>;
    masterVolume: number;
  };
  // 音效
  sfx: {
    pool: Map<string, AudioBuffer[]>;
    masterVolume: number;
  };
  // 全局静音
  muted: boolean;
}
```

#### 2.2.2 Web Audio API 集成

```typescript
class GameAudioEngine {
  private context: AudioContext;
  private masterGain: GainNode;
  private bgmGain: GainNode;
  private sfxGain: GainNode;
  private ambientGain: GainNode;
  
  constructor() {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    
    this.bgmGain = this.context.createGain();
    this.bgmGain.connect(this.masterGain);
    
    this.sfxGain = this.context.createGain();
    this.sfxGain.connect(this.masterGain);
    
    this.ambientGain = this.context.createGain();
    this.ambientGain.connect(this.masterGain);
  }
  
  // 播放背景音乐（带淡入淡出）
  async playBGM(trackId: string, fadeTime: number = 1000): Promise<void>;
  
  // 播放音效
  playSFX(sfxId: string, volume?: number, pan?: number): void;
  
  // 设置环境音
  setAmbient(ambientId: string, volume: number): void;
  
  // 淡出所有音频
  fadeOutAll(duration: number): void;
}
```

### 2.3 背景音乐设计

#### 2.3.1 音乐风格

**主基调：** 赛博朋克工业电子 (Cyberpunk Industrial Electronic)

**参考艺术家：**
- Vangelis (Blade Runner OST)
- Daft Punk (Tron Legacy OST)
- M83
- Perturbator
- Carpenter Brut

**音乐特征：**
- 合成器主导
- 强劲的低频节拍
- 电子脉冲和扫频
- 间歇性的人声采样
- 工业机械音效融入

#### 2.3.2 音乐曲目清单

| 曲目ID | 名称 | 场景 | 时长 | BPM | 情绪 |
|--------|------|------|------|-----|------|
| bgm_main_menu | "Neon Sunrise" | 主菜单 | 2:30 | 100 | 史诗/期待 |
| bgm_gameplay_calm | "Supply Lines" | 正常游戏 | 4:00 | 110 | 轻松/专注 |
| bgm_gameplay_busy | "Production Peak" | 繁忙时期 | 3:30 | 125 | 紧张/活力 |
| bgm_gameplay_crisis | "Market Crash" | 危机事件 | 3:00 | 140 | 紧迫/压力 |
| bgm_research | "Digital Frontier" | 研发界面 | 3:30 | 90 | 科技/神秘 |
| bgm_stock | "Trading Floor" | 股票市场 | 3:00 | 120 | 快节奏/刺激 |
| bgm_night | "Midnight Factory" | 夜间 | 4:00 | 85 | 安静/氛围 |
| bgm_victory | "Empire Rising" | 胜利/成就 | 1:30 | 130 | 胜利/庆祝 |

#### 2.3.3 动态音乐系统

```typescript
interface DynamicMusicSystem {
  // 音乐层
  layers: {
    base: AudioBufferSourceNode;      // 基础节拍
    melody: AudioBufferSourceNode;    // 主旋律
    atmosphere: AudioBufferSourceNode; // 氛围层
    accent: AudioBufferSourceNode;    // 强调层
  };
  // 当前强度 (0-1)
  intensity: number;
  // 触发条件
  triggers: {
    buildingCount: number;
    cashFlow: number;
    marketVolatility: number;
    activeEvents: number;
  };
}

// 根据游戏状态动态调整音乐层
function updateMusicIntensity(gameState: GameState): number {
  let intensity = 0;
  
  // 建筑数量影响
  intensity += Math.min(gameState.buildings.length / 20, 0.3);
  
  // 资金流动影响
  const cashFlow = calculateCashFlow(gameState);
  if (Math.abs(cashFlow) > 1000000) {
    intensity += 0.2;
  }
  
  // 市场波动影响
  if (gameState.marketVolatility > 0.5) {
    intensity += 0.3;
  }
  
  // 活跃事件影响
  intensity += gameState.activeEvents.length * 0.1;
  
  return Math.min(intensity, 1);
}
```

### 2.4 音效设计

#### 2.4.1 UI 音效

| 音效ID | 描述 | 触发时机 |
|--------|------|----------|
| sfx_click | 按钮点击 | 任何按钮点击 |
| sfx_hover | 悬停音 | 可交互元素悬停 |
| sfx_open_panel | 面板打开 | 打开任何面板 |
| sfx_close_panel | 面板关闭 | 关闭任何面板 |
| sfx_tab_switch | 标签切换 | 切换标签页 |
| sfx_toggle_on | 开关打开 | 切换开关为开 |
| sfx_toggle_off | 开关关闭 | 切换开关为关 |
| sfx_slider | 滑块滑动 | 调整滑块 |
| sfx_notification | 通知弹出 | 新通知出现 |
| sfx_error | 错误提示 | 操作失败 |
| sfx_success | 成功提示 | 操作成功 |

#### 2.4.2 游戏音效

| 音效ID | 描述 | 触发时机 |
|--------|------|----------|
| sfx_build_start | 开始建造 | 购买建筑 |
| sfx_build_complete | 建造完成 | 建筑落成 |
| sfx_production | 生产周期完成 | 生产完成 |
| sfx_trade_buy | 买入成交 | 买单成交 |
| sfx_trade_sell | 卖出成交 | 卖单成交 |
| sfx_cash_in | 资金增加 | 收入到账 |
| sfx_cash_out | 资金减少 | 支出发生 |
| sfx_research_start | 开始研发 | 启动研发项目 |
| sfx_research_complete | 研发完成 | 科技突破 |
| sfx_event_positive | 正面事件 | 好消息 |
| sfx_event_negative | 负面事件 | 坏消息 |
| sfx_event_critical | 紧急事件 | 危机警报 |
| sfx_level_up | 升级 | 公司等级提升 |
| sfx_achievement | 成就解锁 | 获得成就 |

#### 2.4.3 环境音效

| 音效ID | 描述 | 场景 |
|--------|------|------|
| amb_city | 城市嗡嗡声 | 城市地图背景 |
| amb_factory | 工厂运转 | 有建筑运行时 |
| amb_market | 交易所喧嚣 | 股票/交易界面 |
| amb_rain | 雨声 | 下雨天气 |
| amb_thunder | 雷声 | 雷暴天气 |
| amb_night | 夜间蟋蟀 | 夜间时段 |
| amb_keyboard | 键盘敲击 | 研发界面 |

### 2.5 音频资源管理

#### 2.5.1 音频格式

- **背景音乐：** OGG Vorbis (高质量压缩)
- **音效：** WebM Opus / OGG (低延迟)
- **环境音：** MP3 (兼容性)

#### 2.5.2 音频精灵图 (Audio Sprites)

将小型音效合并为单个文件，减少 HTTP 请求：

```typescript
interface AudioSprite {
  src: string;
  sprites: {
    [key: string]: {
      start: number; // 秒
      end: number;   // 秒
      loop?: boolean;
    };
  };
}

const uiSfxSprite: AudioSprite = {
  src: '/audio/ui-sfx-sprite.webm',
  sprites: {
    click: { start: 0, end: 0.2 },
    hover: { start: 0.2, end: 0.4 },
    open: { start: 0.4, end: 0.8 },
    close: { start: 0.8, end: 1.2 },
    // ...
  },
};
```

#### 2.5.3 音频懒加载

```typescript
// 按需加载音频资源
const audioLoadPriority = {
  immediate: ['bgm_main_menu', 'sfx_click', 'sfx_hover'],
  onGameStart: ['bgm_gameplay_calm', 'amb_city', 'sfx_build_complete'],
  onDemand: ['bgm_crisis', 'bgm_night', 'sfx_achievement'],
};

async function preloadAudio(priority: 'immediate' | 'onGameStart' | 'onDemand'): Promise<void> {
  const audioIds = audioLoadPriority[priority];
  await Promise.all(audioIds.map(loadAudioBuffer));
}
```

### 2.6 音频设置界面

```typescript
interface AudioSettings {
  // 主音量 (0-100)
  masterVolume: number;
  // 音乐音量 (0-100)
  musicVolume: number;
  // 音效音量 (0-100)
  sfxVolume: number;
  // 环境音量 (0-100)
  ambientVolume: number;
  // 静音
  muted: boolean;
  // 动态音乐
  dynamicMusic: boolean;
  // 交易音效
  tradeSounds: boolean;
  // 通知音效
  notificationSounds: boolean;
}
```

---

## 第三部分：实施计划

### 3.1 阶段划分

#### 第一阶段：基础设施 (2周)

- [ ] 建立图标资源管道
- [ ] 实现主题系统框架
- [ ] 集成 Framer Motion 动画库
- [ ] 实现 Web Audio API 音频引擎
- [ ] 创建音频设置界面

#### 第二阶段：核心美术 (3周)

- [ ] 生成/获取建筑图标 (40+)
- [ ] 实现建筑图标组件
- [ ] 添加 UI 微交互动画
- [ ] 实现面板过渡动画
- [ ] 深色/浅色主题切换

#### 第三阶段：核心音频 (2周)

- [ ] 采购/制作背景音乐 (8首)
- [ ] 采购/制作 UI 音效 (15个)
- [ ] 采购/制作游戏音效 (20个)
- [ ] 实现音效触发系统
- [ ] 音乐淡入淡出

#### 第四阶段：高级美术 (3周)

- [ ] 实现粒子效果系统
- [ ] 工厂烟雾效果
- [ ] 交易光效
- [ ] 城市地图等距渲染
- [ ] 霓虹主题

#### 第五阶段：高级音频 (2周)

- [ ] 环境音系统
- [ ] 动态音乐系统
- [ ] 音频精灵图优化
- [ ] 音频懒加载

#### 第六阶段：优化与测试 (2周)

- [ ] 性能优化
- [ ] 内存优化
- [ ] 兼容性测试
- [ ] 用户测试与反馈

### 3.2 资源预算

#### 美术资源

| 资源类型 | 数量 | 预算 (USD) |
|----------|------|------------|
| 建筑图标 (AI生成+调整) | 50 | $200 |
| UI 图标套件 | 1套 | $50 |
| 粒子纹理 | 10 | $50 |
| 地图瓦片 | 20 | $100 |
| **小计** | - | **$400** |

#### 音频资源

| 资源类型 | 数量 | 预算 (USD) |
|----------|------|------------|
| 背景音乐 (版权购买) | 8首 | $300 |
| UI 音效包 | 1套 | $50 |
| 游戏音效包 | 1套 | $100 |
| 环境音效 | 10 | $50 |
| **小计** | - | **$500** |

#### 总预算：$900

### 3.3 技术依赖

#### 新增依赖

```json
{
  "dependencies": {
    "framer-motion": "^10.0.0",     // 动画库
    "howler": "^2.2.3",              // 音频库 (可选，替代 Web Audio API)
  },
  "devDependencies": {
    "@types/howler": "^2.2.8"
  }
}
```

### 3.4 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 图标风格不统一 | 中 | 中 | 制定严格的风格指南，多次迭代 |
| 音频加载过慢 | 中 | 高 | 音频精灵图 + 懒加载 |
| 粒子效果影响性能 | 高 | 中 | 粒子数量限制 + LOD |
| 主题切换闪烁 | 低 | 低 | CSS 变量 + 预加载 |
| 浏览器兼容性问题 | 中 | 中 | 功能检测 + 优雅降级 |

---

## 第四部分：验收标准

### 4.1 美术验收

- [ ] 所有建筑有对应图标
- [ ] 深色/浅色主题可切换
- [ ] UI 过渡动画流畅 (60fps)
- [ ] 粒子效果不影响帧率
- [ ] 城市地图可缩放和平移

### 4.2 音频验收

- [ ] 背景音乐循环无缝
- [ ] 音效触发无延迟 (<100ms)
- [ ] 音量可独立调节
- [ ] 静音功能正常
- [ ] 无音频爆音或失真

### 4.3 性能验收

- [ ] 首次加载 < 5秒
- [ ] 帧率 > 55fps (开启所有效果)
- [ ] 内存占用 < 500MB
- [ ] 音频文件总大小 < 20MB

---

## 附录

### A. 色彩参考

**霓虹色板**
- 霓虹青: #00FFFF
- 霓虹粉: #FF00FF
- 霓虹绿: #00FF00
- 霓虹橙: #FF6600
- 霓虹紫: #9900FF

**工业色板**
- 金属灰: #4A5568
- 钢铁蓝: #2C5282
- 铜锈绿: #2F855A
- 警告红: #C53030
- 工业黄: #D69E2E

### B. 音效资源网站

- [Epidemic Sound](https://www.epidemicsound.com/) - 高质量音乐
- [Artlist](https://artlist.io/) - 音乐和音效
- [Freesound](https://freesound.org/) - 免费音效
- [Sonniss GDC Bundle](https://sonniss.com/gameaudiogdc) - 游戏音效包
- [Zapsplat](https://www.zapsplat.com/) - 免费音效

### C. 图标资源

- [Lucide](https://lucide.dev/) - 开源图标
- [Heroicons](https://heroicons.com/) - Tailwind 图标
- [Flaticon](https://www.flaticon.com/) - 矢量图标
- [Game-icons.net](https://game-icons.net/) - 游戏图标