/**
 * Building Shop Component - Purchase new buildings
 *
 * 优化：支持"先购买后囤积材料"模式
 * - 购买时只需资金充足
 * - 显示建造材料需求（仅作参考）
 * - 材料不足时建筑进入"等待材料"状态
 *
 * 真实成本系统：
 * - 材料成本 = Σ(材料数量 × 市场价格)
 * - 人工成本 = 基础人工 × 规模系数 × 复杂度系数
 * - 总成本 = 材料成本 + 人工成本
 */

import { useState, useMemo } from 'react';
import {
  BUILDINGS_BY_CATEGORY,
  type BuildingData,
  GOODS_MAP,
  getConstructionMaterials,
  getBuildingDef,
  calculateConstructionCost,
  CONSTRUCTION_MATERIALS_BY_SIZE,
  CONSTRUCTION_TIME_BY_SIZE
} from '@scc/shared';
import { useGameStore, useInventory } from '../../stores/gameStore';
import { gameWebSocket } from '../../services/websocket';
import { formatMoney } from '../../utils/formatters';

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

// 获取建造材料的辅助函数（客户端版本）
function getBuildingConstructionMaterials(building: BuildingData): Array<{ goodsId: string; amount: number }> {
  // 尝试使用 shared 包的函数
  try {
    const materials = getConstructionMaterials(building as any);
    if (materials && materials.length > 0) {
      return materials;
    }
  } catch {
    // 忽略错误，使用备用逻辑
  }
  // 备用：根据建筑规模返回默认材料
  return CONSTRUCTION_MATERIALS_BY_SIZE[building.size] ?? [];
}

// 获取建造时间
function getBuildingConstructionTime(building: BuildingData): number {
  return CONSTRUCTION_TIME_BY_SIZE[building.size] ?? 7;
}

export function BuildingShop({ onClose }: BuildingShopProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('extraction');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  
  const playerCash = useGameStore((state) => state.playerCompany?.cash ?? 0);
  const inventory = useInventory();
  const marketPrices = useGameStore((state) => state.marketPrices ?? {});
  
  // 获取商品库存数量
  const getInventoryQuantity = (goodsId: string): number => {
    if (!inventory?.stocks) return 0;
    const stock = inventory.stocks.find(s => s.goodsId === goodsId);
    return stock?.quantity ?? 0;
  };
  
  // 计算建筑的真实建造成本
  const calculateRealCost = (building: BuildingData): {
    materialCost: number;
    laborCost: number;
    totalCost: number;
    materialDetails: Array<{ goodsId: string; amount: number; unitPrice: number; subtotal: number }>;
  } => {
    const buildingDef = getBuildingDef(building.id);
    if (!buildingDef) {
      // 回退到旧的 baseCost
      return {
        materialCost: building.baseCost,
        laborCost: 0,
        totalCost: building.baseCost,
        materialDetails: [],
      };
    }
    
    const result = calculateConstructionCost(buildingDef, marketPrices);
    return {
      materialCost: result.materialCost,
      laborCost: result.laborCost,
      totalCost: result.totalCost,
      materialDetails: result.materialDetails,
    };
  };
  
  const categoryBuildings = useMemo(() => {
    return BUILDINGS_BY_CATEGORY[selectedCategory as keyof typeof BUILDINGS_BY_CATEGORY] ?? [];
  }, [selectedCategory]);
  
  const handlePurchase = async (building: BuildingData) => {
    const realCost = calculateRealCost(building);
    // 注意：只需要人工费作为现金支付，材料通过库存消耗
    if (playerCash < realCost.laborCost) {
      alert(`资金不足！需要 ${formatMoney(realCost.laborCost)} 人工费`);
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
              // 计算真实成本
              const realCost = calculateRealCost(building);
              // 只检查人工费（现金支付），材料通过库存消耗
              const canAffordLabor = playerCash >= realCost.laborCost;
              const isPurchasing = purchasing === building.id;
              
              // 获取建造材料需求
              const constructionMaterials = getBuildingConstructionMaterials(building);
              const constructionTime = getBuildingConstructionTime(building);
              
              // 检查材料是否充足
              const materialStatus = constructionMaterials.map(mat => {
                const available = getInventoryQuantity(mat.goodsId);
                const goodsData = GOODS_MAP.get(mat.goodsId);
                const priceInfo = realCost.materialDetails.find(d => d.goodsId === mat.goodsId);
                return {
                  goodsId: mat.goodsId,
                  goodsName: goodsData?.nameZh ?? mat.goodsId,
                  goodsIcon: goodsData?.icon ?? '📦',
                  needed: mat.amount,
                  available,
                  sufficient: available >= mat.amount,
                  unitPrice: priceInfo?.unitPrice ?? 0,
                  subtotal: priceInfo?.subtotal ?? 0,
                };
              });
              
              const hasAllMaterials = materialStatus.every(m => m.sufficient);
              
              return (
                <div
                  key={building.id}
                  className={`p-4 rounded-xl border transition-all ${
                    canAffordLabor
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
                        <div className="text-right">
                          <span className={`text-sm font-bold ${canAffordLabor ? 'text-green-400' : 'text-red-400'}`}>
                            人工 {formatMoney(realCost.laborCost)}
                          </span>
                          <div className="text-xs text-gray-500">
                            + 材料费约 {formatMoney(realCost.materialCost)}
                          </div>
                        </div>
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
                        <span className="text-gray-500">
                          建造: {constructionTime}天
                        </span>
                      </div>
                      
                      {/* Construction Materials */}
                      {constructionMaterials.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-600/50">
                          <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                            <span>🔧 建造材料:</span>
                            {!hasAllMaterials && (
                              <span className="text-yellow-400 text-xs">(材料不足将等待囤积)</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {materialStatus.map(mat => (
                              <div
                                key={mat.goodsId}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                                  mat.sufficient
                                    ? 'bg-green-900/30 text-green-400'
                                    : 'bg-yellow-900/30 text-yellow-400'
                                }`}
                                title={`需要 ${mat.needed}个，库存 ${mat.available.toFixed(0)}，单价 ${formatMoney(mat.unitPrice)}，小计 ${formatMoney(mat.subtotal)}`}
                              >
                                <span>{mat.goodsIcon}</span>
                                <span>{mat.goodsName}</span>
                                <span className="font-mono">
                                  {mat.available.toFixed(0)}/{mat.needed}
                                </span>
                                {mat.sufficient ? '✓' : '⏳'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Purchase Button */}
                  <button
                    onClick={() => handlePurchase(building)}
                    disabled={!canAffordLabor || isPurchasing}
                    className={`w-full mt-3 py-2 rounded-lg font-medium transition-all ${
                      isPurchasing
                        ? 'bg-cyan-600 text-white cursor-wait'
                        : canAffordLabor
                          ? hasAllMaterials
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/25'
                            : 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white hover:shadow-lg hover:shadow-yellow-500/25'
                          : 'bg-slate-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isPurchasing
                      ? '购买中...'
                      : canAffordLabor
                        ? hasAllMaterials
                          ? '立即建造'
                          : '购买 (等待材料)'
                        : '资金不足'}
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