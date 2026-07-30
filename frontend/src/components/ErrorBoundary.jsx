import { Component } from 'react';

/**
 * Catches render-time exceptions so one bad value can't unmount the whole app.
 * Without this, React tears the tree down to a blank page and the only way out
 * is a manual reload.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-2xl text-red-600 dark:text-red-400">error</span>
          </div>
          <h1 className="font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            This page hit an unexpected error. Reloading usually clears it — your saved data is unaffected.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-black rounded-xl transition-colors uppercase text-sm"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
