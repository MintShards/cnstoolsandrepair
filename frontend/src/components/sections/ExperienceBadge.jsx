export default function ExperienceBadge() {
  return (
    <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 border-2 border-primary/30 rounded-xl">
      <span
        className="material-symbols-outlined text-primary text-2xl"
        style={{ fontVariationSettings: "'wght' 600" }}
      >
        verified
      </span>
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
        <span className="text-slate-900 dark:text-white font-black text-lg uppercase tracking-tight">
          Professional Service
        </span>
        <span className="hidden sm:inline text-slate-400">•</span>
        <span className="text-slate-600 dark:text-slate-300 font-bold text-sm">
          Factory-Trained Technicians
        </span>
      </div>
    </div>
  );
}
