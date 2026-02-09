import { Link, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-8 py-3 pb-8 z-50">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <Link
          to="/"
          className={`flex flex-col items-center gap-1 ${
            isActive('/') ? 'text-primary' : 'text-slate-400'
          }`}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: isActive('/') ? "'FILL' 1" : "'FILL' 0" }}
          >
            home
          </span>
          <span className="text-[9px] font-black uppercase tracking-tighter">Home</span>
        </Link>

        <Link
          to="/services"
          className={`flex flex-col items-center gap-1 ${
            isActive('/services') ? 'text-primary' : 'text-slate-400'
          }`}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: isActive('/services') ? "'FILL' 1" : "'FILL' 0" }}
          >
            handyman
          </span>
          <span className="text-[9px] font-black uppercase tracking-tighter">Services</span>
        </Link>

        <div className="relative -mt-12">
          <Link to="/quote">
            <button className="bg-primary size-14 rounded-full shadow-xl shadow-primary/40 flex items-center justify-center text-white ring-4 ring-white dark:ring-slate-950">
              <span className="material-symbols-outlined" style={{ fontSize: '30px' }}>
                add_task
              </span>
            </button>
          </Link>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-primary uppercase whitespace-nowrap">
            Quote
          </span>
        </div>

        <Link
          to="/about"
          className={`flex flex-col items-center gap-1 ${
            isActive('/about') ? 'text-primary' : 'text-slate-400'
          }`}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: isActive('/about') ? "'FILL' 1" : "'FILL' 0" }}
          >
            history
          </span>
          <span className="text-[9px] font-black uppercase tracking-tighter">About</span>
        </Link>

        <Link
          to="/contact"
          className={`flex flex-col items-center gap-1 ${
            isActive('/contact') ? 'text-primary' : 'text-slate-400'
          }`}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: isActive('/contact') ? "'FILL' 1" : "'FILL' 0" }}
          >
            chat_bubble
          </span>
          <span className="text-[9px] font-black uppercase tracking-tighter">Contact</span>
        </Link>
      </div>
    </nav>
  );
}
