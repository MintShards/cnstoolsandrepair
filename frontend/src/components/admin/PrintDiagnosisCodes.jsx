import { BUSINESS_INFO } from '../../config/business.js';
import { formatDatePacific } from '../../utils/dateFormat';
import { groupCodes } from '../../constants/diagnosisCodes';

/**
 * The diagnosis-code wall chart, two ways:
 *   index — large type, code + symptom only, one section (category) per
 *           page with its tool types underneath. Readable from across the
 *           shop; how a tech finds the code to type.
 *   full  — landscape table per section: code, symptom, likely causes,
 *           technician checks, repair, parts (+ quote notes when asked),
 *           with a sub-heading row per tool type.
 * Same inline-print mechanism as the work order (DOM root on desktop, a new
 * tab on phones), so it prints from anywhere.
 */

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

const list = (items) => (items?.length
  ? `<ul class="bul">${items.map((x) => `<li>${escHtml(x)}</li>`).join('')}</ul>`
  : '<span class="none">—</span>');

const partsList = (parts) => (parts?.length
  ? `<ul class="bul">${parts.map((p) => `<li>${escHtml(p.name)}${p.quantity > 1 ? ` <span class="qty">×${p.quantity}</span>` : ''}</li>`).join('')}</ul>`
  : '<span class="none">—</span>');

function header(mode, count) {
  const sub = mode === 'index' ? 'Wall index — code and problem' : 'Reference chart — causes, checks, repair and parts';
  return `
    <div class="doc-header">
      <div>
        <div class="company-name">${escHtml(BUSINESS_INFO.name || 'CNS Tool Repair')}</div>
        <div class="company-sub">Diagnosis codes · ${escHtml(sub)} · internal use only</div>
      </div>
      <div class="meta">${count} codes · printed ${escHtml(formatDatePacific(new Date()))}</div>
    </div>`;
}

function buildIndex(groups) {
  return groups.map((g, gi) => `
    <section class="group idx ${gi > 0 ? 'page' : ''}">
      <h2 class="group-title"><span class="letter">${escHtml(g.letter)}.</span> ${escHtml(g.category)}</h2>
      ${g.types.map((t) => `
        <h3 class="type-title">${escHtml(t.toolType)}</h3>
        <div class="idx-grid">
          ${t.codes.map((c) => `
            <div class="idx-row">
              <span class="idx-code">${escHtml(c.code)}</span>
              <span class="idx-title">${escHtml(c.title)}</span>
            </div>`).join('')}
        </div>`).join('')}
    </section>`).join('');
}

function buildFull(groups, includeQuoteNotes) {
  const cols = includeQuoteNotes ? 7 : 6;
  return groups.map((g) => `
    <section class="group">
      <h2 class="group-title"><span class="letter">${escHtml(g.letter)}.</span> ${escHtml(g.category)}</h2>
      <table class="chart">
        <thead>
          <tr>
            <th class="c-code">Code</th>
            <th class="c-sym">Symptom / Problem</th>
            <th>Likely causes</th>
            <th>Technician checks</th>
            <th>Repair</th>
            <th class="c-parts">Parts</th>
            ${includeQuoteNotes ? '<th class="c-quote">Quote note</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${g.types.map((t) => `
            <tr class="sub"><td colspan="${cols}">${escHtml(t.toolType)}</td></tr>
            ${t.codes.map((c) => `
              <tr>
                <td class="c-code"><span class="code">${escHtml(c.code)}</span></td>
                <td class="c-sym"><strong>${escHtml(c.title)}</strong></td>
                <td>${list(c.likely_causes)}</td>
                <td>${list(c.technician_checks)}</td>
                <td>${c.solution ? escHtml(c.solution) : '<span class="none">—</span>'}</td>
                <td class="c-parts">${partsList(c.parts)}</td>
                ${includeQuoteNotes ? `<td class="c-quote">${c.quote_note ? escHtml(c.quote_note) : '<span class="none">—</span>'}</td>` : ''}
              </tr>`).join('')}`).join('')}
        </tbody>
      </table>
    </section>`).join('');
}

function getStyles(prefix, mode) {
  const p = prefix ? `${prefix} ` : '';
  const s = prefix || 'body';
  return `
    @page { margin: 10mm; size: ${mode === 'index' ? 'portrait' : 'landscape'}; }
    ${p}* { box-sizing: border-box; margin: 0; padding: 0; }
    ${s} { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 16px; }
    ${p}.doc-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
    ${p}.company-name { font-family: 'Russo One', sans-serif; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; }
    ${p}.company-sub { font-size: 11px; color: #333; margin-top: 2px; }
    ${p}.meta { font-size: 10px; color: #555; text-align: right; }
    ${p}.group { margin-bottom: 18px; }
    ${p}.group.page { break-before: page; }
    ${p}.group-title { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
    ${p}.group-title .letter { display: inline-block; min-width: 24px; }
    ${p}.type-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #333; margin: 12px 0 4px; break-after: avoid; }
    ${p}.chart { width: 100%; border-collapse: collapse; table-layout: fixed; }
    ${p}.chart th, ${p}.chart td { border: 1px solid #999; padding: 5px 6px; vertical-align: top; text-align: left; font-size: 10.5px; line-height: 1.35; }
    ${p}.chart th { background: #e8e8e8; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; }
    ${p}.chart thead { display: table-header-group; }
    ${p}.chart tr { break-inside: avoid; }
    ${p}.chart tr.sub td { background: #f4f4f4; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 6px; break-after: avoid; }
    ${p}.chart .c-code { width: 76px; }
    ${p}.chart .c-sym { width: 15%; }
    ${p}.chart .c-parts { width: 13%; }
    ${p}.chart .c-quote { width: 18%; }
    ${p}.code { display: inline-block; white-space: nowrap; font-family: monospace; font-size: 12px; font-weight: 900; border: 1.5px solid #000; border-radius: 4px; padding: 1px 5px; }
    ${p}.bul { padding-left: 14px; }
    ${p}.bul li { margin-bottom: 1px; }
    ${p}.qty { color: #555; font-size: 9.5px; }
    ${p}.none { color: #999; }
    ${p}.idx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
    ${p}.idx-row { display: flex; align-items: baseline; gap: 12px; border-bottom: 1px solid #ddd; padding: 5px 0; break-inside: avoid; }
    ${p}.idx-code { flex-shrink: 0; min-width: 88px; font-family: monospace; font-size: 24px; font-weight: 900; }
    ${p}.idx-title { font-size: 17px; font-weight: 600; line-height: 1.25; }
  `;
}

function buildBody(codes, mode, includeQuoteNotes) {
  const groups = groupCodes(codes);
  return `${header(mode, codes.length)}${mode === 'index' ? buildIndex(groups) : buildFull(groups, includeQuoteNotes)}`;
}

function buildFullHTML(codes, mode, includeQuoteNotes) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Diagnosis codes — ${mode === 'index' ? 'wall index' : 'reference chart'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet"/>
  <style>${getStyles('', mode)}</style>
</head>
<body>${buildBody(codes, mode, includeQuoteNotes)}</body>
</html>`;
}

/**
 * @param {Array} codes   active codes to print
 * @param {{mode?: 'index'|'full', includeQuoteNotes?: boolean}} options
 */
export function openPrintDiagnosisCodes(codes, { mode = 'full', includeQuoteNotes = false } = {}) {
  if (!codes?.length) return;
  if (isMobile()) {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildFullHTML(codes, mode, includeQuoteNotes));
    win.document.close();
    win.focus();
    return;
  }
  const root = document.getElementById('print-work-order-root');
  if (!root) return;
  root.innerHTML = `<style>${getStyles('#print-work-order-root', mode)}</style>${buildBody(codes, mode, includeQuoteNotes)}`;
  const cleanup = () => { root.innerHTML = ''; };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(() => {
    window.removeEventListener('afterprint', cleanup);
    root.innerHTML = '';
  }, 60000);
}
