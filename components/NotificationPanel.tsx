import React, { useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCheck, Info, ShieldAlert, X } from 'lucide-react';
import { PortfolioAlert } from '../types';

interface NotificationPanelProps {
  isOpen: boolean;
  alerts: PortfolioAlert[];
  onClose: () => void;
  onMarkRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onMarkAllRead: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  alerts,
  onClose,
  onMarkRead,
  onDismiss,
  onMarkAllRead,
}) => {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const visibleAlerts = useMemo(
    () => (showUnreadOnly ? alerts.filter((alert) => alert.status === 'UNREAD') : alerts),
    [alerts, showUnreadOnly]
  );

  const unreadCount = useMemo(
    () => alerts.filter((alert) => alert.status === 'UNREAD').length,
    [alerts]
  );

  const iconForSeverity = (severity: PortfolioAlert['severity']) => {
    if (severity === 'CRITICAL') return <ShieldAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />;
    if (severity === 'WARNING') return <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />;
    return <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed left-2 right-2 top-20 z-50 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 md:absolute md:left-auto md:right-0 md:top-12 md:w-[24rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-slate-600 dark:text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full dark:bg-blue-900/40 dark:text-blue-300">
              {unreadCount} new
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Close notifications"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setShowUnreadOnly((prev) => !prev)}
          className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
            showUnreadOnly
              ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
              : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
          }`}
        >
          {showUnreadOnly ? 'Showing unread' : 'Show unread only'}
        </button>
        <button
          onClick={onMarkAllRead}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300"
        >
          <CheckCheck size={14} />
          Mark all read
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto md:max-h-96">
        {visibleAlerts.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No alerts right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleAlerts.map((alert) => (
              <div key={alert.id} className="p-4">
                <div className="flex items-start gap-2.5">
                  {iconForSeverity(alert.severity)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{alert.title}</h4>
                      {alert.status === 'UNREAD' && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" aria-label="Unread" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{alert.message}</p>
                    {alert.actionHint && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Action: {alert.actionHint}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {alert.category}
                      </span>
                      <div className="flex items-center gap-2">
                        {alert.status === 'UNREAD' && (
                          <button
                            onClick={() => onMarkRead(alert.id)}
                            className="text-[11px] text-blue-700 hover:underline dark:text-blue-300"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          onClick={() => onDismiss(alert.id)}
                          className="text-[11px] text-slate-500 hover:underline dark:text-slate-400"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
