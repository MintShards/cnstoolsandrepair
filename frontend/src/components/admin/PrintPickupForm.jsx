import { formatDateShortPacific } from '../../utils/dateFormat';
import { REPAIR_STATUSES } from '../../constants/repairStatuses';
import { effectiveStatus } from '../../utils/jobAccounting';
import { buildCompanyHeader } from './PrintWorkOrder';

// The Tool Pick-Up Form: one sheet per work order for whoever collects the
// tools to sign. The work order's side is prefilled (customer on file, the
// tools with their outcome, what came in with them, invoice numbers); the
// collector's side is lines to write on — name, company, phone, signature —
// kept apart from the contact on file because at a company the person
// collecting is often not the person who dropped off. Same mechanism as the
// work order print: desktop prints from the global #print-work-order-root,
// phones open a new tab inside the tap. Black and white, the brand's scarlet
// on "CNS" only, like the work order.

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

const upper = (s) => escHtml(String(s || '').toUpperCase());

// The tools that go out with the collector: repaired and waiting (paid or
// not), or coming back unrepaired. Everything else is still on the bench,
// or already left on an earlier visit, and stays off the sheet.
const COLLECT_STATUSES = new Set(['ready', 'invoiced', 'declined', 'beyond_economical_repair']);
const box = () => '<span class="cb"></span>';
const field = (label, inner = '<div class="line"></div>') => `<div class="field-group"><div class="field-label">${label}</div>${inner}</div>`;
const shown = (v) => `<div class="val">${v}</div>`;

// How the tool goes back out, in the customer's words, from its status. A
// closed tool reads as whatever it was before it was closed.
function outcome(tool) {
  const status = effectiveStatus(tool);
  switch (status) {
    case 'ready':
    case 'invoiced':
    case 'completed':
      return 'Repair complete';
    case 'declined':
      return 'Estimate declined — returned unrepaired';
    case 'beyond_economical_repair':
      return 'Beyond economical repair — returned unrepaired';
    case 'abandoned':
      return 'Returned';
    default:
      return `Not finished — ${REPAIR_STATUSES[status]?.label || status}`;
  }
}

// "BRAND MODEL" over "TYPE · S/N: X", with a Hathorn unit's components and
// remaining rod on a third line, as the work order prints them.
function toolCellHTML(tool) {
  const title = [tool.brand, tool.model_number].filter(Boolean).join(' ') || tool.tool_type;
  const sub = [tool.tool_type, tool.quantity > 1 ? `× ${tool.quantity}` : '', tool.serial_number ? `S/N: ${tool.serial_number}` : '']
    .filter(Boolean).join(' · ');
  const comp = (label, model, serial) => (model || serial)
    ? `${label}${model ? ` ${upper(model)}` : ''}${serial ? ` (S/N: ${upper(serial)})` : ''}`
    : '';
  const comps = [
    comp('Controller', tool.controller_model, tool.controller_serial),
    comp('Reel', tool.reel_model, tool.reel_serial),
    comp('Head', tool.camera_head_model, tool.camera_head_serial),
    tool.rod_length_remaining != null ? `${escHtml(tool.rod_length_remaining)} ft rod remaining` : '',
  ].filter(Boolean).join(' · ');
  return `<strong>${upper(title)}</strong>${sub ? `<div class="sub">${upper(sub)}</div>` : ''}${comps ? `<div class="sub">${comps}</div>` : ''}`;
}

function getStyles(prefix) {
  const p = prefix ? `${prefix} ` : '';
  const s = prefix || 'body';
  return `
    @page { margin: 10mm; size: auto; }
    ${p}* { box-sizing: border-box; margin: 0; padding: 0; }
    ${s} { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #000; background: #fff; padding: 24px; }
    ${p}.doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 14px; }
    ${p}.company-name { font-family: 'Russo One', sans-serif; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; color: #000; }
    ${p}.company-accent { color: #FF2400; }
    ${p}.company-sub { font-size: 11px; color: #333; margin-top: 2px; }
    ${p}.wo-block { text-align: right; }
    ${p}.form-title { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; }
    ${p}.wo-number { font-size: 22px; font-weight: 900; font-family: monospace; color: #000; margin-top: 2px; }
    ${p}.wo-meta { font-size: 11px; color: #333; margin-top: 2px; }
    ${p}.section { margin-bottom: 12px; }
    ${p}.section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    ${p}.section-title .hint { font-weight: 400; text-transform: none; letter-spacing: 0; color: #555; text-align: right; }
    ${p}.grid { display: grid; gap: 6px 16px; }
    ${p}.g4 { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 1.4fr); }
    ${p}.g3 { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 0.9fr); }
    ${p}.g2 { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
    ${p}.field-group { display: flex; flex-direction: column; min-width: 0; }
    ${p}.field-group > *:not(.field-label) { overflow-wrap: anywhere; word-break: break-word; }
    ${p}.field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #555; letter-spacing: 0.05em; margin-bottom: 2px; }
    ${p}.val { min-height: 20px; }
    ${p}.line { height: 22px; border-bottom: 1px solid #000; }
    ${p}.note { font-size: 10px; color: #555; margin-top: 4px; }
    ${p}.checks { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; min-height: 22px; font-size: 11px; }
    ${p}.cb { display: inline-block; width: 11px; height: 11px; border: 1px solid #000; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
    ${p}table.tools { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
    ${p}table.tools th { border: 1px solid #ccc; padding: 4px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #333; text-align: left; vertical-align: bottom; }
    ${p}table.tools td { border: 1px solid #ccc; padding: 6px; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
    ${p}table.tools td.c { text-align: center; }
    ${p}table.tools .sub { font-size: 10px; color: #333; margin-top: 1px; }
    ${p}table.tools .ret { display: block; margin-bottom: 2px; }
    ${p}.ack { border: 1px solid #000; border-radius: 6px; padding: 10px 12px; margin-top: 4px; break-inside: avoid; }
    ${p}.ack p { font-size: 11px; line-height: 1.45; margin-bottom: 10px; }
    ${p}.sig { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 0.9fr); gap: 16px; }
    ${p}.sig .line { height: 30px; }
    ${p}.footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #ccc; font-size: 10px; color: #555; display: flex; justify-content: space-between; gap: 16px; }
    ${p}.footer span:first-child { flex: 1; }
    ${p}.footer span:last-child { white-space: nowrap; }
  `;
}

function buildBody(job, businessInfo) {
  const header = buildCompanyHeader(businessInfo);
  const all = job.tools || [];
  // Printed before anything is ready (a receipt at the counter, say), the
  // sheet lists every tool rather than none; the outcome column then says
  // "Not finished" on each.
  const collectable = all.filter((t) => COLLECT_STATUSES.has(t.status));
  const tools = collectable.length ? collectable : all;
  const contactName = `${job.first_name || ''} ${job.last_name || ''}`.trim();
  const printed = formatDateShortPacific(new Date().toISOString());

  // Who the signer says they are: at a company, anyone the company sent; for
  // an individual, the customer themselves or someone they sent. The
  // disassembled-tool line prints only when an unrepaired tool is on the
  // sheet, in the Service Agreement's own terms.
  const authority = job.company_name
    ? `I am authorized by ${upper(job.company_name)}`
    : contactName
      ? `I am ${upper(contactName)}, or am authorized by ${upper(contactName)},`
      : 'I am the customer named above, or am authorized by them,';
  const unrepairedListed = tools.some((t) => ['declined', 'beyond_economical_repair'].includes(effectiveStatus(t)));
  // "Ticked as returned" only when the sheet has accessories to tick.
  const accessoriesListed = tools.some((t) => (t.included_items || []).some(Boolean));

  const toolRows = tools.map((tool) => {
    const included = (tool.included_items || []).filter(Boolean);
    return `
      <tr>
        <td class="c"><strong>${all.indexOf(tool) + 1}</strong></td>
        <td>${toolCellHTML(tool)}</td>
        <td>${escHtml(outcome(tool))}</td>
        <td>${included.length ? included.map((i) => `<span class="ret">${box()}${escHtml(i)}</span>`).join('') : '—'}</td>
        <td>${tool.zoho_invoice_number ? escHtml(tool.zoho_invoice_number) : '—'}</td>
      </tr>`;
  }).join('');

  return `
    <div class="doc-header">
      <div>
        ${header.html}
      </div>
      <div class="wo-block">
        <div class="form-title">Tool Pick-Up Form</div>
        <div class="wo-number">${escHtml(job.request_number)}</div>
        <div class="wo-meta">Printed ${escHtml(printed)}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Customer on file <span class="hint">The contact on the work order — not always the person collecting.</span></div>
      <div class="grid g4">
        ${field('Company', shown(job.company_name ? upper(job.company_name) : '—'))}
        ${field('Contact', shown(upper(contactName) || '—'))}
        ${field('Phone', shown(escHtml(job.phone || '—')))}
        ${field('Email', shown(escHtml(job.email || '—')))}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Tools going out (${tools.length}${collectable.length && tools.length < all.length ? ` of ${all.length} on the work order` : ''}) <span class="hint">Numbered as on the work order. Tick each item handed back with the tool.</span></div>
      <table class="tools">
        <thead>
          <tr>
            <th style="width:26px">#</th>
            <th style="width:32%">Tool</th>
            <th style="width:22%">Outcome</th>
            <th>Returned with it</th>
            <th style="width:13%">Invoice #</th>
          </tr>
        </thead>
        <tbody>${toolRows}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Payment</div>
      <div class="checks">
        <span>${box()}Paid at pick-up</span>
        <span>${box()}On account — to be paid against the invoice</span>
        <span>${box()}No charge</span>
        <span style="margin-left:auto">Amount paid: ________________</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Picked up by <span class="hint">Please print clearly.</span></div>
      <div class="grid g3">
        ${field('Name')}
        ${field('Company')}
        ${field('Phone')}
      </div>
      <div class="grid g2" style="margin-top:8px">
        ${field('Authorized by (when not the contact on file)')}
        ${field('Photo ID checked by the shop', `<div class="checks">${box()}Yes ${box()}No</div>`)}
      </div>
    </div>

    <div class="ack">
      <p><strong>Pick-up acknowledgement.</strong> I confirm that ${authority} to collect the tools listed above, that I have received them${accessoriesListed ? ' together with the items ticked as returned' : ''}, and that I have looked them over at pick-up. Repaired tools are covered by the warranty in the CNS Tool Repair Service Agreement on the work order.${unrepairedListed ? ' A tool returned unrepaired is returned disassembled, as the Service Agreement provides, and must not be operated in that state.' : ''}</p>
      <div class="sig">
        ${field('Signature')}
        ${field('Printed name')}
        ${field('Date')}
      </div>
    </div>

    <div class="grid g2" style="margin-top:10px">
      ${field('Released by (shop)')}
      ${field('Date / time')}
    </div>

    <div class="footer">
      <span>Shop copy — stays with the work order.</span>
      <span>${escHtml(header.phone)} · ${escHtml(header.email)}</span>
    </div>
  `;
}

/** The form as a standalone document — what a phone's new tab shows. */
export function buildPickupFormHTML(job, businessInfo) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pick-Up Form ${escHtml(job.request_number)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet"/>
  <style>${getStyles('')}</style>
</head>
<body>${buildBody(job, businessInfo)}</body>
</html>`;
}

/** Print the pick-up form for a work order (Print / Save as PDF on desktop, a new tab on phones). */
export function openPrintPickupForm(job, businessInfo) {
  if (isMobile()) {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildPickupFormHTML(job, businessInfo));
    win.document.close();
    win.focus();
    return;
  }
  const root = document.getElementById('print-work-order-root');
  if (!root) return;
  root.innerHTML = `<style>${getStyles('#print-work-order-root')}</style>${buildBody(job, businessInfo)}`;
  const cleanup = () => { root.innerHTML = ''; };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(() => {
    window.removeEventListener('afterprint', cleanup);
    root.innerHTML = '';
  }, 60000);
}
