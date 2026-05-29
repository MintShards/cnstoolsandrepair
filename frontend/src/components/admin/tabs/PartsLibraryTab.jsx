import { useState, useEffect, useCallback, useRef } from 'react';
import { partsLibraryAPI, repairsAPI, suppliersAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import { useSettings } from '../../../contexts/SettingsContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DiagramList({ urls, onDelete, readonly = false }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {urls.map((url, i) => {
        const isPdf = url.toLowerCase().endsWith('.pdf');
        const ext = url.split('.').pop()?.toLowerCase() || '';
        const displayName = isPdf ? `Diagram ${i + 1}.pdf` : `Diagram ${i + 1}${ext ? `.${ext}` : ''}`;
        const fullUrl = url.startsWith('http') ? url : `/uploads/${url}`;
        return (
          <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 text-xs">
            <span className="material-symbols-outlined text-sm text-slate-500">
              {isPdf ? 'picture_as_pdf' : 'image'}
            </span>
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline max-w-[120px] truncate"
              title={displayName}
            >
              {displayName}
            </a>
            {!readonly && onDelete && (
              <button
                onClick={() => onDelete(url)}
                className="text-slate-400 hover:text-red-500 transition-colors ml-0.5"
                title="Remove diagram"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadDiagramButton({ onUpload, loading }) {
  const ref = useRef();
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); e.target.value = ''; }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-sm">upload</span>
        {loading ? 'Uploading…' : 'Upload diagram / PDF'}
      </button>
    </>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-slate-200 dark:border-slate-700">
        <p className="text-slate-700 dark:text-slate-200 text-sm mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Parts Analytics Section ──────────────────────────────────────────────────

function fmt$(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AnalyticsSectionCard({ title, icon, children }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-base">{icon}</span>
        <h3 className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

const PAGE_SIZES = [5, 10, 25, 50, 100];

function PartsAnalyticsSection() {
  const [open, setOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const [analytics, summary] = await Promise.all([
        repairsAPI.partsAnalytics(),
        repairsAPI.summary(),
      ]);
      setAnalyticsData(analytics);
      setSummaryData(summary?.parts_summary ?? null);
    } catch {
      // silently fail — non-critical
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [loaded]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const ps = summaryData;
  const mu = analyticsData?.most_used_parts ?? [];
  const totalPages = Math.ceil(mu.length / pageSize);
  const muPage = mu.slice(page * pageSize, page * pageSize + pageSize);
  const ts = analyticsData?.top_suppliers ?? [];
  const lt = analyticsData?.supplier_lead_times ?? [];
  const ms = analyticsData?.monthly_spend ?? [];

  const maxSpend = ms.length > 0 ? Math.max(...ms.map(m => m.total_cost || 0), 1) : 1;

  const hasAnyData = mu.length > 0 || ts.length > 0 || ms.length > 0;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-base">analytics</span>
          <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Parts Analytics</span>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal normal-case hidden sm:inline">Most-used parts, suppliers &amp; spend</span>
        </div>
        <span
          className="material-symbols-outlined text-slate-400 text-xl transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800/60 px-3 sm:px-4 pb-4 pt-3 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
              <span className="material-symbols-outlined text-base animate-spin">autorenew</span>
              Loading analytics…
            </div>
          )}

          {!loading && loaded && !hasAnyData && (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2 block">inventory_2</span>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No parts data yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">Parts analytics will appear as you add parts to repair jobs.</p>
            </div>
          )}

          {!loading && loaded && hasAnyData && (
            <>
              {/* Parts Status KPI row */}
              {ps && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Pending', value: ps.pending ?? 0, color: 'amber', icon: 'pending' },
                    { label: 'Ordered', value: ps.ordered ?? 0, color: 'blue', icon: 'shopping_cart' },
                    { label: 'Received', value: ps.received ?? 0, color: 'cyan', icon: 'inventory' },
                    { label: 'Installed', value: ps.installed ?? 0, color: 'green', icon: 'check_circle' },
                  ].map(({ label, value, color, icon }) => {
                    const colorMap = {
                      amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400',
                      blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400',
                      cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800/40 text-cyan-700 dark:text-cyan-400',
                      green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400',
                    };
                    return (
                      <div key={label} className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-xl border ${colorMap[color]}`}>
                        <span className="material-symbols-outlined text-lg opacity-70">{icon}</span>
                        <div className="text-2xl font-black leading-none">{value}</div>
                        <div className="text-[11px] font-bold opacity-80">{label}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Main 2-column grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Most-Used Parts table — 2/3 width */}
                <div className="lg:col-span-2">
                  <AnalyticsSectionCard title="Most-Used Parts" icon="build">
                    {mu.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-2">No parts data</p>
                    ) : (
                      <>
                        <div className="overflow-x-auto -mx-1">
                          <table className="min-w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-slate-800">
                                <th className="px-2 py-1.5 font-bold text-slate-400 uppercase tracking-wide w-6">#</th>
                                <th className="px-2 py-1.5 font-bold text-slate-400 uppercase tracking-wide">Part</th>
                                <th className="px-2 py-1.5 font-bold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Part #</th>
                                <th className="px-2 py-1.5 font-bold text-slate-400 uppercase tracking-wide text-right">Qty</th>
                                <th className="px-2 py-1.5 font-bold text-slate-400 uppercase tracking-wide text-right hidden md:table-cell">Jobs</th>
                                <th className="px-2 py-1.5 font-bold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Compat</th>
                                <th className="px-2 py-1.5 font-bold text-slate-400 uppercase tracking-wide text-right">Spend</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                              {muPage.map((part, i) => (
                                <tr key={part.part_number || part.part_name || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="px-2 py-2 text-slate-400 font-bold">{page * pageSize + i + 1}</td>
                                  <td className="px-2 py-2">
                                    <span className="font-bold text-slate-700 dark:text-slate-200 uppercase block truncate max-w-[140px]">{part.part_name || '—'}</span>
                                  </td>
                                  <td className="px-2 py-2 hidden sm:table-cell">
                                    <span className="text-slate-400 uppercase">{part.part_number || '—'}</span>
                                  </td>
                                  <td className="px-2 py-2 text-right font-black text-slate-700 dark:text-slate-200">{part.total_quantity}</td>
                                  <td className="px-2 py-2 text-right text-slate-400 hidden md:table-cell">{part.job_count}</td>
                                  <td className="px-2 py-2 hidden lg:table-cell">
                                    {part.compat_groups?.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {part.compat_groups.map((g, j) => (
                                          <span key={j} className="px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] font-medium">{g}</span>
                                        ))}
                                      </div>
                                    ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                  </td>
                                  <td className="px-2 py-2 text-right text-slate-500 dark:text-slate-400">{fmt$(part.total_spend)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400">Rows per page:</span>
                            <div className="flex items-center gap-0.5">
                              {PAGE_SIZES.map(size => (
                                <button
                                  key={size}
                                  onClick={() => { setPageSize(size); setPage(0); }}
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                                    pageSize === size
                                      ? 'bg-blue-600 text-white'
                                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/40'
                                  }`}
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          </div>
                          {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-slate-400 mr-1">
                                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, mu.length)} of {mu.length}
                              </span>
                              <button
                                onClick={() => setPage(p => p - 1)}
                                disabled={page === 0}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-default transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">chevron_left</span>
                              </button>
                              <span className="text-[11px] font-bold text-slate-500 px-1">{page + 1} / {totalPages}</span>
                              <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= totalPages - 1}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-default transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">chevron_right</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </AnalyticsSectionCard>
                </div>

                {/* Sidebar — 1/3 width */}
                <div className="space-y-4">

                  {/* Top Suppliers */}
                  <AnalyticsSectionCard title="Top Suppliers" icon="local_shipping">
                    {ts.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-2">No supplier data</p>
                    ) : (
                      <ul className="space-y-2">
                        {ts.map((s, i) => (
                          <li key={s.supplier} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 dark:border-slate-800/40 last:border-0">
                            <div className="min-w-0 flex items-start gap-1.5">
                              <span className="text-[10px] font-black text-slate-400 flex-shrink-0 mt-0.5">{i + 1}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{s.supplier}</p>
                                <p className="text-[10px] text-slate-400">{s.part_count} parts · {s.unique_part_count} unique</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">{fmt$(s.total_spend)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AnalyticsSectionCard>

                  {/* Avg Lead Times */}
                  {lt.length > 0 && (
                    <AnalyticsSectionCard title="Avg Lead Time" icon="schedule">
                      <ul className="space-y-2">
                        {lt.map((s) => (
                          <li key={s.supplier} className="py-1 border-b border-slate-50 dark:border-slate-800/40 last:border-0">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{s.supplier}</p>
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <span className="text-[10px] text-slate-400">{s.sample_count} order{s.sample_count !== 1 ? 's' : ''}</span>
                              <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                                {s.avg_lead_days.toFixed(1)}d
                                <span className="text-[10px] font-normal text-slate-400 ml-1">({s.min_lead_days}–{s.max_lead_days})</span>
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </AnalyticsSectionCard>
                  )}

                  {/* Monthly Spend bar chart */}
                  {ms.length > 0 && (
                    <AnalyticsSectionCard title="Monthly Spend" icon="payments">
                      <div className="space-y-1.5">
                        {[...ms].reverse().map((m) => {
                          const pct = Math.round(((m.total_cost || 0) / maxSpend) * 100);
                          return (
                            <div key={m.month} className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 w-12 flex-shrink-0">{m.month}</span>
                              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-500 dark:bg-blue-600 transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 w-16 text-right flex-shrink-0">{fmt$(m.total_cost)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </AnalyticsSectionCard>
                  )}

                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Brand Form Modal ─────────────────────────────────────────────────────────

function BrandFormModal({ brand, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: (brand?.name || '').toUpperCase(),
    short_code: (brand?.short_code || '').toUpperCase(),
    website: brand?.website || '',
    notes: brand?.notes || '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('short_code', form.short_code.trim());
      fd.append('website', form.website.trim());
      fd.append('notes', form.notes.trim());
      if (logoFile) fd.append('logo', logoFile);

      const saved = brand?.id
        ? await partsLibraryAPI.updateBrand(brand.id, fd)
        : await partsLibraryAPI.createBrand(fd);
      onSaved(saved);
      toast('success', `Brand ${brand?.id ? 'updated' : 'created'} successfully`);
      onClose();
    } catch (err) {
      toast('error', err.response?.data?.detail || 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{brand?.id ? 'Edit Brand' : 'Add Brand'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Brand Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. INGERSOLL RAND"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Short Code</label>
            <input
              value={form.short_code}
              onChange={e => setForm(f => ({ ...f, short_code: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. IR"
              maxLength={10}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Website</label>
            <input
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Logo (optional)</label>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files[0] || null)} />
            <div className="flex items-center gap-2">
              {brand?.logo_url && !logoFile && (
                <img src={brand.logo_url.startsWith('http') ? brand.logo_url : `/uploads/${brand.logo_url}`} alt="logo" className="h-8 rounded" />
              )}
              {logoFile && <span className="text-xs text-slate-500 truncate max-w-[120px]">{logoFile.name}</span>}
              <button type="button" onClick={() => logoRef.current?.click()} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                {brand?.logo_url || logoFile ? 'Change logo' : 'Upload logo'}
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : (brand?.id ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Model Form Modal ─────────────────────────────────────────────────────────

function ModelFormModal({ model, brandId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: (model?.name || '').toUpperCase(),
    category: (model?.category || '').toUpperCase(),
    specifications: model?.specifications || '',
    discontinued: model?.discontinued || false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = model?.id
        ? await partsLibraryAPI.updateModel(model.id, form)
        : await partsLibraryAPI.createModel(brandId, form);
      onSaved(saved);
      toast('success', `Model ${model?.id ? 'updated' : 'created'} successfully`);
      onClose();
    } catch (err) {
      toast('error', err.response?.data?.detail || 'Failed to save model');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{model?.id ? 'Edit Model' : 'Add Model'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Model Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 2135TIMAX"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Category</label>
            <input
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. IMPACT WRENCH"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Specifications</label>
            <textarea
              value={form.specifications}
              onChange={e => setForm(f => ({ ...f, specifications: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Drive size, max torque, etc."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.discontinued}
              onChange={e => setForm(f => ({ ...f, discontinued: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">Discontinued model</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : (model?.id ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Part Form Modal ──────────────────────────────────────────────────────────

function PartFormModal({ part, brandId, modelId, compatGroups, onClose, onSaved }) {
  const toast = useToast();
  const { settings } = useSettings();
  const defaultMarkup = settings?.defaultMarkupPercentage ?? 30;
  // Track whether suggested_price was manually overridden by the user
  const [priceManuallySet, setPriceManuallySet] = useState(part?.suggested_price != null && part?.cost == null);
  const [form, setForm] = useState({
    part_number: (part?.part_number || '').toUpperCase(),
    name: (part?.name || '').toUpperCase(),
    brand_id: part?.brand_id || brandId || '',
    model_ids: part?.model_ids || (modelId ? [modelId] : []),
    compatibility_group_ids: part?.compatibility_group_ids || [],
    suggested_suppliers: part?.suggested_suppliers || [],
    cost: part?.cost ?? '',
    suggested_price: part?.suggested_price ?? '',
    market_price: part?.market_price ?? '',
    notes: part?.notes || '',
    quantity_on_hand: part?.quantity_on_hand ?? 0,
    reorder_point: part?.reorder_point ?? 0,
    reorder_quantity: part?.reorder_quantity ?? 0,
    location: part?.location || '',
  });
  const [suppliersList, setSuppliersList] = useState([]);
  const [saving, setSaving] = useState(false);

  const refreshSuppliers = () => suppliersAPI.getAll().then(setSuppliersList).catch(() => {});

  useEffect(() => { refreshSuppliers(); }, []);

  const addSupplier = (name) => {
    if (name && !form.suggested_suppliers.includes(name)) {
      setForm(f => ({ ...f, suggested_suppliers: [...f.suggested_suppliers, name] }));
    }
  };

  const toggleGroup = (gid) => {
    setForm(f => ({
      ...f,
      compatibility_group_ids: f.compatibility_group_ids.includes(gid)
        ? f.compatibility_group_ids.filter(id => id !== gid)
        : [...f.compatibility_group_ids, gid],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        cost: form.cost === '' ? null : Number(form.cost),
        suggested_price: form.suggested_price === '' ? null : Number(form.suggested_price),
        market_price: form.market_price === '' ? null : Number(form.market_price),
        notes: form.notes || null,
        location: form.location || null,
        quantity_on_hand: Number(form.quantity_on_hand) || 0,
        reorder_point: Number(form.reorder_point) || 0,
        reorder_quantity: Number(form.reorder_quantity) || 0,
      };
      const saved = part?.id
        ? await partsLibraryAPI.updatePart(part.id, payload)
        : await partsLibraryAPI.createPart(payload);
      onSaved(saved);
      toast('success', `Part ${part?.id ? 'updated' : 'created'} successfully`);
      onClose();
    } catch (err) {
      toast('error', err.response?.data?.detail || 'Failed to save part');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-auto border border-slate-200 dark:border-slate-700 my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{part?.id ? 'Edit Part' : 'Add Part'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Part Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. O-RING KIT"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Part Number *</label>
              <input
                required
                value={form.part_number}
                onChange={e => setForm(f => ({ ...f, part_number: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. IR-231C-601"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cost ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={e => {
                  const costVal = e.target.value;
                  setForm(f => {
                    const newForm = { ...f, cost: costVal };
                    if (!priceManuallySet) {
                      const parsed = parseFloat(costVal);
                      newForm.suggested_price = isNaN(parsed) ? '' : (parsed * (1 + defaultMarkup / 100)).toFixed(2);
                    }
                    return newForm;
                  });
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Sell Price ($)
                {!priceManuallySet && form.cost !== '' && <span className="ml-1 text-slate-400">(auto)</span>}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.suggested_price}
                onChange={e => {
                  setPriceManuallySet(true);
                  setForm(f => ({ ...f, suggested_price: e.target.value }));
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Market Price ($)
                <span className="ml-1 text-slate-400 font-normal">MSRP / competitor</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.market_price}
                onChange={e => setForm(f => ({ ...f, market_price: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Suggested Suppliers */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Suppliers</label>
            <select
              onChange={e => { if (e.target.value) { addSupplier(e.target.value); e.target.value = ''; } }}
              onFocus={refreshSuppliers}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{suppliersList.length === 0 ? 'No suppliers — add them in Parts Sourcing' : 'Select supplier...'}</option>
              {suppliersList.filter(s => !form.suggested_suppliers.includes(s.name)).map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            {form.suggested_suppliers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.suggested_suppliers.map((s, i) => {
                  const isManaged = suppliersList.some(sup => sup.name === s);
                  return (
                    <span key={i} className={`flex items-center gap-1 text-xs rounded-lg px-2 py-0.5 ${isManaged ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}`} title={isManaged ? '' : 'Not in managed suppliers list'}>
                      {s}
                      <button type="button" onClick={() => setForm(f => ({ ...f, suggested_suppliers: f.suggested_suppliers.filter((_, j) => j !== i) }))} className="hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compatibility Groups */}
          {compatGroups && compatGroups.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Compatibility Groups</label>
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {compatGroups.map(g => (
                  <label key={g.id} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.compatibility_group_ids.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="rounded"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">{g.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Inventory */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              Inventory
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Qty on Hand</label>
                <input
                  type="number"
                  min="0"
                  value={form.quantity_on_hand}
                  onChange={e => setForm(f => ({ ...f, quantity_on_hand: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Reorder Point</label>
                <input
                  type="number"
                  min="0"
                  value={form.reorder_point}
                  onChange={e => setForm(f => ({ ...f, reorder_point: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Reorder Qty</label>
                <input
                  type="number"
                  min="0"
                  value={form.reorder_quantity}
                  onChange={e => setForm(f => ({ ...f, reorder_quantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Location</label>
                <input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Shelf B-3"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : (part?.id ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Compat Group Form Modal ──────────────────────────────────────────────────

function CompatGroupFormModal({ group, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: group?.name || '', description: group?.description || '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = group?.id
        ? await partsLibraryAPI.updateCompatGroup(group.id, form)
        : await partsLibraryAPI.createCompatGroup(form);
      onSaved(saved);
      toast('success', `Compatibility group ${group?.id ? 'updated' : 'created'}`);
      onClose();
    } catch (err) {
      toast('error', err.response?.data?.detail || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{group?.id ? 'Edit Compat Group' : 'New Compat Group'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Group Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 1/2in Impact O-Ring Kit (Universal)"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="What makes these parts interchangeable?"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : (group?.id ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Parts List (for a model) ─────────────────────────────────────────────────

function PartsView({ model, compatGroups, onBack }) {
  const toast = useToast();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showPartForm, setShowPartForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedPart, setExpandedPart] = useState(null);
  const [stockAdjust, setStockAdjust] = useState(null); // { partId, delta: '', reason: '' }
  const [adjustingStock, setAdjustingStock] = useState(false);
  const [stockHistory, setStockHistory] = useState(null); // { partId, entries: [] }
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [compatibleFor, setCompatibleFor] = useState(null);
  const [compatData, setCompatData] = useState(null);
  const [uploadingModelDiagram, setUploadingModelDiagram] = useState(false);
  const [currentModel, setCurrentModel] = useState(model);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await partsLibraryAPI.listParts({ model_id: model.id, limit: 200 });
      setParts(res.items || []);
    } catch {
      toast('error', 'Failed to load parts');
    } finally {
      setLoading(false);
    }
  }, [model.id]);

  useEffect(() => { load(); }, [load]);

  const handleDeletePart = async () => {
    try {
      await partsLibraryAPI.deletePart(confirmDelete.id);
      setParts(p => p.filter(x => x.id !== confirmDelete.id));
      toast('success', 'Part removed');
    } catch {
      toast('error', 'Failed to remove part');
    }
    setConfirmDelete(null);
  };

  const handleStockAdjust = async (partId) => {
    if (!stockAdjust || !stockAdjust.delta || !stockAdjust.reason.trim()) return;
    setAdjustingStock(true);
    const rawQty = Math.abs(Number(stockAdjust.delta));
    const delta = stockAdjust.mode === 'remove' ? -rawQty : rawQty;
    try {
      const updated = await partsLibraryAPI.adjustStock(partId, {
        delta,
        reason: stockAdjust.reason.trim(),
      });
      setParts(p => p.map(x => x.id === partId ? updated : x));
      setStockAdjust(null);
      toast('success', 'Stock adjusted');
    } catch (err) {
      toast('error', err.response?.data?.detail || 'Failed to adjust stock');
    } finally {
      setAdjustingStock(false);
    }
  };

  const handleLoadStockHistory = async (partId) => {
    if (stockHistory?.partId === partId) { setStockHistory(null); return; }
    setLoadingHistory(true);
    setHistoryLimit(20);
    try {
      const entries = await partsLibraryAPI.getStockHistory(partId);
      setStockHistory({ partId, entries });
    } catch {
      toast('error', 'Failed to load stock history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUploadModelDiagram = async (file) => {
    setUploadingModelDiagram(true);
    try {
      const updated = await partsLibraryAPI.uploadModelDiagram(model.id, file);
      setCurrentModel(updated);
      toast('success', 'Diagram uploaded');
    } catch (err) {
      toast('error', err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingModelDiagram(false);
    }
  };

  const handleDeleteModelDiagram = async (url) => {
    try {
      await partsLibraryAPI.deleteModelDiagram(model.id, url);
      setCurrentModel(m => ({ ...m, diagram_urls: m.diagram_urls.filter(u => u !== url) }));
      toast('success', 'Diagram removed');
    } catch {
      toast('error', 'Failed to remove diagram');
    }
  };

  const handleShowCompat = async (part) => {
    try {
      const data = await partsLibraryAPI.getCompatibleParts(part.id);
      setCompatData(data);
      setCompatibleFor(part);
    } catch {
      toast('error', 'Failed to load compatible parts');
    }
  };

  const filtered = parts.filter(p =>
    !search || p.part_number.toLowerCase().includes(search.toLowerCase()) ||
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Model diagrams */}
      <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Model Breakdown Diagrams</span>
          <UploadDiagramButton onUpload={handleUploadModelDiagram} loading={uploadingModelDiagram} />
        </div>
        {currentModel.diagram_urls?.length > 0 && (
          <DiagramList urls={currentModel.diagram_urls} onDelete={handleDeleteModelDiagram} />
        )}
        {model.specifications && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{model.specifications}</p>
        )}
      </div>

      {/* Parts header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400">settings</span>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Parts ({parts.length})</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search parts…"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48"
          />
          <button
            onClick={() => { setEditingPart(null); setShowPartForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span className="hidden sm:inline">Add Part</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">progress_activity</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2 block">settings</span>
          {search ? 'No parts match your search' : 'No parts yet. Add your first part above.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(part => (
            <div key={part.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div
                className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpandedPart(expandedPart === part.id ? null : part.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase">{part.name}{part.part_number ? ` - ${part.part_number}` : ''}</span>
                    {part.cost != null && (
                      <span className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">Cost: ${part.cost.toFixed(2)}</span>
                    )}
                    {part.suggested_price != null && (
                      <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">Sell: ${part.suggested_price.toFixed(2)}</span>
                    )}
                    {part.market_price != null && (
                      <span className="text-xs sm:text-sm text-violet-600 dark:text-violet-400">Mkt: ${part.market_price.toFixed(2)}</span>
                    )}
                    <span className={`text-xs sm:text-sm px-1.5 py-0.5 rounded-full font-medium ${
                      part.low_stock
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        : part.quantity_on_hand > 0
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}>
                      {part.quantity_on_hand} in stock
                    </span>
                    {part.location && (
                      <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-300">Note: {part.location}</span>
                    )}
                    {part.suggested_suppliers?.length > 0 && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {part.suggested_suppliers.length} supplier{part.suggested_suppliers.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {part.diagram_urls?.length > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-slate-400 dark:text-slate-500">
                        <span className="material-symbols-outlined text-xs">image</span>
                        {part.diagram_urls.length}
                      </span>
                    )}
                    {part.compatibility_group_ids?.length > 0 && (
                      <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">
                        {part.compatibility_group_ids.length} compat
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {part.compatibility_group_ids?.length > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); handleShowCompat(part); }}
                      className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      title="View cross-compatible parts"
                    >
                      <span className="material-symbols-outlined text-sm">swap_horiz</span>
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setEditingPart(part); setShowPartForm(true); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(part); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                  <span className={`material-symbols-outlined text-slate-400 text-sm transition-transform ${expandedPart === part.id ? 'rotate-180' : ''}`}>expand_more</span>
                </div>
              </div>

              {expandedPart === part.id && (
                <div className="px-4 pb-4 pt-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {part.suggested_suppliers?.length > 0 && (
                      <div>
                        <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Suppliers</span>
                        <div className="flex flex-wrap gap-1">
                          {part.suggested_suppliers.map((s, i) => (
                            <span key={i} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {part.compatibility_group_names?.length > 0 && (
                      <div>
                        <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Compat Groups</span>
                        <div className="flex flex-wrap gap-1">
                          {part.compatibility_group_names.map((g, i) => (
                            <span key={i} className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-md">{g}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {part.notes && (
                    <div className="mt-3">
                      <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Notes</span>
                      <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">{part.notes}</p>
                    </div>
                  )}

                  {/* Inventory */}
                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 overflow-hidden">
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary dark:text-blue-400">inventory_2</span>
                        Inventory
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleLoadStockHistory(part.id)}
                          className={`text-[10px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                            stockHistory?.partId === part.id
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300'
                          }`}
                        >
                          <span className="material-symbols-outlined" style={{fontSize:'13px'}}>history</span>
                          {stockHistory?.partId === part.id ? 'Hide' : 'History'}
                        </button>
                        <button
                          onClick={() => setStockAdjust(stockAdjust?.partId === part.id ? null : { partId: part.id, delta: '', reason: '', mode: 'add' })}
                          className={`text-[10px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                            stockAdjust?.partId === part.id
                              ? 'bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-300'
                              : 'text-primary dark:text-blue-400 hover:bg-primary/10 dark:hover:bg-blue-500/20'
                          }`}
                        >
                          <span className="material-symbols-outlined" style={{fontSize:'13px'}}>tune</span>
                          Adjust
                        </button>
                      </div>
                    </div>
                    <div className="px-3.5 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className={`rounded-lg px-3 py-2 text-center ${
                          part.low_stock
                            ? 'bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40'
                            : part.quantity_on_hand > 0
                              ? 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40'
                              : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                        }`}>
                          <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">On Hand</span>
                          <span className={`block text-lg font-black mt-0.5 ${
                            part.low_stock
                              ? 'text-red-600 dark:text-red-400'
                              : part.quantity_on_hand > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400 dark:text-slate-500'
                          }`}>{part.quantity_on_hand}</span>
                        </div>
                        <div className="rounded-lg px-3 py-2 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reorder At</span>
                          <span className="block text-lg font-black text-slate-600 dark:text-slate-300 mt-0.5">{part.reorder_point || '—'}</span>
                        </div>
                        <div className="rounded-lg px-3 py-2 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Order Qty</span>
                          <span className="block text-lg font-black text-slate-600 dark:text-slate-300 mt-0.5">{part.reorder_quantity || '—'}</span>
                        </div>
                        <div className="rounded-lg px-3 py-2 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Location</span>
                          <span className="block text-sm font-bold text-slate-600 dark:text-slate-300 mt-1 truncate">{part.location || '—'}</span>
                        </div>
                      </div>

                      {/* Adjust stock inline form */}
                      {stockAdjust?.partId === part.id && (() => {
                        const rawQty = Math.abs(Number(stockAdjust.delta) || 0);
                        const previewDelta = stockAdjust.mode === 'remove' ? -rawQty : rawQty;
                        const previewQty = Math.max(0, (part.quantity_on_hand || 0) + previewDelta);
                        const quickReasons = [
                          { label: 'Received shipment', icon: 'local_shipping' },
                          { label: 'Inventory correction', icon: 'edit_note' },
                          { label: 'Damaged / defective', icon: 'broken_image' },
                          { label: 'Returned to supplier', icon: 'undo' },
                        ];
                        return (
                        <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10 p-3">
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Stock Adjustment</span>
                            {rawQty > 0 && (
                              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {part.quantity_on_hand} <span className="text-slate-400 dark:text-slate-500">→</span>{' '}
                                <span className={`font-bold ${previewQty <= (part.reorder_point || 0) && part.reorder_point > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{previewQty}</span>
                              </span>
                            )}
                          </div>
                          {/* Add / Remove toggle */}
                          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 mb-3 w-fit">
                            <button
                              onClick={() => setStockAdjust(s => ({ ...s, mode: 'add' }))}
                              className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition-colors ${
                                stockAdjust.mode === 'add'
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="material-symbols-outlined" style={{fontSize:'14px'}}>add</span>
                              Add Stock
                            </button>
                            <button
                              onClick={() => setStockAdjust(s => ({ ...s, mode: 'remove' }))}
                              className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition-colors border-l border-slate-200 dark:border-slate-600 ${
                                stockAdjust.mode === 'remove'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="material-symbols-outlined" style={{fontSize:'14px'}}>remove</span>
                              Remove Stock
                            </button>
                          </div>
                          {/* Quantity + quick qty buttons */}
                          <div className="flex items-end gap-2 mb-3 flex-wrap">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">Quantity</label>
                              <input
                                type="number"
                                min="1"
                                value={stockAdjust.delta}
                                onChange={e => setStockAdjust(s => ({ ...s, delta: e.target.value }))}
                                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="5"
                              />
                            </div>
                            <div className="flex gap-1">
                              {[1, 5, 10, 25].map(n => (
                                <button
                                  key={n}
                                  onClick={() => setStockAdjust(s => ({ ...s, delta: String(n) }))}
                                  className={`px-2 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
                                    String(n) === stockAdjust.delta
                                      ? 'bg-primary text-white'
                                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600'
                                  }`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Quick-pick reasons */}
                          <div className="mb-2">
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">Reason</label>
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {quickReasons.map(r => (
                                <button
                                  key={r.label}
                                  onClick={() => setStockAdjust(s => ({ ...s, reason: r.label }))}
                                  className={`text-[10px] px-2 py-1 rounded-md flex items-center gap-1 transition-colors ${
                                    stockAdjust.reason === r.label
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-600'
                                  }`}
                                >
                                  <span className="material-symbols-outlined" style={{fontSize:'12px'}}>{r.icon}</span>
                                  {r.label}
                                </button>
                              ))}
                            </div>
                            <input
                              value={stockAdjust.reason}
                              onChange={e => setStockAdjust(s => ({ ...s, reason: e.target.value }))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Or type a custom reason…"
                            />
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => handleStockAdjust(part.id)}
                              disabled={adjustingStock || !stockAdjust.delta || !stockAdjust.reason.trim()}
                              className={`px-4 py-1.5 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm ${
                                stockAdjust.mode === 'remove' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
                              }`}
                            >
                              {adjustingStock ? 'Saving…' : stockAdjust.mode === 'remove' ? 'Remove Stock' : 'Add Stock'}
                            </button>
                            <button
                              onClick={() => setStockAdjust(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        );
                      })()}

                      {/* Stock history */}
                      {loadingHistory && stockHistory?.partId !== part.id && (
                        <div className="mt-3 text-xs text-slate-400 flex items-center justify-center gap-1.5 py-3">
                          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                          Loading history…
                        </div>
                      )}
                      {stockHistory?.partId === part.id && (
                        <div className="mt-3">
                          <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Recent Changes</span>
                          {stockHistory.entries.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2 text-center">No stock changes recorded</p>
                          ) : (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                              {stockHistory.entries.slice(0, historyLimit).map((entry, i) => (
                                <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 text-[11px] ${
                                  i % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-800/20'
                                } ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''}`}>
                                  {/* Delta badge */}
                                  <span className={`inline-flex items-center justify-center w-10 py-0.5 rounded-md text-[11px] font-bold flex-shrink-0 mt-0.5 ${
                                    entry.delta > 0
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                  }`}>
                                    {entry.delta > 0 ? '+' : ''}{entry.delta}
                                  </span>
                                  {/* Result qty */}
                                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px] mt-0.5 flex-shrink-0">→ {entry.resulting_quantity}</span>
                                  {/* Main content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                      {/* Source badge */}
                                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                        entry.source === 'auto'
                                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                      }`}>
                                        {entry.source === 'auto' ? 'Auto' : 'Manual'}
                                      </span>
                                      {/* Job reference */}
                                      {entry.reference_job_id && (
                                        <span className="text-[9px] font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                          Job: {entry.reference_job_id.slice(-6)}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-slate-600 dark:text-slate-300 block truncate">{entry.reason}</span>
                                    {entry.adjusted_by && (
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{entry.adjusted_by}</span>
                                    )}
                                  </div>
                                  {/* Date */}
                                  <span className="text-slate-400 dark:text-slate-500 flex-shrink-0 text-[10px] mt-0.5">
                                    {new Date(entry.timestamp).toLocaleDateString()}
                                  </span>
                                </div>
                              ))}
                              {/* Load more */}
                              {stockHistory.entries.length > historyLimit && (
                                <button
                                  onClick={() => setHistoryLimit(l => l + 20)}
                                  className="w-full py-2 text-[11px] text-primary dark:text-blue-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors border-t border-slate-100 dark:border-slate-700/50"
                                >
                                  Show more ({stockHistory.entries.length - historyLimit} remaining)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showPartForm && (
        <PartFormModal
          part={editingPart}
          brandId={model.brand_id}
          modelId={model.id}
          compatGroups={compatGroups}
          onClose={() => { setShowPartForm(false); setEditingPart(null); }}
          onSaved={(saved) => {
            if (editingPart) {
              setParts(p => p.map(x => x.id === saved.id ? saved : x));
            } else {
              setParts(p => [...p, saved]);
            }
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Remove part "${confirmDelete.name}" (${confirmDelete.part_number}) from the library?`}
          onConfirm={handleDeletePart}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {compatibleFor && compatData && (
        <CompatiblePartsModal
          part={compatibleFor}
          data={compatData}
          onClose={() => { setCompatibleFor(null); setCompatData(null); }}
        />
      )}
    </div>
  );
}

// ─── Compatible Parts Modal ───────────────────────────────────────────────────

function CompatiblePartsModal({ part, data, onClose }) {
  const totalCompatible = data.compatibility_groups.reduce((sum, g) => sum + g.parts.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-auto border border-slate-200 dark:border-slate-700 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Cross-Compatible Parts</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              For: <span className="font-semibold text-blue-600 dark:text-blue-400">{part.name}{part.part_number ? ` - ${part.part_number}` : ''}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {totalCompatible === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <span className="material-symbols-outlined text-3xl mb-2 block">swap_horiz</span>
              No cross-compatible alternatives found in the library yet.
            </div>
          ) : (
            data.compatibility_groups.map(cg => (
              <div key={cg.group.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-sm">link</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{cg.group.name}</span>
                  {cg.group.description && (
                    <span className="text-xs text-slate-400 truncate">— {cg.group.description}</span>
                  )}
                </div>
                {cg.parts.length === 0 ? (
                  <p className="text-xs text-slate-400 ml-6">No other parts in this group yet</p>
                ) : (
                  <div className="space-y-1.5 ml-6">
                    {cg.parts.map(p => (
                      <div key={p.id} className="flex items-start gap-2 bg-green-50 dark:bg-green-900/10 rounded-xl px-3 py-2 border border-green-100 dark:border-green-800/30">
                        <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-sm mt-0.5 flex-shrink-0">check_circle</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-slate-700 dark:text-slate-200 uppercase">{p.name}{p.part_number ? ` - ${p.part_number}` : ''}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 uppercase">
                            {p.brand_name} {p.model_names?.length > 0 ? `— ${p.model_names.join(', ')}` : ''}
                          </div>
                          {p.suggested_suppliers?.length > 0 && (
                            <div className="text-xs text-slate-400 mt-0.5">{p.suggested_suppliers.join(', ')}</div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          {p.cost != null && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">Cost: ${p.cost.toFixed(2)}</span>
                          )}
                          {p.suggested_price != null && (
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Sell: ${p.suggested_price.toFixed(2)}</span>
                          )}
                          {p.market_price != null && (
                            <span className="text-xs text-violet-600 dark:text-violet-400">Mkt: ${p.market_price.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Models View (level 1) ────────────────────────────────────────────────────

function ModelsView({ brand, compatGroups, onBack, onSelectModel }) {
  const toast = useToast();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [modelSearch, setModelSearch] = useState('');
  const [partResults, setPartResults] = useState([]);
  const [partSearchLoading, setPartSearchLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await partsLibraryAPI.listModels(brand.id);
      setModels(data);
    } catch {
      toast('error', 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [brand.id]);

  useEffect(() => { load(); }, [load]);

  const filteredModels = models.filter(m =>
    !modelSearch ||
    m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
    (m.category && m.category.toLowerCase().includes(modelSearch.toLowerCase()))
  );

  // Also search parts via API when query is 2+ chars
  useEffect(() => {
    if (!modelSearch.trim() || modelSearch.trim().length < 2) { setPartResults([]); return; }
    const timer = setTimeout(async () => {
      setPartSearchLoading(true);
      try {
        const data = await partsLibraryAPI.search(modelSearch.trim());
        setPartResults(data);
      } catch { /* silent */ }
      finally { setPartSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [modelSearch]);

  const handleDelete = async () => {
    try {
      await partsLibraryAPI.deleteModel(confirmDelete.id);
      setModels(m => m.filter(x => x.id !== confirmDelete.id));
      toast('success', 'Model removed');
    } catch {
      toast('error', 'Failed to remove model');
    }
    setConfirmDelete(null);
  };

  return (
    <div>
      {models.length > 0 && (
        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">search</span>
          <input
            type="text"
            value={modelSearch}
            onChange={e => setModelSearch(e.target.value)}
            placeholder="Search models and parts…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {modelSearch && (
            <button
              onClick={() => setModelSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Models ({models.length})</h3>
        <button
          onClick={() => { setEditingModel(null); setShowModelForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Model
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">progress_activity</span>
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2 block">build_circle</span>
          No models yet. Add the first model for {brand.name}.
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
          No models match &ldquo;{modelSearch}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredModels.map(model => (
            <div
              key={model.id}
              className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer group"
              onClick={() => onSelectModel(model)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 dark:text-slate-100 uppercase">{model.name}</span>
                    {model.discontinued && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">Discontinued</span>
                    )}
                  </div>
                  {model.category && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 uppercase">{model.category}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setEditingModel(model); setShowModelForm(true); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={() => setConfirmDelete(model)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">settings</span>
                    {model.part_count ?? 0} parts
                  </span>
                  {model.diagram_urls?.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                      {model.diagram_urls.length} diagram{model.diagram_urls.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-blue-400 dark:group-hover:text-blue-500 transition-colors text-sm">arrow_forward</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Parts search results */}
      {modelSearch.trim().length >= 2 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">settings</span>
            Parts
          </h4>
          {partSearchLoading && (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-slate-400 text-2xl">progress_activity</span>
            </div>
          )}
          {!partSearchLoading && partResults.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">No parts found for &ldquo;{modelSearch}&rdquo;</p>
          )}
          {!partSearchLoading && partResults.length > 0 && (
            <div className="space-y-2">
              {partResults.map(part => (
                <div
                  key={part.id}
                  className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                  onClick={() => {
                    const model = models.find(m => part.model_ids?.includes(m.id));
                    if (model) { onSelectModel(model); }
                  }}
                >
                  <span className="material-symbols-outlined text-slate-400 mt-0.5">settings</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100 uppercase">{part.name}{part.part_number ? ` - ${part.part_number}` : ''}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 uppercase">
                      {part.brand_name}{part.model_names?.length > 0 ? ` — ${part.model_names.join(', ')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    {part.cost != null && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">Cost: ${part.cost.toFixed(2)}</span>
                    )}
                    {part.suggested_price != null && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">Sell: ${part.suggested_price.toFixed(2)}</span>
                    )}
                    {part.market_price != null && (
                      <span className="text-xs text-violet-600 dark:text-violet-400">Mkt: ${part.market_price.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModelForm && (
        <ModelFormModal
          model={editingModel}
          brandId={brand.id}
          onClose={() => { setShowModelForm(false); setEditingModel(null); }}
          onSaved={(saved) => {
            if (editingModel) {
              setModels(m => m.map(x => x.id === saved.id ? saved : x));
            } else {
              setModels(m => [...m, saved]);
            }
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Remove model "${confirmDelete.name}"? All associated parts will also be hidden.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Compat Groups Panel ──────────────────────────────────────────────────────

function CompatGroupsPanel({ onClose }) {
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');

  // Expanded group state
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [groupParts, setGroupParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(false);

  // Add-parts picker state
  const [showAddParts, setShowAddParts] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addingIds, setAddingIds] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await partsLibraryAPI.listCompatGroups();
      setGroups(data);
    } catch {
      toast('error', 'Failed to load compatibility groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredGroups = groups.filter(g =>
    !search ||
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.description && g.description.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleExpand = async (groupId) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
      setShowAddParts(false);
      setAddSearch('');
      setAddResults([]);
      return;
    }
    setExpandedGroupId(groupId);
    setShowAddParts(false);
    setAddSearch('');
    setAddResults([]);
    setLoadingParts(true);
    try {
      const parts = await partsLibraryAPI.getCompatGroupParts(groupId);
      setGroupParts(parts);
    } catch {
      toast('error', 'Failed to load group parts');
    } finally {
      setLoadingParts(false);
    }
  };

  const handleRemoveFromGroup = async (part, groupId) => {
    try {
      const newIds = (part.compatibility_group_ids || []).filter(id => id !== groupId);
      await partsLibraryAPI.updatePart(part.id, { compatibility_group_ids: newIds });
      setGroupParts(prev => prev.filter(p => p.id !== part.id));
      setGroups(g => g.map(x => x.id === groupId ? { ...x, part_count: Math.max(0, (x.part_count || 1) - 1) } : x));
      toast('success', `Removed ${part.name}`);
    } catch {
      toast('error', 'Failed to remove part');
    }
  };

  const handleAddToGroup = async (part, groupId) => {
    setAddingIds(prev => new Set(prev).add(part.id));
    try {
      const newIds = [...(part.compatibility_group_ids || []), groupId];
      const updated = await partsLibraryAPI.updatePart(part.id, { compatibility_group_ids: newIds });
      setGroupParts(prev => [...prev, updated]);
      setAddResults(prev => prev.filter(p => p.id !== part.id));
      setGroups(g => g.map(x => x.id === groupId ? { ...x, part_count: (x.part_count || 0) + 1 } : x));
      toast('success', `Added ${part.name}`);
    } catch {
      toast('error', 'Failed to add part');
    } finally {
      setAddingIds(prev => { const s = new Set(prev); s.delete(part.id); return s; });
    }
  };

  // Add-parts search with debounce
  useEffect(() => {
    if (!showAddParts || !addSearch.trim() || addSearch.trim().length < 2) { setAddResults([]); return; }
    const timer = setTimeout(async () => {
      setAddSearching(true);
      try {
        const data = await partsLibraryAPI.search(addSearch.trim());
        // Filter out parts already in this group
        const memberIds = new Set(groupParts.map(p => p.id));
        setAddResults(data.filter(p => !memberIds.has(p.id) && !(p.compatibility_group_ids || []).includes(expandedGroupId)));
      } catch { /* silent */ }
      finally { setAddSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [addSearch, showAddParts, expandedGroupId, groupParts]);

  const handleDelete = async () => {
    try {
      await partsLibraryAPI.deleteCompatGroup(confirmDelete.id);
      setGroups(g => g.filter(x => x.id !== confirmDelete.id));
      if (expandedGroupId === confirmDelete.id) setExpandedGroupId(null);
      toast('success', 'Group removed');
    } catch {
      toast('error', 'Failed to remove group');
    }
    setConfirmDelete(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl sm:mx-4 border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">Compatibility Groups</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Parts in the same group are interchangeable across brands</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0 ml-2">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <button
              onClick={() => { setEditingGroup(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Group
            </button>
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter groups…"
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">progress_activity</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No compatibility groups yet</div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <span className="material-symbols-outlined text-3xl mb-1 block">search_off</span>
              No groups match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGroups.map(g => (
                <div key={g.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-colors">
                  {/* Group header row */}
                  <div
                    className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(g.id)}
                  >
                    <span className={`material-symbols-outlined text-sm mt-1 transition-transform ${expandedGroupId === g.id ? 'rotate-180' : ''} text-slate-400 flex-shrink-0`}>expand_more</span>
                    <span className="material-symbols-outlined text-green-600 dark:text-green-400 mt-0.5 hidden sm:block flex-shrink-0">link</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{g.name}</p>
                      {g.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{g.description}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{g.part_count ?? 0} parts</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditingGroup(g); setShowForm(true); }}
                        className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(g)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded: member parts */}
                  {expandedGroupId === g.id && (
                    <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 px-3 sm:px-4 py-3">
                      {loadingParts ? (
                        <div className="flex items-center justify-center py-4">
                          <span className="material-symbols-outlined animate-spin text-slate-400 text-xl">progress_activity</span>
                        </div>
                      ) : (
                        <>
                          {/* Action bar */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Member Parts ({groupParts.length})</span>
                            <button
                              onClick={() => { setShowAddParts(v => !v); setAddSearch(''); setAddResults([]); }}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                showAddParts
                                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">{showAddParts ? 'close' : 'add'}</span>
                              {showAddParts ? 'Cancel' : 'Add Parts'}
                            </button>
                          </div>

                          {/* Add-parts picker */}
                          {showAddParts && (
                            <div className="mb-3 p-2 sm:p-3 border border-green-200 dark:border-green-800/40 rounded-xl bg-green-50/50 dark:bg-green-900/10">
                              <div className="relative mb-2">
                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">search</span>
                                <input
                                  value={addSearch}
                                  onChange={e => setAddSearch(e.target.value)}
                                  placeholder="Search parts to add…"
                                  className="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                                  autoFocus
                                />
                                {addSearch && (
                                  <button onClick={() => { setAddSearch(''); setAddResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <span className="material-symbols-outlined text-sm">close</span>
                                  </button>
                                )}
                              </div>
                              {addSearching && (
                                <div className="flex items-center justify-center py-3">
                                  <span className="material-symbols-outlined animate-spin text-slate-400 text-sm">progress_activity</span>
                                </div>
                              )}
                              {!addSearching && addSearch.trim().length >= 2 && addResults.length === 0 && (
                                <p className="text-xs text-slate-400 text-center py-2">No parts found</p>
                              )}
                              {!addSearching && addResults.length > 0 && (
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {addResults.map(p => (
                                    <div key={p.id} className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <span className="text-xs font-medium text-slate-800 dark:text-slate-100 uppercase truncate">{p.name}</span>
                                          {p.part_number && <span className="text-[10px] text-slate-400 flex-shrink-0">#{p.part_number}</span>}
                                        </div>
                                        <p className="text-[10px] text-slate-400 uppercase truncate">{p.brand_name}{p.model_names?.length > 0 ? ` — ${p.model_names.join(', ')}` : ''}</p>
                                      </div>
                                      <button
                                        onClick={() => handleAddToGroup(p, g.id)}
                                        disabled={addingIds.has(p.id)}
                                        className="px-2 py-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium transition-colors flex-shrink-0"
                                      >
                                        {addingIds.has(p.id) ? '…' : 'Add'}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Parts list */}
                          {groupParts.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-3">No parts in this group yet</p>
                          ) : (
                            <div className="space-y-1">
                              {groupParts.map(p => (
                                <div key={p.id} className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 group/part">
                                  <span className="material-symbols-outlined text-slate-400 text-sm hidden sm:block">settings</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                      <span className="text-xs font-medium text-slate-800 dark:text-slate-100 uppercase truncate">{p.name}</span>
                                      {p.part_number && (
                                        <span className="text-[10px] font-mono text-primary bg-primary/10 dark:bg-primary/20 px-1 py-0.5 rounded flex-shrink-0">{p.part_number}</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 uppercase truncate">{p.brand_name}{p.model_names?.length > 0 ? ` — ${p.model_names.join(', ')}` : ''}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                    {p.suggested_price != null && <span className="text-[10px] text-slate-600 dark:text-slate-300 hidden sm:inline">Sell: ${p.suggested_price.toFixed(2)}</span>}
                                    {p.market_price != null && <span className="text-[10px] text-violet-600 dark:text-violet-400 hidden sm:inline">Mkt: ${p.market_price.toFixed(2)}</span>}
                                    <button
                                      onClick={() => handleRemoveFromGroup(p, g.id)}
                                      className="p-0.5 rounded text-slate-400 sm:text-slate-300 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 sm:opacity-0 sm:group-hover/part:opacity-100 transition-all"
                                      title="Remove from group"
                                    >
                                      <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <CompatGroupFormModal
          group={editingGroup}
          onClose={() => { setShowForm(false); setEditingGroup(null); }}
          onSaved={(saved) => {
            if (editingGroup) {
              setGroups(g => g.map(x => x.id === saved.id ? saved : x));
            } else {
              setGroups(g => [...g, saved]);
            }
          }}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          message={`Remove compatibility group "${confirmDelete.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Global Search View ───────────────────────────────────────────────────────

// ─── Main PartsLibraryTab ─────────────────────────────────────────────────────

export default function PartsLibraryTab({ initialFilter } = {}) {
  const toast = useToast();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compatGroups, setCompatGroups] = useState([]);

  // Navigation state: null=brands list, {brand}=models view, {brand,model}=parts view
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  // Low-stock filter view
  const [showLowStockOnly, setShowLowStockOnly] = useState(initialFilter === 'low-stock');
  const [lowStockParts, setLowStockParts] = useState([]);
  const [loadingLowStock, setLoadingLowStock] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCompatibleFor, setSearchCompatibleFor] = useState(null);
  const [searchCompatData, setSearchCompatData] = useState(null);

  // Modals
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showCompatGroups, setShowCompatGroups] = useState(false);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    try {
      const [brandsData, groupsData] = await Promise.all([
        partsLibraryAPI.listBrands(),
        partsLibraryAPI.listCompatGroups(),
      ]);
      setBrands(brandsData);
      setCompatGroups(groupsData);
    } catch {
      toast('error', 'Failed to load brands');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBrands(); }, [loadBrands]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await partsLibraryAPI.search(searchQuery.trim());
        setSearchResults(data);
      } catch { toast('error', 'Search failed'); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!showLowStockOnly) { setLowStockParts([]); return; }
    setLoadingLowStock(true);
    partsLibraryAPI.getLowStock(200)
      .then(parts => setLowStockParts(parts))
      .catch(() => toast('error', 'Failed to load low-stock parts'))
      .finally(() => setLoadingLowStock(false));
  }, [showLowStockOnly]);

  const handleSearchCompat = async (part) => {
    try {
      const data = await partsLibraryAPI.getCompatibleParts(part.id);
      setSearchCompatData(data);
      setSearchCompatibleFor(part);
    } catch { toast('error', 'Failed to load compatible parts'); }
  };

  const handleDeleteBrand = async () => {
    try {
      await partsLibraryAPI.deleteBrand(confirmDelete.id);
      setBrands(b => b.filter(x => x.id !== confirmDelete.id));
      toast('success', 'Brand removed');
    } catch {
      toast('error', 'Failed to remove brand');
    }
    setConfirmDelete(null);
  };

  const isSearchActive = searchQuery.trim().length >= 2;

  // Filter brands client-side when search is active
  const filteredBrands = isSearchActive
    ? brands.filter(b => b.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : [];

  // Extract unique models from parts search results
  const matchedModels = isSearchActive && searchResults.length > 0
    ? (() => {
        const seen = new Set();
        const models = [];
        searchResults.forEach(part => {
          if (part.model_ids && part.model_names) {
            part.model_ids.forEach((mid, i) => {
              if (!seen.has(mid) && part.model_names[i]?.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
                seen.add(mid);
                models.push({ id: mid, name: part.model_names[i], brand_name: part.brand_name, brand_id: part.brand_id });
              }
            });
          }
        });
        return models;
      })()
    : [];

  return (
    <div>
      {/* Header with breadcrumb */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-4">
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 flex-shrink-0 text-lg sm:text-xl">inventory_2</span>
          <button
            onClick={() => { setSelectedBrand(null); setSelectedModel(null); setSearchQuery(''); }}
            className={`text-sm sm:text-lg font-bold transition-colors flex-shrink-0 ${selectedBrand || selectedModel ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300' : 'text-slate-800 dark:text-slate-100 cursor-default'}`}
          >
            {selectedBrand ? <span className="hidden sm:inline">Parts Library</span> : 'Parts Library'}
          </button>
          {!selectedBrand && !selectedModel && (
            <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full flex-shrink-0">{brands.length} brands</span>
          )}
          {selectedBrand && (
            <>
              <span className="material-symbols-outlined text-slate-400 text-xs sm:text-sm flex-shrink-0">chevron_right</span>
              <button
                onClick={() => { setSelectedModel(null); setSearchQuery(''); }}
                className={`text-sm sm:text-lg font-bold transition-colors truncate max-w-[100px] sm:max-w-xs uppercase ${selectedModel ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300' : 'text-slate-800 dark:text-slate-100 cursor-default'}`}
                title={selectedBrand.name}
              >
                {selectedBrand.name}
              </button>
            </>
          )}
          {selectedModel && (
            <>
              <span className="material-symbols-outlined text-slate-400 text-xs sm:text-sm flex-shrink-0">chevron_right</span>
              <span className="text-sm sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate max-w-[100px] sm:max-w-xs uppercase" title={selectedModel.name}>{selectedModel.name}</span>
              {selectedModel.category && (
                <span className="text-xs sm:text-base text-slate-500 dark:text-slate-300 flex-shrink-0 uppercase">— {selectedModel.category}</span>
              )}
              {selectedModel.discontinued && (
                <span className="text-[10px] sm:text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0">Discontinued</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setShowLowStockOnly(v => !v)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              showLowStockOnly
                ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-sm">warning</span>
            <span className="hidden sm:inline">Low Stock</span>
            {!showLowStockOnly && lowStockParts.length === 0 && brands.length > 0 && null}
          </button>
          <button
            onClick={() => setShowCompatGroups(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">link</span>
            <span className="hidden sm:inline">Compat Groups</span>
            {compatGroups.length > 0 && (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">{compatGroups.length}</span>
            )}
          </button>
          <button
            onClick={() => { setEditingBrand(null); setShowBrandForm(true); }}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span className="hidden sm:inline">Add Brand</span>
          </button>
        </div>
      </div>

      {/* Persistent search bar — only at top-level brands view (models & parts views have their own) */}
      {!selectedBrand && !selectedModel && <div className="mb-4 relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">search</span>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search brands, models, and parts…"
          className="w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>}

      {/* Low-stock filter view */}
      {showLowStockOnly && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-red-500 dark:text-red-400">warning</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Parts Below Reorder Point</span>
            {!loadingLowStock && (
              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">{lowStockParts.length}</span>
            )}
            <button
              onClick={() => setShowLowStockOnly(false)}
              className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              Clear filter
            </button>
          </div>
          {loadingLowStock && (
            <div className="flex items-center justify-center py-16">
              <span className="material-symbols-outlined animate-spin text-slate-400 text-4xl">progress_activity</span>
            </div>
          )}
          {!loadingLowStock && lowStockParts.length === 0 && (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-4xl text-emerald-400 dark:text-emerald-500 mb-2 block">check_circle</span>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">All stocked up</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No parts are below their reorder point</p>
            </div>
          )}
          {!loadingLowStock && lowStockParts.length > 0 && (
            <div className="space-y-2">
              {lowStockParts.map(part => (
                <div key={part.id} className="flex items-center gap-3 p-3 border border-red-200 dark:border-red-800/40 rounded-xl bg-red-50/40 dark:bg-red-900/10">
                  <span className="material-symbols-outlined text-red-400 flex-shrink-0">inventory_2</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase">{part.name}</span>
                      {part.part_number && (
                        <span className="text-xs font-mono text-primary bg-primary/10 dark:bg-primary/20 px-1.5 py-0.5 rounded">{part.part_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {part.brand_name && <span>{part.brand_name}</span>}
                      {part.model_names?.length > 0 && <span>{part.model_names.slice(0,2).join(', ')}</span>}
                      {part.location && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined" style={{fontSize:'12px'}}>location_on</span>{part.location}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wide">On Hand</span>
                      <span className="text-lg font-black text-red-600 dark:text-red-400">{part.quantity_on_hand}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wide">Reorder At</span>
                      <span className="text-lg font-black text-slate-600 dark:text-slate-300">{part.reorder_point}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content: search results OR drill-down view */}
      {!showLowStockOnly && isSearchActive ? (
        <div className="space-y-5">
          {/* Brands section */}
          {filteredBrands.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">build</span>
                Brands ({filteredBrands.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredBrands.map(brand => (
                  <div
                    key={brand.id}
                    className="flex items-center gap-2.5 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => { setSelectedBrand(brand); setSearchQuery(''); }}
                  >
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url.startsWith('http') ? brand.logo_url : `/uploads/${brand.logo_url}`}
                        alt={brand.name}
                        className="h-6 w-auto object-contain rounded"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-slate-400 text-sm">build</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 uppercase">{brand.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{brand.model_count ?? 0} models</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-sm">arrow_forward</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Models section */}
          {matchedModels.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">build_circle</span>
                Models ({matchedModels.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {matchedModels.map(model => (
                  <div
                    key={model.id}
                    className="flex items-center gap-2.5 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => {
                      const brand = brands.find(b => b.id === model.brand_id);
                      if (brand) { setSelectedBrand(brand); }
                      setSearchQuery('');
                    }}
                  >
                    <span className="material-symbols-outlined text-slate-400 text-sm">build_circle</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 uppercase">{model.name}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">{model.brand_name}</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-sm">arrow_forward</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parts section */}
          {(searchLoading || searchResults.length > 0) && (
          <div>
            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">settings</span>
              Parts
            </h4>
            {searchLoading && (
              <div className="flex items-center justify-center py-8">
                <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">progress_activity</span>
              </div>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map(part => (
                  <div
                    key={part.id}
                    className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => {
                      const brand = brands.find(b => b.id === part.brand_id);
                      if (brand) { setSelectedBrand(brand); setSelectedModel(null); }
                      setSearchQuery('');
                    }}
                  >
                    <span className="material-symbols-outlined text-slate-400 mt-0.5">settings</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100 uppercase">{part.name}{part.part_number ? ` - ${part.part_number}` : ''}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="uppercase">{part.brand_name}{part.model_names?.length > 0 ? ` — ${part.model_names.join(', ')}` : ''}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-end gap-0.5">
                        {part.cost != null && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">Cost: ${part.cost.toFixed(2)}</span>
                        )}
                        {part.suggested_price != null && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">Sell: ${part.suggested_price.toFixed(2)}</span>
                        )}
                        {part.market_price != null && (
                          <span className="text-xs text-violet-600 dark:text-violet-400">Mkt: ${part.market_price.toFixed(2)}</span>
                        )}
                      </div>
                      {part.compatibility_group_ids?.length > 0 && (
                        <button
                          onClick={() => handleSearchCompat(part)}
                          className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          title="View cross-compatible parts"
                        >
                          <span className="material-symbols-outlined text-sm">swap_horiz</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* No results at all */}
          {!searchLoading && filteredBrands.length === 0 && matchedModels.length === 0 && searchResults.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
              <p className="text-sm">No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
        </div>
      ) : selectedModel ? (
        <PartsView
          model={selectedModel}
          compatGroups={compatGroups}
          onBack={() => setSelectedModel(null)}
        />
      ) : selectedBrand ? (
        <ModelsView
          brand={selectedBrand}
          compatGroups={compatGroups}
          onBack={() => setSelectedBrand(null)}
          onSelectModel={setSelectedModel}
        />
      ) : (
        <>
          {/* Parts Analytics (lazy-loaded, collapsible) */}
          <PartsAnalyticsSection />

          {/* How it works hint */}
          <div className="mb-5 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30 text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">info</span>
              How it works
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Add brands → add models per brand → add parts per model with part numbers and diagrams.
              Use <strong>Compat Groups</strong> to mark parts from different brands as interchangeable — then you can instantly find alternatives when a part is out of stock.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="material-symbols-outlined animate-spin text-slate-400 text-4xl">progress_activity</span>
            </div>
          ) : brands.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3 block">inventory_2</span>
              <p className="font-medium text-slate-600 dark:text-slate-300 mb-1">No brands yet</p>
              <p className="text-sm">Add your first brand to start building the parts library.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {brands.map(brand => (
                <div
                  key={brand.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md dark:hover:shadow-black/20 transition-all cursor-pointer group bg-white dark:bg-slate-800/50"
                  onClick={() => setSelectedBrand(brand)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url.startsWith('http') ? brand.logo_url : `/uploads/${brand.logo_url}`}
                          alt={brand.name}
                          className="h-8 w-auto object-contain rounded"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-slate-400 text-sm">build</span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 leading-tight uppercase">{brand.name}</p>
                        {brand.short_code && (
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">{brand.short_code}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditingBrand(brand); setShowBrandForm(true); }}
                        className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(brand)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">build_circle</span>
                      {brand.model_count ?? 0} model{(brand.model_count ?? 0) !== 1 ? 's' : ''}
                    </div>
                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-blue-400 dark:group-hover:text-blue-500 transition-colors text-sm">arrow_forward</span>
                  </div>

                  {brand.notes && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 line-clamp-2">{brand.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showBrandForm && (
        <BrandFormModal
          brand={editingBrand}
          onClose={() => { setShowBrandForm(false); setEditingBrand(null); }}
          onSaved={(saved) => {
            loadBrands();
            if (selectedBrand?.id === saved.id) setSelectedBrand(saved);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Remove brand "${confirmDelete.name}"? All models and parts will be hidden.`}
          onConfirm={handleDeleteBrand}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showCompatGroups && (
        <CompatGroupsPanel
          onClose={() => { setShowCompatGroups(false); loadBrands(); }}
        />
      )}

      {searchCompatibleFor && searchCompatData && (
        <CompatiblePartsModal
          part={searchCompatibleFor}
          data={searchCompatData}
          onClose={() => { setSearchCompatibleFor(null); setSearchCompatData(null); }}
        />
      )}
    </div>
  );
}
