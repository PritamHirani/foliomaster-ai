export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum TransactionNature {
  LUMPSUM = 'LUMPSUM',
  SIP = 'SIP',
  SWP = 'SWP',
  STP_IN = 'STP_IN',
  STP_OUT = 'STP_OUT',
  SWITCH_IN = 'SWITCH_IN',
  SWITCH_OUT = 'SWITCH_OUT',
  DIVIDEND_REINVEST = 'DIVIDEND_REINVEST'
}

export type UserRole = 'DISTRIBUTOR' | 'CLIENT';

export interface Client {
    id: string;
    name: string;
    pan: string;
    email?: string;
    associatedArn: string;
    familyId?: string; // New field for family grouping
}

export interface Transaction {
  id: string;
  schemeCode?: string;
  fundName: string;
  date: string;
  nav: number;
  amount: number;
  units: number;
  type: TransactionType;
  nature: TransactionNature; // New field for SIP/SWP etc
  category: string;
  clientId: string;
  arn: string;
  folioNumber: string; // New field
}

export interface Holding {
  schemeCode?: string;
  fundName: string;
  category: string;
  folioNumber: string;
  totalUnits: number;
  averageNav: number;
  investedAmount: number;
  currentNav: number; 
  currentValue: number;
  absoluteReturn: number;
  absoluteReturnPercentage: number;
  xirr: number; // New metric
  lastUpdated?: string;
  lastTxDate?: string;
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  totalGainPercentage: number;
  xirr: number; // New metric
}

export interface AdvisorResponse {
  analysis: string;
  riskScore: number;
  suggestions: string[];
}

export interface AMFIScheme {
  schemeCode: string;
  schemeName: string;
}

export interface Goal {
  id: string;
  clientId: string;
  name: string;
  targetAmount: number;
  currentAmount?: number; // Recalculated from linked portfolio
  targetDate: string;
  category: 'EDUCATION' | 'RETIREMENT' | 'HOME' | 'CHILD_MARRIAGE' | 'VACATION' | 'OTHER';
  priority: 1 | 2 | 3;
  linkedFolios?: string[]; // Optional: specify which folios fund this goal
  status: 'ON_TRACK' | 'AT_RISK' | 'COMPLETED';
}

export interface FundMetrics {
  schemeCode: string;
  expenseRatio: number; // %
  aum: number; // Assets under management in crores
  fundManager: string;
  inception: string;
  return1Y: number;
  return3Y: number;
  return5Y: number;
  beta: number;
  alpha: number;
  riskStd: number; // Standard deviation
  benchmarkIndex: string;
}

export interface Family {
  id: string;
  name: string;
  description?: string;
  clientIds: string[];
  createdDate: string;
  arnFilter: string; // Must belong to same distributor ARN
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertCategory = 'PORTFOLIO' | 'GOAL' | 'TRANSACTION' | 'SYSTEM';
export type AlertStatus = 'UNREAD' | 'READ' | 'DISMISSED';

export interface PortfolioAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  status: AlertStatus;
  createdAt: string;
  clientId?: string;
  actionHint?: string;
}
