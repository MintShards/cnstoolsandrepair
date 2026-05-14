import { BUSINESS_INFO, getFullAddress } from '../../config/business.js';
import { formatDatePacific, formatDateShortPacific } from '../../utils/dateFormat';

const PART_STATUS_LABELS = {
  pending: 'Pending',
  ordered: 'Ordered',
  received: 'Received',
  installed: 'Installed',
};

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function openPrintWorkOrder(job, businessInfo, serviceAgreement) {
  if (isMobile()) {
    // Mobile: open in new tab (window.print() is unreliable on iOS/Android)
    const html = buildFullHTML(job, businessInfo, serviceAgreement);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  } else {
    // Desktop: inline DOM print
    const root = document.getElementById('print-work-order-root');
    if (!root) return;
    root.innerHTML = buildPrintContent(job, businessInfo, serviceAgreement);
    const cleanup = () => { root.innerHTML = ''; };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(() => {
      window.removeEventListener('afterprint', cleanup);
      root.innerHTML = '';
    }, 60000);
  }
}

function getStyles(prefix) {
  const p = prefix ? `${prefix} ` : '';
  const s = prefix || 'body';
  return `
    @page { margin: 10mm; size: auto; }
    ${p}* { box-sizing: border-box; margin: 0; padding: 0; }
    ${s} { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #000; background: #fff; padding: 24px; }
    ${p}.doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
    ${p}.company-name { font-family: 'Russo One', sans-serif; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; color: #000; }
    ${p}.company-sub { font-size: 11px; color: #333; margin-top: 2px; }
    ${p}.wo-block { text-align: right; }
    ${p}.wo-number { font-size: 22px; font-weight: 900; font-family: monospace; color: #000; }
    ${p}.wo-meta { font-size: 11px; color: #333; margin-top: 2px; }
    ${p}.section { margin-bottom: 14px; }
    ${p}.section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
    ${p}.customer-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 16px; }
    ${p}.field-group { display: flex; flex-direction: column; margin-bottom: 4px; }
    ${p}.field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #555; letter-spacing: 0.05em; }
    ${p}.muted { color: #333; font-style: normal; }
    ${p}.tool-card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    ${p}.tool-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
    ${p}.tool-num { width: 24px; height: 24px; background: #f5f5f5; border: 1px solid #ccc; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; flex-shrink: 0; }
    ${p}.tool-title { flex: 1; }
    ${p}.tool-title strong { font-size: 13px; }
    ${p}.tool-title .muted { font-size: 13px; }
    ${p}.tool-badges { display: flex; gap: 4px; flex-wrap: wrap; flex-shrink: 0; }
    ${p}.badge { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; border: 1px solid #000; }
    ${p}.badge.priority-rush { background: #fff; color: #000; border-color: #000; }
    ${p}.badge.priority-urgent { background: #000; color: #fff; border-color: #000; }
    ${p}.badge.warranty { background: #fff; color: #000; border-color: #000; }
    ${p}.tool-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px; margin-bottom: 8px; }
    ${p}.remarks { margin-bottom: 8px; line-height: 1.5; font-size: 11px; }
    ${p}.parts-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; table-layout: auto; }
    ${p}.parts-table th:nth-child(1), ${p}.parts-table td:nth-child(1) { width: auto; }
    ${p}.parts-table th:nth-child(2), ${p}.parts-table td:nth-child(2) { white-space: nowrap; }
    ${p}.parts-table th:nth-child(3), ${p}.parts-table td:nth-child(3) { white-space: nowrap; }
    ${p}.parts-table th:nth-child(4), ${p}.parts-table td:nth-child(4) { }
    ${p}.parts-table th:nth-child(5), ${p}.parts-table td:nth-child(5) { white-space: nowrap; }
    ${p}.parts-table th:nth-child(6), ${p}.parts-table td:nth-child(6) { white-space: nowrap; }
    ${p}.parts-table th { background: #f5f5f5; border: 1px solid #ccc; padding: 4px 8px; font-size: 10px; text-transform: uppercase; color: #333; text-align: left; }
    ${p}.parts-table td { border: 1px solid #ccc; padding: 4px 8px; }
    ${p}.center, ${p}.parts-table th.center { text-align: center; }
    ${p}.right, ${p}.parts-table th.right { text-align: right; }
    ${p}.terms-section { margin-top: 24px; }
    ${p}.terms { font-size: 9px; color: #333; line-height: 1.6; margin-bottom: 6px; }
    ${p}.terms-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #555; margin-bottom: 4px; }
    ${p}.terms-sub { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #555; margin-top: 6px; margin-bottom: 2px; }
    ${p}.signature-row { display: flex; justify-content: flex-end; align-items: flex-end; margin-top: 16px; }
    ${p}.signature-box { width: 220px; border-top: 1px solid #000; padding-top: 4px; font-size: 10px; color: #333; }
  `;
}

function buildServiceAgreementHTML(serviceAgreement) {
  if (serviceAgreement && Array.isArray(serviceAgreement.sections) && serviceAgreement.sections.length > 0) {
    return serviceAgreement.sections.map(section => {
      const items = (section.items || []).map((item, i) =>
        `${i + 1}. ${escHtml(item.text)}`
      ).join('<br/>');
      return `<div class="terms-sub">${escHtml(section.title)}</div>${items}`;
    }).join('');
  }
  // Hardcoded fallback
  return `
    <div class="terms-sub">Warranty Coverage</div>
    1. A 1-month warranty is provided on all parts replaced and labour performed, under normal use and conditions.<br/>
    2. Warranty does not cover: normal wear and tear, misuse, improper use, poor maintenance (including air supply issues), accidental or external damage, or parts or components not listed on this work order.<br/>
    3. Warranty is void if the tool is opened, modified, or repaired by anyone other than CNS Tool Repair.<br/>
    4. All warranty claims require in-shop inspection. Our technicians will assess whether the failure is covered.
    <div class="terms-sub">Air Supply Requirements</div>
    5. Tools must be operated with clean, dry, regulated air at 90 PSI.<br/>
    6. Minimum 3/8" air hose required. For high-demand tools, 1/2" hose is strongly recommended.<br/>
    7. Operating outside these requirements may cause poor performance, premature wear, or damage — and will void the warranty.
    <div class="terms-sub">General</div>
    8. CNS Tool Repair is not liable for pre-existing damage identified at intake and noted on this work order, or damage unrelated to the repair performed.<br/>
    9. Estimates are provided free of charge. If a repair is declined, the tool will be returned in a disassembled state. Reassembly is not included. Do not attempt to operate a disassembled tool — doing so may cause injury or further damage.<br/>
    10. Unclaimed tools after 30 days will be considered abandoned and may be disposed of or sold to recover costs.
  `;
}

function buildBody(job, businessInfo, serviceAgreement) {
  const biz = businessInfo || {};
  const name = biz.name || BUSINESS_INFO.name;
  const phone = biz.phone || BUSINESS_INFO.phone;
  const email = biz.email || BUSINESS_INFO.email;
  const addr = biz.address
    ? (() => { const a = biz.address; return `${a.street}, ${a.city}, ${a.province}${a.postalCode ? ' ' + a.postalCode : ''}, ${a.country}`; })()
    : getFullAddress();
  const printDate = formatDatePacific(new Date().toISOString());

  const toolsHTML = job.tools.map((tool, idx) => {

    const filteredParts = (tool.parts || []).filter(p => p.name?.trim());
    const partsRows = filteredParts.map(p => {
      const lineTotal = (p.price != null && p.price !== '') ? (parseFloat(p.price) * (p.quantity || 1)).toFixed(2) : '';
      const postOrderInfo = ['ordered', 'received', 'installed'].includes(p.status)
        ? [p.tracking ? `Track: ${p.tracking}` : '', p.eta ? `ETA: ${new Date(p.eta).toLocaleDateString('en-CA')}` : ''].filter(Boolean).join(' · ')
        : '';
      return `
        <tr>
          <td>${escHtml(p.name)}${p.part_number ? ' - ' + escHtml(p.part_number) : ''}${postOrderInfo ? `<br><span style="font-size:10px;color:#6b7280;">${escHtml(postOrderInfo)}</span>` : ''}</td>
          <td class="center">${p.quantity ?? 1}</td>
          <td class="right">${p.price != null && p.price !== '' ? '$' + parseFloat(p.price).toFixed(2) : '—'}</td>
          <td>${p.supplier ? escHtml(p.supplier) : '—'}</td>
          <td class="center">${escHtml(PART_STATUS_LABELS[p.status] || p.status || '')}</td>
          <td class="right">${lineTotal ? '$' + lineTotal : '—'}</td>
        </tr>
      `;
    }).join('');
    const partsTotal = filteredParts.filter(p => p.price != null && p.price !== '').reduce((sum, p) => sum + parseFloat(p.price) * (p.quantity || 1), 0);
    const partsTotalRow = filteredParts.length > 0 && partsTotal > 0 ? `
      <tr style="border-top:2px solid #e2e8f0;font-weight:700;">
        <td colspan="5" class="right" style="padding-top:6px;">Parts Subtotal</td>
        <td class="right" style="padding-top:6px;">$${partsTotal.toFixed(2)}</td>
      </tr>
    ` : '';

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
                <th class="right">Price</th>
                <th>Supplier</th>
                <th class="center">Status</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>${partsRows}${partsTotalRow}</tbody>
          </table>
        ` : ''}

      </div>
    `;
  }).join('');

  return `
    <div class="doc-header">
      <div>
        <div class="company-name">${escHtml(name)}</div>
        <div class="company-sub">${escHtml(addr)}</div>
        <div class="company-sub">${escHtml(phone)} · ${escHtml(email)}</div>
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

    <div class="terms-section">
      <div class="terms">
        <div class="terms-title">Service Agreement</div>
        ${buildServiceAgreementHTML(serviceAgreement)}
      </div>
    </div>
    <div class="signature-row">
      <div class="signature-box">Customer Signature &amp; Date</div>
    </div>
  `;
}

function buildPrintContent(job, businessInfo, serviceAgreement) {
  return `<style>${getStyles('#print-work-order-root')}</style>${buildBody(job, businessInfo, serviceAgreement)}`;
}

function buildFullHTML(job, businessInfo, serviceAgreement) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Work Order ${escHtml(job.request_number)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet"/>
  <style>
    ${getStyles('')}
    @media print { .tool-card { break-inside: avoid; } }
  </style>
</head>
<body>
  ${buildBody(job, businessInfo, serviceAgreement)}
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
