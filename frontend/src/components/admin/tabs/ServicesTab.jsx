import { useState, useEffect } from 'react';
import { settingsAPI, toolsAPI } from '../../../services/api';
import { useSettings } from '../../../contexts/SettingsContext';
import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';

export default function ServicesTab() {
  const { refreshSettings } = useSettings();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [expandedServices, setExpandedServices] = useState(new Set());

  // Tools state
  const [tools, setTools] = useState([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [expandedTools, setExpandedTools] = useState(new Set());
  const [deletedToolIds, setDeletedToolIds] = useState([]);

  // Load current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingsAPI.get();
        setFormData(data);
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        showNotification('Failed to load services: ' + error.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Load tools catalog
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const data = await toolsAPI.list(true); // true = active only (exclude deleted)
        setTools(data);
      } catch (error) {
        console.error('Failed to fetch tools:', error);
        showNotification('Failed to load tools: ' + error.message, 'error');
      } finally {
        setLoadingTools(false);
      }
    };

    fetchTools();
  }, []);

  const handleSaveAll = async () => {
    setSaving(true);
    setNotification(null);

    try {
      // Save services (settings)
      await settingsAPI.update(formData);

      // Delete removed tools first
      for (const toolId of deletedToolIds) {
        try {
          await toolsAPI.delete(toolId);
        } catch (error) {
          console.error('Failed to delete tool:', error);
          // Continue with other deletions even if one fails
        }
      }
      // Clear deleted IDs after processing
      setDeletedToolIds([]);

      // Save tools - track original IDs before save
      const originalIds = new Set(tools.filter(t => t.id).map(t => t.id));
      let skippedTools = 0;
      const updatedTools = []; // Build updated tools list

      for (const tool of tools) {
        // Skip empty tools (not yet filled out)
        if (!tool.name || !tool.description) {
          if (!tool.id) {
            // Only count new empty tools as skipped
            skippedTools++;
          }
          continue; // Don't include empty tools
        }

        if (tool.id) {
          // Update existing tool
          await toolsAPI.update(tool.id, {
            name: tool.name,
            description: tool.description,
            category: tool.category,
            active: tool.active,
          });
          // Keep in local state with existing ID
          updatedTools.push(tool);
        } else {
          // Create new tool
          const created = await toolsAPI.create({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            active: tool.active,
          });
          // Add to local state with new ID from backend
          updatedTools.push(created);
        }
      }

      // Update local state directly (like services do) - no API re-fetch!
      setTools(updatedTools);

      // Auto-expand newly created tools (compare against original IDs)
      const newExpandedIndices = new Set();
      updatedTools.forEach((tool, index) => {
        // Check if this tool didn't exist before save (new ID not in original set)
        const wasNew = !originalIds.has(tool.id);
        if (wasNew) {
          newExpandedIndices.add(index);
        }
      });

      if (newExpandedIndices.size > 0) {
        setExpandedTools(newExpandedIndices);
      } else {
        // Clear expanded state if no new tools
        setExpandedTools(new Set());
      }

      // Refresh settings context AFTER tools save completes (prevents race condition)
      await refreshSettings();

      if (skippedTools > 0) {
        showNotification(`Changes saved! ${skippedTools} empty tool(s) were not saved.`, 'success');
      } else {
        showNotification('All changes saved successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      showNotification('Failed to save: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const toggleService = (index) => {
    setExpandedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const addService = () => {
    setFormData((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        { title: '', description: '', icon: 'build' },
      ],
    }));
  };

  const removeService = (index) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }));
  };

  const updateService = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.map((service, i) =>
        i === index ? { ...service, [field]: value } : service
      ),
    }));
  };

  const handleAddService = () => {
    const newIndex = formData.services.length;
    // Auto-expand the new service
    setExpandedServices(prev => {
      const newSet = new Set(prev);
      newSet.add(newIndex);
      return newSet;
    });
    addService();
  };

  // Tools management functions
  const toggleTool = (index) => {
    setExpandedTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const addTool = () => {
    setTools((prev) => [
      ...prev,
      {
        name: '',
        description: '',
        category: 'air_tools',
        active: true
      },
    ]);
  };

  const removeTool = (index) => {
    const tool = tools[index];

    if (tool.id) {
      // Track ID for deletion during save
      setDeletedToolIds((prev) => [...prev, tool.id]);
    }

    // Remove from local state immediately (like services)
    setTools((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTool = (index, field, value) => {
    setTools((prev) =>
      prev.map((tool, i) =>
        i === index ? { ...tool, [field]: value } : tool
      )
    );
  };

  const handleAddTool = () => {
    const newIndex = tools.length;
    // Auto-expand the new tool
    setExpandedTools(prev => {
      const newSet = new Set(prev);
      newSet.add(newIndex);
      return newSet;
    });
    addTool();
  };


  if (loading || !formData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
          <p className="text-slate-400 mt-4">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          Services Page Content
        </h2>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors"
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

      {/* Our Services */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">
            Our Services
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Main service offerings displayed at the top of the Services page.
          </p>
        </div>
        <button
          onClick={handleAddService}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          Add Service
        </button>
      </div>

      <div className="space-y-3">
        {formData.services.map((service, index) => {
          const isExpanded = expandedServices.has(index);

          return (
            <div key={index} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-all">
              {/* Collapsed Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => toggleService(index)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="text-slate-400 font-bold text-sm whitespace-nowrap">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-bold truncate">
                      {service.title || 'Untitled Service'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeService(index);
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
                      label="Title"
                      value={service.title}
                      onChange={(v) => updateService(index, 'title', v)}
                      required
                      maxLength={200}
                    />
                    <AdminTextarea
                      label="Description"
                      value={service.description}
                      onChange={(v) => updateService(index, 'description', v)}
                      required
                      maxLength={1000}
                      rows={3}
                    />
                    <AdminInput
                      label="Icon (Material Symbol name)"
                      value={service.icon}
                      onChange={(v) => updateService(index, 'icon', v)}
                      required
                      maxLength={50}
                      helperText="See: fonts.google.com/icons"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {formData.services.length === 0 && (
        <div className="p-8 text-center bg-slate-800 rounded-lg border border-slate-700">
          <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">
            build
          </span>
          <p className="text-slate-400 mb-2">No services added yet.</p>
          <p className="text-sm text-slate-500">Click "Add Service" to create your first service.</p>
        </div>
      )}

      {/* Tools We Repair */}
      <div className="flex items-center justify-between mb-6 mt-12 pt-8 border-t border-slate-700">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">
            Tools We Repair
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Tools catalog displayed in the "Tools We Repair" section on the Services page.
          </p>
        </div>
        <button
          onClick={handleAddTool}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          Add Tool
        </button>
      </div>

      {loadingTools ? (
        <div className="text-center py-20 bg-slate-800 rounded-lg border border-slate-700">
          <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
          <p className="mt-4 text-slate-400">Loading tools...</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {tools.map((tool, index) => {
              const isExpanded = expandedTools.has(index);

              return (
                <div key={index} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-all">
                  {/* Collapsed Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                    onClick={() => toggleTool(index)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className="text-slate-400 font-bold text-sm whitespace-nowrap">#{index + 1}</span>
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className="text-white font-bold truncate">
                          {tool.name || 'Untitled Tool'}
                        </span>
                        {tool.category && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${
                            tool.category === 'air_tools' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                            tool.category === 'electric_tools' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            {tool.category === 'air_tools' ? 'Air' :
                             tool.category === 'electric_tools' ? 'Electric' :
                             'Lifting'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTool(index);
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
                          label="Tool Name"
                          value={tool.name}
                          onChange={(v) => updateTool(index, 'name', v)}
                          required
                          maxLength={200}
                          placeholder="Impact Wrenches"
                        />

                        {/* Category Dropdown */}
                        <div>
                          <label className="block text-sm font-bold text-slate-300 mb-2">
                            Category <span className="text-red-400">*</span>
                          </label>
                          <select
                            value={tool.category || 'air_tools'}
                            onChange={(e) => updateTool(index, 'category', e.target.value)}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors font-medium"
                          >
                            <option value="air_tools">Air Tools (Pneumatic)</option>
                            <option value="electric_tools">Electric Tools</option>
                            <option value="lifting_equipment">Lifting Equipment</option>
                          </select>
                          <p className="text-xs text-slate-500 mt-1.5">
                            Category determines which column this tool appears in on the Services page.
                          </p>
                        </div>

                        <AdminTextarea
                          label="Description"
                          value={tool.description}
                          onChange={(v) => updateTool(index, 'description', v)}
                          required
                          maxLength={1000}
                          rows={3}
                          placeholder="High-torque pneumatic impact wrenches for heavy-duty applications..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {tools.length === 0 && (
            <div className="p-8 text-center bg-slate-800 rounded-lg border border-slate-700">
              <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">
                construction
              </span>
              <p className="text-slate-400 mb-2">No tools added yet.</p>
              <p className="text-sm text-slate-500">Click "Add Tool" to create your first tool.</p>
            </div>
          )}

        </>
      )}

      {/* Save All Changes Button at Bottom */}
      <div className="flex gap-4 mt-8 pt-6 border-t border-slate-800">
        <button
          onClick={handleSaveAll}
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
