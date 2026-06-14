import { formatDateShortPacific } from '../../utils/dateFormat';

// Letter suffix for multi-tool jobs: 0 → A, 1 → B, etc.
const TOOL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Human-readable status labels for print tags
const STATUS_LABELS = {
  received: 'Received', diagnosed: 'Diagnosed', quoted: 'Quoted',
  approved: 'Approved', declined: 'Declined', parts_pending: 'Parts Pending',
  in_repair: 'In Repair', ready: 'Ready for Pickup', invoiced: 'Invoiced',
  completed: 'Completed', abandoned: 'Abandoned', closed: 'Closed',
  beyond_economical_repair: 'Beyond Economical Repair',
};

function buildTagHTML(job, toolItem, toolIndex) {
  const toolLetter = TOOL_LETTERS[toolIndex] || String(toolIndex + 1);
  const tagId = `${job.request_number}-${toolLetter}`;

  const contactName = escHtml(`${job.first_name} ${job.last_name}`);

  const statusLabel = STATUS_LABELS[toolItem.status] || escHtml(toolItem.status || 'Unknown');

  const dateReceived = toolItem.date_received
    ? escHtml(formatDateShortPacific(toolItem.date_received))
    : '—';

  const parts = (toolItem.parts || []).filter(p => p.name?.trim());
  const partsHTML = parts.length
    ? parts.map(p =>
        `<li>
          <span class="part-qty">×${p.quantity || 1}</span>
          <span class="part-name">${escHtml((p.name || '').toUpperCase())}</span>
          ${p.part_number ? `<span class="part-num">${escHtml(p.part_number.toUpperCase())}</span>` : ''}
        </li>`
      ).join('')
    : '<li class="none">No parts listed</li>';

  const remarksHTML = toolItem.remarks
    ? `<div class="section"><div class="label">REMARKS</div><div class="remarks-text">${escHtml(toolItem.remarks)}</div></div>`
    : '';

  return `
    <div class="tag">
      <!-- Main content -->
      <div class="content">
        <div class="top-grid">
          <div>
            <div class="wo-header">
              <div class="wo-id">${escHtml(tagId)}</div>
              ${toolItem.warranty ? '<div class="warranty-badge">WARRANTY</div>' : ''}
            </div>
            <div class="section">
              <div class="value">${escHtml((toolItem.brand || '').toUpperCase())} ${escHtml((toolItem.model_number || '').toUpperCase())} · ${escHtml((toolItem.tool_type || '').toUpperCase())}${toolItem.serial_number ? ` · S/N: ${escHtml(toolItem.serial_number.toUpperCase())}` : ''}</div>
            </div>
          </div>
          <div class="right-col">
            <div class="section">
              <div class="label">DATE RECEIVED</div>
              <div class="value">${dateReceived}</div>
            </div>
            <div class="status-badge">${escHtml(statusLabel)}</div>
          </div>
        </div>
        <div class="divider"></div>

        <div class="info-grid">
          ${job.company_name ? `
          <div class="section">
            <div class="label">COMPANY</div>
            <div class="value customer">${escHtml(job.company_name)}</div>
          </div>` : ''}
          <div class="section">
            <div class="label">CUSTOMER</div>
            <div class="value contact">${contactName}</div>
          </div>
        </div>

        ${remarksHTML}

        <div class="section parts-section">
          <div class="label">PARTS NEEDED</div>
          <ul class="parts-list">${partsHTML}</ul>
        </div>
      </div>
    </div>
  `;
}

function getTagStyles(prefix) {
  const p = prefix ? `${prefix} ` : '';
  const s = prefix || 'body';
  return `
    @page { size: 4in 3in landscape; margin: 0; }
    @media print {
      html, ${s} { width: 4in; height: 3in; overflow: hidden; }
      ${p}.tag { page-break-inside: avoid; }
    }
    ${p}* { box-sizing: border-box; margin: 0; padding: 0; }
    ${s} { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #000; }

    ${p}.tag {
      width: 4in;
      height: 3in;
      padding: 10px 14px 10px 8px;
      display: flex;
      flex-direction: row;
      gap: 10px;
      border: 1px solid #ccc;
      overflow: hidden;
    }

    ${p}.content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 5px;
      overflow: hidden;
    }

    ${p}.wo-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    ${p}.wo-id {
      font-family: monospace;
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #000;
    }
    ${p}.warranty-badge {
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.08em;
      padding: 2px 7px;
      border: 1px solid #555;
      border-radius: 4px;
      background: #fff;
      color: #555;
      flex-shrink: 0;
    }

    ${p}.divider {
      border-top: 1.5px solid #000;
      margin: 1px 0;
    }

    ${p}.section {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    ${p}.label {
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #555;
      text-transform: uppercase;
    }
    ${p}.value {
      font-size: 12px;
      font-weight: 600;
      color: #000;
      line-height: 1.3;
    }
    ${p}.top-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4px 12px;
      align-items: start;
    }
    ${p}.info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 10px;
    }
    ${p}.right-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-end;
      text-align: right;
    }
    ${p}.status-badge {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 2px 8px;
      border: 1.5px solid #000;
      border-radius: 4px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    ${p}.customer { font-size: 13px; }
    ${p}.contact { font-size: 11px; color: #333; font-weight: 500; }
    ${p}.remarks-text {
      font-size: 10px;
      line-height: 1.4;
      color: #111;
    }

    ${p}.parts-section { flex: 1; }
    ${p}.parts-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    ${p}.parts-list li {
      font-size: 10px;
      padding: 1.5px 0;
      border-bottom: 1px dotted #ddd;
      color: #111;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    ${p}.parts-list li.none {
      color: #888;
      font-style: italic;
    }
    ${p}.part-qty {
      font-size: 9px;
      font-weight: 700;
      color: #555;
      flex-shrink: 0;
    }
    ${p}.part-name { flex: 1; }
    ${p}.part-num {
      font-size: 9px;
      color: #777;
      font-family: monospace;
      flex-shrink: 0;
    }
  `;
}

export function openPrintToolTag(job, toolItem, toolIndex) {
  const tagBodyHTML = buildTagHTML(job, toolItem, toolIndex);

  if (isMobile()) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tag ${job.request_number}-${TOOL_LETTERS[toolIndex] || toolIndex + 1}</title>
  <style>${getTagStyles('')}</style>
</head>
<body>${tagBodyHTML}</body>
</html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  } else {
    const root = document.getElementById('print-work-order-root');
    if (!root) return;
    root.innerHTML = `<style>${getTagStyles('#print-work-order-root')}</style>${tagBodyHTML}`;
    const cleanup = () => { root.innerHTML = ''; };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(() => {
      window.removeEventListener('afterprint', cleanup);
      root.innerHTML = '';
    }, 60000);
  }
}
