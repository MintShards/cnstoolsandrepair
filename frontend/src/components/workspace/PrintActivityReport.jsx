import { formatYmd } from '../../utils/dateFormat';
import { activityKind } from '../../constants/activity';

// Printable activity report — same mechanism as PrintWorkOrder: desktop
// prints from the global #print-work-order-root, phones open a new tab.

const STATUS_LABELS = {
  received: 'Received', diagnosed: 'Diagnosed', quoted: 'Quoted', approved: 'Approved',
  parts_pending: 'Parts Pending', in_repair: 'In Repair', ready: 'Ready for Pickup',
  invoiced: 'Invoiced', completed: 'Completed', declined: 'Declined',
  beyond_economical_repair: 'Beyond Economical Repair', abandoned: 'Abandoned', closed: 'Closed',
};

export function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// Phones get the report in a new tab, and Safari's pop-up blocker only allows
// window.open inside the tap itself — not after the data fetch resolves. Open
// the tab first with a placeholder; openPrintActivityReport fills it later.
// Returns null when the browser blocked it so the caller can say so.
export function openReportTab() {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.write('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Activity Report</title></head><body style="font-family:\'Segoe UI\',Arial,sans-serif;padding:24px;color:#333">Preparing the activity report…</body></html>');
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

// Weekday-prefixed day heading from a YYYY-MM-DD, using local calendar math
// so no timezone can shift the date.
function longDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function rangeLabel(from, to) {
  return from === to ? formatYmd(from) : `${formatYmd(from)} – ${formatYmd(to)}`;
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
    ${p}.card .num { font-size: 18px; font-weight: 900; line-height: 1.1; }
    ${p}.card .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin-top: 2px; }
    ${p}.inline-list { font-size: 11px; line-height: 1.6; }
    ${p}table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    ${p}th { background: #f5f5f5; border: 1px solid #ccc; padding: 3px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #333; text-align: left; }
    ${p}td { border: 1px solid #ccc; padding: 3px 6px; vertical-align: top; }
    ${p}td.num, ${p}th.num { text-align: right; white-space: nowrap; }
    ${p}td.time { white-space: nowrap; width: 62px; }
    ${p}td.who { white-space: nowrap; width: 110px; }
    ${p}td.wo { white-space: nowrap; width: 92px; font-family: monospace; }
    ${p}.kind { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; display: block; }
    ${p}.details { color: #333; font-size: 10px; }
    ${p}.day { margin-bottom: 12px; }
    ${p}.day-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; break-after: avoid; }
    ${p}.day-title span { font-weight: 400; color: #555; text-transform: none; letter-spacing: 0; }
    ${p}tr { break-inside: avoid; }
    ${p}.empty { color: #555; font-style: italic; }
    ${p}.footer { margin-top: 16px; padding-top: 6px; border-top: 1px solid #ccc; font-size: 9px; color: #555; display: flex; justify-content: space-between; }
  `;
}

function card(num, label) {
  return `<div class="card"><div class="num">${escHtml(num)}</div><div class="lbl">${escHtml(label)}</div></div>`;
}

function buildSummary(summary) {
  const t = summary.transitions || {};
  const open = summary.open_at_end || {};
  const openLines = Object.entries(open)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${escHtml(STATUS_LABELS[s] || s)}: <strong>${n}</strong>`)
    .join(' &nbsp;·&nbsp; ');
  return `
    <div class="section">
      <div class="section-title">Progress summary</div>
      <div class="cards">
        ${card(summary.tools_received, 'Tools received')}
        ${card(summary.jobs_created, 'Work orders opened')}
        ${card(summary.requests_received, 'Online requests')}
        ${card(summary.status_changes, 'Status changes')}
        ${card(t.quoted || 0, 'Quoted')}
        ${card(t.approved || 0, 'Approved')}
        ${card(t.ready || 0, 'Ready for pickup')}
        ${card(t.completed || 0, 'Completed')}
        ${card(summary.tasks_completed, 'Tasks completed')}
        ${card(summary.avg_turnaround_days != null ? `${summary.avg_turnaround_days}d` : '—', 'Avg. turnaround to ready')}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Open work at end of period — ${escHtml(summary.open_total)} tool${summary.open_total === 1 ? '' : 's'}</div>
      <div class="inline-list">${openLines || '<span class="empty">Nothing open.</span>'}</div>
    </div>`;
}

function buildMonths(months) {
  if (!months || !months.length) return '';
  const rows = months.map((m) => `
    <tr>
      <td>${escHtml(monthLabel(m.month))}</td>
      <td class="num">${m.tools_received}</td>
      <td class="num">${m.jobs_created}</td>
      <td class="num">${m.requests_received}</td>
      <td class="num">${m.status_changes}</td>
      <td class="num">${m.ready}</td>
      <td class="num">${m.completed}</td>
      <td class="num">${m.tasks_completed}</td>
      <td class="num">${m.events}</td>
    </tr>`).join('');
  return `
    <div class="section">
      <div class="section-title">Month by month</div>
      <table>
        <thead><tr>
          <th>Month</th><th class="num">Tools in</th><th class="num">WOs opened</th><th class="num">Requests</th>
          <th class="num">Status changes</th><th class="num">Ready</th><th class="num">Completed</th>
          <th class="num">Tasks done</th><th class="num">All events</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function buildLog(events) {
  if (!events.length) {
    return '<div class="section"><div class="section-title">Daily log</div><p class="empty">No recorded activity in this period.</p></div>';
  }
  const byDay = new Map();
  for (const e of events) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(e);
  }
  const days = [...byDay.entries()].map(([day, list]) => {
    const rows = list.map((e) => {
      const kind = activityKind(e.kind);
      const details = (e.details || []).join('; ');
      return `
        <tr>
          <td class="time">${escHtml(e.time)}</td>
          <td class="who">${escHtml(e.actor?.name || '—')}</td>
          <td><span class="kind">${escHtml(kind.label)}</span>${escHtml(e.summary)}${details ? `<div class="details">${escHtml(details)}</div>` : ''}</td>
          <td class="wo">${escHtml(e.request_number || '')}</td>
        </tr>`;
    }).join('');
    return `
      <div class="day">
        <div class="day-title">${escHtml(longDay(day))} <span>— ${list.length} happening${list.length === 1 ? '' : 's'}</span></div>
        <table>
          <thead><tr><th>Time</th><th>Who</th><th>What happened</th><th>Work order</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
  return `<div class="section"><div class="section-title">Daily log</div>${days}</div>`;
}

function buildBody({ data, includeLog, generatedBy }) {
  const generated = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const events = data.events || [];
  return `
    <div class="doc-header">
      <div>
        <div class="company-name">CNS Tool Repair</div>
        <div class="company-sub">Repair Tracker &amp; Workspace activity</div>
      </div>
      <div class="report-block">
        <div class="report-title">Activity Report</div>
        <div class="report-meta">${escHtml(rangeLabel(data.from, data.to))}</div>
        <div class="report-meta">${events.length} happening${events.length === 1 ? '' : 's'} across ${data.days_with_activity} day${data.days_with_activity === 1 ? '' : 's'}</div>
      </div>
    </div>
    ${buildSummary(data.summary || {})}
    ${buildMonths(data.months)}
    ${includeLog ? buildLog(events) : '<div class="section"><div class="section-title">Daily log</div><p class="empty">Daily log omitted for this range — print a shorter period for the line-by-line detail.</p></div>'}
    <div class="footer">
      <span>Generated ${escHtml(generated)}${generatedBy ? ` by ${escHtml(generatedBy)}` : ''}</span>
      <span>Internal — not customer facing</span>
    </div>`;
}

function buildFullHTML(opts) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Activity Report ${escHtml(rangeLabel(opts.data.from, opts.data.to))}</title>
  <link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet"/>
  <style>${getStyles('')}</style>
</head>
<body>${buildBody(opts)}</body>
</html>`;
}

/**
 * Print an activity report. `data` is the GET /api/activity payload;
 * `includeLog` controls the line-by-line section (the year report prints
 * summary + months only by default).
 *
 * Resolves once the print dialog is out of the way: desktop browsers block
 * inside window.print() until the dialog closes (print or cancel), and the
 * phone path resolves as soon as the new tab is open — so the caller can
 * dismiss its own dialog at the right moment.
 */
export function openPrintActivityReport(opts) {
  return new Promise((resolve, reject) => {
    if (isMobile()) {
      // Prefer a tab the caller opened inside the tap (see openReportTab).
      const win = opts.win || window.open('', '_blank');
      if (!win) {
        reject(new Error('The browser blocked the report tab. Allow pop-ups for this site and try again.'));
        return;
      }
      win.document.open();
      win.document.write(buildFullHTML(opts));
      win.document.close();
      win.focus();
      resolve();
      return;
    }
    const root = document.getElementById('print-work-order-root');
    if (!root) { resolve(); return; }
    root.innerHTML = `<style>${getStyles('#print-work-order-root')}</style>${buildBody(opts)}`;
    // The markup stays until the dialog reports it's done with it — never
    // cleared on the print() return alone, in case a browser returns early.
    const cleanup = () => { root.innerHTML = ''; };
    window.addEventListener('afterprint', cleanup, { once: true });
    try {
      window.print();
    } finally {
      setTimeout(() => {
        window.removeEventListener('afterprint', cleanup);
        root.innerHTML = '';
      }, 60000);
      resolve();
    }
  });
}
