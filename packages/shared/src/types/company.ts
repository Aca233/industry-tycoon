/**
 * Company and competitor types
 */

import { type EntityId, type Money, type Percentage, type Timestamp } from './common.js';

/** Company type */
export enum CompanyType {
  Player = 'player',
  AICompetitor = 'ai_competitor',
  NPC = 'npc', // Background companies
}

/** AI personality archetype */
export enum AIPersonality {
  Monopolist = 'monopolist', // Aggressive, price wars, supply control
  TrendSurfer = 'trend_surfer', // Follows trends, quick pivots
  OldMoney = 'old_money', // Conservative, quality focused
  Innovator = 'innovator', // R&D focused, first mover
  CostLeader = 'cost_leader', // Efficiency obsessed
}

/** Company definition */
export interface Company {
  id: EntityId;
  name: string;
  type: CompanyType;
  
  // AI specific
  personality?: AIPersonality;
  aiInstructions?: string; // LLM system prompt
  
  // Financials
  cash: Money;
  debt: Money;
  creditRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D';
  
  // Stock
  stockPrice: Money;
  sharesOutstanding: number;
  marketCap: Money;
  
  // Reputation
  publicReputation: Percentage;
  supplierReputation: Percentage;
  employeeReputation: Percentage;
  
  // Relationships with other companies
  relationships: CompanyRelationship[];
  
  // Memory of past interactions (for LLM context)
  interactionHistory: InteractionRecord[];
  
  createdAt: Timestamp;
  bankruptAt?: Timestamp;
}

export interface CompanyRelationship {
  targetCompanyId: EntityId;
  type: RelationshipType;
  trust: number; // -100 to 100
  lastInteraction: Timestamp;
  notes: string[]; // LLM generated notes about the relationship
}

export enum RelationshipType {
  Neutral = 'neutral',
  Ally = 'ally',
  Rival = 'rival',
  Supplier = 'supplier',
  Customer = 'customer',
  Subsidiary = 'subsidiary',
  Parent = 'parent',
}

export interface InteractionRecord {
  tick: number;
  type: InteractionType;
  targetCompanyId?: EntityId;
  description: string;
  outcome: 'positive' | 'negative' | 'neutral';
  impactOnTrust?: number;
}

export enum InteractionType {
  ContractSigned = 'contract_signed',
  ContractBreached = 'contract_breached',
  PriceWar = 'price_war',
  Acquisition = 'acquisition',
  JointVenture = 'joint_venture',
  Lawsuit = 'lawsuit',
  Negotiation = 'negotiation',
  Espionage = 'espionage',
  TalentPoaching = 'talent_poaching',
  MediaAttack = 'media_attack',
}

/** Employee/Talent types */
export interface Employee {
  id: EntityId;
  name: string;
  role: EmployeeRole;
  companyId: EntityId;
  
  // Skills
  skills: Record<string, number>;
  experience: number;
  
  // Satisfaction
  salary: Money;
  satisfaction: Percentage;
  loyalty: Percentage;
  
  // History
  previousCompanies: EntityId[];
  hiredAt: Timestamp;
}

export enum EmployeeRole {
  CEO = 'ceo',
  ChiefEngineer = 'chief_engineer',
  ChiefScientist = 'chief_scientist',
  ChiefMarketing = 'chief_marketing',
  ChiefFinance = 'chief_finance',
  FactoryManager = 'factory_manager',
  SalesRep = 'sales_rep',
  Researcher = 'researcher',
  Worker = 'worker',
}

/** Job offer for talent poaching */
export interface JobOffer {
  id: EntityId;
  fromCompanyId: EntityId;
  toEmployeeId: EntityId;
  role: EmployeeRole;
  salaryOffer: Money;
  signingBonus: Money;
  message: string; // LLM generated pitch
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

/** Financial report */
export interface FinancialReport {
  companyId: EntityId;
  period: { startTick: number; endTick: number };
  
  revenue: Money;
  costOfGoodsSold: Money;
  grossProfit: Money;
  
  operatingExpenses: {
    labor: Money;
    maintenance: Money;
    marketing: Money;
    research: Money;
    other: Money;
  };
  
  operatingIncome: Money;
  interestExpense: Money;
  taxes: Money;
  netIncome: Money;
  
  // Balance sheet items
  totalAssets: Money;
  totalLiabilities: Money;
  shareholderEquity: Money;
  
  // Ratios
  profitMargin: Percentage;
  debtToEquity: number;
  currentRatio: number;
}