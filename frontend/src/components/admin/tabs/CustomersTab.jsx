import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { customersAPI, repairsAPI, serviceAgreementAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import { REPAIR_STATUSES } from '../../../constants/repairStatuses';
import { StatusBadge } from '../shared/RepairStatusBadges';
import PaginationBar from '../shared/PaginationBar';
import { formatDateShortPacific } from '../../../utils/dateFormat';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { openPrintWorkOrder } from '../PrintWorkOrder';
import SendWorkOrderEmailModal from '../SendWorkOrderEmailModal';
import { useSettings } from '../../../contexts/SettingsContext';
import WorkOrderDialog from '../shared/WorkOrderDialog';

const EMPTY_CUSTOMER = {
  company_name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  customer_notes: '',
};


const getErrorMessage = (err, fallback) => {
  const detail = err.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join('; ');
  return fallback;
};

const PRIORITIES = {
  standard: { label: 'Standard', color: 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' },
  rush:     { label: 'Rush',     color: 'bg-orange-100 text-orange-700 border-orange-400 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700' },
  urgent:   { label: 'Urgent',   color: 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
};

const STATUS_PRIORITY = ['abandoned', 'declined', 'received', 'diagnosed', 'parts_pending', 'in_repair', 'quoted', 'approved', 'ready', 'invoiced', 'completed', 'closed'];
const byStatusPriority = (a, b) => {
  const ai = STATUS_PRIORITY.indexOf(a.status);
  const bi = STATUS_PRIORITY.indexOf(b.status);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
};

const PRIORITY_RANK = { urgent: 3, rush: 2, standard: 1 };
const getHighestPriority = (tools) => {
  if (!tools?.length) return 'standard';
  return tools.reduce((highest, tool) =>
    (PRIORITY_RANK[tool.priority] || 0) > (PRIORITY_RANK[highest] || 0) ? tool.priority : highest,
    'standard'
  );
};

function PriorityBadge({ priority }) {
  const cfg = PRIORITIES[priority] || PRIORITIES.standard;
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-bold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  if (digits.length > 3) return digits.slice(0, 3) + '-' + digits.slice(3);
  return digits;
}

export default function CustomersTab({ onNewJob, onCountUpdate, externalOpenNewCustomer, onExternalOpenNewCustomerHandled }) {
  const showToast = useToast();
  const { settings } = useSettings();
  const [serviceAgreement, setServiceAgreement] = useState(null);
  useEffect(() => {
    serviceAgreementAPI.get().then(setServiceAgreement).catch(() => {});
  }, []);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('smart');
  const [sortDir, setSortDir] = useState('desc');

  // Profile view
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  useBodyScrollLock(!!selectedCustomer);
  const [customerJobs, setCustomerJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsPageSize, setJobsPageSize] = useState(10);

  // Edit customer
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // New customer modal
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_CUSTOMER);
  const [creating, setCreating] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Open new customer form triggered from the dashboard
  useEffect(() => {
    if (externalOpenNewCustomer) {
      setShowNewForm(true);
      setNewForm(EMPTY_CUSTOMER);
      if (onExternalOpenNewCustomerHandled) onExternalOpenNewCustomerHandled();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenNewCustomer]);

  // WO detail dialog
  const [woDialogJob, setWoDialogJob] = useState(null);
  const [deleteJobConfirm, setDeleteJobConfirm] = useState(null);
  const [emailModalJob, setEmailModalJob] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = searchQuery ? { search: searchQuery } : {};
        params.sort_by = sortField;
        params.sort_order = sortDir;
        const data = await customersAPI.list({ ...params, limit: 200 });
        if (cancelled) return;
        setCustomers(data);
        // Only update the tab badge when not searching — a search result
        // would show a filtered count instead of the total.
        if (onCountUpdate && !searchQuery) onCountUpdate(data.length);
      } catch {
        if (!cancelled) showToast('error', 'Failed to load customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sortField, sortDir]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const handleSort = (field) => {
    if (field === 'smart') {
      setSortField('smart');
      setSortDir('desc');
    } else if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'created_at' || field === 'updated_at' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Escape key: close topmost open modal
  // Customer profile deep-linking: the open profile lives in the URL
  // (?tab=customers&customer=<id>) so it works in new browser tabs
  const [searchParams, setSearchParams] = useSearchParams();
  const closeCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setEditing(false);
    setSearchParams({ tab: 'customers' }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (woDialogJob) return; // WorkOrderDialog handles Escape while open
      if (deleteJobConfirm) { setDeleteJobConfirm(null); return; }
      if (selectedCustomer) { closeCustomer(); return; }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [woDialogJob, deleteJobConfirm, selectedCustomer, closeCustomer]);

  const openCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setEditing(false);
    setEditForm({});
    setCustomerJobs([]);
    setWoDialogJob(null);
    setJobsPage(1);
    setLoadingJobs(true);
    try {
      const jobs = await customersAPI.getJobs(customer.id);
      setCustomerJobs(jobs);
    } catch {
      setCustomerJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Open the profile named by the URL param (new-tab loads, back/forward)
  const customerParam = searchParams.get('customer');
  useEffect(() => {
    if (!customerParam) { setSelectedCustomer(null); return; }
    if (selectedCustomer?.id === customerParam) return;
    const cached = customers.find(c => c.id === customerParam);
    if (cached) { openCustomer(cached); return; }
    (async () => {
      try {
        const customer = await customersAPI.get(customerParam);
        openCustomer(customer);
      } catch {
        showToast('error', 'Failed to load customer');
        setSearchParams({ tab: 'customers' }, { replace: true });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerParam]);

  const handleStartEdit = () => {
    setEditForm({
      company_name: selectedCustomer.company_name || '',
      first_name: selectedCustomer.first_name,
      last_name: selectedCustomer.last_name,
      email: selectedCustomer.email,
      phone: selectedCustomer.phone,
      address: selectedCustomer.address || '',
      customer_notes: selectedCustomer.customer_notes || '',
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    let updated;
    try {
      updated = await customersAPI.update(selectedCustomer.id, editForm);
    } catch (err) {
      console.error('handleSaveEdit failed:', err);
      showToast('error', getErrorMessage(err, 'Failed to update customer'));
      setSaving(false);
      return;
    }
    setSelectedCustomer(updated);
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEditing(false);
    showToast('success', 'Customer updated successfully');
    setSaving(false);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setCreating(true);
    let created;
    try {
      created = await customersAPI.create(newForm);
    } catch (err) {
      console.error('handleCreateCustomer failed:', err);
      showToast('error', getErrorMessage(err, 'Failed to create customer'));
      setCreating(false);
      return;
    }
    setCustomers(prev => {
      const updated = [created, ...prev];
      if (onCountUpdate) onCountUpdate(updated.length);
      return updated;
    });
    setShowNewForm(false);
    setNewForm(EMPTY_CUSTOMER);
    showToast('success', `Customer ${created.first_name} ${created.last_name} created successfully`);
    setCreating(false);
    openCustomer(created);
    setSearchParams({ tab: 'customers', customer: created.id });
  };

  const handleDeleteCustomer = async () => {
    if (!deleteConfirm) return;
    try {
      await customersAPI.delete(deleteConfirm.id);
      const remaining = customers.filter(c => c.id !== deleteConfirm.id);
      setCustomers(remaining);
      if (onCountUpdate) onCountUpdate(remaining.length);
      if (selectedCustomer?.id === deleteConfirm.id) closeCustomer();
      setDeleteConfirm(null);
      showToast('success', 'Customer deleted successfully');
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to delete customer'));
      setDeleteConfirm(null);
    }
  };

  // ── WO Dialog Handlers ──
  const openWoDialog = async (job) => {
    try {
      const fresh = await repairsAPI.get(job.id);
      setWoDialogJob(fresh);
    } catch {
      setWoDialogJob(job);
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobConfirm) return;
    try {
      await repairsAPI.delete(deleteJobConfirm.id);
      setCustomerJobs(prev => prev.filter(j => j.id !== deleteJobConfirm.id));
      if (woDialogJob?.id === deleteJobConfirm.id) setWoDialogJob(null);
      setDeleteJobConfirm(null);
      showToast('success', 'Repair job deleted');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to delete repair job';
      showToast('error', msg);
      setDeleteJobConfirm(null);
    }
  };

  const getToolStatusSummary = (tools) => {
    if (!tools?.length) return null;
    const counts = {};
    tools.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  };

  const formatDate = formatDateShortPacific;

  const paginated = customers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Customer jobs pagination
  const jobsStartIndex = (jobsPage - 1) * jobsPageSize;
  const paginatedJobs = customerJobs.slice(jobsStartIndex, jobsStartIndex + jobsPageSize);


  // ── Profile view ──
  if (selectedCustomer) {
    return (
      <div>
        {/* Back + Header */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={closeCustomer}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all text-sm font-bold flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Customers</span>
          </button>
          <span className="text-slate-400 dark:text-slate-600 text-sm flex-shrink-0">/</span>
          <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-black text-sm">
              {(selectedCustomer.first_name || selectedCustomer.company_name || '?')[0].toUpperCase()}
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase truncate leading-tight min-w-0 flex-1">
            {selectedCustomer.company_name || `${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onNewJob && (
              <button
                onClick={() => onNewJob(selectedCustomer)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl text-sm font-bold transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span className="hidden sm:inline">New Job</span>
              </button>
            )}
            <button
              onClick={() => setDeleteConfirm(selectedCustomer)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border border-red-200 hover:border-red-300 dark:border-red-800/30 dark:hover:border-red-700/50 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 rounded-xl text-sm font-bold transition-all"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Customer Info Card */}
          <div>
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
              {/* Card header */}
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2 flex-wrap">
                <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '13px' }}>person</span>
                </div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">Customer Info</h3>
                <span className="text-slate-500 dark:text-slate-700 text-xs select-none">·</span>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="material-symbols-outlined text-slate-400 dark:text-slate-600" style={{ fontSize: '12px' }}>calendar_month</span>
                  Since {formatDate(selectedCustomer.created_at)}
                </div>
                <div className="ml-auto">
                  <button
                    onClick={handleStartEdit}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold transition-all"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span>
                    Edit
                  </button>
                </div>
              </div>
              {/* Compact inline fields */}
              <div className="px-4 py-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {selectedCustomer.company_name && (
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>business</span>
                      <span className="text-xs text-slate-500">Company:</span>
                      <span className="text-sm text-slate-900 dark:text-white font-bold">{(selectedCustomer.company_name || '').toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>person</span>
                    <span className="text-xs text-slate-500">Contact:</span>
                    <span className="text-sm text-slate-900 dark:text-white">{(selectedCustomer.first_name || '').toUpperCase()} {(selectedCustomer.last_name || '').toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>mail</span>
                    <span className="text-xs text-slate-500">Email:</span>
                    <a href={`mailto:${selectedCustomer.email}`} className="text-sm text-primary hover:underline">{selectedCustomer.email}</a>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>phone</span>
                    <span className="text-xs text-slate-500">Phone:</span>
                    <a href={`tel:${selectedCustomer.phone}`} className="text-sm text-primary hover:underline">{selectedCustomer.phone}</a>
                  </div>
                  {selectedCustomer.address && (
                    <div className="flex items-center gap-1.5 sm:col-span-2">
                      <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>location_on</span>
                      <span className="text-xs text-slate-500">Address:</span>
                      <span className="text-sm text-slate-900 dark:text-white">{(selectedCustomer.address || '').toUpperCase()}</span>
                    </div>
                  )}
                </div>
                {selectedCustomer.customer_notes && (
                  <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-slate-200/40 dark:border-slate-700/40">
                    <span className="material-symbols-outlined text-slate-500 mt-0.5" style={{ fontSize: '13px' }}>sticky_note_2</span>
                    <span className="text-xs text-slate-500">Notes:</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{(selectedCustomer.customer_notes || '').toUpperCase()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Repair Jobs */}
          <div>
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-sm">build_circle</span>
                </div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  Repair Jobs
                </h3>
                <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                  {loadingJobs ? '…' : customerJobs.length}
                </span>
              </div>
              {loadingJobs ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-3xl text-primary animate-spin">refresh</span>
                </div>
              ) : customerJobs.length === 0 ? (
                <div className="text-center py-12 px-5">
                  <div className="w-16 h-16 bg-slate-200/40 dark:bg-slate-700/40 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-3xl text-slate-500">build_circle</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No repair jobs yet</p>
                  <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">Create the first job for this customer</p>
                  {onNewJob && (
                    <button
                      onClick={() => onNewJob(selectedCustomer)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl text-sm font-bold transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Create First Job
                    </button>
                  )}
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-base">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60">
                        <th className="py-3 px-4 text-sm font-bold uppercase tracking-wide text-slate-500">Work Order #</th>
                        <th className="py-3 px-4 text-sm font-bold uppercase tracking-wide text-slate-500 hidden md:table-cell">Tools</th>
                        <th className="py-3 px-4 text-sm font-bold uppercase tracking-wide text-slate-500 hidden md:table-cell">Priority</th>
                        <th className="py-3 px-4 text-sm font-bold uppercase tracking-wide text-slate-500">Status</th>
                        <th className="py-3 px-4 text-sm font-bold uppercase tracking-wide text-slate-500 hidden md:table-cell">Created</th>
                        <th className="py-3 px-4 text-right text-sm font-bold uppercase tracking-wide text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                  {paginatedJobs.map((job) => (
                        <tr
                          key={job.id}
                          className="group cursor-pointer transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/30"
                          onClick={() => openWoDialog(job)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="text-slate-900 dark:text-white font-mono font-bold text-sm tracking-wide">{job.request_number}</div>
                            {job.source === 'online_request' && (
                              <span className="inline-flex items-center gap-1 text-xs text-sky-400 mt-0.5">
                                <span className="material-symbols-outlined text-sm" style={{fontSize:'13px'}}>public</span>
                                Online
                              </span>
                            )}
                            {job.source === 'phone_in' && (
                              <span className="inline-flex items-center gap-1 text-xs text-violet-400 mt-0.5">
                                <span className="material-symbols-outlined text-sm" style={{fontSize:'13px'}}>call</span>
                                Phone
                              </span>
                            )}
                            {job.source === 'email' && (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 mt-0.5">
                                <span className="material-symbols-outlined text-sm" style={{fontSize:'13px'}}>mail</span>
                                Email
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 hidden md:table-cell">
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 text-sm font-medium">
                              <span className="material-symbols-outlined text-slate-500" style={{fontSize:'16px'}}>build</span>
                              {job.tools.length} tool{job.tools.length !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 hidden md:table-cell">
                            <PriorityBadge priority={getHighestPriority(job.tools)} />
                          </td>
                          <td className="py-3.5 px-4">
                            {job.tools?.length === 1 ? (
                              <StatusBadge status={job.tools[0].status} />
                            ) : (() => {
                              const summary = getToolStatusSummary(job.tools).sort(byStatusPriority);
                              const tooltip = summary.map(s => `${REPAIR_STATUSES[s.status]?.label || s.status}: ${s.count}`).join(', ');
                              return (
                                <div
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50"
                                  title={tooltip}
                                >
                                  {summary.map(({ status }) => (
                                    <span
                                      key={status}
                                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${REPAIR_STATUSES[status]?.dot || 'bg-slate-400'}`}
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-sm hidden md:table-cell">{formatDate(job.created_at)}</td>
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                to={`/admin/repair-tracker?tab=jobs&job=${job.id}`}
                                onClick={(e) => {
                                  // Plain left-click opens the inline dialog; modified clicks and
                                  // right-click use the href to the full Repair Jobs view
                                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                                  e.preventDefault();
                                  openWoDialog(job);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/90 hover:bg-primary text-white rounded-lg text-sm font-bold transition-all shadow-sm"
                              >
                                <span className="material-symbols-outlined text-base">open_in_new</span>
                                Open
                              </Link>
                              <button
                                onClick={() => openPrintWorkOrder(job, settings?.contact, serviceAgreement)}
                                className="hidden sm:flex p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-200 hover:border-slate-300 dark:border-slate-600/50 dark:hover:border-slate-500 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-all items-center justify-center"
                                title="Print Work Order"
                              >
                                <span className="material-symbols-outlined text-base">print</span>
                              </button>
                              {job.email && (
                                <button
                                  onClick={() => setEmailModalJob(job)}
                                  className={`hidden sm:flex p-1.5 border rounded-lg transition-all items-center justify-center ${
                                    job.work_order_emails_sent?.length
                                      ? 'bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 border-green-200 hover:border-green-300 dark:border-green-800/40 dark:hover:border-green-700 text-green-600 dark:text-green-400'
                                      : 'bg-slate-100 hover:bg-blue-50 dark:bg-slate-700/60 dark:hover:bg-blue-900/30 border-slate-200 hover:border-blue-300 dark:border-slate-600/50 dark:hover:border-blue-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
                                  }`}
                                  title={job.work_order_emails_sent?.length
                                    ? `Work order emailed (${job.work_order_emails_sent.length}x) — click to resend`
                                    : 'Email work order to customer'}
                                >
                                  <span className="material-symbols-outlined text-base">
                                    {job.work_order_emails_sent?.length ? 'mark_email_read' : 'mail'}
                                  </span>
                                </button>
                              )}
                              {job.tools?.every(t => t.status === 'received') && (
                                <button
                                  onClick={() => setDeleteJobConfirm(job)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/60 border border-red-200 hover:border-red-300 dark:border-red-800/40 dark:hover:border-red-700 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-lg transition-all"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                  ))}
                    </tbody>
                  </table>
                </div>
                {/* Jobs Pagination */}
                <PaginationBar
                  currentPage={jobsPage}
                  totalItems={customerJobs.length}
                  pageSize={jobsPageSize}
                  onPageChange={setJobsPage}
                  onPageSizeChange={setJobsPageSize}

                />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Edit Customer Modal */}
        {editing && (
          <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 max-w-lg w-full my-4 sm:my-8 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-lg">edit</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Edit Customer</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditing(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">First Name *</label>
                    <input value={editForm.first_name} onChange={(e) => { const pos = e.target.selectionStart; setEditForm({ ...editForm, first_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Last Name *</label>
                    <input value={editForm.last_name} onChange={(e) => { const pos = e.target.selectionStart; setEditForm({ ...editForm, last_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Company</label>
                  <input value={editForm.company_name} onChange={(e) => { const pos = e.target.selectionStart; setEditForm({ ...editForm, company_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Email *</label>
                    <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Phone *</label>
                    <input value={editForm.phone} onChange={(e) => {
                      const input = e.target;
                      const cursorPos = input.selectionStart;
                      const prevLen = input.value.length;
                      const formatted = formatPhone(input.value);
                      setEditForm({ ...editForm, phone: formatted });
                      requestAnimationFrame(() => {
                        const adjusted = Math.max(0, cursorPos + (formatted.length - prevLen));
                        input.setSelectionRange(adjusted, adjusted);
                      });
                    }} placeholder="###-###-####" className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Address</label>
                  <input value={editForm.address} onChange={(e) => { const pos = e.target.selectionStart; setEditForm({ ...editForm, address: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Notes (Internal)</label>
                  <textarea
                    value={editForm.customer_notes}
                    onChange={(e) => { const pos = e.target.selectionStart; setEditForm({ ...editForm, customer_notes: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all resize-none"
                  />
                </div>
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button onClick={() => setEditing(false)} className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold text-sm transition-all">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={saving} className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">check</span>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-red-200 dark:border-red-900/40 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="h-0.5 bg-gradient-to-r from-red-600 via-red-400 to-red-600/30" />
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-center mb-5">
                  <div className="w-16 h-16 bg-red-100 border border-red-300 dark:bg-red-900/30 dark:border-red-800/40 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-red-600 dark:text-red-400">person_remove</span>
                  </div>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase text-center mb-2">Delete Customer</h3>
                <p className="text-slate-600 dark:text-slate-300 text-center mb-1">
                  Delete <span className="font-bold text-slate-900 dark:text-white">{deleteConfirm.company_name || `${deleteConfirm.first_name} ${deleteConfirm.last_name}`}</span>?
                </p>
                <p className="text-red-600/80 dark:text-red-300/80 text-sm text-center mb-6">Customers with linked repair jobs cannot be deleted.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold">Cancel</button>
                  <button onClick={handleDeleteCustomer} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 dark:bg-red-900/60 dark:hover:bg-red-800/80 border border-red-500 dark:border-red-700/50 text-white dark:text-red-200 rounded-xl font-bold">Delete</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── WO DETAIL DIALOG (shared with Repair Jobs tab) ── */}
        {woDialogJob && (
          <WorkOrderDialog
            job={woDialogJob}
            serviceAgreement={serviceAgreement}
            onClose={() => setWoDialogJob(null)}
            onJobUpdated={(updated) => {
              setWoDialogJob(updated);
              setCustomerJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
            }}
            onCustomerUpdated={(cust) => {
              setSelectedCustomer(prev => (prev && prev.id === cust.id ? cust : prev));
              setCustomers(prev => prev.map(c => c.id === cust.id ? cust : c));
            }}
          />
        )}

        {/* Delete Job Confirm */}
        {deleteJobConfirm && (
          <div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-red-200 dark:border-red-900/40 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="h-0.5 bg-gradient-to-r from-red-600 via-red-400 to-red-600/30" />
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-center mb-5">
                  <div className="w-16 h-16 bg-red-100 border border-red-300 dark:bg-red-900/30 dark:border-red-800/40 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-red-600 dark:text-red-400">delete_forever</span>
                  </div>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase text-center mb-2">Delete Repair Job</h3>
                <p className="text-slate-600 dark:text-slate-300 text-center mb-1">
                  Delete job <span className="font-bold text-slate-900 dark:text-white font-mono">{deleteJobConfirm.request_number}</span>?
                </p>
                <p className="text-red-600/80 dark:text-red-300/80 text-sm text-center mb-6">For correcting data entry mistakes only. All tool data and photos will be permanently removed.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteJobConfirm(null)} className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all">Cancel</button>
                  <button onClick={handleDeleteJob} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 dark:bg-red-900/60 dark:hover:bg-red-800/80 border border-red-500 dark:border-red-700/50 text-white dark:text-red-200 rounded-xl font-bold transition-all">
                    Delete Permanently
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Send Work Order Email Modal */}
        {emailModalJob && (
          <SendWorkOrderEmailModal
            job={emailModalJob}
            template={settings?.workOrderEmailTemplate}
            onClose={() => setEmailModalJob(null)}
            onSuccess={(sentTo) => {
              const jobId = emailModalJob.id;
              setEmailModalJob(null);
              showToast('success', `Work order emailed to ${sentTo}`);
              const emailRecord = { sent_at: new Date().toISOString(), sent_to: sentTo, success: true };
              setCustomerJobs(prev => prev.map(j => j.id === jobId
                ? { ...j, work_order_emails_sent: [...(j.work_order_emails_sent || []), emailRecord] }
                : j
              ));
              if (woDialogJob?.id === jobId) {
                setWoDialogJob(prev => ({ ...prev, work_order_emails_sent: [...(prev.work_order_emails_sent || []), emailRecord] }));
              }
            }}
          />
        )}

      </div>
    );
  }

  // ── List view ──
  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Customers</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage customer profiles and repair history</p>
        </div>
        <button
          onClick={() => { setShowNewForm(true); setNewForm(EMPTY_CUSTOMER); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl text-sm font-bold transition-all"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          <span className="hidden sm:inline">New Customer</span>
        </button>
      </div>

      {/* Search + Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Search by company, contact, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">All Customers</span>
            <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{customers.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-200/40 dark:bg-slate-700/40 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl text-slate-500">group</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {searchQuery ? 'No customers match your search' : 'No customers yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => { setShowNewForm(true); setNewForm(EMPTY_CUSTOMER); }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl text-sm font-bold transition-all"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Add First Customer
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-base text-left">
                <thead className="text-sm uppercase text-slate-500 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                  <tr>
                    {[
                      { field: 'company_name', label: 'Company / Contact', cls: '' },
                      { field: 'email', label: 'Email', cls: 'hidden md:table-cell' },
                      { field: 'phone', label: 'Phone', cls: 'hidden md:table-cell', sortable: false },
                      { field: 'address', label: 'Address', cls: 'hidden lg:table-cell', sortable: false },
                      { field: 'created_at', label: 'Since', cls: 'hidden lg:table-cell' },
                    ].map(({ field, label, cls, sortable = true }) => (
                      <th
                        key={field}
                        className={`py-3 px-4 font-bold ${sortable ? 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300' : ''} transition-colors ${cls}`}
                        onClick={sortable ? () => handleSort(field) : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {sortable && (
                            <span className="material-symbols-outlined text-xs opacity-50" style={{fontSize:'14px'}}>
                              {sortField === field ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                  {paginated.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      onClick={() => setSearchParams({ tab: 'customers', customer: customer.id })}
                    >
                      <td className="py-3.5 px-4 max-w-[200px] lg:max-w-[260px]">
                        <div className="text-slate-900 dark:text-white font-bold truncate">{customer.company_name ? customer.company_name.toUpperCase() : `${(customer.first_name || '').toUpperCase()} ${(customer.last_name || '').toUpperCase()}`}</div>
                        {customer.company_name && <div className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 truncate">{(customer.first_name || '').toUpperCase()} {(customer.last_name || '').toUpperCase()}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 hidden md:table-cell max-w-[180px] truncate">{customer.email}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 hidden md:table-cell">{customer.phone}</td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-sm hidden lg:table-cell max-w-[200px] truncate">{customer.address ? customer.address.toUpperCase() : <span className="text-slate-400 dark:text-slate-600">—</span>}</td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-sm hidden lg:table-cell">{formatDate(customer.created_at)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/admin/repair-tracker?tab=customers&customer=${customer.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200/60 dark:bg-slate-700/60 group-hover:bg-primary/20 group-hover:border-primary/30 hover:text-primary border border-slate-300 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-base">open_in_new</span>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <PaginationBar
              currentPage={currentPage}
              totalItems={customers.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}

            />
          </>
        )}
      </div>

      {/* New Customer Modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full my-4 sm:my-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
            <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700/60">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-lg">person_add</span>
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase flex-1">New Customer</h3>
              <button onClick={() => setShowNewForm(false)} className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newForm.first_name}
                    onChange={(e) => { const pos = e.target.selectionStart; setNewForm({ ...newForm, first_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newForm.last_name}
                    onChange={(e) => { const pos = e.target.selectionStart; setNewForm({ ...newForm, last_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  value={newForm.company_name}
                  onChange={(e) => { const pos = e.target.selectionStart; setNewForm({ ...newForm, company_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={newForm.email}
                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={newForm.phone}
                    onChange={(e) => {
                      const input = e.target;
                      const cursorPos = input.selectionStart;
                      const prevLen = input.value.length;
                      const formatted = formatPhone(input.value);
                      setNewForm({ ...newForm, phone: formatted });
                      requestAnimationFrame(() => {
                        const adjusted = Math.max(0, cursorPos + (formatted.length - prevLen));
                        input.setSelectionRange(adjusted, adjusted);
                      });
                    }}
                    placeholder="###-###-####"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Address</label>
                <input
                  type="text"
                  value={newForm.address}
                  onChange={(e) => { const pos = e.target.selectionStart; setNewForm({ ...newForm, address: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Internal Notes</label>
                <textarea
                  value={newForm.customer_notes}
                  onChange={(e) => { const pos = e.target.selectionStart; setNewForm({ ...newForm, customer_notes: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                  rows={3}
                  placeholder="e.g., Net 30, VIP customer"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewForm(false)} className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
