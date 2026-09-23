import { useEffect, useState } from 'react';
import { authAPI, AUTH_CHANGED_EVENT } from '../services/api';

// One shared fetch of the signed-in user per session. RequireRole already
// asks the server who you are for routing; this is the same answer for
// components that render differently by role (the tracker's money block is
// admin-only). The cache is a promise so parallel mounts share one request.
let userPromise = null;

export function fetchCurrentUser() {
  if (!userPromise) {
    userPromise = authAPI.getMe().catch(() => {
      userPromise = null; // let a later mount retry after a failure
      return null;
    });
  }
  return userPromise;
}

/** Forget the cached answer; the next mount asks the server again. */
export function resetCurrentUser() {
  userPromise = null;
}

// services/api.js announces every login and logout, so the cached answer never
// outlives the session it came from — logging out and back in as someone else
// on the same page load must not keep the first person's role.
if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_CHANGED_EVENT, resetCurrentUser);
}

/** { user, isAdmin, loading } — user is null until known (or when signed out). */
export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchCurrentUser().then((u) => {
      if (!alive) return;
      setUser(u);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  return { user, isAdmin: user?.role === 'admin', loading };
}
