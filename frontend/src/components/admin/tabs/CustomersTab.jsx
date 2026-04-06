import { useState, useEffect, useCallback, useRef } from 'react';
import { customersAPI, repairsAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const REPAIR_STATUSES = {
  received: { label: 'Received', color: 'bg-slate-700 text-slate-300 border-slate-600' },
  dismantled: { label: 'Dismantled', color: 'bg-yellow-900/30 text-yellow-400 border-yellow-700' },
  quotation_sent: { label: 'Quote Sent', color: 'bg-purple-900/30 text-purple-400 border-purple-700' },
  approved: { label: 'Approved', color: 'bg-green-900/30 text-green-400 border-green-700' },
  declined: { label: 'Declined', color: 'bg-red-900/30 text-red-400 border-red-700' },
  parts_ordered: { label: 'Parts Ordered', color: 'bg-orange-900/30 text-orange-400 border-orange-700' },
  parts_received: { label: 'Parts Received', color: 'bg-cyan-900/30 text-cyan-400 border-cyan-700' },
  in_repair: { label: 'In Repair', color: 'bg-blue-900/30 text-blue-400 border-blue-700' },
  testing: { label: 'Testing / QC', color: 'bg-indigo-900/30 text-indigo-400 border-indigo-700' },
  ready_for_pickup: { label: 'Ready for Pickup', color: 'bg-emerald-900/30 text-emerald-400 border-emerald-700' },
  completed: { label: 'Completed', color: 'bg-green-900/50 text-green-300 border-green-600' },
  returned: { label: 'Returned', color: 'bg-slate-800/50 text-slate-300 border-slate-500' },
  closed: { label: 'Closed', color: 'bg-slate-800/50 text-slate-400 border-slate-600' },
  abandoned: { label: 'Abandoned', color: 'bg-rose-900/30 text-rose-400 border-rose-700' },
};

const EMPTY_CUSTOMER = {
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  customer_notes: '',
};

function StatusBadge({ status }) {
  const cfg = REPAIR_STATUSES[status] || { label: status, color: 'bg-slate-700 text-slate-300 border-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

const REPAIR_STATUSES_LIST = [
  { value: 'received', label: 'Received' }, { value: 'dismantled', label: 'Dismantled' },
  { value: 'quotation_sent', label: 'Quote Sent' }, { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' }, { value: 'parts_ordered', label: 'Parts Ordered' },
  { value: 'parts_received', label: 'Parts Received' }, { value: 'in_repair', label: 'In Repair' },
  { value: 'testing', label: 'Testing / QC' }, { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'completed', label: 'Completed' }, { value: 'returned', label: 'Returned' },
  { value: 'closed', label: 'Closed' }, { value: 'abandoned', label: 'Abandoned' },
];

const PRIORITIES = {
  standard: { label: 'Standard', color: 'bg-slate-700 text-slate-300' },
  rush: { label: 'Rush', color: 'bg-orange-900/40 text-orange-300' },
  urgent: { label: 'Urgent', color: 'bg-red-900/40 text-red-300' },
};

function PriorityBadge({ priority }) {
  const cfg = PRIORITIES[priority] || PRIORITIES.standard;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

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

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  if (digits.length > 3) return digits.slice(0, 3) + '-' + digits.slice(3);
  return digits;
}

export default function CustomersTab({ onNewJob }) {
  const showToast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Profile view
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerJobs, setCustomerJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

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

  // Inline job management
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [expandedJobData, setExpandedJobData] = useState(null);
  const [statusUpdateModal, setStatusUpdateModal] = useState(null);
  const [statusUpdateForm, setStatusUpdateForm] = useState({ status: '', notes: '', estimated_completion: '' });
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState(null);
  const removeConfirmTimer = useRef(null);
  const [addToolForm, setAddToolForm] = useState(null);
  const [editingToolId, setEditingToolId] = useState(null);
  const [toolEditForm, setToolEditForm] = useState(null);
  const [savingToolEdit, setSavingToolEdit] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = searchQuery ? { search: searchQuery } : {};
      const data = await customersAPI.list({ ...params, limit: 200 });
      setCustomers(data);
    } catch {
      showToast('error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, showToast]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
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
      if (statusUpdateModal && !updatingStatus) { setStatusUpdateModal(null); return; }
      if (removeConfirmId) { setRemoveConfirmId(null); return; }
      if (selectedCustomer) { setSelectedCustomer(null); return; }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, statusUpdateModal, updatingStatus, removeConfirmId, selectedCustomer]);

  const openCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setEditing(false);
    setEditForm({});
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
      contact_person: selectedCustomer.contact_person,
      email: selectedCustomer.email,
      phone: selectedCustomer.phone,
      address: selectedCustomer.address || '',
      customer_notes: selectedCustomer.customer_notes || '',
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updated = await customersAPI.update(selectedCustomer.id, editForm);
      setSelectedCustomer(updated);
      setCustomers(customers.map(c => c.id === updated.id ? updated : c));
      setEditing(false);
      showToast('success', 'Customer updated successfully');
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await customersAPI.create(newForm);
      setCustomers([created, ...customers]);
      setShowNewForm(false);
      setNewForm(EMPTY_CUSTOMER);
      showToast('success', `Customer ${created.contact_person} created successfully`);
      openCustomer(created);
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Failed to create customer');
    } finally {
      setCreating(false);
    }
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
      showToast('error', err.response?.data?.detail || 'Failed to delete customer');
      setDeleteConfirm(null);
    }
  };

  // ── Inline Job Management Handlers ──
  const toggleExpandJob = async (job) => {
    if (expandedJobId === job.id) {
      setExpandedJobId(null);
      setExpandedJobData(null);
      return;
    }
    setExpandedJobId(job.id);
    try {
      const fresh = await repairsAPI.get(job.id);
      setExpandedJobData(fresh);
    } catch {
      setExpandedJobData(job);
    }
  };

  const refreshExpandedJob = async () => {
    if (!expandedJobId) return;
    try {
      const fresh = await repairsAPI.get(expandedJobId);
      setExpandedJobData(fresh);
      setCustomerJobs(customerJobs.map(j => j.id === fresh.id ? fresh : j));
    } catch {
      showToast('error', 'Failed to refresh job');
    }
  };

  const openStatusUpdate = (tool) => {
    setStatusUpdateModal(tool);
    setStatusUpdateForm({ status: tool.status, notes: '', estimated_completion: '' });
  };

  const handleStatusUpdate = async () => {
    if (!statusUpdateModal || !expandedJobData) return;
    setUpdatingStatus(true);
    try {
      const payload = {
        status: statusUpdateForm.status,
        notes: statusUpdateForm.notes || null,
        estimated_completion: statusUpdateForm.estimated_completion || null,
      };
      const updated = await repairsAPI.updateToolStatus(expandedJobData.id, statusUpdateModal.tool_id, payload);
      setExpandedJobData(updated);
      setCustomerJobs(customerJobs.map(j => j.id === updated.id ? updated : j));
      setStatusUpdateModal(null);
      showToast('success', 'Tool status updated');
    } catch {
      showToast('error', 'Failed to update tool status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddToolToJob = async () => {
    if (!addToolForm || !expandedJobData) return;
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
      const updated = await repairsAPI.addTool(expandedJobData.id, payload);
      setExpandedJobData(updated);
      setCustomerJobs(customerJobs.map(j => j.id === updated.id ? updated : j));
      setAddToolForm(null);
      showToast('success', 'Tool added to repair job');
    } catch {
      showToast('error', 'Failed to add tool');
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
    if (!editingToolId || !toolEditForm || !expandedJobData) return;
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
      const updated = await repairsAPI.updateTool(expandedJobData.id, editingToolId, payload);
      setExpandedJobData(updated);
      setCustomerJobs(customerJobs.map(j => j.id === updated.id ? updated : j));
      setEditingToolId(null);
      setToolEditForm(null);
      showToast('success', 'Tool details updated');
    } catch {
      showToast('error', 'Failed to update tool');
    } finally {
      setSavingToolEdit(false);
    }
  };

  const handleRemoveTool = async (toolId) => {
    if (!expandedJobData) return;
    if (removeConfirmId !== toolId) {
      setRemoveConfirmId(toolId);
      clearTimeout(removeConfirmTimer.current);
      removeConfirmTimer.current = setTimeout(() => setRemoveConfirmId(null), 3000);
      return;
    }
    setRemoveConfirmId(null);
    clearTimeout(removeConfirmTimer.current);
    try {
      const updated = await repairsAPI.removeTool(expandedJobData.id, toolId);
      setExpandedJobData(updated);
      setCustomerJobs(customerJobs.map(j => j.id === updated.id ? updated : j));
      showToast('success', 'Tool removed');
    } catch {
      showToast('error', 'Failed to remove tool');
    }
  };

  const handlePhotoUpload = async (toolId, file) => {
    if (!expandedJobData) return;
    setUploadingPhoto(toolId);
    try {
      const updated = await repairsAPI.uploadToolPhoto(expandedJobData.id, toolId, file);
      setExpandedJobData(updated);
      setCustomerJobs(customerJobs.map(j => j.id === updated.id ? updated : j));
      showToast('success', 'Photo uploaded');
    } catch {
      showToast('error', 'Failed to upload photo');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  const totalPages = Math.ceil(customers.length / pageSize);
  const paginated = customers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Profile view ──
  if (selectedCustomer) {
    return (
      <div>
        {/* Back + Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedCustomer(null); setEditing(false); }}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              <span className="text-sm font-bold">All Customers</span>
            </button>
            <span className="text-slate-700">›</span>
            <h2 className="text-xl font-black text-white uppercase">
              {selectedCustomer.company_name || selectedCustomer.contact_person}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onNewJob && (
              <button
                onClick={() => onNewJob(selectedCustomer)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                New Repair Job
              </button>
            )}
            <button
              onClick={() => setDeleteConfirm(selectedCustomer)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-red-900/40 hover:bg-red-900 text-red-300 rounded-lg text-sm font-bold transition-all"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Info Card */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wide">Customer Info</h3>
                {!editing ? (
                  <button
                    onClick={handleStartEdit}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all">Cancel</button>
                    <button onClick={handleSaveEdit} disabled={saving} className="px-3 py-1.5 bg-primary hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {editing ? (
                <div className="space-y-3">
                  {[
                    { key: 'company_name', label: 'Company', required: false },
                    { key: 'contact_person', label: 'Contact Person', required: true },
                    { key: 'email', label: 'Email', required: true, type: 'email' },
                    { key: 'phone', label: 'Phone', required: true, placeholder: '###-###-####' },
                    { key: 'address', label: 'Address', required: false },
                  ].map(({ key, label, required, type, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-bold text-slate-400 mb-1">{label}{required && ' *'}</label>
                      <input
                        type={type || 'text'}
                        value={editForm[key]}
                        onChange={(e) => {
                          const val = key === 'phone' ? formatPhone(e.target.value) : e.target.value;
                          setEditForm({ ...editForm, [key]: val });
                        }}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Notes (Internal)</label>
                    <textarea
                      value={editForm.customer_notes}
                      onChange={(e) => setEditForm({ ...editForm, customer_notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {selectedCustomer.company_name && (
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Company</div>
                      <div className="text-white font-bold">{selectedCustomer.company_name}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Contact</div>
                    <div className="text-white">{selectedCustomer.contact_person}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Email</div>
                    <a href={`mailto:${selectedCustomer.email}`} className="text-primary hover:underline">{selectedCustomer.email}</a>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Phone</div>
                    <a href={`tel:${selectedCustomer.phone}`} className="text-primary hover:underline">{selectedCustomer.phone}</a>
                  </div>
                  {selectedCustomer.address && (
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Address</div>
                      <div className="text-white">{selectedCustomer.address}</div>
                    </div>
                  )}
                  {selectedCustomer.customer_notes && (
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Notes</div>
                      <div className="text-slate-300">{selectedCustomer.customer_notes}</div>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-700">
                    <div className="text-xs text-slate-500">Customer since {formatDate(selectedCustomer.created_at)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Repair Jobs */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wide mb-4">
                Repair Jobs ({loadingJobs ? '...' : customerJobs.length})
              </h3>

              {loadingJobs ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-3xl text-primary animate-spin">refresh</span>
                </div>
              ) : customerJobs.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-4xl text-slate-600">build_circle</span>
                  <p className="mt-2 text-slate-400 text-sm">No repair jobs yet</p>
                  {onNewJob && (
                    <button
                      onClick={() => onNewJob(selectedCustomer)}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Create First Job
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {customerJobs.map((job) => {
                    const statuses = [...new Set(job.tools.map(t => t.status))];
                    const isExpanded = expandedJobId === job.id;
                    const jobData = isExpanded && expandedJobData ? expandedJobData : job;
                    return (
                      <div key={job.id} className={`bg-slate-900 rounded-lg border ${isExpanded ? 'border-primary/50' : 'border-slate-700'} overflow-hidden transition-all`}>
                        {/* Job Header (always visible, clickable) */}
                        <div
                          className="p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                          onClick={() => toggleExpandJob(job)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={`material-symbols-outlined text-sm text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                              <div>
                                <div className="text-white font-bold text-sm font-mono">{job.request_number}</div>
                                <div className="text-slate-400 text-xs mt-0.5">{formatDate(job.created_at)} · {job.tools.length} tool{job.tools.length !== 1 ? 's' : ''} · {job.source === 'online_request' ? 'Online' : 'Walk-in'}</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 justify-end">
                              {statuses.slice(0, 3).map(s => <StatusBadge key={s} status={s} />)}
                              {statuses.length > 3 && <span className="text-xs text-slate-400">+{statuses.length - 3}</span>}
                            </div>
                          </div>
                          {!isExpanded && (
                            <div className="flex flex-wrap gap-1.5 mt-2 ml-6">
                              {job.tools.map(t => (
                                <span key={t.tool_id} className="text-xs bg-slate-800 border border-slate-600 px-2 py-0.5 rounded text-slate-300">
                                  {t.brand} {t.model_number}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Expanded Job Detail */}
                        {isExpanded && expandedJobData && (
                          <div className="border-t border-slate-700">
                            {/* Tools Header + Add Tool */}
                            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tools ({jobData.tools.length})</h4>
                              <button
                                onClick={(e) => { e.stopPropagation(); setAddToolForm(getEmptyTool()); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-blue-600 text-white rounded text-xs font-bold transition-all"
                              >
                                <span className="material-symbols-outlined text-xs">add</span>
                                Add Tool
                              </button>
                            </div>

                            {/* Tool Cards */}
                            <div className="px-4 pb-4 space-y-3">
                              {jobData.tools.map((tool, idx) => (
                                <div key={tool.tool_id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                                  {/* Tool Header */}
                                  <div className="p-3 border-b border-slate-700">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="font-bold text-white text-sm">
                                          Tool {idx + 1}: {tool.brand} {tool.model_number}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                          {tool.tool_type} · Qty: {tool.quantity}
                                          {tool.serial_number && ` · S/N: ${tool.serial_number}`}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <PriorityBadge priority={tool.priority} />
                                        {tool.warranty && (
                                          <span className="hidden sm:inline px-1.5 py-0.5 rounded text-xs font-bold bg-teal-900/30 text-teal-400 border border-teal-700">Warranty</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                      {tool.warranty && (
                                        <span className="sm:hidden px-1.5 py-0.5 rounded text-xs font-bold bg-teal-900/30 text-teal-400 border border-teal-700">Warranty</span>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openStatusUpdate(tool); }}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-bold transition-all"
                                      >
                                        <span className="material-symbols-outlined text-xs">update</span>
                                        Status
                                      </button>
                                      {editingToolId !== tool.tool_id && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleStartToolEdit(tool); }}
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-bold transition-all"
                                        >
                                          <span className="material-symbols-outlined text-xs">edit</span>
                                          Edit
                                        </button>
                                      )}
                                      {jobData.tools.length > 1 && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleRemoveTool(tool.tool_id); }}
                                          className={`transition-colors ${
                                            removeConfirmId === tool.tool_id
                                              ? 'px-2 py-0.5 rounded text-xs font-bold bg-red-900/40 text-red-300 border border-red-700'
                                              : 'p-1 text-red-400 hover:text-red-300'
                                          }`}
                                        >
                                          {removeConfirmId === tool.tool_id ? 'Confirm Remove?' : (
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Status Bar */}
                                  <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-700 flex items-center gap-2 flex-wrap text-xs">
                                    <StatusBadge status={tool.status} />
                                    <span className="text-slate-400">
                                      Received: {formatDate(tool.date_received)}
                                      {tool.date_completed && ` · Done: ${formatDate(tool.date_completed)}`}
                                    </span>
                                  </div>

                                  {editingToolId === tool.tool_id && toolEditForm ? (
                                    /* ── EDIT MODE ── */
                                    <div className="p-3 border-b border-slate-700" onClick={(e) => e.stopPropagation()}>
                                      <InlineToolForm toolData={toolEditForm} onChange={setToolEditForm} />
                                      <div className="flex gap-2 mt-3">
                                        <button onClick={handleCancelToolEdit} disabled={savingToolEdit} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold transition-all disabled:opacity-50">
                                          Cancel
                                        </button>
                                        <button onClick={handleSaveToolEdit} disabled={savingToolEdit} className="px-3 py-1.5 bg-primary hover:bg-blue-600 text-white rounded text-xs font-bold transition-all disabled:opacity-50">
                                          {savingToolEdit ? 'Saving...' : 'Save Changes'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* ── VIEW MODE ── */
                                    <>
                                  {/* Scheduling & Meta */}
                                  <div className="px-3 py-2 border-b border-slate-700">
                                    <div className="flex items-center gap-3 flex-wrap text-xs">
                                      <div>
                                        <span className="text-slate-500">Est. Completion:</span>
                                        <span className={`ml-1 ${tool.estimated_completion ? 'text-slate-300' : 'text-slate-600'}`}>
                                          {tool.estimated_completion ? formatDate(tool.estimated_completion) : 'Not set'}
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
                                  <div className="p-3 space-y-2 text-sm">
                                    {/* Remarks */}
                                    <div>
                                      <span className="text-slate-400 text-xs uppercase tracking-wide">Remarks</span>
                                      <p className={`mt-0.5 text-xs ${tool.remarks ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                                        {tool.remarks || 'No remarks'}
                                      </p>
                                    </div>

                                    {/* Parts */}
                                    <div>
                                      <span className="text-slate-400 text-xs uppercase tracking-wide">Parts</span>
                                      {tool.parts && tool.parts.filter(p => p.name?.trim()).length > 0 ? (
                                        <div className="mt-1 space-y-1">
                                          {tool.parts.filter(p => p.name?.trim()).map((p, pi) => (
                                            <div key={pi} className="flex items-center gap-2 text-xs">
                                              <span className="text-slate-300">{p.name}</span>
                                              <span className="text-slate-500">x{p.quantity}</span>
                                              {p.unit_cost != null && <span className="text-slate-400">${parseFloat(p.unit_cost).toFixed(2)}</span>}
                                              <span className={`px-1.5 py-0.5 rounded-full font-bold ${
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
                                        <p className="mt-0.5 text-xs text-slate-600 italic">No parts listed</p>
                                      )}
                                    </div>

                                    {/* Labour & Cost + Technician + Zoho */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                      <div>
                                        <span className="text-slate-400 uppercase tracking-wide">Labour</span>
                                        <p className={`mt-0.5 ${tool.labour_hours || tool.hourly_rate ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                                          {tool.labour_hours || tool.hourly_rate ? (
                                            <>
                                              {tool.labour_hours ? `${tool.labour_hours} hrs` : '\u2014 hrs'}
                                              {tool.hourly_rate ? ` @ $${tool.hourly_rate}/hr` : ''}
                                              {tool.labour_hours && tool.hourly_rate && (
                                                <span className="ml-1 text-slate-400">= <span className="text-white font-bold">${(parseFloat(tool.labour_hours) * parseFloat(tool.hourly_rate)).toFixed(2)}</span></span>
                                              )}
                                            </>
                                          ) : 'Not set'}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 uppercase tracking-wide">Technician</span>
                                        <p className={`mt-0.5 ${tool.assigned_technician ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                                          {tool.assigned_technician || 'Unassigned'}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 uppercase tracking-wide">Zoho Ref</span>
                                        <p className={`mt-0.5 ${tool.zoho_quote_ref ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                                          {tool.zoho_quote_ref || 'None'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                    </>
                                  )}

                                  {/* Photos */}
                                  <div className="px-3 pb-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Photos ({tool.photos?.length || 0})</span>
                                      <label className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-bold cursor-pointer transition-all">
                                        <span className="material-symbols-outlined text-xs">upload</span>
                                        {uploadingPhoto === tool.tool_id ? 'Uploading...' : 'Upload'}
                                        <input type="file" accept="image/*" className="hidden"
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => { e.stopPropagation(); e.target.files?.[0] && handlePhotoUpload(tool.tool_id, e.target.files[0]); }}
                                        />
                                      </label>
                                    </div>
                                    {tool.photos?.length > 0 && (
                                      <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
                                        {tool.photos.map((photo, pidx) => (
                                          <div key={pidx} className="aspect-square cursor-pointer group relative"
                                            onClick={(e) => { e.stopPropagation(); setSelectedPhoto(photo); }}>
                                            <img
                                              src={photo.startsWith('http') ? photo : `${API_BASE_URL}/uploads/${photo}`}
                                              alt={`Photo ${pidx + 1}`}
                                              className="w-full h-full object-cover rounded border border-slate-700 group-hover:border-primary transition-all"
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                                              <span className="material-symbols-outlined text-white text-lg">zoom_in</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Status History */}
                                  {tool.status_history?.length > 0 && (
                                    <details className="border-t border-slate-700">
                                      <summary className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-300 select-none"
                                        onClick={(e) => e.stopPropagation()}>
                                        Status History ({tool.status_history.length})
                                      </summary>
                                      <div className="px-3 pb-3 space-y-1.5 mt-1">
                                        {[...tool.status_history].reverse().map((entry, hidx) => (
                                          <div key={hidx} className="flex items-start gap-2 text-xs">
                                            <StatusBadge status={entry.status} />
                                            <div className="text-slate-400">
                                              <span>{formatDate(entry.timestamp)}</span>
                                              {entry.notes && <span className="ml-1 text-slate-300 italic">— {entry.notes}</span>}
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
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-red-700" onClick={e => e.stopPropagation()}>
              <div className="flex justify-center mb-4">
                <div className="bg-red-900/30 p-3 rounded-full">
                  <span className="material-symbols-outlined text-4xl text-red-400">warning</span>
                </div>
              </div>
              <h3 className="text-xl font-black text-white uppercase text-center mb-2">Delete Customer</h3>
              <p className="text-slate-300 text-center mb-2">
                Delete <span className="font-bold text-white">{deleteConfirm.company_name || deleteConfirm.contact_person}</span>?
              </p>
              <p className="text-red-300 text-sm text-center mb-6">This cannot be undone. Customers with linked repair jobs cannot be deleted.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold">Cancel</button>
                <button onClick={handleDeleteCustomer} className="flex-1 px-4 py-3 bg-red-900 hover:bg-red-800 text-white rounded-lg font-bold">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Status Update Modal */}
        {statusUpdateModal && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => !updatingStatus && setStatusUpdateModal(null)}>
            <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 border border-slate-600" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-black text-white uppercase mb-1">Update Tool Status</h3>
              <p className="text-slate-400 text-sm mb-4">
                {statusUpdateModal.brand} {statusUpdateModal.model_number}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">New Status</label>
                  <select
                    value={statusUpdateForm.status}
                    onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {REPAIR_STATUSES_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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

        {/* Add Tool Modal */}
        {addToolForm && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setAddToolForm(null)}>
            <div className="bg-slate-800 rounded-lg max-w-2xl w-full my-8 p-6 border border-slate-600" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-black text-white uppercase mb-4">Add Tool</h3>
              <InlineToolForm toolData={addToolForm} onChange={setAddToolForm} />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setAddToolForm(null)} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all">Cancel</button>
                <button onClick={handleAddToolToJob} className="flex-1 px-4 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold transition-all">Add Tool</button>
              </div>
            </div>
          </div>
        )}

        {/* Photo Lightbox */}
        {selectedPhoto && (
          <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4 cursor-pointer" onClick={() => setSelectedPhoto(null)}>
            <button className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors">
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Customers</h2>
        <button
          onClick={() => { setShowNewForm(true); setNewForm(EMPTY_CUSTOMER); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-all"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          New Customer
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by company, contact, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-96 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <span className="text-sm font-bold text-slate-300">{customers.length} customer{customers.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
            <p className="mt-2 text-slate-400">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-5xl text-slate-600">group</span>
            <p className="mt-2 text-slate-400">
              {searchQuery ? 'No customers match your search' : 'No customers yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Company / Contact</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Since</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {paginated.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                      onClick={() => openCustomer(customer)}
                    >
                      <td className="py-3 px-4">
                        <div className="text-white font-bold">{customer.company_name || customer.contact_person}</div>
                        {customer.company_name && <div className="text-slate-400 text-xs">{customer.contact_person}</div>}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{customer.email}</td>
                      <td className="py-3 px-4 text-slate-300">{customer.phone}</td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{formatDate(customer.created_at)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openCustomer(customer); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">person</span>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-700 flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, customers.length)} of {customers.length}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="px-3 py-1.5 bg-slate-700 rounded-lg text-slate-300 hover:bg-slate-600 disabled:opacity-50">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 bg-slate-700 rounded-lg text-slate-300 hover:bg-slate-600 disabled:opacity-50">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Customer Modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowNewForm(false)}>
          <div className="bg-slate-800 rounded-xl max-w-lg w-full border border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-xl font-black text-white uppercase">New Customer</h3>
              <button onClick={() => setShowNewForm(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={newForm.company_name}
                    onChange={(e) => setNewForm({ ...newForm, company_name: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={newForm.contact_person}
                    onChange={(e) => setNewForm({ ...newForm, contact_person: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={newForm.email}
                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={newForm.phone}
                    onChange={(e) => setNewForm({ ...newForm, phone: formatPhone(e.target.value) })}
                    placeholder="###-###-####"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">Address</label>
                <input
                  type="text"
                  value={newForm.address}
                  onChange={(e) => setNewForm({ ...newForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">Internal Notes</label>
                <textarea
                  value={newForm.customer_notes}
                  onChange={(e) => setNewForm({ ...newForm, customer_notes: e.target.value })}
                  rows={3}
                  placeholder="e.g., Net 30, VIP customer"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewForm(false)} className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="flex-1 px-4 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold transition-all disabled:opacity-50">
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
  const ic = "w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary";
  const sh = "text-xs text-slate-500 uppercase tracking-wide font-bold mb-3 pb-2 border-b border-slate-700";
  return (
    <div className="space-y-5 text-sm">
      {/* Section 1 — Tool Identification */}
      <div>
        <p className={sh}>Tool Identification</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tool Type <span className="text-red-400">*</span></label>
            <input required value={d.tool_type || ''} onChange={(e) => h('tool_type', e.target.value)} placeholder="e.g., Impact Wrench" className={ic} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Brand <span className="text-red-400">*</span></label>
            <input required value={d.brand || ''} onChange={(e) => h('brand', e.target.value)} placeholder="e.g., Ingersoll Rand" className={ic} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Model Number <span className="text-red-400">*</span></label>
            <input required value={d.model_number || ''} onChange={(e) => h('model_number', e.target.value)} placeholder="e.g., 2135TIMAX" className={ic} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Serial Number</label>
            <input value={d.serial_number || ''} onChange={(e) => h('serial_number', e.target.value)} placeholder="Optional" className={ic} />
          </div>
        </div>
      </div>

      {/* Section 2 — Job Details */}
      <div>
        <p className={sh}>Job Details</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Quantity</label>
            <input type="number" min="1" value={d.quantity || 1} onChange={(e) => h('quantity', e.target.value)} className={ic} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Priority</label>
            <select value={d.priority || 'standard'} onChange={(e) => h('priority', e.target.value)} className={ic}>
              <option value="standard">Standard</option>
              <option value="rush">Rush</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Remarks / Description</label>
            <textarea value={d.remarks || ''} onChange={(e) => h('remarks', e.target.value)}
              rows={2} placeholder="Customer's description of the problem"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={d.warranty || false} onChange={(e) => h('warranty', e.target.checked)}
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
          <button type="button" onClick={() => h('parts', [...(d.parts || []), { name: '', quantity: 1, unit_cost: '', status: 'pending' }])}
            className="text-xs text-primary hover:text-blue-400 font-bold flex items-center gap-0.5 transition-colors">
            <span className="material-symbols-outlined text-sm">add</span> Add Part
          </button>
        </div>
        {(d.parts || []).length > 0 && (
          <div className="space-y-2">
            {d.parts.map((part, pi) => (
              <div key={pi} className="flex items-start gap-2 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input placeholder="Part name *" value={part.name} onChange={(e) => {
                    const updated = [...d.parts]; updated[pi] = { ...part, name: e.target.value }; h('parts', updated);
                  }} className="col-span-2 md:col-span-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="number" min="1" placeholder="Qty" value={part.quantity} onChange={(e) => {
                    const updated = [...d.parts]; updated[pi] = { ...part, quantity: parseInt(e.target.value) || 1 }; h('parts', updated);
                  }} className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="number" step="0.01" min="0" placeholder="Unit $" value={part.unit_cost ?? ''} onChange={(e) => {
                    const updated = [...d.parts]; updated[pi] = { ...part, unit_cost: e.target.value === '' ? null : parseFloat(e.target.value) }; h('parts', updated);
                  }} className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  <select value={part.status} onChange={(e) => {
                    const updated = [...d.parts]; updated[pi] = { ...part, status: e.target.value }; h('parts', updated);
                  }} className="px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="pending">Pending</option>
                    <option value="ordered">Ordered</option>
                    <option value="received">Received</option>
                    <option value="installed">Installed</option>
                  </select>
                </div>
                <button type="button" onClick={() => { h('parts', d.parts.filter((_, i) => i !== pi)); }}
                  className="text-red-400 hover:text-red-300 mt-1 transition-colors">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Labour Hours</label>
            <input type="number" step="0.5" min="0" value={d.labour_hours || ''} onChange={(e) => h('labour_hours', e.target.value)} placeholder="e.g., 2.5" className={ic} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hourly Rate ($)</label>
            <input type="number" step="0.01" min="0" value={d.hourly_rate || ''} onChange={(e) => h('hourly_rate', e.target.value)} placeholder="e.g., 95.00" className={ic} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Zoho Quote Reference</label>
            <input value={d.zoho_quote_ref || ''} onChange={(e) => h('zoho_quote_ref', e.target.value)} placeholder="Optional" className={ic} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Assigned Technician</label>
            <input value={d.assigned_technician || ''} onChange={(e) => h('assigned_technician', e.target.value)} placeholder="Optional" className={ic} />
          </div>
        </div>
      </div>

      {/* Section 5 — Scheduling */}
      <div>
        <p className={sh}>Scheduling</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Date Received</label>
            <input type="date" value={d.date_received ? d.date_received.split('T')[0] : ''} onChange={(e) => h('date_received', e.target.value)} className={ic} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Est. Completion Date</label>
            <input type="date" value={d.estimated_completion || ''} onChange={(e) => h('estimated_completion', e.target.value)} className={ic} />
          </div>
        </div>
      </div>
    </div>
  );
}
