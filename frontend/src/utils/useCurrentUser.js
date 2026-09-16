import { useEffect, useState } from 'react';
import { authAPI } from '../services/api';

// One shared fetch of the signed-in user per page load. RequireRole already
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
