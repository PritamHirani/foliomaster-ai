import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import { getTransactions, calculateHoldings, getPortfolioSummary, getClients, deleteAllData, getGoals } from './services/storageService';
import { fetchLivePrices } from './services/amfiService';
import { dismissAlert, generatePortfolioAlerts, markAlertAsRead, markAllAlertsRead } from './services/alertsService';
import { Transaction, Holding, PortfolioSummary, UserRole, Client, Goal, PortfolioAlert, TransactionType, TransactionNature } from './types';
import { RefreshCw, Loader2, Filter, ArrowLeft, Menu, Bell } from 'lucide-react';
import NotificationPanel from './components/NotificationPanel';

// Lazy load components for better performance
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const Transactions = React.lazy(() => import('./components/Transactions'));
const AIAdvisor = React.lazy(() => import('./components/AIAdvisor'));
const ClientList = React.lazy(() => import('./components/ClientList'));
const GoalManagement = React.lazy(() => import('./components/GoalManagement'));
const FundComparison = React.lazy(() => import('./components/FundComparison'));
const FamilyGrouping = React.lazy(() => import('./components/FamilyGrouping'));
const AnalyticsView = React.lazy(() => import('./components/AnalyticsView'));

const ARNS = ['ARN-0001', 'ARN-0002'];

const App: React.FC = () => {
  // --- Global State ---
  const [role, setRole] = useState<UserRole>('DISTRIBUTOR');
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Distributor Specific State
  const [selectedArn, setSelectedArn] = useState<string>('ARN-0001');
  
  // Drill-down State (Distributor viewing a client, or Client viewing themselves)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientOptions, setClientOptions] = useState<Client[]>([]);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalInvested: 0,
    currentValue: 0,
    totalGain: 0,
    totalGainPercentage: 0,
    xirr: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [alerts, setAlerts] = useState<PortfolioAlert[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  
  // Version key to force re-render of components that fetch their own data
  const [dataVersion, setDataVersion] = useState(0);

  // --- Auth Simulation ---
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initial Load & Effect on Filters Change
  useEffect(() => {
    refreshData(true);
  }, [role, selectedArn, selectedClient]);

  useEffect(() => {
    const allClients = getClients();
    setClientOptions(allClients);
  }, [showRoleSwitcher]);

  useEffect(() => {
    const generatedAlerts = generatePortfolioAlerts({
      holdings,
      summary,
      goals,
      transactions,
      selectedClientId: selectedClient?.id,
    });
    setAlerts(generatedAlerts);
  }, [holdings, summary, goals, transactions, selectedClient?.id]);

  useEffect(() => {
    if (!isNotificationOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNotificationOpen]);

  // Keyboard Shortcuts Effect
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        return;
      }

      // Ctrl/Cmd + R: Refresh data
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        refreshData(true);
        return;
      }

      // Ctrl/Cmd + D: Toggle dark mode
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        toggleDarkMode();
        return;
      }

      // Alt + number keys for navigation (1-8)
      if (event.altKey && event.key >= '1' && event.key <= '8') {
        event.preventDefault();
        const menuItems = [
          'dashboard', 'clients', 'transactions', 'goals', 
          'fund-comparison', 'families', 'analytics', 'advisor'
        ];
        const index = parseInt(event.key) - 1;
        if (index < menuItems.length) {
          const item = menuItems[index];
          // Check if the menu item is available for current role
          const availableItems = [
            { id: 'dashboard', roles: ['DISTRIBUTOR', 'CLIENT'] },
            { id: 'clients', roles: ['DISTRIBUTOR'] },
            { id: 'transactions', roles: ['DISTRIBUTOR', 'CLIENT'] },
            { id: 'goals', roles: ['DISTRIBUTOR', 'CLIENT'] },
            { id: 'fund-comparison', roles: ['DISTRIBUTOR', 'CLIENT'] },
            { id: 'families', roles: ['DISTRIBUTOR'] },
            { id: 'analytics', roles: ['DISTRIBUTOR', 'CLIENT'] },
            { id: 'advisor', roles: ['CLIENT'] },
          ];
          if (availableItems[index].roles.includes(role)) {
            setCurrentView(item);
          }
        }
        return;
      }

      // Escape: Go back to dashboard (if not already there)
      if (event.key === 'Escape' && currentView !== 'dashboard') {
        event.preventDefault();
        setCurrentView('dashboard');
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [role, currentView]);

  // Dark Mode Effect
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    document.documentElement.classList.toggle('dark', isDarkMode);

    // Favicon symbol follows current theme (dark/light), with graceful fallback.
    const preferredPng = isDarkMode
      ? '/branding/logo-symbol-dark.png'
      : '/branding/logo-symbol-light.png';
    const secondaryPng = isDarkMode
      ? '/branding/logo-symbol-light.png'
      : '/branding/logo-symbol-dark.png';
    const fallbackSvg = isDarkMode
      ? '/branding/logo-symbol-dark.svg'
      : '/branding/logo-symbol-light.svg';
    const secondarySvg = isDarkMode
      ? '/branding/logo-symbol-light.svg'
      : '/branding/logo-symbol-dark.svg';
    const defaultFallback = '/logo.svg';

    const setFavicon = (href: string) => {
      let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.type = 'image/svg+xml';
        document.head.appendChild(favicon);
      }
      favicon.href = href;
    };

    const tryImage = (src: string, onSuccess: () => void, onError: () => void) => {
      const probe = new Image();
      probe.onload = onSuccess;
      probe.onerror = onError;
      probe.src = src;
    };

    tryImage(
      preferredPng,
      () => setFavicon(preferredPng),
      () =>
        tryImage(
          secondaryPng,
          () => setFavicon(secondaryPng),
          () =>
            tryImage(
              fallbackSvg,
              () => setFavicon(fallbackSvg),
              () =>
                tryImage(
                  secondarySvg,
                  () => setFavicon(secondarySvg),
                  () => setFavicon(defaultFallback)
                )
            )
        )
    );
  }, [isDarkMode]);

  const refreshData = async (shouldFetchPrices = false) => {
    // Determine filters based on current context
    const filters: { clientId?: string, arn?: string } = {};

    if (role === 'CLIENT' && selectedClient) {
        filters.clientId = selectedClient.id;
    } else if (role === 'DISTRIBUTOR') {
        // If viewing specific client
        if (selectedClient) {
            filters.clientId = selectedClient.id;
        } else {
            // Aggregate view for ARN
            filters.arn = selectedArn;
        }
    }

    const txs = getTransactions(filters);
    setTransactions(txs);
    
    // Load goals for the current context
    const goalsData = getGoals(selectedClient?.id);
    setGoals(goalsData);
    
    // First, calculate with stored values to show immediate UI
    let currentHoldings = calculateHoldings(txs);
    setHoldings(currentHoldings);
    setSummary(getPortfolioSummary(currentHoldings));
    
    // Increment version to notify children
    setDataVersion(v => v + 1);

    if (shouldFetchPrices) {
        setIsRefreshing(true);
        try {
            const schemeCodes = [...new Set(txs.map(t => t.schemeCode).filter(c => !!c))] as string[];
            if (schemeCodes.length > 0) {
                const livePrices = await fetchLivePrices(schemeCodes);
                currentHoldings = calculateHoldings(txs, livePrices);
                setHoldings(currentHoldings);
                setSummary(getPortfolioSummary(currentHoldings));
                setLastUpdated(new Date());
            }
        } catch (e) {
            console.error("Failed to fetch live prices", e);
        } finally {
            setIsRefreshing(false);
        }
    }
  };

  const handleClientSelect = (client: Client) => {
      setSelectedClient(client);
      setCurrentView('dashboard'); // Switch to dashboard view for that client
  };

  const handleBackToAggregate = () => {
      setSelectedClient(null);
      setCurrentView('clients');
  };

  const handleRoleSelect = (newRole: UserRole) => {
      setRole(newRole);
      setShowRoleSwitcher(false);
      setIsSidebarOpen(false);
      
      if (newRole === 'DISTRIBUTOR') {
          setSelectedClient(null);
          setCurrentView('dashboard');
      } else {
          const allClients = getClients();
          setClientOptions(allClients);
          if (allClients.length > 0) setSelectedClient(allClients[0]);
          setCurrentView('dashboard');
      }
  };

  const handleResetData = async () => {
      const shouldGenerateSample = window.confirm("Reset all data? You can choose to generate sample data after reset.");
      if (!shouldGenerateSample) return;

      const generateSample = window.confirm("Generate sample data after reset? This will create demo clients, transactions, and goals.");
      
      deleteAllData();
      setSelectedClient(null);
      
      if (generateSample) {
          // Generate sample data
          await generateSampleData();
      }
      
      refreshData(false);
      alert(generateSample ? "Data reset complete. Sample data has been generated." : "All data has been cleared.");
  }

  const generateSampleData = async () => {
      const arns = ['ARN-0001', 'ARN-0002', 'ARN-0003'];
      const firstNames = ['Rahul', 'Priya', 'Amit', 'Neha', 'Vikram', 'Anita', 'Rohan', 'Kavya', 'Arjun', 'Meera', 'Karan', 'Isha'];
      const surnames = ['Sharma', 'Patel', 'Singh', 'Verma', 'Gupta', 'Reddy', 'Iyer', 'Kumar', 'Das', 'Malhotra'];
      const categories: Goal['category'][] = ['EDUCATION', 'RETIREMENT', 'HOME', 'CHILD_MARRIAGE', 'VACATION', 'OTHER'];

      const sampleClients: Client[] = [];
      const sampleTransactions: Transaction[] = [];
      const sampleGoals: Goal[] = [];

      const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
      const toDateStr = (date: Date) => date.toISOString().split('T')[0];

      let nameSeed = 0;
      for (const arn of arns) {
          for (let i = 0; i < 10; i++) {
              const first = firstNames[nameSeed % firstNames.length];
              const last = surnames[(nameSeed + i) % surnames.length];
              const clientId = `c_${arn}_${i}`;
              const pan = `${String.fromCharCode(65 + (nameSeed % 26))}BCDE${1000 + nameSeed}${String.fromCharCode(70 + (i % 10))}`;

              sampleClients.push({
                  id: clientId,
                  name: `${first} ${last}`,
                  pan,
                  associatedArn: arn,
              });
              nameSeed++;
          }
      }

      const familyGroups = [
          { id: 'fam_1', arnFilter: 'ARN-0001', clientIds: sampleClients.filter(c => c.associatedArn === 'ARN-0001').slice(0, 4).map(c => c.id), name: 'Sharma Family Group' },
          { id: 'fam_2', arnFilter: 'ARN-0002', clientIds: sampleClients.filter(c => c.associatedArn === 'ARN-0002').slice(0, 4).map(c => c.id), name: 'Patel Family Group' },
          { id: 'fam_3', arnFilter: 'ARN-0003', clientIds: sampleClients.filter(c => c.associatedArn === 'ARN-0003').slice(0, 4).map(c => c.id), name: 'Singh Family Group' },
      ];

      const { addClient, addFamily, addGoal, saveTransaction, SCHEMES } = await import('./services/storageService');

      for (const client of sampleClients) {
          const profile = Math.random() > 0.7 ? 'AGGRESSIVE' : Math.random() > 0.4 ? 'BALANCED' : 'CONSERVATIVE';
          const schemeCount = profile === 'AGGRESSIVE' ? 7 : profile === 'BALANCED' ? 6 : 5;
          const chosenSchemes = [...SCHEMES].sort(() => Math.random() - 0.5).slice(0, schemeCount);

          for (let s = 0; s < chosenSchemes.length; s++) {
              const scheme = chosenSchemes[s];
              const folioNumber = `${client.id.toUpperCase()}/${scheme.code}/F${s + 1}`;
              let currentDate = new Date('2020-01-01');
              const today = new Date();
              let nav = scheme.baseNav * randomBetween(0.9, 1.1);
              let unitsHeld = 0;
              let sipAmount = profile === 'AGGRESSIVE' ? 5000 : profile === 'BALANCED' ? 3000 : 2000;

              while (currentDate <= today) {
                  const year = currentDate.getFullYear();
                  const month = currentDate.getMonth();

                  let annualDrift = 1.012;
                  if (year === 2020) annualDrift = 1.004;
                  if (year === 2021) annualDrift = 1.018;
                  if (year === 2022) annualDrift = 0.995;
                  if (year >= 2023) annualDrift = 1.011;

                  const volatility = randomBetween(-0.035, 0.04);
                  nav = Math.max(1, nav * annualDrift * (1 + volatility));

                  const skipSip = Math.random() < 0.06;
                  if (!skipSip) {
                      const amount = Math.round(sipAmount);
                      const units = amount / nav;
                      unitsHeld += units;
                      sampleTransactions.push({
                          id: crypto.randomUUID(),
                          schemeCode: scheme.code,
                          fundName: scheme.name,
                          category: scheme.category,
                          date: toDateStr(currentDate),
                          nav,
                          amount,
                          units,
                          type: TransactionType.BUY,
                          nature: TransactionNature.SIP,
                          clientId: client.id,
                          arn: client.associatedArn,
                          folioNumber,
                      });
                  }

                  if ((month === 2 || month === 11) && Math.random() < 0.28) {
                      const amount = Math.round(randomBetween(20000, 120000));
                      const units = amount / nav;
                      unitsHeld += units;
                      sampleTransactions.push({
                          id: crypto.randomUUID(),
                          schemeCode: scheme.code,
                          fundName: scheme.name,
                          category: scheme.category,
                          date: toDateStr(currentDate),
                          nav,
                          amount,
                          units,
                          type: TransactionType.BUY,
                          nature: TransactionNature.LUMPSUM,
                          clientId: client.id,
                          arn: client.associatedArn,
                          folioNumber,
                      });
                  }

                  if (year >= 2023 && unitsHeld > 50 && Math.random() < 0.08) {
                      const sellUnits = Math.min(unitsHeld * randomBetween(0.03, 0.12), unitsHeld - 1);
                      if (sellUnits > 0) {
                          const amount = sellUnits * nav;
                          unitsHeld -= sellUnits;
                          sampleTransactions.push({
                              id: crypto.randomUUID(),
                              schemeCode: scheme.code,
                              fundName: scheme.name,
                              category: scheme.category,
                              date: toDateStr(currentDate),
                              nav,
                              amount,
                              units: sellUnits,
                              type: TransactionType.SELL,
                              nature: Math.random() < 0.5 ? TransactionNature.SWP : TransactionNature.LUMPSUM,
                              clientId: client.id,
                              arn: client.associatedArn,
                              folioNumber,
                          });
                      }
                  }

                  if (month === 3) {
                      sipAmount = Math.round(sipAmount * randomBetween(1.02, 1.08));
                  }

                  currentDate.setMonth(currentDate.getMonth() + 1);
              }
          }

          const goalCount = Math.random() < 0.5 ? 2 : 3;
          for (let g = 0; g < goalCount; g++) {
              const category = categories[Math.floor(Math.random() * categories.length)];
              const targetDate = new Date();
              targetDate.setFullYear(targetDate.getFullYear() + Math.floor(randomBetween(3, 12)));
              const targetAmount = Math.round(randomBetween(300000, 4000000));
              const progress = randomBetween(15, 75);

              sampleGoals.push({
                  id: crypto.randomUUID(),
                  clientId: client.id,
                  name: `${category.replace('_', ' ')} Goal ${g + 1}`,
                  targetAmount,
                  currentAmount: Math.round((targetAmount * progress) / 100),
                  targetDate: toDateStr(targetDate),
                  category,
                  priority: (Math.floor(randomBetween(1, 4)) as 1 | 2 | 3),
                  status: progress > 90 ? 'COMPLETED' : progress > 55 ? 'ON_TRACK' : 'AT_RISK',
              });
          }
      }

      sampleClients.forEach(client => addClient(client));
      familyGroups.forEach((family, idx) => {
          addFamily({
              id: family.id,
              name: family.name,
              description: `Sample family group ${idx + 1}`,
              clientIds: family.clientIds,
              createdDate: '2021-01-01',
              arnFilter: family.arnFilter,
          });
      });
      sampleTransactions.forEach(tx => saveTransaction(tx));
      sampleGoals.forEach(goal => addGoal(goal));
  }

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  }

  const unreadAlertCount = useMemo(
    () => alerts.filter((alert) => alert.status === 'UNREAD').length,
    [alerts]
  );

  const handleMarkRead = (alertId: string) => {
    markAlertAsRead(alertId);
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, status: 'READ' } : alert))
    );
  };

  const handleDismissAlert = (alertId: string) => {
    dismissAlert(alertId);
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  const handleMarkAllRead = () => {
    markAllAlertsRead(alerts.map((alert) => alert.id));
    setAlerts((prev) => prev.map((alert) => ({ ...alert, status: 'READ' })));
  };

  // --- Role Switcher Modal ---
  if (showRoleSwitcher) {
      return (
          <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-[100] overflow-hidden">
              <div className="absolute -top-20 -right-10 w-96 h-96 bg-cyan-500/20 blur-3xl rounded-full" />
              <div className="absolute -bottom-24 -left-16 w-96 h-96 bg-blue-600/25 blur-3xl rounded-full" />
              <div className="relative bg-slate-900/95 backdrop-blur rounded-3xl p-8 max-w-3xl w-full shadow-2xl border border-slate-700">
                  <div className="text-center mb-8">
                    <img
                      src="/branding/logo-full-dark.png"
                      alt="FolioMaster"
                      className="h-12 w-auto mx-auto mb-3"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (img.dataset.fallbackStep !== 'svg') {
                          img.dataset.fallbackStep = 'svg';
                          img.src = '/branding/logo-full-dark.svg';
                        } else {
                          img.src = '/logo.svg';
                        }
                      }}
                    />
                    <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-cyan-300 mb-3 border border-slate-700">FolioMaster Platform</div>
                    <h1 className="text-4xl font-bold text-white mb-2">Choose Your Workspace</h1>
                    <p className="text-slate-300">Enter as distributor or client to load the right tools, reports, and workflows.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => handleRoleSelect('DISTRIBUTOR')}
                        className="w-full p-6 border border-slate-700 rounded-2xl hover:bg-slate-800 hover:border-cyan-400 transition-all text-left group bg-slate-900/70"
                      >
                          <span className="font-bold block text-xl mb-2 text-slate-100 group-hover:text-cyan-300">Distributor Console</span>
                          <span className="text-slate-400 text-sm">Client management, family grouping, analytics, and portfolio supervision.</span>
                      </button>
                      <button
                        onClick={() => handleRoleSelect('CLIENT')}
                        className="w-full p-6 border border-slate-700 rounded-2xl hover:bg-slate-800 hover:border-blue-400 transition-all text-left group bg-slate-900/70"
                      >
                          <span className="font-bold block text-xl mb-2 text-slate-100 group-hover:text-blue-300">Client Portal</span>
                          <span className="text-slate-400 text-sm">Track holdings, goals, performance, and AI-driven suggestions.</span>
                      </button>
                  </div>
              </div>
          </div>
      )
  }

  // --- Main App ---
  const userLabel = role === 'DISTRIBUTOR' 
    ? 'Distributor Admin' 
    : (selectedClient?.name || 'Unknown Client');

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        role={role}
        userLabel={userLabel}
        onLogout={() => setShowRoleSwitcher(true)}
        onResetData={handleResetData}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        isMobileOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8 transition-all">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
            <div>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm"
              >
                <Menu size={16} />
                <span>Menu</span>
              </button>
               {/* Breadcrumb for Distributor Drilling Down */}
              {role === 'DISTRIBUTOR' && selectedClient && (
                  <button 
                    onClick={handleBackToAggregate}
                    className="flex items-center text-sm text-slate-500 hover:text-blue-600 mb-2 transition-colors"
                  >
                      <ArrowLeft size={16} className="mr-1" /> Back to Client List
                  </button>
              )}
              
              <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-800 capitalize">
                    {selectedClient && role === 'DISTRIBUTOR' 
                        ? `${selectedClient.name}'s Portfolio` 
                        : currentView === 'advisor' ? 'AI Advisor' : currentView
                    }
                  </h1>
                  
                  {/* ARN Selector for Distributors */}
                  {role === 'DISTRIBUTOR' && !selectedClient && (
                     <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                         <Filter size={14} className="text-slate-400" />
                         <span className="text-xs text-slate-500 font-medium">ARN:</span>
                         <select 
                            value={selectedArn}
                            onChange={(e) => setSelectedArn(e.target.value)}
                            className="text-sm font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                         >
                             {ARNS.map(arn => <option key={arn} value={arn}>{arn}</option>)}
                         </select>
                     </div>
                  )}

                  {role === 'CLIENT' && clientOptions.length > 0 && (
                     <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                         <span className="text-xs text-slate-500 font-medium">Client:</span>
                         <select
                            value={selectedClient?.id || ''}
                            onChange={(e) => {
                              const selected = clientOptions.find(c => c.id === e.target.value) || null;
                              setSelectedClient(selected);
                            }}
                            className="text-sm font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                         >
                             {clientOptions.map(client => (
                               <option key={client.id} value={client.id}>
                                 {client.name}
                               </option>
                             ))}
                         </select>
                     </div>
                  )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3 md:space-x-4">
                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={() => setIsNotificationOpen((prev) => !prev)}
                    className="relative flex items-center justify-center text-slate-500 hover:text-blue-600 bg-white h-10 w-10 rounded-lg border border-slate-200 hover:border-blue-200 shadow-sm transition-all active:scale-95"
                    aria-label="Open notifications"
                  >
                    <Bell size={17} />
                    {unreadAlertCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
                      </span>
                    )}
                  </button>
                  <NotificationPanel
                    isOpen={isNotificationOpen}
                    alerts={alerts}
                    onClose={() => setIsNotificationOpen(false)}
                    onMarkRead={handleMarkRead}
                    onDismiss={handleDismissAlert}
                    onMarkAllRead={handleMarkAllRead}
                  />
                </div>
                {lastUpdated && (
                    <span className="text-xs text-slate-400 hidden lg:block">
                        Updated: {lastUpdated.toLocaleTimeString()}
                    </span>
                )}
                <button 
                    onClick={() => refreshData(true)}
                    disabled={isRefreshing}
                    className="flex items-center space-x-2 text-sm font-medium text-slate-500 hover:text-blue-600 bg-white px-4 py-2 rounded-lg border border-slate-200 hover:border-blue-200 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                    {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    <span>{isRefreshing ? 'Fetching...' : 'Refresh Prices'}</span>
                </button>
            </div>
          </header>

          {/* Content Route */}
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-slate-500 font-medium">Loading...</p>
            </div>
          }>
            <div className="animate-in fade-in zoom-in-95 duration-300">
              {currentView === 'dashboard' && (
                <Dashboard 
                  holdings={holdings} 
                  summary={summary} 
                  transactions={transactions}
                  goals={goals}
                  role={role}
                  selectedClientId={selectedClient?.id ?? null}
                />
              )}
              
              {currentView === 'clients' && role === 'DISTRIBUTOR' && (
                  <ClientList 
                      key={dataVersion}
                      onSelectClient={handleClientSelect} 
                      currentArnFilter={selectedArn}
                  />
              )}

              {currentView === 'transactions' && (
                <Transactions 
                  transactions={transactions} 
                  onUpdate={() => refreshData(true)} 
                  role={role}
                  currentClientId={selectedClient?.id}
                  currentArn={selectedArn}
                />
              )}
              
              {currentView === 'analytics' && (
                 <AnalyticsView holdings={holdings} summary={summary} transactions={transactions} />
              )}
              
              {currentView === 'advisor' && (
                <AIAdvisor holdings={holdings} />
              )}

              {currentView === 'goals' && (
                <GoalManagement
                  selectedClient={selectedClient}
                  arnFilter={role === 'DISTRIBUTOR' ? selectedArn : undefined}
                />
              )}

              {currentView === 'fund-comparison' && (
                <FundComparison />
              )}

              {currentView === 'families' && role === 'DISTRIBUTOR' && (
                <FamilyGrouping arnFilter={selectedArn} />
              )}
            </div>
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default App;
