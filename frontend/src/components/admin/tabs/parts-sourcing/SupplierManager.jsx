import { useState, useEffect } from 'react';
import { suppliersAPI } from '../../../../services/api';
import PaginationBar from '../../shared/PaginationBar';

const EMPTY_FORM = { name: '', email: '', phone: '', contact_name: '', website: '', tags: '' };

const inputClass =
  'w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:outline-none [&:not(:placeholder-shown)]:uppercase';

export default function SupplierManager({ suppliers, onSuppliersChange }) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [showAddRow, setShowAddRow] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when suppliers list changes
  useEffect(() => {
    setPage(1);
  }, [suppliers.length]);

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const refresh = async () => {
    const fresh = await suppliersAPI.getAll();
    onSuppliersChange(fresh);
  };

  const handleAddClick = () => {
    setExpanded(true);
    setShowAddRow(true);
    setEditingId(null);
  };

  const parseTags = (raw) =>
    raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

  const handleAdd = async () => {
    if (!addForm.name.trim()) return showError('Supplier name is required.');
    setSaving(true);
    try {
      await suppliersAPI.create({
        name: addForm.name.trim(),
        email: addForm.email.trim() || null,
        phone: addForm.phone.trim() || null,
        contact_name: addForm.contact_name.trim() || null,
        website: addForm.website.trim() || null,
        tags: parseTags(addForm.tags),
      });
      await refresh();
      setAddForm(EMPTY_FORM);
      setShowAddRow(false);
    } catch (e) {
      showError(e?.response?.data?.detail || 'Failed to add supplier.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (supplier) => {
    setEditingId(supplier.id);
    setEditForm({
      name: supplier.name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      contact_name: supplier.contact_name || '',
      website: supplier.website || '',
      tags: (supplier.tags || []).join(', '),
    });
    setDeletingId(null);
    setShowAddRow(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) return showError('Supplier name is required.');
    setSaving(true);
    try {
      await suppliersAPI.update(editingId, {
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        contact_name: editForm.contact_name.trim() || null,
        website: editForm.website.trim() || null,
        tags: parseTags(editForm.tags),
      });
      await refresh();
      setEditingId(null);
      setEditForm(EMPTY_FORM);
    } catch (e) {
      showError(e?.response?.data?.detail || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setSaving(true);
    try {
      await suppliersAPI.remove(deletingId);
      await refresh();
      setDeletingId(null);
    } catch {
      showError('Failed to delete supplier.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e, saveFn, cancelFn) => {
    if (e.key === 'Enter') { e.preventDefault(); saveFn(); }
    if (e.key === 'Escape') cancelFn();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-base">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
          Manage suppliers
          {suppliers.length > 0 && (
            <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full font-semibold">
              {suppliers.length}
            </span>
          )}
        </button>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add supplier
        </button>
      </div>

      {/* Table */}
      {(expanded || showAddRow) && (
        <>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Company</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</th>
                <th className="hidden md:table-cell px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Phone</th>
                <th className="hidden lg:table-cell px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Contact</th>
                <th className="hidden lg:table-cell px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Website</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tags</th>
                <th className="px-1 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">

              {/* Empty state */}
              {suppliers.length === 0 && !showAddRow && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-xs text-slate-400 dark:text-slate-500 text-center">
                    No suppliers yet. Click &ldquo;Add supplier&rdquo; to get started.
                  </td>
                </tr>
              )}

              {suppliers.slice((page - 1) * pageSize, page * pageSize).map((s) => {
                if (deletingId === s.id) {
                  return (
                    <tr key={s.id} className="bg-red-50 dark:bg-red-900/10">
                      <td colSpan={7} className="px-3 py-2.5">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-slate-700 dark:text-slate-300">
                            Delete <span className="font-semibold">&ldquo;{s.name}&rdquo;</span>?
                          </span>
                          <button
                            onClick={handleDeleteConfirm}
                            disabled={saving}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold text-xs disabled:opacity-40"
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (editingId === s.id) {
                  return (
                    <tr key={s.id} className="bg-primary/5">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          onKeyDown={(e) => onKeyDown(e, handleSaveEdit, handleCancelEdit)}
                          placeholder="Company name *"
                          className={inputClass}
                          autoFocus
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          onKeyDown={(e) => onKeyDown(e, handleSaveEdit, handleCancelEdit)}
                          placeholder="email@example.com"
                          className={inputClass}
                        />
                      </td>
                      <td className="hidden md:table-cell px-3 py-2">
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          onKeyDown={(e) => onKeyDown(e, handleSaveEdit, handleCancelEdit)}
                          placeholder="604-555-5555"
                          className={inputClass}
                        />
                      </td>
                      <td className="hidden lg:table-cell px-3 py-2">
                        <input
                          type="text"
                          value={editForm.contact_name}
                          onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                          onKeyDown={(e) => onKeyDown(e, handleSaveEdit, handleCancelEdit)}
                          placeholder="Contact name"
                          className={inputClass}
                        />
                      </td>
                      <td className="hidden lg:table-cell px-3 py-2">
                        <input
                          type="text"
                          value={editForm.website}
                          onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                          onKeyDown={(e) => onKeyDown(e, handleSaveEdit, handleCancelEdit)}
                          placeholder="www.example.com"
                          className={inputClass}
                        />
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2">
                        <input
                          type="text"
                          value={editForm.tags}
                          onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                          onKeyDown={(e) => onKeyDown(e, handleSaveEdit, handleCancelEdit)}
                          placeholder="e.g. oem, bearings"
                          className={inputClass}
                          title="Comma-separated tags"
                        />
                      </td>
                      <td className="px-1 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="text-primary hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-40 transition-colors"
                            title="Save"
                          >
                            <span className="material-symbols-outlined text-base">check</span>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors"
                            title="Cancel"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Display row
                return (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white truncate uppercase">{s.name}</td>
                    <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 truncate lowercase">
                      {s.email
                        ? <a href={`mailto:${s.email}`} className="hover:text-primary transition-colors">{s.email}</a>
                        : <span className="text-slate-300 dark:text-slate-600">—</span>
                      }
                    </td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-slate-500 dark:text-slate-400 truncate">
                      {s.phone
                        ? s.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
                        : <span className="text-slate-300 dark:text-slate-600">—</span>
                      }
                    </td>
                    <td className="hidden lg:table-cell px-3 py-2.5 text-slate-500 dark:text-slate-400 truncate uppercase">
                      {s.contact_name || <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="hidden lg:table-cell px-3 py-2.5 text-slate-500 dark:text-slate-400 truncate lowercase">
                      {s.website
                        ? <a href={s.website} target="_blank" rel="noopener noreferrer" title={s.website} className="hover:text-primary transition-colors">{s.website.replace(/^https?:\/\//, '')}</a>
                        : <span className="text-slate-300 dark:text-slate-600">—</span>
                      }
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2.5">
                      {s.tags && s.tags.length > 0
                        ? (
                          <div className="flex flex-wrap gap-1">
                            {s.tags.map((tag) => (
                              <span key={tag} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-1.5 py-0.5 rounded-full uppercase">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )
                        : <span className="text-slate-300 dark:text-slate-600">—</span>
                      }
                    </td>
                    <td className="px-1 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleStartEdit(s)}
                          className="text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => { setDeletingId(s.id); setEditingId(null); }}
                          className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Add row */}
              {showAddRow && (
                <tr className="bg-primary/5">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      onKeyDown={(e) => onKeyDown(e, handleAdd, () => { setShowAddRow(false); setAddForm(EMPTY_FORM); })}
                      placeholder="Company name *"
                      className={inputClass}
                      autoFocus
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      onKeyDown={(e) => onKeyDown(e, handleAdd, () => { setShowAddRow(false); setAddForm(EMPTY_FORM); })}
                      placeholder="email@example.com"
                      className={inputClass}
                    />
                  </td>
                  <td className="hidden md:table-cell px-3 py-2">
                    <input
                      type="text"
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      onKeyDown={(e) => onKeyDown(e, handleAdd, () => { setShowAddRow(false); setAddForm(EMPTY_FORM); })}
                      placeholder="604-555-5555"
                      className={inputClass}
                    />
                  </td>
                  <td className="hidden lg:table-cell px-3 py-2">
                    <input
                      type="text"
                      value={addForm.contact_name}
                      onChange={(e) => setAddForm({ ...addForm, contact_name: e.target.value })}
                      onKeyDown={(e) => onKeyDown(e, handleAdd, () => { setShowAddRow(false); setAddForm(EMPTY_FORM); })}
                      placeholder="Contact name"
                      className={inputClass}
                    />
                  </td>
                  <td className="hidden lg:table-cell px-3 py-2">
                    <input
                      type="text"
                      value={addForm.website}
                      onChange={(e) => setAddForm({ ...addForm, website: e.target.value })}
                      onKeyDown={(e) => onKeyDown(e, handleAdd, () => { setShowAddRow(false); setAddForm(EMPTY_FORM); })}
                      placeholder="www.example.com"
                      className={inputClass}
                    />
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2">
                    <input
                      type="text"
                      value={addForm.tags}
                      onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
                      onKeyDown={(e) => onKeyDown(e, handleAdd, () => { setShowAddRow(false); setAddForm(EMPTY_FORM); })}
                      placeholder="e.g. oem, bearings"
                      className={inputClass}
                      title="Comma-separated tags"
                    />
                  </td>
                  <td className="px-1 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={handleAdd}
                        disabled={saving}
                        className="text-primary hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-40 transition-colors"
                        title="Add"
                      >
                        <span className="material-symbols-outlined text-base">check</span>
                      </button>
                      <button
                        onClick={() => { setShowAddRow(false); setAddForm(EMPTY_FORM); }}
                        className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors"
                        title="Cancel"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {suppliers.length > 0 && (
          <PaginationBar
            currentPage={page}
            totalItems={suppliers.length}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        )}
        </>
      )}

      {/* Inline error */}
      {error && (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
