import { useState, useEffect } from 'react';
import { homeContentAPI } from '../../../services/api';
import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';

export default function HomeTab() {
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [expandedTestimonials, setExpandedTestimonials] = useState(new Set());
  const [expandedTrustBadges, setExpandedTrustBadges] = useState(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState(new Set());
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  // Load current home content
  useEffect(() => {
    const fetchHomeContent = async () => {
      try {
        const data = await homeContentAPI.get();
        setFormData(data);
      } catch (error) {
        console.error('Failed to fetch home content:', error);
        showNotification('Failed to load home content: ' + error.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchHomeContent();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);

    try {
      await homeContentAPI.update(formData);
      showNotification('Home page content saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save home content:', error);
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

  // Why Choose Us - Feature management
  const addFeature = () => {
    setFormData((prev) => {
      const newIndex = prev.whyChooseUs.features.length;
      // Auto-expand the new feature
      setExpandedFeatures(prevExpanded => {
        const newSet = new Set(prevExpanded);
        newSet.add(newIndex);
        return newSet;
      });

      return {
        ...prev,
        whyChooseUs: {
          ...prev.whyChooseUs,
          features: [
            ...prev.whyChooseUs.features,
            { icon: '', title: '', description: '', display_order: newIndex },
          ],
        },
      };
    });
  };

  const removeFeature = (index) => {
    setFormData((prev) => ({
      ...prev,
      whyChooseUs: {
        ...prev.whyChooseUs,
        features: prev.whyChooseUs.features.filter((_, i) => i !== index),
      },
    }));
  };

  const updateFeature = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      whyChooseUs: {
        ...prev.whyChooseUs,
        features: prev.whyChooseUs.features.map((feature, i) =>
          i === index ? { ...feature, [field]: value } : feature
        ),
      },
    }));
  };

  // How It Works - Step management
  const addStep = () => {
    setFormData((prev) => {
      const newIndex = prev.howItWorks.steps.length;
      const nextNumber = newIndex + 1;
      // Auto-expand the new step
      setExpandedSteps(prevExpanded => {
        const newSet = new Set(prevExpanded);
        newSet.add(newIndex);
        return newSet;
      });

      return {
        ...prev,
        howItWorks: {
          ...prev.howItWorks,
          steps: [
            ...prev.howItWorks.steps,
            { number: nextNumber, title: '', description: '', display_order: newIndex },
          ],
        },
      };
    });
  };

  const removeStep = (index) => {
    setFormData((prev) => ({
      ...prev,
      howItWorks: {
        ...prev.howItWorks,
        steps: prev.howItWorks.steps.filter((_, i) => i !== index),
      },
    }));
  };

  const updateStep = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      howItWorks: {
        ...prev.howItWorks,
        steps: prev.howItWorks.steps.map((step, i) =>
          i === index ? { ...step, [field]: value } : step
        ),
      },
    }));
  };

  // Service Area - City management
  const addCity = () => {
    setFormData((prev) => ({
      ...prev,
      serviceArea: {
        ...prev.serviceArea,
        highlightedCities: [...prev.serviceArea.highlightedCities, ''],
      },
    }));
  };

  const removeCity = (index) => {
    setFormData((prev) => ({
      ...prev,
      serviceArea: {
        ...prev.serviceArea,
        highlightedCities: prev.serviceArea.highlightedCities.filter((_, i) => i !== index),
      },
    }));
  };

  const updateCity = (index, value) => {
    setFormData((prev) => ({
      ...prev,
      serviceArea: {
        ...prev.serviceArea,
        highlightedCities: prev.serviceArea.highlightedCities.map((city, i) =>
          i === index ? value : city
        ),
      },
    }));
  };

  // QuickFacts - Trust Badge management
  const addTrustBadge = () => {
    setFormData((prev) => {
      const newIndex = prev.quickFacts.trustBadges.length;
      // Auto-expand the new badge
      setExpandedTrustBadges(prevExpanded => {
        const newSet = new Set(prevExpanded);
        newSet.add(newIndex);
        return newSet;
      });

      return {
        ...prev,
        quickFacts: {
          ...prev.quickFacts,
          trustBadges: [
            ...prev.quickFacts.trustBadges,
            { icon: '', label: '', color: 'text-green-400', display_order: newIndex },
          ],
        },
      };
    });
  };

  const removeTrustBadge = (index) => {
    setFormData((prev) => ({
      ...prev,
      quickFacts: {
        ...prev.quickFacts,
        trustBadges: prev.quickFacts.trustBadges.filter((_, i) => i !== index),
      },
    }));
  };

  const updateTrustBadge = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      quickFacts: {
        ...prev.quickFacts,
        trustBadges: prev.quickFacts.trustBadges.map((badge, i) =>
          i === index ? { ...badge, [field]: value } : badge
        ),
      },
    }));
  };

  // Testimonials management
  const addTestimonial = () => {
    setFormData((prev) => {
      const newIndex = (prev.testimonials || []).length;
      // Auto-expand the new testimonial
      setExpandedTestimonials(prevExpanded => {
        const newSet = new Set(prevExpanded);
        newSet.add(newIndex);
        return newSet;
      });

      return {
        ...prev,
        testimonials: [
          ...(prev.testimonials || []),
          {
            company: '',
            person: '',
            title: '',
            industry: 'person',
            industryName: '',
            quote: '',
            location: '',
          },
        ],
      };
    });
  };

  const removeTestimonial = (index) => {
    setFormData((prev) => ({
      ...prev,
      testimonials: prev.testimonials.filter((_, i) => i !== index),
    }));
  };

  const updateTestimonial = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      testimonials: prev.testimonials.map((testimonial, i) =>
        i === index ? { ...testimonial, [field]: value } : testimonial
      ),
    }));
  };

  const toggleTestimonial = (index) => {
    setExpandedTestimonials(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleTrustBadge = (index) => {
    setExpandedTrustBadges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleFeature = (index) => {
    setExpandedFeatures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleStep = (index) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (loading || !formData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
          <p className="text-slate-400 mt-4">Loading home page content...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          Home Page Content
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
          label="Headline"
          value={formData.hero.headline}
          onChange={(v) => updateField('hero.headline', v)}
          required
          maxLength={300}
          helperText="Main heading shown on hero section"
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
          label="Primary Button Text"
          value={formData.hero.primaryButtonText}
          onChange={(v) => updateField('hero.primaryButtonText', v)}
          required
          maxLength={100}
          placeholder="Request a Repair Assessment"
        />
        <AdminInput
          label="Secondary Button Text"
          value={formData.hero.secondaryButtonText}
          onChange={(v) => updateField('hero.secondaryButtonText', v)}
          required
          maxLength={100}
          placeholder="View Pneumatic Tool Repair Services"
        />
      </div>

      {/* QuickFacts - Trust Badges */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        QuickFacts Trust Badges
      </h3>
      <div className="mb-4">
        <button
          type="button"
          onClick={addTrustBadge}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add Trust Badge
        </button>
      </div>

      <div className="space-y-3 mb-8">
        {formData.quickFacts.trustBadges.map((badge, index) => {
          const isExpanded = expandedTrustBadges.has(index);

          return (
            <div key={index} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-all">
              {/* Collapsed Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => toggleTrustBadge(index)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="text-slate-400 font-bold text-sm whitespace-nowrap">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-bold truncate">
                      {badge.label || 'Untitled Badge'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrustBadge(index);
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AdminInput
                      label="Icon Name"
                      value={badge.icon}
                      onChange={(v) => updateTrustBadge(index, 'icon', v)}
                      required
                      maxLength={50}
                      placeholder="verified, workspace_premium, security, etc."
                      helperText="Material Symbols icon name"
                    />
                    <AdminInput
                      label="Label"
                      value={badge.label}
                      onChange={(v) => updateTrustBadge(index, 'label', v)}
                      required
                      maxLength={100}
                      placeholder="OEM Certified, 15+ Years, etc."
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Color Class
                      </label>
                      <select
                        value={badge.color}
                        onChange={(e) => updateTrustBadge(index, 'color', e.target.value)}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary transition-colors"
                      >
                        <option value="text-green-400">Green</option>
                        <option value="text-blue-400">Blue</option>
                        <option value="text-purple-400">Purple</option>
                        <option value="text-yellow-400">Yellow</option>
                        <option value="text-red-400">Red</option>
                        <option value="text-orange-400">Orange</option>
                        <option value="text-pink-400">Pink</option>
                        <option value="text-cyan-400">Cyan</option>
                      </select>
                    </div>
                    <AdminInput
                      label="Display Order"
                      value={badge.display_order}
                      onChange={(v) => updateTrustBadge(index, 'display_order', parseInt(v, 10) || 0)}
                      type="number"
                      min={0}
                      helperText="Order in which badge appears (0-based)"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SEO Meta Tags */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        SEO Meta Tags
      </h3>
      <div className="grid grid-cols-1 gap-6 mb-8">
        <AdminInput
          label="Page Title"
          value={formData.seo.title}
          onChange={(v) => updateField('seo.title', v)}
          required
          maxLength={200}
          helperText="Shown in browser tab and search results"
        />
        <AdminTextarea
          label="Meta Description"
          value={formData.seo.description}
          onChange={(v) => updateField('seo.description', v)}
          required
          maxLength={500}
          rows={3}
          helperText="Shown in search results (155-160 chars ideal)"
        />
        <AdminTextarea
          label="Keywords"
          value={formData.seo.keywords}
          onChange={(v) => updateField('seo.keywords', v)}
          required
          maxLength={500}
          rows={2}
          helperText="Comma-separated keywords for search engines"
        />
      </div>

      {/* Repair Process Intro Section */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Repair Process Intro Section
      </h3>
      <div className="grid grid-cols-1 gap-6 mb-8">
        <AdminInput
          label="Small Label"
          value={formData.repairProcessIntro.label}
          onChange={(v) => updateField('repairProcessIntro.label', v)}
          required
          maxLength={50}
          placeholder="Our Process"
        />
        <AdminInput
          label="Heading"
          value={formData.repairProcessIntro.heading}
          onChange={(v) => updateField('repairProcessIntro.heading', v)}
          required
          maxLength={200}
        />
        <AdminTextarea
          label="Description"
          value={formData.repairProcessIntro.description}
          onChange={(v) => updateField('repairProcessIntro.description', v)}
          required
          maxLength={1000}
          rows={4}
        />
      </div>

      {/* Why Choose Us Section */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Why Choose Us Section
      </h3>
      <div className="grid grid-cols-1 gap-6 mb-4">
        <AdminInput
          label="Small Label"
          value={formData.whyChooseUs.label}
          onChange={(v) => updateField('whyChooseUs.label', v)}
          required
          maxLength={50}
          placeholder="Why Choose CNS"
        />
        <AdminInput
          label="Heading"
          value={formData.whyChooseUs.heading}
          onChange={(v) => updateField('whyChooseUs.heading', v)}
          required
          maxLength={200}
        />
        <AdminTextarea
          label="Subheading"
          value={formData.whyChooseUs.subheading}
          onChange={(v) => updateField('whyChooseUs.subheading', v)}
          required
          maxLength={500}
          rows={2}
        />
      </div>

      {/* Why Choose Us - Features */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold text-white">Features ({formData.whyChooseUs.features.length})</h4>
        <button
          onClick={addFeature}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add Feature
        </button>
      </div>

      <div className="space-y-3 mb-8">
        {formData.whyChooseUs.features.map((feature, index) => {
          const isExpanded = expandedFeatures.has(index);

          return (
            <div key={index} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-all">
              {/* Collapsed Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => toggleFeature(index)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="text-slate-400 font-bold text-sm whitespace-nowrap">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-bold truncate">
                      {feature.title || 'Untitled Feature'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFeature(index);
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
                      label="Icon (Material Symbol)"
                      value={feature.icon}
                      onChange={(v) => updateFeature(index, 'icon', v)}
                      required
                      maxLength={50}
                      placeholder="query_stats"
                      helperText="Material Symbols icon name"
                    />
                    <AdminInput
                      label="Title"
                      value={feature.title}
                      onChange={(v) => updateFeature(index, 'title', v)}
                      required
                      maxLength={100}
                    />
                    <AdminTextarea
                      label="Description"
                      value={feature.description}
                      onChange={(v) => updateFeature(index, 'description', v)}
                      required
                      maxLength={500}
                      rows={3}
                    />
                    <AdminInput
                      label="Display Order"
                      value={feature.display_order}
                      onChange={(v) => updateFeature(index, 'display_order', parseInt(v) || 0)}
                      type="number"
                      min="0"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* How It Works Section */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        How It Works Section
      </h3>
      <div className="grid grid-cols-1 gap-6 mb-4">
        <AdminInput
          label="Small Label"
          value={formData.howItWorks.label}
          onChange={(v) => updateField('howItWorks.label', v)}
          required
          maxLength={50}
          placeholder="Our Workflow"
        />
        <AdminInput
          label="Heading"
          value={formData.howItWorks.heading}
          onChange={(v) => updateField('howItWorks.heading', v)}
          required
          maxLength={200}
        />
      </div>

      {/* How It Works - Steps */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold text-white">Steps ({formData.howItWorks.steps.length})</h4>
        <button
          onClick={addStep}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add Step
        </button>
      </div>

      <div className="space-y-3 mb-4">
        {formData.howItWorks.steps.map((step, index) => {
          const isExpanded = expandedSteps.has(index);

          return (
            <div key={index} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-all">
              {/* Collapsed Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => toggleStep(index)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="text-slate-400 font-bold text-sm whitespace-nowrap">Step {step.number}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-bold truncate">
                      {step.title || 'Untitled Step'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStep(index);
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
                      label="Step Number"
                      value={step.number}
                      onChange={(v) => updateStep(index, 'number', parseInt(v) || 1)}
                      type="number"
                      min="1"
                      max="10"
                    />
                    <AdminInput
                      label="Title"
                      value={step.title}
                      onChange={(v) => updateStep(index, 'title', v)}
                      required
                      maxLength={100}
                    />
                    <AdminTextarea
                      label="Description"
                      value={step.description}
                      onChange={(v) => updateStep(index, 'description', v)}
                      required
                      maxLength={500}
                      rows={3}
                    />
                    <AdminInput
                      label="Display Order"
                      value={step.display_order}
                      onChange={(v) => updateStep(index, 'display_order', parseInt(v) || 0)}
                      type="number"
                      min="0"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-8">
        <AdminTextarea
          label="Bottom Note"
          value={formData.howItWorks.note}
          onChange={(v) => updateField('howItWorks.note', v)}
          required
          maxLength={500}
          rows={2}
          helperText="Disclaimer or additional note shown at bottom"
        />
      </div>

      {/* Industrial Use Cases Section */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Industrial Use Cases Section
      </h3>
      <div className="grid grid-cols-1 gap-6 mb-8">
        <AdminInput
          label="Small Label"
          value={formData.industrialUseCases.label}
          onChange={(v) => updateField('industrialUseCases.label', v)}
          required
          maxLength={50}
          placeholder="Use Cases"
        />
        <AdminInput
          label="Heading"
          value={formData.industrialUseCases.heading}
          onChange={(v) => updateField('industrialUseCases.heading', v)}
          required
          maxLength={200}
        />
        <AdminTextarea
          label="Subtitle"
          value={formData.industrialUseCases.subtitle}
          onChange={(v) => updateField('industrialUseCases.subtitle', v)}
          required
          maxLength={500}
          rows={2}
        />
        <AdminTextarea
          label="Description"
          value={formData.industrialUseCases.description}
          onChange={(v) => updateField('industrialUseCases.description', v)}
          required
          maxLength={1000}
          rows={4}
        />
      </div>

      {/* Service Area Section */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Service Area Section
      </h3>
      <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <p className="text-sm text-slate-400 mb-2">
          <span className="material-symbols-outlined text-base align-middle mr-1">info</span>
          Description is auto-generated from your city list
        </p>
        <p className="text-slate-300 text-sm italic">
          Template: "Based in Surrey, BC, CNS Tool Repair provides industrial pneumatic tool repair services to businesses across <span className="text-primary font-bold">[City List]</span>, and the Lower Mainland."
        </p>
      </div>

      {/* Service Area - Highlighted Cities */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold text-white">Highlighted Cities ({formData.serviceArea.highlightedCities.length})</h4>
        <button
          onClick={addCity}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add City
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        {formData.serviceArea.highlightedCities.map((city, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={city}
              onChange={(e) => updateCity(index, e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-primary focus:outline-none"
              placeholder="City name"
              maxLength={100}
            />
            <button
              onClick={() => removeCity(index)}
              className="px-3 py-2 hover:bg-red-900/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
              title="Remove city"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        ))}
      </div>

      {/* Testimonials Section */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Testimonials Section
      </h3>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold text-white">Testimonials ({(formData.testimonials || []).length})</h4>
        <button
          type="button"
          onClick={addTestimonial}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add Testimonial
        </button>
      </div>

      <div className="space-y-3 mb-8">
        {(formData.testimonials || []).map((testimonial, index) => {
            const actualIndex = index;
            const isExpanded = expandedTestimonials.has(actualIndex);

            return (
              <div key={actualIndex} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-all">
                {/* Collapsed Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => toggleTestimonial(actualIndex)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="text-slate-400 font-bold text-sm whitespace-nowrap">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-bold truncate">
                        {testimonial.company || 'Unknown Company'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTestimonial(actualIndex);
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <AdminInput
                        label="Company Name"
                        value={testimonial.company}
                        onChange={(v) => updateTestimonial(actualIndex, 'company', v)}
                        maxLength={200}
                        placeholder="Fraser Valley Auto Group"
                      />
                      <AdminInput
                        label="Person Name"
                        value={testimonial.person}
                        onChange={(v) => updateTestimonial(actualIndex, 'person', v)}
                        maxLength={200}
                        placeholder="Marcus Chen"
                      />
                      <AdminInput
                        label="Job Title"
                        value={testimonial.title}
                        onChange={(v) => updateTestimonial(actualIndex, 'title', v)}
                        maxLength={200}
                        placeholder="Fleet Maintenance Director"
                      />
                      <AdminInput
                        label="Location"
                        value={testimonial.location}
                        onChange={(v) => updateTestimonial(actualIndex, 'location', v)}
                        maxLength={200}
                        placeholder="Surrey, BC"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Industry
                      </label>
                      <select
                        value={testimonial.industryName}
                        onChange={(e) => {
                          const industryOptions = {
                            '': 'person',
                            automotive: 'directions_car',
                            fleet: 'local_shipping',
                            construction: 'construction',
                            manufacturing: 'precision_manufacturing',
                            oil_gas: 'factory',
                            aerospace: 'flight',
                            marine: 'sailing',
                            mining: 'landslide',
                          };
                          updateTestimonial(actualIndex, 'industryName', e.target.value);
                          updateTestimonial(actualIndex, 'industry', industryOptions[e.target.value] || 'person');
                        }}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-primary transition-colors"
                      >
                        <option value="">Unknown / Walk-in Customer</option>
                        <option value="automotive">Automotive</option>
                        <option value="fleet">Fleet Maintenance</option>
                        <option value="construction">Construction</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="oil_gas">Oil & Gas</option>
                        <option value="aerospace">Aerospace</option>
                        <option value="marine">Marine</option>
                        <option value="mining">Mining</option>
                      </select>
                    </div>

                    <div>
                      <AdminTextarea
                        label="Testimonial Quote"
                        value={testimonial.quote}
                        onChange={(v) => updateTestimonial(actualIndex, 'quote', v)}
                        required
                        maxLength={1000}
                        rows={4}
                        placeholder="CNS saved us over 40 hours of production downtime..."
                        helperText="The testimonial text from the client (required)"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Final CTA Section */}
      <h3 className="text-xl font-black text-white uppercase tracking-tight mt-8 mb-4">
        Final CTA Section
      </h3>
      <div className="grid grid-cols-1 gap-6 mb-8">
        <AdminInput
          label="Heading"
          value={formData.finalCta.heading}
          onChange={(v) => updateField('finalCta.heading', v)}
          required
          maxLength={200}
        />
        <AdminTextarea
          label="Description"
          value={formData.finalCta.description}
          onChange={(v) => updateField('finalCta.description', v)}
          required
          maxLength={500}
          rows={3}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdminInput
            label="Primary Button Text"
            value={formData.finalCta.primaryButtonText}
            onChange={(v) => updateField('finalCta.primaryButtonText', v)}
            required
            maxLength={100}
            placeholder="Request a Repair Assessment"
          />
          <AdminInput
            label="Secondary Button Text"
            value={formData.finalCta.secondaryButtonText}
            onChange={(v) => updateField('finalCta.secondaryButtonText', v)}
            required
            maxLength={100}
            placeholder="Call Support"
          />
        </div>
      </div>

      {/* Save Button at Bottom */}
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
