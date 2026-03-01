export default function ServiceArea({ loading = false }) {
  // Loading skeleton
  if (loading) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20 bg-white dark:bg-slate-900">
        <div className="max-w-screen-xl mx-auto">
          <div className="max-w-4xl mx-auto text-center space-y-2">
            <div className="h-5 lg:h-6 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            <div className="h-5 lg:h-6 w-3/4 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20 bg-white dark:bg-slate-900">
      <div className="max-w-screen-xl mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed">
            We serve businesses across <span className="font-bold text-slate-700 dark:text-slate-300">Surrey, Delta, Langley, Burnaby, Richmond,</span> and the <span className="font-bold text-slate-700 dark:text-slate-300">Greater Metro Vancouver area</span> with local pneumatic tool repair services.
          </p>
        </div>
      </div>
    </section>
  );
}
