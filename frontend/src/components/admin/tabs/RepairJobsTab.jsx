import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { repairsAPI, customersAPI, serviceAgreementAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import { REPAIR_STATUSES, REPAIR_STATUSES_LIST } from '../../../constants/repairStatuses';
import { StatusBadge } from '../shared/RepairStatusBadges';
import { openPrintWorkOrder } from '../PrintWorkOrder';
import SendWorkOrderEmailModal from '../SendWorkOrderEmailModal';
import PaginationBar from '../shared/PaginationBar';
import { formatDateShortPacific, getTodayPacific } from '../../../utils/dateFormat';
import { useSettings } from '../../../contexts/SettingsContext';
import ToolForm, { getEmptyTool, syncPartsToLibrary, toolDisplayTitle } from '../shared/ToolForm';
import WorkOrderDialog from '../shared/WorkOrderDialog';

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

const getEmptyJob = () => ({
  customer_id: null, company_name: '', first_name: '', last_name: '', email: '', phone: '',
  address: '', customer_notes: '', source: 'drop_off', tools: [getEmptyTool()]
});

export default function RepairJobsTab({ preselectedCustomer, onPreselectedCustomerUsed, onCountUpdate, externalOpenNewJob, onExternalOpenNewJobHandled }) {
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
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Dashboard click-throughs arrive as URL params so they work in new browser
  // tabs: ?status=<repair status> or ?view=overdue|stuck|attention|all|...
  const [searchParams, setSearchParams] = useSearchParams();
  const VIEW_TO_EXT = {
    all: '__all__', attention: '__attention__', overdue: '__overdue__', stuck: '__stuck__',
    ready_for_repair: '__ready_for_repair__', ready_for_pickup: '__ready_for_pickup__',
  };
  const SPECIAL_FILTERS = new Set(['__all__', '__attention__', '__overdue__', '__stuck__', '__ready_for_repair__', '__ready_for_pickup__']);
  const ext = searchParams.get('status') || VIEW_TO_EXT[searchParams.get('view')] || '';
  const initStatus = ext && !SPECIAL_FILTERS.has(ext) ? ext : '';
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
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState(new Set()); // Set of "jobId:toolId"
  const [batchTargetStatus, setBatchTargetStatus] = useState('');
  const [batchApplying, setBatchApplying] = useState(false);
  const [attentionFilter, setAttentionFilter] = useState(ext === '__attention__');
  // Specific dashboard filters: 'overdue' = past estimated_completion, 'stuck' = diagnosed/in_repair 24h+
  const initSpecial = ext === '__all__' ? 'active_only' : ext === '__overdue__' ? 'overdue' : ext === '__stuck__' ? 'stuck' : ext === '__ready_for_repair__' ? 'ready_for_repair' : ext === '__ready_for_pickup__' ? 'ready_for_pickup' : '';
  const [specialFilter, setSpecialFilter] = useState(initSpecial);

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

  // Apply status/view URL params that change AFTER mount (e.g. back/forward
  // between filtered views, or a dashboard link clicked while already here).
  // Initial value is handled by the useState initializers above.
  const prevExt = useRef(ext);
  useEffect(() => {
    if (prevExt.current === ext) return;
    prevExt.current = ext;
    if (ext === '') return; // param removed — leave the user's current filters alone
    const isAttention = ext === '__attention__';
    const isAll = ext === '__all__';
    const isOverdue = ext === '__overdue__';
    const isStuck = ext === '__stuck__';
    const isReadyForRepair = ext === '__ready_for_repair__';
    const isReadyForPickup = ext === '__ready_for_pickup__';
    const isSpecial = isAttention || isAll || isOverdue || isStuck || isReadyForRepair || isReadyForPickup;

    setStatusFilter(isSpecial ? '' : ext);
    setAttentionFilter(isAttention);
    setSpecialFilter(isAll ? 'active_only' : isOverdue ? 'overdue' : isStuck ? 'stuck' : isReadyForRepair ? 'ready_for_repair' : isReadyForPickup ? 'ready_for_pickup' : '');
    setSearchQuery('');
    setPriorityFilter('');
    setCurrentPage(1);
  }, [ext]);

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

  // The open work order lives in the URL (?tab=jobs&job=<id>) so jobs can be
  // opened in new browser tabs, and back/forward closes/reopens the detail view
  const jobParam = searchParams.get('job');
  useEffect(() => {
    if (!jobParam) { setSelectedJob(null); return; }
    if (selectedJob?.id === jobParam) return;
    openJob({ id: jobParam });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobParam]);

  const closeJob = useCallback(() => {
    setSelectedJob(null);
    setSearchParams({ tab: 'jobs' }, { replace: true });
  }, [setSearchParams]);

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

  // Escape key: close topmost open modal. While the WO dialog is open it owns
  // all Escape handling (including its inner modals) — skip everything here.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedJob) return; // WorkOrderDialog handles Escape while open
      if (deleteConfirmId) { setDeleteConfirmId(null); return; }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedJob, deleteConfirmId]);

  const SERVER_SORT_FIELDS = new Set(['created_at', 'updated_at', 'request_number', 'smart']);

  const fetchJobs = async (page, size, attention) => {
    try {
      setLoading(true);
      const activePage = page ?? currentPage;
      const activeSize = size ?? pageSize;
      const isAttention = attention !== undefined ? attention : attentionFilter;
      const isBulkFilter = isAttention || (specialFilter !== '' && specialFilter !== 'active_only');
      const params = isBulkFilter
        ? { skip: 0, limit: 200 }  // fetch all when client-side filter active
        : { skip: (activePage - 1) * activeSize, limit: activeSize };
      if (specialFilter === 'active_only') params.active_only = true;
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
      setTotalCount(isBulkFilter ? data.length : total);  // active_only uses server total via !isBulkFilter
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
    if (specialFilter === 'ready_for_pickup') {
      base = base.filter(job => job.tools.some(t => t.status === 'ready' || t.status === 'invoiced'));
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
  const isBulkFiltered = attentionFilter || (specialFilter !== '' && specialFilter !== 'active_only');
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

  // ── VIEW JOB ─────────────────────────────────────────
  const openJob = async (job) => {
    try {
      const fresh = await repairsAPI.get(job.id);
      setSelectedJob(fresh);
    } catch {
      showToast('error', 'Failed to load repair job');
      // Drop a dead ?job= param so the same link can be clicked again
      setSearchParams({ tab: 'jobs' }, { replace: true });
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

  // ── DELETE JOB ───────────────────────────────────────
  const handleDeleteJob = async () => {
    if (!deleteConfirmId) return;
    try {
      await repairsAPI.delete(deleteConfirmId.id);
      setJobs(jobs.filter(j => j.id !== deleteConfirmId.id));
      setDeleteConfirmId(null);
      if (selectedJob?.id === deleteConfirmId.id) closeJob();
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
              specialFilter === 'active_only'
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : specialFilter === 'ready_for_repair'
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : specialFilter === 'ready_for_pickup'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {specialFilter === 'active_only' ? 'build_circle' : specialFilter === 'overdue' ? 'schedule' : specialFilter === 'stuck' ? 'block' : specialFilter === 'ready_for_pickup' ? 'storefront' : 'construction'}
              </span>
              {specialFilter === 'active_only' ? 'Active Jobs' : specialFilter === 'overdue' ? 'Overdue' : specialFilter === 'stuck' ? 'Stuck 24h+' : specialFilter === 'ready_for_pickup' ? 'Ready for Pickup' : 'Ready for Repair'}
              <button onClick={() => setSpecialFilter('')} className={`ml-0.5 ${specialFilter === 'ready_for_repair' ? 'hover:text-blue-900 dark:hover:text-blue-100' : specialFilter === 'ready_for_pickup' ? 'hover:text-emerald-900 dark:hover:text-emerald-100' : 'hover:text-amber-900 dark:hover:text-amber-100'}`}>
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
        {/* Desktop: full labels. flex-wrap matters — the row's minimum widths
            total ~880px, which at tablet sizes stretched the whole page and
            dragged every w-full element (table included) past the viewport */}
        <div className="hidden sm:flex flex-wrap items-center gap-3">
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
              specialFilter === 'active_only'
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : specialFilter === 'ready_for_repair'
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : specialFilter === 'ready_for_pickup'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {specialFilter === 'active_only' ? 'build_circle' : specialFilter === 'overdue' ? 'schedule' : specialFilter === 'stuck' ? 'block' : specialFilter === 'ready_for_pickup' ? 'storefront' : 'construction'}
              </span>
              {specialFilter === 'active_only' ? 'Active Jobs' : specialFilter === 'overdue' ? 'Overdue' : specialFilter === 'stuck' ? 'Stuck 24h+' : specialFilter === 'ready_for_pickup' ? 'Ready for Pickup' : 'Ready for Repair'}
              <button onClick={() => setSpecialFilter('')} className={`ml-0.5 ${specialFilter === 'ready_for_repair' ? 'hover:text-blue-900 dark:hover:text-blue-100' : specialFilter === 'ready_for_pickup' ? 'hover:text-emerald-900 dark:hover:text-emerald-100' : 'hover:text-amber-900 dark:hover:text-amber-100'}`}>
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
                    onClick={() => !batchMode && setSearchParams({ tab: 'jobs', job: job.id })}
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
                      <div className="font-semibold text-sm text-slate-900 dark:text-white truncate leading-tight">
                        {(job.company_name || `${job.first_name} ${job.last_name}`).toUpperCase()}
                      </div>
                      {job.company_name && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{`${job.first_name} ${job.last_name}`.toUpperCase()}</div>
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
                      <Link
                        to={`/admin/repair-tracker?tab=jobs&job=${job.id}`}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-primary/90 hover:bg-primary text-white rounded-lg transition-all shadow-sm"
                        title="Open"
                        aria-label={`Open ${job.work_order_number}`}
                      >
                        <span className="material-symbols-outlined text-base">open_in_new</span>
                      </Link>
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
                    { field: 'tools', label: 'Tools', cls: 'hidden lg:table-cell' },
                    { field: 'priority', label: 'Priority', cls: 'hidden lg:table-cell' },
                    { field: 'status', label: 'Status', cls: '' },
                    { field: 'created_at', label: 'Created / Due', cls: 'hidden xl:table-cell' },
                    { field: 'updated_at', label: 'Updated', cls: 'hidden 2xl:table-cell' },
                  ].map(({ field, label, cls }) => (
                    <th
                      key={field}
                      className={`py-3 px-2 sm:px-3 lg:px-4 text-xs font-bold uppercase tracking-wide text-slate-500 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300 transition-colors ${cls}`}
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
                  <th className="py-3 px-2 sm:px-3 lg:px-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">
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
                    onClick={() => !batchMode && setSearchParams({ tab: 'jobs', job: job.id })}
                  >
                    <td className="py-3 px-2 sm:px-3 lg:px-4">
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
                    <td className="py-3 px-2 sm:px-3 lg:px-4 max-w-[220px] md:max-w-[300px] lg:max-w-[240px]">
                      <div className="text-slate-900 dark:text-white font-semibold text-sm truncate">{(job.company_name || `${job.first_name} ${job.last_name}`).toUpperCase()}</div>
                      {job.company_name && <div className="text-slate-500 dark:text-slate-400 text-xs truncate">{`${job.first_name} ${job.last_name}`.toUpperCase()}</div>}
                      <div className="flex items-center gap-2 mt-0.5 lg:hidden">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                          <span className="material-symbols-outlined" style={{fontSize:'12px'}}>build</span>
                          {job.tools.length} tool{job.tools.length !== 1 ? 's' : ''}
                        </span>
                        <PriorityBadge priority={getHighestPriority(job.tools)} />
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:px-3 lg:px-4 hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 text-sm font-medium">
                        <span className="material-symbols-outlined text-slate-500" style={{fontSize:'16px'}}>build</span>
                        {job.tools.length} tool{job.tools.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-2 sm:px-3 lg:px-4 hidden lg:table-cell">
                      <PriorityBadge priority={getHighestPriority(job.tools)} />
                    </td>
                    <td className="py-3 px-2 sm:px-3 lg:px-4">
                      {job.tools?.length === 1 ? (
                        <StatusBadge status={job.tools[0].status} />
                      ) : (() => {
                        const summary = (getToolStatusSummary(job.tools) || []).sort(byStatusPriority);
                        // Full breakdown lives in the tooltip; the pill itself stays
                        // compact so long status names don't clutter the list
                        const tooltip = summary.map(s => `${s.count} ${REPAIR_STATUSES[s.status]?.label || s.status}`).join(' · ');
                        return (
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 cursor-default"
                            title={tooltip}
                            aria-label={tooltip}
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
                    <td className="py-3 px-2 sm:px-3 lg:px-4 hidden xl:table-cell">
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
                    <td className="py-3 px-2 sm:px-3 lg:px-4 text-slate-500 text-sm hidden 2xl:table-cell">{formatDateShort(job.updated_at)}</td>
                    <td className="py-3 px-2 sm:px-3 lg:px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {!batchMode && (
                          <>
                            <Link
                              to={`/admin/repair-tracker?tab=jobs&job=${job.id}`}
                              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-primary/90 hover:bg-primary text-white rounded-lg text-sm font-bold transition-all shadow-sm"
                              title="Open"
                            >
                              <span className="material-symbols-outlined text-base">open_in_new</span>
                              <span className="hidden sm:inline">Open</span>
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
                                <span>{toolDisplayTitle(tool).toUpperCase()}</span>
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

      {/* ── WORK ORDER DIALOG (shared with Customers tab) ── */}
      {selectedJob && (
        <WorkOrderDialog
          job={selectedJob}
          serviceAgreement={serviceAgreement}
          onClose={closeJob}
          onJobUpdated={(updated) => {
            setSelectedJob(updated);
            setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
          }}
        />
      )}

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
                        <p className="text-slate-500 text-xs mt-2">No customers found matching &quot;{customerSearch}&quot;</p>
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
                  <p className="text-slate-900 dark:text-white text-sm font-bold truncate">
                    {(selectedCustomerObj ? `${selectedCustomerObj.first_name} ${selectedCustomerObj.last_name}` : `${newJobForm.first_name} ${newJobForm.last_name}`).toUpperCase()}
                    {(selectedCustomerObj?.company_name || newJobForm.company_name) && (
                      <span className="text-slate-500 dark:text-slate-400 font-normal"> — {(selectedCustomerObj?.company_name || newJobForm.company_name).toUpperCase()}</span>
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
                      // Hathorn units carry identity on their components (any
                      // mix can arrive alone), so the generic model number is
                      // waived when at least one component field is filled.
                      const hasComponent = (t) => [
                        t.camera_head_model, t.camera_head_serial,
                        t.controller_model, t.controller_serial,
                        t.rod_holder_model, t.rod_holder_serial,
                      ].some((v) => v?.trim());
                      const badTool = newJobForm.tools.find(t =>
                        !t.tool_type?.trim() || !t.brand?.trim() ||
                        (/hathorn/i.test(t.brand || '') ? !hasComponent(t) : !t.model_number?.trim())
                      );
                      if (badTool) {
                        showToast('error', /hathorn/i.test(badTool.brand || '')
                          ? 'Each Hathorn tool needs at least one component model or serial (camera head, controller, or pushrod holder)'
                          : 'Tool type, brand, and model number are required for each tool');
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
                            <p className="text-slate-500 dark:text-slate-400 text-xs">{toolDisplayTitle(tool)}</p>
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
                            <p className="text-slate-500 dark:text-slate-400 text-xs">{toolDisplayTitle(tool)}</p>
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
