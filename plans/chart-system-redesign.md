# 通用图表系统重构方案

> **更新：采用 KLineChart 库**
>
> 基于用户反馈，决定采用专业的金融K线图表库 [KLineChart](https://github.com/klinecharts/KLineChart)
> 作为底层渲染引擎，而非完全自研。这将大幅降低开发成本，同时获得更专业的图表效果。

---

## 1. 现状分析

### 1.1 当前实现

项目中存在**三个**独立的图表实现：

1. **[`InteractiveChart.tsx`](packages/client/src/components/charts/InteractiveChart.tsx)**
   - 功能：折线图/K线图切换、均线、成交量、时间周期
   - 技术：Canvas 自绘
   - 问题：代码冗长（700+行）、耦合度高、维护困难

2. **[`CandlestickChart.tsx`](packages/client/src/components/stock/CandlestickChart.tsx)**
   - 功能：股票K线图（包装 InteractiveChart）
   - 技术：简单包装层
   - 问题：功能重复

3. **[`MarketTradeCenter.tsx`](packages/client/src/components/game/MarketTradeCenter.tsx) 内置 PriceChart**
   - 功能：简单价格走势图
   - 技术：D3.js SVG
   - 问题：与其他图表不统一、性能较差

### 1.2 当前问题

从截图和代码分析，存在以下问题：

| 问题 | 描述 | 影响 |
|------|------|------|
| 视觉扁平 | Y轴范围计算不够智能，价格波动不明显 | 用户体验差 |
| 成交量过小 | 成交量柱状图占比太小，几乎看不清 | 信息展示不清晰 |
| X轴标签稀疏 | 时间标签间隔过大 | 难以定位具体时间点 |
| 代码重复 | 三套独立实现，功能相似但不统一 | 维护成本高 |
| 交互体验 | 缩放拖拽等交互功能不够流畅 | 专业感不足 |

### 1.3 数据结构

```typescript
// 价格历史条目 (来自 gameStore.ts)
interface PriceHistoryEntry {
  tick: number;
  price: number;
  volume?: number;
  buyVolume?: number;
  sellVolume?: number;
}

// 建筑财务历史
interface BuildingFinanceEntry {
  tick: number;
  income: number;
  inputCost: number;
  maintenance: number;
  net: number;
}
```

---

## 2. 新架构设计（基于 KLineChart）

### 2.1 技术选型

经过对比分析，选择 **KLineChart** 作为底层图表库：

| 特性 | KLineChart | Lightweight Charts | 自研 |
|------|------------|-------------------|------|
| 包大小 | ~100KB | ~40KB | 无 |
| K线支持 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 需开发 |
| 技术指标 | 内置 30+ | 需扩展 | 需开发 |
| 主题定制 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 完全控制 |
| 中文支持 | ⭐⭐⭐⭐⭐ | ⭐⭐ | 完全控制 |
| 学习成本 | 低 | 低 | 高 |
| 开发周期 | 1-2天 | 2-3天 | 2-3周 |

### 2.2 设计原则

1. **包装而非重写** - 用 React 组件包装 KLineChart，保留其全部能力
2. **统一数据接口** - 设计适配层，兼容现有 store 数据格式
3. **主题一致性** - 将游戏的赛博朋克风格映射到 KLineChart 主题
4. **渐进式迁移** - 先替换价格走势图，再扩展到其他图表

### 2.3 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Components                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ PriceChart   │ │ StockChart   │ │ FinanceChart             │ │
│  │ 价格走势图    │ │ 股票K线图    │ │ 财务趋势图               │ │
│  └──────┬───────┘ └──────┬───────┘ └────────────┬─────────────┘ │
│         └────────────────┴──────────────────────┘               │
│                           │                                      │
│  ┌────────────────────────┴─────────────────────────────────┐   │
│  │                   KLineChartWrapper                       │   │
│  │  - 统一的 React 组件接口                                   │   │
│  │  - 数据格式转换适配器                                       │   │
│  │  - 主题配置管理                                            │   │
│  │  - 生命周期管理                                            │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────┴─────────────────────────────────┐   │
│  │                   KLineChart 核心                         │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │   │
│  │  │ Chart 实例   │ │ 技术指标    │ │ 交互系统    │         │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 文件结构

```
packages/client/src/components/charts-v2/
├── core/
│   ├── KLineChartWrapper.tsx   # KLineChart React 包装器
│   ├── chartAdapter.ts         # 数据格式适配器
│   ├── types.ts                # 类型定义
│   └── index.ts
│
├── themes/
│   ├── cyberpunk.ts            # 赛博朋克主题（映射到 KLineChart）
│   ├── professional.ts         # 专业金融主题
│   └── index.ts
│
├── indicators/
│   ├── customMA.ts             # 自定义均线指标
│   ├── customVolume.ts         # 自定义成交量指标
│   └── index.ts
│
├── charts/
│   ├── PriceChart.tsx          # 价格走势图（业务组件）
│   ├── StockChart.tsx          # 股票详情图（业务组件）
│   └── index.ts
│
├── hooks/
│   ├── useKLineChart.ts        # KLineChart Hook
│   ├── useChartData.ts         # 数据转换 Hook
│   └── index.ts
│
└── index.ts                    # 统一导出
```

---

## 3. KLineChart 集成方案

### 3.1 安装依赖

```bash
# 在 packages/client 目录下执行
pnpm add klinecharts
```

### 3.2 核心类型定义

```typescript
// core/types.ts

import type { KLineData, IndicatorCreate, Styles } from 'klinecharts';

/** 来自 gameStore 的价格历史条目 */
export interface PriceHistoryEntry {
  tick: number;
  price: number;
  volume?: number;
  buyVolume?: number;
  sellVolume?: number;
}

/** 图表配置选项 */
export interface ChartOptions {
  /** 图表模式 */
  mode: 'line' | 'candle';
  /** 是否显示成交量 */
  showVolume: boolean;
  /** 是否显示均线 */
  showMA: boolean;
  /** 均线周期配置 */
  maPeriods: number[];
  /** 时间周期（聚合） */
  timeframe: number;
  /** 价格格式化函数 */
  formatPrice: (value: number) => string;
  /** 时间格式化函数 */
  formatTime: (tick: number) => string;
}

/** 图表主题类型 */
export type ChartThemeType = 'cyberpunk' | 'professional' | 'dark' | 'light';

/** 图表组件 Props */
export interface KLineChartWrapperProps {
  /** 原始价格数据 */
  data: PriceHistoryEntry[];
  /** 宽度（自动响应容器） */
  width?: number;
  /** 高度 */
  height?: number;
  /** 主题 */
  theme?: ChartThemeType;
  /** 配置选项 */
  options?: Partial<ChartOptions>;
  /** 类名 */
  className?: string;
  /** 图表实例引用回调 */
  onChartReady?: (chart: any) => void;
}

/** 默认配置 */
export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  mode: 'line',
  showVolume: true,
  showMA: true,
  maPeriods: [5, 10, 20],
  timeframe: 1,
  formatPrice: (v) => `¥${(v / 100).toFixed(2)}`,
  formatTime: (tick) => `D${tick + 1}`,
};
```

### 3.3 数据适配器

```typescript
// core/chartAdapter.ts

import type { KLineData } from 'klinecharts';
import type { PriceHistoryEntry } from './types';

/**
 * 将游戏价格历史数据转换为 KLineChart 格式
 */
export function convertToKLineData(
  history: PriceHistoryEntry[],
  mode: 'line' | 'candle',
  timeframe: number = 1
): KLineData[] {
  if (!history || history.length === 0) return [];
  
  // 折线模式：每个点都是一个数据
  if (mode === 'line' || timeframe <= 1) {
    return history.map((h) => ({
      timestamp: h.tick * 86400000, // tick 转换为毫秒时间戳（假设 1 tick = 1 天）
      open: h.price,
      high: h.price,
      low: h.price,
      close: h.price,
      volume: (h.buyVolume || 0) + (h.sellVolume || 0) + (h.volume || 0),
      turnover: 0,
    }));
  }
  
  // K线模式：按周期聚合
  return aggregateToCandles(history, timeframe);
}

/**
 * 按周期聚合K线数据
 */
function aggregateToCandles(
  history: PriceHistoryEntry[],
  period: number
): KLineData[] {
  const candles: KLineData[] = [];
  let currentCandle: KLineData | null = null;
  
  for (const point of history) {
    const periodIndex = Math.floor(point.tick / period);
    const periodStart = periodIndex * period;
    
    if (!currentCandle || currentCandle.timestamp !== periodStart * 86400000) {
      if (currentCandle) {
        candles.push(currentCandle);
      }
      currentCandle = {
        timestamp: periodStart * 86400000,
        open: point.price,
        high: point.price,
        low: point.price,
        close: point.price,
        volume: (point.buyVolume || 0) + (point.sellVolume || 0) + (point.volume || 0),
        turnover: 0,
      };
    } else {
      currentCandle.high = Math.max(currentCandle.high, point.price);
      currentCandle.low = Math.min(currentCandle.low, point.price);
      currentCandle.close = point.price;
      currentCandle.volume! += (point.buyVolume || 0) + (point.sellVolume || 0) + (point.volume || 0);
    }
  }
  
  if (currentCandle) {
    candles.push(currentCandle);
  }
  
  return candles;
}

/**
 * 格式化时间标签
 * 1 tick = 1 天
 */
export function formatTickLabel(timestamp: number): string {
  const tick = Math.floor(timestamp / 86400000);
  const day = tick + 1;
  const week = Math.floor(tick / 7) + 1;
  const month = Math.floor(tick / 30) + 1;
  
  // 根据范围选择格式
  if (tick < 30) {
    return `D${day}`;
  } else if (tick < 90) {
    return tick % 7 === 0 ? `W${week}` : `D${day}`;
  } else {
    return `M${month}`;
  }
}
```

### 3.4 赛博朋克主题（KLineChart 格式）

```typescript
// themes/cyberpunk.ts

import type { Styles } from 'klinecharts';

/**
 * 赛博朋克主题 - 映射到 KLineChart 样式系统
 */
export const cyberpunkStyles: Partial<Styles> = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      size: 1,
      color: 'rgba(30, 41, 59, 0.6)',
      style: 'dashed',
      dashedValue: [2, 2],
    },
    vertical: {
      show: false,
      size: 1,
      color: 'rgba(30, 41, 59, 0.4)',
      style: 'dashed',
      dashedValue: [2, 2],
    },
  },
  
  candle: {
    type: 'candle_solid',
    bar: {
      upColor: '#22c55e',        // green-500
      downColor: '#ef4444',      // red-500
      noChangeColor: '#64748b',
      upBorderColor: '#22c55e',
      downBorderColor: '#ef4444',
      noChangeBorderColor: '#64748b',
      upWickColor: '#22c55e',
      downWickColor: '#ef4444',
      noChangeWickColor: '#64748b',
    },
    area: {
      lineSize: 2,
      lineColor: '#22d3ee',      // cyan-400
      smooth: true,
      value: 'close',
      backgroundColor: [
        { offset: 0, color: 'rgba(34, 211, 238, 0.3)' },
        { offset: 1, color: 'rgba(34, 211, 238, 0)' },
      ],
    },
    priceMark: {
      show: true,
      high: {
        show: true,
        color: '#94a3b8',
        textOffset: 5,
        textSize: 10,
        textFamily: 'JetBrains Mono, monospace',
        textWeight: 'normal',
      },
      low: {
        show: true,
        color: '#94a3b8',
        textOffset: 5,
        textSize: 10,
        textFamily: 'JetBrains Mono, monospace',
        textWeight: 'normal',
      },
      last: {
        show: true,
        upColor: '#22c55e',
        downColor: '#ef4444',
        noChangeColor: '#64748b',
        line: {
          show: true,
          style: 'dashed',
          dashedValue: [4, 4],
          size: 1,
        },
        text: {
          show: true,
          style: 'fill',
          size: 10,
          paddingLeft: 4,
          paddingTop: 2,
          paddingRight: 4,
          paddingBottom: 2,
          borderRadius: 2,
          color: '#ffffff',
          family: 'JetBrains Mono, monospace',
          weight: 'bold',
        },
      },
    },
  },
  
  indicator: {
    lastValueMark: { show: false },
    tooltip: {
      showRule: 'follow_cross',
      showType: 'rect',
    },
    lines: [
      { style: 'solid', smooth: true, size: 1.5, color: '#f59e0b' },  // MA5
      { style: 'solid', smooth: true, size: 1.5, color: '#ec4899' },  // MA10
      { style: 'solid', smooth: true, size: 1.5, color: '#8b5cf6' },  // MA20
    ],
  },
  
  xAxis: {
    show: true,
    size: 'auto',
    axisLine: { show: false, color: '#475569', size: 1 },
    tickText: {
      show: true,
      color: '#64748b',
      family: 'JetBrains Mono, monospace',
      weight: 'normal',
      size: 10,
    },
    tickLine: { show: false, size: 1, length: 3, color: '#475569' },
  },
  
  yAxis: {
    show: true,
    size: 50,
    position: 'right',
    type: 'normal',
    inside: false,
    reverse: false,
    axisLine: { show: false, color: '#475569', size: 1 },
    tickText: {
      show: true,
      color: '#94a3b8',
      family: 'JetBrains Mono, monospace',
      weight: 'normal',
      size: 10,
    },
    tickLine: { show: false, size: 1, length: 3, color: '#475569' },
  },
  
  separator: {
    size: 1,
    color: 'rgba(71, 85, 105, 0.5)',
    fill: true,
    activeBackgroundColor: 'rgba(34, 211, 238, 0.1)',
  },
  
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: {
        show: true,
        style: 'dashed',
        dashedValue: [4, 2],
        size: 1,
        color: '#94a3b8',
      },
      text: {
        show: true,
        style: 'fill',
        color: '#ffffff',
        size: 10,
        family: 'JetBrains Mono, monospace',
        weight: 'normal',
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2,
        backgroundColor: '#334155',
      },
    },
    vertical: {
      show: true,
      line: {
        show: true,
        style: 'dashed',
        dashedValue: [4, 2],
        size: 1,
        color: '#94a3b8',
      },
      text: {
        show: true,
        style: 'fill',
        color: '#ffffff',
        size: 10,
        family: 'JetBrains Mono, monospace',
        weight: 'normal',
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2,
        backgroundColor: '#334155',
      },
    },
  },
};
```

### 3.5 KLineChart React 包装组件

```tsx
// core/KLineChartWrapper.tsx

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { init, dispose, Chart } from 'klinecharts';
import type { KLineChartWrapperProps, ChartOptions } from './types';
import { convertToKLineData, formatTickLabel } from './chartAdapter';
import { cyberpunkStyles } from '../themes/cyberpunk';
import { DEFAULT_CHART_OPTIONS } from './types';

export const KLineChartWrapper = memo(function KLineChartWrapper({
  data,
  width,
  height = 300,
  theme = 'cyberpunk',
  options: optionsOverride,
  className = '',
  onChartReady,
}: KLineChartWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [containerWidth, setContainerWidth] = useState(width ?? 600);
  
  // 合并配置
  const options: ChartOptions = { ...DEFAULT_CHART_OPTIONS, ...optionsOverride };
  
  // 获取主题样式
  const getThemeStyles = useCallback(() => {
    switch (theme) {
      case 'cyberpunk':
        return cyberpunkStyles;
      case 'professional':
        return {}; // TODO: 添加专业主题
      default:
        return cyberpunkStyles;
    }
  }, [theme]);
  
  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return;
    
    // 创建图表实例
    const chart = init(containerRef.current, {
      styles: getThemeStyles(),
      customApi: {
        // 自定义时间格式化
        formatDate: (timestamp: number) => formatTickLabel(timestamp),
        // 自定义价格格式化
        formatBigNumber: (value: number) => options.formatPrice(value),
      },
    });
    
    if (!chart) return;
    
    chartRef.current = chart;
    
    // 设置图表类型
    if (options.mode === 'line') {
      chart.setStyles({ candle: { type: 'area' } });
    } else {
      chart.setStyles({ candle: { type: 'candle_solid' } });
    }
    
    // 添加成交量指标
    if (options.showVolume) {
      chart.createIndicator('VOL', false, { id: 'volume_pane' });
    }
    
    // 添加均线指标
    if (options.showMA && options.maPeriods.length > 0) {
      chart.createIndicator({
        name: 'MA',
        calcParams: options.maPeriods,
      }, true);
    }
    
    // 回调通知图表就绪
    onChartReady?.(chart);
    
    return () => {
      dispose(containerRef.current!);
      chartRef.current = null;
    };
  }, [theme, options.mode, options.showVolume, options.showMA]);
  
  // 更新数据
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data.length) return;
    
    const klineData = convertToKLineData(data, options.mode, options.timeframe);
    chart.applyNewData(klineData);
  }, [data, options.mode, options.timeframe]);
  
  // 响应式宽度
  useEffect(() => {
    if (width !== undefined) {
      setContainerWidth(width);
      return;
    }
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const newWidth = entry.contentRect.width;
        setContainerWidth(newWidth);
        chartRef.current?.resize();
      }
    });
    
    if (containerRef.current?.parentElement) {
      observer.observe(containerRef.current.parentElement);
    }
    
    return () => observer.disconnect();
  }, [width]);
  
  // 数据为空时的占位
  if (!data || data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800/50 rounded-lg text-gray-500 ${className}`}
        style={{ width: containerWidth, height }}
      >
        等待价格数据...
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className={`kline-chart-container ${className}`}
      style={{
        width: width ?? '100%',
        height,
        backgroundColor: 'transparent',
      }}
    />
  );
});

export default KLineChartWrapper;
```

### 3.6 价格走势图业务组件

```tsx
// charts/PriceChart.tsx

import { useState, useMemo, memo } from 'react';
import { KLineChartWrapper } from '../core/KLineChartWrapper';
import type { PriceHistoryEntry } from '../core/types';

/** 时间周期选项 */
const TIMEFRAMES = [
  { label: '1D', value: 1 },
  { label: '3D', value: 3 },
  { label: '1W', value: 7 },
  { label: '2W', value: 14 },
  { label: '1M', value: 30 },
];

interface PriceChartProps {
  history: PriceHistoryEntry[];
  width?: number;
  height?: number;
  showToolbar?: boolean;
  className?: string;
}

export const PriceChart = memo(function PriceChart({
  history,
  width,
  height = 280,
  showToolbar = true,
  className = '',
}: PriceChartProps) {
  const [mode, setMode] = useState<'line' | 'candle'>('line');
  const [timeframe, setTimeframe] = useState(30);
  const [showMA, setShowMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  
  const toolbarHeight = showToolbar ? 36 : 0;
  const chartHeight = height - toolbarHeight;
  
  return (
    <div className={`bg-slate-900/50 rounded-lg overflow-hidden ${className}`}>
      {/* 工具栏 */}
      {showToolbar && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-700/50">
          {/* 图表类型切换 */}
          <button
            onClick={() => setMode(mode === 'line' ? 'candle' : 'line')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              mode === 'candle'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            }`}
          >
            {mode === 'line' ? '📈' : '📊'}
          </button>
          
          {/* 均线开关 */}
          <button
            onClick={() => setShowMA(!showMA)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              showMA
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            }`}
          >
            MA
          </button>
          
          {/* 成交量开关 */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              showVolume
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
            }`}
          >
            VOL
          </button>
          
          <div className="w-px h-4 bg-slate-600 mx-1" />
          
          {/* 时间周期 */}
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                timeframe === tf.value
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
              }`}
            >
              {tf.label}
            </button>
          ))}
          
          <div className="flex-1" />
          
          {/* 数据统计 */}
          <span className="text-xs text-slate-500">
            {history.length} 天
          </span>
        </div>
      )}
      
      {/* KLineChart 图表 */}
      <KLineChartWrapper
        data={history}
        width={width}
        height={chartHeight}
        theme="cyberpunk"
        options={{
          mode,
          showMA,
          showVolume,
          timeframe,
          maPeriods: [5, 10, 20],
          formatPrice: (v) => `¥${(v / 100).toFixed(1)}`,
        }}
      />
    </div>
  );
});

export default PriceChart;
```

---

## 4. 迁移计划（简化版）

### 4.1 ChartEngine

```typescript
// core/ChartEngine.ts

export class ChartEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dimensions: ChartDimensions;
  private viewport: ViewportState;
  private theme: ChartTheme;
  private renderers: Map<string, Renderer>;
  private interactionManager: InteractionManager;
  private animationFrameId: number | null = null;
  private isDirty = false;
  
  constructor(options: ChartEngineOptions) {
    this.canvas = options.canvas;
    this.ctx = this.setupCanvas();
    this.dimensions = this.calculateDimensions(options.width, options.height, options.margin);
    this.theme = options.theme;
    this.viewport = this.createInitialViewport();
    this.renderers = new Map();
    this.interactionManager = new InteractionManager(this);
  }
  
  /** 设置 Canvas（处理 DPI） */
  private setupCanvas(): CanvasRenderingContext2D {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.dimensions.width * dpr;
    this.canvas.height = this.dimensions.height * dpr;
    const ctx = this.canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    return ctx;
  }
  
  /** 注册渲染器 */
  registerRenderer(name: string, renderer: Renderer): void {
    this.renderers.set(name, renderer);
  }
  
  /** 设置数据 */
  setData(data: DataPoint[]): void {
    // 处理数据，计算统计信息
    this.processedData = this.dataProcessor.process(data);
    // 自动调整视口
    if (!this.viewport.isManuallySet) {
      this.viewport = this.calculateAutoViewport(this.processedData);
    }
    this.markDirty();
  }
  
  /** 标记需要重绘 */
  markDirty(): void {
    if (this.isDirty) return;
    this.isDirty = true;
    this.scheduleRender();
  }
  
  /** 调度渲染（使用 RAF 节流） */
  private scheduleRender(): void {
    if (this.animationFrameId !== null) return;
    this.animationFrameId = requestAnimationFrame(() => {
      this.render();
      this.animationFrameId = null;
      this.isDirty = false;
    });
  }
  
  /** 主渲染循环 */
  private render(): void {
    const ctx = this.ctx;
    const { width, height } = this.dimensions;
    
    // 1. 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 2. 构建渲染上下文
    const renderContext: RenderContext = {
      ctx,
      dimensions: this.dimensions,
      scales: this.calculateScales(),
      viewport: this.viewport,
      theme: this.theme,
      data: this.processedData,
    };
    
    // 3. 按顺序执行渲染器
    for (const [, renderer] of this.renderers) {
      renderer.render(renderContext);
    }
  }
  
  /** 计算比例尺 */
  private calculateScales(): Scales {
    const { innerWidth, innerHeight, margin } = this.dimensions;
    const [startIdx, endIdx] = this.viewport.dataRange;
    const [minPrice, maxPrice] = this.viewport.priceRange;
    
    return {
      x: (index: number) => {
        const ratio = (index - startIdx) / (endIdx - startIdx - 1 || 1);
        return margin.left + ratio * innerWidth;
      },
      y: (value: number) => {
        const ratio = (value - minPrice) / (maxPrice - minPrice || 1);
        return margin.top + innerHeight * (1 - ratio);
      },
      xInvert: (pixel: number) => {
        const ratio = (pixel - margin.left) / innerWidth;
        return startIdx + ratio * (endIdx - startIdx);
      },
      yInvert: (pixel: number) => {
        const ratio = (margin.top + innerHeight - pixel) / innerHeight;
        return minPrice + ratio * (maxPrice - minPrice);
      },
    };
  }
  
  /** 销毁 */
  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.interactionManager.destroy();
  }
}
```

### 4.2 智能价格范围计算

解决当前图表"扁平"问题的核心算法：

```typescript
// core/ScaleManager.ts

export class ScaleManager {
  /**
   * 智能计算价格范围
   * 确保价格波动视觉效果明显，同时保持合理的边距
   */
  static calculatePriceRange(
    data: DataPoint[],
    priceKey: string | string[] = 'price',
    options: {
      paddingPercent?: number;      // 边距百分比
      minRangePercent?: number;     // 最小范围（相对于中心价）
      roundToNice?: boolean;        // 是否圆整到"好看"的数字
      forceSymmetric?: boolean;     // 是否强制对称（用于盈亏图）
    } = {}
  ): [number, number] {
    const {
      paddingPercent = 0.1,
      minRangePercent = 0.08,  // 至少 8% 的波动范围
      roundToNice = true,
    } = options;
    
    // 1. 收集所有价格值
    const keys = Array.isArray(priceKey) ? priceKey : [priceKey];
    let min = Infinity;
    let max = -Infinity;
    
    for (const point of data) {
      for (const key of keys) {
        const value = point[key];
        if (typeof value === 'number' && isFinite(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
    }
    
    if (!isFinite(min) || !isFinite(max)) {
      return [0, 100];
    }
    
    // 2. 计算中心价和实际范围
    const center = (min + max) / 2;
    const actualRange = max - min;
    
    // 3. 确保最小范围（解决"扁平"问题）
    const minRange = center * minRangePercent;
    const effectiveRange = Math.max(actualRange, minRange);
    
    // 4. 添加边距
    const padding = effectiveRange * paddingPercent;
    let rangeMin = center - effectiveRange / 2 - padding;
    let rangeMax = center + effectiveRange / 2 + padding;
    
    // 5. 确保非负（价格不能为负）
    if (rangeMin < 0 && min >= 0) {
      rangeMin = 0;
      rangeMax = effectiveRange * (1 + paddingPercent * 2);
    }
    
    // 6. 圆整到"好看"的数字
    if (roundToNice) {
      const step = this.calculateNiceStep(rangeMax - rangeMin, 5);
      rangeMin = Math.floor(rangeMin / step) * step;
      rangeMax = Math.ceil(rangeMax / step) * step;
    }
    
    return [rangeMin, rangeMax];
  }
  
  /**
   * 计算"好看"的刻度间隔
   */
  static calculateNiceStep(range: number, targetTicks: number): number {
    const roughStep = range / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;
    
    let niceStep: number;
    if (normalized <= 1) niceStep = 1;
    else if (normalized <= 2) niceStep = 2;
    else if (normalized <= 5) niceStep = 5;
    else niceStep = 10;
    
    return niceStep * magnitude;
  }
}
```

---

## 5. 渲染器实现

### 5.1 折线渲染器

```typescript
// renderers/LineRenderer.ts

export class LineRenderer implements Renderer {
  private options: LineRendererOptions;
  
  constructor(options: LineRendererOptions = {}) {
    this.options = {
      dataKey: 'price',
      lineWidth: 2,
      tension: 0.25,  // 贝塞尔曲线张力
      showArea: true,
      showDots: false,
      ...options,
    };
  }
  
  render(context: RenderContext): void {
    const { ctx, scales, data, theme, dimensions } = context;
    const { dataKey, lineWidth, tension, showArea } = this.options;
    
    if (data.length < 2) return;
    
    // 构建点序列
    const points: Point[] = data.map((d, i) => ({
      x: scales.x(i),
      y: scales.y(d[dataKey] as number),
    }));
    
    // 绘制渐变区域
    if (showArea) {
      this.drawArea(ctx, points, dimensions, theme);
    }
    
    // 绘制平滑曲线
    this.drawSmoothLine(ctx, points, theme.priceLine.color, lineWidth, tension);
    
    // 绘制当前价格点
    this.drawCurrentPricePoint(ctx, points[points.length - 1], theme);
  }
  
  private drawSmoothLine(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    color: string,
    width: number,
    tension: number
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      // Catmull-Rom to Bezier conversion
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    
    ctx.stroke();
  }
  
  private drawArea(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    dimensions: ChartDimensions,
    theme: ChartTheme
  ): void {
    const baseY = dimensions.margin.top + dimensions.innerHeight;
    
    // 创建渐变
    const gradient = ctx.createLinearGradient(0, points[0].y, 0, baseY);
    gradient.addColorStop(0, theme.priceLine.gradientStart);
    gradient.addColorStop(1, theme.priceLine.gradientEnd);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(points[0].x, baseY);
    
    // 使用与线条相同的贝塞尔曲线
    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        ctx.lineTo(points[i].x, points[i].y);
      } else {
        const p0 = points[Math.max(0, i - 2)];
        const p1 = points[i - 1];
        const p2 = points[i];
        const p3 = points[Math.min(points.length - 1, i + 1)];
        
        const tension = 0.25;
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    }
    
    ctx.lineTo(points[points.length - 1].x, baseY);
    ctx.closePath();
    ctx.fill();
  }
}
```

### 5.2 K线渲染器

```typescript
// renderers/CandleRenderer.ts

export class CandleRenderer implements Renderer {
  render(context: RenderContext): void {
    const { ctx, scales, data, theme, dimensions } = context;
    const candleData = data as CandleDataPoint[];
    
    if (candleData.length === 0) return;
    
    // 计算蜡烛布局
    const layout = this.calculateLayout(dimensions.innerWidth, candleData.length);
    
    for (let i = 0; i < candleData.length; i++) {
      const d = candleData[i];
      const x = scales.x(i) - layout.candleWidth / 2;
      
      this.drawCandle(ctx, {
        x,
        width: layout.candleWidth,
        open: scales.y(d.open),
        high: scales.y(d.high),
        low: scales.y(d.low),
        close: scales.y(d.close),
        isUp: d.close >= d.open,
        theme: theme.candle,
      });
    }
  }
  
  private calculateLayout(chartWidth: number, count: number): CandleLayout {
    const slotWidth = chartWidth / count;
    const candleWidth = Math.max(3, Math.min(14, slotWidth * 0.65));
    const gap = slotWidth - candleWidth;
    
    return { candleWidth, gap };
  }
  
  private drawCandle(
    ctx: CanvasRenderingContext2D,
    params: CandleDrawParams
  ): void {
    const { x, width, open, high, low, close, isUp, theme } = params;
    const color = isUp ? theme.upColor : theme.downColor;
    const wickColor = isUp ? (theme.upWickColor || color) : (theme.downWickColor || color);
    
    const bodyTop = Math.min(open, close);
    const bodyBottom = Math.max(open, close);
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);
    const centerX = x + width / 2;
    
    // 1. 绘制影线
    const wickWidth = Math.max(1, Math.min(2, width * 0.15));
    ctx.strokeStyle = wickColor;
    ctx.lineWidth = wickWidth;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    if (high < bodyTop - 1) {
      ctx.moveTo(centerX, high);
      ctx.lineTo(centerX, bodyTop);
    }
    if (low > bodyBottom + 1) {
      ctx.moveTo(centerX, bodyBottom);
      ctx.lineTo(centerX, low);
    }
    ctx.stroke();
    
    // 2. 绘制实体
    const radius = Math.min(theme.borderRadius, width / 4, bodyHeight / 4);
    
    if (theme.hollowUp && isUp && width > 5) {
      // 空心阳线
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, width * 0.15);
      ctx.beginPath();
      this.roundRect(ctx, x, bodyTop, width, bodyHeight, radius);
      ctx.stroke();
    } else {
      // 实心蜡烛
      ctx.fillStyle = color;
      ctx.beginPath();
      this.roundRect(ctx, x, bodyTop, width, bodyHeight, radius);
      ctx.fill();
    }
  }
  
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    if (r > 0 && h > 2) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  }
}
```

### 5.3 成交量渲染器

```typescript
// renderers/VolumeRenderer.ts

export class VolumeRenderer implements Renderer {
  private options: VolumeRendererOptions;
  
  constructor(options: VolumeRendererOptions = {}) {
    this.options = {
      height: 60,           // 成交量区域高度
      barWidthRatio: 0.6,   // 柱宽占比
      showSeparator: true,  // 是否显示分隔线
      ...options,
    };
  }
  
  render(context: RenderContext): void {
    const { ctx, scales, data, theme, dimensions } = context;
    const { height, barWidthRatio } = this.options;
    
    // 成交量绘制区域
    const volumeTop = dimensions.margin.top + dimensions.innerHeight - height;
    const volumeHeight = height - 10;
    
    // 计算最大成交量
    const maxVolume = Math.max(...data.map(d => (d.volume as number) || 0), 1);
    
    // 计算柱宽
    const barWidth = Math.max(2, (dimensions.innerWidth / data.length) * barWidthRatio);
    
    // 绘制分隔线
    if (this.options.showSeparator) {
      ctx.strokeStyle = theme.grid.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(dimensions.margin.left, volumeTop);
      ctx.lineTo(dimensions.margin.left + dimensions.innerWidth, volumeTop);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // 绘制成交量柱
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const volume = (d.volume as number) || 0;
      if (volume === 0) continue;
      
      const x = scales.x(i);
      const barHeight = (volume / maxVolume) * volumeHeight;
      const y = volumeTop + volumeHeight - barHeight;
      
      // 判断涨跌
      const isUp = this.isUp(data, i);
      const color = isUp ? theme.volume.upColor : theme.volume.downColor;
      
      ctx.globalAlpha = theme.volume.opacity;
      ctx.fillStyle = color;
      ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);
      ctx.globalAlpha = 1;
    }
    
    // 绘制 VOL 标签
    ctx.fillStyle = theme.axis.textColor;
    ctx.font = `${theme.axis.fontSize - 2}px ${theme.axis.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.fillText('VOL', dimensions.margin.left + 5, volumeTop + 12);
  }
  
  private isUp(data: DataPoint[], index: number): boolean {
    const d = data[index];
    
    // K线数据
    if ('close' in d && 'open' in d) {
      return (d.close as number) >= (d.open as number);
    }
    
    // 普通价格数据：与前一个比较
    if (index > 0 && 'price' in d) {
      return (d.price as number) >= (data[index - 1].price as number);
    }
    
    // 买卖量数据
    if ('buyVolume' in d && 'sellVolume' in d) {
      return (d.buyVolume as number) >= (d.sellVolume as number);
    }
    
    return true;
  }
}
```

---

## 6. 交互系统

### 6.1 交互管理器

```typescript
// interaction/InteractionManager.ts

export class InteractionManager {
  private engine: ChartEngine;
  private behaviors: Map<string, InteractionBehavior>;
  private activeListeners: (() => void)[] = [];
  
  constructor(engine: ChartEngine) {
    this.engine = engine;
    this.behaviors = new Map();
    this.setupEventListeners();
  }
  
  registerBehavior(name: string, behavior: InteractionBehavior): void {
    this.behaviors.set(name, behavior);
    behavior.attach(this.engine);
  }
  
  private setupEventListeners(): void {
    const canvas = this.engine.canvas;
    
    // 鼠标事件
    const onMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
    const onMouseDown = (e: MouseEvent) => this.handleMouseDown(e);
    const onMouseUp = (e: MouseEvent) => this.handleMouseUp(e);
    const onMouseLeave = () => this.handleMouseLeave();
    const onWheel = (e: WheelEvent) => this.handleWheel(e);
    
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    
    // 触摸事件
    const onTouchStart = (e: TouchEvent) => this.handleTouchStart(e);
    const onTouchMove = (e: TouchEvent) => this.handleTouchMove(e);
    const onTouchEnd = () => this.handleTouchEnd();
    
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);
    
    // 存储清理函数
    this.activeListeners.push(() => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    });
  }
  
  private handleMouseMove(e: MouseEvent): void {
    const point = this.getCanvasPoint(e);
    for (const [, behavior] of this.behaviors) {
      behavior.onMouseMove?.(point, e);
    }
  }
  
  // ... 其他事件处理方法
  
  destroy(): void {
    for (const cleanup of this.activeListeners) {
      cleanup();
    }
    for (const [, behavior] of this.behaviors) {
      behavior.detach();
    }
  }
}
```

### 6.2 十字光标行为

```typescript
// interaction/CrosshairBehavior.ts

export class CrosshairBehavior implements InteractionBehavior {
  private engine: ChartEngine | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private currentPosition: Point | null = null;
  private rafId: number | null = null;
  
  attach(engine: ChartEngine): void {
    this.engine = engine;
    // 创建叠加层 Canvas
    this.overlayCtx = this.createOverlayCanvas();
  }
  
  onMouseMove(point: Point): void {
    this.currentPosition = point;
    this.scheduleRender();
  }
  
  onMouseLeave(): void {
    this.currentPosition = null;
    this.clear();
  }
  
  private scheduleRender(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.render();
      this.rafId = null;
    });
  }
  
  private render(): void {
    if (!this.overlayCtx || !this.currentPosition || !this.engine) return;
    
    const ctx = this.overlayCtx;
    const { dimensions, theme, scales } = this.engine;
    const { x, y } = this.currentPosition;
    
    // 检查是否在绘图区域内
    if (!this.isInChartArea(x, y, dimensions)) {
      this.clear();
      return;
    }
    
    // 清除叠加层
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    
    // 绘制十字光标线
    ctx.strokeStyle = theme.crosshair.lineColor;
    ctx.lineWidth = theme.crosshair.lineWidth;
    ctx.setLineDash(theme.crosshair.dashArray);
    
    // 水平线
    ctx.beginPath();
    ctx.moveTo(dimensions.margin.left, y);
    ctx.lineTo(dimensions.margin.left + dimensions.innerWidth, y);
    ctx.stroke();
    
    // 垂直线
    ctx.beginPath();
    ctx.moveTo(x, dimensions.margin.top);
    ctx.lineTo(x, dimensions.margin.top + dimensions.innerHeight);
    ctx.stroke();
    
    ctx.setLineDash([]);
    
    // 绘制价格标签
    const price = scales.yInvert(y);
    this.drawPriceLabel(ctx, price, y, dimensions, theme);
    
    // 绘制时间标签
    const dataIndex = Math.round(scales.xInvert(x));
    this.drawTimeLabel(ctx, dataIndex, x, dimensions, theme);
  }
  
  private drawPriceLabel(
    ctx: CanvasRenderingContext2D,
    price: number,
    y: number,
    dimensions: ChartDimensions,
    theme: ChartTheme
  ): void {
    const label = this.engine?.formatPrice(price) ?? price.toFixed(2);
    const x = dimensions.margin.left + dimensions.innerWidth + 5;
    
    ctx.fillStyle = theme.tooltip.background;
    ctx.font = `${theme.axis.fontSize}px ${theme.axis.fontFamily}`;
    const textWidth = ctx.measureText(label).width;
    
    // 背景
    ctx.fillRect(x, y - 10, textWidth + 10, 20);
    
    // 文字
    ctx.fillStyle = theme.tooltip.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 5, y);
  }
}
```

---

## 7. React 组件层

### 7.1 基础图表容器

```tsx
// charts/BaseChart.tsx

export interface BaseChartProps {
  /** 数据 */
  data: DataPoint[];
  /** 宽度（默认自适应容器） */
  width?: number;
  /** 高度 */
  height?: number;
  /** 主题 */
  theme?: ChartTheme | 'cyberpunk' | 'professional' | 'minimal';
  /** 边距 */
  margin?: Partial<ChartDimensions['margin']>;
  /** 是否显示网格 */
  showGrid?: boolean;
  /** 是否显示十字光标 */
  showCrosshair?: boolean;
  /** 是否启用缩放 */
  enableZoom?: boolean;
  /** 是否启用拖拽 */
  enablePan?: boolean;
  /** 价格格式化函数 */
  formatPrice?: (value: number) => string;
  /** 时间格式化函数 */
  formatTime?: (tick: number) => string;
  /** 子元素（可组合的图表元素） */
  children?: React.ReactNode;
  /** 类名 */
  className?: string;
}

export function BaseChart({
  data,
  width: propWidth,
  height = 300,
  theme = 'cyberpunk',
  margin: marginOverride,
  showGrid = true,
  showCrosshair = true,
  enableZoom = true,
  enablePan = true,
  formatPrice = (v) => `¥${(v / 100).toFixed(2)}`,
  formatTime,
  children,
  className = '',
}: BaseChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  
  // 自适应宽度
  const [containerWidth, setContainerWidth] = useState(propWidth ?? 600);
  
  // 解析主题
  const resolvedTheme = useMemo(() => {
    if (typeof theme === 'string') {
      return getTheme(theme);
    }
    return theme;
  }, [theme]);
  
  // 使用图表引擎
  const engine = useChartEngine({
    canvas: canvasRef.current,
    overlay: overlayRef.current,
    width: containerWidth,
    height,
    theme: resolvedTheme,
    margin: marginOverride,
    formatPrice,
    formatTime,
  });
  
  // 响应式宽度
  useEffect(() => {
    if (propWidth !== undefined) return;
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [propWidth]);
  
  // 更新数据
  useEffect(() => {
    engine?.setData(data);
  }, [engine, data]);
  
  // 配置交互
  useEffect(() => {
    if (!engine) return;
    
    if (enableZoom) {
      engine.enableBehavior('zoom');
    }
    if (enablePan) {
      engine.enableBehavior('pan');
    }
    if (showCrosshair) {
      engine.enableBehavior('crosshair');
    }
  }, [engine, enableZoom, enablePan, showCrosshair]);
  
  return (
    <ChartContext.Provider value={{ engine, theme: resolvedTheme }}>
      <div 
        ref={containerRef} 
        className={`relative ${className}`}
        style={{ width: propWidth ?? '100%', height }}
      >
        {/* 主画布 */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ width: containerWidth, height }}
        />
        
        {/* 叠加层（十字光标等） */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: containerWidth, height }}
        />
        
        {/* 可组合子元素 */}
        {children}
      </div>
    </ChartContext.Provider>
  );
}
```

### 7.2 价格走势图（业务组件）

```tsx
// charts/PriceChart.tsx

export interface PriceChartProps {
  /** 价格历史数据 */
  history: PriceHistoryEntry[];
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 是否显示成交量 */
  showVolume?: boolean;
  /** 是否显示均线 */
  showMA?: boolean;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 图表模式 */
  mode?: 'line' | 'candle';
  /** 时间周期选项 */
  timeframes?: TimeframeOption[];
  /** 初始时间周期 */
  initialTimeframe?: number;
  /** 类名 */
  className?: string;
}

export function PriceChart({
  history,
  width,
  height = 280,
  showVolume = true,
  showMA = true,
  showToolbar = true,
  mode: initialMode = 'line',
  timeframes = DEFAULT_TIMEFRAMES,
  initialTimeframe = 30,
  className = '',
}: PriceChartProps) {
  const [mode, setMode] = useState(initialMode);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [maEnabled, setMaEnabled] = useState(showMA);
  const [volumeEnabled, setVolumeEnabled] = useState(showVolume);
  
  // 根据时间周期聚合数据
  const chartData = useMemo(() => {
    if (mode === 'candle') {
      return aggregateToCandles(history, timeframe);
    }
    return history;
  }, [history, mode, timeframe]);
  
  // 计算实际高度（扣除工具栏）
  const chartHeight = showToolbar ? height - 36 : height;
  const volumeHeight = volumeEnabled ? 60 : 0;
  
  if (history.length < 2) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-800/50 rounded-lg text-gray-500 ${className}`}
        style={{ width, height }}
      >
        等待价格数据...
      </div>
    );
  }
  
  return (
    <div className={`bg-slate-900/50 rounded-lg overflow-hidden ${className}`}>
      {/* 工具栏 */}
      {showToolbar && (
        <ChartToolbar
          mode={mode}
          onModeChange={setMode}
          timeframe={timeframe}
          timeframes={timeframes}
          onTimeframeChange={setTimeframe}
          maEnabled={maEnabled}
          onMaToggle={() => setMaEnabled(!maEnabled)}
          volumeEnabled={volumeEnabled}
          onVolumeToggle={() => setVolumeEnabled(!volumeEnabled)}
          dataCount={chartData.length}
        />
      )}
      
      {/* 图表 */}
      <BaseChart
        data={chartData}
        width={width}
        height={chartHeight}
        theme="cyberpunk"
        showGrid
        showCrosshair
        enableZoom
        enablePan
        formatPrice={(cents) => `¥${(cents / 100).toFixed(1)}`}
      >
        {/* 主图层 */}
        {mode === 'line' ? (
          <LineSeries dataKey="price" showArea />
        ) : (
          <CandleSeries />
        )}
        
        {/* 均线 */}
        {maEnabled && (
          <>
            <MASeries period={5} color="#f59e0b" />
            <MASeries period={10} color="#ec4899" />
          </>
        )}
        
        {/* 成交量 */}
        {volumeEnabled && (
          <VolumeSeries height={volumeHeight} />
        )}
        
        {/* 坐标轴 */}
        <XAxis />
        <YAxis />
        
        {/* 当前价格线 */}
        <CurrentPriceLine />
        
        {/* 图例 */}
        {maEnabled && <MALegend />}
      </BaseChart>
    </div>
  );
}
```

---

## 8. 主题系统

### 8.1 赛博朋克主题

```typescript
// themes/cyberpunk.ts

export const cyberpunkTheme: ChartTheme = {
  name: 'cyberpunk',
  
  background: 'transparent',
  
  grid: {
    color: 'rgba(30, 41, 59, 0.8)',  // slate-800
    lineWidth: 0.5,
    dashArray: [2, 2],
  },
  
  axis: {
    lineColor: '#475569',  // slate-600
    textColor: '#94a3b8',  // slate-400
    fontSize: 10,
    fontFamily: 'JetBrains Mono, monospace',
  },
  
  priceLine: {
    color: '#22d3ee',  // cyan-400
    width: 2,
    gradientStart: 'rgba(34, 211, 238, 0.3)',
    gradientEnd: 'rgba(34, 211, 238, 0)',
  },
  
  candle: {
    upColor: '#22c55e',    // green-500
    downColor: '#ef4444',  // red-500
    borderRadius: 1,
    hollowUp: true,
  },
  
  volume: {
    upColor: '#22c55e',
    downColor: '#ef4444',
    opacity: 0.6,
  },
  
  movingAverages: {
    ma5: '#f59e0b',   // amber-500
    ma10: '#ec4899',  // pink-500
    ma20: '#8b5cf6',  // violet-500
    ma60: '#06b6d4',  // cyan-500
  },
  
  crosshair: {
    lineColor: '#94a3b8',
    lineWidth: 0.5,
    dashArray: [4, 2],
  },
  
  tooltip: {
    background: 'rgba(30, 41, 59, 0.95)',
    border: '#334155',
    textColor: '#e2e8f0',
    shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
  },
  
  priceLabel: {
    upBackground: '#22c55e',
    downBackground: '#ef4444',
    textColor: '#ffffff',
  },
};
```

---

## 9. 迁移策略

### 阶段一：创建新系统（不影响现有功能）
1. 在 `charts-v2/` 目录创建新系统
2. 实现核心引擎和基础渲染器
3. 创建测试页面验证功能

### 阶段二：替换价格走势图
1. 用新的 `PriceChart` 替换 `PriceChartCanvas`
2. 验证功能和性能
3. 收集反馈优化

### 阶段三：替换其他图表
1. 替换 `CandlestickChart`
2. 替换 `MarketTradeCenter` 内的 PriceChart
3. 清理旧代码

### 阶段四：扩展和优化
1. 添加更多图表类型（柱状图、饼图等）
2. 性能优化（Web Worker、虚拟化）
3. 添加更多主题

---

## 10. 预期效果

| 指标 | 当前 | 目标 |
|------|------|------|
| 价格波动可视化 | 扁平 | 清晰可见 |
| 成交量显示 | 过小 | 占图表 20% 高度 |
| 代码复用率 | ~20% | >80% |
| 渲染性能 | 一般 | <16ms/帧 |
| 交互流畅度 | 卡顿 | 60fps |
| 主题一致性 | 混乱 | 统一 |

---

## 11. 技术栈总结

- **渲染**：Canvas 2D（高性能、完全控制）
- **状态管理**：React Hooks + 轻量级 Context
- **交互**：原生事件 + RAF 节流
- **动画**：requestAnimationFrame
- **类型**：TypeScript 严格模式
- **主题**：对象配置 + CSS 变量