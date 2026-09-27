import { partsLibraryAPI } from '../services/api';

/**
 * The library parts filed under a tool's model(s): brand → models → parts,
 * merged across a Hathorn unit's component models. This is the lookup the
 * tool form's Suggested Parts box runs; it is shared so the Diagnosis dialog
 * can match a diagnosis code's parts to the same library.
 */
export async function fetchSuggestedPartsForTool(tool) {
  const brand = (tool?.brand || '').trim().toLowerCase();
  const names = [tool?.model_number, tool?.camera_head_model, tool?.controller_model, tool?.reel_model]
    .map((m) => (m || '').trim().toLowerCase())
    .filter(Boolean);
  if (!brand || !names.length) return [];
  const brands = await partsLibraryAPI.listBrands();
  const matchBrand = brands.find((b) => b.name.toLowerCase() === brand);
  if (!matchBrand) return [];
  const models = await partsLibraryAPI.listModels(matchBrand.id);
  const matched = models.filter((m) => names.includes(m.name.toLowerCase()));
  if (!matched.length) return [];
  const results = await Promise.all(
    matched.map((m) => partsLibraryAPI.listParts({ model_id: m.id, limit: 50 }).catch(() => ({ items: [] }))),
  );
  const seen = new Set();
  return results.flatMap((r) => r.items || []).filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * A code's generic part names against the model's library parts: an exact
 * name match first, else one name containing the other ("hammer cage" ↔
 * "Hammer cage assembly"). Returns [{ name, quantity, libPart | null }].
 */
export function matchCodeParts(codeParts, libraryParts) {
  const lib = libraryParts || [];
  return (codeParts || []).map((cp) => {
    const n = norm(cp.name);
    const exact = lib.find((lp) => norm(lp.name) === n);
    const loose = exact || (n.length >= 4
      ? lib.find((lp) => { const ln = norm(lp.name); return ln.includes(n) || n.includes(ln); })
      : null);
    return { name: cp.name, quantity: cp.quantity || 1, libPart: loose || null };
  });
}

/**
 * A Parts-list row for one matched code part — the same shape the tool form's
 * Suggested Parts box adds for a library part (part number, price, the shop's
 * cost snapshot, suppliers, stock badge) — or a plain pending row by name
 * when the model's library has no such part yet.
 */
export function partRowFromMatch({ name, quantity, libPart }) {
  if (libPart) {
    return {
      name: libPart.name || name,
      part_number: libPart.part_number || '',
      library_part_id: libPart.id,
      quantity,
      price: libPart.suggested_price != null ? String(libPart.suggested_price) : '',
      cost: libPart.cost != null ? String(libPart.cost) : '',
      supplier: libPart.suggested_suppliers?.[0] || '',
      _suggested_suppliers: libPart.suggested_suppliers || [],
      order_link: '',
      notes: libPart.notes || '',
      status: (libPart.quantity_on_hand ?? 0) > 0 ? 'in_stock' : 'pending',
      tracking: '',
      eta: '',
      _library_qty: libPart.quantity_on_hand ?? 0,
      _library_low_stock: libPart.low_stock ?? false,
    };
  }
  return { name, part_number: '', quantity, price: '', supplier: '', order_link: '', notes: '', status: 'pending', tracking: '', eta: '' };
}

/** Is a matched code part already on the tool — same library part, or same name? */
export function isPartListed(existingParts, match) {
  const n = norm(match.name);
  const libName = match.libPart ? norm(match.libPart.name) : null;
  return (existingParts || []).some((p) => {
    if (!p?.name?.trim()) return false;
    if (match.libPart && p.library_part_id && p.library_part_id === match.libPart.id) return true;
    const pn = norm(p.name);
    return pn === n || (libName && pn === libName);
  });
}
