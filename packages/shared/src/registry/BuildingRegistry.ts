/**
 * 建筑注册表 - 基于模板系统的建筑管理
 * 
 * 核心功能：
 * 1. 模板 → 变体自动生成
 * 2. 生产方式槽位管理
 * 3. 配方自动关联
 * 4. 单例模式全局访问
 */

import type {
  BuildingTemplate,
  BuildingConfig,
  BuildingData,
  ProductionRecipe,
  ProductionMethodDefinition,
  BuildingCategory,
} from './types.js';
import type { EntityId } from '../types/common.js';
import type { BuildingDef } from '../data/buildingDefinitions.js';

// ============================================================
// 建筑注册表单例
// ============================================================

let buildingRegistryInstance: BuildingRegistry | null = null;

export class BuildingRegistry {
  private templates: Map<string, BuildingTemplate> = new Map();
  private buildings: Map<string, BuildingData> = new Map();
  
  // 索引
  private byCategory: Map<BuildingCategory, BuildingData[]> = new Map();
  private byTemplate: Map<string, BuildingData[]> = new Map();
  private byOutputGoods: Map<EntityId, BuildingData[]> = new Map();
  private byInputGoods: Map<EntityId, BuildingData[]> = new Map();
  
  private initialized = false;

  private constructor() {}

  static getInstance(): BuildingRegistry {
    if (!buildingRegistryInstance) {
      buildingRegistryInstance = new BuildingRegistry();
    }
    return buildingRegistryInstance;
  }

  // ============================================================
  // 模板注册
  // ============================================================

  /**
   * 注册建筑模板
   */
  registerTemplate(id: string, template: BuildingTemplate): void {
    this.templates.set(id, template);
  }

  /**
   * 批量注册模板
   */
  registerAllTemplates(templates: Record<string, BuildingTemplate>): void {
    for (const [id, template] of Object.entries(templates)) {
      this.registerTemplate(id, template);
    }
  }

  // ============================================================
  // 建筑配置注册（从模板生成完整建筑）
  // ============================================================

  /**
   * 注册建筑配置并生成完整建筑数据
   */
  registerBuilding(config: BuildingConfig): void {
    const template = this.templates.get(config.template);
    if (!template) {
      console.warn(`[BuildingRegistry] Template not found: ${config.template}`);
      return;
    }

    // 合并模板和配置
    const buildingData = this.mergeTemplateWithConfig(template, config);
    this.buildings.set(config.id, buildingData);
    
    // 更新索引
    this.indexBuilding(buildingData);
  }

  /**
   * 批量注册建筑
   */
  registerAllBuildings(configs: BuildingConfig[]): void {
    for (const config of configs) {
      this.registerBuilding(config);
    }
    this.initialized = true;
  }

  // ============================================================
  // 从 BuildingDefinition 格式注册（新格式适配器）
  // ============================================================

  /**
   * 从 BuildingDef 格式注册建筑
   * 这是新的声明式建筑定义格式的适配器
   */
  registerFromDefinition(id: string, def: BuildingDef): void {
    // 提取第一个生产槽位的默认方法来获取主配方
    const firstSlot = def.productionSlots?.[0];
    const defaultMethod = firstSlot?.methods?.find((m: { id: string }) => m.id === firstSlot.defaultMethodId);
    
    // 构建完整的生产槽位数据
    const productionSlots: BuildingData['productionSlots'] = def.productionSlots.map((slot: { type: string; name: string; methods: Array<{ id: string; nameZh: string; name?: string; description?: string; efficiency?: number; laborRequired?: number; powerRequired?: number; recipe: { inputs: Array<{ goodsId: string; amount: number }>; outputs: Array<{ goodsId: string; amount: number }>; ticksRequired: number } }>; defaultMethodId: string }) => ({
      type: slot.type as 'process' | 'automation' | 'energy' | 'labor' | 'quality',
      nameZh: slot.name,
      methods: slot.methods.map((m: { id: string; nameZh: string; name?: string; description?: string; efficiency?: number; laborRequired?: number; powerRequired?: number; recipe: { inputs: Array<{ goodsId: string; amount: number }>; outputs: Array<{ goodsId: string; amount: number }>; ticksRequired: number } }) => {
        const method: ProductionMethodDefinition = {
          id: m.id,
          nameZh: m.nameZh,
          recipe: {
            inputs: m.recipe.inputs,
            outputs: m.recipe.outputs,
            ticksRequired: m.recipe.ticksRequired,
          },
        };
        // 可选字段只在有值时添加
        if (m.name) method.name = m.name;
        if (m.description) method.description = m.description;
        if (m.efficiency !== undefined) method.efficiencyMultiplier = m.efficiency;
        if (m.laborRequired !== undefined) method.laborMultiplier = m.laborRequired / 100;
        if (m.powerRequired !== undefined) method.powerMultiplier = m.powerRequired / 100;
        return method;
      }),
      defaultMethodId: slot.defaultMethodId,
    }));

    // 从输出商品推断 tier
    const tier = this.inferTierFromOutputs(
      defaultMethod?.recipe?.outputs?.map((o: { goodsId: string; amount: number }) => ({ goodsId: o.goodsId, amount: o.amount })) || []
    );

    // 构建 BuildingData
    const buildingData: BuildingData = {
      id,
      name: def.name || def.nameZh,
      nameZh: def.nameZh,
      icon: def.icon || '🏭',
      description: def.description || def.nameZh,
      category: def.category,
      baseCost: def.baseCost,
      maintenanceCost: def.maintenanceCost,
      maxWorkers: def.maxWorkers,
      productionSlots,
      tier,
      templateId: def.templateId || 'CUSTOM',
    };

    // 注册并索引
    this.buildings.set(id, buildingData);
    this.indexBuilding(buildingData);
  }

  /**
   * 批量从 BuildingDef 格式注册所有建筑
   */
  registerAllFromDefinitions(definitions: Record<string, BuildingDef>): void {
    const count = Object.keys(definitions).length;
    console.log(`[BuildingRegistry] 从声明式定义注册 ${count} 个建筑...`);
    
    for (const [id, def] of Object.entries(definitions)) {
      try {
        this.registerFromDefinition(id, def);
      } catch (error) {
        console.warn(`[BuildingRegistry] 注册建筑失败: ${id}`, error);
      }
    }
    
    this.initialized = true;
    console.log(`[BuildingRegistry] 建筑注册完成，共 ${this.buildings.size} 个`);
  }

  // ============================================================
  // 模板与配置合并
  // ============================================================

  private mergeTemplateWithConfig(
    template: BuildingTemplate,
    config: BuildingConfig
  ): BuildingData {
    // 构建生产槽位
    const productionSlots = this.buildProductionSlots(template, config);

    // 计算成本和维护
    const costMultiplier = config.costMultiplier ?? 1;
    const workerMultiplier = config.workerMultiplier ?? 1;
    const maintenanceMultiplier = config.maintenanceMultiplier ?? 1;

    // 从输出商品推断 tier
    const tier = this.inferTierFromOutputs(config.primaryOutputs);

    return {
      id: config.id,
      name: config.name || config.nameZh,
      nameZh: config.nameZh,
      icon: config.icon || '🏭',
      description: config.description || `${config.nameZh}`,
      category: template.category,
      
      // 成本和运营
      baseCost: Math.round(template.baseCost * costMultiplier),
      maintenanceCost: Math.round(template.baseMaintenance * maintenanceMultiplier),
      maxWorkers: Math.round(template.baseWorkers * workerMultiplier),
      
      // 生产槽位
      productionSlots,
      
      // 元数据
      tier,
      templateId: config.template,
    };
  }

  /**
   * 构建生产槽位
   */
  private buildProductionSlots(
    template: BuildingTemplate,
    config: BuildingConfig
  ): BuildingData['productionSlots'] {
    const slots: BuildingData['productionSlots'] = [];

    for (const slotTemplate of template.slotTemplates) {
      // 创建主生产方式（基于配置的输入/输出）
      const methods: ProductionMethodDefinition[] = [];

      // 如果是生产槽位，添加默认生产方式
      if (slotTemplate.type === 'process') {
        const defaultMethod: ProductionMethodDefinition = {
          id: `${config.id}-default`,
          nameZh: '标准生产',
          name: 'Standard Production',
          recipe: {
            inputs: config.primaryInputs || [],
            outputs: config.primaryOutputs,
            ticksRequired: 10, // 默认10 tick
          },
        };
        methods.push(defaultMethod);
      }

      // 添加模板中的通用方法（如自动化等级）
      if (slotTemplate.commonMethods) {
        methods.push(...slotTemplate.commonMethods);
      }

      // 添加配置中的额外方法
      if (config.additionalMethods) {
        methods.push(...config.additionalMethods);
      }

      slots.push({
        type: slotTemplate.type,
        nameZh: slotTemplate.nameZh,
        methods,
        defaultMethodId: methods[0]?.id || '',
      });
    }

    return slots;
  }

  /**
   * 从输出商品推断产业链层级
   */
  private inferTierFromOutputs(
    outputs: Array<{ goodsId: EntityId; amount: number }>
  ): number {
    // 简单的推断逻辑，实际可以从 GoodsRegistry 获取
    // tier 0 = 原材料, tier 1 = 基础加工, tier 2+ = 高级制造
    if (outputs.length === 0) return 0;
    
    // 可以通过商品ID的模式来推断
    const firstOutput = outputs[0];
    if (!firstOutput) return 0;
    const goodsId = firstOutput.goodsId;
    if (goodsId.includes('ore') || goodsId.includes('raw')) return 0;
    if (goodsId.includes('processed') || goodsId.includes('refined')) return 1;
    return 2;
  }

  // ============================================================
  // 索引管理
  // ============================================================

  private indexBuilding(building: BuildingData): void {
    // 按类别索引
    if (!this.byCategory.has(building.category)) {
      this.byCategory.set(building.category, []);
    }
    this.byCategory.get(building.category)!.push(building);

    // 按模板索引
    if (!this.byTemplate.has(building.templateId)) {
      this.byTemplate.set(building.templateId, []);
    }
    this.byTemplate.get(building.templateId)!.push(building);

    // 按输出商品索引
    for (const slot of building.productionSlots) {
      for (const method of slot.methods) {
        if (method.recipe) {
          for (const output of method.recipe.outputs) {
            if (!this.byOutputGoods.has(output.goodsId)) {
              this.byOutputGoods.set(output.goodsId, []);
            }
            const existing = this.byOutputGoods.get(output.goodsId)!;
            if (!existing.find(b => b.id === building.id)) {
              existing.push(building);
            }
          }
          
          // 按输入商品索引
          for (const input of method.recipe.inputs) {
            if (!this.byInputGoods.has(input.goodsId)) {
              this.byInputGoods.set(input.goodsId, []);
            }
            const existing = this.byInputGoods.get(input.goodsId)!;
            if (!existing.find(b => b.id === building.id)) {
              existing.push(building);
            }
          }
        }
      }
    }
  }

  // ============================================================
  // 查询 API
  // ============================================================

  get(id: string): BuildingData | undefined {
    return this.buildings.get(id);
  }

  getAll(): BuildingData[] {
    return Array.from(this.buildings.values());
  }

  getTemplate(id: string): BuildingTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): BuildingTemplate[] {
    return Array.from(this.templates.values());
  }

  getByCategory(category: BuildingCategory): BuildingData[] {
    return this.byCategory.get(category) || [];
  }

  getByTemplate(templateId: string): BuildingData[] {
    return this.byTemplate.get(templateId) || [];
  }

  /**
   * 获取生产指定商品的建筑
   */
  getProducersOf(goodsId: EntityId): BuildingData[] {
    return this.byOutputGoods.get(goodsId) || [];
  }

  /**
   * 获取消耗指定商品的建筑
   */
  getConsumersOf(goodsId: EntityId): BuildingData[] {
    return this.byInputGoods.get(goodsId) || [];
  }

  /**
   * 获取建筑的所有配方
   */
  getRecipesForBuilding(buildingId: string): ProductionRecipe[] {
    const building = this.buildings.get(buildingId);
    if (!building) return [];
    
    const recipes: ProductionRecipe[] = [];
    for (const slot of building.productionSlots) {
      for (const method of slot.methods) {
        if (method.recipe) {
          recipes.push(method.recipe);
        }
      }
    }
    return recipes;
  }

  /**
   * 获取建筑当前活动的配方
   */
  getActiveRecipe(buildingId: string, slotType: string = 'process'): ProductionRecipe | undefined {
    const building = this.buildings.get(buildingId);
    if (!building) return undefined;
    
    const slot = building.productionSlots.find(s => s.type === slotType);
    if (!slot) return undefined;
    
    const activeMethod = slot.methods.find(m => m.id === slot.defaultMethodId);
    return activeMethod?.recipe;
  }

  // ============================================================
  // 生产方式切换（Vic3 风格）
  // ============================================================

  /**
   * 切换建筑的生产方式
   */
  switchProductionMethod(
    buildingId: string,
    slotType: string,
    methodId: string
  ): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;

    const slot = building.productionSlots.find(s => s.type === slotType);
    if (!slot) return false;

    const method = slot.methods.find(m => m.id === methodId);
    if (!method) return false;

    slot.defaultMethodId = methodId;
    return true;
  }

  /**
   * 获取可用的生产方式列表
   */
  getAvailableMethods(
    buildingId: string,
    slotType: string
  ): ProductionMethodDefinition[] {
    const building = this.buildings.get(buildingId);
    if (!building) return [];
    
    const slot = building.productionSlots.find(s => s.type === slotType);
    return slot?.methods || [];
  }

  // ============================================================
  // 供应链分析
  // ============================================================

  /**
   * 获取完整的生产链
   * 从最终产品回溯到原材料
   */
  getSupplyChain(goodsId: EntityId): {
    goods: EntityId;
    producers: { buildingId: string; method: ProductionMethodDefinition }[];
    inputs: EntityId[];
  }[] {
    const chain: {
      goods: EntityId;
      producers: { buildingId: string; method: ProductionMethodDefinition }[];
      inputs: EntityId[];
    }[] = [];
    
    const visited = new Set<EntityId>();
    const queue = [goodsId];

    while (queue.length > 0) {
      const currentGoods = queue.shift()!;
      if (visited.has(currentGoods)) continue;
      visited.add(currentGoods);

      const producers = this.byOutputGoods.get(currentGoods) || [];
      const producerInfo: { buildingId: string; method: ProductionMethodDefinition }[] = [];
      const inputGoods = new Set<EntityId>();

      for (const building of producers) {
        for (const slot of building.productionSlots) {
          for (const method of slot.methods) {
            if (method.recipe?.outputs.some(o => o.goodsId === currentGoods)) {
              producerInfo.push({ buildingId: building.id, method });
              for (const input of method.recipe.inputs) {
                inputGoods.add(input.goodsId);
                if (!visited.has(input.goodsId)) {
                  queue.push(input.goodsId);
                }
              }
            }
          }
        }
      }

      chain.push({
        goods: currentGoods,
        producers: producerInfo,
        inputs: Array.from(inputGoods),
      });
    }

    return chain;
  }

  // ============================================================
  // 调试和状态
  // ============================================================

  isInitialized(): boolean {
    return this.initialized;
  }

  getStats(): {
    templateCount: number;
    buildingCount: number;
  } {
    return {
      templateCount: this.templates.size,
      buildingCount: this.buildings.size,
    };
  }

  /**
   * 重置注册表（用于测试）
   */
  reset(): void {
    this.templates.clear();
    this.buildings.clear();
    this.byCategory.clear();
    this.byTemplate.clear();
    this.byOutputGoods.clear();
    this.byInputGoods.clear();
    this.initialized = false;
  }

  /**
   * 重置单例实例（用于测试）
   */
  static resetInstance(): void {
    if (buildingRegistryInstance) {
      buildingRegistryInstance.reset();
    }
    buildingRegistryInstance = null;
  }
}

// 便捷访问函数
export function getBuildingRegistry(): BuildingRegistry {
  return BuildingRegistry.getInstance();
}