import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toolsAPI, brandsAPI } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import 'swiper/css';
import BrandsCarousel from '../components/sections/BrandsCarousel';
import HowItWorks from '../components/sections/HowItWorks';
import DualCTA from '../components/sections/DualCTA';

// Shown in the warranty section and mirrored into the FAQPage JSON-LD in the
// Helmet below; keep the two in sync — Google requires schema answers to
// match the visible page content.
const WARRANTY_FAQS = [
  {
    q: 'How do JET, Strongarm, and Hathorn warranty repairs work?',
    a: 'Bring your tool and proof of purchase to our Surrey, BC shop. We confirm warranty coverage with the manufacturer, complete the repair in-shop, and test the tool before pickup.',
  },
  {
    q: 'Do I need a receipt for a warranty claim?',
    a: 'Yes — proof of purchase is required for warranty claims. Without it, we can still assess and repair your tool as a standard repair.',
  },
  {
    q: 'Does a warranty repair cost anything?',
    a: "Approved warranty claims are repaired under the manufacturer's warranty terms at no charge to you. If a claim is not covered, we provide a quote before any work is done.",
  },
  {
    q: 'Can you repair JET, Strongarm, or Hathorn tools that are out of warranty?',
    a: 'Yes. We repair these brands and most other industrial tool brands as standard out-of-warranty repairs, with diagnostics and a quote before work begins.',
  },
];

function AuthorizedBrandChip({ brand, uniform = false }) {
  // uniform: fixed-size chips so wrapped grid rows line up into columns even
  // though brand logos have wildly different aspect ratios. The carousel keeps
  // natural widths (uniform=false) since slides scroll rather than wrap.
  return (
    <div
      className={`flex items-center gap-2 bg-white dark:bg-slate-100 shadow-md rounded-full px-5 py-2 ${
        uniform ? 'w-56 max-w-full min-h-[3.25rem] justify-center text-center' : ''
      }`}
    >
      {brand.logo_url && (
        <img
          src={brand.logo_url}
          alt={`${brand.name} logo`}
          className="h-6 w-auto max-w-[72px] shrink-0 object-contain"
          loading="lazy"
        />
      )}
      <span
        className={`text-sm font-black uppercase tracking-tight text-slate-900 ${
          uniform ? 'leading-tight' : 'whitespace-nowrap'
        }`}
      >
        {brand.name}
      </span>
      <span
        className="material-symbols-outlined text-primary text-base shrink-0"
        style={{ fontVariationSettings: "'wght' 600" }}
      >
        verified
      </span>
    </div>
  );
}

export default function Services() {
  const { settings, loading: loadingSettings } = useSettings();
  const [toolsByCategory, setToolsByCategory] = useState(null);
  const [loadingTools, setLoadingTools] = useState(true);
  // Brands flagged `authorized` in Admin Settings → Global drive the warranty
  // section, so gaining a new authorization is a toggle, not a deploy.
  const [authorizedBrands, setAuthorizedBrands] = useState([]);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Get services from Settings (managed via admin dashboard)
  const services = settings?.services || [];

  // Warranty section copy is editable in Admin Settings → Services; every
  // field falls back to the shipped wording so the section never renders bare.
  const warranty = settings?.warranty || {};
  const warrantyLabel = warranty.label?.trim() || 'Factory Authorized';
  const warrantyHeading = warranty.heading?.trim() || 'Authorized Warranty Repair';
  const warrantyPrimaryCta = warranty.primaryCta?.trim() || 'Start a Warranty Claim';
  const warrantySecondaryCta = warranty.secondaryCta?.trim() || 'Ask About Coverage';
  const warrantyDescription = warranty.description?.trim()
    || (authorizedBrands.length > 0
      ? 'CNS Tool Repair is a factory-authorized warranty repair centre for the brands shown here. Warranty claims are assessed and repaired in-shop at our Surrey, BC facility — bring your tool and proof of purchase, and we handle the claim from diagnosis through repair.'
      : 'CNS Tool Repair is an authorized warranty repair centre for JET Tools and Strongarm Products. Warranty claims are assessed and repaired in-shop at our Surrey, BC facility — bring your tool and proof of purchase, and we handle the claim from diagnosis through repair.');

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const data = await toolsAPI.getByCategory();
        setToolsByCategory(data);
      } catch (error) {
        console.error('Failed to fetch tools:', error);
      } finally {
        setLoadingTools(false);
      }
    };

    fetchTools();
  }, []);

  useEffect(() => {
    const fetchAuthorizedBrands = async () => {
      try {
        const data = await brandsAPI.list(true);
        setAuthorizedBrands((data || []).filter((brand) => brand.authorized));
      } catch {
        // Leave empty — the section falls back to its static brand copy.
      }
    };

    fetchAuthorizedBrands();
  }, []);

  return (
    <>
      <Helmet>
        <title>Tool Repair & Warranty Services | CNS Tool Repair Surrey BC</title>
        <meta
          name="description"
          content="Pneumatic tool repair in Surrey, BC. Authorized JET, Strongarm & Hathorn warranty repair centre. Air, hydraulic and electric tools plus lifting equipment."
        />
        <meta
          name="keywords"
          content="pneumatic tool repair services, air tool maintenance, tool rental Surrey, industrial equipment repair, used pneumatic tools, impact wrench repair, pneumatic grinder repair, air drill service, tool service Surrey BC, electric tool repair, lifting equipment repair, hydraulic jack repair, hydraulic tool repair"
        />
        <link rel="canonical" href="https://cnstoolrepair.com/services" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolrepair.com/services" />
        <meta property="og:title" content="Pneumatic Tool Services & Repair | Tools We Repair | CNS Tool Repair Surrey BC" />
        <meta property="og:description" content="Pneumatic tool repair in Surrey, BC. Authorized JET, Strongarm & Hathorn warranty repair centre for air, hydraulic and electric tools." />
        <meta property="og:image" content="https://cnstoolrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolrepair.com/services" />
        <meta name="twitter:title" content="Pneumatic Tool Services & Repair | Tools We Repair | CNS Tool Repair Surrey BC" />
        <meta name="twitter:description" content="Pneumatic tool repair in Surrey, BC. Authorized JET, Strongarm & Hathorn warranty repair centre for air, hydraulic and electric tools." />
        <meta name="twitter:image" content="https://cnstoolrepair.com/og-image.jpg" />

        {/* FAQ rich-result markup for the warranty section */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: WARRANTY_FAQS.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: { '@type': 'Answer', text: faq.a },
            })),
          })}
        </script>
      </Helmet>
      <main className="relative min-h-screen">
        {/* Our Services Section */}
        <div className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
          <div className="max-w-screen-xl mx-auto">
            {loadingSettings ? (
              <>
                {/* Hero Skeleton */}
                <div className="text-center mb-12 lg:mb-16">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
                  <div className="h-10 lg:h-12 w-48 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4 animate-pulse"></div>
                  <div className="max-w-2xl mx-auto space-y-2">
                    <div className="h-4 lg:h-5 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    <div className="h-4 lg:h-5 w-4/5 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  </div>
                </div>

                {/* Service Cards Skeleton */}
                <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-4 p-6 bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-1rem)] lg:w-[calc(33.333%-1.334rem)]"
                    >
                      <div className="mx-auto">
                        <div className="size-16 rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse"></div>
                      </div>
                      <div>
                        <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-2 animate-pulse"></div>
                        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1 animate-pulse"></div>
                        <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mx-auto animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Hero Section */}
                <div className="text-center mb-12 lg:mb-16">
                  <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">What We Offer</h2>
                  <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Our Services</h1>
                  <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto text-base lg:text-lg">
                    Expert pneumatic tool repair and maintenance services in Surrey, BC, supporting automotive, manufacturing, and industrial businesses across Surrey and the Metro Vancouver area.
                  </p>
                </div>

                {/* Service Cards */}
                {services.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8">
                    {services.map((service, index) => (
                      <div
                        key={index}
                        className="flex flex-col gap-4 p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-transparent shadow-lg hover:shadow-xl hover:border-primary dark:hover:border-primary transition-all text-center w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-1rem)] lg:w-[calc(33.333%-1.334rem)]"
                      >
                        <div className="mx-auto">
                          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <span
                              className="material-symbols-outlined text-primary text-4xl"
                              style={{ fontVariationSettings: "'wght' 600" }}
                            >
                              {service.icon}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-black mb-2 uppercase tracking-tight">{service.title}</h3>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{service.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <span className="material-symbols-outlined text-6xl text-slate-400">build</span>
                    <p className="mt-4 text-slate-500">No services listed yet. Check back soon!</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Authorized Warranty Repair Section */}
        <div className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-900">
          <div className="max-w-screen-xl mx-auto">
            <div className="text-center mb-8 lg:mb-10">
              <p className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">{warrantyLabel}</p>
              <h2 className="text-3xl lg:text-4xl font-black tracking-tight uppercase">{warrantyHeading}</h2>
            </div>
            <div className="max-w-3xl mx-auto text-center">
              {authorizedBrands.length >= 10 ? (
                <div className="mb-5">
                  <Swiper
                    modules={[Autoplay]}
                    spaceBetween={12}
                    slidesPerView="auto"
                    loop={true}
                    autoplay={prefersReducedMotion ? false : {
                      delay: 0,
                      disableOnInteraction: false,
                    }}
                    speed={5000}
                  >
                    {authorizedBrands.map((brand) => (
                      <SwiperSlide key={brand.id} className="!w-auto">
                        <AuthorizedBrandChip brand={brand} />
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </div>
              ) : authorizedBrands.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-3 mb-5">
                  {authorizedBrands.map((brand) => (
                    <AuthorizedBrandChip key={brand.id} brand={brand} uniform />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span
                    className="material-symbols-outlined text-primary text-3xl"
                    style={{ fontVariationSettings: "'wght' 600" }}
                  >
                    verified
                  </span>
                  <p className="text-lg sm:text-xl font-black uppercase tracking-tight">
                    JET Tools &amp; Strongarm Products
                  </p>
                </div>
              )}
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {warrantyDescription}
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/repair-request"
                  className="bg-primary text-white font-black px-8 py-4 rounded-xl uppercase hover:bg-primary/90 transition-colors"
                >
                  {warrantyPrimaryCta}
                </Link>
                <Link
                  to="/contact"
                  className="bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black px-8 py-4 rounded-xl uppercase hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  {warrantySecondaryCta}
                </Link>
              </div>

              {/* Warranty FAQ — answers mirror the FAQPage schema in Helmet */}
              <div className="mt-12 text-left">
                <h3 className="text-xl font-black tracking-tight uppercase text-center mb-6">
                  Warranty Repair FAQ
                </h3>
                <div className="space-y-5">
                  {WARRANTY_FAQS.map((faq) => (
                    <div key={faq.q} className="border-l-2 border-primary/40 pl-4">
                      <h4 className="text-sm font-black uppercase tracking-tight mb-1">{faq.q}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tools We Repair Section - Categorized by Type */}
        <div className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
          <div className="max-w-screen-xl mx-auto">
            {loadingTools ? (
              <>
                {/* Hero Skeleton */}
                <div className="text-center mb-12 lg:mb-16">
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
                  <div className="h-10 lg:h-12 w-48 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4 animate-pulse"></div>
                  <div className="max-w-2xl mx-auto space-y-2">
                    <div className="h-4 lg:h-5 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    <div className="h-4 lg:h-5 w-5/6 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  </div>
                </div>

                {/* 4-Column Tool Categories Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 lg:gap-10">
                  {/* Air Tools Column Skeleton */}
                  <div>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-blue-500">
                      <div className="size-12 rounded-xl bg-blue-500/10 animate-pulse"></div>
                      <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2 animate-pulse"></div>
                          <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1 animate-pulse"></div>
                          <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hydraulic Tools Column Skeleton */}
                  <div>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-red-500">
                      <div className="size-12 rounded-xl bg-red-500/10 animate-pulse"></div>
                      <div className="h-7 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2 animate-pulse"></div>
                          <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1 animate-pulse"></div>
                          <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lifting Equipment Column Skeleton */}
                  <div>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-purple-500">
                      <div className="size-12 rounded-xl bg-purple-500/10 animate-pulse"></div>
                      <div className="h-7 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2 animate-pulse"></div>
                          <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1 animate-pulse"></div>
                          <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Electric Tools Column Skeleton */}
                  <div>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-amber-500">
                      <div className="size-12 rounded-xl bg-amber-500/10 animate-pulse"></div>
                      <div className="h-7 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2 animate-pulse"></div>
                          <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1 animate-pulse"></div>
                          <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Hero Section */}
                <div className="text-center mb-12 lg:mb-16">
                  <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Expertise</h2>
                  <h2 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Tools We Repair</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto text-base lg:text-lg">
                    Complete repair services for pneumatic impact wrenches, air drills, grinders, sanders, electric tools, hydraulic jacks, and lifting equipment—supporting a wide range of industrial applications.
                  </p>
                </div>

                {/* Tool Categories */}
                {toolsByCategory ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 lg:gap-10">
                        {/* Air Tools Column */}
                    <div>
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-blue-500">
                        <div className="size-12 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <span
                            className="material-symbols-outlined text-blue-500 text-3xl"
                            style={{ fontVariationSettings: "'wght' 600" }}
                          >
                            air
                          </span>
                        </div>
                        <h3 className="text-2xl xl:text-lg font-black uppercase tracking-tight">Air Tools</h3>
                      </div>
                      <div className="space-y-3">
                        {toolsByCategory.air_tools && toolsByCategory.air_tools.length > 0 ? (
                          toolsByCategory.air_tools.map((tool) => (
                            <div
                              key={tool.id}
                              className="border-l-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 pl-4 py-1.5 transition-colors"
                            >
                              <h4 className="text-sm font-black uppercase tracking-tight mb-1">{tool.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tool.description}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 italic">No air tools listed.</p>
                        )}
                      </div>
                    </div>

                    {/* Hydraulic Tools Column */}
                    <div>
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-red-500">
                        <div className="size-12 shrink-0 rounded-full bg-red-500/10 flex items-center justify-center">
                          <span
                            className="material-symbols-outlined text-red-500 text-3xl"
                            style={{ fontVariationSettings: "'wght' 600" }}
                          >
                            compress
                          </span>
                        </div>
                        <h3 className="text-2xl xl:text-lg font-black uppercase tracking-tight">Hydraulic Tools</h3>
                      </div>
                      <div className="space-y-3">
                        {toolsByCategory.hydraulic_tools && toolsByCategory.hydraulic_tools.length > 0 ? (
                          toolsByCategory.hydraulic_tools.map((tool) => (
                            <div
                              key={tool.id}
                              className="border-l-2 border-slate-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 pl-4 py-1.5 transition-colors"
                            >
                              <h4 className="text-sm font-black uppercase tracking-tight mb-1">{tool.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tool.description}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 italic">No hydraulic tools listed.</p>
                        )}
                      </div>
                    </div>

                    {/* Lifting Equipment Column */}
                    <div>
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-purple-500">
                        <div className="size-12 shrink-0 rounded-full bg-purple-500/10 flex items-center justify-center">
                          <span
                            className="material-symbols-outlined text-purple-500 text-3xl"
                            style={{ fontVariationSettings: "'wght' 600" }}
                          >
                            precision_manufacturing
                          </span>
                        </div>
                        <h3 className="text-2xl xl:text-lg font-black uppercase tracking-tight">Lifting Equipment</h3>
                      </div>
                      <div className="space-y-3">
                        {toolsByCategory.lifting_equipment && toolsByCategory.lifting_equipment.length > 0 ? (
                          toolsByCategory.lifting_equipment.map((tool) => (
                            <div
                              key={tool.id}
                              className="border-l-2 border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 pl-4 py-1.5 transition-colors"
                            >
                              <h4 className="text-sm font-black uppercase tracking-tight mb-1">{tool.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tool.description}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 italic">No lifting equipment listed.</p>
                        )}
                      </div>
                    </div>

                    {/* Electric Tools Column */}
                    <div>
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-amber-500">
                        <div className="size-12 shrink-0 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <span
                            className="material-symbols-outlined text-amber-500 text-3xl"
                            style={{ fontVariationSettings: "'wght' 600" }}
                          >
                            bolt
                          </span>
                        </div>
                        <h3 className="text-2xl xl:text-lg font-black uppercase tracking-tight">Electric Tools</h3>
                      </div>
                      <div className="space-y-3">
                        {toolsByCategory.electric_tools && toolsByCategory.electric_tools.length > 0 ? (
                          toolsByCategory.electric_tools.map((tool) => (
                            <div
                              key={tool.id}
                              className="border-l-2 border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 pl-4 py-1.5 transition-colors"
                            >
                              <h4 className="text-sm font-black uppercase tracking-tight mb-1">{tool.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tool.description}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 italic">No electric tools listed.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <span className="material-symbols-outlined text-6xl text-slate-400">inventory_2</span>
                    <p className="mt-4 text-slate-500">No tools listed yet. Check back soon!</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Brands We Service Carousel */}
        <BrandsCarousel backgroundColor="bg-slate-100 dark:bg-slate-900" />

        {/* How It Works Section */}
        <HowItWorks backgroundColor="bg-white dark:bg-slate-950" />

        {/* Final CTA Section */}
        <DualCTA backgroundColor="bg-slate-100 dark:bg-slate-900" />
      </main>
    </>
  );
}
