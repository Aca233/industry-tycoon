/**
 * 格式化金额，使用万/亿为单位
 * @param amount 金额（单位：元）
 * @returns 格式化后的字符串
 */
export function formatMoney(amount: number | undefined | null): string {
  // Handle undefined, null, or NaN values
  if (amount === undefined || amount === null || !Number.isFinite(amount)) {
    return '¥0';
  }
  
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  
  if (absAmount >= 100000000) {
    // 1亿及以上
    const yi = absAmount / 100000000;
    return `${sign}¥${yi.toFixed(yi >= 10 ? 1 : 2)}亿`;
  } else if (absAmount >= 10000) {
    // 1万及以上
    const wan = absAmount / 10000;
    return `${sign}¥${wan.toFixed(wan >= 100 ? 0 : wan >= 10 ? 1 : 2)}万`;
  } else if (absAmount >= 1) {
    // 1元以上，显示整数
    return `${sign}¥${Math.round(absAmount)}`;
  } else if (absAmount > 0) {
    // 小于1元，保留2位小数
    return `${sign}¥${absAmount.toFixed(2)}`;
  }
  return '¥0';
}

/**
 * 格式化金额（简短版本，用于空间受限的地方）
 * @param amount 金额（单位：元）
 * @returns 格式化后的字符串
 */
export function formatMoneyShort(amount: number | undefined | null): string {
  // Handle undefined, null, or NaN values
  if (amount === undefined || amount === null || !Number.isFinite(amount)) {
    return '¥0';
  }
  
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  
  if (absAmount >= 100000000) {
    // 1亿及以上
    return `${sign}¥${(absAmount / 100000000).toFixed(1)}亿`;
  } else if (absAmount >= 10000) {
    // 1万及以上
    return `${sign}¥${(absAmount / 10000).toFixed(0)}万`;
  } else if (absAmount >= 1) {
    return `${sign}¥${Math.round(absAmount)}`;
  }
  return '¥0';
}

/**
 * 游戏时间格式化配置
 * 统一时间体系：1 tick = 1小时
 *
 * 时间换算：
 * - 1天 = 24 ticks
 * - 1周 = 168 ticks
 * - 1月 = 720 ticks (30天)
 * - 1年 = 8760 ticks
 */
export const TICKS_PER_HOUR = 1;   // 1 tick = 1小时
export const TICKS_PER_DAY = 24;   // 1天 = 24 ticks
export const TICKS_PER_WEEK = 168; // 1周 = 168 ticks
export const TICKS_PER_MONTH = 720; // 1月 = 720 ticks

/**
 * 游戏时间格式类型
 */
export type GameTimeFormat = 'full' | 'compact' | 'short' | 'chart';

/**
 * 格式化游戏时间
 * @param tick 当前tick值（1 tick = 1小时）
 * @param format 格式类型：
 *   - 'full': 第 X 天 HH时（状态栏用）
 *   - 'compact': D{day} HH时（图表X轴用）
 *   - 'short': HH时（空间受限用）
 *   - 'chart': 根据数据密度自动选择最佳格式
 * @param dataLength 数据点数量（用于chart模式的智能格式选择）
 * @returns 格式化后的时间字符串
 */
export function formatGameTime(
  tick: number,
  format: GameTimeFormat = 'full',
  dataLength?: number
): string {
  const day = Math.floor(tick / TICKS_PER_DAY) + 1;
  const hour = tick % TICKS_PER_DAY;
  
  const hourStr = hour.toString().padStart(2, '0');
  
  switch (format) {
    case 'full':
      return `第 ${day} 天 ${hourStr}时`;
    
    case 'compact':
      return `D${day} ${hourStr}h`;
    
    case 'short':
      return `${hourStr}h`;
    
    case 'chart':
      // 根据数据密度选择最佳格式
      if (dataLength && dataLength > 168) {
        // 数据量大（>7天），只在0时显示日期，其他显示小时
        if (hour === 0) {
          return `D${day}`;
        }
        // 每6小时显示一个刻度
        if (hour % 6 === 0) {
          return `${hourStr}h`;
        }
        return '';
      } else if (dataLength && dataLength > 48) {
        // 中等数据量（2-7天）：显示日期+小时
        if (hour === 0 || hour === 12) {
          return `D${day} ${hourStr}h`;
        }
        return `${hourStr}h`;
      } else {
        // 少量数据（<2天）：紧凑格式
        return `D${day} ${hourStr}h`;
      }
    
    default:
      return `第 ${day} 天 ${hourStr}时`;
  }
}

/**
 * 获取游戏日期的各个部分
 * @param tick 当前tick值（1 tick = 1小时）
 * @returns 包含day, hour的对象（无分钟概念）
 */
export function getGameTimeParts(tick: number): {
  day: number;
  hour: number;
} {
  return {
    day: Math.floor(tick / TICKS_PER_DAY) + 1,
    hour: tick % TICKS_PER_DAY,
  };
}
