/**
 * Stock Market Panel - 股票市场面板
 * 显示股票列表、市场状态、交易界面
 *
 * 性能优化：
 * - 使用 React.memo 包装子组件避免不必要的重渲染
 * - 使用 useMemo 缓存计算结果
 * - 使用 useCallback 缓存回调函数
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { api } from '../../api/client';
import { formatMoney } from '../../utils/formatters';
import { StockDetailPanel, OrderManagement } from '../stock';

// 股票数据类型
interface Stock {
  companyId: string;
  ticker: string;
  totalShares: number;
  floatingShares: number;
  currentPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  previousClose: number;
  marketCap: number;
  peRatio: number;
  pbRatio: number;
  eps: number;
  bookValuePerShare: number;
  dividendYield: number;
  priceChangePercent: number;
  volume: number;
  turnover: number;
  status: string;
  listedTick: number;
}

interface MarketState {
  marketIndex: number;
  indexBase: number;
  sentiment: string;
  dailyTurnover: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  limitUpStocks: string[];
  limitDownStocks: string[];
  isOpen: boolean;
  openTick: number;
  closeTick: number;
}

interface StockHolding {
  holderId: string;
  companyId: string;
  shares: number;
  sharePercent: number;
  costBasis: number;
  avgCostPrice: number;
  type: string;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  pnLPercent: number;
  ticker: string;
}

interface StockMarketProps {
  gameId: string;  // Reserved for future use
  playerCompanyId: string;
}

// 静态配置移到组件外部避免每次渲染创建
const sentimentLabels: Record<string, { label: string; color: string; icon: string }> = {
  extreme_fear: { label: '极度恐慌', color: 'text-red-600', icon: '😱' },
  fear: { label: '恐慌', color: 'text-red-500', icon: '😰' },
  cautious: { label: '谨慎', color: 'text-yellow-500', icon: '😟' },
  neutral: { label: '中性', color: 'text-gray-500', icon: '😐' },
  optimistic: { label: '乐观', color: 'text-green-400', icon: '🙂' },
  greedy: { label: '贪婪', color: 'text-green-500', icon: '🤑' },
  extreme_greed: { label: '极度贪婪', color: 'text-green-600', icon: '🚀' },
};

// 股票状态显示
const statusLabels: Record<string, { label: string; color: string }> = {
  trading: { label: '交易中', color: 'bg-green-500' },
  suspended: { label: '停牌', color: 'bg-gray-500' },
  limit_up: { label: '涨停', color: 'bg-red-500' },
  limit_down: { label: '跌停', color: 'bg-green-700' },
  delisted: { label: '退市', color: 'bg-black' },
};

export function StockMarket({ gameId: _gameId, playerCompanyId }: StockMarketProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'market' | 'holdings' | 'trade' | 'orders'>('market');
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // 交易表单状态
  const [tradeForm, setTradeForm] = useState({
    side: 'buy' as 'buy' | 'sell',
    orderType: 'market' as 'market' | 'limit',
    quantity: 100,
    limitPrice: 0,
  });
  const [tradeSubmitting, setTradeSubmitting] = useState(false);

  // 加载股票数据
  const loadStockData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [stocksResult, holdingsResult] = await Promise.all([
        api.getStocks(),
        api.getStockHoldings(playerCompanyId),
      ]);

      if (stocksResult.error) {
        setError(stocksResult.error);
        return;
      }

      if (stocksResult.data?.data) {
        setStocks(stocksResult.data.data.stocks);
        setMarketState(stocksResult.data.data.marketState);
      }

      if (holdingsResult.data?.data) {
        setHoldings(holdingsResult.data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [playerCompanyId]);

  useEffect(() => {
    loadStockData();

    // 每5秒刷新一次
    const interval = setInterval(loadStockData, 5000);
    return () => clearInterval(interval);
  }, [loadStockData]);

  // 提交交易
  const handleSubmitOrder = async () => {
    if (!selectedStock) return;

    setTradeSubmitting(true);
    try {
      const result = await api.submitStockOrder(
        playerCompanyId,
        selectedStock.companyId,
        tradeForm.orderType,
        tradeForm.side,
        tradeForm.quantity,
        tradeForm.orderType === 'limit' ? tradeForm.limitPrice : undefined
      );

      if (result.error) {
        alert(`交易失败: ${result.error}`);
      } else if (result.data?.data?.success) {
        alert('订单已提交');
        loadStockData();
      } else {
        alert(`交易失败: ${result.data?.data?.error || '未知错误'}`);
      }
    } catch (err) {
      alert(`交易失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setTradeSubmitting(false);
    }
  };

  // 缓存计算结果
  const marketOverviewData = useMemo(() => {
    if (!marketState) return null;
    const sentiment = sentimentLabels[marketState.sentiment] || sentimentLabels.neutral;
    const indexChange = ((marketState.marketIndex - marketState.indexBase) / marketState.indexBase) * 100;
    return { sentiment, indexChange };
  }, [marketState]);

  // 渲染市场概览
  const renderMarketOverview = useCallback(() => {
    if (!marketState || !marketOverviewData) return null;

    const { sentiment, indexChange } = marketOverviewData;

    return (
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-gray-400">综合指数</div>
            <div className="text-2xl font-bold flex items-center">
              {marketState.marketIndex.toFixed(2)}
              <span className={`ml-2 text-sm ${indexChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {indexChange >= 0 ? '+' : ''}{indexChange.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">市场情绪</div>
            <div className={`text-xl ${sentiment.color}`}>
              {sentiment.icon} {sentiment.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">成交额</div>
            <div className="text-lg">{formatMoney(marketState.dailyTurnover / 100)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-red-500 text-xl font-bold">{marketState.advancers}</div>
            <div className="text-xs text-gray-400">上涨</div>
          </div>
          <div>
            <div className="text-gray-400 text-xl font-bold">{marketState.unchanged}</div>
            <div className="text-xs text-gray-400">平盘</div>
          </div>
          <div>
            <div className="text-green-500 text-xl font-bold">{marketState.decliners}</div>
            <div className="text-xs text-gray-400">下跌</div>
          </div>
        </div>

        {(marketState.limitUpStocks.length > 0 || marketState.limitDownStocks.length > 0) && (
          <div className="mt-3 pt-3 border-t border-gray-700 text-sm">
            {marketState.limitUpStocks.length > 0 && (
              <div className="text-red-500">涨停: {marketState.limitUpStocks.length} 只</div>
            )}
            {marketState.limitDownStocks.length > 0 && (
              <div className="text-green-500">跌停: {marketState.limitDownStocks.length} 只</div>
            )}
          </div>
        )}
      </div>
    );
  }, [marketState, marketOverviewData]);

  // 渲染股票行 - 提取为独立组件方便优化
  const StockRow = memo(function StockRow({
    stock,
    isSelected,
    onSelect,
    onDoubleClick,
  }: {
    stock: Stock;
    isSelected: boolean;
    onSelect: () => void;
    onDoubleClick: () => void;
  }) {
    const priceChange = stock.priceChangePercent * 100;
    const isUp = priceChange > 0;
    const isDown = priceChange < 0;
    const status = statusLabels[stock.status] || statusLabels.trading;

    return (
      <tr
        className={`border-b border-gray-700 hover:bg-gray-700 cursor-pointer ${
          isSelected ? 'bg-gray-600' : ''
        }`}
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
      >
        <td className="px-3 py-2">
          <div className="font-mono font-bold">{stock.ticker}</div>
        </td>
        <td className={`px-3 py-2 text-right font-mono ${isUp ? 'text-red-500' : isDown ? 'text-green-500' : ''}`}>
          {(stock.currentPrice / 100).toFixed(2)}
        </td>
        <td className={`px-3 py-2 text-right ${isUp ? 'text-red-500' : isDown ? 'text-green-500' : ''}`}>
          {isUp ? '+' : ''}{priceChange.toFixed(2)}%
        </td>
        <td className="px-3 py-2 text-right text-gray-400">
          {(stock.volume / 10000).toFixed(1)}万
        </td>
        <td className="px-3 py-2 text-right text-gray-400">
          {(stock.marketCap / 100000000).toFixed(2)}亿
        </td>
        <td className="px-3 py-2 text-right text-gray-400">
          {stock.peRatio.toFixed(1)}
        </td>
        <td className="px-3 py-2 text-center">
          <span className={`px-2 py-0.5 rounded text-xs ${status.color} text-white`}>
            {status.label}
          </span>
        </td>
      </tr>
    );
  });

  // 渲染股票列表
  const renderStockList = useCallback(() => (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* 操作提示 */}
      <div className="px-3 py-2 bg-gray-700/50 text-xs text-gray-400 flex items-center gap-4 border-b border-gray-600">
        <span>💡 单击选择股票</span>
        <span>🔍 双击查看详情（K线图、盘口、成交记录）</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-3 py-2 text-left">代码</th>
            <th className="px-3 py-2 text-right">最新价</th>
            <th className="px-3 py-2 text-right">涨跌幅</th>
            <th className="px-3 py-2 text-right">成交量</th>
            <th className="px-3 py-2 text-right">市值</th>
            <th className="px-3 py-2 text-right">PE</th>
            <th className="px-3 py-2 text-center">状态</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <StockRow
              key={stock.companyId}
              stock={stock}
              isSelected={selectedStock?.companyId === stock.companyId}
              onSelect={() => {
                setSelectedStock(stock);
                setTradeForm((prev) => ({
                  ...prev,
                  limitPrice: stock.currentPrice / 100,
                }));
              }}
              onDoubleClick={() => {
                setSelectedStock(stock);
                setShowDetailPanel(true);
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  ), [stocks, selectedStock, setSelectedStock, setTradeForm, setShowDetailPanel]);

  // 缓存持仓统计
  const holdingsStats = useMemo(() => {
    const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const totalPnL = holdings.reduce((sum, h) => sum + h.unrealizedPnL, 0);
    return { totalValue, totalPnL };
  }, [holdings]);

  // 渲染持仓列表
  const renderHoldings = useCallback(() => {
    const { totalValue, totalPnL } = holdingsStats;

    return (
      <div>
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400">持仓市值</div>
              <div className="text-xl font-bold">{formatMoney(totalValue / 100)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">浮动盈亏</div>
              <div className={`text-xl font-bold ${totalPnL >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {totalPnL >= 0 ? '+' : ''}{formatMoney(totalPnL / 100)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">股票</th>
                <th className="px-3 py-2 text-right">持股</th>
                <th className="px-3 py-2 text-right">成本</th>
                <th className="px-3 py-2 text-right">现价</th>
                <th className="px-3 py-2 text-right">市值</th>
                <th className="px-3 py-2 text-right">盈亏</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => {
                const isProfit = holding.unrealizedPnL >= 0;

                return (
                  <tr
                    key={`${holding.holderId}-${holding.companyId}`}
                    className="border-b border-gray-700 hover:bg-gray-700 cursor-pointer"
                    onClick={() => {
                      const stock = stocks.find((s) => s.companyId === holding.companyId);
                      if (stock) {
                        setSelectedStock(stock);
                        setActiveTab('trade');
                      }
                    }}
                  >
                    <td className="px-3 py-2">
                      <div className="font-mono font-bold">{holding.ticker}</div>
                      <div className="text-xs text-gray-400">{(holding.sharePercent * 100).toFixed(2)}%</div>
                    </td>
                    <td className="px-3 py-2 text-right">{holding.shares.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {(holding.avgCostPrice / 100).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(holding.currentPrice / 100).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatMoney(holding.marketValue / 100)}</td>
                    <td className={`px-3 py-2 text-right ${isProfit ? 'text-red-500' : 'text-green-500'}`}>
                      {isProfit ? '+' : ''}{formatMoney(holding.unrealizedPnL / 100)}
                      <div className="text-xs">
                        ({isProfit ? '+' : ''}{(holding.pnLPercent * 100).toFixed(2)}%)
                      </div>
                    </td>
                  </tr>
                );
              })}
              {holdings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    暂无持仓
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [holdings, holdingsStats, stocks, setSelectedStock, setActiveTab]);

  // 渲染交易面板
  const renderTradePanel = () => {
    if (!selectedStock) {
      return (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-500">
          请从市场列表中选择一只股票
        </div>
      );
    }

    const priceChange = selectedStock.priceChangePercent * 100;
    const isUp = priceChange > 0;
    const isDown = priceChange < 0;
    const currentHolding = holdings.find((h) => h.companyId === selectedStock.companyId);

    return (
      <div className="bg-gray-800 rounded-lg p-4">
        {/* 股票信息头 */}
        <div className="mb-4 pb-4 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xl font-bold font-mono">{selectedStock.ticker}</div>
              <div className="text-sm text-gray-400">{selectedStock.companyId}</div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${isUp ? 'text-red-500' : isDown ? 'text-green-500' : ''}`}>
                ¥{(selectedStock.currentPrice / 100).toFixed(2)}
              </div>
              <div className={`text-sm ${isUp ? 'text-red-500' : isDown ? 'text-green-500' : ''}`}>
                {isUp ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3 text-sm">
            <div>
              <span className="text-gray-400">开盘:</span>
              <span className="ml-1">{(selectedStock.openPrice / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-400">最高:</span>
              <span className="ml-1 text-red-400">{(selectedStock.highPrice / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-400">最低:</span>
              <span className="ml-1 text-green-400">{(selectedStock.lowPrice / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-400">昨收:</span>
              <span className="ml-1">{(selectedStock.previousClose / 100).toFixed(2)}</span>
            </div>
          </div>

          {currentHolding && (
            <div className="mt-3 p-2 bg-gray-700 rounded text-sm">
              <span className="text-gray-400">持仓:</span>
              <span className="ml-2">{currentHolding.shares.toLocaleString()} 股</span>
              <span className="ml-4 text-gray-400">成本:</span>
              <span className="ml-1">¥{(currentHolding.avgCostPrice / 100).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* 交易表单 */}
        <div className="space-y-4">
          {/* 买卖方向 */}
          <div className="flex gap-2">
            <button
              className={`flex-1 py-2 rounded font-bold ${
                tradeForm.side === 'buy'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setTradeForm((prev) => ({ ...prev, side: 'buy' }))}
            >
              买入
            </button>
            <button
              className={`flex-1 py-2 rounded font-bold ${
                tradeForm.side === 'sell'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setTradeForm((prev) => ({ ...prev, side: 'sell' }))}
            >
              卖出
            </button>
          </div>

          {/* 订单类型 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">订单类型</label>
            <select
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              value={tradeForm.orderType}
              onChange={(e) =>
                setTradeForm((prev) => ({
                  ...prev,
                  orderType: e.target.value as 'market' | 'limit',
                }))
              }
            >
              <option value="market">市价单</option>
              <option value="limit">限价单</option>
            </select>
          </div>

          {/* 限价 */}
          {tradeForm.orderType === 'limit' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">限价 (元)</label>
              <input
                type="number"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                value={tradeForm.limitPrice}
                onChange={(e) =>
                  setTradeForm((prev) => ({ ...prev, limitPrice: parseFloat(e.target.value) || 0 }))
                }
                step="0.01"
                min="0"
              />
            </div>
          )}

          {/* 数量 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">数量 (股)</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2"
                value={tradeForm.quantity}
                onChange={(e) =>
                  setTradeForm((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))
                }
                step="100"
                min="100"
              />
              <button
                className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
                onClick={() =>
                  setTradeForm((prev) => ({
                    ...prev,
                    quantity: Math.max(100, (currentHolding?.shares || 1000) / 4),
                  }))
                }
              >
                1/4
              </button>
              <button
                className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
                onClick={() =>
                  setTradeForm((prev) => ({
                    ...prev,
                    quantity: Math.max(100, (currentHolding?.shares || 1000) / 2),
                  }))
                }
              >
                1/2
              </button>
              <button
                className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
                onClick={() =>
                  setTradeForm((prev) => ({
                    ...prev,
                    quantity: currentHolding?.shares || 1000,
                  }))
                }
              >
                全部
              </button>
            </div>
          </div>

          {/* 预估金额 */}
          <div className="text-sm text-gray-400">
            预估金额: ¥
            {(
              (tradeForm.orderType === 'limit'
                ? tradeForm.limitPrice * 100
                : selectedStock.currentPrice) *
              tradeForm.quantity /
              100
            ).toLocaleString()}
          </div>

          {/* 提交按钮 */}
          <button
            className={`w-full py-3 rounded font-bold disabled:opacity-50 ${
              tradeForm.side === 'buy'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
            onClick={handleSubmitOrder}
            disabled={tradeSubmitting || selectedStock.status !== 'trading'}
          >
            {tradeSubmitting
              ? '提交中...'
              : `${tradeForm.side === 'buy' ? '买入' : '卖出'} ${tradeForm.quantity} 股`}
          </button>
        </div>
      </div>
    );
  };

  if (loading && stocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载股市数据中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-400 mb-4">{error}</div>
        <button
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          onClick={loadStockData}
        >
          重试
        </button>
      </div>
    );
  }

  // 渲染订单管理标签
  const renderOrdersTab = () => (
    <OrderManagement
      companyId={playerCompanyId}
      onOrderCancelled={loadStockData}
      className="h-full"
    />
  );

  return (
    <div className="h-full flex flex-col relative">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">📈 股票市场</h2>
        <div className="flex gap-2">
          <button
            className={`px-4 py-1.5 rounded ${
              activeTab === 'market' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            onClick={() => setActiveTab('market')}
          >
            行情
          </button>
          <button
            className={`px-4 py-1.5 rounded ${
              activeTab === 'holdings' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            onClick={() => setActiveTab('holdings')}
          >
            持仓
          </button>
          <button
            className={`px-4 py-1.5 rounded ${
              activeTab === 'trade' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            onClick={() => setActiveTab('trade')}
          >
            交易
          </button>
          <button
            className={`px-4 py-1.5 rounded ${
              activeTab === 'orders' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            onClick={() => setActiveTab('orders')}
          >
            委托
          </button>
        </div>
      </div>

      {/* 市场概览 */}
      {renderMarketOverview()}

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'market' && renderStockList()}
        {activeTab === 'holdings' && renderHoldings()}
        {activeTab === 'trade' && renderTradePanel()}
        {activeTab === 'orders' && renderOrdersTab()}
      </div>

      {/* 股票详情弹窗 */}
      {showDetailPanel && selectedStock && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl max-h-full overflow-auto">
            <StockDetailPanel
              stockId={selectedStock.companyId}
              playerId={playerCompanyId}
              onClose={() => setShowDetailPanel(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// 使用 memo 包装导出组件
export default memo(StockMarket);