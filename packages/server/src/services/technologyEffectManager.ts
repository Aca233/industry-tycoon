/**
 * Technology Effect Manager - 技术效果管理器
 * 管理已激活技术的效果，并在游戏循环中应用这些效果
 */

import { BUILDINGS_DATA, type ProductionMethodData } from '@scc/shared';

// ============================================
// 类型定义
// ============================================

/** 技术修饰符 */
export interface TechnologyModifier {
  targetType: 'building' | 'goods' | 'production_method' | 'global';
  targetId?: string | undefined;
  modifierType: string;
  value: number;
  isMultiplier: boolean;
}

/** 生产方式解锁 */
export interface ProductionMethodUnlock {
  buildingId: string;
  method: {
    id: string;
    name: string;
    nameZh: string;
    description: string;
    recipe: {
      inputs: Array<{ goodsId: string; amount: number }>;
      outputs: Array<{ goodsId: string; amount: number }>;
      ticksRequired: number;
    };
    laborRequired: number;
    powerRequired: number;
    efficiency: number;
  };
}

/** 激活的技术信息 */
export interface ActiveTechnology {
  id: string;
  name: string;
  companyId: string;
  activatedAt: number;
  globalModifiers: TechnologyModifier[];
  unlockedMethods: ProductionMethodUnlock[];
}

/** 建筑效率修饰符聚合结果 */
export interface BuildingModifiers {
  efficiencyMultiplier: number;
  costMultiplier: number;
  outputMultiplier: number;
  inputMultiplier: number;
}

/**
 * 技术效果管理器
 */
export class TechnologyEffectManager {
  // 存储激活的技术
  private activeTechnologies: Map<string, ActiveTechnology> = new Map();
  
  // 按建筑ID存储解锁的生产方式
  private unlockedMethodsByBuilding: Map<string, ProductionMethodData[]> = new Map();
  
  // 缓存的全局修饰符聚合
  private cachedGlobalModifiers: TechnologyModifier[] = [];
  private cacheValid = false;

  /**
   * 初始化管理器
   */
  initialize(): void {
    this.activeTechnologies.clear();
    this.unlockedMethodsByBuilding.clear();
    this.invalidateCache();
    console.log('[TechnologyEffectManager] Initialized');
  }

  /**
   * 激活一个技术
   */
  activateTechnology(
    id: string,
    name: string,
    companyId: string,
    globalModifiers: TechnologyModifier[],
    unlockedMethods: ProductionMethodUnlock[],
    currentTick: number
  ): void {
    const tech: ActiveTechnology = {
      id,
      name,
      companyId,
      activatedAt: currentTick,
      globalModifiers,
      unlockedMethods,
    };

    this.activeTechnologies.set(id, tech);
    
    // 处理解锁的生产方式
    for (const unlock of unlockedMethods) {
      const existing = this.unlockedMethodsByBuilding.get(unlock.buildingId) || [];
      
      // 转换为ProductionMethodData格式
      const methodData: ProductionMethodData = {
        id: unlock.method.id,
        name: unlock.method.name,
        nameZh: unlock.method.nameZh,
        description: unlock.method.description,
        recipe: unlock.method.recipe,
        laborRequired: unlock.method.laborRequired,
        powerRequired: unlock.method.powerRequired,
        efficiency: unlock.method.efficiency,
      };
      
      // 避免重复添加
      if (!existing.some(m => m.id === methodData.id)) {
        existing.push(methodData);
        this.unlockedMethodsByBuilding.set(unlock.buildingId, existing);
      }
    }

    this.invalidateCache();
    console.log(`[TechnologyEffectManager] Activated technology: ${name} (${id})`);
    console.log(`[TechnologyEffectManager]   - ${globalModifiers.length} modifiers`);
    console.log(`[TechnologyEffectManager]   - ${unlockedMethods.length} method unlocks`);
  }

  /**
   * 获取建筑的效率修饰符（聚合所有激活技术的效果）
   */
  getBuildingModifiers(buildingId: string, buildingCategory?: string): BuildingModifiers {
    const result: BuildingModifiers = {
      efficiencyMultiplier: 1.0,
      costMultiplier: 1.0,
      outputMultiplier: 1.0,
      inputMultiplier: 1.0,
    };

    // 遍历所有激活技术的修饰符
    for (const [, tech] of this.activeTechnologies) {
      for (const mod of tech.globalModifiers) {
        // 检查是否适用于此建筑
        const applies = 
          mod.targetType === 'global' ||
          (mod.targetType === 'building' && mod.targetId === buildingId) ||
          (mod.targetType === 'building' && mod.targetId === buildingCategory);

        if (!applies) continue;

        // 应用修饰符
        switch (mod.modifierType) {
          case 'efficiency_boost':
            result.efficiencyMultiplier *= (1 + mod.value);
            break;
          case 'cost_reduction':
            result.costMultiplier *= (1 - mod.value);
            break;
          case 'output_increase':
            result.outputMultiplier *= (1 + mod.value);
            break;
          case 'input_reduction':
            result.inputMultiplier *= (1 - mod.value);
            break;
        }
      }
    }

    return result;
  }

  /**
   * 获取所有全局效率修饰符（用于UI显示）
   */
  getGlobalEfficiencyBonus(): number {
    let bonus = 0;
    for (const [, tech] of this.activeTechnologies) {
      for (const mod of tech.globalModifiers) {
        if (mod.targetType === 'global' && mod.modifierType === 'efficiency_boost') {
          bonus += mod.value;
        }
      }
    }
    return bonus;
  }

  /**
   * 获取建筑可用的生产方式（包括技术解锁的）
   */
  getAvailableMethods(buildingId: string): ProductionMethodData[] {
    const buildingDef = BUILDINGS_DATA.find(b => b.id === buildingId);
    if (!buildingDef) return [];

    // 获取基础方法
    const baseMethods = buildingDef.productionSlots.flatMap(s => s.methods);
    
    // 获取技术解锁的方法
    const unlockedMethods = this.unlockedMethodsByBuilding.get(buildingId) || [];

    return [...baseMethods, ...unlockedMethods];
  }

  /**
   * 检查某个生产方式是否是技术解锁的
   */
  isMethodUnlockedByTech(buildingId: string, methodId: string): boolean {
    const unlockedMethods = this.unlockedMethodsByBuilding.get(buildingId) || [];
    return unlockedMethods.some(m => m.id === methodId);
  }

  /**
   * 获取所有激活的技术
   */
  getActiveTechnologies(): ActiveTechnology[] {
    return Array.from(this.activeTechnologies.values());
  }

  /**
   * 获取公司激活的技术
   */
  getTechnologiesByCompany(companyId: string): ActiveTechnology[] {
    return Array.from(this.activeTechnologies.values())
      .filter(t => t.companyId === companyId);
  }

  /**
   * 获取所有激活的修饰符（用于调试）
   */
  getAllActiveModifiers(): TechnologyModifier[] {
    if (this.cacheValid) {
      return this.cachedGlobalModifiers;
    }

    const allModifiers: TechnologyModifier[] = [];
    for (const [, tech] of this.activeTechnologies) {
      allModifiers.push(...tech.globalModifiers);
    }

    this.cachedGlobalModifiers = allModifiers;
    this.cacheValid = true;
    return allModifiers;
  }

  /**
   * 获取效果摘要（用于前端显示）
   */
  getEffectsSummary(): {
    totalTechnologies: number;
    globalEfficiencyBonus: number;
    totalUnlockedMethods: number;
    modifiersByType: Record<string, number>;
  } {
    let totalUnlockedMethods = 0;
    const modifiersByType: Record<string, number> = {};

    for (const [, methods] of this.unlockedMethodsByBuilding) {
      totalUnlockedMethods += methods.length;
    }

    for (const [, tech] of this.activeTechnologies) {
      for (const mod of tech.globalModifiers) {
        modifiersByType[mod.modifierType] = (modifiersByType[mod.modifierType] || 0) + mod.value;
      }
    }

    return {
      totalTechnologies: this.activeTechnologies.size,
      globalEfficiencyBonus: this.getGlobalEfficiencyBonus(),
      totalUnlockedMethods,
      modifiersByType,
    };
  }

  /**
   * 使缓存失效
   */
  private invalidateCache(): void {
    this.cacheValid = false;
    this.cachedGlobalModifiers = [];
  }
}

// 导出单例
export const technologyEffectManager = new TechnologyEffectManager();