import { groupZones } from './zoneTree';

/**
 * `<option>` list for a zone `<select>`, grouped by parent.
 *
 * The parent itself stays selectable — "filter to everything in Surrey" is
 * meaningful now that a zone filter includes child zones — and an
 * `<optgroup label>` is not selectable. So a parent with children renders as an
 * optgroup whose first entry is the parent itself, labelled "… — all" so it
 * doesn't read as a duplicate of the group header. A childless zone stays a
 * plain option, exactly as before the hierarchy existed.
 *
 * Render inside a <select>, after whatever placeholder option that select needs.
 */
export default function ZoneOptions({ zones = [], leafOnly = false }) {
  return groupZones(zones).map(({ parent, children }) => (
    children.length === 0 ? (
      <option key={parent.id} value={parent.id}>{parent.name}</option>
    ) : (
      <optgroup key={parent.id} label={parent.name}>
        {/* leafOnly: saved routes live INSIDE subzones, so a parent that
            holds zones isn't a valid home — only its children are. */}
        {!leafOnly && <option value={parent.id}>{parent.name} — all</option>}
        {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </optgroup>
    )
  ));
}
