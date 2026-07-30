import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authAPI } from '../../services/api';

export default function ProtectedSalesRoute({ children }) {
  const [isAuthorized, setIsAuthorized] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await authAPI.getMe();
        // Both sales reps and admins can access the sales dashboard
        setIsAuthorized(user.role === 'sales' || user.role === 'admin');
      } catch {
        setIsAuthorized(false);
      }
    };
    checkAuth();
  }, []);

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

  if (!isAuthorized) {
    return <Navigate to="/sales/login" state={{ from: location }} replace />;
  }

  return children;
}
