// Google Maps deep links for route navigation.
//
// The Maps URLs API (google.com/maps/dir/?api=1) accepts a destination plus at
// most 9 waypoints, so a single launch can navigate 10 stops. Longer routes get
// chained: navigate the first 10, complete them, launch again for the rest.
export const MAX_NAV_STOPS = 10;

// Full place links embed the exact pin as !3d<lat>!4d<lng>. The @lat,lng pair
// is only the map viewport centre — close, but it can be a zoomed-out area —
// so it ranks below a human-entered address when picking a waypoint.
// Multi-stop directions links repeat the block per stop; the last one is the
// final destination, which is the place a pasted link is meant to point at.
function pinCoords(link) {
  const matches = [...(link || '').matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  if (matches.length === 0) return null;
  const m = matches[matches.length - 1];
  return `${m[1]},${m[2]}`;
}

// Some directions links carry stop coords only as !2m2!1d<lng>!2d<lat> —
// longitude first, unlike the pin format. Same exact-destination trust as
// pinCoords, and again the last pair is the final destination.
function dirCoords(link) {
  const matches = [...(link || '').matchAll(/!2m2!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/g)];
  if (matches.length === 0) return null;
  const m = matches[matches.length - 1];
  return `${m[2]},${m[1]}`;
}

function viewportCoords(link) {
  const m = (link || '').match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return m ? `${m[1]},${m[2]}` : null;
}

// Best geocodable string for a stop, in decreasing order of trust. Exact
// coords from a pasted link beat the address (which Google must geocode); the
// company name is a last resort — ", BC" keeps it from matching elsewhere.
export function waypointFor(stop) {
  if (!stop) return null;
  return (
    pinCoords(stop.google_maps_link) ||
    dirCoords(stop.google_maps_link) ||
    (stop.address || '').trim() ||
    viewportCoords(stop.google_maps_link) ||
    (stop.company_name ? `${stop.company_name}, BC` : null)
  );
}

// Directions from the rep's current location to a single stop. Falls back to
// the stored place link when there's nothing to build directions from.
export function stopNavUrl(stop) {
  const wp = waypointFor(stop);
  if (!wp) return stop?.google_maps_link || null;
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(wp)}`;
}

// One Google Maps launch covering the next stops in the order given, from the
// rep's current location. Returns null when nothing is navigable; `included`
// tells the caller how many stops made it in when the 10-stop cap bites.
export function routeNavUrl(stops) {
  const points = (stops || []).map(waypointFor).filter(Boolean).slice(0, MAX_NAV_STOPS);
  if (points.length === 0) return null;
  const destination = points[points.length - 1];
  const waypoints = points.slice(0, -1);
  let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}`;
  if (waypoints.length > 0) {
    url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
  }
  return { url, included: points.length };
}

export function telHref(phone) {
  return `tel:${(phone || '').replace(/\D/g, '')}`;
}
