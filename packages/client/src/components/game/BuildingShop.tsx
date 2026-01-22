/**
 * Building Shop Component - Purchase new buildings
 */

import { useState, useMemo } from 'react';
import { BUILDINGS_BY_CATEGORY, type BuildingData } from '@scc/shared';
import { useGameStore } from '../../stores/gameStore';
import { gameWebSocket } from '../../services/websocket';

interface BuildingShopProps {
  onClose: () => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  extraction: '资源开采',
  processing: '基础加工',
  manufacturing: '高端制造',
  service: '服务设施',
  retail: '零售消费',
  agriculture: '农业畜牧',
};

const CATEGORY_COLORS: Record<string, string> = {
  extraction: 'from-amber-500 to-orange-600',
  processing: 'from-green-500 to-emerald-600',
  manufacturing: 'from-purple-500 to-indigo-600',
  service: 'from-cyan-500 to-blue-600',
  retail: 'from-pink-500 to-rose-600',
  agriculture: 'from-lime-500 to-green-600',
};

export function BuildingShop({ onClose }: BuildingShopProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('extraction');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  
  const playerCash = useGameStore((state) => state.playerCompany?.cash ?? 0);
  
  const formatMoney = (cents: number | undefined | null) => {
    // Handle undefined, null, or NaN values
    if (cents === undefined || cents === null || !Number.isFinite(cents)) {
      return '¥0';
    }
    if (cents >= 100000000) {
      return `¥${(cents / 100000000).toFixed(1)}亿`;
    } else if (cents >= 10000) {
      return `¥${(cents / 10000).toFixed(0)}万`;
    }
    return `¥${cents}`;
  };
  
  const categoryBuildings = useMemo(() => {
    return BUILDINGS_BY_CATEGORY[selectedCategory as keyof typeof BUILDINGS_BY_CATEGORY] ?? [];
  }, [selectedCategory]);
  
  const handlePurchase = async (building: BuildingData) => {
    if (playerCash < building.baseCost) {
      alert('资金不足！');
      return;
    }
    
    setPurchasing(building.id);
    
    try {
      gameWebSocket.send('purchaseBuilding', { buildingId: building.id });
      
      // Wait for response
      await new Promise<void>((resolve) => {
        const unsubscribe = gameWebSocket.on('purchaseResult', (msg) => {
          const result = msg.payload as { success: boolean; error?: string };
          if (!result.success && result.error) {
            alert(`购买失败: ${result.error}`);
          }
          unsubscribe();
          resolve();
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          unsubscribe();
          resolve();
        }, 5000);
      });
    } finally {
      setPurchasing(null);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">建筑商店</h2>
            <p className="text-sm text-gray-400">选择要购买的建筑类型</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-400">可用资金</p>
              <p className="text-lg font-bold text-green-400">{formatMoney(playerCash)}</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Category Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-700">
          {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === key
                  ? `bg-gradient-to-r ${CATEGORY_COLORS[key]} text-white shadow-lg`
                  : 'bg-slate-700 text-gray-400 hover:text-white hover:bg-slate-600'
              }`}
            >
              {name}
              <span className="ml-2 text-xs opacity-70">
                ({BUILDINGS_BY_CATEGORY[key as keyof typeof BUILDINGS_BY_CATEGORY]?.length ?? 0})
              </span>
            </button>
          ))}
        </div>
        
        {/* Building List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryBuildings.map((building) => {
              const canAfford = playerCash >= building.baseCost;
              const isPurchasing = purchasing === building.id;
              
              return (
                <div
                  key={building.id}
                  className={`p-4 rounded-xl border transition-all ${
                    canAfford
                      ? 'bg-slate-700/50 border-slate-600 hover:border-cyan-500/50'
                      : 'bg-slate-800/50 border-slate-700 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="text-3xl w-12 h-12 flex items-center justify-center bg-slate-600 rounded-lg">
                      {building.icon}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white">{building.nameZh}</h3>
                        <span className={`text-sm ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                          {formatMoney(building.baseCost)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{building.description}</p>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-gray-500">
                          维护: {formatMoney(building.maintenanceCost)}/tick
                        </span>
                        <span className="text-gray-500">
                          工人: {building.maxWorkers}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          building.size === 'huge' ? 'bg-purple-500/20 text-purple-400' :
                          building.size === 'large' ? 'bg-blue-500/20 text-blue-400' :
                          building.size === 'medium' ? 'bg-green-500/20 text-green-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {building.size}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Purchase Button */}
                  <button
                    onClick={() => handlePurchase(building)}
                    disabled={!canAfford || isPurchasing}
                    className={`w-full mt-3 py-2 rounded-lg font-medium transition-all ${
                      isPurchasing
                        ? 'bg-cyan-600 text-white cursor-wait'
                        : canAfford
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/25'
                          : 'bg-slate-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isPurchasing ? '购买中...' : canAfford ? '购买建筑' : '资金不足'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}