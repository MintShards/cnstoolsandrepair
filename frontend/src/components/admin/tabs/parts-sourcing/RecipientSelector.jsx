import { useState } from 'react';

export default function RecipientSelector({ suppliers, recipients, onChange }) {
  const [adHocEmail, setAdHocEmail] = useState('');
  const [adHocName, setAdHocName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suppliersWithEmail = suppliers.filter((s) => s.email);

  const emailSuggestions = adHocEmail.trim().length > 0
    ? suppliersWithEmail.filter((s) => {
        if (recipients.some((r) => r.email === s.email)) return false;
        const q = adHocEmail.trim().toLowerCase();
        return s.email.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q);
      })
    : [];

  const selectSuggestion = (supplier) => {
    onChange([...recipients, { email: supplier.email, name: supplier.name, supplier_id: supplier.id }]);
    setAdHocEmail('');
    setAdHocName('');
    setShowSuggestions(false);
  };

  const allTags = [...new Set(suppliers.flatMap((s) => s.tags || []))].sort();

  const getTagState = (tag) => {
    const tagSuppliers = suppliersWithEmail.filter((s) => (s.tags || []).includes(tag));
    if (tagSuppliers.length === 0) return 'none';
    const selectedCount = tagSuppliers.filter((s) => recipients.some((r) => r.email === s.email)).length;
    if (selectedCount === 0) return 'inactive';
    if (selectedCount === tagSuppliers.length) return 'active';
    return 'partial';
  };

  const toggleTag = (tag) => {
    const tagSuppliers = suppliersWithEmail.filter((s) => (s.tags || []).includes(tag));
    const state = getTagState(tag);
    if (state === 'active') {
      // Remove all suppliers with this tag
      onChange(recipients.filter((r) => !tagSuppliers.some((s) => s.email === r.email)));
    } else {
      // Add all suppliers with this tag that aren't already selected
      const toAdd = tagSuppliers
        .filter((s) => !recipients.some((r) => r.email === s.email))
        .map((s) => ({ email: s.email, name: s.name, supplier_id: s.id }));
      onChange([...recipients, ...toAdd]);
    }
  };

  const addAdHoc = () => {
    const email = adHocEmail.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    if (recipients.some((r) => r.email === email)) return;
    onChange([...recipients, { email, name: adHocName.trim() || null, supplier_id: null }]);
    setAdHocEmail('');
    setAdHocName('');
  };

  const removeRecipient = (email) => {
    onChange(recipients.filter((r) => r.email !== email));
  };

  return (
    <div className="space-y-4">
      {/* Quick add by tag */}
      {allTags.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Quick add by tag:</p>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const state = getTagState(tag);
              if (state === 'none') return null;
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                    state === 'active'
                      ? 'bg-primary text-white border-primary'
                      : state === 'partial'
                      ? 'bg-primary/10 text-primary border-primary/50'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {state === 'active' && <span className="material-symbols-outlined text-xs">check</span>}
                  {state === 'partial' && <span className="material-symbols-outlined text-xs">remove</span>}
                  <span className="material-symbols-outlined text-xs">label</span>
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search or add recipient */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-[2] min-w-0 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Search or add recipient</label>
          <input
            type="email"
            placeholder="supplier@example.com"
            value={adHocEmail}
            onChange={(e) => { setAdHocEmail(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => e.key === 'Enter' && addAdHoc()}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:outline-none"
          />
          {showSuggestions && emailSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {emailSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => selectSuggestion(s)}
                  className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 border-b last:border-b-0 border-slate-100 dark:border-slate-700 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{s.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{s.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Name (optional)</label>
          <input
            type="text"
            placeholder="Contact name"
            value={adHocName}
            onChange={(e) => setAdHocName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAdHoc()}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:outline-none"
          />
        </div>
        <button
          onClick={addAdHoc}
          disabled={!adHocEmail.trim()}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-white text-sm rounded-lg transition-colors"
        >
          Add
        </button>
      </div>

      {/* Selected recipients */}
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          {recipients.length > 0
            ? `Will send to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}:`
            : 'No recipients selected'}
        </p>
        {recipients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recipients.map((r) => (
              <div
                key={r.email}
                className="flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-full text-sm max-w-full"
              >
                <span className="truncate">{r.name ? `${r.name} (${r.email})` : r.email}</span>
                <button
                  onClick={() => removeRecipient(r.email)}
                  className="text-primary/60 hover:text-red-400 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
