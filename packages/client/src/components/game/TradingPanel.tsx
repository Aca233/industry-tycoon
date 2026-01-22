/**
 * TradingPanel - 市场交易面板
 * 显示订单簿、交易历史和下单功能
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameStore, useMarketPrices } from '../../stores';

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

interface TradingPanelProps {
  onClose: () => void;
}

export function TradingPanel({ onClose }: TradingPanelProps) {
  const gameId = useGameStore((state) => state.gameId);
  const marketPrices = useMarketPrices();
  
  const [selectedGoods, setSelectedGoods] = useState<string>('steel');
  const [depth, setDepth] = useState<MarketDepth | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [playerOrders, setPlayerOrders] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 下单表单状态
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderQuantity, setOrderQuantity] = useState(10);
  const [orderPrice, setOrderPrice] = useState(1000);
  const [orderError, setOrderError] = useState<string | null>(null);

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
      const tradesRes = await fetch(`/api/v1/games/${gameId}/market/trades?goodsId=${selectedGoods}&limit=20`);
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
      setOrderPrice(price);
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
        fetchData();
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

  // 商品列表（常用商品）
  const goodsList = [
    { id: 'steel', name: '钢材' },
    { id: 'semiconductor-chip', name: '半导体芯片' },
    { id: 'smartphone', name: '智能手机' },
    { id: 'electric-vehicle', name: '电动汽车' },
    { id: 'electricity', name: '电力' },
    { id: 'crude-oil', name: '原油' },
    { id: 'iron-ore', name: '铁矿石' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📈</span>
            <h2 className="text-xl font-bold text-white">市场交易</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Goods Selector */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex gap-2 flex-wrap">
            {goodsList.map((goods) => (
              <button
                key={goods.id}
                onClick={() => setSelectedGoods(goods.id)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  selectedGoods === goods.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {goods.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4">
          {/* Order Book */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">订单簿</h3>
            
            {loading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : (
              <div className="space-y-4">
                {/* Asks (Sell orders) */}
                <div>
                  <div className="text-xs text-red-400 mb-1">卖单 (Ask)</div>
                  <div className="space-y-1">
                    {depth?.asks.slice().reverse().slice(0, 5).map((level, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-red-400">{formatMoney(level.price)}</div>
                        <div className="text-right text-gray-300">{level.quantity.toFixed(1)}</div>
                        <div className="text-right text-gray-500">{level.orderCount}单</div>
                      </div>
                    ))}
                    {(!depth?.asks || depth.asks.length === 0) && (
                      <div className="text-xs text-gray-500 text-center py-2">暂无卖单</div>
                    )}
                  </div>
                </div>

                {/* Spread */}
                <div className="text-center py-2 border-y border-slate-600">
                  <span className="text-xs text-gray-400">价差: </span>
                  <span className="text-sm text-white">
                    {depth && depth.spread !== null ? formatMoney(depth.spread) : '-'}
                  </span>
                </div>

                {/* Bids (Buy orders) */}
                <div>
                  <div className="text-xs text-green-400 mb-1">买单 (Bid)</div>
                  <div className="space-y-1">
                    {depth?.bids.slice(0, 5).map((level, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-green-400">{formatMoney(level.price)}</div>
                        <div className="text-right text-gray-300">{level.quantity.toFixed(1)}</div>
                        <div className="text-right text-gray-500">{level.orderCount}单</div>
                      </div>
                    ))}
                    {(!depth?.bids || depth.bids.length === 0) && (
                      <div className="text-xs text-gray-500 text-center py-2">暂无买单</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trade History */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">成交历史</h3>
            
            {trades.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无成交记录</div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {trades.map((trade) => (
                  <div key={trade.id} className="grid grid-cols-4 gap-2 text-xs py-1">
                    <div className="text-gray-400">T{trade.tick}</div>
                    <div className="text-white">{trade.quantity.toFixed(1)}</div>
                    <div className="text-cyan-400">{formatMoney(trade.price)}</div>
                    <div className="text-right text-gray-300">{formatMoney(trade.totalValue)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Order Form */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">下单</h4>
          
          <div className="flex gap-4 items-end">
            {/* Order Type Toggle */}
            <div className="flex bg-slate-700 rounded overflow-hidden">
              <button
                onClick={() => setOrderType('buy')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  orderType === 'buy' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                买入
              </button>
              <button
                onClick={() => setOrderType('sell')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  orderType === 'sell' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                卖出
              </button>
            </div>

            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">数量</label>
              <input
                type="number"
                min={1}
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">
                {orderType === 'buy' ? '最高价格（分）' : '最低价格（分）'}
              </label>
              <input
                type="number"
                min={1}
                value={orderPrice}
                onChange={(e) => setOrderPrice(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-blue-500 outline-none"
              />
            </div>

            <button
              onClick={handleSubmitOrder}
              className={`px-6 py-2 font-medium rounded transition-colors ${
                orderType === 'buy'
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {orderType === 'buy' ? '买入' : '卖出'}
            </button>
          </div>

          {orderError && (
            <div className="mt-2 text-sm text-red-400">{orderError}</div>
          )}
        </div>

        {/* Player Orders */}
        {playerOrders.length > 0 && (
          <div className="p-4 border-t border-slate-700">
            <h4 className="text-sm font-semibold text-gray-400 mb-3">我的挂单</h4>
            <div className="space-y-2">
              {playerOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between bg-slate-700/30 rounded px-3 py-2">
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-medium ${order.orderType === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {order.orderType === 'buy' ? '买入' : '卖出'}
                    </span>
                    <span className="text-white">{order.remainingQuantity.toFixed(1)}</span>
                    <span className="text-gray-400">@</span>
                    <span className="text-cyan-400">{formatMoney(order.price)}</span>
                  </div>
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    className="text-xs text-red-400 hover:text-red-300"
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
  );
}