import { useState, useEffect, useCallback } from 'react';
import { repairsAPI } from '../../services/api';
import { REPAIR_STATUSES, MAIN_STAGES } from '../../constants/repairStatuses';

const REFRESH_INTERVAL_MS = 60_000;

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(isoString) {
  if (!isoString) return null;
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KPICard({ icon, label, value, sub, color, onClick, urgent }) {
  const colorMap = {
    blue:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400',
    amber:   'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400',
    red:     'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400',
    green:   'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400',
  };
  const base = `flex flex-col gap-0.5 sm:gap-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border h-full ${colorMap[color]} transition-all`;
  const interactive = onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98] sm:hover:scale-[1.02]' : '';
  return (
    <div className={`${base} ${interactive} ${urgent ? 'animate-pulse' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between">
        <span className="material-symbols-outlined text-lg sm:text-xl opacity-70">{icon}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-black leading-none">{value}</div>
      <div className="text-[11px] sm:text-xs font-bold opacity-80 leading-tight">{label}</div>
      {sub && <div className="text-[10px] sm:text-xs opacity-50 leading-tight hidden sm:block">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-800/60">
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">{title}</h3>
          {subtitle && <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = REPAIR_STATUSES[status];
  if (!cfg) return <span className="text-xs text-slate-400">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DashboardSummary({
  onStatusFilter, onTechFilter, onNewJob, onNewCustomer, onGoToRequests,
  onAttentionUpdate, onStaleDaysUpdate, onOpenJob,
  collapsed: initialCollapsed = false,
  asTab = false,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const fetchSummary = useCallback(async () => {
    try {
      const result = await repairsAPI.summary();
      setData(result);
      if (onAttentionUpdate) {
        onAttentionUpdate((result.overdue_count > 0) || (result.stale_count > 0) || (result.rush_urgent_active > 0));
      }
      if (onStaleDaysUpdate && result.stale_days != null) {
        onStaleDaysUpdate(result.stale_days);
      }
    } catch {
      // Silently fail — dashboard is non-critical
    } finally {
      setLoading(false);
    }
  }, [onAttentionUpdate, onStaleDaysUpdate]);

  useEffect(() => {
    fetchSummary();
    const timer = setInterval(fetchSummary, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchSummary]);

  const nav = (status) => { if (onStatusFilter) onStatusFilter(status); };

  // ── Derived data ──
  const sc = data?.status_counts ?? {};
  const totalActive = data?.total_active_jobs ?? 0;
  const pendingApproval = sc.quoted ?? 0;
  const readyCount = (sc.ready ?? 0) + (sc.invoiced ?? 0);
  const overdueCount = data?.overdue_count ?? 0;
  const completedToday = data?.today_activity?.completions ?? 0;
  const pendingRequestsCount = data?.pending_requests_count ?? 0;
  const pendingApprovalStale = data?.pending_approval_stale_count ?? 0;
  const stuckCount = data?.stuck_count ?? 0;
  const readyForPickup = data?.ready_for_pickup ?? [];
  const priorityJobs = data?.priority_jobs ?? [];
  const activeCustomers = data?.active_customers ?? [];
  const pendingApprovals = data?.pending_approvals ?? [];
  const hasAttention = overdueCount > 0 || (data?.stale_count ?? 0) > 0 || (data?.rush_urgent_active ?? 0) > 0;

  const maxStatusCount = Math.max(1, ...MAIN_STAGES.map(s => sc[s] ?? 0));

  // Action Required items
  const actionItems = [
    {
      icon: 'schedule',
      label: `${overdueCount} overdue job${overdueCount !== 1 ? 's' : ''}`,
      detail: 'Past target turnaround date',
      count: overdueCount,
      priority: 'High',
      priorityColor: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
      onClick: () => nav('__overdue__'),
    },
    {
      icon: 'hourglass_top',
      label: `${pendingApprovalStale} waiting approval 2+ days`,
      detail: 'Customers have not responded',
      count: pendingApprovalStale,
      priority: 'Medium',
      priorityColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
      onClick: () => nav('quoted'),
    },
    {
      icon: 'block',
      label: `${stuckCount} stuck job${stuckCount !== 1 ? 's' : ''} (24h+)`,
      detail: 'No status update in over 24 hours',
      count: stuckCount,
      priority: 'Medium',
      priorityColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
      onClick: () => nav('__stuck__'),
    },
    {
      icon: 'storefront',
      label: `${readyForPickup.length} ready for pickup`,
      detail: 'Customer follow-up recommended',
      count: readyForPickup.length,
      priority: 'Low',
      priorityColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
      onClick: () => nav('ready'),
    },
  ];

  const content = (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Header ──────────────────────────────────────────────── */}
      {asTab && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {onNewJob && (
              <button
                onClick={onNewJob}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-primary text-white text-xs sm:text-sm font-bold hover:bg-primary/90 active:scale-[0.97] transition-colors shadow-sm shadow-primary/25"
              >
                <span className="material-symbols-outlined text-sm sm:text-base">add_circle</span>
                Work Order
              </button>
            )}
            {onNewCustomer && (
              <button
                onClick={onNewCustomer}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-700 dark:bg-slate-600 text-white text-xs sm:text-sm font-bold hover:bg-slate-600 dark:hover:bg-slate-500 active:scale-[0.97] transition-colors"
              >
                <span className="material-symbols-outlined text-sm sm:text-base">person_add</span>
                Customer
              </button>
            )}
          </div>
          <button
            onClick={fetchSummary}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg flex-shrink-0"
            title="Refresh now"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
          <span className="material-symbols-outlined text-base animate-spin">autorenew</span>
          Loading summary...
        </div>
      ) : (
        <>
          {/* ── Pending Requests banner ──────────────────────────── */}
          <button
            onClick={() => onGoToRequests && onGoToRequests()}
            className={`w-full flex items-center gap-2 px-3 py-2 border rounded-xl text-xs sm:text-sm font-bold transition-colors text-left active:scale-[0.99] ${
              pendingRequestsCount > 0
                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/40 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <span className="material-symbols-outlined text-base">inbox</span>
            <span className="flex-1">
              {pendingRequestsCount > 0
                ? `${pendingRequestsCount} repair request${pendingRequestsCount !== 1 ? 's' : ''} awaiting review`
                : 'No pending repair requests'}
            </span>
            <span className="material-symbols-outlined text-sm opacity-50">chevron_right</span>
          </button>

          {/* ── KPI Cards ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            <KPICard
              icon="build_circle" label="Active Jobs" value={totalActive}
              sub="Currently in shop" color="blue"
              onClick={() => nav('__all__')}
            />
            <KPICard
              icon="pending_actions" label="Pending Approval" value={pendingApproval}
              sub="Waiting for customer" color="amber"
              onClick={() => nav('quoted')}
            />
            <KPICard
              icon="storefront" label="Ready for Pickup" value={readyCount}
              sub="Awaiting collection" color="emerald"
              onClick={() => nav('ready')}
            />
            <KPICard
              icon="schedule" label="Overdue" value={overdueCount}
              sub="Need attention" color="red"
              urgent={overdueCount > 0}
              onClick={overdueCount > 0 ? () => nav('__overdue__') : undefined}
            />
            <div className="col-span-2 sm:col-span-1">
              <KPICard
                icon="check_circle" label="Completed Today" value={completedToday}
                sub="Finished today" color="green"
              />
            </div>
          </div>

          {/* ── 2-column layout ──────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">

            {/* ── MAIN COLUMN ─────────────────────────────── */}
            <div className="md:col-span-2 space-y-4 sm:space-y-5">

              {/* Action Required */}
              <SectionCard
                title="Action Required"
                subtitle="Items that need follow-up today"
                action={
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    actionItems.some(a => a.count > 0)
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : 'bg-slate-100 dark:bg-slate-700/40 text-slate-400'
                  }`}>
                    {actionItems.filter(a => a.count > 0).length} active
                  </span>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                  {actionItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={item.count > 0 ? item.onClick : undefined}
                      disabled={item.count === 0}
                      className={`flex items-center sm:items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                        item.count > 0
                          ? 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm cursor-pointer active:scale-[0.98]'
                          : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/40 opacity-50 cursor-default'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-base flex-shrink-0 ${
                        item.count > 0 ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'
                      }`}>{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs sm:text-sm font-bold leading-tight ${item.count > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                          {item.label}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 leading-tight hidden sm:block">{item.detail}</p>
                      </div>
                      <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ${item.priorityColor}`}>
                        {item.priority}
                      </span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* Status Pipeline */}
              <SectionCard title="Status Pipeline" subtitle="Where jobs are sitting right now">
                <div className="space-y-2 sm:space-y-2.5">
                  {MAIN_STAGES.map((status) => {
                    const cfg = REPAIR_STATUSES[status];
                    const count = sc[status] ?? 0;
                    const pct = Math.round((count / maxStatusCount) * 100);
                    return (
                      <button
                        key={status}
                        onClick={() => nav(status)}
                        disabled={count === 0}
                        className={`w-full text-left group py-0.5 ${count === 0 ? 'opacity-40 cursor-default' : 'cursor-pointer active:scale-[0.99]'}`}
                      >
                        <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                          <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-blue-400 transition-colors">
                            {cfg.label}
                          </span>
                          <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-300">{count}</span>
                        </div>
                        <div className="h-1.5 sm:h-2 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${cfg.dot}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              {/* Work Queue */}
              <SectionCard
                title="Work Queue"
                subtitle="Overdue, stale, rush/urgent, and stuck jobs"
                action={
                  <button
                    onClick={() => nav('__all__')}
                    className="text-xs font-bold text-primary dark:text-blue-400 hover:underline flex-shrink-0"
                  >
                    Go to Repair Jobs
                  </button>
                }
              >
                {priorityJobs.length === 0 ? (
                  <div className="text-center py-6">
                    <span className="material-symbols-outlined text-3xl text-green-400 dark:text-green-600 mb-2 block">check_circle</span>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">All caught up</p>
                    <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">No overdue, stale, or rush jobs</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: card layout */}
                    <div className="space-y-2 sm:hidden">
                      {priorityJobs.map((job, i) => (
                        <button
                          key={`${job.request_number}-${i}`}
                          onClick={() => onOpenJob ? onOpenJob(job.job_id) : nav(job.status)}
                          className="w-full text-left px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800/40 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-400 dark:text-slate-500">{job.request_number}</span>
                                <StatusBadge status={job.status} />
                              </div>
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate mt-1">
                                {job.brand || job.tool_type || '—'}{job.model_number ? ` ${job.model_number}` : ''}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{job.customer_name || '—'}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <span className="text-xs text-slate-400">{job.assigned_technician}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(job.reason || []).map((r) => {
                              const reasonStyles = {
                                overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                rush: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                                stuck: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                stale: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                                'awaiting approval': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                              };
                              return (
                                <span key={r} className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${reasonStyles[r] || 'bg-slate-100 text-slate-500'}`}>
                                  {r}
                                </span>
                              );
                            })}
                          </div>
                        </button>
                      ))}
                    </div>
                    {/* Desktop/tablet: table layout */}
                    <div className="overflow-x-auto -mx-1 hidden sm:block">
                      <table className="min-w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="px-2 py-2 font-bold text-slate-400 uppercase tracking-wide">WO#</th>
                            <th className="px-2 py-2 font-bold text-slate-400 uppercase tracking-wide">Tool</th>
                            <th className="px-2 py-2 font-bold text-slate-400 uppercase tracking-wide hidden md:table-cell">Customer</th>
                            <th className="px-2 py-2 font-bold text-slate-400 uppercase tracking-wide">Status</th>
                            <th className="px-2 py-2 font-bold text-slate-400 uppercase tracking-wide">Why</th>
                            <th className="px-2 py-2 font-bold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Assigned</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                          {priorityJobs.map((job, i) => (
                            <tr
                              key={`${job.request_number}-${i}`}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                              onClick={() => onOpenJob ? onOpenJob(job.job_id) : nav(job.status)}
                            >
                              <td className="px-2 py-2.5">
                                <span className="font-black text-slate-500 dark:text-slate-400">{job.request_number}</span>
                              </td>
                              <td className="px-2 py-2.5">
                                <span className="font-bold text-slate-700 dark:text-slate-200 block truncate max-w-[120px]">
                                  {job.brand || job.tool_type || '—'}
                                </span>
                                {job.model_number && (
                                  <span className="text-slate-400 block truncate max-w-[120px]">{job.model_number}</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5 hidden md:table-cell">
                                <span className="text-slate-600 dark:text-slate-300 truncate max-w-[120px] block">{job.customer_name || '—'}</span>
                              </td>
                              <td className="px-2 py-2.5">
                                <StatusBadge status={job.status} />
                              </td>
                              <td className="px-2 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {(job.reason || []).map((r) => {
                                    const reasonStyles = {
                                      overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                      urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                      rush: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                                      stuck: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                      stale: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                                      'awaiting approval': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                                    };
                                    return (
                                      <span key={r} className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${reasonStyles[r] || 'bg-slate-100 text-slate-500'}`}>
                                        {r}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="px-2 py-2.5 hidden lg:table-cell">
                                <span className="text-slate-500 dark:text-slate-400 truncate max-w-[80px] block">{job.assigned_technician}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </SectionCard>
            </div>

            {/* ── SIDEBAR ─────────────────────────────────── */}
            <div className="space-y-4 sm:space-y-5">

              {/* Active Customers */}
              <SectionCard title="Active Customers" subtitle="Customers with open jobs">
                {activeCustomers.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-2">No active customers</p>
                ) : (
                  <ul className="space-y-1.5 sm:space-y-2">
                    {activeCustomers.map((c) => (
                      <li key={c.name} className="flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{c.name}</p>
                          {c.last_activity && (
                            <p className="text-[10px] sm:text-xs text-slate-400">{relativeTime(c.last_activity)}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className="text-base sm:text-lg font-black text-slate-600 dark:text-slate-300">{c.job_count}</span>
                          <p className="text-[10px] sm:text-xs text-slate-400 leading-none">job{c.job_count !== 1 ? 's' : ''}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              {/* Pending Approvals */}
              <SectionCard title="Pending Approvals" subtitle="Sales follow-up list">
                {pendingApprovals.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-2">No pending approvals</p>
                ) : (
                  <ul className="space-y-1.5 sm:space-y-2">
                    {pendingApprovals.map((item) => (
                      <li key={item.request_number}>
                        <button
                          onClick={() => onOpenJob ? onOpenJob(item.job_id) : nav('quoted')}
                          className="w-full flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:border-amber-200 dark:hover:border-amber-800/40 transition-colors text-left group active:scale-[0.98]"
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-black text-slate-400 dark:text-slate-500">{item.request_number}</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{item.customer_name || '—'}</p>
                            <p className="text-[10px] sm:text-xs text-slate-400">{item.tool_count} tool{item.tool_count !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold ${
                              item.days_waiting >= 3
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                : item.days_waiting >= 1
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                  : 'bg-slate-100 dark:bg-slate-700/40 text-slate-500'
                            }`}>
                              {item.days_waiting === 0 ? 'Today' : `${item.days_waiting}d`}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

            </div>
          </div>
        </>
      )}
    </div>
  );

  if (asTab) return content;

  return (
    <div className="mb-6 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 sm:px-5 py-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">dashboard</span>
          <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Dashboard</h2>
          {hasAttention && collapsed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700/50 text-red-700 dark:text-red-400 text-xs font-bold">
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>warning</span>
              needs attention
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
        <div className="px-3 sm:px-5 pb-3 sm:pb-4 border-t border-slate-100 dark:border-slate-800/60 pt-3 sm:pt-4">
          {content}
        </div>
      )}
    </div>
  );
}
