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
 * 统一时间体系：1 tick = 1天
 *
 * 时间换算：
 * - 1天 = 1 tick
 * - 1周 = 7 ticks
 * - 1月 = 30 ticks
 * - 1年 = 365 ticks
 */
export const TICKS_PER_DAY = 1;    // 1天 = 1 tick
export const TICKS_PER_WEEK = 7;   // 1周 = 7 ticks
export const TICKS_PER_MONTH = 30; // 1月 = 30 ticks
export const TICKS_PER_YEAR = 365; // 1年 = 365 ticks

/**
 * 游戏时间格式类型
 */
export type GameTimeFormat = 'full' | 'compact' | 'short' | 'chart';

/**
 * 格式化游戏时间
 * @param tick 当前tick值（1 tick = 1天）
 * @param format 格式类型：
 *   - 'full': 第 X 天（状态栏用）
 *   - 'compact': D{day}（图表X轴用）
 *   - 'short': D{day}（空间受限用）
 *   - 'chart': 根据数据密度自动选择最佳格式
 * @param dataLength 数据点数量（用于chart模式的智能格式选择）
 * @returns 格式化后的时间字符串
 */
export function formatGameTime(
  tick: number,
  format: GameTimeFormat = 'full',
  dataLength?: number
): string {
  const day = tick + 1; // tick 0 = 第1天
  const week = Math.floor(tick / TICKS_PER_WEEK) + 1;
  const month = Math.floor(tick / TICKS_PER_MONTH) + 1;
  const year = Math.floor(tick / TICKS_PER_YEAR) + 1;
  
  switch (format) {
    case 'full':
      if (tick >= TICKS_PER_YEAR) {
        return `第 ${year} 年 第 ${day % TICKS_PER_YEAR || TICKS_PER_YEAR} 天`;
      }
      return `第 ${day} 天`;
    
    case 'compact':
      if (tick >= TICKS_PER_MONTH) {
        return `M${month}D${(tick % TICKS_PER_MONTH) + 1}`;
      }
      return `D${day}`;
    
    case 'short':
      return `D${day}`;
    
    case 'chart':
      // 根据数据密度选择最佳格式
      if (dataLength && dataLength > 365) {
        // 数据量大（>1年），显示月份
        if (tick % TICKS_PER_MONTH === 0) {
          return `M${month}`;
        }
        // 每周显示一个刻度
        if (tick % TICKS_PER_WEEK === 0) {
          return `W${week}`;
        }
        return '';
      } else if (dataLength && dataLength > 30) {
        // 中等数据量（1-12月）：显示周或月
        if (tick % TICKS_PER_WEEK === 0) {
          return `W${week}`;
        }
        return `D${day}`;
      } else {
        // 少量数据（<1月）：显示天
        return `D${day}`;
      }
    
    default:
      return `第 ${day} 天`;
  }
}

/**
 * 获取游戏日期的各个部分
 * @param tick 当前tick值（1 tick = 1天）
 * @returns 包含day, week, month, year的对象
 */
export function getGameTimeParts(tick: number): {
  day: number;
  week: number;
  month: number;
  year: number;
  dayOfWeek: number;
  dayOfMonth: number;
} {
  return {
    day: tick + 1,
    week: Math.floor(tick / TICKS_PER_WEEK) + 1,
    month: Math.floor(tick / TICKS_PER_MONTH) + 1,
    year: Math.floor(tick / TICKS_PER_YEAR) + 1,
    dayOfWeek: (tick % TICKS_PER_WEEK) + 1,
    dayOfMonth: (tick % TICKS_PER_MONTH) + 1,
  };
}

/**
 * 格式化持续时间（tick数转为可读时间）
 * @param ticks tick数量
 * @returns 格式化后的持续时间字符串
 */
export function formatDuration(ticks: number): string {
  if (ticks >= TICKS_PER_YEAR) {
    const years = Math.floor(ticks / TICKS_PER_YEAR);
    const remainingDays = ticks % TICKS_PER_YEAR;
    if (remainingDays > 0) {
      return `${years}年${remainingDays}天`;
    }
    return `${years}年`;
  } else if (ticks >= TICKS_PER_MONTH) {
    const months = Math.floor(ticks / TICKS_PER_MONTH);
    const remainingDays = ticks % TICKS_PER_MONTH;
    if (remainingDays > 0) {
      return `${months}月${remainingDays}天`;
    }
    return `${months}月`;
  } else if (ticks >= TICKS_PER_WEEK) {
    const weeks = Math.floor(ticks / TICKS_PER_WEEK);
    const remainingDays = ticks % TICKS_PER_WEEK;
    if (remainingDays > 0) {
      return `${weeks}周${remainingDays}天`;
    }
    return `${weeks}周`;
  } else {
    return `${ticks}天`;
  }
}
