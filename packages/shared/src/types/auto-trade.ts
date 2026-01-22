/**
 * 自动交易系统类型定义
 * Auto Trade System Types
 */

/** 单个商品的自动采购配置 */
export interface AutoBuyConfig {
  /** 是否启用自动采购 */
  enabled: boolean;
  /** 当库存低于此值时触发采购 */
  triggerThreshold: number;
  /** 每次采购的目标库存量 */
  targetStock: number;
  /** 最高接受价格倍数（相对市场价） */
  maxPriceMultiplier: number;
}

/** 单个商品的自动销售配置 */
export interface AutoSellConfig {
  /** 是否启用自动销售 */
  enabled: boolean;
  /** 当库存超过此值时触发销售 */
  triggerThreshold: number;
  /** 销售后保留的库存量 */
  reserveStock: number;
  /** 最低接受价格倍数（相对市场价） */
  minPriceMultiplier: number;
}

/** 单个商品的完整自动交易配置 */
export interface GoodsAutoTradeConfig {
  goodsId: string;
  autoBuy: AutoBuyConfig;
  autoSell: AutoSellConfig;
}

/** 全局自动交易配置 */
export interface AutoTradeConfig {
  /** 全局开关 */
  enabled: boolean;
  
  /** 每种商品的配置 */
  goodsConfigs: Record<string, GoodsAutoTradeConfig>;
  
  /** 自动根据建筑需求生成配置 */
  autoConfigureFromBuildings: boolean;
  
  /** 最大同时活跃订单数 */
  maxActiveOrders: number;
  
  /** 订单刷新间隔（ticks） */
  orderRefreshInterval: number;
}

/** 自动交易订单记录 */
export interface AutoTradeOrder {
  orderId: string;
  goodsId: string;
  orderType: 'buy' | 'sell';
  quantity: number;
  price: number;
  createdTick: number;
  /** 用于判断是否需要刷新 */
  originalMarketPrice: number;
}

/** 自动交易执行动作 */
export interface AutoTradeAction {
  type: 'buy' | 'sell';
  goodsId: string;
  quantity: number;
  price: number;
  success: boolean;
  message?: string;
}

/** 自动交易处理结果 */
export interface AutoTradeResult {
  actions: AutoTradeAction[];
  cancelledOrders: string[];
}

/** 自动交易状态摘要 */
export interface AutoTradeStatus {
  enabled: boolean;
  goodsConfigs: GoodsAutoTradeConfig[];
  activeOrders: {
    buyOrders: number;
    sellOrders: number;
    totalValue: number;
  };
  lastActions: AutoTradeAction[];
  lastProcessedTick: number;
}

/** 默认自动采购配置 */
export const DEFAULT_AUTO_BUY_CONFIG: AutoBuyConfig = {
  enabled: false,
  triggerThreshold: 100,
  targetStock: 500,
  maxPriceMultiplier: 1.1,
};

/** 默认自动销售配置 */
export const DEFAULT_AUTO_SELL_CONFIG: AutoSellConfig = {
  enabled: false,
  triggerThreshold: 1000,
  reserveStock: 100,
  minPriceMultiplier: 0.9,
};

/** 默认全局自动交易配置 */
export const DEFAULT_AUTO_TRADE_CONFIG: AutoTradeConfig = {
  enabled: false,
  goodsConfigs: {},
  autoConfigureFromBuildings: true,
  maxActiveOrders: 50,
  orderRefreshInterval: 10,
};

/** 创建默认商品配置 */
export function createDefaultGoodsConfig(goodsId: string): GoodsAutoTradeConfig {
  return {
    goodsId,
    autoBuy: { ...DEFAULT_AUTO_BUY_CONFIG },
    autoSell: { ...DEFAULT_AUTO_SELL_CONFIG },
  };
}

// WebSocket 消息类型
export type AutoTradeClientMessage =
  | { type: 'auto_trade_toggle'; enabled: boolean }
  | { type: 'auto_trade_config_update'; goodsId: string; config: Partial<GoodsAutoTradeConfig> }
  | { type: 'auto_trade_auto_configure' }
  | { type: 'auto_trade_get_status' };

export type AutoTradeServerMessage =
  | { type: 'auto_trade_status'; status: AutoTradeStatus }
  | { type: 'auto_trade_action'; action: AutoTradeAction }
  | { type: 'auto_trade_error'; error: string };