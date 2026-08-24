import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { authAPI } from '../../services/api';
import { apiErrorMessage } from '../../utils/apiError';

/**
 * The shop floor's own front door: staff bookmark /workspace/login and never
 * need an /admin URL. Admins can use it too; sales accounts are turned away.
 */
export default function WorkspaceLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authAPI.login({ email, password });

      if (!['staff', 'technician', 'admin'].includes(result.role)) {
        // The cookie is already set; drop the session rather than leaving a
        // signed-in account behind a "no access" message.
        authAPI.logout().catch(() => {});
        setError('Your account does not have Workspace access.');
        setLoading(false);
        return;
      }

      const from = location.state?.from
        ? `${location.state.from.pathname}${location.state.from.search || ''}`
        : '/workspace';
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <Helmet>
        <title>Workspace Login — CNS Tool Repair</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <span className="material-symbols-outlined text-4xl text-primary">
              hub
            </span>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-1">
            Workspace Login
          </h1>
          <p className="text-slate-400 text-sm">
            CNS Tool Repair — Tasks, Shop Feed &amp; Repair Tracker
          </p>
        </div>

        {/* Form */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors text-base"
                placeholder="you@cnstoolrepair.com"
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-4 pr-14 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors text-base"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-2.5"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3 bg-red-900/20 border border-red-700 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-300 text-lg">error</span>
                  <p className="text-sm text-red-300 font-medium">{error}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black rounded-xl transition-colors uppercase text-base"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">refresh</span>
                  Logging in...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">login</span>
                  Login
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
