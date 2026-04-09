import React from 'react';
import { LayoutDashboard, PieChart, ArrowRightLeft, BrainCircuit, Users, LogOut, Trash2, Target, BarChart3, UserCheck, Moon, Sun, X } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
  role: 'DISTRIBUTOR' | 'CLIENT';
  userLabel: string;
  onLogout: () => void;
  onResetData: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  role,
  userLabel,
  onLogout,
  onResetData,
  isDarkMode,
  onToggleDarkMode,
  isMobileOpen,
  onCloseMobile
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['DISTRIBUTOR', 'CLIENT'] },
    { id: 'clients', label: 'Clients', icon: Users, roles: ['DISTRIBUTOR'] },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft, roles: ['DISTRIBUTOR', 'CLIENT'] },
    { id: 'goals', label: 'Goals', icon: Target, roles: ['DISTRIBUTOR', 'CLIENT'] },
    { id: 'fund-comparison', label: 'Fund Analysis', icon: BarChart3, roles: ['DISTRIBUTOR', 'CLIENT'] },
    { id: 'families', label: 'Family Groups', icon: UserCheck, roles: ['DISTRIBUTOR'] },
    { id: 'analytics', label: 'Analytics', icon: PieChart, roles: ['DISTRIBUTOR', 'CLIENT'] },
    { id: 'advisor', label: 'AI Advisor', icon: BrainCircuit, roles: ['CLIENT'] },
  ];

  return (
    <>
      {isMobileOpen && (
        <button
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          aria-label="Close sidebar overlay"
        />
      )}
      <aside className={`w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50 transition-all duration-300 transform ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
      <div className="p-6 border-b border-slate-700 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <img
              src="/branding/logo-full-dark.png"
              alt="FolioMaster logo"
              className="h-11 w-auto max-w-[13rem] object-contain"
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
          </div>
          <p className="text-xs text-slate-400 mt-1">
              {role === 'DISTRIBUTOR' ? 'Distributor Console' : 'Client Portal'}
          </p>
        </div>
        <button onClick={onCloseMobile} className="md:hidden text-slate-400 hover:text-white">
          <X size={20} />
        </button>
      </div>
      
      <div className="px-6 py-4 bg-slate-800/50">
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Logged in as</p>
          <p className="text-sm font-medium text-white truncate">{userLabel}</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.filter(item => item.roles.includes(role)).map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-teal-600/20 text-teal-400 shadow-sm border border-teal-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-800 space-y-2">
        <button 
            onClick={onToggleDarkMode}
            className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all"
        >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span className="font-medium">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        {role === 'DISTRIBUTOR' && (
             <button 
                onClick={onResetData}
                className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:bg-red-900/30 hover:text-red-400 rounded-xl transition-all"
            >
                <Trash2 size={20} />
                <span className="font-medium">Reset Data</span>
            </button>
        )}
        <button 
            onClick={() => {
              onLogout();
              onCloseMobile();
            }}
            className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all"
        >
            <LogOut size={20} />
            <span className="font-medium">Switch Role</span>
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
