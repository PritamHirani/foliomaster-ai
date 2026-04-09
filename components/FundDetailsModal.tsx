import React, { useMemo, useState } from 'react';
import { Holding, Transaction, TransactionType, TransactionNature } from '../types';
import { X, TrendingUp, Calendar, ArrowUpCircle, ArrowDownCircle, Repeat, ArrowRightLeft, Percent, Hash, RotateCcw } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts';

interface FundDetailsModalProps {
  holding: Holding;
  allTransactions: Transaction[];
  onClose: () => void;
}

const FundDetailsModal: React.FC<FundDetailsModalProps> = ({ holding, allTransactions, onClose }) => {
  const [selectedRange, setSelectedRange] = useState<{ start: string, end: string } | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);

  // Filter transactions for this specific holding
  const fundTransactions = useMemo(() => {
    return allTransactions
      .filter(t => 
        (t.folioNumber === holding.folioNumber) && 
        (t.schemeCode === holding.schemeCode || t.fundName === holding.fundName)
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allTransactions, holding]);

  // Prepare Chart Data (NAV History based on transactions + Current NAV)
  const chartData = useMemo(() => {
    const data = fundTransactions.map(t => ({
      date: t.date,
      nav: t.nav,
      type: t.type,
      amount: t.amount,
      nature: t.nature,
      tooltipLabel: `Tx NAV: ₹${t.nav.toFixed(2)}`
    }));

    // Add current point
    data.push({
      date: 'Today',
      nav: holding.currentNav,
      type: 'CURRENT' as any,
      amount: 0,
      nature: 'LUMPSUM' as any,
      tooltipLabel: `Current NAV: ₹${holding.currentNav.toFixed(2)}`
    });

    return data;
  }, [fundTransactions, holding]);

  const displayedData = useMemo(() => {
      if (!selectedRange) return chartData;
      const startIndex = chartData.findIndex(d => d.date === selectedRange.start);
      const endIndex = chartData.findIndex(d => d.date === selectedRange.end);
      
      if (startIndex === -1 || endIndex === -1) return chartData;
      
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);
      
      return chartData.slice(start, end + 1);
  }, [chartData, selectedRange]);

  const zoomStats = useMemo(() => {
      if (!selectedRange) return null;
      
      // We need accurate start/end based on selection order
      // But displayedData handles slicing correctly. We need stats from the slice edges.
      // Or look up from chartData using selectedRange keys.
      
      const startItem = chartData.find(d => d.date === selectedRange.start);
      const endItem = chartData.find(d => d.date === selectedRange.end);
      
      if (!startItem || !endItem) return null;

      // Ensure chronological order for math
      const startIndex = chartData.findIndex(d => d.date === selectedRange.start);
      const endIndex = chartData.findIndex(d => d.date === selectedRange.end);
      
      const first = startIndex < endIndex ? startItem : endItem;
      const last = startIndex < endIndex ? endItem : startItem;

      const growth = ((last.nav - first.nav) / first.nav) * 100;
      return {
          growth,
          startNav: first.nav,
          endNav: last.nav,
          days: Math.abs(endIndex - startIndex) // Approximation if dates are dense, otherwise rough metric
      };
  }, [selectedRange, chartData]);

  const handleZoom = () => {
      if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
          setSelectedRange({ start: refAreaLeft, end: refAreaRight });
      }
      setRefAreaLeft(null);
      setRefAreaRight(null);
  };

  const handleResetZoom = () => {
      setSelectedRange(null);
      setRefAreaLeft(null);
      setRefAreaRight(null);
  }

  const formatINR = (val: number) => val.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  const getNatureIcon = (n: TransactionNature) => {
    switch(n) {
        case TransactionNature.SIP: return <Repeat size={14} className="text-blue-500" />;
        case TransactionNature.SWP: return <ArrowDownCircle size={14} className="text-orange-500" />;
        case TransactionNature.STP_IN: 
        case TransactionNature.STP_OUT: 
        case TransactionNature.SWITCH_IN:
        case TransactionNature.SWITCH_OUT: return <ArrowRightLeft size={14} className="text-purple-500" />;
        case TransactionNature.DIVIDEND_REINVEST: return <Percent size={14} className="text-green-500" />;
        default: return <Hash size={14} className="text-slate-400" />;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2 mb-1">
                <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                    {holding.category}
                </span>
                <span className="text-slate-400 text-xs font-mono">Folio: {holding.folioNumber}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 leading-tight">{holding.fundName}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-8">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Current Value</p>
                    <p className="text-lg font-bold text-slate-800">{formatINR(holding.currentValue)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Invested Amount</p>
                    <p className="text-lg font-bold text-slate-800">{formatINR(holding.investedAmount)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Total Returns</p>
                    <p className={`text-lg font-bold flex items-center ${holding.absoluteReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {holding.absoluteReturn >= 0 ? '+' : ''}{formatINR(holding.absoluteReturn)}
                    </p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-xs text-indigo-500 mb-1">XIRR</p>
                    <p className="text-lg font-bold text-indigo-700">{holding.xirr.toFixed(2)}%</p>
                </div>
            </div>

            {/* Chart Section */}
            <div className="h-80 w-full bg-white rounded-2xl border border-slate-100 p-4 shadow-sm relative group">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-sm font-semibold text-slate-700 flex items-center">
                        <TrendingUp size={16} className="mr-2 text-blue-500"/>
                        NAV Performance Trend
                        <span className="ml-2 text-[10px] font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            Drag to zoom & measure
                        </span>
                    </h3>
                    {selectedRange && (
                        <button 
                            onClick={handleResetZoom}
                            className="flex items-center text-xs font-medium text-slate-500 hover:text-blue-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                        >
                            <RotateCcw size={12} className="mr-1.5" /> Reset View
                        </button>
                    )}
                </div>

                {/* Zoom Stats Overlay */}
                {zoomStats && (
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 text-white px-4 py-2 rounded-xl backdrop-blur-sm shadow-xl flex items-center space-x-4 text-xs animate-in fade-in zoom-in-95">
                         <div>
                             <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Growth</span>
                             <span className={`text-base font-bold ${zoomStats.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                 {zoomStats.growth > 0 ? '+' : ''}{zoomStats.growth.toFixed(2)}%
                             </span>
                         </div>
                         <div className="w-px h-6 bg-white/20"></div>
                         <div>
                             <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Range NAV</span>
                             <span className="font-medium">₹{zoomStats.startNav.toFixed(1)} <span className="text-slate-500 mx-1">→</span> ₹{zoomStats.endNav.toFixed(1)}</span>
                         </div>
                    </div>
                )}
                
                <div className="h-64 w-full select-none">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                            data={displayedData} 
                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                            onMouseDown={(e) => e && e.activeLabel && setRefAreaLeft(String(e.activeLabel))}
                            onMouseMove={(e) => refAreaLeft && e && e.activeLabel && setRefAreaRight(String(e.activeLabel))}
                            onMouseUp={handleZoom}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="date" 
                                tick={{fontSize: 10, fill: '#94a3b8'}} 
                                axisLine={false} 
                                tickLine={false}
                                minTickGap={30}
                            />
                            <YAxis 
                                domain={['auto', 'auto']} 
                                tick={{fontSize: 10, fill: '#94a3b8'}} 
                                axisLine={false} 
                                tickLine={false}
                                tickFormatter={(val) => `₹${val}`}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="nav" 
                                stroke="#3b82f6" 
                                strokeWidth={3} 
                                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6 }}
                                animationDuration={300}
                            />
                            {refAreaLeft && refAreaRight && (
                                <ReferenceArea 
                                    x1={refAreaLeft} 
                                    x2={refAreaRight} 
                                    strokeOpacity={0.3} 
                                    fill="#3b82f6" 
                                    fillOpacity={0.1} 
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Transaction Timeline */}
            <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center">
                    <Calendar size={16} className="mr-2 text-blue-500"/>
                    Transaction History
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Type</th>
                                <th className="p-3 text-right">NAV</th>
                                <th className="p-3 text-right">Units</th>
                                <th className="p-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {fundTransactions.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 text-slate-600 font-medium">{t.date}</td>
                                    <td className="p-3">
                                        <div className="flex items-center">
                                            <div className="mr-2 p-1 bg-slate-100 rounded-md">
                                                {getNatureIcon(t.nature)}
                                            </div>
                                            <div>
                                                <div className={`text-xs font-bold ${t.type === TransactionType.BUY ? 'text-green-600' : 'text-red-600'}`}>
                                                    {t.type}
                                                </div>
                                                <div className="text-[10px] text-slate-400 uppercase">{t.nature.replace('_', ' ')}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3 text-right text-slate-600">₹{t.nav.toFixed(4)}</td>
                                    <td className="p-3 text-right text-slate-600">{t.units.toFixed(3)}</td>
                                    <td className="p-3 text-right font-medium text-slate-800">
                                        {formatINR(t.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default FundDetailsModal;