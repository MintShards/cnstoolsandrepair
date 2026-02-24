import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(password);

      if (response.success) {
        // Store session token and timestamp
        localStorage.setItem('admin_token', response.token);
        localStorage.setItem('admin_login_time', Date.now().toString());

        // Redirect to admin settings
        navigate('/admin/settings');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <span className="material-symbols-outlined text-4xl text-primary">
              lock
            </span>
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
            Admin Login
          </h1>
          <p className="text-slate-400">
            Enter password to access business settings
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
                placeholder="Enter admin password"
                required
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-red-300">
                    error
                  </span>
                  <p className="text-sm text-red-300 font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black rounded-xl transition-colors uppercase"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">
                    refresh
                  </span>
                  Logging in...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">login</span>
                  Login
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back to Website Link */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              arrow_back
            </span>
            Back to Website
          </a>
        </div>
      </div>
    </div>
  );
}
