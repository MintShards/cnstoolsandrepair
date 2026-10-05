// Profit & Loss rows and money-journal entries, built on the client from the
// records a period touches (accountingAPI) with the same maths the work
// order dialog uses (jobAccounting), so a repair's profit here is the figure
// on its card. Everything is pre-tax and in CAD unless said otherwise.
import { jobAccounting, sumEntered, toolCharges, toolLabel, taxOn, DEFAULT_GST_RATE, DEFAULT_PST_RATE } from './jobAccounting';
import { round2 } from './money';
import { getTodayPacific } from './dateFormat';
import * as billConst from '../constants/bills';

const entered = (v) => v != null && v !== '' && Number.isFinite(parseFloat(v));

// The backend emits naive-UTC ISO strings; give them their Z so the shop-local
// day comes out right.
const normalize = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !/[Z+-]\d*$/.test(s) ? `${s}Z` : s);
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Shop-local calendar day (YYYY-MM-DD) of a backend timestamp. */
export const shopDay = (ts) => (ts ? ymdFmt.format(new Date(normalize(ts))) : null);
/** Shop-local clock time of a backend timestamp, "10:14 AM". */
export const shopTime = (ts) => (ts
  ? new Date(normalize(ts)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Vancouver' })
  : '');
const tsValue = (ts) => (ts ? new Date(normalize(ts)).getTime() : 0);

// YMD arithmetic with no timezone involved.
export const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export const PERIOD_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

/** The shop-local date range a preset means today. Weeks run Monday to Sunday. */
export function presetRange(id, today = getTodayPacific()) {
  if (id === 'week') {
    const [y, m, d] = today.split('-').map(Number);
    const back = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    const from = addDays(today, -back);
    return { from, to: addDays(from, 6) };
  }
  if (id === 'month') {
    const [y, m] = today.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${String(last).padStart(2, '0')}` };
  }
  return { from: today, to: today };
}

const inRange = (ymd, from, to) => Boolean(ymd) && ymd >= from && ymd <= to;
const customerOf = (job) => job.company_name || [job.first_name, job.last_name].filter(Boolean).join(' ') || '—';
const pct = (profit, revenue) => (revenue > 0 && profit != null ? Math.round((profit / revenue) * 100) : null);

const labelOf = (src, value) => {
  if (!value) return '';
  if (Array.isArray(src)) {
    const hit = src.find((x) => x.value === value || x.id === value);
    return hit?.label || value;
  }
  const hit = src?.[value];
  return (hit && typeof hit === 'object' ? hit.label : hit) || value;
};
export const methodLabel = (m) => labelOf(billConst.PAYMENT_METHODS, m);
export const categoryLabel = (c) => labelOf(billConst.BILL_CATEGORIES, c);

/**
 * One row per tool completed in the period. The job's shared costs (bill
 * lines with no tool) ride with the tool completed last on that job, so a
 * multi-tool job counts them once. Tools the customer will not pay for
 * (declined, BER, abandoned) are left out, as the dialog leaves them out.
 */
export function pnlRows(data, { from, to, labourCostRate, gstRate, pstRate, technicianRates }) {
  const rows = [];
  for (const job of data?.jobs || []) {
    const bills = (data.bills || []).filter((b) => (b.lines || []).some((l) => l.repair_id === job.id));
    const payments = (data.payments || []).filter((p) => p.repair_id === job.id);
    const acct = jobAccounting(job, bills, payments, { labourCostRate, gstRate, pstRate, technicianRates });
    const completed = (job.tools || []).filter((t) => t.date_completed);
    const last = completed.reduce((a, t) => (!a || tsValue(t.date_completed) > tsValue(a.date_completed) ? t : a), null);
    for (const t of completed) {
      const day = shopDay(t.date_completed);
      if (!inRange(day, from, to)) continue;
      const at = acct.tools.find((x) => x.tool_id === t.tool_id);
      if (!at || at.excluded) continue;
      const shared = last && last.tool_id === t.tool_id ? acct.shared.other : null;
      const other = sumEntered([at.cost.other, shared]);
      const cost = sumEntered([at.cost.labour, at.cost.parts, other]);
      const revenue = at.charges.revenue;
      const profit = revenue == null && cost == null ? null : round2((revenue ?? 0) - (cost ?? 0));
      rows.push({
        key: `${job.id}-${t.tool_id}`,
        job_id: job.id,
        request_number: job.request_number,
        customer: customerOf(job),
        tool_id: t.tool_id,
        label: at.label,
        technician: t.assigned_technician || null,
        day,
        completed_at: t.date_completed,
        revenue,
        invoiced: at.charges.invoiced != null,
        zoho_invoice_number: t.zoho_invoice_number || null,
        labourCost: at.cost.labour,
        partsCost: at.cost.parts,
        otherCost: other,
        cost,
        profit,
        margin: pct(profit, revenue),
        uncostedParts: at.cost.uncostedParts || 0,
        received: acct.received,
        balance: acct.balance,
        paid: acct.balance != null && acct.balance <= 0,
      });
    }
  }
  rows.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.request_number.localeCompare(b.request_number)));

  const sum = (pick) => sumEntered(rows.map(pick));
  const revenue = sum((r) => r.revenue);
  const cost = sum((r) => r.cost);
  const profit = sum((r) => r.profit);
  const totals = {
    count: rows.length,
    revenue,
    labourCost: sum((r) => r.labourCost),
    partsCost: sum((r) => r.partsCost),
    otherCost: sum((r) => r.otherCost),
    cost,
    profit,
    margin: pct(profit, revenue),
    uncostedParts: rows.reduce((s, r) => s + r.uncostedParts, 0),
    unpaid: rows.filter((r) => !r.paid).length,
  };

  const byDay = new Map();
  for (const r of rows) {
    const d = byDay.get(r.day) || { day: r.day, count: 0, revenue: [], cost: [], profit: [] };
    d.count += 1;
    d.revenue.push(r.revenue);
    d.cost.push(r.cost);
    d.profit.push(r.profit);
    byDay.set(r.day, d);
  }
  const days = [...byDay.values()].map((d) => {
    const rev = sumEntered(d.revenue);
    const pr = sumEntered(d.profit);
    return { day: d.day, count: d.count, revenue: rev, cost: sumEntered(d.cost), profit: pr, margin: pct(pr, rev) };
  });
  return { rows, totals, days };
}

// ── Money journal ────────────────────────────────────────────────────────────

export const JOURNAL_KINDS = {
  invoice: { label: 'Invoice issued', icon: 'request_quote', tone: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/50' },
  completed: { label: 'Repair completed', icon: 'task_alt', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50' },
  payment: { label: 'Payment received', icon: 'payments', tone: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/50' },
  bill_logged: { label: 'Bill logged', icon: 'receipt_long', tone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50' },
  bill_paid: { label: 'Bill paid', icon: 'price_check', tone: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/50' },
  bill_status: { label: 'Bill status', icon: 'swap_horiz', tone: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  edit: { label: 'Money edit', icon: 'edit_note', tone: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/50' },
};

export const JOURNAL_FILTERS = [
  { id: 'all', label: 'All', kinds: null },
  { id: 'invoice', label: 'Invoices', kinds: ['invoice'] },
  { id: 'payment', label: 'Payments', kinds: ['payment'] },
  { id: 'bills', label: 'Bills', kinds: ['bill_logged', 'bill_paid', 'bill_status'] },
  { id: 'completed', label: 'Completed', kinds: ['completed'] },
  { id: 'edit', label: 'Edits', kinds: ['edit'] },
];

const BILL_STATUS_LABELS = { unpaid: 'Unpaid', paid: 'Paid', disputed: 'Disputed', void: 'Void' };

/**
 * Every money event in the period, oldest first, with a running cash
 * balance (payments received minus bills paid). `direction` says how the
 * amount reads: in (cash received), out (cash paid), billed (invoice
 * issued, not yet cash), owed (bill logged, not yet cash), info (none).
 */
export function journalEntries(data, { from, to, gstRate, pstRate }) {
  const gst = entered(gstRate) ? Number(gstRate) : DEFAULT_GST_RATE;
  const pst = entered(pstRate) ? Number(pstRate) : DEFAULT_PST_RATE;
  const entries = [];
  const push = (e) => { if (inRange(e.day, from, to)) entries.push(e); };

  for (const job of data?.jobs || []) {
    const customer = customerOf(job);
    const wo = { type: 'wo', id: job.id, number: job.request_number };
    for (const t of job.tools || []) {
      const charges = toolCharges(t);
      const tax = taxOn(charges.revenue, t.tax_status || 'taxable', gst, pst);
      for (const h of t.status_history || []) {
        if (h.status === 'invoiced') {
          push({
            kind: 'invoice', ts: h.timestamp, day: shopDay(h.timestamp), ref: wo,
            title: `Invoice issued — ${toolLabel(t)}`,
            sub: [customer, t.zoho_invoice_number ? `Zoho invoice ${t.zoho_invoice_number}` : null,
              charges.invoiced == null && charges.revenue != null ? 'amount from the tool’s charges' : null].filter(Boolean).join(' · '),
            amount: charges.revenue, inclTax: charges.revenue == null ? null : round2(charges.revenue + tax.total),
            direction: 'billed', actor: h.by || null, currency: 'CAD',
          });
        } else if (h.status === 'completed') {
          push({
            kind: 'completed', ts: h.timestamp, day: shopDay(h.timestamp), ref: wo,
            title: `Repair completed — ${toolLabel(t)}`,
            sub: `${customer} · counts in the P&L today`,
            amount: charges.revenue, direction: 'info', actor: h.by || null, currency: 'CAD',
          });
        }
      }
    }
  }

  for (const p of data?.payments || []) {
    push({
      kind: 'payment', ts: p.created_at, day: p.received_date || shopDay(p.created_at),
      ref: { type: 'payment', id: p.id, number: p.payment_number },
      wo: p.repair_id && p.request_number ? { type: 'wo', id: p.repair_id, number: p.request_number } : null,
      title: `Payment received — ${p.customer_name || '—'}`,
      sub: [methodLabel(p.payment_method), p.payment_reference, p.zoho_invoice_number ? `Zoho invoice ${p.zoho_invoice_number}` : null].filter(Boolean).join(' · '),
      amount: p.amount, direction: 'in', actor: p.created_by || null, currency: p.currency || 'CAD',
    });
  }

  for (const b of data?.bills || []) {
    const hist = [...(b.status_history || [])].sort((x, y) => tsValue(x.timestamp) - tsValue(y.timestamp));
    const lines = b.lines || [];
    const woNumbers = [...new Set(lines.map((l) => l.request_number).filter(Boolean))];
    const woIds = [...new Set(lines.map((l) => l.repair_id).filter(Boolean))];
    const wo = woIds.length === 1 && woNumbers.length === 1 ? { type: 'wo', id: woIds[0], number: woNumbers[0] } : null;
    const ref = { type: 'bill', id: b.id, number: b.bill_number };
    const first = hist[0];
    const live = b.status !== 'void';
    if (live) {
      push({
        kind: 'bill_logged', ts: first?.timestamp || b.created_at, day: b.bill_date || shopDay(b.created_at), ref, wo,
        title: `Bill logged — ${b.supplier_name}`,
        sub: [categoryLabel(b.category), first?.status === 'paid' ? 'paid on the spot' : null,
          woNumbers.length > 1 ? `Work orders ${woNumbers.join(', ')}` : null].filter(Boolean).join(' · '),
        amount: b.total, direction: 'owed', actor: first?.by || b.created_by || null, currency: b.currency || 'CAD',
      });
    }
    hist.forEach((h, i) => {
      if (h.status === 'paid') {
        if (!live) return;
        const paidDay = b.status === 'paid' && b.paid_date && i === hist.length - 1 ? b.paid_date : shopDay(h.timestamp);
        push({
          kind: 'bill_paid', ts: h.timestamp, day: paidDay, ref, wo,
          title: `Bill paid — ${b.supplier_name}`,
          sub: [b.payment_method ? methodLabel(b.payment_method) : null, b.payment_reference, h.notes].filter(Boolean).join(' · '),
          amount: b.total, direction: 'out', actor: h.by || null, currency: b.currency || 'CAD',
        });
      } else if (i > 0) {
        const prev = hist[i - 1]?.status;
        push({
          kind: 'bill_status', ts: h.timestamp, day: shopDay(h.timestamp), ref, wo,
          title: `Bill ${b.bill_number} — ${BILL_STATUS_LABELS[prev] || prev} → ${BILL_STATUS_LABELS[h.status] || h.status}`,
          sub: [b.supplier_name, h.notes].filter(Boolean).join(' · '),
          amount: null, direction: 'info', actor: h.by || null, currency: b.currency || 'CAD',
        });
      }
    });
  }

  for (const e of data?.edits || []) {
    const ref = e.bill_id ? { type: 'bill', id: e.bill_id, number: e.bill_number }
      : e.payment_id ? { type: 'payment', id: e.payment_id, number: e.payment_number }
        : e.job_id ? { type: 'wo', id: e.job_id, number: e.request_number } : null;
    push({
      kind: 'edit', ts: e.ts, day: shopDay(e.ts), ref,
      title: e.summary || 'Money edit', sub: (e.details || []).join(' · '),
      amount: null, direction: 'info', actor: e.actor || null, currency: 'CAD',
    });
  }

  entries.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : tsValue(a.ts) - tsValue(b.ts)));
  let balance = 0;
  for (const e of entries) {
    const cad = (e.currency || 'CAD') === 'CAD' && e.amount != null;
    if (cad && e.direction === 'in') balance = round2(balance + e.amount);
    else if (cad && e.direction === 'out') balance = round2(balance - e.amount);
    e.balance = balance;
  }
  const sumDir = (dir) => {
    const vals = entries.filter((e) => e.direction === dir && e.amount != null && (e.currency || 'CAD') === 'CAD').map((e) => e.amount);
    return vals.length ? round2(vals.reduce((s, v) => s + v, 0)) : null;
  };
  const received = sumDir('in');
  const paid = sumDir('out');
  const totals = {
    count: entries.length,
    billed: sumDir('billed'),
    received,
    owed: sumDir('owed'),
    paid,
    net: received == null && paid == null ? null : round2((received || 0) - (paid || 0)),
  };
  return { entries, totals };
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** columns: [{ label, value: key | (row) => cell }]. Excel-friendly: BOM, CRLF, quoted when needed. */
export function toCsv(columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cell = (c, r) => (typeof c.value === 'function' ? c.value(r) : r[c.value]);
  return [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(cell(c, r))).join(','))].join('\r\n');
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Money as a plain number string for CSV cells (blank when never entered). */
export const csvMoney = (n) => (n == null ? '' : Number(n).toFixed(2));
