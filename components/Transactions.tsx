import React, { useState } from 'react';
import { Transaction, TransactionType, AMFIScheme, UserRole, TransactionNature } from '../types';
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle, Search, UploadCloud, User, Repeat, ArrowRightLeft, Percent, Filter, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { saveTransaction, deleteTransaction } from '../services/storageService';
import { searchFunds } from '../services/amfiService';
import FileImporter from './FileImporter';
import { exportToCSV } from '../utils/financeUtils';

interface TransactionsProps {
  transactions: Transaction[];
  onUpdate: () => void;
  role: UserRole;
  currentClientId?: string;
  currentArn?: string;
}

const Transactions: React.FC<TransactionsProps> = ({ transactions, onUpdate, role, currentClientId, currentArn }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  
  // --- ADD FORM STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AMFIScheme[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fundName, setFundName] = useState('');
  const [schemeCode, setSchemeCode] = useState('');
  const [category, setCategory] = useState('Large Cap');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [nav, setNav] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.BUY);
  const [nature, setNature] = useState<TransactionNature>(TransactionNature.LUMPSUM);
  const [folioNumber, setFolioNumber] = useState('');

  // --- FILTER STATES ---
  const [filterFund, setFilterFund] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const handleSearch = async (query: string) => {
      setSearchQuery(query);
      if (query.length > 2) {
          setIsSearching(true);
          const results = await searchFunds(query);
          setSearchResults(results);
          setIsSearching(false);
      } else {
          setSearchResults([]);
      }
  };

  const selectFund = (scheme: AMFIScheme) => {
      setFundName(scheme.schemeName);
      setSchemeCode(scheme.schemeCode);
      setSearchQuery('');
      setSearchResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const navVal = parseFloat(nav);
    const amountVal = parseFloat(amount);
    
    if (!fundName || isNaN(navVal) || isNaN(amountVal)) return;
    
    const targetClientId = currentClientId || 'c1'; 
    const targetArn = currentArn || 'ARN-0001';

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      fundName,
      schemeCode,
      category,
      date,
      nav: navVal,
      amount: amountVal,
      units: amountVal / navVal,
      type,
      nature,
      clientId: targetClientId,
      arn: targetArn,
      folioNumber: folioNumber || `NEW/${schemeCode || 'NA'}`
    };

    saveTransaction(newTx);
    onUpdate();
    setIsAdding(false);
    // Reset form
    setFundName('');
    setSchemeCode('');
    setNav('');
    setAmount('');
    setFolioNumber('');
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Are you sure you want to delete this transaction?")) {
        deleteTransaction(id);
        onUpdate();
      }
  }

  const handleExportCSV = () => {
    const exportData = sortedTransactions.map(t => ({
      Date: t.date,
      Client: role === 'DISTRIBUTOR' && !currentClientId ? t.clientId : '',
      ARN: t.arn,
      Fund: t.fundName,
      Folio: t.folioNumber,
      Type: t.type,
      Nature: t.nature,
      Amount: t.amount,
      NAV: t.nav,
      Units: t.units
    }));

    const headers = role === 'DISTRIBUTOR' && !currentClientId 
      ? ['Date', 'Client', 'ARN', 'Fund', 'Folio', 'Type', 'Nature', 'Amount', 'NAV', 'Units']
      : ['Date', 'Fund', 'Folio', 'Type', 'Nature', 'Amount', 'NAV', 'Units'];

    const filename = `transactions_${new Date().toISOString().split('T')[0]}`;
    exportToCSV(exportData, filename, headers);
  }

  const getNatureIcon = (n: TransactionNature) => {
      switch(n) {
          case TransactionNature.SIP: return <Repeat size={12} className="mr-1 text-blue-500" />;
          case TransactionNature.SWP: return <ArrowDownCircle size={12} className="mr-1 text-orange-500" />;
          case TransactionNature.STP_IN: 
          case TransactionNature.STP_OUT: return <ArrowRightLeft size={12} className="mr-1 text-purple-500" />;
          case TransactionNature.SWITCH_IN:
          case TransactionNature.SWITCH_OUT: return <ArrowRightLeft size={12} className="mr-1 text-indigo-500" />;
          case TransactionNature.DIVIDEND_REINVEST: return <Percent size={12} className="mr-1 text-green-500" />;
          default: return null;
      }
  }

  const clearFilters = () => {
      setFilterFund('');
      setFilterType('ALL');
      setFilterDateFrom('');
      setFilterDateTo('');
  }

  const canAdd = role === 'CLIENT' || (role === 'DISTRIBUTOR' && currentClientId);

  // --- FILTERING LOGIC ---
  const filteredTransactions = transactions.filter(t => {
      const matchFund = t.fundName.toLowerCase().includes(filterFund.toLowerCase()) || 
                        t.folioNumber?.toLowerCase().includes(filterFund.toLowerCase());
      
      const matchType = filterType === 'ALL' || t.type === filterType;
      
      let matchDate = true;
      if (filterDateFrom) {
          matchDate = matchDate && new Date(t.date) >= new Date(filterDateFrom);
      }
      if (filterDateTo) {
          matchDate = matchDate && new Date(t.date) <= new Date(filterDateTo);
      }

      return matchFund && matchType && matchDate;
  });

  const sortedTransactions = filteredTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const paginatedTransactions = sortedTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterFund, filterType, filterDateFrom, filterDateTo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
        <h2 className="text-2xl font-bold text-slate-800">Transactions</h2>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
            <button
            onClick={handleExportCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-green-500/20"
            >
            <Download size={18} />
            <span>Export CSV</span>
            </button>
            <button
            onClick={() => setShowImporter(true)}
            className="bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:text-blue-600 px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-sm"
            >
            <UploadCloud size={18} />
            <span>Import CSV</span>
            </button>
            {canAdd && (
                <button
                onClick={() => setIsAdding(!isAdding)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-blue-500/20"
                >
                <Plus size={18} />
                <span>Add Transaction</span>
                </button>
            )}
        </div>
      </div>

      {showImporter && (
          <FileImporter 
            onClose={() => setShowImporter(false)}
            onImportComplete={() => {
                setShowImporter(false);
                onUpdate();
            }}
          />
      )}

      {/* --- ADD TRANSACTION FORM --- */}
      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">New Transaction</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div className="md:col-span-2 relative">
              <label className="block text-xs font-medium text-slate-500 mb-1">Search & Select Fund</label>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={fundName || searchQuery}
                    onChange={(e) => {
                        setFundName('');
                        handleSearch(e.target.value);
                    }}
                    className="w-full border border-slate-200 pl-10 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Type to search (e.g. Parag Parikh)..."
                    required
                  />
                  {searchResults.length > 0 && !fundName && (
                      <div className="absolute z-10 w-full bg-white mt-1 border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                          {searchResults.map(s => (
                              <div 
                                key={s.schemeCode}
                                onClick={() => selectFund(s)}
                                className="p-3 text-sm hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
                              >
                                  <div className="font-medium text-slate-700">{s.schemeName}</div>
                                  <div className="text-xs text-slate-400">Code: {s.schemeCode}</div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none"
              >
                <option>Large Cap</option>
                <option>Mid Cap</option>
                <option>Small Cap</option>
                <option>Debt</option>
                <option>Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select
                value={nature}
                onChange={(e) => {
                    setNature(e.target.value as TransactionNature);
                    if (e.target.value.includes('SWP') || e.target.value.includes('SELL') || e.target.value.includes('OUT')) {
                        setType(TransactionType.SELL);
                    } else {
                        setType(TransactionType.BUY);
                    }
                }}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none"
              >
                <option value={TransactionNature.LUMPSUM}>Lumpsum Invest</option>
                <option value={TransactionNature.SIP}>SIP Installment</option>
                <option value={TransactionNature.LUMPSUM}>Redemption</option>
                <option value={TransactionNature.SWP}>SWP Withdrawal</option>
                <option value={TransactionNature.SWITCH_OUT}>Switch Out</option>
                <option value={TransactionNature.SWITCH_IN}>Switch In</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Folio Number</label>
              <input
                type="text"
                value={folioNumber}
                onChange={(e) => setFolioNumber(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none"
                placeholder="Optional (Auto-generated if empty)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">NAV</label>
              <input
                type="number"
                step="0.0001"
                value={nav}
                onChange={(e) => setNav(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none"
                placeholder="0.00"
                required
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end space-x-3 mt-2">
                <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                    Save Transaction
                </button>
            </div>
          </form>
        </div>
      )}

      {/* --- FILTER BAR --- */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Filter by Fund / Folio</label>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    value={filterFund}
                    onChange={(e) => setFilterFund(e.target.value)}
                    placeholder="Fund Name or Folio..."
                    className="w-full border border-slate-200 pl-10 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                  />
              </div>
          </div>
          
          <div className="w-full md:w-40">
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
              >
                  <option value="ALL">All Types</option>
                  <option value="BUY">Investments</option>
                  <option value="SELL">Redemptions</option>
              </select>
          </div>

          <div className="w-full md:w-auto">
              <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
              <input 
                type="date" 
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
              />
          </div>

          <div className="w-full md:w-auto">
              <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
              <input 
                type="date" 
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
              />
          </div>

          <button 
            onClick={clearFilters}
            className="px-3 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center md:justify-start"
            title="Clear Filters"
          >
              <X size={18} />
          </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                {role === 'DISTRIBUTOR' && !currentClientId && (
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                )}
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fund & Folio</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">NAV</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Units</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedTransactions.length === 0 ? (
                  <tr>
                      <td colSpan={role === 'DISTRIBUTOR' && !currentClientId ? 8 : 7} className="p-8 text-center text-slate-400 text-sm">
                          {sortedTransactions.length === 0 ? "No transactions found." : "No matching transactions found."}
                      </td>
                  </tr>
              ) : (
                  paginatedTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-sm text-slate-600 whitespace-nowrap">{t.date}</td>
                      {role === 'DISTRIBUTOR' && !currentClientId && (
                          <td className="p-4 text-sm font-medium text-slate-800">
                              <div className="flex items-center">
                                  <User size={14} className="mr-2 text-slate-400" />
                                  {t.clientId}
                              </div>
                              <div className="text-[10px] text-slate-400">{t.arn}</div>
                          </td>
                      )}
                      <td className="p-4 text-sm font-medium text-slate-800">
                          <div className="truncate max-w-[200px]">{t.fundName}</div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                             <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Folio: {t.folioNumber}</span>
                          </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col items-start space-y-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            t.type === TransactionType.BUY 
                                ? 'bg-green-50 text-green-700' 
                                : 'bg-red-50 text-red-700'
                            }`}>
                            {t.type === TransactionType.BUY ? <ArrowDownCircle size={12} className="mr-1"/> : <ArrowUpCircle size={12} className="mr-1"/>}
                            {t.type}
                            </span>
                            {t.nature && t.nature !== TransactionNature.LUMPSUM && (
                                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center">
                                    {getNatureIcon(t.nature)}
                                    {t.nature.replace('_', ' ')}
                                </span>
                            )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-right font-medium text-slate-700">
                          {t.amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}
                      </td>
                      <td className="p-4 text-sm text-right text-slate-600">{t.nav.toFixed(4)}</td>
                      <td className="p-4 text-sm text-right text-slate-600">{t.units.toFixed(4)}</td>
                      <td className="p-4 text-center">
                          <button 
                            onClick={() => handleDelete(t.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          >
                              <Trash2 size={16} />
                          </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden p-3 space-y-3">
          {paginatedTransactions.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              {sortedTransactions.length === 0 ? "No transactions found." : "No matching transactions found."}
            </div>
          ) : (
            paginatedTransactions.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{t.fundName}</div>
                    <div className="text-[11px] text-slate-500">{t.date}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Folio: {t.folioNumber}</div>
                  </div>
                  <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-xs">
                  <div className="text-slate-500">Type</div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      t.type === TransactionType.BUY ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {t.type}
                    </span>
                  </div>
                  <div className="text-slate-500">Amount</div>
                  <div className="text-right font-medium text-slate-700">
                    {t.amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}
                  </div>
                  <div className="text-slate-500">NAV</div>
                  <div className="text-right text-slate-700">{t.nav.toFixed(4)}</div>
                  <div className="text-slate-500">Units</div>
                  <div className="text-right text-slate-700">{t.units.toFixed(4)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
          <div className="text-xs sm:text-sm text-slate-500">
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, sortedTransactions.length)} to {Math.min(currentPage * itemsPerPage, sortedTransactions.length)} of {sortedTransactions.length} transactions
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-2 sm:px-3 py-2 rounded-lg border transition-colors text-sm ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
