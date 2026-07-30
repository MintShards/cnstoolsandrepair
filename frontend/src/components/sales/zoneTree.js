/**
 * Grouping helpers for the zone pickers.
 *
 * `zonesAPI.list()` returns every zone flat, each with a `parent_id`, so all
 * grouping happens here rather than needing a second request per dropdown.
 *
 * Named `zoneTree`, not `zoneOptions`, on purpose: `<ZoneOptions>` lives next
 * door in ZoneOptions.jsx, and two files differing only in case break on
 * Windows and macOS. Vite resolves `.js` before `.jsx`, so `./ZoneOptions`
 * matched this file case-insensitively and every importer got a module with no
 * default export. Keep the names distinct.
 */

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * Split a flat zone list into `[{ parent, children }]`, alphabetically.
 * A top-level zone with no children still gets an entry with `children: []`.
 */
export function groupZones(zones = []) {
  const parents = zones.filter(z => !z.parent_id).sort(byName);
  const childrenOf = new Map();
  for (const z of zones) {
    if (!z.parent_id) continue;
    if (!childrenOf.has(z.parent_id)) childrenOf.set(z.parent_id, []);
    childrenOf.get(z.parent_id).push(z);
  }
  for (const list of childrenOf.values()) list.sort(byName);
  return parents.map(parent => ({ parent, children: childrenOf.get(parent.id) || [] }));
}

/** Zones allowed to be a parent: top-level, and not the zone being edited. */
export function eligibleParents(zones = [], excludeId = null) {
  return zones.filter(z => !z.parent_id && z.id !== excludeId).sort(byName);
}
