import { Link } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';

export default function Hero({
  data = null,
  loading: contentLoading = false
}) {
  const { settings, loading: settingsLoading } = useSettings();
  const loading = settingsLoading || contentLoading;

  // Progressive image loading: WebP with JPG fallback
  const heroImageWebP = '/images/hero/workshop-tools-pegboard-optimized.webp';
  const heroImageJPG = '/images/hero/workshop-tools-pegboard-optimized.jpg';

  // Check WebP support and build background image URL
  const getBackgroundImage = () => {
    // Modern browsers support WebP, use optimized WebP version
    // Fallback to optimized JPG for older browsers (handled by CSS)

    // Strong gradient overlay for both themes to ensure text contrast
    // Same gradient strength for both light and dark mode
    const gradient = 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.85) 40%, rgba(15, 23, 42, 0.75) 70%, rgba(15, 23, 42, 0.65) 100%)';

    // Use image-set for automatic WebP/JPG selection based on browser support
    return `${gradient}, image-set(url("${heroImageWebP}") 1x, url("${heroImageJPG}") 1x)`;
  };

  // Show loading skeleton or use fallback data
  if (loading || !settings) {
    return (
      <section className="@container">
        <div className="relative overflow-hidden">
          <div
            className="flex min-h-[480px] lg:min-h-[560px] flex-col gap-6 lg:gap-8 bg-cover bg-center bg-no-repeat items-start justify-end px-6 sm:px-8 lg:px-12 pb-12 sm:pb-16 lg:pb-20 pt-24"
            style={{
              backgroundImage: getBackgroundImage(),
            }}
          >
            <div className="max-w-screen-xl mx-auto w-full">
              <div className="flex flex-col gap-4 lg:gap-6 max-w-lg lg:max-w-2xl">
                {/* Title/Heading Skeleton */}
                <div className="space-y-3">
                  <div className="h-10 lg:h-14 w-full bg-white/10 rounded animate-pulse"></div>
                  <div className="h-10 lg:h-14 w-4/5 bg-white/10 rounded animate-pulse"></div>
                </div>

                {/* Description Skeleton */}
                <div className="space-y-2">
                  <div className="h-5 lg:h-6 w-full bg-white/10 rounded animate-pulse"></div>
                  <div className="h-5 lg:h-6 w-3/4 bg-white/10 rounded animate-pulse"></div>
                </div>
              </div>

              {/* CTA Buttons Skeleton */}
              <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 sm:gap-3 lg:gap-4 mt-6 sm:mt-6">
                <div className="w-full sm:w-auto">
                  <div className="h-14 w-full sm:w-80 bg-white/10 rounded-xl animate-pulse"></div>
                </div>
                <div className="w-full sm:w-auto">
                  <div className="h-12 sm:h-14 w-full sm:w-80 bg-white/10 rounded-xl animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default hero content (fallback)
  const defaultData = {
    headline: "Industrial Pneumatic Tool Repair & Maintenance in Surrey, BC",
    subheadline: "Professional diagnostics and in-shop repair for air-powered tools used in demanding industrial operations. Supporting automotive, fleet, manufacturing, and metal fabrication businesses across Surrey and the Lower Mainland.",
    primaryButtonText: "Request a Repair Assessment",
    secondaryButtonText: "View Pneumatic Tool Repair Services",
  };

  const content = data || defaultData;

  return (
    <section className="@container">
      <div className="relative overflow-hidden">
        <div
          className="flex min-h-[480px] lg:min-h-[560px] flex-col gap-6 lg:gap-8 bg-cover bg-center bg-no-repeat items-start justify-end px-6 sm:px-8 lg:px-12 pb-12 sm:pb-16 lg:pb-20 pt-24"
          style={{
            backgroundImage: getBackgroundImage(),
          }}
        >
          <div className="max-w-screen-xl mx-auto w-full">
            <div className="flex flex-col gap-4 lg:gap-6 max-w-lg lg:max-w-2xl">
              <h1 className="text-white text-4xl lg:text-5xl xl:text-6xl font-black leading-tight tracking-tight uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                {content.headline}
              </h1>
              <p className="text-slate-300 text-base lg:text-lg font-medium leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                {content.subheadline}
              </p>
            </div>
            {/* Mobile-First CTA Buttons - Optimized for thumb reach */}
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 sm:gap-3 lg:gap-4 mt-6 sm:mt-6">
              <Link to="/repair-request" className="w-full sm:w-auto order-1">
                <button className="flex items-center justify-center gap-2 sm:gap-3 rounded-xl h-14 sm:h-14 px-6 sm:px-8 bg-primary text-white text-base sm:text-base font-black shadow-2xl shadow-primary/40 active:scale-95 transition-all border-2 border-primary/50 w-full touch-manipulation">
                  <span className="material-symbols-outlined text-xl sm:text-2xl">build</span>
                  <span className="tracking-tight">{content.primaryButtonText}</span>
                </button>
              </Link>
              <Link to="/services" className="w-full sm:w-auto order-2">
                <button className="flex items-center justify-center gap-2 rounded-xl h-12 sm:h-14 px-6 sm:px-8 bg-white/15 dark:bg-white/10 backdrop-blur-md border-2 border-white/40 dark:border-white/30 text-white text-sm sm:text-base font-bold hover:bg-white/25 dark:hover:bg-white/20 active:scale-95 transition-all w-full touch-manipulation">
                  <span className="material-symbols-outlined text-lg sm:text-xl">construction</span>
                  <span>{content.secondaryButtonText}</span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
