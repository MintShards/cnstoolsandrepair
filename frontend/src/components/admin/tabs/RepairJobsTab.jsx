import { useState, useEffect, useRef, useCallback } from 'react';
import { repairsAPI, customersAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  if (digits.length > 3) return digits.slice(0, 3) + '-' + digits.slice(3);
  return digits;
}

const REPAIR_STATUSES = [
  { value: 'received', label: 'Received', color: 'bg-slate-700 text-slate-300 border-slate-600' },
  { value: 'dismantled', label: 'Dismantled', color: 'bg-yellow-900/30 text-yellow-400 border-yellow-700' },
  { value: 'quotation_sent', label: 'Quote Sent', color: 'bg-purple-900/30 text-purple-400 border-purple-700' },
  { value: 'approved', label: 'Approved', color: 'bg-green-900/30 text-green-400 border-green-700' },
  { value: 'declined', label: 'Declined', color: 'bg-red-900/30 text-red-400 border-red-700' },
  { value: 'parts_ordered', label: 'Parts Ordered', color: 'bg-orange-900/30 text-orange-400 border-orange-700' },
  { value: 'parts_received', label: 'Parts Received', color: 'bg-cyan-900/30 text-cyan-400 border-cyan-700' },
  { value: 'in_repair', label: 'In Repair', color: 'bg-blue-900/30 text-blue-400 border-blue-700' },
  { value: 'testing', label: 'Testing / QC', color: 'bg-indigo-900/30 text-indigo-400 border-indigo-700' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup', color: 'bg-emerald-900/30 text-emerald-400 border-emerald-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-900/50 text-green-300 border-green-600' },
  { value: 'returned', label: 'Returned', color: 'bg-slate-800/50 text-slate-300 border-slate-500' },
  { value: 'closed', label: 'Closed', color: 'bg-slate-800/50 text-slate-400 border-slate-600' },
  { value: 'abandoned', label: 'Abandoned', color: 'bg-rose-900/30 text-rose-400 border-rose-700' },
];

const PRIORITIES = [
  { value: 'standard', label: 'Standard', color: 'bg-slate-700 text-slate-300 border-slate-600' },
  { value: 'rush', label: 'Rush', color: 'bg-orange-900/30 text-orange-400 border-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-900/30 text-red-400 border-red-700' },
];

const getStatusConfig = (value) => REPAIR_STATUSES.find(s => s.value === value) || REPAIR_STATUSES[0];
const getPriorityConfig = (value) => PRIORITIES.find(p => p.value === value) || PRIORITIES[0];

const StatusBadge = ({ status }) => {
  const cfg = getStatusConfig(status);
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${cfg.color}`}>
      {cfg.label}
    </span>
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
  quantity: 1, remarks: '', parts: [{ name: '', quantity: 1, unit_cost: '', status: 'pending' }],
  labour_hours: '', hourly_rate: '', priority: 'standard', warranty: false,
  zoho_quote_ref: '', assigned_technician: '', estimated_completion: ''
};

const getEmptyTool = () => ({
  ...EMPTY_TOOL_BASE,
  date_received: new Date().toISOString().split('T')[0],
});

const getEmptyJob = () => ({
  customer_id: null, company_name: '', contact_person: '', email: '', phone: '',
  address: '', customer_notes: '', source: 'walk_in', tools: [getEmptyTool()]
});

export default function RepairJobsTab({ preselectedCustomer, onPreselectedCustomerUsed }) {
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
  const [editingJob, setEditingJob] = useState(false);
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
      contact_person: customer.contact_person,
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
    setNewJobForm({ ...newJobForm, customer_id: null, company_name: '', contact_person: '', email: '', phone: '', address: '', customer_notes: '' });
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
      if (addToolForm && !addingTool) { setAddToolForm(null); return; }
      if (deleteConfirmId) { setDeleteConfirmId(null); return; }
      if (selectedJob) { setSelectedJob(null); return; }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, statusUpdateModal, updatingStatus, addToolForm, addingTool, deleteConfirmId, selectedJob]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await repairsAPI.list(params);
      setJobs(data);
    } catch {
      showToast('error', 'Failed to load repair jobs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // ── FILTER / PAGINATION ──────────────────────────────
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || (() => {
      const s = searchQuery.toLowerCase();
      return (
        job.company_name?.toLowerCase().includes(s) ||
        job.contact_person.toLowerCase().includes(s) ||
        job.email.toLowerCase().includes(s) ||
        job.request_number.toLowerCase().includes(s)
      );
    })();
    const matchesPriority = !priorityFilter || job.tools.some(t => t.priority === priorityFilter);
    return matchesSearch && matchesPriority;
  });

  const totalResults = filteredJobs.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedJobs = filteredJobs.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  };

  // Summary of tool statuses for list view
  const getToolStatusSummary = (tools) => {
    if (!tools?.length) return null;
    const counts = {};
    tools.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
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
      const tools = newJobForm.tools.map(t => ({
        ...t,
        quantity: parseInt(t.quantity) || 1,
        labour_hours: t.labour_hours ? parseFloat(t.labour_hours) : null,
        hourly_rate: t.hourly_rate ? parseFloat(t.hourly_rate) : null,
        serial_number: t.serial_number || null,
        remarks: t.remarks || null,
        parts: (t.parts || []).filter(p => p.name.trim()),
        zoho_quote_ref: t.zoho_quote_ref || null,
        assigned_technician: t.assigned_technician || null,
        estimated_completion: t.estimated_completion || null,
      }));

      let payload;
      if (newJobForm.customer_id) {
        // Existing customer — send customer_id + tools + source only
        payload = {
          customer_id: newJobForm.customer_id,
          customer_notes: newJobForm.customer_notes || null,
          source: newJobForm.source,
          tools,
        };
      } else {
        // Inline new customer fields
        payload = {
          company_name: newJobForm.company_name || null,
          contact_person: newJobForm.contact_person,
          email: newJobForm.email,
          phone: newJobForm.phone,
          address: newJobForm.address || null,
          customer_notes: newJobForm.customer_notes || null,
          source: newJobForm.source,
          tools,
        };
      }

      const created = await repairsAPI.create(payload);
      setJobs([created, ...jobs]);
      handleCloseNewJob();
      showToast('success', `Repair job ${created.request_number} created successfully`);
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg).join(', ')
        : (detail || 'Failed to create repair job');
      showToast('error', msg);
    } finally {
      setSavingJob(false);
    }
  };

  // ── VIEW / EDIT JOB ──────────────────────────────────
  const openJob = async (job) => {
    try {
      const fresh = await repairsAPI.get(job.id);
      setSelectedJob(fresh);
      setEditingJob(false);
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
    try {
      const updated = await repairsAPI.update(selectedJob.id, jobEditForm);
      setSelectedJob(updated);
      setJobs(jobs.map(j => j.id === updated.id ? updated : j));
      setEditingJob(false);
      showToast('success', 'Job details updated');
    } catch {
      showToast('error', 'Failed to update job');
    }
  };

  // ── STATUS UPDATE ────────────────────────────────────
  const openStatusUpdate = (tool) => {
    setStatusUpdateModal(tool);
    setStatusUpdateForm({ status: tool.status, notes: '', estimated_completion: '' });
  };

  const handleStatusUpdate = async () => {
    if (!statusUpdateModal) return;
    setUpdatingStatus(true);
    try {
      const payload = {
        status: statusUpdateForm.status,
        notes: statusUpdateForm.notes || null,
        estimated_completion: statusUpdateForm.estimated_completion || null,
      };
      const updated = await repairsAPI.updateToolStatus(selectedJob.id, statusUpdateModal.tool_id, payload);
      setSelectedJob(updated);
      setJobs(jobs.map(j => j.id === updated.id ? updated : j));
      setStatusUpdateModal(null);
      showToast('success', 'Tool status updated');
    } catch {
      showToast('error', 'Failed to update tool status');
    } finally {
      setUpdatingStatus(false);
    }
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
      parts: tool.parts?.length > 0 ? tool.parts.map(p => ({ ...p })) : [{ name: '', quantity: 1, unit_cost: '', status: 'pending' }],
      labour_hours: tool.labour_hours ?? '',
      hourly_rate: tool.hourly_rate ?? '',
      priority: tool.priority || 'standard',
      warranty: tool.warranty || false,
      zoho_quote_ref: tool.zoho_quote_ref || '',
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
    try {
      const payload = {
        ...toolEditForm,
        quantity: parseInt(toolEditForm.quantity) || 1,
        labour_hours: toolEditForm.labour_hours ? parseFloat(toolEditForm.labour_hours) : null,
        hourly_rate: toolEditForm.hourly_rate ? parseFloat(toolEditForm.hourly_rate) : null,
        serial_number: toolEditForm.serial_number || null,
        remarks: toolEditForm.remarks || null,
        parts: (toolEditForm.parts || []).filter(p => p.name?.trim()),
        zoho_quote_ref: toolEditForm.zoho_quote_ref || null,
        assigned_technician: toolEditForm.assigned_technician || null,
        estimated_completion: toolEditForm.estimated_completion || null,
      };
      const updated = await repairsAPI.updateTool(selectedJob.id, editingToolId, payload);
      setSelectedJob(updated);
      setJobs(jobs.map(j => j.id === updated.id ? updated : j));
      setEditingToolId(null);
      setToolEditForm(null);
      showToast('success', 'Tool details updated');
    } catch {
      showToast('error', 'Failed to update tool');
    } finally {
      setSavingToolEdit(false);
    }
  };

  // ── ADD TOOL TO EXISTING JOB ─────────────────────────
  const handleAddTool = async () => {
    if (!addToolForm) return;
    setAddingTool(true);
    try {
      const payload = {
        ...addToolForm,
        quantity: parseInt(addToolForm.quantity) || 1,
        labour_hours: addToolForm.labour_hours ? parseFloat(addToolForm.labour_hours) : null,
        hourly_rate: addToolForm.hourly_rate ? parseFloat(addToolForm.hourly_rate) : null,
        serial_number: addToolForm.serial_number || null,
        remarks: addToolForm.remarks || null,
        parts: (addToolForm.parts || []).filter(p => p.name.trim()),
        zoho_quote_ref: addToolForm.zoho_quote_ref || null,
        assigned_technician: addToolForm.assigned_technician || null,
        estimated_completion: addToolForm.estimated_completion || null,
      };
      const updated = await repairsAPI.addTool(selectedJob.id, payload);
      setSelectedJob(updated);
      setJobs(jobs.map(j => j.id === updated.id ? updated : j));
      setAddToolForm(null);
      showToast('success', 'Tool added to repair job');
    } catch {
      showToast('error', 'Failed to add tool');
    } finally {
      setAddingTool(false);
    }
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
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Repair Jobs</h2>
        <button
          onClick={handleOpenNewJob}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold text-sm transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Repair Job
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 p-6 bg-slate-800 rounded-lg border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Search</label>
            <input
              type="text"
              placeholder="Company, contact, email, request #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Filter by Tool Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              {REPAIR_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Filter by Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">Jobs ({totalResults})</h3>

        {loading ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-2 text-slate-400">Loading repair jobs...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-slate-600">build</span>
            <p className="mt-2 text-slate-400">
              {searchQuery || statusFilter || priorityFilter ? 'No jobs match your filters' : 'No repair jobs yet. Create one or convert an online request.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Work Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Tools</th>
                  <th className="py-3 px-4">Status Summary</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {paginatedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="text-slate-300 font-mono text-xs">{job.request_number}</div>
                      {job.source === 'online_request' && (
                        <span className="text-xs text-slate-500">Online</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-300 font-bold">{job.company_name || job.contact_person}</div>
                      {job.company_name && <div className="text-slate-400 text-xs">{job.contact_person}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {job.tools.length} tool{job.tools.length !== 1 ? 's' : ''}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {getToolStatusSummary(job.tools)?.map(({ status, count }) => (
                          <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${getStatusConfig(status).color}`}>
                            {count > 1 && <span>{count}×</span>}
                            {getStatusConfig(status).label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{formatDateShort(job.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openJob(job)}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          Manage
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(job)}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-red-900 hover:bg-red-800 text-red-200 rounded-lg text-xs font-bold transition-all"
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
        {!loading && totalResults > pageSize && (
          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
            <div className="text-sm text-slate-400">
              Showing <span className="text-white font-bold">{startIndex + 1}</span> to{' '}
              <span className="text-white font-bold">{Math.min(startIndex + pageSize, totalResults)}</span> of{' '}
              <span className="text-white font-bold">{totalResults}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              {getPageNumbers().map((page, idx) => (
                page === '...' ? (
                  <span key={`e-${idx}`} className="px-3 py-2 text-slate-500">...</span>
                ) : (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${currentPage === page ? 'bg-primary text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                    {page}
                  </button>
                )
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Show:</label>
              <select value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── JOB DETAIL MODAL ─────────────────────────────── */}
      {selectedJob && (
        <div role="dialog" aria-modal="true" aria-labelledby="wo-dialog-title" className="fixed inset-0 z-50 bg-black/90 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setSelectedJob(null)}>
          <div className="bg-slate-800 rounded-lg max-w-5xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between z-10">
              <div>
                <h3 id="wo-dialog-title" className="text-xl font-black text-white uppercase">Work Order {selectedJob.request_number}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-slate-400">Created {formatDateShort(selectedJob.created_at)}</span>
                  {selectedJob.source === 'online_request' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">Online Request</span>
                  )}
                  {selectedJob.source === 'walk_in' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-600">Walk-in</span>
                  )}
                </div>
              </div>
              <button ref={detailCloseRef} onClick={() => setSelectedJob(null)} className="text-slate-400 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white uppercase">Customer / Company</h4>
                  {!editingJob ? (
                    <button onClick={() => { setEditingJob(true); setJobEditForm({
                      company_name: selectedJob.company_name || '',
                      contact_person: selectedJob.contact_person,
                      email: selectedJob.email,
                      phone: selectedJob.phone,
                      address: selectedJob.address || '',
                      customer_notes: selectedJob.customer_notes || '',
                    }); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all">
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingJob(false)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all">Cancel</button>
                      <button onClick={handleSaveJobEdit} className="px-3 py-1.5 bg-primary hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all">Save</button>
                    </div>
                  )}
                </div>
                {editingJob ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'company_name', label: 'Company Name', placeholder: 'Optional' },
                      { key: 'contact_person', label: 'Contact Person', required: true },
                      { key: 'email', label: 'Email', required: true },
                      { key: 'phone', label: 'Phone (###-###-####)', required: true },
                      { key: 'address', label: 'Address', placeholder: 'Optional' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                        <input
                          value={jobEditForm[f.key] || ''}
                          onChange={(e) => {
                            const val = f.key === 'phone' ? formatPhone(e.target.value) : e.target.value;
                            setJobEditForm({ ...jobEditForm, [f.key]: val });
                          }}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    ))}
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Internal Notes</label>
                      <textarea
                        value={jobEditForm.customer_notes || ''}
                        onChange={(e) => setJobEditForm({ ...jobEditForm, customer_notes: e.target.value })}
                        rows={2}
                        placeholder="Internal notes (not visible to customer)"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {selectedJob.company_name && (
                      <div><span className="text-slate-400">Company:</span><span className="ml-2 text-white font-bold">{selectedJob.company_name}</span></div>
                    )}
                    <div><span className="text-slate-400">Contact:</span><span className="ml-2 text-white">{selectedJob.contact_person}</span></div>
                    <div><span className="text-slate-400">Email:</span><a href={`mailto:${selectedJob.email}`} className="ml-2 text-primary hover:underline">{selectedJob.email}</a></div>
                    <div><span className="text-slate-400">Phone:</span><a href={`tel:${selectedJob.phone}`} className="ml-2 text-primary hover:underline">{selectedJob.phone}</a></div>
                    {selectedJob.address && <div className="md:col-span-2"><span className="text-slate-400">Address:</span><span className="ml-2 text-white">{selectedJob.address}</span></div>}
                    {selectedJob.customer_notes && <div className="md:col-span-2"><span className="text-slate-400">Notes:</span><span className="ml-2 text-slate-300 italic">{selectedJob.customer_notes}</span></div>}
                  </div>
                )}
              </div>

              {/* Tools */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white uppercase">Tools ({selectedJob.tools.length})</h4>
                  <button
                    onClick={() => setAddToolForm(getEmptyTool())}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Tool
                  </button>
                </div>

                <div className="space-y-4">
                  {selectedJob.tools.map((tool, idx) => (
                    <div key={tool.tool_id} className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                      {/* Tool Header */}
                      <div className="p-4 border-b border-slate-700">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-white">
                              Tool {idx + 1}: {tool.brand} {tool.model_number}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {tool.tool_type} • Qty: {tool.quantity}
                              {tool.serial_number && ` • S/N: ${tool.serial_number}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <PriorityBadge priority={tool.priority} />
                            {tool.warranty && (
                              <span className="hidden sm:inline px-2 py-1 rounded text-xs font-bold bg-teal-900/30 text-teal-400 border border-teal-700">Warranty</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {tool.warranty && (
                            <span className="sm:hidden px-2 py-1 rounded text-xs font-bold bg-teal-900/30 text-teal-400 border border-teal-700">Warranty</span>
                          )}
                          <button
                            onClick={() => openStatusUpdate(tool)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">update</span>
                            Update Status
                          </button>
                          {editingToolId !== tool.tool_id && (
                            <button
                              onClick={() => handleStartToolEdit(tool)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              Edit
                            </button>
                          )}
                          {selectedJob.tools.length > 1 && (
                            <button
                              onClick={() => handleRemoveTool(tool.tool_id)}
                              className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                                removeConfirmId === tool.tool_id
                                  ? 'bg-red-900/40 text-red-300 border border-red-700'
                                  : 'p-1.5 text-red-400 hover:text-red-300'
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
                      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-3 flex-wrap">
                        <StatusBadge status={tool.status} />
                        <div className="text-xs text-slate-400">
                          Received: {formatDateShort(tool.date_received)}
                          {tool.date_completed && ` • Completed: ${formatDateShort(tool.date_completed)}`}
                        </div>
                      </div>

                      {editingToolId === tool.tool_id && toolEditForm ? (
                        /* ── EDIT MODE ── */
                        <div className="p-4 border-b border-slate-700">
                          <ToolForm toolData={toolEditForm} onChange={setToolEditForm} />
                          <div className="flex gap-3 mt-4">
                            <button onClick={handleCancelToolEdit} disabled={savingToolEdit} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                              Cancel
                            </button>
                            <button onClick={handleSaveToolEdit} disabled={savingToolEdit} className="px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                              {savingToolEdit ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── VIEW MODE ── */
                        <>
                      {/* Scheduling & Meta */}
                      <div className="px-4 py-3 border-b border-slate-700">
                        <div className="flex items-center gap-4 flex-wrap text-xs">
                          <div>
                            <span className="text-slate-500">Est. Completion:</span>
                            <span className={`ml-1 ${tool.estimated_completion ? 'text-slate-300' : 'text-slate-600'}`}>
                              {tool.estimated_completion ? formatDateShort(tool.estimated_completion) : 'Not set'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Warranty:</span>
                            <span className={`ml-1 ${tool.warranty ? 'text-teal-400 font-bold' : 'text-slate-600'}`}>
                              {tool.warranty ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">S/N:</span>
                            <span className={`ml-1 ${tool.serial_number ? 'text-slate-300' : 'text-slate-600'}`}>
                              {tool.serial_number || 'Not set'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tool Details */}
                      <div className="p-4 space-y-4 text-sm">
                        {/* Remarks */}
                        <div>
                          <span className="text-slate-400 text-xs uppercase tracking-wide">Remarks / Description</span>
                          <p className={`mt-0.5 ${tool.remarks ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                            {tool.remarks || 'No remarks'}
                          </p>
                        </div>

                        {/* Parts */}
                        <div>
                          <span className="text-slate-400 text-xs uppercase tracking-wide">Parts</span>
                          {tool.parts && tool.parts.filter(p => p.name?.trim()).length > 0 ? (
                            <div className="mt-1 space-y-1">
                              {tool.parts.filter(p => p.name?.trim()).map((p, pi) => (
                                <div key={pi} className="flex items-center gap-3 text-sm">
                                  <span className="text-slate-300">{p.name}</span>
                                  <span className="text-slate-500">x{p.quantity}</span>
                                  {p.unit_cost != null && <span className="text-slate-400">${parseFloat(p.unit_cost).toFixed(2)}</span>}
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    p.status === 'installed' ? 'bg-green-900/40 text-green-400' :
                                    p.status === 'received' ? 'bg-cyan-900/40 text-cyan-400' :
                                    p.status === 'ordered' ? 'bg-orange-900/40 text-orange-400' :
                                    'bg-slate-700 text-slate-400'
                                  }`}>{p.status}</span>
                                </div>
                              ))}
                              {tool.parts.some(p => p.unit_cost != null) && (() => {
                                const total = tool.parts.reduce((sum, p) => p.unit_cost != null ? sum + (parseFloat(p.unit_cost) * (p.quantity || 1)) : sum, 0);
                                return <p className="text-xs text-slate-400 mt-1">Parts Total: <span className="text-white font-bold">${total.toFixed(2)}</span></p>;
                              })()}
                            </div>
                          ) : (
                            <p className="mt-0.5 text-slate-600 italic">No parts listed</p>
                          )}
                        </div>

                        {/* Labour & Cost + Technician row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div>
                            <span className="text-slate-400 text-xs uppercase tracking-wide">Labour</span>
                            <p className={`mt-0.5 ${tool.labour_hours || tool.hourly_rate ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                              {tool.labour_hours || tool.hourly_rate ? (
                                <>
                                  {tool.labour_hours ? `${tool.labour_hours} hrs` : '— hrs'}
                                  {tool.hourly_rate ? ` @ $${tool.hourly_rate}/hr` : ''}
                                  {tool.labour_hours && tool.hourly_rate && (
                                    <span className="ml-2 text-slate-400">= <span className="text-white font-bold">${(parseFloat(tool.labour_hours) * parseFloat(tool.hourly_rate)).toFixed(2)}</span></span>
                                  )}
                                </>
                              ) : 'Not set'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-xs uppercase tracking-wide">Technician</span>
                            <p className={`mt-0.5 ${tool.assigned_technician ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                              {tool.assigned_technician || 'Unassigned'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-xs uppercase tracking-wide">Zoho Quote Ref</span>
                            <p className={`mt-0.5 ${tool.zoho_quote_ref ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                              {tool.zoho_quote_ref || 'None'}
                            </p>
                          </div>
                        </div>
                      </div>
                        </>
                      )}

                      {/* Photos */}
                      <div className="px-4 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Photos ({tool.photos?.length || 0})</span>
                          <label className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-bold cursor-pointer transition-all">
                            <span className="material-symbols-outlined text-xs">upload</span>
                            {uploadingPhoto === tool.tool_id ? 'Uploading...' : 'Upload'}
                            <input type="file" accept="image/*" className="hidden"
                              onChange={(e) => e.target.files?.[0] && handlePhotoUpload(tool.tool_id, e.target.files[0])}
                            />
                          </label>
                        </div>
                        {tool.photos?.length > 0 && (
                          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                            {tool.photos.map((photo, pidx) => (
                              <div key={pidx} className="aspect-square cursor-pointer group relative" onClick={() => setSelectedPhoto(photo)}>
                                <img
                                  src={photo.startsWith('http') ? photo : `${API_BASE_URL}/uploads/${photo}`}
                                  alt={`Photo ${pidx + 1}`}
                                  className="w-full h-full object-cover rounded border border-slate-700 group-hover:border-primary transition-all"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                                  <span className="material-symbols-outlined text-white text-xl">zoom_in</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Status History */}
                      {tool.status_history?.length > 0 && (
                        <details className="border-t border-slate-700">
                          <summary className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-300 select-none">
                            Status History ({tool.status_history.length})
                          </summary>
                          <div className="px-4 pb-4 space-y-2 mt-2">
                            {[...tool.status_history].reverse().map((entry, hidx) => (
                              <div key={hidx} className="flex items-start gap-3 text-xs">
                                <div className="flex-shrink-0 mt-0.5">
                                  <StatusBadge status={entry.status} />
                                </div>
                                <div className="text-slate-400">
                                  <span>{formatDate(entry.timestamp)}</span>
                                  {entry.notes && <span className="ml-2 text-slate-300 italic">— {entry.notes}</span>}
                                </div>
                              </div>
                            ))}
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
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => !updatingStatus && setStatusUpdateModal(null)}>
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-slate-600" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white uppercase mb-1">Update Tool Status</h3>
            <p className="text-slate-400 text-sm mb-4">
              {statusUpdateModal.brand} {statusUpdateModal.model_number}
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400">Current:</span>
                  <StatusBadge status={statusUpdateModal.status} />
                </div>
                <label className="block text-sm font-bold text-slate-300 mb-2">New Status</label>
                <select
                  value={statusUpdateForm.status}
                  onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {REPAIR_STATUSES.map(s => (
                    <option key={s.value} value={s.value} disabled={s.value === statusUpdateModal.status}>
                      {s.label}{s.value === statusUpdateModal.status ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={statusUpdateForm.notes}
                  onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, notes: e.target.value })}
                  placeholder="e.g., Parts arrived from supplier"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Est. Completion Date (optional)</label>
                <input
                  type="date"
                  value={statusUpdateForm.estimated_completion}
                  onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, estimated_completion: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStatusUpdateModal(null)} disabled={updatingStatus} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all disabled:opacity-50">Cancel</button>
              <button onClick={handleStatusUpdate} disabled={updatingStatus} className="flex-1 px-4 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold transition-all disabled:opacity-50">
                {updatingStatus ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD TOOL MODAL ───────────────────────────────── */}
      {addToolForm && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-start justify-center p-4 overflow-y-auto" onClick={() => !addingTool && setAddToolForm(null)}>
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full my-8 p-6 border border-slate-600" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white uppercase mb-4">Add Tool</h3>
            <ToolForm toolData={addToolForm} onChange={setAddToolForm} />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setAddToolForm(null)} disabled={addingTool} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all disabled:opacity-50">Cancel</button>
              <button onClick={handleAddTool} disabled={addingTool} className="flex-1 px-4 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold transition-all disabled:opacity-50">
                {addingTool ? 'Adding...' : 'Add Tool'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW JOB FORM MODAL (TWO-STEP) ───────────────── */}
      {showNewJobForm && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-start justify-center p-4 overflow-y-auto" onClick={handleCloseNewJob}>
          <div className="bg-slate-800 rounded-lg max-w-3xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white uppercase">New Repair Job</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${newJobStep === 1 ? 'bg-primary text-white' : 'bg-slate-600 text-slate-400'}`}>1 Customer</span>
                  <span className="text-slate-600">→</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${newJobStep === 2 ? 'bg-primary text-white' : 'bg-slate-600 text-slate-400'}`}>2 Tools</span>
                </div>
              </div>
              <button onClick={handleCloseNewJob} className="text-slate-400 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>

            {/* Step 1: Customer Selection */}
            {newJobStep === 1 && (
              <div className="p-6 space-y-5">
                {!selectedCustomerObj ? (
                  <>
                    {/* Search existing */}
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Search Existing Customer</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input
                          type="text"
                          placeholder="Search by name, company, or email..."
                          value={customerSearch}
                          onChange={(e) => { setCustomerSearch(e.target.value); searchCustomersDebounced(e.target.value); }}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {customerSearching && (
                          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg animate-spin">autorenew</span>
                        )}
                      </div>

                      {/* Search results */}
                      {customerResults.length > 0 && (
                        <div className="mt-1 bg-slate-900 border border-slate-600 rounded-lg overflow-hidden">
                          {customerResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectExistingCustomer(c)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-700 border-b border-slate-700 last:border-0 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-white font-bold text-sm">{c.contact_person}</p>
                                  {c.company_name && <p className="text-slate-400 text-xs">{c.company_name}</p>}
                                </div>
                                <p className="text-slate-400 text-xs">{c.email}</p>
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
                      <div className="flex-1 h-px bg-slate-700" />
                      <span className="text-slate-500 text-xs font-bold uppercase">or</span>
                      <div className="flex-1 h-px bg-slate-700" />
                    </div>

                    {/* New customer toggle */}
                    {!showInlineCustomerForm ? (
                      <button
                        type="button"
                        onClick={() => setShowInlineCustomerForm(true)}
                        className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-primary text-slate-400 hover:text-primary rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Create New Customer
                      </button>
                    ) : (
                      <div className="bg-slate-900 rounded-lg border border-slate-600 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white uppercase">New Customer</h4>
                          <button type="button" onClick={() => setShowInlineCustomerForm(false)} className="text-slate-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            { key: 'company_name', label: 'Company Name', placeholder: 'Optional', required: false },
                            { key: 'contact_person', label: 'Contact Person', required: true },
                            { key: 'email', label: 'Email', type: 'email', required: true },
                            { key: 'phone', label: 'Phone (###-###-####)', required: true },
                            { key: 'address', label: 'Address', placeholder: 'Optional', required: false },
                          ].map(f => (
                            <div key={f.key} className={f.key === 'address' ? 'md:col-span-2' : ''}>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">
                                {f.label}{f.required && <span className="text-red-400 ml-1">*</span>}
                              </label>
                              <input
                                type={f.type || 'text'}
                                placeholder={f.placeholder}
                                value={newJobForm[f.key] || ''}
                                onChange={(e) => {
                                  const val = f.key === 'phone' ? formatPhone(e.target.value) : e.target.value;
                                  setNewJobForm({ ...newJobForm, [f.key]: val });
                                }}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                          ))}
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Internal Notes</label>
                            <textarea
                              value={newJobForm.customer_notes || ''}
                              onChange={(e) => setNewJobForm({ ...newJobForm, customer_notes: e.target.value })}
                              rows={2}
                              placeholder="Optional"
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Selected customer summary card */
                  <div className="bg-slate-900 rounded-lg border border-primary/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary text-lg">person</span>
                        </div>
                        <div>
                          <p className="text-white font-bold">{selectedCustomerObj.contact_person}</p>
                          {selectedCustomerObj.company_name && <p className="text-slate-400 text-sm">{selectedCustomerObj.company_name}</p>}
                          <p className="text-slate-400 text-xs mt-0.5">{selectedCustomerObj.email} · {selectedCustomerObj.phone}</p>
                        </div>
                      </div>
                      <button type="button" onClick={clearSelectedCustomer} className="text-slate-400 hover:text-white transition-colors flex-shrink-0" title="Change customer">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 1 actions */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={handleCloseNewJob} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Validate: either a selected customer or inline form with required fields
                      if (selectedCustomerObj) {
                        setNewJobStep(2);
                      } else if (showInlineCustomerForm) {
                        if (!newJobForm.contact_person || !newJobForm.email || !newJobForm.phone) {
                          showToast('error', 'Contact person, email, and phone are required');
                          return;
                        }
                        setNewJobStep(2);
                      } else {
                        showToast('error', 'Please select or create a customer first');
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                  >
                    Next: Add Tools
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Tools */}
            {newJobStep === 2 && (
              <form onSubmit={handleCreateJob} className="p-6 space-y-6">
                {/* Customer summary (read-only) */}
                <div className="bg-slate-900 rounded-lg border border-slate-700 p-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-lg">person</span>
                  <div>
                    <p className="text-white text-sm font-bold">
                      {selectedCustomerObj?.contact_person || newJobForm.contact_person}
                      {(selectedCustomerObj?.company_name || newJobForm.company_name) && (
                        <span className="text-slate-400 font-normal"> — {selectedCustomerObj?.company_name || newJobForm.company_name}</span>
                      )}
                    </p>
                    <p className="text-slate-400 text-xs">{selectedCustomerObj?.email || newJobForm.email}</p>
                  </div>
                  <button type="button" onClick={() => setNewJobStep(1)} className="ml-auto text-slate-400 hover:text-white text-xs font-bold transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Change
                  </button>
                </div>

                {/* Tools */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white uppercase">Tools to Repair</h4>
                    <button type="button" onClick={handleAddToolToForm}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all">
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Another Tool
                    </button>
                  </div>
                  <div className="space-y-4">
                    {newJobForm.tools.map((tool, idx) => (
                      <div key={idx} className="bg-slate-900 rounded-lg border border-slate-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold text-white">Tool {idx + 1}</h5>
                          {newJobForm.tools.length > 1 && (
                            <button type="button" onClick={() => handleRemoveToolFromForm(idx)} className="text-red-400 hover:text-red-300 transition-colors">
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </div>
                        <ToolForm toolData={tool} onChange={(updated) => handleNewJobToolChange(idx, null, null, updated)} isNewJobForm idx={idx} newJobForm={newJobForm} setNewJobForm={setNewJobForm} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setNewJobStep(1)} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                    Back
                  </button>
                  <button type="submit" disabled={savingJob} className="flex-1 px-4 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold transition-all disabled:opacity-50">
                    {savingJob ? 'Creating...' : 'Create Repair Job'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors" onClick={() => setSelectedPhoto(null)}>
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

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-red-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-900/30 p-3 rounded-full">
                <span className="material-symbols-outlined text-4xl text-red-400">warning</span>
              </div>
            </div>
            <h3 className="text-xl font-black text-white uppercase text-center mb-2">Delete Repair Job</h3>
            <p className="text-slate-300 text-center mb-2">
              Delete job <span className="font-bold text-white">{deleteConfirmId.request_number}</span>?
            </p>
            <p className="text-red-300 text-sm text-center font-bold mb-6">This will permanently delete all tool data and photos.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all">Cancel</button>
              <button onClick={handleDeleteJob} className="flex-1 px-4 py-3 bg-red-900 hover:bg-red-800 text-white rounded-lg font-bold transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TOOL FORM (reusable for new job form and add tool modal) ──
function ToolForm({ toolData, onChange, isNewJobForm, idx, newJobForm, setNewJobForm }) {
  const handleChange = (field, value) => {
    if (isNewJobForm) {
      const updatedTools = newJobForm.tools.map((t, i) => i === idx ? { ...t, [field]: value } : t);
      setNewJobForm({ ...newJobForm, tools: updatedTools });
    } else {
      onChange({ ...toolData, [field]: value });
    }
  };

  const data = toolData;

  const inputCls = "w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary";
  const sectionHdr = "text-xs text-slate-500 uppercase tracking-wide font-bold mb-3 pb-2 border-b border-slate-700";

  return (
    <div className="space-y-5 text-sm">
      {/* Section 1 — Tool Identification */}
      <div>
        <p className={sectionHdr}>Tool Identification</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tool Type <span className="text-red-400">*</span></label>
            <input required value={data.tool_type || ''} onChange={(e) => handleChange('tool_type', e.target.value)}
              placeholder="e.g., Impact Wrench" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Brand <span className="text-red-400">*</span></label>
            <input required value={data.brand || ''} onChange={(e) => handleChange('brand', e.target.value)}
              placeholder="e.g., Ingersoll Rand" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Model Number <span className="text-red-400">*</span></label>
            <input required value={data.model_number || ''} onChange={(e) => handleChange('model_number', e.target.value)}
              placeholder="e.g., 2135TIMAX" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Serial Number</label>
            <input value={data.serial_number || ''} onChange={(e) => handleChange('serial_number', e.target.value)}
              placeholder="Optional" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Section 2 — Job Details */}
      <div>
        <p className={sectionHdr}>Job Details</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Quantity</label>
            <input type="number" min="1" value={data.quantity || 1} onChange={(e) => handleChange('quantity', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Priority</label>
            <select value={data.priority || 'standard'} onChange={(e) => handleChange('priority', e.target.value)} className={inputCls}>
              <option value="standard">Standard</option>
              <option value="rush">Rush</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Remarks / Description</label>
            <textarea value={data.remarks || ''} onChange={(e) => handleChange('remarks', e.target.value)}
              rows={2} placeholder="Customer's description of the problem"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={data.warranty || false} onChange={(e) => handleChange('warranty', e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary" />
              <span className="text-sm text-slate-300">Warranty Repair</span>
            </label>
          </div>
        </div>
      </div>

      {/* Section 3 — Parts */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-700">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-bold">Parts</p>
          <button type="button" onClick={() => handleChange('parts', [...(data.parts || []), { name: '', quantity: 1, unit_cost: '', status: 'pending' }])}
            className="text-xs text-primary hover:text-blue-400 font-bold flex items-center gap-0.5 transition-colors">
            <span className="material-symbols-outlined text-sm">add</span> Add Part
          </button>
        </div>
        {(data.parts || []).length > 0 && (
          <div className="space-y-2">
            {data.parts.map((part, pi) => (
              <div key={pi} className="flex items-start gap-2 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input placeholder="Part name *" value={part.name} onChange={(e) => {
                    const updated = [...data.parts]; updated[pi] = { ...part, name: e.target.value }; handleChange('parts', updated);
                  }} className="col-span-2 md:col-span-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="number" min="1" placeholder="Qty" value={part.quantity} onChange={(e) => {
                    const updated = [...data.parts]; updated[pi] = { ...part, quantity: parseInt(e.target.value) || 1 }; handleChange('parts', updated);
                  }} className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="number" step="0.01" min="0" placeholder="Unit $" value={part.unit_cost ?? ''} onChange={(e) => {
                    const updated = [...data.parts]; updated[pi] = { ...part, unit_cost: e.target.value === '' ? null : parseFloat(e.target.value) }; handleChange('parts', updated);
                  }} className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  <select value={part.status} onChange={(e) => {
                    const updated = [...data.parts]; updated[pi] = { ...part, status: e.target.value }; handleChange('parts', updated);
                  }} className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="pending">Pending</option>
                    <option value="ordered">Ordered</option>
                    <option value="received">Received</option>
                    <option value="installed">Installed</option>
                  </select>
                </div>
                <button type="button" onClick={() => {
                  const updated = data.parts.filter((_, i) => i !== pi); handleChange('parts', updated);
                }} className="text-red-400 hover:text-red-300 mt-1 transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 4 — Labour & Cost */}
      <div>
        <p className={sectionHdr}>Labour & Cost</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Labour Hours</label>
            <input type="number" step="0.5" min="0" value={data.labour_hours || ''} onChange={(e) => handleChange('labour_hours', e.target.value)}
              placeholder="e.g., 2.5" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hourly Rate ($)</label>
            <input type="number" step="0.01" min="0" value={data.hourly_rate || ''} onChange={(e) => handleChange('hourly_rate', e.target.value)}
              placeholder="e.g., 95.00" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Zoho Quote Reference</label>
            <input value={data.zoho_quote_ref || ''} onChange={(e) => handleChange('zoho_quote_ref', e.target.value)}
              placeholder="Optional" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Assigned Technician</label>
            <input value={data.assigned_technician || ''} onChange={(e) => handleChange('assigned_technician', e.target.value)}
              placeholder="Optional" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Section 5 — Scheduling */}
      <div>
        <p className={sectionHdr}>Scheduling</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Date Received</label>
            <input type="date" value={data.date_received ? data.date_received.split('T')[0] : ''} onChange={(e) => handleChange('date_received', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Est. Completion Date</label>
            <input type="date" value={data.estimated_completion || ''} onChange={(e) => handleChange('estimated_completion', e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>
    </div>
  );
}
