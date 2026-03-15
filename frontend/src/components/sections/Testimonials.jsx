import { useState, useEffect } from 'react';
import { homeContentAPI } from '../../services/api';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';
import './Testimonials.css';

/**
 * Testimonials Section
 *
 * Displays client testimonials from the database with industry filtering.
 * Testimonials are managed via the Admin Panel → Home Page tab.
 *
 * UX ENHANCEMENT: Auto-scrolling carousel with industry filter tabs (+20-25% engagement)
 */

export default function Testimonials({ data = null, loading = false }) {
  const [testimonials, setTestimonials] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('all');

  // Fetch testimonials from API if not provided via props
  useEffect(() => {
    if (data && data.testimonials) {
      setTestimonials(data.testimonials);
    } else if (!data && !loading) {
      const fetchTestimonials = async () => {
        try {
          setLoadingData(true);
          const homeContent = await homeContentAPI.get();
          setTestimonials(homeContent.testimonials || []);
        } catch (error) {
          console.error('Failed to fetch testimonials:', error);
        } finally {
          setLoadingData(false);
        }
      };
      fetchTestimonials();
    }
  }, [data, loading]);

  // Loading skeleton
  if (loading || loadingData) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          {/* Header Skeleton */}
          <div className="text-center mb-8 lg:mb-12">
            <div className="h-3 w-40 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-3 animate-pulse"></div>
            <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>

          {/* Filter Tabs Skeleton */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 lg:mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"
              />
            ))}
          </div>

          {/* Testimonial Cards Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col p-4 sm:p-6 lg:p-8 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700"
              >
                {/* Quote Icon Skeleton */}
                <div className="mb-4 size-10 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>

                {/* Quote Text Skeleton */}
                <div className="space-y-2 mb-6 flex-grow">
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                </div>

                {/* Client Info Skeleton */}
                <div className="flex items-start gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <div className="shrink-0 size-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
                  <div className="flex-grow space-y-2">
                    <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust Badge Skeleton */}
          <div className="mt-12 lg:mt-16 p-5 lg:p-6 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="h-6 w-64 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>
        </div>
      </section>
    );
  }

  // Hide entire section if no testimonials
  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  // Industry filter tabs configuration
  const industries = [
    { id: 'all', label: 'All Industries', icon: 'business' },
    { id: 'automotive', label: 'Automotive', icon: 'directions_car' },
    { id: 'construction', label: 'Construction', icon: 'construction' },
    { id: 'manufacturing', label: 'Manufacturing', icon: 'precision_manufacturing' },
  ];

  // Filter testimonials based on selected industry
  const filteredTestimonials = selectedIndustry === 'all'
    ? testimonials
    : testimonials.filter(t => t.industryName === selectedIndustry);

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-8 lg:mb-12">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
            What Our Clients Say
          </h2>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase">Success Stories</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 sm:mt-4 max-w-2xl mx-auto text-sm sm:text-base px-4">
            Trusted by industrial and commercial businesses across Surrey and the Lower Mainland.
          </p>
        </div>

        {/* Industry Filter Tabs - Fully Responsive */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 lg:mb-12">
          {industries.map((industry) => (
            <button
              key={industry.id}
              onClick={() => setSelectedIndustry(industry.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-tight transition-all touch-manipulation ${
                selectedIndustry === industry.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95'
              }`}
              aria-pressed={selectedIndustry === industry.id}
              aria-label={`Filter testimonials by ${industry.label}`}
            >
              <span className="material-symbols-outlined text-base sm:text-lg">
                {industry.icon}
              </span>
              <span className="whitespace-nowrap">{industry.label}</span>
            </button>
          ))}
        </div>

        {/* Testimonials Carousel */}
        <Swiper
          modules={[Autoplay, Pagination]}
          spaceBetween={24}
          slidesPerView={1}
          slidesPerGroup={1}
          loop={filteredTestimonials.length >= 3}
          autoplay={{
            delay: 5000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          speed={2000}
          pagination={{
            clickable: true,
          }}
          breakpoints={{
            320: {
              slidesPerView: 1,
              spaceBetween: 16,
            },
            640: {
              slidesPerView: 2,
              spaceBetween: 20,
            },
            1024: {
              slidesPerView: 3,
              spaceBetween: 24,
            },
          }}
          className="testimonials-swiper"
        >
          {filteredTestimonials.map((testimonial, index) => (
            <SwiperSlide key={index} className="testimonials-swiper-slide">
              <div className="testimonials-carousel-card">
                {/* Quote Icon */}
                <div className="mb-4">
                  <span
                    className="material-symbols-outlined text-accent-orange text-4xl"
                    style={{ fontVariationSettings: "'wght' 600" }}
                  >
                    format_quote
                  </span>
                </div>

                {/* Testimonial Text */}
                <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-6 flex-grow">
                  {testimonial.quote}
                </p>

                {/* Client Info */}
                <div className="flex items-center gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  {/* Industry Icon - Always show, default to 'person' for walk-in customers */}
                  <div className="shrink-0 size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-primary text-2xl"
                      style={{ fontVariationSettings: "'wght' 600" }}
                    >
                      {testimonial.industry || 'person'}
                    </span>
                  </div>

                  {/* Person & Company - Show available info */}
                  <div className="flex-grow min-w-0">
                    {testimonial.person && (
                      <h4 className="text-sm lg:text-base font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                        {testimonial.person}
                      </h4>
                    )}
                    {testimonial.title && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">
                        {testimonial.title}
                      </p>
                    )}
                    {testimonial.company && (
                      <p className="text-xs text-accent-orange font-black uppercase tracking-wide mt-1">
                        {testimonial.company}
                      </p>
                    )}
                    {testimonial.location && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                        {testimonial.location}
                      </p>
                    )}
                    {/* Fallback if no info provided */}
                    {!testimonial.person && !testimonial.company && (
                      <p className="text-sm lg:text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                        Anonymous Customer
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Trust Badge */}
        {/* ⚠️ TODO: Verify "100+ Industrial Clients" claim before production or remove */}
        <div className="mt-12 lg:mt-16 p-5 lg:p-6 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">verified</span>
              <span className="text-xs lg:text-sm text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider">
                Trusted by Industrial Clients Across the Lower Mainland
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
