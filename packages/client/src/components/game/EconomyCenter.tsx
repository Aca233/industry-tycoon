/**
 * EconomyCenter - 经济管理中心（主面板模式）
 * 三栏布局：左侧商品分类树 | 中间商品详情 | 右侧交易操作
 *
 * 性能优化：
 * - React.memo 包装子组件，避免不必要的重渲染
 * - useMemo 缓存计算结果
 * - useCallback 缓存事件处理函数
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useGameStore, useInventory, useMarketPrices, usePriceHistory, useEconomySelectedGoodsId, type InventoryStockItem } from '../../stores';
import { PriceChartWrapperCanvas } from './PriceChartCanvas';
import { gameWebSocket } from '../../services/websocket';
import {
  GOODS_DATA,
  GOODS_BY_CATEGORY,
  getBuildingsProducingGoods,
  getBuildingsConsumingGoods,
  getBuildingsProducingGoodsFromData,
  getBuildingsConsumingGoodsFromData,
  getCompanyInfo,
  isAICompetitor,
  isPOPConsumer,
  type BuildingGoodsRelation,
  type EntityId
} from '@scc/shared';
import type { BuildingInstance } from '@scc/shared';

// ============ 类型定义 ============
interface MarketOrder {
  id: string;
  companyId: string;
  goodsId: string;
  orderType: 'buy' | 'sell';
  pricePerUnit: number;  // 服务端返回的字段名
  quantity: number;
  remainingQuantity: number;
  status: string;
  createdTick: number;
}

interface CompanyShare {
  companyId: string;
  quantity: number;
  turnover: number;
  quantityShare: number;
  turnoverShare: number;
}

interface MarketShareData {
  goodsId: string;
  periodTicks: number;
  totalQuantity: number;
  totalTurnover: number;
  tradeCount: number;
  shares: CompanyShare[];
}

interface TradeRecord {
  id: string;
  buyerId: string;
  sellerId: string;
  goodsId: string;
  quantity: number;
  pricePerUnit: number;  // 修正字段名称，匹配服务端
  totalValue: number;
  tick: number;
}

interface MarketDepthLevel {
  price: number;
  quantity: number;
  orderCount: number;
  hasPlayerOrder?: boolean;  // 是否包含玩家的订单
  companies?: Array<{
    companyId: string;
    quantity: number;
  }>;
}

interface MarketDepth {
  bids: MarketDepthLevel[];
  asks: MarketDepthLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
}

// 使用 GoodsData 类型
type GoodsInfo = {
  id: string;
  name: string;
  nameZh: string;
  category: string;
  subcategory: string;
  basePrice: number;
  icon: string;
  tags: string[];
  description: string;
};

// ============ 常量 ============
const categoryNames: Record<string, string> = {
  raw_material: '原材料',
  basic_processed: '基础加工',
  intermediate: '中间产品',
  consumer_good: '消费品',
  service: '服务',
};

const categoryIcons: Record<string, string> = {
  raw_material: '🪨',
  basic_processed: '🔩',
  intermediate: '⚙️',
  consumer_good: '📦',
  service: '⚡',
};

// ============ 骨架屏组件（使用 memo 优化） ============
const Skeleton = memo(function Skeleton({ className = '', animate = true }: { className?: string; animate?: boolean }) {
  return (
    <div
      className={`bg-slate-700/50 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
    />
  );
});

// ============ 订单簿骨架屏（使用 memo 优化） ============
const OrderBookSkeleton = memo(function OrderBookSkeleton() {
  return (
    <div className="space-y-1">
      {/* 卖单区域骨架 */}
      <div className="bg-red-900/15 rounded p-1.5 border border-red-800/20">
        <div className="flex items-center justify-between text-[10px] text-red-400 mb-1">
          <span>🔴 卖方报价</span>
          <Skeleton className="w-8 h-3" />
        </div>
        <div className="space-y-0.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-4 gap-1 px-1 py-0.5">
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
            </div>
          ))}
        </div>
      </div>
      
      {/* 价差骨架 */}
      <div className="flex items-center justify-center gap-1 py-0.5">
        <Skeleton className="w-16 h-3" />
      </div>
      
      {/* 买单区域骨架 */}
      <div className="bg-green-900/15 rounded p-1.5 border border-green-800/20">
        <div className="flex items-center justify-between text-[10px] text-green-400 mb-1">
          <span>🟢 买方报价</span>
          <Skeleton className="w-8 h-3" />
        </div>
        <div className="space-y-0.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-4 gap-1 px-1 py-0.5">
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ============ 建筑关联区域组件（使用 memo 优化） ============
interface BuildingRelationSectionProps {
  title: string;
  subtitle: string;
  relations: BuildingGoodsRelation[];
  isProducer: boolean;
  onBuild: (buildingId: string) => void;
  formatMoney: (cents: number | undefined | null) => string;
  playerBuildings: Map<EntityId, BuildingInstance>;
}

const BuildingRelationSection = memo(function BuildingRelationSection({
  title,
  subtitle,
  relations,
  isProducer,
  onBuild,
  formatMoney,
  playerBuildings,
}: BuildingRelationSectionProps) {
  if (relations.length === 0) {
    return null;
  }

  // 去重（同一建筑可能多个方法都产出/消耗）并统计玩家拥有数量
  const uniqueBuildings = new Map<string, BuildingGoodsRelation & { ownedCount: number }>();
  for (const rel of relations) {
    if (!uniqueBuildings.has(rel.buildingId)) {
      // 统计玩家拥有该类型建筑的数量
      let ownedCount = 0;
      for (const building of playerBuildings.values()) {
        if (building.definitionId === rel.buildingId) {
          ownedCount++;
        }
      }
      uniqueBuildings.set(rel.buildingId, { ...rel, ownedCount });
    }
  }

  return (
    <div>
      <div className="text-sm font-medium text-gray-400 mb-1">{title}</div>
      <div className="text-xs text-gray-500 mb-2">{subtitle}</div>
      <div className="space-y-2">
        {Array.from(uniqueBuildings.values()).map((rel) => (
          <div
            key={rel.buildingId}
            className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{rel.buildingIcon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{rel.buildingName}</span>
                  {rel.ownedCount > 0 && (
                    <span className="text-xs bg-cyan-600/30 text-cyan-400 px-1.5 py-0.5 rounded-full">
                      已有 {rel.ownedCount} 座
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {isProducer ? (
                    <span className="text-green-400">产出 {rel.amount}/周期</span>
                  ) : (
                    <span className="text-orange-400">消耗 {rel.amount}/周期</span>
                  )}
                  <span className="mx-1">·</span>
                  <span>{rel.methodName}</span>
                </div>
                <div className="text-xs text-gray-500">
                  建造成本: {formatMoney(rel.buildingCost)}
                </div>
              </div>
            </div>
            <button
              onClick={() => onBuild(rel.buildingId)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded transition-colors"
            >
              建造
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

// ============ 主组件 ============
export function EconomyCenter() {
  const gameId = useGameStore((state) => state.gameId);
  const inventory = useInventory();
  const marketPrices = useMarketPrices();
  const priceHistory = usePriceHistory();
  const externalSelectedGoodsId = useEconomySelectedGoodsId();
  const setEconomySelectedGoodsId = useGameStore((state) => state.setEconomySelectedGoodsId);
  const playerBuildings = useGameStore((state) => state.buildings);
  const playerCompanyId = useGameStore((state) => state.playerCompanyId);
  
  // 状态
  const [selectedGoodsId, setSelectedGoodsId] = useState<string>('steel');
  
  // 当从其他面板跳转过来时，自动选中对应商品
  useEffect(() => {
    if (externalSelectedGoodsId) {
      setSelectedGoodsId(externalSelectedGoodsId);
      // 清除外部选中状态，避免重复触发
      setEconomySelectedGoodsId(null);
    }
  }, [externalSelectedGoodsId, setEconomySelectedGoodsId]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['raw_material', 'basic_processed', 'intermediate', 'consumer_good'])
  );
  const [searchTerm, setSearchTerm] = useState('');
  
  // 市场数据
  const [depth, setDepth] = useState<MarketDepth | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [playerOrders, setPlayerOrders] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);  // 仅用于首次加载
  const [hasLoaded, setHasLoaded] = useState(false);  // 标记是否已完成首次加载
  const [marketShare, setMarketShare] = useState<MarketShareData | null>(null);  // 市场占比数据
  const [_playerShare, setPlayerShare] = useState<CompanyShare | null>(null);  // 玩家占比（暂未使用）
  
  // 下单表单
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderQuantity, setOrderQuantity] = useState(10);
  const [orderPrice, setOrderPrice] = useState(1000);
  const [orderError, setOrderError] = useState<string | null>(null);

  // ============ 辅助函数 ============
  const formatMoney = (cents: number | undefined | null) => {
    if (cents === undefined || cents === null || !Number.isFinite(cents)) {
      return '¥0';
    }
    const value = cents / 100;
    if (Math.abs(value) >= 10000) {
      return `¥${(value / 10000).toFixed(2)}万`;
    } else if (Math.abs(value) >= 1000) {
      return `¥${value.toFixed(0)}`;
    }
    return `¥${value.toFixed(2)}`;
  };

  const getGoodsInfo = useCallback((goodsId: string): GoodsInfo | null => {
    const goods = GOODS_DATA.find(g => g.id === goodsId);
    return goods || null;
  }, []);

  const getInventoryStock = useCallback((goodsId: string): InventoryStockItem | undefined => {
    return inventory?.stocks.find(s => s.goodsId === goodsId);
  }, [inventory]);

  // 商品分组
  const goodsByCategory = useMemo(() => {
    const categories = ['raw_material', 'basic_processed', 'intermediate', 'consumer_good', 'service'];
    const result: Record<string, GoodsInfo[]> = {};
    
    for (const cat of categories) {
      const goods = GOODS_BY_CATEGORY[cat as keyof typeof GOODS_BY_CATEGORY] || [];
      result[cat] = goods.filter(g => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return g.nameZh.toLowerCase().includes(term) || 
               g.name.toLowerCase().includes(term) ||
               g.id.toLowerCase().includes(term);
      });
    }
    
    return result;
  }, [searchTerm]);

  // ============ API 调用 ============
  const fetchMarketData = useCallback(async (isInitial: boolean = false) => {
    if (!gameId || !selectedGoodsId) {
      setLoading(false);
      return;
    }
    
    // 只在首次加载时显示"加载中..."，后续刷新静默进行
    if (isInitial && !hasLoaded) {
      setLoading(true);
    }
    
    try {
      const [depthRes, tradesRes, ordersRes, shareRes] = await Promise.all([
        fetch(`/api/v1/games/${gameId}/market/orderbook/${selectedGoodsId}`),
        fetch(`/api/v1/games/${gameId}/market/trades?goodsId=${selectedGoodsId}&limit=15`),
        fetch(`/api/v1/games/${gameId}/orders`),
        fetch(`/api/v1/games/${gameId}/market/share/${selectedGoodsId}`),
      ]);
      
      if (depthRes.ok) {
        const data = await depthRes.json();
        setDepth(data.depth);
      }
      
      if (tradesRes.ok) {
        const data = await tradesRes.json();
        setTrades(data.trades || []);
      }
      
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        // 显示所有商品的挂单，不再过滤当前选中商品
        setPlayerOrders(data.orders || []);
      }
      
      if (shareRes.ok) {
        const data = await shareRes.json();
        setMarketShare(data.marketShare || null);
        setPlayerShare(data.playerShare || null);
      }
      
      // 标记已完成首次加载
      if (!hasLoaded) {
        setHasLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch market data:', err);
    } finally {
      setLoading(false);
    }
  }, [gameId, selectedGoodsId, hasLoaded]);

  // 商品切换时重置加载状态
  useEffect(() => {
    setHasLoaded(false);
    setLoading(true);
  }, [selectedGoodsId]);
  
  // 游戏ID和商品变化时获取数据，定时刷新
  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }
    
    // 首次加载
    fetchMarketData(true);
    // 设置定时刷新（静默刷新，不显示加载状态）
    const interval = setInterval(() => fetchMarketData(false), 2000);
    return () => clearInterval(interval);
  }, [gameId, selectedGoodsId]); // 注意：不依赖 fetchMarketData 避免无限循环

  useEffect(() => {
    const price = marketPrices[selectedGoodsId];
    if (price) {
      setOrderPrice(price);
    } else {
      const goods = getGoodsInfo(selectedGoodsId);
      if (goods) {
        setOrderPrice(goods.basePrice);
      }
    }
  }, [selectedGoodsId, marketPrices, getGoodsInfo]);

  // ============ 事件处理 ============
  const handleSubmitOrder = async (customQuantity?: number, customPrice?: number, customType?: 'buy' | 'sell') => {
    if (!gameId) return;
    setOrderError(null);
    
    const type = customType ?? orderType;
    const qty = customQuantity ?? orderQuantity;
    const price = customPrice ?? orderPrice;
    
    try {
      const endpoint = type === 'buy' ? 'buy' : 'sell';
      const body = type === 'buy'
        ? { goodsId: selectedGoodsId, quantity: qty, maxPrice: price }
        : { goodsId: selectedGoodsId, quantity: qty, minPrice: price };
      
      const response = await fetch(`/api/v1/games/${gameId}/orders/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        fetchMarketData();
        if (!customQuantity) setOrderQuantity(10);
      } else {
        const data = await response.json();
        setOrderError(data.error || '下单失败');
      }
    } catch (err) {
      setOrderError('网络错误');
    }
  };
  
  // 接受卖家报价（立即买入）
  const handleAcceptAsk = (price: number, quantity: number) => {
    // 以该卖价下买单，数量为该档位可用数量
    handleSubmitOrder(quantity, price, 'buy');
  };
  
  // 接受买家报价（立即卖出）
  const handleAcceptBid = (price: number, quantity: number) => {
    // 以该买价下卖单，数量为该档位可用数量
    handleSubmitOrder(quantity, price, 'sell');
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!gameId) return;
    
    try {
      const response = await fetch(`/api/v1/games/${gameId}/orders/${orderId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        fetchMarketData();
      }
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
  };

  // 建造建筑 - 使用 WebSocket 发送，确保实时更新
  const handleBuildBuilding = (buildingId: string) => {
    if (!gameId) {
      alert('游戏未连接');
      return;
    }
    
    // 通过 WebSocket 购买建筑，这样会触发 buildingAdded 消息实时更新
    gameWebSocket.send('purchaseBuilding', { buildingId });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // ============ 计算派生数据 ============
  const selectedGoods = getGoodsInfo(selectedGoodsId);
  const selectedStock = getInventoryStock(selectedGoodsId);
  const selectedHistory = priceHistory.get(selectedGoodsId) ?? [];
  const currentPrice = marketPrices[selectedGoodsId] ?? selectedGoods?.basePrice ?? 0;
  const priceChange = selectedGoods ? ((currentPrice - selectedGoods.basePrice) / selectedGoods.basePrice * 100) : 0;

  // ============ 渲染 ============
  return (
    <div className="h-full flex bg-[#0d1117] overflow-hidden">
      {/* ========== 左栏：商品分类树 ========== */}
      <div className="w-56 border-r border-slate-700 flex flex-col bg-slate-800/30">
        {/* 搜索框 */}
        <div className="p-3 border-b border-slate-700">
          <input
            type="text"
            placeholder="🔍 搜索商品..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 focus:border-cyan-500 outline-none"
          />
        </div>
        
        {/* 分类列表 */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(goodsByCategory).map(([category, goods]) => (
            <div key={category}>
              {/* 分类标题 */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{categoryIcons[category]}</span>
                  <span className="text-sm font-medium text-gray-300">{categoryNames[category]}</span>
                  <span className="text-xs text-gray-500">({goods.length})</span>
                </div>
                <span className="text-gray-500 text-xs">
                  {expandedCategories.has(category) ? '▼' : '▶'}
                </span>
              </button>
              
              {/* 商品列表 */}
              {expandedCategories.has(category) && (
                <div className="py-1">
                  {goods.map(g => {
                    const stock = getInventoryStock(g.id);
                    const hasStock = stock && stock.quantity > 0;
                    const hasOrder = playerOrders.some(o => o.goodsId === g.id);
                    const isSelected = selectedGoodsId === g.id;
                    
                    return (
                      <button
                        key={g.id}
                        onClick={() => setSelectedGoodsId(g.id)}
                        className={`w-full flex items-center gap-2 px-4 py-1.5 text-left transition-colors ${
                          isSelected 
                            ? 'bg-cyan-600/30 border-l-2 border-cyan-500' 
                            : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                        }`}
                      >
                        <span className="text-sm">{g.icon}</span>
                        <span className={`text-sm flex-1 truncate ${isSelected ? 'text-cyan-400' : 'text-gray-300'}`}>
                          {g.nameZh}
                        </span>
                        <div className="flex gap-0.5">
                          {hasStock && <span className="w-2 h-2 rounded-full bg-green-400" title="有库存" />}
                          {hasOrder && <span className="w-2 h-2 rounded-full bg-blue-400" title="有挂单" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* 图例 */}
        <div className="p-3 border-t border-slate-700 text-xs text-gray-500">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span>有库存</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>有挂单</span>
          </div>
        </div>
      </div>

      {/* ========== 中栏：商品详情 ========== */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-700">
        {selectedGoods ? (
          <>
            {/* 商品头部 */}
            <div className="p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedGoods.icon}</span>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">{selectedGoods.nameZh}</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>{selectedGoods.name}</span>
                    <span>·</span>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">
                      {categoryNames[selectedGoods.category]}
                    </span>
                    <span>·</span>
                    <span>{selectedGoods.subcategory}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 价格信息 */}
            <div className="p-4 border-b border-slate-700">
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">市场价格</div>
                  <div className="text-xl font-bold text-cyan-400">{formatMoney(currentPrice)}</div>
                  <div className={`text-xs ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">基准价格</div>
                  <div className="text-xl font-bold text-orange-400">{formatMoney(selectedGoods.basePrice)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">我的库存</div>
                  <div className="text-xl font-bold text-white">
                    {selectedStock ? selectedStock.quantity.toFixed(0) : '0'}
                  </div>
                  <div className="text-xs text-gray-500">
                    价值 {selectedStock ? formatMoney(selectedStock.marketValue) : '¥0'}
                  </div>
                </div>
              </div>
              
              {/* 市场占比信息 - 排行榜 */}
              <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-3 border border-purple-600/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-purple-300 font-medium">📊 市场份额排行榜</div>
                  <div className="text-xs text-gray-500">近30天销售 · 总量 {marketShare ? marketShare.totalQuantity.toFixed(0) : '0'}</div>
                </div>
                {marketShare && marketShare.totalQuantity > 0 && marketShare.shares.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {marketShare.shares.slice(0, 10).map((share, index) => {
                      const isPlayer = share.companyId === playerCompanyId;
                      const rank = index + 1;
                      // 排名颜色
                      const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
                      const rankColor = rank <= 3 ? rankColors[rank - 1] : 'text-gray-500';
                      // 排名徽章
                      const rankBadges = ['🥇', '🥈', '🥉'];
                      const rankBadge = rank <= 3 ? rankBadges[rank - 1] : `#${rank}`;
                      
                      return (
                        <div
                          key={share.companyId}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                            isPlayer
                              ? 'bg-cyan-900/40 border border-cyan-500/50'
                              : 'bg-slate-800/40 hover:bg-slate-700/40'
                          }`}
                        >
                          {/* 排名 */}
                          <div className={`w-8 text-center font-bold ${rankColor}`}>
                            {rankBadge}
                          </div>
                          {/* 公司名称 */}
                          <div className="flex-1 min-w-0">
                            {(() => {
                              const companyInfo = getCompanyInfo(share.companyId);
                              const isAI = isAICompetitor(share.companyId);
                              const isPOP = isPOPConsumer(share.companyId);
                              return (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs">{companyInfo.icon}</span>
                                  <span
                                    className={`text-sm font-medium truncate ${isPlayer ? 'text-cyan-400' : 'text-gray-300'}`}
                                    style={{ color: companyInfo.color }}
                                  >
                                    {isPlayer ? '我的公司' : companyInfo.name}
                                  </span>
                                  {isPlayer && <span className="text-xs text-cyan-500">★</span>}
                                  {isAI && <span className="text-[10px] text-gray-500 bg-gray-700/50 px-1 rounded">AI</span>}
                                  {isPOP && <span className="text-[10px] text-orange-400 bg-orange-900/30 px-1 rounded">消费者</span>}
                                </div>
                              );
                            })()}
                          </div>
                          {/* 销量 */}
                          <div className="text-right">
                            <div className="text-sm font-mono text-white">{share.quantity.toFixed(0)}</div>
                            <div className="text-xs text-gray-500">件</div>
                          </div>
                          {/* 占比 - 带进度条 */}
                          <div className="w-20">
                            <div className="flex items-center justify-end gap-1">
                              <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    isPlayer ? 'bg-cyan-500' : rank === 1 ? 'bg-yellow-500' : 'bg-purple-500'
                                  }`}
                                  style={{ width: `${Math.min(share.quantityShare, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-mono ${isPlayer ? 'text-cyan-400' : 'text-purple-400'}`}>
                                {share.quantityShare.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {marketShare.shares.length > 10 && (
                      <div className="text-xs text-gray-500 text-center py-1">
                        还有 {marketShare.shares.length - 10} 家公司...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4">
                    暂无交易记录
                  </div>
                )}
              </div>
            </div>
            
            {/* 价格走势图 - 使用 Canvas GPU 加速版本 */}
            <div className="p-4 border-b border-slate-700">
              <div className="text-sm font-medium text-gray-400 mb-2">📈 价格走势</div>
              <PriceChartWrapperCanvas history={selectedHistory} />
            </div>
            
            {/* 生产/消耗建筑 + 标签 */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {/* 生产建筑 */}
              <BuildingRelationSection
                title="🏭 生产建筑"
                subtitle="可以生产该商品的建筑"
                relations={[
                  ...getBuildingsProducingGoods(selectedGoodsId),
                  ...getBuildingsProducingGoodsFromData(selectedGoodsId),
                ]}
                isProducer={true}
                onBuild={handleBuildBuilding}
                formatMoney={formatMoney}
                playerBuildings={playerBuildings}
              />
              
              {/* 消耗建筑 */}
              <BuildingRelationSection
                title="⚙️ 消耗建筑"
                subtitle="需要消耗该商品的建筑"
                relations={[
                  ...getBuildingsConsumingGoods(selectedGoodsId),
                  ...getBuildingsConsumingGoodsFromData(selectedGoodsId),
                ]}
                isProducer={false}
                onBuild={handleBuildBuilding}
                formatMoney={formatMoney}
                playerBuildings={playerBuildings}
              />
              
              {/* 标签 */}
              <div>
                <div className="text-sm font-medium text-gray-400 mb-2">🏷️ 标签</div>
                <div className="flex flex-wrap gap-2">
                  {selectedGoods.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-slate-700 rounded text-xs text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            请选择商品
          </div>
        )}
      </div>

      {/* ========== 右栏：交易操作 ========== */}
      <div className="w-80 flex flex-col overflow-y-auto bg-slate-800/30">
        {/* 订单簿 - 紧凑版 */}
        <div className="p-2 border-b border-slate-700" style={{ minHeight: '280px' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-gray-400">📊 市场挂单</div>
            <div className="text-[10px] text-gray-500">{loading ? '' : '点击接受报价'}</div>
          </div>
          {loading ? (
            <OrderBookSkeleton />
          ) : (
            <div className="space-y-1">
              {/* 卖单区域 */}
              <div className="bg-red-900/15 rounded p-1.5 border border-red-800/20">
                <div className="flex items-center justify-between text-[10px] text-red-400 mb-1">
                  <span>🔴 卖方报价 (点击买入)</span>
                  <span className="text-gray-500">{depth?.asks?.length || 0}档</span>
                </div>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {depth?.asks.slice().reverse().slice(0, 8).map((level, i) => {
                    const hasMyOrder = playerOrders.some(o => o.orderType === 'sell' && o.pricePerUnit === level.price);
                    const topSeller = level.companies?.reduce((max, c) =>
                      c.quantity > (max?.quantity ?? 0) ? c : max, level.companies[0]);
                    const sellerInfo = topSeller ? getCompanyInfo(topSeller.companyId) : null;
                    const isPlayerSeller = topSeller?.companyId === playerCompanyId;
                    const canAccept = !isPlayerSeller && level.quantity > 0;
                    return (
                      <div
                        key={i}
                        onClick={() => canAccept && handleAcceptAsk(level.price, Math.min(level.quantity, 100))}
                        className={`grid grid-cols-4 gap-1 text-[11px] rounded px-1 py-0.5 transition-colors ${
                          hasMyOrder ? 'bg-yellow-900/40' :
                          canAccept ? 'bg-slate-800/50 hover:bg-green-900/30 cursor-pointer' : 'bg-slate-800/50'
                        }`}
                        title={canAccept ? `点击以 ${formatMoney(level.price)} 买入` : undefined}
                      >
                        <div className="text-red-400 font-mono">{formatMoney(level.price)}</div>
                        <div className="text-right text-gray-300 font-mono">{level.quantity.toFixed(0)}</div>
                        <div className="text-right text-gray-500">{level.orderCount}单</div>
                        <div className="text-right truncate text-[10px]" style={{ color: sellerInfo?.color }}>
                          {isPlayerSeller ? '我' : sellerInfo?.shortName || '-'}
                        </div>
                      </div>
                    );
                  })}
                  {(!depth?.asks || depth.asks.length === 0) && (
                    <div className="text-[10px] text-gray-500 text-center py-1">暂无卖家</div>
                  )}
                </div>
              </div>
              
              {/* 价差 */}
              <div className="flex items-center justify-center gap-1 py-0.5 text-[10px]">
                <span className="text-gray-500">价差</span>
                <span className="text-cyan-400 font-mono">
                  {depth && depth.spread !== null ? formatMoney(depth.spread) : '-'}
                </span>
              </div>
              
              {/* 买单区域 */}
            <div className="bg-green-900/15 rounded p-1.5 border border-green-800/20">
              <div className="flex items-center justify-between text-[10px] text-green-400 mb-1">
                <span>🟢 买方报价 (点击卖出)</span>
                <span className="text-gray-500">
                  {depth?.bids?.length || 0}档
                  {selectedStock && selectedStock.quantity > 0 && ` · 库存: ${selectedStock.quantity.toFixed(0)}`}
                </span>
              </div>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {depth?.bids.slice(0, 8).map((level, i) => {
                  const hasMyOrder = playerOrders.some(o => o.orderType === 'buy' && o.pricePerUnit === level.price);
                  const topBuyer = level.companies?.reduce((max, c) =>
                    c.quantity > (max?.quantity ?? 0) ? c : max, level.companies[0]);
                  const buyerInfo = topBuyer ? getCompanyInfo(topBuyer.companyId) : null;
                  const isPlayerBuyer = topBuyer?.companyId === playerCompanyId;
                  // 检查玩家是否有库存可卖
                  const playerAvailableStock = selectedStock?.quantity ?? 0;
                  const hasStock = playerAvailableStock > 0;
                  const canAccept = !isPlayerBuyer && level.quantity > 0 && hasStock;
                  return (
                    <div
                      key={i}
                      onClick={() => canAccept && handleAcceptBid(level.price, Math.min(level.quantity, playerAvailableStock, 100))}
                      className={`grid grid-cols-4 gap-1 text-[11px] rounded px-1 py-0.5 transition-colors ${
                        hasMyOrder ? 'bg-yellow-900/40' :
                        canAccept ? 'bg-slate-800/50 hover:bg-red-900/30 cursor-pointer' :
                        !hasStock && !isPlayerBuyer ? 'bg-slate-800/50 opacity-50' : 'bg-slate-800/50'
                      }`}
                      title={!hasStock ? '您没有该商品的库存' : canAccept ? `点击以 ${formatMoney(level.price)} 卖出 (最多 ${Math.min(level.quantity, playerAvailableStock).toFixed(0)} 件)` : undefined}
                    >
                      <div className="text-green-400 font-mono">{formatMoney(level.price)}</div>
                      <div className="text-right text-gray-300 font-mono">{level.quantity.toFixed(0)}</div>
                      <div className="text-right text-gray-500">{level.orderCount}单</div>
                      <div className="text-right truncate text-[10px]" style={{ color: buyerInfo?.color }}>
                        {isPlayerBuyer ? '我' : buyerInfo?.shortName || '-'}
                      </div>
                    </div>
                  );
                })}
                {(!depth?.bids || depth.bids.length === 0) && (
                  <div className="text-[10px] text-gray-500 text-center py-1">暂无买家</div>
                )}
              </div>
            </div>
            </div>
          )}
        </div>
        
        {/* 成交历史 - 紧凑版 */}
        <div className="p-2 border-b border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-gray-400">📜 成交记录</div>
            <div className="text-[10px] text-gray-500">{trades.length} 笔</div>
          </div>
          <div className="max-h-20 overflow-y-auto">
            {trades.length === 0 ? (
              <div className="text-center py-2 text-gray-500 text-[10px]">暂无记录</div>
            ) : (
              <div className="space-y-0.5">
                {trades.slice(0, 6).map((trade, index) => {
                  const isMyBuy = trade.buyerId === playerCompanyId;
                  const isMySell = trade.sellerId === playerCompanyId;
                  const isMyTrade = isMyBuy || isMySell;
                  return (
                    <div
                      key={trade.id}
                      className={`flex items-center justify-between text-[10px] px-1 py-0.5 rounded ${
                        isMyTrade ? 'bg-yellow-900/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">#{trades.length - index}</span>
                        {isMyTrade && (
                          <span className={`px-0.5 rounded ${isMyBuy ? 'text-green-400' : 'text-red-400'}`}>
                            {isMyBuy ? '买' : '卖'}
                          </span>
                        )}
                      </div>
                      <span className="text-gray-300 font-mono">{trade.quantity.toFixed(0)}</span>
                      <span className="text-cyan-400 font-mono">{formatMoney(trade.pricePerUnit)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        {/* 下单表单 - 紧凑版 */}
        <div className="p-2 border-b border-slate-700">
          <div className="text-xs font-medium text-gray-400 mb-2">💰 自定义下单</div>
          
          {/* 买卖切换 */}
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => setOrderType('buy')}
              className={`flex-1 py-2 text-xs font-bold rounded transition-all ${
                orderType === 'buy'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
            >
              🟢 买入
            </button>
            <button
              onClick={() => setOrderType('sell')}
              className={`flex-1 py-2 text-xs font-bold rounded transition-all ${
                orderType === 'sell'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
            >
              🔴 卖出
            </button>
          </div>
          
          {/* 数量和价格输入 - 并排 */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">数量</label>
              <input
                type="number"
                min={1}
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded border border-slate-600 focus:border-cyan-500 outline-none text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">单价 (分)</label>
              <input
                type="number"
                min={1}
                value={orderPrice}
                onChange={(e) => setOrderPrice(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded border border-slate-600 focus:border-cyan-500 outline-none text-xs font-mono"
              />
            </div>
          </div>
          
          {/* 预估总价和提交按钮 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs">
              <span className="text-gray-500">总价:</span>
              <span className={`ml-1 font-mono ${orderType === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {formatMoney(orderPrice * orderQuantity)}
              </span>
            </div>
            <button
              onClick={() => handleSubmitOrder()}
              className={`px-4 py-1.5 text-xs font-bold rounded transition-all ${
                orderType === 'buy'
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {orderType === 'buy' ? '买入' : '卖出'}
            </button>
          </div>
          
          {orderError && (
            <div className="mt-1 text-[10px] text-red-400 bg-red-900/30 px-2 py-1 rounded">⚠️ {orderError}</div>
          )}
        </div>
        
        {/* 我的挂单 - 紧凑版 */}
        <div className="p-2 bg-slate-900/50 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-gray-400">📋 我的挂单</div>
            <div className="text-[10px] text-yellow-400">{playerOrders.length} 笔</div>
          </div>
          {playerOrders.length > 0 ? (
            <div className="space-y-1">
              {playerOrders.map((order) => {
                const orderGoods = getGoodsInfo(order.goodsId);
                const isCurrentGoods = order.goodsId === selectedGoodsId;
                return (
                  <div
                    key={order.id}
                    className={`flex items-center gap-1.5 rounded px-1.5 py-1 cursor-pointer ${
                      isCurrentGoods ? 'bg-cyan-900/30' : 'bg-slate-700/30 hover:bg-slate-700/50'
                    }`}
                    onClick={() => setSelectedGoodsId(order.goodsId)}
                  >
                    <span className="text-sm">{orderGoods?.icon || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-white truncate">{orderGoods?.nameZh || order.goodsId}</span>
                        <span className={`text-[9px] px-1 rounded ${
                          order.orderType === 'buy' ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
                        }`}>
                          {order.orderType === 'buy' ? '买' : '卖'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        <span className="font-mono">{order.remainingQuantity.toFixed(0)}</span>
                        <span className="mx-0.5">×</span>
                        <span className="text-cyan-400 font-mono">{formatMoney(order.pricePerUnit)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelOrder(order.id);
                      }}
                      className="text-[10px] text-red-400 hover:bg-red-900/30 px-1 py-0.5 rounded"
                    >
                      撤
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-2 text-gray-500 text-[10px]">暂无挂单</div>
          )}
        </div>
      </div>
    </div>
  );
}