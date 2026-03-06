import { Link } from 'react-router-dom';

export default function ToolsPreview({ loading = false }) {
  // Loading skeleton
  if (loading) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          {/* Header Skeleton */}
          <div className="text-center mb-8 sm:mb-10 lg:mb-16">
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-8 w-56 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-3 animate-pulse"></div>
            <div className="h-4 w-80 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>

          {/* Tool Cards Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-5 lg:p-6 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700"
              >
                <div className="size-12 sm:size-14 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
              </div>
            ))}
          </div>

          {/* Description & Button Skeleton */}
          <div className="mt-8 sm:mt-10 lg:mt-12 text-center">
            <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4 sm:mb-5 lg:mb-6 animate-pulse"></div>
            <div className="h-12 sm:h-14 w-40 bg-slate-200 dark:bg-slate-800 rounded-xl mx-auto animate-pulse"></div>
          </div>
        </div>
      </section>
    );
  }

  const toolCategories = [
    { name: 'Impact Wrenches', icon: 'construction' },
    { name: 'Grinders', icon: 'auto_fix_high' },
    { name: 'Drills', icon: 'handyman' },
    { name: 'Sanders', icon: 'hardware' },
    { name: 'Ratchets', icon: 'settings' },
    { name: 'Spray Guns', icon: 'air' },
    { name: 'Nail Guns', icon: 'push_pin' },
    { name: 'Air Hammers', icon: 'gavel' },
  ];

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-16">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
            Tool Categories
          </h2>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase px-4">
            Which Tools We Service
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 sm:mt-4 max-w-2xl mx-auto text-sm sm:text-base px-4">
            Expert repair and maintenance for all major pneumatic tool types
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {toolCategories.map((tool, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-5 lg:p-6 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-colors"
            >
              <div className="size-12 sm:size-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-primary text-2xl sm:text-3xl"
                  style={{ fontVariationSettings: "'wght' 600" }}
                >
                  {tool.icon}
                </span>
              </div>
              <h4 className="text-xs sm:text-sm lg:text-base font-black uppercase tracking-tight text-center leading-tight">
                {tool.name}
              </h4>
            </div>
          ))}
        </div>

        <div className="mt-8 sm:mt-10 lg:mt-12 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-4 sm:mb-5 lg:mb-6 px-4">
            Our pneumatic tool repair services cover a wide range of industrial air-powered tools used in manufacturing, construction, and maintenance operations.
          </p>
          <Link to="/services" className="inline-block w-full sm:w-auto">
            <button className="w-full sm:w-auto bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black px-6 sm:px-8 h-12 sm:h-14 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary active:scale-95 transition-all uppercase text-sm touch-manipulation">
              See All Services
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
