import { Link } from 'react-router-dom';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between p-4 max-w-screen-xl mx-auto">
        <div className="flex items-center">
          <Link to="/">
            <h2 className="font-logo text-xl md:text-2xl font-bold leading-none tracking-wide uppercase">
              <span className="text-accent-orange">CNS</span>{' '}
              <span className="text-slate-900 dark:text-white">Tools and Repair</span>
            </h2>
          </Link>
        </div>

        {/* Desktop Navigation - Hidden on mobile */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link
            to="/"
            className="font-semibold uppercase text-sm hover:text-primary transition-colors"
          >
            Home
          </Link>
          <Link
            to="/services"
            className="font-semibold uppercase text-sm hover:text-primary transition-colors"
          >
            Services
          </Link>
          <Link
            to="/tools"
            className="font-semibold uppercase text-sm hover:text-primary transition-colors"
          >
            Tools We Repair
          </Link>
          <Link
            to="/industries"
            className="font-semibold uppercase text-sm hover:text-primary transition-colors"
          >
            Industries
          </Link>
          <Link
            to="/gallery"
            className="font-semibold uppercase text-sm hover:text-primary transition-colors"
          >
            Gallery
          </Link>
          <Link
            to="/about"
            className="font-semibold uppercase text-sm hover:text-primary transition-colors"
          >
            About
          </Link>
          <Link
            to="/contact"
            className="font-semibold uppercase text-sm hover:text-primary transition-colors"
          >
            Contact
          </Link>
          <ThemeToggle />
          <Link to="/quote">
            <button className="bg-primary text-white text-sm font-bold px-6 py-3 rounded-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 active:scale-95 transition-all uppercase">
              Get Quote
            </button>
          </Link>
        </nav>

        {/* Mobile Navigation Toggle - Hidden on desktop */}
        <div className="flex lg:hidden items-center gap-2">
          <Link to="/quote">
            <button className="bg-primary text-white text-[10px] font-bold px-3 py-2 rounded-lg shadow-md active:scale-95 transition-transform uppercase">
              Quote
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
              className="px-4 py-3 font-semibold uppercase text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/services"
              className="px-4 py-3 font-semibold uppercase text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              to="/tools"
              className="px-4 py-3 font-semibold uppercase text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Tools We Repair
            </Link>
            <Link
              to="/industries"
              className="px-4 py-3 font-semibold uppercase text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Industries
            </Link>
            <Link
              to="/gallery"
              className="px-4 py-3 font-semibold uppercase text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Gallery
            </Link>
            <Link
              to="/about"
              className="px-4 py-3 font-semibold uppercase text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="px-4 py-3 font-semibold uppercase text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
