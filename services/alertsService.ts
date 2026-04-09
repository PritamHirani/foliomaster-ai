import { Goal, Holding, PortfolioAlert, PortfolioSummary, Transaction } from '../types';

const ALERT_STATE_KEY = 'folio_master_alert_states_v1';

type AlertStateMap = Record<string, 'READ' | 'DISMISSED'>;

interface AlertContext {
  holdings: Holding[];
  summary: PortfolioSummary;
  goals: Goal[];
  transactions: Transaction[];
  selectedClientId?: string;
}

const severityRank: Record<PortfolioAlert['severity'], number> = {
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1,
};

const getAlertStateMap = (): AlertStateMap => {
  const raw = localStorage.getItem(ALERT_STATE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as AlertStateMap;
  } catch {
    return {};
  }
};

const saveAlertStateMap = (map: AlertStateMap) => {
  localStorage.setItem(ALERT_STATE_KEY, JSON.stringify(map));
};

export const markAlertAsRead = (alertId: string) => {
  const current = getAlertStateMap();
  current[alertId] = 'READ';
  saveAlertStateMap(current);
};

export const dismissAlert = (alertId: string) => {
  const current = getAlertStateMap();
  current[alertId] = 'DISMISSED';
  saveAlertStateMap(current);
};

export const markAllAlertsRead = (alertIds: string[]) => {
  const current = getAlertStateMap();
  alertIds.forEach((id) => {
    if (current[id] !== 'DISMISSED') {
      current[id] = 'READ';
    }
  });
  saveAlertStateMap(current);
};

const withStatus = (alerts: Omit<PortfolioAlert, 'status'>[]): PortfolioAlert[] => {
  const state = getAlertStateMap();

  return alerts
    .map((alert): PortfolioAlert => ({
      ...alert,
      status: (state[alert.id] ?? 'UNREAD') as PortfolioAlert['status'],
    }))
    .filter((alert) => alert.status !== 'DISMISSED')
    .sort((a, b) => {
      const severityDelta = severityRank[b.severity] - severityRank[a.severity];
      if (severityDelta !== 0) return severityDelta;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
};

const buildPortfolioAlerts = (context: AlertContext): Omit<PortfolioAlert, 'status'>[] => {
  const alerts: Omit<PortfolioAlert, 'status'>[] = [];
  const now = new Date().toISOString();
  const portfolioId = context.selectedClientId ?? 'scope';

  if (context.summary.totalGainPercentage <= -6) {
    alerts.push({
      id: `portfolio-drawdown-${portfolioId}`,
      title: 'Portfolio Drawdown Alert',
      message: `Portfolio return is ${context.summary.totalGainPercentage.toFixed(1)}%. Consider rebalancing risk-heavy allocations.`,
      severity: context.summary.totalGainPercentage <= -12 ? 'CRITICAL' : 'WARNING',
      category: 'PORTFOLIO',
      createdAt: now,
      clientId: context.selectedClientId,
      actionHint: 'Review holdings concentration and high-beta funds.',
    });
  }

  const totalValue = context.holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  if (totalValue > 0 && context.holdings.length > 1) {
    const largestHolding = context.holdings.reduce((prev, curr) =>
      curr.currentValue > prev.currentValue ? curr : prev
    );
    const concentration = (largestHolding.currentValue / totalValue) * 100;

    if (concentration >= 40) {
      alerts.push({
        id: `portfolio-concentration-${portfolioId}`,
        title: 'High Concentration Risk',
        message: `${largestHolding.fundName} is ${concentration.toFixed(1)}% of the portfolio.`,
        severity: concentration >= 55 ? 'CRITICAL' : 'WARNING',
        category: 'PORTFOLIO',
        createdAt: now,
        clientId: context.selectedClientId,
        actionHint: 'Diversify into additional categories to reduce concentration.',
      });
    }
  }

  return alerts;
};

const estimateGoalCurrentAmount = (goal: Goal): number => {
  if (typeof goal.currentAmount === 'number') return goal.currentAmount;
  if (goal.status === 'COMPLETED') return goal.targetAmount;
  if (goal.status === 'ON_TRACK') return goal.targetAmount * 0.65;
  return goal.targetAmount * 0.35;
};

const buildGoalAlerts = (context: AlertContext): Omit<PortfolioAlert, 'status'>[] => {
  const now = new Date();
  const alerts: Omit<PortfolioAlert, 'status'>[] = [];

  context.goals.forEach((goal) => {
    const currentAmount = estimateGoalCurrentAmount(goal);
    const progress = goal.targetAmount > 0 ? (currentAmount / goal.targetAmount) * 100 : 0;
    const targetDate = new Date(goal.targetDate);
    const monthsLeft = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

    if (goal.status === 'AT_RISK' || (monthsLeft <= 18 && progress < 55)) {
      alerts.push({
        id: `goal-risk-${goal.id}`,
        title: `${goal.name} needs attention`,
        message: `Progress is ${Math.max(0, Math.min(100, progress)).toFixed(0)}% with about ${Math.max(0, Math.ceil(monthsLeft))} months left.`,
        severity: monthsLeft <= 8 ? 'CRITICAL' : 'WARNING',
        category: 'GOAL',
        createdAt: now.toISOString(),
        clientId: goal.clientId,
        actionHint: 'Increase SIP or extend target timeline.',
      });
    }
  });

  return alerts;
};

const buildTransactionAlerts = (context: AlertContext): Omit<PortfolioAlert, 'status'>[] => {
  const alerts: Omit<PortfolioAlert, 'status'>[] = [];
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const recentSells = context.transactions.filter((tx) => tx.type === 'SELL' && new Date(tx.date) >= oneMonthAgo);
  if (recentSells.length >= 4) {
    alerts.push({
      id: `tx-heavy-redemption-${context.selectedClientId ?? 'scope'}`,
      title: 'Frequent Redemptions Detected',
      message: `${recentSells.length} redemption transactions were recorded in the last 30 days.`,
      severity: recentSells.length >= 8 ? 'CRITICAL' : 'INFO',
      category: 'TRANSACTION',
      createdAt: now.toISOString(),
      clientId: context.selectedClientId,
      actionHint: 'Verify cashflow need and tax impact.',
    });
  }

  return alerts;
};

export const generatePortfolioAlerts = (context: AlertContext): PortfolioAlert[] => {
  const generated = [
    ...buildPortfolioAlerts(context),
    ...buildGoalAlerts(context),
    ...buildTransactionAlerts(context),
  ];

  return withStatus(generated);
};
