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

  const contactName = escHtml(`${job.first_name} ${job.last_name}`.toUpperCase());

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
    ? `<div class="section"><div class="label">REMARKS</div><div class="remarks-text">${escHtml(toolItem.remarks.toUpperCase())}</div></div>`
    : '';

  // Hathorn camera intake: pushrod footage and what arrived with the unit.
  // The tag travels with the tool, so this is the checklist at pickup.
  const rodBits = [
    toolItem.rod_length_received != null ? `RECV ${toolItem.rod_length_received} FT` : '',
    toolItem.rod_length_cut != null ? `CUT ${toolItem.rod_length_cut} FT` : '',
    toolItem.rod_length_remaining != null ? `REM ${toolItem.rod_length_remaining} FT` : '',
  ].filter(Boolean).join(' · ');
  const rodHTML = rodBits ? `<div class="rod-line">ROD: ${rodBits}</div>` : '';

  // "HEAD D18 S/N: S123" — model then serial, whichever halves were recorded
  const comp = (label, model, serial) => (model || serial)
    ? `${label} ${[model && escHtml(model.toUpperCase()), serial && `S/N: ${escHtml(serial.toUpperCase())}`].filter(Boolean).join(' ')}`
    : '';
  const compBits = [
    comp('CTRL', toolItem.controller_model, toolItem.controller_serial),
    comp('REEL', toolItem.reel_model, toolItem.reel_serial),
    comp('HEAD', toolItem.camera_head_model, toolItem.camera_head_serial),
  ].filter(Boolean).join(' · ');
  const compHTML = compBits ? `<div class="rod-line">${compBits}</div>` : '';

  const included = (toolItem.included_items || []).filter(Boolean);
  const includesHTML = included.length
    ? `<div class="section">
        <div class="label">INCLUDED WITH UNIT (${included.length})</div>
        <div class="includes-line">${included.map(i => escHtml(i.toUpperCase())).join(', ')}</div>
      </div>`
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
              <div class="value">${escHtml([toolItem.brand, toolItem.model_number].filter(Boolean).join(' ').toUpperCase())}</div>
              <div class="value">${escHtml((toolItem.tool_type || '').toUpperCase())}${toolItem.serial_number ? ` · S/N: ${escHtml(toolItem.serial_number.toUpperCase())}` : ''}</div>
              ${compHTML}
              ${rodHTML}
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
            <div class="value customer">${escHtml(job.company_name.toUpperCase())}</div>
          </div>` : ''}
          <div class="section">
            <div class="label">CUSTOMER</div>
            <div class="value contact">${contactName}</div>
          </div>
        </div>

        ${remarksHTML}
        ${includesHTML}

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
    @page { size: 4in 2in landscape; margin: 0; }
    @media print {
      html, ${s} { width: 4in; height: 2in; overflow: hidden; }
      ${p}.tag { page-break-inside: avoid; }
    }
    ${p}* { box-sizing: border-box; margin: 0; padding: 0; }
    ${s} { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #000; }

    ${p}.tag {
      width: 4in;
      height: 2in;
      padding: 6px 10px 6px 6px;
      display: flex;
      flex-direction: row;
      gap: 6px;
      border: 1px solid #ccc;
      overflow: hidden;
    }

    ${p}.content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      overflow: hidden;
    }

    ${p}.wo-header {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    ${p}.wo-id {
      font-family: monospace;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #000;
    }
    ${p}.warranty-badge {
      font-size: 7px;
      font-weight: 500;
      letter-spacing: 0.08em;
      padding: 1px 5px;
      border: 1px solid #555;
      border-radius: 3px;
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
      font-size: 6px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #555;
      text-transform: uppercase;
    }
    ${p}.value {
      font-size: 9px;
      font-weight: 600;
      color: #000;
      line-height: 1.2;
    }
    ${p}.top-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 3px 10px;
      align-items: start;
    }
    ${p}.info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 8px;
    }
    ${p}.right-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
      align-items: flex-end;
      text-align: right;
    }
    ${p}.status-badge {
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.02em;
      padding: 1px 5px;
      border: 1.5px solid #000;
      border-radius: 3px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    ${p}.customer { font-size: 9px; }
    ${p}.contact { font-size: 8px; color: #333; font-weight: 500; }
    ${p}.remarks-text {
      font-size: 8px;
      line-height: 1.3;
      color: #111;
    }

    ${p}.parts-section { flex: 1; }
    ${p}.parts-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    ${p}.parts-list li {
      font-size: 8px;
      padding: 1px 0;
      border-bottom: 1px dotted #ddd;
      color: #111;
      display: flex;
      align-items: baseline;
      gap: 3px;
    }
    ${p}.parts-list li.none {
      color: #888;
      font-style: italic;
    }
    ${p}.part-qty {
      font-size: 7px;
      font-weight: 700;
      color: #555;
      flex-shrink: 0;
    }
    ${p}.part-name { flex: 1; }
    ${p}.rod-line {
      font-size: 8px;
      font-weight: 700;
      margin-top: 2px;
      letter-spacing: 0.02em;
    }
    ${p}.includes-line {
      font-size: 8px;
      line-height: 1.35;
      word-break: break-word;
    }
    ${p}.part-num {
      font-size: 7px;
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
