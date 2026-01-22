/**
 * Game constants and configuration values
 */

/** Time and tick settings */
export const TIME_CONSTANTS = {
  /** Ticks per in-game day */
  TICKS_PER_DAY: 24,
  /** Ticks per in-game week */
  TICKS_PER_WEEK: 168,
  /** Ticks per in-game month (30 days) */
  TICKS_PER_MONTH: 720,
  /** Ticks per in-game year */
  TICKS_PER_YEAR: 8760,
  /** Default real-time milliseconds per tick at normal speed */
  MS_PER_TICK_NORMAL: 1000,
} as const;

/** Economic constants */
export const ECONOMY_CONSTANTS = {
  /** Starting cash for player in easy mode (cents) */
  STARTING_CASH_EASY: 10_000_000_00, // $10M
  /** Starting cash for player in normal mode */
  STARTING_CASH_NORMAL: 5_000_000_00, // $5M
  /** Starting cash for player in hard mode */
  STARTING_CASH_HARD: 1_000_000_00, // $1M
  
  /** Base interest rate (annual) */
  BASE_INTEREST_RATE: 0.05,
  /** Base tax rate */
  BASE_TAX_RATE: 0.25,
  /** Base inflation rate per year */
  BASE_INFLATION_RATE: 0.02,
  
  /** Minimum price multiplier (relative to base) */
  MIN_PRICE_MULTIPLIER: 0.1,
  /** Maximum price multiplier */
  MAX_PRICE_MULTIPLIER: 10.0,
  
  /** Price elasticity default */
  DEFAULT_ELASTICITY: -0.5,
} as const;

/** Production constants */
export const PRODUCTION_CONSTANTS = {
  /** Base production efficiency */
  BASE_EFFICIENCY: 1.0,
  /** Minimum efficiency (due to issues) */
  MIN_EFFICIENCY: 0.1,
  /** Maximum efficiency (with bonuses) */
  MAX_EFFICIENCY: 2.0,
  
  /** Worker satisfaction impact on efficiency */
  SATISFACTION_EFFICIENCY_WEIGHT: 0.3,
  
  /** Energy cost per production unit (base) */
  BASE_ENERGY_COST: 10,
  
  /** Maintenance cost as % of building value per year */
  MAINTENANCE_RATE: 0.05,
} as const;

/** Market constants */
export const MARKET_CONSTANTS = {
  /** Maximum listings per company */
  MAX_LISTINGS_PER_COMPANY: 100,
  /** Listing expiry in ticks */
  DEFAULT_LISTING_EXPIRY_TICKS: 720, // 1 month
  
  /** Price history retention (ticks) */
  PRICE_HISTORY_RETENTION: 8760, // 1 year
  
  /** Trend minimum duration (ticks) */
  TREND_MIN_DURATION: 168, // 1 week
  /** Trend maximum duration */
  TREND_MAX_DURATION: 2160, // 3 months
  
  /** Supply/demand imbalance threshold for price movement */
  IMBALANCE_THRESHOLD: 0.05, // 5%失衡就触发价格调整
  /** Price adjustment speed per tick */
  PRICE_ADJUSTMENT_RATE: 0.01, // 1%调整速率，增加市场活力
  /** Supply/demand decay rate per tick (slower = more stable market) */
  SUPPLY_DEMAND_DECAY: 0.99, // 1%衰减，让供需数据有效积累
  /** Base demand fluctuation amplitude (±30%) */
  DEMAND_FLUCTUATION_AMPLITUDE: 0.3,
  /** Demand fluctuation cycle length in ticks (约1个月) */
  DEMAND_FLUCTUATION_CYCLE: 720,
} as const;

/** AI constants */
export const AI_CONSTANTS = {
  /** AI decision interval (ticks) */
  AI_DECISION_INTERVAL: 24, // Daily
  /** Memory retention (number of interactions) */
  AI_MEMORY_SIZE: 100,
  
  /** Trust change per positive interaction */
  TRUST_GAIN_POSITIVE: 5,
  /** Trust change per negative interaction */
  TRUST_LOSS_NEGATIVE: -10,
  
  /** Negotiation patience (max rounds) */
  MAX_NEGOTIATION_ROUNDS: 10,
} as const;

/** LLM constants */
export const LLM_CONSTANTS = {
  /** Maximum tokens for event generation */
  EVENT_MAX_TOKENS: 500,
  /** Maximum tokens for negotiation response */
  NEGOTIATION_MAX_TOKENS: 300,
  /** Maximum tokens for research evaluation */
  RESEARCH_MAX_TOKENS: 800,
  
  /** Temperature for creative content */
  CREATIVE_TEMPERATURE: 0.8,
  /** Temperature for analytical content */
  ANALYTICAL_TEMPERATURE: 0.3,
  
  /** Cache TTL for similar prompts (ms) */
  CACHE_TTL_MS: 60000,
  
  /** Rate limit: requests per minute */
  RATE_LIMIT_RPM: 20,
} as const;

/** UI constants */
export const UI_CONSTANTS = {
  /** Map default zoom level */
  MAP_DEFAULT_ZOOM: 1.0,
  /** Map min zoom */
  MAP_MIN_ZOOM: 0.5,
  /** Map max zoom */
  MAP_MAX_ZOOM: 3.0,
  
  /** Node base radius (pixels) */
  NODE_BASE_RADIUS: 20,
  /** Node max radius */
  NODE_MAX_RADIUS: 60,
  
  /** Animation duration (ms) */
  ANIMATION_DURATION: 300,
  
  /** News ticker speed (chars per second) */
  NEWS_TICKER_SPEED: 50,
  
  /** Market galaxy force strength */
  MARKET_GALAXY_FORCE: -100,
  /** Market galaxy link distance */
  MARKET_GALAXY_LINK_DISTANCE: 100,
} as const;

/** Game balance multipliers */
export const BALANCE_MULTIPLIERS = {
  difficulty: {
    sandbox: { income: 2.0, costs: 0.5, aiAggression: 0.3 },
    easy: { income: 1.5, costs: 0.75, aiAggression: 0.5 },
    normal: { income: 1.0, costs: 1.0, aiAggression: 1.0 },
    hard: { income: 0.75, costs: 1.25, aiAggression: 1.5 },
    brutal: { income: 0.5, costs: 1.5, aiAggression: 2.0 },
  },
} as const;