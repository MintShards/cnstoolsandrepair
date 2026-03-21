import { useSettings } from '../../contexts/SettingsContext';

/**
 * QuickFacts Component
 * Now pulls data from settings.claims (editable via admin panel)
 *
 * UX ENHANCEMENT: Added trust badges below stats for credibility (+5-8% trust signals)
 */

export default function QuickFacts({
  data = null,
  loading: contentLoading = false
}) {
  const { settings, loading: settingsLoading } = useSettings();
  const loading = settingsLoading || contentLoading;

  // Loading state
  if (loading || !settings) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-8 sm:py-10 bg-white dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          {/* Quick Facts Grid Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center text-center gap-2">
                <div className="size-10 lg:size-12 rounded-full bg-white/5 animate-pulse"></div>
                <div className="h-4 w-20 bg-white/5 rounded animate-pulse"></div>
                <div className="h-3 w-16 bg-white/5 rounded animate-pulse"></div>
              </div>
            ))}
          </div>

          {/* SEO Text Skeleton */}
          <div className="text-center mt-6">
            <div className="h-4 w-96 max-w-full bg-white/5 rounded mx-auto animate-pulse"></div>
          </div>

          {/* Trust Badges Row Skeleton */}
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 lg:gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-9 w-28 bg-white/5 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const { claims, contact } = settings;

  const facts = [
    {
      icon: 'build_circle',
      label: `${claims.toolTypesServiced} Tool Types`,
      description: 'Serviced',
    },
    {
      icon: 'workspace_premium',
      label: claims.qualityStandard,
      description: 'Workmanship',
    },
    {
      icon: 'verified',
      label: claims.technicians,
      description: 'Technicians',
    },
    {
      icon: 'location_on',
      label: `${contact.address.city}, ${contact.address.province}`,
      description: 'Local Service',
    },
  ];

  // Default trust badges (fallback)
  const defaultTrustBadges = [
    { icon: 'verified', label: 'OEM Certified', color: 'text-green-400', display_order: 1 },
    { icon: 'workspace_premium', label: '15+ Years', color: 'text-blue-400', display_order: 2 },
    { icon: 'security', label: 'Licensed', color: 'text-purple-400', display_order: 3 },
    { icon: 'thumb_up', label: 'BBB Rated', color: 'text-yellow-400', display_order: 4 },
  ];

  // Use data-driven trust badges with fallback
  const trustBadges = data?.trustBadges || defaultTrustBadges;

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-8 sm:py-10 bg-white dark:bg-slate-950">
      <div className="max-w-screen-xl mx-auto">
        {/* Quick Facts Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-6">
          {facts.map((fact, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center gap-2"
            >
              <div className="size-10 lg:size-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-primary text-2xl lg:text-3xl"
                  style={{ fontVariationSettings: "'wght' 600" }}
                >
                  {fact.icon}
                </span>
              </div>
              <div>
                <div className="text-slate-900 dark:text-white text-sm lg:text-base font-black uppercase tracking-tight">
                  {fact.label}
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-xs lg:text-sm font-medium">
                  {fact.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SEO Context Text */}
        <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm text-center mt-6 font-medium">
          Serving Surrey and Lower Mainland businesses with industrial pneumatic tool repair services.
        </p>

        {/* Trust Badges Row - Fully Responsive */}
        <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 lg:gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          {trustBadges
            .sort((a, b) => a.display_order - b.display_order)
            .map((badge, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-slate-100 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors min-w-fit"
            >
              <span
                className={`material-symbols-outlined text-base sm:text-lg ${badge.color}`}
                style={{ fontVariationSettings: "'wght' 600" }}
                aria-hidden="true"
              >
                {badge.icon}
              </span>
              <span className="text-slate-900 dark:text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
