/**
 * MarketGalaxy - 增强版产业链市场可视化
 * 
 * 功能增强:
 * 1. 盈亏着色 - 连接线根据利润率显示绿色/红色
 * 2. 玩家标记 - 标识玩家拥有生产/消耗该商品的建筑
 * 3. 价格涨跌 - 节点显示价格和涨跌幅
 * 4. 交易入口 - 点击节点可快速买卖
 * 5. 投资机会 - 右侧面板显示价格异常和高利润链
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { GOODS_DATA, GOODS_BY_CATEGORY, BUILDING_DEFINITIONS } from '@scc/shared';
import type { EntityId, BuildingInstance } from '@scc/shared';
import { useGameStore, usePriceHistory, useMarketPrices, useInventory, type PriceHistoryEntry } from '../../stores';

// ============ 类型定义 ============

interface GoodsNodeEnhanced {
  id: EntityId;
  name: string;
  nameZh: string;
  category: string;
  subcategory: string;
  tags: string[];
  icon: string;
  basePrice: number;
  layer: number;
  x: number;
  y: number;
  // 增强数据
  currentPrice: number;
  priceChangePercent: number;
  playerProduces: boolean;  // 玩家有生产建筑
  playerConsumes: boolean;  // 玩家有消耗建筑
  playerInventory: number;  // 玩家库存
  opportunity: 'buy' | 'sell' | 'hot' | null;
}

interface SupplyChainLinkEnhanced {
  source: string;
  target: string;
  type: 'supply_chain' | 'substitute' | 'complement';
  profitMargin: number;  // 边际利润率
  isPlayerChain: boolean;  // 是否涉及玩家建筑
}

interface InvestmentOpportunity {
  id: string;
  type: 'price_low' | 'price_high' | 'high_profit_chain' | 'supply_shortage';
  goodsId?: string;
  goodsName?: string;
  icon?: string;
  description: string;
  value?: number;
  chainPath?: string[];
}

// ============ 常量 ============

const categoryColors: Record<string, { main: string; bg: string; glow: string }> = {
  raw_material: { main: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', glow: 'rgba(245, 158, 11, 0.4)' },
  basic_processed: { main: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', glow: 'rgba(59, 130, 246, 0.4)' },
  intermediate: { main: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', glow: 'rgba(139, 92, 246, 0.4)' },
  consumer_good: { main: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', glow: 'rgba(16, 185, 129, 0.4)' },
  service: { main: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', glow: 'rgba(236, 72, 153, 0.4)' },
};

const categoryNames: Record<string, string> = {
  raw_material: '原材料',
  basic_processed: '基础加工',
  intermediate: '中间产品',
  consumer_good: '消费品',
  service: '服务',
};

const layerNames = ['原材料', '基础加工', '中间产品', '消费品'];

const categoryToLayer: Record<string, number> = {
  raw_material: 0,
  basic_processed: 1,
  intermediate: 2,
  consumer_good: 3,
  service: 3,
};

// 供应链连接 (带配方比例用于利润计算)
const supplyChainLinks: Array<{
  source: string;
  target: string;
  type: 'supply_chain';
  inputAmount?: number;
  outputAmount?: number;
}> = [
  // 原材料 -> 基础加工
  { source: 'iron-ore', target: 'steel', type: 'supply_chain', inputAmount: 100, outputAmount: 60 },
  { source: 'coal', target: 'steel', type: 'supply_chain', inputAmount: 50, outputAmount: 60 },
  { source: 'copper-ore', target: 'copper', type: 'supply_chain', inputAmount: 100, outputAmount: 50 },
  { source: 'crude-oil', target: 'refined-fuel', type: 'supply_chain', inputAmount: 100, outputAmount: 40 },
  { source: 'crude-oil', target: 'plastic', type: 'supply_chain', inputAmount: 100, outputAmount: 30 },
  { source: 'crude-oil', target: 'chemicals', type: 'supply_chain', inputAmount: 100, outputAmount: 25 },
  { source: 'natural-gas', target: 'chemicals', type: 'supply_chain', inputAmount: 20, outputAmount: 50 },
  { source: 'natural-gas', target: 'electricity', type: 'supply_chain', inputAmount: 50, outputAmount: 400 },
  { source: 'bauxite', target: 'aluminum', type: 'supply_chain', inputAmount: 100, outputAmount: 40 },
  { source: 'silica-sand', target: 'silicon-wafer', type: 'supply_chain', inputAmount: 50, outputAmount: 10 },
  { source: 'silica-sand', target: 'glass', type: 'supply_chain', inputAmount: 80, outputAmount: 60 },
  { source: 'lithium', target: 'battery-cell', type: 'supply_chain', inputAmount: 20, outputAmount: 50 },
  { source: 'rare-earth', target: 'semiconductor-chip', type: 'supply_chain', inputAmount: 2, outputAmount: 100 },
  { source: 'rare-earth', target: 'electric-motor', type: 'supply_chain', inputAmount: 5, outputAmount: 15 },
  { source: 'rubber', target: 'auto-parts', type: 'supply_chain', inputAmount: 30, outputAmount: 40 },
  { source: 'coal', target: 'electricity', type: 'supply_chain', inputAmount: 100, outputAmount: 500 },
  
  // 基础加工 -> 中间产品
  { source: 'silicon-wafer', target: 'semiconductor-chip', type: 'supply_chain', inputAmount: 10, outputAmount: 100 },
  { source: 'silicon-wafer', target: 'advanced-chip', type: 'supply_chain', inputAmount: 20, outputAmount: 50 },
  { source: 'copper', target: 'pcb', type: 'supply_chain', inputAmount: 30, outputAmount: 50 },
  { source: 'copper', target: 'electric-motor', type: 'supply_chain', inputAmount: 50, outputAmount: 15 },
  { source: 'battery-cell', target: 'battery-pack', type: 'supply_chain', inputAmount: 100, outputAmount: 5 },
  { source: 'steel', target: 'mechanical-parts', type: 'supply_chain', inputAmount: 50, outputAmount: 80 },
  { source: 'steel', target: 'auto-parts', type: 'supply_chain', inputAmount: 50, outputAmount: 40 },
  { source: 'steel', target: 'engine', type: 'supply_chain', inputAmount: 80, outputAmount: 10 },
  { source: 'aluminum', target: 'auto-parts', type: 'supply_chain', inputAmount: 30, outputAmount: 40 },
  { source: 'aluminum', target: 'mechanical-parts', type: 'supply_chain', inputAmount: 20, outputAmount: 80 },
  { source: 'glass', target: 'display-panel', type: 'supply_chain', inputAmount: 20, outputAmount: 20 },
  { source: 'plastic', target: 'auto-parts', type: 'supply_chain', inputAmount: 40, outputAmount: 40 },
  { source: 'plastic', target: 'household-goods', type: 'supply_chain', inputAmount: 40, outputAmount: 100 },
  { source: 'chemicals', target: 'battery-cell', type: 'supply_chain', inputAmount: 30, outputAmount: 50 },
  
  // 中间产品 -> 消费品
  { source: 'semiconductor-chip', target: 'smartphone', type: 'supply_chain', inputAmount: 5, outputAmount: 10 },
  { source: 'semiconductor-chip', target: 'personal-computer', type: 'supply_chain', inputAmount: 10, outputAmount: 5 },
  { source: 'semiconductor-chip', target: 'smart-tv', type: 'supply_chain', inputAmount: 8, outputAmount: 10 },
  { source: 'semiconductor-chip', target: 'gaming-console', type: 'supply_chain', inputAmount: 5, outputAmount: 10 },
  { source: 'semiconductor-chip', target: 'home-appliance', type: 'supply_chain', inputAmount: 5, outputAmount: 20 },
  { source: 'advanced-chip', target: 'premium-smartphone', type: 'supply_chain', inputAmount: 3, outputAmount: 5 },
  { source: 'advanced-chip', target: 'vr-headset', type: 'supply_chain', inputAmount: 1, outputAmount: 8 },
  { source: 'advanced-chip', target: 'premium-ev', type: 'supply_chain', inputAmount: 10, outputAmount: 1 },
  { source: 'display-panel', target: 'smartphone', type: 'supply_chain', inputAmount: 1, outputAmount: 10 },
  { source: 'display-panel', target: 'premium-smartphone', type: 'supply_chain', inputAmount: 2, outputAmount: 5 },
  { source: 'display-panel', target: 'smart-tv', type: 'supply_chain', inputAmount: 10, outputAmount: 10 },
  { source: 'display-panel', target: 'personal-computer', type: 'supply_chain', inputAmount: 1, outputAmount: 5 },
  { source: 'display-panel', target: 'vr-headset', type: 'supply_chain', inputAmount: 2, outputAmount: 8 },
  { source: 'battery-pack', target: 'electric-vehicle', type: 'supply_chain', inputAmount: 1, outputAmount: 1 },
  { source: 'battery-pack', target: 'premium-ev', type: 'supply_chain', inputAmount: 2, outputAmount: 1 },
  { source: 'electric-motor', target: 'electric-vehicle', type: 'supply_chain', inputAmount: 1, outputAmount: 1 },
  { source: 'electric-motor', target: 'premium-ev', type: 'supply_chain', inputAmount: 2, outputAmount: 1 },
  { source: 'electric-motor', target: 'home-appliance', type: 'supply_chain', inputAmount: 5, outputAmount: 20 },
  { source: 'engine', target: 'gasoline-car', type: 'supply_chain', inputAmount: 1, outputAmount: 1 },
  { source: 'mechanical-parts', target: 'gasoline-car', type: 'supply_chain', inputAmount: 50, outputAmount: 1 },
  { source: 'mechanical-parts', target: 'electric-vehicle', type: 'supply_chain', inputAmount: 30, outputAmount: 1 },
  { source: 'mechanical-parts', target: 'home-appliance', type: 'supply_chain', inputAmount: 10, outputAmount: 20 },
  { source: 'auto-parts', target: 'gasoline-car', type: 'supply_chain', inputAmount: 50, outputAmount: 1 },
  { source: 'auto-parts', target: 'electric-vehicle', type: 'supply_chain', inputAmount: 40, outputAmount: 1 },
  { source: 'auto-parts', target: 'premium-ev', type: 'supply_chain', inputAmount: 60, outputAmount: 1 },
  { source: 'pcb', target: 'smartphone', type: 'supply_chain', inputAmount: 1, outputAmount: 10 },
  { source: 'pcb', target: 'personal-computer', type: 'supply_chain', inputAmount: 3, outputAmount: 5 },
  { source: 'pcb', target: 'gaming-console', type: 'supply_chain', inputAmount: 3, outputAmount: 10 },
  { source: 'pcb', target: 'smart-tv', type: 'supply_chain', inputAmount: 5, outputAmount: 10 },
  { source: 'sensors', target: 'smartphone', type: 'supply_chain', inputAmount: 5, outputAmount: 10 },
  { source: 'sensors', target: 'electric-vehicle', type: 'supply_chain', inputAmount: 20, outputAmount: 1 },
  { source: 'sensors', target: 'vr-headset', type: 'supply_chain', inputAmount: 10, outputAmount: 8 },
  
  // 农产品链
  { source: 'grain', target: 'packaged-food', type: 'supply_chain', inputAmount: 30, outputAmount: 50 },
  { source: 'grain', target: 'beverages', type: 'supply_chain', inputAmount: 20, outputAmount: 100 },
  { source: 'vegetables', target: 'packaged-food', type: 'supply_chain', inputAmount: 20, outputAmount: 50 },
  { source: 'meat', target: 'processed-meat', type: 'supply_chain', inputAmount: 30, outputAmount: 25 },
  { source: 'dairy', target: 'packaged-food', type: 'supply_chain', inputAmount: 10, outputAmount: 50 },
  { source: 'dairy', target: 'beverages', type: 'supply_chain', inputAmount: 15, outputAmount: 100 },
  
  // 服务类
  { source: 'electricity', target: 'computing-power', type: 'supply_chain', inputAmount: 200, outputAmount: 100 },
  { source: 'semiconductor-chip', target: 'computing-power', type: 'supply_chain', inputAmount: 1, outputAmount: 100 },
];

// ============ 辅助函数 ============

function buildAdjacencyLists(links: typeof supplyChainLinks): {
  upstream: Map<string, Set<string>>;
  downstream: Map<string, Set<string>>;
} {
  const upstream = new Map<string, Set<string>>();
  const downstream = new Map<string, Set<string>>();
  
  for (const link of links) {
    if (!upstream.has(link.target)) upstream.set(link.target, new Set());
    upstream.get(link.target)!.add(link.source);
    
    if (!downstream.has(link.source)) downstream.set(link.source, new Set());
    downstream.get(link.source)!.add(link.target);
  }
  
  return { upstream, downstream };
}

function getAllRelatedNodes(
  nodeId: string,
  upstream: Map<string, Set<string>>,
  downstream: Map<string, Set<string>>
): Set<string> {
  const related = new Set<string>();
  
  function getUpstream(id: string) {
    const parents = upstream.get(id);
    if (parents) {
      for (const p of parents) {
        if (!related.has(p)) {
          related.add(p);
          getUpstream(p);
        }
      }
    }
  }
  
  function getDownstream(id: string) {
    const children = downstream.get(id);
    if (children) {
      for (const c of children) {
        if (!related.has(c)) {
          related.add(c);
          getDownstream(c);
        }
      }
    }
  }
  
  getUpstream(nodeId);
  getDownstream(nodeId);
  
  return related;
}

// 获取玩家建筑生产和消耗的商品
function getPlayerGoodsRelations(buildings: Map<EntityId, BuildingInstance>): {
  produces: Set<string>;
  consumes: Set<string>;
} {
  const produces = new Set<string>();
  const consumes = new Set<string>();
  
  for (const [, building] of buildings) {
    const def = BUILDING_DEFINITIONS[building.definitionId];
    if (!def) continue;
    
    for (const slot of def.productionSlots) {
      // 获取当前激活的生产方式
      const slotTypeKey = slot.type as string;
      const activeMethodId = (building.activeMethodIds as Record<string, string>)?.[slotTypeKey] || slot.defaultMethodId;
      const method = slot.methods.find(m => m.id === activeMethodId);
      
      if (method) {
        for (const output of method.recipe.outputs) {
          produces.add(output.goodsId);
        }
        for (const input of method.recipe.inputs) {
          consumes.add(input.goodsId);
        }
      }
    }
  }
  
  return { produces, consumes };
}

// 计算利润率
function calculateProfitMargin(
  sourceId: string,
  targetId: string,
  marketPrices: Record<string, number>,
  link: typeof supplyChainLinks[0]
): number {
  const sourcePrice = marketPrices[sourceId];
  const targetPrice = marketPrices[targetId];
  
  if (!sourcePrice || !targetPrice || !link.inputAmount || !link.outputAmount) {
    return 0;
  }
  
  const inputCost = sourcePrice * link.inputAmount;
  const outputValue = targetPrice * link.outputAmount;
  
  if (inputCost === 0) return 0;
  
  return (outputValue - inputCost) / inputCost;
}

// 获取利润率对应的颜色 - 增强对比度
function getProfitColor(margin: number): string {
  if (margin > 0.3) return '#00ff00';  // 高利润 - 亮绿（霓虹绿）
  if (margin > 0.1) return '#4ade80';  // 中利润 - 绿色
  if (margin > 0) return '#facc15';    // 微利 - 金黄色
  if (margin > -0.1) return '#fb923c'; // 微亏 - 橙色
  return '#ff0000';                     // 高亏损 - 亮红
}

// ============ 迷你价格图组件（保留但使用下划线标记为未使用） ============

// 注意：MiniSparkline 组件已准备好，可用于小型节点上的价格显示
// 目前主图表使用更详细的 PriceChart 组件
// 保留此组件以备将来使用
/*
function _MiniSparkline({ history, width = 60, height = 20 }: {
  history: PriceHistoryEntry[];
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || history.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const prices = history.slice(-20).map(h => h.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;

    const xScale = d3.scaleLinear()
      .domain([0, prices.length - 1])
      .range([2, width - 2]);

    const yScale = d3.scaleLinear()
      .domain([minPrice - range * 0.1, maxPrice + range * 0.1])
      .range([height - 2, 2]);

    const line = d3.line<number>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveMonotoneX);

    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? '#22c55e' : '#ef4444';

    svg.append('path')
      .datum(prices)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('d', line);

  }, [history, width, height]);

  if (history.length < 2) {
    return <div style={{ width, height }} className="bg-slate-700/30 rounded" />;
  }

  return <svg ref={svgRef} width={width} height={height} />;
}
*/

// ============ 详情价格图组件 ============

function PriceChart({ history, width = 240, height = 80 }: { 
  history: PriceHistoryEntry[]; 
  width?: number; 
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || history.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 5, right: 5, bottom: 15, left: 35 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const prices = history.map(h => h.price);
    const minPrice = Math.min(...prices) * 0.95;
    const maxPrice = Math.max(...prices) * 1.05;

    const xScale = d3.scaleLinear()
      .domain([0, history.length - 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([minPrice, maxPrice])
      .range([innerHeight, 0]);

    // 渐变
    const isUp = prices[prices.length - 1] >= prices[0];
    const gradientColor = isUp ? '#22c55e' : '#ef4444';

    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'sparkline-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', gradientColor)
      .attr('stop-opacity', 0.3);
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', gradientColor)
      .attr('stop-opacity', 0);

    const area = d3.area<PriceHistoryEntry>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('fill', 'url(#sparkline-gradient)')
      .attr('d', area);

    const line = d3.line<PriceHistoryEntry>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', gradientColor)
      .attr('stroke-width', 2)
      .attr('d', line);

    // 当前点
    const lastPoint = history[history.length - 1];
    g.append('circle')
      .attr('cx', xScale(history.length - 1))
      .attr('cy', yScale(lastPoint.price))
      .attr('r', 4)
      .attr('fill', gradientColor)
      .attr('stroke', '#0d1117')
      .attr('stroke-width', 2);

    // Y轴
    const yAxis = d3.axisLeft(yScale)
      .ticks(3)
      .tickFormat(d => `¥${((d as number) / 100).toFixed(0)}`);
    
    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '8px');

    g.selectAll('.y-axis path, .y-axis line').attr('stroke', '#334155');

  }, [history, width, height]);

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center text-gray-500 text-xs" style={{ width, height }}>
        等待价格数据...
      </div>
    );
  }

  return <svg ref={svgRef} width={width} height={height} />;
}

// ============ 投资机会面板 ============

function OpportunityPanel({ opportunities, onClickGoods }: {
  opportunities: InvestmentOpportunity[];
  onClickGoods: (goodsId: string) => void;
}) {
  const groupedOps = useMemo(() => {
    const groups: Record<string, InvestmentOpportunity[]> = {
      price_low: [],
      price_high: [],
      high_profit_chain: [],
      supply_shortage: [],
    };
    for (const op of opportunities) {
      if (groups[op.type]) {
        groups[op.type].push(op);
      }
    }
    return groups;
  }, [opportunities]);

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl p-3 w-64 max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
        💡 投资机会
      </div>
      
      {/* 低价买入机会 */}
      {groupedOps.price_low.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-green-400 font-medium mb-1">📉 低价机会</div>
          {groupedOps.price_low.slice(0, 3).map(op => (
            <button
              key={op.id}
              onClick={() => op.goodsId && onClickGoods(op.goodsId)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-green-900/30 hover:bg-green-900/50 transition-colors mb-1"
            >
              <span className="text-lg">{op.icon}</span>
              <div className="flex-1 text-left">
                <div className="text-xs text-white">{op.goodsName}</div>
                <div className="text-[10px] text-green-400">{op.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* 高价卖出提示 */}
      {groupedOps.price_high.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-red-400 font-medium mb-1">📈 高价警告</div>
          {groupedOps.price_high.slice(0, 3).map(op => (
            <button
              key={op.id}
              onClick={() => op.goodsId && onClickGoods(op.goodsId)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-red-900/30 hover:bg-red-900/50 transition-colors mb-1"
            >
              <span className="text-lg">{op.icon}</span>
              <div className="flex-1 text-left">
                <div className="text-xs text-white">{op.goodsName}</div>
                <div className="text-[10px] text-red-400">{op.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* 高利润链 */}
      {groupedOps.high_profit_chain.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-purple-400 font-medium mb-1">🔗 高利润链</div>
          {groupedOps.high_profit_chain.slice(0, 3).map(op => (
            <div
              key={op.id}
              className="px-2 py-1.5 rounded bg-purple-900/30 mb-1"
            >
              <div className="text-[10px] text-white">{op.description}</div>
              {op.value !== undefined && (
                <div className="text-[10px] text-purple-400">利润率: +{(op.value * 100).toFixed(0)}%</div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {opportunities.length === 0 && (
        <div className="text-xs text-gray-500 text-center py-4">
          暂无投资机会
        </div>
      )}
    </div>
  );
}

// ============ 交易快捷面板（内嵌版，放在右侧栏底部） ============

interface QuickTradeProps {
  node: GoodsNodeEnhanced;
  priceHistory: PriceHistoryEntry[];
  onClose: () => void;
  onTrade: (goodsId: string, type: 'buy' | 'sell', quantity: number, price: number) => void;
  gameId: string | null;
}

function QuickTradePanelInline({ node, priceHistory, onClose, onTrade, gameId }: QuickTradeProps) {
  const [quantity, setQuantity] = useState(10);
  const navigateToEconomy = useGameStore(state => state.navigateToEconomyGoods);

  const handleQuickBuy = () => {
    if (!gameId) return;
    onTrade(node.id, 'buy', quantity, node.currentPrice);
  };

  const handleQuickSell = () => {
    if (!gameId) return;
    onTrade(node.id, 'sell', quantity, node.currentPrice);
  };

  const formatPrice = (cents: number) => {
    if (!Number.isFinite(cents)) return '¥0';
    if (cents >= 1000000) return `¥${(cents / 100 / 10000).toFixed(1)}万`;
    if (cents >= 10000) return `¥${(cents / 100).toFixed(0)}`;
    return `¥${(cents / 100).toFixed(2)}`;
  };

  const priceChangeColor = node.priceChangePercent > 0 ? 'text-green-400' :
                           node.priceChangePercent < 0 ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="bg-gradient-to-b from-cyan-900/30 to-gray-800/80 rounded-lg p-3 border border-cyan-700/50">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyan-700/40">
        <span className="text-cyan-400 text-sm font-bold">📊 商品详情</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
      </div>
      
      {/* 头部 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{node.icon}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm">{node.nameZh}</span>
              {node.playerProduces && <span className="text-[10px] bg-green-600/30 text-green-400 px-1 py-0.5 rounded">🏭</span>}
              {node.playerConsumes && <span className="text-[10px] bg-blue-600/30 text-blue-400 px-1 py-0.5 rounded">🛒</span>}
            </div>
            <div className="text-[10px] text-gray-400">{node.subcategory}</div>
          </div>
        </div>
      </div>
      
      {/* 价格信息 */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-slate-900/50 rounded p-1.5">
          <div className="text-[9px] text-gray-500">当前价格</div>
          <div className="text-sm font-bold text-cyan-400">{formatPrice(node.currentPrice)}</div>
          <div className={`text-[10px] ${priceChangeColor}`}>
            {node.priceChangePercent > 0 ? '▲' : node.priceChangePercent < 0 ? '▼' : '●'}
            {Math.abs(node.priceChangePercent).toFixed(1)}%
          </div>
        </div>
        <div className="bg-slate-900/50 rounded p-1.5">
          <div className="text-[9px] text-gray-500">我的库存</div>
          <div className="text-sm font-bold text-white">{node.playerInventory.toFixed(0)}</div>
          <div className="text-[10px] text-gray-500">
            价值 {formatPrice(node.playerInventory * node.currentPrice)}
          </div>
        </div>
      </div>

      {/* 价格走势 */}
      <div className="mb-2">
        <div className="text-[10px] text-gray-400 mb-1">📈 价格走势</div>
        <div className="bg-slate-900/50 rounded p-1.5">
          <PriceChart history={priceHistory} width={224} height={60} />
        </div>
      </div>
      
      {/* 快速交易 */}
      <div className="border-t border-gray-700 pt-2">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] text-gray-400">数量:</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 bg-slate-700 text-white px-1.5 py-0.5 rounded text-xs text-center"
          />
          <div className="flex gap-1 flex-1 justify-end">
            {[10, 50, 100].map(q => (
              <button
                key={q}
                onClick={() => setQuantity(q)}
                className={`px-1.5 py-0.5 text-[10px] rounded ${quantity === q ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-gray-400 hover:bg-slate-600'}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <button
            onClick={handleQuickBuy}
            disabled={!gameId}
            className="py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-bold text-xs rounded transition-colors"
          >
            🟢 买入
          </button>
          <button
            onClick={handleQuickSell}
            disabled={!gameId || node.playerInventory < quantity}
            className="py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white font-bold text-xs rounded transition-colors"
          >
            🔴 卖出
          </button>
        </div>
        
        <button
          onClick={() => navigateToEconomy(node.id)}
          className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-cyan-400 text-xs rounded transition-colors"
        >
          📈 进入交易中心
        </button>
      </div>
      
      {/* 标签 */}
      {node.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-700">
          {node.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-400">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ 主组件 ============

export function MarketGalaxy() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GoodsNodeEnhanced | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(['raw_material', 'basic_processed', 'intermediate', 'consumer_good'])
  );
  const [showPlayerChainOnly, setShowPlayerChainOnly] = useState(false);
  const [showOpportunities, setShowOpportunities] = useState(true);

  const priceHistory = usePriceHistory();
  const marketPrices = useMarketPrices();
  const inventory = useInventory();
  const buildings = useGameStore(state => state.buildings);
  const gameId = useGameStore(state => state.gameId);

  // 获取玩家建筑的商品关系
  const playerGoodsRelations = useMemo(() => {
    return getPlayerGoodsRelations(buildings);
  }, [buildings]);

  // 获取玩家库存
  const playerInventoryMap = useMemo(() => {
    const map = new Map<string, number>();
    if (inventory?.stocks) {
      for (const stock of inventory.stocks) {
        map.set(stock.goodsId, stock.quantity);
      }
    }
    return map;
  }, [inventory]);

  // 构建邻接表
  const adjacency = useMemo(() => buildAdjacencyLists(supplyChainLinks), []);

  // 计算增强节点数据
  const { nodes, links, opportunities } = useMemo(() => {
    let filteredGoods = GOODS_DATA.filter(g => activeCategories.has(g.category));
    
    // 玩家链筛选
    if (showPlayerChainOnly) {
      const playerGoods = new Set([...playerGoodsRelations.produces, ...playerGoodsRelations.consumes]);
      // 获取玩家商品的上下游
      const relatedGoods = new Set<string>();
      for (const goodsId of playerGoods) {
        const related = getAllRelatedNodes(goodsId, adjacency.upstream, adjacency.downstream);
        for (const r of related) relatedGoods.add(r);
        relatedGoods.add(goodsId);
      }
      filteredGoods = filteredGoods.filter(g => relatedGoods.has(g.id));
    }
    
    // 按层级分组
    const layers: Map<number, GoodsNodeEnhanced[]> = new Map();
    for (let i = 0; i < 4; i++) layers.set(i, []);

    const nodeMap = new Map<string, GoodsNodeEnhanced>();
    const ops: InvestmentOpportunity[] = [];

    for (const goods of filteredGoods) {
      const layer = categoryToLayer[goods.category] ?? 0;
      const currentPrice = marketPrices[goods.id] ?? goods.basePrice;
      const priceChangePercent = ((currentPrice - goods.basePrice) / goods.basePrice) * 100;
      
      const playerProduces = playerGoodsRelations.produces.has(goods.id);
      const playerConsumes = playerGoodsRelations.consumes.has(goods.id);
      const playerInv = playerInventoryMap.get(goods.id) ?? 0;
      
      // 判断投资机会
      let opportunity: 'buy' | 'sell' | 'hot' | null = null;
      
      if (priceChangePercent < -15) {
        opportunity = 'buy';
        ops.push({
          id: `low-${goods.id}`,
          type: 'price_low',
          goodsId: goods.id,
          goodsName: goods.nameZh,
          icon: goods.icon,
          description: `价格下跌 ${priceChangePercent.toFixed(0)}%`,
          value: priceChangePercent,
        });
      } else if (priceChangePercent > 25) {
        opportunity = 'sell';
        ops.push({
          id: `high-${goods.id}`,
          type: 'price_high',
          goodsId: goods.id,
          goodsName: goods.nameZh,
          icon: goods.icon,
          description: `价格上涨 +${priceChangePercent.toFixed(0)}%`,
          value: priceChangePercent,
        });
      }
      
      const node: GoodsNodeEnhanced = {
        id: goods.id,
        name: goods.name,
        nameZh: goods.nameZh,
        category: goods.category,
        subcategory: goods.subcategory,
        tags: goods.tags,
        icon: goods.icon,
        basePrice: goods.basePrice,
        layer,
        x: 0,
        y: 0,
        currentPrice,
        priceChangePercent,
        playerProduces,
        playerConsumes,
        playerInventory: playerInv,
        opportunity,
      };
      
      layers.get(layer)?.push(node);
      nodeMap.set(goods.id, node);
    }

    // 计算节点位置
    const padding = { left: 100, right: 100, top: 60, bottom: 60 };
    const availableWidth = dimensions.width - (showOpportunities ? 280 : 0);
    const layerWidth = (availableWidth - padding.left - padding.right) / 4;

    const allNodes: GoodsNodeEnhanced[] = [];

    for (let layerIdx = 0; layerIdx < 4; layerIdx++) {
      const layerNodes = layers.get(layerIdx) ?? [];
      const nodeHeight = (dimensions.height - padding.top - padding.bottom) / Math.max(layerNodes.length, 1);
      
      layerNodes.forEach((node, idx) => {
        node.x = padding.left + layerIdx * layerWidth + layerWidth / 2;
        node.y = padding.top + idx * nodeHeight + nodeHeight / 2;
        allNodes.push(node);
      });
    }

    // 过滤连接并计算利润率
    const filteredLinks: SupplyChainLinkEnhanced[] = [];
    
    for (const link of supplyChainLinks) {
      if (!nodeMap.has(link.source) || !nodeMap.has(link.target)) continue;
      
      const profitMargin = calculateProfitMargin(link.source, link.target, marketPrices, link);
      const sourceNode = nodeMap.get(link.source)!;
      const targetNode = nodeMap.get(link.target)!;
      const isPlayerChain = sourceNode.playerProduces || sourceNode.playerConsumes || 
                            targetNode.playerProduces || targetNode.playerConsumes;
      
      filteredLinks.push({
        source: link.source,
        target: link.target,
        type: link.type,
        profitMargin,
        isPlayerChain,
      });
      
      // 高利润链机会
      if (profitMargin > 0.3 && isPlayerChain) {
        ops.push({
          id: `chain-${link.source}-${link.target}`,
          type: 'high_profit_chain',
          description: `${sourceNode.nameZh} → ${targetNode.nameZh}`,
          value: profitMargin,
          chainPath: [link.source, link.target],
        });
      }
    }

    // 排序机会
    ops.sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0));

    return { nodes: allNodes, links: filteredLinks, opportunities: ops };
  }, [activeCategories, dimensions, marketPrices, playerGoodsRelations, playerInventoryMap, showPlayerChainOnly, showOpportunities, adjacency]);

  // 监听容器大小
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 绘制 SVG
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const availableWidth = dimensions.width - (showOpportunities ? 280 : 0);
    const { height } = dimensions;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // 滤镜
    const defs = svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'glow-market')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // 层级背景
    const layerWidth = (availableWidth - 200) / 4;
    for (let i = 0; i < 4; i++) {
      svg.append('rect')
        .attr('x', 100 + i * layerWidth)
        .attr('y', 30)
        .attr('width', layerWidth)
        .attr('height', height - 60)
        .attr('fill', i % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'rgba(30, 41, 59, 0.15)')
        .attr('rx', 8);

      svg.append('text')
        .attr('x', 100 + i * layerWidth + layerWidth / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .text(layerNames[i]);
    }

    // 连接线 - 使用利润着色
    const linkGroup = svg.append('g').attr('class', 'links');
    
    for (const link of links) {
      const sourceNode = nodeMap.get(link.source);
      const targetNode = nodeMap.get(link.target);
      if (!sourceNode || !targetNode) continue;

      const isSameLayer = sourceNode.layer === targetNode.layer;
      
      let pathD: string;
      
      if (isSameLayer) {
        const sx = sourceNode.x;
        const sy = sourceNode.y - 30;
        const tx = targetNode.x;
        const ty = targetNode.y - 30;
        const midX = (sx + tx) / 2;
        const arcHeight = Math.min(30, Math.abs(ty - sy) * 0.3 + 15);
        const controlY = Math.max(35, Math.min(sy, ty) - arcHeight);
        pathD = `M ${sx},${sy} Q ${midX},${controlY} ${tx},${ty}`;
      } else {
        const sx = sourceNode.x + 40;
        const sy = sourceNode.y;
        const tx = targetNode.x - 40;
        const ty = targetNode.y;
        const mx = (sx + tx) / 2;
        pathD = `M ${sx},${sy} C ${mx},${sy} ${mx},${ty} ${tx},${ty}`;
      }
      
      // 利润着色 - 增强颜色对比度
      const color = getProfitColor(link.profitMargin);
      const strokeWidth = link.isPlayerChain ? 3 : 2;
      // 高利润和亏损的线条更明显
      const baseOpacity = Math.abs(link.profitMargin) > 0.3 ? 0.8 :
                          Math.abs(link.profitMargin) > 0.1 ? 0.65 : 0.5;
      
      linkGroup.append('path')
        .attr('d', pathD)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-opacity', isSameLayer ? 0 : baseOpacity)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-dasharray', isSameLayer ? '4,3' : 'none')
        .attr('data-source', link.source)
        .attr('data-target', link.target)
        .attr('data-same-layer', isSameLayer ? 'true' : 'false')
        .attr('data-player-chain', link.isPlayerChain ? 'true' : 'false');
    }

    // 节点
    const nodeGroup = svg.append('g').attr('class', 'nodes');
    
    for (const node of nodes) {
      const g = nodeGroup.append('g')
        .attr('transform', `translate(${node.x}, ${node.y})`)
        .attr('cursor', 'pointer')
        .attr('data-id', node.id);

      // 玩家标记 - 外发光
      if (node.playerProduces || node.playerConsumes) {
        g.append('rect')
          .attr('x', -42)
          .attr('y', -32)
          .attr('width', 84)
          .attr('height', 64)
          .attr('rx', 10)
          .attr('fill', 'none')
          .attr('stroke', node.playerProduces ? '#22c55e' : '#3b82f6')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,2')
          .attr('opacity', 0.6);
      }

      // 节点背景 - 增大尺寸
      g.append('rect')
        .attr('x', -38)
        .attr('y', -28)
        .attr('width', 76)
        .attr('height', 56)
        .attr('rx', 8)
        .attr('fill', categoryColors[node.category]?.bg ?? 'rgba(100,100,100,0.2)')
        .attr('stroke', categoryColors[node.category]?.main ?? '#888')
        .attr('stroke-width', node.opportunity ? 2 : 1.5);

      // 机会指示器
      if (node.opportunity) {
        const oppColor = node.opportunity === 'buy' ? '#22c55e' : '#ef4444';
        g.append('circle')
          .attr('cx', 32)
          .attr('cy', -22)
          .attr('r', 8)
          .attr('fill', oppColor)
          .attr('class', 'opportunity-pulse');
        
        g.append('text')
          .attr('x', 32)
          .attr('y', -22)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', '10px')
          .attr('fill', '#fff')
          .text(node.opportunity === 'buy' ? '💰' : '⚠️');
      }

      // 玩家标记图标
      if (node.playerProduces) {
        g.append('text')
          .attr('x', -30)
          .attr('y', -20)
          .attr('font-size', '10px')
          .text('🏭');
      }
      if (node.playerConsumes) {
        g.append('text')
          .attr('x', node.playerProduces ? -18 : -30)
          .attr('y', -20)
          .attr('font-size', '10px')
          .text('🛒');
      }

      // 图标
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-5')
        .attr('font-size', '20px')
        .text(node.icon);

      // 名称
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '12')
        .attr('font-size', '10px')
        .attr('fill', '#e2e8f0')
        .attr('font-weight', '500')
        .text(node.nameZh.length > 4 ? node.nameZh.slice(0, 4) + '..' : node.nameZh);

      // 价格变化指示
      const priceColor = node.priceChangePercent > 0 ? '#22c55e' : 
                         node.priceChangePercent < 0 ? '#ef4444' : '#64748b';
      const arrow = node.priceChangePercent > 0 ? '▲' : 
                    node.priceChangePercent < 0 ? '▼' : '●';
      
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '24')
        .attr('font-size', '9px')
        .attr('fill', priceColor)
        .text(`${arrow}${Math.abs(node.priceChangePercent).toFixed(0)}%`);

      // 点击事件
      g.on('click', (event) => {
        setSelectedNode(node);
        event.stopPropagation();
      });

      // Hover 效果
      g.on('mouseover', function() {
        const relatedNodes = getAllRelatedNodes(node.id, adjacency.upstream, adjacency.downstream);
        relatedNodes.add(node.id);

        d3.select(this).select('rect')
          .transition().duration(150)
          .attr('stroke-width', 3)
          .attr('filter', 'url(#glow-market)');

        nodeGroup.selectAll('g').each(function() {
          const nodeId = d3.select(this).attr('data-id');
          if (nodeId && relatedNodes.has(nodeId)) {
            d3.select(this).select('rect')
              .transition().duration(150)
              .attr('stroke-width', 2.5)
              .attr('filter', 'url(#glow-market)');
          } else if (nodeId !== node.id) {
            d3.select(this)
              .transition().duration(150)
              .attr('opacity', 0.3);
          }
        });

        linkGroup.selectAll('path')
          .attr('stroke-opacity', function() {
            const source = d3.select(this).attr('data-source');
            const target = d3.select(this).attr('data-target');
            const isSameLayer = d3.select(this).attr('data-same-layer') === 'true';
            if (source && target && relatedNodes.has(source) && relatedNodes.has(target)) {
              return 0.9;
            }
            return isSameLayer ? 0 : 0.1;
          })
          .attr('stroke-width', function() {
            const source = d3.select(this).attr('data-source');
            const target = d3.select(this).attr('data-target');
            if (source && target && relatedNodes.has(source) && relatedNodes.has(target)) {
              return 4;
            }
            return 1;
          });
      });

      g.on('mouseout', function() {
        nodeGroup.selectAll('g').each(function() {
          d3.select(this).select('rect')
            .transition().duration(150)
            .attr('stroke-width', 1.5)
            .attr('filter', null);
          d3.select(this)
            .transition().duration(150)
            .attr('opacity', 1);
        });

        linkGroup.selectAll('path')
          .attr('stroke-opacity', function() {
            const isSameLayer = d3.select(this).attr('data-same-layer') === 'true';
            return isSameLayer ? 0 : 0.5;
          })
          .attr('stroke-width', function() {
            const isPlayerChain = d3.select(this).attr('data-player-chain') === 'true';
            return isPlayerChain ? 2.5 : 1.5;
          });
      });
    }

    // 点击空白关闭
    svg.on('click', () => setSelectedNode(null));

  }, [dimensions, nodes, links, adjacency, showOpportunities]);

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // 交易处理
  const handleTrade = useCallback(async (goodsId: string, type: 'buy' | 'sell', quantity: number, price: number) => {
    if (!gameId) return;
    
    try {
      const endpoint = type === 'buy' ? 'buy' : 'sell';
      const body = type === 'buy'
        ? { goodsId, quantity, maxPrice: price }
        : { goodsId, quantity, minPrice: price };
      
      const response = await fetch(`/api/v1/games/${gameId}/orders/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        // 成功提示可以通过 toast 或其他方式
        console.log(`${type} order placed successfully`);
      } else {
        const data = await response.json();
        console.error('Trade failed:', data.error);
      }
    } catch (err) {
      console.error('Trade error:', err);
    }
  }, [gameId]);

  const handleClickOpportunityGoods = (goodsId: string) => {
    const node = nodes.find(n => n.id === goodsId);
    if (node) {
      setSelectedNode(node);
    }
  };

  const selectedHistory = selectedNode ? (priceHistory.get(selectedNode.id) ?? []) : [];
  const svgWidth = dimensions.width - (showOpportunities ? 280 : 0);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0d1117] overflow-hidden flex">
      {/* 主图表区域 */}
      <div className="flex-1 relative">
        <svg ref={svgRef} width={svgWidth} height={dimensions.height} />
        
        {/* 筛选器 */}
        <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-3">
          <div className="text-xs font-bold text-gray-400 mb-2">商品类别</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(categoryNames).slice(0, 4).map(([key, name]) => (
              <button
                key={key}
                onClick={() => toggleCategory(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCategories.has(key)
                    ? 'text-white shadow-lg'
                    : 'text-gray-500 bg-gray-800/50 hover:bg-gray-700/50'
                }`}
                style={activeCategories.has(key) ? {
                  backgroundColor: categoryColors[key]?.main,
                } : {}}
              >
                {name} ({GOODS_BY_CATEGORY[key as keyof typeof GOODS_BY_CATEGORY]?.length || 0})
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 pt-2 border-t border-gray-700">
            <button
              onClick={() => setShowPlayerChainOnly(!showPlayerChainOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showPlayerChainOnly
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              🏭 仅显示我的产业链
            </button>
            <button
              onClick={() => setShowOpportunities(!showOpportunities)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showOpportunities
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              💡 投资机会
            </button>
          </div>
        </div>

        {/* 图例 */}
        <div className="absolute bottom-4 left-4 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl p-3 text-xs">
          <div className="font-bold text-gray-300 mb-2">产业链盈亏</div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-10 h-2 rounded-full" style={{ backgroundColor: '#00ff00', boxShadow: '0 0 8px #00ff00' }}></div>
            <span style={{ color: '#00ff00' }} className="font-bold">高利润 (&gt;30%)</span>
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-10 h-2 rounded-full" style={{ backgroundColor: '#4ade80', boxShadow: '0 0 4px #4ade80' }}></div>
            <span style={{ color: '#4ade80' }}>中利润 (10-30%)</span>
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-10 h-2 rounded-full" style={{ backgroundColor: '#facc15', boxShadow: '0 0 4px #facc15' }}></div>
            <span style={{ color: '#facc15' }}>微利 (0-10%)</span>
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-10 h-2 rounded-full" style={{ backgroundColor: '#ff0000', boxShadow: '0 0 8px #ff0000' }}></div>
            <span style={{ color: '#ff0000' }} className="font-bold">亏损 (&lt;0%)</span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-400">🏭</span>
              <span className="text-gray-400">我生产</span>
              <span className="text-blue-400 ml-2">🛒</span>
              <span className="text-gray-400">我消耗</span>
            </div>
          </div>
          <div className="mt-2 text-gray-500">
            共 {nodes.length} 种商品 · {links.length} 条连接
          </div>
        </div>

        {/* 操作提示 */}
        <div className="absolute bottom-4 right-4 text-xs text-gray-500">
          点击商品查看详情和快速交易
        </div>
      </div>

      {/* 右侧栏：投资机会 + 交易面板 */}
      {showOpportunities && (
        <div className="w-72 border-l border-gray-700 flex flex-col overflow-hidden bg-gray-900/50">
          {/* 投资机会面板 */}
          <div
            className="p-3 overflow-y-auto border-b-2 border-yellow-600/30"
            style={{ maxHeight: selectedNode ? '45%' : '100%' }}
          >
            <OpportunityPanel
              opportunities={opportunities}
              onClickGoods={handleClickOpportunityGoods}
            />
          </div>
          
          {/* 选中节点详情 + 交易面板（内嵌在右侧栏底部） */}
          {selectedNode && (
            <div className="flex-1 p-3 overflow-y-auto bg-gradient-to-b from-cyan-950/40 to-transparent">
              <QuickTradePanelInline
                node={selectedNode}
                priceHistory={selectedHistory}
                onClose={() => setSelectedNode(null)}
                onTrade={handleTrade}
                gameId={gameId}
              />
            </div>
          )}
          
          {/* 无选中时的提示 */}
          {!selectedNode && (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-gray-600">
                <div className="text-3xl mb-2">👆</div>
                <div className="text-xs">点击左侧商品节点<br/>查看详情和交易</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSS 动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        .opportunity-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}