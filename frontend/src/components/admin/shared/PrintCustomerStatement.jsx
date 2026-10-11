import { formatYmd } from '../../../utils/dateFormat';
import { formatMoney } from '../../../utils/money';
import { methodLabel } from '../../../utils/accounting';
import { paymentDay } from '../../../utils/customerAccounting';
import { isMobile } from '../../workspace/PrintDayClose';

// Printable customer accounting: the period's figures, the position as of
// today, the year table, the repairs completed and the payments received.
// Same mechanism as the Day Close: desktop prints from the global
// #print-work-order-root, phones open a new tab (pass a tab opened inside
// the tap as `win` — see openStatementTab). Internal shop figures, never
// sent to the customer.

export function openStatementTab() {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.write('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Customer Accounting</title></head><body style="font-family:\'Segoe UI\',Arial,sans-serif;padding:24px;color:#333">Preparing the statement…</body></html>');
  win.document.close();
  return win;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const money = (n) => (n == null ? '—' : formatMoney(n));
const pctText = (n) => (n == null ? '—' : `${n}%`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function getStyles(prefix) {
  const p = prefix ? `${prefix} ` : '';
  const s = prefix || 'body';
  return `
    @page { margin: 10mm; size: auto; }
    ${p}* { box-sizing: border-box; margin: 0; padding: 0; }
    ${s} { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 20px; }
    ${p}.doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; }
    ${p}.company-name { font-family: 'Russo One', sans-serif; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; }
    ${p}.company-sub { font-size: 10px; color: #333; margin-top: 2px; }
    ${p}.report-block { text-align: right; }
    ${p}.report-title { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; }
    ${p}.report-meta { font-size: 10px; color: #333; margin-top: 2px; }
    ${p}.section { margin-bottom: 14px; }
    ${p}.section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
    ${p}.customer-name { font-size: 15px; font-weight: 900; text-transform: uppercase; }
    ${p}.cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    ${p}.cards-3 { grid-template-columns: repeat(3, 1fr); }
    ${p}.card { border: 1px solid #ccc; border-radius: 6px; padding: 6px 8px; }
    ${p}.card .num { font-size: 16px; font-weight: 900; line-height: 1.1; white-space: nowrap; }
    ${p}.card .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin-top: 2px; }
    ${p}.neg { color: #b91c1c; }
    ${p}table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    ${p}th { background: #f5f5f5; border: 1px solid #ccc; padding: 3px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #333; text-align: left; }
    ${p}td { border: 1px solid #ccc; padding: 3px 6px; vertical-align: top; }
    ${p}td.num, ${p}th.num { text-align: right; white-space: nowrap; }
    ${p}td.mono { font-family: monospace; white-space: nowrap; }
    ${p}tr.total td { font-weight: 700; background: #fafafa; }
    ${p}tr { break-inside: avoid; }
    ${p}.sub { color: #333; font-size: 10px; margin-top: 2px; }
    ${p}.empty { color: #555; font-style: italic; }
    ${p}.note { font-size: 9.5px; color: #555; margin-top: 4px; }
    ${p}.footer { margin-top: 16px; padding-top: 6px; border-top: 1px solid #ccc; font-size: 9px; color: #555; display: flex; justify-content: space-between; }
  `;
}

const card = (num, label, neg = false) => `<div class="card"><div class="num${neg ? ' neg' : ''}">${escHtml(num)}</div><div class="lbl">${escHtml(label)}</div></div>`;

function buildBody({ customer, summary }) {
  const p = summary.period;
  const n = summary.now;
  const contactName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  const name = customer.company_name || contactName || 'Customer';
  const contact = [customer.company_name ? contactName : null, customer.email, customer.phone, customer.address].filter(Boolean).join(' · ');
  const range = summary.allTime ? 'All time' : `${formatYmd(summary.from)} – ${formatYmd(summary.to)}`;
  const printed = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Vancouver' });
  const visits = [
    plural(summary.counts.jobs, 'work order'), plural(summary.counts.tools, 'tool'),
    summary.counts.firstVisit ? `first visit ${formatYmd(summary.counts.firstVisit)}` : null,
    summary.counts.lastVisit && summary.counts.lastVisit !== summary.counts.firstVisit ? `last visit ${formatYmd(summary.counts.lastVisit)}` : null,
  ].filter(Boolean).join(' · ');

  const yearTable = summary.byYear.length ? `
    <div class="section">
      <div class="section-title">Year by year</div>
      <table>
        <thead><tr><th>Year</th><th class="num">Repairs</th><th class="num">Work orders</th><th class="num">Revenue</th><th class="num">Cost</th><th class="num">Profit</th><th class="num">Margin</th><th class="num">Paid</th></tr></thead>
        <tbody>${summary.byYear.map((y) => `<tr><td class="mono">${escHtml(y.year)}</td><td class="num">${y.tools || '—'}</td><td class="num">${y.jobs || '—'}</td><td class="num">${money(y.revenue)}</td><td class="num">${money(y.cost)}</td><td class="num${y.profit < 0 ? ' neg' : ''}">${money(y.profit)}</td><td class="num">${pctText(y.margin)}</td><td class="num">${money(y.paid)}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : '';

  const repairRows = p.rows.map((r) => `
    <tr>
      <td class="mono">${escHtml(formatYmd(r.day))}</td>
      <td class="mono">${escHtml(r.request_number)}</td>
      <td>${escHtml(r.label)}</td>
      <td>${escHtml(r.technician || '')}</td>
      <td class="num">${money(r.revenue)}</td>
      <td class="num">${money(r.partsCost)}</td>
      <td class="num">${money(r.labourCost)}</td>
      <td class="num">${money(r.otherCost)}</td>
      <td class="num${r.profit < 0 ? ' neg' : ''}">${money(r.profit)}</td>
      <td class="num">${pctText(r.margin)}</td>
      <td>${r.paid ? 'Paid' : r.balance != null ? `Owing ${formatMoney(r.balance)}` : '—'}</td>
    </tr>`).join('');

  const paymentRows = p.payments.map((pay) => `
    <tr>
      <td class="mono">${escHtml(formatYmd(paymentDay(pay)))}</td>
      <td class="mono">${escHtml(pay.payment_number || '')}</td>
      <td class="mono">${escHtml(pay.request_number || '')}</td>
      <td>${escHtml([methodLabel(pay.payment_method), pay.payment_reference, pay.zoho_invoice_number ? `Zoho invoice ${pay.zoho_invoice_number}` : null].filter(Boolean).join(' · '))}</td>
      <td class="num">${money(pay.amount)}</td>
    </tr>`).join('');

  return `
    <div class="doc-header">
      <div>
        <div class="company-name">CNS Tool Repair</div>
        <div class="company-sub">Internal — shop figures, pre-tax, CAD. Zoho Books remains the book of record.</div>
      </div>
      <div class="report-block">
        <div class="report-title">Customer Accounting</div>
        <div class="report-meta">${escHtml(range)}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Customer</div>
      <div class="customer-name">${escHtml(name)}</div>
      ${contact ? `<div class="sub">${escHtml(contact)}</div>` : ''}
      <div class="sub">${escHtml(visits)}</div>
    </div>
    <div class="section">
      <div class="section-title">${summary.allTime ? 'All time' : 'This period'} — repairs completed</div>
      <div class="cards">
        ${card(money(p.revenue), 'Revenue (pre-tax)')}
        ${card(money(p.cost), 'Cost to shop')}
        ${card(money(p.profit), 'Profit', p.profit < 0)}
        ${card(pctText(p.margin), 'Margin')}
        ${card(money(p.paid), summary.allTime ? 'Paid' : 'Paid in period')}
      </div>
      <div class="note">${escHtml(plural(p.completedTools, 'repair'))} completed on ${escHtml(plural(p.completedJobs, 'work order'))}${p.averagePerJob != null ? ` · average ${escHtml(money(p.averagePerJob))} per completed work order` : ''}.${p.uncostedParts ? ` ${escHtml(plural(p.uncostedParts, 'part'))} carry no cost in the parts library, so parts cost trails parts charged.` : ''}</div>
    </div>
    <div class="section">
      <div class="section-title">As of today</div>
      <div class="cards cards-3">
        ${card(money(n.received), 'Paid, all time')}
        ${card(money(n.balance), n.balance == null ? 'Balance due' : n.balance > 0 ? `Balance due on ${plural(n.invoicedJobs, 'invoiced work order')}` : n.balance < 0 ? 'Overpaid' : 'Paid in full', n.balance > 0)}
        ${card(n.open.tools ? money(n.open.revenue) : '—', n.open.tools ? `Open now — ${plural(n.open.tools, 'tool')} on ${plural(n.open.jobs, 'work order')}, expected` : 'Nothing open')}
      </div>
    </div>
    ${yearTable}
    <div class="section">
      <div class="section-title">Completed repairs (${p.rows.length})</div>
      ${p.rows.length ? `
      <table>
        <thead><tr><th>Day</th><th>Work order</th><th>Tool</th><th>Technician</th><th class="num">Revenue</th><th class="num">Parts</th><th class="num">Labour</th><th class="num">Other</th><th class="num">Profit</th><th class="num">Margin</th><th>Payment</th></tr></thead>
        <tbody>
          ${repairRows}
          <tr class="total">
            <td colspan="4">Total</td>
            <td class="num">${money(p.revenue)}</td><td class="num">${money(p.partsCost)}</td><td class="num">${money(p.labourCost)}</td><td class="num">${money(p.otherCost)}</td>
            <td class="num${p.profit < 0 ? ' neg' : ''}">${money(p.profit)}</td><td class="num">${pctText(p.margin)}</td><td></td>
          </tr>
        </tbody>
      </table>` : '<p class="empty">No repairs were completed in this period.</p>'}
    </div>
    <div class="section">
      <div class="section-title">Payments received (${p.payments.length})</div>
      ${p.payments.length ? `
      <table>
        <thead><tr><th>Day</th><th>Payment</th><th>Work order</th><th>Method</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${paymentRows}
          <tr class="total"><td colspan="4">Total</td><td class="num">${money(p.paid)}</td></tr>
        </tbody>
      </table>` : '<p class="empty">No payments were received in this period.</p>'}
    </div>
    <div class="footer"><span>A repair counts on the day its tool was marked Completed.</span><span>Printed ${escHtml(printed)}</span></div>`;
}

/**
 * Resolves when the print dialog closes (desktop) or as soon as the tab is
 * filled (phone), so the caller can tidy up at the right moment.
 */
export function openPrintCustomerStatement(opts) {
  return new Promise((resolve, reject) => {
    if (isMobile()) {
      const win = opts.win || window.open('', '_blank');
      if (!win) { reject(new Error('Pop-up blocked')); return; }
      win.document.open();
      win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Customer Accounting</title><style>${getStyles('')}</style></head><body>${buildBody(opts)}</body></html>`);
      win.document.close();
      win.focus();
      resolve();
      return;
    }
    const root = document.getElementById('print-work-order-root');
    if (!root) { resolve(); return; }
    root.innerHTML = `<style>${getStyles('#print-work-order-root')}</style>${buildBody(opts)}`;
    const cleanup = () => { root.innerHTML = ''; };
    window.addEventListener('afterprint', cleanup, { once: true });
    try {
      window.print();
    } finally {
      setTimeout(() => {
        window.removeEventListener('afterprint', cleanup);
        root.innerHTML = '';
        resolve();
      }, 60000);
      resolve();
    }
  });
}
