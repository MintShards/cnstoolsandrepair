import { useState } from 'react';
import { visitsAPI } from '../../services/api';
import { useToast } from '../../pages/sales/SalesDashboard';
import { apiErrorMessage } from '../../utils/apiError';
import { getTodayPacific } from '../../utils/dateFormat';
import useEscapeClose from '../../utils/useEscapeClose';
import { INTEREST_META, INTEREST_LEVELS } from './ui';

export default function VisitLogger({ businessId, businessName, routeId, initialInterest, onSuccess, onClose }) {
  const showToast = useToast();
  // Start from the business's current level — defaulting to cold silently
  // downgraded a warm lead whenever the rep forgot to re-pick it.
  const [interestLevel, setInterestLevel] = useState(
    INTEREST_META[initialInterest] ? initialInterest : 'cold'
  );
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await visitsAPI.create({
        business_id: businessId,
        route_id: routeId || undefined,
        interest_level: interestLevel,
        notes: notes.trim() || undefined,
        follow_up_date: followUpDate || undefined,
        follow_up_note: followUpNote.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to log visit.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Log Visit</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{businessName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          {/* Interest Level */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Interest Level *</label>
            <div className="flex gap-2">
              {INTEREST_LEVELS.map((value) => {
                const meta = INTEREST_META[value];
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setInterestLevel(value)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-bold text-xs uppercase ${
                      interestLevel === value
                        ? 'border-primary bg-primary/5 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Visit Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={5000}
              placeholder="What was discussed? Any relevant details..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* Follow-up */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Follow-up Date</label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              min={getTodayPacific()}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {followUpDate && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Follow-up Note</label>
              <input
                type="text"
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                maxLength={500}
                placeholder="What to follow up on..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          )}

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
              className="flex-1 py-3 bg-primary hover:bg-primary/90 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white font-black rounded-xl transition-colors uppercase text-sm"
            >
              {saving ? 'Saving...' : 'Log Visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
