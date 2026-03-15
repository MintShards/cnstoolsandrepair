import { useState, useEffect } from 'react';
import { aboutContentAPI } from '../../../services/api';
import AdminTextarea from '../AdminTextarea';

export default function AboutTab() {
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Load current about content
  useEffect(() => {
    const fetchAboutContent = async () => {
      try {
        const data = await aboutContentAPI.get();
        setFormData(data);
      } catch (error) {
        console.error('Failed to fetch about content:', error);
        showNotification('Failed to load about content: ' + error.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchAboutContent();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);

    try {
      await aboutContentAPI.update(formData);
      showNotification('About page content saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save about content:', error);
      showNotification('Failed to save: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          About Page Content
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white font-black px-6 py-3 rounded-lg hover:bg-primary/90 active:scale-95 transition-all uppercase text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">save</span>
              <span>Save Changes</span>
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
          <div className="flex gap-3 items-start">
            <span className="material-symbols-outlined">
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p className="flex-1">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Page Heading */}
        <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-start gap-3 mb-4">
            <span className="material-symbols-outlined text-primary text-2xl">title</span>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Page Heading (H1)</h3>
              <p className="text-sm text-slate-400">Main heading displayed at the top of the About page</p>
            </div>
          </div>
          <AdminTextarea
            value={formData.page_heading || ''}
            onChange={(value) => updateField('page_heading', value)}
            placeholder="Example: Industrial pneumatic tool repair and maintenance services in Surrey, BC"
            rows={2}
            maxLength={200}
          />
          <p className="text-xs text-slate-500 mt-2">
            {formData.page_heading?.length || 0}/200 characters
          </p>
        </div>

        {/* Company Story */}
        <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-start gap-3 mb-4">
            <span className="material-symbols-outlined text-accent-orange text-2xl">auto_stories</span>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Company Story</h3>
              <p className="text-sm text-slate-400">Main text displayed in the "Our Story" section</p>
            </div>
          </div>
          <AdminTextarea
            value={formData.company_story || ''}
            onChange={(value) => updateField('company_story', value)}
            placeholder="Example: Industrial pneumatic tool repair services based in Surrey, British Columbia. We provide comprehensive repair, maintenance, rental, and sales services... Our technicians bring years of hands-on experience... (Use factual language, avoid promotional words like 'premier', 'best', 'leading')"
            rows={6}
            maxLength={5000}
          />
          <p className="text-xs text-slate-500 mt-2">
            {formData.company_story?.length || 0}/5000 characters
          </p>
        </div>
      </div>

      {/* Save Button (Bottom) */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white font-black px-8 py-4 rounded-lg hover:bg-primary/90 active:scale-95 transition-all uppercase flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="material-symbols-outlined animate-spin">refresh</span>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">save</span>
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
