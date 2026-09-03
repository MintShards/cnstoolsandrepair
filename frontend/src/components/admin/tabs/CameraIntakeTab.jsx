import { useState, useEffect } from 'react';
import { cameraIntakeAPI } from '../../../services/api';
import { CAMERA_INTAKE_DEFAULTS, clearCameraIntakeConfigCache } from '../../../utils/cameraIntake';

// Admin Settings → Camera Intake. Edits the three option lists the Hathorn
// camera suite renders in the Repair Tracker's tool form — Included With
// Unit, Condition At Intake, and the Final Test Checklist — so wording
// changes from training don't need a code change. The Final Test list is
// also what the backend's Ready gate enforces.

function ListEditor({ title, icon, hint, items, onChange, addPlaceholder }) {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    onChange([...items, v]);
    setDraft('');
  };

  const updateItem = (idx, value) => {
    const next = [...items];
    next[idx] = value;
    onChange(next);
  };

  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));

  const moveItem = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-white uppercase tracking-tight">
            <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
            {title}
            <span className="text-slate-500 font-bold normal-case tracking-normal">({items.length})</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...CAMERA_INTAKE_DEFAULTS[title === 'Included With Unit' ? 'included_options' : title === 'Condition At Intake' ? 'condition_options' : 'final_checklist']])}
          className="flex-shrink-0 text-[11px] font-bold text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 rounded-lg px-2.5 py-1.5 transition-colors"
        >
          Restore defaults
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(e) => updateItem(idx, e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:border-primary focus:outline-none"
            />
            <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Move up">
              <span className="material-symbols-outlined text-lg leading-none">keyboard_arrow_up</span>
            </button>
            <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Move down">
              <span className="material-symbols-outlined text-lg leading-none">keyboard_arrow_down</span>
            </button>
            <button type="button" onClick={() => removeItem(idx)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
              title="Remove">
              <span className="material-symbols-outlined text-lg leading-none">close</span>
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-slate-500 italic px-1">No items — the dropdown will only offer the free-text “Other” entry.</p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder={addPlaceholder}
          className="flex-1 min-w-0 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
        />
        <button type="button" onClick={addItem}
          className="flex items-center gap-1 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-colors">
          <span className="material-symbols-outlined text-base leading-none">add</span>
          Add
        </button>
      </div>
    </div>
  );
}

export default function CameraIntakeTab() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await cameraIntakeAPI.get();
        setConfig({
          included_options: data.included_options ?? [...CAMERA_INTAKE_DEFAULTS.included_options],
          condition_options: data.condition_options ?? [...CAMERA_INTAKE_DEFAULTS.condition_options],
          final_checklist: data.final_checklist ?? [...CAMERA_INTAKE_DEFAULTS.final_checklist],
        });
      } catch (error) {
        console.error('Failed to fetch camera intake config:', error);
        setConfig({ ...CAMERA_INTAKE_DEFAULTS });
      }
    };
    fetchData();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);
    try {
      const saved = await cameraIntakeAPI.update({
        included_options: config.included_options.map((i) => i.trim()).filter(Boolean),
        condition_options: config.condition_options.map((i) => i.trim()).filter(Boolean),
        final_checklist: config.final_checklist.map((i) => i.trim()).filter(Boolean),
      });
      setConfig({
        included_options: saved.included_options,
        condition_options: saved.condition_options,
        final_checklist: saved.final_checklist,
      });
      clearCameraIntakeConfigCache();
      showNotification('Camera intake lists saved — the tracker uses them immediately.', 'success');
    } catch {
      showNotification('Failed to save camera intake lists.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined text-5xl text-primary animate-spin">refresh</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Camera Intake</h2>
          <p className="text-sm text-slate-400 mt-1">
            The option lists the Repair Tracker shows for Hathorn camera systems.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-base">{saving ? 'refresh' : 'save'}</span>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold ${
          notification.type === 'success'
            ? 'bg-green-900/30 border border-green-700 text-green-300'
            : 'bg-red-900/30 border border-red-700 text-red-300'
        }`}>
          <span className="material-symbols-outlined text-base">
            {notification.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {notification.message}
        </div>
      )}

      <ListEditor
        title="Included With Unit"
        icon="inventory_2"
        hint="Accessories offered in the intake dropdown — what arrived with the unit. Techs can always type extras not listed here."
        items={config.included_options}
        onChange={(items) => setConfig((prev) => ({ ...prev, included_options: items }))}
        addPlaceholder="Add an accessory…"
      />

      <ListEditor
        title="Condition At Intake"
        icon="fact_check"
        hint="Power-on observations offered at intake — what the unit did (or didn't do) before the bench touched it."
        items={config.condition_options}
        onChange={(items) => setConfig((prev) => ({ ...prev, condition_options: items }))}
        addPlaceholder="Add a condition…"
      />

      <div className="space-y-3">
        <ListEditor
          title="Final Test Checklist"
          icon="rule"
          hint="Outgoing QC. A Hathorn tool cannot be marked Ready for pickup until every item here is ticked — enforced by the server the moment you save."
          items={config.final_checklist}
          onChange={(items) => setConfig((prev) => ({ ...prev, final_checklist: items }))}
          addPlaceholder="Add a final test…"
        />
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-900/20 border border-amber-800/60 rounded-lg">
          <span className="material-symbols-outlined text-amber-500 text-base flex-shrink-0">warning</span>
          <p className="text-[11px] text-amber-200/90">
            The Ready gate matches items by wording. Renaming an item here effectively unticks it on tools
            that checked the old wording — the renamed item must be ticked again before going Ready.
            Emptying this list turns the gate off entirely.
          </p>
        </div>
      </div>
    </div>
  );
}
