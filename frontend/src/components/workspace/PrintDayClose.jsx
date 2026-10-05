import { formatYmd } from '../../utils/dateFormat';
import { formatMoney } from '../../utils/money';
import { JOURNAL_KINDS, shopTime } from '../../utils/accounting';

// Printable close of a day or period: the P&L of the repairs completed,
// then the money journal. Same mechanism as the activity report: desktop
// prints from the global #print-work-order-root, phones open a new tab
// (pass a tab opened inside the tap as `win` — see openReportTab).

export function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function openCloseTab() {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.write('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Day Close</title></head><body style="font-family:\'Segoe UI\',Arial,sans-serif;padding:24px;color:#333">Preparing the day close…</body></html>');
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
const signed = (e) => {
  if (e.amount == null) return '';
  if (e.direction === 'in') return `+${formatMoney(e.amount, e.currency)}`;
  if (e.direction === 'out') return `−${formatMoney(e.amount, e.currency)}`;
  return formatMoney(e.amount, e.currency);
};

function longDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

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
    ${p}.cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    ${p}.card { border: 1px solid #ccc; border-radius: 6px; padding: 6px 8px; }
    ${p}.card .num { font-size: 16px; font-weight: 900; line-height: 1.1; white-space: nowrap; }
    ${p}.card .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin-top: 2px; }
    ${p}.neg { color: #b91c1c; }
    ${p}table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    ${p}th { background: #f5f5f5; border: 1px solid #ccc; padding: 3px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #333; text-align: left; }
    ${p}td { border: 1px solid #ccc; padding: 3px 6px; vertical-align: top; }
    ${p}td.num, ${p}th.num { text-align: right; white-space: nowrap; }
    ${p}td.mono { font-family: monospace; white-space: nowrap; }
    ${p}td.time { white-space: nowrap; width: 62px; }
    ${p}tr.total td { font-weight: 700; background: #fafafa; }
    ${p}.kind { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; display: block; }
    ${p}.sub { color: #333; font-size: 10px; }
    ${p}.day-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 8px 0 4px; break-after: avoid; }
    ${p}tr { break-inside: avoid; }
    ${p}.empty { color: #555; font-style: italic; }
    ${p}.note { font-size: 9.5px; color: #555; margin-top: 4px; }
    ${p}.footer { margin-top: 16px; padding-top: 6px; border-top: 1px solid #ccc; font-size: 9px; color: #555; display: flex; justify-content: space-between; }
  `;
}

const card = (num, label, neg = false) => `<div class="card"><div class="num${neg ? ' neg' : ''}">${escHtml(num)}</div><div class="lbl">${escHtml(label)}</div></div>`;

function buildPnl(pnl, single) {
  const t = pnl.totals;
  const rows = pnl.rows.map((r) => `
    <tr>
      ${single ? '' : `<td class="mono">${escHtml(formatYmd(r.day))}</td>`}
      <td class="mono">${escHtml(r.request_number)}</td>
      <td>${escHtml(r.customer)}</td>
      <td>${escHtml(r.label)}</td>
      <td class="num">${money(r.revenue)}</td>
      <td class="num">${money(r.partsCost)}</td>
      <td class="num">${money(r.labourCost)}</td>
      <td class="num">${money(r.otherCost)}</td>
      <td class="num${r.profit < 0 ? ' neg' : ''}">${money(r.profit)}</td>
      <td class="num">${r.margin == null ? '—' : `${r.margin}%`}</td>
      <td>${r.paid ? 'Paid' : r.balance != null ? `Owing ${formatMoney(r.balance)}` : '—'}</td>
    </tr>`).join('');
  const days = !single && pnl.days.length > 1 ? `
    <div class="section">
      <div class="section-title">Day by day</div>
      <table>
        <thead><tr><th>Day</th><th class="num">Repairs</th><th class="num">Revenue</th><th class="num">Cost</th><th class="num">Profit</th><th class="num">Margin</th></tr></thead>
        <tbody>${pnl.days.map((d) => `<tr><td>${escHtml(longDay(d.day))}</td><td class="num">${d.count}</td><td class="num">${money(d.revenue)}</td><td class="num">${money(d.cost)}</td><td class="num${d.profit < 0 ? ' neg' : ''}">${money(d.profit)}</td><td class="num">${d.margin == null ? '—' : `${d.margin}%`}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : '';
  return `
    <div class="section">
      <div class="section-title">Profit &amp; loss — repairs completed</div>
      <div class="cards">
        ${card(String(t.count), 'Repairs completed')}
        ${card(money(t.revenue), 'Revenue (pre-tax)')}
        ${card(money(t.cost), 'Cost to shop')}
        ${card(money(t.profit), 'Profit', t.profit < 0)}
        ${card(t.margin == null ? '—' : `${t.margin}%`, 'Margin')}
      </div>
      ${t.uncostedParts ? `<div class="note">${t.uncostedParts} part${t.uncostedParts === 1 ? '' : 's'} on these repairs carry no cost in the parts library, so parts cost trails parts charged.</div>` : ''}
    </div>
    ${days}
    <div class="section">
      <div class="section-title">Completed repairs (${pnl.rows.length})</div>
      ${pnl.rows.length ? `
      <table>
        <thead><tr>
          ${single ? '' : '<th>Day</th>'}<th>Work order</th><th>Customer</th><th>Tool</th>
          <th class="num">Revenue</th><th class="num">Parts</th><th class="num">Labour</th><th class="num">Other</th><th class="num">Profit</th><th class="num">Margin</th><th>Payment</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="total">
            <td colspan="${single ? 3 : 4}">Total</td>
            <td class="num">${money(t.revenue)}</td><td class="num">${money(t.partsCost)}</td><td class="num">${money(t.labourCost)}</td><td class="num">${money(t.otherCost)}</td>
            <td class="num${t.profit < 0 ? ' neg' : ''}">${money(t.profit)}</td><td class="num">${t.margin == null ? '—' : `${t.margin}%`}</td><td>${t.unpaid ? `${t.unpaid} owing` : ''}</td>
          </tr>
        </tbody>
      </table>` : '<p class="empty">No repairs were completed in this period.</p>'}
    </div>`;
}

function buildJournal(journal, single) {
  if (!journal) return '';
  const t = journal.totals;
  let lastDay = null;
  const rows = journal.entries.map((e) => {
    const dayRow = !single && e.day !== lastDay ? `<tr><td colspan="5" class="day-title">${escHtml(longDay(e.day))}</td></tr>` : '';
    lastDay = e.day;
    const refs = [e.ref?.number, e.wo?.number].filter(Boolean).join(' · ');
    return `${dayRow}
    <tr>
      <td class="time">${escHtml(shopTime(e.ts))}</td>
      <td><span class="kind">${escHtml(JOURNAL_KINDS[e.kind]?.label || e.kind)}</span>${escHtml(e.title)}${e.sub ? `<div class="sub">${escHtml(e.sub)}</div>` : ''}</td>
      <td class="mono">${escHtml(refs)}</td>
      <td class="num${e.direction === 'out' ? ' neg' : ''}">${escHtml(signed(e))}</td>
      <td>${escHtml(e.actor?.name || '')}</td>
    </tr>`;
  }).join('');
  return `
    <div class="section">
      <div class="section-title">Money journal (${journal.entries.length})</div>
      <div class="cards">
        ${card(money(t.billed), 'Invoiced (pre-tax)')}
        ${card(money(t.received), 'Received')}
        ${card(money(t.owed), 'Bills logged')}
        ${card(money(t.paid), 'Bills paid')}
        ${card(money(t.net), 'Net cash', t.net < 0)}
      </div>
      ${journal.entries.length ? `
      <table style="margin-top:8px">
        <thead><tr><th>Time</th><th>Event</th><th>Reference</th><th class="num">Amount</th><th>Who</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<p class="empty" style="margin-top:8px">No money events in this period.</p>'}
    </div>`;
}

function buildBody({ from, to, pnl, journal }) {
  const single = from === to;
  const title = single ? 'Day Close' : 'Period Close';
  const range = single ? longDay(from) : `${formatYmd(from)} – ${formatYmd(to)}`;
  const printed = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Vancouver' });
  return `
    <div class="doc-header">
      <div>
        <div class="company-name">CNS Tool Repair</div>
        <div class="company-sub">Internal — shop figures, pre-tax, CAD. Zoho Books remains the book of record.</div>
      </div>
      <div class="report-block">
        <div class="report-title">${escHtml(title)}</div>
        <div class="report-meta">${escHtml(range)}</div>
      </div>
    </div>
    ${buildPnl(pnl, single)}
    ${buildJournal(journal, single)}
    <div class="footer"><span>A repair counts on the day its tool was marked Completed.</span><span>Printed ${escHtml(printed)}</span></div>`;
}

/**
 * Resolves when the print dialog closes (desktop) or as soon as the tab is
 * filled (phone), so the caller can tidy up at the right moment.
 */
export function openPrintDayClose(opts) {
  return new Promise((resolve, reject) => {
    if (isMobile()) {
      const win = opts.win || window.open('', '_blank');
      if (!win) { reject(new Error('Pop-up blocked')); return; }
      win.document.open();
      win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${opts.from === opts.to ? 'Day Close' : 'Period Close'}</title><style>${getStyles('')}</style></head><body>${buildBody(opts)}</body></html>`);
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
