import { useState, useEffect, useRef } from 'react';
import AdminInput from '../AdminInput';
import AdminTextarea from '../AdminTextarea';
import { serviceAgreementAPI, settingsAPI } from '../../../services/api';
import { useSettings } from '../../../contexts/SettingsContext';

const DEFAULT_SOURCING_EMAIL_TEMPLATE = {
  defaultSubject: 'Parts Pricing Request - CNS Tool Repair',
  greeting: 'Hi',
  bodyText: 'We would like to request pricing and availability for the parts listed below. When you have a moment, please reply with your best price and estimated lead time for any items you are able to supply. We truly appreciate your time and assistance.',
  closingText: 'Thank you for your time. We look forward to hearing from you.',
  footerTagline: 'Industrial Pneumatic Tool Repair & Maintenance',
  footerEmail: 'purchasing@cnstoolrepair.com',
  footerPhone: '778-488-0777',
  footerWebsite: 'cnstoolrepair.com',
  footerLabel: 'Supplier & Parts Inquiries',
  cc: '',
  bcc: '',
  fromEmail: '',
  fromName: '',
};

const DEFAULT_WO_EMAIL_TEMPLATE = {
  fromEmail: 'service@cnstoolrepair.com',
  fromName: 'CNS Tool Repair',
  defaultSubject: 'Your Work Order {work_order_number} - CNS Tool Repair',
  greeting: 'Hi {customer_name},',
  bodyText: 'Thank you for bringing your tool(s) in for service. Please find your work order attached. We will be in touch once our technician has had a chance to assess your equipment.',
  closingText: 'If you have any questions, feel free to reply to this email or give us a call.',
  footerTagline: 'Industrial Pneumatic Tool Repair & Maintenance',
  footerEmail: 'service@cnstoolrepair.com',
  footerPhone: '(236) 885-9782',
  footerWebsite: 'cnstoolrepair.com',
  cc: '',
  bcc: '',
};

export default function RepairTrackerTab() {
  const { settings, refreshSettings } = useSettings();
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notification, setNotification] = useState(null);

  // Work Order Email Template
  const [woEmailTemplate, setWoEmailTemplate] = useState(DEFAULT_WO_EMAIL_TEMPLATE);
  const savedWoTemplate = useRef(DEFAULT_WO_EMAIL_TEMPLATE);
  const [savingWoTemplate, setSavingWoTemplate] = useState(false);

  // Sourcing Email Template
  const [sourcingEmailTemplate, setSourcingEmailTemplate] = useState(DEFAULT_SOURCING_EMAIL_TEMPLATE);
  const savedSourcingTemplate = useRef(DEFAULT_SOURCING_EMAIL_TEMPLATE);
  const [savingSourcingTemplate, setSavingSourcingTemplate] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await serviceAgreementAPI.get();
        setFormData(data);
      } catch (error) {
        console.error('Failed to fetch service agreement:', error);
      }
      try {
        const s = await settingsAPI.get();
        if (s.workOrderEmailTemplate) {
          const loaded = { ...DEFAULT_WO_EMAIL_TEMPLATE, ...s.workOrderEmailTemplate };
          setWoEmailTemplate(loaded);
          savedWoTemplate.current = loaded;
        }
        if (s.sourcingEmailTemplate) {
          const loaded = { ...DEFAULT_SOURCING_EMAIL_TEMPLATE, ...s.sourcingEmailTemplate };
          setSourcingEmailTemplate(loaded);
          savedSourcingTemplate.current = loaded;
        }
      } catch (error) {
        console.error('Failed to fetch email templates:', error);
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

  const updateWoTemplate = (field, value) => {
    setWoEmailTemplate(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveWoTemplate = async () => {
    setSavingWoTemplate(true);
    try {
      const current = await settingsAPI.get();
      await settingsAPI.update({ ...current, workOrderEmailTemplate: woEmailTemplate });
      savedWoTemplate.current = woEmailTemplate;
      await refreshSettings();
      showNotification('Work order email template saved!', 'success');
    } catch {
      showNotification('Failed to save work order email template.', 'error');
    } finally {
      setSavingWoTemplate(false);
    }
  };

  const woTemplateDirty = JSON.stringify(woEmailTemplate) !== JSON.stringify(savedWoTemplate.current);

  const updateSourcingTemplate = (field, value) => {
    setSourcingEmailTemplate(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSourcingTemplate = async () => {
    setSavingSourcingTemplate(true);
    try {
      const current = await settingsAPI.get();
      await settingsAPI.update({ ...current, sourcingEmailTemplate: sourcingEmailTemplate });
      savedSourcingTemplate.current = sourcingEmailTemplate;
      await refreshSettings();
      showNotification('Sourcing email template saved!', 'success');
    } catch {
      showNotification('Failed to save sourcing email template.', 'error');
    } finally {
      setSavingSourcingTemplate(false);
    }
  };

  const sourcingTemplateDirty = JSON.stringify(sourcingEmailTemplate) !== JSON.stringify(savedSourcingTemplate.current);

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

      {/* Repair Tracker Settings */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-black text-white uppercase tracking-tight">General Settings</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-3 flex-1 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
            <span className="material-symbols-outlined text-amber-500 text-xl flex-shrink-0">warning</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">Stale Job Threshold</p>
              <p className="text-[11px] text-slate-400">Tools with no status update for this many days are flagged as stale in the dashboard.</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="number" min="1" max="30"
                value={settings?.staleDays ?? 3}
                onChange={async (e) => {
                  const val = Math.max(1, Math.min(30, parseInt(e.target.value) || 3));
                  setSavingSettings(true);
                  try {
                    await settingsAPI.update({ ...settings, staleDays: val });
                    await refreshSettings();
                  } catch { showNotification('Failed to save setting.', 'error'); }
                  finally { setSavingSettings(false); }
                }}
                disabled={savingSettings}
                className="w-14 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white text-center focus:border-primary focus:outline-none"
              />
              <span className="text-xs text-slate-400">days</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-1 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
            <span className="material-symbols-outlined text-green-500 text-xl flex-shrink-0">sell</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">Default Parts Markup</p>
              <p className="text-[11px] text-slate-400">When a part cost is entered, the selling price is auto-calculated using this markup. The price can still be edited manually.</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="number" min="0" max="500" step="1"
                value={settings?.defaultMarkupPercentage ?? 30}
                onChange={async (e) => {
                  const val = Math.max(0, Math.min(500, parseFloat(e.target.value) || 0));
                  setSavingSettings(true);
                  try {
                    await settingsAPI.update({ ...settings, defaultMarkupPercentage: val });
                    await refreshSettings();
                  } catch { showNotification('Failed to save setting.', 'error'); }
                  finally { setSavingSettings(false); }
                }}
                disabled={savingSettings}
                className="w-14 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white text-center focus:border-primary focus:outline-none"
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Work Order Email Template */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-base">mail</span>
              Work Order Email Template
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Customize the email sent to customers when you email their work order from the repair tracker.
              Use <code className="bg-slate-700 px-1 rounded text-blue-300 text-xs">{'{work_order_number}'}</code>,{' '}
              <code className="bg-slate-700 px-1 rounded text-blue-300 text-xs">{'{customer_name}'}</code>,{' '}
              <code className="bg-slate-700 px-1 rounded text-blue-300 text-xs">{'{company_name}'}</code> as variables.
            </p>
          </div>
          {woTemplateDirty && (
            <button
              onClick={handleSaveWoTemplate}
              disabled={savingWoTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-sm">{savingWoTemplate ? 'refresh' : 'save'}</span>
              {savingWoTemplate ? 'Saving…' : 'Save Template'}
            </button>
          )}
        </div>

        {/* Sender */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Sender</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">From Email</label>
              <input
                type="email"
                value={woEmailTemplate.fromEmail}
                onChange={e => updateWoTemplate('fromEmail', e.target.value)}
                placeholder="service@cnstoolrepair.com"
                className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">From Name</label>
              <input
                type="text"
                value={woEmailTemplate.fromName}
                onChange={e => updateWoTemplate('fromName', e.target.value)}
                placeholder="CNS Tool Repair"
                className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Subject & Greeting */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Message</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Default Subject</label>
              <input
                type="text"
                value={woEmailTemplate.defaultSubject}
                onChange={e => updateWoTemplate('defaultSubject', e.target.value)}
                placeholder="Your Work Order {work_order_number} - CNS Tool Repair"
                className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Greeting</label>
              <input
                type="text"
                value={woEmailTemplate.greeting}
                onChange={e => updateWoTemplate('greeting', e.target.value)}
                placeholder="Hi {customer_name},"
                className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Body Text</label>
              <textarea
                value={woEmailTemplate.bodyText}
                onChange={e => updateWoTemplate('bodyText', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Closing Text</label>
              <textarea
                value={woEmailTemplate.closingText}
                onChange={e => updateWoTemplate('closingText', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Footer</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Tagline</label>
              <input type="text" value={woEmailTemplate.footerTagline} onChange={e => updateWoTemplate('footerTagline', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Footer Email</label>
              <input type="email" value={woEmailTemplate.footerEmail} onChange={e => updateWoTemplate('footerEmail', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Footer Phone</label>
              <input type="text" value={woEmailTemplate.footerPhone} onChange={e => updateWoTemplate('footerPhone', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Footer Website</label>
              <input type="text" value={woEmailTemplate.footerWebsite} onChange={e => updateWoTemplate('footerWebsite', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* CC / BCC */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">CC / BCC</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">CC <span className="font-normal text-slate-500">(comma-separated)</span></label>
              <input type="text" value={woEmailTemplate.cc} onChange={e => updateWoTemplate('cc', e.target.value)} placeholder="e.g. manager@company.com" className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">BCC <span className="font-normal text-slate-500">(comma-separated)</span></label>
              <input type="text" value={woEmailTemplate.bcc} onChange={e => updateWoTemplate('bcc', e.target.value)} placeholder="e.g. records@company.com" className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {woTemplateDirty && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveWoTemplate}
              disabled={savingWoTemplate}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-base">{savingWoTemplate ? 'refresh' : 'save'}</span>
              {savingWoTemplate ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        )}
      </div>

      {/* Sourcing Email Template */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-base">forward_to_inbox</span>
              Sourcing Email Template
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Customize the email sent to suppliers when requesting parts pricing from the sourcing queue.
            </p>
          </div>
          {sourcingTemplateDirty && (
            <button
              onClick={handleSaveSourcingTemplate}
              disabled={savingSourcingTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-sm">{savingSourcingTemplate ? 'refresh' : 'save'}</span>
              {savingSourcingTemplate ? 'Saving…' : 'Save Template'}
            </button>
          )}
        </div>

        {/* Sender */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Sender</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">From Email <span className="font-normal text-slate-500">(optional, overrides default)</span></label>
              <input type="email" value={sourcingEmailTemplate.fromEmail} onChange={e => updateSourcingTemplate('fromEmail', e.target.value)} placeholder="purchasing@cnstoolrepair.com" className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">From Name <span className="font-normal text-slate-500">(optional)</span></label>
              <input type="text" value={sourcingEmailTemplate.fromName} onChange={e => updateSourcingTemplate('fromName', e.target.value)} placeholder="CNS Tool Repair" className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* Message */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Message</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Subject</label>
              <input type="text" value={sourcingEmailTemplate.defaultSubject} onChange={e => updateSourcingTemplate('defaultSubject', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Greeting</label>
              <input type="text" value={sourcingEmailTemplate.greeting} onChange={e => updateSourcingTemplate('greeting', e.target.value)} placeholder="Hi" className="w-full sm:w-48 px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Body Text</label>
              <textarea rows={3} value={sourcingEmailTemplate.bodyText} onChange={e => updateSourcingTemplate('bodyText', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Closing Text</label>
              <input type="text" value={sourcingEmailTemplate.closingText} onChange={e => updateSourcingTemplate('closingText', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Footer</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Tagline</label>
              <input type="text" value={sourcingEmailTemplate.footerTagline} onChange={e => updateSourcingTemplate('footerTagline', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Footer Label</label>
              <input type="text" value={sourcingEmailTemplate.footerLabel} onChange={e => updateSourcingTemplate('footerLabel', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Footer Email</label>
              <input type="email" value={sourcingEmailTemplate.footerEmail} onChange={e => updateSourcingTemplate('footerEmail', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Footer Phone</label>
              <input type="text" value={sourcingEmailTemplate.footerPhone} onChange={e => updateSourcingTemplate('footerPhone', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Footer Website</label>
              <input type="text" value={sourcingEmailTemplate.footerWebsite} onChange={e => updateSourcingTemplate('footerWebsite', e.target.value)} className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* CC / BCC */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">CC / BCC</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">CC <span className="font-normal text-slate-500">(comma-separated)</span></label>
              <input type="text" value={sourcingEmailTemplate.cc} onChange={e => updateSourcingTemplate('cc', e.target.value)} placeholder="e.g. manager@company.com" className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">BCC <span className="font-normal text-slate-500">(comma-separated)</span></label>
              <input type="text" value={sourcingEmailTemplate.bcc} onChange={e => updateSourcingTemplate('bcc', e.target.value)} placeholder="e.g. records@company.com" className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {sourcingTemplateDirty && (
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setSourcingEmailTemplate(DEFAULT_SOURCING_EMAIL_TEMPLATE)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Reset to defaults
            </button>
            <button
              onClick={handleSaveSourcingTemplate}
              disabled={savingSourcingTemplate}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-base">{savingSourcingTemplate ? 'refresh' : 'save'}</span>
              {savingSourcingTemplate ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        )}
      </div>

      {/* Service Agreement */}
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
