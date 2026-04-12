import { useState, useEffect, useCallback } from 'react';
import { repairsAPI } from '../../services/api';
import { REPAIR_STATUSES, MAIN_STAGES } from '../../constants/repairStatuses';

const REFRESH_INTERVAL_MS = 60_000;

// Active statuses we show in the swimlane (terminal ones have nothing to action)
const ACTIVE_STATUSES = MAIN_STAGES;

export default function DashboardSummary({ onStatusFilter, collapsed: initialCollapsed = false, asTab = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchSummary = useCallback(async () => {
    try {
      const result = await repairsAPI.summary();
      setData(result);
      setLastRefreshed(new Date());
    } catch {
      // Silently fail — dashboard is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const timer = setInterval(fetchSummary, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchSummary]);

  const handleStatusClick = (status) => {
    if (onStatusFilter) onStatusFilter(status);
  };

  const totalActive = data?.total_active_jobs ?? 0;
  const overdueCount = data?.overdue_count ?? 0;
  const staleCount = data?.stale_count ?? 0;
  const rushUrgent = data?.rush_urgent_active ?? 0;
  const updatedToday = data?.updated_today ?? 0;
  const hasAttention = overdueCount > 0 || staleCount > 0 || rushUrgent > 0;

  const content = (
    <div className="space-y-4">
      {/* Tab mode header with refresh */}
      {asTab && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span className="text-xs text-slate-400 dark:text-slate-600">Refreshes every minute</span>
            )}
          </div>
          <button
            onClick={fetchSummary}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded"
            title="Refresh now"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
          </button>
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
          <span className="material-symbols-outlined text-base animate-spin">autorenew</span>
          Loading summary...
        </div>
      ) : (
        <>
          {/* At-a-glance numbers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  icon="build_circle"
                  label="Active Jobs"
                  value={totalActive}
                  color="blue"
                />
                <StatCard
                  icon="today"
                  label="Updated Today"
                  value={updatedToday}
                  color="green"
                />
                <StatCard
                  icon="schedule"
                  label="Overdue"
                  value={overdueCount}
                  color={overdueCount > 0 ? 'red' : 'neutral'}
                  urgent={overdueCount > 0}
                />
                <StatCard
                  icon="warning"
                  label="Stale (3+ days)"
                  value={staleCount}
                  color={staleCount > 0 ? 'amber' : 'neutral'}
                  urgent={staleCount > 0}
                />
              </div>

              {/* Rush/Urgent alert */}
              {rushUrgent > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl text-sm text-red-700 dark:text-red-400 font-bold cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  onClick={() => handleStatusClick('')}
                  title="Click to show all jobs"
                >
                  <span className="material-symbols-outlined text-base">flag</span>
                  {rushUrgent} Rush / Urgent tool{rushUrgent !== 1 ? 's' : ''} currently active
                </div>
              )}

              {/* Status swimlane */}
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-wide mb-2">
                  Tools by Status — click to filter
                </p>
                <div className="flex flex-wrap gap-2">
                  {ACTIVE_STATUSES.map(status => {
                    const count = data?.status_counts?.[status] ?? 0;
                    const cfg = REPAIR_STATUSES[status];
                    if (!cfg) return null;
                    return (
                      <button
                        key={status}
                        onClick={() => handleStatusClick(status)}
                        disabled={count === 0}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition-all
                          ${count > 0
                            ? 'hover:scale-105 hover:shadow-md cursor-pointer opacity-100'
                            : 'opacity-30 cursor-default'
                          } ${cfg.color}`}
                        title={count > 0 ? `Filter to ${cfg.label}` : `No tools in ${cfg.label}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                        <span className="font-black">{count}</span>
                      </button>
                    );
                  })}
                  {/* Show off-ramp statuses that have tools */}
                  {['declined', 'completed', 'abandoned'].map(status => {
                    const count = data?.status_counts?.[status] ?? 0;
                    if (count === 0) return null;
                    const cfg = REPAIR_STATUSES[status];
                    return (
                      <button
                        key={status}
                        onClick={() => handleStatusClick(status)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition-all hover:scale-105 cursor-pointer ${cfg.color}`}
                        title={`Filter to ${cfg.label}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                        <span className="font-black">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
        </>
      )}
    </div>
  );

  if (asTab) return content;

  return (
    <div className="mb-6 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 sm:px-5 py-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">dashboard</span>
          <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
            Dashboard
          </h2>
          {!collapsed && lastRefreshed && (
            <span className="text-xs text-slate-400 dark:text-slate-600 hidden sm:inline">
              · refreshes every minute
            </span>
          )}
          {hasAttention && collapsed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700/50 text-red-700 dark:text-red-400 text-xs font-bold">
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>warning</span>
              {overdueCount + staleCount + rushUrgent} need attention
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && (
            <button
              onClick={(e) => { e.stopPropagation(); fetchSummary(); }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded"
              title="Refresh now"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
            </button>
          )}
          <span className="material-symbols-outlined text-slate-400 text-xl transition-transform duration-200" style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            expand_more
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 sm:px-5 pb-4 border-t border-slate-100 dark:border-slate-800/60 pt-4">
          {content}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, urgent }) {
  const colorMap = {
    blue:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400',
    green:   'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400',
    red:     'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400',
    amber:   'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400',
    neutral: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/40 text-slate-500 dark:text-slate-400',
  };
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${colorMap[color] || colorMap.neutral} ${urgent ? 'animate-pulse' : ''}`}>
      <span className="material-symbols-outlined text-xl flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xl font-black leading-none">{value}</div>
        <div className="text-xs font-bold opacity-70 mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}
