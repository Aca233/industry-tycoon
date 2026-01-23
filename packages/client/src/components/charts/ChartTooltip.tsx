/**
 * 图表悬浮提示组件
 */

import React from 'react';
import type { TooltipData, ChartColors } from './types';
import { formatGameTime } from '../../utils/formatters';

interface ChartTooltipProps {
  data: TooltipData;
  colors: ChartColors['tooltip'];
  formatPrice?: (value: number) => string;
  showVolume?: boolean;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  data,
  colors,
  formatPrice = (v) => `¥${v.toFixed(2)}`,
  showVolume = true,
}) => {
  if (!data.visible || !data.data) return null;

  const { tick, price, open, high, low, close, volume, change, changePercent } = data.data;
  const isUp = (close ?? price ?? 0) >= (open ?? price ?? 0);

  // 计算提示框位置（避免超出边界）
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: data.x + 15,
    top: data.y - 10,
    backgroundColor: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    padding: '8px 12px',
    color: colors.text,
    fontSize: '11px',
    zIndex: 100,
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    minWidth: '140px',
  };

  return (
    <div style={tooltipStyle}>
      {/* 时间 */}
      <div className="text-xs text-gray-400 mb-1.5 pb-1 border-b border-slate-600">
        {formatGameTime(tick, 'full')}
      </div>

      {/* K线数据 */}
      {open !== undefined && close !== undefined ? (
        <div className="space-y-0.5">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">开盘</span>
            <span>{formatPrice(open)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">最高</span>
            <span className="text-green-400">{formatPrice(high ?? open)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">最低</span>
            <span className="text-red-400">{formatPrice(low ?? open)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">收盘</span>
            <span className={isUp ? 'text-green-400' : 'text-red-400'}>
              {formatPrice(close)}
            </span>
          </div>
        </div>
      ) : price !== undefined ? (
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">价格</span>
          <span>{formatPrice(price)}</span>
        </div>
      ) : null}

      {/* 涨跌 */}
      {change !== undefined && changePercent !== undefined && (
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-600">
          <span className="text-gray-500">涨跌</span>
          <span className={change >= 0 ? 'text-green-400' : 'text-red-400'}>
            {change >= 0 ? '+' : ''}{formatPrice(change)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
          </span>
        </div>
      )}

      {/* 成交量 */}
      {showVolume && volume !== undefined && volume > 0 && (
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-600">
          <span className="text-gray-500">成交量</span>
          <span>{volume.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
};

/**
 * 价格标签组件（显示在Y轴旁边）
 */
interface PriceLabelProps {
  price: number;
  y: number;
  x: number;
  isUp: boolean;
  formatPrice?: (value: number) => string;
}

export const PriceLabel: React.FC<PriceLabelProps> = ({
  price,
  y,
  x,
  isUp,
  formatPrice = (v) => `¥${v.toFixed(2)}`,
}) => {
  const color = isUp ? '#22c55e' : '#ef4444';

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y - 10,
        backgroundColor: color,
        color: 'white',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: 'bold',
        pointerEvents: 'none',
      }}
    >
      {formatPrice(price)}
    </div>
  );
};

/**
 * 时间标签组件（显示在X轴旁边）
 */
interface TimeLabelProps {
  tick: number;
  x: number;
  y: number;
}

export const TimeLabel: React.FC<TimeLabelProps> = ({ tick, x, y }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translateX(-50%)',
        backgroundColor: '#334155',
        color: '#e2e8f0',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '9px',
        pointerEvents: 'none',
      }}
    >
      {formatGameTime(tick, 'compact')}
    </div>
  );
};