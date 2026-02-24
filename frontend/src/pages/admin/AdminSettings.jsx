import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { settingsAPI } from '../../services/api';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminInput from '../../components/admin/AdminInput';
import AdminTextarea from '../../components/admin/AdminTextarea';
import AdminToggle from '../../components/admin/AdminToggle';
import AdminSelect from '../../components/admin/AdminSelect';

export default function AdminSettings() {
  const { settings, loading: settingsLoading, refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('contact');
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Load current settings into form
  useEffect(() => {
    if (settings) {
      setFormData(JSON.parse(JSON.stringify(settings))); // Deep clone
    }
  }, [settings]);

  const tabs = [
    { id: 'contact', label: 'Contact', icon: 'call' },
    { id: 'hero', label: 'Hero Section', icon: 'star' },
    { id: 'services', label: 'Services', icon: 'build' },
    { id: 'brands', label: 'Brands', icon: 'business' },
    { id: 'announcement', label: 'Banner', icon: 'campaign' },
    { id: 'map', label: 'Map & Location', icon: 'location_on' },
    { id: 'claims', label: 'Claims & Stats', icon: 'analytics' },
  ];

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);

    try {
      await settingsAPI.update(formData);
      await refreshSettings();
      showNotification('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showNotification('Failed to save settings: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all fields to current saved values?')) {
      setFormData(JSON.parse(JSON.stringify(settings)));
      showNotification('Form reset to saved values', 'info');
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

  // Brand management functions
  const addBrand = () => {
    setFormData((prev) => ({
      ...prev,
      brands: [
        ...prev.brands,
        { name: '', logoUrl: '', authorized: false, displayOrder: prev.brands.length },
      ],
    }));
  };

  const removeBrand = (index) => {
    setFormData((prev) => ({
      ...prev,
      brands: prev.brands.filter((_, i) => i !== index),
    }));
  };

  const updateBrand = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      brands: prev.brands.map((brand, i) =>
        i === index ? { ...brand, [field]: value } : brand
      ),
    }));
  };

  const handleBrandLogoUpload = async (index, file) => {
    if (!file) return;

    // For now, store as data URL (temporary solution)
    // In production, upload to backend and get URL
    const reader = new FileReader();
    reader.onloadend = () => {
      updateBrand(index, 'logoUrl', reader.result);
    };
    reader.readAsDataURL(file);
  };

  if (settingsLoading || !formData) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-primary animate-spin">
              refresh
            </span>
            <p className="text-slate-400 mt-4">Loading settings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Business Settings">
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

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form Content */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
        {/* Contact Tab */}
        {activeTab === 'contact' && (
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AdminInput
                label="Phone Number"
                value={formData.contact.phone}
                onChange={(v) => updateField('contact.phone', v)}
                required
                maxLength={20}
                helperText="Display format: (604) 555-0123"
              />
              <AdminInput
                label="Phone Link"
                value={formData.contact.phoneLink}
                onChange={(v) => updateField('contact.phoneLink', v)}
                required
                maxLength={20}
                helperText="Digits only: 6045550123"
              />
              <div className="md:col-span-2">
                <AdminInput
                  label="Email Address"
                  value={formData.contact.email}
                  onChange={(v) => updateField('contact.email', v)}
                  type="email"
                  required
                  helperText="Business email address"
                />
              </div>
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
              Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <AdminInput
                  label="Street Address"
                  value={formData.contact.address.street}
                  onChange={(v) => updateField('contact.address.street', v)}
                  required
                  maxLength={200}
                />
              </div>
              <AdminInput
                label="City"
                value={formData.contact.address.city}
                onChange={(v) => updateField('contact.address.city', v)}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <AdminInput
                  label="Province"
                  value={formData.contact.address.province}
                  onChange={(v) => updateField('contact.address.province', v)}
                  required
                  maxLength={50}
                />
                <AdminInput
                  label="Postal Code"
                  value={formData.contact.address.postalCode}
                  onChange={(v) => updateField('contact.address.postalCode', v)}
                  maxLength={20}
                />
              </div>
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
              Business Hours
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AdminInput
                label="Weekdays"
                value={formData.hours.weekdays}
                onChange={(v) => updateField('hours.weekdays', v)}
                required
                maxLength={200}
                placeholder="Monday - Friday: 8:00 AM - 5:00 PM"
              />
              <AdminInput
                label="Weekend"
                value={formData.hours.weekend}
                onChange={(v) => updateField('hours.weekend', v)}
                required
                maxLength={200}
                placeholder="Saturday - Sunday: Closed"
              />
              <AdminInput
                label="Timezone"
                value={formData.hours.timezone}
                onChange={(v) => updateField('hours.timezone', v)}
                maxLength={10}
                placeholder="PST"
              />
            </div>
          </div>
        )}

        {/* Hero Tab */}
        {activeTab === 'hero' && (
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
              Hero Section
            </h2>
            <AdminInput
              label="Headline"
              value={formData.hero.headline}
              onChange={(v) => updateField('hero.headline', v)}
              required
              maxLength={300}
              helperText="Main headline on homepage"
            />
            <AdminTextarea
              label="Subheadline"
              value={formData.hero.subheadline}
              onChange={(v) => updateField('hero.subheadline', v)}
              required
              maxLength={500}
              rows={3}
              helperText="Supporting text below headline"
            />
            <AdminInput
              label="Industries (comma-separated)"
              value={formData.hero.industries.join(', ')}
              onChange={(v) => updateField('hero.industries', v.split(',').map((s) => s.trim()))}
              helperText="Example: Automotive, Railway, Construction"
            />
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                Services Offered
              </h2>
              <button
                onClick={addService}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">add</span>
                Add Service
              </button>
            </div>

            {formData.services.map((service, index) => (
              <div
                key={index}
                className="mb-6 p-6 bg-slate-800 rounded-lg border border-slate-700"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Service {index + 1}</h3>
                  <button
                    onClick={() => removeService(index)}
                    className="flex items-center gap-1 px-3 py-1 bg-red-900/20 hover:bg-red-900/40 text-red-300 text-sm font-bold rounded transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    Remove
                  </button>
                </div>
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
            ))}
          </div>
        )}

        {/* Brands Tab */}
        {activeTab === 'brands' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  Brands We Service
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {formData.brands.length} brand{formData.brands.length !== 1 ? 's' : ''} total
                </p>
              </div>
              <button
                onClick={addBrand}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">add</span>
                Add Brand
              </button>
            </div>

            {/* Help Text */}
            {formData.brands.length > 0 && (
              <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-blue-400">info</span>
                  <div className="flex-1 text-sm text-blue-300">
                    <p className="font-bold mb-1">Managing Brand Visibility</p>
                    <p className="text-blue-400">
                      Click the eye icon to enable/disable brands from appearing on the carousel.
                      Only enabled brands with logos will show on your website.
                      Reorder brands by changing their Display Order (lower numbers appear first).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formData.brands.length === 0 && (
              <div className="p-8 text-center bg-slate-800 rounded-lg border border-slate-700">
                <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">
                  business
                </span>
                <p className="text-slate-400 mb-2">No brands added yet.</p>
                <p className="text-sm text-slate-500">
                  Run <code className="px-2 py-1 bg-slate-900 rounded">python3 backend/scripts/download_brand_logos.py</code> to import 82 brand logos,
                  <br />then run <code className="px-2 py-1 bg-slate-900 rounded">python3 backend/scripts/seed_brands.py</code> to add them here.
                </p>
              </div>
            )}

            {/* Brand Cards Grid - 4x4 Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {formData.brands
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((brand, index) => {
                  const actualIndex = formData.brands.findIndex(b => b === brand);
                  const hasLogo = brand.logoUrl && brand.logoUrl.trim() !== '';
                  const isActive = brand.active !== false; // Default to true if undefined
                  const showInCarousel = hasLogo && isActive;

                  return (
                    <div
                      key={actualIndex}
                      className={`relative p-3 rounded-lg border transition-all ${
                        showInCarousel
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-900/50 border-slate-800 opacity-60'
                      }`}
                    >
                      {/* Action Buttons - Top Right */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button
                          onClick={() => updateBrand(actualIndex, 'active', !isActive)}
                          className={`p-1.5 rounded transition-colors ${
                            isActive
                              ? 'hover:bg-orange-900/20 text-slate-400 hover:text-orange-400'
                              : 'hover:bg-green-900/20 text-slate-400 hover:text-green-400'
                          }`}
                          title={isActive ? 'Disable brand' : 'Enable brand'}
                        >
                          <span className="material-symbols-outlined text-base">
                            {isActive ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                        <button
                          onClick={() => removeBrand(actualIndex)}
                          className="p-1.5 hover:bg-red-900/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                          title="Delete brand"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>

                      {/* Logo - Centered */}
                      <div className="flex justify-center mb-2">
                        {brand.logoUrl ? (
                          <img
                            src={brand.logoUrl}
                            alt={brand.name || 'Brand logo'}
                            className="h-10 w-16 object-contain bg-white p-1 rounded"
                          />
                        ) : (
                          <div className="h-10 w-16 bg-slate-700 rounded flex items-center justify-center">
                            <span className="material-symbols-outlined text-slate-500 text-sm">image</span>
                          </div>
                        )}
                      </div>

                      {/* Brand Name - Centered */}
                      <h3 className="text-xs font-bold text-white text-center truncate px-6 mb-2">
                        {brand.name || 'Unnamed Brand'}
                      </h3>

                      {/* Status Indicators - Compact Row */}
                      <div className="flex items-center justify-center gap-1 mb-2 flex-wrap">
                        {showInCarousel && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400" title="Visible in carousel">
                            ✓
                          </span>
                        )}
                        {!isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-400" title="Disabled">
                            ✕
                          </span>
                        )}
                        {brand.authorized && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary-300" title="Authorized">
                            ★
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500" title="Display order">
                          #{brand.displayOrder}
                        </span>
                      </div>

                      {/* Expandable Details */}
                      <details className="group">
                        <summary className="cursor-pointer text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider list-none flex items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-xs group-open:rotate-90 transition-transform">
                            chevron_right
                          </span>
                          Edit
                        </summary>

                        <div className="mt-2 pt-2 border-t border-slate-700 space-y-2">
                          {/* Brand Name Input */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Name</label>
                            <input
                              type="text"
                              value={brand.name}
                              onChange={(e) => updateBrand(actualIndex, 'name', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:border-primary focus:outline-none"
                              placeholder="Brand name"
                              maxLength={100}
                            />
                          </div>

                          {/* Logo Upload */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Logo</label>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/svg+xml"
                              onChange={(e) => handleBrandLogoUpload(actualIndex, e.target.files[0])}
                              className="block w-full text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                            />
                          </div>

                          {/* Authorized Toggle */}
                          <div className="flex items-center justify-between p-1.5 bg-slate-900 rounded">
                            <label className="text-[10px] font-bold text-slate-400">Authorized</label>
                            <button
                              type="button"
                              onClick={() => updateBrand(actualIndex, 'authorized', !brand.authorized)}
                              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                                brand.authorized ? 'bg-primary' : 'bg-slate-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                                  brand.authorized ? 'translate-x-4' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Display Order */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Order</label>
                            <input
                              type="number"
                              value={brand.displayOrder}
                              onChange={(e) => updateBrand(actualIndex, 'displayOrder', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:border-primary focus:outline-none"
                              min="0"
                            />
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Announcement Tab */}
        {activeTab === 'announcement' && (
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
              Announcement Banner
            </h2>
            <AdminToggle
              label="Enable Banner"
              value={formData.announcement.enabled}
              onChange={(v) => updateField('announcement.enabled', v)}
              helperText="Show announcement banner at top of website"
            />
            {formData.announcement.enabled && (
              <>
                <AdminTextarea
                  label="Message"
                  value={formData.announcement.message}
                  onChange={(v) => updateField('announcement.message', v)}
                  maxLength={500}
                  rows={2}
                  helperText="Announcement text to display"
                />
                <AdminSelect
                  label="Banner Type"
                  value={formData.announcement.type}
                  onChange={(v) => updateField('announcement.type', v)}
                  options={[
                    { value: 'info', label: 'Info (Blue)' },
                    { value: 'warning', label: 'Warning (Orange)' },
                    { value: 'success', label: 'Success (Green)' },
                  ]}
                  helperText="Visual style of the banner"
                />
              </>
            )}
          </div>
        )}

        {/* Map Tab */}
        {activeTab === 'map' && (
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
              Map & Location
            </h2>
            <AdminTextarea
              label="Google Maps Embed URL"
              value={formData.map.embedUrl}
              onChange={(v) => updateField('map.embedUrl', v)}
              required
              rows={3}
              helperText="Get from Google Maps → Share → Embed"
            />
            <AdminInput
              label="Directions URL"
              value={formData.map.directionsUrl}
              onChange={(v) => updateField('map.directionsUrl', v)}
              required
              helperText="Link for 'Get Directions' button"
            />
            <AdminInput
              label="Service Area"
              value={formData.serviceArea}
              onChange={(v) => updateField('serviceArea', v)}
              maxLength={100}
              helperText="Example: Metro Vancouver"
            />
          </div>
        )}

        {/* Claims Tab */}
        {activeTab === 'claims' && (
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">
              Claims & Statistics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AdminInput
                label="Tool Types Serviced"
                value={formData.claims.toolTypesServiced}
                onChange={(v) => updateField('claims.toolTypesServiced', v)}
                maxLength={20}
                placeholder="20+"
              />
              <AdminInput
                label="Average Turnaround"
                value={formData.claims.averageTurnaround}
                onChange={(v) => updateField('claims.averageTurnaround', v)}
                maxLength={50}
                placeholder="3-7 Day"
              />
              <AdminInput
                label="Response Time"
                value={formData.claims.responseTime}
                onChange={(v) => updateField('claims.responseTime', v)}
                maxLength={50}
                placeholder="Same-day"
              />
              <AdminInput
                label="Technicians"
                value={formData.claims.technicians}
                onChange={(v) => updateField('claims.technicians', v)}
                maxLength={100}
                placeholder="Factory-Trained"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mt-8">
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
              Save Changes
            </>
          )}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 disabled:text-slate-500 text-slate-300 font-bold rounded-xl transition-colors uppercase"
        >
          <span className="material-symbols-outlined">restart_alt</span>
          Reset
        </button>
      </div>
    </AdminLayout>
  );
}
