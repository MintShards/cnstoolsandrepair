import { useState, useEffect } from 'react';
import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';
import { contactContentAPI } from '../../../services/api';

export default function ContactTab({ formData, updateField }) {
  const [contactContent, setContactContent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Fetch contact content on mount
  useEffect(() => {
    const fetchContactContent = async () => {
      try {
        const data = await contactContentAPI.get();
        setContactContent(data);
      } catch (error) {
        console.error('Failed to fetch contact content:', error);
      }
    };

    fetchContactContent();
  }, []);

  const updateContactField = (path, value) => {
    const keys = path.split('.');
    setContactContent((prev) => {
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

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const saveContactContent = async () => {
    setSaving(true);
    setNotification(null);

    try {
      await contactContentAPI.update(contactContent);
      showNotification('Contact page content saved successfully!', 'success');
    } catch (error) {
      showNotification('Failed to save contact content', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!contactContent) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          Contact Page Content
        </h2>
        <button
          onClick={saveContactContent}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-lg transition-colors"
        >
          {saving ? (
            <>
              <span className="material-symbols-outlined text-base animate-spin">refresh</span>
              Saving...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">save</span>
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-6 p-4 rounded-lg border ${
          notification.type === 'success'
            ? 'bg-green-900/20 border-green-700'
            : 'bg-red-900/20 border-red-700'
        }`}>
          <div className="flex gap-3">
            <span className={`material-symbols-outlined ${
              notification.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p className={`text-sm font-medium ${
              notification.type === 'success' ? 'text-green-300' : 'text-red-300'
            }`}>
              {notification.message}
            </p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">
        Hero Section
      </h3>
      <AdminInput
        label="Hero Label"
        value={contactContent.hero.label}
        onChange={(v) => updateContactField('hero.label', v)}
        maxLength={50}
        helperText="Small orange label above heading"
      />
      <AdminInput
        label="Hero Heading"
        value={contactContent.hero.heading}
        onChange={(v) => updateContactField('hero.heading', v)}
        maxLength={100}
        helperText="Main page heading"
      />
      <AdminTextarea
        label="Hero Description"
        value={contactContent.hero.description}
        onChange={(v) => updateContactField('hero.description', v)}
        rows={3}
        maxLength={500}
        helperText="Subheading text below main heading"
      />
    </div>
  );
}
