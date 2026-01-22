# Registry System - 统一数据架构

本目录包含 Supply Chain Commander 的新一代数据管理系统，采用 **Schema-First + 建筑模板** 的设计模式。

## 核心概念

### 1. 声明式配置 (Declarative Configuration)

不再硬编码，所有游戏数据通过声明式配置定义：

```typescript
// 商品定义 - 只需填写核心属性
const GOODS_DEFINITIONS = {
  'steel': {
    nameZh: '钢材',
    category: 'basic_processed',
    tier: 1,
    basePrice: 800,
    icon: '🔩',
    tags: ['metal', 'construction'],
  }
};

// 派生属性（价格波动、消费需求）自动计算
```

### 2. 建筑模板系统 (Building Templates)

定义一次模板，复用于多个建筑：

```typescript
// 模板定义
registry.registerTemplate('EXTRACTION', {
  category: 'extraction',
  baseWorkers: 20,
  baseCost: 5000000,
  slotTemplates: [
    { type: 'process', nameZh: '采掘工艺' },
    { type: 'automation', nameZh: '自动化等级', commonMethods: [...] }
  ],
});

// 从模板创建建筑
registry.registerFromTemplate('iron-mine', 'EXTRACTION', {
  nameZh: '铁矿场',
  primaryOutputs: [{ goodsId: 'iron-ore', amount: 100 }],
});
```

### 3. 自动派生 (Automatic Derivation)

系统自动计算运行时属性：

| 输入属性 | 自动派生 |
|---------|---------|
| `category` | `subcategory`, `priceVolatility` |
| `tier` | 产业链层级关系 |
| `tags` | `consumerDemandRate` |
| `recipe.inputs/outputs` | 上下游建筑关系图 |

## 文件结构

```
registry/
├── types.ts              # 核心类型定义
├── GoodsRegistry.ts      # 商品注册表 (单例)
├── BuildingRegistry.ts   # 建筑注册表 (单例)
├── SupplyChainRegistry.ts # 产业链注册表 (单例)
├── initRegistry.ts       # 初始化入口
├── DataValidator.ts      # 数据验证系统
└── README.md             # 本文档
```

## 使用指南

### 初始化

```typescript
import { initializeRegistries } from '@scc/shared';

// 在服务器启动时调用一次
initializeRegistries();
```

### 获取数据

```typescript
import { 
  getGoodsRegistry, 
  getBuildingRegistry, 
  getSupplyChainRegistry 
} from '@scc/shared';

// 获取商品
const steel = getGoodsRegistry().get('steel');

// 获取建筑
const ironMine = getBuildingRegistry().get('iron-mine');

// 获取产业链
const chain = getSupplyChainRegistry().getUpstreamChain('steel');
```

### 查询方法

**GoodsRegistry:**
```typescript
const registry = getGoodsRegistry();

// 按类别查询
const rawMaterials = registry.getByCategory('raw_material');

// 按标签查询
const metals = registry.getByTag('metal');

// 获取消费需求映射（用于 gameLoop）
const demandMap = registry.getConsumerDemandMap();
```

**BuildingRegistry:**
```typescript
const registry = getBuildingRegistry();

// 按类别查询
const factories = registry.getByCategory('processing');

// 查找生产某商品的建筑
const steelProducers = registry.getProducersOf('steel');

// 查找消耗某商品的建筑
const ironConsumers = registry.getConsumersOf('iron-ore');
```

**SupplyChainRegistry:**
```typescript
const registry = getSupplyChainRegistry();

// 获取完整上游供应链
const upstream = registry.getUpstreamChain('electric-vehicle');

// 获取下游消费链
const downstream = registry.getDownstreamChain('steel');

// 计算生产成本
const cost = registry.calculateCostBreakdown('smartphone', marketPrices);

// 分析供应链健康度
const health = registry.analyzeHealth();
```

### 数据验证

```typescript
import { validateGameData, isGameDataValid } from '@scc/shared';

// 完整验证（返回详细报告）
const result = validateGameData();
if (!result.valid) {
  console.log('发现问题:', result.issues);
}

// 快速检查
if (isGameDataValid()) {
  console.log('数据一致性检查通过');
}
```

## 添加新内容

### 添加新商品

1. 编辑 `packages/shared/src/data/goodsDefinitions.ts`
2. 在 `GOODS_DEFINITIONS` 对象中添加：

```typescript
'new-goods': {
  nameZh: '新商品',
  category: 'intermediate',      // raw_material | basic_processed | intermediate | consumer_good | service
  tier: 2,                       // 0=原材料, 1=一次加工, 2+=多次加工
  basePrice: 1000,
  icon: '📦',
  tags: ['electronic'],          // 用于消费需求计算
  consumerDemand: 'medium',      // none | low | medium | high | very_high (可选)
},
```

### 添加新建筑

1. 编辑 `packages/shared/src/data/buildingDefinitions.ts`
2. 使用现有模板：

```typescript
{
  id: 'new-factory',
  template: 'PROCESSING',        // 模板ID
  nameZh: '新工厂',
  icon: '🏭',
  primaryInputs: [
    { goodsId: 'steel', amount: 10 },
    { goodsId: 'plastic', amount: 5 },
  ],
  primaryOutputs: [
    { goodsId: 'new-goods', amount: 1 },
  ],
  costMultiplier: 1.2,           // 成本 = 模板基础成本 × 倍数
},
```

## 向后兼容

旧代码继续工作，兼容层自动转换：

```typescript
// 旧方式 - 仍然有效
import { BUILDINGS_DATA, GOODS_DATA } from '@scc/shared';

// 新方式 - 推荐
import { getBuildingRegistry, getGoodsRegistry } from '@scc/shared';
```

## 数据迁移

使用迁移工具将旧数据转换为新格式：

```typescript
import { migrateGoodsData, generateGoodsMigrationCode } from '@scc/shared/tools/dataMigrator';

// 迁移数据
const newFormat = migrateGoodsData(oldGoodsArray);

// 生成迁移代码
const code = generateGoodsMigrationCode(oldGoodsArray);
```

## 类型定义

所有类型定义在 `types.ts`：

- `GoodsDefinition` - 商品声明式定义
- `GoodsData` - 完整商品数据（含派生属性）
- `BuildingTemplate` - 建筑模板
- `BuildingConfig` - 建筑配置
- `BuildingData` - 完整建筑数据
- `ProductionRecipe` - 生产配方
- `SupplyChainNode` - 产业链节点