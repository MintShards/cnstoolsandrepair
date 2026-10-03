import { repairsAPI } from '../services/api';

// Earlier visits of one unit — what the tracker knows about a tool that
// has been on the bench before. Confirmed visits match a serial (the
// general one or any Hathorn component serial); "possible" visits are the
// same customer's earlier tools of the same model when no serial matched.

// Service agreement: 3 months on parts and labour.
export const WARRANTY_DAYS = 90;

// Clamped at 0: completion stamps are naive UTC, which JS parses as local
// and can land a few hours in the future — "-1 days ago" helps nobody.
export const daysSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

export const toolSerials = (tool) => [tool?.serial_number, tool?.camera_head_serial, tool?.controller_serial, tool?.reel_serial]
  .map((s) => (s || '').trim()).filter((s) => s.length >= 3);

export const toolModels = (tool) => [tool?.model_number, tool?.camera_head_model, tool?.controller_model, tool?.reel_model]
  .map((m) => (m || '').trim()).filter(Boolean);

// `who` is the job (or the new-job form) the tool belongs to — its customer
// identifiers drive the fallback. Resolves to null when nothing was found.
export const fetchToolHistory = async (tool, who = null, excludeJobId = null) => {
  const serials = toolSerials(tool);
  const models = toolModels(tool);
  const customer = { customerId: who?.customer_id, company: who?.company_name, email: who?.email };
  const hasCustomer = Boolean(customer.customerId || customer.company || customer.email);
  const fallback = models.length > 0 && hasCustomer;
  if (!serials.length && !fallback) return null;
  const res = await repairsAPI.serialHistory(serials.join(','), tool.brand?.trim(), excludeJobId, {
    detail: true,
    ...(fallback ? { models: models.join(','), ...customer } : {}),
  });
  const matches = res.matches || [];
  const possible = res.possible || [];
  if (!matches.length && !possible.length) return null;
  const warranty = matches.some((m) => m.date_completed && daysSince(m.date_completed) <= WARRANTY_DAYS);
  return { count: matches.length, warranty, matches, possible };
};

// tool_id → history for every tool on a job; tools with nothing found are
// left out, so a plain `map[tool_id]` check means "this unit has been here".
export const fetchJobHistory = async (job) => {
  const entries = await Promise.all((job?.tools || []).map(async (t) => {
    try { return [t.tool_id, await fetchToolHistory(t, job, job.id)]; } catch { return [t.tool_id, null]; }
  }));
  return Object.fromEntries(entries.filter((e) => e[1]));
};

// A part is the same part by number, or by name when it has no number.
export const partKey = (p) => ((p?.part_number || '').trim() || (p?.name || '').trim()).toUpperCase();
export const partLabel = (p) => `${(p?.name || '').toUpperCase()}${p?.part_number ? ` - ${String(p.part_number).toUpperCase()}` : ''}`;

// What was done on a visit, as short lists for the intake banner and print.
export const visitSummary = (m) => ({
  findings: (m?.diagnostics || []).map((d) => `${d.code ? `[${d.code}] ` : ''}${d.diagnosis}${d.solution ? ` — ${d.solution}` : ''}`),
  parts: (m?.parts || []).map((p) => `${(p.name || '').toUpperCase()}${p.quantity > 1 ? ` ×${p.quantity}` : ''}`),
});

// What this visit has in common with the earlier ones — the facts behind a
// warranty call or an end-of-life conversation with the customer.
export const repeatSignals = (tool, matches) => {
  const signals = [];
  if (!matches?.length) return signals;
  const visits = [...matches].sort((a, b) => new Date(b.date_received || 0) - new Date(a.date_received || 0));
  const myCodes = new Set((tool?.diagnostics || []).map((d) => (d.code || '').toUpperCase()).filter(Boolean));
  const myParts = new Set((tool?.parts || []).map(partKey).filter(Boolean));

  for (const m of visits) {
    const codes = [...new Set((m.diagnostics || []).map((d) => (d.code || '').toUpperCase()).filter((c) => myCodes.has(c)))];
    if (codes.length) { signals.push(`Same finding as ${m.work_order}: ${codes.join(', ')}`); break; }
  }

  const counts = new Map();
  const names = new Map();
  for (const m of visits) {
    for (const p of (m.parts || [])) {
      const k = partKey(p);
      if (!k) continue;
      if (!names.has(k)) names.set(k, (p.name || '').toUpperCase());
    }
    for (const k of new Set((m.parts || []).map(partKey).filter(Boolean))) counts.set(k, (counts.get(k) || 0) + 1);
  }
  for (const [k, n] of counts) {
    if (myParts.has(k)) signals.push(`${names.get(k)} is on this visit too — already replaced ${n === 1 ? 'once' : `${n} times`} before`);
    else if (n >= 2) signals.push(`${names.get(k)} replaced on ${n} of ${visits.length} previous visits`);
  }
  return signals;
};
