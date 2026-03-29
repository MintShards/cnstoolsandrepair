import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between p-4 max-w-screen-xl mx-auto">
        <div className="flex items-center">
          <Link to="/">
            <h2 className="font-logo text-xl md:text-2xl font-bold leading-none tracking-wide uppercase">
              <span className="text-accent-orange">CNS</span>{' '}
              <span className="text-slate-900 dark:text-white">Tool Repair</span>
            </h2>
          </Link>
        </div>

        {/* Desktop Navigation - Hidden on mobile */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link
            to="/"
            className={`font-semibold uppercase text-sm transition-colors ${
              isActive('/') ? 'text-primary' : 'hover:text-primary'
            }`}
          >
            Home
          </Link>
          <Link
            to="/services"
            className={`font-semibold uppercase text-sm transition-colors ${
              isActive('/services') ? 'text-primary' : 'hover:text-primary'
            }`}
          >
            Services
          </Link>
          <Link
            to="/industries"
            className={`font-semibold uppercase text-sm transition-colors ${
              isActive('/industries') ? 'text-primary' : 'hover:text-primary'
            }`}
          >
            Industries
          </Link>
          <Link
            to="/gallery"
            className={`font-semibold uppercase text-sm transition-colors ${
              isActive('/gallery') ? 'text-primary' : 'hover:text-primary'
            }`}
          >
            Gallery
          </Link>
          <Link
            to="/about"
            className={`font-semibold uppercase text-sm transition-colors ${
              isActive('/about') ? 'text-primary' : 'hover:text-primary'
            }`}
          >
            About
          </Link>
          <Link
            to="/contact"
            className={`font-semibold uppercase text-sm transition-colors ${
              isActive('/contact') ? 'text-primary' : 'hover:text-primary'
            }`}
          >
            Contact
          </Link>
          <ThemeToggle />
          <Link to="/repair-request">
            <button className="bg-primary text-white text-sm font-bold px-6 py-3 rounded-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 active:scale-95 transition-all uppercase">
              Get Repair
            </button>
          </Link>
        </nav>

        {/* Mobile Navigation Toggle - Hidden on desktop */}
        <div className="flex lg:hidden items-center gap-2">
          <Link to="/repair-request">
            <button className="bg-primary text-white text-[10px] font-bold px-3 py-2 rounded-lg shadow-md active:scale-95 transition-transform uppercase">
              Repair
            </button>
          </Link>
          <ThemeToggle />
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center justify-center size-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-lg">
          <nav className="flex flex-col p-4 gap-2">
            <Link
              to="/"
              className={`px-4 py-3 font-semibold uppercase text-sm rounded-lg transition-colors ${
                isActive('/')
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/services"
              className={`px-4 py-3 font-semibold uppercase text-sm rounded-lg transition-colors ${
                isActive('/services')
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              to="/industries"
              className={`px-4 py-3 font-semibold uppercase text-sm rounded-lg transition-colors ${
                isActive('/industries')
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Industries
            </Link>
            <Link
              to="/gallery"
              className={`px-4 py-3 font-semibold uppercase text-sm rounded-lg transition-colors ${
                isActive('/gallery')
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Gallery
            </Link>
            <Link
              to="/about"
              className={`px-4 py-3 font-semibold uppercase text-sm rounded-lg transition-colors ${
                isActive('/about')
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/contact"
              className={`px-4 py-3 font-semibold uppercase text-sm rounded-lg transition-colors ${
                isActive('/contact')
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
