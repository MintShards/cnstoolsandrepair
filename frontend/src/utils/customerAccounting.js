// A customer's accounting, built on the client from every work order of
// theirs (accountingAPI.customer) with the same maths the work order dialog
// and the P&L use, so the profile never disagrees with either. Pre-tax, CAD.
import { jobAccounting, sumEntered } from './jobAccounting';
import { pnlRows, shopDay } from './accounting';
import { round2 } from './money';

const ALL_TIME = { from: '0000-01-01', to: '9999-12-31' };
// A tool still on the bench, or waiting to be paid for.
const OPEN_STATUSES = new Set(['received', 'diagnosed', 'quoted', 'approved', 'parts_pending', 'in_repair', 'ready', 'invoiced']);
// A job has been invoiced once a tool reached the invoice stage, or a
// figure was typed in from Zoho.
const INVOICED_STATUSES = new Set(['invoiced', 'completed', 'closed']);
const pct = (profit, revenue) => (revenue > 0 && profit != null ? Math.round((profit / revenue) * 100) : null);

/**
 * Lifetime and per-year figures for one customer.
 *
 * Completed work follows the P&L rule — a repair counts in the year its tool
 * was marked Completed, declined / BER / abandoned tools stay out, a job's
 * shared costs are split across its counted tools — so "revenue" and
 * "profit" here are the same rows the P&L would show for this customer.
 * Open work is what is still on the bench or awaiting payment, at the
 * revenue its charges add up to today. Paid and balance come from the jobs
 * as a whole: every payment received, and what is still owed on the jobs
 * that have been invoiced.
 */
export function customerSummary(data, opts) {
  const jobs = data?.jobs || [];
  const bills = data?.bills || [];
  const payments = data?.payments || [];
  const pnl = pnlRows({ jobs, bills, payments }, { ...ALL_TIME, ...opts });

  // By year, from the P&L rows (one per completed tool).
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

  // Paid, balance and open work from the jobs as a whole.
  const received = [];
  const balance = [];
  let invoicedJobs = 0;
  const open = { tools: 0, revenue: [], jobs: new Set() };
  const paidByYear = new Map();
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
    for (const p of jobPayments) {
      const y = (p.received_date || shopDay(p.created_at) || '').slice(0, 4);
      if (!y) continue;
      paidByYear.set(y, round2((paidByYear.get(y) || 0) + (Number(p.amount) || 0)));
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

  const revenue = pnl.totals.revenue;
  const profit = pnl.totals.profit;
  const byYear = [...years.values()]
    .map((y) => {
      const rev = sumEntered(y.revenue);
      const pr = sumEntered(y.profit);
      return {
        year: y.year, jobs: y.jobs.size, tools: y.tools,
        revenue: rev, cost: sumEntered(y.cost), profit: pr, margin: pct(pr, rev),
        paid: paidByYear.has(y.year) ? paidByYear.get(y.year) : null,
      };
    })
    .sort((a, b) => (a.year < b.year ? 1 : -1));
  // A year with payments but no completed repair still shows its money in.
  for (const [y, paid] of paidByYear) {
    if (!years.has(y)) byYear.push({ year: y, jobs: 0, tools: 0, revenue: null, cost: null, profit: null, margin: null, paid });
  }
  byYear.sort((a, b) => (a.year < b.year ? 1 : -1));

  const completedJobs = new Set(pnl.rows.map((r) => r.job_id)).size;
  return {
    lifetime: {
      revenue,
      cost: pnl.totals.cost,
      profit,
      margin: pct(profit, revenue),
      received: received.length ? sumEntered(received) : null,
      balance: balance.length ? sumEntered(balance) : null,
      invoicedJobs,
      completedTools: pnl.rows.length,
      completedJobs,
      averagePerJob: completedJobs > 0 && revenue != null ? round2(revenue / completedJobs) : null,
      uncostedParts: pnl.totals.uncostedParts,
    },
    byYear,
    open: { tools: open.tools, jobs: open.jobs.size, revenue: open.revenue.length ? sumEntered(open.revenue) : null },
    counts: { jobs: jobs.length, tools: toolCount, firstVisit, lastVisit },
    matched: data?.matched || { by_link: jobs.length, by_name: 0 },
  };
}
