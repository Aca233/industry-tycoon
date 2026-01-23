/**
 * 股票详情面板
 * 整合K线图、盘口、交易等功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Stock, StockPriceHistory, Shareholding, StockTrade, CompanyValuation, Money } from '@scc/shared';
import { StockOrderType, StockOrderSide } from '@scc/shared';
import { CandlestickChart } from './CandlestickChart';
import { MarketDepth } from './MarketDepth';

interface StockDetailData {
  stock: Stock;
  priceHistory: StockPriceHistory[];
  stockholders: Shareholding[];
  recentTrades: StockTrade[];
  valuation: CompanyValuation | null;
}

interface MarketDepthData {
  bids: Array<{ price: Money; volume: number }>;
  asks: Array<{ price: Money; volume: number }>;
}

interface StockDetailPanelProps {
  stockId: string;
  playerId: string;
  onClose?: () => void;
  className?: string;
}

export const StockDetailPanel: React.FC<StockDetailPanelProps> = ({
  stockId,
  playerId,
  onClose,
  className = '',
}) => {
  const [data, setData] = useState<StockDetailData | null>(null);
  const [depth, setDepth] = useState<MarketDepthData>({ bids: [], asks: [] });
  const [loading, setLoading] = useState(true);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState(100);
  const [limitPrice, setLimitPrice] = useState<number | ''>('');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // 加载股票数据
  const loadData = useCallback(async () => {
    try {
      const [stockRes, depthRes] = await Promise.all([
        fetch(`/api/v1/stocks/${stockId}`),
        fetch(`/api/v1/stocks/${stockId}/depth?levels=5`),
      ]);
      
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        if (stockData.success) {
          setData(stockData.data);
          // 设置默认限价为当前价
          if (limitPrice === '' && stockData.data.stock) {
            setLimitPrice(stockData.data.stock.currentPrice / 100);
          }
        }
      }
      
      if (depthRes.ok) {
        const depthData = await depthRes.json();
        if (depthData.success) {
          setDepth({
            bids: depthData.data.bids || [],
            asks: depthData.data.asks || [],
          });
        }
      }
    } catch (error) {
      console.error('Failed to load stock data:', error);
    } finally {
      setLoading(false);
    }
  }, [stockId, limitPrice]);
  
  useEffect(() => {
    loadData();
    
    // 定时刷新
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);
  
  // 提交订单
  const submitOrder = async () => {
    if (!data) return;
    
    setSubmitting(true);
    setMessage(null);
    
    try {
      const orderData = {
        companyId: playerId,
        stockId,
        orderType: orderType === 'market' ? StockOrderType.Market : StockOrderType.Limit,
        side: orderSide === 'buy' ? StockOrderSide.Buy : StockOrderSide.Sell,
        quantity,
        limitPrice: orderType === 'limit' && limitPrice !== '' ? Math.round(Number(limitPrice) * 100) : undefined,
      };
      
      const response = await fetch('/api/v1/stocks/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: '订单已提交' });
        loadData(); // 刷新数据
      } else {
        setMessage({ type: 'error', text: result.error || '提交失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '网络错误' });
    } finally {
      setSubmitting(false);
    }
  };
  
  // 格式化价格
  const formatPrice = (price: Money) => `$${(price / 100).toFixed(2)}`;
  
  // 格式化百分比
  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(2)}%`;
  };
  
  if (loading) {
    return (
      <div className={`bg-slate-800 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className={`bg-slate-800 rounded-lg p-6 ${className}`}>
        <div className="text-center text-slate-500">
          股票数据加载失败
        </div>
      </div>
    );
  }
  
  const { stock, priceHistory, recentTrades, valuation } = data;
  const isUp = stock.priceChangePercent >= 0;
  
  return (
    <div className={`bg-slate-800 rounded-lg overflow-hidden ${className}`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{stock.ticker}</span>
          <span className={`text-xl font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {formatPrice(stock.currentPrice)}
          </span>
          <span className={`text-sm ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(stock.priceChangePercent)}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>
      
      <div className="p-4 grid grid-cols-3 gap-4">
        {/* 左侧：K线图 */}
        <div className="col-span-2">
          <CandlestickChart
            data={priceHistory}
            width={500}
            height={280}
            showVolume={true}
          />
          
          {/* 股票信息 */}
          <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">市值</span>
              <div className="text-white font-mono">
                ${(stock.marketCap / 100000000).toFixed(2)}亿
              </div>
            </div>
            <div>
              <span className="text-slate-500">PE</span>
              <div className="text-white font-mono">
                {stock.peRatio > 0 ? stock.peRatio.toFixed(1) : '--'}
              </div>
            </div>
            <div>
              <span className="text-slate-500">PB</span>
              <div className="text-white font-mono">
                {stock.pbRatio > 0 ? stock.pbRatio.toFixed(2) : '--'}
              </div>
            </div>
            <div>
              <span className="text-slate-500">股息率</span>
              <div className="text-white font-mono">
                {(stock.dividendYield * 100).toFixed(2)}%
              </div>
            </div>
          </div>
          
          {/* 估值信息 */}
          {valuation && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">估值分析</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  valuation.rating === 'undervalued' ? 'bg-green-500/20 text-green-400' :
                  valuation.rating === 'overvalued' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {valuation.rating === 'undervalued' ? '低估' :
                   valuation.rating === 'overvalued' ? '高估' : '合理'}
                </span>
              </div>
              <div className="mt-2 flex gap-6 text-xs">
                <div>
                  <span className="text-slate-500">公允价值</span>
                  <span className="ml-2 text-cyan-400 font-mono">
                    {formatPrice(valuation.fairValue)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">溢价/折价</span>
                  <span className={`ml-2 font-mono ${
                    valuation.premiumDiscount > 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {formatPercent(valuation.premiumDiscount)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* 右侧：盘口和交易 */}
        <div className="space-y-4">
          {/* 盘口 */}
          <MarketDepth
            stockId={stockId}
            ticker={stock.ticker}
            currentPrice={stock.currentPrice}
            bids={depth.bids}
            asks={depth.asks}
          />
          
          {/* 交易面板 */}
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="flex mb-3">
              <button
                onClick={() => setOrderSide('buy')}
                className={`flex-1 py-2 text-sm font-medium rounded-l transition-colors ${
                  orderSide === 'buy'
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                买入
              </button>
              <button
                onClick={() => setOrderSide('sell')}
                className={`flex-1 py-2 text-sm font-medium rounded-r transition-colors ${
                  orderSide === 'sell'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                卖出
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setOrderType('limit')}
                  className={`flex-1 py-1 text-xs rounded ${
                    orderType === 'limit'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                      : 'bg-slate-600 text-slate-400'
                  }`}
                >
                  限价单
                </button>
                <button
                  onClick={() => setOrderType('market')}
                  className={`flex-1 py-1 text-xs rounded ${
                    orderType === 'market'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                      : 'bg-slate-600 text-slate-400'
                  }`}
                >
                  市价单
                </button>
              </div>
              
              {orderType === 'limit' && (
                <div>
                  <label className="text-xs text-slate-500">价格</label>
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value ? Number(e.target.value) : '')}
                    step="0.01"
                    className="w-full mt-1 px-2 py-1.5 bg-slate-600 rounded text-white text-sm font-mono"
                    placeholder="输入价格"
                  />
                </div>
              )}
              
              <div>
                <label className="text-xs text-slate-500">数量</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min={1}
                  step={100}
                  className="w-full mt-1 px-2 py-1.5 bg-slate-600 rounded text-white text-sm font-mono"
                />
              </div>
              
              <div className="flex gap-1 text-xs">
                {[100, 500, 1000, 5000].map(q => (
                  <button
                    key={q}
                    onClick={() => setQuantity(q)}
                    className="flex-1 py-1 bg-slate-600 hover:bg-slate-500 rounded text-slate-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
              
              {message && (
                <div className={`text-xs p-2 rounded ${
                  message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {message.text}
                </div>
              )}
              
              <button
                onClick={submitOrder}
                disabled={submitting || (orderType === 'limit' && !limitPrice)}
                className={`w-full py-2 rounded font-medium text-white transition-colors ${
                  orderSide === 'buy'
                    ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-500/50'
                    : 'bg-red-500 hover:bg-red-600 disabled:bg-red-500/50'
                }`}
              >
                {submitting ? '提交中...' : orderSide === 'buy' ? '确认买入' : '确认卖出'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 最近成交 */}
      <div className="px-4 pb-4">
        <div className="text-sm text-slate-400 mb-2">最近成交</div>
        <div className="bg-slate-700/30 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-600">
                <th className="py-2 px-3 text-left">时间</th>
                <th className="py-2 px-3 text-right">价格</th>
                <th className="py-2 px-3 text-right">数量</th>
                <th className="py-2 px-3 text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.slice(0, 5).map((trade, index) => (
                <tr key={trade.id || index} className="border-b border-slate-700/50 last:border-0">
                  <td className="py-1.5 px-3 text-slate-400">T{trade.tick}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-white">
                    {formatPrice(trade.price)}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-300">
                    {trade.quantity}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-cyan-400">
                    {formatPrice(trade.value)}
                  </td>
                </tr>
              ))}
              {recentTrades.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">
                    暂无成交记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockDetailPanel;