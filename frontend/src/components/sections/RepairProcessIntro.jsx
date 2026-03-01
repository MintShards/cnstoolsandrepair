export default function RepairProcessIntro({ loading = false }) {
  // Loading skeleton
  if (loading) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          {/* Header Skeleton */}
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-8 sm:h-9 lg:h-10 w-80 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>

          {/* Description Skeleton */}
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="h-5 lg:h-6 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            <div className="h-5 lg:h-6 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            <div className="h-5 lg:h-6 w-3/4 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-950">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
            Our Process
          </h2>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase px-4">
            How Our Repair Process Works
          </h3>
        </div>
        <div className="max-w-3xl mx-auto">
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed text-center">
            All pneumatic tools are evaluated through a structured inspection process. Repair recommendations, parts requirements, and service details are provided after assessment to ensure accurate diagnostics and quality workmanship.
          </p>
        </div>
      </div>
    </section>
  );
}
