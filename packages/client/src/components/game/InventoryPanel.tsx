/**
 * InventoryPanel - 库存管理面板
 * 显示玩家公司的商品库存和交易功能
 * 通过 WebSocket 实时更新库存数据
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameStore, useInventory, type InventoryStockItem } from '../../stores';

interface InventoryPanelProps {
  onClose: () => void;
}

export function InventoryPanel({ onClose }: InventoryPanelProps) {
  const gameId = useGameStore((state) => state.gameId);
  // 从 store 获取实时库存数据（通过 WebSocket tick 更新）
  const inventory = useInventory();
  const [selectedGoodsId, setSelectedGoodsId] = useState<string | null>(null);
  const [sellQuantity, setSellQuantity] = useState<number>(1);
  const [sellPrice, setSellPrice] = useState<number>(1000);
  const [error, setError] = useState<string | null>(null);

  // 首次加载时获取库存（作为 fallback）
  const [initialLoading, setInitialLoading] = useState(true);
  
  const fetchInventory = useCallback(async () => {
    if (!gameId) return;
    
    try {
      // 这个请求仅在首次加载时使用，之后依赖 WebSocket 实时更新
      const response = await fetch(`/api/v1/games/${gameId}/inventory`);
      if (!response.ok) {
        // 如果 API 失败，不设置错误，因为 WebSocket 会提供数据
        console.warn('初始库存加载失败，等待 WebSocket 更新');
      }
    } catch (err) {
      console.warn('初始库存加载失败:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    // 仅在首次挂载时获取一次（WebSocket 可能还没有发送第一个 tick）
    if (initialLoading && !inventory) {
      fetchInventory();
    } else {
      setInitialLoading(false);
    }
  }, [fetchInventory, initialLoading, inventory]);

  const formatMoney = (cents: number | undefined | null) => {
    // Handle undefined, null, or NaN values
    if (cents === undefined || cents === null || !Number.isFinite(cents)) {
      return '¥0';
    }
    const value = cents / 100;
    if (Math.abs(value) >= 1000000) {
      return `¥${(value / 1000000).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `¥${(value / 1000).toFixed(2)}K`;
    }
    return `¥${value.toFixed(2)}`;
  };

  const handleSubmitSellOrder = async () => {
    if (!gameId || !selectedGoodsId) return;
    
    try {
      const response = await fetch(`/api/v1/games/${gameId}/orders/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goodsId: selectedGoodsId,
          quantity: sellQuantity,
          minPrice: sellPrice,
        }),
      });
      
      if (response.ok) {
        setSelectedGoodsId(null);
        fetchInventory();
      } else {
        const data = await response.json();
        setError(data.error || '下单失败');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError('网络错误');
      setTimeout(() => setError(null), 3000);
    }
  };

  const selectedStock = inventory?.stocks.find((s: InventoryStockItem) => s.goodsId === selectedGoodsId);
  
  // 判断是否正在加载（首次加载且没有数据）
  const loading = initialLoading && !inventory;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📦</span>
            <h2 className="text-xl font-bold text-white">公司库存</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Summary */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">库存总价值</div>
              <div className="text-2xl font-bold text-amber-400">
                {inventory ? formatMoney(inventory.totalValue) : '¥0'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">商品种类</div>
              <div className="text-xl font-medium text-white">
                {inventory?.stocks.length ?? 0} 种
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin text-4xl mb-2">⏳</div>
              <p>正在加载库存数据...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">
              <div className="text-4xl mb-2">⚠️</div>
              <p>{error}</p>
            </div>
          ) : !inventory || inventory.stocks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <p>库存为空</p>
              <p className="text-sm">生产完成后商品将存入库存</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="grid grid-cols-6 gap-2 text-xs text-gray-500 px-3 py-2 bg-slate-700/30 rounded">
                <div className="col-span-2">商品</div>
                <div className="text-right">可用</div>
                <div className="text-right">预留出售</div>
                <div className="text-right">平均成本</div>
                <div className="text-right">市场价值</div>
              </div>
              
              {/* Table Rows */}
              {inventory.stocks.map((stock: InventoryStockItem) => (
                <div
                  key={stock.goodsId}
                  onClick={() => {
                    setSelectedGoodsId(stock.goodsId === selectedGoodsId ? null : stock.goodsId);
                    if (stock.goodsId !== selectedGoodsId) {
                      setSellQuantity(Math.min(stock.quantity, 10));
                      setSellPrice(Math.round(stock.marketValue / (stock.quantity + stock.reservedForSale + stock.reservedForProduction) || stock.avgCost * 1.1));
                    }
                  }}
                  className={`grid grid-cols-6 gap-2 text-sm px-3 py-3 rounded cursor-pointer transition-colors ${
                    selectedGoodsId === stock.goodsId 
                      ? 'bg-amber-900/40 border border-amber-500/50' 
                      : 'bg-slate-700/20 hover:bg-slate-700/40'
                  }`}
                >
                  <div className="col-span-2 text-white font-medium truncate" title={stock.goodsName}>
                    {stock.goodsName}
                  </div>
                  <div className="text-right text-green-400 font-medium">
                    {stock.quantity.toFixed(1)}
                  </div>
                  <div className="text-right text-orange-400">
                    {stock.reservedForSale > 0 ? stock.reservedForSale.toFixed(1) : '-'}
                  </div>
                  <div className="text-right text-gray-400">
                    {formatMoney(stock.avgCost)}
                  </div>
                  <div className="text-right text-amber-400 font-medium">
                    {formatMoney(stock.marketValue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sell Order Form */}
        {selectedGoodsId && selectedStock && selectedStock.quantity > 0 && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50">
            <h4 className="text-sm font-semibold text-gray-400 mb-3">
              挂卖单 - {selectedStock.goodsName}
            </h4>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">数量</label>
                <input
                  type="number"
                  min={1}
                  max={selectedStock.quantity}
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(Math.min(selectedStock.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">最低单价（分）</label>
                <input
                  type="number"
                  min={1}
                  value={sellPrice}
                  onChange={(e) => setSellPrice(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-amber-500 outline-none"
                />
              </div>
              <button
                onClick={handleSubmitSellOrder}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded transition-colors"
              >
                挂单出售
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="text-xs text-gray-500 text-center">
            点击商品行可以挂卖单出售 · 预留出售 = 已挂卖单但未成交的数量
          </div>
        </div>
      </div>
    </div>
  );
}