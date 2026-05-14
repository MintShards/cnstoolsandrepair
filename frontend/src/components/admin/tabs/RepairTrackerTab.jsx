import { useState, useEffect } from 'react';
import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';
import { serviceAgreementAPI } from '../../../services/api';

export default function RepairTrackerTab() {
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await serviceAgreementAPI.get();
        setFormData(data);
      } catch (error) {
        console.error('Failed to fetch service agreement:', error);
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
      await serviceAgreementAPI.update(formData);
      showNotification('Service agreement saved successfully!', 'success');
    } catch (error) {
      showNotification('Failed to save service agreement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSectionTitle = (sIdx, value) => {
    setFormData((prev) => {
      const sections = prev.sections.map((s, i) =>
        i === sIdx ? { ...s, title: value } : s
      );
      return { ...prev, sections };
    });
  };

  const updateItem = (sIdx, iIdx, value) => {
    setFormData((prev) => {
      const sections = prev.sections.map((s, si) => {
        if (si !== sIdx) return s;
        const items = s.items.map((item, ii) =>
          ii === iIdx ? { text: value } : item
        );
        return { ...s, items };
      });
      return { ...prev, sections };
    });
  };

  const addItem = (sIdx) => {
    setFormData((prev) => {
      const sections = prev.sections.map((s, si) => {
        if (si !== sIdx) return s;
        return { ...s, items: [...s.items, { text: '' }] };
      });
      return { ...prev, sections };
    });
  };

  const removeItem = (sIdx, iIdx) => {
    setFormData((prev) => {
      const sections = prev.sections.map((s, si) => {
        if (si !== sIdx) return s;
        return { ...s, items: s.items.filter((_, ii) => ii !== iIdx) };
      });
      return { ...prev, sections };
    });
  };

  const addSection = () => {
    setFormData((prev) => ({
      ...prev,
      sections: [...prev.sections, { title: 'New Section', items: [{ text: '' }] }],
    }));
  };

  const removeSection = (sIdx) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== sIdx),
    }));
  };

  if (!formData) {
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
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Repair Tracker Settings</h2>
          <p className="text-sm text-slate-400 mt-1">Edit the Service Agreement that prints on every work order.</p>
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

      {/* Info box */}
      <div className="flex gap-3 p-4 bg-blue-900/20 border border-blue-800 rounded-xl text-sm text-blue-300">
        <span className="material-symbols-outlined text-base flex-shrink-0 mt-0.5">info</span>
        <span>These terms appear at the bottom of every printed work order under <strong>Service Agreement</strong>. Changes take effect on the next print — no restart needed.</span>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {formData.sections.map((section, sIdx) => (
          <div key={sIdx} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
            {/* Section header */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <AdminInput
                  label="Section Title"
                  value={section.title}
                  onChange={(v) => updateSectionTitle(sIdx, v)}
                  placeholder="e.g. Warranty Coverage"
                />
              </div>
              {formData.sections.length > 1 && (
                <button
                  onClick={() => removeSection(sIdx)}
                  className="mt-6 flex items-center gap-1 px-3 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg text-xs font-bold transition-colors flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Remove Section
                </button>
              )}
            </div>

            {/* Items */}
            <div className="space-y-3">
              {section.items.map((item, iIdx) => (
                <div key={iIdx} className="flex items-start gap-2">
                  <span className="w-6 h-6 bg-slate-700 text-slate-300 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 mt-6">{iIdx + 1}</span>
                  <div className="flex-1">
                    <AdminTextarea
                      label=""
                      value={item.text}
                      onChange={(v) => updateItem(sIdx, iIdx, v)}
                      placeholder="Enter term or condition…"
                      rows={2}
                    />
                  </div>
                  {section.items.length > 1 && (
                    <button
                      onClick={() => removeItem(sIdx, iIdx)}
                      className="mt-6 p-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors flex-shrink-0"
                      title="Remove item"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add item */}
            <button
              onClick={() => addItem(sIdx)}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              Add Item
            </button>
          </div>
        ))}
      </div>

      {/* Add section */}
      <button
        onClick={addSection}
        className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-600 hover:border-primary text-slate-400 hover:text-primary rounded-xl text-sm font-bold transition-colors w-full justify-center"
      >
        <span className="material-symbols-outlined text-base">add</span>
        Add Section
      </button>

      {/* Save (bottom) */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-base">{saving ? 'refresh' : 'save'}</span>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
