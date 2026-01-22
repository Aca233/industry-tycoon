/**
 * 数据验证系统
 * 启动时检查商品、建筑、产业链数据的一致性
 */

import { getGoodsRegistry } from './GoodsRegistry.js';
import { getBuildingRegistry } from './BuildingRegistry.js';
import { getSupplyChainRegistry } from './SupplyChainRegistry.js';
import { isRegistryInitialized } from './initRegistry.js';

// ============ 类型定义 ============

/** 验证问题严重级别 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/** 验证问题类别 */
export type ValidationCategory = 
  | 'missing_reference'    // 引用不存在的商品/建筑
  | 'circular_dependency'  // 循环依赖
  | 'orphan_data'          // 孤立数据（未被任何建筑使用）
  | 'invalid_value'        // 无效值（负数、空字符串等）
  | 'duplicate_id'         // 重复ID
  | 'schema_mismatch'      // Schema不匹配
  | 'balance_issue';       // 平衡性问题

/** 单个验证问题 */
export interface ValidationIssue {
  /** 问题ID */
  id: string;
  /** 严重级别 */
  severity: ValidationSeverity;
  /** 问题类别 */
  category: ValidationCategory;
  /** 涉及的实体类型 */
  entityType: 'goods' | 'building' | 'supply_chain' | 'recipe';
  /** 涉及的实体ID */
  entityId: string;
  /** 问题描述 */
  message: string;
  /** 修复建议 */
  suggestion?: string;
  /** 相关的其他实体 */
  relatedEntities?: string[];
}

/** 验证结果 */
export interface ValidationResult {
  /** 是否通过验证（无错误） */
  valid: boolean;
  /** 发现的问题列表 */
  issues: ValidationIssue[];
  /** 统计信息 */
  stats: {
    totalChecks: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    goodsChecked: number;
    buildingsChecked: number;
    recipesChecked: number;
  };
  /** 验证时间戳 */
  timestamp: number;
}

/** 验证配置 */
export interface ValidationConfig {
  /** 是否检查孤立数据 */
  checkOrphans: boolean;
  /** 是否检查平衡性问题 */
  checkBalance: boolean;
  /** 是否在发现错误时抛出异常 */
  throwOnError: boolean;
  /** 忽略的问题类别 */
  ignoreCategories: ValidationCategory[];
}

const DEFAULT_CONFIG: ValidationConfig = {
  checkOrphans: true,
  checkBalance: true,
  throwOnError: false,
  ignoreCategories: [],
};

// ============ 验证器实现 ============

class DataValidator {
  private config: ValidationConfig = DEFAULT_CONFIG;
  private issues: ValidationIssue[] = [];
  private issueIdCounter = 0;

  /**
   * 执行全面验证
   */
  validate(config?: Partial<ValidationConfig>): ValidationResult {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.issues = [];
    this.issueIdCounter = 0;

    // 检查注册表是否已初始化
    if (!isRegistryInitialized()) {
      this.addIssue({
        severity: 'error',
        category: 'schema_mismatch',
        entityType: 'goods',
        entityId: '_system',
        message: '注册表尚未初始化，请先调用 initializeRegistries()',
        suggestion: '在验证前调用 initializeRegistries()',
      });
      return this.buildResult(0, 0, 0);
    }

    const goodsRegistry = getGoodsRegistry();
    const buildingRegistry = getBuildingRegistry();

    // 统计
    let goodsChecked = 0;
    let buildingsChecked = 0;
    let recipesChecked = 0;

    // 1. 验证商品数据
    console.log('[DataValidator] 验证商品数据...');
    for (const goods of goodsRegistry.getAll()) {
      this.validateGoods(goods.id);
      goodsChecked++;
    }

    // 2. 验证建筑数据
    console.log('[DataValidator] 验证建筑数据...');
    for (const building of buildingRegistry.getAll()) {
      this.validateBuilding(building.id);
      buildingsChecked++;
      
      // 验证配方
      for (const slot of building.productionSlots || []) {
        for (const method of slot.methods || []) {
          this.validateRecipe(building.id, method.id, method.recipe);
          recipesChecked++;
        }
      }
    }

    // 3. 验证产业链
    console.log('[DataValidator] 验证产业链...');
    this.validateSupplyChain();

    // 4. 检查孤立数据
    if (this.config.checkOrphans) {
      console.log('[DataValidator] 检查孤立数据...');
      this.checkOrphanGoods();
    }

    // 5. 检查平衡性问题
    if (this.config.checkBalance) {
      console.log('[DataValidator] 检查平衡性...');
      this.checkBalanceIssues();
    }

    const result = this.buildResult(goodsChecked, buildingsChecked, recipesChecked);

    // 输出结果
    this.logResult(result);

    // 如果配置了抛出异常且有错误
    if (this.config.throwOnError && result.stats.errorCount > 0) {
      throw new Error(`数据验证失败: ${result.stats.errorCount} 个错误`);
    }

    return result;
  }

  /**
   * 验证单个商品
   */
  private validateGoods(goodsId: string): void {
    const goodsRegistry = getGoodsRegistry();
    const goods = goodsRegistry.get(goodsId);

    if (!goods) {
      this.addIssue({
        severity: 'error',
        category: 'missing_reference',
        entityType: 'goods',
        entityId: goodsId,
        message: `商品 ${goodsId} 不存在于注册表中`,
      });
      return;
    }

    // 检查必填字段
    if (!goods.nameZh || goods.nameZh.trim() === '') {
      this.addIssue({
        severity: 'warning',
        category: 'invalid_value',
        entityType: 'goods',
        entityId: goodsId,
        message: `商品 ${goodsId} 缺少中文名称`,
        suggestion: '添加 nameZh 字段',
      });
    }

    // 检查价格
    if (!goods.basePrice || goods.basePrice <= 0) {
      this.addIssue({
        severity: 'warning',
        category: 'invalid_value',
        entityType: 'goods',
        entityId: goodsId,
        message: `商品 ${goodsId} 的基础价格无效: ${goods.basePrice}`,
        suggestion: '设置正数的 basePrice',
      });
    }

    // 检查类别
    if (!goods.category) {
      this.addIssue({
        severity: 'warning',
        category: 'invalid_value',
        entityType: 'goods',
        entityId: goodsId,
        message: `商品 ${goodsId} 缺少类别`,
        suggestion: '添加 category 字段',
      });
    }
  }

  /**
   * 验证单个建筑
   */
  private validateBuilding(buildingId: string): void {
    const buildingRegistry = getBuildingRegistry();
    const building = buildingRegistry.get(buildingId);

    if (!building) {
      this.addIssue({
        severity: 'error',
        category: 'missing_reference',
        entityType: 'building',
        entityId: buildingId,
        message: `建筑 ${buildingId} 不存在于注册表中`,
      });
      return;
    }

    // 检查必填字段
    if (!building.nameZh || building.nameZh.trim() === '') {
      this.addIssue({
        severity: 'warning',
        category: 'invalid_value',
        entityType: 'building',
        entityId: buildingId,
        message: `建筑 ${buildingId} 缺少中文名称`,
        suggestion: '添加 nameZh 字段',
      });
    }

    // 检查成本
    if (!building.baseCost || building.baseCost <= 0) {
      this.addIssue({
        severity: 'warning',
        category: 'invalid_value',
        entityType: 'building',
        entityId: buildingId,
        message: `建筑 ${buildingId} 的建造成本无效: ${building.baseCost}`,
        suggestion: '设置正数的 baseCost',
      });
    }

    // 检查维护成本
    if (building.maintenanceCost !== undefined && building.maintenanceCost < 0) {
      this.addIssue({
        severity: 'warning',
        category: 'invalid_value',
        entityType: 'building',
        entityId: buildingId,
        message: `建筑 ${buildingId} 的维护成本为负数: ${building.maintenanceCost}`,
        suggestion: '设置非负的 maintenanceCost',
      });
    }

    // 检查生产槽位
    if (!building.productionSlots || building.productionSlots.length === 0) {
      this.addIssue({
        severity: 'info',
        category: 'invalid_value',
        entityType: 'building',
        entityId: buildingId,
        message: `建筑 ${buildingId} 没有生产槽位`,
        suggestion: '添加 productionSlots',
      });
    }
  }

  /**
   * 验证配方
   */
  private validateRecipe(
    buildingId: string,
    methodId: string,
    recipe: { inputs: { goodsId: string; amount: number }[]; outputs: { goodsId: string; amount: number }[]; ticksRequired: number }
  ): void {
    const goodsRegistry = getGoodsRegistry();
    const entityId = `${buildingId}:${methodId}`;

    // 检查配方周期
    if (!recipe.ticksRequired || recipe.ticksRequired <= 0) {
      this.addIssue({
        severity: 'error',
        category: 'invalid_value',
        entityType: 'recipe',
        entityId,
        message: `配方 ${entityId} 的生产周期无效: ${recipe.ticksRequired}`,
        suggestion: '设置正整数的 ticksRequired',
      });
    }

    // 检查输入商品引用
    for (const input of recipe.inputs || []) {
      if (!goodsRegistry.get(input.goodsId)) {
        this.addIssue({
          severity: 'error',
          category: 'missing_reference',
          entityType: 'recipe',
          entityId,
          message: `配方 ${entityId} 引用了不存在的输入商品: ${input.goodsId}`,
          suggestion: `在 goodsDefinitions.ts 中添加商品 ${input.goodsId}`,
          relatedEntities: [input.goodsId],
        });
      }

      if (input.amount <= 0) {
        this.addIssue({
          severity: 'error',
          category: 'invalid_value',
          entityType: 'recipe',
          entityId,
          message: `配方 ${entityId} 的输入 ${input.goodsId} 数量无效: ${input.amount}`,
          suggestion: '设置正数的 amount',
        });
      }
    }

    // 检查输出商品引用
    for (const output of recipe.outputs || []) {
      if (!goodsRegistry.get(output.goodsId)) {
        this.addIssue({
          severity: 'error',
          category: 'missing_reference',
          entityType: 'recipe',
          entityId,
          message: `配方 ${entityId} 引用了不存在的输出商品: ${output.goodsId}`,
          suggestion: `在 goodsDefinitions.ts 中添加商品 ${output.goodsId}`,
          relatedEntities: [output.goodsId],
        });
      }

      if (output.amount <= 0) {
        this.addIssue({
          severity: 'error',
          category: 'invalid_value',
          entityType: 'recipe',
          entityId,
          message: `配方 ${entityId} 的输出 ${output.goodsId} 数量无效: ${output.amount}`,
          suggestion: '设置正数的 amount',
        });
      }
    }

    // 检查配方是否有产出
    if (!recipe.outputs || recipe.outputs.length === 0) {
      this.addIssue({
        severity: 'warning',
        category: 'invalid_value',
        entityType: 'recipe',
        entityId,
        message: `配方 ${entityId} 没有任何产出`,
        suggestion: '添加 outputs',
      });
    }
  }

  /**
   * 验证产业链
   */
  private validateSupplyChain(): void {
    const supplyChainRegistry = getSupplyChainRegistry();
    
    // 检查产业链健康度
    const health = supplyChainRegistry.analyzeHealth();
    
    if (health.overallScore < 50) {
      this.addIssue({
        severity: 'warning',
        category: 'balance_issue',
        entityType: 'supply_chain',
        entityId: '_system',
        message: `产业链健康度较低: ${health.overallScore}/100`,
        suggestion: '检查是否有过多的瓶颈节点或缺失的生产者',
      });
    }
    
    // 报告高风险项
    for (const risk of health.risks.filter(r => r.severity === 'high')) {
      this.addIssue({
        severity: 'warning',
        category: 'missing_reference',
        entityType: 'supply_chain',
        entityId: risk.nodeId,
        message: risk.description,
        suggestion: '添加生产该商品的建筑',
      });
    }
  }

  /**
   * 检查孤立商品（未被任何建筑使用）
   */
  private checkOrphanGoods(): void {
    const goodsRegistry = getGoodsRegistry();
    const buildingRegistry = getBuildingRegistry();

    // 收集所有被使用的商品
    const usedGoods = new Set<string>();
    
    for (const building of buildingRegistry.getAll()) {
      for (const slot of building.productionSlots || []) {
        for (const method of slot.methods || []) {
          for (const input of method.recipe?.inputs || []) {
            usedGoods.add(input.goodsId);
          }
          for (const output of method.recipe?.outputs || []) {
            usedGoods.add(output.goodsId);
          }
        }
      }
    }

    // 检查未使用的商品
    for (const goods of goodsRegistry.getAll()) {
      if (!usedGoods.has(goods.id)) {
        // 消费品可能只被POPs消费，不算孤立
        // GoodsCategory: 'raw_material' | 'basic_processed' | 'intermediate' | 'consumer_good' | 'service'
        const isConsumerGoods = goods.tags?.includes('consumer') ||
                                goods.category === 'consumer_good';
        
        this.addIssue({
          severity: isConsumerGoods ? 'info' : 'warning',
          category: 'orphan_data',
          entityType: 'goods',
          entityId: goods.id,
          message: `商品 ${goods.id} 未被任何建筑配方使用`,
          suggestion: isConsumerGoods
            ? '这是消费品，可能通过POPs消费'
            : '考虑添加使用该商品的建筑，或删除该商品',
        });
      }
    }
  }

  /**
   * 检查平衡性问题
   */
  private checkBalanceIssues(): void {
    const goodsRegistry = getGoodsRegistry();
    const buildingRegistry = getBuildingRegistry();

    // 检查价格异常
    const prices = Array.from(goodsRegistry.getAll()).map(g => g.basePrice || 0);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    for (const goods of goodsRegistry.getAll()) {
      const price = goods.basePrice || 0;
      
      // 价格超过平均值10倍
      if (price > avgPrice * 10) {
        this.addIssue({
          severity: 'info',
          category: 'balance_issue',
          entityType: 'goods',
          entityId: goods.id,
          message: `商品 ${goods.id} 的价格 (${price}) 远高于平均值 (${avgPrice.toFixed(0)})`,
          suggestion: '确认这是高端商品的预期定价',
        });
      }
    }

    // 检查建筑成本异常
    const costs = Array.from(buildingRegistry.getAll()).map(b => b.baseCost || 0);
    const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;

    for (const building of buildingRegistry.getAll()) {
      const cost = building.baseCost || 0;
      
      // 成本超过平均值10倍
      if (cost > avgCost * 10) {
        this.addIssue({
          severity: 'info',
          category: 'balance_issue',
          entityType: 'building',
          entityId: building.id,
          message: `建筑 ${building.id} 的成本 (${cost}) 远高于平均值 (${avgCost.toFixed(0)})`,
          suggestion: '确认这是高端建筑的预期定价',
        });
      }
    }
  }

  /**
   * 添加问题
   */
  private addIssue(issue: Omit<ValidationIssue, 'id'>): void {
    // 检查是否被忽略
    if (this.config.ignoreCategories.includes(issue.category)) {
      return;
    }

    this.issues.push({
      ...issue,
      id: `issue-${++this.issueIdCounter}`,
    });
  }

  /**
   * 构建验证结果
   */
  private buildResult(
    goodsChecked: number,
    buildingsChecked: number,
    recipesChecked: number
  ): ValidationResult {
    const errorCount = this.issues.filter(i => i.severity === 'error').length;
    const warningCount = this.issues.filter(i => i.severity === 'warning').length;
    const infoCount = this.issues.filter(i => i.severity === 'info').length;

    return {
      valid: errorCount === 0,
      issues: this.issues,
      stats: {
        totalChecks: goodsChecked + buildingsChecked + recipesChecked,
        errorCount,
        warningCount,
        infoCount,
        goodsChecked,
        buildingsChecked,
        recipesChecked,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * 输出验证结果日志
   */
  private logResult(result: ValidationResult): void {
    console.log('[DataValidator] ========== 验证结果 ==========');
    console.log(`[DataValidator] 检查项: ${result.stats.totalChecks}`);
    console.log(`[DataValidator]   - 商品: ${result.stats.goodsChecked}`);
    console.log(`[DataValidator]   - 建筑: ${result.stats.buildingsChecked}`);
    console.log(`[DataValidator]   - 配方: ${result.stats.recipesChecked}`);
    console.log(`[DataValidator] 问题统计:`);
    console.log(`[DataValidator]   - 错误: ${result.stats.errorCount}`);
    console.log(`[DataValidator]   - 警告: ${result.stats.warningCount}`);
    console.log(`[DataValidator]   - 信息: ${result.stats.infoCount}`);
    
    if (result.valid) {
      console.log('[DataValidator] ✅ 验证通过');
    } else {
      console.log('[DataValidator] ❌ 验证失败');
    }

    // 输出错误详情
    if (result.stats.errorCount > 0) {
      console.log('[DataValidator] 错误详情:');
      for (const issue of result.issues.filter(i => i.severity === 'error')) {
        console.log(`  [ERROR] ${issue.message}`);
        if (issue.suggestion) {
          console.log(`          建议: ${issue.suggestion}`);
        }
      }
    }

    // 输出警告详情（前5个）
    if (result.stats.warningCount > 0) {
      console.log(`[DataValidator] 警告详情 (显示前5个，共${result.stats.warningCount}个):`);
      for (const issue of result.issues.filter(i => i.severity === 'warning').slice(0, 5)) {
        console.log(`  [WARN] ${issue.message}`);
      }
    }

    console.log('[DataValidator] ================================');
  }
}

// ============ 单例导出 ============

let instance: DataValidator | null = null;

export function getDataValidator(): DataValidator {
  if (!instance) {
    instance = new DataValidator();
  }
  return instance;
}

/**
 * 便捷函数：执行验证
 */
export function validateGameData(config?: Partial<ValidationConfig>): ValidationResult {
  return getDataValidator().validate(config);
}

/**
 * 便捷函数：仅检查是否有效（无错误）
 */
export function isGameDataValid(): boolean {
  const result = getDataValidator().validate({ 
    checkBalance: false, 
    checkOrphans: false 
  });
  return result.valid;
}