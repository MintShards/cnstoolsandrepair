export default function IndustrialUseCases({ loading = false }) {
  // Loading skeleton
  if (loading) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          {/* Header Skeleton */}
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-8 sm:h-9 lg:h-10 w-80 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-3 sm:mb-4 animate-pulse"></div>
            <div className="max-w-2xl mx-auto space-y-2">
              <div className="h-3 w-3/4 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Description Skeleton */}
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="h-5 lg:h-6 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            <div className="h-5 lg:h-6 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            <div className="h-5 lg:h-6 w-4/5 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
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
            Use Cases
          </h2>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase px-4">
            Industrial Use Cases We Support
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 sm:mt-4 max-w-2xl mx-auto text-xs sm:text-sm px-4 font-medium">
            These applications describe how pneumatic tools are used within industrial environments, regardless of industry classification.
          </p>
        </div>
        <div className="max-w-3xl mx-auto">
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed text-center">
            Our services support pneumatic tools used in automotive repair & body shops, truck & fleet maintenance, manufacturing & assembly, metal fabrication & welding, construction & concrete trades, aerospace & aviation, marine & shipbuilding, oil & gas operations, mining & aggregates, and MRO (Maintenance, Repair & Operations) environments.
          </p>
        </div>
      </div>
    </section>
  );
}
