import { BUSINESS_INFO, getFullAddress } from '../../config/business.js';
import { formatDatePacific, formatDateShortPacific } from '../../utils/dateFormat';

const PART_STATUS_LABELS = {
  pending: 'Pending',
  ordered: 'Ordered',
  received: 'Received',
  installed: 'Installed',
};


export function openPrintWorkOrder(job) {
  const root = document.getElementById('print-work-order-root');
  if (!root) return;
  root.innerHTML = buildPrintContent(job);
  const cleanup = () => { root.innerHTML = ''; };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  // Fallback: clear after 60s if afterprint never fires (some mobile browsers)
  setTimeout(() => {
    window.removeEventListener('afterprint', cleanup);
    root.innerHTML = '';
  }, 60000);
}

function buildPrintContent(job) {
  const address = getFullAddress();
  const printDate = formatDatePacific(new Date().toISOString());

  const toolsHTML = job.tools.map((tool, idx) => {

    const partsRows = (tool.parts || [])
      .filter(p => p.name?.trim())
      .map(p => `
        <tr>
          <td>${escHtml(p.name)}</td>
          <td class="center">${p.quantity ?? 1}</td>
          <td class="center">${escHtml(PART_STATUS_LABELS[p.status] || p.status || '')}</td>
        </tr>
      `).join('');

    return `
      <div class="tool-card">
        <div class="tool-header">
          <div class="tool-num">#${idx + 1}</div>
          <div class="tool-title">
            <strong>${escHtml(tool.brand)} ${escHtml(tool.model_number)}</strong> · <span class="muted">${escHtml(tool.tool_type)}${tool.quantity > 1 ? ' × ' + tool.quantity : ''}${tool.serial_number ? ' · S/N: ' + escHtml(tool.serial_number) : ''}</span>
          </div>
          <div class="tool-badges">
            ${tool.priority && tool.priority !== 'standard' ? `<span class="badge priority-${tool.priority}">${capitalize(tool.priority)}</span>` : ''}
            ${tool.warranty ? '<span class="badge warranty">Warranty</span>' : ''}
          </div>
        </div>

        <div class="tool-grid">
          <div class="field-group">
            <div class="field-label">Received</div>
            <div>${tool.date_received ? formatDateShortPacific(tool.date_received) : '—'}</div>
          </div>
          <div class="field-group">
            <div class="field-label">Est. Completion</div>
            <div>${tool.estimated_completion ? formatDateShortPacific(tool.estimated_completion) : '—'}</div>
          </div>
          <div class="field-group">
            <div class="field-label">Technician</div>
            <div>${tool.assigned_technician ? escHtml(tool.assigned_technician) : '—'}</div>
          </div>
          <div class="field-group"><div class="field-label">Zoho Ref</div><div>${tool.zoho_ref ? escHtml(tool.zoho_ref) : '—'}</div></div>
        </div>

        ${tool.remarks ? `
          <div class="remarks">
            <span class="field-label">Remarks: </span>${escHtml(tool.remarks)}
          </div>
        ` : ''}

        ${partsRows ? `
          <table class="parts-table">
            <thead>
              <tr>
                <th>Part</th>
                <th class="center">Qty</th>
                <th class="center">Status</th>
              </tr>
            </thead>
            <tbody>${partsRows}</tbody>
          </table>
        ` : ''}

      </div>
    `;
  }).join('');

  return `
    <style>
      #print-work-order-root * { box-sizing: border-box; margin: 0; padding: 0; }
      #print-work-order-root { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 24px; }
      #print-work-order-root .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1152d4; padding-bottom: 12px; margin-bottom: 16px; }
      #print-work-order-root .company-name { font-family: 'Russo One', sans-serif; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; color: #1152d4; }
      #print-work-order-root .company-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
      #print-work-order-root .wo-block { text-align: right; }
      #print-work-order-root .wo-number { font-size: 22px; font-weight: 900; font-family: monospace; color: #1152d4; }
      #print-work-order-root .wo-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
      #print-work-order-root .section { margin-bottom: 14px; }
      #print-work-order-root .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
      #print-work-order-root .customer-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 16px; }
      #print-work-order-root .field-group { display: flex; flex-direction: column; margin-bottom: 4px; }
      #print-work-order-root .field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
      #print-work-order-root .muted { color: #94a3b8; font-style: italic; }
      #print-work-order-root .tool-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      #print-work-order-root .tool-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
      #print-work-order-root .tool-num { width: 24px; height: 24px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; flex-shrink: 0; }
      #print-work-order-root .tool-title { flex: 1; }
      #print-work-order-root .tool-title strong { font-size: 13px; }
      #print-work-order-root .tool-title .muted { font-size: 11px; }
      #print-work-order-root .tool-badges { display: flex; gap: 4px; flex-wrap: wrap; flex-shrink: 0; }
      #print-work-order-root .badge { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; border: 1px solid; }
      #print-work-order-root .badge.priority-rush { background: #fff7ed; color: #c2410c; border-color: #fdba74; }
      #print-work-order-root .badge.priority-urgent { background: #fef2f2; color: #b91c1c; border-color: #fca5a5; }
      #print-work-order-root .badge.warranty { background: #f0fdfa; color: #0f766e; border-color: #5eead4; }
      #print-work-order-root .tool-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px; margin-bottom: 8px; }
      #print-work-order-root .remarks { margin-bottom: 8px; line-height: 1.5; font-size: 11px; }
      #print-work-order-root .parts-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; table-layout: fixed; }
      #print-work-order-root .parts-table th:nth-child(1), #print-work-order-root .parts-table td:nth-child(1) { width: 60%; }
      #print-work-order-root .parts-table th:nth-child(2), #print-work-order-root .parts-table td:nth-child(2) { width: 15%; }
      #print-work-order-root .parts-table th:nth-child(3), #print-work-order-root .parts-table td:nth-child(3) { width: 25%; }
      #print-work-order-root .parts-table th { background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 8px; font-size: 10px; text-transform: uppercase; color: #64748b; text-align: center; }
      #print-work-order-root .parts-table th:first-child { text-align: left; }
      #print-work-order-root .parts-table td { border: 1px solid #e2e8f0; padding: 4px 8px; }
      #print-work-order-root .center { text-align: center; }
      #print-work-order-root .signature-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; }
      #print-work-order-root .signature-row .signature-box { width: 220px; }
      #print-work-order-root .terms { font-size: 9px; color: #64748b; line-height: 1.6; }
      #print-work-order-root .terms-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 4px; }
      #print-work-order-root .signature-box { border-top: 1px solid #64748b; padding-top: 4px; font-size: 10px; color: #64748b; }
    </style>

    <div class="doc-header">
      <div>
        <div class="company-name">${escHtml(BUSINESS_INFO.name)}</div>
        <div class="company-sub">${escHtml(address)}</div>
        <div class="company-sub">${escHtml(BUSINESS_INFO.phone)} · ${escHtml(BUSINESS_INFO.email)}</div>
      </div>
      <div class="wo-block">
        <div class="wo-number">${escHtml(job.request_number)}</div>
        <div class="wo-meta">${printDate}</div>
        <div class="wo-meta">Source: ${job.source === 'online_request' ? 'Online Request' : job.source === 'phone_in' ? 'Phone-in' : job.source === 'email' ? 'Email' : 'Drop-off'}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Customer Information</div>
      <div class="customer-grid">
        <div class="field-group"><div class="field-label">Company</div><div>${job.company_name ? escHtml(job.company_name) : '—'}</div></div>
        <div class="field-group"><div class="field-label">Contact</div><div>${escHtml(job.first_name)} ${escHtml(job.last_name)}</div></div>
        <div class="field-group"><div class="field-label">Email</div><div>${escHtml(job.email)}</div></div>
        <div class="field-group"><div class="field-label">Phone</div><div>${escHtml(job.phone)}</div></div>
        ${job.address ? `<div class="field-group" style="grid-column:span 2"><div class="field-label">Address</div><div>${escHtml(job.address)}</div></div>` : '<div class="field-group" style="grid-column:span 2"></div>'}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Tools (${job.tools.length})</div>
      ${toolsHTML}
    </div>


    <div class="signature-row">
      <div class="terms">
        <div class="terms-title">Terms &amp; Conditions</div>
        1. Replaced parts carry a 30-day warranty.<br/>
        2. Not liable for pre-existing damage.<br/>
        3. Unclaimed items after 30 days may be disposed of.
      </div>
      <div class="signature-box">Customer Signature &amp; Date</div>
    </div>

  `;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
