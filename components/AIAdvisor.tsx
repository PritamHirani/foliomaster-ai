import React, { useState } from 'react';
import { Holding, AdvisorResponse } from '../types';
import { analyzePortfolio } from '../services/geminiService';
import { Sparkles, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface AIAdvisorProps {
  holdings: Holding[];
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ holdings }) => {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<AdvisorResponse | null>(null);
  const hasConfiguredApiKey = Boolean(process.env.API_KEY && !String(process.env.API_KEY).includes('PLACEHOLDER'));

  const handleAnalysis = async () => {
    if (holdings.length === 0) {
      alert('Please add some transactions first.');
      return;
    }

    setLoading(true);
    try {
      const result = await analyzePortfolio(holdings);
      setAdvice(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 flex items-center">
            <Sparkles className="mr-3 text-yellow-300" />
            AI Portfolio Advisor
          </h2>
          <p className="text-indigo-100 max-w-xl mb-4 md:mb-6 text-sm md:text-base">
            Get risk assessment, diversification analysis, and practical actions for this portfolio.
          </p>

          <div className="text-xs mb-4 inline-flex items-center px-3 py-1 rounded-full bg-white/15">
            {hasConfiguredApiKey ? 'Mode: Gemini Live' : 'Mode: Smart Local Analysis (set GEMINI_API_KEY for live AI)'}
          </div>

          {!loading && (
            <button
              onClick={handleAnalysis}
              className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-md active:scale-95"
            >
              {advice ? 'Re-Analyze Portfolio' : 'Analyze My Portfolio'}
            </button>
          )}

          {loading && (
            <div className="flex items-center space-x-3 bg-white/10 w-fit px-6 py-3 rounded-xl backdrop-blur-sm">
              <Loader2 className="animate-spin" />
              <span>Analyzing portfolio...</span>
            </div>
          )}
        </div>
      </div>

      {advice && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Risk Assessment</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Based on current category allocation and concentration</p>
            </div>
            <div className="flex items-center">
              <div className="mr-4 text-right">
                <span className="block text-2xl font-bold text-slate-800 dark:text-slate-100">{advice.riskScore}/10</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Risk Score</span>
              </div>
              <div className="h-16 w-16 rounded-full border-4 border-slate-100 dark:border-slate-700 flex items-center justify-center relative">
                <div
                  className={`absolute inset-0 rounded-full border-4 opacity-50 ${advice.riskScore > 7 ? 'border-red-500' : advice.riskScore > 4 ? 'border-yellow-500' : 'border-green-500'}`}
                  style={{ clipPath: `inset(${100 - (advice.riskScore * 10)}% 0 0 0)` }}
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{advice.riskScore > 7 ? 'High' : advice.riskScore > 4 ? 'Med' : 'Low'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Portfolio Analysis</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base md:text-lg">{advice.analysis}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {advice.suggestions.map((s, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-4">
                  {i === 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                </div>
                <p className="text-slate-700 dark:text-slate-200 font-medium">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAdvisor;
