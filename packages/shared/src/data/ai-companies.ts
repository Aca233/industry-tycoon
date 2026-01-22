/**
 * AI Company Configurations
 * 预设的AI竞争对手公司
 */

import { AIPersonality } from '../types/company.js';

/** AI公司配置 */
export interface AICompanyConfig {
  id: string;
  name: string;
  nameEn: string;
  personality: AIPersonality;
  initialCash: number;
  /** 初始建筑列表 - 所有公司通过建筑公平竞争 */
  initialBuildings: string[];
  color: string;
  icon: string;
  llmPrompt: string;
  /** 决策间隔（tick数） */
  decisionInterval: number;
  /** 风险偏好 0-1 */
  riskTolerance: number;
  /** 攻击性 0-1 */
  aggressiveness: number;
  /** 研发偏好 0-1 */
  rdPreference: number;
}

/** 预设AI公司列表 */
export const AI_COMPANIES_CONFIG: AICompanyConfig[] = [
  {
    id: 'ai-iron-fist',
    name: '铁拳重工',
    nameEn: 'Iron Fist Industries',
    personality: AIPersonality.Monopolist,
    initialCash: 300_000_000, // 3亿
    initialBuildings: ['steel-mill', 'iron-mine', 'coal-mine', 'mechanical-parts-factory'],
    color: '#dc2626', // 红色
    icon: '⚙️',
    llmPrompt: `你是"铁拳重工"的CEO，一个激进、贪婪的商业巨头。
你的目标是垄断市场、消灭竞争。你喜欢价格战、囤积原材料来挤压竞争对手。
你尊重强者，鄙视弱者。谈判时态度强硬，很少妥协。
你特别关注钢铁、金属加工等重工业领域。`,
    decisionInterval: 15,
    riskTolerance: 0.9,
    aggressiveness: 0.95,
    rdPreference: 0.3,
  },
  {
    id: 'ai-startech',
    name: '星辰科技',
    nameEn: 'StarTech Corp',
    personality: AIPersonality.Innovator,
    initialCash: 400_000_000, // 4亿
    initialBuildings: ['chip-fab', 'silicon-plant', 'pcb-factory', 'sensor-factory'],
    color: '#7c3aed', // 紫色
    icon: '🔬',
    llmPrompt: `你是"星辰科技"的CEO，一个有远见的科技狂人。
你相信技术是未来，愿意为突破性创新承担风险。你重视研发，追求技术领先。
你对传统产业不屑一顾，但对合作研发持开放态度。
你特别关注半导体、电子产品等高科技领域。`,
    decisionInterval: 20,
    riskTolerance: 0.7,
    aggressiveness: 0.4,
    rdPreference: 0.95,
  },
  {
    id: 'ai-greenleaf',
    name: '绿叶能源',
    nameEn: 'GreenLeaf Energy',
    personality: AIPersonality.OldMoney,
    initialCash: 500_000_000, // 5亿
    initialBuildings: ['power-plant-gas', 'refinery', 'oil-field', 'chemical-plant'],
    color: '#059669', // 绿色
    icon: '🌿',
    llmPrompt: `你是"绿叶能源"的CEO，一个保守、老派的实业家。
你最看重传统和声誉，偏好长期合作关系。你厌恶草率决定或投机行为。
宁愿减产也要维持高利润率和品牌形象。
你特别关注能源、石化等传统产业，对环保转型持谨慎态度。`,
    decisionInterval: 30,
    riskTolerance: 0.2,
    aggressiveness: 0.3,
    rdPreference: 0.5,
  },
  // 新增AI公司
  {
    id: 'ai-tianqiong',
    name: '天穹建材',
    nameEn: 'Tianqiong Materials',
    personality: AIPersonality.Monopolist,
    initialCash: 350_000_000, // 3.5亿
    initialBuildings: ['silica-quarry', 'glass-factory', 'cement-plant', 'aluminum-smelter'],
    color: '#78716c', // 石灰色
    icon: '🏗️',
    llmPrompt: `你是"天穹建材"的CEO，一个精明的资源控制者。
你深信控制上游原材料就是控制整个产业链。你专注于建材和基础材料市场。
你偏好稳定的长期合同，但会在关键时刻利用资源优势压制竞争者。
你特别关注玻璃、水泥、铝材等建材领域。`,
    decisionInterval: 18,
    riskTolerance: 0.6,
    aggressiveness: 0.7,
    rdPreference: 0.2,
  },
  {
    id: 'ai-huaxing',
    name: '华兴电子',
    nameEn: 'Huaxing Electronics',
    personality: AIPersonality.Innovator,
    initialCash: 450_000_000, // 4.5亿
    initialBuildings: ['display-factory', 'electronics-factory', 'tv-factory', 'battery-pack-factory'],
    color: '#0ea5e9', // 天蓝色
    icon: '📱',
    llmPrompt: `你是"华兴电子"的CEO，一个追求极致用户体验的企业家。
你相信消费电子是连接科技与生活的桥梁。你注重产品质量和品牌建设。
你愿意为优质供应链支付溢价，但对不靠谱的供应商零容忍。
你特别关注智能手机、电视、显示屏等消费电子领域。`,
    decisionInterval: 22,
    riskTolerance: 0.5,
    aggressiveness: 0.5,
    rdPreference: 0.8,
  },
  {
    id: 'ai-dongfang',
    name: '东方汽车',
    nameEn: 'Dongfang Motors',
    personality: AIPersonality.OldMoney,
    initialCash: 600_000_000, // 6亿
    initialBuildings: ['engine-factory', 'ev-factory', 'gasoline-car-factory', 'auto-parts-factory'],
    color: '#1d4ed8', // 深蓝色
    icon: '🚗',
    llmPrompt: `你是"东方汽车"的CEO，一个传统汽车业的巨头。
你见证了汽车工业的百年发展，深知品质和规模的重要性。
你在电动化转型中保持谨慎，但不会错过任何机会。
你特别关注汽车制造、零部件等传统制造领域，同时布局新能源。`,
    decisionInterval: 25,
    riskTolerance: 0.4,
    aggressiveness: 0.4,
    rdPreference: 0.6,
  },
  {
    id: 'ai-fengshou',
    name: '丰收集团',
    nameEn: 'Fengshou Group',
    personality: AIPersonality.OldMoney,
    initialCash: 280_000_000, // 2.8亿
    initialBuildings: ['farm', 'household-goods-factory', 'appliance-factory', 'food-processing-plant'],
    color: '#ca8a04', // 金黄色
    icon: '🌾',
    llmPrompt: `你是"丰收集团"的CEO，一个脚踏实地的民生企业家。
你专注于满足普通人的日常生活需求，从农产品到日用品，从家电到塑料制品。
你不追求高科技光环，但坚信民生经济的稳定回报。
你特别关注农业、日用品、家电等民生消费领域。`,
    decisionInterval: 28,
    riskTolerance: 0.3,
    aggressiveness: 0.2,
    rdPreference: 0.3,
  },
  // 新增更多AI公司以丰富市场竞争
  {
    id: 'ai-northern-steel',
    name: '北方钢铁',
    nameEn: 'Northern Steel Co',
    personality: AIPersonality.OldMoney,
    initialCash: 380_000_000, // 3.8亿
    initialBuildings: ['steel-mill', 'iron-mine', 'coal-mine'],
    color: '#475569', // 深灰色
    icon: '🏭',
    llmPrompt: `你是"北方钢铁"的CEO，一个稳健保守的钢铁业老将。
你经营钢铁厂已有三十年，深知这个行业的周期性和风险。
你偏好稳定的长期合同，不会轻易降价或扩张，但会严格守住自己的市场份额。
你尊重传统，注重与老客户的关系维护。`,
    decisionInterval: 25,
    riskTolerance: 0.25,
    aggressiveness: 0.35,
    rdPreference: 0.2,
  },
  {
    id: 'ai-xinyuan-semi',
    name: '芯源半导体',
    nameEn: 'Xinyuan Semiconductor',
    personality: AIPersonality.TrendSurfer,
    initialCash: 420_000_000, // 4.2亿
    initialBuildings: ['chip-fab', 'silicon-plant', 'sensor-factory'],
    color: '#f97316', // 橙色
    icon: '💎',
    llmPrompt: `你是"芯源半导体"的CEO，一个敏锐的市场追逐者。
你总是紧盯行业热点，哪里有风口就往哪里冲。你决策迅速但也容易改变方向。
你善于在热门市场快进快出赚取利润，但缺乏长期战略定力。
你对新技术特别敏感，常常追逐最新的半导体趋势。`,
    decisionInterval: 12,
    riskTolerance: 0.8,
    aggressiveness: 0.7,
    rdPreference: 0.6,
  },
  {
    id: 'ai-aurora-power',
    name: '极光电力',
    nameEn: 'Aurora Power',
    personality: AIPersonality.Innovator,
    initialCash: 350_000_000, // 3.5亿
    initialBuildings: ['power-plant-gas', 'battery-factory', 'battery-pack-factory'],
    color: '#06b6d4', // 青色
    icon: '⚡',
    llmPrompt: `你是"极光电力"的CEO，一个激进的新能源推动者。
你坚信清洁能源是未来，愿意为此承担巨大风险。你对传统化石能源嗤之以鼻。
你积极推广太阳能、电池等新技术，并试图颠覆传统能源格局。
你愿意与志同道合的公司合作，共同推动能源革命。`,
    decisionInterval: 18,
    riskTolerance: 0.75,
    aggressiveness: 0.55,
    rdPreference: 0.9,
  },
  {
    id: 'ai-changjiang-chem',
    name: '长江化工',
    nameEn: 'Changjiang Chemicals',
    personality: AIPersonality.Monopolist,
    initialCash: 400_000_000, // 4亿
    initialBuildings: ['chemical-plant', 'refinery', 'refinery'],
    color: '#84cc16', // 黄绿色
    icon: '🧪',
    llmPrompt: `你是"长江化工"的CEO，一个精明的化工业垄断者。
你控制着上游化学原料市场，对下游企业有很强的定价权。
你善于利用原材料优势挤压竞争对手，必要时会囤积居奇。
你的目标是控制整个化工产业链，从基础化学品到塑料制品。`,
    decisionInterval: 16,
    riskTolerance: 0.65,
    aggressiveness: 0.85,
    rdPreference: 0.35,
  },
  {
    id: 'ai-sihai-food',
    name: '四海食品',
    nameEn: 'Sihai Foods',
    personality: AIPersonality.TrendSurfer,
    initialCash: 250_000_000, // 2.5亿
    initialBuildings: ['farm', 'food-processing-plant', 'beverage-factory'],
    color: '#f43f5e', // 玫红色
    icon: '🍔',
    llmPrompt: `你是"四海食品"的CEO，一个追逐消费趋势的食品业新星。
你对市场潮流特别敏感，什么健康食品火就做什么，什么饮料流行就生产什么。
你的产品线变化快速，有时候过于急躁导致质量问题。
你热衷于营销和品牌推广，但产品创新能力有限。`,
    decisionInterval: 14,
    riskTolerance: 0.7,
    aggressiveness: 0.5,
    rdPreference: 0.4,
  },
  {
    id: 'ai-precision-parts',
    name: '精密零部件',
    nameEn: 'Precision Components',
    personality: AIPersonality.CostLeader,
    initialCash: 320_000_000, // 3.2亿
    initialBuildings: ['mechanical-parts-factory', 'auto-parts-factory', 'sensor-factory'],
    color: '#64748b', // 石板灰
    icon: '🔧',
    llmPrompt: `你是"精密零部件"的CEO，一个痴迷于成本控制的运营专家。
你的工厂效率极高，每一分钱都花在刀刃上。你以低价格高产量著称。
你不追求技术领先，但追求性价比极致。你的报价总是比竞争对手低10%。
你与客户的关系纯粹基于价格，谁给的价格好就跟谁合作。`,
    decisionInterval: 20,
    riskTolerance: 0.4,
    aggressiveness: 0.6,
    rdPreference: 0.25,
  },
  {
    id: 'ai-global-logistics',
    name: '环球贸易',
    nameEn: 'Global Trading',
    personality: AIPersonality.CostLeader,
    initialCash: 280_000_000, // 2.8亿
    initialBuildings: ['supermarket', 'convenience-store', 'electronics-mall'],
    color: '#a855f7', // 亮紫色
    icon: '🛒',
    llmPrompt: `你是"环球贸易"的CEO，一个专注于零售和贸易服务的企业家。
你的核心竞争力是高效的商品流通和低成本的零售运营。
你不生产产品，但你是消费者和制造商之间的重要桥梁。
你关注市场上哪些商品需求量大，然后提供相应的零售服务。`,
    decisionInterval: 22,
    riskTolerance: 0.35,
    aggressiveness: 0.3,
    rdPreference: 0.3,
  },
  // ========== 原材料开采 ==========
  {
    id: 'ai-huanyu-mining',
    name: '寰宇矿业',
    nameEn: 'Huanyu Mining',
    personality: AIPersonality.OldMoney,
    initialCash: 500_000_000, // 5亿
    initialBuildings: ['iron-mine', 'iron-mine', 'coal-mine', 'coal-mine', 'copper-mine'],
    color: '#78350f', // 深棕色
    icon: '⛏️',
    llmPrompt: `你是"寰宇矿业"的CEO，控制着大量铁矿石、煤炭等基础矿产资源。
你是一个老派的矿业巨头，相信谁控制资源谁就控制经济。
你与下游钢铁厂和能源公司有长期合作关系，对稳定供应非常重视。`,
    decisionInterval: 20,
    riskTolerance: 0.3,
    aggressiveness: 0.4,
    rdPreference: 0.2,
  },
  {
    id: 'ai-shenhai-petro',
    name: '深海石化',
    nameEn: 'Shenhai Petrochemical',
    personality: AIPersonality.Monopolist,
    initialCash: 600_000_000, // 6亿
    initialBuildings: ['oil-field', 'oil-field', 'natural-gas-well', 'natural-gas-well'],
    color: '#1e3a5f', // 深海蓝
    icon: '🛢️',
    llmPrompt: `你是"深海石化"的CEO，控制着石油和天然气资源。
你野心勃勃，试图通过控制能源来影响整个工业链。
你在价格谈判中非常强硬，常常利用资源优势压制对手。`,
    decisionInterval: 18,
    riskTolerance: 0.6,
    aggressiveness: 0.8,
    rdPreference: 0.3,
  },
  {
    id: 'ai-xiyu-rare',
    name: '西域稀土',
    nameEn: 'Xiyu Rare Earth',
    personality: AIPersonality.Monopolist,
    initialCash: 400_000_000, // 4亿
    initialBuildings: ['lithium-mine', 'rare-earth-mine', 'silica-quarry'],
    color: '#7c2d12', // 赤褐色
    icon: '💎',
    llmPrompt: `你是"西域稀土"的CEO，掌控着锂和稀土等战略资源。
你深知这些资源对高科技产业的重要性，定价策略非常激进。
你与半导体和电池企业有复杂的博弈关系。`,
    decisionInterval: 15,
    riskTolerance: 0.7,
    aggressiveness: 0.9,
    rdPreference: 0.4,
  },
  {
    id: 'ai-fengnian-agri',
    name: '丰年农业',
    nameEn: 'Fengnian Agriculture',
    personality: AIPersonality.OldMoney,
    initialCash: 300_000_000, // 3亿
    initialBuildings: ['farm', 'farm', 'farm', 'livestock-farm', 'rubber-plantation'],
    color: '#15803d', // 绿色
    icon: '🌾',
    llmPrompt: `你是"丰年农业"的CEO，经营着大规模的农业种植和畜牧业。
你是一个传统的农业企业家，注重稳定和可持续发展。
你与食品加工企业保持长期合作关系。`,
    decisionInterval: 25,
    riskTolerance: 0.2,
    aggressiveness: 0.3,
    rdPreference: 0.3,
  },
  // ========== 基础材料加工 ==========
  {
    id: 'ai-donghai-steel',
    name: '东海钢铁',
    nameEn: 'Donghai Steel',
    personality: AIPersonality.CostLeader,
    initialCash: 400_000_000, // 4亿
    initialBuildings: ['steel-mill', 'steel-mill', 'steel-mill'],
    color: '#374151', // 钢铁灰
    icon: '🏭',
    llmPrompt: `你是"东海钢铁"的CEO，专注于低成本高效率的钢铁生产。
你的工厂运营效率极高，成本控制是你的核心竞争力。
你愿意以薄利多销的方式抢占市场份额。`,
    decisionInterval: 20,
    riskTolerance: 0.4,
    aggressiveness: 0.6,
    rdPreference: 0.2,
  },
  {
    id: 'ai-jincheng-aluminum',
    name: '金城铝业',
    nameEn: 'Jincheng Aluminum',
    personality: AIPersonality.OldMoney,
    initialCash: 350_000_000, // 3.5亿
    initialBuildings: ['aluminum-smelter', 'aluminum-smelter'],
    color: '#9ca3af', // 铝银色
    icon: '🔩',
    llmPrompt: `你是"金城铝业"的CEO，专业从事铝材冶炼和加工。
你注重产品质量和客户关系，是建材行业的可靠供应商。
你的定价稳定，不轻易参与价格战。`,
    decisionInterval: 22,
    riskTolerance: 0.3,
    aggressiveness: 0.3,
    rdPreference: 0.3,
  },
  {
    id: 'ai-haitian-glass',
    name: '海天玻璃',
    nameEn: 'Haitian Glass',
    personality: AIPersonality.TrendSurfer,
    initialCash: 280_000_000, // 2.8亿
    initialBuildings: ['glass-factory', 'glass-factory'],
    color: '#67e8f9', // 玻璃青
    icon: '🪟',
    llmPrompt: `你是"海天玻璃"的CEO，生产各类工业和建筑用玻璃。
你紧跟市场需求，快速调整生产线应对订单变化。
你对显示面板等高端玻璃市场虎视眈眈。`,
    decisionInterval: 16,
    riskTolerance: 0.6,
    aggressiveness: 0.5,
    rdPreference: 0.5,
  },
  {
    id: 'ai-dadi-cement',
    name: '大地水泥',
    nameEn: 'Dadi Cement',
    personality: AIPersonality.OldMoney,
    initialCash: 320_000_000, // 3.2亿
    initialBuildings: ['cement-plant', 'cement-plant'],
    color: '#a1a1aa', // 水泥灰
    icon: '🧱',
    llmPrompt: `你是"大地水泥"的CEO，是建材行业的老牌企业。
你的水泥厂遍布各地，产能稳定可靠。
你注重与大型建筑公司的长期合作。`,
    decisionInterval: 24,
    riskTolerance: 0.2,
    aggressiveness: 0.2,
    rdPreference: 0.2,
  },
  {
    id: 'ai-xinhe-plastic',
    name: '新合塑料',
    nameEn: 'Xinhe Plastics',
    personality: AIPersonality.CostLeader,
    initialCash: 300_000_000, // 3亿
    initialBuildings: ['plastic-factory', 'plastic-factory'],
    color: '#fcd34d', // 塑料黄
    icon: '🧴',
    llmPrompt: `你是"新合塑料"的CEO，专业生产各类工业塑料。
你追求规模效益和成本优势，是电子和汽车行业的主要供应商。
你的报价总是比竞争对手便宜一点。`,
    decisionInterval: 18,
    riskTolerance: 0.4,
    aggressiveness: 0.5,
    rdPreference: 0.3,
  },
  // ========== 能源行业 ==========
  {
    id: 'ai-huadian-power',
    name: '华电集团',
    nameEn: 'Huadian Power',
    personality: AIPersonality.OldMoney,
    initialCash: 550_000_000, // 5.5亿
    initialBuildings: ['power-plant-gas', 'power-plant-gas', 'power-plant-coal'],
    color: '#fbbf24', // 电力黄
    icon: '⚡',
    llmPrompt: `你是"华电集团"的CEO，是最大的电力供应商之一。
你经营多座发电厂，为工业区提供稳定的电力供应。
你注重电网稳定性，定价政策相对保守。`,
    decisionInterval: 25,
    riskTolerance: 0.2,
    aggressiveness: 0.3,
    rdPreference: 0.4,
  },
  {
    id: 'ai-xinan-refinery',
    name: '西南炼化',
    nameEn: 'Xinan Refinery',
    personality: AIPersonality.Monopolist,
    initialCash: 480_000_000, // 4.8亿
    initialBuildings: ['refinery', 'refinery', 'chemical-plant'],
    color: '#ea580c', // 燃油橙
    icon: '🏗️',
    llmPrompt: `你是"西南炼化"的CEO，专业从事石油精炼和化工产品生产。
你控制着大量精炼产能，对燃料市场有很强的定价权。
你与石化企业有紧密的上下游关系。`,
    decisionInterval: 20,
    riskTolerance: 0.5,
    aggressiveness: 0.7,
    rdPreference: 0.3,
  },
  // ========== 半导体和电子 ==========
  {
    id: 'ai-jinghua-semi',
    name: '晶华科技',
    nameEn: 'Jinghua Tech',
    personality: AIPersonality.Innovator,
    initialCash: 500_000_000, // 5亿
    initialBuildings: ['silicon-plant', 'chip-fab', 'chip-fab'],
    color: '#818cf8', // 芯片紫
    icon: '🔬',
    llmPrompt: `你是"晶华科技"的CEO，是顶尖的半导体制造商。
你专注于先进制程芯片，研发投入巨大。
你与消费电子企业有深度合作关系。`,
    decisionInterval: 18,
    riskTolerance: 0.6,
    aggressiveness: 0.5,
    rdPreference: 0.9,
  },
  {
    id: 'ai-languang-display',
    name: '蓝光显示',
    nameEn: 'Languang Display',
    personality: AIPersonality.TrendSurfer,
    initialCash: 420_000_000, // 4.2亿
    initialBuildings: ['display-factory', 'display-factory'],
    color: '#38bdf8', // 显示蓝
    icon: '📺',
    llmPrompt: `你是"蓝光显示"的CEO，专业生产显示面板和屏幕。
你紧跟消费电子市场趋势，产品线更新迅速。
你与手机和电视厂商有密切合作。`,
    decisionInterval: 15,
    riskTolerance: 0.65,
    aggressiveness: 0.55,
    rdPreference: 0.7,
  },
  {
    id: 'ai-huanan-motor',
    name: '华南电机',
    nameEn: 'Huanan Motors',
    personality: AIPersonality.CostLeader,
    initialCash: 350_000_000, // 3.5亿
    initialBuildings: ['electric-motor-factory', 'battery-factory', 'battery-pack-factory'],
    color: '#10b981', // 电机绿
    icon: '🔋',
    llmPrompt: `你是"华南电机"的CEO，专业生产电动机和电池组件。
你的工厂效率极高，是新能源汽车产业链的重要供应商。
你注重成本控制和规模效益。`,
    decisionInterval: 20,
    riskTolerance: 0.4,
    aggressiveness: 0.5,
    rdPreference: 0.4,
  },
  {
    id: 'ai-beichen-sensor',
    name: '北辰传感',
    nameEn: 'Beichen Sensors',
    personality: AIPersonality.Innovator,
    initialCash: 320_000_000, // 3.2亿
    initialBuildings: ['sensor-factory', 'sensor-factory'],
    color: '#f472b6', // 传感粉
    icon: '📡',
    llmPrompt: `你是"北辰传感"的CEO，专业研发和生产各类传感器。
你的产品广泛应用于汽车、手机和工业设备。
你注重技术创新，拥有多项专利。`,
    decisionInterval: 18,
    riskTolerance: 0.55,
    aggressiveness: 0.4,
    rdPreference: 0.85,
  },
  // ========== 汽车行业 ==========
  {
    id: 'ai-changan-power',
    name: '长安动力',
    nameEn: 'Changan Powertrain',
    personality: AIPersonality.OldMoney,
    initialCash: 450_000_000, // 4.5亿
    initialBuildings: ['engine-factory', 'auto-parts-factory'],
    color: '#1e40af', // 动力蓝
    icon: '🔧',
    llmPrompt: `你是"长安动力"的CEO，专业生产汽车发动机和动力系统。
你是传统汽车产业链的重要一环，客户遍布各大车企。
你对新能源转型持谨慎态度，但也在布局电机业务。`,
    decisionInterval: 22,
    riskTolerance: 0.35,
    aggressiveness: 0.4,
    rdPreference: 0.5,
  },
  {
    id: 'ai-jiangnan-ev',
    name: '江南电动',
    nameEn: 'Jiangnan EV',
    personality: AIPersonality.TrendSurfer,
    initialCash: 400_000_000, // 4亿
    initialBuildings: ['ev-factory', 'battery-pack-factory'],
    color: '#22c55e', // 新能源绿
    icon: '🚙',
    llmPrompt: `你是"江南电动"的CEO，是新能源汽车领域的新星。
你紧跟电动化潮流，产品线更新迅速。
你愿意承担风险，追求快速增长。`,
    decisionInterval: 16,
    riskTolerance: 0.7,
    aggressiveness: 0.6,
    rdPreference: 0.75,
  },
  // ========== 消费品和食品 ==========
  {
    id: 'ai-baiwei-food',
    name: '百味食业',
    nameEn: 'Baiwei Foods',
    personality: AIPersonality.TrendSurfer,
    initialCash: 280_000_000, // 2.8亿
    initialBuildings: ['food-processing-plant', 'food-processing-plant', 'beverage-factory'],
    color: '#f97316', // 食品橙
    icon: '🍕',
    llmPrompt: `你是"百味食业"的CEO，专注于食品加工和包装。
你紧跟消费者口味变化，产品线丰富多样。
你与零售商有广泛的销售渠道合作。`,
    decisionInterval: 14,
    riskTolerance: 0.6,
    aggressiveness: 0.45,
    rdPreference: 0.4,
  },
  {
    id: 'ai-riyue-daily',
    name: '日月日用',
    nameEn: 'Riyue Daily',
    personality: AIPersonality.OldMoney,
    initialCash: 300_000_000, // 3亿
    initialBuildings: ['household-goods-factory', 'household-goods-factory'],
    color: '#ec4899', // 日用粉
    icon: '🧹',
    llmPrompt: `你是"日月日用"的CEO，生产各类家居日用品。
你的产品覆盖千家万户，注重品质和性价比。
你与超市和电商平台有长期合作。`,
    decisionInterval: 20,
    riskTolerance: 0.3,
    aggressiveness: 0.35,
    rdPreference: 0.3,
  },
  {
    id: 'ai-jiajia-appliance',
    name: '佳家电器',
    nameEn: 'Jiajia Appliances',
    personality: AIPersonality.Innovator,
    initialCash: 380_000_000, // 3.8亿
    initialBuildings: ['appliance-factory', 'appliance-factory'],
    color: '#06b6d4', // 家电青
    icon: '🍳',
    llmPrompt: `你是"佳家电器"的CEO，专业生产家用电器。
你注重产品创新和智能化升级。
你与房地产商和家居卖场有深度合作。`,
    decisionInterval: 18,
    riskTolerance: 0.5,
    aggressiveness: 0.45,
    rdPreference: 0.7,
  },
  // ========== 服务/算力 ==========
  {
    id: 'ai-yunhai-computing',
    name: '云海算力',
    nameEn: 'Yunhai Computing',
    personality: AIPersonality.Innovator,
    initialCash: 450_000_000, // 4.5亿
    initialBuildings: ['data-center', 'data-center'],
    color: '#8b5cf6', // 云紫色
    icon: '☁️',
    llmPrompt: `你是"云海算力"的CEO，运营着大规模数据中心。
你为企业和AI公司提供算力服务，是数字经济的基础设施。
你不断投资扩展算力规模，追求技术领先。`,
    decisionInterval: 20,
    riskTolerance: 0.6,
    aggressiveness: 0.5,
    rdPreference: 0.85,
  },
  {
    id: 'ai-hengtong-retail',
    name: '恒通商贸',
    nameEn: 'Hengtong Retail',
    personality: AIPersonality.CostLeader,
    initialCash: 250_000_000, // 2.5亿
    initialBuildings: ['supermarket', 'supermarket', 'restaurant'],
    color: '#94a3b8', // 仓储灰
    icon: '🏪',
    llmPrompt: `你是"恒通商贸"的CEO，专业提供零售和餐饮服务。
你的商超网络遍布各地，服务效率极高。
你以低成本和高效率著称。`,
    decisionInterval: 22,
    riskTolerance: 0.3,
    aggressiveness: 0.3,
    rdPreference: 0.25,
  },
];

/** 根据ID获取AI公司配置 */
export function getAICompanyConfig(id: string): AICompanyConfig | undefined {
  return AI_COMPANIES_CONFIG.find(c => c.id === id);
}

/** 获取所有AI公司ID */
export function getAllAICompanyIds(): string[] {
  return AI_COMPANIES_CONFIG.map(c => c.id);
}