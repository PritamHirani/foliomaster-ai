import React, { useState, useEffect } from 'react';
import { FundMetrics, AMFIScheme } from '../types';
import { getFundMetrics, searchFunds } from '../services/amfiService';
import { SCHEMES } from '../services/storageService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const FundComparison: React.FC = () => {
  const [selectedFunds, setSelectedFunds] = useState<FundMetrics[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AMFIScheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadDefaultFunds();
  }, []);

  const loadDefaultFunds = async () => {
    setLoading(true);
    const defaultSchemes = SCHEMES.slice(0, 3);
    const fundMetrics = await Promise.all(
      defaultSchemes.map(async (scheme) => {
        const metrics = await getFundMetrics(scheme.code);
        return metrics;
      })
    );

    setSelectedFunds(fundMetrics.filter((m): m is FundMetrics => m !== null));
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const results = await searchFunds(searchQuery);
    setSearchResults(results);
    setLoading(false);
  };

  const addFundToComparison = async (scheme: AMFIScheme) => {
    if (selectedFunds.length >= 4) {
      alert('Maximum 4 funds can be compared at once');
      return;
    }

    if (selectedFunds.find((f) => f.schemeCode === scheme.schemeCode)) {
      alert('Fund already added to comparison');
      return;
    }

    setLoading(true);
    const metrics = await getFundMetrics(scheme.schemeCode);
    if (metrics) {
      setSelectedFunds((prev) => [...prev, metrics]);
    }
    setLoading(false);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeFund = (schemeCode: string) => {
    setSelectedFunds((prev) => prev.filter((f) => f.schemeCode !== schemeCode));
  };

  const getRiskColor = (beta: number) => {
    if (beta < 0.8) return 'text-green-600 dark:text-green-400';
    if (beta < 1.2) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getReturnColor = (returnValue: number) => {
    if (returnValue > 20) return 'text-green-600 dark:text-green-400';
    if (returnValue > 10) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const overlapData = selectedFunds.reduce<{ name: string; value: number }[]>((acc, fund) => {
    const category = SCHEMES.find(s => s.code === fund.schemeCode)?.category || 'Unknown';
    const existing = acc.find(x => x.name === category);
    if (existing) existing.value += 1;
    else acc.push({ name: category, value: 1 });
    return acc;
  }, []);
  const pieColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

  return (
    <div className="p-4 md:p-6 fund-analysis">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Fund Comparison</h2>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full sm:w-auto"
        >
          {showSearch ? 'Hide Search' : 'Add Fund'}
        </button>
      </div>

      {showSearch && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-md mb-6">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for mutual funds..."
              className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-500"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              {searchResults.map((scheme) => (
                <div
                  key={scheme.schemeCode}
                  className="flex justify-between items-center p-2 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{scheme.schemeName}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Code: {scheme.schemeCode}</p>
                  </div>
                  <button
                    onClick={() => addFundToComparison(scheme)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-slate-600 dark:text-slate-300">Loading fund data...</p>
        </div>
      )}

      {selectedFunds.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-md">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Fund Details</th>
                  {selectedFunds.map((fund) => (
                    <th key={fund.schemeCode} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                      <div className="flex justify-between items-center gap-2">
                        <span>{fund.fundManager.split(' ')[0]}</span>
                        <button onClick={() => removeFund(fund.schemeCode)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm">x</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                <tr>
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">Scheme Name</td>
                  {selectedFunds.map((fund) => <td key={fund.schemeCode} className="px-4 py-4 text-slate-900 dark:text-slate-100">{SCHEMES.find((s) => s.code === fund.schemeCode)?.name || 'Unknown'}</td>)}
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">AUM (INR Cr)</td>
                  {selectedFunds.map((fund) => <td key={fund.schemeCode} className="px-4 py-4 text-slate-900 dark:text-slate-100">{fund.aum.toLocaleString()}</td>)}
                </tr>
                <tr>
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">Expense Ratio (%)</td>
                  {selectedFunds.map((fund) => <td key={fund.schemeCode} className="px-4 py-4 text-slate-900 dark:text-slate-100">{fund.expenseRatio.toFixed(2)}</td>)}
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">1Y Return (%)</td>
                  {selectedFunds.map((fund) => <td key={fund.schemeCode} className="px-4 py-4"><span className={getReturnColor(fund.return1Y)}>{fund.return1Y.toFixed(2)}</span></td>)}
                </tr>
                <tr>
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">3Y Return (%)</td>
                  {selectedFunds.map((fund) => <td key={fund.schemeCode} className="px-4 py-4"><span className={getReturnColor(fund.return3Y)}>{fund.return3Y.toFixed(2)}</span></td>)}
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">5Y Return (%)</td>
                  {selectedFunds.map((fund) => <td key={fund.schemeCode} className="px-4 py-4"><span className={getReturnColor(fund.return5Y)}>{fund.return5Y.toFixed(2)}</span></td>)}
                </tr>
                <tr>
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">Beta</td>
                  {selectedFunds.map((fund) => <td key={fund.schemeCode} className="px-4 py-4"><span className={getRiskColor(fund.beta)}>{fund.beta.toFixed(2)}</span></td>)}
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">Alpha (%)</td>
                  {selectedFunds.map((fund) => <td key={fund.schemeCode} className="px-4 py-4"><span className={fund.alpha > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{fund.alpha > 0 ? '+' : ''}{fund.alpha.toFixed(2)}</span></td>)}
                </tr>
                <tr>
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">Risk (Std Dev %)</td>
                  {selectedFunds.map((fund) => <td key={fund.schemeCode} className="px-4 py-4"><span className={getRiskColor(fund.riskStd / 10)}>{fund.riskStd.toFixed(2)}</span></td>)}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="md:hidden grid grid-cols-1 gap-4">
            {selectedFunds.map((fund) => (
              <div key={fund.schemeCode} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{SCHEMES.find((s) => s.code === fund.schemeCode)?.name || 'Unknown'}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{fund.fundManager}</p>
                  </div>
                  <button onClick={() => removeFund(fund.schemeCode)} className="text-red-600 dark:text-red-400 text-xs">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-slate-500 dark:text-slate-400">AUM</div><div className="text-right text-slate-900 dark:text-slate-100">{fund.aum.toLocaleString()} Cr</div>
                  <div className="text-slate-500 dark:text-slate-400">Expense</div><div className="text-right text-slate-900 dark:text-slate-100">{fund.expenseRatio.toFixed(2)}%</div>
                  <div className="text-slate-500 dark:text-slate-400">1Y Return</div><div className={`text-right ${getReturnColor(fund.return1Y)}`}>{fund.return1Y.toFixed(2)}%</div>
                  <div className="text-slate-500 dark:text-slate-400">3Y Return</div><div className={`text-right ${getReturnColor(fund.return3Y)}`}>{fund.return3Y.toFixed(2)}%</div>
                  <div className="text-slate-500 dark:text-slate-400">5Y Return</div><div className={`text-right ${getReturnColor(fund.return5Y)}`}>{fund.return5Y.toFixed(2)}%</div>
                  <div className="text-slate-500 dark:text-slate-400">Beta</div><div className={`text-right ${getRiskColor(fund.beta)}`}>{fund.beta.toFixed(2)}</div>
                  <div className="text-slate-500 dark:text-slate-400">Alpha</div><div className={`text-right ${fund.alpha > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{fund.alpha > 0 ? '+' : ''}{fund.alpha.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedFunds.length > 1 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Fund Overlap by Category</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Shows how many selected funds belong to similar categories.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={overlapData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={105} innerRadius={55} label>
                  {overlapData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} fund(s)`, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {selectedFunds.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-300">No funds selected for comparison. Add funds to get started!</p>
        </div>
      )}

      <div className="mt-6 bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-700 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">Understanding the Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-slate-300">
          <div>
            <p><strong>Beta:</strong> Measures volatility relative to market. &lt; 1.0 = less volatile, &gt; 1.0 = more volatile</p>
            <p><strong>Alpha:</strong> Excess return over benchmark. Positive alpha means fund outperformed.</p>
          </div>
          <div>
            <p><strong>Expense Ratio:</strong> Annual fee as % of assets. Lower is better for investors.</p>
            <p><strong>AUM:</strong> Assets Under Management. Larger AUM often means more stability.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundComparison;
