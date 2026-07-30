// Google Maps deep links for route navigation.
//
// The Maps URLs API (google.com/maps/dir/?api=1) accepts a destination plus at
// most 9 waypoints, so a single launch can navigate 10 stops. Longer routes get
// chained: navigate the first 10, complete them, launch again for the rest.
export const MAX_NAV_STOPS = 10;

// Full place links embed the exact pin as !3d<lat>!4d<lng>. The @lat,lng pair
// is only the map viewport centre — close, but it can be a zoomed-out area —
// so it ranks below a human-entered address when picking a waypoint.
function pinCoords(link) {
  const m = (link || '').match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  return m ? `${m[1]},${m[2]}` : null;
}

function viewportCoords(link) {
  const m = (link || '').match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return m ? `${m[1]},${m[2]}` : null;
}

// Best geocodable string for a stop, in decreasing order of trust. The company
// name is a last resort — ", BC" keeps Google from matching another province.
export function waypointFor(stop) {
  if (!stop) return null;
  return (
    pinCoords(stop.google_maps_link) ||
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
