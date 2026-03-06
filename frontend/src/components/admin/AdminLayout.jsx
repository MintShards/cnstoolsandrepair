import { Link, useNavigate } from 'react-router-dom';

export default function AdminLayout({ children, title = 'Admin Settings' }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear session data
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_login_time');

    // Redirect to login
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-4">
              <Link to="/" className="font-logo text-2xl font-bold leading-none tracking-wide uppercase">
                <span className="text-accent-orange">CNS</span>{' '}
                <span className="text-white">Tools and Repair</span>
              </Link>
              <div className="h-8 w-px bg-slate-700"></div>
              <div>
                <h1 className="text-lg font-black text-white uppercase tracking-tight">
                  {title}
                </h1>
                <p className="text-xs text-slate-400">Business Settings Management</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-300 rounded-lg transition-colors text-sm font-bold"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                Logout
              </button>
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-bold"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Back to Website
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        {children}
      </main>

      {/* Admin Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 mt-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <p>⚠️ Admin Panel - Changes affect live website immediately</p>
            <p>CNS Tools and Repair © {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
