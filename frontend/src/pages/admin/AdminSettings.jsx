import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import AdminLayout from '../../components/admin/AdminLayout';
import HomeTab from '../../components/admin/tabs/HomeTab';
import ServicesTab from '../../components/admin/tabs/ServicesTab';
import IndustriesTab from '../../components/admin/tabs/IndustriesTab';
import GalleryTab from '../../components/admin/tabs/GalleryTab';
import AboutTab from '../../components/admin/tabs/AboutTab';
import ContactTab from '../../components/admin/tabs/ContactTab';
import GlobalTab from '../../components/admin/tabs/GlobalTab';

export default function AdminSettings() {
  const { settings, loading: settingsLoading, refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('home');
  const [formData, setFormData] = useState(null);

  // Load current settings into form
  useEffect(() => {
    if (settings) {
      const clonedSettings = JSON.parse(JSON.stringify(settings)); // Deep clone
      // Initialize social field if not present
      if (!clonedSettings.social) {
        clonedSettings.social = { facebook: '', linkedin: '', instagram: '' };
      }
      setFormData(clonedSettings);
    }
  }, [settings]);

  const tabs = [
    { id: 'home', label: 'Home Page', icon: 'home' },
    { id: 'services', label: 'Services Page', icon: 'build' },
    { id: 'industries', label: 'Industries Page', icon: 'factory' },
    { id: 'gallery', label: 'Gallery Page', icon: 'photo_library' },
    { id: 'about', label: 'About Page', icon: 'info' },
    { id: 'contact', label: 'Contact Page', icon: 'contact_mail' },
    { id: 'global', label: 'Global Settings', icon: 'settings' },
  ];

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
      {/* Sidebar + Content Layout */}
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <aside className="w-72 flex-shrink-0">
          <div className="sticky top-8 space-y-6">
            {/* Navigation */}
            <nav className="bg-slate-900 rounded-2xl border border-slate-800 p-3">
              <div className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm transition-all ${
                      activeTab === tab.id
                        ? 'bg-primary/10 text-primary border-l-4 border-primary pl-3'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-4 border-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
            {activeTab === 'home' && (
              <HomeTab formData={formData} updateField={updateField} />
            )}

            {activeTab === 'services' && (
              <ServicesTab
                formData={formData}
                addService={addService}
                removeService={removeService}
                updateService={updateService}
              />
            )}

            {activeTab === 'industries' && (
              <IndustriesTab />
            )}

            {activeTab === 'gallery' && (
              <GalleryTab />
            )}

            {activeTab === 'about' && (
              <AboutTab />
            )}

            {activeTab === 'contact' && (
              <ContactTab formData={formData} updateField={updateField} />
            )}

            {activeTab === 'global' && (
              <GlobalTab
                formData={formData}
                updateField={updateField}
                addBrand={addBrand}
                removeBrand={removeBrand}
                updateBrand={updateBrand}
                handleBrandLogoUpload={handleBrandLogoUpload}
              />
            )}
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
