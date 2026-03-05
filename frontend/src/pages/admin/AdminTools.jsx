import { useState, useEffect } from 'react';
import { toolsAPI } from '../../services/api';
import AdminLayout from '../../components/admin/AdminLayout';

export default function AdminTools() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const data = await toolsAPI.list(false); // Get all tools including inactive
      setTools(data);
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      showNotification('Failed to load tools: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const addTool = () => {
    const newTool = {
      id: `temp-${Date.now()}`, // Temporary ID for unsaved tool
      name: '',
      category: '',
      description: '',
      icon: 'build',
      image_url: 'placeholder-tool.jpg',
      display_order: tools.length,
      active: true,
      isNew: true,
    };
    setTools([...tools, newTool]);
  };

  const removeTool = async (tool) => {
    if (tool.isNew) {
      // Just remove from state if unsaved
      setTools(tools.filter((t) => t.id !== tool.id));
      return;
    }

    if (!window.confirm(`Permanently delete "${tool.name}"? This cannot be undone!`)) {
      return;
    }

    try {
      await toolsAPI.delete(tool.id, true); // true = permanent delete
      showNotification('Tool permanently deleted', 'success');
      await fetchTools();
    } catch (error) {
      console.error('Failed to delete tool:', error);
      showNotification('Failed to delete tool: ' + error.message, 'error');
    }
  };

  const updateTool = (id, field, value) => {
    setTools(
      tools.map((tool) =>
        tool.id === id ? { ...tool, [field]: value } : tool
      )
    );
  };

  const saveTool = async (tool) => {
    if (!tool.name.trim()) {
      showNotification('Tool name is required', 'error');
      return;
    }
    if (!tool.category.trim()) {
      showNotification('Category is required', 'error');
      return;
    }
    if (!tool.description.trim()) {
      showNotification('Description is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (tool.isNew) {
        // Create new tool
        const { id, isNew, ...toolData } = tool;
        await toolsAPI.create(toolData);
        showNotification('Tool created successfully!', 'success');
      } else {
        // Update existing tool
        const { id, ...toolData } = tool;
        await toolsAPI.update(id, toolData);
        showNotification('Tool updated successfully!', 'success');
      }
      await fetchTools();
    } catch (error) {
      console.error('Failed to save tool:', error);
      showNotification('Failed to save tool: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-primary animate-spin">
              refresh
            </span>
            <p className="text-slate-400 mt-4">Loading tools...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Tools Management">
      {/* Notification */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'success'
              ? 'bg-green-900/20 border-green-700 text-green-300'
              : notification.type === 'error'
              ? 'bg-red-900/20 border-red-700 text-red-300'
              : 'bg-blue-900/20 border-blue-700 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">
              {notification.type === 'success' ? 'check_circle' : 'info'}
            </span>
            <p className="font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Tools We Service
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {tools.filter(t => t.active).length} active tool{tools.filter(t => t.active).length !== 1 ? 's' : ''} • {tools.length} total
          </p>
        </div>
        <button
          onClick={addTool}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          Add Tool
        </button>
      </div>

      {/* Tools Grid */}
      {tools.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 rounded-lg border border-slate-800">
          <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">
            build
          </span>
          <p className="text-slate-400 mb-2">No tools added yet.</p>
          <p className="text-sm text-slate-500">
            Click "Add Tool" to create your first tool entry.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {tools
            .sort((a, b) => a.display_order - b.display_order)
            .map((tool) => (
              <div
                key={tool.id}
                className={`p-6 rounded-2xl border transition-all ${
                  tool.active
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-900/50 border-slate-800 opacity-60'
                } ${tool.isNew ? 'ring-2 ring-primary' : ''}`}
              >
                {/* Header with Actions */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* Icon Preview */}
                    <div className={`size-12 rounded-xl ${tool.active ? 'bg-primary/10' : 'bg-slate-800'} flex items-center justify-center`}>
                      <span
                        className={`material-symbols-outlined text-2xl ${tool.active ? 'text-primary' : 'text-slate-600'}`}
                        style={{ fontVariationSettings: "'wght' 600" }}
                      >
                        {tool.icon || 'build'}
                      </span>
                    </div>
                    {/* Status Badges */}
                    <div className="flex flex-col gap-1">
                      {tool.isNew && (
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">
                          NEW
                        </span>
                      )}
                      {!tool.active && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400 font-bold">
                          HIDDEN
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateTool(tool.id, 'active', !tool.active)}
                      className={`p-2 rounded transition-colors ${
                        tool.active
                          ? 'hover:bg-orange-900/20 text-slate-400 hover:text-orange-400'
                          : 'hover:bg-green-900/20 text-slate-400 hover:text-green-400'
                      }`}
                      title={tool.active ? 'Hide tool' : 'Show tool'}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {tool.active ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                    <button
                      onClick={() => removeTool(tool)}
                      className="p-2 hover:bg-red-900/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                      title="Delete tool"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>

                {/* Tool Form Fields */}
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">
                      Tool Name *
                    </label>
                    <input
                      type="text"
                      value={tool.name}
                      onChange={(e) => updateTool(tool.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary focus:outline-none"
                      placeholder="e.g., Impact Wrenches"
                      maxLength={200}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">
                      Category *
                    </label>
                    <input
                      type="text"
                      value={tool.category}
                      onChange={(e) => updateTool(tool.id, 'category', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary focus:outline-none"
                      placeholder="e.g., impact_tools"
                      maxLength={100}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={tool.description}
                      onChange={(e) => updateTool(tool.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary focus:outline-none resize-none"
                      placeholder="Brief description of the tool type..."
                      rows={3}
                      maxLength={1000}
                    />
                  </div>

                  {/* Icon & Display Order */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">
                        Icon Name
                      </label>
                      <input
                        type="text"
                        value={tool.icon}
                        onChange={(e) => updateTool(tool.id, 'icon', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary focus:outline-none"
                        placeholder="build"
                        maxLength={50}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        <a
                          href="https://fonts.google.com/icons"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary"
                        >
                          Browse icons →
                        </a>
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={tool.display_order}
                        onChange={(e) => updateTool(tool.id, 'display_order', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary focus:outline-none"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={() => saveTool(tool)}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors uppercase text-sm"
                  >
                    {saving ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-base">refresh</span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">save</span>
                        {tool.isNew ? 'Create Tool' : 'Save Changes'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </AdminLayout>
  );
}
