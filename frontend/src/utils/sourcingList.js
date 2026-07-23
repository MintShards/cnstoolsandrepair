// Shared access to the Parts Sourcing tab's manual parts list.
//
// The sourcing tab keeps admin-entered "manual" parts in localStorage so they
// survive refreshes and tab switches. Other tabs (e.g. Parts Library) push
// parts into the same list with addToSourcingList(); the sourcing tab reads it
// on mount and listens for cross-window `storage` events.

export const SOURCING_MANUAL_PARTS_KEY = 'sourcingManualParts';

export function readSourcingList() {
  try {
    const list = JSON.parse(localStorage.getItem(SOURCING_MANUAL_PARTS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function writeSourcingList(parts) {
  localStorage.setItem(SOURCING_MANUAL_PARTS_KEY, JSON.stringify(parts));
}

/**
 * Add a library part to the sourcing list, or bump its quantity when the same
 * part is already there. `quantity` sets the initial quantity for new entries
 * (e.g. the part's reorder quantity from the low-stock view); repeat adds bump
 * by 1 regardless. Returns { added, quantity } so callers can word their toast
 * accordingly.
 */
export function addToSourcingList(libPart, { quantity } = {}) {
  const list = readSourcingList();
  const name = (libPart.name || '').trim().toUpperCase();
  const partNumber = (libPart.part_number || '').trim().toUpperCase();

  const existing = list.find((p) =>
    (libPart.id && p.library_part_id === libPart.id) ||
    ((name || partNumber) &&
      (p.name || '').trim().toUpperCase() === name &&
      (p.part_number || '').trim().toUpperCase() === partNumber)
  );

  if (existing) {
    // Clamp before incrementing so a bad stored value (negative, NaN, '') can
    // never produce a quantity below 1.
    existing.quantity = Math.max(0, parseInt(existing.quantity, 10) || 0) + 1;
    writeSourcingList(list);
    return { added: false, quantity: existing.quantity };
  }

  const initialQty = Math.max(1, parseInt(quantity, 10) || 1);
  list.push({ name, part_number: partNumber, quantity: initialQty, library_part_id: libPart.id });
  writeSourcingList(list);
  return { added: true, quantity: initialQty };
}

/** Set of library_part_ids currently on the sourcing list (for queued indicators). */
export function sourcingListPartIds() {
  return new Set(readSourcingList().map((p) => p.library_part_id).filter(Boolean));
}
