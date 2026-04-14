import { useState, useEffect, useRef } from 'react';
import { customersAPI, repairsAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import {
  REPAIR_STATUSES, REPAIR_STATUSES_LIST,
  getValidNextStatuses,
} from '../../../constants/repairStatuses';
import { StatusBadge, StepBadge, ProgressStepper } from '../shared/RepairStatusBadges';
import PaginationBar from '../shared/PaginationBar';
import { formatDatePacific, formatDateShortPacific, getTodayPacific } from '../../../utils/dateFormat';
import { openPrintWorkOrder } from '../PrintWorkOrder';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

const getToolStatusSummary = (tools) => {
  if (!tools?.length) return [];
  const counts = {};
  tools.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
  return Object.entries(counts).map(([status, count]) => ({ status, count }));
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

const EMPTY_TOOL_BASE = {
  tool_type: '', brand: '', model_number: '', serial_number: '',
  quantity: 1, remarks: '', parts: [{ name: '', quantity: 1, status: 'pending' }],
  labour_hours: '', hourly_rate: '', priority: 'standard', warranty: false,
  zoho_ref: '', assigned_technician: '', estimated_completion: ''
};

const getEmptyTool = () => ({
  ...EMPTY_TOOL_BASE,
  date_received: getTodayPacific(),
});

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  if (digits.length > 3) return digits.slice(0, 3) + '-' + digits.slice(3);
  return digits;
}

export default function CustomersTab({ onNewJob, onCountUpdate }) {
  const showToast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Profile view
  const [selectedCustomer, setSelectedCustomer] = useState(null);
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

  // WO detail dialog
  const [woDialogJob, setWoDialogJob] = useState(null);
  const [deleteJobConfirm, setDeleteJobConfirm] = useState(null);
  const [statusUpdateModal, setStatusUpdateModal] = useState(null);
  const [statusUpdateForm, setStatusUpdateForm] = useState({ status: '', notes: '', estimated_completion: '' });
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState(null);
  const removeConfirmTimer = useRef(null);
  const [addToolForm, setAddToolForm] = useState(null);
  const [addingTool, setAddingTool] = useState(false);
  const [editingToolId, setEditingToolId] = useState(null);
  const [toolEditForm, setToolEditForm] = useState(null);
  const [savingToolEdit, setSavingToolEdit] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = searchQuery ? { search: searchQuery } : {};
        const data = await customersAPI.list({ ...params, limit: 200 });
        if (cancelled) return;
        setCustomers(data);
        if (onCountUpdate) onCountUpdate(data.length);
      } catch {
        if (!cancelled) showToast('error', 'Failed to load customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Clean up remove-confirm timer on unmount
  useEffect(() => {
    return () => {
      if (removeConfirmTimer.current) clearTimeout(removeConfirmTimer.current);
    };
  }, []);

  // Escape key: close topmost open modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedPhoto) { setSelectedPhoto(null); return; }
      if (editingToolId && !savingToolEdit) { handleCancelToolEdit(); return; }
      if (addToolForm) { setAddToolForm(null); return; }
      if (deleteJobConfirm) { setDeleteJobConfirm(null); return; }
      if (statusUpdateModal && !updatingStatus) { setStatusUpdateModal(null); return; }
      if (removeConfirmId) { setRemoveConfirmId(null); return; }
      if (woDialogJob) { setWoDialogJob(null); return; }
      if (selectedCustomer) { setSelectedCustomer(null); return; }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, editingToolId, savingToolEdit, addToolForm, deleteJobConfirm, statusUpdateModal, updatingStatus, removeConfirmId, woDialogJob, selectedCustomer]);

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
    setCustomers(prev => [created, ...prev]);
    setShowNewForm(false);
    setNewForm(EMPTY_CUSTOMER);
    showToast('success', `Customer ${created.first_name} ${created.last_name} created successfully`);
    setCreating(false);
    openCustomer(created);
  };

  const handleDeleteCustomer = async () => {
    if (!deleteConfirm) return;
    try {
      await customersAPI.delete(deleteConfirm.id);
      setCustomers(customers.filter(c => c.id !== deleteConfirm.id));
      if (selectedCustomer?.id === deleteConfirm.id) setSelectedCustomer(null);
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

  const refreshWoDialog = async () => {
    if (!woDialogJob) return;
    try {
      const fresh = await repairsAPI.get(woDialogJob.id);
      setWoDialogJob(fresh);
      setCustomerJobs(prev => prev.map(j => j.id === fresh.id ? fresh : j));
    } catch {
      showToast('error', 'Failed to refresh job');
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
    } catch {
      showToast('error', 'Failed to delete repair job');
      setDeleteJobConfirm(null);
    }
  };

  const openStatusUpdate = (tool) => {
    setStatusUpdateModal(tool);
    const validNext = getValidNextStatuses(tool.status);
    setStatusUpdateForm({ status: validNext[0] || '', notes: '', estimated_completion: '' });
  };

  const handleStatusUpdate = async () => {
    if (!statusUpdateModal || !woDialogJob) return;
    setUpdatingStatus(true);
    let updated;
    try {
      const payload = {
        status: statusUpdateForm.status,
        notes: statusUpdateForm.notes || null,
        estimated_completion: statusUpdateForm.estimated_completion || null,
      };
      updated = await repairsAPI.updateToolStatus(woDialogJob.id, statusUpdateModal.tool_id, payload);
    } catch (err) {
      console.error('handleStatusUpdate failed:', err);
      showToast('error', getErrorMessage(err, 'Failed to update tool status'));
      setUpdatingStatus(false);
      return;
    }
    setWoDialogJob(updated);
    setCustomerJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    setStatusUpdateModal(null);
    showToast('success', 'Tool status updated');
    setUpdatingStatus(false);
  };

  const handleAddToolToJob = async () => {
    if (!addToolForm || !woDialogJob) return;
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
      updated = await repairsAPI.addTool(woDialogJob.id, payload);
    } catch (err) {
      console.error('handleAddToolToJob failed:', err);
      showToast('error', getErrorMessage(err, 'Failed to add tool'));
      setAddingTool(false);
      return;
    }
    setWoDialogJob(updated);
    setCustomerJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    setAddToolForm(null);
    showToast('success', 'Tool added to repair job');
    setAddingTool(false);
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
    if (!editingToolId || !toolEditForm || !woDialogJob) return;
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
      updated = await repairsAPI.updateTool(woDialogJob.id, editingToolId, payload);
    } catch (err) {
      console.error('handleSaveToolEdit failed:', err);
      showToast('error', getErrorMessage(err, 'Failed to update tool'));
      setSavingToolEdit(false);
      return;
    }
    setWoDialogJob(updated);
    setCustomerJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    setEditingToolId(null);
    setToolEditForm(null);
    showToast('success', 'Tool details updated');
    setSavingToolEdit(false);
  };

  const handleRemoveTool = async (toolId) => {
    if (!woDialogJob) return;
    if (removeConfirmId !== toolId) {
      setRemoveConfirmId(toolId);
      clearTimeout(removeConfirmTimer.current);
      removeConfirmTimer.current = setTimeout(() => setRemoveConfirmId(null), 3000);
      return;
    }
    setRemoveConfirmId(null);
    clearTimeout(removeConfirmTimer.current);
    try {
      const updated = await repairsAPI.removeTool(woDialogJob.id, toolId);
      setWoDialogJob(updated);
      setCustomerJobs(customerJobs.map(j => j.id === updated.id ? updated : j));
      showToast('success', 'Tool removed');
    } catch {
      showToast('error', 'Failed to remove tool');
    }
  };

  const handlePhotoUpload = async (toolId, file) => {
    if (!woDialogJob) return;
    setUploadingPhoto(toolId);
    try {
      const updated = await repairsAPI.uploadToolPhoto(woDialogJob.id, toolId, file);
      setWoDialogJob(updated);
      setCustomerJobs(customerJobs.map(j => j.id === updated.id ? updated : j));
      showToast('success', 'Photo uploaded');
    } catch {
      showToast('error', 'Failed to upload photo');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleDeletePhoto = async (toolId, photoUrl) => {
    if (!woDialogJob) return;
    try {
      const updated = await repairsAPI.deleteToolPhoto(woDialogJob.id, toolId, photoUrl);
      setWoDialogJob(updated);
      setCustomerJobs(customerJobs.map(j => j.id === updated.id ? updated : j));
      showToast('success', 'Photo deleted');
    } catch {
      showToast('error', 'Failed to delete photo');
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
            onClick={() => { setSelectedCustomer(null); setEditing(false); }}
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
                      <span className="text-sm text-slate-900 dark:text-white font-bold">{selectedCustomer.company_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>person</span>
                    <span className="text-xs text-slate-500">Contact:</span>
                    <span className="text-sm text-slate-900 dark:text-white">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
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
                      <span className="text-sm text-slate-900 dark:text-white">{selectedCustomer.address}</span>
                    </div>
                  )}
                </div>
                {selectedCustomer.customer_notes && (
                  <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-slate-200/40 dark:border-slate-700/40">
                    <span className="material-symbols-outlined text-slate-500 mt-0.5" style={{ fontSize: '13px' }}>sticky_note_2</span>
                    <span className="text-xs text-slate-500">Notes:</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">{selectedCustomer.customer_notes}</span>
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
                              <button
                                onClick={() => openWoDialog(job)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/90 hover:bg-primary text-white rounded-lg text-sm font-bold transition-all shadow-sm"
                              >
                                <span className="material-symbols-outlined text-base">open_in_new</span>
                                Open
                              </button>
                              <button
                                onClick={() => setDeleteJobConfirm(job)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/60 border border-red-200 hover:border-red-300 dark:border-red-800/40 dark:hover:border-red-700 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-lg transition-all"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
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
                    <input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Last Name *</label>
                    <input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Company</label>
                  <input value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Email *</label>
                    <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Phone *</label>
                    <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: formatPhone(e.target.value) })} placeholder="###-###-####" className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Address</label>
                  <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Notes (Internal)</label>
                  <textarea
                    value={editForm.customer_notes}
                    onChange={(e) => setEditForm({ ...editForm, customer_notes: e.target.value })}
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

        {/* ── WO DETAIL DIALOG ─────────────────────────────── */}
        {woDialogJob && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] flex flex-col border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/50 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30 flex-shrink-0" />
              {/* Header */}
              <div className="flex-shrink-0 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/60 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-xl">build_circle</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">Work Order <span className="text-primary font-mono">{woDialogJob.request_number}</span></h3>
                      <button
                        onClick={() => openPrintWorkOrder(woDialogJob)}
                        className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                        title="Print / Save as PDF"
                      >
                        <span className="material-symbols-outlined" style={{fontSize:'18px'}}>print</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">Created {formatDate(woDialogJob.created_at)}</span>
                      {woDialogJob.source === 'online_request' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-700/50">
                          <span className="material-symbols-outlined" style={{fontSize:'11px'}}>public</span>
                          Online Request
                        </span>
                      )}
                      {woDialogJob.source === 'drop_off' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600/50">
                          <span className="material-symbols-outlined" style={{fontSize:'11px'}}>store</span>
                          Drop-off
                        </span>
                      )}
                      {woDialogJob.source === 'phone_in' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700/50">
                          <span className="material-symbols-outlined" style={{fontSize:'11px'}}>call</span>
                          Phone-in
                        </span>
                      )}
                      {woDialogJob.source === 'email' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700/50">
                          <span className="material-symbols-outlined" style={{fontSize:'11px'}}>mail</span>
                          Email
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setWoDialogJob(null)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Tools */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-base">build</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Tools</span>
                      <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">{woDialogJob.tools.length}</span>
                    </div>
                    <button
                      onClick={() => setAddToolForm(getEmptyTool())}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-lg text-xs font-bold transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Tool
                    </button>
                  </div>
                  <div className="space-y-3">
                    {woDialogJob.tools.map((tool, idx) => (
                      <div key={tool.tool_id} className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                        {/* Tool Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-black text-slate-500 dark:text-slate-400">
                                {idx + 1}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white text-base">{tool.brand} {tool.model_number}</div>
                                <div className="text-sm text-slate-500 mt-0.5">
                                  {tool.tool_type}{tool.quantity > 1 && ` × ${tool.quantity}`}
                                  {tool.serial_number && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>S/N: {tool.serial_number}</>}
                                  {tool.estimated_completion && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>Est: {formatDate(tool.estimated_completion)}</>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <StepBadge status={tool.status} />
                              <PriorityBadge priority={tool.priority} />
                              {tool.warranty && (
                                <span className="hidden sm:inline px-2.5 py-1 rounded-full text-sm font-bold bg-teal-100 text-teal-700 border border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/50">Warranty</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                            {tool.warranty && (
                              <span className="sm:hidden px-2.5 py-1 rounded-full text-sm font-bold bg-teal-100 text-teal-700 border border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/50">Warranty</span>
                            )}
                            <button onClick={() => openStatusUpdate(tool)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary hover:text-blue-700 dark:hover:text-blue-300 rounded-lg text-sm font-bold transition-all">
                              <span className="material-symbols-outlined text-base">update</span>
                              Update Status
                            </button>
                            {editingToolId !== tool.tool_id && (
                              <button onClick={() => handleStartToolEdit(tool)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm font-bold transition-all">
                                <span className="material-symbols-outlined text-base">edit</span>
                                Edit
                              </button>
                            )}
                            {woDialogJob.tools.length > 1 && (
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

                        {/* Status Bar + Stepper */}
                        <div className="px-4 pt-3 pb-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700/60">
                          <div className="flex items-center gap-3 flex-wrap mb-1">
                            <StatusBadge status={tool.status} />
                            <div className="text-sm text-slate-500">
                              Received: {formatDate(tool.date_received)}
                              {tool.date_completed && ` · Completed: ${formatDate(tool.date_completed)}`}
                            </div>
                          </div>
                          <div className="md:hidden"><ProgressStepper status={tool.status} compact /></div>
                          <div className="hidden md:block"><ProgressStepper status={tool.status} /></div>
                        </div>

                            {/* Tool Details — 3-column grid */}
                            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                {/* Left — Remarks */}
                                <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200/40 dark:border-slate-700/40">
                                  <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'12px'}}>Remarks</span>
                                  <p className={`mt-1 leading-relaxed ${tool.remarks ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>{tool.remarks || 'No remarks'}</p>
                                </div>
                                {/* Middle — Parts */}
                                <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200/40 dark:border-slate-700/40">
                                  <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'12px'}}>Parts {tool.parts?.filter(p => p.name?.trim()).length > 0 && `(${tool.parts.filter(p => p.name?.trim()).length})`}</span>
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
                                          }`} style={{fontSize:'12px'}}>{p.status}</span>
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
                                <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-200/60 dark:bg-slate-700/60" />
                                <div className="space-y-3">
                                  {[...tool.status_history].reverse().map((entry, hidx) => (
                                    <div key={hidx} className="relative flex items-start gap-3 text-sm">
                                      <div className={`absolute -left-3.5 mt-1.5 w-2 h-2 rounded-full flex-shrink-0 border-2 border-slate-200 dark:border-slate-800 ${REPAIR_STATUSES[entry.status]?.dot || 'bg-slate-500'}`} />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <StatusBadge status={entry.status} />
                                          <span className="text-slate-500">{formatDatePacific(entry.timestamp)}</span>
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

        {/* Status Update Modal */}
        {statusUpdateModal && (
          <div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
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
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Current:</span>
                    <StatusBadge status={statusUpdateModal.status} />
                  </div>
                  {getValidNextStatuses(statusUpdateModal.status).length === 0 ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                      <span className="material-symbols-outlined text-slate-500 text-base">info</span>
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">Terminal status — cannot be changed.</p>
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
                          .map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Est. Completion Date (optional)</label>
                  <input
                    type="date"
                    value={statusUpdateForm.estimated_completion}
                    onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, estimated_completion: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
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

        {/* Add / Edit Tool Modal */}
        {(addToolForm || (editingToolId && toolEditForm)) && (() => {
          const isEdit = !!editingToolId;
          const formData = isEdit ? toolEditForm : addToolForm;
          const setFormData = isEdit ? setToolEditForm : setAddToolForm;
          const busy = isEdit ? savingToolEdit : addingTool;
          const handleClose = () => { if (busy) return; isEdit ? handleCancelToolEdit() : setAddToolForm(null); };
          const handleSubmit = isEdit ? handleSaveToolEdit : handleAddToolToJob;
          return (
          <div className="fixed inset-0 z-[60] bg-black/40 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full my-8 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-[fadeInScale_0.2s_ease-out] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="h-0.5 bg-gradient-to-r from-primary via-blue-400 to-primary/30" />
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
              <div className="p-4 sm:p-6">
                <InlineToolForm toolData={formData} onChange={setFormData} />
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
                <p className="text-red-600/80 dark:text-red-300/80 text-sm text-center mb-6">This will permanently delete all tool data and photos.</p>
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

        {/* Photo Lightbox */}
        {selectedPhoto && (
          <div className="fixed inset-0 z-[70] bg-black/90 dark:bg-black/95 flex items-center justify-center p-4 cursor-pointer" onClick={() => setSelectedPhoto(null)}>
            <button className="absolute top-4 right-4 text-slate-900 dark:text-white hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <span className="material-symbols-outlined text-4xl">close</span>
            </button>
            <img
              src={selectedPhoto.startsWith('http') ? selectedPhoto : `${API_BASE_URL}/uploads/${selectedPhoto}`}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
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
                    <th className="py-3 px-4 font-bold">Company / Contact</th>
                    <th className="py-3 px-4 font-bold hidden md:table-cell">Email</th>
                    <th className="py-3 px-4 font-bold hidden md:table-cell">Phone</th>
                    <th className="py-3 px-4 font-bold hidden lg:table-cell">Address</th>
                    <th className="py-3 px-4 font-bold hidden lg:table-cell">Since</th>
                    <th className="py-3 px-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
                  {paginated.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      onClick={() => openCustomer(customer)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="text-slate-900 dark:text-white font-bold">{customer.company_name || `${customer.first_name} ${customer.last_name}`}</div>
                        {customer.company_name && <div className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{customer.first_name} {customer.last_name}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 hidden md:table-cell">{customer.email}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 hidden md:table-cell">{customer.phone}</td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-sm hidden lg:table-cell">{customer.address || <span className="text-slate-400 dark:text-slate-600">—</span>}</td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-sm hidden lg:table-cell">{formatDate(customer.created_at)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openCustomer(customer); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200/60 dark:bg-slate-700/60 group-hover:bg-primary/20 group-hover:border-primary/30 hover:text-primary border border-slate-300 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-base">open_in_new</span>
                          Open
                        </button>
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
                    onChange={(e) => setNewForm({ ...newForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newForm.last_name}
                    onChange={(e) => setNewForm({ ...newForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  value={newForm.company_name}
                  onChange={(e) => setNewForm({ ...newForm, company_name: e.target.value })}
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
                    onChange={(e) => setNewForm({ ...newForm, phone: formatPhone(e.target.value) })}
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
                  onChange={(e) => setNewForm({ ...newForm, address: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Internal Notes</label>
                <textarea
                  value={newForm.customer_notes}
                  onChange={(e) => setNewForm({ ...newForm, customer_notes: e.target.value })}
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

function InlineToolForm({ toolData, onChange }) {
  const h = (field, value) => onChange({ ...toolData, [field]: value });
  const d = toolData;
  const ic = "w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-primary";
  const sh = "text-sm text-slate-500 uppercase tracking-wide font-bold mb-4 pb-2 border-b border-slate-300 dark:border-slate-700";
  return (
    <div className="space-y-6 text-base">
      {/* Section 1 — Tool Identification */}
      <div>
        <p className={sh}>Tool Identification</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Tool Type <span className="text-red-400">*</span></label>
            <input required value={d.tool_type || ''} onChange={(e) => h('tool_type', e.target.value)} placeholder="e.g., Impact Wrench" className={ic} />
          </div>
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Brand <span className="text-red-400">*</span></label>
            <input required value={d.brand || ''} onChange={(e) => h('brand', e.target.value)} placeholder="e.g., Ingersoll Rand" className={ic} />
          </div>
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Model Number <span className="text-red-400">*</span></label>
            <input required value={d.model_number || ''} onChange={(e) => h('model_number', e.target.value)} placeholder="e.g., 2135TIMAX" className={ic} />
          </div>
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Serial Number</label>
            <input value={d.serial_number || ''} onChange={(e) => h('serial_number', e.target.value)} placeholder="Optional" className={ic} />
          </div>
        </div>
      </div>

      {/* Section 2 — Job Details */}
      <div>
        <p className={sh}>Job Details</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Quantity</label>
            <input type="number" min="1" value={d.quantity || 1} onChange={(e) => h('quantity', e.target.value)} className={ic} />
          </div>
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Priority</label>
            <select value={d.priority || 'standard'} onChange={(e) => h('priority', e.target.value)} className={ic}>
              <option value="standard">Standard</option>
              <option value="rush">Rush</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Remarks / Description</label>
            <textarea value={d.remarks || ''} onChange={(e) => h('remarks', e.target.value)}
              rows={3} placeholder="Customer's description of the problem"
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={d.warranty || false} onChange={(e) => h('warranty', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary" />
              <span className="text-base text-slate-600 dark:text-slate-300">Warranty Repair</span>
            </label>
          </div>
        </div>
      </div>

      {/* Section 3 — Parts */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-4 border-b border-slate-300 dark:border-slate-700">
          <p className="text-sm text-slate-500 uppercase tracking-wide font-bold">Parts</p>
          <button type="button" onClick={() => h('parts', [...(d.parts || []), { name: '', quantity: 1, status: 'pending' }])}
            className="text-sm text-primary hover:text-blue-400 font-bold flex items-center gap-0.5 transition-colors">
            <span className="material-symbols-outlined text-sm">add</span> Add Part
          </button>
        </div>
        {(d.parts || []).length > 0 && (
          <div className="space-y-2">
            {d.parts.map((part, pi) => (
              <div key={pi} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-300 dark:border-slate-700">
                <div className="flex-1 flex flex-wrap gap-2 sm:gap-3">
                  <input placeholder="Part name *" value={part.name} onChange={(e) => {
                    const updated = [...d.parts]; updated[pi] = { ...part, name: e.target.value }; h('parts', updated);
                  }} className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="number" min="1" placeholder="Qty" value={part.quantity ?? ''} onChange={(e) => {
                    const updated = [...d.parts]; updated[pi] = { ...part, quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 1 }; h('parts', updated);
                  }} className="w-16 px-2 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  <select value={part.status} onChange={(e) => {
                    const updated = [...d.parts]; updated[pi] = { ...part, status: e.target.value }; h('parts', updated);
                  }} className="w-28 sm:w-auto px-2 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="pending">Pending</option>
                    <option value="ordered">Ordered</option>
                    <option value="received">Received</option>
                    <option value="installed">Installed</option>
                  </select>
                </div>
                <button type="button" onClick={() => { h('parts', d.parts.filter((_, i) => i !== pi)); }}
                  className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 4 — Labour & Cost */}
      <div>
        <p className={sh}>Labour & Cost</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Labour Hours</label>
            <input type="number" step="0.5" min="0" value={d.labour_hours || ''} onChange={(e) => h('labour_hours', e.target.value)} placeholder="e.g., 2.5" className={ic} />
          </div>
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Hourly Rate ($)</label>
            <input type="number" step="0.01" min="0" value={d.hourly_rate || ''} onChange={(e) => h('hourly_rate', e.target.value)} placeholder="e.g., 95.00" className={ic} />
          </div>
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Zoho Reference</label>
            <input value={d.zoho_ref || ''} onChange={(e) => h('zoho_ref', e.target.value)} placeholder="Optional" className={ic} />
          </div>
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Assigned Technician</label>
            <input value={d.assigned_technician || ''} onChange={(e) => h('assigned_technician', e.target.value)} placeholder="Optional" className={ic} />
          </div>
        </div>
      </div>

      {/* Section 5 — Scheduling */}
      <div>
        <p className={sh}>Scheduling</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Date Received</label>
            <input type="date" value={d.date_received ? d.date_received.split('T')[0] : ''} onChange={(e) => h('date_received', e.target.value)} className={ic} />
          </div>
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Est. Completion Date</label>
            <input type="date" value={d.estimated_completion || ''} onChange={(e) => h('estimated_completion', e.target.value)} className={ic} />
          </div>
        </div>
      </div>
    </div>
  );
}
