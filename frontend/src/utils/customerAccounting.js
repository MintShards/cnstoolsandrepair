// A customer's accounting, built on the client from every work order of
// theirs (accountingAPI.customer) with the same maths the work order dialog
// and the P&L use, so the profile never disagrees with either. Pre-tax, CAD.
import { jobAccounting, sumEntered } from './jobAccounting';
import { pnlRows, shopDay, ALL_TIME } from './accounting';
import { round2 } from './money';

// A tool still on the bench, or waiting to be paid for.
const OPEN_STATUSES = new Set(['received', 'diagnosed', 'quoted', 'approved', 'parts_pending', 'in_repair', 'ready', 'invoiced']);
// A job has been invoiced once a tool reached the invoice stage, or a
// figure was typed in from Zoho.
const INVOICED_STATUSES = new Set(['invoiced', 'completed', 'closed']);
const pct = (profit, revenue) => (revenue > 0 && profit != null ? Math.round((profit / revenue) * 100) : null);
const isCad = (p) => (p.currency || 'CAD') === 'CAD';
/** The shop-local day a payment counts on. */
export const paymentDay = (p) => p.received_date || shopDay(p.created_at) || null;

/**
 * Figures for one customer, scoped to a period (`from` / `to`, shop-local
 * inclusive dates; ALL_TIME when none is given).
 *
 * `period` follows the P&L rule — a repair counts on the day its tool was
 * marked Completed, declined / BER / abandoned tools stay out, a job's
 * shared costs are split across its counted tools — plus the payments
 * received in the period, with the rows behind both for the statement and
 * the CSV. `now` is as of today whatever the period: every payment ever
 * received, what is still owed on the invoiced work orders, and the open
 * work at its charges today. `byYear` breaks the period down.
 */
export function customerSummary(data, opts = {}) {
  const from = opts.from || ALL_TIME.from;
  const to = opts.to || ALL_TIME.to;
  const jobs = data?.jobs || [];
  const bills = data?.bills || [];
  const payments = data?.payments || [];
  const pnl = pnlRows({ jobs, bills, payments }, { ...opts, from, to });

  // By year, from the P&L rows (one per completed tool in the period).
  const years = new Map();
  for (const r of pnl.rows) {
    const y = r.day.slice(0, 4);
    const row = years.get(y) || { year: y, jobs: new Set(), tools: 0, revenue: [], cost: [], profit: [] };
    row.jobs.add(r.job_id);
    row.tools += 1;
    row.revenue.push(r.revenue);
    row.cost.push(r.cost);
    row.profit.push(r.profit);
    years.set(y, row);
  }

  // Payments received in the period.
  const periodPayments = payments
    .filter((p) => { const d = paymentDay(p); return isCad(p) && d && d >= from && d <= to; })
    .sort((a, b) => (paymentDay(a) < paymentDay(b) ? -1 : paymentDay(a) > paymentDay(b) ? 1 : 0));
  const paidByYear = new Map();
  for (const p of periodPayments) {
    const y = paymentDay(p).slice(0, 4);
    paidByYear.set(y, round2((paidByYear.get(y) || 0) + (Number(p.amount) || 0)));
  }

  // As of today, from the jobs as a whole.
  const received = [];
  const balance = [];
  let invoicedJobs = 0;
  const open = { tools: 0, revenue: [], jobs: new Set() };
  let toolCount = 0;
  let firstVisit = null;
  let lastVisit = null;
  for (const job of jobs) {
    const jobBills = bills.filter((b) => (b.lines || []).some((l) => l.repair_id === job.id));
    const jobPayments = payments.filter((p) => p.repair_id === job.id);
    const acct = jobAccounting(job, jobBills, jobPayments, opts);
    toolCount += (job.tools || []).length;
    const created = shopDay(job.created_at);
    if (created && (!firstVisit || created < firstVisit)) firstVisit = created;
    if (created && (!lastVisit || created > lastVisit)) lastVisit = created;

    if (acct.received != null) received.push(acct.received);
    const invoiced = (job.tools || []).some((t) => INVOICED_STATUSES.has(t.status) || t.invoiced_amount != null);
    if (invoiced && acct.balance != null) {
      invoicedJobs += 1;
      balance.push(acct.balance);
    }
    for (const t of job.tools || []) {
      if (!OPEN_STATUSES.has(t.status)) continue;
      const at = acct.tools.find((x) => x.tool_id === t.tool_id);
      if (!at || at.excluded) continue;
      open.tools += 1;
      open.jobs.add(job.id);
      open.revenue.push(at.charges.revenue);
    }
  }

  const byYear = [...years.values()].map((y) => {
    const rev = sumEntered(y.revenue);
    const pr = sumEntered(y.profit);
    return {
      year: y.year, jobs: y.jobs.size, tools: y.tools,
      revenue: rev, cost: sumEntered(y.cost), profit: pr, margin: pct(pr, rev),
      paid: paidByYear.has(y.year) ? paidByYear.get(y.year) : null,
    };
  });
  // A year with payments but no completed repair still shows its money in.
  for (const [y, paid] of paidByYear) {
    if (!years.has(y)) byYear.push({ year: y, jobs: 0, tools: 0, revenue: null, cost: null, profit: null, margin: null, paid });
  }
  byYear.sort((a, b) => (a.year < b.year ? 1 : -1));

  const revenue = pnl.totals.revenue;
  const profit = pnl.totals.profit;
  const completedJobs = new Set(pnl.rows.map((r) => r.job_id)).size;
  return {
    from,
    to,
    allTime: from === ALL_TIME.from && to === ALL_TIME.to,
    period: {
      revenue,
      cost: pnl.totals.cost,
      labourCost: pnl.totals.labourCost,
      partsCost: pnl.totals.partsCost,
      otherCost: pnl.totals.otherCost,
      profit,
      margin: pct(profit, revenue),
      completedTools: pnl.rows.length,
      completedJobs,
      averagePerJob: completedJobs > 0 && revenue != null ? round2(revenue / completedJobs) : null,
      uncostedParts: pnl.totals.uncostedParts,
      paid: periodPayments.length ? round2(periodPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)) : null,
      rows: pnl.rows,
      payments: periodPayments,
    },
    now: {
      received: received.length ? sumEntered(received) : null,
      balance: balance.length ? sumEntered(balance) : null,
      invoicedJobs,
      open: { tools: open.tools, jobs: open.jobs.size, revenue: open.revenue.length ? sumEntered(open.revenue) : null },
    },
    byYear,
    counts: { jobs: jobs.length, tools: toolCount, firstVisit, lastVisit },
    matched: data?.matched || { by_link: jobs.length, by_name: 0 },
  };
}
