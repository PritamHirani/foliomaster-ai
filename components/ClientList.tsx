import React, { useState, useEffect } from 'react';
import { Client, Holding, PortfolioSummary, Family } from '../types';
import { getClients, getTransactions, calculateHoldings, getPortfolioSummary, getFamilies } from '../services/storageService';
import { fetchLivePrices } from '../services/amfiService';
import { Search, User, TrendingUp, ChevronRight, ChevronLeft, Loader2, AlertCircle, Users, Filter } from 'lucide-react';

interface ClientListProps {
    onSelectClient: (client: Client) => void;
    currentArnFilter: string;
}

interface ClientWithStats extends Client {
    summary: PortfolioSummary;
}

const ClientList: React.FC<ClientListProps> = ({ onSelectClient, currentArnFilter }) => {
    const [clients, setClients] = useState<ClientWithStats[]>([]);
    const [families, setFamilies] = useState<Family[]>([]);
    const [search, setSearch] = useState('');
    const [familyFilter, setFamilyFilter] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const rawClients = getClients(currentArnFilter);
                const rawFamilies = getFamilies(currentArnFilter);
                
                // 1. Get all transactions for these clients
                // We fetch all transactions to determine which schemes need price updates
                const allTxs = getTransactions();
                const clientIds = new Set(rawClients.map(c => c.id));
                const relevantTxs = allTxs.filter(t => clientIds.has(t.clientId));

                // 2. Identify unique scheme codes to fetch live prices
                // This prevents making hundreds of requests; we only fetch distinct funds.
                const uniqueSchemes = [...new Set(relevantTxs.map(t => t.schemeCode).filter(c => !!c))] as string[];
                
                let prices: Record<string, number> = {};
                if (uniqueSchemes.length > 0) {
                    // Fetch live prices (This ensures Client List matches Dashboard numbers)
                    prices = await fetchLivePrices(uniqueSchemes);
                }

                // 3. Calculate stats for each client using Live Prices
                const clientsWithStats = rawClients.map(c => {
                    const clientTxs = relevantTxs.filter(t => t.clientId === c.id);
                    const holdings = calculateHoldings(clientTxs, prices);
                    const summary = getPortfolioSummary(holdings);
                    return { ...c, summary };
                });

                setClients(clientsWithStats);
                setFamilies(rawFamilies);
            } catch (error) {
                console.error("Error loading client data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [currentArnFilter]);

    const filteredClients = clients.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                            c.pan.toLowerCase().includes(search.toLowerCase());
        
        const matchesFamily = familyFilter === 'all' || 
                            (familyFilter === 'none' && !c.familyId) || 
                            c.familyId === familyFilter;
        
        return matchesSearch && matchesFamily;
    });

    // Pagination
    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedClients = filteredClients.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const formatMoney = (val: number) => val.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <p className="text-slate-500 font-medium">Syncing live market values for all clients...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">My Clients</h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-52">
                        <Filter className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <select
                            value={familyFilter}
                            onChange={(e) => setFamilyFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none bg-white"
                        >
                            <option value="all">All Families</option>
                            <option value="none">No Family</option>
                            {families.map(family => (
                                <option key={family.id} value={family.id}>
                                    {family.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input 
                            type="text"
                            placeholder="Search by Name or PAN..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedClients.map(client => (
                    <div key={client.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-3">
                                <div className="h-10 w-10 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                    <User size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{client.name}</h3>
                                    <p className="text-xs text-slate-400">PAN: {client.pan}</p>
                                    {client.familyId && (
                                        <div className="flex items-center mt-1">
                                            <Users size={12} className="text-blue-500 mr-1" />
                                            <span className="text-xs text-blue-600 font-medium">
                                                {families.find(f => f.id === client.familyId)?.name || 'Family'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded">
                                {client.associatedArn}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <p className="text-xs text-slate-400 mb-1">Current Value</p>
                                <p className="font-bold text-slate-800">{formatMoney(client.summary.currentValue)}</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <p className="text-xs text-slate-400 mb-1">Abs. Return</p>
                                <p className={`font-bold ${client.summary.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {client.summary.totalGainPercentage.toFixed(2)}%
                                </p>
                            </div>
                        </div>

                        <button 
                            onClick={() => onSelectClient(client)}
                            className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600"
                        >
                            <span>View Portfolio</span>
                            <ChevronRight size={16} className="ml-2" />
                        </button>
                    </div>
                ))}

                {paginatedClients.length === 0 && filteredClients.length > 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400">
                        <AlertCircle size={48} className="mb-4 text-slate-200" />
                        <p>No clients found on this page. Try adjusting your search or filters.</p>
                    </div>
                )}

                {filteredClients.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400">
                        <AlertCircle size={48} className="mb-4 text-slate-200" />
                        <p>No clients found matching "{search}"</p>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
                    <div className="text-xs sm:text-sm text-slate-500">
                        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredClients.length)} to {Math.min(currentPage * itemsPerPage, filteredClients.length)} of {filteredClients.length} clients
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

export default ClientList;
