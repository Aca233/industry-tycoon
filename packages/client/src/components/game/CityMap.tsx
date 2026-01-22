/**
 * CityMap - PixiJS powered city holographic map
 * Displays buildings as nodes with supply chain connections
 * 
 * 优化版本：
 * - 更大的节点间距
 * - 简化的配色方案（类别色为主，状态用边框表示）
 * - 贝塞尔曲线连接
 * - 清晰的分层布局
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useGameStore } from '../../stores';
import { BUILDINGS_MAP, type BuildingData } from '@scc/shared';
import type { EntityId, BuildingInstance } from '@scc/shared';

interface BuildingNode {
  id: EntityId;
  name: string;
  category: string;
  x: number;
  y: number;
  size: number;
  status: 'profitable' | 'loss' | 'warning';
  connections: EntityId[];
  buildingData: BuildingData;
  row: number;
}

// 类别配色 - 使用更柔和的渐变色
const categoryColors: Record<string, { main: number; glow: number; text: string }> = {
  extraction: { main: 0xf59e0b, glow: 0xfbbf24, text: '#f59e0b' },    // 橙色 - 资源开采
  processing: { main: 0x3b82f6, glow: 0x60a5fa, text: '#3b82f6' },    // 蓝色 - 基础加工
  manufacturing: { main: 0x8b5cf6, glow: 0xa78bfa, text: '#8b5cf6' }, // 紫色 - 高端制造
  service: { main: 0x10b981, glow: 0x34d399, text: '#10b981' },       // 绿色 - 服务设施
  retail: { main: 0xec4899, glow: 0xf472b6, text: '#ec4899' },        // 粉色 - 零售消费
  agriculture: { main: 0x84cc16, glow: 0xa3e635, text: '#84cc16' },   // 青绿 - 农业畜牧
};

// 状态颜色 - 用于边框
const statusStyles: Record<string, { borderColor: number; borderWidth: number }> = {
  profitable: { borderColor: 0x22c55e, borderWidth: 3 },
  loss: { borderColor: 0xef4444, borderWidth: 3 },
  warning: { borderColor: 0xeab308, borderWidth: 2 },
};

// 统一节点大小
const NODE_SIZE = 28;
const NODE_SPACING_X = 120;
const NODE_SPACING_Y = 70;
const LAYER_GAP = 10; // 层级之间的额外间距

// 行名称
const rowLabels = ['资源开采', '基础加工', '高端制造', '服务设施', '零售消费', '农业畜牧'];

// 产业链连接关系
const supplyChainConnections: Record<string, string[]> = {
  'iron-mine': ['steel-mill'],
  'coal-mine': ['steel-mill', 'power-plant-coal'],
  'copper-mine': ['copper-smelter'],
  'rare-earth-mine': ['chip-fab', 'battery-factory'],
  'oil-field': ['refinery'],
  'lithium-mine': ['battery-factory'],
  'steel-mill': ['ev-factory'],
  'refinery': ['chemical-plant'],
  'copper-smelter': ['electronics-factory', 'battery-factory'],
  'silicon-plant': ['chip-fab'],
  'chemical-plant': ['chip-fab', 'battery-factory'],
  'chip-fab': ['electronics-factory', 'ev-factory', 'data-center'],
  'battery-factory': ['ev-factory'],
  'display-factory': ['electronics-factory', 'ev-factory'],
  'power-plant-coal': ['chip-fab', 'data-center'],
  'power-plant-gas': ['chip-fab', 'data-center'],
};

// 根据玩家拥有的建筑生成节点
function generateBuildingNodesFromInstances(buildingInstances: BuildingInstance[]): BuildingNode[] {
  const nodes: BuildingNode[] = [];
  const categories = ['extraction', 'processing', 'manufacturing', 'service', 'retail', 'agriculture'] as const;
  
  // 按类别分组建筑实例
  const instancesByCategory = new Map<string, BuildingInstance[]>();
  categories.forEach(cat => instancesByCategory.set(cat, []));
  
  buildingInstances.forEach(instance => {
    const def = BUILDINGS_MAP.get(instance.definitionId);
    if (def) {
      const catInstances = instancesByCategory.get(def.category) || [];
      catInstances.push(instance);
      instancesByCategory.set(def.category, catInstances);
    }
  });

  // 只渲染有建筑的类别
  let currentRow = 0;
  categories.forEach((category) => {
    const instances = instancesByCategory.get(category) || [];
    if (instances.length === 0) return; // 跳过没有建筑的类别
    
    const startX = 150;
    const y = 80 + currentRow * (NODE_SPACING_Y + LAYER_GAP);
    
    instances.forEach((instance, colIndex) => {
      const def = BUILDINGS_MAP.get(instance.definitionId);
      if (!def) return;
      
      // 根据运营状态确定显示状态（operationalStatus可能是字符串或枚举）
      const opStatus = String(instance.operationalStatus);
      const status: 'profitable' | 'loss' | 'warning' =
        opStatus === 'running' || opStatus === 'operational' ? 'profitable' :
        opStatus === 'paused' ? 'warning' : 'loss';
      
      nodes.push({
        id: instance.id,
        name: instance.name || def.nameZh,
        category: def.category,
        x: startX + colIndex * NODE_SPACING_X,
        y: y,
        size: NODE_SIZE,
        status,
        connections: supplyChainConnections[def.id] || [],
        buildingData: def,
        row: currentRow,
      });
    });
    
    currentRow++; // 只有渲染了建筑的类别才增加行号
  });

  return nodes;
}

export function CityMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const buildingNodesRef = useRef<BuildingNode[]>([]);
  const labelsContainerRef = useRef<Container | null>(null);
  const interactiveContainerRef = useRef<Container | null>(null);
  const selectBuildingRef = useRef<(id: EntityId | null) => void>(() => {});
  const hoveredNodeIdRef = useRef<EntityId | null>(null); // 用于ticker中的hover检测
  const [hoveredBuilding, setHoveredBuilding] = useState<BuildingNode | null>(null);
  const [_hoveredNodeId, setHoveredNodeId] = useState<EntityId | null>(null);
  const [pixiReady, setPixiReady] = useState(false);
  
  const buildingsMap = useGameStore((state) => state.buildings);
  const selectBuilding = useGameStore((state) => state.selectBuilding);
  
  // 更新ref
  selectBuildingRef.current = selectBuilding;
  
  // 使用buildings的size作为依赖触发器
  const buildingsSize = buildingsMap.size;
  
  // 从store的buildings Map生成节点
  const buildingNodes = useMemo(() => {
    const instances = Array.from(buildingsMap.values());
    return generateBuildingNodesFromInstances(instances);
  }, [buildingsMap, buildingsSize]);
  
  // 每当buildingNodes数量变化或PixiJS准备就绪时，更新ref并重建交互元素
  const buildingNodesCount = buildingNodes.length;
  
  useEffect(() => {
    buildingNodesRef.current = buildingNodes;
  }, [buildingNodes, buildingNodesCount, pixiReady]);
  
  // 计算统计数据
  const stats = useMemo(() => {
    const byCategory = new Map<string, number>();
    buildingNodes.forEach(node => {
      byCategory.set(node.category, (byCategory.get(node.category) || 0) + 1);
    });
    return byCategory;
  }, [buildingNodes]);

  useEffect(() => {
    if (!containerRef.current) return;

    const initPixi = async () => {
      const app = new Application();
      await app.init({
        background: 0x0d1117,
        resizeTo: containerRef.current!,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      
      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      const mainContainer = new Container();
      app.stage.addChild(mainContainer);

      // 层级：背景 -> 行标签 -> 连接线 -> 节点 -> 文字标签(动态) -> 交互层
      const bgLayer = new Graphics();
      const rowLabelContainer = new Container();
      const connectionsLayer = new Graphics();
      const nodesLayer = new Graphics();
      const dynamicLabelsContainer = new Container();  // 动态标签容器，每帧更新
      const interactiveContainer = new Container();
      
      mainContainer.addChild(bgLayer);
      mainContainer.addChild(rowLabelContainer);
      mainContainer.addChild(connectionsLayer);
      mainContainer.addChild(nodesLayer);
      mainContainer.addChild(dynamicLabelsContainer);
      mainContainer.addChild(interactiveContainer);
      
      // 保存引用以便后续更新
      labelsContainerRef.current = dynamicLabelsContainer;
      interactiveContainerRef.current = interactiveContainer;
      
      // 启用sortableChildren以使zIndex生效
      dynamicLabelsContainer.sortableChildren = true;
      
      // 预创建标签样式（只创建一次）
      const nodeLabelStyleForTicker = new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 11,
        fill: '#ffffff',
        fontWeight: '500',
        align: 'center',
      });
      
      // 标记PixiJS准备就绪，触发buildingNodes的更新
      setPixiReady(true);

      // 绘制背景 - 带微妙渐变的网格
      bgLayer.rect(0, 0, app.screen.width, app.screen.height);
      bgLayer.fill({ color: 0x0d1117 });
      
      // 微妙的网格线
      const gridSize = 40;
      for (let x = 0; x < app.screen.width; x += gridSize) {
        bgLayer.moveTo(x, 0);
        bgLayer.lineTo(x, app.screen.height);
        bgLayer.stroke({ color: 0x21262d, width: 1, alpha: 0.5 });
      }
      for (let y = 0; y < app.screen.height; y += gridSize) {
        bgLayer.moveTo(0, y);
        bgLayer.lineTo(app.screen.width, y);
        bgLayer.stroke({ color: 0x21262d, width: 1, alpha: 0.5 });
      }

      // 绘制行标签（产业层级标识）
      const allCategories = ['extraction', 'processing', 'manufacturing', 'service', 'retail', 'agriculture'] as const;
      allCategories.forEach((cat, i) => {
        const y = 80 + i * (NODE_SPACING_Y + LAYER_GAP);
        const colors = categoryColors[cat];
        
        // 行背景条
        const rowBg = new Graphics();
        rowBg.roundRect(10, y - 25, 85, 50, 8);
        rowBg.fill({ color: colors.main, alpha: 0.1 });
        rowBg.stroke({ color: colors.main, alpha: 0.3, width: 1 });
        rowLabelContainer.addChild(rowBg);
        
        // 行标签
        const label = new Text({
          text: rowLabels[i],
          style: new TextStyle({
            fontFamily: 'system-ui, sans-serif',
            fontSize: 11,
            fontWeight: 'bold',
            fill: colors.main,
          }),
        });
        label.x = 20;
        label.y = y - 5;
        rowLabelContainer.addChild(label);
      });

      // 动画循环
      let time = 0;
      // 缓存的标签和交互区域
      const labelCache = new Map<string, Text>();
      const hitAreaCache = new Map<string, Graphics>();
      
      // 用于闭包的引用
      const selectBuildingFn = selectBuildingRef;
      const hoveredIdRef = hoveredNodeIdRef;
      const setHoveredBuildingFn = (b: BuildingNode | null) => {
        setHoveredBuilding(b);
      };
      const setHoveredNodeIdFn = (id: EntityId | null) => {
        hoveredIdRef.current = id;
        setHoveredNodeId(id);
      };

      app.ticker.add(() => {
        time += 0.015;
        connectionsLayer.clear();
        nodesLayer.clear();
        
        const currentNodes = buildingNodesRef.current;
        // 创建从定义ID到实例节点的映射（用于连接线查找）
        const buildingByDefId = new Map(currentNodes.map(b => [b.buildingData.id, b]));
        const currentHoveredId = hoveredIdRef.current; // 使用ref获取最新hover状态
        
        // 更新动态标签和交互区域 - 在ticker中管理
        const existingIds = new Set(currentNodes.map(n => n.id));
        
        // 移除不再存在的标签和交互区域
        for (const [id, label] of labelCache.entries()) {
          if (!existingIds.has(id)) {
            dynamicLabelsContainer.removeChild(label);
            label.destroy();
            labelCache.delete(id);
          }
        }
        for (const [id, hitArea] of hitAreaCache.entries()) {
          if (!existingIds.has(id)) {
            interactiveContainer.removeChild(hitArea);
            hitArea.destroy();
            hitAreaCache.delete(id);
          }
        }
        
        // 添加新标签、交互区域，或更新现有的
        currentNodes.forEach((building) => {
          const displayName = building.name || building.buildingData?.nameZh || '未命名';
          
          // 标签
          if (!labelCache.has(building.id)) {
            const label = new Text({
              text: displayName,
              style: nodeLabelStyleForTicker,
            });
            const estimatedWidth = displayName.length * 11;
            label.x = building.x - estimatedWidth / 2;
            label.y = building.y + building.size + 8;
            dynamicLabelsContainer.addChild(label);
            labelCache.set(building.id, label);
          }
          
          // 交互区域
          if (!hitAreaCache.has(building.id)) {
            const hitArea = new Graphics();
            hitArea.circle(building.x, building.y, building.size + 15); // 更大的点击区域
            hitArea.fill({ color: 0xffffff, alpha: 0.001 });
            hitArea.eventMode = 'static';
            hitArea.cursor = 'pointer';
            
            // 使用闭包捕获building数据
            const buildingId = building.id;
            const buildingData = building;
            
            hitArea.on('pointerdown', () => {
              selectBuildingFn.current(buildingId);
            });
            
            hitArea.on('pointerover', () => {
              setHoveredBuildingFn(buildingData);
              setHoveredNodeIdFn(buildingId);
            });
            
            hitArea.on('pointerout', () => {
              setHoveredBuildingFn(null);
              setHoveredNodeIdFn(null);
            });
            
            interactiveContainer.addChild(hitArea);
            hitAreaCache.set(building.id, hitArea);
          }
        });
        
        // 绘制连接线 - 使用贝塞尔曲线
        currentNodes.forEach((building) => {
          building.connections.forEach((targetDefId) => {
            // connections存储的是定义ID，需要从定义ID映射中查找目标
            const target = buildingByDefId.get(targetDefId);
            if (!target) return;
            
            const fromColors = categoryColors[building.category];
            
            // 判断是否高亮（hover在源或目标节点上）
            const isHighlighted = currentHoveredId === building.id || currentHoveredId === target.id;
            const alpha = isHighlighted ? 0.8 : 0.25;
            const width = isHighlighted ? 2.5 : 1.5;
            
            // 计算贝塞尔曲线控制点
            const midX = (building.x + target.x) / 2;
            const midY = (building.y + target.y) / 2;
            const controlOffset = Math.abs(building.y - target.y) * 0.3;
            
            // 渐变色连接线
            const gradient = isHighlighted ? fromColors.glow : fromColors.main;
            
            connectionsLayer.moveTo(building.x, building.y);
            connectionsLayer.quadraticCurveTo(
              midX + controlOffset,
              midY,
              target.x,
              target.y
            );
            connectionsLayer.stroke({ color: gradient, width, alpha });
            
            // 流动的粒子效果（仅在高亮时）
            if (isHighlighted) {
              const progress = (Math.sin(time * 3) + 1) / 2;
              // 沿曲线的近似位置
              const t = progress;
              const dotX = (1-t)*(1-t)*building.x + 2*(1-t)*t*(midX + controlOffset) + t*t*target.x;
              const dotY = (1-t)*(1-t)*building.y + 2*(1-t)*t*midY + t*t*target.y;
              
              connectionsLayer.circle(dotX, dotY, 4);
              connectionsLayer.fill({ color: 0xffffff, alpha: 0.9 });
            }
          });
        });
        
        // 绘制节点
        currentNodes.forEach((building) => {
          const colors = categoryColors[building.category];
          const status = statusStyles[building.status];
          const isHovered = currentHoveredId === building.id;
          
          const pulseScale = isHovered ? 1 + Math.sin(time * 4) * 0.08 : 1;
          const nodeSize = building.size * pulseScale;
          
          // 外发光
          if (isHovered) {
            nodesLayer.circle(building.x, building.y, nodeSize + 12);
            nodesLayer.fill({ color: colors.glow, alpha: 0.3 });
          }
          
          // 节点背景
          nodesLayer.circle(building.x, building.y, nodeSize);
          nodesLayer.fill({ color: colors.main, alpha: 0.9 });
          
          // 状态边框
          nodesLayer.circle(building.x, building.y, nodeSize);
          nodesLayer.stroke({
            color: status.borderColor,
            width: isHovered ? status.borderWidth + 1 : status.borderWidth,
            alpha: isHovered ? 1 : 0.8
          });
          
          // 内部图标区域
          nodesLayer.circle(building.x, building.y, nodeSize * 0.6);
          nodesLayer.fill({ color: 0x0d1117, alpha: 0.6 });
        });
      });
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        labelsContainerRef.current = null;
        interactiveContainerRef.current = null;
        setPixiReady(false);
      }
    };
  }, []); // 只在挂载/卸载时运行

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

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0d1117]">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Hover 卡片 - 优化样式 */}
      {hoveredBuilding && (
        <div 
          className="absolute pointer-events-none z-50 animate-fade-in"
          style={{
            left: Math.min(hoveredBuilding.x + 50, window.innerWidth - 280),
            top: Math.max(hoveredBuilding.y - 30, 10),
          }}
        >
          <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl p-4 shadow-2xl min-w-[200px]">
            {/* 标题栏 */}
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: categoryColors[hoveredBuilding.category]?.text + '20' }}
              >
                {hoveredBuilding.buildingData.icon}
              </div>
              <div>
                <div className="font-bold text-white">{hoveredBuilding.name}</div>
                <div 
                  className="text-xs"
                  style={{ color: categoryColors[hoveredBuilding.category]?.text }}
                >
                  {hoveredBuilding.buildingData.subcategory}
                </div>
              </div>
            </div>
            
            {/* 状态指示器 */}
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mb-3 ${
              hoveredBuilding.status === 'profitable' ? 'bg-green-500/20 text-green-400' :
              hoveredBuilding.status === 'loss' ? 'bg-red-500/20 text-red-400' : 
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {hoveredBuilding.status === 'profitable' ? '运营良好' :
               hoveredBuilding.status === 'loss' ? '亏损状态' : '需要关注'}
            </div>
            
            {/* 详细信息 */}
            <div className="space-y-2 text-sm border-t border-gray-700/50 pt-3">
              <div className="flex justify-between">
                <span className="text-gray-400">建造成本</span>
                <span className="text-orange-400 font-medium">{formatCost(hoveredBuilding.buildingData.baseCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">维护费用</span>
                <span className="text-yellow-400 font-medium">{formatCost(hoveredBuilding.buildingData.maintenanceCost)}/周期</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">雇员上限</span>
                <span className="text-blue-400 font-medium">{hoveredBuilding.buildingData.maxWorkers}人</span>
              </div>
            </div>
            
            {/* 供应链信息 */}
            {hoveredBuilding.connections.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <div className="text-xs text-gray-500">供应链下游 ({hoveredBuilding.connections.length})</div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 右上角图例 - 显示玩家拥有的建筑统计 */}
      <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-4 text-xs">
        <div className="font-bold text-gray-300 mb-3">我的产业</div>
        {buildingNodes.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            <div className="text-2xl mb-2">🏗️</div>
            <div>暂无建筑</div>
            <div className="mt-1 text-gray-600">点击右上角建造</div>
          </div>
        ) : (
          <div className="space-y-2">
            {['extraction', 'processing', 'manufacturing', 'service', 'retail', 'agriculture'].map((category) => {
              const count = stats.get(category) || 0;
              if (count === 0) return null;
              return (
                <div key={category} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: categoryColors[category]?.text }}
                    ></div>
                    <span className="text-gray-400">{rowLabels[['extraction', 'processing', 'manufacturing', 'service', 'retail', 'agriculture'].indexOf(category)]}</span>
                  </div>
                  <span
                    className="font-medium"
                    style={{ color: categoryColors[category]?.text }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-700">
              <span className="text-gray-400">总计</span>
              <span className="text-cyan-400 font-bold">{buildingNodes.length}</span>
            </div>
          </div>
        )}
        
        {/* 状态图例 */}
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="font-bold text-gray-300 mb-2">状态指示</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-green-500 bg-transparent"></div>
              <span className="text-gray-400">盈利</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-yellow-500 bg-transparent"></div>
              <span className="text-gray-400">警示</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-transparent"></div>
              <span className="text-gray-400">亏损</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 提示文字 */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-500">
        点击建筑查看详情
      </div>
    </div>
  );
}