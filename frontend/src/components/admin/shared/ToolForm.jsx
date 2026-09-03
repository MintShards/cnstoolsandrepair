import { useState, useEffect, useRef } from 'react';
import { suppliersAPI, staffAPI, partsLibraryAPI } from '../../../services/api';
import { getTodayPacific } from '../../../utils/dateFormat';

// Shared blank-tool factory used by the WO dialog's Add Tool and the New Job wizard
const EMPTY_TOOL_BASE = {
  tool_type: '', brand: '', model_number: '', serial_number: '',
  quantity: 1, remarks: '', parts: [{ name: '', part_number: '', quantity: 1, price: '', supplier: '', order_link: '', notes: '', status: 'pending', tracking: '', eta: '' }],
  labour_hours: '', hourly_rate: '', priority: 'standard', warranty: false,
  zoho_ref: '', assigned_technician: '', estimated_completion: '',
  included_items: [], rod_length_received: '', rod_length_cut: '', rod_length_remaining: '',
  camera_head_serial: '', controller_serial: '',
  counter_at_intake: '', counter_after_repair: '',
  intake_condition: [],
  _pendingPhotos: [], // File objects staged during wizard — never sent to API
};

// What typically ships with a Hathorn camera system. The intake checklist
// exists so what goes back to the customer is never a memory contest.
export const HATHORN_INCLUDED_OPTIONS = [
  'Power Cord', 'Controller', 'Patch Cable', 'Battery', 'Battery Charger',
  'SD Card', 'USB Drive', 'Carrying Case', 'Skids / Guides', 'Manual',
];

// Power-on condition observed at intake — the answer to "it worked fine
// before you had it" is written down before the bench touches it. The bump
// test (tap the head, watch for image flicker) catches intermittents that a
// static check misses.
export const HATHORN_CONDITION_OPTIONS = [
  'Powers On', 'No Power', 'Image OK', 'Image Cloudy', 'No Image',
  'Bump Test OK', 'Bump Test Fails',
  'LEDs OK', 'LEDs Dim / Dead', 'Sonde Transmits', 'Sonde Dead',
  'Odometer Works', 'Odometer Faulty',
];

// Multi-select dropdown with checkbox rows, a free-text "other" entry and
// removable chips — used for the Hathorn included/condition checklists.
function ChecklistDropdown({ label, options, value = [], onChange, emptyText, inputCls }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const toggleItem = (item) => {
    const exists = value.some((i) => i.toLowerCase() === item.toLowerCase());
    onChange(exists ? value.filter((i) => i.toLowerCase() !== item.toLowerCase()) : [...value, item]);
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!value.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setCustom('');
  };

  return (
    <div className="relative">
      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      <button type="button"
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className={`${inputCls} flex items-center justify-between text-left`}>
        <span className={value.length ? '' : 'text-slate-400 dark:text-slate-500'}>
          {value.length ? `${value.length} item${value.length !== 1 ? 's' : ''} recorded` : emptyText}
        </span>
        <span className="material-symbols-outlined text-slate-400">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {options.map((item) => {
            const checked = value.some((i) => i.toLowerCase() === item.toLowerCase());
            return (
              <button key={item} type="button"
                onMouseDown={(e) => { e.preventDefault(); toggleItem(item); }}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700 transition-colors">
                <span className={`material-symbols-outlined text-lg ${checked ? 'text-primary' : 'text-slate-300 dark:text-slate-600'}`}>
                  {checked ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <span className="text-slate-800 dark:text-slate-100">{item}</span>
              </button>
            );
          })}
          <div className="flex gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/50"
            onMouseDown={(e) => e.preventDefault() /* keep the panel open */}>
            <input value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              placeholder="Other item…"
              className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); addCustom(); }}
              className="px-3 py-1.5 bg-primary text-white rounded text-sm font-bold hover:bg-blue-600 transition-colors">
              Add
            </button>
          </div>
        </div>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((item) => (
            <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">
              {item}
              <button type="button" onClick={() => toggleItem(item)}
                className="text-slate-400 hover:text-red-500 transition-colors" title={`Remove ${item}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const getEmptyTool = () => ({
  ...EMPTY_TOOL_BASE,
  date_received: getTodayPacific(),
});

// Silently save new parts to the Parts Library (fire-and-forget)
export const syncPartsToLibrary = async (tools) => {
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

// ── TOOL FORM (reusable for new job form and add tool modal) ──
// wizardStep: 2 = Tool Identification + Photos, 3 = Job Details + Parts, 4 = Labour & Scheduling
// Omit wizardStep (or isNewJobForm=false) to render all sections (add tool modal / edit mode)
export default function ToolForm({ toolData, onChange, isNewJobForm, wizardStep, idx, newJobForm, setNewJobForm }) {
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

  // Technician dropdown: real shop accounts (admin/staff/technician), the
  // same people the Workspace assigns tasks to — replaced the old standalone
  // technicians directory, which was a second hand-typed list that couldn't
  // stay in sync with Users & Accounts.
  const [technicians, setTechnicians] = useState([]);

  useEffect(() => {
    staffAPI.list()
      .then((accounts) => setTechnicians(
        accounts
          .filter((a) => a.is_active)
          .map((a) => a.name)
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      ))
      .catch(() => {});
  }, []);

  // Library brands/models for tool identification dropdowns
  const [libraryBrands, setLibraryBrands] = useState([]);
  const [libraryModels, setLibraryModels] = useState([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const isHathorn = /hathorn/i.test(toolData.brand || '');

  // Rod lengths: remaining auto-fills from received − cut, but stays editable
  // because the tech re-measures the finished rod anyway.
  const handleRodChange = (field, value) => {
    const updates = { [field]: value };
    if (field === 'rod_length_received' || field === 'rod_length_cut') {
      const received = parseFloat(field === 'rod_length_received' ? value : toolData.rod_length_received);
      const cut = parseFloat(field === 'rod_length_cut' ? value : toolData.rod_length_cut);
      if (!isNaN(received) && !isNaN(cut)) {
        updates.rod_length_remaining = String(Math.max(0, Math.round((received - cut) * 10) / 10));
      }
    }
    handleChange(updates);
  };

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

            {/* Hathorn camera intake — only when the brand says so */}
            {isHathorn && (
              <div className="md:col-span-2 p-4 bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-lg space-y-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                  Hathorn Camera Intake
                </p>

                {/* Component serial numbers — the reel's serial lives in the
                    main Serial Number field above */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Camera Head S/N</label>
                    <input value={data.camera_head_serial || ''}
                      onChange={(e) => { const pos = e.target.selectionStart; handleChange('camera_head_serial', e.target.value.toUpperCase()); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                      placeholder="Optional" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Controller S/N</label>
                    <input value={data.controller_serial || ''}
                      onChange={(e) => { const pos = e.target.selectionStart; handleChange('controller_serial', e.target.value.toUpperCase()); requestAnimationFrame(() => e.target.setSelectionRange(pos, pos)); }}
                      placeholder="Optional" className={inputCls} />
                  </div>
                </div>

                <ChecklistDropdown
                  label="Included With Unit"
                  options={HATHORN_INCLUDED_OPTIONS}
                  value={data.included_items || []}
                  onChange={(items) => handleChange('included_items', items)}
                  emptyText="Select what came with the unit…"
                  inputCls={inputCls}
                />

                <ChecklistDropdown
                  label="Condition At Intake"
                  options={HATHORN_CONDITION_OPTIONS}
                  value={data.intake_condition || []}
                  onChange={(items) => handleChange('intake_condition', items)}
                  emptyText="Record the power-on check…"
                  inputCls={inputCls}
                />

                {/* Footage odometer — training calls it that, so the label does
                    too (the API field is still counter_at_intake underneath) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Odometer At Intake (ft)</label>
                    <input type="number" min="0" step="1" value={data.counter_at_intake ?? ''}
                      onChange={(e) => handleChange('counter_at_intake', e.target.value)}
                      placeholder="e.g., 1240" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Odometer After Repair (ft)</label>
                    <input type="number" min="0" step="1" value={data.counter_after_repair ?? ''}
                      onChange={(e) => handleChange('counter_after_repair', e.target.value)}
                      placeholder="After recalibration" className={inputCls} />
                  </div>
                </div>

                {/* Pushrod lengths */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Rod Length Received (ft)</label>
                    <input type="number" min="0" step="0.1" value={data.rod_length_received ?? ''}
                      onChange={(e) => handleRodChange('rod_length_received', e.target.value)}
                      placeholder="e.g., 200" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Rod Cut Off (ft)</label>
                    <input type="number" min="0" step="0.1" value={data.rod_length_cut ?? ''}
                      onChange={(e) => handleRodChange('rod_length_cut', e.target.value)}
                      placeholder="e.g., 15" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1.5">Rod Remaining (ft)</label>
                    <input type="number" min="0" step="0.1" value={data.rod_length_remaining ?? ''}
                      onChange={(e) => handleChange('rod_length_remaining', e.target.value)}
                      placeholder="Auto" className={inputCls} />
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Auto-calculated — adjust if re-measured</p>
                  </div>
                </div>
              </div>
            )}
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
                      <span className="font-medium">{`${sp.name}${sp.part_number ? ` - ${sp.part_number}` : ''}`.toUpperCase()}</span>
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
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{`${s.name}${s.part_number ? ` - ${s.part_number}` : ''}`.toUpperCase()}</span>
                                {s.model_names?.length > 0 && <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate hidden sm:inline max-w-[180px]">{s.model_names.join(', ').toUpperCase()}</span>}
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
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{`${s.name}${s.part_number ? ` - ${s.part_number}` : ''}`.toUpperCase()}</span>
                                {s.model_names?.length > 0 && <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate hidden sm:inline max-w-[180px]">{s.model_names.join(', ').toUpperCase()}</span>}
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
              <select value={data.assigned_technician || ''} onChange={(e) => handleChange('assigned_technician', e.target.value)}
                className="w-full px-3 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base focus:outline-none focus:border-primary">
                <option value="">Unassigned</option>
                {/* A name assigned before this dropdown keyed on accounts (or
                    from a since-deactivated account) stays selectable so
                    opening the form never silently clears the assignment. */}
                {data.assigned_technician && !technicians.includes(data.assigned_technician) && (
                  <option value={data.assigned_technician}>{data.assigned_technician}</option>
                )}
                {technicians.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">People come from Users &amp; Accounts</p>
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
