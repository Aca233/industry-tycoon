/**
 * IndustryPanel - 工业产能概览面板
 * 提供直观的建筑管理和产业链视图
 *
 * 性能优化：
 * - 使用 React.memo 包装子组件避免不必要的重渲染
 * - 使用 useMemo 缓存计算结果
 * - 使用 useCallback 缓存回调函数
 */

import { useState, useMemo, useCallback, memo } from 'react';
import { useGameStore, useMarketPrices, useBuildingShortages, useInventory, useNavigateToEconomyGoods, type FinancialSummary, type BuildingProfit, type BuildingShortage, type InventorySnapshot } from '../../stores';
import { BUILDINGS_MAP, GOODS_MAP, type BuildingData, type ProductionMethodData, type ProductionSlotData } from '@scc/shared';
import type { EntityId, BuildingInstance } from '@scc/shared';
import { gameWebSocket } from '../../services/websocket';
import { formatMoney } from '../../utils/formatters';

// 获取生产方式的简短图标表示
const getMethodIcon = (method: ProductionMethodData): string => {
  // 根据方法名称推断图标
  const name = method.nameZh.toLowerCase();
  if (name.includes('手工') || name.includes('人工')) return '👐';
  if (name.includes('机械') || name.includes('自动')) return '⚙️';
  if (name.includes('高级') || name.includes('先进')) return '🔬';
  if (name.includes('节能') || name.includes('绿色')) return '🌿';
  if (name.includes('高效') || name.includes('快速')) return '⚡';
  if (name.includes('精密') || name.includes('精细')) return '🎯';
  // 默认使用第一个产出商品的图标
  const firstOutput = method.recipe.outputs[0];
  if (firstOutput) {
    return getGoodsIcon(firstOutput.goodsId);
  }
  return '🔧';
};

// 类别配置
const CATEGORY_CONFIG = {
  extraction: { name: '资源开采', icon: '⛏️', color: 'amber' },
  processing: { name: '基础加工', icon: '🏭', color: 'blue' },
  manufacturing: { name: '高端制造', icon: '🔧', color: 'purple' },
  service: { name: '服务设施', icon: '⚡', color: 'green' },
  retail: { name: '零售消费', icon: '🛒', color: 'pink' },
  agriculture: { name: '农业畜牧', icon: '🌾', color: 'lime' },
} as const;

type CategoryKey = keyof typeof CATEGORY_CONFIG;

// 获取商品名称
const getGoodsName = (goodsId: string): string => {
  const goods = GOODS_MAP.get(goodsId);
  return goods?.nameZh || goodsId;
};

// 获取商品图标
const getGoodsIcon = (goodsId: string): string => {
  const goods = GOODS_MAP.get(goodsId);
  return goods?.icon || '📦';
};

// formatMoney 现在从 utils/formatters 导入

// 停工状态配置
const SHUTDOWN_STATUS_CONFIG = {
  paused: {
    label: '已暂停',
    icon: '⏸️',
    color: 'gray',
    bgClass: 'bg-gray-600/30',
    textClass: 'text-gray-400',
    borderClass: 'border-gray-600/50',
    description: '工厂已手动暂停生产',
  },
  lacking_inputs: {
    label: '缺少原料',
    icon: '📦',
    color: 'red',
    bgClass: 'bg-red-600/30',
    textClass: 'text-red-400',
    borderClass: 'border-red-600/50',
    description: '生产所需的原材料不足',
  },
  lacking_workers: {
    label: '缺少工人',
    icon: '👷',
    color: 'orange',
    bgClass: 'bg-orange-600/30',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-600/50',
    description: '没有足够的工人进行生产',
  },
  lacking_energy: {
    label: '缺少电力',
    icon: '⚡',
    color: 'yellow',
    bgClass: 'bg-yellow-600/30',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-600/50',
    description: '电力供应不足，无法开工',
  },
  waiting_materials: {
    label: '等待材料',
    icon: '📦',
    color: 'cyan',
    bgClass: 'bg-cyan-600/30',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-600/50',
    description: '建筑已购买，正在等待建造材料囤积完成',
  },
  under_construction: {
    label: '建设中',
    icon: '🏗️',
    color: 'blue',
    bgClass: 'bg-blue-600/30',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-600/50',
    description: '建筑正在建设中',
  },
  upgrading: {
    label: '升级中',
    icon: '🔧',
    color: 'purple',
    bgClass: 'bg-purple-600/30',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-600/50',
    description: '建筑正在进行升级改造',
  },
} as const;

// 获取建筑停工状态信息
function getShutdownInfo(status: string): typeof SHUTDOWN_STATUS_CONFIG[keyof typeof SHUTDOWN_STATUS_CONFIG] | null {
  const normalizedStatus = status.toLowerCase().replace(/-/g, '_');
  if (normalizedStatus === 'operational' || normalizedStatus === 'running') {
    return null;
  }
  return SHUTDOWN_STATUS_CONFIG[normalizedStatus as keyof typeof SHUTDOWN_STATUS_CONFIG] || {
    label: '异常',
    icon: '❓',
    color: 'gray',
    bgClass: 'bg-gray-600/30',
    textClass: 'text-gray-400',
    borderClass: 'border-gray-600/50',
    description: '建筑状态异常',
  };
}

// 停工建筑警告面板（综合所有停工类型）
const ShutdownAlertPanel = memo(function ShutdownAlertPanel() {
  const buildings = useGameStore((state) => state.buildings);
  const buildingShortages = useBuildingShortages();
  const navigateToEconomyGoods = useNavigateToEconomyGoods();
  
  // 收集所有停工建筑
  const shutdownBuildings = useMemo(() => {
    const result: {
      buildingId: string;
      buildingName: string;
      definitionId: string;
      status: string;
      statusInfo: typeof SHUTDOWN_STATUS_CONFIG[keyof typeof SHUTDOWN_STATUS_CONFIG];
      missingInputs?: BuildingShortage['missingInputs'];
    }[] = [];
    
    // 从短缺数据中获取缺料信息
    const shortageMap = new Map<string, BuildingShortage>();
    for (const shortage of buildingShortages || []) {
      shortageMap.set(shortage.buildingId, shortage);
    }
    
    for (const building of buildings.values()) {
      // 优先使用服务端原始状态，fallback 到 operationalStatus
      const serverStatus = (building as { serverStatus?: string }).serverStatus;
      const status = serverStatus || String(building.operationalStatus);
      const statusInfo = getShutdownInfo(status);
      
      if (statusInfo) {
        const def = BUILDINGS_MAP.get(building.definitionId);
        const shortage = shortageMap.get(building.id);
        
        result.push({
          buildingId: building.id,
          buildingName: def?.nameZh || building.name || building.id,
          definitionId: building.definitionId,
          status,
          statusInfo,
          missingInputs: shortage?.missingInputs,
        });
      }
    }
    
    return result;
  }, [buildings, buildingShortages]);
  
  // 按状态分组统计
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of shutdownBuildings) {
      const key = b.status.toLowerCase().replace(/-/g, '_');
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [shutdownBuildings]);
  
  if (shutdownBuildings.length === 0) {
    return null;
  }
  
  // 按严重程度排序：缺原料 > 缺电力 > 缺工人 > 等待材料 > 暂停 > 其他
  const priorityOrder = ['lacking_inputs', 'lacking_energy', 'lacking_workers', 'waiting_materials', 'paused', 'under_construction', 'upgrading'];
  const sortedBuildings = [...shutdownBuildings].sort((a, b) => {
    const aKey = a.status.toLowerCase().replace(/-/g, '_');
    const bKey = b.status.toLowerCase().replace(/-/g, '_');
    const aIndex = priorityOrder.indexOf(aKey);
    const bIndex = priorityOrder.indexOf(bKey);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
  
  return (
    <div className="bg-amber-900/20 border border-amber-600/50 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🚨</span>
        <h3 className="text-lg font-bold text-amber-400">停工警告</h3>
        <span className="text-sm text-amber-300/70">
          {shutdownBuildings.length} 座建筑未在生产
        </span>
      </div>
      
      {/* 状态统计条 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(statusCounts).map(([status, count]) => {
          const config = SHUTDOWN_STATUS_CONFIG[status as keyof typeof SHUTDOWN_STATUS_CONFIG];
          if (!config) return null;
          return (
            <div
              key={status}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.bgClass} ${config.textClass}`}
            >
              <span>{config.icon}</span>
              <span>{config.label}</span>
              <span className="font-bold">×{count}</span>
            </div>
          );
        })}
      </div>
      
      {/* 停工建筑列表 */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {sortedBuildings.map((b) => {
          const def = BUILDINGS_MAP.get(b.definitionId);
          return (
            <div
              key={b.buildingId}
              className={`bg-slate-900/50 rounded-lg p-3 border ${b.statusInfo.borderClass}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{def?.icon || '🏭'}</span>
                  <span className="font-medium text-white">{b.buildingName}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${b.statusInfo.bgClass} ${b.statusInfo.textClass}`}>
                  <span>{b.statusInfo.icon}</span>
                  <span>{b.statusInfo.label}</span>
                </span>
              </div>
              
              {/* 显示缺少的原料（可点击跳转到商品详情） */}
              {b.missingInputs && b.missingInputs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {b.missingInputs.map((input) => {
                    const icon = GOODS_MAP.get(input.goodsId)?.icon ?? '📦';
                    const shortageAmount = input.needed - input.available;
                    return (
                      <div
                        key={input.goodsId}
                        className="flex items-center gap-1 bg-red-800/30 px-2 py-1 rounded text-xs cursor-pointer hover:bg-red-700/40 transition-colors"
                        title={`点击查看商品详情 | 需要 ${input.needed.toFixed(1)}，当前 ${input.available.toFixed(1)}，差 ${shortageAmount.toFixed(1)}`}
                        onClick={() => navigateToEconomyGoods(input.goodsId)}
                      >
                        <span>{icon}</span>
                        <span className="text-red-300 hover:underline">{input.goodsName}</span>
                        <span className="text-red-400 font-mono">
                          缺{shortageAmount.toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* 状态描述 */}
              <div className="text-xs text-gray-500 mt-1">
                {b.statusInfo.description}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-3 text-xs text-gray-400">
        💡 提示：系统正在自动采购缺少的原料，请确保有足够的资金和市场供应。如需手动暂停，请在详情页操作。
      </div>
    </div>
  );
});

// 产能总览卡片
const CapacitySummaryCard = memo(function CapacitySummaryCard({
  buildings,
  financials
}: {
  buildings: Map<EntityId, BuildingInstance>;
  financials: FinancialSummary | null;
}) {
  const stats = useMemo(() => {
    const result: Record<CategoryKey, { count: number; profitable: number; warning: number; loss: number }> = {
      extraction: { count: 0, profitable: 0, warning: 0, loss: 0 },
      processing: { count: 0, profitable: 0, warning: 0, loss: 0 },
      manufacturing: { count: 0, profitable: 0, warning: 0, loss: 0 },
      service: { count: 0, profitable: 0, warning: 0, loss: 0 },
      retail: { count: 0, profitable: 0, warning: 0, loss: 0 },
      agriculture: { count: 0, profitable: 0, warning: 0, loss: 0 },
    };

    // 使用滚动平均值来判断盈亏状态
    const profitMap = new Map<string, number>();
    if (financials?.buildingProfits) {
      for (const bp of financials.buildingProfits) {
        // 优先使用平均值，如果没有则使用当前值
        profitMap.set(bp.buildingId, bp.avgNet ?? bp.net);
      }
    }

    for (const building of buildings.values()) {
      const def = BUILDINGS_MAP.get(building.definitionId);
      if (!def) continue;
      
      const category = def.category as CategoryKey;
      if (!result[category]) continue;
      
      result[category].count++;
      
      const avgNet = profitMap.get(building.id) ?? 0;
      // 优先使用服务端原始状态
      const serverStatus = (building as { serverStatus?: string }).serverStatus;
      const status = serverStatus || String(building.operationalStatus);
      
      // 判断停工状态：paused, lacking_inputs/no_input, waiting_materials, under_construction
      if (status === 'paused' || status === 'lacking_inputs' || status === 'no_input' ||
          status === 'waiting_materials' || status === 'under_construction') {
        result[category].warning++;
      } else if (avgNet < 0) {
        result[category].loss++;
      } else {
        result[category].profitable++;
      }
    }

    return result;
  }, [buildings, financials]);

  const totalBuildings = Array.from(buildings.values()).length;
  // 使用滚动平均净利润
  const totalProfit = financials?.avgNetProfit ?? financials?.netProfit ?? 0;
  const warningCount = Object.values(stats).reduce((sum, s) => sum + s.warning + s.loss, 0);

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">产能概览</h3>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-400">总建筑</div>
            <div className="text-lg font-bold text-cyan-400">{totalBuildings}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">平均利润/tick</div>
            <div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalProfit >= 0 ? '+' : ''}{formatMoney(totalProfit)}
            </div>
          </div>
          {warningCount > 0 && (
            <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg text-sm">
              ⚠️ {warningCount} 座建筑需要关注
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {(Object.entries(CATEGORY_CONFIG) as [CategoryKey, typeof CATEGORY_CONFIG[CategoryKey]][]).map(([key, config]) => {
          const s = stats[key];
          if (s.count === 0) return (
            <div key={key} className="bg-slate-900/50 rounded-lg p-3 text-center opacity-50">
              <div className="text-2xl mb-1">{config.icon}</div>
              <div className="text-xs text-gray-500">{config.name}</div>
              <div className="text-sm text-gray-600">无</div>
            </div>
          );

          const profitRate = s.count > 0 ? ((s.profitable / s.count) * 100).toFixed(0) : '0';
          
          return (
            <div key={key} className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700">
              <div className="text-2xl mb-1">{config.icon}</div>
              <div className="text-xs text-gray-400 mb-1">{config.name}</div>
              <div className="text-lg font-bold text-white">{s.count}</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-xs text-gray-400">{s.profitable}</span>
                {s.warning > 0 && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-yellow-500 ml-1"></span>
                    <span className="text-xs text-gray-400">{s.warning}</span>
                  </>
                )}
                {s.loss > 0 && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 ml-1"></span>
                    <span className="text-xs text-gray-400">{s.loss}</span>
                  </>
                )}
              </div>
              <div className="text-xs text-green-400 mt-1">{profitRate}% 盈利</div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/** 合并后的建筑组数据 */
interface BuildingGroup {
  definitionId: string;
  def: BuildingData;
  buildings: BuildingInstance[];
  profits: BuildingProfit[];
  totalAvgNet: number;
  runningCount: number;
  warningCount: number;
  /** 建造中的建筑（包括等待材料和正在建设） */
  constructingBuildings: BuildingInstance[];
}

/** 扩展 BuildingInstance 类型以包含建造进度字段 */
interface BuildingWithConstruction extends BuildingInstance {
  serverStatus?: string;
  constructionProgress?: number;
  constructionTimeRequired?: number;
}

/** 建造进度条组件 */
const ConstructionProgressBar = memo(function ConstructionProgressBar({
  building,
  buildingName,
}: {
  building: BuildingWithConstruction;
  buildingName: string;
}) {
  const serverStatus = building.serverStatus || String(building.operationalStatus);
  const isWaitingMaterials = serverStatus === 'waiting_materials';
  const isUnderConstruction = serverStatus === 'under_construction';
  
  if (!isWaitingMaterials && !isUnderConstruction) {
    return null;
  }
  
  const progress = building.constructionProgress ?? 0;
  const totalTime = building.constructionTimeRequired ?? 7;
  // 修正：constructionProgress 是累计的 tick 数，不是百分比
  // 剩余天数 = 总时间 - 已完成进度
  const remainingDays = Math.max(0, Math.ceil(totalTime - progress));
  // 进度百分比 = 已完成进度 / 总时间 * 100
  const progressPercent = Math.min(100, Math.round((progress / totalTime) * 100));
  
  return (
    <div className={`rounded-lg p-3 border ${
      isWaitingMaterials
        ? 'bg-orange-900/20 border-orange-500/50'
        : 'bg-blue-900/20 border-blue-500/50'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{isWaitingMaterials ? '📦' : '🏗️'}</span>
          <span className="text-sm font-medium text-white">{buildingName}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isWaitingMaterials
              ? 'bg-orange-600/30 text-orange-400'
              : 'bg-blue-600/30 text-blue-400'
          }`}>
            {isWaitingMaterials ? '等待材料' : '建设中'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={isWaitingMaterials ? 'text-orange-400' : 'text-blue-400'}>
            {progressPercent}%
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-300">
            剩余 <span className="font-mono font-bold">{remainingDays}</span> 天
          </span>
        </div>
      </div>
      
      {/* 进度条 */}
      <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
            isWaitingMaterials
              ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
              : 'bg-gradient-to-r from-blue-500 to-cyan-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
        {/* 动画效果 - 脉动光条 */}
        {isUnderConstruction && progressPercent < 100 && (
          <div
            className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"
            style={{ left: `${Math.max(0, progressPercent - 5)}%` }}
          />
        )}
      </div>
      
      {/* 等待材料时显示提示 */}
      {isWaitingMaterials && (
        <div className="text-xs text-orange-300/70 mt-2">
          💡 建筑已购买，正在等待建造材料囤积完成后开始建设
        </div>
      )}
    </div>
  );
});

// 原材料/产品流程图组件 - 显示名称版
const RecipeFlowDiagram = memo(function RecipeFlowDiagram({
  inputs,
  outputs,
  count,
  ticksRequired,
  marketPrices,
  inventory,
  onGoodsClick,
}: {
  inputs: { goodsId: string; amount: number }[];
  outputs: { goodsId: string; amount: number }[];
  count: number;
  ticksRequired: number;
  marketPrices: Record<string, number>;
  inventory: InventorySnapshot | null;
  onGoodsClick?: (goodsId: string) => void;
}) {
  // 计算总成本和收益
  let inputCost = 0;
  let outputValue = 0;
  
  for (const input of inputs) {
    const price = marketPrices[input.goodsId] ?? GOODS_MAP.get(input.goodsId)?.basePrice ?? 0;
    inputCost += price * input.amount * count;
  }
  
  for (const output of outputs) {
    const price = marketPrices[output.goodsId] ?? GOODS_MAP.get(output.goodsId)?.basePrice ?? 0;
    outputValue += price * output.amount * count;
  }
  
  const profit = outputValue - inputCost;
  const profitPerTick = profit / ticksRequired;
  
  // 获取库存数量
  const getStockAmount = (goodsId: string): number => {
    if (!inventory?.stocks) return 0;
    const item = inventory.stocks.find((s) => s.goodsId === goodsId);
    return item?.quantity ?? 0;
  };
  
  return (
    <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-600/50">
      {/* 流程图主体 - 水平布局 */}
      <div className="flex items-center gap-3">
        {/* 输入区域 */}
        <div className="flex items-center gap-2 flex-wrap">
          {inputs.length > 0 ? (
            inputs.map((input) => {
              const totalAmount = input.amount * count;
              const stockAmount = getStockAmount(input.goodsId);
              // 缺货判断：库存不足以支撑一轮生产
              const isShortage = stockAmount < totalAmount;
              // 严重缺货：库存为0或接近0
              const isCriticalShortage = stockAmount < 1;
              const price = marketPrices[input.goodsId] ?? GOODS_MAP.get(input.goodsId)?.basePrice ?? 0;
              
              // 根据缺货程度决定样式
              let bgClass = 'bg-red-900/30 border-red-700/30';
              let stockClass = 'text-gray-500';
              
              if (isCriticalShortage) {
                bgClass = 'bg-red-800/70 border-red-400/70 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
                stockClass = 'text-red-400 font-bold animate-pulse';
              } else if (isShortage) {
                bgClass = 'bg-red-900/50 border-red-500/50';
                stockClass = 'text-yellow-400';
              }
              
              return (
                <div
                  key={input.goodsId}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1 border cursor-pointer hover:opacity-80 transition-opacity ${bgClass}`}
                  title={`单价: ${formatMoney(price)} | 库存: ${stockAmount.toFixed(0)}${isShortage ? ' ⚠️ 库存不足!' : ''}`}
                  onClick={() => onGoodsClick?.(input.goodsId)}
                >
                  <span className="text-base">{getGoodsIcon(input.goodsId)}</span>
                  <span className="text-sm text-gray-300">{getGoodsName(input.goodsId)}</span>
                  <span className="text-red-400 font-mono text-sm">×{totalAmount}</span>
                  <span className={`text-xs ${stockClass}`}>
                    [{stockAmount.toFixed(0)}]
                  </span>
                  {/* 缺货标识 */}
                  {isCriticalShortage && (
                    <span className="text-red-400 text-xs font-bold ml-1">⚠️缺货</span>
                  )}
                </div>
              );
            })
          ) : (
            <span className="text-sm text-gray-500 italic">无需原料</span>
          )}
        </div>
        
        {/* 箭头 + 周期 */}
        <div className="flex items-center text-cyan-400 text-lg whitespace-nowrap">
          →<span className="text-xs text-gray-500 mx-1">{ticksRequired}t</span>→
        </div>
        
        {/* 输出区域 */}
        <div className="flex items-center gap-2 flex-wrap">
          {outputs.map((output) => {
            const totalAmount = output.amount * count;
            const stockAmount = getStockAmount(output.goodsId);
            const price = marketPrices[output.goodsId] ?? GOODS_MAP.get(output.goodsId)?.basePrice ?? 0;
            return (
              <div
                key={output.goodsId}
                className="flex items-center gap-1.5 bg-green-900/30 rounded-lg px-2 py-1 border border-green-700/30 cursor-pointer hover:opacity-80 transition-opacity"
                title={`单价: ${formatMoney(price)} | 库存: ${stockAmount.toFixed(0)}`}
                onClick={() => onGoodsClick?.(output.goodsId)}
              >
                <span className="text-base">{getGoodsIcon(output.goodsId)}</span>
                <span className="text-sm text-gray-300">{getGoodsName(output.goodsId)}</span>
                <span className="text-green-400 font-mono text-sm">×{totalAmount}</span>
                <span className="text-xs text-gray-500">
                  [{stockAmount.toFixed(0)}]
                </span>
              </div>
            );
          })}
        </div>
        
        {/* 利润显示 */}
        <div className={`ml-auto text-sm font-mono whitespace-nowrap ${profitPerTick >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {profitPerTick >= 0 ? '+' : ''}{formatMoney(profitPerTick)}/t
        </div>
      </div>
    </div>
  );
});

// 生产方式选择组件（Victoria 3 风格）
function ProductionMethodSelector({
  slot,
  activeMethodId,
  buildingId,
  marketPrices,
}: {
  slot: ProductionSlotData;
  activeMethodId: string;
  buildingId: string;
  marketPrices: Record<string, number>;
}) {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  
  // 计算每个方法的利润率
  const calculateMethodProfit = useCallback((method: ProductionMethodData): number => {
    let inputCost = 0;
    let outputValue = 0;
    
    for (const input of method.recipe.inputs) {
      const price = marketPrices[input.goodsId] ?? GOODS_MAP.get(input.goodsId)?.basePrice ?? 0;
      inputCost += price * input.amount;
    }
    
    for (const output of method.recipe.outputs) {
      const price = marketPrices[output.goodsId] ?? GOODS_MAP.get(output.goodsId)?.basePrice ?? 0;
      outputValue += price * output.amount;
    }
    
    return (outputValue - inputCost) / method.recipe.ticksRequired;
  }, [marketPrices]);
  
  const handleMethodSwitch = useCallback((methodId: string) => {
    gameWebSocket.switchMethod(buildingId, methodId);
  }, [buildingId]);
  
  if (slot.methods.length <= 1) {
    return null; // 只有一种方式，不显示选择器
  }
  
  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="text-xs text-gray-500">生产方式:</span>
      <div className="flex gap-2">
        {slot.methods.map((method) => {
          const isActive = method.id === activeMethodId;
          const profit = calculateMethodProfit(method);
          const profitColor = profit >= 0 ? 'text-green-400' : 'text-red-400';
          
          return (
            <div
              key={method.id}
              className="relative"
              onMouseEnter={() => setShowTooltip(method.id)}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <button
                onClick={() => handleMethodSwitch(method.id)}
                className={`w-10 h-10 flex items-center justify-center text-lg rounded-lg border-2 transition-all ${
                  isActive
                    ? 'bg-cyan-600/40 border-cyan-400 shadow-lg shadow-cyan-500/30'
                    : 'bg-slate-700/50 border-slate-600 hover:border-slate-500 hover:bg-slate-700'
                }`}
                title={method.nameZh}
              >
                {getMethodIcon(method)}
              </button>
              
              {/* 工具提示 - 显示在左上方，避免遮挡 */}
              {showTooltip === method.id && (
                <div className="absolute z-50 bottom-full left-0 mb-2 w-56 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl pointer-events-none">
                  <div className="text-sm font-medium text-white mb-1">{method.nameZh}</div>
                  <div className="text-xs text-gray-400 mb-2">{method.description}</div>
                  <div className="space-y-1.5">
                    <div className="text-xs">
                      <span className="text-gray-500">投入: </span>
                      {method.recipe.inputs.map((input, i) => (
                        <span key={input.goodsId}>
                          {i > 0 && ' + '}
                          <span className="text-red-300">{getGoodsIcon(input.goodsId)} {getGoodsName(input.goodsId)} ×{input.amount}</span>
                        </span>
                      ))}
                      {method.recipe.inputs.length === 0 && <span className="text-gray-500">无</span>}
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500">产出: </span>
                      {method.recipe.outputs.map((output, i) => (
                        <span key={output.goodsId}>
                          {i > 0 && ' + '}
                          <span className="text-green-300">{getGoodsIcon(output.goodsId)} {getGoodsName(output.goodsId)} ×{output.amount}</span>
                        </span>
                      ))}
                    </div>
                    <div className={`text-xs font-mono ${profitColor}`}>
                      利润: {profit >= 0 ? '+' : ''}{formatMoney(profit)}/tick
                    </div>
                  </div>
                  {/* 小箭头指向按钮 */}
                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 使用 memo 包装 ProductionMethodSelector
const MemoizedProductionMethodSelector = memo(ProductionMethodSelector);

// 合并建筑组行组件
function BuildingGroupRow({
  group,
  marketPrices,
  inventory,
  onAddBuilding,
  onRemoveBuilding,
  onSelectBuilding,
  onGoodsClick,
}: {
  group: BuildingGroup;
  marketPrices: Record<string, number>;
  inventory: InventorySnapshot | null;
  onAddBuilding: (defId: string) => void;
  onRemoveBuilding: (buildingId: string) => void;
  onSelectBuilding: (buildingId: string) => void;
  onGoodsClick?: (goodsId: string) => void;
}) {
  const { def, buildings, totalAvgNet, runningCount, warningCount, constructingBuildings } = group;
  const count = buildings.length;
  const constructingCount = constructingBuildings.length;
  
  // 获取第一个运行中的建筑作为示例（优先显示运行中的）
  const runningBuilding = buildings.find(b => {
    const status = (b as BuildingWithConstruction).serverStatus || String(b.operationalStatus);
    return status === 'running' || status === 'operational';
  });
  const firstBuilding = runningBuilding || buildings[0];
  if (!firstBuilding) return null;
  
  // 获取当前活跃的生产方式
  const activeSlot = def.productionSlots[0];
  const activeMethodId = firstBuilding.activeMethodIds?.['process'] || activeSlot?.defaultMethodId;
  const activeMethod = activeSlot?.methods.find(m => m.id === activeMethodId);

  // 判断是否有建造中的建筑
  const hasConstructing = constructingCount > 0;

  return (
    <div className={`bg-slate-800/30 rounded-lg p-4 border transition-colors ${
      hasConstructing
        ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
        : 'border-slate-700 hover:border-slate-600'
    }`}>
      <div className="flex items-start gap-4">
        {/* 建筑图标 */}
        <div className={`text-3xl w-12 h-12 flex items-center justify-center rounded-lg flex-shrink-0 ${
          hasConstructing ? 'bg-blue-900/50 animate-pulse' : 'bg-slate-700'
        }`}>
          {def.icon}
        </div>
        
        {/* 建筑信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-white truncate">{def.nameZh}</h4>
              <span className="text-sm text-cyan-400 bg-cyan-600/20 px-2 py-0.5 rounded-full">
                ×{count}
              </span>
              {runningCount > 0 && (
                <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
                  🟢 {runningCount}运行中
                </span>
              )}
              {constructingCount > 0 && (
                <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full animate-pulse">
                  🏗️ {constructingCount}建造中
                </span>
              )}
              {warningCount > 0 && warningCount > constructingCount && (
                <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full animate-pulse">
                  🚨 {warningCount - constructingCount}停工
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono font-bold ${totalAvgNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalAvgNet >= 0 ? '+' : ''}{formatMoney(totalAvgNet)}
              </span>
            </div>
          </div>
          
          {/* 建造进度条列表 - 显示所有正在建造的建筑 */}
          {constructingBuildings.length > 0 && (
            <div className="space-y-2 mb-3">
              {constructingBuildings.map((building, index) => (
                <ConstructionProgressBar
                  key={building.id}
                  building={building as BuildingWithConstruction}
                  buildingName={`${def.nameZh} #${index + 1}`}
                />
              ))}
            </div>
          )}
          
          {/* 原材料和产品流程示意图 - 只有有运行中的建筑时才显示 */}
          {activeMethod && runningCount > 0 && (
            <RecipeFlowDiagram
              inputs={activeMethod.recipe.inputs}
              outputs={activeMethod.recipe.outputs}
              count={runningCount}
              ticksRequired={activeMethod.recipe.ticksRequired}
              marketPrices={marketPrices}
              inventory={inventory}
              onGoodsClick={onGoodsClick}
            />
          )}
          
          {/* 生产方式选择器（Victoria 3 风格）- 只有有运行中的建筑时才显示 */}
          {activeSlot && runningCount > 0 && (
            <MemoizedProductionMethodSelector
              slot={activeSlot}
              activeMethodId={activeMethodId || activeSlot.defaultMethodId}
              buildingId={firstBuilding.id}
              marketPrices={marketPrices}
            />
          )}
          
          {/* 建设成本信息 */}
          <div className="text-xs text-gray-500 mt-2">
            建设成本: {formatMoney(def.baseCost)}/座 · 维护: {formatMoney(def.maintenanceCost)}/月/座
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          {/* 减少按钮 */}
          <button
            onClick={() => {
              const lastBuilding = buildings[buildings.length - 1];
              if (lastBuilding) {
                onRemoveBuilding(lastBuilding.id);
              }
            }}
            className="w-8 h-8 flex items-center justify-center text-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors border border-red-600/30"
            title="拆除一座"
          >
            −
          </button>
          
          {/* 数量显示 */}
          <span className="w-8 text-center font-bold text-white">{count}</span>
          
          {/* 增加按钮 */}
          <button
            onClick={() => onAddBuilding(def.id)}
            className="w-8 h-8 flex items-center justify-center text-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg transition-colors border border-green-600/30"
            title="建造一座"
          >
            +
          </button>
          
          {/* 详情按钮 */}
          <button
            onClick={() => onSelectBuilding(firstBuilding.id)}
            className="px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors ml-2"
          >
            详情
          </button>
        </div>
      </div>
    </div>
  );
}

// 使用 memo 包装 BuildingGroupRow
const MemoizedBuildingGroupRow = memo(BuildingGroupRow);

// 主面板组件
export const IndustryPanel = memo(function IndustryPanel() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'profit' | 'count'>('name');
  
  const buildings = useGameStore((state) => state.buildings);
  const financials = useGameStore((state) => state.financials);
  const marketPrices = useMarketPrices();
  const inventory = useInventory();
  const selectBuilding = useGameStore((state) => state.selectBuilding);
  const navigateToEconomyGoods = useNavigateToEconomyGoods();
  
  // 商品点击跳转到经济管理中心
  const handleGoodsClick = useCallback((goodsId: string) => {
    navigateToEconomyGoods(goodsId);
  }, [navigateToEconomyGoods]);
  
  // 按类别和建筑类型分组
  const groupedBuildings = useMemo(() => {
    const profitMap = new Map<string, BuildingProfit>();
    if (financials?.buildingProfits) {
      for (const bp of financials.buildingProfits) {
        profitMap.set(bp.buildingId, bp);
      }
    }
    
    // 首先按 definitionId 分组
    const buildingsByDef = new Map<string, {
      buildings: BuildingInstance[];
      profits: BuildingProfit[];
      def: BuildingData;
    }>();
    
    for (const building of buildings.values()) {
      const def = BUILDINGS_MAP.get(building.definitionId);
      if (!def) continue;
      
      let group = buildingsByDef.get(building.definitionId);
      if (!group) {
        group = { buildings: [], profits: [], def };
        buildingsByDef.set(building.definitionId, group);
      }
      
      group.buildings.push(building);
      const profit = profitMap.get(building.id);
      if (profit) {
        group.profits.push(profit);
      }
    }
    
    // 转换为 BuildingGroup 并按类别分组
    const result: Record<CategoryKey, BuildingGroup[]> = {
      extraction: [],
      processing: [],
      manufacturing: [],
      service: [],
      retail: [],
      agriculture: [],
    };
    
    for (const [definitionId, data] of buildingsByDef) {
      const category = data.def.category as CategoryKey;
      if (!result[category]) continue;
      
      // 计算汇总数据
      const totalAvgNet = data.profits.reduce((sum, p) => sum + (p.avgNet ?? p.net), 0);
      const runningCount = data.buildings.filter(b => {
        // 优先使用服务端原始状态
        const serverStatus = (b as { serverStatus?: string }).serverStatus;
        const status = serverStatus || String(b.operationalStatus);
        return status === 'running' || status === 'operational';
      }).length;
      
      // 收集建造中的建筑（等待材料或正在建设）
      const constructingBuildings = data.buildings.filter(b => {
        const serverStatus = (b as { serverStatus?: string }).serverStatus;
        const status = serverStatus || String(b.operationalStatus);
        return status === 'waiting_materials' || status === 'under_construction';
      });
      
      const warningCount = data.buildings.filter(b => {
        // 优先使用服务端原始状态
        const serverStatus = (b as { serverStatus?: string }).serverStatus;
        const status = serverStatus || String(b.operationalStatus);
        return status !== 'running' && status !== 'operational';
      }).length;
      
      result[category].push({
        definitionId,
        def: data.def,
        buildings: data.buildings,
        profits: data.profits,
        totalAvgNet,
        runningCount,
        warningCount,
        constructingBuildings,
      });
    }
    
    // 排序
    for (const category of Object.keys(result) as CategoryKey[]) {
      result[category].sort((a, b) => {
        if (sortBy === 'profit') {
          return b.totalAvgNet - a.totalAvgNet;
        } else if (sortBy === 'count') {
          return b.buildings.length - a.buildings.length;
        }
        // 默认按名称排序
        return a.def.nameZh.localeCompare(b.def.nameZh);
      });
    }
    
    return result;
  }, [buildings, financials, sortBy]);
  
  // 过滤显示的类别
  const displayCategories = selectedCategory === 'all'
    ? (Object.keys(CATEGORY_CONFIG) as CategoryKey[])
    : [selectedCategory];
  
  // 统计总建筑类型数
  const totalBuildingTypes = Object.values(groupedBuildings).reduce((sum, groups) => sum + groups.length, 0);
    
  const handleAddBuilding = (defId: string) => {
    gameWebSocket.purchaseBuilding(defId);
  };
  
  const handleRemoveBuilding = (_buildingId: string) => {
    // TODO: 实现拆除建筑功能
    // 暂时只显示提示
    alert('拆除功能暂未实现');
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <div>
          <h2 className="text-xl font-bold text-white">工业产能</h2>
          <p className="text-sm text-gray-400">管理你的产业帝国</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 排序方式 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1.5 bg-slate-700 text-white rounded-lg border border-slate-600 text-sm"
          >
            <option value="name">按名称排序</option>
            <option value="profit">按利润排序</option>
            <option value="count">按数量排序</option>
          </select>
        </div>
      </div>
      
      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* 产能概览 */}
        <CapacitySummaryCard buildings={buildings} financials={financials} />
        
        {/* 停工警告面板（综合所有停工类型） */}
        <ShutdownAlertPanel />
        
        {/* 类别筛选 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-700 text-gray-400 hover:text-white hover:bg-slate-600'
            }`}
          >
            全部 ({totalBuildingTypes})
          </button>
          {(Object.entries(CATEGORY_CONFIG) as [CategoryKey, typeof CATEGORY_CONFIG[CategoryKey]][]).map(([key, config]) => {
            const typeCount = groupedBuildings[key].length;
            const buildingCount = groupedBuildings[key].reduce((sum, g) => sum + g.buildings.length, 0);
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  selectedCategory === key
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-gray-400 hover:text-white hover:bg-slate-600'
                }`}
              >
                <span>{config.icon}</span>
                <span>{config.name}</span>
                <span className="text-xs opacity-70">({typeCount}种/{buildingCount}座)</span>
              </button>
            );
          })}
        </div>
        
        {/* 建筑列表（合并同类） */}
        {displayCategories.map((category) => {
          const groups = groupedBuildings[category];
          if (groups.length === 0) return null;
          
          const config = CATEGORY_CONFIG[category];
          const totalBuildings = groups.reduce((sum, g) => sum + g.buildings.length, 0);
          
          return (
            <div key={category} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{config.icon}</span>
                <h3 className="text-lg font-bold text-white">{config.name}</h3>
                <span className="text-gray-400">({groups.length}种 / {totalBuildings}座)</span>
              </div>
              
              <div className="space-y-3">
                {groups.map((group) => (
                  <MemoizedBuildingGroupRow
                    key={group.definitionId}
                    group={group}
                    marketPrices={marketPrices}
                    inventory={inventory}
                    onAddBuilding={handleAddBuilding}
                    onRemoveBuilding={handleRemoveBuilding}
                    onSelectBuilding={(buildingId: string) => selectBuilding(buildingId)}
                    onGoodsClick={handleGoodsClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
        
        {/* 空状态 */}
        {buildings.size === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-bold text-white mb-2">暂无建筑</h3>
            <p className="text-gray-400 mb-6">点击下方按钮开始建造你的第一座工厂</p>
          </div>
        )}
      </div>
    </div>
  );
});