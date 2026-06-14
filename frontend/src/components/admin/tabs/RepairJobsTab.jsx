import React, { useState, useEffect, useRef, useCallback } from 'react';
import { repairsAPI, customersAPI, suppliersAPI, techniciansAPI, partsLibraryAPI, serviceAgreementAPI, sourcingAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import {
  REPAIR_STATUSES, REPAIR_STATUSES_LIST,
  getValidNextStatuses,
} from '../../../constants/repairStatuses';
import { StatusBadge, StepBadge, ProgressStepper } from '../shared/RepairStatusBadges';
import { openPrintWorkOrder } from '../PrintWorkOrder';
import { openPrintToolTag } from '../PrintToolTag';
import SendWorkOrderEmailModal from '../SendWorkOrderEmailModal';
import PaginationBar from '../shared/PaginationBar';
import { formatDatePacific, formatDateShortPacific, getTodayPacific } from '../../../utils/dateFormat';
import { useSettings } from '../../../contexts/SettingsContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getErrorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join('; ');
  return fallback;
};

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  if (digits.length > 3) return digits.slice(0, 3) + '-' + digits.slice(3);
  return digits;
}

const PRIORITIES = [
  { value: 'standard', label: 'Standard', color: 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' },
  { value: 'rush',     label: 'Rush',     color: 'bg-orange-100 text-orange-700 border-orange-400 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700' },
  { value: 'urgent',   label: 'Urgent',   color: 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
];

const getStatusConfig = (value) => REPAIR_STATUSES[value] || REPAIR_STATUSES['received'];
const getPriorityConfig = (value) => PRIORITIES.find(p => p.value === value) || PRIORITIES[0];

const PRIORITY_RANK = { urgent: 3, rush: 2, standard: 1 };
const getHighestPriority = (tools) => {
  if (!tools?.length) return 'standard';
  return tools.reduce((highest, tool) =>
    (PRIORITY_RANK[tool.priority] || 0) > (PRIORITY_RANK[highest] || 0) ? tool.priority : highest,
    'standard'
  );
};


const PriorityBadge = ({ priority }) => {
  const cfg = getPriorityConfig(priority);
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-bold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

const EMPTY_TOOL_BASE = {
  tool_type: '', brand: '', model_number: '', serial_number: '',
  quantity: 1, remarks: '', parts: [{ name: '', part_number: '', quantity: 1, price: '', supplier: '', order_link: '', notes: '', status: 'pending', tracking: '', eta: '' }],
  labour_hours: '', hourly_rate: '', priority: 'standard', warranty: false,
  zoho_ref: '', assigned_technician: '', estimated_completion: '',
  _pendingPhotos: [], // File objects staged during wizard — never sent to API
};

const getEmptyTool = () => ({
  ...EMPTY_TOOL_BASE,
  date_received: getTodayPacific(),
});

const getEmptyJob = () => ({
  customer_id: null, company_name: '', first_name: '', last_name: '', email: '', phone: '',
  address: '', customer_notes: '', source: 'drop_off', tools: [getEmptyTool()]
});

export default function RepairJobsTab({ preselectedCustomer, onPreselectedCustomerUsed, onCountUpdate, onGoToPartsLibrary, externalStatusFilter, onExternalStatusFilterApplied, externalTechFilter, onExternalTechFilterApplied, externalOpenNewJob, onExternalOpenNewJobHandled, externalOpenJobId, onExternalOpenJobHandled }) {
  const showToast = useToast();
  const { settings } = useSettings();
  const staleDays = settings?.staleDays ?? 3;
  const [serviceAgreement, setServiceAgreement] = useState(null);
  useEffect(() => {
    serviceAgreementAPI.get().then(setServiceAgreement).catch(() => {});
  }, []);
  const [lifetimeStats, setLifetimeStats] = useState(null);
  useEffect(() => {
    repairsAPI.lifetimeStats().then(setLifetimeStats).catch(() => {});
  }, []);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [retailPriceMap, setRetailPriceMap] = useState({}); // { tool_id: price | null }
  const libraryBrandsCache = useRef(null);
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Initialize filter from external prop if present (dashboard click-through)
  // Capture the initial prop in a ref so StrictMode double-mount doesn't lose it
  const SPECIAL_FILTERS = new Set(['__all__', '__attention__', '__overdue__', '__stuck__', '__ready_for_repair__']);
  const initialExternalStatus = useRef(externalStatusFilter);
  const ext = initialExternalStatus.current;
  const initStatus = ext && ext !== '' && !SPECIAL_FILTERS.has(ext) ? ext : '';
  const [statusFilter, setStatusFilter] = useState(initStatus);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [technicianFilter, setTechnicianFilter] = useState(() => localStorage.getItem('rt_technician_filter') || '');
  const [sortField, setSortField] = useState('smart');
  const [sortDir, setSortDir] = useState('desc');
  const [totalCount, setTotalCount] = useState(0);
  const [knownTechnicians, setKnownTechnicians] = useState([]);
  const searchDebounceRef = useRef(null);
  const [quickAdvancing, setQuickAdvancing] = useState(null); // toolId being quick-advanced
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState(new Set()); // Set of "jobId:toolId"
  const [batchTargetStatus, setBatchTargetStatus] = useState('');
  const [batchApplying, setBatchApplying] = useState(false);
  const [attentionFilter, setAttentionFilter] = useState(ext === '__attention__');
  // Specific dashboard filters: 'overdue' = past estimated_completion, 'stuck' = diagnosed/in_repair 24h+
  const initSpecial = ext === '__overdue__' ? 'overdue' : ext === '__stuck__' ? 'stuck' : ext === '__ready_for_repair__' ? 'ready_for_repair' : '';
  const [specialFilter, setSpecialFilter] = useState(initSpecial);

  // Detail view state
  const [jobCustomer, setJobCustomer] = useState(null); // linked customer record (single source of truth)
  const [editingJob, setEditingJob] = useState(false);
  const [savingJobEdit, setSavingJobEdit] = useState(false);
  const [jobEditForm, setJobEditForm] = useState({});
  const [statusUpdateModal, setStatusUpdateModal] = useState(null); // tool object
  const [statusUpdateForm, setStatusUpdateForm] = useState({ status: '', notes: '', estimated_completion: '' });
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState(null); // toolId pending confirm
  const removeConfirmTimer = useRef(null);
  const [addToolForm, setAddToolForm] = useState(null);
  const [addingTool, setAddingTool] = useState(false);
  const [editingToolId, setEditingToolId] = useState(null);
  const [toolEditForm, setToolEditForm] = useState(null);
  const [savingToolEdit, setSavingToolEdit] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(null); // toolId
  const detailCloseRef = useRef(null);

  // Work order email modal state
  const [emailModalJob, setEmailModalJob] = useState(null); // job to email; null = closed

  // New job form state
  const [newJobForm, setNewJobForm] = useState(getEmptyJob());
  const [savingJob, setSavingJob] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  // Two-step job creation: step 1 = customer, step 2 = tools
  const [newJobStep, setNewJobStep] = useState(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null); // existing customer selected
  const [showInlineCustomerForm, setShowInlineCustomerForm] = useState(false);

  // Open new job form, optionally pre-selecting a customer
  useEffect(() => {
    if (preselectedCustomer && !showNewJobForm) {
      setSelectedCustomerObj(preselectedCustomer);
      setNewJobForm({
        ...getEmptyJob(),
        customer_id: preselectedCustomer.id,
      });
      setNewJobStep(2);
      setShowNewJobForm(true);
      if (onPreselectedCustomerUsed) onPreselectedCustomerUsed();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedCustomer]);

  // Apply status filter pushed from the dashboard.
  // Initial value is handled by useState initializer above — this effect only
  // responds to prop changes AFTER mount (e.g. clicking another dashboard card
  // while already on the Jobs tab — which can't happen with current conditional
  // rendering, but is future-proof).
  const prevExternalStatus = useRef(externalStatusFilter);
  useEffect(() => {
    // On mount: clear the prop after a tick so StrictMode remount can still read it
    if (prevExternalStatus.current === externalStatusFilter) {
      if (externalStatusFilter && externalStatusFilter !== '') {
        setTimeout(() => { if (onExternalStatusFilterApplied) onExternalStatusFilterApplied(); }, 0);
      }
      return;
    }
    prevExternalStatus.current = externalStatusFilter;
    if (externalStatusFilter !== undefined && externalStatusFilter !== '') {
      const isAttention = externalStatusFilter === '__attention__';
      const isAll = externalStatusFilter === '__all__';
      const isOverdue = externalStatusFilter === '__overdue__';
      const isStuck = externalStatusFilter === '__stuck__';
      const isReadyForRepair = externalStatusFilter === '__ready_for_repair__';
      const isSpecial = isAttention || isAll || isOverdue || isStuck || isReadyForRepair;
      const newStatus = isSpecial ? '' : externalStatusFilter;

      setStatusFilter(newStatus);
      setAttentionFilter(isAttention);
      setSpecialFilter(isOverdue ? 'overdue' : isStuck ? 'stuck' : isReadyForRepair ? 'ready_for_repair' : '');
      setSearchQuery('');
      setPriorityFilter('');
      setCurrentPage(1);
      if (onExternalStatusFilterApplied) onExternalStatusFilterApplied();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalStatusFilter]);

  // Apply technician filter pushed from the dashboard
  const prevExternalTech = useRef(externalTechFilter);
  useEffect(() => {
    if (prevExternalTech.current === externalTechFilter) {
      if (externalTechFilter && externalTechFilter !== '') {
        setTimeout(() => { if (onExternalTechFilterApplied) onExternalTechFilterApplied(); }, 0);
      }
      return;
    }
    prevExternalTech.current = externalTechFilter;
    if (externalTechFilter !== undefined && externalTechFilter !== '') {
      setTechnicianFilter(externalTechFilter);
      setCurrentPage(1);
      if (onExternalTechFilterApplied) onExternalTechFilterApplied();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTechFilter]);

  // Open new job form triggered from the dashboard
  useEffect(() => {
    if (externalOpenNewJob) {
      setShowNewJobForm(true);
      setNewJobStep(1);
      setNewJobForm(getEmptyJob());
      setSelectedCustomerObj(null);
      setShowInlineCustomerForm(false);
      if (onExternalOpenNewJobHandled) onExternalOpenNewJobHandled();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenNewJob]);

  // Open a specific job triggered from the dashboard (e.g. clicking a work order in Pending Approvals)
  const initialOpenJobId = useRef(externalOpenJobId);
  useEffect(() => {
    const jobId = initialOpenJobId.current || externalOpenJobId;
    if (!jobId) return;
    initialOpenJobId.current = null;
    (async () => {
      try {
        const job = await repairsAPI.get(jobId);
        setSelectedJob(job);
      } catch (err) {
        showToast('error', 'Could not open work order');
      }
      if (onExternalOpenJobHandled) onExternalOpenJobHandled();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenJobId]);

  // Enrich parts with library stock data when a job is loaded or refreshed
  // Build a key from all library_part_ids missing stock data to detect when enrichment is needed
  const missingStockKey = React.useMemo(() => {
    if (!selectedJob?.tools?.length) return '';
    const ids = [];
    selectedJob.tools.forEach(t => (t.parts || []).forEach(p => {
      if (p.library_part_id && p._library_qty == null) ids.push(p.library_part_id);
    }));
    return ids.sort().join(',');
  }, [selectedJob]);

  useEffect(() => {
    if (!missingStockKey) return;
    const unique = [...new Set(missingStockKey.split(','))];
    let cancelled = false;
    (async () => {
      const stockMap = {};
      await Promise.all(unique.map(async (id) => {
        try {
          const lp = await partsLibraryAPI.getPart(id);
          stockMap[id] = { qty: lp.quantity_on_hand ?? 0, low: lp.low_stock ?? false };
        } catch { /* part may have been deleted */ }
      }));
      if (cancelled || !Object.keys(stockMap).length) return;
      setSelectedJob(prev => {
        if (!prev) return prev;
        return { ...prev, tools: prev.tools.map(t => ({
          ...t,
          parts: (t.parts || []).map(p =>
            p.library_part_id && stockMap[p.library_part_id]
              ? { ...p, _library_qty: stockMap[p.library_part_id].qty, _library_low_stock: stockMap[p.library_part_id].low }
              : p
          ),
        }))};
      });
    })();
    return () => { cancelled = true; };
  }, [missingStockKey]);

  // Pre-fetch library brands on mount so retail price lookups are instant
  useEffect(() => {
    partsLibraryAPI.listBrands().then(b => { libraryBrandsCache.current = b; }).catch(() => {});
  }, []);

  // Look up retail prices from parts library when a job is loaded
  useEffect(() => {
    if (!selectedJob?.tools?.length) { setRetailPriceMap({}); return; }
    let cancelled = false;
    (async () => {
      const brands = libraryBrandsCache.current || await partsLibraryAPI.listBrands().catch(() => []);
      if (!libraryBrandsCache.current) libraryBrandsCache.current = brands;
      // Group tools by brand to fetch models once per unique brand
      const brandGroups = {};
      for (const tool of selectedJob.tools) {
        if (!tool.brand || !tool.model_number) continue;
        const key = tool.brand.trim().toLowerCase();
        if (!brandGroups[key]) brandGroups[key] = { brand: brands.find(b => b.name.toLowerCase() === key), tools: [] };
        brandGroups[key].tools.push(tool);
      }
      const priceMap = {};
      await Promise.all(Object.values(brandGroups).map(async ({ brand, tools }) => {
        if (!brand) { tools.forEach(t => { priceMap[t.tool_id] = null; }); return; }
        const models = await partsLibraryAPI.listModels(brand.id).catch(() => []);
        for (const tool of tools) {
          const match = models.find(m => m.name.toLowerCase() === tool.model_number.trim().toLowerCase());
          priceMap[tool.tool_id] = match?.retail_price ?? null;
        }
      }));
      if (!cancelled) setRetailPriceMap(priceMap);
    })();
    return () => { cancelled = true; };
  }, [selectedJob?.id]);

  // Debounced customer search
  const searchCustomersDebounced = useCallback(
    (() => {
      let timer;
      return (query) => {
        clearTimeout(timer);
        if (!query.trim()) { setCustomerResults([]); return; }
        timer = setTimeout(async () => {
          setCustomerSearching(true);
          try {
            const results = await customersAPI.list({ search: query, limit: 8 });
            setCustomerResults(results);
          } catch {
            setCustomerResults([]);
          } finally {
            setCustomerSearching(false);
          }
        }, 300);
      };
    })(),
    []
  );

  const selectExistingCustomer = (customer) => {
    setSelectedCustomerObj(customer);
    setNewJobForm({
      ...newJobForm,
      customer_id: customer.id,
      company_name: customer.company_name || '',
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address || '',
    });
    setCustomerSearch('');
    setCustomerResults([]);
    setShowInlineCustomerForm(false);
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomerObj(null);
    setShowInlineCustomerForm(false);
    setNewJobForm({ ...newJobForm, customer_id: null, company_name: '', first_name: '', last_name: '', email: '', phone: '', address: '', customer_notes: '' });
  };

  const handleOpenNewJob = () => {
    setNewJobForm(getEmptyJob());
    setSelectedCustomerObj(null);
    setShowInlineCustomerForm(false);
    setCustomerSearch('');
    setCustomerResults([]);
    setNewJobStep(1);
    setShowNewJobForm(true);
  };

  const handleCloseNewJob = () => {
    setShowNewJobForm(false);
    setNewJobStep(1);
    setSelectedCustomerObj(null);
    setShowInlineCustomerForm(false);
    setNewJobForm(getEmptyJob());
  };

  // Initial load — state is pre-initialized from props (statusFilter, attentionFilter)
  useEffect(() => {
    fetchJobs(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server-side filters/sort: refetch when these change (reset to page 1)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setCurrentPage(1);
    fetchJobs(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, technicianFilter, sortField, sortDir]);

  // Attention filter: fetch all jobs (limit 200) when active, normal page when off
  const isFirstAttention = useRef(true);
  useEffect(() => {
    if (isFirstAttention.current) { isFirstAttention.current = false; return; }
    setCurrentPage(1);
    fetchJobs(1, pageSize, attentionFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attentionFilter]);

  // Special filter (overdue / stuck): fetch all + client filter
  const isFirstSpecial = useRef(true);
  useEffect(() => {
    if (isFirstSpecial.current) { isFirstSpecial.current = false; return; }
    setCurrentPage(1);
    fetchJobs(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialFilter]);

  // Debounced search: reset page and fetch after 350ms pause (skip initial empty value)
  const isFirstSearch = useRef(true);
  useEffect(() => {
    if (isFirstSearch.current && searchQuery === '') { isFirstSearch.current = false; return; }
    isFirstSearch.current = false;
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchJobs(1);
    }, 350);
    return () => clearTimeout(searchDebounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

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

  const handleTechnicianFilter = (value) => {
    setTechnicianFilter(value);
    if (value) localStorage.setItem('rt_technician_filter', value);
    else localStorage.removeItem('rt_technician_filter');
  };

  // Clean up remove-confirm timer on unmount
  useEffect(() => {
    return () => {
      if (removeConfirmTimer.current) clearTimeout(removeConfirmTimer.current);
    };
  }, []);

  // Focus close button when detail modal opens
  useEffect(() => {
    if (selectedJob && detailCloseRef.current) {
      detailCloseRef.current.focus();
    }
  }, [selectedJob]);

  // Escape key: close topmost open modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedPhoto) { setSelectedPhoto(null); return; }
      if (statusUpdateModal && !updatingStatus) { setStatusUpdateModal(null); return; }
      if (editingToolId && !savingToolEdit) { handleCancelToolEdit(); return; }
      if (addToolForm && !addingTool) { setAddToolForm(null); return; }
      if (editingJob) { setEditingJob(false); return; }
      if (deleteConfirmId) { setDeleteConfirmId(null); return; }
      if (selectedJob) { setSelectedJob(null); return; }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, statusUpdateModal, updatingStatus, editingToolId, savingToolEdit, addToolForm, addingTool, editingJob, deleteConfirmId, selectedJob]);

  const SERVER_SORT_FIELDS = new Set(['created_at', 'updated_at', 'request_number', 'smart']);

  const fetchJobs = async (page, size, attention) => {
    try {
      setLoading(true);
      const activePage = page ?? currentPage;
      const activeSize = size ?? pageSize;
      const isAttention = attention !== undefined ? attention : attentionFilter;
      const isBulkFilter = isAttention || specialFilter !== '';
      const params = isBulkFilter
        ? { skip: 0, limit: 200 }  // fetch all when client-side filter active
        : { skip: (activePage - 1) * activeSize, limit: activeSize };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (technicianFilter) params.assigned_technician = technicianFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      // Only pass sort to server for server-sortable fields
      if (SERVER_SORT_FIELDS.has(sortField)) {
        params.sort_by = sortField;
        params.sort_order = sortDir;
      }
      const { jobs: data, total } = await repairsAPI.list(params);
      setJobs(data);
      setTotalCount(isBulkFilter ? data.length : total);
      // Only update the tab badge with the unfiltered server total.
      // When any filter is active the count would reflect filtered results,
      // so we skip the update and let the parent's independent fetch own the count.
      const hasActiveFilter = isBulkFilter || statusFilter || priorityFilter || technicianFilter || searchQuery.trim();
      if (onCountUpdate && !hasActiveFilter) onCountUpdate(total);
      // Accumulate known technicians across pages for filter dropdown
      const newTechs = data.flatMap(j => j.tools.map(t => t.assigned_technician).filter(Boolean));
      setKnownTechnicians(prev => [...new Set([...prev, ...newTechs])].sort());
    } catch {
      showToast('error', 'Failed to load repair jobs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = formatDatePacific;
  const formatDateShort = formatDateShortPacific;

  // ── STALE / OVERDUE HELPERS ──────────────────────────
  const TERMINAL_STATUSES = new Set(['completed', 'abandoned', 'closed', 'declined', 'beyond_economical_repair']);
  const now = new Date();

  const getDaysSinceLastUpdate = (tool) => {
    const history = tool.status_history;
    if (!history?.length) return null;
    const raw = history[history.length - 1].timestamp;
    // Timestamps from MongoDB have no timezone suffix — treat them as UTC
    const ts = typeof raw === 'string' && !raw.endsWith('Z') && !raw.includes('+') ? raw + 'Z' : raw;
    const last = new Date(ts);
    return Math.floor((now - last) / (1000 * 60 * 60 * 24));
  };

  const isToolOverdue = (tool) => {
    if (!tool.estimated_completion || TERMINAL_STATUSES.has(tool.status)) return false;
    const raw = tool.estimated_completion;
    const ts = typeof raw === 'string' && !raw.endsWith('Z') && !raw.includes('+') ? raw + 'Z' : raw;
    return new Date(ts) < now;
  };

  const isToolStale = (tool) => {
    if (TERMINAL_STATUSES.has(tool.status)) return false;
    const days = getDaysSinceLastUpdate(tool);
    return days !== null && days >= staleDays;
  };

  const getJobAlertLevel = (job) => {
    if (job.tools.some(t => isToolOverdue(t))) return 'overdue';
    if (job.tools.some(t => isToolStale(t))) return 'stale';
    return null;
  };

  // ── SERVER-SIDE PAGINATION / CLIENT-SIDE SORT (non-server fields only) ──
  // Server handles: search, status, priority, technician filters, created_at/updated_at/request_number sort
  // Client handles: customer/tools/priority/status sort (over the current page only)
  const displayJobs = (() => {
    let base = jobs;
    if (attentionFilter) {
      base = base.filter(job => {
        const alert = getJobAlertLevel(job);
        if (alert === 'overdue' || alert === 'stale') return true;
        return job.tools.some(t => t.priority === 'rush' || t.priority === 'urgent');
      });
    }
    if (specialFilter === 'overdue') {
      base = base.filter(job => job.tools.some(t => isToolOverdue(t)));
    }
    if (specialFilter === 'stuck') {
      const STUCK_STATUSES = new Set(['diagnosed', 'in_repair']);
      base = base.filter(job => job.tools.some(t => {
        if (!STUCK_STATUSES.has(t.status)) return false;
        const days = getDaysSinceLastUpdate(t);
        // 24 hours = 1 day, but getDaysSinceLastUpdate uses Math.floor(days)
        // so anything >= 1 day qualifies
        const hours = (() => {
          const history = t.status_history;
          if (!history?.length) return 0;
          const raw = history[history.length - 1].timestamp;
          const ts = typeof raw === 'string' && !raw.endsWith('Z') && !raw.includes('+') ? raw + 'Z' : raw;
          return (now - new Date(ts)) / (1000 * 60 * 60);
        })();
        return hours >= 24;
      }));
    }
    if (specialFilter === 'ready_for_repair') {
      const READY_REPAIR_STATUSES = new Set(['approved', 'parts_pending']);
      const PARTS_OK = new Set(['in_stock', 'received', 'installed']);
      base = base.filter(job => job.tools.some(t => {
        if (!READY_REPAIR_STATUSES.has(t.status)) return false;
        const parts = t.parts || [];
        return parts.length === 0 || parts.every(p => PARTS_OK.has(p.status));
      }));
    }
    if (SERVER_SORT_FIELDS.has(sortField)) return base; // already sorted by server
    const sorted = [...base];
    sorted.sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'customer') {
        aVal = (a.company_name || `${a.first_name} ${a.last_name}`).toLowerCase();
        bVal = (b.company_name || `${b.first_name} ${b.last_name}`).toLowerCase();
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else if (sortField === 'tools') {
        aVal = a.tools.length; bVal = b.tools.length;
      } else if (sortField === 'priority') {
        aVal = PRIORITY_RANK[getHighestPriority(a.tools)] || 0;
        bVal = PRIORITY_RANK[getHighestPriority(b.tools)] || 0;
      } else if (sortField === 'status') {
        const getMinStep = (job) => {
          const steps = job.tools.map(t => REPAIR_STATUSES[t.status]?.step ?? 99);
          return Math.min(...steps);
        };
        aVal = getMinStep(a); bVal = getMinStep(b);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  })();

  // In client-filter mode: displayJobs is client-filtered (from all 200 fetched), so use its length
  const isBulkFiltered = attentionFilter || specialFilter !== '';
  const totalResults = isBulkFiltered ? displayJobs.length : totalCount;
  const paginatedJobs = displayJobs; // server already applied skip/limit

  // Summary of tool statuses for list view
  const getToolStatusSummary = (tools) => {
    if (!tools?.length) return null;
    const counts = {};
    tools.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  };

  // Priority order for dot sorting: most actionable first
  const STATUS_PRIORITY = ['abandoned', 'declined', 'beyond_economical_repair', 'received', 'diagnosed', 'parts_pending', 'in_repair', 'quoted', 'approved', 'ready', 'invoiced', 'completed', 'closed'];
  const byStatusPriority = (a, b) => {
    const ai = STATUS_PRIORITY.indexOf(a.status);
    const bi = STATUS_PRIORITY.indexOf(b.status);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  };

  // ── CREATE NEW JOB ───────────────────────────────────
  const handleNewJobToolChange = (idx, field, value) => {
    const updatedTools = newJobForm.tools.map((t, i) => i === idx ? { ...t, [field]: value } : t);
    setNewJobForm({ ...newJobForm, tools: updatedTools });
  };

  const handleAddToolToForm = () => {
    setNewJobForm({ ...newJobForm, tools: [...newJobForm.tools, getEmptyTool()] });
  };

  const handleRemoveToolFromForm = (idx) => {
    if (newJobForm.tools.length === 1) return;
    setNewJobForm({ ...newJobForm, tools: newJobForm.tools.filter((_, i) => i !== idx) });
  };

  // Silently save new parts to the Parts Library (fire-and-forget)
  const syncPartsToLibrary = async (tools) => {
    try {
      let libraryBrands = null;
      const getBrandId = async (brandName) => {
        if (!brandName?.trim()) return null;
        if (!libraryBrands) libraryBrands = await partsLibraryAPI.listBrands();
        const match = libraryBrands.find(b => b.name.toLowerCase() === brandName.trim().toLowerCase());
        if (match) return match.id;
        const created = await partsLibraryAPI.createBrand({ name: brandName.trim() });
        libraryBrands.push(created);
        return created.id;
      };

      const getModelId = async (brandId, modelName, toolType) => {
        if (!brandId || !modelName?.trim()) return [];
        try {
          const models = await partsLibraryAPI.listModels(brandId);
          const match = models.find(m => m.name.toLowerCase() === modelName.trim().toLowerCase());
          if (match) return [match.id];
          // Auto-create the model in the library
          try {
            const created = await partsLibraryAPI.createModel(brandId, { name: modelName.trim(), category: toolType?.trim() || null });
            return [created.id];
          } catch { return []; }
        } catch { return []; }
      };

      for (const tool of tools) {
        const brandId = await getBrandId(tool.brand);
        if (!brandId) continue;
        const modelIds = await getModelId(brandId, tool.model_number, tool.tool_type);
        for (const part of (tool.parts || [])) {
          if (!part.name?.trim() || part.library_part_id) continue;
          try {
            const created = await partsLibraryAPI.createPart({
              name: part.name.trim(),
              part_number: part.part_number?.trim() || part.name.trim().toUpperCase().replace(/\s+/g, '-'),
              brand_id: brandId,
              model_ids: modelIds,
              compatibility_group_ids: [],
              suggested_suppliers: part.supplier ? [part.supplier] : [],
              suggested_price: part.price ? Number(part.price) : null,
              notes: part.notes || null,
            });
            // Backfill library_part_id on the part
            if (created?.id) part.library_part_id = created.id;
          } catch {
            // Duplicate — try to find existing and backfill library_part_id
            try {
              const partNum = part.part_number?.trim() || part.name.trim().toUpperCase().replace(/\s+/g, '-');
              const existing = await partsLibraryAPI.search(partNum, 5);
              const match = existing.find(p => p.brand_id === brandId && p.part_number.toLowerCase() === partNum.toLowerCase());
              if (match) part.library_part_id = match.id;
            } catch { /* ignore */ }
          }
        }
      }
    } catch { /* never block the caller */ }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    setSavingJob(true);
    try {
      // Capture pending photos before stripping from payload
      const pendingPhotosByIndex = newJobForm.tools.map(t => t._pendingPhotos || []);

      const tools = newJobForm.tools.map(({ _pendingPhotos, date_received, ...t }) => ({
        ...t,
        quantity: parseInt(t.quantity) || 1,
        labour_hours: t.labour_hours ? parseFloat(t.labour_hours) : null,
        hourly_rate: t.hourly_rate ? parseFloat(t.hourly_rate) : null,
        serial_number: t.serial_number || null,
        remarks: t.remarks || null,
        parts: (t.parts || []).filter(p => p.name.trim()).map(({ _suggested_suppliers, ...p }) => p),
        zoho_ref: t.zoho_ref || null,
        assigned_technician: t.assigned_technician || null,
        estimated_completion: t.estimated_completion || null,
        date_received: date_received || getTodayPacific(),
      }));

      let payload;
      if (newJobForm.customer_id) {
        payload = {
          customer_id: newJobForm.customer_id,
          customer_notes: newJobForm.customer_notes || null,
          source: newJobForm.source,
          tools,
        };
      } else {
        payload = {
          company_name: newJobForm.company_name || null,
          first_name: newJobForm.first_name,
          last_name: newJobForm.last_name,
          email: newJobForm.email,
          phone: newJobForm.phone,
          address: newJobForm.address || null,
          customer_notes: newJobForm.customer_notes || null,
          source: newJobForm.source,
          tools,
        };
      }

      let created;
      try {
        created = await repairsAPI.create(payload);
      } catch (err) {
        showToast('error', getErrorMessage(err, 'Failed to create repair job'));
        setSavingJob(false);
        return;
      }

      // Silently save new parts to the Parts Library (fire-and-forget)
      syncPartsToLibrary(newJobForm.tools);

      // API succeeded — upload staged photos then update UI
      const hasPhotos = pendingPhotosByIndex.some(arr => arr.length > 0);
      let finalJob = created;
      if (hasPhotos) {
        setUploadingPhotos(true);
        const photoErrors = [];
        for (let i = 0; i < pendingPhotosByIndex.length; i++) {
          const files = pendingPhotosByIndex[i];
          if (!files.length) continue;
          const toolId = created.tools?.[i]?.tool_id;
          if (!toolId) continue;
          for (const file of files) {
            try {
              await repairsAPI.uploadToolPhoto(created.id, toolId, file);
            } catch {
              photoErrors.push(`${file.name} (Tool ${i + 1})`);
            }
          }
        }
        setUploadingPhotos(false);
        try { finalJob = await repairsAPI.get(created.id); } catch { /* use created */ }
        if (photoErrors.length > 0) {
          setJobs(prev => [finalJob, ...prev]);
          if (window.matchMedia('(min-width: 768px)').matches) openPrintWorkOrder(finalJob, settings?.contact, serviceAgreement);
          handleCloseNewJob();
          showToast('error', `Job ${created.request_number} created. Some photos failed: ${photoErrors.join(', ')}`);
          setSavingJob(false);
          if (finalJob?.email) setEmailModalJob(finalJob);
          return;
        }
      }

      setJobs(prev => [finalJob, ...prev]);
      if (window.matchMedia('(min-width: 768px)').matches) openPrintWorkOrder(finalJob, settings?.contact, serviceAgreement);
      handleCloseNewJob();
      showToast('success', `Repair job ${created.request_number} created successfully`);
      setSavingJob(false);
      if (finalJob?.email) setEmailModalJob(finalJob);
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to create repair job'));
    } finally {
      setSavingJob(false);
      setUploadingPhotos(false);
    }
  };

  // ── VIEW / EDIT JOB ──────────────────────────────────
  const openJob = async (job) => {
    try {
      const fresh = await repairsAPI.get(job.id);
      setSelectedJob(fresh);
      setEditingJob(false);
      // Fetch linked customer record (single source of truth)
      if (fresh.customer_id) {
        try {
          const cust = await customersAPI.get(fresh.customer_id);
          setJobCustomer(cust);
        } catch {
          setJobCustomer(null);
        }
      } else {
        setJobCustomer(null);
      }
    } catch {
      showToast('error', 'Failed to load repair job');
    }
  };

  const refreshSelectedJob = async () => {
    if (!selectedJob) return;
    try {
      const fresh = await repairsAPI.get(selectedJob.id);
      setSelectedJob(fresh);
      setJobs(jobs.map(j => j.id === fresh.id ? fresh : j));
    } catch {
      showToast('error', 'Failed to refresh job details');
    }
  };

  const handleSaveJobEdit = async () => {
    setSavingJobEdit(true);
    try {
      if (selectedJob.customer_id) {
        // Write 1: update customer record (single source of truth)
        let updatedCustomer;
        try {
          updatedCustomer = await customersAPI.update(selectedJob.customer_id, jobEditForm);
        } catch (err) {
          showToast('error', getErrorMessage(err, 'Failed to update customer'));
          return;
        }
        // Write 2: sync denormalized fields on the job
        const jobUpdate = {
          company_name: updatedCustomer.company_name,
          first_name: updatedCustomer.first_name,
          last_name: updatedCustomer.last_name,
          email: updatedCustomer.email,
          phone: updatedCustomer.phone,
          address: updatedCustomer.address,
          customer_notes: updatedCustomer.customer_notes,
        };
        let updatedJob;
        try {
          updatedJob = await repairsAPI.update(selectedJob.id, jobUpdate);
        } catch (err) {
          // Customer was already saved — report partial success
          setJobCustomer(updatedCustomer);
          showToast('success', 'Customer updated. Job sync failed — refresh to see latest.');
          setEditingJob(false);
          return;
        }
        setJobCustomer(updatedCustomer);
        setSelectedJob(updatedJob);
        setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
      } else {
        let updated;
        try {
          updated = await repairsAPI.update(selectedJob.id, jobEditForm);
        } catch (err) {
          showToast('error', getErrorMessage(err, 'Failed to update customer'));
          return;
        }
        setSelectedJob(updated);
        setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
      }
      setEditingJob(false);
      showToast('success', 'Customer details updated');
    } finally {
      setSavingJobEdit(false);
    }
  };

  // ── STATUS UPDATE ────────────────────────────────────
  const openStatusUpdate = (tool) => {
    setStatusUpdateModal(tool);
    const validNext = getValidNextStatuses(tool.status);
    // Pre-fill estimated_completion from the tool if set
    const existingDate = tool.estimated_completion ? tool.estimated_completion.split('T')[0] : '';
    setStatusUpdateForm({ status: validNext[0] || '', notes: '', estimated_completion: existingDate });
  };

  const handleStatusUpdate = async () => {
    if (!statusUpdateModal) return;
    setUpdatingStatus(true);
    let updated;
    try {
      const payload = {
        status: statusUpdateForm.status,
        notes: statusUpdateForm.notes || null,
        estimated_completion: statusUpdateForm.estimated_completion || null,
      };
      updated = await repairsAPI.updateToolStatus(selectedJob.id, statusUpdateModal.tool_id, payload);
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to update tool status'));
      setUpdatingStatus(false);
      return;
    }
    setSelectedJob(updated);
    setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    setStatusUpdateModal(null);
    showToast('success', 'Tool status updated');
    setUpdatingStatus(false);
  };

  // ── QUICK-ADVANCE STATUS ────────────────────────────
  const handleQuickAdvance = async (tool, targetStatus) => {
    setQuickAdvancing(tool.tool_id);
    const TERMINAL_FOR_ADVANCE = new Set(['completed', 'abandoned', 'closed', 'declined', 'beyond_economical_repair']);
    try {
      const updated = await repairsAPI.updateToolStatus(selectedJob.id, tool.tool_id, {
        status: targetStatus,
        notes: null,
        // Preserve existing estimated_completion unless moving to a terminal status
        estimated_completion: TERMINAL_FOR_ADVANCE.has(targetStatus) ? null : (tool.estimated_completion ? tool.estimated_completion.split('T')[0] : null),
      });
      setSelectedJob(updated);
      setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
      showToast('success', `Status → ${REPAIR_STATUSES[targetStatus]?.label || targetStatus}`);
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to update status'));
    } finally {
      setQuickAdvancing(null);
    }
  };

  // ── BATCH STATUS UPDATE ─────────────────────────────
  const toggleBatchSelect = (jobId, toolId) => {
    const key = `${jobId}:${toolId}`;
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleBatchApply = async () => {
    if (!batchTargetStatus || batchSelected.size === 0) return;
    setBatchApplying(true);
    try {
      const items = [...batchSelected].map(key => {
        const [job_id, tool_id] = key.split(':');
        return { job_id, tool_id, new_status: batchTargetStatus, notes: null };
      });
      const result = await repairsAPI.batchUpdateStatus(items);
      if (result.success_count > 0) {
        showToast('success', `Updated ${result.success_count} tool${result.success_count !== 1 ? 's' : ''}`);
        setBatchSelected(new Set());
        setBatchTargetStatus('');
        await fetchJobs(currentPage, pageSize);
      }
      if (result.failure_count > 0) {
        showToast('error', `${result.failure_count} update${result.failure_count !== 1 ? 's' : ''} failed`);
      }
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Batch update failed'));
    } finally {
      setBatchApplying(false);
    }
  };

  const handleExitBatchMode = () => {
    setBatchMode(false);
    setBatchSelected(new Set());
    setBatchTargetStatus('');
  };

  const handleSelectAllPage = () => {
    const pageKeys = paginatedJobs.flatMap(job =>
      job.tools.map(t => `${job.id}:${t.tool_id}`)
    );
    const allSelected = pageKeys.every(k => batchSelected.has(k));
    if (allSelected) {
      // Deselect all on this page
      setBatchSelected(prev => {
        const next = new Set(prev);
        pageKeys.forEach(k => next.delete(k));
        return next;
      });
    } else {
      setBatchSelected(prev => {
        const next = new Set(prev);
        pageKeys.forEach(k => next.add(k));
        return next;
      });
    }
  };

  const allPageSelected = paginatedJobs.length > 0 && paginatedJobs.flatMap(job =>
    job.tools.map(t => `${job.id}:${t.tool_id}`)
  ).every(k => batchSelected.has(k));

  // ── EDIT TOOL DETAILS ───────────────────────────────
  const handleStartToolEdit = (tool) => {
    setEditingToolId(tool.tool_id);
    const parts = tool.parts?.length > 0
      ? tool.parts.map(p => ({ ...p, price: p.price ?? p.unit_cost ?? '', supplier: p.supplier ?? '', order_link: p.order_link ?? '', notes: p.notes ?? '', tracking: p.tracking ?? '', eta: p.eta ? p.eta.split('T')[0] : '' }))
      : [{ name: '', part_number: '', quantity: 1, price: '', supplier: '', order_link: '', notes: '', status: 'pending', tracking: '', eta: '' }];
    setToolEditForm({
      tool_type: (tool.tool_type || '').toUpperCase(),
      brand: (tool.brand || '').toUpperCase(),
      model_number: (tool.model_number || '').toUpperCase(),
      serial_number: (tool.serial_number || '').toUpperCase(),
      quantity: tool.quantity || 1,
      remarks: tool.remarks || '',
      parts,
      labour_hours: tool.labour_hours ?? '',
      hourly_rate: tool.hourly_rate ?? '',
      priority: tool.priority || 'standard',
      warranty: tool.warranty || false,
      zoho_ref: tool.zoho_ref || '',
      assigned_technician: tool.assigned_technician || '',
      date_received: tool.date_received ? tool.date_received.split('T')[0] : '',
      estimated_completion: tool.estimated_completion ? tool.estimated_completion.split('T')[0] : '',
    });
    // Enrich parts with library stock data
    const libraryIds = [...new Set(parts.filter(p => p.library_part_id).map(p => p.library_part_id))];
    if (libraryIds.length) {
      Promise.all(libraryIds.map(id => partsLibraryAPI.getPart(id).catch(() => null)))
        .then(results => {
          const stockMap = {};
          results.forEach(lp => { if (lp) stockMap[lp.id] = { qty: lp.quantity_on_hand ?? 0, low: lp.low_stock ?? false }; });
          setToolEditForm(prev => prev ? ({
            ...prev,
            parts: prev.parts.map(p =>
              p.library_part_id && stockMap[p.library_part_id]
                ? { ...p, _library_qty: stockMap[p.library_part_id].qty, _library_low_stock: stockMap[p.library_part_id].low }
                : p
            ),
          }) : prev);
        });
    }
  };

  const handleCancelToolEdit = () => {
    setEditingToolId(null);
    setToolEditForm(null);
  };

  const handleSaveToolEdit = async () => {
    if (!editingToolId || !toolEditForm) return;
    setSavingToolEdit(true);
    let updated;
    try {
      const payload = {
        ...toolEditForm,
        quantity: parseInt(toolEditForm.quantity) || 1,
        labour_hours: toolEditForm.labour_hours ? parseFloat(toolEditForm.labour_hours) : null,
        hourly_rate: toolEditForm.hourly_rate ? parseFloat(toolEditForm.hourly_rate) : null,
        serial_number: toolEditForm.serial_number || null,
        remarks: toolEditForm.remarks || null,
        parts: (toolEditForm.parts || []).filter(p => p.name?.trim()).map(({ _suggested_suppliers, ...p }) => p),
        zoho_ref: toolEditForm.zoho_ref || null,
        assigned_technician: toolEditForm.assigned_technician || null,
        estimated_completion: toolEditForm.estimated_completion || null,
      };
      updated = await repairsAPI.updateTool(selectedJob.id, editingToolId, payload);
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to update tool'));
      setSavingToolEdit(false);
      return;
    }
    // Silently save new parts to library
    syncPartsToLibrary([toolEditForm]);

    setSelectedJob(updated);
    setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    setEditingToolId(null);
    setToolEditForm(null);
    showToast('success', 'Tool details updated');
    setSavingToolEdit(false);
  };

  // ── ADD TOOL TO EXISTING JOB ─────────────────────────
  const handleAddTool = async () => {
    if (!addToolForm) return;
    setAddingTool(true);
    let updated;
    try {
      const payload = {
        ...addToolForm,
        quantity: parseInt(addToolForm.quantity) || 1,
        labour_hours: addToolForm.labour_hours ? parseFloat(addToolForm.labour_hours) : null,
        hourly_rate: addToolForm.hourly_rate ? parseFloat(addToolForm.hourly_rate) : null,
        serial_number: addToolForm.serial_number || null,
        remarks: addToolForm.remarks || null,
        parts: (addToolForm.parts || []).filter(p => p.name.trim()).map(({ _suggested_suppliers, ...p }) => p),
        zoho_ref: addToolForm.zoho_ref || null,
        assigned_technician: addToolForm.assigned_technician || null,
        estimated_completion: addToolForm.estimated_completion || null,
      };
      updated = await repairsAPI.addTool(selectedJob.id, payload);
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to add tool'));
      setAddingTool(false);
      return;
    }
    // Silently save new parts to library
    syncPartsToLibrary([addToolForm]);

    setSelectedJob(updated);
    setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    setAddToolForm(null);
    showToast('success', 'Tool added to repair job');
    setAddingTool(false);
  };

  const handleRemoveTool = async (toolId) => {
    if (removeConfirmId !== toolId) {
      setRemoveConfirmId(toolId);
      clearTimeout(removeConfirmTimer.current);
      removeConfirmTimer.current = setTimeout(() => setRemoveConfirmId(null), 3000);
      return;
    }
    setRemoveConfirmId(null);
    clearTimeout(removeConfirmTimer.current);
    try {
      const updated = await repairsAPI.removeTool(selectedJob.id, toolId);
      setSelectedJob(updated);
      setJobs(jobs.map(j => j.id === updated.id ? updated : j));
      showToast('success', 'Tool removed');
    } catch {
      showToast('error', 'Failed to remove tool');
    }
  };

  // ── PHOTO UPLOAD ─────────────────────────────────────
  const handlePhotoUpload = async (toolId, file) => {
    setUploadingPhoto(toolId);
    try {
      const updated = await repairsAPI.uploadToolPhoto(selectedJob.id, toolId, file);
      setSelectedJob(updated);
      setJobs(jobs.map(j => j.id === updated.id ? updated : j));
      showToast('success', 'Photo uploaded');
    } catch {
      showToast('error', 'Failed to upload photo');
    } finally {
      setUploadingPhoto(null);
    }
  };

  // ── PHOTO DELETE ─────────────────────────────────────
  const handleDeletePhoto = async (toolId, filename) => {
    try {
      const updated = await repairsAPI.deleteToolPhoto(selectedJob.id, toolId, filename);
      setSelectedJob(updated);
      setJobs(jobs.map(j => j.id === updated.id ? updated : j));
      showToast('success', 'Photo deleted');
    } catch {
      showToast('error', 'Failed to delete photo');
    }
  };

  // ── DELETE JOB ───────────────────────────────────────
  const handleDeleteJob = async () => {
    if (!deleteConfirmId) return;
    try {
      await repairsAPI.delete(deleteConfirmId.id);
      setJobs(jobs.filter(j => j.id !== deleteConfirmId.id));
      setDeleteConfirmId(null);
      if (selectedJob?.id === deleteConfirmId.id) setSelectedJob(null);
      showToast('success', 'Repair job deleted');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to delete repair job';
      showToast('error', msg);
      setDeleteConfirmId(null);
    }
  };

  // ── RENDER ───────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Repair Jobs</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage work orders and tool repairs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNewJob}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="hidden sm:inline">New Repair Job</span>
          </button>
        </div>
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-5">
        {[
          { icon: 'construction', label: 'Tools Repaired', value: lifetimeStats ? lifetimeStats.total_tools_repaired.toLocaleString() : '—', sub: 'All time', color: 'indigo' },
          { icon: 'trending_up',  label: 'This Month',     value: lifetimeStats ? lifetimeStats.completed_this_month.toLocaleString() : '—', sub: 'Completed this month', color: 'violet' },
          { icon: 'avg_pace',     label: 'Avg Turnaround', value: lifetimeStats ? (lifetimeStats.avg_turnaround_days != null ? `${lifetimeStats.avg_turnaround_days}d` : '—') : '—', sub: 'Last 90 days', color: 'teal' },
          { icon: 'handyman',     label: 'Total Jobs',     value: lifetimeStats ? lifetimeStats.total_jobs_created.toLocaleString() : '—', sub: 'All time', color: 'slate' },
        ].map(card => {
          const colorMap = {
            indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-400',
            violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40 text-violet-700 dark:text-violet-400',
            teal:   'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/40 text-teal-700 dark:text-teal-400',
            slate:  'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400',
          };
          return (
            <div key={card.label} className={`flex flex-col gap-0.5 sm:gap-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border ${colorMap[card.color]}`}>
              <span className="material-symbols-outlined text-lg sm:text-xl opacity-70">{card.icon}</span>
              <div className="text-2xl sm:text-3xl font-black leading-none">{card.value}</div>
              <div className="text-[11px] sm:text-xs font-bold opacity-80 leading-tight">{card.label}</div>
              <div className="text-[10px] sm:text-xs opacity-50 leading-tight hidden sm:block">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-5 p-3 sm:p-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
        {/* Row 1: search (full width on mobile) */}
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0 sm:hidden">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">search</span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
          {/* Mobile: icon-only selects + batch */}
          <div className={`relative ${statusFilter ? 'ring-2 ring-primary/40 rounded-xl' : ''}`}>
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">label</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-2 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all appearance-none cursor-pointer w-10"
              title="Filter by status"
            >
              <option value="">All Statuses</option>
              {REPAIR_STATUSES_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className={`relative ${priorityFilter ? 'ring-2 ring-primary/40 rounded-xl' : ''}`}>
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">flag</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="pl-9 pr-2 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all appearance-none cursor-pointer w-10"
              title="Filter by priority"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {knownTechnicians.length > 0 && (
            <div className={`relative ${technicianFilter ? 'ring-2 ring-primary/40 rounded-xl' : ''}`}>
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">engineering</span>
              <select
                value={technicianFilter}
                onChange={(e) => handleTechnicianFilter(e.target.value)}
                className="pl-9 pr-2 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all appearance-none cursor-pointer w-10"
                title="Filter by technician"
              >
                <option value="">All Techs</option>
                {knownTechnicians.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <button
            onClick={() => { setAttentionFilter(f => !f); setSpecialFilter(''); }}
            className={`w-10 h-10 flex items-center justify-center rounded-xl border flex-shrink-0 transition-all ${
              attentionFilter
                ? 'bg-red-500 border-red-500 text-white shadow-md'
                : 'bg-white dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:border-red-400 dark:hover:border-red-600'
            }`}
            title={attentionFilter ? 'Show all jobs' : 'Show jobs needing attention (overdue, stale, rush/urgent)'}
          >
            <span className="material-symbols-outlined text-base">notification_important</span>
          </button>
          {specialFilter && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold ${
              specialFilter === 'ready_for_repair'
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {specialFilter === 'overdue' ? 'schedule' : specialFilter === 'stuck' ? 'block' : 'construction'}
              </span>
              {specialFilter === 'overdue' ? 'Overdue' : specialFilter === 'stuck' ? 'Stuck 24h+' : 'Ready for Repair'}
              <button onClick={() => setSpecialFilter('')} className={`ml-0.5 ${specialFilter === 'ready_for_repair' ? 'hover:text-blue-900 dark:hover:text-blue-100' : 'hover:text-amber-900 dark:hover:text-amber-100'}`}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </span>
          )}
          {(searchQuery || statusFilter || priorityFilter || technicianFilter || attentionFilter || specialFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter(''); setPriorityFilter(''); handleTechnicianFilter(''); setAttentionFilter(false); setSpecialFilter(''); }}
              className="w-10 h-10 flex items-center justify-center bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0"
              title="Clear all filters"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
          <button
            onClick={() => batchMode ? handleExitBatchMode() : setBatchMode(true)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl border flex-shrink-0 transition-all ${
              batchMode
                ? 'bg-primary/10 dark:bg-primary/20 border-primary/50 text-primary dark:text-blue-400'
                : 'bg-white dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-600'
            }`}
            title={batchMode ? 'Exit batch mode' : 'Batch update statuses'}
          >
            <span className="material-symbols-outlined text-base">checklist</span>
          </button>
        </div>
        {/* Desktop: single row, full labels */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">search</span>
            <input
              type="text"
              placeholder="Search company, contact, email, WO#, tool brand/model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
          <div className="relative min-w-[140px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">label</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              {REPAIR_STATUSES_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="relative min-w-[130px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">flag</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {knownTechnicians.length > 0 && (
            <div className="relative min-w-[140px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">engineering</span>
              <select
                value={technicianFilter}
                onChange={(e) => handleTechnicianFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
              >
                <option value="">All Technicians</option>
                {knownTechnicians.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <button
            onClick={() => { setAttentionFilter(f => !f); setSpecialFilter(''); }}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all flex-shrink-0 ${
              attentionFilter
                ? 'bg-red-500 border-red-500 text-white shadow-md'
                : 'bg-white dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:border-red-400 dark:hover:border-red-600'
            }`}
            title={attentionFilter ? 'Show all jobs' : 'Show jobs needing attention (overdue, stale, rush/urgent)'}
          >
            <span className="material-symbols-outlined text-base">notification_important</span>
            Attention
          </button>
          {specialFilter && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold ${
              specialFilter === 'ready_for_repair'
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {specialFilter === 'overdue' ? 'schedule' : specialFilter === 'stuck' ? 'block' : 'construction'}
              </span>
              {specialFilter === 'overdue' ? 'Overdue' : specialFilter === 'stuck' ? 'Stuck 24h+' : 'Ready for Repair'}
              <button onClick={() => setSpecialFilter('')} className={`ml-0.5 ${specialFilter === 'ready_for_repair' ? 'hover:text-blue-900 dark:hover:text-blue-100' : 'hover:text-amber-900 dark:hover:text-amber-100'}`}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </span>
          )}
          {(searchQuery || statusFilter || priorityFilter || technicianFilter || attentionFilter || specialFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter(''); setPriorityFilter(''); handleTechnicianFilter(''); setAttentionFilter(false); setSpecialFilter(''); }}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-bold transition-all"
            >
              <span className="material-symbols-outlined text-base">close</span>
              Clear filters
            </button>
          )}
          <button
            onClick={() => batchMode ? handleExitBatchMode() : setBatchMode(true)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all ${
              batchMode
                ? 'bg-primary/10 dark:bg-primary/20 border-primary/50 dark:border-primary/50 text-primary dark:text-blue-400'
                : 'bg-white dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-600'
            }`}
            title={batchMode ? 'Exit batch mode' : 'Batch update statuses'}
          >
            <span className="material-symbols-outlined text-base">checklist</span>
            {batchMode ? 'Exit Batch' : 'Batch'}
          </button>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
          <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
            Work Orders
            <span className="ml-2 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 font-bold">{totalResults}</span>
          </h3>
          {batchMode && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-primary dark:text-blue-400 font-bold">
                {batchSelected.size} tool{batchSelected.size !== 1 ? 's' : ''} selected
              </span>
              {paginatedJobs.length > 0 && (
                <button
                  onClick={handleSelectAllPage}
                  className="text-xs font-bold px-2 py-1 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/20 transition-colors"
                >
                  {allPageSelected ? 'Deselect page' : `Select all ${paginatedJobs.flatMap(j => j.tools).length} tools on page`}
                </button>
              )}
              {batchSelected.size > 0 && (
                <button
                  onClick={() => setBatchSelected(new Set())}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin">autorenew</span>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Loading repair jobs...</p>
          </div>
        ) : paginatedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-200/50 dark:bg-slate-700/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-slate-500">build_circle</span>
            </div>
            <div className="text-center">
              <p className="text-slate-900 dark:text-white font-bold text-base">
                {searchQuery || statusFilter || priorityFilter ? 'No jobs match your filters' : 'No repair jobs yet'}
              </p>
              <p className="text-slate-500 text-sm mt-1">
                {searchQuery || statusFilter || priorityFilter || technicianFilter
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create a new job or convert an online repair request'}
              </p>
            </div>
            {!searchQuery && !statusFilter && !priorityFilter && !technicianFilter && (
              <button
                onClick={handleOpenNewJob}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-primary/20"
              >
                <span className="material-symbols-outlined text-base">add</span>
                New Repair Job
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* ── MOBILE CARD LIST (< sm) ─────────────────────── */}
            <div className="sm:hidden divide-y divide-slate-200 dark:divide-slate-700/40">
              {paginatedJobs.map((job) => {
                const alertLevel = getJobAlertLevel(job);
                return (
                  <div
                    key={job.id}
                    onClick={() => !batchMode && openJob(job)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-slate-100 dark:active:bg-slate-700/40 transition-colors ${
                      alertLevel === 'overdue' ? 'bg-red-50/50 dark:bg-red-900/10' :
                      alertLevel === 'stale' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                    }`}
                  >
                    {/* Left: WO number */}
                    <div className="flex-shrink-0 w-12">
                      <div className="flex items-center gap-0.5">
                        <span className="font-mono font-bold text-xs text-slate-500 dark:text-slate-400">
                          {job.request_number?.split('-').pop()}
                        </span>
                        {alertLevel === 'overdue' && (
                          <span className="material-symbols-outlined text-red-500" style={{fontSize:'13px'}}>schedule</span>
                        )}
                        {alertLevel === 'stale' && (
                          <span className="material-symbols-outlined text-amber-500" style={{fontSize:'13px'}}>warning</span>
                        )}
                      </div>
                    </div>
                    {/* Middle: customer + status */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-white truncate uppercase leading-tight">
                        {job.company_name || `${job.first_name} ${job.last_name}`}
                      </div>
                      {job.company_name && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate uppercase">{job.first_name} {job.last_name}</div>
                      )}
                      <div className="mt-1">
                        {job.tools?.length === 1 ? (
                          <StatusBadge status={job.tools[0].status} />
                        ) : (() => {
                          const summary = (getToolStatusSummary(job.tools) || []).sort(byStatusPriority);
                          const tooltip = summary.map(s => `${REPAIR_STATUSES[s.status]?.label || s.status}: ${s.count}`).join(', ');
                          return (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50" title={tooltip}>
                              {summary.map(({ status }) => (
                                <span key={status} className={`w-2 h-2 rounded-full flex-shrink-0 ${REPAIR_STATUSES[status]?.dot || 'bg-slate-400'}`} />
                              ))}
                              <span className="text-xs text-slate-500">{job.tools.length} tools</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    {/* Right: open button */}
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openJob(job)}
                        className="p-2 bg-primary/90 hover:bg-primary text-white rounded-lg transition-all shadow-sm"
                        title="Open"
                      >
                        <span className="material-symbols-outlined text-base">open_in_new</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP TABLE (≥ sm) ────────────────────────── */}
            <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60">
                  {[
                    { field: 'request_number', label: 'WO #', cls: '' },
                    { field: 'customer', label: 'Customer', cls: '' },
                    { field: 'tools', label: 'Tools', cls: 'hidden md:table-cell' },
                    { field: 'priority', label: 'Priority', cls: 'hidden md:table-cell' },
                    { field: 'status', label: 'Status', cls: '' },
                    { field: 'created_at', label: 'Created / Due', cls: 'hidden lg:table-cell' },
                    { field: 'updated_at', label: 'Updated', cls: 'hidden xl:table-cell' },
                  ].map(({ field, label, cls }) => (
                    <th
                      key={field}
                      className={`py-3 px-3 sm:px-4 text-xs font-bold uppercase tracking-wide text-slate-500 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300 transition-colors ${cls}`}
                      onClick={() => handleSort(field)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <span className="material-symbols-outlined text-xs opacity-50" style={{fontSize:'14px'}}>
                          {sortField === field ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </span>
                    </th>
                  ))}
                  <th className="py-3 px-3 sm:px-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                    {batchMode ? (
                      <label className="inline-flex items-center gap-1.5 cursor-pointer" title={allPageSelected ? 'Deselect all on page' : 'Select all on page'}>
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={handleSelectAllPage}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="text-xs">All</span>
                      </label>
                    ) : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                {paginatedJobs.map((job) => {
                  const alertLevel = getJobAlertLevel(job);
                  return (
                  <React.Fragment key={job.id}>
                  <tr
                    className={`group hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors duration-150 ${batchMode ? '' : 'cursor-pointer'} ${
                      alertLevel === 'overdue' ? 'bg-red-50/50 dark:bg-red-900/10' :
                      alertLevel === 'stale' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                    }`}
                    onClick={() => !batchMode && openJob(job)}
                  >
                    <td className="py-3 px-3 sm:px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-900 dark:text-white font-mono font-bold text-xs sm:text-sm tracking-wide whitespace-nowrap">{job.request_number}</span>
                        {alertLevel === 'overdue' && (
                          <span className="material-symbols-outlined text-red-500 dark:text-red-400" style={{fontSize:'14px'}} title="Overdue">schedule</span>
                        )}
                        {alertLevel === 'stale' && (
                          <span className="material-symbols-outlined text-amber-500 dark:text-amber-400" style={{fontSize:'14px'}} title={`No update in ${staleDays}+ days`}>warning</span>
                        )}
                      </div>
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
                    <td className="py-3 px-3 sm:px-4 max-w-[180px] lg:max-w-[240px]">
                      <div className="text-slate-900 dark:text-white font-semibold text-sm truncate uppercase">{job.company_name || `${job.first_name} ${job.last_name}`}</div>
                      {job.company_name && <div className="text-slate-500 dark:text-slate-400 text-xs truncate uppercase">{job.first_name} {job.last_name}</div>}
                    </td>
                    <td className="py-3 px-3 sm:px-4 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 text-sm font-medium">
                        <span className="material-symbols-outlined text-slate-500" style={{fontSize:'16px'}}>build</span>
                        {job.tools.length} tool{job.tools.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 hidden md:table-cell">
                      <PriorityBadge priority={getHighestPriority(job.tools)} />
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      {job.tools?.length === 1 ? (
                        <StatusBadge status={job.tools[0].status} />
                      ) : (() => {
                        const summary = (getToolStatusSummary(job.tools) || []).sort(byStatusPriority);
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
                    <td className="py-3 px-3 sm:px-4 hidden lg:table-cell">
                      <div className="text-slate-500 text-sm">{formatDateShort(job.created_at)}</div>
                      {(() => {
                        const activeDates = job.tools
                          .filter(t => !TERMINAL_STATUSES.has(t.status) && t.estimated_completion)
                          .map(t => new Date(t.estimated_completion))
                          .sort((a, b) => a - b);
                        if (!activeDates.length) return null;
                        const earliest = activeDates[0];
                        const isOverdue = earliest < now;
                        return (
                          <div className={`flex items-center gap-1 text-xs mt-0.5 font-bold ${isOverdue ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            <span className="material-symbols-outlined" style={{fontSize:'12px'}}>{isOverdue ? 'schedule' : 'event'}</span>
                            {isOverdue ? 'Due ' : 'Est. '}{formatDateShort(earliest)}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-500 text-sm hidden xl:table-cell">{formatDateShort(job.updated_at)}</td>
                    <td className="py-3 px-3 sm:px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {!batchMode && (
                          <>
                            <button
                              onClick={() => openJob(job)}
                              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-primary/90 hover:bg-primary text-white rounded-lg text-sm font-bold transition-all shadow-sm"
                              title="Open"
                            >
                              <span className="material-symbols-outlined text-base">open_in_new</span>
                              <span className="hidden sm:inline">Open</span>
                            </button>
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
                                onClick={() => setDeleteConfirmId(job)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/60 border border-red-200 hover:border-red-300 dark:border-red-800/40 dark:hover:border-red-700 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-lg transition-all"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {batchMode && (
                    <tr className="bg-blue-50/60 dark:bg-blue-900/10 border-t border-blue-200 dark:border-slate-700/60">
                      <td colSpan={8} className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          {job.tools.map(tool => {
                            const key = `${job.id}:${tool.tool_id}`;
                            const isChecked = batchSelected.has(key);
                            const cfg = REPAIR_STATUSES[tool.status] || {};
                            return (
                              <label
                                key={tool.tool_id}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer text-xs font-semibold transition-all select-none ${
                                  isChecked
                                    ? 'bg-primary/10 dark:bg-primary/20 border-primary dark:border-primary/60 text-primary dark:text-blue-300'
                                    : 'bg-white dark:bg-slate-800/60 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-primary/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleBatchSelect(job.id, tool.tool_id)}
                                  className="accent-primary w-3.5 h-3.5"
                                />
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot || 'bg-slate-400'}`} />
                                <span className="uppercase">{tool.brand} {tool.model_number}</span>
                                <span className="opacity-60">— {cfg.label || tool.status}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {/* Pagination — hidden in attention mode (all results loaded at once) */}
        {!loading && !isBulkFiltered && (
          <PaginationBar
            currentPage={currentPage}
            totalItems={totalResults}
            pageSize={pageSize}
            onPageChange={(page) => { setCurrentPage(page); fetchJobs(page); }}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); fetchJobs(1, size); }}
          />
        )}
      </div>

      {/* ── BATCH ACTION BAR ────────────────────────────────── */}
      {batchMode && batchSelected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/30 border border-blue-400/20 animate-[slideInRight_0.2s_ease-out]">
          <span className="material-symbols-outlined text-lg">checklist</span>
          <span className="text-sm font-bold whitespace-nowrap">{batchSelected.size} tool{batchSelected.size !== 1 ? 's' : ''}</span>
          <div className="w-px h-5 bg-blue-400/40" />
          <select
            value={batchTargetStatus}
            onChange={(e) => setBatchTargetStatus(e.target.value)}
            className="bg-blue-700 border border-blue-400/40 text-white text-sm font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/30 cursor-pointer"
          >
            <option value="">Set status…</option>
            {Object.entries(REPAIR_STATUSES).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <button
            onClick={handleBatchApply}
            disabled={!batchTargetStatus || batchApplying}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-primary hover:bg-blue-50 rounded-xl text-sm font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {batchApplying ? (
              <span className="material-symbols-outlined text-base animate-spin">autorenew</span>
            ) : (
              <span className="material-symbols-outlined text-base">check</span>
            )}
            Apply
          </button>
          <button
            onClick={() => setBatchSelected(new Set())}
            className="p-1.5 text-blue-200 hover:text-white transition-colors"
            title="Clear selection"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* ── JOB DETAIL MODAL ─────────────────────────────── */}
      {selectedJob && (
        <div role="dialog" aria-modal="true" aria-labelledby="wo-dialog-title" className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] flex flex-col border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/50 animate-fadeInScale overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Colored top-border accent */}
            <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30 flex-shrink-0" />
            {/* Header */}
            <div className="flex-shrink-0 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/60 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">build_circle</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="wo-dialog-title" className="text-base sm:text-lg font-black text-slate-900 dark:text-white"><span className="hidden sm:inline">Work Order </span><span className="text-primary font-mono">{selectedJob.request_number}</span></h3>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">Created {formatDateShort(selectedJob.created_at)}</span>
                    {selectedJob.source === 'online_request' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-700/50">
                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>public</span>
                        <span className="hidden sm:inline">Online Request</span>
                      </span>
                    )}
                    {selectedJob.source === 'drop_off' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600/50">
                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>store</span>
                        <span className="hidden sm:inline">Drop-off</span>
                      </span>
                    )}
                    {selectedJob.source === 'phone_in' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700/50">
                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>call</span>
                        <span className="hidden sm:inline">Phone-in</span>
                      </span>
                    )}
                    {selectedJob.source === 'email' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700/50">
                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>mail</span>
                        <span className="hidden sm:inline">Email</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEmailModalJob(selectedJob)}
                  className={`w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                    selectedJob?.work_order_emails_sent?.length
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                  title={selectedJob?.work_order_emails_sent?.length
                    ? `Work order emailed (${selectedJob.work_order_emails_sent.length}x) — click to resend`
                    : 'Email work order to customer'}
                >
                  <span className="material-symbols-outlined" style={{fontSize:'18px'}}>
                    {selectedJob?.work_order_emails_sent?.length ? 'mark_email_read' : 'mail'}
                  </span>
                </button>
                <button
                  onClick={() => openPrintWorkOrder(selectedJob, settings?.contact, serviceAgreement)}
                  className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                  title="Print / Save as PDF"
                >
                  <span className="material-symbols-outlined" style={{fontSize:'18px'}}>print</span>
                </button>
                <button ref={detailCloseRef} onClick={() => setSelectedJob(null)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Customer Info */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40">
                  <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '14px' }}>person</span>
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Customer</h4>
                  <div className="ml-auto">
                    <button onClick={() => { const src = jobCustomer || selectedJob; setEditingJob(true); setJobEditForm({
                      company_name: src.company_name || '',
                      first_name: src.first_name || '',
                      last_name: src.last_name || '',
                      email: src.email,
                      phone: src.phone,
                      address: src.address || '',
                      customer_notes: src.customer_notes || '',
                    }); }} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold transition-all">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span>
                      Edit
                    </button>
                  </div>
                </div>
                {(
                  <div className="px-4 py-2.5">
                    {(() => { const cust = jobCustomer || selectedJob; return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                          {cust.company_name && (
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>business</span>
                              <span className="text-xs text-slate-500">Company:</span>
                              <span className="text-sm text-slate-900 dark:text-white font-bold truncate uppercase">{cust.company_name}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>person</span>
                            <span className="text-xs text-slate-500">Contact:</span>
                            <span className="text-sm text-slate-900 dark:text-white uppercase">{cust.first_name} {cust.last_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>mail</span>
                            <span className="text-xs text-slate-500">Email:</span>
                            <a href={`mailto:${cust.email}`} className="text-sm text-primary hover:underline">{cust.email}</a>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>phone</span>
                            <span className="text-xs text-slate-500">Phone:</span>
                            <a href={`tel:${cust.phone}`} className="text-sm text-primary hover:underline">{cust.phone}</a>
                          </div>
                          {cust.address && (
                            <div className="flex items-center gap-1.5 sm:col-span-2">
                              <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>location_on</span>
                              <span className="text-xs text-slate-500">Address:</span>
                              <span className="text-sm text-slate-900 dark:text-white truncate uppercase">{cust.address}</span>
                            </div>
                          )}
                        </div>
                        {cust.customer_notes && (
                          <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-slate-200/40 dark:border-slate-700/40">
                            <span className="material-symbols-outlined text-slate-500 mt-0.5" style={{ fontSize: '13px' }}>sticky_note_2</span>
                            <span className="text-xs text-slate-500">Notes:</span>
                            <span className="text-xs text-slate-600 dark:text-slate-300 uppercase">{cust.customer_notes}</span>
                          </div>
                        )}
                      </>
                    ); })()}
                  </div>
                )}
              </div>

              {/* Tools */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-base">build</span>
                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Tools ({selectedJob.tools.length})</h4>
                  </div>
                  <button
                    onClick={() => setAddToolForm(getEmptyTool())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/90 hover:bg-primary text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Tool
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedJob.tools.map((tool, idx) => (
                    <div key={tool.tool_id} className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-sm">
                      {/* Tool Header — colored left border by status */}
                      <div className="p-4 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-black text-slate-500 dark:text-slate-400">
                              {idx + 1}
                            </div>
                            <div>
                              {onGoToPartsLibrary ? (
                                <button
                                  onClick={() => onGoToPartsLibrary(tool.brand, tool.model_number)}
                                  className="font-bold text-slate-900 dark:text-white text-base uppercase text-left group/pl flex items-center gap-1.5 hover:text-primary dark:hover:text-blue-400 transition-colors"
                                  title="View in Parts Library"
                                >
                                  {tool.brand} {tool.model_number}
                                  <span className="material-symbols-outlined text-sm opacity-0 group-hover/pl:opacity-60 transition-opacity">inventory_2</span>
                                </button>
                              ) : (
                                <div className="font-bold text-slate-900 dark:text-white text-base uppercase">
                                  {tool.brand} {tool.model_number}
                                </div>
                              )}
                              <div className="text-sm text-slate-500 mt-0.5 uppercase">
                                {tool.tool_type}{tool.quantity > 1 && ` × ${tool.quantity}`}
                                {tool.serial_number && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>S/N: {tool.serial_number}</>}
                                {retailPriceMap[tool.tool_id] != null && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>Retail: ${parseFloat(retailPriceMap[tool.tool_id]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
                                {tool.estimated_completion && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>Est: {formatDateShort(tool.estimated_completion)}</>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StepBadge status={tool.status} />
                            <span className="hidden sm:block"><PriorityBadge priority={tool.priority} /></span>
                            {tool.warranty && (
                              <span className="hidden sm:inline px-2.5 py-1 rounded-full text-sm font-bold bg-teal-100 text-teal-700 border border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/50">Warranty</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          {tool.warranty && (
                            <span className="sm:hidden px-2.5 py-1 rounded-full text-sm font-bold bg-teal-100 text-teal-700 border border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/50">Warranty</span>
                          )}
                          <button
                            onClick={() => openStatusUpdate(tool)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary hover:text-blue-700 dark:hover:text-blue-300 rounded-lg text-sm font-bold transition-all"
                          >
                            <span className="material-symbols-outlined text-base">update</span>
                            Update Status
                          </button>
                          {editingToolId !== tool.tool_id && (
                            <button
                              onClick={() => handleStartToolEdit(tool)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm font-bold transition-all"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => openPrintToolTag(selectedJob, tool, idx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm font-bold transition-all"
                            title="Print tool tag"
                          >
                            <span className="material-symbols-outlined text-base">label</span>
                            Print Tag
                          </button>
                          {selectedJob.tools.length > 1 && (
                            <button
                              onClick={() => handleRemoveTool(tool.tool_id)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
                                removeConfirmId === tool.tool_id
                                  ? 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/60'
                                  : 'bg-slate-200/40 dark:bg-slate-700/40 hover:bg-red-50 dark:hover:bg-red-900/30 border-slate-200 dark:border-slate-600/40 hover:border-red-300 dark:hover:border-red-700/40 text-slate-500 hover:text-red-600 dark:hover:text-red-400'
                              }`}
                            >
                              {removeConfirmId === tool.tool_id ? 'Confirm Remove?' : (
                                <span className="material-symbols-outlined text-base">delete</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Current Status bar (always visible) */}
                      <div className="px-4 pt-3 pb-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700/60">
                        {isToolOverdue(tool) && (
                          <div className="flex items-center gap-1.5 mb-2 px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-400 font-bold">
                            <span className="material-symbols-outlined" style={{fontSize:'14px'}}>schedule</span>
                            Overdue — estimated completion was {formatDateShort(tool.estimated_completion)}
                          </div>
                        )}
                        {!isToolOverdue(tool) && isToolStale(tool) && (
                          <div className="flex items-center gap-1.5 mb-2 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-xs text-amber-700 dark:text-amber-400 font-bold">
                            <span className="material-symbols-outlined" style={{fontSize:'14px'}}>warning</span>
                            No status update in {getDaysSinceLastUpdate(tool)} days
                          </div>
                        )}
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <StatusBadge status={tool.status} />
                          <div className="text-sm text-slate-500">
                            Received: {formatDateShort(tool.date_received)}
                            {tool.date_completed && ` · Completed: ${formatDateShort(tool.date_completed)}`}
                          </div>
                        </div>
                        <div className="md:hidden"><ProgressStepper status={tool.status} compact /></div>
                        <div className="hidden md:block"><ProgressStepper status={tool.status} /></div>
                      </div>

                      {/* Tool Details — 2-column grid: left (Remarks + Labour/Tech/Zoho), right (Parts wider) */}
                      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3 text-sm">
                          {/* Left column — Remarks stacked above Labour/Tech/Zoho */}
                          <div className="space-y-3">
                            {/* Remarks */}
                            <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200/40 dark:border-slate-700/40">
                              <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'12px'}}>Remarks</span>
                              <p className={`mt-1 leading-relaxed whitespace-pre-wrap ${tool.remarks ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>{tool.remarks || 'No remarks'}</p>
                            </div>
                            {/* Labour / Technician / Zoho */}
                            <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200/40 dark:border-slate-700/40 space-y-1.5">
                              <div>
                                <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'12px'}}>Labour</span>
                                <p className={`mt-0.5 ${tool.labour_hours || tool.hourly_rate ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>
                                  {tool.labour_hours || tool.hourly_rate ? (
                                    <>
                                      {tool.labour_hours ? `${tool.labour_hours} hrs` : '—'}
                                      {tool.hourly_rate ? ` @ $${tool.hourly_rate}/hr` : ''}
                                      {tool.labour_hours && tool.hourly_rate && (
                                        <> = <span className="text-slate-900 dark:text-white font-bold">${(parseFloat(tool.labour_hours) * parseFloat(tool.hourly_rate)).toFixed(2)}</span></>
                                      )}
                                    </>
                                  ) : 'Not set'}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'12px'}}>Technician</span>
                                <p className={`mt-0.5 ${tool.assigned_technician ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>{tool.assigned_technician || 'Unassigned'}</p>
                              </div>
                              <div>
                                <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'12px'}}>Zoho Ref</span>
                                <p className={`mt-0.5 ${tool.zoho_ref ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>{tool.zoho_ref || 'None'}</p>
                              </div>
                            </div>
                          </div>
                          {/* Right column — Parts (wider) */}
                          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200/40 dark:border-slate-700/40">
                            <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'12px'}}>Parts {tool.parts?.filter(p => p.name?.trim()).length > 0 && `(${tool.parts.filter(p => p.name?.trim()).length})`}</span>
                            {tool.parts && tool.parts.filter(p => p.name?.trim()).length > 0 ? (
                              <div className="mt-1 space-y-1">
                                {tool.parts.map((p, realPi) => p.name?.trim() ? (
                                  <div key={realPi} className="bg-slate-50 dark:bg-slate-900/60 rounded-md px-2 py-1.5 border border-slate-200/30 dark:border-slate-700/30 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-slate-700 dark:text-slate-200 font-medium flex-1 uppercase">{p.name}{p.part_number ? ` - ${p.part_number}` : ''}</span>
                                      <span className="text-slate-500 text-xs">×{p.quantity}</span>
                                      {(p.price != null && p.price !== '') && (
                                        <span className="text-slate-700 dark:text-slate-300 text-xs font-medium">${(parseFloat(p.price) * (p.quantity || 1)).toFixed(2)}</span>
                                      )}
                                      <span className={`px-1.5 py-px rounded-full font-bold ${
                                        p.status === 'installed' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                                        p.status === 'received' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400' :
                                        p.status === 'ordered' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                                        p.status === 'in_stock' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                                        'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                      }`} style={{fontSize:'11px'}}>{p.status.replace(/_/g, ' ')}</span>
                                      {p.library_part_id && p._library_qty != null && (
                                        <span title={p._library_qty > 0 ? (p._library_low_stock ? `Low stock (${p._library_qty})` : `${p._library_qty} in stock`) : 'Out of stock'} className={`flex-shrink-0 ${
                                          p._library_qty > 0
                                            ? p._library_low_stock ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'
                                            : 'text-red-500 dark:text-red-400'
                                        }`}>
                                          <span className="material-symbols-outlined" style={{fontSize:'14px'}}>inventory_2</span>
                                        </span>
                                      )}
                                      {/* Sourcing toggle button */}
                                      <button
                                        type="button"
                                        title={p.needs_sourcing ? 'Remove from sourcing queue' : 'Flag for sourcing'}
                                        onClick={async () => {
                                          try {
                                            await repairsAPI.togglePartSourcing(selectedJob.id, tool.tool_id, realPi);
                                            const updated = await repairsAPI.get(selectedJob.id);
                                            setSelectedJob(updated);
                                          } catch (e) {
                                            console.error('Failed to toggle sourcing flag', e);
                                          }
                                        }}
                                        className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-full font-bold transition-colors ${
                                          p.needs_sourcing
                                            ? 'bg-primary/20 text-primary hover:bg-red-500/20 hover:text-red-400'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:bg-primary/20 hover:text-primary'
                                        }`}
                                        style={{fontSize:'11px'}}
                                      >
                                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>local_shipping</span>
                                        {p.needs_sourcing ? 'sourcing' : 'source'}
                                      </button>
                                    </div>
                                    {p.supplier && <div className="text-xs text-slate-500 dark:text-slate-400">{p.supplier}</div>}
                                    {p.order_link?.trim() && (
                                      <div className="text-xs">
                                        <a href={p.order_link.startsWith('http') ? p.order_link : `https://${p.order_link}`} target="_blank" rel="noopener noreferrer"
                                          className="text-primary dark:text-primary/80 hover:underline inline-flex items-center gap-0.5">
                                          <span className="material-symbols-outlined" style={{fontSize:'12px'}}>link</span>
                                          Order link
                                          <span className="material-symbols-outlined" style={{fontSize:'11px'}}>open_in_new</span>
                                        </a>
                                      </div>
                                    )}
                                    {['ordered','received','installed'].includes(p.status) && (p.tracking || p.eta) && (
                                      <div className="flex items-center gap-2 flex-wrap" style={{fontSize:'11px'}}>
                                        {p.tracking && <span className="text-slate-500">Track: <span className="text-slate-700 dark:text-slate-300 font-medium">{p.tracking}</span></span>}
                                        {p.eta && <span className="text-slate-500">ETA: <span className="text-slate-700 dark:text-slate-300 font-medium">{new Date(p.eta).toLocaleDateString('en-CA')}</span></span>}
                                      </div>
                                    )}
                                  </div>
                                ) : null)}
                                {(() => {
                                  const total = tool.parts.filter(p => p.name?.trim() && (p.price != null && p.price !== '')).reduce((sum, p) => sum + parseFloat(p.price) * (p.quantity || 1), 0);
                                  return total > 0 ? (
                                    <div className="flex justify-end pt-1.5 border-t border-slate-200 dark:border-slate-700/40">
                                      <span className="text-sm text-slate-500">Parts total: <span className="text-base font-bold text-slate-900 dark:text-white">${total.toFixed(2)}</span></span>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            ) : (
                              <p className="mt-1 text-slate-400 dark:text-slate-600 italic">No parts</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Photos */}
                      <div className="px-4 pb-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-500 text-base">photo_library</span>
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Photos</span>
                            {tool.photos?.length > 0 && (
                              <span className="text-sm font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">{tool.photos.length}</span>
                            )}
                          </div>
                          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm font-bold cursor-pointer transition-all">
                            <span className="material-symbols-outlined text-base">upload</span>
                            {uploadingPhoto === tool.tool_id ? 'Uploading...' : 'Add Photo'}
                            <input type="file" accept="image/*" className="hidden"
                              onChange={(e) => e.target.files?.[0] && handlePhotoUpload(tool.tool_id, e.target.files[0])}
                            />
                          </label>
                        </div>
                        {tool.photos?.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                            {tool.photos.map((photo, pidx) => (
                              <div key={pidx} className="aspect-square cursor-pointer group relative rounded-lg overflow-hidden" onClick={() => setSelectedPhoto(photo)}>
                                <img
                                  src={photo.startsWith('http') ? photo : `${API_BASE_URL}/uploads/${photo}`}
                                  alt={`Photo ${pidx + 1}`}
                                  className="w-full h-full object-cover border border-slate-300 dark:border-slate-700 group-hover:border-primary/60 transition-all duration-200"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="material-symbols-outlined text-slate-900 dark:text-white text-lg">zoom_in</span>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeletePhoto(tool.tool_id, photo); }}
                                  className="absolute top-1 right-1 w-5 h-5 bg-red-600/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                  title="Delete photo"
                                >
                                  <span className="material-symbols-outlined text-slate-900 dark:text-white" style={{ fontSize: '14px' }}>close</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Status History */}
                      {tool.status_history?.length > 0 && (
                        <details className="border-t border-slate-200 dark:border-slate-700/60 group/hist">
                          <summary className="px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors select-none list-none">
                            <span className="material-symbols-outlined text-slate-500 text-base group-open/hist:rotate-90 transition-transform">chevron_right</span>
                            <span className="material-symbols-outlined text-slate-500 text-base">history</span>
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status History</span>
                            <span className="text-sm font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full ml-1">{tool.status_history.length}</span>
                          </summary>
                          <div className="px-4 pb-4 pt-2">
                            <div className="relative pl-5">
                              {/* Vertical connector line */}
                              <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-200/60 dark:bg-slate-700/60" />
                              <div className="space-y-3">
                                {[...tool.status_history].reverse().map((entry, hidx) => (
                                  <div key={hidx} className="relative flex items-start gap-3 text-sm">
                                    {/* Timeline dot */}
                                    <div className={`absolute -left-3.5 mt-1.5 w-2 h-2 rounded-full flex-shrink-0 border-2 border-slate-200 dark:border-slate-800 ${
                                      REPAIR_STATUSES[entry.status]?.dot || 'bg-slate-500'
                                    }`} />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <StatusBadge status={entry.status} />
                                        <span className="text-slate-500">{formatDate(entry.timestamp)}</span>
                                      </div>
                                      {entry.notes && (
                                        <p className="mt-1 text-slate-500 dark:text-slate-400 italic pl-0.5">"{entry.notes}"</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STATUS UPDATE MODAL ──────────────────────────── */}
      {statusUpdateModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Top accent */}
            <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700/60">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-lg">sync</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">Update Status</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs truncate uppercase">{statusUpdateModal.brand} {statusUpdateModal.model_number}{statusUpdateModal.tool_type ? ` — ${statusUpdateModal.tool_type}` : ''}</p>
              </div>
              <button onClick={() => setStatusUpdateModal(null)} className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Current:</span>
                  <StatusBadge status={statusUpdateModal.status} />
                </div>
                {getValidNextStatuses(statusUpdateModal.status).length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    <span className="material-symbols-outlined text-slate-500 text-base">info</span>
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">This tool is in a terminal status and cannot be changed.</p>
                  </div>
                ) : (
                  <>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">New Status</label>
                    <select
                      value={statusUpdateForm.status}
                      onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    >
                      {REPAIR_STATUSES_LIST
                        .filter(s => getValidNextStatuses(statusUpdateModal.status).includes(s.value))
                        .map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={statusUpdateForm.notes}
                  onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, notes: e.target.value })}
                  placeholder="e.g., Parts arrived from supplier"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Est. Completion Date (optional)</label>
                <input
                  type="date"
                  value={statusUpdateForm.estimated_completion}
                  onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, estimated_completion: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setStatusUpdateModal(null)} disabled={updatingStatus} className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all disabled:opacity-50">Cancel</button>
              <button onClick={handleStatusUpdate} disabled={updatingStatus || getValidNextStatuses(statusUpdateModal.status).length === 0} className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                {updatingStatus ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT TOOL MODAL ─────────────────────────── */}
      {(addToolForm || (editingToolId && toolEditForm)) && (() => {
        const isEdit = !!editingToolId;
        const formData = isEdit ? toolEditForm : addToolForm;
        const setFormData = isEdit ? setToolEditForm : setAddToolForm;
        const busy = isEdit ? savingToolEdit : addingTool;
        const handleClose = () => { if (busy) return; isEdit ? handleCancelToolEdit() : setAddToolForm(null); };
        const handleSubmit = isEdit ? handleSaveToolEdit : handleAddTool;
        return (
        <div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full my-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Top accent */}
            <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700/60">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-lg">{isEdit ? 'edit' : 'build'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{isEdit ? 'Edit Tool' : 'Add Tool to Job'}</h3>
                {isEdit && <p className="text-xs text-slate-500 mt-0.5 truncate uppercase">{formData.brand} {formData.model_number}</p>}
              </div>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <ToolForm toolData={formData} onChange={setFormData} />
              <div className="flex gap-3 mt-6">
                <button onClick={handleClose} disabled={busy} className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all disabled:opacity-50">Cancel</button>
                <button onClick={handleSubmit} disabled={busy} className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                  {busy ? (isEdit ? 'Saving...' : 'Adding...') : (isEdit ? 'Save Changes' : 'Add Tool')}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── NEW JOB FORM MODAL (TWO-STEP) ───────────────── */}
      {showNewJobForm && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full my-4 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Top accent */}
            <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
            {/* Header */}
            <div className="flex-shrink-0 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/60 px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 z-10">
              {/* Row 1: Title + Close */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-sm">add_circle</span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">New Repair Job</h3>
                </div>
                <button onClick={handleCloseNewJob} className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              {/* Row 2: 4-step progress stepper */}
              <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                <div className="flex items-center gap-0 min-w-[280px] max-w-sm mx-auto">
                  {[
                    { n: 1, label: 'Customer' },
                    { n: 2, label: 'Tool Info' },
                    { n: 3, label: 'Job Details' },
                    { n: 4, label: 'Cost & Schedule' },
                  ].map(({ n, label }, i) => {
                    const done = newJobStep > n;
                    const active = newJobStep === n;
                    return (
                      <div key={n} className="flex items-center gap-0 flex-1 min-w-0">
                        {i > 0 && <div className={`h-0.5 flex-1 transition-all duration-300 ${done ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                        <button
                          type="button"
                          onClick={() => done && setNewJobStep(n)}
                          className={`flex flex-col items-center gap-1 flex-shrink-0 ${done ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-all duration-300 ${
                            done ? 'bg-primary text-white hover:bg-blue-500' :
                            active ? 'bg-primary text-white shadow-md shadow-primary/30' :
                            'bg-slate-200 dark:bg-slate-700 text-slate-500 border border-slate-300 dark:border-slate-600'
                          }`}>
                            {active && <span className="absolute inset-0 rounded-full ring-4 ring-primary/20 animate-pulse" />}
                            {done ? <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span> : n}
                          </div>
                          <span className={`text-[10px] font-bold text-center leading-tight ${active ? 'text-blue-400' : done ? 'text-slate-500' : 'text-slate-400 dark:text-slate-600'}`}>{label}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 1: Customer Selection */}
            {newJobStep === 1 && (
              <div className="p-4 sm:p-6 space-y-5">
                {!selectedCustomerObj ? (
                  <>
                    {/* Search existing */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Search Existing Customer</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-lg">search</span>
                        <input
                          type="text"
                          placeholder="Search by name, company, or email..."
                          value={customerSearch}
                          onChange={(e) => { setCustomerSearch(e.target.value); searchCustomersDebounced(e.target.value); }}
                          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {customerSearching && (
                          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-lg animate-spin">autorenew</span>
                        )}
                      </div>

                      {/* Search results */}
                      {customerResults.length > 0 && (
                        <div className="mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                          {customerResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectExistingCustomer(c)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-200 dark:hover:bg-slate-700 border-b border-slate-300 dark:border-slate-700 last:border-0 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-slate-900 dark:text-white font-bold text-sm">{c.first_name} {c.last_name}</p>
                                  {c.company_name && <p className="text-slate-500 dark:text-slate-400 text-xs">{c.company_name}</p>}
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">{c.email}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {customerSearch.length >= 2 && !customerSearching && customerResults.length === 0 && (
                        <p className="text-slate-500 text-xs mt-2">No customers found matching "{customerSearch}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                      <span className="text-slate-500 text-xs font-bold uppercase">or</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    </div>

                    {/* New customer toggle */}
                    {!showInlineCustomerForm ? (
                      <button
                        type="button"
                        onClick={() => setShowInlineCustomerForm(true)}
                        className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-primary text-slate-500 dark:text-slate-400 hover:text-primary rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Create New Customer
                      </button>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-600 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase">New Customer</h4>
                          <button type="button" onClick={() => setShowInlineCustomerForm(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </div>
                        <div className="space-y-3">
                          {/* First Name | Last Name */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                First Name<span className="text-red-400 ml-1">*</span>
                              </label>
                              <input
                                value={newJobForm.first_name || ''}
                                onChange={(e) => { const pos = e.target.selectionStart; setNewJobForm({ ...newJobForm, first_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                Last Name<span className="text-red-400 ml-1">*</span>
                              </label>
                              <input
                                value={newJobForm.last_name || ''}
                                onChange={(e) => { const pos = e.target.selectionStart; setNewJobForm({ ...newJobForm, last_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                          </div>
                          {/* Company Name */}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                              Company Name
                            </label>
                            <input
                              placeholder="Optional"
                              value={newJobForm.company_name || ''}
                              onChange={(e) => { const pos = e.target.selectionStart; setNewJobForm({ ...newJobForm, company_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          {/* Email | Phone */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                Email<span className="text-red-400 ml-1">*</span>
                              </label>
                              <input
                                type="email"
                                value={newJobForm.email || ''}
                                onChange={(e) => setNewJobForm({ ...newJobForm, email: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                Phone (###-###-####)<span className="text-red-400 ml-1">*</span>
                              </label>
                              <input
                                value={newJobForm.phone || ''}
                                onChange={(e) => {
                                  const input = e.target;
                                  const cursorPos = input.selectionStart;
                                  const prevLen = input.value.length;
                                  const formatted = formatPhone(input.value);
                                  setNewJobForm({ ...newJobForm, phone: formatted });
                                  requestAnimationFrame(() => {
                                    const adjusted = Math.max(0, cursorPos + (formatted.length - prevLen));
                                    input.setSelectionRange(adjusted, adjusted);
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                          </div>
                          {/* Address */}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                              Address
                            </label>
                            <input
                              placeholder="Optional"
                              value={newJobForm.address || ''}
                              onChange={(e) => { const pos = e.target.selectionStart; setNewJobForm({ ...newJobForm, address: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          {/* Internal Notes */}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Internal Notes</label>
                            <textarea
                              value={newJobForm.customer_notes || ''}
                              onChange={(e) => setNewJobForm({ ...newJobForm, customer_notes: e.target.value })}
                              rows={2}
                              placeholder="Optional"
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Selected customer summary card */
                  <div className="bg-white dark:bg-slate-900 rounded-lg border border-primary/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary text-lg">person</span>
                        </div>
                        <div>
                          <p className="text-slate-900 dark:text-white font-bold">{selectedCustomerObj.first_name} {selectedCustomerObj.last_name}</p>
                          {selectedCustomerObj.company_name && <p className="text-slate-500 dark:text-slate-400 text-sm">{selectedCustomerObj.company_name}</p>}
                          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{selectedCustomerObj.email} · {selectedCustomerObj.phone}</p>
                        </div>
                      </div>
                      <button type="button" onClick={clearSelectedCustomer} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex-shrink-0" title="Change customer">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 1 actions */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button type="button" onClick={handleCloseNewJob} className="px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Validate: either a selected customer or inline form with required fields
                      if (selectedCustomerObj) {
                        setNewJobStep(2);
                      } else if (showInlineCustomerForm) {
                        if (!newJobForm.first_name || !newJobForm.last_name || !newJobForm.email || !newJobForm.phone) {
                          showToast('error', 'First name, last name, email, and phone are required');
                          return;
                        }
                        setNewJobStep(2);
                      } else {
                        showToast('error', 'Please select or create a customer first');
                      }
                    }}
                    className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    Next: Add Tools
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* Customer summary bar — shown on steps 2–4 */}
            {newJobStep >= 2 && (
              <div className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700/60 px-6 py-2.5 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-lg">person</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white text-sm font-bold truncate uppercase">
                    {selectedCustomerObj ? `${selectedCustomerObj.first_name} ${selectedCustomerObj.last_name}` : `${newJobForm.first_name} ${newJobForm.last_name}`}
                    {(selectedCustomerObj?.company_name || newJobForm.company_name) && (
                      <span className="text-slate-500 dark:text-slate-400 font-normal"> — {selectedCustomerObj?.company_name || newJobForm.company_name}</span>
                    )}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{selectedCustomerObj?.email || newJobForm.email}</p>
                </div>
                <button type="button" onClick={() => setNewJobStep(1)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-colors flex items-center gap-1 flex-shrink-0">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Change
                </button>
              </div>
            )}

            {/* Step 2: Tool Info (identification + photos) */}
            {newJobStep === 2 && (
              <div className="p-4 sm:p-6 space-y-6">
                {/* Tools */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tools to Repair</h4>
                    <button type="button" onClick={handleAddToolToForm}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold transition-all">
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Another Tool
                    </button>
                  </div>
                  <div className="space-y-4">
                    {newJobForm.tools.map((tool, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-primary font-black text-xs">{idx + 1}</span>
                            </div>
                            <h5 className="font-bold text-slate-900 dark:text-white text-sm">Tool {idx + 1}</h5>
                          </div>
                          {newJobForm.tools.length > 1 && (
                            <button type="button" onClick={() => handleRemoveToolFromForm(idx)} className="text-slate-500 hover:text-red-400 transition-colors">
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </div>
                        <div className="p-4">
                          <ToolForm toolData={tool} onChange={(updated) => handleNewJobToolChange(idx, null, null, updated)} isNewJobForm wizardStep={2} idx={idx} newJobForm={newJobForm} setNewJobForm={setNewJobForm} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setNewJobStep(1)} className="px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const missing = newJobForm.tools.some(t => !t.tool_type?.trim() || !t.brand?.trim() || !t.model_number?.trim());
                      if (missing) {
                        showToast('error', 'Tool type, brand, and model number are required for each tool');
                        return;
                      }
                      setNewJobStep(3);
                    }}
                    className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    Next: Job Details
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Job Details (description + parts) */}
            {newJobStep === 3 && (
              <div className="p-4 sm:p-6 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">How did this job come in?</label>
                  <select
                    value={newJobForm.source}
                    onChange={(e) => setNewJobForm({ ...newJobForm, source: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="drop_off">Drop-off</option>
                    <option value="online_request">Online Request</option>
                    <option value="phone_in">Phone-in</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Tools to Repair</h4>
                  <div className="space-y-4">
                    {newJobForm.tools.map((tool, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-black text-xs">{idx + 1}</span>
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900 dark:text-white text-sm">Tool {idx + 1}</h5>
                            <p className="text-slate-500 dark:text-slate-400 text-xs">{tool.brand} {tool.model_number}</p>
                          </div>
                        </div>
                        <div className="p-4">
                          <ToolForm toolData={tool} onChange={(updated) => handleNewJobToolChange(idx, null, null, updated)} isNewJobForm wizardStep={3} idx={idx} newJobForm={newJobForm} setNewJobForm={setNewJobForm} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setNewJobStep(2)} className="px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                    Back
                  </button>
                  <button type="button" onClick={() => setNewJobStep(4)} className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                    Next: Cost & Schedule
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Cost & Schedule + submit */}
            {newJobStep === 4 && (
              <form onSubmit={handleCreateJob} className="p-4 sm:p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Tools to Repair</h4>
                  <div className="space-y-4">
                    {newJobForm.tools.map((tool, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-black text-xs">{idx + 1}</span>
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900 dark:text-white text-sm">Tool {idx + 1}</h5>
                            <p className="text-slate-500 dark:text-slate-400 text-xs">{tool.brand} {tool.model_number}</p>
                          </div>
                        </div>
                        <div className="p-4">
                          <ToolForm toolData={tool} onChange={(updated) => handleNewJobToolChange(idx, null, null, updated)} isNewJobForm wizardStep={4} idx={idx} newJobForm={newJobForm} setNewJobForm={setNewJobForm} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setNewJobStep(3)} className="px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                    Back
                  </button>
                  <button type="submit" disabled={savingJob} className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingJob ? (
                      uploadingPhotos ? 'Uploading Photos...' : 'Creating...'
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        Create Repair Job
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[70] bg-black/90 dark:bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <button className="absolute top-4 right-4 text-slate-900 dark:text-white hover:text-slate-600 dark:hover:text-slate-300 transition-colors" onClick={() => setSelectedPhoto(null)}>
            <span className="material-symbols-outlined text-4xl">close</span>
          </button>
          <img
            src={selectedPhoto.startsWith('http') ? selectedPhoto : `${API_BASE_URL}/uploads/${selectedPhoto}`}
            alt="Tool photo"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Edit Customer Modal (from WO dialog) */}
      {editingJob && (
        <div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 max-w-lg w-full shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg">edit</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Edit Customer</h3>
                  <p className="text-xs text-slate-500 mt-0.5 uppercase">{jobEditForm.first_name} {jobEditForm.last_name}</p>
                </div>
              </div>
              <button onClick={() => setEditingJob(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">First Name *</label>
                  <input value={jobEditForm.first_name || ''} onChange={(e) => { const pos = e.target.selectionStart; setJobEditForm({ ...jobEditForm, first_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Last Name *</label>
                  <input value={jobEditForm.last_name || ''} onChange={(e) => { const pos = e.target.selectionStart; setJobEditForm({ ...jobEditForm, last_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Company</label>
                <input value={jobEditForm.company_name || ''} onChange={(e) => { const pos = e.target.selectionStart; setJobEditForm({ ...jobEditForm, company_name: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Email *</label>
                  <input type="email" value={jobEditForm.email || ''} onChange={(e) => setJobEditForm({ ...jobEditForm, email: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Phone *</label>
                  <input value={jobEditForm.phone || ''} onChange={(e) => {
                    const input = e.target;
                    const cursorPos = input.selectionStart;
                    const prevLen = input.value.length;
                    const formatted = formatPhone(input.value);
                    setJobEditForm({ ...jobEditForm, phone: formatted });
                    requestAnimationFrame(() => {
                      const adjusted = Math.max(0, cursorPos + (formatted.length - prevLen));
                      input.setSelectionRange(adjusted, adjusted);
                    });
                  }} placeholder="###-###-####" className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Address</label>
                <input value={jobEditForm.address || ''} onChange={(e) => { const pos = e.target.selectionStart; setJobEditForm({ ...jobEditForm, address: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Notes (Internal)</label>
                <textarea value={jobEditForm.customer_notes || ''} onChange={(e) => { const pos = e.target.selectionStart; setJobEditForm({ ...jobEditForm, customer_notes: e.target.value.toUpperCase() }); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }} rows={3} placeholder="Internal notes (not visible to customer)" className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all resize-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setEditingJob(false)} className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold text-sm transition-all">
                Cancel
              </button>
              <button onClick={handleSaveJobEdit} disabled={savingJobEdit} className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-500 shadow-md shadow-primary/20 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none">
                {savingJobEdit ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-sm">check</span>}
                {savingJobEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-red-200 dark:border-red-900/40 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Top accent — red */}
            <div className="h-0.5 bg-gradient-to-r from-red-600 via-red-400 to-red-600/30" />
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-center mb-5">
                <div className="w-16 h-16 bg-red-100 border border-red-300 dark:bg-red-900/30 dark:border-red-800/40 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-red-600 dark:text-red-400">delete_forever</span>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase text-center mb-2">Delete Repair Job</h3>
              <p className="text-slate-600 dark:text-slate-300 text-center mb-1">
                Delete job <span className="font-bold text-slate-900 dark:text-white font-mono">{deleteConfirmId.request_number}</span>?
              </p>
              <p className="text-red-600/80 dark:text-red-300/80 text-sm text-center mb-6">For correcting data entry mistakes only. All tool data and photos will be permanently removed.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-900 dark:text-white rounded-xl font-bold transition-all">Cancel</button>
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
            // Mark job as emailed locally so the icon updates immediately
            const emailRecord = { sent_at: new Date().toISOString(), sent_to: sentTo, success: true };
            setJobs(prev => prev.map(j => j.id === jobId
              ? { ...j, work_order_emails_sent: [...(j.work_order_emails_sent || []), emailRecord] }
              : j
            ));
            if (selectedJob?.id === jobId) {
              setSelectedJob(prev => ({ ...prev, work_order_emails_sent: [...(prev.work_order_emails_sent || []), emailRecord] }));
            }
          }}
        />
      )}
    </div>
  );
}

// ── TOOL FORM (reusable for new job form and add tool modal) ──
// wizardStep: 2 = Tool Identification + Photos, 3 = Job Details + Parts, 4 = Labour & Scheduling
// Omit wizardStep (or isNewJobForm=false) to render all sections (add tool modal / edit mode)
function ToolForm({ toolData, onChange, isNewJobForm, wizardStep, idx, newJobForm, setNewJobForm }) {
  const handleChange = (fieldOrObj, value) => {
    // Support both handleChange('field', value) and handleChange({ field1: v1, field2: v2 })
    const updates = typeof fieldOrObj === 'string' ? { [fieldOrObj]: value } : fieldOrObj;
    if (isNewJobForm) {
      setNewJobForm(prev => ({
        ...prev,
        tools: prev.tools.map((t, i) => i === idx ? { ...t, ...updates } : t),
      }));
    } else {
      onChange({ ...toolData, ...updates });
    }
  };

  // Supplier dropdown state
  const [suppliers, setSuppliers] = useState([]);
  const refreshSuppliers = () => suppliersAPI.getAll().then(setSuppliers).catch(() => {});

  // Parts Library autocomplete
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [partSuggestionsLoading, setPartSuggestionsLoading] = useState(false);
  const [activeSuggestionPi, setActiveSuggestionPi] = useState(null);
  const [suggestionAnchor, setSuggestionAnchor] = useState(null); // 'name' | 'partnum'
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const partSearchTimer = useRef(null);

  // Suggested parts for this model
  const [suggestedParts, setSuggestedParts] = useState([]);
  const [suggestedPartsLoading, setSuggestedPartsLoading] = useState(false);
  const [showSuggestedParts, setShowSuggestedParts] = useState(false);

  const loadSuggestedParts = async () => {
    if (showSuggestedParts) { setShowSuggestedParts(false); return; }
    // Find model ID from library brands/models
    const brand = data.brand?.trim();
    const model = data.model_number?.trim();
    if (!brand || !model) return;
    setSuggestedPartsLoading(true);
    setShowSuggestedParts(true);
    try {
      const brands = await partsLibraryAPI.listBrands();
      const matchBrand = brands.find(b => b.name.toLowerCase() === brand.toLowerCase());
      if (!matchBrand) { setSuggestedParts([]); return; }
      const models = await partsLibraryAPI.listModels(matchBrand.id);
      const matchModel = models.find(m => m.name.toLowerCase() === model.toLowerCase());
      if (!matchModel) { setSuggestedParts([]); return; }
      const result = await partsLibraryAPI.listParts({ model_id: matchModel.id, limit: 50 });
      setSuggestedParts(result.items || []);
    } catch { setSuggestedParts([]); }
    finally { setSuggestedPartsLoading(false); }
  };

  const addSuggestedPart = (libPart) => {
    const updated = [...(data.parts || [])];
    updated.push({
      name: libPart.name || '',
      part_number: libPart.part_number || '',
      library_part_id: libPart.id,
      quantity: 1,
      price: libPart.suggested_price != null ? String(libPart.suggested_price) : '',
      supplier: libPart.suggested_suppliers?.[0] || '',
      _suggested_suppliers: libPart.suggested_suppliers || [],
      order_link: '',
      notes: libPart.notes || '',
      status: (libPart.quantity_on_hand ?? 0) > 0 ? 'in_stock' : 'pending',
      tracking: '',
      eta: '',
      _library_qty: libPart.quantity_on_hand ?? 0,
      _library_low_stock: libPart.low_stock ?? false,
    });
    handleChange('parts', updated);
  };

  const triggerPartSearch = (pi, searchValue, anchor) => {
    setActiveSuggestionPi(pi);
    setSuggestionAnchor(anchor);
    setHighlightIndex(-1);
    if (partSearchTimer.current) clearTimeout(partSearchTimer.current);
    const trimmed = searchValue.trim();
    if (trimmed.length < 2) { setPartSuggestions([]); return; }
    partSearchTimer.current = setTimeout(async () => {
      setPartSuggestionsLoading(true);
      try {
        const results = await partsLibraryAPI.search(trimmed, 8);
        setPartSuggestions(results);
      } catch { setPartSuggestions([]); }
      finally { setPartSuggestionsLoading(false); }
    }, 300);
  };

  const handlePartNameChange = (pi, value, updatePart, e) => {
    updatePart({ name: value.toUpperCase() });
    triggerPartSearch(pi, value, 'name');
    if (e?.target) {
      const pos = e.target.selectionStart;
      requestAnimationFrame(() => e.target.setSelectionRange(pos, pos));
    }
  };

  const handlePartNumberChange = (pi, value, updatePart, e) => {
    updatePart({ part_number: value.toUpperCase() });
    triggerPartSearch(pi, value, 'partnum');
    if (e?.target) {
      const pos = e.target.selectionStart;
      requestAnimationFrame(() => e.target.setSelectionRange(pos, pos));
    }
  };

  const handleSelectSuggestion = (part, updatePart) => {
    updatePart({
      name: part.name || '',
      part_number: part.part_number || '',
      library_part_id: part.id,
      supplier: part.suggested_suppliers?.[0] || '',
      _suggested_suppliers: part.suggested_suppliers || [],
      price: part.suggested_price != null ? String(part.suggested_price) : '',
      order_link: '',
      notes: part.notes || '',
      status: (part.quantity_on_hand ?? 0) > 0 ? 'in_stock' : 'pending',
      _library_qty: part.quantity_on_hand ?? 0,
      _library_low_stock: part.low_stock ?? false,
    });
    setPartSuggestions([]);
    setActiveSuggestionPi(null);
    setSuggestionAnchor(null);
    setHighlightIndex(-1);
  };

  const handleSuggestionKeyDown = (e, updatePart) => {
    const isOpen = activeSuggestionPi !== null && (partSuggestions.length > 0 || partSuggestionsLoading);
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => (i + 1) % partSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => (i <= 0 ? partSuggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0 && partSuggestions[highlightIndex]) {
        e.preventDefault();
        handleSelectSuggestion(partSuggestions[highlightIndex], updatePart);
      }
    } else if (e.key === 'Escape') {
      setPartSuggestions([]);
      setActiveSuggestionPi(null);
      setSuggestionAnchor(null);
      setHighlightIndex(-1);
    }
  };

  useEffect(() => {
    suppliersAPI.getAll().then(setSuppliers).catch(() => {});
  }, []);

  // Technician dropdown state
  const [technicians, setTechnicians] = useState([]);
  const [addingTechnician, setAddingTechnician] = useState(false);
  const [newTechnicianName, setNewTechnicianName] = useState('');
  const [technicianSaving, setTechnicianSaving] = useState(false);

  useEffect(() => {
    techniciansAPI.getAll().then(setTechnicians).catch(() => {});
  }, []);

  const handleAddTechnician = async () => {
    if (!newTechnicianName.trim()) return;
    setTechnicianSaving(true);
    try {
      const created = await techniciansAPI.create({ name: newTechnicianName.trim() });
      setTechnicians(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTechnicianName('');
      setAddingTechnician(false);
      handleChange('assigned_technician', created.name);
    } catch {
      // duplicate or error — silently ignore
    } finally {
      setTechnicianSaving(false);
    }
  };

  const handleRemoveTechnician = async (technician) => {
    try {
      await techniciansAPI.remove(technician.id);
      setTechnicians(prev => prev.filter(t => t.id !== technician.id));
    } catch {
      // ignore
    }
  };

  // Library brands/models for tool identification dropdowns
  const [libraryBrands, setLibraryBrands] = useState([]);
  const [libraryModels, setLibraryModels] = useState([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  useEffect(() => {
    partsLibraryAPI.listBrands().then(setLibraryBrands).catch(() => {});
  }, []);

  // When brand changes, load models for matching library brand
  const matchedBrand = libraryBrands.find(b => b.name.toLowerCase() === (toolData.brand || '').trim().toLowerCase());
  useEffect(() => {
    if (matchedBrand) {
      partsLibraryAPI.listModels(matchedBrand.id).then(setLibraryModels).catch(() => setLibraryModels([]));
    } else {
      setLibraryModels([]);
    }
  }, [matchedBrand?.id]);

  const filteredBrands = libraryBrands.filter(b =>
    !toolData.brand?.trim() || b.name.toLowerCase().includes(toolData.brand.trim().toLowerCase())
  );
  const filteredModels = libraryModels.filter(m =>
    !toolData.model_number?.trim() || m.name.toLowerCase().includes(toolData.model_number.trim().toLowerCase())
  );

  const data = toolData;

  const inputCls = "w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-primary";
  const sectionHdr = "text-sm text-slate-500 uppercase tracking-wide font-bold mb-4 pb-2 border-b border-slate-300 dark:border-slate-700";

  // Which sections to show: no wizardStep (or non-wizard) = show all
  const showSection = (sections) => !isNewJobForm || !wizardStep || sections.includes(wizardStep);

  return (
    <div className="space-y-6 text-base">
      {/* Section 1 — Tool Identification */}
      {showSection([2]) && (
        <div>
          <p className={sectionHdr}>Tool Identification</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Brand <span className="text-red-400">*</span></label>
              <input required value={data.brand || ''} autoComplete="off"
                onChange={(e) => { const pos = e.target.selectionStart; handleChange('brand', e.target.value.toUpperCase()); setShowBrandDropdown(true); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                onFocus={() => setShowBrandDropdown(true)}
                onBlur={() => setTimeout(() => setShowBrandDropdown(false), 200)}
                placeholder="e.g., Ingersoll Rand" className={inputCls} />
              {showBrandDropdown && filteredBrands.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredBrands.map(b => (
                    <button key={b.id} type="button"
                      onMouseDown={() => { handleChange('brand', b.name.toUpperCase()); setShowBrandDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm border-b last:border-b-0 border-slate-100 dark:border-slate-700 transition-colors"
                    >
                      <span className="text-slate-800 dark:text-slate-100">{b.name}</span>
                      {b.short_code && <span className="ml-2 text-xs text-slate-400">{b.short_code}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Model Number <span className="text-red-400">*</span></label>
              <input required value={data.model_number || ''} autoComplete="off"
                onChange={(e) => { const pos = e.target.selectionStart; handleChange('model_number', e.target.value.toUpperCase()); setShowModelDropdown(true); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                onFocus={() => { if (libraryModels.length > 0) setShowModelDropdown(true); }}
                onBlur={() => setTimeout(() => setShowModelDropdown(false), 200)}
                placeholder="e.g., 2135TIMAX" className={inputCls} />
              {showModelDropdown && filteredModels.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredModels.map(m => (
                    <button key={m.id} type="button"
                      onMouseDown={() => {
                        const updates = { model_number: m.name.toUpperCase() };
                        if (m.category) updates.tool_type = m.category.toUpperCase();
                        handleChange(updates);
                        setShowModelDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm border-b last:border-b-0 border-slate-100 dark:border-slate-700 transition-colors"
                    >
                      <span className="text-slate-800 dark:text-slate-100">{m.name}</span>
                      {m.category && <span className="ml-2 text-xs text-slate-400">{m.category}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Tool Type <span className="text-red-400">*</span></label>
              <input required value={data.tool_type || ''} onChange={(e) => { const pos = e.target.selectionStart; handleChange('tool_type', e.target.value.toUpperCase()); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                placeholder="e.g., Impact Wrench" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Serial Number</label>
              <input value={data.serial_number || ''} onChange={(e) => { const pos = e.target.selectionStart; handleChange('serial_number', e.target.value.toUpperCase()); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                placeholder="Optional" className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {/* Section 2 — Job Details */}
      {showSection([3]) && (
        <div>
          <p className={sectionHdr}>Job Details</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Quantity</label>
              <input type="number" min="1" value={data.quantity || 1} onChange={(e) => handleChange('quantity', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Priority</label>
              <select value={data.priority || 'standard'} onChange={(e) => handleChange('priority', e.target.value)} className={inputCls}>
                <option value="standard">Standard</option>
                <option value="rush">Rush</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Remarks / Description</label>
              <textarea value={data.remarks || ''} onChange={(e) => { const pos = e.target.selectionStart; handleChange('remarks', e.target.value.toUpperCase()); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                rows={3} placeholder="Customer's description of the problem"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.warranty || false} onChange={(e) => handleChange('warranty', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Warranty Repair</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Section 3 — Photos (wizard step 2 only) */}
      {showSection([2]) && isNewJobForm && (
        <div>
          <p className={sectionHdr}>Photos</p>
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-all">
              <span className="material-symbols-outlined text-sm">add_a_photo</span>
              Add Photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleChange('_pendingPhotos', [
                      ...(data._pendingPhotos || []),
                      ...Array.from(e.target.files),
                    ]);
                  }
                  e.target.value = '';
                }}
              />
            </label>
            {(data._pendingPhotos?.length > 0) && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {data._pendingPhotos.length} photo{data._pendingPhotos.length !== 1 ? 's' : ''} selected
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {data._pendingPhotos.map((file, fi) => (
                    <div key={fi} className="aspect-square group relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover rounded border border-slate-300 dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleChange('_pendingPhotos', data._pendingPhotos.filter((_, i) => i !== fi))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove photo"
                      >
                        <span className="material-symbols-outlined text-slate-900 dark:text-white" style={{ fontSize: '14px' }}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Section 4 — Parts */}
      {showSection([3]) && <div>
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-300 dark:border-slate-700">
          <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">Parts</p>
          <div className="flex items-center gap-3">
            {data.brand && data.model_number && (
              <button type="button" onClick={loadSuggestedParts}
                className={`text-xs font-bold flex items-center gap-1 transition-colors ${showSuggestedParts ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 hover:text-amber-600 dark:hover:text-amber-400'}`}>
                <span className="material-symbols-outlined" style={{fontSize:'15px'}}>lightbulb</span>
                {suggestedPartsLoading ? 'Loading…' : showSuggestedParts ? 'Hide Suggestions' : 'Suggested Parts'}
              </button>
            )}
            <button type="button" onClick={() => handleChange('parts', [...(data.parts || []), { name: '', part_number: '', quantity: 1, price: '', supplier: '', order_link: '', notes: '', status: 'pending', tracking: '', eta: '' }])}
              className="text-sm text-primary hover:text-blue-400 font-bold flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-base">add</span> Add Part
            </button>
          </div>
        </div>

        {/* Suggested parts for this model */}
        {showSuggestedParts && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wide mb-2">
              Parts for {data.brand} {data.model_number}
            </p>
            {suggestedPartsLoading ? (
              <p className="text-xs text-slate-500">Loading…</p>
            ) : suggestedParts.length === 0 ? (
              <p className="text-xs text-slate-500">No parts found in library for this model.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {suggestedParts.map(sp => {
                  const alreadyAdded = (data.parts || []).some(p => p.library_part_id === sp.id);
                  return (
                    <button key={sp.id} type="button" disabled={alreadyAdded}
                      onClick={() => addSuggestedPart(sp)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                        alreadyAdded
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 cursor-default'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 text-slate-700 dark:text-slate-200'
                      }`}>
                      {alreadyAdded ? (
                        <span className="material-symbols-outlined" style={{fontSize:'13px'}}>check</span>
                      ) : (
                        <span className="material-symbols-outlined" style={{fontSize:'13px'}}>add</span>
                      )}
                      <span className="font-medium uppercase">{sp.name}{sp.part_number ? ` - ${sp.part_number}` : ''}</span>
                      {sp.suggested_price != null && <span className="text-green-600 dark:text-green-400">${sp.suggested_price.toFixed(2)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {(data.parts || []).length > 0 && (
          <div className="space-y-3">
            {data.parts.map((part, pi) => {
              const updatePart = (fields) => {
                const updated = [...data.parts];
                updated[pi] = { ...part, ...fields };
                handleChange('parts', updated);
              };
              const isPostOrder = ['ordered', 'received', 'installed'].includes(part.status); // in_stock skips ordering so no tracking fields
              const partInputCls = "px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary";
              return (
                <div key={pi} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                  {/* Row 1: Name, Part#, Qty, Price, Status, Remove — all inline */}
                  <div className="flex items-center gap-2 p-2.5 flex-wrap">
                    <div className="relative w-[35%] min-w-[100px]">
                      <input
                        placeholder="Part name *"
                        value={part.name || ''}
                        onChange={(e) => handlePartNameChange(pi, e.target.value, updatePart, e)}
                        onBlur={() => setTimeout(() => { if (activeSuggestionPi === pi) { setActiveSuggestionPi(null); setPartSuggestions([]); setSuggestionAnchor(null); setHighlightIndex(-1); } }, 200)}
                        onKeyDown={(e) => handleSuggestionKeyDown(e, updatePart)}
                        className={`w-full ${partInputCls}`}
                        autoComplete="off"
                      />
                      {activeSuggestionPi === pi && suggestionAnchor === 'name' && (partSuggestions.length > 0 || partSuggestionsLoading) && (
                        <div className="absolute z-50 left-0 right-0 sm:right-auto top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-h-60 overflow-y-auto sm:min-w-[300px]">
                          {partSuggestionsLoading ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
                              <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                              Searching parts library…
                            </div>
                          ) : partSuggestions.map((s, idx) => (
                            <button
                              key={s.id}
                              type="button"
                              ref={el => { if (idx === highlightIndex) el?.scrollIntoView({ block: 'nearest' }); }}
                              onMouseDown={() => handleSelectSuggestion(s, updatePart)}
                              onMouseEnter={() => setHighlightIndex(idx)}
                              className={`w-full text-left px-3 py-2 sm:py-1.5 flex items-center gap-2 border-b last:border-b-0 border-slate-100 dark:border-slate-700/60 transition-colors ${idx === highlightIndex ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase truncate">{s.name}{s.part_number ? ` - ${s.part_number}` : ''}</span>
                                {s.model_names?.length > 0 && <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase truncate hidden sm:inline max-w-[180px]">{s.model_names.join(', ')}</span>}
                                <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                                  {s.suggested_price != null && <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">${s.suggested_price.toFixed(2)}</span>}
                                  <span title={s.quantity_on_hand > 0 ? (s.low_stock ? `Low stock (${s.quantity_on_hand})` : `${s.quantity_on_hand} in stock`) : 'Out of stock'} className={
                                    s.quantity_on_hand > 0
                                      ? s.low_stock ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'
                                      : 'text-red-500 dark:text-red-400'
                                  }>
                                    <span className="material-symbols-outlined" style={{fontSize:'14px'}}>inventory_2</span>
                                  </span>
                                  {s.compatibility_group_names?.length > 0 && (
                                    <span title={s.compatibility_group_names.join(', ')} className="text-green-500 dark:text-green-400">
                                      <span className="material-symbols-outlined" style={{fontSize:'14px'}}>sync_alt</span>
                                    </span>
                                  )}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative flex-1 min-w-[100px]">
                      <input
                        placeholder="Part #"
                        value={part.part_number || ''}
                        onChange={(e) => handlePartNumberChange(pi, e.target.value, updatePart, e)}
                        onBlur={() => setTimeout(() => { if (activeSuggestionPi === pi) { setActiveSuggestionPi(null); setPartSuggestions([]); setSuggestionAnchor(null); setHighlightIndex(-1); } }, 200)}
                        onKeyDown={(e) => handleSuggestionKeyDown(e, updatePart)}
                        className={`w-full ${partInputCls}`}
                        autoComplete="off"
                      />
                      {activeSuggestionPi === pi && suggestionAnchor === 'partnum' && (partSuggestions.length > 0 || partSuggestionsLoading) && (
                        <div className="absolute z-50 left-0 right-0 sm:right-auto top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-h-60 overflow-y-auto sm:min-w-[300px]">
                          {partSuggestionsLoading ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
                              <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                              Searching parts library…
                            </div>
                          ) : partSuggestions.map((s, idx) => (
                            <button
                              key={s.id}
                              type="button"
                              ref={el => { if (idx === highlightIndex) el?.scrollIntoView({ block: 'nearest' }); }}
                              onMouseDown={() => handleSelectSuggestion(s, updatePart)}
                              onMouseEnter={() => setHighlightIndex(idx)}
                              className={`w-full text-left px-3 py-2 sm:py-1.5 flex items-center gap-2 border-b last:border-b-0 border-slate-100 dark:border-slate-700/60 transition-colors ${idx === highlightIndex ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase truncate">{s.name}{s.part_number ? ` - ${s.part_number}` : ''}</span>
                                {s.model_names?.length > 0 && <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase truncate hidden sm:inline max-w-[180px]">{s.model_names.join(', ')}</span>}
                                <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                                  {s.suggested_price != null && <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">${s.suggested_price.toFixed(2)}</span>}
                                  <span title={s.quantity_on_hand > 0 ? (s.low_stock ? `Low stock (${s.quantity_on_hand})` : `${s.quantity_on_hand} in stock`) : 'Out of stock'} className={
                                    s.quantity_on_hand > 0
                                      ? s.low_stock ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'
                                      : 'text-red-500 dark:text-red-400'
                                  }>
                                    <span className="material-symbols-outlined" style={{fontSize:'14px'}}>inventory_2</span>
                                  </span>
                                  {s.compatibility_group_names?.length > 0 && (
                                    <span title={s.compatibility_group_names.join(', ')} className="text-green-500 dark:text-green-400">
                                      <span className="material-symbols-outlined" style={{fontSize:'14px'}}>sync_alt</span>
                                    </span>
                                  )}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="number" min="1" placeholder="Qty" value={part.quantity ?? ''} onChange={(e) => updatePart({ quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 1 })}
                      className={`w-14 ${partInputCls}`} />
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                      <input type="number" min="0" step="0.01" placeholder="Price" value={part.price ?? ''} onChange={(e) => updatePart({ price: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        className={`w-24 pl-5 ${partInputCls}`} />
                    </div>
                    <select value={part.status || 'pending'} onChange={(e) => updatePart({ status: e.target.value })}
                      className={`w-28 ${partInputCls}`}>
                      <option value="pending">Pending</option>
                      <option value="ordered">Ordered</option>
                      <option value="in_stock">In Stock</option>
                      <option value="received">Received</option>
                      <option value="installed">Installed</option>
                    </select>
                    {part.library_part_id && (
                      <span title={part._library_qty != null ? (part._library_qty > 0 ? (part._library_low_stock ? `Low stock (${part._library_qty})` : `${part._library_qty} in stock`) : 'Out of stock') : 'Linked to Parts Library'} className={`flex-shrink-0 ${
                        part._library_qty == null ? 'text-violet-500 dark:text-violet-400'
                        : part._library_qty > 0
                          ? part._library_low_stock ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}>
                        <span className="material-symbols-outlined" style={{fontSize:'18px'}}>inventory_2</span>
                      </span>
                    )}
                    <button type="button" onClick={() => updatePart({ needs_sourcing: !part.needs_sourcing })}
                      className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold transition-colors ${
                        part.needs_sourcing
                          ? 'bg-primary/20 text-primary hover:bg-red-500/20 hover:text-red-400'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:bg-primary/20 hover:text-primary'
                      }`} title={part.needs_sourcing ? 'Remove from sourcing queue' : 'Add to sourcing queue'}>
                      <span className="material-symbols-outlined" style={{fontSize:'14px'}}>local_shipping</span>
                      {part.needs_sourcing ? 'sourcing' : 'source'}
                    </button>
                    <button type="button" onClick={() => handleChange('parts', data.parts.filter((_, i) => i !== pi))}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors flex-shrink-0" title="Remove part">
                      <span className="material-symbols-outlined" style={{fontSize:'18px'}}>close</span>
                    </button>
                  </div>

                  {/* Row 2: Supplier + Order link */}
                  <div className="flex gap-2 px-2.5 pb-2 flex-wrap">
                    {/* Supplier dropdown */}
                    <div className="flex flex-1 min-w-[180px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden">
                      <select value={part.supplier || ''} onChange={(e) => updatePart({ supplier: e.target.value })}
                        onFocus={refreshSuppliers}
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none border-none">
                        <option value="">Supplier</option>
                        {/* Show current value if it's not in the managed list (legacy/library name) */}
                        {part.supplier && !suppliers.some(sup => sup.name === part.supplier) && !(part._suggested_suppliers || []).includes(part.supplier) && (
                          <option value={part.supplier}>{part.supplier}</option>
                        )}
                        {(part._suggested_suppliers || []).filter(s => !suppliers.some(sup => sup.name === s)).map(s => (
                          <option key={`lib-${s}`} value={s}>{s} (library)</option>
                        ))}
                        {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    {/* Order link input group */}
                    <div className="flex flex-1 min-w-[180px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden focus-within:border-primary dark:focus-within:border-primary/70">
                      <span className="flex items-center pl-2 text-slate-400 dark:text-slate-500 pointer-events-none flex-shrink-0">
                        <span className="material-symbols-outlined" style={{fontSize:'15px'}}>link</span>
                      </span>
                      <input placeholder="Order link (URL)" value={part.order_link || ''} onChange={(e) => updatePart({ order_link: e.target.value })}
                        className="flex-1 min-w-0 px-2 py-1.5 bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none border-none placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                      {part.order_link?.trim() && (
                        <a href={part.order_link.startsWith('http') ? part.order_link : `https://${part.order_link}`} target="_blank" rel="noopener noreferrer"
                          className="px-2 border-l border-slate-300 dark:border-slate-600 text-primary dark:text-primary/80 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors flex items-center flex-shrink-0" title="Open link">
                          <span className="material-symbols-outlined" style={{fontSize:'15px'}}>open_in_new</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Row 3 (post-approval): Tracking, ETA, auto-dates */}
                  {isPostOrder && (
                    <div className="flex items-center gap-3 px-2.5 pb-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 bg-blue-50/30 dark:bg-blue-900/10 flex-wrap">
                      <input placeholder="Tracking #" value={part.tracking || ''} onChange={(e) => updatePart({ tracking: e.target.value })}
                        className={`w-32 ${partInputCls}`} />
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 whitespace-nowrap">ETA</span>
                        <input type="date" value={part.eta ? (typeof part.eta === 'string' ? part.eta.split('T')[0] : '') : ''} onChange={(e) => updatePart({ eta: e.target.value })}
                          className={`${partInputCls}`} />
                      </div>
                      {part.order_date && (
                        <span className="text-xs text-slate-500">Ordered: <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(part.order_date).toLocaleDateString('en-CA')}</span></span>
                      )}
                      {part.date_received && (
                        <span className="text-xs text-slate-500">Received: <span className="font-medium text-green-600 dark:text-green-400">{new Date(part.date_received).toLocaleDateString('en-CA')}</span></span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div className="px-3 pb-3 pt-1">
                    <label className="block text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Notes</label>
                    <input placeholder="Backorder, alternatives, OEM only…" value={part.notes || ''} onChange={(e) => updatePart({ notes: e.target.value })}
                      className={`w-full ${partInputCls}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* Section 5 — Labour & Cost */}
      {showSection([4]) && (
        <div>
          <p className={sectionHdr}>Labour & Cost</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Labour Hours</label>
              <input type="number" step="0.5" min="0" value={data.labour_hours || ''} onChange={(e) => handleChange('labour_hours', e.target.value)}
                placeholder="e.g., 2.5" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Hourly Rate ($)</label>
              <input type="number" step="0.01" min="0" value={data.hourly_rate || ''} onChange={(e) => handleChange('hourly_rate', e.target.value)}
                placeholder="e.g., 95.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Zoho Reference</label>
              <input value={data.zoho_ref || ''} onChange={(e) => { const pos = e.target.selectionStart; handleChange('zoho_ref', e.target.value.toUpperCase()); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                placeholder="Optional" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Assigned Technician</label>
              {!addingTechnician ? (
                <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden">
                  <select value={data.assigned_technician || ''} onChange={(e) => handleChange('assigned_technician', e.target.value)}
                    className="flex-1 min-w-0 px-3 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base focus:outline-none border-none">
                    <option value="">Unassigned</option>
                    {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                  {data.assigned_technician && technicians.find(t => t.name === data.assigned_technician) && (
                    <button type="button" title="Remove technician" onClick={() => { const t = technicians.find(x => x.name === data.assigned_technician); if (t) handleRemoveTechnician(t); }}
                      className="px-2 border-l border-slate-300 dark:border-slate-600 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                      <span className="material-symbols-outlined" style={{fontSize:'16px'}}>delete</span>
                    </button>
                  )}
                  <button type="button" onClick={() => setAddingTechnician(true)} title="Add technician"
                    className="px-3 border-l border-slate-300 dark:border-slate-600 text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors">
                    <span className="material-symbols-outlined" style={{fontSize:'18px'}}>add</span>
                  </button>
                </div>
              ) : (
                <div className="flex rounded-lg border border-primary dark:border-primary/60 bg-white dark:bg-slate-800 overflow-hidden">
                  <input autoFocus placeholder="New technician name" value={newTechnicianName}
                    onChange={(e) => { const pos = e.target.selectionStart; setNewTechnicianName(e.target.value.toUpperCase()); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTechnician(); } if (e.key === 'Escape') { setAddingTechnician(false); setNewTechnicianName(''); } }}
                    className="flex-1 min-w-0 px-3 py-3 bg-transparent text-slate-900 dark:text-white text-base focus:outline-none border-none placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                  <button type="button" onClick={handleAddTechnician} disabled={technicianSaving}
                    className="px-3 border-l border-slate-300 dark:border-slate-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50">
                    <span className="material-symbols-outlined" style={{fontSize:'18px'}}>check</span>
                  </button>
                  <button type="button" onClick={() => { setAddingTechnician(false); setNewTechnicianName(''); }}
                    className="px-3 border-l border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                    <span className="material-symbols-outlined" style={{fontSize:'18px'}}>close</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section 6 — Scheduling */}
      {showSection([4]) && (
        <div>
          <p className={sectionHdr}>Scheduling</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Date Received</label>
              <input type="date" value={data.date_received ? data.date_received.split('T')[0] : ''} onChange={(e) => handleChange('date_received', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Est. Completion Date</label>
              <input type="date" value={data.estimated_completion || ''} onChange={(e) => handleChange('estimated_completion', e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
