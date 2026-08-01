import { useState, useEffect } from 'react';
import { businessesAPI, savedRoutesAPI, zonesAPI } from '../../services/api';
import { useToast } from '../../pages/sales/SalesDashboard';
import { formatPhone, isPhoneSubmittable } from '../../utils/phone';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import { INTEREST_META, INTEREST_LEVELS } from './ui';
import { groupZones } from './zoneTree';

function ZoneChip({ zone, on, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(zone.id)}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
        on
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <span className="material-symbols-outlined text-sm">
        {on ? 'check_circle' : 'add_circle'}
      </span>
      {zone.name}
    </button>
  );
}

export default function BusinessForm({ business, zones, defaultZoneIds, onSuccess, onClose }) {
  const showToast = useToast();
  useEscapeClose(onClose);
  const [form, setForm] = useState({
    company_name: business?.company_name || '',
    google_maps_link: business?.google_maps_link || '',
    zone_ids: business?.zone_ids?.length ? [...business.zone_ids] : (defaultZoneIds || []),
    contact_first_name: business?.contact_first_name || '',
    contact_last_name: business?.contact_last_name || '',
    phone: formatPhone(business?.phone),
    email: business?.email || '',
    address: business?.address || '',
    notes: business?.notes || '',
    interest_level: business?.interest_level || 'cold',
  });
  const [saving, setSaving] = useState(false);

  // Live duplicate check: as the name settles, look for an existing business
  // with the same name (case/spacing-insensitive). The server hard-rejects
  // duplicates anyway — this just says so before the user fills the rest in.
  const [dupMatch, setDupMatch] = useState(null);
  useEffect(() => {
    const name = form.company_name.trim();
    if (!name) { setDupMatch(null); return undefined; }
    // Search with the collapsed form — a stray double space in the input
    // would otherwise miss the single-spaced stored name entirely.
    const norm = name.replace(/\s+/g, ' ').toLowerCase();
    // The in-flight request outlives the name it was asked about: clear the
    // field while one is pending and its answer would otherwise land as a
    // duplicate warning under an empty box.
    let cancelled = false;
    const t = setTimeout(() => {
      businessesAPI.list({ search: norm, limit: 10 })
        .then(({ data }) => {
          if (cancelled) return;
          const hit = data.find(
            (b) => b.company_name.replace(/\s+/g, ' ').toLowerCase() === norm
              && b.id !== business?.id
          );
          setDupMatch(hit || null);
        })
        .catch(() => { if (!cancelled) setDupMatch(null); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.company_name, business?.id]);

  // Standing-route membership: designate this business to one or more saved
  // routes right here, instead of editing every route it belongs to.
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [routeIds, setRouteIds] = useState([]);
  const [initialRouteIds, setInitialRouteIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    savedRoutesAPI.list()
      .then((all) => {
        if (cancelled) return;
        setSavedRoutes(all);
        if (business) {
          const mine = all.filter(r => (r.business_ids || []).includes(business.id)).map(r => r.id);
          setRouteIds(mine);
          setInitialRouteIds(mine);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [business]);

  const toggleRoute = (routeId) => setRouteIds(prev => (
    prev.includes(routeId) ? prev.filter(r => r !== routeId) : [...prev, routeId]
  ));

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const setPhone = (e) => {
    setForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }));
  };

  const toggleZone = (zoneId) => setForm(prev => ({
    ...prev,
    zone_ids: prev.zone_ids.includes(zoneId)
      ? prev.zone_ids.filter(z => z !== zoneId)
      : [...prev.zone_ids, zoneId],
  }));

  // A zone is required, so on a fresh database (or a brand-new area) the form
  // can mint one right here instead of forcing a detour to the Zones tab.
  const [createdZones, setCreatedZones] = useState([]);
  const [newZoneName, setNewZoneName] = useState('');
  const [creatingZone, setCreatingZone] = useState(false);
  const allZones = [...zones, ...createdZones];

  const handleCreateZone = async () => {
    const zoneName = newZoneName.trim();
    if (!zoneName || creatingZone) return;
    setCreatingZone(true);
    try {
      const created = await zonesAPI.create({ name: zoneName, description: '', parent_id: null });
      setCreatedZones(prev => [...prev, created]);
      // Auto-select — creating it here means this business belongs in it.
      setForm(prev => ({ ...prev, zone_ids: [...prev.zone_ids, created.id] }));
      setNewZoneName('');
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to create the zone.'));
    } finally {
      setCreatingZone(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.google_maps_link.trim() || form.zone_ids.length === 0) {
      showToast('error', 'Company name, Google Maps link, and at least one zone are required.');
      return;
    }
    if (!isPhoneSubmittable(form.phone)) {
      showToast('error', 'Phone must be a full 10-digit number including area code, e.g. 604-555-0100.');
      return;
    }
    setSaving(true);
    try {
      // Send trimmed strings rather than undefined: JSON.stringify drops undefined
      // keys, so the backend's exclude_unset would never see a cleared field.
      const payload = {
        company_name: form.company_name.trim(),
        google_maps_link: form.google_maps_link.trim(),
        zone_ids: form.zone_ids,
        contact_first_name: form.contact_first_name.trim(),
        contact_last_name: form.contact_last_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        interest_level: form.interest_level,
      };
      let saved;
      if (business) {
        saved = await businessesAPI.update(business.id, payload);
      } else {
        saved = await businessesAPI.create(payload);
      }

      // Sync saved-route membership after the business exists. Failures here
      // shouldn't eat the save itself — surface them and move on.
      const toAdd = routeIds.filter(id => !initialRouteIds.includes(id));
      const toRemove = initialRouteIds.filter(id => !routeIds.includes(id));
      if (toAdd.length || toRemove.length) {
        try {
          await Promise.all([
            ...toAdd.map(id => savedRoutesAPI.addBusiness(id, saved.id)),
            ...toRemove.map(id => savedRoutesAPI.removeBusiness(id, saved.id)),
          ]);
        } catch {
          showToast('error', 'Business saved, but updating its saved routes failed.');
        }
      }
      onSuccess();
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save business.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg mb-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {business ? 'Edit Business' : 'Add Business'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Company name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Company Name *</label>
            <input
              type="text"
              value={form.company_name}
              onChange={set('company_name')}
              required
              maxLength={200}
              placeholder="ACME Industrial Supply"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
            />
            {dupMatch && (
              <p className="mt-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 flex items-start gap-1">
                <span className="material-symbols-outlined text-sm leading-4">warning</span>
                <span>
                  &quot;{dupMatch.company_name}&quot; is already in the list
                  {dupMatch.zone_names?.length ? ` (${dupMatch.zone_names.join(', ')})` : ''}
                  {' '}&mdash; edit that one instead of adding a duplicate.
                </span>
              </p>
            )}
          </div>

          {/* Google Maps link */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Google Maps Link *</label>
            <input
              type="url"
              value={form.google_maps_link}
              onChange={set('google_maps_link')}
              required
              maxLength={2000}
              placeholder="https://maps.google.com/..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Zones — a business can sit in more than one */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Zones * <span className="font-normal normal-case tracking-normal text-slate-400">— pick one or more</span>
            </label>
            {/* Grouped by parent, so children sit under the area they belong to */}
            <div className="flex flex-col gap-3">
              {groupZones(allZones).map(({ parent, children }) => (
                <div key={parent.id}>
                  <div className="flex flex-wrap gap-2">
                    <ZoneChip zone={parent} on={form.zone_ids.includes(parent.id)} onToggle={toggleZone} />
                  </div>
                  {children.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 ml-4 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                      {children.map(c => (
                        <ZoneChip key={c.id} zone={c} on={form.zone_ids.includes(c.id)} onToggle={toggleZone} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {allZones.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                No zones yet — type a name below to create your first.
              </p>
            ) : form.zone_ids.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">No zones selected yet.</p>
            )}

            {/* Quick-create: mint a top-level zone without leaving the form */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                onKeyDown={(e) => {
                  // Enter creates the zone — it must not submit the business.
                  if (e.key === 'Enter') { e.preventDefault(); handleCreateZone(); }
                }}
                maxLength={100}
                placeholder="New zone name…"
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
              <button
                type="button"
                onClick={handleCreateZone}
                disabled={creatingZone || !newZoneName.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600/50 text-slate-600 dark:text-slate-300 hover:text-primary rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-sm ${creatingZone ? 'animate-spin' : ''}`}>
                  {creatingZone ? 'progress_activity' : 'add_location_alt'}
                </span>
                Create Zone
              </button>
            </div>
          </div>

          {/* Saved routes — optional membership in standing runs */}
          {savedRoutes.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Saved Routes <span className="font-normal normal-case tracking-normal text-slate-400">— add to standing runs</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {savedRoutes.map(sr => (
                  <ZoneChip key={sr.id} zone={sr} on={routeIds.includes(sr.id)} onToggle={toggleRoute} />
                ))}
              </div>
            </div>
          )}

          {/* Interest level — same quiet dot selector as the visit logger */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Interest Level</label>
            <div className="flex gap-2">
              {INTEREST_LEVELS.map(lvl => {
                const meta = INTEREST_META[lvl];
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, interest_level: lvl }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-xs uppercase transition-all ${
                      form.interest_level === lvl
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

          {/* Row: Contact First + Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Contact First Name</label>
              <input
                type="text"
                value={form.contact_first_name}
                onChange={set('contact_first_name')}
                maxLength={50}
                placeholder="Jane"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Contact Last Name</label>
              <input
                type="text"
                value={form.contact_last_name}
                onChange={set('contact_last_name')}
                maxLength={50}
                placeholder="Smith"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Row: Email + Phone */}
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
              className="flex-1 py-3 bg-primary hover:bg-primary/90 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white font-black rounded-xl transition-colors uppercase text-sm"
            >
              {saving ? 'Saving...' : business ? 'Save Changes' : 'Add Business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
