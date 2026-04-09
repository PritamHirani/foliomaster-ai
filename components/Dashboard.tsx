import React, { useEffect, useMemo, useState } from 'react';
import { Holding, PortfolioSummary, Transaction, Goal, TransactionType, UserRole } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Percent, Activity, Target, Users, Shield, Calculator } from 'lucide-react';
import FundDetailsModal from './FundDetailsModal';
import { calculateGoalProgress, SCHEMES } from '../services/storageService';

interface DashboardProps {
  holdings: Holding[];
  summary: PortfolioSummary;
  transactions?: Transaction[];
  goals?: Goal[];
  role?: UserRole;
  selectedClientId?: string | null;
  showFamilyView?: boolean;
  onToggleFamilyView?: () => void;
}

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#6366f1'];
const EQUITY_CATEGORIES = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Flexi Cap', 'Sectoral']);

const CATEGORY_RISK_SCORE: Record<string, number> = {
  'Liquid': 20,
  'Large Cap': 40,
  'Hybrid': 45,
  'Flexi Cap': 60,
  'Mid Cap': 70,
  'Small Cap': 82,
  'Sectoral': 90,
};
const SCHEME_META_MAP = new Map(SCHEMES.map((s) => [s.code, s]));

const EQUITY_STCG_RATE = 0.2;
const EQUITY_LTCG_RATE = 0.125;
const EQUITY_LTCG_EXEMPTION = 125000;
const NON_EQUITY_LTCG_RATE = 0.125;
const HEALTH_EDU_CESS_RATE = 0.04;
const DEBT_SPECIFIED_CUTOFF_DATE = new Date('2023-04-01');
const CAPITAL_GAINS_RATE_CHANGE_DATE = new Date('2024-07-23');

interface TaxForecast {
  taxRegime: 'EQUITY' | 'NON_EQUITY';
  redemptionAmount: number;
  unitsRedeemed: number;
  stcgGain: number;
  ltcgGain: number;
  baseTax: number;
  cess: number;
  estimatedTax: number;
  postTaxAmount: number;
}

const formatINR = (value: number) => {
    return value.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    });
}

const Dashboard: React.FC<DashboardProps> = ({
  holdings,
  summary,
  transactions = [],
  goals = [],
  role = 'CLIENT',
  selectedClientId = null,
  showFamilyView = false,
  onToggleFamilyView
}) => {
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [growthGranularity, setGrowthGranularity] = useState<'DAILY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [growthWindow, setGrowthWindow] = useState<'6M' | '1Y' | '3Y' | 'ALL'>('1Y');
  const [taxHoldingKey, setTaxHoldingKey] = useState<string>('');
  const [redeemPercent, setRedeemPercent] = useState<number>(25);
  const [taxSlabRate, setTaxSlabRate] = useState<number>(0.3);
  const showClientScopedInsights = role === 'CLIENT' || (role === 'DISTRIBUTOR' && !!selectedClientId);
  const showTaxForecaster = showClientScopedInsights;

  // Aggregate for Pie Chart
  const categoryData = holdings.reduce((acc, curr) => {
    const existing = acc.find(x => x.name === curr.category);
    if (existing) {
      existing.value += curr.currentValue;
    } else {
      acc.push({ name: curr.category, value: curr.currentValue });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const growthData = useMemo(() => {
    if (transactions.length === 0) return [{ name: 'Current', value: summary.currentValue }];

    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const tracker: Record<string, { units: number; nav: number }> = {};
    const raw: { date: string; value: number }[] = [];

    sorted.forEach((t) => {
      const key = `${t.folioNumber}_${t.schemeCode || t.fundName}`;
      if (!tracker[key]) tracker[key] = { units: 0, nav: t.nav };

      if (t.type === TransactionType.BUY) tracker[key].units += t.units;
      else tracker[key].units = Math.max(0, tracker[key].units - t.units);
      tracker[key].nav = t.nav;

      const total = Object.values(tracker).reduce((sum, x) => sum + x.units * x.nav, 0);
      raw.push({ date: t.date, value: total });
    });

    const grouped: Record<string, { date: Date; value: number; label: string }> = {};
    raw.forEach((point) => {
      const d = new Date(point.date);
      let key = point.date;
      let label = point.date;
      let anchor = new Date(d);

      if (growthGranularity === 'MONTHLY') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        anchor = new Date(d.getFullYear(), d.getMonth(), 1);
      } else if (growthGranularity === 'YEARLY') {
        key = `${d.getFullYear()}`;
        label = String(d.getFullYear());
        anchor = new Date(d.getFullYear(), 0, 1);
      } else {
        label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      }

      grouped[key] = { date: anchor, value: point.value, label };
    });

    const now = new Date();
    const windowStart = new Date(now);
    if (growthWindow === '6M') windowStart.setMonth(now.getMonth() - 6);
    if (growthWindow === '1Y') windowStart.setFullYear(now.getFullYear() - 1);
    if (growthWindow === '3Y') windowStart.setFullYear(now.getFullYear() - 3);

    let points = Object.values(grouped).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Densify daily view so chart has true day-wise points between transaction days.
    if (growthGranularity === 'DAILY' && points.length > 1) {
      const dense: { date: Date; value: number; label: string }[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const startDate = new Date(start.date);
        const endDate = new Date(end.date);
        const dayMs = 24 * 60 * 60 * 1000;
        const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / dayMs));

        for (let d = 0; d < days; d++) {
          const current = new Date(startDate.getTime() + d * dayMs);
          const t = d / days;
          const interpolated = start.value + (end.value - start.value) * t;
          dense.push({
            date: current,
            value: interpolated,
            label: current.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
          });
        }
      }
      dense.push(points[points.length - 1]);
      points = dense;
    }
    if (growthWindow !== 'ALL') {
      points = points.filter(p => p.date >= windowStart);
    }

    const smoothingWindow = growthGranularity === 'DAILY' ? 5 : growthGranularity === 'MONTHLY' ? 3 : 2;
    const smoothed = points.map((p, i) => {
      const start = Math.max(0, i - smoothingWindow + 1);
      const segment = points.slice(start, i + 1);
      const avg = segment.reduce((sum, x) => sum + x.value, 0) / segment.length;
      return { name: p.label, value: avg };
    });

    smoothed.push({ name: 'Current', value: summary.currentValue });
    return smoothed;
  }, [transactions, growthGranularity, growthWindow, summary.currentValue]);

  useEffect(() => {
    if (holdings.length === 0) {
      setTaxHoldingKey('');
      return;
    }

    if (!taxHoldingKey || !holdings.some((h) => `${h.folioNumber}_${h.schemeCode || h.fundName}` === taxHoldingKey)) {
      const top = [...holdings].sort((a, b) => b.currentValue - a.currentValue)[0];
      setTaxHoldingKey(`${top.folioNumber}_${top.schemeCode || top.fundName}`);
    }
  }, [holdings, taxHoldingKey]);

  const riskInsights = useMemo(() => {
    const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    if (total <= 0 || holdings.length === 0) {
      return {
        score: 0,
        level: 'Low',
        concentration: 0,
        equityShare: 0,
        recommendations: ['Add diversified investments to generate a reliable risk profile.'],
      };
    }

    const weightedBaseRisk = holdings.reduce((sum, h) => {
      const weight = h.currentValue / total;
      const categoryRisk = CATEGORY_RISK_SCORE[h.category] ?? 60;
      const schemeMeta = h.schemeCode ? SCHEME_META_MAP.get(h.schemeCode) : undefined;
      const betaAdjustment = schemeMeta?.beta ? (schemeMeta.beta - 1) * 15 : 0;
      const profileAdjustment =
        schemeMeta?.riskProfile === 'HIGH' ? 8 :
        schemeMeta?.riskProfile === 'LOW' ? -6 :
        0;

      return sum + weight * (categoryRisk + betaAdjustment + profileAdjustment);
    }, 0);

    const largestHolding = holdings.reduce((prev, curr) => (curr.currentValue > prev.currentValue ? curr : prev));
    const concentration = (largestHolding.currentValue / total) * 100;
    const equityValue = holdings
      .filter((h) => EQUITY_CATEGORIES.has(h.category))
      .reduce((sum, h) => sum + h.currentValue, 0);
    const equityShare = (equityValue / total) * 100;
    const categoriesCount = new Set(holdings.map((h) => h.category)).size;

    let score = weightedBaseRisk;
    if (concentration > 50) score += 18;
    else if (concentration > 35) score += 10;
    if (categoriesCount <= 2) score += 8;
    if (summary.totalGainPercentage < -5) score += 6;
    score = Math.max(0, Math.min(100, score));

    const level =
      score < 35 ? 'Low' :
      score < 60 ? 'Moderate' :
      score < 80 ? 'High' :
      'Very High';

    const recommendations: string[] = [];
    if (concentration > 40) {
      recommendations.push(`Reduce concentration in ${largestHolding.fundName} (${concentration.toFixed(1)}%).`);
    }
    if (equityShare > 75) {
      recommendations.push('Portfolio is equity-heavy; consider debt/liquid allocation for downside protection.');
    }
    if (categoriesCount <= 2) {
      recommendations.push('Add 1-2 additional fund categories to improve diversification.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Current allocation looks balanced for the observed risk profile.');
    }

    return { score, level, concentration, equityShare, recommendations };
  }, [holdings, summary.totalGainPercentage]);

  const taxForecast = useMemo((): TaxForecast | null => {
    if (!showTaxForecaster || !taxHoldingKey) return null;
    const selected = holdings.find((h) => `${h.folioNumber}_${h.schemeCode || h.fundName}` === taxHoldingKey);
    if (!selected || selected.totalUnits <= 0 || selected.currentNav <= 0) return null;

    const selectedTxs = transactions
      .filter((t) => t.folioNumber === selected.folioNumber && (t.schemeCode || t.fundName) === (selected.schemeCode || selected.fundName))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    type Lot = { units: number; nav: number; date: Date };
    const lots: Lot[] = [];

    selectedTxs.forEach((tx) => {
      if (tx.type === TransactionType.BUY) {
        lots.push({ units: tx.units, nav: tx.nav, date: new Date(tx.date) });
        return;
      }

      let remaining = tx.units;
      while (remaining > 0.000001 && lots.length > 0) {
        const firstLot = lots[0];
        const used = Math.min(firstLot.units, remaining);
        firstLot.units -= used;
        remaining -= used;
        if (firstLot.units <= 0.000001) lots.shift();
      }
    });

    const redemptionAmount = (selected.currentValue * redeemPercent) / 100;
    let unitsToRedeem = Math.min(selected.totalUnits, redemptionAmount / selected.currentNav);
    const now = new Date();
    const isLikelyEquity =
      EQUITY_CATEGORIES.has(selected.category) ||
      (selected.category === 'Hybrid' && /(equity|balanced|aggressive)/i.test(selected.fundName));
    const taxRegime: TaxForecast['taxRegime'] = isLikelyEquity ? 'EQUITY' : 'NON_EQUITY';

    let stcgGain = 0;
    let ltcgGain = 0;
    let slabTaxableGain = 0;

    for (const lot of lots) {
      if (unitsToRedeem <= 0) break;
      if (lot.units <= 0) continue;

      const units = Math.min(lot.units, unitsToRedeem);
      unitsToRedeem -= units;
      const gain = units * (selected.currentNav - lot.nav);
      const holdingDays = (now.getTime() - lot.date.getTime()) / (1000 * 60 * 60 * 24);
      const isLongTerm = taxRegime === 'EQUITY' ? holdingDays >= 365 : holdingDays >= 1095;

      if (taxRegime === 'EQUITY') {
        if (isLongTerm) ltcgGain += gain;
        else stcgGain += gain;
      } else {
        // Non-equity lots acquired on/after 1-Apr-2023 are taxed at slab rates.
        if (lot.date >= DEBT_SPECIFIED_CUTOFF_DATE) {
          slabTaxableGain += gain;
        } else if (isLongTerm) {
          ltcgGain += gain;
        } else {
          slabTaxableGain += gain;
        }
      }
    }

    let baseTax = 0;
    if (taxRegime === 'EQUITY') {
      const taxableLtcg = Math.max(0, ltcgGain - EQUITY_LTCG_EXEMPTION);
      baseTax = Math.max(0, stcgGain) * EQUITY_STCG_RATE + Math.max(0, taxableLtcg) * EQUITY_LTCG_RATE;
    } else {
      const transferRate = now >= CAPITAL_GAINS_RATE_CHANGE_DATE ? NON_EQUITY_LTCG_RATE : 0.2;
      baseTax =
        Math.max(0, ltcgGain) * transferRate +
        Math.max(0, slabTaxableGain) * taxSlabRate;
      stcgGain = slabTaxableGain;
    }

    const cess = baseTax * HEALTH_EDU_CESS_RATE;
    const estimatedTax = baseTax + cess;

    return {
      taxRegime,
      redemptionAmount,
      unitsRedeemed: Math.min(selected.totalUnits, redemptionAmount / selected.currentNav),
      stcgGain,
      ltcgGain,
      baseTax,
      cess,
      estimatedTax,
      postTaxAmount: Math.max(0, redemptionAmount - estimatedTax),
    };
  }, [showTaxForecaster, taxHoldingKey, holdings, transactions, redeemPercent, taxSlabRate]);

  return (
    <div className="space-y-6">
      {selectedHolding && (
        <FundDetailsModal 
          holding={selectedHolding}
          allTransactions={transactions}
          onClose={() => setSelectedHolding(null)}
        />
      )}

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1 flex items-center">
             <Wallet size={14} className="mr-2" /> Current Value
          </div>
          <div className="text-xl font-bold text-slate-800">
            {formatINR(summary.currentValue)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1 flex items-center">
             <DollarSign size={14} className="mr-2" /> Invested Amount
          </div>
          <div className="text-xl font-bold text-slate-800">
            {formatINR(summary.totalInvested)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1 flex items-center">
             {summary.totalGain >= 0 ? <TrendingUp size={14} className="mr-2 text-green-500"/> : <TrendingDown size={14} className="mr-2 text-red-500"/>} 
             Total Gain
          </div>
          <div className={`text-xl font-bold ${summary.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {summary.totalGain >= 0 ? '+' : ''}{formatINR(summary.totalGain)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1 flex items-center">
             <Percent size={14} className="mr-2" /> Abs. Return
          </div>
          <div className={`text-xl font-bold ${summary.totalGainPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {summary.totalGainPercentage.toFixed(2)}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-between">
          <div className="text-indigo-600 text-xs font-medium uppercase tracking-wide mb-1 flex items-center">
             <Activity size={14} className="mr-2" /> XIRR
          </div>
          <div className="text-xl font-bold text-indigo-700">
            {summary.xirr.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Family View Toggle */}
      {onToggleFamilyView && (
        <div className="flex justify-between items-center">
          <div></div>
          <button
            onClick={onToggleFamilyView}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showFamilyView
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Users size={16} className="inline mr-2" />
            {showFamilyView ? 'Family View' : 'Individual View'}
          </button>
        </div>
      )}

      {/* Goals Progress Section */}
      {goals.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
              <Target size={20} className="mr-2 text-blue-600" />
              Goal Progress
            </h3>
            <span className="text-sm text-slate-500">
              {goals.filter(g => g.status === 'ON_TRACK').length} of {goals.length} on track
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.slice(0, 6).map(goal => {
              const progress = calculateGoalProgress(goal, holdings);
              const progressPercentage = Math.min(progress.progress, 100);

              return (
                <div key={goal.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-slate-800 text-sm">{goal.name}</h4>
                      <p className="text-xs text-slate-500 capitalize">{goal.category.replace('_', ' ')}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      goal.status === 'ON_TRACK' ? 'bg-green-100 text-green-700' :
                      goal.status === 'AT_RISK' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {goal.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Progress</span>
                      <span>{progress.progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Target: {formatINR(goal.targetAmount)}</span>
                      <span className="text-slate-500">
                        {new Date(goal.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    {progress.gap > 0 && (
                      <div className="text-xs text-slate-600">
                        Gap: {formatINR(progress.gap)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {goals.length > 6 && (
            <div className="text-center mt-4">
              <span className="text-sm text-slate-500">
                +{goals.length - 6} more goals
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showClientScopedInsights && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Shield size={18} className="text-blue-600" />
            Risk Meter
          </h3>
          <p className="text-xs text-slate-500 mt-1">Based on allocation mix, concentration, and portfolio behavior.</p>

          <div className="mt-4">
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold text-slate-800">{Math.round(riskInsights.score)}</div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                riskInsights.level === 'Low' ? 'bg-green-100 text-green-700' :
                riskInsights.level === 'Moderate' ? 'bg-blue-100 text-blue-700' :
                riskInsights.level === 'High' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {riskInsights.level}
              </span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  riskInsights.score < 35 ? 'bg-green-500' :
                  riskInsights.score < 60 ? 'bg-blue-500' :
                  riskInsights.score < 80 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, riskInsights.score))}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Top Holding</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">{riskInsights.concentration.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Equity Share</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">{riskInsights.equityShare.toFixed(1)}%</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {riskInsights.recommendations.slice(0, 2).map((tip, idx) => (
              <div key={idx} className="text-xs text-slate-600 bg-blue-50/70 border border-blue-100 rounded-lg p-2.5">
                {tip}
              </div>
            ))}
          </div>
        </div>
        )}

        {showTaxForecaster && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Calculator size={18} className="text-indigo-600" />
            Tax Impact Forecaster
          </h3>
          <p className="text-xs text-slate-500 mt-1">Estimate tax before redeeming. Uses FIFO lots and current capital-gains norms.</p>

          {holdings.length === 0 ? (
            <div className="mt-6 text-sm text-slate-500">No holdings available for tax forecast.</div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <select
                  value={taxHoldingKey}
                  onChange={(e) => setTaxHoldingKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
                >
                  {holdings.map((h) => {
                    const key = `${h.folioNumber}_${h.schemeCode || h.fundName}`;
                    return (
                      <option key={key} value={key}>
                        {h.fundName} ({h.folioNumber})
                      </option>
                    );
                  })}
                </select>

                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-3">
                  <div className="flex justify-between text-xs text-slate-600 mb-2">
                    <span>Redemption Size</span>
                    <span className="font-semibold">{redeemPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={redeemPercent}
                    onChange={(e) => setRedeemPercent(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-3">
                  <div className="text-xs text-slate-600 mb-2">Income tax slab for non-equity slab-taxed gains</div>
                  <div className="flex gap-2">
                    {[0.05, 0.2, 0.3].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setTaxSlabRate(rate)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          taxSlabRate === rate
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-white border-slate-300 text-slate-600'
                        }`}
                      >
                        {(rate * 100).toFixed(0)}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {taxForecast && (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5">
                    Regime: <span className="font-semibold">{taxForecast.taxRegime === 'EQUITY' ? 'Equity-Oriented (Sec 111A / 112A)' : 'Non-Equity / Debt (Sec 50AA / 112)'}</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Redeem Amount</div>
                    <div className="font-semibold text-slate-800 mt-1">{formatINR(taxForecast.redemptionAmount)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Units</div>
                    <div className="font-semibold text-slate-800 mt-1">{taxForecast.unitsRedeemed.toFixed(3)}</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <div className="text-[11px] uppercase tracking-wide text-amber-700">Est. Tax (incl. cess)</div>
                    <div className="font-semibold text-amber-800 mt-1">{formatINR(taxForecast.estimatedTax)}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <div className="text-[11px] uppercase tracking-wide text-green-700">Post-Tax Cash</div>
                    <div className="font-semibold text-green-800 mt-1">{formatINR(taxForecast.postTaxAmount)}</div>
                  </div>
                  <div className="col-span-2 text-xs text-slate-500">
                    STCG Gain: {formatINR(taxForecast.stcgGain)} | LTCG Gain: {formatINR(taxForecast.ltcgGain)}
                  </div>
                  <div className="col-span-2 text-xs text-slate-500">
                    Base Tax: {formatINR(taxForecast.baseTax)} | Cess (4%): {formatINR(taxForecast.cess)}
                  </div>
                  <div className="col-span-2 text-[11px] text-slate-400">
                    Norms used: Equity STCG 20%, Equity LTCG 12.5% above INR 1.25L; non-equity post 01-Apr-2023 lots taxed at slab; cess 4%.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold mb-6 text-slate-800">Asset Allocation</h3>
          <div className="h-64">
            {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    >
                    {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatINR(value)} />
                    <Legend />
                </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data available</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h3 className="text-lg font-semibold text-slate-800">Portfolio Growth</h3>
            <div className="flex flex-wrap gap-2">
              <div className="flex bg-slate-100 rounded-lg p-1 text-xs">
                {(['DAILY', 'MONTHLY', 'YEARLY'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrowthGranularity(g)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      growthGranularity === g ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="flex bg-slate-100 rounded-lg p-1 text-xs">
                {(['6M', '1Y', '3Y', 'ALL'] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => setGrowthWindow(w)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      growthWindow === w ? 'bg-white shadow-sm text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false} minTickGap={22} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [formatINR(value), 'Value']}
                />
                <Area type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" isAnimationActive animationDuration={450} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">Folio Holdings</h3>
              <div className="text-xs text-slate-400">
                  Click on any fund to view analysis
              </div>
          </div>
          <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
                      <tr>
                          <th className="p-4">Fund & Folio</th>
                          <th className="p-4 text-right">Units</th>
                          <th className="p-4 text-right">Avg NAV</th>
                          <th className="p-4 text-right">Invested</th>
                          <th className="p-4 text-right">Current Value</th>
                          <th className="p-4 text-right">Abs. Return</th>
                          <th className="p-4 text-right">XIRR</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                      {holdings.length === 0 ? (
                           <tr>
                             <td colSpan={7} className="p-8 text-center text-slate-400">No holdings found.</td>
                           </tr>
                      ) : (
                          holdings.map((h, i) => (
                              <tr 
                                key={i} 
                                onClick={() => setSelectedHolding(h)}
                                className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                              >
                                  <td className="p-4 font-medium text-slate-800 group-hover:text-blue-700">
                                      {h.fundName}
                                      <div className="text-xs text-slate-500 font-normal mt-0.5">{h.category}</div>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 group-hover:text-blue-400">Folio: {h.folioNumber}</div>
                                  </td>
                                  <td className="p-4 text-right text-slate-600">{h.totalUnits.toFixed(3)}</td>
                                  <td className="p-4 text-right text-slate-600">{h.averageNav.toFixed(2)}</td>
                                  <td className="p-4 text-right text-slate-800 font-medium">
                                      {formatINR(h.investedAmount)}
                                  </td>
                                  <td className="p-4 text-right text-slate-800 font-bold">
                                      {formatINR(h.currentValue)}
                                  </td>
                                  <td className={`p-4 text-right font-medium ${h.absoluteReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {h.absoluteReturnPercentage.toFixed(2)}%
                                      <div className="text-xs opacity-70">
                                          {formatINR(h.absoluteReturn)}
                                      </div>
                                  </td>
                                  <td className={`p-4 text-right font-medium ${h.xirr >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                                      {h.xirr.toFixed(2)}%
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
          <div className="md:hidden p-4 space-y-3">
              {holdings.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">No holdings found.</div>
              ) : (
                  holdings.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedHolding(h)}
                        className="w-full text-left bg-slate-50 rounded-xl p-4 border border-slate-100 active:scale-[0.99] transition"
                      >
                        <div className="font-semibold text-slate-800 text-sm">{h.fundName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{h.category}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Folio: {h.folioNumber}</div>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                          <div className="text-slate-500">Current</div>
                          <div className="text-right font-semibold text-slate-800">{formatINR(h.currentValue)}</div>
                          <div className="text-slate-500">Invested</div>
                          <div className="text-right text-slate-700">{formatINR(h.investedAmount)}</div>
                          <div className="text-slate-500">Return</div>
                          <div className={`text-right font-medium ${h.absoluteReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {h.absoluteReturnPercentage.toFixed(2)}%
                          </div>
                          <div className="text-slate-500">XIRR</div>
                          <div className={`text-right font-medium ${h.xirr >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                            {h.xirr.toFixed(2)}%
                          </div>
                        </div>
                      </button>
                  ))
              )}
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
