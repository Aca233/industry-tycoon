/**
 * 赛博朋克主题
 * 映射游戏风格到 KLineChart 样式系统
 * 
 * 使用 KLineChart v9 的枚举类型
 */

import { LineType, CandleType, PolygonType, type DeepPartial, type Styles } from 'klinecharts';

/**
 * 赛博朋克主题样式配置
 * 只覆盖需要自定义的属性
 */
export const cyberpunkStyles: DeepPartial<Styles> = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      size: 1,
      color: 'rgba(30, 41, 59, 0.6)',
      style: LineType.Dashed,
      dashedValue: [2, 2],
    },
    vertical: {
      show: false,
    },
  },

  candle: {
    type: CandleType.CandleSolid,
    bar: {
      upColor: '#22c55e',
      downColor: '#ef4444',
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
      lineColor: '#22d3ee',
      smooth: true,
      value: 'close',
      backgroundColor: [
        { offset: 0, color: 'rgba(34, 211, 238, 0.3)' },
        { offset: 1, color: 'rgba(34, 211, 238, 0)' },
      ],
    },
    priceMark: {
      show: true,
      last: {
        show: true,
        upColor: '#22c55e',
        downColor: '#ef4444',
        noChangeColor: '#64748b',
        line: {
          show: true,
          style: LineType.Dashed,
          dashedValue: [4, 4],
          size: 1,
        },
      },
    },
  },

  indicator: {
    lines: [
      { style: LineType.Solid, smooth: true, size: 1.5, color: '#f59e0b', dashedValue: [2, 2] },
      { style: LineType.Solid, smooth: true, size: 1.5, color: '#ec4899', dashedValue: [2, 2] },
      { style: LineType.Solid, smooth: true, size: 1.5, color: '#8b5cf6', dashedValue: [2, 2] },
    ],
  },

  xAxis: {
    show: true,
    axisLine: { show: false },
    tickText: {
      show: true,
      color: '#64748b',
      family: 'JetBrains Mono, monospace',
      size: 10,
    },
    tickLine: { show: false },
  },

  yAxis: {
    show: true,
    axisLine: { show: false },
    tickText: {
      show: true,
      color: '#94a3b8',
      family: 'JetBrains Mono, monospace',
      size: 10,
    },
    tickLine: { show: false },
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
        style: LineType.Dashed,
        dashedValue: [4, 2],
        size: 1,
        color: '#94a3b8',
      },
      text: {
        show: true,
        style: PolygonType.Fill,
        color: '#ffffff',
        size: 10,
        family: 'JetBrains Mono, monospace',
        backgroundColor: '#334155',
        borderStyle: LineType.Solid,
        borderSize: 0,
        borderColor: 'transparent',
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2,
        borderDashedValue: [2, 2],
      },
    },
    vertical: {
      show: true,
      line: {
        show: true,
        style: LineType.Dashed,
        dashedValue: [4, 2],
        size: 1,
        color: '#94a3b8',
      },
      text: {
        show: true,
        style: PolygonType.Fill,
        color: '#ffffff',
        size: 10,
        family: 'JetBrains Mono, monospace',
        backgroundColor: '#334155',
        borderStyle: LineType.Solid,
        borderSize: 0,
        borderColor: 'transparent',
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2,
        borderDashedValue: [2, 2],
      },
    },
  },
};

/**
 * 获取主题样式
 */
export function getThemeStyles(theme: string): DeepPartial<Styles> {
  switch (theme) {
    case 'cyberpunk':
      return cyberpunkStyles;
    case 'professional':
    case 'dark':
    case 'light':
    default:
      return cyberpunkStyles;
  }
}