import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { repairsAPI, customersAPI, partsLibraryAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';
import {
  REPAIR_STATUSES, REPAIR_STATUSES_LIST,
  getValidNextStatuses,
} from '../../../constants/repairStatuses';
import { StatusBadge, StepBadge, ProgressStepper } from './RepairStatusBadges';
import { openPrintWorkOrder } from '../PrintWorkOrder';
import { openPrintToolTag } from '../PrintToolTag';
import SendWorkOrderEmailModal from '../SendWorkOrderEmailModal';
import { formatDatePacific, formatDateShortPacific } from '../../../utils/dateFormat';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { useSettings } from '../../../contexts/SettingsContext';
import ToolForm, { getEmptyTool, syncPartsToLibrary, HATHORN_FINAL_CHECKLIST } from './ToolForm';

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
const getPriorityConfig = (value) => PRIORITIES.find(p => p.value === value) || PRIORITIES[0];

const PriorityBadge = ({ priority }) => {
  const cfg = getPriorityConfig(priority);
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-bold border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

const TERMINAL_STATUSES = new Set(['completed', 'abandoned', 'closed', 'declined', 'beyond_economical_repair']);

// Module-level cache so retail price lookups stay instant across dialog opens
let libraryBrandsCache = null;

// Shared work order detail dialog: full tool cards, parts, photos, status
// updates, customer edit and email/print actions. The job object lives in the
// PARENT (fully controlled): every mutation calls onJobUpdated(updatedJob) so
// the parent can sync both its dialog state and its list rows.
export default function WorkOrderDialog({ job, serviceAgreement, onClose, onJobUpdated, onCustomerUpdated }) {
  const showToast = useToast();
  const { settings } = useSettings();
  const staleDays = settings?.staleDays ?? 3;
  useBodyScrollLock(true);

  // Linked customer record (single source of truth)
  const [jobCustomer, setJobCustomer] = useState(null);
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

  // Returning-unit badges: for each tool with serials, has this exact unit
  // (or one of its Hathorn components) been on the bench before?
  const [returningMap, setReturningMap] = useState({});
  useEffect(() => {
    if (!job?.id) return undefined;
    let alive = true;
    (async () => {
      const entries = await Promise.all((job.tools || []).map(async (t) => {
        const serials = [t.serial_number, t.camera_head_serial, t.controller_serial, t.rod_holder_serial]
          .map((s) => (s || '').trim()).filter((s) => s.length >= 3);
        if (!serials.length) return [t.tool_id, null];
        try {
          const res = await repairsAPI.serialHistory(serials.join(','), t.brand?.trim(), job.id);
          const ms = res.matches || [];
          if (!ms.length) return [t.tool_id, null];
          const warranty = ms.some((m) => m.date_completed
            && (Date.now() - new Date(m.date_completed).getTime()) / 86400000 <= 90);
          return [t.tool_id, { count: ms.length, warranty, last: ms[0]?.work_order }];
        } catch { return [t.tool_id, null]; }
      }));
      if (alive) setReturningMap(Object.fromEntries(entries.filter((e) => e[1])));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.tools?.length]);
  const [toolEditForm, setToolEditForm] = useState(null);
  const [savingToolEdit, setSavingToolEdit] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(null); // toolId
  const [retailPriceMap, setRetailPriceMap] = useState({}); // { tool_id: price | null }
  const detailCloseRef = useRef(null);

  // Update-all-tools state
  const [updateAllOpen, setUpdateAllOpen] = useState(false);
  const [updateAllForm, setUpdateAllForm] = useState({ status: '', notes: '' });
  const [updateAllApplying, setUpdateAllApplying] = useState(false);
  const [updateAllSelected, setUpdateAllSelected] = useState(new Set()); // tool_ids

  // Work order email modal
  const [emailOpen, setEmailOpen] = useState(false);

  const formatDate = formatDatePacific;
  const formatDateShort = formatDateShortPacific;

  // Fetch linked customer record whenever the job changes
  useEffect(() => {
    let cancelled = false;
    if (!job?.customer_id) { setJobCustomer(null); return; }
    customersAPI.get(job.customer_id)
      .then(cust => { if (!cancelled) setJobCustomer(cust); })
      .catch(() => { if (!cancelled) setJobCustomer(null); });
    return () => { cancelled = true; };
  }, [job?.customer_id]);

  // Enrich parts with library stock data when a job is loaded or refreshed
  // Build a key from all library_part_ids missing stock data to detect when enrichment is needed
  const missingStockKey = useMemo(() => {
    if (!job?.tools?.length) return '';
    const ids = [];
    job.tools.forEach(t => (t.parts || []).forEach(p => {
      if (p.library_part_id && p._library_qty == null) ids.push(p.library_part_id);
    }));
    return ids.sort().join(',');
  }, [job]);

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
      onJobUpdated({ ...job, tools: job.tools.map(t => ({
        ...t,
        parts: (t.parts || []).map(p =>
          p.library_part_id && stockMap[p.library_part_id]
            ? { ...p, _library_qty: stockMap[p.library_part_id].qty, _library_low_stock: stockMap[p.library_part_id].low }
            : p
        ),
      }))});
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingStockKey]);

  // Look up retail prices from parts library when a job is loaded
  useEffect(() => {
    if (!job?.tools?.length) { setRetailPriceMap({}); return; }
    let cancelled = false;
    (async () => {
      const brands = libraryBrandsCache || await partsLibraryAPI.listBrands().catch(() => []);
      if (!libraryBrandsCache) libraryBrandsCache = brands;
      // Group tools by brand to fetch models once per unique brand
      const brandGroups = {};
      for (const tool of job.tools) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  // Focus close button when the dialog opens
  useEffect(() => {
    detailCloseRef.current?.focus();
  }, []);

  // Clean up remove-confirm timer on unmount
  useEffect(() => {
    return () => {
      if (removeConfirmTimer.current) clearTimeout(removeConfirmTimer.current);
    };
  }, []);

  // Escape key: close topmost open layer. The parent's own Escape handler must
  // skip everything while the dialog is open (it knows: it holds the job state).
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedPhoto) { setSelectedPhoto(null); return; }
      if (statusUpdateModal && !updatingStatus) { setStatusUpdateModal(null); return; }
      if (editingToolId && !savingToolEdit) { handleCancelToolEdit(); return; }
      if (addToolForm && !addingTool) { setAddToolForm(null); return; }
      if (updateAllOpen && !updateAllApplying) { setUpdateAllOpen(false); return; }
      if (editingJob) { setEditingJob(false); return; }
      if (emailOpen) return; // email modal manages its own closing
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, statusUpdateModal, updatingStatus, editingToolId, savingToolEdit, addToolForm, addingTool, updateAllOpen, updateAllApplying, editingJob, emailOpen, onClose]);

  // ── STALE / OVERDUE HELPERS ──────────────────────────
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

  // Returns status keys valid as next status for ALL given tools
  const getCommonValidTransitions = (tools) => {
    if (!tools || tools.length === 0) return [];
    const sets = tools.map(t => new Set(getValidNextStatuses(t.status)));
    return [...sets[0]].filter(s => sets.every(set => set.has(s)));
  };

  // ── CUSTOMER EDIT (from WO dialog) ───────────────────
  const handleSaveJobEdit = async () => {
    setSavingJobEdit(true);
    try {
      if (job.customer_id) {
        // Write 1: update customer record (single source of truth)
        let updatedCustomer;
        try {
          updatedCustomer = await customersAPI.update(job.customer_id, jobEditForm);
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
          updatedJob = await repairsAPI.update(job.id, jobUpdate);
        } catch {
          // Customer was already saved — report partial success
          setJobCustomer(updatedCustomer);
          if (onCustomerUpdated) onCustomerUpdated(updatedCustomer);
          showToast('success', 'Customer updated. Job sync failed — refresh to see latest.');
          setEditingJob(false);
          return;
        }
        setJobCustomer(updatedCustomer);
        if (onCustomerUpdated) onCustomerUpdated(updatedCustomer);
        onJobUpdated(updatedJob);
      } else {
        let updated;
        try {
          updated = await repairsAPI.update(job.id, jobEditForm);
        } catch (err) {
          showToast('error', getErrorMessage(err, 'Failed to update customer'));
          return;
        }
        onJobUpdated(updated);
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
      updated = await repairsAPI.updateToolStatus(job.id, statusUpdateModal.tool_id, payload);
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to update tool status'));
      setUpdatingStatus(false);
      return;
    }
    onJobUpdated(updated);
    setStatusUpdateModal(null);
    showToast('success', 'Tool status updated');
    setUpdatingStatus(false);
  };

  // ── UPDATE ALL/SELECTED TOOLS ─────────────────────────
  const getSelectedTools = () => {
    if (!job) return [];
    if (updateAllSelected.size === 0) return job.tools; // none selected = all
    return job.tools.filter(t => updateAllSelected.has(t.tool_id));
  };

  const handleUpdateAllTools = async () => {
    if (!updateAllForm.status || !job) return;
    const tools = getSelectedTools();
    if (tools.length === 0) return;
    setUpdateAllApplying(true);
    try {
      const items = tools.map(t => ({
        job_id: job.id,
        tool_id: t.tool_id,
        new_status: updateAllForm.status,
        notes: updateAllForm.notes || null,
      }));
      const result = await repairsAPI.batchUpdateStatus(items);
      if (result.success_count > 0) {
        showToast('success', `Updated ${result.success_count} tool${result.success_count !== 1 ? 's' : ''}`);
        const fresh = await repairsAPI.get(job.id);
        onJobUpdated(fresh);
        setUpdateAllOpen(false);
        setUpdateAllForm({ status: '', notes: '' });
        setUpdateAllSelected(new Set());
      }
      if (result.failure_count > 0) {
        showToast('error', `${result.failure_count} update${result.failure_count !== 1 ? 's' : ''} failed`);
      }
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to update tools'));
    } finally {
      setUpdateAllApplying(false);
    }
  };

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
      included_items: tool.included_items || [],
      rod_length_received: tool.rod_length_received ?? '',
      rod_length_cut: tool.rod_length_cut ?? '',
      rod_length_remaining: tool.rod_length_remaining ?? '',
      camera_head_serial: (tool.camera_head_serial || '').toUpperCase(),
      controller_serial: (tool.controller_serial || '').toUpperCase(),
      rod_holder_serial: (tool.rod_holder_serial || '').toUpperCase(),
      counter_at_intake: tool.counter_at_intake ?? '',
      counter_after_repair: tool.counter_after_repair ?? '',
      intake_condition: tool.intake_condition || [],
      final_checklist: tool.final_checklist || [],
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
      updated = await repairsAPI.updateTool(job.id, editingToolId, payload);
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to update tool'));
      setSavingToolEdit(false);
      return;
    }
    // Silently save new parts to library
    syncPartsToLibrary([toolEditForm]);

    onJobUpdated(updated);
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
      updated = await repairsAPI.addTool(job.id, payload);
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to add tool'));
      setAddingTool(false);
      return;
    }
    // Silently save new parts to library
    syncPartsToLibrary([addToolForm]);

    onJobUpdated(updated);
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
      const updated = await repairsAPI.removeTool(job.id, toolId);
      onJobUpdated(updated);
      showToast('success', 'Tool removed');
    } catch {
      showToast('error', 'Failed to remove tool');
    }
  };

  // ── PHOTO UPLOAD / DELETE ────────────────────────────
  const handlePhotoUpload = async (toolId, file) => {
    setUploadingPhoto(toolId);
    try {
      const updated = await repairsAPI.uploadToolPhoto(job.id, toolId, file);
      onJobUpdated(updated);
      showToast('success', 'Photo uploaded');
    } catch {
      showToast('error', 'Failed to upload photo');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleDeletePhoto = async (toolId, filename) => {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return;
    try {
      const updated = await repairsAPI.deleteToolPhoto(job.id, toolId, filename);
      onJobUpdated(updated);
      showToast('success', 'Photo deleted');
    } catch {
      showToast('error', 'Failed to delete photo');
    }
  };

  if (!job) return null;

  return (
    <>
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
                    <h3 id="wo-dialog-title" className="text-base sm:text-lg font-black text-slate-900 dark:text-white"><span className="hidden sm:inline">Work Order </span><span className="text-primary font-mono">{job.request_number}</span></h3>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">Created {formatDateShort(job.created_at)}</span>
                    {job.source === 'online_request' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-700/50">
                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>public</span>
                        <span className="hidden sm:inline">Online Request</span>
                      </span>
                    )}
                    {job.source === 'drop_off' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600/50">
                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>store</span>
                        <span className="hidden sm:inline">Drop-off</span>
                      </span>
                    )}
                    {job.source === 'phone_in' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-300 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-700/50">
                        <span className="material-symbols-outlined" style={{fontSize:'11px'}}>call</span>
                        <span className="hidden sm:inline">Phone-in</span>
                      </span>
                    )}
                    {job.source === 'email' && (
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
                  onClick={() => setEmailOpen(true)}
                  className={`w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                    job?.work_order_emails_sent?.length
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                  title={job?.work_order_emails_sent?.length
                    ? `Work order emailed (${job.work_order_emails_sent.length}x) — click to resend`
                    : 'Email work order to customer'}
                >
                  <span className="material-symbols-outlined" style={{fontSize:'18px'}}>
                    {job?.work_order_emails_sent?.length ? 'mark_email_read' : 'mail'}
                  </span>
                </button>
                <button
                  onClick={() => openPrintWorkOrder(job, settings?.contact, serviceAgreement)}
                  className="w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                  title="Print / Save as PDF"
                >
                  <span className="material-symbols-outlined" style={{fontSize:'18px'}}>print</span>
                </button>
                <button ref={detailCloseRef} onClick={onClose} aria-label="Close work order" className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Customer Info */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40">
                  <span className="material-symbols-outlined text-slate-500 dark:text-slate-400" style={{ fontSize: '14px' }}>person</span>
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Customer</h4>
                  <div className="ml-auto flex items-center gap-1.5">
                    {job.customer_id && (
                      <Link
                        to={`/admin/repair-tracker?tab=customers&customer=${job.customer_id}`}
                        title="Open customer profile"
                        className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold transition-all"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>open_in_new</span>
                        Profile
                      </Link>
                    )}
                    <button onClick={() => { const src = jobCustomer || job; setEditingJob(true); setJobEditForm({
                      company_name: src.company_name || '',
                      first_name: src.first_name || '',
                      last_name: src.last_name || '',
                      email: src.email,
                      phone: src.phone,
                      address: src.address || '',
                      customer_notes: src.customer_notes || '',
                    }); }} className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-bold transition-all">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span>
                      Edit
                    </button>
                  </div>
                </div>
                {(
                  <div className="px-4 py-4">
                    {(() => { const cust = jobCustomer || job; return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                          {cust.company_name && (
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>business</span>
                              <span className="text-xs text-slate-500">Company:</span>
                              <span className="text-sm text-slate-900 dark:text-white font-bold truncate">{(cust.company_name || '').toUpperCase()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '13px' }}>person</span>
                            <span className="text-xs text-slate-500">Contact:</span>
                            <span className="text-sm text-slate-900 dark:text-white">{`${cust.first_name} ${cust.last_name}`.toUpperCase()}</span>
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
                              <span className="text-sm text-slate-900 dark:text-white truncate">{(cust.address || '').toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        {cust.customer_notes && (
                          <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-slate-200/40 dark:border-slate-700/40">
                            <span className="material-symbols-outlined text-slate-500 mt-0.5" style={{ fontSize: '13px' }}>sticky_note_2</span>
                            <span className="text-xs text-slate-500">Notes:</span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">{(cust.customer_notes || '').toUpperCase()}</span>
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
                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Tools ({job.tools.length})</h4>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {job.tools.length >= 2 && (
                      <button
                        onClick={() => {
                          if (updateAllOpen) {
                            setUpdateAllOpen(false);
                            setUpdateAllSelected(new Set());
                          } else {
                            setUpdateAllSelected(new Set()); // start with all selected (empty = all)
                            const common = getCommonValidTransitions(job.tools);
                            setUpdateAllForm({ status: common[0] || '', notes: '' });
                            setUpdateAllOpen(true);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-xs font-bold transition-all ${
                          updateAllOpen
                            ? 'bg-primary text-white shadow-sm shadow-primary/20'
                            : 'bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary dark:text-blue-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">update</span>
                        Update Statuses
                      </button>
                    )}
                    <button
                      onClick={() => setAddToolForm(getEmptyTool())}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 bg-primary/90 hover:bg-primary text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-primary/20"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Tool
                    </button>
                  </div>
                </div>

                {/* Update Tools inline panel (hybrid: all or selective) */}
                {updateAllOpen && job.tools.length >= 2 && (() => {
                  const targetTools = getSelectedTools();
                  const common = getCommonValidTransitions(targetTools);
                  const isAllSelected = updateAllSelected.size === 0;
                  const toolCount = targetTools.length;
                  return (
                    <div className="mb-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-xl flex flex-col gap-2">
                      {/* Row 1: tool selection chips */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => {
                            setUpdateAllSelected(new Set());
                            const allCommon = getCommonValidTransitions(job.tools);
                            setUpdateAllForm(f => ({ ...f, status: allCommon[0] || '' }));
                          }}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                            isAllSelected
                              ? 'bg-primary text-white'
                              : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-primary/50'
                          }`}
                        >
                          All
                        </button>
                        {job.tools.map(tool => {
                          const cfg = REPAIR_STATUSES[tool.status] || {};
                          const isChecked = !isAllSelected && updateAllSelected.has(tool.tool_id);
                          return (
                            <button
                              key={tool.tool_id}
                              onClick={() => {
                                let next;
                                if (isAllSelected) {
                                  next = new Set([tool.tool_id]);
                                } else {
                                  next = new Set(updateAllSelected);
                                  if (next.has(tool.tool_id)) next.delete(tool.tool_id); else next.add(tool.tool_id);
                                  if (next.size === job.tools.length || next.size === 0) next = new Set();
                                }
                                setUpdateAllSelected(next);
                                const tools = next.size === 0 ? job.tools : job.tools.filter(t => next.has(t.tool_id));
                                const newCommon = getCommonValidTransitions(tools);
                                setUpdateAllForm(f => ({ ...f, status: newCommon[0] || '' }));
                              }}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                                isChecked
                                  ? 'bg-primary text-white'
                                  : isAllSelected
                                    ? 'bg-primary/10 border border-primary/30 text-primary dark:text-blue-400'
                                    : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-primary/50'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot || 'bg-slate-400'}`} />
                              {`${tool.brand} ${tool.model_number}`.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                      {/* Row 2: status + notes + actions */}
                      {common.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">No common next status — adjust selection or update individually.</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={updateAllForm.status}
                            onChange={e => setUpdateAllForm(f => ({ ...f, status: e.target.value }))}
                            className="w-full sm:w-auto min-w-[10rem] text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            {common.map(s => (
                              <option key={s} value={s}>{REPAIR_STATUSES[s]?.label || s}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Notes (optional)"
                            value={updateAllForm.notes}
                            onChange={e => setUpdateAllForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full sm:flex-1 sm:min-w-0 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-400"
                          />
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              onClick={handleUpdateAllTools}
                              disabled={updateAllApplying || !updateAllForm.status}
                              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-primary hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                            >
                              <span className="material-symbols-outlined text-sm">{updateAllApplying ? 'refresh' : 'done_all'}</span>
                              {updateAllApplying ? 'Updating…' : `Update ${isAllSelected ? 'All' : toolCount}`}
                            </button>
                            <button
                              onClick={() => { setUpdateAllOpen(false); setUpdateAllSelected(new Set()); }}
                              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold transition-colors whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-5">
                  {job.tools.map((tool, idx) => (
                    <div key={tool.tool_id} className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-sm">
                      {/* Tool Header — colored left border by status */}
                      <div className="p-4 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-black text-slate-500 dark:text-slate-400">
                              {idx + 1}
                            </div>
                            <div>
                              <Link
                                to={`/admin/repair-tracker?tab=parts-library&brand=${encodeURIComponent(tool.brand || '')}&model=${encodeURIComponent(tool.model_number || '')}`}
                                className="font-bold text-slate-900 dark:text-white text-base text-left group/pl flex items-center gap-1.5 hover:text-primary dark:hover:text-blue-400 transition-colors"
                                title="View in Parts Library"
                              >
                                {`${tool.brand} ${tool.model_number}`.toUpperCase()}
                                <span className="material-symbols-outlined text-sm opacity-0 group-hover/pl:opacity-60 transition-opacity">inventory_2</span>
                              </Link>
                              <div className="text-sm text-slate-500 mt-1">
                                {(tool.tool_type || '').toUpperCase()}{tool.quantity > 1 && ` × ${tool.quantity}`}
                                {tool.serial_number && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>S/N: {tool.serial_number.toUpperCase()}</>}
                                {retailPriceMap[tool.tool_id] != null && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>Retail: ${parseFloat(retailPriceMap[tool.tool_id]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
                                {tool.estimated_completion && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>Est: {formatDateShort(tool.estimated_completion)}</>}
                              </div>
                              {(() => {
                                const bits = [
                                  tool.camera_head_serial && `Head S/N: ${tool.camera_head_serial.toUpperCase()}`,
                                  tool.controller_serial && `Ctrl S/N: ${tool.controller_serial.toUpperCase()}`,
                                  tool.rod_holder_serial && `Holder S/N: ${tool.rod_holder_serial.toUpperCase()}`,
                                  tool.counter_at_intake != null && `Odometer in: ${tool.counter_at_intake} ft`,
                                  tool.counter_after_repair != null && `out: ${tool.counter_after_repair} ft`,
                                ].filter(Boolean);
                                return bits.length > 0 && (
                                  <div className="text-sm text-slate-500 mt-0.5">
                                    {bits.map((b, i) => (
                                      <span key={b}>{i > 0 && <span className="mx-1 text-slate-500 dark:text-slate-700">·</span>}{b}</span>
                                    ))}
                                  </div>
                                );
                              })()}
                              {(tool.rod_length_received != null || tool.rod_length_cut != null || tool.rod_length_remaining != null) && (
                                <div className="text-sm text-slate-500 mt-0.5">
                                  Rod:{tool.rod_length_received != null && <> {tool.rod_length_received} ft received</>}
                                  {tool.rod_length_cut != null && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span>{tool.rod_length_cut} ft cut</>}
                                  {tool.rod_length_remaining != null && <><span className="mx-1 text-slate-500 dark:text-slate-700">·</span><span className="font-medium text-slate-600 dark:text-slate-300">{tool.rod_length_remaining} ft remaining</span></>}
                                </div>
                              )}
                              {tool.intake_condition?.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                  <span className="text-xs text-slate-400 dark:text-slate-500 mr-0.5">Condition in:</span>
                                  {tool.intake_condition.map((item) => (
                                    <span key={item} className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {tool.included_items?.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                  <span className="text-xs text-slate-400 dark:text-slate-500 mr-0.5">Includes:</span>
                                  {tool.included_items.map((item) => (
                                    <span key={item} className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {returningMap[tool.tool_id] && (
                              <span
                                title={returningMap[tool.tool_id].warranty
                                  ? `Completed within the 3-month warranty window — see ${returningMap[tool.tool_id].last}`
                                  : `${returningMap[tool.tool_id].count} previous visit${returningMap[tool.tool_id].count !== 1 ? 's' : ''} — last was ${returningMap[tool.tool_id].last}`}
                                className={`px-2.5 py-1 rounded-full text-sm font-bold border ${
                                  returningMap[tool.tool_id].warranty
                                    ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50'
                                    : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/50'
                                }`}
                              >
                                {returningMap[tool.tool_id].warranty ? 'Warranty window' : 'Returning unit'}
                              </span>
                            )}
                            {/hathorn/i.test(tool.brand || '') && (() => {
                              const done = new Set((tool.final_checklist || []).map((i) => i.toLowerCase()));
                              const n = HATHORN_FINAL_CHECKLIST.filter((i) => done.has(i.toLowerCase())).length;
                              const total = HATHORN_FINAL_CHECKLIST.length;
                              const complete = n === total;
                              return (
                                <span
                                  title={complete ? 'Final test checklist complete' : `Final test checklist ${n}/${total} — required before Ready`}
                                  className={`px-2.5 py-1 rounded-full text-sm font-bold border ${
                                    complete
                                      ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50'
                                      : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/50'
                                  }`}
                                >
                                  QC {n}/{total}
                                </span>
                              );
                            })()}
                            <StepBadge status={tool.status} />
                            <span className="hidden sm:block"><PriorityBadge priority={tool.priority} /></span>
                            {tool.warranty && (
                              <span className="hidden sm:inline px-2.5 py-1 rounded-full text-sm font-bold bg-teal-100 text-teal-700 border border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/50">Warranty</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 mt-4 flex-wrap">
                          {tool.warranty && (
                            <span className="sm:hidden px-2.5 py-1 rounded-full text-sm font-bold bg-teal-100 text-teal-700 border border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/50">Warranty</span>
                          )}
                          <button
                            onClick={() => openStatusUpdate(tool)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary hover:text-blue-700 dark:hover:text-blue-300 rounded-lg text-sm font-bold transition-all"
                          >
                            <span className="material-symbols-outlined text-base">update</span>
                            Update Status
                          </button>
                          {editingToolId !== tool.tool_id && (
                            <button
                              onClick={() => handleStartToolEdit(tool)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm font-bold transition-all"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => openPrintToolTag(job, tool, idx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm font-bold transition-all"
                            title="Print tool tag"
                          >
                            <span className="material-symbols-outlined text-base">label</span>
                            Print Tag
                          </button>
                          {job.tools.length > 1 && (
                            <button
                              onClick={() => handleRemoveTool(tool.tool_id)}
                              title="Remove tool from work order"
                              aria-label="Remove tool from work order"
                              className={`px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-sm font-bold transition-all border ${
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
                      <div className="px-4 pt-4 pb-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700/60">
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
                        <div className="flex items-center gap-3 flex-wrap mb-2">
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
                      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700/60">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 text-sm">
                          {/* Left column — Remarks stacked above Labour/Tech/Zoho */}
                          <div className="space-y-4">
                            {/* Remarks */}
                            <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3.5 py-3 border border-slate-200/40 dark:border-slate-700/40">
                              <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'12px'}}>Remarks</span>
                              <p className={`mt-1 leading-relaxed whitespace-pre-wrap ${tool.remarks ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 italic'}`}>{tool.remarks || 'No remarks'}</p>
                            </div>
                            {/* Labour / Technician / Zoho */}
                            <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3.5 py-3 border border-slate-200/40 dark:border-slate-700/40 space-y-2.5">
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
                          <div className="bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3.5 py-3 border border-slate-200/40 dark:border-slate-700/40">
                            <span className="text-slate-500 uppercase tracking-wide font-bold" style={{fontSize:'12px'}}>Parts {tool.parts?.filter(p => p.name?.trim()).length > 0 && `(${tool.parts.filter(p => p.name?.trim()).length})`}</span>
                            {tool.parts && tool.parts.filter(p => p.name?.trim()).length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {tool.parts.map((p, realPi) => p.name?.trim() ? (
                                  <div key={realPi} className="bg-slate-50 dark:bg-slate-900/60 rounded-md px-2.5 py-2 border border-slate-200/30 dark:border-slate-700/30 space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-slate-700 dark:text-slate-200 font-medium flex-1">{`${p.name}${p.part_number ? ` - ${p.part_number}` : ''}`.toUpperCase()}</span>
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
                                            await repairsAPI.togglePartSourcing(job.id, tool.tool_id, realPi);
                                            const updated = await repairsAPI.get(job.id);
                                            onJobUpdated(updated);
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
                      <div className="px-4 pb-4 pt-4 border-t border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-500 text-base">photo_library</span>
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Photos</span>
                            {tool.photos?.length > 0 && (
                              <span className="text-sm font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">{tool.photos.length}</span>
                            )}
                          </div>
                          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[44px] sm:min-h-0 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm font-bold cursor-pointer transition-all">
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
                                  className="absolute top-1 right-1 w-7 h-7 sm:w-6 sm:h-6 bg-red-600/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg"
                                  title="Delete photo"
                                  aria-label="Delete photo"
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
                                        <p className="mt-1 text-slate-500 dark:text-slate-400 italic pl-0.5">&quot;{entry.notes}&quot;</p>
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
                <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{`${statusUpdateModal.brand} ${statusUpdateModal.model_number}${statusUpdateModal.tool_type ? ` — ${statusUpdateModal.tool_type}` : ''}`.toUpperCase()}</p>
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
                {isEdit && <p className="text-xs text-slate-500 mt-0.5 truncate">{`${formData.brand} ${formData.model_number}`.toUpperCase()}</p>}
              </div>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex-shrink-0">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <ToolForm toolData={formData} onChange={setFormData} currentJobId={job.id} />
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
                  <p className="text-xs text-slate-500 mt-0.5">{`${jobEditForm.first_name} ${jobEditForm.last_name}`.toUpperCase()}</p>
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

      {/* Send Work Order Email Modal */}
      {emailOpen && (
        <SendWorkOrderEmailModal
          job={job}
          template={settings?.workOrderEmailTemplate}
          onClose={() => setEmailOpen(false)}
          onSuccess={(sentTo) => {
            setEmailOpen(false);
            showToast('success', `Work order emailed to ${sentTo}`);
            // Mark job as emailed locally so the icon updates immediately
            const emailRecord = { sent_at: new Date().toISOString(), sent_to: sentTo, success: true };
            onJobUpdated({ ...job, work_order_emails_sent: [...(job.work_order_emails_sent || []), emailRecord] });
          }}
        />
      )}
    </>
  );
}
