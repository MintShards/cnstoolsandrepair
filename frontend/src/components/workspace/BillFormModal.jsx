import { useState, useEffect, useRef, useId } from 'react';
import { billsAPI, suppliersAPI, repairsAPI } from '../../services/api';
import { useToast } from '../admin/shared/ToastProvider';
import { apiErrorMessage } from '../../utils/apiError';
import useEscapeClose from '../../utils/useEscapeClose';
import useBodyScrollLock from '../../utils/useBodyScrollLock';
import { INPUT_CLS, AMOUNT_INPUT_CLS, LABEL_CLS, CANCEL_BTN_CLS, SUBMIT_BTN_CLS, pillCls } from './formStyles';
import { BTN_NEUTRAL } from '../sales/ui';
import {
  BILL_CATEGORY_LIST, BILL_LINE_KIND_LIST, PAYMENT_METHOD_LIST, CURRENCIES, GST_RATE, PST_RATE,
} from '../../constants/bills';
import { formatMoney, round2 } from '../../utils/money';
import { toolLabel } from '../../utils/jobAccounting';
import { getTodayPacific } from '../../utils/dateFormat';
import WorkOrderPicker from './WorkOrderPicker';

const MAX_FILES = 10;
const noop = () => {};
// Small labels inside the amounts and lines blocks (the big ones use LABEL_CLS).
const MINI_LABEL = 'block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1';

const numStr = (n) => (n === null || n === undefined ? '' : String(n));
const num = (s) => {
  const v = parseFloat(String(s).replace(/[$,\s]/g, ''));
  return Number.isNaN(v) ? null : v;
};
const numOrNull = (s) => (String(s).trim() === '' ? null : num(s));
let lineKey = 0;
const newLine = (line = {}) => ({
  key: `l${lineKey += 1}`,
  description: line.description || '',
  part_number: line.part_number || '',
  quantity: numStr(line.quantity ?? 1),
  unit_price: numStr(line.unit_price),
  // What the line paid for (parts vs additional expenses) and, on a linked
  // work order, which tool it was for — this is what per-tool profit hangs on.
  kind: line.kind || 'part',
  tool_id: line.tool_id || null,
  workOrder: line.repair_id ? { repair_id: line.repair_id, request_number: line.request_number } : null,
  linking: false,
});
/** Something typed on the line besides the description — worth stopping for, not dropping. */
const lineHasContent = (l) => Boolean(l.part_number.trim() || l.unit_price.trim() || l.workOrder);

/**
 * Supplier picker: type to filter the active suppliers, or keep the typed
 * name as a one-off supplier, or add it to the directory right here.
 */
function SupplierPicker({ inputId, value, suppliers, onChange, onCreated }) {
  const showToast = useToast();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (value) {
    return (
      <div>
        <p className={LABEL_CLS}>Supplier *</p>
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-primary/5 border border-primary/30 rounded-xl">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-primary dark:text-blue-400 min-w-0">
            <span className="material-symbols-outlined text-base">storefront</span>
            <span className="truncate">{value.supplier_name}</span>
            {!value.supplier_id && <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">one-off</span>}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Change supplier"
            title="Change supplier"
            className="w-11 h-11 -my-2.5 -mr-1 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const matches = (needle
    ? suppliers.filter((s) => s.name.toLowerCase().includes(needle))
    : suppliers).slice(0, 8);
  const exact = suppliers.find((s) => s.name.toLowerCase() === needle) || null;

  const pick = (supplier) => {
    onChange({ supplier_id: supplier.id, supplier_name: supplier.name });
    setQuery('');
    setOpen(false);
  };

  const pickTyped = () => {
    onChange({ supplier_id: null, supplier_name: query.trim() });
    setQuery('');
    setOpen(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await suppliersAPI.create({ name: query.trim() });
      onCreated();
      pick(created);
      showToast('success', `${created.name} added to suppliers.`);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Could not add the supplier.'));
    } finally {
      setCreating(false);
    }
  };

  const listOpen = open && (matches.length > 0 || Boolean(needle));

  // Enter takes the obvious pick (an exact name, else the first match, else
  // the typed name as a one-off) instead of submitting the whole bill;
  // Escape closes just the list when one is showing — otherwise it falls
  // through to the modal's own Escape.
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!needle) return;
      if (exact) pick(exact);
      else if (matches.length) pick(matches[0]);
      else pickTyped();
    } else if (e.key === 'Escape' && listOpen) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={inputId} className={LABEL_CLS}>Supplier *</label>
      <input
        id={inputId}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Type a supplier name…"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        className={INPUT_CLS}
        autoFocus
      />
      {listOpen && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-100 dark:divide-slate-700/60">
          {matches.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => pick(s)} className="w-full text-left px-4 py-2.5 min-h-11 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="block text-sm font-bold text-slate-900 dark:text-white">{s.name}</span>
                {s.contact_name && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{s.contact_name}</span>}
              </button>
            </li>
          ))}
          {needle && !exact && (
            <>
              <li>
                <button
                  type="button"
                  onClick={pickTyped}
                  className="w-full text-left px-4 py-2.5 min-h-11 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <span className="material-symbols-outlined text-base align-middle mr-1">storefront</span>
                  Use “{query.trim()}” as a one-off supplier
                </button>
              </li>
              <li>
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreate}
                  className="w-full text-left px-4 py-2.5 min-h-11 text-sm font-bold text-primary dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base align-middle mr-1">add</span>
                  {creating ? 'Adding…' : `Add “${query.trim()}” to suppliers`}
                </button>
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}

/** Sum of the priced lines a prefill carries, so the form opens with a subtotal. */
function linesSubtotal(lines) {
  const priced = (lines || []).filter((l) => l.unit_price != null && l.unit_price !== '');
  if (!priced.length) return '';
  return String(round2(priced.reduce((s, l) => s + (Number(l.quantity) || 1) * Number(l.unit_price), 0)));
}

/**
 * Log or edit a bill. A receipt paid on the spot is logged straight in as
 * paid ("Paid already"); attachments chosen while logging upload one by one
 * after the bill exists, and are managed from the bill itself afterwards.
 * `defaults` prefills create mode — the work order dialog passes the job's
 * parts as lines and their supplier.
 */
export default function BillFormModal({ bill, defaults, suppliers, onSuppliersChange, onSaved, onClose }) {
  const showToast = useToast();
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;
  const editing = Boolean(bill);
  const fileRef = useRef(null);
  const seed = !editing ? (defaults || {}) : {};

  const [supplier, setSupplier] = useState(
    bill ? { supplier_id: bill.supplier_id || null, supplier_name: bill.supplier_name } : (seed.supplier || null),
  );
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState(bill?.vendor_invoice_number || '');
  const [category, setCategory] = useState(bill?.category || seed.category || 'parts');
  const [billDate, setBillDate] = useState(bill?.bill_date || getTodayPacific());
  const [dueDate, setDueDate] = useState(bill?.due_date || '');
  const [paidAlready, setPaidAlready] = useState(false);
  const [paidDate, setPaidDate] = useState(bill?.paid_date || getTodayPacific());
  const [paymentMethod, setPaymentMethod] = useState(bill?.payment_method || '');
  const [paymentReference, setPaymentReference] = useState(bill?.payment_reference || '');
  const [currency, setCurrency] = useState(bill?.currency || 'CAD');
  const [subtotal, setSubtotal] = useState(bill ? numStr(bill.subtotal) : linesSubtotal(seed.lines));
  const [gst, setGst] = useState(numStr(bill?.gst));
  const [pst, setPst] = useState(numStr(bill?.pst));
  const [total, setTotal] = useState(bill ? numStr(bill.total) : linesSubtotal(seed.lines));
  const [lines, setLines] = useState(() => (bill?.lines || seed.lines || []).map(newLine));
  // { repair_id: [{ tool_id, label }] } for the per-line tool picker. Seeds
  // from the work order dialog arrive with theirs; the rest are fetched once.
  const [jobTools, setJobTools] = useState(() => seed.jobTools || {});
  const [zohoBillNumber, setZohoBillNumber] = useState(bill?.zoho_bill_number || '');
  const [notes, setNotes] = useState(bill?.notes || '');
  const [files, setFiles] = useState([]);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  // Nothing closes the form mid-save: the bill may already exist and the
  // attachments still be uploading.
  useEscapeClose(saving ? noop : onClose);
  useBodyScrollLock(true);

  const showPayment = editing ? bill.status === 'paid' : paidAlready;

  useEffect(() => {
    const missing = [...new Set(lines.map((l) => l.workOrder?.repair_id).filter(Boolean))]
      .filter((id) => !jobTools[id]);
    if (!missing.length) return;
    // Mark as loading first so a re-render doesn't fetch the same job twice.
    setJobTools((m) => Object.fromEntries([...Object.entries(m), ...missing.map((id) => [id, []])]));
    missing.forEach((id) => {
      repairsAPI.get(id).then((job) => {
        const tools = (job.tools || []).map((t) => ({ tool_id: t.tool_id, label: toolLabel(t) }));
        setJobTools((m) => ({ ...m, [id]: tools }));
        // A single-tool job: its lines are that tool's without asking.
        if (tools.length === 1) {
          setLines((ls) => ls.map((l) => (l.workOrder?.repair_id === id && !l.tool_id ? { ...l, tool_id: tools[0].tool_id } : l)));
        }
      }).catch(() => {
        // No picker for that job; the line stays shared by the whole work order.
      });
    });
  }, [lines, jobTools]);

  // Soft check only — shipping, enviro fees and discounts legitimately break it.
  const s = numOrNull(subtotal);
  const t = numOrNull(total);
  const partsSum = s !== null ? round2(s + (numOrNull(gst) || 0) + (numOrNull(pst) || 0)) : null;
  const mismatch = partsSum !== null && t !== null ? round2(t - partsSum) : 0;

  const calcFromSubtotal = () => {
    if (s === null) return;
    const g = round2(s * GST_RATE);
    const p = round2(s * PST_RATE);
    setGst(String(g));
    setPst(String(p));
    setTotal(String(round2(s + g + p)));
  };

  const updateLine = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i) => setLines((ls) => ls.filter((_, j) => j !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplier) { showToast('error', 'Pick a supplier or type a name.'); return; }
    if (!(t > 0)) { showToast('error', 'Enter the bill total.'); return; }
    // A line with a part number, price or work order but no description would
    // otherwise be dropped without a word.
    const unnamed = lines.findIndex((l) => !l.description.trim() && lineHasContent(l));
    if (unnamed >= 0) { showToast('error', `Line ${unnamed + 1} needs a description — what was bought.`); return; }
    const payload = {
      supplier_id: supplier.supplier_id || null,
      supplier_name: supplier.supplier_name,
      vendor_invoice_number: vendorInvoiceNumber.trim() || null,
      category,
      bill_date: billDate || null,
      due_date: dueDate || null,
      subtotal: s,
      gst: numOrNull(gst),
      pst: numOrNull(pst),
      total: round2(t),
      currency,
      lines: lines
        .filter((l) => l.description.trim())
        .map((l) => ({
          description: l.description.trim(),
          part_number: l.part_number.trim() || null,
          quantity: num(l.quantity) > 0 ? num(l.quantity) : 1,
          unit_price: numOrNull(l.unit_price),
          kind: l.kind || 'part',
          repair_id: l.workOrder?.repair_id || null,
          tool_id: l.workOrder ? (l.tool_id || null) : null,
        })),
      zoho_bill_number: zohoBillNumber.trim() || null,
      notes: notes.trim() || null,
    };
    if (showPayment) {
      payload.paid_date = paidDate || null;
      payload.payment_method = paymentMethod || null;
      payload.payment_reference = paymentReference.trim() || null;
    }
    if (!editing) payload.status = paidAlready ? 'paid' : 'unpaid';

    setSaving(true);
    try {
      let saved = editing ? await billsAPI.update(bill.id, payload) : await billsAPI.create(payload);
      let failed = 0;
      for (let i = 0; i < files.length; i += 1) {
        setUploadIndex(i + 1);
        try {
          saved = await billsAPI.uploadAttachment(saved.id, files[i]);
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) {
        showToast('error', `Bill saved; ${failed} attachment${failed === 1 ? '' : 's'} failed — add ${failed === 1 ? 'it' : 'them'} from the bill.`);
      } else {
        showToast('success', editing ? 'Bill updated.' : `${saved.bill_number} logged.`);
      }
      onSaved(saved);
    } catch (err) {
      showToast('error', apiErrorMessage(err, 'Failed to save the bill.'));
    } finally {
      setSaving(false);
      setUploadIndex(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-4 pt-3 sm:pt-10 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={fid('title')}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-5rem)]"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 id={fid('title')} className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {editing ? `Edit ${bill.bill_number}` : 'Log a bill'}
          </h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-2 -m-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form id="bill-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-5 overflow-y-auto flex-1 min-h-0">
          <SupplierPicker inputId={fid('supplier')} value={supplier} suppliers={suppliers} onChange={setSupplier} onCreated={onSuppliersChange} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={fid('vendor')} className={LABEL_CLS}>Supplier invoice / receipt #</label>
              {/* First field to fill when the supplier came prefilled (work order dialog). */}
              <input id={fid('vendor')} type="text" value={vendorInvoiceNumber} onChange={(e) => setVendorInvoiceNumber(e.target.value)} maxLength={100} placeholder="Their number" autoFocus={Boolean(seed.supplier)} className={INPUT_CLS} />
            </div>
            <div>
              <label htmlFor={fid('category')} className={LABEL_CLS}>Category</label>
              <select id={fid('category')} value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT_CLS}>
                {BILL_CATEGORY_LIST.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={fid('bill-date')} className={LABEL_CLS}>Bill date</label>
              <input id={fid('bill-date')} type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label htmlFor={fid('due-date')} className={LABEL_CLS}>Due date</label>
              <input id={fid('due-date')} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <p className={`${LABEL_CLS} mb-0`}>Amounts</p>
              {CURRENCIES.length > 1 && (
                <div className="flex gap-1" role="group" aria-label="Currency">
                  {CURRENCIES.map((c) => (
                    <button key={c} type="button" onClick={() => setCurrency(c)} aria-pressed={currency === c} className={pillCls(currency === c, { compact: true })}>{c}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Subtotal', 'subtotal', subtotal, setSubtotal],
                ['GST', 'gst', gst, setGst],
                ['PST', 'pst', pst, setPst],
              ].map(([label, key, value, set]) => (
                <div key={key}>
                  <label htmlFor={fid(key)} className={MINI_LABEL}>{label}</label>
                  <input id={fid(key)} type="text" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder="0.00" className={INPUT_CLS} />
                </div>
              ))}
              <div>
                <label htmlFor={fid('total')} className={MINI_LABEL}>Total *</label>
                <input id={fid('total')} type="text" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" required className={AMOUNT_INPUT_CLS} />
              </div>
            </div>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
              <button type="button" onClick={calcFromSubtotal} disabled={s === null} className={`${BTN_NEUTRAL} w-full sm:w-auto min-h-[44px] sm:min-h-0 disabled:opacity-50`}>
                <span className="material-symbols-outlined text-base">calculate</span>
                GST 5% + PST 7% from subtotal
              </button>
              {Math.abs(mismatch) >= 0.01 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Subtotal + taxes come to {formatMoney(partsSum, currency)}, {formatMoney(Math.abs(mismatch), currency)} {mismatch > 0 ? 'less' : 'more'} than the total. Fine if there’s shipping or a discount.
                </p>
              )}
            </div>
          </div>

          {!editing && (
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 min-h-[44px] cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
              <input type="checkbox" checked={paidAlready} onChange={(e) => setPaidAlready(e.target.checked)} className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/50 bg-white dark:bg-slate-700" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">Paid already</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">receipt, card at the counter…</span>
            </label>
          )}

          {showPayment && (
            <div className="rounded-xl border border-green-300 dark:border-green-800/40 bg-green-50/60 dark:bg-green-900/10 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={fid('paid-date')} className={LABEL_CLS}>Paid on</label>
                  <input id={fid('paid-date')} type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label htmlFor={fid('reference')} className={LABEL_CLS}>Reference</label>
                  <input id={fid('reference')} type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} maxLength={100} placeholder="Last 4, e-transfer ref, cheque #" className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <p id={fid('method')} className={LABEL_CLS}>Paid by</p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby={fid('method')}>
                  {PAYMENT_METHOD_LIST.map((m) => (
                    <button key={m.value} type="button" onClick={() => setPaymentMethod(paymentMethod === m.value ? '' : m.value)} aria-pressed={paymentMethod === m.value} className={pillCls(paymentMethod === m.value)}>{m.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Enter inside a line (or its work-order search) must not submit the
              bill half-typed; the Total field above still submits on Enter. */}
          <div onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault(); }}>
            <p className={LABEL_CLS}>Lines <span className="normal-case tracking-normal font-medium">(optional)</span></p>
            {lines.length > 0 && (
              <div className="space-y-2">
                {lines.map((ln, i) => {
                  const unit = numOrNull(ln.unit_price);
                  const qty = num(ln.quantity) > 0 ? num(ln.quantity) : 1;
                  const n = i + 1;
                  return (
                    <div key={ln.key} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                      <div className="flex gap-2">
                        <input type="text" value={ln.description} onChange={(e) => updateLine(i, { description: e.target.value })} maxLength={300} placeholder="What was bought *" aria-label={`Line ${n}: what was bought`} className={INPUT_CLS} />
                        <button type="button" onClick={() => removeLine(i)} aria-label={`Remove line ${n}`} title="Remove line" className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 transition-colors">
                          <span className="material-symbols-outlined">close</span>
                        </button>
                      </div>
                      {/* Phones: part number on its own row, qty and price below — three
                          abreast at 375px truncated every placeholder. */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <input type="text" value={ln.part_number} onChange={(e) => updateLine(i, { part_number: e.target.value })} maxLength={100} placeholder="Part #" aria-label={`Line ${n}: part number`} className={`${INPUT_CLS} col-span-2 sm:col-span-1`} />
                        <input type="text" inputMode="decimal" value={ln.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} placeholder="Qty" aria-label={`Line ${n}: quantity`} className={INPUT_CLS} />
                        <input type="text" inputMode="decimal" value={ln.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} placeholder="Unit price" aria-label={`Line ${n}: unit price`} className={INPUT_CLS} />
                      </div>
                      {/* Parts feed a job's parts cost; the other kinds are its
                          additional expenses. On a multi-tool job the line can
                          name its tool, or stay shared by the whole job. */}
                      {(() => {
                        const tools = ln.workOrder ? jobTools[ln.workOrder.repair_id] : null;
                        const single = tools?.length === 1 ? tools[0] : null;
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select value={ln.kind} onChange={(e) => updateLine(i, { kind: e.target.value })} aria-label={`Line ${n}: what it paid for`} className={INPUT_CLS}>
                              {BILL_LINE_KIND_LIST.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                            </select>
                            {tools?.length > 1 && (
                              <select value={ln.tool_id || ''} onChange={(e) => updateLine(i, { tool_id: e.target.value || null })} aria-label={`Line ${n}: which tool`} className={INPUT_CLS}>
                                <option value="">Whole job (shared)</option>
                                {tools.map((t, ti) => <option key={t.tool_id} value={t.tool_id}>{ti + 1}. {t.label}</option>)}
                              </select>
                            )}
                            {single && (
                              <p className="self-center text-xs text-slate-500 dark:text-slate-400 truncate" title={single.label}>For {single.label}</p>
                            )}
                          </div>
                        );
                      })()}
                      {(ln.workOrder || ln.linking) ? (
                        <WorkOrderPicker value={ln.workOrder} onChange={(wo) => updateLine(i, { workOrder: wo, tool_id: null, linking: wo ? false : ln.linking })} label="Work order" />
                      ) : (
                        <button type="button" onClick={() => updateLine(i, { linking: true })} className="text-xs font-bold text-primary dark:text-blue-400 hover:underline min-h-[44px] sm:min-h-0 inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">build_circle</span>
                          Link to a work order
                        </button>
                      )}
                      {unit !== null && (
                        <p className="text-xs text-right text-slate-500 dark:text-slate-400">Line total {formatMoney(round2(qty * unit), currency)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])} className={`${BTN_NEUTRAL} mt-2 w-full sm:w-auto min-h-[44px] sm:min-h-0`}>
              <span className="material-symbols-outlined text-base">add</span>
              Add line
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={fid('zoho')} className={LABEL_CLS}>Zoho bill #</label>
              <input id={fid('zoho')} type="text" value={zohoBillNumber} onChange={(e) => setZohoBillNumber(e.target.value)} maxLength={100} placeholder="If entered in Zoho Books" className={INPUT_CLS} />
            </div>
            <div>
              <label htmlFor={fid('notes')} className={LABEL_CLS}>Notes</label>
              <textarea id={fid('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} rows={2} placeholder="Anything worth remembering…" className={`${INPUT_CLS} resize-none`} />
            </div>
          </div>

          {!editing ? (
            <div>
              <p className={LABEL_CLS}>Attach the bill <span className="normal-case tracking-normal font-medium">(photo or PDF)</span></p>
              {/* No `capture`: the phone's picker already offers the camera, and
                  capture would hide the Files option that PDFs need. */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  setFiles((f) => [...f, ...picked].slice(0, MAX_FILES));
                  e.target.value = '';
                }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={files.length >= MAX_FILES} className={`${BTN_NEUTRAL} w-full min-h-[44px] sm:min-h-0 disabled:opacity-50`}>
                <span className="material-symbols-outlined text-base">attach_file</span>
                {files.length ? 'Add another' : 'Choose photo or PDF'}
              </button>
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                      <span className="truncate inline-flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-base text-slate-400">{f.type === 'application/pdf' ? 'picture_as_pdf' : 'image'}</span>
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      </span>
                      <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} title="Remove file" className="w-11 h-11 -my-2 flex items-center justify-center text-slate-400 hover:text-red-500 flex-shrink-0">
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">Attachments are added and removed from the bill itself.</p>
          )}
        </form>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          {uploadIndex > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2" aria-live="polite">Uploading {uploadIndex} of {files.length}…</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className={CANCEL_BTN_CLS}>Cancel</button>
            <button type="submit" form="bill-form" disabled={saving} className={SUBMIT_BTN_CLS}>
              {saving ? 'Saving...' : editing ? 'Save changes' : paidAlready ? 'Log as paid' : 'Log bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
