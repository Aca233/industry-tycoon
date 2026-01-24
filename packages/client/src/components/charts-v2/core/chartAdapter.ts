/**
 * 图表数据适配器
 * 将 gameStore 数据格式转换为 KLineChart 格式
 */

import type { KLineData } from 'klinecharts';
import type { PriceHistoryEntry, ChartMode } from './types';

/** 股票价格历史数据类型（来自 @scc/shared） */
export interface StockPriceHistoryEntry {
  tick: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
}

// 游戏开始日期（作为时间基准）
const GAME_START_DATE = new Date('2025-01-01').getTime();

/**
 * 将游戏价格历史数据转换为 KLineChart 格式
 * 每个 tick 对应一个数据点，不做时间聚合
 * 价格单位：分 -> 元（除以 100）
 */
export function convertToKLineData(
  history: PriceHistoryEntry[],
  _mode: ChartMode
): KLineData[] {
  if (!history || history.length === 0) return [];

  // 每个 tick 都是一个独立数据点
  // 价格从分转换为元
  // timestamp 使用真实日期（游戏开始日期 + tick天数）
  return history.map((h) => ({
    timestamp: GAME_START_DATE + h.tick * 86400000, // 游戏开始日期 + tick天
    open: h.price / 100,     // 分 -> 元
    high: h.price / 100,     // 分 -> 元
    low: h.price / 100,      // 分 -> 元
    close: h.price / 100,    // 分 -> 元
    volume: (h.buyVolume || 0) + (h.sellVolume || 0) + (h.volume || 0),
    turnover: 0,
  }));
}

/**
 * 将股票价格历史数据转换为 KLineChart 格式
 * 股票数据已有完整的 OHLC 数据
 */
export function convertStockToKLineData(
  history: StockPriceHistoryEntry[]
): KLineData[] {
  if (!history || history.length === 0) return [];

  return history.map((h) => ({
    timestamp: GAME_START_DATE + h.tick * 86400000, // 游戏开始日期 + tick天
    open: h.open,
    high: h.high,
    low: h.low,
    close: h.close,
    volume: h.volume,
    turnover: h.turnover || 0,
  }));
}

/**
 * 格式化时间标签
 * 使用标准日期格式 MM-DD 或 YYYY-MM-DD
 */
export function formatTickLabel(timestamp: number, _dataRange?: number): string {
  const date = new Date(timestamp);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // 计算数据跨度（从游戏开始到当前时间的天数）
  const daysSinceStart = Math.floor((timestamp - GAME_START_DATE) / 86400000);
  
  // 根据跨度选择格式
  if (daysSinceStart < 90) {
    // 3个月内显示 MM-DD
    return `${month}-${day}`;
  } else {
    // 超过3个月显示 YYYY-MM
    const year = date.getFullYear();
    return `${year}-${month}`;
  }
}

/**
 * 格式化价格（元）
 * 注意：convertToKLineData 已将分转为元，所以这里直接处理元
 */
export function formatPrice(yuan: number): string {
  if (!Number.isFinite(yuan)) return '¥0';
  if (Math.abs(yuan) >= 1000000) {
    return `¥${(yuan / 1000000).toFixed(2)}M`;
  } else if (Math.abs(yuan) >= 10000) {
    return `¥${(yuan / 10000).toFixed(1)}万`;
  } else if (Math.abs(yuan) >= 1000) {
    return `¥${yuan.toFixed(0)}`;
  }
  return `¥${yuan.toFixed(2)}`;
}