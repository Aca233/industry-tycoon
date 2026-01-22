/**
 * MarketGalaxy - Hierarchical supply chain market visualization
 * Shows goods organized by supply chain layers (raw materials → finished goods)
 * with price history charts
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { GOODS_DATA, GOODS_BY_CATEGORY } from '@scc/shared';
import type { EntityId } from '@scc/shared';
import { usePriceHistory, useMarketPrices, type PriceHistoryEntry } from '../../stores';

interface GoodsNode {
  id: EntityId;
  name: string;
  nameZh: string;
  category: string;
  subcategory: string;
  tags: string[];
  icon: string;
  basePrice: number;
  layer: number; // 0=raw, 1=basic, 2=intermediate, 3=consumer
  x: number;
  y: number;
}

interface SupplyChainLink {
  source: string;
  target: string;
  type: 'supply_chain' | 'substitute' | 'complement';
}

// 类别配色
const categoryColors: Record<string, { main: string; bg: string }> = {
  raw_material: { main: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  basic_processed: { main: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  intermediate: { main: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  consumer_good: { main: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  service: { main: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
};

const categoryNames: Record<string, string> = {
  raw_material: '原材料',
  basic_processed: '基础加工',
  intermediate: '中间产品',
  consumer_good: '消费品',
  service: '服务',
};

const layerNames = ['原材料', '基础加工', '中间产品', '消费品'];

// 商品到层级的映射
const categoryToLayer: Record<string, number> = {
  raw_material: 0,
  basic_processed: 1,
  intermediate: 2,
  consumer_good: 3,
  service: 3,
};

// 完整的供应链连接
const supplyChainLinks: SupplyChainLink[] = [
  // ===== 原材料 -> 基础加工 =====
  { source: 'iron-ore', target: 'steel', type: 'supply_chain' },
  { source: 'coal', target: 'steel', type: 'supply_chain' },
  { source: 'copper-ore', target: 'copper', type: 'supply_chain' },
  { source: 'crude-oil', target: 'refined-fuel', type: 'supply_chain' },
  { source: 'crude-oil', target: 'plastic', type: 'supply_chain' },
  { source: 'crude-oil', target: 'chemicals', type: 'supply_chain' },
  { source: 'natural-gas', target: 'chemicals', type: 'supply_chain' },
  { source: 'natural-gas', target: 'electricity', type: 'supply_chain' },
  { source: 'bauxite', target: 'aluminum', type: 'supply_chain' },
  { source: 'silica-sand', target: 'silicon-wafer', type: 'supply_chain' },
  { source: 'silica-sand', target: 'glass', type: 'supply_chain' },
  { source: 'lithium', target: 'battery-cell', type: 'supply_chain' },
  { source: 'rare-earth', target: 'semiconductor-chip', type: 'supply_chain' },
  { source: 'rare-earth', target: 'electric-motor', type: 'supply_chain' },
  { source: 'rubber', target: 'auto-parts', type: 'supply_chain' },
  { source: 'coal', target: 'electricity', type: 'supply_chain' },
  
  // ===== 基础加工 -> 中间产品 =====
  { source: 'silicon-wafer', target: 'semiconductor-chip', type: 'supply_chain' },
  { source: 'silicon-wafer', target: 'advanced-chip', type: 'supply_chain' },
  { source: 'copper', target: 'pcb', type: 'supply_chain' },
  { source: 'copper', target: 'electric-motor', type: 'supply_chain' },
  { source: 'battery-cell', target: 'battery-pack', type: 'supply_chain' },
  { source: 'steel', target: 'mechanical-parts', type: 'supply_chain' },
  { source: 'steel', target: 'auto-parts', type: 'supply_chain' },
  { source: 'steel', target: 'engine', type: 'supply_chain' },
  { source: 'aluminum', target: 'auto-parts', type: 'supply_chain' },
  { source: 'aluminum', target: 'mechanical-parts', type: 'supply_chain' },
  { source: 'glass', target: 'display-panel', type: 'supply_chain' },
  { source: 'plastic', target: 'auto-parts', type: 'supply_chain' },
  { source: 'plastic', target: 'household-goods', type: 'supply_chain' },
  { source: 'chemicals', target: 'battery-cell', type: 'supply_chain' },
  { source: 'chemicals', target: 'plastic', type: 'supply_chain' },
  
  // ===== 中间产品 -> 消费品 =====
  { source: 'semiconductor-chip', target: 'smartphone', type: 'supply_chain' },
  { source: 'semiconductor-chip', target: 'personal-computer', type: 'supply_chain' },
  { source: 'semiconductor-chip', target: 'smart-tv', type: 'supply_chain' },
  { source: 'semiconductor-chip', target: 'gaming-console', type: 'supply_chain' },
  { source: 'semiconductor-chip', target: 'home-appliance', type: 'supply_chain' },
  { source: 'advanced-chip', target: 'premium-smartphone', type: 'supply_chain' },
  { source: 'advanced-chip', target: 'vr-headset', type: 'supply_chain' },
  { source: 'advanced-chip', target: 'premium-ev', type: 'supply_chain' },
  { source: 'display-panel', target: 'smartphone', type: 'supply_chain' },
  { source: 'display-panel', target: 'premium-smartphone', type: 'supply_chain' },
  { source: 'display-panel', target: 'smart-tv', type: 'supply_chain' },
  { source: 'display-panel', target: 'personal-computer', type: 'supply_chain' },
  { source: 'display-panel', target: 'vr-headset', type: 'supply_chain' },
  { source: 'battery-pack', target: 'electric-vehicle', type: 'supply_chain' },
  { source: 'battery-pack', target: 'premium-ev', type: 'supply_chain' },
  { source: 'battery-pack', target: 'smartphone', type: 'supply_chain' },
  { source: 'battery-pack', target: 'personal-computer', type: 'supply_chain' },
  { source: 'electric-motor', target: 'electric-vehicle', type: 'supply_chain' },
  { source: 'electric-motor', target: 'premium-ev', type: 'supply_chain' },
  { source: 'electric-motor', target: 'home-appliance', type: 'supply_chain' },
  { source: 'engine', target: 'gasoline-car', type: 'supply_chain' },
  { source: 'mechanical-parts', target: 'gasoline-car', type: 'supply_chain' },
  { source: 'mechanical-parts', target: 'electric-vehicle', type: 'supply_chain' },
  { source: 'mechanical-parts', target: 'home-appliance', type: 'supply_chain' },
  { source: 'auto-parts', target: 'gasoline-car', type: 'supply_chain' },
  { source: 'auto-parts', target: 'electric-vehicle', type: 'supply_chain' },
  { source: 'auto-parts', target: 'premium-ev', type: 'supply_chain' },
  { source: 'pcb', target: 'smartphone', type: 'supply_chain' },
  { source: 'pcb', target: 'personal-computer', type: 'supply_chain' },
  { source: 'pcb', target: 'gaming-console', type: 'supply_chain' },
  { source: 'pcb', target: 'smart-tv', type: 'supply_chain' },
  { source: 'sensors', target: 'smartphone', type: 'supply_chain' },
  { source: 'sensors', target: 'electric-vehicle', type: 'supply_chain' },
  { source: 'sensors', target: 'vr-headset', type: 'supply_chain' },
  
  // ===== 农产品链 =====
  { source: 'grain', target: 'packaged-food', type: 'supply_chain' },
  { source: 'grain', target: 'beverages', type: 'supply_chain' },
  { source: 'vegetables', target: 'packaged-food', type: 'supply_chain' },
  { source: 'meat', target: 'processed-meat', type: 'supply_chain' },
  { source: 'dairy', target: 'packaged-food', type: 'supply_chain' },
  { source: 'dairy', target: 'beverages', type: 'supply_chain' },
  
  // ===== 服务类 =====
  { source: 'electricity', target: 'computing-power', type: 'supply_chain' },
  { source: 'semiconductor-chip', target: 'computing-power', type: 'supply_chain' },
];

// 构建邻接表用于递归查找
function buildAdjacencyLists(links: SupplyChainLink[]): {
  upstream: Map<string, Set<string>>;
  downstream: Map<string, Set<string>>;
} {
  const upstream = new Map<string, Set<string>>();  // 上游 (谁是我的原料)
  const downstream = new Map<string, Set<string>>(); // 下游 (我是谁的原料)
  
  for (const link of links) {
    // target 的上游包含 source
    if (!upstream.has(link.target)) upstream.set(link.target, new Set());
    upstream.get(link.target)!.add(link.source);
    
    // source 的下游包含 target
    if (!downstream.has(link.source)) downstream.set(link.source, new Set());
    downstream.get(link.source)!.add(link.target);
  }
  
  return { upstream, downstream };
}

// 递归获取所有相关节点
function getAllRelatedNodes(
  nodeId: string,
  upstream: Map<string, Set<string>>,
  downstream: Map<string, Set<string>>
): Set<string> {
  const related = new Set<string>();
  
  // 递归获取上游
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
  
  // 递归获取下游
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

// 价格曲线组件
function PriceChart({ history, width = 180, height = 60 }: { 
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

    // 计算价格范围
    const prices = history.map(h => h.price);
    const minPrice = Math.min(...prices) * 0.95;
    const maxPrice = Math.max(...prices) * 1.05;

    // 比例尺
    const xScale = d3.scaleLinear()
      .domain([0, history.length - 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([minPrice, maxPrice])
      .range([innerHeight, 0]);

    // 绘制网格线
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data([0.25, 0.5, 0.75])
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => innerHeight * d)
      .attr('y2', d => innerHeight * d)
      .attr('stroke', '#334155')
      .attr('stroke-dasharray', '2,2');

    // 创建线条生成器
    const line = d3.line<PriceHistoryEntry>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX); // 平滑曲线

    // 绘制渐变区域
    const area = d3.area<PriceHistoryEntry>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    // 创建渐变
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'price-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#22d3ee')
      .attr('stop-opacity', 0.3);
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#22d3ee')
      .attr('stop-opacity', 0);

    g.append('path')
      .datum(history)
      .attr('fill', 'url(#price-gradient)')
      .attr('d', area);

    // 绘制价格线
    g.append('path')
      .datum(history)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 2)
      .attr('d', line);

    // 绘制当前价格点
    const lastPoint = history[history.length - 1];
    g.append('circle')
      .attr('cx', xScale(history.length - 1))
      .attr('cy', yScale(lastPoint.price))
      .attr('r', 4)
      .attr('fill', '#22d3ee')
      .attr('stroke', '#0d1117')
      .attr('stroke-width', 2);

    // Y轴
    const yAxis = d3.axisLeft(yScale)
      .ticks(3)
      .tickFormat(d => `¥${(d as number / 100).toFixed(0)}`);
    
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

export function MarketGalaxy() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GoodsNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(['raw_material', 'basic_processed', 'intermediate', 'consumer_good'])
  );

  const priceHistory = usePriceHistory();
  const marketPrices = useMarketPrices();

  // 构建邻接表
  const { adjacency } = useMemo(() => {
    const adj = buildAdjacencyLists(supplyChainLinks);
    return { adjacency: adj };
  }, []);

  // 计算节点位置 - 分层布局
  const { nodes, links } = useMemo(() => {
    const filteredGoods = GOODS_DATA.filter(g => activeCategories.has(g.category));
    
    // 按层级分组
    const layers: Map<number, GoodsNode[]> = new Map();
    for (let i = 0; i < 4; i++) layers.set(i, []);

    const nodeMap = new Map<string, GoodsNode>();

    for (const goods of filteredGoods) {
      const layer = categoryToLayer[goods.category] ?? 0;
      const node: GoodsNode = {
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
      };
      layers.get(layer)?.push(node);
      nodeMap.set(goods.id, node);
    }

    // 计算节点位置
    const padding = { left: 80, right: 80, top: 60, bottom: 60 };
    const layerWidth = (dimensions.width - padding.left - padding.right) / 4;

    const allNodes: GoodsNode[] = [];

    for (let layerIdx = 0; layerIdx < 4; layerIdx++) {
      const layerNodes = layers.get(layerIdx) ?? [];
      
      const nodeHeight = (dimensions.height - padding.top - padding.bottom) / Math.max(layerNodes.length, 1);
      
      layerNodes.forEach((node, idx) => {
        node.x = padding.left + layerIdx * layerWidth + layerWidth / 2;
        node.y = padding.top + idx * nodeHeight + nodeHeight / 2;
        allNodes.push(node);
      });
    }

    // 过滤连接
    const filteredLinks = supplyChainLinks.filter(
      l => nodeMap.has(l.source) && nodeMap.has(l.target)
    );

    return { nodes: allNodes, links: filteredLinks };
  }, [activeCategories, dimensions]);

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

  // 分离：主 SVG 绘制（只在 dimensions/nodes/links 变化时）
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // 创建滤镜
    const defs = svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'glow-market')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // 绘制层级背景
    const layerWidth = (width - 160) / 4;
    for (let i = 0; i < 4; i++) {
      svg.append('rect')
        .attr('x', 80 + i * layerWidth)
        .attr('y', 30)
        .attr('width', layerWidth)
        .attr('height', height - 60)
        .attr('fill', i % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'rgba(30, 41, 59, 0.15)')
        .attr('rx', 8);

      // 层级标签
      svg.append('text')
        .attr('x', 80 + i * layerWidth + layerWidth / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .text(layerNames[i]);
    }

    // 绘制连接线 - 区分跨层和同层连接
    const linkGroup = svg.append('g').attr('class', 'links');
    
    for (const link of links) {
      const sourceNode = nodeMap.get(link.source);
      const targetNode = nodeMap.get(link.target);
      if (!sourceNode || !targetNode) continue;

      const isSameLayer = sourceNode.layer === targetNode.layer;
      
      let pathD: string;
      
      if (isSameLayer) {
        // 同层级连接 - 使用向上弯曲的弧形
        const sx = sourceNode.x;
        const sy = sourceNode.y - 25; // 从节点顶部出发
        const tx = targetNode.x;
        const ty = targetNode.y - 25;
        
        // 计算弧形控制点 - 向上弯曲，但限制在可视区域内
        const midX = (sx + tx) / 2;
        const verticalDistance = Math.abs(ty - sy);
        const arcHeight = Math.min(30, verticalDistance * 0.3 + 15); // 更小的弧度高度
        const controlY = Math.max(35, Math.min(sy, ty) - arcHeight); // 确保不超出顶部
        
        pathD = `M ${sx},${sy} Q ${midX},${controlY} ${tx},${ty}`;
      } else {
        // 跨层连接 - 使用水平贝塞尔曲线
        const sx = sourceNode.x + 20;
        const sy = sourceNode.y;
        const tx = targetNode.x - 20;
        const ty = targetNode.y;
        const mx = (sx + tx) / 2;
        
        pathD = `M ${sx},${sy} C ${mx},${sy} ${mx},${ty} ${tx},${ty}`;
      }
      
      linkGroup.append('path')
        .attr('d', pathD)
        .attr('fill', 'none')
        .attr('stroke', isSameLayer ? '#f59e0b' : '#4ade80') // 同层用橙色，跨层用绿色
        .attr('stroke-opacity', isSameLayer ? 0 : 0.4) // 同层默认隐藏
        .attr('stroke-width', isSameLayer ? 1.5 : 1.5)
        .attr('stroke-dasharray', isSameLayer ? '4,3' : 'none') // 同层用虚线
        .attr('data-source', link.source)
        .attr('data-target', link.target)
        .attr('data-same-layer', isSameLayer ? 'true' : 'false');
    }

    // 绘制节点
    const nodeGroup = svg.append('g').attr('class', 'nodes');
    
    for (const node of nodes) {
      const g = nodeGroup.append('g')
        .attr('transform', `translate(${node.x}, ${node.y})`)
        .attr('cursor', 'pointer')
        .attr('data-id', node.id);

      // 节点背景
      g.append('rect')
        .attr('x', -35)
        .attr('y', -25)
        .attr('width', 70)
        .attr('height', 50)
        .attr('rx', 8)
        .attr('fill', categoryColors[node.category]?.bg ?? 'rgba(100,100,100,0.2)')
        .attr('stroke', categoryColors[node.category]?.main ?? '#888')
        .attr('stroke-width', 1.5);

      // 图标
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-5')
        .attr('font-size', '18px')
        .text(node.icon);

      // 名称
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '15')
        .attr('font-size', '10px')
        .attr('fill', '#e2e8f0')
        .text(node.nameZh.length > 4 ? node.nameZh.slice(0, 4) + '..' : node.nameZh);

      // 价格变化指示器容器（稍后由单独的 effect 更新）
      g.append('circle')
        .attr('class', 'price-indicator')
        .attr('cx', 28)
        .attr('cy', -18)
        .attr('r', 6)
        .attr('fill', '#64748b');

      g.append('text')
        .attr('class', 'price-arrow')
        .attr('x', 28)
        .attr('y', -18)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '8px')
        .attr('fill', '#fff')
        .text('●');

      // 点击事件
      g.on('click', (event) => {
        setSelectedNode(node);
        event.stopPropagation();
      });

      // Hover 效果 - 递归高亮整条产业链
      g.on('mouseover', function() {
        // 获取所有相关节点（递归上下游）
        const relatedNodes = getAllRelatedNodes(node.id, adjacency.upstream, adjacency.downstream);
        relatedNodes.add(node.id);

        // 高亮当前节点
        d3.select(this).select('rect')
          .transition().duration(150)
          .attr('stroke-width', 3)
          .attr('filter', 'url(#glow-market)');

        // 高亮所有相关节点
        nodeGroup.selectAll('g').each(function() {
          const nodeId = d3.select(this).attr('data-id');
          if (nodeId && relatedNodes.has(nodeId)) {
            d3.select(this).select('rect')
              .transition().duration(150)
              .attr('stroke-width', 2.5)
              .attr('filter', 'url(#glow-market)');
          } else if (nodeId !== node.id) {
            d3.select(this).select('rect')
              .transition().duration(150)
              .attr('opacity', 0.3);
          }
        });

        // 高亮所有相关连接（上下游全部亮起，包括同层连接）
        linkGroup.selectAll('path')
          .attr('stroke-opacity', function() {
            const source = d3.select(this).attr('data-source');
            const target = d3.select(this).attr('data-target');
            const isSameLayer = d3.select(this).attr('data-same-layer') === 'true';
            // 检查连接的两端是否都在相关节点中
            if (source && target && relatedNodes.has(source) && relatedNodes.has(target)) {
              return 0.9; // hover 时显示同层连接
            }
            return isSameLayer ? 0 : 0.05; // 非相关的同层连接保持隐藏
          })
          .attr('stroke-width', function() {
            const source = d3.select(this).attr('data-source');
            const target = d3.select(this).attr('data-target');
            if (source && target && relatedNodes.has(source) && relatedNodes.has(target)) {
              return 3;
            }
            return 1;
          });
      });

      g.on('mouseout', function() {
        // 恢复所有节点
        nodeGroup.selectAll('g').each(function() {
          d3.select(this).select('rect')
            .transition().duration(150)
            .attr('stroke-width', 1.5)
            .attr('filter', null)
            .attr('opacity', 1);
        });

        // 恢复所有连接 - 同层连接恢复隐藏
        linkGroup.selectAll('path')
          .attr('stroke-opacity', function() {
            const isSameLayer = d3.select(this).attr('data-same-layer') === 'true';
            return isSameLayer ? 0 : 0.4;
          })
          .attr('stroke-width', 1.5);
      });
    }

    // 点击空白关闭详情
    svg.on('click', () => setSelectedNode(null));

  }, [dimensions, nodes, links, adjacency]);

  // 分离：价格指示器更新（只更新颜色和箭头，不重绘整个 SVG）
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const nodeGroup = svg.select('.nodes');
    
    if (nodeGroup.empty()) return;
    
    nodeGroup.selectAll('g').each(function() {
      const g = d3.select(this);
      const nodeId = g.attr('data-id');
      if (!nodeId) return;
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      const currentPrice = marketPrices[nodeId] ?? node.basePrice;
      const priceChange = currentPrice - node.basePrice;
      const priceColor = priceChange > 0 ? '#22c55e' : priceChange < 0 ? '#ef4444' : '#64748b';
      const arrow = priceChange > 0 ? '▲' : priceChange < 0 ? '▼' : '●';
      
      g.select('.price-indicator').attr('fill', priceColor);
      g.select('.price-arrow').text(arrow);
    });
  }, [marketPrices, nodes]);

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

  const formatPrice = (cents: number | undefined | null) => {
    // Handle undefined, null, or NaN values
    if (cents === undefined || cents === null || !Number.isFinite(cents)) {
      return '¥0';
    }
    if (cents >= 1000000) return `¥${(cents / 100 / 10000).toFixed(1)}万`;
    if (cents >= 10000) return `¥${(cents / 100).toFixed(0)}`;
    return `¥${(cents / 100).toFixed(2)}`;
  };

  // 获取选中商品的价格历史
  const selectedHistory = selectedNode ? (priceHistory.get(selectedNode.id) ?? []) : [];

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0d1117] overflow-hidden">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
      
      {/* 分类筛选器 */}
      <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-3">
        <div className="text-xs font-bold text-gray-400 mb-2">商品类别</div>
        <div className="flex flex-wrap gap-2">
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
      </div>

      {/* 选中节点详情 + 价格曲线 */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl p-4 w-72 z-50 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedNode.icon}</span>
              <div>
                <div className="font-bold text-white">{selectedNode.nameZh}</div>
                <div className="text-xs text-gray-400">{selectedNode.subcategory}</div>
              </div>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-white">✕</button>
          </div>
          
          <div 
            className="inline-flex px-2 py-1 rounded-md text-xs font-medium mb-3"
            style={{ 
              backgroundColor: categoryColors[selectedNode.category]?.bg,
              color: categoryColors[selectedNode.category]?.main 
            }}
          >
            {categoryNames[selectedNode.category]}
          </div>
          
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-gray-400">当前价格</span>
              <span className="text-cyan-400 font-medium">
                {formatPrice(marketPrices[selectedNode.id] ?? selectedNode.basePrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">基准价格</span>
              <span className="text-orange-400">{formatPrice(selectedNode.basePrice)}</span>
            </div>
          </div>

          {/* 价格曲线 */}
          <div className="border-t border-gray-700 pt-3">
            <div className="text-xs text-gray-400 mb-2">价格走势</div>
            <div className="bg-gray-800/50 rounded-lg p-2">
              <PriceChart history={selectedHistory} width={240} height={80} />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-700">
            {selectedNode.tags.slice(0, 4).map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-3 text-xs">
        <div className="font-bold text-gray-300 mb-2">供应链流向</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-0.5 bg-green-400"></div>
          <span className="text-gray-400">跨层连接（原料→产品）</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-amber-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #f59e0b 0, #f59e0b 4px, transparent 4px, transparent 7px)' }}></div>
          <span className="text-gray-400">同层连接（hover显示）</span>
        </div>
        <div className="mt-2 text-gray-500">
          共 {nodes.length} 种商品 · {links.length} 条连接
        </div>
      </div>

      {/* 操作提示 */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-500">
        点击商品查看详情和价格曲线
      </div>
    </div>
  );
}