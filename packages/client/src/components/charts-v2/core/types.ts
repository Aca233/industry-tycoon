/**
 * 图表系统核心类型定义
 * 基于 KLineChart 的封装
 */

// 不需要导入未使用的类型

/** 来自 gameStore 的价格历史条目 */
export interface PriceHistoryEntry {
  tick: number;
  price: number;
  volume?: number;
  buyVolume?: number;
  sellVolume?: number;
}

/** 图表模式 */
export type ChartMode = 'line' | 'candle';

/** 图表主题类型 */
export type ChartThemeType = 'cyberpunk' | 'professional' | 'dark' | 'light';

/** 图表配置选项 */
export interface ChartOptions {
  /** 图表模式 */
  mode: ChartMode;
  /** 是否显示成交量 */
  showVolume: boolean;
  /** 是否显示均线 */
  showMA: boolean;
  /** 均线周期配置 */
  maPeriods: number[];
  /** 价格格式化函数 */
  formatPrice: (value: number) => string;
  /** 时间格式化函数 */
  formatTime: (tick: number) => string;
}

/** KLineChart 包装组件 Props */
export interface KLineChartWrapperProps {
  /** 原始价格数据 */
  data: PriceHistoryEntry[];
  /** 图表唯一标识（用于区分不同商品） */
  chartId?: string;
  /** 当前 tick（用于触发更新） */
  tick?: number;
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
  onChartReady?: (chart: unknown) => void;
}

/** 价格走势图 Props */
export interface PriceChartProps {
  /** 价格历史数据 */
  history: PriceHistoryEntry[];
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 类名 */
  className?: string;
}

/** 默认配置 */
export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  mode: 'line',
  showVolume: true,
  showMA: true,
  maPeriods: [5, 10, 20],
  formatPrice: (v) => `¥${(v / 100).toFixed(2)}`,
  formatTime: (tick) => `D${tick + 1}`,
};