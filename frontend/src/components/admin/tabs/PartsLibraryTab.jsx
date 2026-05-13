import { useState, useEffect, useCallback, useRef } from 'react';
import { partsLibraryAPI } from '../../../services/api';
import { useToast } from '../../../pages/admin/RepairTracker';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DiagramList({ urls, onDelete, readonly = false }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {urls.map((url, i) => {
        const isPdf = url.toLowerCase().endsWith('.pdf');
        const displayName = url.split('/').pop()?.slice(0, 30) || `File ${i + 1}`;
        return (
          <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 text-xs">
            <span className="material-symbols-outlined text-sm text-slate-500">
              {isPdf ? 'picture_as_pdf' : 'image'}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline max-w-[120px] truncate"
              title={url}
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

// ─── Brand Form Modal ─────────────────────────────────────────────────────────

function BrandFormModal({ brand, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: brand?.name || '',
    short_code: brand?.short_code || '',
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
      if (form.short_code) fd.append('short_code', form.short_code.trim());
      if (form.website) fd.append('website', form.website.trim());
      if (form.notes) fd.append('notes', form.notes.trim());
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
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Ingersoll Rand"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Short Code</label>
            <input
              value={form.short_code}
              onChange={e => setForm(f => ({ ...f, short_code: e.target.value }))}
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
    name: model?.name || '',
    category: model?.category || '',
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
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 2135TiMAX"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Category</label>
            <input
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Impact Wrench"
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
  const [form, setForm] = useState({
    part_number: part?.part_number || '',
    name: part?.name || '',
    description: part?.description || '',
    category: part?.category || '',
    ref_number: part?.ref_number || '',
    brand_id: part?.brand_id || brandId || '',
    model_ids: part?.model_ids || (modelId ? [modelId] : []),
    compatibility_group_ids: part?.compatibility_group_ids || [],
    specifications: part?.specifications || '',
    suggested_suppliers: part?.suggested_suppliers || [],
    suggested_price: part?.suggested_price ?? '',
    order_url: part?.order_url || '',
    notes: part?.notes || '',
  });
  const [supplierInput, setSupplierInput] = useState('');
  const [saving, setSaving] = useState(false);

  const addSupplier = () => {
    const s = supplierInput.trim();
    if (s && !form.suggested_suppliers.includes(s)) {
      setForm(f => ({ ...f, suggested_suppliers: [...f.suggested_suppliers, s] }));
    }
    setSupplierInput('');
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
        suggested_price: form.suggested_price === '' ? null : Number(form.suggested_price),
        description: form.description || null,
        category: form.category || null,
        ref_number: form.ref_number || null,
        specifications: form.specifications || null,
        order_url: form.order_url || null,
        notes: form.notes || null,
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Part Number *</label>
              <input
                required
                value={form.part_number}
                onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. IR-231C-601"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Diagram Ref #</label>
              <input
                value={form.ref_number}
                onChange={e => setForm(f => ({ ...f, ref_number: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 14"
                maxLength={20}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Part Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. O-Ring Kit"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Category</label>
              <input
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. O-Ring, Blade"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Suggested Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.suggested_price}
                onChange={e => setForm(f => ({ ...f, suggested_price: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Order URL</label>
            <input
              value={form.order_url}
              onChange={e => setForm(f => ({ ...f, order_url: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://supplier.com/part/..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Specifications</label>
            <textarea
              value={form.specifications}
              onChange={e => setForm(f => ({ ...f, specifications: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Suggested Suppliers */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Suggested Suppliers</label>
            <div className="flex gap-2">
              <input
                value={supplierInput}
                onChange={e => setSupplierInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSupplier(); } }}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Supplier name, press Enter"
              />
              <button type="button" onClick={addSupplier} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Add</button>
            </div>
            {form.suggested_suppliers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.suggested_suppliers.map((s, i) => (
                  <span key={i} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-lg px-2 py-0.5">
                    {s}
                    <button type="button" onClick={() => setForm(f => ({ ...f, suggested_suppliers: f.suggested_suppliers.filter((_, j) => j !== i) }))} className="hover:text-red-500 transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </span>
                ))}
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
  const [uploadingDiagramFor, setUploadingDiagramFor] = useState(null);
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

  const handleUploadPartDiagram = async (partId, file) => {
    setUploadingDiagramFor(partId);
    try {
      const updated = await partsLibraryAPI.uploadPartDiagram(partId, file);
      setParts(p => p.map(x => x.id === partId ? updated : x));
      toast('success', 'Diagram uploaded');
    } catch (err) {
      toast('error', err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingDiagramFor(null);
    }
  };

  const handleDeletePartDiagram = async (partId, url) => {
    try {
      await partsLibraryAPI.deletePartDiagram(partId, url);
      setParts(p => p.map(x => x.id === partId ? { ...x, diagram_urls: x.diagram_urls.filter(u => u !== url) } : x));
      toast('success', 'Diagram removed');
    } catch {
      toast('error', 'Failed to remove diagram');
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
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.ref_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4 flex-wrap">
        <button onClick={onBack} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Brands</button>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <button onClick={onBack} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{model.brand_name}</button>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-slate-800 dark:text-slate-100 font-medium">{model.name}</span>
        {model.discontinued && (
          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">Discontinued</span>
        )}
      </div>

      {/* Model diagrams */}
      <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Model Breakdown Diagrams</span>
          <UploadDiagramButton onUpload={handleUploadModelDiagram} loading={uploadingModelDiagram} />
        </div>
        {currentModel.diagram_urls?.length > 0
          ? <DiagramList urls={currentModel.diagram_urls} onDelete={handleDeleteModelDiagram} />
          : <p className="text-xs text-slate-400">No diagrams uploaded yet</p>
        }
        {model.specifications && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{model.specifications}</p>
        )}
      </div>

      {/* Parts header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400">settings</span>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Parts ({parts.length})</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search parts…"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
          <button
            onClick={() => { setEditingPart(null); setShowPartForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Part
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
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpandedPart(expandedPart === part.id ? null : part.id)}
              >
                <span className="material-symbols-outlined text-slate-400 text-sm">settings</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                      {part.part_number}
                    </span>
                    {part.ref_number && (
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded" title="Diagram reference #">
                        #{part.ref_number}
                      </span>
                    )}
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{part.name}</span>
                    {part.category && (
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{part.category}</span>
                    )}
                    {part.compatibility_group_ids?.length > 0 && (
                      <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full" title="Has cross-compatible alternatives">
                        {part.compatibility_group_ids.length} compat group{part.compatibility_group_ids.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {part.suggested_price != null && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">${part.suggested_price.toFixed(2)}</span>
                  )}
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
                <div className="px-4 pb-4 pt-1 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  {part.description && <p className="text-sm text-slate-600 dark:text-slate-300">{part.description}</p>}
                  {part.specifications && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Specifications: </span>
                      <span className="text-xs text-slate-600 dark:text-slate-300">{part.specifications}</span>
                    </div>
                  )}
                  {part.suggested_suppliers?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Suppliers: </span>
                      <span className="text-xs text-slate-600 dark:text-slate-300">{part.suggested_suppliers.join(', ')}</span>
                    </div>
                  )}
                  {part.order_url && (
                    <div>
                      <a href={part.order_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Order link
                      </a>
                    </div>
                  )}
                  {part.notes && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Notes: </span>
                      <span className="text-xs text-slate-600 dark:text-slate-300">{part.notes}</span>
                    </div>
                  )}
                  {part.compatibility_group_names?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Compat groups: </span>
                      <span className="text-xs text-slate-600 dark:text-slate-300">{part.compatibility_group_names.join(', ')}</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Diagrams</span>
                      <UploadDiagramButton onUpload={(f) => handleUploadPartDiagram(part.id, f)} loading={uploadingDiagramFor === part.id} />
                    </div>
                    <DiagramList
                      urls={part.diagram_urls}
                      onDelete={(url) => handleDeletePartDiagram(part.id, url)}
                    />
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
              For: <span className="font-mono text-blue-600 dark:text-blue-400">{part.part_number}</span> — {part.name}
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
                            <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">{p.part_number}</span>
                            <span className="text-sm text-slate-700 dark:text-slate-200">{p.name}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {p.brand_name} {p.model_names?.length > 0 ? `— ${p.model_names.join(', ')}` : ''}
                          </div>
                          {p.suggested_suppliers?.length > 0 && (
                            <div className="text-xs text-slate-400 mt-0.5">{p.suggested_suppliers.join(', ')}</div>
                          )}
                          {p.order_url && (
                            <a href={p.order_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 mt-0.5">
                              <span className="material-symbols-outlined text-xs">open_in_new</span> Order link
                            </a>
                          )}
                        </div>
                        {p.suggested_price != null && (
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex-shrink-0">${p.suggested_price.toFixed(2)}</span>
                        )}
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
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
        <button onClick={onBack} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Brands</button>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-slate-800 dark:text-slate-100 font-medium">{brand.name}</span>
        {brand.short_code && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">{brand.short_code}</span>}
      </div>

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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {models.map(model => (
            <div
              key={model.id}
              className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer group"
              onClick={() => onSelectModel(model)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{model.name}</span>
                    {model.discontinued && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">Discontinued</span>
                    )}
                  </div>
                  {model.category && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{model.category}</p>}
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

  const handleDelete = async () => {
    try {
      await partsLibraryAPI.deleteCompatGroup(confirmDelete.id);
      setGroups(g => g.filter(x => x.id !== confirmDelete.id));
      toast('success', 'Group removed');
    } catch {
      toast('error', 'Failed to remove group');
    }
    setConfirmDelete(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg sm:mx-4 border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Compatibility Groups</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Parts in the same group are interchangeable across brands</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <button
            onClick={() => { setEditingGroup(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors mb-4"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Group
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">progress_activity</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No compatibility groups yet</div>
          ) : (
            <div className="space-y-2">
              {groups.map(g => (
                <div key={g.id} className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400 mt-0.5">link</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{g.name}</p>
                    {g.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{g.description}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">{g.part_count ?? 0} parts</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
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

function GlobalSearchView({ onSelectPart, onClose }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [compatibleFor, setCompatibleFor] = useState(null);
  const [compatData, setCompatData] = useState(null);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await partsLibraryAPI.search(query.trim());
        setResults(data);
      } catch {
        toast('error', 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleShowCompat = async (part) => {
    try {
      const data = await partsLibraryAPI.getCompatibleParts(part.id);
      setCompatData(data);
      setCompatibleFor(part);
    } catch {
      toast('error', 'Failed to load compatible parts');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-16 px-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 max-h-[80vh] flex flex-col">
        <div className="p-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <span className="material-symbols-outlined text-slate-400">search</span>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by part number, name, category…"
            className="flex-1 bg-transparent text-slate-800 dark:text-slate-100 text-sm focus:outline-none placeholder-slate-400"
          />
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-slate-400 text-3xl">progress_activity</span>
            </div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No parts found for "{query}"</div>
          )}
          {!loading && results.length > 0 && (
            <div className="space-y-2">
              {results.map(part => (
                <div key={part.id} className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <span className="material-symbols-outlined text-slate-400 mt-0.5">settings</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">{part.part_number}</span>
                      {part.ref_number && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">#{part.ref_number}</span>}
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{part.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {part.brand_name} {part.model_names?.length > 0 ? `— ${part.model_names.join(', ')}` : ''}
                      {part.category ? ` · ${part.category}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {part.suggested_price != null && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">${part.suggested_price.toFixed(2)}</span>
                    )}
                    {part.compatibility_group_ids?.length > 0 && (
                      <button
                        onClick={() => handleShowCompat(part)}
                        className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        title="View cross-compatible parts"
                      >
                        <span className="material-symbols-outlined text-sm">swap_horiz</span>
                      </button>
                    )}
                    {onSelectPart && (
                      <button
                        onClick={() => { onSelectPart(part); onClose(); }}
                        className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                      >
                        Use
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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

// ─── Main PartsLibraryTab ─────────────────────────────────────────────────────

export default function PartsLibraryTab() {
  const toast = useToast();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compatGroups, setCompatGroups] = useState([]);

  // Navigation state: null=brands list, {brand}=models view, {brand,model}=parts view
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  // Modals
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showCompatGroups, setShowCompatGroups] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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

  // Drill-down: show parts for a model
  if (selectedModel) {
    return (
      <PartsView
        model={selectedModel}
        compatGroups={compatGroups}
        onBack={() => setSelectedModel(null)}
      />
    );
  }

  // Drill-down: show models for a brand
  if (selectedBrand) {
    return (
      <ModelsView
        brand={selectedBrand}
        compatGroups={compatGroups}
        onBack={() => setSelectedBrand(null)}
        onSelectModel={setSelectedModel}
      />
    );
  }

  // Top level: brands grid
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">inventory_2</span>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Parts Library</h2>
          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{brands.length} brands</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">search</span>
            Search Parts
          </button>
          <button
            onClick={() => setShowCompatGroups(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">link</span>
            Compat Groups
            {compatGroups.length > 0 && (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">{compatGroups.length}</span>
            )}
          </button>
          <button
            onClick={() => { setEditingBrand(null); setShowBrandForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Brand
          </button>
        </div>
      </div>

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
                    <p className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{brand.name}</p>
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

      {showBrandForm && (
        <BrandFormModal
          brand={editingBrand}
          onClose={() => { setShowBrandForm(false); setEditingBrand(null); }}
          onSaved={(saved) => {
            if (editingBrand) {
              setBrands(b => b.map(x => x.id === saved.id ? saved : x));
            } else {
              setBrands(b => [...b, saved]);
            }
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

      {showSearch && (
        <GlobalSearchView
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
