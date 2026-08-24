import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';

// Where each role belongs when it lands somewhere it isn't allowed. Sending a
// logged-in-but-wrong-role user to a login page would loop them: log in →
// bounced back → blocked → login again.
const ROLE_HOME = {
  admin: '/admin/repair-tracker',
  staff: '/workspace',
  technician: '/workspace',
  sales: '/sales/dashboard',
};

/**
 * Role-aware route guard shared by the admin, workspace, and sales areas.
 * Auth is server-authoritative: the JWT is an httpOnly cookie JS can't read,
 * so we ask the backend who this is. Guards here shape navigation only — the
 * backend enforces every permission on its own.
 */
export default function RequireRole({ roles, loginPath, children }) {
  // undefined = still checking, null = not logged in, object = the user
  const [user, setUser] = useState(undefined);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    authAPI.getMe()
      .then((me) => { if (!cancelled) setUser(me); })
      .catch(() => { if (!cancelled) setUser(null); });
    return () => { cancelled = true; };
  }, []);

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-primary animate-spin">
            refresh
          </span>
          <p className="text-slate-400 mt-4">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || loginPath} replace />;
  }

  return children;
}
