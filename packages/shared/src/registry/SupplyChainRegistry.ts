/**
 * 产业链注册表 (SupplyChainRegistry)
 *
 * 自动构建 商品→建筑→商品 的完整产业链关系图
 * 提供供应链分析方法：成本计算、路径查找、瓶颈分析
 */

import type { EntityId } from '../types/common.js';
import { getGoodsRegistry, GoodsRegistry } from './GoodsRegistry.js';
import { getBuildingRegistry, BuildingRegistry } from './BuildingRegistry.js';
import type { GoodsData, BuildingData, ProductionRecipe } from './types.js';

/**
 * 产业链节点类型
 */
export type SupplyChainNodeType = 'goods' | 'building';

/**
 * 产业链节点（通用）
 */
export interface SupplyChainNode {
  id: EntityId;
  type: SupplyChainNodeType;
  /** 上游节点 (供应方) */
  upstreamIds: EntityId[];
  /** 下游节点 (消费方) */
  downstreamIds: EntityId[];
  /** 层级 (0 = 原材料, 越大越终端) */
  tier: number;
}

/**
 * 商品节点
 */
export interface GoodsNode extends SupplyChainNode {
  type: 'goods';
  goods: GoodsData;
  /** 生产此商品的建筑ID列表 */
  producerBuildingIds: EntityId[];
  /** 消费此商品的建筑ID列表 */
  consumerBuildingIds: EntityId[];
  /** 是否是原材料 (没有上游建筑) */
  isRawMaterial: boolean;
  /** 是否是终端商品 (没有下游建筑) */
  isTerminalGoods: boolean;
}

/**
 * 建筑节点
 */
export interface BuildingNode extends SupplyChainNode {
  type: 'building';
  building: BuildingData;
  /** 需要的输入商品 */
  inputGoodsIds: EntityId[];
  /** 产出的商品 */
  outputGoodsIds: EntityId[];
}

/**
 * 产业链路径
 */
export interface SupplyChainPath {
  /** 路径上的节点序列 */
  nodes: SupplyChainNode[];
  /** 总层级跨度 */
  tierSpan: number;
  /** 是否包含瓶颈（单一供应商） */
  hasBottleneck: boolean;
  /** 瓶颈节点 */
  bottleneckNodes: SupplyChainNode[];
}

/**
 * 成本结构分析
 */
export interface CostBreakdown {
  /** 直接原材料成本 */
  rawMaterialCost: number;
  /** 加工成本（建筑维护+劳动力） */
  processingCost: number;
  /** 间接成本（上游加工成本） */
  indirectCost: number;
  /** 总成本 */
  totalCost: number;
  /** 各层级成本明细 */
  tierBreakdown: Map<number, number>;
}

/**
 * 产业链健康度分析
 */
export interface SupplyChainHealth {
  /** 总体健康分 (0-100) */
  overallScore: number;
  /** 冗余度 (供应商数量/需求量) */
  redundancy: number;
  /** 瓶颈数量 */
  bottleneckCount: number;
  /** 最长供应链深度 */
  maxDepth: number;
  /** 风险点 */
  risks: Array<{
    nodeId: EntityId;
    riskType: 'single_supplier' | 'high_tier' | 'missing_producer';
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

/**
 * 产业链注册表 (单例模式)
 */
export class SupplyChainRegistry {
  private static instance: SupplyChainRegistry | null = null;

  private goodsNodes: Map<EntityId, GoodsNode> = new Map();
  private buildingNodes: Map<EntityId, BuildingNode> = new Map();
  private goodsRegistry: GoodsRegistry;
  private buildingRegistry: BuildingRegistry;
  private initialized = false;

  private constructor() {
    this.goodsRegistry = getGoodsRegistry();
    this.buildingRegistry = getBuildingRegistry();
  }

  static getInstance(): SupplyChainRegistry {
    if (!SupplyChainRegistry.instance) {
      SupplyChainRegistry.instance = new SupplyChainRegistry();
    }
    return SupplyChainRegistry.instance;
  }

  /**
   * 重置实例（用于测试）
   */
  static resetInstance(): void {
    SupplyChainRegistry.instance = null;
  }

  /**
   * 从建筑的默认生产槽位获取配方
   */
  private getDefaultRecipe(building: BuildingData): ProductionRecipe | null {
    // 查找 'process' 类型的槽位
    const processSlot = building.productionSlots.find(slot => slot.type === 'process');
    if (!processSlot || processSlot.methods.length === 0) {
      return null;
    }
    
    // 获取默认方法或第一个方法
    const defaultMethod = processSlot.methods.find(m => m.id === processSlot.defaultMethodId)
      ?? processSlot.methods[0];
    
    return defaultMethod?.recipe ?? null;
  }

  /**
   * 构建产业链图
   * 从 GoodsRegistry 和 BuildingRegistry 自动构建
   */
  buildGraph(): void {
    if (this.initialized) {
      console.warn('[SupplyChainRegistry] Graph already built, rebuilding...');
    }

    this.goodsNodes.clear();
    this.buildingNodes.clear();

    // 1. 创建所有商品节点
    const allGoods = this.goodsRegistry.getAll();
    for (const goods of allGoods) {
      const producers = this.buildingRegistry.getProducersOf(goods.id);
      const consumers = this.buildingRegistry.getConsumersOf(goods.id);

      const node: GoodsNode = {
        id: goods.id,
        type: 'goods',
        goods,
        upstreamIds: producers.map(b => b.id),
        downstreamIds: consumers.map(b => b.id),
        producerBuildingIds: producers.map(b => b.id),
        consumerBuildingIds: consumers.map(b => b.id),
        isRawMaterial: producers.length === 0,
        isTerminalGoods: consumers.length === 0,
        tier: goods.tier,
      };
      this.goodsNodes.set(goods.id, node);
    }

    // 2. 创建所有建筑节点
    const allBuildings = this.buildingRegistry.getAll();
    for (const building of allBuildings) {
      const recipe = this.getDefaultRecipe(building);
      const inputGoodsIds = recipe?.inputs.map(i => i.goodsId) ?? [];
      const outputGoodsIds = recipe?.outputs.map(o => o.goodsId) ?? [];

      const node: BuildingNode = {
        id: building.id,
        type: 'building',
        building,
        upstreamIds: inputGoodsIds,
        downstreamIds: outputGoodsIds,
        inputGoodsIds,
        outputGoodsIds,
        tier: this.calculateBuildingTier(building),
      };
      this.buildingNodes.set(building.id, node);
    }

    // 3. 重新计算商品层级（基于生产它的建筑的输入）
    this.recalculateTiers();

    this.initialized = true;
    console.log(`[SupplyChainRegistry] Graph built: ${this.goodsNodes.size} goods, ${this.buildingNodes.size} buildings`);
  }

  /**
   * 计算建筑层级（基于输入商品的最大层级 + 1）
   */
  private calculateBuildingTier(building: BuildingData): number {
    const recipe = this.getDefaultRecipe(building);
    if (!recipe || recipe.inputs.length === 0) {
      return 0; // 无输入的建筑是最上游（采掘类）
    }

    let maxInputTier = 0;
    for (const input of recipe.inputs) {
      const goods = this.goodsRegistry.get(input.goodsId);
      if (goods) {
        maxInputTier = Math.max(maxInputTier, goods.tier);
      }
    }
    return maxInputTier + 1;
  }

  /**
   * 重新计算所有层级（拓扑排序）
   */
  private recalculateTiers(): void {
    // 使用 BFS 从原材料开始计算层级
    const goodsTiers = new Map<EntityId, number>();
    const buildingTiers = new Map<EntityId, number>();

    // 原材料层级为 0
    for (const [id, node] of this.goodsNodes) {
      if (node.isRawMaterial) {
        goodsTiers.set(id, 0);
      }
    }

    // 迭代计算直到稳定
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // 计算建筑层级
      for (const [id, node] of this.buildingNodes) {
        const inputTiers = node.inputGoodsIds
          .map(gid => goodsTiers.get(gid))
          .filter((t): t is number => t !== undefined);

        if (inputTiers.length === node.inputGoodsIds.length || node.inputGoodsIds.length === 0) {
          const newTier = inputTiers.length > 0 ? Math.max(...inputTiers) + 1 : 0;
          const oldTier = buildingTiers.get(id);
          if (oldTier !== newTier) {
            buildingTiers.set(id, newTier);
            changed = true;
          }
        }
      }

      // 计算商品层级（基于生产它的建筑）
      for (const [id, node] of this.goodsNodes) {
        if (node.isRawMaterial) continue;

        const producerTiers = node.producerBuildingIds
          .map(bid => buildingTiers.get(bid))
          .filter((t): t is number => t !== undefined);

        if (producerTiers.length > 0) {
          const newTier = Math.max(...producerTiers);
          const oldTier = goodsTiers.get(id);
          if (oldTier !== newTier) {
            goodsTiers.set(id, newTier);
            changed = true;
          }
        }
      }
    }

    // 更新节点层级
    for (const [id, tier] of goodsTiers) {
      const node = this.goodsNodes.get(id);
      if (node) node.tier = tier;
    }
    for (const [id, tier] of buildingTiers) {
      const node = this.buildingNodes.get(id);
      if (node) node.tier = tier;
    }
  }

  // ============ 查询方法 ============

  /**
   * 获取商品节点
   */
  getGoodsNode(id: EntityId): GoodsNode | undefined {
    return this.goodsNodes.get(id);
  }

  /**
   * 获取建筑节点
   */
  getBuildingNode(id: EntityId): BuildingNode | undefined {
    return this.buildingNodes.get(id);
  }

  /**
   * 获取所有原材料
   */
  getRawMaterials(): GoodsNode[] {
    return Array.from(this.goodsNodes.values()).filter(n => n.isRawMaterial);
  }

  /**
   * 获取所有终端商品
   */
  getTerminalGoods(): GoodsNode[] {
    return Array.from(this.goodsNodes.values()).filter(n => n.isTerminalGoods);
  }

  /**
   * 获取指定层级的商品
   */
  getGoodsByTier(tier: number): GoodsNode[] {
    return Array.from(this.goodsNodes.values()).filter(n => n.tier === tier);
  }

  /**
   * 获取生产某商品的完整上游供应链
   */
  getUpstreamChain(goodsId: EntityId): SupplyChainPath {
    const nodes: SupplyChainNode[] = [];
    const visited = new Set<string>();
    const bottleneckNodes: SupplyChainNode[] = [];

    const dfs = (nodeId: EntityId, nodeType: SupplyChainNodeType): void => {
      const key = `${nodeType}:${nodeId}`;
      if (visited.has(key)) return;
      visited.add(key);

      if (nodeType === 'goods') {
        const node = this.goodsNodes.get(nodeId);
        if (!node) return;
        nodes.push(node);

        // 检查瓶颈：单一生产者
        if (node.producerBuildingIds.length === 1) {
          bottleneckNodes.push(node);
        }

        // 继续向上游探索
        for (const buildingId of node.producerBuildingIds) {
          dfs(buildingId, 'building');
        }
      } else {
        const node = this.buildingNodes.get(nodeId);
        if (!node) return;
        nodes.push(node);

        // 继续向上游探索
        for (const inputGoodsId of node.inputGoodsIds) {
          dfs(inputGoodsId, 'goods');
        }
      }
    };

    dfs(goodsId, 'goods');

    const tiers = nodes.map(n => n.tier);
    return {
      nodes,
      tierSpan: tiers.length > 0 ? Math.max(...tiers) - Math.min(...tiers) : 0,
      hasBottleneck: bottleneckNodes.length > 0,
      bottleneckNodes,
    };
  }

  /**
   * 获取某商品的下游消费链
   */
  getDownstreamChain(goodsId: EntityId): SupplyChainPath {
    const nodes: SupplyChainNode[] = [];
    const visited = new Set<string>();
    const bottleneckNodes: SupplyChainNode[] = [];

    const dfs = (nodeId: EntityId, nodeType: SupplyChainNodeType): void => {
      const key = `${nodeType}:${nodeId}`;
      if (visited.has(key)) return;
      visited.add(key);

      if (nodeType === 'goods') {
        const node = this.goodsNodes.get(nodeId);
        if (!node) return;
        nodes.push(node);

        // 继续向下游探索
        for (const buildingId of node.consumerBuildingIds) {
          dfs(buildingId, 'building');
        }
      } else {
        const node = this.buildingNodes.get(nodeId);
        if (!node) return;
        nodes.push(node);

        // 检查瓶颈：单一消费者依赖
        const firstOutputId = node.outputGoodsIds[0];
        if (node.outputGoodsIds.length === 1 && firstOutputId) {
          const outputNode = this.goodsNodes.get(firstOutputId);
          if (outputNode && outputNode.consumerBuildingIds.length <= 1) {
            bottleneckNodes.push(node);
          }
        }

        // 继续向下游探索
        for (const outputGoodsId of node.outputGoodsIds) {
          dfs(outputGoodsId, 'goods');
        }
      }
    };

    dfs(goodsId, 'goods');

    const tiers = nodes.map(n => n.tier);
    return {
      nodes,
      tierSpan: tiers.length > 0 ? Math.max(...tiers) - Math.min(...tiers) : 0,
      hasBottleneck: bottleneckNodes.length > 0,
      bottleneckNodes,
    };
  }

  /**
   * 计算生产某商品的理论成本结构
   */
  calculateCostBreakdown(goodsId: EntityId, marketPrices: Map<EntityId, number>): CostBreakdown {
    const tierBreakdown = new Map<number, number>();
    let rawMaterialCost = 0;
    let processingCost = 0;
    let indirectCost = 0;

    const calculateRecursive = (gid: EntityId, multiplier: number): number => {
      const node = this.goodsNodes.get(gid);
      if (!node) return 0;

      // 原材料：直接使用市场价
      if (node.isRawMaterial) {
        const price = marketPrices.get(gid) ?? node.goods.basePrice;
        const cost = price * multiplier;
        rawMaterialCost += cost;
        tierBreakdown.set(0, (tierBreakdown.get(0) ?? 0) + cost);
        return cost;
      }

      // 非原材料：计算生产成本
      let minCost = Infinity;

      for (const buildingId of node.producerBuildingIds) {
        const buildingNode = this.buildingNodes.get(buildingId);
        if (!buildingNode) continue;

        const building = buildingNode.building;
        const recipe = this.getDefaultRecipe(building);
        if (!recipe) continue;

        // 找到输出这个商品的数量
        const outputItem = recipe.outputs.find((o: { goodsId: string; amount: number }) => o.goodsId === gid);
        if (!outputItem) continue;

        const outputPerRun = outputItem.amount;
        const runsNeeded = multiplier / outputPerRun;

        // 计算输入成本
        let inputCost = 0;
        for (const input of recipe.inputs) {
          inputCost += calculateRecursive(input.goodsId, input.amount * runsNeeded);
        }

        // 加上建筑维护成本（按生产次数分摊）
        const maintenancePerRun = building.maintenanceCost / 100; // 假设每100tick维护一次
        const buildingCost = maintenancePerRun * runsNeeded;

        const totalCost = inputCost + buildingCost;
        if (totalCost < minCost) {
          minCost = totalCost;
          processingCost += buildingCost;
        }
      }

      if (minCost === Infinity) {
        // 没有生产者，使用市场价
        const price = marketPrices.get(gid) ?? node.goods.basePrice;
        return price * multiplier;
      }

      tierBreakdown.set(node.tier, (tierBreakdown.get(node.tier) ?? 0) + minCost);
      return minCost;
    };

    const totalCost = calculateRecursive(goodsId, 1);
    indirectCost = totalCost - rawMaterialCost - processingCost;

    return {
      rawMaterialCost,
      processingCost,
      indirectCost,
      totalCost,
      tierBreakdown,
    };
  }

  /**
   * 分析整体供应链健康度
   */
  analyzeHealth(): SupplyChainHealth {
    const risks: SupplyChainHealth['risks'] = [];
    let bottleneckCount = 0;
    let totalRedundancy = 0;
    let goodsWithProducers = 0;
    let maxDepth = 0;

    for (const [id, node] of this.goodsNodes) {
      maxDepth = Math.max(maxDepth, node.tier);

      // 原材料跳过生产者检查
      if (node.isRawMaterial) continue;

      if (node.producerBuildingIds.length === 0) {
        // 没有生产者
        risks.push({
          nodeId: id,
          riskType: 'missing_producer',
          severity: 'high',
          description: `商品 ${node.goods.nameZh} 没有生产建筑`,
        });
      } else if (node.producerBuildingIds.length === 1) {
        // 单一供应商
        bottleneckCount++;
        risks.push({
          nodeId: id,
          riskType: 'single_supplier',
          severity: 'medium',
          description: `商品 ${node.goods.nameZh} 只有1个生产建筑`,
        });
        totalRedundancy += 1;
        goodsWithProducers++;
      } else {
        totalRedundancy += node.producerBuildingIds.length;
        goodsWithProducers++;
      }

      // 高层级商品风险
      if (node.tier >= 4) {
        risks.push({
          nodeId: id,
          riskType: 'high_tier',
          severity: 'low',
          description: `商品 ${node.goods.nameZh} 层级较高(${node.tier})，供应链复杂`,
        });
      }
    }

    const avgRedundancy = goodsWithProducers > 0 ? totalRedundancy / goodsWithProducers : 1;
    const healthPenalty = (bottleneckCount * 5) + (risks.filter(r => r.severity === 'high').length * 10);
    const overallScore = Math.max(0, Math.min(100, 100 - healthPenalty));

    return {
      overallScore,
      redundancy: avgRedundancy,
      bottleneckCount,
      maxDepth,
      risks,
    };
  }

  // ============ 可视化数据导出 ============

  /**
   * 导出为 D3.js 力导向图格式
   */
  exportForD3(): { nodes: Array<{ id: string; type: string; tier: number; name: string }>; links: Array<{ source: string; target: string }> } {
    const nodes: Array<{ id: string; type: string; tier: number; name: string }> = [];
    const links: Array<{ source: string; target: string }> = [];

    for (const [id, node] of this.goodsNodes) {
      nodes.push({
        id: `goods:${id}`,
        type: 'goods',
        tier: node.tier,
        name: node.goods.nameZh,
      });

      // 商品 -> 消费建筑
      for (const buildingId of node.consumerBuildingIds) {
        links.push({
          source: `goods:${id}`,
          target: `building:${buildingId}`,
        });
      }
    }

    for (const [id, node] of this.buildingNodes) {
      nodes.push({
        id: `building:${id}`,
        type: 'building',
        tier: node.tier,
        name: node.building.nameZh,
      });

      // 建筑 -> 产出商品
      for (const goodsId of node.outputGoodsIds) {
        links.push({
          source: `building:${id}`,
          target: `goods:${goodsId}`,
        });
      }
    }

    return { nodes, links };
  }

  /**
   * 导出层级化布局数据
   */
  exportHierarchical(): Map<number, Array<{ id: EntityId; type: SupplyChainNodeType; name: string }>> {
    const result = new Map<number, Array<{ id: EntityId; type: SupplyChainNodeType; name: string }>>();

    for (const [id, node] of this.goodsNodes) {
      if (!result.has(node.tier)) {
        result.set(node.tier, []);
      }
      result.get(node.tier)!.push({
        id,
        type: 'goods',
        name: node.goods.nameZh,
      });
    }

    for (const [id, node] of this.buildingNodes) {
      if (!result.has(node.tier)) {
        result.set(node.tier, []);
      }
      result.get(node.tier)!.push({
        id,
        type: 'building',
        name: node.building.nameZh,
      });
    }

    return result;
  }
}

/**
 * 获取产业链注册表单例
 */
export function getSupplyChainRegistry(): SupplyChainRegistry {
  return SupplyChainRegistry.getInstance();
}