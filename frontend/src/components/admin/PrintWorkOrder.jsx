import { REPAIR_STATUSES } from '../../constants/repairStatuses';
import { BUSINESS_INFO, getFullAddress } from '../../config/business.js';
import { formatDatePacific, formatDateShortPacific } from '../../utils/dateFormat';

const PART_STATUS_LABELS = {
  pending: 'Pending',
  ordered: 'Ordered',
  received: 'Received',
  installed: 'Installed',
};

function calcLabourTotal(tool) {
  if (tool.labour_hours && tool.hourly_rate) {
    return (parseFloat(tool.labour_hours) * parseFloat(tool.hourly_rate)).toFixed(2);
  }
  return null;
}

function calcPartsTotal(tool) {
  const parts = (tool.parts || []).filter(p => p.name?.trim() && p.unit_cost != null);
  if (!parts.length) return null;
  return parts.reduce((sum, p) => sum + (parseFloat(p.unit_cost) * (p.quantity || 1)), 0).toFixed(2);
}

export function openPrintWorkOrder(job) {
  const html = buildPrintHTML(job);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Small delay so images can start loading before print dialog
  setTimeout(() => win.print(), 400);
}

function buildPrintHTML(job) {
  const address = getFullAddress();
  const printDate = formatDatePacific(new Date().toISOString());

  const toolsHTML = job.tools.map((tool, idx) => {
    const statusCfg = REPAIR_STATUSES[tool.status] || {};
    const labourTotal = calcLabourTotal(tool);
    const partsTotal = calcPartsTotal(tool);
    const grandTotal = (parseFloat(labourTotal || 0) + parseFloat(partsTotal || 0)) || null;

    const partsRows = (tool.parts || [])
      .filter(p => p.name?.trim())
      .map(p => `
        <tr>
          <td>${escHtml(p.name)}</td>
          <td class="center">${p.quantity ?? 1}</td>
          <td class="center">${p.unit_cost != null ? '$' + parseFloat(p.unit_cost).toFixed(2) : '—'}</td>
          <td class="center">${p.unit_cost != null ? '$' + (parseFloat(p.unit_cost) * (p.quantity || 1)).toFixed(2) : '—'}</td>
          <td class="center">${escHtml(PART_STATUS_LABELS[p.status] || p.status || '')}</td>
        </tr>
      `).join('');

    return `
      <div class="tool-card">
        <div class="tool-header">
          <div class="tool-num">#${idx + 1}</div>
          <div class="tool-title">
            <strong>${escHtml(tool.brand)} ${escHtml(tool.model_number)}</strong>
            <span class="muted">${escHtml(tool.tool_type)}${tool.quantity > 1 ? ' × ' + tool.quantity : ''}${tool.serial_number ? ' · S/N: ' + escHtml(tool.serial_number) : ''}</span>
          </div>
          <div class="tool-badges">
            <span class="badge status">${escHtml(statusCfg.label || tool.status)}</span>
            <span class="badge priority-${tool.priority}">${capitalize(tool.priority || 'standard')}</span>
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
          ${tool.zoho_ref ? `<div class="field-group"><div class="field-label">Zoho Ref</div><div>${escHtml(tool.zoho_ref)}</div></div>` : ''}
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
                <th class="center">Unit Cost</th>
                <th class="center">Total</th>
                <th class="center">Status</th>
              </tr>
            </thead>
            <tbody>${partsRows}</tbody>
            ${partsTotal ? `
              <tfoot>
                <tr><td colspan="3" class="right"><strong>Parts Subtotal</strong></td><td class="center"><strong>$${partsTotal}</strong></td><td></td></tr>
              </tfoot>
            ` : ''}
          </table>
        ` : ''}

        <div class="labour-row">
          ${labourTotal ? `
            <span class="field-label">Labour:</span>
            ${tool.labour_hours} hrs @ $${parseFloat(tool.hourly_rate).toFixed(2)}/hr
            = <strong>$${labourTotal}</strong>
          ` : '<span class="muted">Labour not set</span>'}
          ${grandTotal ? `<span class="total-badge">Tool Total: $${grandTotal}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Grand total across all tools
  const allTotals = job.tools.map(t => {
    const l = calcLabourTotal(t);
    const p = calcPartsTotal(t);
    return parseFloat(l || 0) + parseFloat(p || 0);
  });
  const grandTotal = allTotals.reduce((a, b) => a + b, 0);
  const grandTotalStr = grandTotal > 0 ? grandTotal.toFixed(2) : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Work Order ${escHtml(job.request_number)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 24px; }
    @media print {
      body { padding: 12px; }
      .no-print { display: none !important; }
      .tool-card { break-inside: avoid; }
    }

    /* Header */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1152d4; padding-bottom: 12px; margin-bottom: 16px; }
    .company-name { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; color: #1152d4; }
    .company-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .wo-block { text-align: right; }
    .wo-number { font-size: 22px; font-weight: 900; font-family: monospace; color: #1152d4; }
    .wo-meta { font-size: 11px; color: #64748b; margin-top: 2px; }

    /* Customer section */
    .section { margin-bottom: 14px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
    .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
    .field-group { display: flex; flex-direction: column; margin-bottom: 4px; }
    .field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
    .muted { color: #94a3b8; font-style: italic; }

    /* Tool cards */
    .tool-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .tool-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
    .tool-num { width: 24px; height: 24px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; flex-shrink: 0; }
    .tool-title { flex: 1; }
    .tool-title strong { display: block; font-size: 13px; }
    .tool-title .muted { font-size: 11px; }
    .tool-badges { display: flex; gap: 4px; flex-wrap: wrap; flex-shrink: 0; }

    /* Badges */
    .badge { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; border: 1px solid; }
    .badge.status { background: #eff6ff; color: #1d4ed8; border-color: #93c5fd; }
    .badge.priority-standard { background: #f8fafc; color: #64748b; border-color: #cbd5e1; }
    .badge.priority-rush { background: #fff7ed; color: #c2410c; border-color: #fdba74; }
    .badge.priority-urgent { background: #fef2f2; color: #b91c1c; border-color: #fca5a5; }
    .badge.warranty { background: #f0fdfa; color: #0f766e; border-color: #5eead4; }

    /* Tool grid */
    .tool-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px; margin-bottom: 8px; }
    .remarks { margin-bottom: 8px; line-height: 1.5; font-size: 11px; }

    /* Parts table */
    .parts-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
    .parts-table th { background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 8px; font-size: 10px; text-transform: uppercase; color: #64748b; }
    .parts-table td { border: 1px solid #e2e8f0; padding: 4px 8px; }
    .parts-table tfoot td { background: #f8fafc; }
    .center { text-align: center; }
    .right { text-align: right; }

    /* Labour row */
    .labour-row { display: flex; align-items: center; gap: 8px; font-size: 11px; flex-wrap: wrap; margin-top: 4px; }
    .total-badge { margin-left: auto; background: #1152d4; color: #fff; padding: 3px 10px; border-radius: 6px; font-weight: 900; font-size: 12px; }

    /* Grand total */
    .grand-total-row { display: flex; justify-content: flex-end; margin-top: 4px; }
    .grand-total { background: #1e293b; color: #fff; padding: 6px 16px; border-radius: 8px; font-size: 15px; font-weight: 900; }

    /* Footer */
    .doc-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
    .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; }
    .signature-box { border-top: 1px solid #64748b; padding-top: 4px; font-size: 10px; color: #64748b; }

    /* Print button (screen only) */
    .print-btn { position: fixed; bottom: 24px; right: 24px; background: #1152d4; color: #fff; border: none; border-radius: 12px; padding: 12px 20px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 20px rgba(17,82,212,0.4); }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="doc-header">
    <div>
      <div class="company-name">${escHtml(BUSINESS_INFO.name)}</div>
      <div class="company-sub">${escHtml(address)}</div>
      <div class="company-sub">${escHtml(BUSINESS_INFO.phone)} · ${escHtml(BUSINESS_INFO.email)}</div>
    </div>
    <div class="wo-block">
      <div class="wo-number">${escHtml(job.request_number)}</div>
      <div class="wo-meta">Work Order</div>
      <div class="wo-meta">Printed: ${printDate}</div>
      <div class="wo-meta">Source: ${job.source === 'online_request' ? 'Online Request' : job.source === 'phone_in' ? 'Phone-in' : job.source === 'email' ? 'Email' : 'Drop-off'}</div>
    </div>
  </div>

  <!-- Customer -->
  <div class="section">
    <div class="section-title">Customer Information</div>
    <div class="customer-grid">
      ${job.company_name ? `<div class="field-group"><div class="field-label">Company</div><div>${escHtml(job.company_name)}</div></div>` : ''}
      <div class="field-group"><div class="field-label">Contact</div><div>${escHtml(job.first_name)} ${escHtml(job.last_name)}</div></div>
      <div class="field-group"><div class="field-label">Email</div><div>${escHtml(job.email)}</div></div>
      <div class="field-group"><div class="field-label">Phone</div><div>${escHtml(job.phone)}</div></div>
      ${job.address ? `<div class="field-group" style="grid-column:span 2"><div class="field-label">Address</div><div>${escHtml(job.address)}</div></div>` : ''}
      ${job.customer_notes ? `<div class="field-group" style="grid-column:span 2"><div class="field-label">Notes</div><div>${escHtml(job.customer_notes)}</div></div>` : ''}
    </div>
  </div>

  <!-- Tools -->
  <div class="section">
    <div class="section-title">Tools (${job.tools.length})</div>
    ${toolsHTML}
  </div>

  ${grandTotalStr ? `
    <div class="grand-total-row">
      <div class="grand-total">Grand Total: $${grandTotalStr}</div>
    </div>
  ` : ''}

  <!-- Signature -->
  <div class="signature-row">
    <div class="signature-box">Customer Signature &amp; Date</div>
    <div class="signature-box">Authorized By &amp; Date</div>
  </div>

  <!-- Footer -->
  <div class="doc-footer">
    <span>${escHtml(BUSINESS_INFO.name)} · ${escHtml(address)}</span>
    <span>WO ${escHtml(job.request_number)}</span>
  </div>

  <!-- Print button (hidden when printing) -->
  <button class="print-btn no-print" onclick="window.print()">
    🖨 Print / Save PDF
  </button>
</body>
</html>`;
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
