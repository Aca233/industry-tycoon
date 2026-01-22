# Industry Tycoon - 工业大亨

一款受《维多利亚3》启发的 LLM 驱动商业模拟游戏。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

## 🎮 游戏概念

你面对的不是厂房内部的平面图，而是城市大地图和复杂的仪表盘。你的操作层级是"建筑/公司"级别，而不是"机器"级别。

### 核心特性

- **生产方式切换**: 类似《维多利亚3》，通过下拉菜单切换工厂的生产方式
- **动态市场替代**: LLM驱动的需求替代机制，商品标签实时变化
- **AI竞争对手**: 具有独特人格的AI对手，在市场中与你竞争
- **实时经济系统**: 供需关系、价格波动、订单簿交易
- **涌现式科技树**: 通过自然语言描述发明新技术

## 📸 游戏截图

（待添加）

## 🚀 快速开始

### 前置要求

- Node.js 20+
- pnpm 9+
- OpenAI API Key 或兼容的第三方 API（可选，用于 AI 功能）

### 一键启动（Windows）

```bash
# 双击运行
start.bat
```

这将自动安装依赖、构建共享包、启动服务器和客户端，并打开浏览器。

### 手动安装

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/industry-tycoon.git
cd industry-tycoon

# 安装依赖（会自动构建 shared 和 game-core 包）
pnpm install

# 启动开发服务器
pnpm dev
```

> **注意**: `pnpm install` 会自动运行 `postinstall` 脚本来构建依赖包。如果遇到问题，可以手动执行：
> ```bash
> pnpm --filter @scc/shared build
> pnpm --filter @scc/game-core build
> ```

访问 http://localhost:5173 开始游戏！

### 配置 LLM API（可选）

编辑 `packages/server/.env` 文件：

```env
# OpenAI 官方 API
OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini

# 或第三方兼容 API
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://your-proxy.com/v1
OPENAI_MODEL=gpt-4o-mini
```

> 注意：如果未配置 API，游戏会使用本地 fallback 响应，确保游戏可以正常运行。

## 🏗️ 技术架构

### Monorepo 结构

```
packages/
├── shared/      # 共享类型和常量
├── game-core/   # 游戏引擎核心逻辑
├── server/      # Fastify 后端服务
└── client/      # React 前端应用
```

### 技术栈

**前端:**
- React 19 + TypeScript
- Vite (构建工具)
- TailwindCSS (样式)
- Zustand + Immer (状态管理)
- D3.js (图表)

**后端:**
- Fastify 5 (Web框架)
- WebSocket (实时通信)
- OpenAI API (LLM集成)

**游戏引擎:**
- 自定义游戏循环 (1 tick = 1 游戏分钟)
- Victoria 3 风格生产系统
- 订单簿交易系统
- POPs 消费系统

## 🎯 游戏系统

### 生产系统

每个建筑有多个槽位，每个槽位可选择不同的生产方式：

```
槽位1: 基础工艺
  - 手工组装 (高劳动力, 低产能, 高质量)
  - 流水线生产 (电力 + 大量零件, 高产能)
  - AI辅助制造 (算力 + 高级合金, 极大产能)

槽位2: 自动化等级
  - 无自动化
  - 传感器监控
  - 全自动黑灯工厂
```

### 市场系统

- **订单簿交易**: 买卖挂单、价格发现
- **供需平衡**: 价格根据供需自动调整
- **市场份额**: 追踪各公司的市场占比
- **价格图表**: K线图、均线、成交量

### AI 竞争对手

多家 AI 公司与你在市场中竞争：

- **蓝海实业** - 综合型企业
- **绿源能源** - 能源巨头
- **华南电机** - 电子制造商
- **更多公司...**

## 📁 项目结构

```
industry-tycoon/
├── packages/
│   ├── shared/          # 共享类型、常量、数据定义
│   ├── game-core/       # 游戏引擎
│   ├── server/          # 后端服务
│   └── client/          # 前端应用
├── plans/               # 设计文档
├── start.bat           # Windows 一键启动
├── package.json
└── README.md
```

## 📝 开发计划

- [x] 基础架构和游戏引擎
- [x] 生产系统
- [x] 市场交易系统
- [x] AI 竞争对手
- [x] POPs 消费系统
- [x] LLM 集成
- [ ] 科技研发系统
- [ ] 商战系统
- [ ] 更多内容...

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发环境

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 类型检查
pnpm typecheck

# 代码格式化
pnpm format
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 游戏设计灵感来自 Paradox 的《维多利亚3》
- 感谢所有贡献者和玩家的支持