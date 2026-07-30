import { useState } from 'react';
import { businessesAPI } from '../../services/api';
import { useToast } from '../../pages/sales/SalesDashboard';
import { formatPhone, isPhoneSubmittable } from '../../utils/phone';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';

export default function ConvertToCustomerForm({ business, onSuccess, onClose }) {
  const showToast = useToast();
  useEscapeClose(onClose);
  const [form, setForm] = useState({
    first_name: business?.contact_first_name || '',
    last_name: business?.contact_last_name || '',
    company_name: business?.company_name || '',
    email: business?.email || '',
    phone: formatPhone(business?.phone),
    address: business?.address || '',
    notes: business?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const setPhone = (e) => {
    setForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      showToast('error', 'First name and last name are required.');
      return;
    }
    if (!isPhoneSubmittable(form.phone)) {
      showToast('error', 'Phone must be a full 10-digit number including area code, e.g. 604-555-0100.');
      return;
    }
    setSaving(true);
    try {
      await businessesAPI.convertToCustomer(business.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        company_name: form.company_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      });
      onSuccess();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to convert to customer.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md mb-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Convert to Customer</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{business.company_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-5 pt-4 pb-0">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              These 7 fields will be added to the Repair Tracker. Visit history, interest level, and all route management data stay in Route Management only.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Row 1: First + Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">First Name *</label>
              <input
                type="text"
                value={form.first_name}
                onChange={set('first_name')}
                required
                maxLength={50}
                placeholder="Jane"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Last Name *</label>
              <input
                type="text"
                value={form.last_name}
                onChange={set('last_name')}
                required
                maxLength={50}
                placeholder="Smith"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Row 2: Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="contact@company.com"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={setPhone}
                placeholder="604-555-0100"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={set('address')}
              maxLength={500}
              placeholder="123 Industrial Ave, Surrey, BC"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              maxLength={2000}
              placeholder="Any notes about this prospect..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white font-black rounded-xl transition-colors uppercase text-sm"
            >
              {saving ? 'Converting...' : 'Convert to Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
