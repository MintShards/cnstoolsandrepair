import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authAPI } from '../../services/api';

export default function ProtectedAdminRoute({ children }) {
  const [isAuthorized, setIsAuthorized] = useState(null);
  const location = useLocation();

  const checkAuth = async () => {
    // Auth is server-authoritative: the JWT is in an httpOnly cookie that JS can't
    // read, so we ask the backend. Success means a valid, unexpired session.
    try {
      await authAPI.getMe();
      setIsAuthorized(true);
    } catch (error) {
      setIsAuthorized(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Loading state
  if (isAuthorized === null) {
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

  // Redirect to login if not authorized
  if (!isAuthorized) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Render protected content
  return children;
}
