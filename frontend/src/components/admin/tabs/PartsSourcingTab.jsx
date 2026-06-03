import { useState, useEffect } from 'react';
import { sourcingAPI, suppliersAPI, repairsAPI } from '../../../services/api';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../pages/admin/RepairTracker';
import SourcingQueue from './parts-sourcing/SourcingQueue';
import RecipientSelector from './parts-sourcing/RecipientSelector';
import SourcingHistory from './parts-sourcing/SourcingHistory';
import SupplierManager from './parts-sourcing/SupplierManager';

export default function PartsSourcingTab() {
  const { settings } = useSettings();
  const emailTemplate = settings?.sourcingEmailTemplate || {};
  const showToast = useToast();
  const [queue, setQueue] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selected, setSelected] = useState(new Set()); // Set of "repairId-toolIdx-partIdx" keys
  const [selectedItems, setSelectedItems] = useState({}); // key -> item map

  // Manual parts — persisted to localStorage so they survive page refreshes
  const [manualParts, setManualParts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sourcingManualParts') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem('sourcingManualParts', JSON.stringify(manualParts));
  }, [manualParts]);

  // Recipients
  const [recipients, setRecipients] = useState([]);

  // Email compose
  const [message, setMessage] = useState('');

  // Send state
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [q, s] = await Promise.all([
          sourcingAPI.getQueue(),
          suppliersAPI.getAll(),
        ]);
        setQueue(q);
        setSuppliers(s);
      } catch (e) {
        showToast('error', 'Failed to load sourcing queue.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleToggle = (key, item) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setSelectedItems((prev) => {
      if (prev[key]) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: item };
    });
  };

  const handleSelectAll = (selectAll) => {
    if (selectAll) {
      const keys = new Set();
      const items = {};
      queue.forEach((item) => {
        const key = `${item.repair_id}-${item.tool_index}-${item.part_index}`;
        keys.add(key);
        items[key] = item;
      });
      manualParts.forEach((part, idx) => {
        if (part.name.trim() && part.part_number?.trim()) {
          const key = `manual-${idx}`;
          keys.add(key);
          items[key] = { manual: true, index: idx, part };
        }
      });
      setSelected(keys);
      setSelectedItems(items);
    } else {
      setSelected(new Set());
      setSelectedItems({});
    }
  };

  const handleRemove = async (item) => {
    if (item.manual) {
      // Manual part — remove from manualParts state only, no API call
      setManualParts((prev) => prev.filter((_, i) => i !== item.index));
      const key = `manual-${item.index}`;
      setSelected((prev) => { const next = new Set(prev); next.delete(key); return next; });
      setSelectedItems((prev) => { const { [key]: _, ...rest } = prev; return rest; });
      return;
    }
    try {
      await repairsAPI.togglePartSourcing(item.repair_id, item.tool_id, item.part_index);
      const key = `${item.repair_id}-${item.tool_index}-${item.part_index}`;
      setSelected((prev) => { const next = new Set(prev); next.delete(key); return next; });
      setSelectedItems((prev) => { const { [key]: _, ...rest } = prev; return rest; });
      const q = await sourcingAPI.getQueue();
      setQueue(q);
    } catch (e) {
      showToast('error', 'Failed to remove part from queue.');
    }
  };

  const handleRemoveSelected = async () => {
    const allItems = Object.values(selectedItems);
    const queueItems = allItems.filter((item) => !item.manual);
    const manualItems = allItems.filter((item) => item.manual);
    try {
      await Promise.all(
        queueItems.map((item) => repairsAPI.togglePartSourcing(item.repair_id, item.tool_id, item.part_index))
      );
      // Remove selected manual parts by index (descending to keep indices stable)
      if (manualItems.length > 0) {
        const indicesToRemove = new Set(manualItems.map((item) => item.index));
        setManualParts((prev) => prev.filter((_, i) => !indicesToRemove.has(i)));
      }
      setSelected(new Set());
      setSelectedItems({});
      if (queueItems.length > 0) {
        const q = await sourcingAPI.getQueue();
        setQueue(q);
      }
      showToast('success', `Removed ${allItems.length} part${allItems.length !== 1 ? 's' : ''} from queue.`);
    } catch (e) {
      showToast('error', 'Failed to remove selected parts.');
    }
  };

  const buildPartsPayload = () => {
    const fromQueue = Object.values(selectedItems)
      .filter((item) => !item.manual)
      .map((item) => ({
        name: item.part.name,
        part_number: item.part.part_number || null,
        quantity: item.part.quantity,
        repair_id: item.repair_id,
        request_number: item.request_number,
        tool_index: item.tool_index,
        part_index: item.part_index,
      }));
    const fromManual = Object.values(selectedItems)
      .filter((item) => item.manual)
      .map((item) => ({
        name: item.part.name.trim(),
        part_number: item.part.part_number.trim(),
        quantity: item.part.quantity || 1,
      }));
    return [...fromQueue, ...fromManual];
  };

  const totalParts = selected.size;
  const canSend = totalParts > 0 && recipients.length > 0 && !sending;

  const handleSend = async () => {
    setSending(true);
    setShowConfirm(false);

    try {
      const result = await sourcingAPI.send({
        recipients,
        parts: buildPartsPayload(),
        subject: undefined,
        message: message.trim() || undefined,
      });

      if (result.status === 'sent') {
        showToast('success', `Sent to ${result.sent_count} supplier${result.sent_count !== 1 ? 's' : ''} successfully.`);
        setSelected(new Set());
        setSelectedItems({});
        setManualParts([]);
        setRecipients([]);
        setMessage('');
        const q = await sourcingAPI.getQueue();
        setQueue(q);
      } else if (result.status === 'partial_failure') {
        showToast('error', `Sent to ${result.sent_count}, failed for ${result.failed_count}. Check history for details.`);
        const q = await sourcingAPI.getQueue();
        setQueue(q);
      } else {
        showToast('error', 'All emails failed to send. Check email settings.');
      }
    } catch (e) {
      showToast('error', e?.response?.data?.detail || 'Failed to send emails.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-orange-500 dark:text-orange-400 text-xs uppercase tracking-[0.25em] font-semibold mb-2">Purchasing</p>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase">Parts Sourcing</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Select parts flagged for sourcing, pick suppliers, and send bulk pricing request emails.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
        </div>
      ) : (
        <>
          {/* Section 1: Parts */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary">queue</span>
              Parts
            </h3>
            <SourcingQueue
              items={queue}
              selected={selected}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onRemove={handleRemove}
              onRemoveSelected={handleRemoveSelected}
              manualParts={manualParts}
              onManualPartsChange={setManualParts}
              onUpdateQuantity={async (idx, qty) => {
                // Update local state immediately for responsive UI
                setQueue(prev => prev.map((item, i) => i === idx ? { ...item, part: { ...item.part, quantity: qty } } : item));
                // Persist to backend
                const item = queue[idx];
                if (!item || !item.repair_id || !item.tool_id || qty === '' || qty < 1) return;
                try {
                  const job = await repairsAPI.get(item.repair_id);
                  const tool = job.tools?.find(t => t.tool_id === item.tool_id);
                  if (!tool) return;
                  const updatedParts = tool.parts.map((p, pi) =>
                    pi === item.part_index ? { ...p, quantity: qty } : p
                  );
                  await repairsAPI.updateTool(item.repair_id, item.tool_id, { parts: updatedParts });
                } catch {
                  showToast('error', 'Failed to save quantity change.');
                }
              }}
            />
          </section>

          {/* Section 3: Recipients */}
          <section className="border-t border-slate-200 dark:border-slate-700/50 pt-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary">email</span>
              Recipients
            </h3>
            <RecipientSelector
              suppliers={suppliers}
              recipients={recipients}
              onChange={setRecipients}
            />
          </section>

          {/* Section 4: Supplier management */}
          <section className="border-t border-slate-200 dark:border-slate-700/50 pt-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary">inventory</span>
              Suppliers
            </h3>
            <SupplierManager suppliers={suppliers} onSuppliersChange={setSuppliers} />
          </section>

          {/* Section 5: Message */}
          <section className="border-t border-slate-200 dark:border-slate-700/50 pt-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary">forward_to_inbox</span>
              Email
            </h3>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                Message <span className="text-slate-400 dark:text-slate-500">(optional additional note)</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. We need these urgently, please advise availability..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:outline-none resize-none transition-colors"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Appears above the parts table. To edit the email template, go to <strong>Admin Settings → Repair Tracker</strong>.
              </p>
            </div>
          </section>

          {/* Send button */}
          <section className="border-t border-slate-200 dark:border-slate-700/50 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {totalParts > 0 || recipients.length > 0 ? (
                  <span>
                    <span className="text-slate-900 dark:text-white font-semibold">{totalParts}</span> part{totalParts !== 1 ? 's' : ''} →{' '}
                    <span className="text-slate-900 dark:text-white font-semibold">{recipients.length}</span> supplier{recipients.length !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">Select parts and recipients to send</span>
                )}
              </div>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!canSend}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-colors uppercase tracking-wide"
              >
                {sending ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                    Sending...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">send</span>
                    Send Emails
                  </>
                )}
              </button>
            </div>
          </section>

          {/* History */}
          <section className="border-t border-slate-200 dark:border-slate-700/50 pt-6">
            <SourcingHistory />
          </section>
        </>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (() => {
        const confirmParts = buildPartsPayload();
        const ccTrimmed = (emailTemplate.cc || '').trim();
        const bccTrimmed = (emailTemplate.bcc || '').trim();
        const msgTrimmed = message.trim();
        return (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-w-md w-full flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="flex items-center gap-3 px-6 pt-6 pb-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg">send</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">Confirm Send</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {totalParts} part{totalParts !== 1 ? 's' : ''} → {recipients.length} supplier{recipients.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto px-6 pb-2 space-y-4 flex-1">

                {/* Parts */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Parts ({confirmParts.length})
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden">
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
                      {confirmParts.map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{p.name}</p>
                            {p.part_number && (
                              <p className="text-xs text-slate-400 dark:text-slate-500">{p.part_number}</p>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">×{p.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recipients */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">To</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recipients.map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                        <span className="material-symbols-outlined text-xs" style={{ fontSize: '12px' }}>person</span>
                        {r.name ? `${r.name}` : r.email}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                  {(emailTemplate.fromEmail || emailTemplate.fromName) && (
                    <div className="flex gap-2 px-3 py-2.5">
                      <span className="text-slate-400 dark:text-slate-500 w-14 flex-shrink-0">From</span>
                      <span className="text-slate-900 dark:text-white break-all">
                        {emailTemplate.fromName && emailTemplate.fromEmail
                          ? `${emailTemplate.fromName} <${emailTemplate.fromEmail}>`
                          : emailTemplate.fromEmail || emailTemplate.fromName}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2 px-3 py-2.5">
                    <span className="text-slate-400 dark:text-slate-500 w-14 flex-shrink-0">Subject</span>
                    <span className="text-slate-900 dark:text-white">{emailTemplate.defaultSubject}</span>
                  </div>
                  {ccTrimmed && (
                    <div className="flex gap-2 px-3 py-2.5">
                      <span className="text-slate-400 dark:text-slate-500 w-14 flex-shrink-0">CC</span>
                      <span className="text-slate-900 dark:text-white break-all">{ccTrimmed}</span>
                    </div>
                  )}
                  {bccTrimmed && (
                    <div className="flex gap-2 px-3 py-2.5">
                      <span className="text-slate-400 dark:text-slate-500 w-14 flex-shrink-0">BCC</span>
                      <span className="text-slate-900 dark:text-white break-all">{bccTrimmed}</span>
                    </div>
                  )}
                  {msgTrimmed && (
                    <div className="flex gap-2 px-3 py-2.5">
                      <span className="text-slate-400 dark:text-slate-500 w-14 flex-shrink-0">Note</span>
                      <span className="text-slate-900 dark:text-white line-clamp-2">{msgTrimmed}</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Actions */}
              <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-sm rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white font-bold text-sm rounded-xl transition-colors uppercase"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  Send Now
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
