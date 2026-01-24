# 音频资源目录

此目录用于存放游戏的所有音频资源文件。

## 目录结构

```
audio/
├── bgm/                    # 背景音乐
│   ├── menu-theme.mp3     # 主菜单音乐
│   ├── gameplay-calm.mp3  # 平静游戏状态
│   ├── gameplay-intense.mp3 # 紧张游戏状态
│   ├── research-lab.mp3   # 研发界面
│   ├── trading-floor.mp3  # 交易界面
│   └── victory.mp3        # 胜利音乐
│
├── sfx/                    # 音效
│   ├── ui/                 # UI音效
│   │   ├── click.mp3      # 点击音效
│   │   ├── hover.mp3      # 悬停音效
│   │   ├── panel-open.mp3 # 面板打开
│   │   ├── panel-close.mp3 # 面板关闭
│   │   ├── tab-switch.mp3 # 标签切换
│   │   ├── toggle.mp3     # 开关切换
│   │   ├── confirm.mp3    # 确认
│   │   ├── cancel.mp3     # 取消
│   │   ├── success.mp3    # 成功
│   │   ├── error.mp3      # 错误
│   │   └── warning.mp3    # 警告
│   │
│   └── game/               # 游戏事件音效
│       ├── trade-buy.mp3  # 买入
│       ├── trade-sell.mp3 # 卖出
│       ├── trade-big.mp3  # 大额交易
│       ├── trade-fail.mp3 # 交易失败
│       ├── production-complete.mp3 # 生产完成
│       ├── building-construct.mp3  # 建筑建造
│       ├── building-upgrade.mp3    # 建筑升级
│       ├── research-start.mp3      # 研究开始
│       ├── research-complete.mp3   # 研究完成
│       ├── tech-unlock.mp3         # 科技解锁
│       ├── money-gain.mp3          # 收入
│       ├── money-jackpot.mp3       # 大额收入
│       ├── market-alert.mp3        # 市场警报
│       ├── notification.mp3        # 通知
│       └── achievement.mp3         # 成就解锁
│
└── ambient/                # 环境音效
    ├── city-traffic.mp3   # 城市交通
    ├── datacenter-hum.mp3 # 数据中心
    ├── factory-machinery.mp3 # 工厂机械
    ├── stock-exchange.mp3 # 证券交易所
    ├── rain.mp3           # 雨声
    └── electronic-atmosphere.mp3 # 电子氛围
```

## 音频规格要求

### BGM (背景音乐)
- **格式**: MP3 (主要) + OGG (备用)
- **采样率**: 44.1kHz
- **比特率**: 128-192 kbps
- **时长**: 2-5分钟 (循环播放)
- **风格**: 赛博朋克/电子/合成器音乐

### SFX (音效)
- **格式**: MP3 (主要) + OGG (备用)
- **采样率**: 44.1kHz
- **比特率**: 128 kbps
- **时长**: 0.1-2秒
- **响度**: 归一化处理

### Ambient (环境音)
- **格式**: MP3 (主要) + OGG (备用)
- **采样率**: 44.1kHz
- **比特率**: 128 kbps
- **时长**: 30秒-2分钟 (无缝循环)

## 音效获取建议

### 免费资源
1. **Freesound.org** - 大量CC协议音效
2. **OpenGameArt.org** - 游戏专用资源
3. **Mixkit.co** - 免费音效库
4. **Pixabay.com** - 免版税音频

### 付费资源
1. **Envato Elements** - 订阅制音效库
2. **AudioJungle** - 单曲购买
3. **Epidemic Sound** - 高质量音乐

### AI生成
1. **Suno AI** - AI音乐生成
2. **AIVA** - AI作曲
3. **Soundraw** - AI音乐创作

## 版权声明

请确保所有使用的音频资源都具有适当的许可证：
- **CC0** - 公共领域，无限制使用
- **CC BY** - 需要署名
- **CC BY-NC** - 需要署名，禁止商用
- **商业许可** - 已购买商业使用权

在 `LICENSES.md` 文件中记录所有音频的来源和许可信息。