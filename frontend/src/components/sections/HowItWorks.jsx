export default function HowItWorks({
  data = null,
  loading = false,
  backgroundColor = 'bg-slate-100 dark:bg-slate-900'
}) {
  // Default content (fallback)
  const defaultData = {
    label: "Our Workflow",
    heading: "Repair Request Workflow",
    steps: [
      {
        number: 1,
        title: "Request an Assessment",
        description: "Submit tool details online to begin the professional diagnostic process.",
        display_order: 1,
      },
      {
        number: 2,
        title: "Bring Tools to Surrey",
        description: "Drop off tools at our Surrey workshop — local service with no shipping delays or damage risk.",
        display_order: 2,
      },
      {
        number: 3,
        title: "Diagnosis & Approval",
        description: "Expert technicians identify root causes and provide transparent pricing before work starts.",
        display_order: 3,
      },
      {
        number: 4,
        title: "Repair & Testing",
        description: "OEM-compatible parts installation and rigorous quality testing—tools returned ready for production.",
        display_order: 4,
      },
    ],
    note: "Note: Final turnaround times are determined by the complexity of the diagnosis and specific parts availability.",
  };

  const content = data || defaultData;

  // Loading skeleton
  if (loading) {
    return (
      <section className={`px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 ${backgroundColor}`}>
        <div className="max-w-screen-xl mx-auto">
          {/* Header Skeleton */}
          <div className="text-center mb-8 sm:mb-10 lg:mb-16">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>

          {/* Steps Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex lg:flex-col gap-4 sm:gap-5 lg:gap-4 items-start lg:items-center lg:text-center">
                <div className="shrink-0 size-12 sm:size-14 lg:size-16 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
                <div className="flex-grow lg:w-full">
                  <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-2 animate-pulse"></div>
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded mb-1 animate-pulse"></div>
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Note Skeleton */}
          <div className="mt-8 sm:mt-10 lg:mt-16 p-4 sm:p-5 lg:p-6 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 ${backgroundColor}`}>
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-16">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">{content.label}</h2>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase px-4">{content.heading}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
        {content.steps
          .sort((a, b) => a.display_order - b.display_order)
          .map((step) => (
          <div key={step.number} className="flex lg:flex-col gap-4 sm:gap-5 lg:gap-4 items-start lg:items-center lg:text-center">
            <div className="shrink-0 flex items-center justify-center size-12 sm:size-14 lg:size-16 rounded-xl bg-primary text-white font-black text-lg sm:text-xl lg:text-2xl shadow-lg shadow-primary/20">
              {step.number}
            </div>
            <div>
              <h4 className="text-base sm:text-lg lg:text-xl font-black mb-1 sm:mb-1.5 lg:mb-2 uppercase tracking-tight">{step.title}</h4>
              <p className="text-xs sm:text-sm lg:text-base text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
        </div>
        <div className="mt-8 sm:mt-10 lg:mt-16 p-4 sm:p-5 lg:p-6 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="material-symbols-outlined text-accent-orange text-lg sm:text-xl shrink-0">info</span>
            <p className="text-[10px] sm:text-[11px] lg:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
              {content.note}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
