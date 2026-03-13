import { useState, useEffect } from 'react';
import { industriesContentAPI } from '../../../services/api';
import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';

export default function IndustriesTab() {
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [expandedIndustries, setExpandedIndustries] = useState(new Set());

  // Load current industries content
  useEffect(() => {
    const fetchIndustriesContent = async () => {
      try {
        const data = await industriesContentAPI.get();
        setFormData(data);
      } catch (error) {
        console.error('Failed to fetch industries content:', error);
        showNotification('Failed to load industries content: ' + error.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchIndustriesContent();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);

    try {
      await industriesContentAPI.update(formData);
      showNotification('Industries page content saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save industries content:', error);
      showNotification('Failed to save: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const updateField = (path, value) => {
    const keys = path.split('.');
    setFormData((prev) => {
      const newData = { ...prev };
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  // Industry management functions
  const addIndustry = () => {
    setFormData((prev) => {
      const newIndex = prev.industries.length;
      // Auto-expand the new industry
      setExpandedIndustries(prevExpanded => {
        const newSet = new Set(prevExpanded);
        newSet.add(newIndex);
        return newSet;
      });

      return {
        ...prev,
        industries: [
          ...prev.industries,
          {
            name: '',
            description: '',
            icon: 'business',
            toolBadges: [],
            display_order: newIndex,
          },
        ],
      };
    });
  };

  const removeIndustry = (index) => {
    setFormData((prev) => ({
      ...prev,
      industries: prev.industries.filter((_, i) => i !== index),
    }));
  };

  const updateIndustry = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      industries: prev.industries.map((industry, i) =>
        i === index ? { ...industry, [field]: value } : industry
      ),
    }));
  };

  const toggleIndustry = (index) => {
    setExpandedIndustries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleAddIndustry = () => {
    const newIndex = formData.industries.length;
    // Auto-expand the new industry
    setExpandedIndustries(prev => {
      const newSet = new Set(prev);
      newSet.add(newIndex);
      return newSet;
    });
    addIndustry();
  };

  // Tool badge management
  const addToolBadge = (industryIndex, badgeName) => {
    if (!badgeName.trim()) return;

    setFormData((prev) => ({
      ...prev,
      industries: prev.industries.map((industry, i) =>
        i === industryIndex
          ? {
              ...industry,
              toolBadges: [...(industry.toolBadges || []), badgeName.trim()],
            }
          : industry
      ),
    }));
  };

  const removeToolBadge = (industryIndex, badgeIndex) => {
    setFormData((prev) => ({
      ...prev,
      industries: prev.industries.map((industry, i) =>
        i === industryIndex
          ? {
              ...industry,
              toolBadges: industry.toolBadges.filter((_, bi) => bi !== badgeIndex),
            }
          : industry
      ),
    }));
  };

  if (loading || !formData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
          <p className="text-slate-400 mt-4">Loading industries page content...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          Industries Page Content
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors"
        >
          {saving ? (
            <>
              <span className="material-symbols-outlined animate-spin text-base">refresh</span>
              Saving...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">save</span>
              Save All Changes
            </>
          )}
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'success'
              ? 'bg-green-900/20 border-green-700 text-green-300'
              : 'bg-red-900/20 border-red-700 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p className="font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">
        Hero Section
      </h3>
      <div className="grid grid-cols-1 gap-6 mb-8">
        <AdminInput
          label="Label"
          value={formData.hero.label}
          onChange={(v) => updateField('hero.label', v)}
          required
          maxLength={100}
          helperText="Small label above heading (e.g., 'Who We Serve')"
        />
        <AdminInput
          label="Heading"
          value={formData.hero.heading}
          onChange={(v) => updateField('hero.heading', v)}
          required
          maxLength={200}
          helperText="Main heading shown on industries page"
        />
        <AdminTextarea
          label="Description"
          value={formData.hero.description}
          onChange={(v) => updateField('hero.description', v)}
          required
          maxLength={500}
          rows={3}
          helperText="Description text below heading"
        />
      </div>

      {/* Industries Section */}
      <div className="flex items-center justify-between mb-6 pt-8 border-t border-slate-700">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">
            Industries List
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Industries displayed on the Industries page with tool badges.
          </p>
        </div>
        <button
          onClick={handleAddIndustry}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          Add Industry
        </button>
      </div>

      <div className="space-y-3">
        {formData.industries.map((industry, index) => {
          const isExpanded = expandedIndustries.has(index);

          return (
            <div key={index} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-all">
              {/* Collapsed Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => toggleIndustry(index)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="text-slate-400 font-bold text-sm whitespace-nowrap">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-bold truncate">
                      {industry.name || 'Untitled Industry'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeIndustry(index);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-400 font-bold rounded-lg transition-colors text-sm"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    Delete
                  </button>
                  <span className="material-symbols-outlined text-slate-400 transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    expand_more
                  </span>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-6 pt-4 border-t border-slate-700">
                  <div className="space-y-4">
                    <AdminInput
                      label="Industry Name"
                      value={industry.name}
                      onChange={(v) => updateIndustry(index, 'name', v)}
                      required
                      maxLength={100}
                      placeholder="Automotive Repair & Body Shops"
                    />
                    <AdminTextarea
                      label="Description"
                      value={industry.description}
                      onChange={(v) => updateIndustry(index, 'description', v)}
                      required
                      maxLength={500}
                      rows={3}
                      placeholder="Professional pneumatic tool repair for..."
                    />
                    <AdminInput
                      label="Icon (Material Symbol name)"
                      value={industry.icon}
                      onChange={(v) => updateIndustry(index, 'icon', v)}
                      required
                      maxLength={50}
                      placeholder="directions_car"
                      helperText="See: fonts.google.com/icons"
                    />

                    {/* Tool Badges */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">
                        Tool Badges
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {industry.toolBadges && industry.toolBadges.length > 0 ? (
                          industry.toolBadges.map((badge, badgeIndex) => (
                            <span
                              key={badgeIndex}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-white rounded-lg border border-slate-600"
                            >
                              <span className="text-sm font-medium">{badge}</span>
                              <button
                                type="button"
                                onClick={() => removeToolBadge(index, badgeIndex)}
                                className="hover:text-red-400 transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">close</span>
                              </button>
                            </span>
                          ))
                        ) : (
                          <p className="text-slate-500 text-sm">No tool badges added yet.</p>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Type tool name and press Enter"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addToolBadge(index, e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <p className="text-xs text-slate-500 mt-1.5">
                        Tool types associated with this industry (e.g., "Impact Wrenches", "Grinders")
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {formData.industries.length === 0 && (
        <div className="p-8 text-center bg-slate-800 rounded-lg border border-slate-700">
          <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">
            business
          </span>
          <p className="text-slate-400 mb-2">No industries added yet.</p>
          <p className="text-sm text-slate-500">Click "Add Industry" to create your first industry.</p>
        </div>
      )}

      {/* Save All Changes Button at Bottom */}
      <div className="flex gap-4 mt-8 pt-6 border-t border-slate-800">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black rounded-xl transition-colors uppercase"
        >
          {saving ? (
            <>
              <span className="material-symbols-outlined animate-spin">refresh</span>
              Saving...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">save</span>
              Save All Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
