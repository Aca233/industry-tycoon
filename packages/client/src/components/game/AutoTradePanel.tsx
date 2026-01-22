/**
 * AutoTradePanel - 自动交易控制面板
 * 允许玩家开关自动交易、配置商品阈值
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { useGameStore } from '../../stores';
import { GOODS_DATA } from '@scc/shared';

// 类型定义
interface AutoBuyConfig {
  enabled: boolean;
  triggerThreshold: number;
  targetStock: number;
  maxPriceMultiplier: number;
}

interface AutoSellConfig {
  enabled: boolean;
  triggerThreshold: number;
  reserveStock: number;
  minPriceMultiplier: number;
}

interface GoodsAutoTradeConfig {
  goodsId: string;
  autoBuy: AutoBuyConfig;
  autoSell: AutoSellConfig;
}

interface AutoTradeAction {
  type: 'buy' | 'sell';
  goodsId: string;
  quantity: number;
  price: number;
  success: boolean;
  message?: string;
}

interface AutoTradeStatus {
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

export function AutoTradePanel() {
  const [status, setStatus] = useState<AutoTradeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGoods, setExpandedGoods] = useState<Set<string>>(new Set());
  
  const gameId = useGameStore((state) => state.gameId);
  
  // 获取商品名称
  const getGoodsName = useCallback((goodsId: string): string => {
    const goods = GOODS_DATA.find(g => g.id === goodsId);
    return goods?.nameZh || goods?.name || goodsId;
  }, []);
  
  // 获取状态
  const fetchStatus = useCallback(async () => {
    if (!gameId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await api.getAutoTradeStatus(gameId);
      if (result.data) {
        setStatus(result.data);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取状态失败');
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);
  
  // 初始加载
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);
  
  // 切换启用状态
  const handleToggle = async () => {
    if (!gameId || !status) return;
    
    setIsLoading(true);
    try {
      const result = await api.toggleAutoTrade(gameId, !status.enabled);
      if (result.data?.status) {
        setStatus(result.data.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换失败');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 自动配置
  const handleAutoConfigure = async () => {
    if (!gameId) return;
    
    setIsLoading(true);
    try {
      const result = await api.autoConfigureAutoTrade(gameId);
      if (result.data?.status) {
        setStatus(result.data.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '自动配置失败');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 更新商品配置
  const handleUpdateConfig = async (
    goodsId: string,
    configType: 'autoBuy' | 'autoSell',
    field: string,
    value: boolean | number
  ) => {
    if (!gameId) return;
    
    try {
      const config = {
        [configType]: {
          [field]: value,
        },
      };
      
      const result = await api.updateAutoTradeGoodsConfig(gameId, goodsId, config);
      if (result.data?.status) {
        setStatus(result.data.status);
      }
    } catch (err) {
      console.error('更新配置失败:', err);
    }
  };
  
  // 切换展开
  const toggleExpanded = (goodsId: string) => {
    setExpandedGoods(prev => {
      const next = new Set(prev);
      if (next.has(goodsId)) {
        next.delete(goodsId);
      } else {
        next.add(goodsId);
      }
      return next;
    });
  };
  
  // 格式化金额
  const formatMoney = (value: number | undefined | null): string => {
    // Handle undefined, null, or NaN values
    if (value === undefined || value === null || !Number.isFinite(value)) {
      return '¥0';
    }
    if (value >= 1000000) {
      return `¥${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `¥${(value / 1000).toFixed(1)}K`;
    }
    return `¥${value.toFixed(0)}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
      {/* 标题和主开关 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h3 className="text-lg font-semibold text-white">自动交易</h3>
          {status?.enabled && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              运行中
            </span>
          )}
        </div>
        
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${status?.enabled ? 'bg-cyan-600' : 'bg-slate-600'}
            ${isLoading ? 'opacity-50' : 'hover:brightness-110'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${status?.enabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>
      
      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {/* 统计信息 */}
      {status && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-800 rounded p-2 text-center">
            <div className="text-xs text-gray-400">配置商品</div>
            <div className="text-lg font-bold text-cyan-400">
              {status.goodsConfigs.length}
            </div>
          </div>
          <div className="bg-slate-800 rounded p-2 text-center">
            <div className="text-xs text-gray-400">活跃订单</div>
            <div className="text-lg font-bold text-yellow-400">
              {status.activeOrders.buyOrders + status.activeOrders.sellOrders}
            </div>
          </div>
          <div className="bg-slate-800 rounded p-2 text-center">
            <div className="text-xs text-gray-400">订单价值</div>
            <div className="text-lg font-bold text-green-400">
              {formatMoney(status.activeOrders.totalValue)}
            </div>
          </div>
        </div>
      )}
      
      {/* 快捷操作 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleAutoConfigure}
          disabled={isLoading}
          className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded text-sm transition-colors disabled:opacity-50"
        >
          🔄 根据建筑自动配置
        </button>
        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded text-sm transition-colors disabled:opacity-50"
        >
          🔃
        </button>
      </div>
      
      {/* 最近动作 */}
      {status && status.lastActions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm text-gray-400 mb-2">最近交易</h4>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {status.lastActions.slice(0, 5).map((action, idx) => (
              <div
                key={idx}
                className={`
                  flex items-center justify-between px-2 py-1 rounded text-xs
                  ${action.success 
                    ? (action.type === 'buy' ? 'bg-blue-500/10 text-blue-300' : 'bg-green-500/10 text-green-300')
                    : 'bg-red-500/10 text-red-300'
                  }
                `}
              >
                <span>
                  {action.type === 'buy' ? '📥' : '📤'}{' '}
                  {getGoodsName(action.goodsId)}
                </span>
                <span>
                  {action.quantity.toFixed(0)} @ {formatMoney(action.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 商品配置列表 */}
      {status && status.goodsConfigs.length > 0 && (
        <div>
          <h4 className="text-sm text-gray-400 mb-2">商品配置</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {status.goodsConfigs.map((config) => (
              <div
                key={config.goodsId}
                className="bg-slate-800 rounded border border-slate-700"
              >
                {/* 商品头部 */}
                <div
                  onClick={() => toggleExpanded(config.goodsId)}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">
                      {getGoodsName(config.goodsId)}
                    </span>
                    <div className="flex gap-1">
                      {config.autoBuy.enabled && (
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                          买
                        </span>
                      )}
                      {config.autoSell.enabled && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                          卖
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm">
                    {expandedGoods.has(config.goodsId) ? '▼' : '▶'}
                  </span>
                </div>
                
                {/* 展开的配置详情 */}
                {expandedGoods.has(config.goodsId) && (
                  <div className="px-3 py-2 border-t border-slate-700 space-y-3">
                    {/* 自动采购配置 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-400">📥 自动采购</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.autoBuy.enabled}
                            onChange={(e) => handleUpdateConfig(config.goodsId, 'autoBuy', 'enabled', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-cyan-600 focus:ring-cyan-500"
                          />
                        </label>
                      </div>
                      {config.autoBuy.enabled && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-gray-500">触发阈值</label>
                            <input
                              type="number"
                              value={config.autoBuy.triggerThreshold}
                              onChange={(e) => handleUpdateConfig(config.goodsId, 'autoBuy', 'triggerThreshold', Number(e.target.value))}
                              className="w-full mt-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="text-gray-500">目标库存</label>
                            <input
                              type="number"
                              value={config.autoBuy.targetStock}
                              onChange={(e) => handleUpdateConfig(config.goodsId, 'autoBuy', 'targetStock', Number(e.target.value))}
                              className="w-full mt-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 自动销售配置 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-green-400">📤 自动销售</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.autoSell.enabled}
                            onChange={(e) => handleUpdateConfig(config.goodsId, 'autoSell', 'enabled', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-cyan-600 focus:ring-cyan-500"
                          />
                        </label>
                      </div>
                      {config.autoSell.enabled && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-gray-500">触发阈值</label>
                            <input
                              type="number"
                              value={config.autoSell.triggerThreshold}
                              onChange={(e) => handleUpdateConfig(config.goodsId, 'autoSell', 'triggerThreshold', Number(e.target.value))}
                              className="w-full mt-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="text-gray-500">保留库存</label>
                            <input
                              type="number"
                              value={config.autoSell.reserveStock}
                              onChange={(e) => handleUpdateConfig(config.goodsId, 'autoSell', 'reserveStock', Number(e.target.value))}
                              className="w-full mt-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 空状态 */}
      {status && status.goodsConfigs.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">尚未配置任何商品</p>
          <p className="text-xs mt-1">点击"根据建筑自动配置"快速开始</p>
        </div>
      )}
      
      {/* 加载状态 */}
      {isLoading && !status && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      )}
    </div>
  );
}