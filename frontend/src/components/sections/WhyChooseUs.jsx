export default function WhyChooseUs({ loading = false }) {
  // Loading skeleton
  if (loading) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          {/* Header Skeleton */}
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-8 sm:h-9 lg:h-10 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-3 sm:mb-4 animate-pulse"></div>
            <div className="max-w-3xl mx-auto space-y-2">
              <div className="h-4 w-3/4 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Feature Cards Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center text-center p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800"
              >
                <div className="size-14 sm:size-16 rounded-2xl bg-slate-200 dark:bg-slate-800 mb-3 sm:mb-4 animate-pulse"></div>
                <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-2 animate-pulse"></div>
                <div className="space-y-2 w-full">
                  <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-3 w-3/4 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const features = [
    {
      icon: 'query_stats',
      title: 'Professional Diagnostics',
      description: 'Structured inspection process identifies root causes and ensures accurate repair recommendations.',
    },
    {
      icon: 'inventory_2',
      title: 'OEM-Compatible Parts',
      description: 'Quality components from authorized suppliers ensure reliable, long-lasting repairs.',
    },
    {
      icon: 'precision_manufacturing',
      title: 'Precision Calibration',
      description: 'Calibration services for industrial air tools to maintain performance standards.',
    },
    {
      icon: 'location_on',
      title: 'In-Shop Service',
      description: 'Surrey, BC workshop—local on-site service eliminates shipping delays and damage risk.',
    },
  ];

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
            Why Choose CNS
          </h2>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase px-4">
            Professional Repair Standards for Industrial Operations
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mt-3 sm:mt-4 max-w-3xl mx-auto text-sm sm:text-base lg:text-lg leading-relaxed px-4">
            Our repair process prioritizes accuracy, safety, and long-term tool performance for industrial use.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow"
            >
              <div className="size-14 sm:size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                <span
                  className="material-symbols-outlined text-primary text-3xl sm:text-4xl"
                  style={{ fontVariationSettings: "'wght' 600" }}
                >
                  {feature.icon}
                </span>
              </div>
              <h4 className="text-base sm:text-lg font-black mb-2 uppercase tracking-tight">{feature.title}</h4>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
