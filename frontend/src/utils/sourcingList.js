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
 * part is already there. Returns { added, quantity } so callers can word their
 * toast accordingly.
 */
export function addToSourcingList(libPart) {
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

  list.push({ name, part_number: partNumber, quantity: 1, library_part_id: libPart.id });
  writeSourcingList(list);
  return { added: true, quantity: 1 };
}
