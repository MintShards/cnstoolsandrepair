import { useState, useEffect, useRef, useCallback } from 'react';
import { repairsAPI, customersAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import {
  REPAIR_STATUSES, REPAIR_STATUSES_LIST,
  getValidNextStatuses,
} from '../../../constants/repairStatuses';
import { StatusBadge, StepBadge, ProgressStepper } from '../shared/RepairStatusBadges';
import PaginationBar from '../shared/PaginationBar';
import { formatDatePacific, formatDateShortPacific } from '../../../utils/dateFormat';

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
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

const EMPTY_TOOL_BASE = {
  tool_type: '', brand: '', model_number: '', serial_number: '',
  quantity: 1, remarks: '', parts: [{ name: '', quantity: 1, status: 'pending' }],
  labour_hours: '', hourly_rate: '', priority: 'standard', warranty: false,
  zoho_ref: '', assigned_technician: '', estimated_completion: '',
  _pendingPhotos: [], // File objects staged during wizard — never sent to API
};

const getEmptyTool = () => ({
  ...EMPTY_TOOL_BASE,
  date_received: new Date().toISOString().split('T')[0],
});

const getEmptyJob = () => ({
  customer_id: null, company_name: '', first_name: '', last_name: '', email: '', phone: '',
  address: '', customer_notes: '', source: 'walk_in', tools: [getEmptyTool()]
});

export default function RepairJobsTab({ preselectedCustomer, onPreselectedCustomerUsed, onCountUpdate }) {
  const showToast = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

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
  const photoInputRef = useRef(null);
  const detailCloseRef = useRef(null);

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

  useEffect(() => { fetchJobs(); }, [statusFilter]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, priorityFilter]);

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

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await repairsAPI.list(params);
      setJobs(data);
      if (onCountUpdate) onCountUpdate(data.length);
    } catch {
      showToast('error', 'Failed to load repair jobs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = formatDatePacific;
  const formatDateShort = formatDateShortPacific;

  // ── FILTER / PAGINATION ──────────────────────────────
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || (() => {
      const s = searchQuery.toLowerCase();
      return (
        job.company_name?.toLowerCase().includes(s) ||
        `${job.first_name} ${job.last_name}`.toLowerCase().includes(s) ||
        job.email.toLowerCase().includes(s) ||
        job.request_number.toLowerCase().includes(s)
      );
    })();
    const matchesPriority = !priorityFilter || job.tools.some(t => t.priority === priorityFilter);
    return matchesSearch && matchesPriority;
  });

  const totalResults = filteredJobs.length;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedJobs = filteredJobs.slice(startIndex, startIndex + pageSize);


  // Summary of tool statuses for list view
  const getToolStatusSummary = (tools) => {
    if (!tools?.length) return null;
    const counts = {};
    tools.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  };

  // Priority order for dot sorting: most actionable first
  const STATUS_PRIORITY = ['abandoned', 'declined', 'received', 'diagnosed', 'parts_pending', 'in_repair', 'quoted', 'approved', 'ready', 'invoiced', 'completed', 'closed'];
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

      const tools = newJobForm.tools.map(({ _pendingPhotos, ...t }) => ({
        ...t,
        quantity: parseInt(t.quantity) || 1,
        labour_hours: t.labour_hours ? parseFloat(t.labour_hours) : null,
        hourly_rate: t.hourly_rate ? parseFloat(t.hourly_rate) : null,
        serial_number: t.serial_number || null,
        remarks: t.remarks || null,
        parts: (t.parts || []).filter(p => p.name.trim()),
        zoho_ref: t.zoho_ref || null,
        assigned_technician: t.assigned_technician || null,
        estimated_completion: t.estimated_completion || null,
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
        console.error('handleCreateJob API failed:', err);
        showToast('error', getErrorMessage(err, 'Failed to create repair job'));
        setSavingJob(false);
        return;
      }

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
          handleCloseNewJob();
          showToast('error', `Job ${created.request_number} created. Some photos failed: ${photoErrors.join(', ')}`);
          setSavingJob(false);
          return;
        }
      }

      setJobs(prev => [finalJob, ...prev]);
      handleCloseNewJob();
      showToast('success', `Repair job ${created.request_number} created successfully`);
      setSavingJob(false);
    } catch (err) {
      console.error('handleCreateJob unexpected error:', err);
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
          console.error('handleSaveJobEdit customer update failed:', err);
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
          console.error('handleSaveJobEdit job sync failed:', err);
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
          console.error('handleSaveJobEdit job update failed:', err);
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
    setStatusUpdateForm({ status: validNext[0] || '', notes: '', estimated_completion: '' });
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
      console.error('handleStatusUpdate failed:', err);
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

  // ── EDIT TOOL DETAILS ───────────────────────────────
  const handleStartToolEdit = (tool) => {
    setEditingToolId(tool.tool_id);
    setToolEditForm({
      tool_type: tool.tool_type || '',
      brand: tool.brand || '',
      model_number: tool.model_number || '',
      serial_number: tool.serial_number || '',
      quantity: tool.quantity || 1,
      remarks: tool.remarks || '',
      parts: tool.parts?.length > 0 ? tool.parts.map(p => ({ ...p })) : [{ name: '', quantity: 1, status: 'pending' }],
      labour_hours: tool.labour_hours ?? '',
      hourly_rate: tool.hourly_rate ?? '',
      priority: tool.priority || 'standard',
      warranty: tool.warranty || false,
      zoho_ref: tool.zoho_ref || '',
      assigned_technician: tool.assigned_technician || '',
      date_received: tool.date_received ? tool.date_received.split('T')[0] : '',
      estimated_completion: tool.estimated_completion ? tool.estimated_completion.split('T')[0] : '',
    });
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
        parts: (toolEditForm.parts || []).filter(p => p.name?.trim()),
        zoho_ref: toolEditForm.zoho_ref || null,
        assigned_technician: toolEditForm.assigned_technician || null,
        estimated_completion: toolEditForm.estimated_completion || null,
      };
      updated = await repairsAPI.updateTool(selectedJob.id, editingToolId, payload);
    } catch (err) {
      console.error('handleSaveToolEdit failed:', err);
      showToast('error', getErrorMessage(err, 'Failed to update tool'));
      setSavingToolEdit(false);
      return;
    }
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
        parts: (addToolForm.parts || []).filter(p => p.name.trim()),
        zoho_ref: addToolForm.zoho_ref || null,
        assigned_technician: addToolForm.assigned_technician || null,
        estimated_completion: addToolForm.estimated_completion || null,
      };
      updated = await repairsAPI.addTool(selectedJob.id, payload);
    } catch (err) {
      console.error('handleAddTool failed:', err);
      showToast('error', getErrorMessage(err, 'Failed to add tool'));
      setAddingTool(false);
      return;
    }
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
    } catch {
      showToast('error', 'Failed to delete repair job');
      setDeleteConfirmId(null);
    }
  };

  // ── RENDER ───────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Repair Jobs</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage work orders and tool repairs</p>
        </div>
        <button
          onClick={handleOpenNewJob}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
        >
          <span className="material-symbols-outlined text-base">add</span>
          New Repair Job
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 p-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">search</span>
            <input
              type="text"
              placeholder="Search company, contact, email, request #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
          {/* Status filter */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">label</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              {REPAIR_STATUSES_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {/* Priority filter */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg pointer-events-none">flag</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {/* Clear filters */}
          {(searchQuery || statusFilter || priorityFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter(''); setPriorityFilter(''); }}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-bold transition-all"
            >
              <span className="material-symbols-outlined text-base">close</span>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
          <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
            Work Orders
            <span className="ml-2 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 font-bold">{totalResults}</span>
          </h3>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin">autorenew</span>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Loading repair jobs...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-200/50 dark:bg-slate-700/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-slate-500">build_circle</span>
            </div>
            <div className="text-center">
              <p className="text-slate-900 dark:text-white font-bold text-base">
                {searchQuery || statusFilter || priorityFilter ? 'No jobs match your filters' : 'No repair jobs yet'}
              </p>
              <p className="text-slate-500 text-sm mt-1">
                {searchQuery || statusFilter || priorityFilter
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create a new job or convert an online repair request'}
              </p>
            </div>
            {!searchQuery && !statusFilter && !priorityFilter && (
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60">
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wide text-slate-500">Work Order #</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wide text-slate-500">Customer</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wide text-slate-500">Tools</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wide text-slate-500">Priority</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wide text-slate-500">Created</th>
                  <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                {paginatedJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="group hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors duration-150 cursor-pointer"
                    onClick={() => openJob(job)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 dark:text-white font-mono font-bold text-xs tracking-wide">{job.request_number}</div>
                      {job.source === 'online_request' && (
                        <span className="inline-flex items-center gap-1 text-xs text-sky-400 mt-0.5">
                          <span className="material-symbols-outlined text-xs" style={{fontSize:'11px'}}>public</span>
                          Online
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 dark:text-white font-semibold text-sm">{job.company_name || `${job.first_name} ${job.last_name}`}</div>
                      {job.company_name && <div className="text-slate-500 dark:text-slate-400 text-xs">{job.first_name} {job.last_name}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 text-xs font-medium">
                        <span className="material-symbols-outlined text-slate-500" style={{fontSize:'14px'}}>build</span>
                        {job.tools.length} tool{job.tools.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={getHighestPriority(job.tools)} />
                    </td>
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-4 text-slate-500 text-xs">{formatDateShort(job.created_at)}</td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openJob(job)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/90 hover:bg-primary text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">open_in_new</span>
                          Open
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(job)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/60 border border-red-200 hover:border-red-300 dark:border-red-800/40 dark:hover:border-red-700 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-lg transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && (
          <PaginationBar
            currentPage={currentPage}
            totalItems={totalResults}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}

          />
        )}
      </div>

      {/* ── JOB DETAIL MODAL ─────────────────────────────── */}
      {selectedJob && (
        <div role="dialog" aria-modal="true" aria-labelledby="wo-dialog-title" className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full my-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/50 animate-fadeInScale overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Colored top-border accent */}
            <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
            {/* Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/60 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">build_circle</span>
                </div>
                <div>
                  <h3 id="wo-dialog-title" className="text-lg font-black text-slate-900 dark:text-white">Work Order <span className="text-primary font-mono">{selectedJob.request_number}</span></h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">Created {formatDateShort(selectedJob.created_at)}</span>
                    {selectedJob.source === 'online_request' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-700/50">
                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>public</span>
                        Online Request
                      </span>
                    )}
                    {selectedJob.source === 'walk_in' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600/50">
                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>store</span>
                        Walk-in
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button ref={detailCloseRef} onClick={() => setSelectedJob(null)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
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
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          {cust.company_name && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>business</span>
                                <span className="text-xs text-slate-500">Company:</span>
                                <span className="text-sm text-slate-900 dark:text-white font-bold">{cust.company_name}</span>
                              </div>
                              <span className="text-slate-500 dark:text-slate-700 text-xs select-none">|</span>
                            </>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>person</span>
                            <span className="text-xs text-slate-500">Contact:</span>
                            <span className="text-sm text-slate-900 dark:text-white">{cust.first_name} {cust.last_name}</span>
                          </div>
                          <span className="text-slate-500 dark:text-slate-700 text-xs select-none">|</span>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>mail</span>
                            <span className="text-xs text-slate-500">Email:</span>
                            <a href={`mailto:${cust.email}`} className="text-sm text-primary hover:underline">{cust.email}</a>
                          </div>
                          <span className="text-slate-500 dark:text-slate-700 text-xs select-none">|</span>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>phone</span>
                            <span className="text-xs text-slate-500">Phone:</span>
                            <a href={`tel:${cust.phone}`} className="text-sm text-primary hover:underline">{cust.phone}</a>
                          </div>
                          {cust.address && (
                            <>
                              <span className="text-slate-500 dark:text-slate-700 text-xs select-none">|</span>
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>location_on</span>
                                <span className="text-xs text-slate-500">Address:</span>
                                <span className="text-sm text-slate-900 dark:text-white">{cust.address}</span>
                              </div>
                            </>
                          )}
                        </div>
                        {cust.customer_notes && (
                          <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-slate-200/40 dark:border-slate-700/40">
                            <span className="material-symbols-outlined text-slate-500 mt-0.5" style={{ fontSize: '13px' }}>sticky_note_2</span>
                            <span className="text-xs text-slate-500">Notes:</span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">{cust.customer_notes}</span>
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
                            <div className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black text-slate-500 dark:text-slate-400">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-sm">
                                {tool.brand} {tool.model_number}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {tool.tool_type}{tool.quantity > 1 && ` × ${tool.quantity}`}
                                {tool.serial_number && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>S/N: {tool.serial_number}</>}
                                {tool.estimated_completion && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>Est: {formatDateShort(tool.estimated_completion)}</>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StepBadge status={tool.status} />
                            <PriorityBadge priority={tool.priority} />
                            {tool.warranty && (
                              <span className="hidden sm:inline px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-700 border border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/50">Warranty</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          {tool.warranty && (
                            <span className="sm:hidden px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-700 border border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/50">Warranty</span>
                          )}
                          <button
                            onClick={() => openStatusUpdate(tool)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary hover:text-blue-700 dark:hover:text-blue-300 rounded-lg text-xs font-bold transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">update</span>
                            Update Status
                          </button>
                          {editingToolId !== tool.tool_id && (
                            <button
                              onClick={() => handleStartToolEdit(tool)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              Edit
                            </button>
                          )}
                          {selectedJob.tools.length > 1 && (
                            <button
                              onClick={() => handleRemoveTool(tool.tool_id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                removeConfirmId === tool.tool_id
                                  ? 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/60'
                                  : 'bg-slate-200/40 dark:bg-slate-700/40 hover:bg-red-50 dark:hover:bg-red-900/30 border-slate-200 dark:border-slate-600/40 hover:border-red-300 dark:hover:border-red-700/40 text-slate-500 hover:text-red-600 dark:hover:text-red-400'
                              }`}
                            >
                              {removeConfirmId === tool.tool_id ? 'Confirm Remove?' : (
                                <span className="material-symbols-outlined text-sm">delete</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Current Status bar (always visible) */}
                      <div className="px-4 pt-3 pb-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <StatusBadge status={tool.status} />
                          <div className="text-xs text-slate-500">
                            Received: {formatDateShort(tool.date_received)}
                            {tool.date_completed && ` · Completed: ${formatDateShort(tool.date_completed)}`}
                          </div>
                        </div>
                        <ProgressStepper status={tool.status} />
                      </div>

                      {/* Tool Details — 3-column grid */}
                      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60">
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          {/* Left — Remarks */}
                          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200/40 dark:border-slate-700/40">
                            <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'10px'}}>Remarks</span>
                            <p className={`mt-1 leading-relaxed ${tool.remarks ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>{tool.remarks || 'No remarks'}</p>
                          </div>
                          {/* Middle — Parts */}
                          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200/40 dark:border-slate-700/40">
                            <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'10px'}}>Parts {tool.parts?.filter(p => p.name?.trim()).length > 0 && `(${tool.parts.filter(p => p.name?.trim()).length})`}</span>
                            {tool.parts && tool.parts.filter(p => p.name?.trim()).length > 0 ? (
                              <div className="mt-1 space-y-1">
                                {tool.parts.filter(p => p.name?.trim()).map((p, pi) => (
                                  <div key={pi} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 rounded-md px-2 py-1 border border-slate-200/30 dark:border-slate-700/30">
                                    <span className="text-slate-700 dark:text-slate-200 font-medium flex-1">{p.name}</span>
                                    <span className="text-slate-500">×{p.quantity}</span>
                                    <span className={`px-1.5 py-px rounded-full font-bold ${
                                      p.status === 'installed' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                                      p.status === 'received' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400' :
                                      p.status === 'ordered' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                                      'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                    }`} style={{fontSize:'10px'}}>{p.status}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-slate-400 dark:text-slate-600 italic">No parts</p>
                            )}
                          </div>
                          {/* Right — Labour / Technician / Zoho */}
                          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200/40 dark:border-slate-700/40 space-y-1.5">
                            <div>
                              <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'10px'}}>Labour</span>
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
                              <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'10px'}}>Technician</span>
                              <p className={`mt-0.5 ${tool.assigned_technician ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>{tool.assigned_technician || 'Unassigned'}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'10px'}}>Zoho Ref</span>
                              <p className={`mt-0.5 ${tool.zoho_ref ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>{tool.zoho_ref || 'None'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Photos */}
                      <div className="px-4 pb-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-500 text-sm">photo_library</span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Photos</span>
                            {tool.photos?.length > 0 && (
                              <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">{tool.photos.length}</span>
                            )}
                          </div>
                          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-all">
                            <span className="material-symbols-outlined text-sm">upload</span>
                            {uploadingPhoto === tool.tool_id ? 'Uploading...' : 'Add Photo'}
                            <input type="file" accept="image/*" className="hidden"
                              onChange={(e) => e.target.files?.[0] && handlePhotoUpload(tool.tool_id, e.target.files[0])}
                            />
                          </label>
                        </div>
                        {tool.photos?.length > 0 && (
                          <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
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
                                  <span className="material-symbols-outlined text-slate-900 dark:text-white" style={{ fontSize: '12px' }}>close</span>
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
                            <span className="material-symbols-outlined text-slate-500 text-sm group-open/hist:rotate-90 transition-transform">chevron_right</span>
                            <span className="material-symbols-outlined text-slate-500 text-sm">history</span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status History</span>
                            <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full ml-1">{tool.status_history.length}</span>
                          </summary>
                          <div className="px-4 pb-4 pt-2">
                            <div className="relative pl-5">
                              {/* Vertical connector line */}
                              <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-200/60 dark:bg-slate-700/60" />
                              <div className="space-y-3">
                                {[...tool.status_history].reverse().map((entry, hidx) => (
                                  <div key={hidx} className="relative flex items-start gap-3 text-xs">
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
                <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{statusUpdateModal.brand} {statusUpdateModal.model_number}</p>
              </div>
              <button onClick={() => setStatusUpdateModal(null)} className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full my-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Top accent */}
            <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700/60">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-lg">{isEdit ? 'edit' : 'build'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{isEdit ? 'Edit Tool' : 'Add Tool to Job'}</h3>
                {isEdit && <p className="text-xs text-slate-500 mt-0.5 truncate">{formData.brand} {formData.model_number}</p>}
              </div>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-6">
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
            <div className="sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/60 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-sm">add_circle</span>
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">New Repair Job</h3>
              </div>
              {/* 4-step progress stepper */}
              <div className="flex items-center gap-0 flex-1 min-w-0 max-w-sm mx-auto">
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
                        <span className={`text-[10px] font-bold whitespace-nowrap ${active ? 'text-blue-400' : done ? 'text-slate-500' : 'text-slate-400 dark:text-slate-600'}`}>{label}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button onClick={handleCloseNewJob} className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Step 1: Customer Selection */}
            {newJobStep === 1 && (
              <div className="p-6 space-y-5">
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
                                onChange={(e) => setNewJobForm({ ...newJobForm, first_name: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                Last Name<span className="text-red-400 ml-1">*</span>
                              </label>
                              <input
                                value={newJobForm.last_name || ''}
                                onChange={(e) => setNewJobForm({ ...newJobForm, last_name: e.target.value })}
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
                              onChange={(e) => setNewJobForm({ ...newJobForm, company_name: e.target.value })}
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
                                onChange={(e) => setNewJobForm({ ...newJobForm, phone: formatPhone(e.target.value) })}
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
                              onChange={(e) => setNewJobForm({ ...newJobForm, address: e.target.value })}
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
                <div className="flex gap-3 pt-2">
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
              <div className="p-6 space-y-6">
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
                <div className="flex gap-3">
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
              <div className="p-6 space-y-6">
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
                <div className="flex gap-3">
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
              <form onSubmit={handleCreateJob} className="p-6 space-y-6">
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
                <div className="flex gap-3">
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
                  <p className="text-xs text-slate-500 mt-0.5">{jobEditForm.first_name} {jobEditForm.last_name}</p>
                </div>
              </div>
              <button onClick={() => setEditingJob(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">First Name *</label>
                  <input value={jobEditForm.first_name || ''} onChange={(e) => setJobEditForm({ ...jobEditForm, first_name: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Last Name *</label>
                  <input value={jobEditForm.last_name || ''} onChange={(e) => setJobEditForm({ ...jobEditForm, last_name: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Company</label>
                <input value={jobEditForm.company_name || ''} onChange={(e) => setJobEditForm({ ...jobEditForm, company_name: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Email *</label>
                  <input type="email" value={jobEditForm.email || ''} onChange={(e) => setJobEditForm({ ...jobEditForm, email: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Phone *</label>
                  <input value={jobEditForm.phone || ''} onChange={(e) => setJobEditForm({ ...jobEditForm, phone: formatPhone(e.target.value) })} placeholder="###-###-####" className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Address</label>
                <input value={jobEditForm.address || ''} onChange={(e) => setJobEditForm({ ...jobEditForm, address: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Notes (Internal)</label>
                <textarea value={jobEditForm.customer_notes || ''} onChange={(e) => setJobEditForm({ ...jobEditForm, customer_notes: e.target.value })} rows={3} placeholder="Internal notes (not visible to customer)" className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all resize-none" />
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
            <div className="p-6">
              <div className="flex items-center justify-center mb-5">
                <div className="w-16 h-16 bg-red-100 border border-red-300 dark:bg-red-900/30 dark:border-red-800/40 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-red-600 dark:text-red-400">delete_forever</span>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase text-center mb-2">Delete Repair Job</h3>
              <p className="text-slate-600 dark:text-slate-300 text-center mb-1">
                Delete job <span className="font-bold text-slate-900 dark:text-white font-mono">{deleteConfirmId.request_number}</span>?
              </p>
              <p className="text-red-600/80 dark:text-red-300/80 text-sm text-center mb-6">This will permanently delete all tool data and photos.</p>
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
    </div>
  );
}

// ── TOOL FORM (reusable for new job form and add tool modal) ──
// wizardStep: 2 = Tool Identification + Photos, 3 = Job Details + Parts, 4 = Labour & Scheduling
// Omit wizardStep (or isNewJobForm=false) to render all sections (add tool modal / edit mode)
function ToolForm({ toolData, onChange, isNewJobForm, wizardStep, idx, newJobForm, setNewJobForm }) {
  const handleChange = (field, value) => {
    if (isNewJobForm) {
      const updatedTools = newJobForm.tools.map((t, i) => i === idx ? { ...t, [field]: value } : t);
      setNewJobForm({ ...newJobForm, tools: updatedTools });
    } else {
      onChange({ ...toolData, [field]: value });
    }
  };

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
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Tool Type <span className="text-red-400">*</span></label>
              <input required value={data.tool_type || ''} onChange={(e) => handleChange('tool_type', e.target.value)}
                placeholder="e.g., Impact Wrench" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Brand <span className="text-red-400">*</span></label>
              <input required value={data.brand || ''} onChange={(e) => handleChange('brand', e.target.value)}
                placeholder="e.g., Ingersoll Rand" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Model Number <span className="text-red-400">*</span></label>
              <input required value={data.model_number || ''} onChange={(e) => handleChange('model_number', e.target.value)}
                placeholder="e.g., 2135TIMAX" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Serial Number</label>
              <input value={data.serial_number || ''} onChange={(e) => handleChange('serial_number', e.target.value)}
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
              <textarea value={data.remarks || ''} onChange={(e) => handleChange('remarks', e.target.value)}
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
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
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
          <button type="button" onClick={() => handleChange('parts', [...(data.parts || []), { name: '', quantity: 1, status: 'pending' }])}
            className="text-sm text-primary hover:text-blue-400 font-bold flex items-center gap-1 transition-colors">
            <span className="material-symbols-outlined text-base">add</span> Add Part
          </button>
        </div>
        {(data.parts || []).length > 0 && (
          <div className="space-y-2">
            {data.parts.map((part, pi) => (
              <div key={pi} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-300 dark:border-slate-700">
                <div className="flex-1 flex gap-3">
                  <input placeholder="Part name *" value={part.name} onChange={(e) => {
                    const updated = [...data.parts]; updated[pi] = { ...part, name: e.target.value }; handleChange('parts', updated);
                  }} className="w-[70%] px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-base focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="number" min="1" placeholder="Qty" value={part.quantity ?? ''} onChange={(e) => {
                    const updated = [...data.parts]; updated[pi] = { ...part, quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 1 }; handleChange('parts', updated);
                  }} className="w-[15%] px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-base focus:outline-none focus:ring-1 focus:ring-primary" />
                  <select value={part.status} onChange={(e) => {
                    const updated = [...data.parts]; updated[pi] = { ...part, status: e.target.value }; handleChange('parts', updated);
                  }} className="w-[15%] px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-base focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="pending">Pending</option>
                    <option value="ordered">Ordered</option>
                    <option value="received">Received</option>
                    <option value="installed">Installed</option>
                  </select>
                </div>
                <button type="button" onClick={() => {
                  const updated = data.parts.filter((_, i) => i !== pi); handleChange('parts', updated);
                }} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
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
              <input value={data.zoho_ref || ''} onChange={(e) => handleChange('zoho_ref', e.target.value)}
                placeholder="Optional" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Assigned Technician</label>
              <input value={data.assigned_technician || ''} onChange={(e) => handleChange('assigned_technician', e.target.value)}
                placeholder="Optional" className={inputCls} />
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
