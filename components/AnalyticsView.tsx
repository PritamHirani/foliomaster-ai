import React, { useMemo } from 'react';
import { Holding, PortfolioSummary, Transaction, TransactionType } from '../types';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Activity, BarChart3, Wallet, TrendingUp } from 'lucide-react';

interface AnalyticsViewProps {
  holdings: Holding[];
  summary: PortfolioSummary;
  transactions: Transaction[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

const formatINR = (value: number) =>
  value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const monthKey = (date: string) => new Date(date).toISOString().slice(0, 7);

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ holdings, summary, transactions }) => {
  const monthlyFlow = useMemo(() => {
    const map: Record<string, { month: string; invested: number; redeemed: number }> = {};
    transactions.forEach((t) => {
      const key = monthKey(t.date);
      if (!map[key]) map[key] = { month: key, invested: 0, redeemed: 0 };
      if (t.type === TransactionType.BUY) map[key].invested += t.amount;
      else map[key].redeemed += t.amount;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-24);
  }, [transactions]);

  const categoryReturns = useMemo(() => {
    const map: Record<string, { name: string; value: number }> = {};
    holdings.forEach((h) => {
      if (!map[h.category]) map[h.category] = { name: h.category, value: 0 };
      map[h.category].value += h.currentValue;
    });
    return Object.values(map);
  }, [holdings]);

  const buySellSplit = useMemo(() => {
    const buys = transactions.filter(t => t.type === TransactionType.BUY).length;
    const sells = transactions.filter(t => t.type === TransactionType.SELL).length;
    return [
      { name: 'Buy', value: buys },
      { name: 'Sell', value: sells }
    ];
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs uppercase text-slate-500 mb-1 inline-flex items-center gap-1"><Wallet size={14} />Portfolio Value</div>
          <div className="text-xl font-bold text-slate-800">{formatINR(summary.currentValue)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs uppercase text-slate-500 mb-1 inline-flex items-center gap-1"><TrendingUp size={14} />Portfolio XIRR</div>
          <div className="text-xl font-bold text-indigo-700">{summary.xirr.toFixed(2)}%</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs uppercase text-slate-500 mb-1 inline-flex items-center gap-1"><BarChart3 size={14} />Active Holdings</div>
          <div className="text-xl font-bold text-slate-800">{holdings.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs uppercase text-slate-500 mb-1 inline-flex items-center gap-1"><Activity size={14} />Transactions</div>
          <div className="text-xl font-bold text-slate-800">{transactions.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Monthly Invest vs Redeem</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyFlow}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Bar dataKey="invested" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="redeemed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Category Allocation</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryReturns} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55}>
                  {categoryReturns.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Flow Trend (Net)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyFlow.map((m) => ({ ...m, net: m.invested - m.redeemed }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Area type="monotone" dataKey="net" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Buy vs Sell Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={buySellSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                  <Cell fill="#22c55e" />
                  <Cell fill="#f97316" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
