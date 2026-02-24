import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedAdminRoute({ children }) {
  const [isAuthorized, setIsAuthorized] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem('admin_token');
    const loginTime = localStorage.getItem('admin_login_time');

    if (!token || !loginTime) {
      setIsAuthorized(false);
      return;
    }

    // Check if session is expired (24 hours = 86400000 ms)
    const SESSION_DURATION = 24 * 60 * 60 * 1000;
    const currentTime = Date.now();
    const elapsedTime = currentTime - parseInt(loginTime, 10);

    if (elapsedTime > SESSION_DURATION) {
      // Session expired, clear storage
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_login_time');
      setIsAuthorized(false);
      return;
    }

    // Valid session
    setIsAuthorized(true);
  };

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
    return <Navigate to="/admin/login" replace />;
  }

  // Render protected content
  return children;
}
