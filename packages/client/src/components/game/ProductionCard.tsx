/**
 * ProductionCard - Building production management card
 * Victoria 3 style production method switching
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useGameStore, useBuildingFinanceHistory, useMarketPrices, type BuildingFinanceEntry } from '../../stores';
import { BUILDINGS_MAP, GOODS_MAP, type ProductionMethodData, type ProductionSlotData } from '@scc/shared';
import type { EntityId } from '@scc/shared';
import { gameWebSocket } from '../../services/websocket';

// 类别名称映射
const categoryNames: Record<string, string> = {
  extraction: '资源开采',
  processing: '基础加工',
  manufacturing: '高端制造',
  service: '服务设施',
  logistics: '物流仓储',
};

// 格式化成本显示
const formatCost = (cents: number | undefined | null) => {
  // Handle undefined, null, or NaN values
  if (cents === undefined || cents === null || !Number.isFinite(cents)) {
    return '¥0';
  }
  if (cents >= 100000000) {
    return `¥${(cents / 100000000).toFixed(1)}亿`;
  } else if (cents >= 10000) {
    return `¥${(cents / 10000).toFixed(0)}万`;
  }
  return `¥${(cents / 100).toFixed(0)}`;
};

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

// 建筑财务曲线图组件
function FinanceChart({ history, width = 300, height = 120 }: {
  history: BuildingFinanceEntry[];
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || history.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 10, right: 15, bottom: 25, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 计算数据范围
    const incomes = history.map(h => h.income);
    const costs = history.map(h => h.inputCost + h.maintenance);
    const nets = history.map(h => h.net);
    
    const allValues = [...incomes, ...costs, ...nets];
    const minVal = Math.min(...allValues, 0);
    const maxVal = Math.max(...allValues, 0);
    const padding = Math.abs(maxVal - minVal) * 0.1 || 100;

    // 比例尺
    const xScale = d3.scaleLinear()
      .domain([0, history.length - 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([minVal - padding, maxVal + padding])
      .range([innerHeight, 0]);

    // 绘制零线
    if (minVal < 0 && maxVal > 0) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(0))
        .attr('y2', yScale(0))
        .attr('stroke', '#475569')
        .attr('stroke-dasharray', '2,2');
    }

    // 创建渐变
    const defs = svg.append('defs');
    
    // 收入渐变
    const incomeGradient = defs.append('linearGradient')
      .attr('id', 'income-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    incomeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#22c55e').attr('stop-opacity', 0.3);
    incomeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#22c55e').attr('stop-opacity', 0);

    // 成本渐变
    const costGradient = defs.append('linearGradient')
      .attr('id', 'cost-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    costGradient.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444').attr('stop-opacity', 0.3);
    costGradient.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444').attr('stop-opacity', 0);

    // 收入曲线
    const incomeLine = d3.line<BuildingFinanceEntry>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d.income))
      .curve(d3.curveMonotoneX);

    const incomeArea = d3.area<BuildingFinanceEntry>()
      .x((_, i) => xScale(i))
      .y0(yScale(0))
      .y1(d => yScale(d.income))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('fill', 'url(#income-gradient)')
      .attr('d', incomeArea);

    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 2)
      .attr('d', incomeLine);

    // 成本曲线（投入 + 维护）
    const costLine = d3.line<BuildingFinanceEntry>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d.inputCost + d.maintenance))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2')
      .attr('d', costLine);

    // 净利润曲线
    const netLine = d3.line<BuildingFinanceEntry>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d.net))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 2.5)
      .attr('d', netLine);

    // 当前点标记
    const lastIdx = history.length - 1;
    const last = history[lastIdx];
    if (last) {
      g.append('circle')
        .attr('cx', xScale(lastIdx))
        .attr('cy', yScale(last.net))
        .attr('r', 4)
        .attr('fill', last.net >= 0 ? '#22c55e' : '#ef4444')
        .attr('stroke', '#0d1117')
        .attr('stroke-width', 2);
    }

    // Y轴
    const yAxis = d3.axisLeft(yScale)
      .ticks(4)
      .tickFormat(d => {
        const val = d as number;
        if (Math.abs(val) >= 10000) return `${(val / 10000).toFixed(0)}万`;
        if (Math.abs(val) >= 100) return `${(val / 100).toFixed(0)}`;
        return val.toFixed(0);
      });
    
    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '9px');

    g.selectAll('.y-axis path, .y-axis line').attr('stroke', '#334155');

    // X轴标签
    g.append('text')
      .attr('x', innerWidth)
      .attr('y', innerHeight + 18)
      .attr('text-anchor', 'end')
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .text(`最近 ${history.length} tick`);

  }, [history, width, height]);

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center text-gray-500 text-xs" style={{ width, height }}>
        等待数据积累中...
      </div>
    );
  }

  return <svg ref={svgRef} width={width} height={height} />;
}

export function ProductionCard() {
  const selectedBuildingId = useGameStore((state) => state.selectedBuildingId);
  const buildings = useGameStore((state) => state.buildings);
  const setShowProductionCard = useGameStore((state) => state.setShowProductionCard);
  const buildingFinanceHistory = useBuildingFinanceHistory();
  const marketPrices = useMarketPrices();
  
  // 先从 store 获取建筑实例
  const buildingInstance = useMemo(() => {
    if (!selectedBuildingId) return null;
    return buildings.get(selectedBuildingId) || null;
  }, [selectedBuildingId, buildings]);
  
  // 再从建筑实例的 definitionId 获取建筑定义
  const buildingData = useMemo(() => {
    if (!buildingInstance) return null;
    return BUILDINGS_MAP.get(buildingInstance.definitionId) || null;
  }, [buildingInstance]);

  // 管理每个槽位的当前选择 - 从服务器同步的状态
  const [activeMethodIds, setActiveMethodIds] = useState<Record<string, EntityId>>({});

  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  
  // 初始化时从建筑实例的 activeMethodIds 获取，如果没有则使用默认值
  useEffect(() => {
    if (buildingData) {
      const initial: Record<string, EntityId> = {};
      buildingData.productionSlots.forEach(slot => {
        // 优先使用服务器同步的 currentMethodId
        const serverMethod = (buildingInstance as { currentMethodId?: string })?.currentMethodId;
        initial[slot.type] = serverMethod || slot.defaultMethodId;
      });
      setActiveMethodIds(initial);
    }
  }, [buildingData, buildingInstance]);

  if (!selectedBuildingId || !buildingInstance || !buildingData) {
    return null;
  }

  const handleMethodChange = (slotType: string, methodId: EntityId) => {
    // 更新本地状态
    setActiveMethodIds(prev => ({ ...prev, [slotType]: methodId }));
    
    // 发送到服务器
    if (selectedBuildingId) {
      gameWebSocket.switchMethod(selectedBuildingId, methodId);
    }
  };

  const getActiveMethod = (slot: ProductionSlotData): ProductionMethodData | undefined => {
    const activeId = activeMethodIds[slot.type] || slot.defaultMethodId;
    return slot.methods.find(m => m.id === activeId);
  };

  // 计算总成本和产出 - 使用实时市场价格
  const totals = useMemo(() => {
    let totalInputCost = 0;
    let totalOutputValue = 0;
    let totalLabor = 0;
    let totalPower = 0;

    buildingData.productionSlots.forEach(slot => {
      const method = getActiveMethod(slot);
      if (method) {
        // 计算输入成本 - 使用实时市场价格
        method.recipe.inputs.forEach(input => {
          const goods = GOODS_MAP.get(input.goodsId);
          if (goods) {
            // 优先使用实时价格，fallback 到基准价格
            const price = marketPrices[input.goodsId] ?? goods.basePrice;
            totalInputCost += price * input.amount;
          }
        });
        // 计算输出价值 - 使用实时市场价格
        method.recipe.outputs.forEach(output => {
          const goods = GOODS_MAP.get(output.goodsId);
          if (goods) {
            // 优先使用实时价格，fallback 到基准价格
            const price = marketPrices[output.goodsId] ?? goods.basePrice;
            totalOutputValue += price * output.amount;
          }
        });
        totalLabor += method.laborRequired;
        totalPower += method.powerRequired;
      }
    });

    return {
      inputCost: totalInputCost,
      outputValue: totalOutputValue,
      profit: totalOutputValue - totalInputCost,
      labor: totalLabor,
      power: totalPower,
    };
  }, [buildingData, activeMethodIds, marketPrices]);
  const isProfitable = totals.profit > 0;
  
  // 获取当前建筑的财务历史
  const financeHistory = selectedBuildingId
    ? buildingFinanceHistory.get(selectedBuildingId) || []
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-lg w-[650px] max-h-[85vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{buildingData.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-cyan-400">{buildingInstance.name || buildingData.nameZh}</h2>
              <p className="text-sm text-gray-400">
                {categoryNames[buildingData.category]} · {buildingData.subcategory}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowProductionCard(false)}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Building stats */}
        <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-700 grid grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-gray-500">建造成本</span>
            <div className="text-orange-400 font-mono">{formatCost(buildingData.baseCost)}</div>
          </div>
          <div>
            <span className="text-gray-500">维护成本</span>
            <div className="text-yellow-400 font-mono">{formatCost(buildingData.maintenanceCost)}/tick</div>
          </div>
          <div>
            <span className="text-gray-500">最大工人</span>
            <div className="text-blue-400 font-mono">{buildingData.maxWorkers}人</div>
          </div>
          <div>
            <span className="text-gray-500">规模</span>
            <div className="text-purple-400 font-mono capitalize">{buildingData.size}</div>
          </div>
        </div>

        {/* Profitability summary */}
        <div className={`px-6 py-3 ${isProfitable ? 'bg-green-900/30' : 'bg-red-900/30'} border-b border-slate-700`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-gray-400 text-sm">投入成本</span>
                <div className="text-red-400 font-mono">{formatCost(totals.inputCost)}</div>
              </div>
              <div className="text-gray-500">→</div>
              <div>
                <span className="text-gray-400 text-sm">产出价值</span>
                <div className="text-green-400 font-mono">{formatCost(totals.outputValue)}</div>
              </div>
              <div className="text-gray-500">=</div>
              <div>
                <span className="text-gray-400 text-sm">利润/tick</span>
                <div className={`font-mono font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                  {isProfitable ? '+' : ''}{formatCost(totals.profit)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-yellow-400">👷</span>
                <span className="text-gray-300">{totals.labor}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-cyan-400">⚡</span>
                <span className="text-gray-300">{totals.power}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Finance Chart */}
        <div className="px-6 py-3 bg-slate-800/30 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium">收益趋势</span>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-green-500"></div>
                <span className="text-gray-400">收入</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-red-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #ef4444 0, #ef4444 4px, transparent 4px, transparent 6px)' }}></div>
                <span className="text-gray-400">成本</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-cyan-400"></div>
                <span className="text-gray-400">净利润</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2">
            <FinanceChart history={financeHistory} width={600} height={120} />
          </div>
        </div>

        {/* Production slots */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[350px]">
          {buildingData.productionSlots.map(slot => {
            const activeMethod = getActiveMethod(slot);
            const isExpanded = expandedSlot === slot.type;
            
            return (
              <div key={slot.type} className="border border-slate-700 rounded-lg overflow-hidden">
                {/* Slot header */}
                <div 
                  className="bg-slate-800 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700"
                  onClick={() => setExpandedSlot(isExpanded ? null : slot.type)}
                >
                  <div>
                    <span className="text-gray-400 text-sm">{slot.name}</span>
                    <div className="text-white font-medium">{activeMethod?.nameZh || activeMethod?.name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {slot.methods.length} 种工艺可选
                    </span>
                    <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Method selector */}
                {isExpanded && (
                  <div className="p-4 bg-slate-900 space-y-3">
                    {slot.methods.map(method => {
                      const isActive = method.id === (activeMethodIds[slot.type] || slot.defaultMethodId);
                      
                      return (
                        <div
                          key={method.id}
                          onClick={() => handleMethodChange(slot.type, method.id)}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            isActive
                              ? 'bg-cyan-900/30 border border-cyan-500/50'
                              : 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white">{method.nameZh}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                效率: <span className={method.efficiency >= 1 ? 'text-green-400' : 'text-yellow-400'}>
                                  {(method.efficiency * 100).toFixed(0)}%
                                </span>
                              </span>
                              {isActive && (
                                <span className="text-cyan-400 text-sm">✓ 当前</span>
                              )}
                            </div>
                          </div>
                          <p className="text-gray-400 text-sm mb-3">{method.description}</p>
                          
                          {/* Recipe visualization */}
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            {/* Inputs */}
                            {method.recipe.inputs.length > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                {method.recipe.inputs.map((input, idx) => (
                                  <span key={input.goodsId} className="flex items-center">
                                    <span className="px-2 py-0.5 bg-red-900/30 text-red-300 rounded flex items-center gap-1">
                                      <span>{getGoodsIcon(input.goodsId)}</span>
                                      <span>{getGoodsName(input.goodsId)}</span>
                                      <span>×{input.amount}</span>
                                    </span>
                                    {idx < method.recipe.inputs.length - 1 && (
                                      <span className="text-gray-500 mx-1">+</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500">无需输入</span>
                            )}
                            
                            <span className="text-gray-400 mx-2">→</span>
                            
                            {/* Outputs */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {method.recipe.outputs.map((output, idx) => (
                                <span key={output.goodsId} className="flex items-center">
                                  <span className="px-2 py-0.5 bg-green-900/30 text-green-300 rounded flex items-center gap-1">
                                    <span>{getGoodsIcon(output.goodsId)}</span>
                                    <span>{getGoodsName(output.goodsId)}</span>
                                    <span>×{output.amount}</span>
                                  </span>
                                  {idx < method.recipe.outputs.length - 1 && (
                                    <span className="text-gray-500 mx-1">+</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {/* Resource requirements */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>👷 劳动力: {method.laborRequired}</span>
                            <span>⚡ 电力: {method.powerRequired}</span>
                            <span>⏱️ 周期: {method.recipe.ticksRequired} tick</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Description */}
        <div className="px-6 py-3 bg-slate-800/30 border-t border-slate-700">
          <p className="text-gray-400 text-sm">{buildingData.description}</p>
        </div>

        {/* Footer */}
        <div className="bg-slate-800 px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={() => setShowProductionCard(false)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}