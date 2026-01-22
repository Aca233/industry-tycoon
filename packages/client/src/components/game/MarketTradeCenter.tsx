/**
 * MarketTradeCenter - 市场交易中心
 * 整合交易功能和市场行情的全功能界面
 * 三栏布局：左侧商品导航 | 中间交易区 | 右侧市场信息
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGameStore, useMarketPrices, usePriceHistory, type PriceHistoryEntry } from '../../stores';
import { GOODS_DATA, GOODS_BY_CATEGORY, GOODS_MAP } from '@scc/shared';
import * as d3 from 'd3';

interface MarketOrder {
  id: string;
  companyId: string;
  goodsId: string;
  orderType: 'buy' | 'sell';
  price: number;
  originalQuantity: number;
  remainingQuantity: number;
  status: string;
  createdTick: number;
}

interface TradeRecord {
  id: string;
  buyerId: string;
  sellerId: string;
  goodsId: string;
  quantity: number;
  price: number;
  totalValue: number;
  tick: number;
}

interface MarketDepthLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

interface MarketDepth {
  bids: MarketDepthLevel[];
  asks: MarketDepthLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
}

interface MarketTradeCenterProps {
  onClose: () => void;
}

// 类别配置
const categoryConfig: Record<string, { name: string; icon: string; color: string }> = {
  raw_material: { name: '原材料', icon: '📦', color: '#f59e0b' },
  basic_processed: { name: '基础加工', icon: '🔧', color: '#3b82f6' },
  intermediate: { name: '中间产品', icon: '⚙️', color: '#8b5cf6' },
  consumer_good: { name: '消费品', icon: '🛒', color: '#10b981' },
  service: { name: '服务', icon: '⚡', color: '#ec4899' },
};

// 价格走势图组件
function PriceChart({ history, width = 280, height = 120 }: { 
  history: PriceHistoryEntry[]; 
  width?: number; 
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || history.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 10, right: 10, bottom: 25, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 计算价格范围
    const prices = history.map(h => h.price);
    const minPrice = Math.min(...prices) * 0.95;
    const maxPrice = Math.max(...prices) * 1.05;

    // 比例尺
    const xScale = d3.scaleLinear()
      .domain([0, history.length - 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([minPrice, maxPrice])
      .range([innerHeight, 0]);

    // 绘制网格线
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data([0.25, 0.5, 0.75])
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => innerHeight * d)
      .attr('y2', d => innerHeight * d)
      .attr('stroke', '#334155')
      .attr('stroke-dasharray', '2,2');

    // 创建渐变
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'price-gradient-trade')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#22d3ee')
      .attr('stop-opacity', 0.4);
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#22d3ee')
      .attr('stop-opacity', 0);

    // 面积图
    const area = d3.area<PriceHistoryEntry>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('fill', 'url(#price-gradient-trade)')
      .attr('d', area);

    // 价格线
    const line = d3.line<PriceHistoryEntry>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 2)
      .attr('d', line);

    // 当前价格点
    const lastPoint = history[history.length - 1];
    g.append('circle')
      .attr('cx', xScale(history.length - 1))
      .attr('cy', yScale(lastPoint.price))
      .attr('r', 5)
      .attr('fill', '#22d3ee')
      .attr('stroke', '#0d1117')
      .attr('stroke-width', 2);

    // Y轴
    const yAxis = d3.axisLeft(yScale)
      .ticks(4)
      .tickFormat(d => `¥${(d as number / 100).toFixed(0)}`);
    
    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    g.selectAll('.y-axis path, .y-axis line').attr('stroke', '#475569');

    // X轴标签
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .text(`最近 ${history.length} 个周期`);

  }, [history, width, height]);

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center text-gray-500 text-sm" style={{ width, height }}>
        等待价格数据...
      </div>
    );
  }

  return <svg ref={svgRef} width={width} height={height} />;
}

export function MarketTradeCenter({ onClose }: MarketTradeCenterProps) {
  const gameId = useGameStore((state) => state.gameId);
  const marketPrices = useMarketPrices();
  const priceHistory = usePriceHistory();
  
  const [selectedGoods, setSelectedGoods] = useState<string>('steel');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['raw_material', 'basic_processed', 'intermediate', 'consumer_good'])
  );
  const [depth, setDepth] = useState<MarketDepth | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [playerOrders, setPlayerOrders] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 下单表单状态
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderQuantity, setOrderQuantity] = useState(10);
  const [orderPrice, setOrderPrice] = useState(1000);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // 获取选中商品信息
  const selectedGoodsData = useMemo(() => {
    return GOODS_MAP.get(selectedGoods);
  }, [selectedGoods]);

  // 过滤商品
  const filteredGoods = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return GOODS_DATA.filter(g => 
      g.nameZh.toLowerCase().includes(query) || 
      g.id.toLowerCase().includes(query) ||
      g.tags.some(t => t.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  // 获取价格历史
  const selectedPriceHistory = useMemo(() => {
    return priceHistory.get(selectedGoods) ?? [];
  }, [priceHistory, selectedGoods]);

  // 计算价格变化
  const priceChange = useMemo(() => {
    const currentPrice = marketPrices[selectedGoods];
    const basePrice = selectedGoodsData?.basePrice ?? 0;
    if (!currentPrice || !basePrice) return { value: 0, percent: 0 };
    const change = currentPrice - basePrice;
    const percent = (change / basePrice) * 100;
    return { value: change, percent };
  }, [marketPrices, selectedGoods, selectedGoodsData]);

  const fetchData = useCallback(async () => {
    if (!gameId) return;
    
    try {
      // 获取订单簿深度
      const depthRes = await fetch(`/api/v1/games/${gameId}/market/orderbook/${selectedGoods}`);
      if (depthRes.ok) {
        const data = await depthRes.json();
        setDepth(data.depth);
      }
      
      // 获取交易历史
      const tradesRes = await fetch(`/api/v1/games/${gameId}/market/trades?goodsId=${selectedGoods}&limit=30`);
      if (tradesRes.ok) {
        const data = await tradesRes.json();
        setTrades(data.trades);
      }
      
      // 获取玩家订单
      const ordersRes = await fetch(`/api/v1/games/${gameId}/orders`);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setPlayerOrders(data.orders.filter((o: MarketOrder) => o.goodsId === selectedGoods));
      }
    } catch (err) {
      console.error('Failed to fetch trading data:', err);
    } finally {
      setLoading(false);
    }
  }, [gameId, selectedGoods]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    // 根据市场价格设置默认订单价格
    const price = marketPrices[selectedGoods];
    if (price) {
      setOrderPrice(Math.round(price));
    }
  }, [selectedGoods, marketPrices]);

  const formatMoney = (cents: number | undefined | null) => {
    // Handle undefined, null, or NaN values
    if (cents === undefined || cents === null || !Number.isFinite(cents)) {
      return '¥0';
    }
    const value = cents / 100;
    if (Math.abs(value) >= 1000000) {
      return `¥${(value / 1000000).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `¥${(value / 1000).toFixed(1)}K`;
    }
    return `¥${value.toFixed(2)}`;
  };

  const handleSubmitOrder = async () => {
    if (!gameId) return;
    setOrderError(null);
    setOrderSuccess(null);
    
    try {
      const endpoint = orderType === 'buy' ? 'buy' : 'sell';
      const body = orderType === 'buy' 
        ? { goodsId: selectedGoods, quantity: orderQuantity, maxPrice: orderPrice }
        : { goodsId: selectedGoods, quantity: orderQuantity, minPrice: orderPrice };
      
      const response = await fetch(`/api/v1/games/${gameId}/orders/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        setOrderSuccess(`${orderType === 'buy' ? '买入' : '卖出'}订单已提交`);
        fetchData();
        setTimeout(() => setOrderSuccess(null), 3000);
      } else {
        const data = await response.json();
        setOrderError(data.error || '下单失败');
      }
    } catch (err) {
      setOrderError('网络错误');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!gameId) return;
    
    try {
      const response = await fetch(`/api/v1/games/${gameId}/orders/${orderId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
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

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2">
      <div className="bg-slate-900 rounded-xl w-full max-w-7xl h-[95vh] overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-3xl">📈</span>
            <div>
              <h2 className="text-xl font-bold text-white">市场交易中心</h2>
              <p className="text-sm text-white/70">实时交易 · 市场行情 · 订单管理</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Main Content - Three Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Goods Navigation */}
          <div className="w-64 border-r border-slate-700 flex flex-col bg-slate-800/50">
            {/* Search */}
            <div className="p-3 border-b border-slate-700">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索商品..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-700 text-white px-3 py-2 pl-9 rounded-lg border border-slate-600 focus:border-blue-500 outline-none text-sm"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
            </div>

            {/* Goods List */}
            <div className="flex-1 overflow-y-auto">
              {filteredGoods ? (
                // 搜索结果
                <div className="p-2">
                  <div className="text-xs text-gray-400 mb-2">搜索结果 ({filteredGoods.length})</div>
                  {filteredGoods.map(goods => (
                    <button
                      key={goods.id}
                      onClick={() => {
                        setSelectedGoods(goods.id);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-2 transition-colors ${
                        selectedGoods === goods.id
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-slate-700 text-gray-300'
                      }`}
                    >
                      <span>{goods.icon}</span>
                      <span className="text-sm truncate">{goods.nameZh}</span>
                    </button>
                  ))}
                </div>
              ) : (
                // 分类列表
                Object.entries(GOODS_BY_CATEGORY).map(([category, goods]) => {
                  const config = categoryConfig[category];
                  const isExpanded = expandedCategories.has(category);
                  
                  return (
                    <div key={category} className="border-b border-slate-700/50">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span>{config.icon}</span>
                          <span className="text-sm font-medium text-gray-200">{config.name}</span>
                          <span className="text-xs text-gray-500">({goods.length})</span>
                        </div>
                        <span className="text-gray-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
                      </button>
                      
                      {isExpanded && (
                        <div className="pb-2">
                          {goods.map(g => (
                            <button
                              key={g.id}
                              onClick={() => setSelectedGoods(g.id)}
                              className={`w-full text-left px-4 py-1.5 flex items-center gap-2 transition-colors ${
                                selectedGoods === g.id
                                  ? 'bg-blue-600/80 text-white'
                                  : 'hover:bg-slate-700/50 text-gray-400'
                              }`}
                            >
                              <span className="text-sm">{g.icon}</span>
                              <span className="text-sm truncate">{g.nameZh}</span>
                              <span className="ml-auto text-xs opacity-60">
                                {formatMoney(marketPrices[g.id] ?? g.basePrice)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Center Panel - Trading */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Selected Goods Header */}
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{selectedGoodsData?.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedGoodsData?.nameZh}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">{selectedGoodsData?.subcategory}</span>
                      <span 
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ 
                          backgroundColor: `${categoryConfig[selectedGoodsData?.category ?? '']?.color}20`,
                          color: categoryConfig[selectedGoodsData?.category ?? '']?.color
                        }}
                      >
                        {categoryConfig[selectedGoodsData?.category ?? '']?.name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-cyan-400">
                    {formatMoney(marketPrices[selectedGoods] ?? selectedGoodsData?.basePrice ?? 0)}
                  </div>
                  <div className={`text-sm ${priceChange.percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {priceChange.percent >= 0 ? '▲' : '▼'} {priceChange.percent.toFixed(2)}%
                    <span className="text-gray-500 ml-2">vs 基准</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Book */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Asks */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                    <span>📉</span> 卖单 (Ask)
                  </h4>
                  {loading ? (
                    <div className="text-center py-4 text-gray-500">加载中...</div>
                  ) : (
                    <div className="space-y-1">
                      {depth?.asks.slice().reverse().slice(0, 8).map((level, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 text-sm py-1 px-2 rounded hover:bg-slate-700/50">
                          <div className="text-red-400 font-medium">{formatMoney(level.price)}</div>
                          <div className="text-right text-gray-300">{level.quantity.toFixed(1)}</div>
                          <div className="text-right text-gray-500 text-xs">{level.orderCount}单</div>
                        </div>
                      ))}
                      {(!depth?.asks || depth.asks.length === 0) && (
                        <div className="text-xs text-gray-500 text-center py-4">暂无卖单</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bids */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                    <span>📈</span> 买单 (Bid)
                  </h4>
                  <div className="space-y-1">
                    {depth?.bids.slice(0, 8).map((level, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 text-sm py-1 px-2 rounded hover:bg-slate-700/50">
                        <div className="text-green-400 font-medium">{formatMoney(level.price)}</div>
                        <div className="text-right text-gray-300">{level.quantity.toFixed(1)}</div>
                        <div className="text-right text-gray-500 text-xs">{level.orderCount}单</div>
                      </div>
                    ))}
                    {(!depth?.bids || depth.bids.length === 0) && (
                      <div className="text-xs text-gray-500 text-center py-4">暂无买单</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Spread Info */}
              <div className="text-center py-2 mb-4 bg-slate-800/30 rounded-lg">
                <span className="text-xs text-gray-400">价差 (Spread): </span>
                <span className="text-sm text-white font-medium">
                  {depth && depth.spread !== null ? formatMoney(depth.spread) : '-'}
                </span>
                {depth?.bestBid && depth?.bestAsk && (
                  <span className="text-xs text-gray-500 ml-4">
                    最佳买 {formatMoney(depth.bestBid)} | 最佳卖 {formatMoney(depth.bestAsk)}
                  </span>
                )}
              </div>

              {/* Order Form */}
              <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                  <span>📝</span> 创建订单
                </h4>
                
                <div className="grid grid-cols-4 gap-4 items-end">
                  {/* Order Type Toggle */}
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">订单类型</label>
                    <div className="flex bg-slate-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setOrderType('buy')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                          orderType === 'buy' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        买入
                      </button>
                      <button
                        onClick={() => setOrderType('sell')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                          orderType === 'sell' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        卖出
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">数量</label>
                    <input
                      type="number"
                      min={1}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-700 text-white px-3 py-2.5 rounded-lg border border-slate-600 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">
                      {orderType === 'buy' ? '最高价格 (分)' : '最低价格 (分)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-700 text-white px-3 py-2.5 rounded-lg border border-slate-600 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <button
                    onClick={handleSubmitOrder}
                    className={`px-6 py-2.5 font-medium rounded-lg transition-all ${
                      orderType === 'buy'
                        ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20'
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
                    }`}
                  >
                    {orderType === 'buy' ? '确认买入' : '确认卖出'}
                  </button>
                </div>

                {orderError && (
                  <div className="mt-3 text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">⚠️ {orderError}</div>
                )}
                {orderSuccess && (
                  <div className="mt-3 text-sm text-green-400 bg-green-500/10 px-3 py-2 rounded-lg">✓ {orderSuccess}</div>
                )}
              </div>

              {/* Player Orders */}
              {playerOrders.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <span>📋</span> 我的挂单
                  </h4>
                  <div className="space-y-2">
                    {playerOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-2">
                        <div className="flex items-center gap-4">
                          <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                            order.orderType === 'buy' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                          }`}>
                            {order.orderType === 'buy' ? '买入' : '卖出'}
                          </span>
                          <span className="text-white font-medium">{order.remainingQuantity.toFixed(1)}</span>
                          <span className="text-gray-400">@</span>
                          <span className="text-cyan-400">{formatMoney(order.price)}</span>
                        </div>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="text-xs text-red-400 hover:text-red-300 px-3 py-1 rounded hover:bg-red-500/10 transition-colors"
                        >
                          撤单
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Market Info */}
          <div className="w-80 border-l border-slate-700 flex flex-col bg-slate-800/30">
            {/* Price Chart */}
            <div className="p-4 border-b border-slate-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <span>📊</span> 价格走势
              </h4>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <PriceChart history={selectedPriceHistory} width={260} height={140} />
              </div>
            </div>

            {/* Market Stats */}
            <div className="p-4 border-b border-slate-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <span>📈</span> 市场统计
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">当前价格</span>
                  <span className="text-cyan-400 font-medium">
                    {formatMoney(marketPrices[selectedGoods] ?? selectedGoodsData?.basePrice ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">基准价格</span>
                  <span className="text-orange-400">
                    {formatMoney(selectedGoodsData?.basePrice ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">价格变化</span>
                  <span className={priceChange.percent >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">成交记录</span>
                  <span className="text-gray-300">{trades.length} 笔</span>
                </div>
                {depth && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">买单总量</span>
                      <span className="text-green-400">
                        {depth.bids.reduce((sum, b) => sum + b.quantity, 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">卖单总量</span>
                      <span className="text-red-400">
                        {depth.asks.reduce((sum, a) => sum + a.quantity, 0).toFixed(1)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Trade History */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2 shrink-0">
                <span>📜</span> 成交历史
              </h4>
              <div className="flex-1 overflow-y-auto">
                {trades.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">暂无成交记录</div>
                ) : (
                  <div className="space-y-1">
                    {trades.map((trade) => (
                      <div key={trade.id} className="grid grid-cols-4 gap-1 text-xs py-1.5 px-2 rounded hover:bg-slate-700/50">
                        <div className="text-gray-500">T{trade.tick}</div>
                        <div className="text-white">{trade.quantity.toFixed(1)}</div>
                        <div className="text-cyan-400">{formatMoney(trade.price)}</div>
                        <div className="text-right text-gray-400">{formatMoney(trade.totalValue)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {selectedGoodsData?.tags && (
              <div className="p-4 border-t border-slate-700">
                <div className="flex flex-wrap gap-1">
                  {selectedGoodsData.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}