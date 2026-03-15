import { useSettings } from '../../contexts/SettingsContext';

export default function FinalCTA({
  data = null,
  loading = false
}) {
  const { settings } = useSettings();

  // Default content (fallback)
  const defaultData = {
    heading: "Request Professional Pneumatic Tool Repair Services",
    description: "Start the CNS diagnostic process today. Our specialists provide detailed repair assessments for industrial pneumatic tools.",
    primaryButtonText: "Request a Repair Assessment",
    secondaryButtonText: "Call Support",
  };

  const content = data || defaultData;

  //
  // Loading skeleton
  if (loading) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-28 bg-slate-100 dark:bg-slate-900 relative overflow-hidden text-center">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col items-center gap-4 sm:gap-6 relative z-10">
            {/* Icon Skeleton */}
            <div className="size-12 sm:size-14 rounded-full bg-white/5 animate-pulse"></div>

            {/* Heading Skeleton */}
            <div className="space-y-3 w-full max-w-2xl">
              <div className="h-8 sm:h-9 lg:h-10 w-full bg-white/5 rounded animate-pulse"></div>
              <div className="h-8 sm:h-9 lg:h-10 w-3/4 mx-auto bg-white/5 rounded animate-pulse"></div>
            </div>

            {/* Description Skeleton */}
            <div className="max-w-2xl mx-auto space-y-2">
              <div className="h-4 w-3/4 mx-auto bg-white/5 rounded animate-pulse"></div>
              <div className="h-4 w-2/3 mx-auto bg-white/5 rounded animate-pulse"></div>
            </div>

            {/* CTA Buttons Skeleton */}
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 lg:gap-4 mt-2 sm:mt-4 px-4 sm:px-0">
              <div className="h-14 sm:h-16 w-full sm:w-80 bg-white/5 rounded-xl animate-pulse"></div>
              <div className="h-12 sm:h-16 w-full sm:w-48 bg-white/5 rounded-xl animate-pulse"></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-28 bg-slate-100 dark:bg-slate-900 relative overflow-hidden text-center">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex flex-col items-center gap-4 sm:gap-6 relative z-10">
          <div className="bg-accent-orange size-12 sm:size-14 rounded-full flex items-center justify-center shadow-lg shadow-accent-orange/20">
            <span className="material-symbols-outlined text-white text-2xl sm:text-3xl">mail</span>
          </div>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight px-4">
            {content.heading}
          </h3>
          <p className="text-slate-600 dark:text-slate-300 max-w-sm lg:max-w-2xl font-medium mx-auto text-sm sm:text-base lg:text-lg leading-relaxed px-4">
            {content.description}
          </p>
          {/* Mobile-First CTA Buttons */}
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 lg:gap-4 mt-2 sm:mt-4 px-4 sm:px-0">
            <a href="/quote" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto sm:px-8 h-14 sm:h-16 bg-primary text-white font-black rounded-xl flex items-center justify-center gap-2 sm:gap-3 shadow-2xl shadow-primary/40 border-2 border-primary/50 uppercase text-sm sm:text-base hover:bg-primary/90 transition-all active:scale-95 touch-manipulation">
                <span className="material-symbols-outlined text-xl sm:text-2xl">fact_check</span>
                <span>{content.primaryButtonText}</span>
              </button>
            </a>
            <a href={`tel:${settings?.contact?.phoneLink || '6045818930'}`} className="w-full sm:w-auto">
              <button className="w-full sm:w-auto sm:px-8 h-12 sm:h-16 bg-slate-200 dark:bg-white/5 text-slate-900 dark:text-white font-black rounded-xl border-2 border-slate-300 dark:border-white/30 backdrop-blur-md flex items-center justify-center gap-2 uppercase text-sm sm:text-base hover:bg-slate-300 dark:hover:bg-white/10 transition-all active:scale-95 touch-manipulation">
                <span className="material-symbols-outlined text-lg sm:text-xl">call</span>
                <span>{content.secondaryButtonText}</span>
              </button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
