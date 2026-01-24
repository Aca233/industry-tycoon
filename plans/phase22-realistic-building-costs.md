# Phase 22: 真实建造成本系统设计

## 1. 设计目标

将建筑系统的成本计算改为完全基于材料+人工的真实模式：
- **移除固定的 baseCost**，改为动态计算
- **每个建筑使用完全差异化的材料配方**，符合真实建造需求
- **人工成本**按建筑规模和复杂度计算

## 2. 可用建筑材料清单

基于 `goodsDefinitions.ts` 中的商品，以下材料可用于建造：

| 材料ID | 名称 | 基础价格(分) | 用途说明 |
|--------|------|-------------|----------|
| cement | 水泥 | 3,000 | 地基、结构 |
| steel | 钢材 | 12,000 | 框架、设备支撑 |
| glass | 玻璃 | 5,000 | 窗户、洁净室 |
| aluminum | 铝材 | 16,000 | 轻量结构、散热 |
| copper | 铜 | 18,000 | 电气布线 |
| plastic | 塑料 | 8,000 | 管道、装饰 |
| chemicals | 化学品 | 15,000 | 特殊涂料 |
| rubber | 橡胶 | 15,000 | 密封、减震 |
| mechanical-parts | 机械零件 | 25,000 | 设备组装 |
| electric-motor | 电动机 | 120,000 | 动力设备 |
| pcb | 电路板 | 30,000 | 控制系统 |
| sensors | 传感器 | 40,000 | 监控系统 |
| semiconductor-chip | 半导体芯片 | 150,000 | 智能控制 |

## 3. 人工成本计算机制

### 3.1 人工成本公式

```
laborCost = baseLabor × sizeFactor × complexityFactor
```

- **baseLabor**: 基础人工费用 = 1,000,000 (100万)
- **sizeFactor**: 规模系数
  - small: 0.5
  - medium: 1.0
  - large: 2.0
  - huge: 4.0
- **complexityFactor**: 复杂度系数 (按建筑类别)
  - extraction: 1.0 (矿场相对简单)
  - agriculture: 0.6 (农业建筑最简单)
  - processing: 1.5 (加工厂需要专业技术)
  - manufacturing: 2.5 (高端制造最复杂)
  - service: 2.0 (服务设施需要精密安装)
  - retail: 0.8 (零售建筑装修为主)

### 3.2 示例计算

- 铁矿场 (large, extraction): 1,000,000 × 2.0 × 1.0 = 2,000,000
- 芯片工厂 (huge, manufacturing): 1,000,000 × 4.0 × 2.5 = 10,000,000
- 便利店 (small, retail): 1,000,000 × 0.5 × 0.8 = 400,000

## 4. 各类建筑材料配方设计

### 4.1 资源开采类 (extraction)

#### iron-mine (铁矿场) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2000 },      // 矿井巷道加固
  { goodsId: 'steel', amount: 1500 },       // 矿井支撑、提升设备
  { goodsId: 'mechanical-parts', amount: 200 }, // 采矿机械
  { goodsId: 'electric-motor', amount: 20 }, // 提升机、传送带
  { goodsId: 'copper', amount: 100 },       // 电气布线
  { goodsId: 'glass', amount: 50 },         // 控制室
]
// 估算材料成本: 2000×30 + 1500×120 + 200×250 + 20×1200 + 100×180 + 50×50 ≈ 318,000 (万分)
// 人工成本: 2,000,000 分
// 总成本约: 5,180,000 分 ≈ 5180万
```

#### copper-mine (铜矿场) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2200 },
  { goodsId: 'steel', amount: 1600 },
  { goodsId: 'mechanical-parts', amount: 220 },
  { goodsId: 'electric-motor', amount: 22 },
  { goodsId: 'copper', amount: 80 },
  { goodsId: 'glass', amount: 60 },
  { goodsId: 'chemicals', amount: 50 },     // 选矿药剂储存设施
]
```

#### oil-field (油田) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 5000 },      // 大型地基
  { goodsId: 'steel', amount: 4000 },       // 钻井塔架、管道
  { goodsId: 'mechanical-parts', amount: 500 }, // 钻井设备
  { goodsId: 'electric-motor', amount: 50 }, // 抽油机
  { goodsId: 'copper', amount: 300 },       // 电气系统
  { goodsId: 'rubber', amount: 200 },       // 密封件
  { goodsId: 'sensors', amount: 30 },       // 压力监测
  { goodsId: 'glass', amount: 100 },
]
```

#### coal-mine (煤矿) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1800 },
  { goodsId: 'steel', amount: 1400 },
  { goodsId: 'mechanical-parts', amount: 180 },
  { goodsId: 'electric-motor', amount: 18 },
  { goodsId: 'copper', amount: 90 },
  { goodsId: 'glass', amount: 40 },
]
```

#### natural-gas-well (天然气井) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2500 },      // 井口固井
  { goodsId: 'steel', amount: 2000 },       // 管道、设备
  { goodsId: 'mechanical-parts', amount: 300 },
  { goodsId: 'electric-motor', amount: 25 },
  { goodsId: 'copper', amount: 150 },
  { goodsId: 'sensors', amount: 40 },       // 泄漏检测
  { goodsId: 'rubber', amount: 100 },       // 密封
]
```

#### lithium-mine (锂矿场) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1000 },
  { goodsId: 'steel', amount: 800 },
  { goodsId: 'mechanical-parts', amount: 150 },
  { goodsId: 'electric-motor', amount: 15 },
  { goodsId: 'copper', amount: 60 },
  { goodsId: 'chemicals', amount: 100 },    // 提锂化学处理
  { goodsId: 'plastic', amount: 200 },      // 蒸发池衬里
]
```

#### rare-earth-mine (稀土矿场) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1200 },
  { goodsId: 'steel', amount: 900 },
  { goodsId: 'mechanical-parts', amount: 180 },
  { goodsId: 'electric-motor', amount: 18 },
  { goodsId: 'copper', amount: 80 },
  { goodsId: 'chemicals', amount: 150 },    // 分离设备
  { goodsId: 'glass', amount: 80 },         // 实验室
]
```

#### silica-quarry (硅砂矿) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 800 },
  { goodsId: 'steel', amount: 600 },
  { goodsId: 'mechanical-parts', amount: 100 },
  { goodsId: 'electric-motor', amount: 10 },
  { goodsId: 'copper', amount: 40 },
]
```

#### bauxite-mine (铝土矿) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1900 },
  { goodsId: 'steel', amount: 1500 },
  { goodsId: 'mechanical-parts', amount: 190 },
  { goodsId: 'electric-motor', amount: 19 },
  { goodsId: 'copper', amount: 95 },
  { goodsId: 'glass', amount: 45 },
]
```

### 4.2 农业类 (agriculture)

#### farm (农场) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 500 },       // 地基、仓库
  { goodsId: 'steel', amount: 400 },        // 温室框架
  { goodsId: 'glass', amount: 300 },        // 温室玻璃
  { goodsId: 'plastic', amount: 400 },      // 灌溉管道、薄膜
  { goodsId: 'mechanical-parts', amount: 50 }, // 农机设备
  { goodsId: 'electric-motor', amount: 5 }, // 水泵
]
```

#### livestock-farm (畜牧场) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 800 },       // 畜舍地基
  { goodsId: 'steel', amount: 600 },        // 畜舍框架
  { goodsId: 'glass', amount: 100 },        // 通风窗
  { goodsId: 'plastic', amount: 300 },      // 给水管道
  { goodsId: 'mechanical-parts', amount: 80 }, // 自动喂食设备
  { goodsId: 'electric-motor', amount: 8 }, // 通风、清洁设备
]
```

#### rubber-plantation (橡胶种植园) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 600 },       // 加工厂地基
  { goodsId: 'steel', amount: 500 },        // 加工设备支架
  { goodsId: 'glass', amount: 150 },
  { goodsId: 'plastic', amount: 200 },      // 收集容器
  { goodsId: 'mechanical-parts', amount: 100 }, // 加工设备
  { goodsId: 'electric-motor', amount: 10 },
]
```

### 4.3 基础加工类 (processing)

#### steel-mill (钢铁厂) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 6000 },      // 大型地基、高炉基座
  { goodsId: 'steel', amount: 5000 },       // 厂房结构（需要预购或从他处进口）
  { goodsId: 'glass', amount: 300 },
  { goodsId: 'aluminum', amount: 200 },     // 耐高温设备
  { goodsId: 'copper', amount: 400 },       // 电气系统
  { goodsId: 'mechanical-parts', amount: 600 }, // 轧钢设备
  { goodsId: 'electric-motor', amount: 80 }, // 各类电机
  { goodsId: 'sensors', amount: 50 },       // 温度监控
]
```

#### refinery (炼油厂) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 5500 },
  { goodsId: 'steel', amount: 6000 },       // 大量管道、塔器
  { goodsId: 'glass', amount: 200 },
  { goodsId: 'aluminum', amount: 300 },     // 换热器
  { goodsId: 'copper', amount: 500 },       // 电气、仪表
  { goodsId: 'mechanical-parts', amount: 700 },
  { goodsId: 'electric-motor', amount: 100 },
  { goodsId: 'sensors', amount: 100 },      // 过程监控
  { goodsId: 'rubber', amount: 300 },       // 密封件
]
```

#### copper-smelter (铜冶炼厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2500 },
  { goodsId: 'steel', amount: 2000 },
  { goodsId: 'glass', amount: 100 },
  { goodsId: 'aluminum', amount: 150 },
  { goodsId: 'copper', amount: 200 },
  { goodsId: 'mechanical-parts', amount: 300 },
  { goodsId: 'electric-motor', amount: 40 },
  { goodsId: 'sensors', amount: 30 },
]
```

#### aluminum-smelter (铝冶炼厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 3000 },
  { goodsId: 'steel', amount: 2500 },
  { goodsId: 'glass', amount: 150 },
  { goodsId: 'copper', amount: 600 },       // 电解槽大量用铜
  { goodsId: 'mechanical-parts', amount: 350 },
  { goodsId: 'electric-motor', amount: 50 },
  { goodsId: 'sensors', amount: 40 },
]
```

#### silicon-plant (硅材加工厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2000 },
  { goodsId: 'steel', amount: 1500 },
  { goodsId: 'glass', amount: 400 },        // 洁净室隔断
  { goodsId: 'aluminum', amount: 300 },
  { goodsId: 'copper', amount: 250 },
  { goodsId: 'mechanical-parts', amount: 400 },
  { goodsId: 'electric-motor', amount: 45 },
  { goodsId: 'sensors', amount: 60 },
  { goodsId: 'pcb', amount: 30 },           // 控制系统
]
```

#### chemical-plant (化工厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2800 },
  { goodsId: 'steel', amount: 2200 },       // 反应釜、管道
  { goodsId: 'glass', amount: 200 },        // 实验室、观察窗
  { goodsId: 'aluminum', amount: 100 },
  { goodsId: 'copper', amount: 180 },
  { goodsId: 'mechanical-parts', amount: 350 },
  { goodsId: 'electric-motor', amount: 35 },
  { goodsId: 'sensors', amount: 50 },
  { goodsId: 'rubber', amount: 150 },       // 耐腐蚀密封
]
```

#### glass-factory (玻璃厂) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1500 },
  { goodsId: 'steel', amount: 1200 },
  { goodsId: 'aluminum', amount: 100 },     // 高温设备
  { goodsId: 'copper', amount: 100 },
  { goodsId: 'mechanical-parts', amount: 200 },
  { goodsId: 'electric-motor', amount: 25 },
  { goodsId: 'sensors', amount: 20 },
]
```

#### cement-plant (水泥厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'steel', amount: 3000 },       // 回转窑、设备
  { goodsId: 'glass', amount: 100 },
  { goodsId: 'aluminum', amount: 80 },
  { goodsId: 'copper', amount: 150 },
  { goodsId: 'mechanical-parts', amount: 400 },
  { goodsId: 'electric-motor', amount: 50 },
  { goodsId: 'sensors', amount: 30 },
]
// 注意：水泥厂不需要水泥（自己生产）
```

#### plastic-factory (塑料工厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2000 },
  { goodsId: 'steel', amount: 1800 },
  { goodsId: 'glass', amount: 150 },
  { goodsId: 'aluminum', amount: 120 },
  { goodsId: 'copper', amount: 140 },
  { goodsId: 'mechanical-parts', amount: 300 },
  { goodsId: 'electric-motor', amount: 40 },
  { goodsId: 'sensors', amount: 25 },
]
```

#### food-processing-plant (食品加工厂) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1200 },
  { goodsId: 'steel', amount: 1000 },       // 食品级不锈钢
  { goodsId: 'glass', amount: 200 },
  { goodsId: 'aluminum', amount: 150 },
  { goodsId: 'plastic', amount: 300 },      // 食品级塑料
  { goodsId: 'copper', amount: 80 },
  { goodsId: 'mechanical-parts', amount: 200 },
  { goodsId: 'electric-motor', amount: 25 },
]
```

#### beverage-factory (饮料工厂) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1000 },
  { goodsId: 'steel', amount: 900 },
  { goodsId: 'glass', amount: 150 },
  { goodsId: 'aluminum', amount: 200 },     // 灌装线
  { goodsId: 'plastic', amount: 250 },
  { goodsId: 'copper', amount: 70 },
  { goodsId: 'mechanical-parts', amount: 180 },
  { goodsId: 'electric-motor', amount: 22 },
]
```

### 4.4 高端制造类 (manufacturing)

#### chip-fab (芯片工厂) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 4000 },
  { goodsId: 'steel', amount: 3000 },
  { goodsId: 'glass', amount: 1500 },       // 大量洁净室
  { goodsId: 'aluminum', amount: 1000 },    // 洁净室框架
  { goodsId: 'copper', amount: 800 },       // 复杂电气
  { goodsId: 'mechanical-parts', amount: 800 },
  { goodsId: 'electric-motor', amount: 100 },
  { goodsId: 'pcb', amount: 200 },          // 控制系统
  { goodsId: 'sensors', amount: 200 },      // 环境监控
  { goodsId: 'semiconductor-chip', amount: 50 }, // 设备控制芯片
]
```

#### display-factory (显示面板工厂) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 3500 },
  { goodsId: 'steel', amount: 2800 },
  { goodsId: 'glass', amount: 1200 },
  { goodsId: 'aluminum', amount: 800 },
  { goodsId: 'copper', amount: 600 },
  { goodsId: 'mechanical-parts', amount: 700 },
  { goodsId: 'electric-motor', amount: 90 },
  { goodsId: 'pcb', amount: 150 },
  { goodsId: 'sensors', amount: 150 },
]
```

#### ev-factory (电动汽车工厂) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 5000 },
  { goodsId: 'steel', amount: 4500 },
  { goodsId: 'glass', amount: 500 },
  { goodsId: 'aluminum', amount: 600 },
  { goodsId: 'copper', amount: 700 },
  { goodsId: 'mechanical-parts', amount: 1000 }, // 机器人生产线
  { goodsId: 'electric-motor', amount: 150 },
  { goodsId: 'pcb', amount: 100 },
  { goodsId: 'sensors', amount: 120 },
]
```

#### gasoline-car-factory (燃油汽车工厂) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 4800 },
  { goodsId: 'steel', amount: 4200 },
  { goodsId: 'glass', amount: 450 },
  { goodsId: 'aluminum', amount: 500 },
  { goodsId: 'copper', amount: 600 },
  { goodsId: 'mechanical-parts', amount: 900 },
  { goodsId: 'electric-motor', amount: 130 },
  { goodsId: 'pcb', amount: 80 },
  { goodsId: 'sensors', amount: 100 },
]
```

#### electronics-factory (电子产品工厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2000 },
  { goodsId: 'steel', amount: 1500 },
  { goodsId: 'glass', amount: 600 },        // 洁净区
  { goodsId: 'aluminum', amount: 400 },
  { goodsId: 'copper', amount: 350 },
  { goodsId: 'mechanical-parts', amount: 400 },
  { goodsId: 'electric-motor', amount: 50 },
  { goodsId: 'pcb', amount: 80 },
  { goodsId: 'sensors', amount: 60 },
]
```

#### battery-factory (电池工厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2500 },
  { goodsId: 'steel', amount: 2000 },
  { goodsId: 'glass', amount: 400 },
  { goodsId: 'aluminum', amount: 500 },
  { goodsId: 'copper', amount: 400 },
  { goodsId: 'mechanical-parts', amount: 450 },
  { goodsId: 'electric-motor', amount: 55 },
  { goodsId: 'pcb', amount: 70 },
  { goodsId: 'sensors', amount: 80 },
]
```

#### battery-pack-factory (电池组装厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1800 },
  { goodsId: 'steel', amount: 1400 },
  { goodsId: 'glass', amount: 300 },
  { goodsId: 'aluminum', amount: 350 },
  { goodsId: 'copper', amount: 300 },
  { goodsId: 'mechanical-parts', amount: 350 },
  { goodsId: 'electric-motor', amount: 45 },
  { goodsId: 'pcb', amount: 60 },
  { goodsId: 'sensors', amount: 50 },
]
```

#### pcb-factory (PCB工厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1600 },
  { goodsId: 'steel', amount: 1200 },
  { goodsId: 'glass', amount: 400 },
  { goodsId: 'aluminum', amount: 200 },
  { goodsId: 'copper', amount: 500 },       // PCB生产大量用铜
  { goodsId: 'mechanical-parts', amount: 300 },
  { goodsId: 'electric-motor', amount: 40 },
  { goodsId: 'sensors', amount: 40 },
  { goodsId: 'chemicals', amount: 100 },    // 蚀刻液等
]
```

#### engine-factory (发动机厂) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 3500 },
  { goodsId: 'steel', amount: 3000 },
  { goodsId: 'glass', amount: 300 },
  { goodsId: 'aluminum', amount: 400 },
  { goodsId: 'copper', amount: 350 },
  { goodsId: 'mechanical-parts', amount: 800 },
  { goodsId: 'electric-motor', amount: 100 },
  { goodsId: 'pcb', amount: 50 },
  { goodsId: 'sensors', amount: 70 },
]
```

#### electric-motor-factory (电机厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2200 },
  { goodsId: 'steel', amount: 1800 },
  { goodsId: 'glass', amount: 250 },
  { goodsId: 'aluminum', amount: 300 },
  { goodsId: 'copper', amount: 600 },       // 电机用铜
  { goodsId: 'mechanical-parts', amount: 400 },
  { goodsId: 'electric-motor', amount: 60 },
  { goodsId: 'pcb', amount: 40 },
  { goodsId: 'sensors', amount: 45 },
]
```

#### mechanical-parts-factory (机械加工厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2000 },
  { goodsId: 'steel', amount: 1600 },
  { goodsId: 'glass', amount: 200 },
  { goodsId: 'aluminum', amount: 200 },
  { goodsId: 'copper', amount: 200 },
  { goodsId: 'mechanical-parts', amount: 500 }, // 生产设备
  { goodsId: 'electric-motor', amount: 80 },
  { goodsId: 'pcb', amount: 30 },
  { goodsId: 'sensors', amount: 35 },
]
```

#### auto-parts-factory (汽车零部件厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2400 },
  { goodsId: 'steel', amount: 2000 },
  { goodsId: 'glass', amount: 250 },
  { goodsId: 'aluminum', amount: 300 },
  { goodsId: 'copper', amount: 250 },
  { goodsId: 'mechanical-parts', amount: 450 },
  { goodsId: 'electric-motor', amount: 70 },
  { goodsId: 'pcb', amount: 35 },
  { goodsId: 'sensors', amount: 40 },
  { goodsId: 'rubber', amount: 200 },
]
```

#### sensor-factory (传感器厂) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1000 },
  { goodsId: 'steel', amount: 800 },
  { goodsId: 'glass', amount: 500 },        // 洁净区
  { goodsId: 'aluminum', amount: 250 },
  { goodsId: 'copper', amount: 200 },
  { goodsId: 'mechanical-parts', amount: 250 },
  { goodsId: 'electric-motor', amount: 30 },
  { goodsId: 'pcb', amount: 50 },
]
```

#### tv-factory (电视机工厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1800 },
  { goodsId: 'steel', amount: 1400 },
  { goodsId: 'glass', amount: 350 },
  { goodsId: 'aluminum', amount: 300 },
  { goodsId: 'copper', amount: 250 },
  { goodsId: 'mechanical-parts', amount: 350 },
  { goodsId: 'electric-motor', amount: 45 },
  { goodsId: 'pcb', amount: 60 },
  { goodsId: 'sensors', amount: 40 },
]
```

#### appliance-factory (家电工厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2000 },
  { goodsId: 'steel', amount: 1600 },
  { goodsId: 'glass', amount: 250 },
  { goodsId: 'aluminum', amount: 250 },
  { goodsId: 'copper', amount: 220 },
  { goodsId: 'mechanical-parts', amount: 380 },
  { goodsId: 'electric-motor', amount: 55 },
  { goodsId: 'pcb', amount: 45 },
  { goodsId: 'sensors', amount: 35 },
]
```

#### household-goods-factory (日用品工厂) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 800 },
  { goodsId: 'steel', amount: 600 },
  { goodsId: 'glass', amount: 100 },
  { goodsId: 'plastic', amount: 200 },
  { goodsId: 'copper', amount: 60 },
  { goodsId: 'mechanical-parts', amount: 150 },
  { goodsId: 'electric-motor', amount: 20 },
]
```

### 4.5 服务设施类 (service)

#### power-plant-coal (燃煤电厂) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 8000 },      // 大型地基、冷却塔
  { goodsId: 'steel', amount: 6000 },       // 锅炉、烟囱
  { goodsId: 'glass', amount: 200 },
  { goodsId: 'aluminum', amount: 300 },
  { goodsId: 'copper', amount: 1000 },      // 发电机绕组、电缆
  { goodsId: 'mechanical-parts', amount: 800 },
  { goodsId: 'electric-motor', amount: 60 }, // 辅助设备
  { goodsId: 'sensors', amount: 100 },
]
```

#### power-plant-gas (燃气电厂) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 4000 },
  { goodsId: 'steel', amount: 3500 },
  { goodsId: 'glass', amount: 150 },
  { goodsId: 'aluminum', amount: 250 },
  { goodsId: 'copper', amount: 700 },
  { goodsId: 'mechanical-parts', amount: 500 },
  { goodsId: 'electric-motor', amount: 45 },
  { goodsId: 'sensors', amount: 80 },
]
```

#### data-center (数据中心) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2500 },
  { goodsId: 'steel', amount: 2000 },
  { goodsId: 'glass', amount: 400 },
  { goodsId: 'aluminum', amount: 600 },     // 服务器机架、散热
  { goodsId: 'copper', amount: 800 },       // 大量布线
  { goodsId: 'mechanical-parts', amount: 300 },
  { goodsId: 'electric-motor', amount: 100 }, // 冷却系统
  { goodsId: 'pcb', amount: 100 },
  { goodsId: 'sensors', amount: 150 },
]
```

### 4.6 零售类 (retail)

#### supermarket (超市) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1500 },
  { goodsId: 'steel', amount: 1200 },
  { goodsId: 'glass', amount: 500 },        // 大型橱窗
  { goodsId: 'aluminum', amount: 300 },     // 货架、装饰
  { goodsId: 'plastic', amount: 400 },      // 装修材料
  { goodsId: 'copper', amount: 150 },
  { goodsId: 'electric-motor', amount: 30 }, // 冷柜、电梯
]
```

#### convenience-store (便利店) - small
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 200 },
  { goodsId: 'steel', amount: 150 },
  { goodsId: 'glass', amount: 150 },
  { goodsId: 'aluminum', amount: 80 },
  { goodsId: 'plastic', amount: 100 },
  { goodsId: 'copper', amount: 30 },
  { goodsId: 'electric-motor', amount: 5 },
]
```

#### electronics-mall (电子商城) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 2000 },
  { goodsId: 'steel', amount: 1600 },
  { goodsId: 'glass', amount: 800 },
  { goodsId: 'aluminum', amount: 500 },
  { goodsId: 'plastic', amount: 300 },
  { goodsId: 'copper', amount: 200 },
  { goodsId: 'electric-motor', amount: 40 },
  { goodsId: 'pcb', amount: 20 },           // 展示系统
]
```

#### car-dealership (汽车4S店) - huge
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 3000 },
  { goodsId: 'steel', amount: 2500 },
  { goodsId: 'glass', amount: 1000 },       // 大型展厅
  { goodsId: 'aluminum', amount: 400 },
  { goodsId: 'plastic', amount: 200 },
  { goodsId: 'copper', amount: 250 },
  { goodsId: 'mechanical-parts', amount: 200 }, // 维修设备
  { goodsId: 'electric-motor', amount: 50 },
]
```

#### restaurant (餐厅) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 600 },
  { goodsId: 'steel', amount: 400 },
  { goodsId: 'glass', amount: 250 },
  { goodsId: 'aluminum', amount: 150 },
  { goodsId: 'plastic', amount: 100 },
  { goodsId: 'copper', amount: 60 },
  { goodsId: 'electric-motor', amount: 10 },
]
```

#### gas-station (加油站) - medium
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1000 },      // 油罐地基
  { goodsId: 'steel', amount: 800 },        // 罩棚、油罐
  { goodsId: 'glass', amount: 100 },
  { goodsId: 'aluminum', amount: 150 },
  { goodsId: 'plastic', amount: 200 },      // 管道
  { goodsId: 'copper', amount: 100 },
  { goodsId: 'rubber', amount: 100 },       // 密封
  { goodsId: 'sensors', amount: 20 },       // 油位检测
]
```

#### appliance-mall (家电卖场) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1800 },
  { goodsId: 'steel', amount: 1400 },
  { goodsId: 'glass', amount: 600 },
  { goodsId: 'aluminum', amount: 400 },
  { goodsId: 'plastic', amount: 250 },
  { goodsId: 'copper', amount: 180 },
  { goodsId: 'electric-motor', amount: 35 },
]
```

#### construction-supplier (建材供应商) - large
```typescript
constructionMaterials: [
  { goodsId: 'cement', amount: 1200 },
  { goodsId: 'steel', amount: 1500 },       // 仓库货架
  { goodsId: 'glass', amount: 200 },
  { goodsId: 'aluminum', amount: 200 },
  { goodsId: 'copper', amount: 100 },
  { goodsId: 'mechanical-parts', amount: 100 }, // 叉车等
  { goodsId: 'electric-motor', amount: 20 },
]
```

## 5. 实施计划

### 5.1 接口修改

```typescript
// 在 BuildingDef 接口中添加/修改
export interface BuildingDef {
  // ... 现有字段
  
  // 移除 baseCost，改用计算
  // baseCost: number; // 删除
  
  // 新增人工成本系数（可选，默认使用类别系数）
  laborComplexityFactor?: number;
  
  // 建造材料（必须显式定义）
  constructionMaterials: ConstructionMaterial[];
}

// 新增成本计算函数
export function calculateConstructionCost(
  building: BuildingDef, 
  marketPrices: Record<string, number>
): { materialCost: number; laborCost: number; totalCost: number };
```

### 5.2 文件修改清单

1. **packages/shared/src/data/buildingDefinitions.ts**
   - 为每个建筑添加 `constructionMaterials` 配置
   - 移除 `baseCost` 字段
   - 添加 `laborComplexityFactor` 可选字段
   - 添加 `calculateConstructionCost` 函数

2. **packages/server/src/services/aiCompanyManager.ts**
   - 修改建筑购买决策逻辑
   - 使用动态计算的成本替代 `baseCost`

3. **packages/client/src/components/game/BuildingShop.tsx**
   - 显示材料需求和成本明细
   - 实时计算基于市场价格的建造成本

4. **packages/server/src/routes/game.ts**
   - 修改建筑购买API，验证材料需求

### 5.3 建造时间调整

根据材料数量和复杂度调整建造时间：

```typescript
export const CONSTRUCTION_TIME_BY_SIZE: Record<BuildingDef['size'], number> = {
  small: 2,     // 2天
  medium: 5,    // 5天
  large: 11,    // 11天
  huge: 23,     // 23天
};
```

## 6. 成本估算示例

以铁矿场为例：

| 材料 | 数量 | 单价(万) | 小计(万) |
|------|------|----------|----------|
| 水泥 | 2000 | 0.03 | 60 |
| 钢材 | 1500 | 0.12 | 180 |
| 机械零件 | 200 | 0.25 | 50 |
| 电动机 | 20 | 1.2 | 24 |
| 铜 | 100 | 0.18 | 18 |
| 玻璃 | 50 | 0.05 | 2.5 |
| **材料总计** | - | - | **334.5万** |
| **人工成本** | - | - | **200万** |
| **总成本** | - | - | **534.5万** |

原 baseCost 为 5000万，新成本约为 534.5万，更符合实际。

## 7. 注意事项

1. **循环依赖问题**：某些建筑需要自己生产的材料（如钢铁厂需要钢材），需要设计"进口"或"初始库存"机制
2. **市场价格波动**：建造成本会随市场价格波动，需要考虑锁定价格或使用基准价格
3. **材料供应**：玩家需要先确保有足够材料才能建造，增加了游戏策略深度
4. **AI决策调整**：AI需要考虑材料采购和库存管理