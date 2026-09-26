// Work order accounting, computed on the client from what is already loaded:
// the job's tools (the tracker's charges and its parts at cost), its Cash
// Flow bills and payments, and the shop's labour cost rate and tax rates
// from business settings.
//
//   charged  = labour (hours × rate) + parts at customer price + extra charges
//   revenue  = charged, or the pre-tax invoiced amount typed on the tool
//   cost     = labour (hours × cost rate) + parts (installed parts × what the
//              shop paid for them) + other (non-part bill lines and expenses)
//   profit   = revenue − cost, margin = profit / revenue
//   invoice  = revenue + GST and PST per the tool's tax status: the total the
//              customer actually pays, which is what payments count against
//
// A figure nobody has entered is null (shown as "—"), not 0: a tool with no
// labour hours has no labour charge, a tool with no installed parts has no
// parts cost. Sums skip nulls and are themselves null only when every part is.
// Tools whose work will never be done (declined, beyond economical repair,
// abandoned) keep their own figures but stay out of the job's totals.
// Revenue, cost and profit are before tax; everything is in CAD.
import { round2 } from './money';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const entered = (v) => v != null && v !== '' && Number.isFinite(parseFloat(v));

/** Sum of the entered figures, or null when none was entered. */
export function sumEntered(values) {
  const present = values.filter((v) => v != null);
  return present.length ? round2(present.reduce((s, v) => s + v, 0)) : null;
}

// Tools the customer will not be paying for. Their own figures stay visible
// on the tool, but they are left out of the job's totals — a declined,
// beyond-economical-repair or abandoned tool must not drag the job's profit
// around.
export const EXCLUDED_STATUSES = {
  declined: 'declined',
  beyond_economical_repair: 'beyond economical repair',
  abandoned: 'abandoned',
};

/**
 * The status that decides whether a tool counts. A closed tool counts as
 * whatever it was before it was closed: completed then closed is counted,
 * declined then closed is not.
 */
export function effectiveStatus(tool) {
  if (tool.status !== 'closed') return tool.status;
  const history = tool.status_history || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.status && history[i].status !== 'closed') return history[i].status;
  }
  return 'closed';
}

/** Why a tool is left out of the job's figures, or null when it counts. */
export function excludedReason(tool) {
  return EXCLUDED_STATUSES[effectiveStatus(tool)] || null;
}

/** Text colour for a profit figure: red in the hole, green ahead, plain at zero or unknown. */
export const profitTone = (n) => (
  n == null ? 'text-slate-900 dark:text-white'
    : n < 0 ? 'text-red-600 dark:text-red-400'
      : n > 0 ? 'text-green-700 dark:text-green-400'
        : 'text-slate-900 dark:text-white'
);

// Sales tax on a tool's invoice. Revenue and profit stay pre-tax; the tax
// only turns revenue into the invoice total the customer pays.
export const TAX_STATUSES = {
  taxable: 'GST + PST',
  pst_exempt: 'GST only (PST exempt)',
  tax_exempt: 'No tax',
};
export const TAX_STATUS_LIST = Object.entries(TAX_STATUSES).map(([value, label]) => ({ value, label }));
// BC's rates, used when business settings carry none.
export const DEFAULT_GST_RATE = 5;
export const DEFAULT_PST_RATE = 7;

/** GST and PST on a pre-tax amount under a tax status, each rounded to the cent. */
export function taxOn(amount, status, gstRate, pstRate) {
  if (amount == null) return { gst: null, pst: null, total: null };
  const gst = status === 'tax_exempt' ? 0 : round2((amount * gstRate) / 100);
  const pst = status === 'taxable' ? round2((amount * pstRate) / 100) : 0;
  return { gst, pst, total: round2(gst + pst) };
}

/** "BRAND MODEL" (or the Hathorn component models) — mirrors the backend's tool_label. */
export function toolLabel(t) {
  const comps = [t.controller_model, t.reel_model, t.camera_head_model].filter(Boolean).join(' / ');
  return [t.brand, t.model_number || comps].filter(Boolean).join(' ') || t.tool_type || 'Tool';
}

/**
 * What the customer is charged for one tool, before tax: labour (hours ×
 * rate, null until both are entered), parts at the customer's price (null
 * until a part carries a price), extra charges (null until one exists).
 * `invoiced` is the pre-tax Zoho figure typed on the tool when it differs;
 * `revenue` is the one that counts.
 */
export function toolCharges(tool) {
  const hours = entered(tool.labour_hours) ? num(tool.labour_hours) : null;
  const rate = entered(tool.hourly_rate) ? num(tool.hourly_rate) : null;
  const labour = hours != null && rate != null ? round2(hours * rate) : null;
  const priced = (tool.parts || []).filter((p) => p.name?.trim() && entered(p.price));
  const parts = priced.length ? round2(priced.reduce((s, p) => s + num(p.price) * (p.quantity || 1), 0)) : null;
  const charges = tool.extra_charges || [];
  const extras = charges.length ? round2(charges.reduce((s, c) => s + num(c.amount), 0)) : null;
  const subtotal = sumEntered([labour, parts, extras]);
  const invoiced = entered(tool.invoiced_amount) ? round2(num(tool.invoiced_amount)) : null;
  return { hours, rate, labour, parts, extras, subtotal, invoiced, revenue: invoiced ?? subtotal };
}

/**
 * What one tool's labour costs the shop: its hours × its own cost rate, or
 * the shop-wide rate when the tool carries none. Null until both the hours
 * and a rate exist.
 */
export function toolLabourCost(tool, defaultRate) {
  const hours = entered(tool.labour_hours) ? num(tool.labour_hours) : null;
  const own = entered(tool.labour_cost_rate) ? num(tool.labour_cost_rate) : null;
  const shop = entered(defaultRate) ? num(defaultRate) : null;
  const rate = own ?? shop;
  return { hours, rate, own: own != null, amount: hours != null && rate != null ? round2(hours * rate) : null };
}

/**
 * What one tool's parts cost the shop: each installed part's cost (what the
 * shop paid, snapshotted from the parts library when the part was picked and
 * editable on the part) × quantity. A part is only used once installed, so
 * parts still pending, ordered or received are not counted yet; installed
 * parts with no cost are counted separately so the statement can say so.
 */
export function toolPartsCost(tool) {
  const named = (tool.parts || []).filter((p) => p.name?.trim());
  const installed = named.filter((p) => p.status === 'installed');
  const costed = installed.filter((p) => entered(p.cost));
  return {
    amount: costed.length ? round2(costed.reduce((s, p) => s + num(p.cost) * (p.quantity || 1), 0)) : null,
    uncosted: installed.length - costed.length,
    pending: named.length - installed.length,
  };
}

// The bill lines behind a tool's "other" cost. Part lines are deliberately
// left out: parts are counted from the tool's installed parts, so adding the
// supplier bill as well would count them twice.
function costFromLines(lines) {
  let other = null;
  let unpriced = 0;
  const kept = [];
  for (const l of lines) {
    if ((l.kind || 'part') === 'part') continue;
    kept.push(l);
    if (l.line_total == null) { unpriced += 1; continue; }
    other = round2((other ?? 0) + l.line_total);
  }
  return { other, unpriced, lines: kept };
}

/**
 * The whole job's money in one object: per-tool charges, costs and profit,
 * the job-level (shared) costs, the totals, the invoice total with tax, and
 * what has been received against it. `labourCostRate`, `gstRate` and
 * `pstRate` come from business settings; the tax rates fall back to BC's.
 */
export function jobAccounting(job, bills = [], payments = [], { labourCostRate = null, gstRate = null, pstRate = null } = {}) {
  const gst = entered(gstRate) ? num(gstRate) : DEFAULT_GST_RATE;
  const pst = entered(pstRate) ? num(pstRate) : DEFAULT_PST_RATE;
  // The shop works in CAD. A record in another currency (possible on older
  // data) is left out rather than added into CAD figures, and counted so the
  // statement can say so.
  const isCad = (r) => (r.currency || 'CAD') === 'CAD';
  const live = bills.filter((b) => b.status !== 'void' && isCad(b));
  const cadPayments = payments.filter(isCad);
  const foreign = bills.filter((b) => b.status !== 'void' && !isCad(b)).length + payments.filter((p) => !isCad(p)).length;
  const jobLines = [];
  for (const b of live) {
    for (const l of b.lines || []) {
      if (l.repair_id !== job.id) continue;
      jobLines.push({ ...l, bill_id: b.id, bill_number: b.bill_number, supplier_name: b.supplier_name, bill_status: b.status });
    }
  }

  const toolIds = new Set((job.tools || []).map((t) => t.tool_id));
  const tools = (job.tools || []).map((t) => {
    const charges = toolCharges(t);
    const taxStatus = t.tax_status || 'taxable';
    const tax = taxOn(charges.revenue, taxStatus, gst, pst);
    const labour = toolLabourCost(t, labourCostRate);
    const parts = toolPartsCost(t);
    const fromBills = costFromLines(jobLines.filter((l) => l.tool_id === t.tool_id));
    const cost = {
      labour: labour.amount,
      parts: parts.amount,
      other: fromBills.other,
      total: sumEntered([labour.amount, parts.amount, fromBills.other]),
      uncostedParts: parts.uncosted,
      pendingParts: parts.pending,
      unpriced: fromBills.unpriced,
      lines: fromBills.lines,
      labourRate: labour.rate,
      ownLabourRate: labour.own,
    };
    const profit = charges.revenue == null && cost.total == null ? null : round2((charges.revenue ?? 0) - (cost.total ?? 0));
    const reason = excludedReason(t);
    return {
      tool_id: t.tool_id,
      label: toolLabel(t),
      excluded: Boolean(reason),
      excludedReason: reason,
      charges,
      // The charges themselves, for listing; charges.extras is their sum.
      extraCharges: t.extra_charges || [],
      taxStatus,
      tax,
      inclTax: charges.revenue == null ? null : round2(charges.revenue + tax.total),
      cost,
      profit,
      margin: charges.revenue > 0 ? Math.round((profit / charges.revenue) * 100) : null,
    };
  });
  // Lines with no tool (or a tool since removed) belong to the job as a whole.
  const sharedLines = costFromLines(jobLines.filter((l) => !l.tool_id || !toolIds.has(l.tool_id)));
  const shared = { ...sharedLines, total: sharedLines.other };

  // Only tools the customer is paying for make it into the job's totals.
  const counted = tools.filter((t) => !t.excluded);
  const excluded = tools.filter((t) => t.excluded).map((t) => ({
    tool_id: t.tool_id, label: t.label, reason: t.excludedReason, revenue: t.charges.revenue, cost: t.cost.total,
  }));

  const total = (pick, extra = null) => sumEntered([...counted.map(pick), extra]);
  const revenue = total((t) => t.charges.revenue);
  // Tax on the grouped revenue, not the sum of per-tool tax: one Zoho invoice
  // rounds once, so summing rounded tool figures could miss it by a cent.
  const gstBase = total((t) => (t.taxStatus === 'tax_exempt' ? null : t.charges.revenue));
  const pstBase = total((t) => (t.taxStatus === 'taxable' ? t.charges.revenue : null));
  const gstTotal = gstBase == null ? null : round2((gstBase * gst) / 100);
  const pstTotal = pstBase == null ? null : round2((pstBase * pst) / 100);
  const taxTotal = sumEntered([gstTotal, pstTotal]);
  const invoicedInclTax = revenue == null ? null : round2(revenue + (taxTotal || 0));
  const labourCost = total((t) => t.cost.labour);
  const partsCost = total((t) => t.cost.parts);
  const otherCost = total((t) => t.cost.other, shared.other);
  const totalCost = sumEntered([labourCost, partsCost, otherCost]);
  const profit = revenue == null && totalCost == null ? null : round2((revenue ?? 0) - (totalCost ?? 0));

  // Null until a payment exists, so "—" and $0.00 stay distinct here too.
  const received = cadPayments.length ? round2(cadPayments.reduce((s, p) => s + num(p.amount), 0)) : null;

  return {
    tools,
    shared,
    excluded,
    totals: {
      labourCharged: total((t) => t.charges.labour),
      partsCharged: total((t) => t.charges.parts),
      extraCharged: total((t) => t.charges.extras),
      revenue,
      gst: gstTotal,
      pst: pstTotal,
      tax: taxTotal,
      invoicedInclTax,
      labourCost,
      partsCost,
      otherCost,
      totalCost,
      profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 100) : null,
      invoiced: counted.some((t) => t.charges.invoiced != null),
    },
    labourRateSet: entered(labourCostRate),
    // Installed parts with no cost, and parts not installed yet, on the
    // counted tools — the two reasons parts cost can trail parts charged.
    uncostedParts: counted.reduce((s, t) => s + t.cost.uncostedParts, 0),
    pendingParts: counted.reduce((s, t) => s + t.cost.pendingParts, 0),
    unpriced: shared.unpriced + counted.reduce((s, t) => s + t.cost.unpriced, 0),
    received,
    // What the customer still owes on the invoice total; null until there is revenue.
    balance: invoicedInclTax == null ? null : round2(invoicedInclTax - (received || 0)),
    hasCharges: tools.some((t) => t.charges.subtotal > 0 || t.charges.invoiced != null),
    hasBills: live.length > 0,
    hasPayments: cadPayments.length > 0,
    foreign,
  };
}
