import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { brandsAPI } from '../../services/api';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, A11y } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import './BrandsCarousel.css';

export default function BrandsCarousel({ backgroundColor = 'bg-slate-100 dark:bg-slate-900' }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [isPaused, setIsPaused] = useState(prefersReducedMotion);
  const swiperRef = useRef(null);

  const handleAutoplayToggle = () => {
    const swiper = swiperRef.current;
    if (!swiper || !swiper.autoplay) return;
    if (isPaused) {
      swiper.autoplay.start();
    } else {
      swiper.autoplay.stop();
    }
    setIsPaused(!isPaused);
  };

  // Fetch brands from API
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const data = await brandsAPI.list(true); // Get active brands only
        setBrands(data);
      } catch (error) {
        console.error('Failed to fetch brands:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBrands();
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <section className={`px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20 ${backgroundColor}`}>
        <div className="max-w-screen-xl mx-auto">
          {/* Section Header Skeleton */}
          <div className="text-center mb-6 sm:mb-8 lg:mb-12">
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-3 animate-pulse"></div>
            <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>

          {/* Carousel Skeleton */}
          <div className="flex gap-8 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="shrink-0 w-[200px] h-[120px] bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Filter brands with logos (API returns active brands, backend sorts by creation order)
  const activeBrands = brands.filter(brand => {
    const hasLogo = brand.logo_url && brand.logo_url.trim() !== '';
    return hasLogo;
  });

  // Don't render if no active brands to display
  if (activeBrands.length === 0) {
    return null;
  }

  return (
    <section className={`px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20 ${backgroundColor}`}>
      <div className="max-w-screen-xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <p className="text-red-700 dark:text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
            Industrial Tool Support
          </p>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight uppercase px-4">
            Brands We Service
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 sm:mt-3 text-xs sm:text-sm lg:text-base px-4 max-w-2xl mx-auto">
            We service pneumatic and industrial tools used in automotive, fleet maintenance, manufacturing, and MRO environments. Our technicians work with a wide range of professional-grade brands commonly used across industrial operations.
          </p>
        </div>

        {/* Swiper Carousel */}
        <Swiper
          modules={[Autoplay, A11y]}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            if (prefersReducedMotion) {
              swiper.autoplay.stop();
            }
          }}
          spaceBetween={32}
          slidesPerView="auto"
          loop={true}
          autoplay={{
            delay: 0,
            disableOnInteraction: false,
          }}
          speed={5000}
          a11y={{
            paginationBulletMessage: 'Go to brand slide {{index}}',
          }}
          className="brands-swiper"
        >
          {activeBrands.map((brand, index) => (
            <SwiperSlide key={`${brand.id}-${index}`} className="brands-swiper-slide">
              <div className="brands-carousel-card">
                {/* Brand Logo */}
                <div className="brands-logo-container">
                  <img
                    src={brand.logo_url}
                    alt=""
                    className="brands-logo"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                {/* Brand Name */}
                <p className="brands-name">
                  {brand.name}
                </p>

                {/* Authorized Badge */}
                {brand.authorized && (
                  <div className="brands-authorized-badge">
                    <span className="material-symbols-outlined text-xs" aria-hidden="true">
                      verified
                    </span>
                    <span>Authorized</span>
                  </div>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Carousel Pause/Play Toggle */}
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={handleAutoplayToggle}
            aria-pressed={isPaused}
            aria-label={isPaused ? 'Play carousel' : 'Pause carousel'}
            className="flex items-center justify-center size-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">
              {isPaused ? 'play_arrow' : 'pause'}
            </span>
          </button>
        </div>

        {/* Trademark Disclaimer */}
        <p className="text-center text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 mt-6 sm:mt-8 px-4 max-w-2xl mx-auto">
          All trademarks and logos are the property of their respective owners and are shown to indicate the brands we service. Brands marked Authorized are serviced under a factory-authorized warranty repair arrangement; CNS Tool Repair is not otherwise affiliated with or endorsed by the brands shown.
        </p>

        {/* CTA */}
        <p className="text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 sm:mt-3 px-4">
          Don&apos;t see your brand?{' '}
          <Link to="/contact" className="text-accent-orange hover:underline font-bold">
            Contact us
          </Link>
          {' '}&mdash; we service most pneumatic and industrial tools.
        </p>
      </div>
    </section>
  );
}
