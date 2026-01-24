/**
 * KLineChart React 包装组件
 * 提供统一的 React 接口来使用 KLineChart v9
 *
 * 性能优化：
 * - 使用节流控制更新频率
 * - 增量更新只追加新数据点
 * - 避免不必要的重建
 */

import { useRef, useEffect, useState } from 'react';
import { init, dispose, type Chart, CandleType } from 'klinecharts';
import type { KLineChartWrapperProps, ChartOptions, ChartMode } from './types';
import { convertToKLineData, formatTickLabel, formatPrice } from './chartAdapter';
import { getThemeStyles } from '../themes';
import { DEFAULT_CHART_OPTIONS } from './types';


// 不使用 memo，确保每次 props 变化都能更新
export function KLineChartWrapper({
  data,
  chartId,
  tick,
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
  const prevOptionsRef = useRef<{
    mode: ChartMode;
    showVolume: boolean;
    showMA: boolean;
  } | null>(null);
  
  // 跟踪当前图表的 ID，用于检测商品切换
  const currentChartIdRef = useRef<string | undefined>(chartId);
  
  // 使用 ref 保存最新的 data，避免 useEffect 闭包问题
  const dataRef = useRef(data);
  dataRef.current = data;

  // 合并配置
  const options: ChartOptions = { ...DEFAULT_CHART_OPTIONS, ...optionsOverride };
  
  // 使用 ref 保存 options
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 初始化图表 - 当 theme 或 chartId 变化时重新创建
  useEffect(() => {
    if (!containerRef.current) return;

    // 销毁旧实例
    if (chartRef.current) {
      dispose(containerRef.current);
      chartRef.current = null;
    }
    
    // 更新当前图表 ID
    currentChartIdRef.current = chartId;

    // 获取主题样式
    const themeStyles = getThemeStyles(theme);
    
    // 使用 ref 中的最新配置
    const currentOptions = optionsRef.current;

    // 创建图表实例
    const chart = init(containerRef.current, {
      styles: themeStyles as Record<string, unknown>,
      customApi: {
        formatDate: (
          _dateTimeFormat: Intl.DateTimeFormat,
          timestamp: number,
          _format: string,
          _type: number
        ) => formatTickLabel(timestamp),
        formatBigNumber: (value: string | number) =>
          typeof value === 'number' ? formatPrice(value) : value,
      },
    });

    if (!chart) return;

    chartRef.current = chart;

    // 记录当前配置
    prevOptionsRef.current = {
      mode: currentOptions.mode,
      showVolume: currentOptions.showVolume,
      showMA: currentOptions.showMA,
    };

    // 设置图表类型
    if (currentOptions.mode === 'line') {
      chart.setStyles({ candle: { type: CandleType.Area } });
    } else {
      chart.setStyles({ candle: { type: CandleType.CandleSolid } });
    }

    // 添加成交量指标（在副图中显示）
    if (currentOptions.showVolume) {
      chart.createIndicator('VOL', false, { id: 'volume_pane' });
    }

    // 添加均线指标（在主图中显示）
    if (currentOptions.showMA && currentOptions.maPeriods.length > 0) {
      chart.createIndicator(
        {
          name: 'MA',
          calcParams: currentOptions.maPeriods,
        },
        true,
        { id: 'candle_pane' }
      );
    }
    
    // 使用 ref 中的最新数据立即加载
    const currentData = dataRef.current;
    if (currentData.length > 0) {
      const klineData = convertToKLineData(currentData, currentOptions.mode);
      chart.applyNewData(klineData);
      
      // 滚动到最新数据（最右侧）
      chart.scrollToRealTime();
    }

    // 回调通知图表就绪
    onChartReady?.(chart);

    return () => {
      if (containerRef.current) {
        dispose(containerRef.current);
      }
      chartRef.current = null;
    };
  }, [theme, chartId]);  // 只依赖 theme 和 chartId，通过 ref 获取最新数据

  // 更新图表配置
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !prevOptionsRef.current) return;

    const prev = prevOptionsRef.current;

    // 更新图表类型
    if (prev.mode !== options.mode) {
      if (options.mode === 'line') {
        chart.setStyles({ candle: { type: CandleType.Area } });
      } else {
        chart.setStyles({ candle: { type: CandleType.CandleSolid } });
      }
    }

    // 更新成交量显示
    if (prev.showVolume !== options.showVolume) {
      if (options.showVolume) {
        chart.createIndicator('VOL', false, { id: 'volume_pane' });
      } else {
        chart.removeIndicator('volume_pane', 'VOL');
      }
    }

    // 更新均线显示
    if (prev.showMA !== options.showMA) {
      if (options.showMA) {
        chart.createIndicator(
          {
            name: 'MA',
            calcParams: options.maPeriods,
          },
          true,
          { id: 'candle_pane' }
        );
      } else {
        chart.removeIndicator('candle_pane', 'MA');
      }
    }

    // 更新记录
    prevOptionsRef.current = {
      mode: options.mode,
      showVolume: options.showVolume,
      showMA: options.showMA,
    };
  }, [options.mode, options.showVolume, options.showMA, options.maPeriods]);

  // 数据更新逻辑 - 使用全量更新但限制频率
  // KLineChart 的 updateData 方法无法正确触发视觉刷新
  // 因此改用 applyNewData 全量更新，但每5个数据点才更新一次
  const dataLength = data.length;
  const lastDataTick = dataLength > 0 ? data[dataLength - 1].tick : 0;
  
  // 记录上次更新时的数据长度
  const lastAppliedLengthRef = useRef(0);
  // 更新间隔（每N个数据点更新一次）- 设为1确保每个tick都更新
  const UPDATE_INTERVAL = 1;
  
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || dataLength === 0) return;
    
    const lastApplied = lastAppliedLengthRef.current;
    
    // 首次加载、数据减少、或达到更新间隔时全量更新
    const shouldUpdate =
      lastApplied === 0 ||
      dataLength < lastApplied ||
      dataLength - lastApplied >= UPDATE_INTERVAL;
    
    if (shouldUpdate) {
      const currentData = dataRef.current;
      const currentOptions = optionsRef.current;
      const klineData = convertToKLineData(currentData, currentOptions.mode);
      
      chart.applyNewData(klineData);
      lastAppliedLengthRef.current = dataLength;
      chart.scrollToRealTime();
      
      // 强制触发重绘
      requestAnimationFrame(() => {
        chart.resize();
      });
    }
  }, [dataLength, lastDataTick]);

  // 响应式宽度
  useEffect(() => {
    if (width !== undefined) {
      setContainerWidth(width);
      chartRef.current?.resize();
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 0 && Math.abs(newWidth - containerWidth) > 5) {
          setContainerWidth(newWidth);
          chartRef.current?.resize();
        }
      }
    });

    if (containerRef.current?.parentElement) {
      observer.observe(containerRef.current.parentElement);
    }

    return () => observer.disconnect();
  }, [width, containerWidth]);

  // 数据为空时的占位
  if (!data || data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800/50 rounded-lg text-gray-500 text-sm ${className}`}
        style={{ width: width ?? '100%', height }}
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
}

export default KLineChartWrapper;