import { useSettings } from '../../contexts/SettingsContext';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import './BrandsCarousel.css';

export default function BrandsCarousel() {
  const { settings, loading } = useSettings();

  // Don't render if loading or no brands
  if (loading || !settings || !settings.brands || settings.brands.length === 0) {
    return null;
  }

  // Filter active brands with logos, then sort by display order
  const activeBrands = settings.brands.filter(brand => {
    const hasLogo = brand.logoUrl && brand.logoUrl.trim() !== '';
    const isActive = brand.active !== false; // Default to true if undefined
    return hasLogo && isActive;
  });

  const sortedBrands = [...activeBrands].sort((a, b) => a.displayOrder - b.displayOrder);

  // Don't render if no active brands to display
  if (sortedBrands.length === 0) {
    return null;
  }

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20 bg-white dark:bg-slate-900">
      <div className="max-w-screen-xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
            Trusted Partners
          </h2>
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight uppercase px-4">
            Brands We Service
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 sm:mt-3 text-xs sm:text-sm lg:text-base px-4">
            Authorized service and repair for industry-leading pneumatic tool manufacturers
          </p>
        </div>

        {/* Swiper Carousel */}
        <Swiper
          modules={[Autoplay]}
          spaceBetween={32}
          slidesPerView="auto"
          loop={true}
          autoplay={{
            delay: 0,
            disableOnInteraction: false,
          }}
          speed={5000}
          className="brands-swiper"
        >
          {sortedBrands.map((brand, index) => (
            <SwiperSlide key={`${brand.name}-${index}`} className="brands-swiper-slide">
              <div className="brands-carousel-card">
                {/* Brand Logo */}
                <div className="brands-logo-container">
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="brands-logo"
                  />
                </div>

                {/* Brand Name */}
                <p className="brands-name">
                  {brand.name}
                </p>

                {/* Authorized Badge */}
                {brand.authorized && (
                  <div className="brands-authorized-badge">
                    <span className="material-symbols-outlined text-xs">
                      verified
                    </span>
                    <span>Authorized</span>
                  </div>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
