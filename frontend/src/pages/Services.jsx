import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { toolsAPI } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import ExperienceBadge from '../components/sections/ExperienceBadge';
import BrandsCarousel from '../components/sections/BrandsCarousel';
import HowItWorks from '../components/sections/HowItWorks';
import DualCTA from '../components/sections/DualCTA';

export default function Services() {
  const { settings, loading: loadingSettings } = useSettings();
  const [toolsByCategory, setToolsByCategory] = useState(null);
  const [loadingTools, setLoadingTools] = useState(true);

  // Get services from Settings (managed via admin dashboard)
  const services = settings?.services || [];

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

  return (
    <>
      <Helmet>
        <title>Pneumatic Tool Services & Repair | Tools We Repair | CNS Tools Surrey</title>
        <meta
          name="description"
          content="Expert pneumatic tool repair and maintenance services in Surrey, BC. Fast turnaround, factory-trained technicians, serving automotive, manufacturing, and industrial sectors. Complete repair services for air tools, electric tools, and lifting equipment."
        />
        <meta
          name="keywords"
          content="pneumatic tool repair services, air tool maintenance, tool rental Surrey, industrial equipment repair, used pneumatic tools, impact wrench repair, pneumatic grinder repair, air drill service, tool service Surrey BC, electric tool repair, lifting equipment repair"
        />
        <link rel="canonical" href="https://cnstoolsandrepair.com/services" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolsandrepair.com/services" />
        <meta property="og:title" content="Pneumatic Tool Services & Repair | Tools We Repair | CNS Tools Surrey" />
        <meta property="og:description" content="Expert pneumatic tool repair and maintenance services in Surrey, BC. Fast turnaround, factory-trained technicians, serving automotive, manufacturing, and industrial sectors." />
        <meta property="og:image" content="https://cnstoolsandrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolsandrepair.com/services" />
        <meta name="twitter:title" content="Pneumatic Tool Services & Repair | Tools We Repair | CNS Tools Surrey" />
        <meta name="twitter:description" content="Expert pneumatic tool repair and maintenance services in Surrey, BC. Fast turnaround, factory-trained technicians, serving automotive, manufacturing, and industrial sectors." />
        <meta name="twitter:image" content="https://cnstoolsandrepair.com/og-image.jpg" />
      </Helmet>
      <main className="relative min-h-screen">
        {/* Our Services Section */}
        <div className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
          <div className="max-w-screen-xl mx-auto">
            <div className="text-center mb-12 lg:mb-16">
              <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">What We Offer</h2>
              <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Our Services</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto text-base lg:text-lg">
                Expert pneumatic tool repair and maintenance services in Surrey, BC, supporting automotive, manufacturing, and industrial businesses across Surrey and the Metro Vancouver area.
              </p>
            </div>

            {loadingSettings ? (
              <>
                {/* Header Skeleton */}
                <div className="text-center mb-12 lg:mb-16">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
                  <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4 animate-pulse"></div>
                  <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
                  <div className="h-4 w-80 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
                </div>

                {/* Service Cards Skeleton */}
                <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 mb-12 lg:mb-16">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-4 p-6 bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-1rem)] md:w-[calc(25%-1.5rem)] lg:w-[calc(20%-1.6rem)]"
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

                {/* ExperienceBadge Skeleton */}
                <div className="flex justify-center">
                  <div className="h-16 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                </div>
              </>
            ) : services.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8">
                {services.map((service, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-4 p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:border-primary dark:hover:border-primary transition-all text-center w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-1rem)] md:w-[calc(25%-1.5rem)] lg:w-[calc(20%-1.6rem)]"
                  >
                    <div className="mx-auto">
                      <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
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
          </div>
        </div>

        {/* Experience Badge Section */}
        <div className="px-6 sm:px-8 lg:px-12 py-8 sm:py-10 lg:py-12 bg-slate-100 dark:bg-slate-900">
          <div className="max-w-screen-xl mx-auto flex justify-center">
            <ExperienceBadge />
          </div>
        </div>

        {/* Tools We Repair Section - Categorized by Type */}
        <div className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
          <div className="max-w-screen-xl mx-auto">
            <div className="text-center mb-12 lg:mb-16">
              <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Expertise</h2>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Tools We Repair</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto text-base lg:text-lg">
                Complete repair services for pneumatic impact wrenches, air drills, grinders, sanders, electric tools, and lifting equipment. All major brands serviced including Ingersoll Rand, DeWalt, and Chicago Pneumatic.
              </p>
            </div>

            {loadingTools ? (
              <>
                {/* Header Skeleton */}
                <div className="text-center mb-12 lg:mb-16">
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
                  <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4 animate-pulse"></div>
                  <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
                  <div className="h-4 w-80 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
                </div>

                {/* 3-Column Tool Categories Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
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
                          <div className="flex items-start gap-3">
                            <div className="size-8 rounded bg-slate-200 dark:bg-slate-700 shrink-0 animate-pulse"></div>
                            <div className="flex-1">
                              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2 animate-pulse"></div>
                              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1 animate-pulse"></div>
                              <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                            </div>
                          </div>
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
                          <div className="flex items-start gap-3">
                            <div className="size-8 rounded bg-slate-200 dark:bg-slate-700 shrink-0 animate-pulse"></div>
                            <div className="flex-1">
                              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2 animate-pulse"></div>
                              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1 animate-pulse"></div>
                              <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                            </div>
                          </div>
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
                          <div className="flex items-start gap-3">
                            <div className="size-8 rounded bg-slate-200 dark:bg-slate-700 shrink-0 animate-pulse"></div>
                            <div className="flex-1">
                              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2 animate-pulse"></div>
                              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1 animate-pulse"></div>
                              <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : toolsByCategory ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
                {/* Air Tools Column */}
                <div>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-blue-500">
                    <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <span
                        className="material-symbols-outlined text-blue-500 text-3xl"
                        style={{ fontVariationSettings: "'wght' 600" }}
                      >
                        air
                      </span>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Air Tools</h3>
                  </div>
                  <div className="space-y-3">
                    {toolsByCategory.air_tools && toolsByCategory.air_tools.length > 0 ? (
                      toolsByCategory.air_tools.map((tool) => (
                        <div
                          key={tool.id}
                          className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className="material-symbols-outlined text-blue-500 text-2xl shrink-0 mt-0.5"
                              style={{ fontVariationSettings: "'wght' 600" }}
                            >
                              {tool.icon || 'build'}
                            </span>
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-tight mb-1">{tool.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tool.description}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic">No air tools listed.</p>
                    )}
                  </div>
                </div>

                {/* Electric Tools Column */}
                <div>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-amber-500">
                    <div className="size-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <span
                        className="material-symbols-outlined text-amber-500 text-3xl"
                        style={{ fontVariationSettings: "'wght' 600" }}
                      >
                        bolt
                      </span>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Electric Tools</h3>
                  </div>
                  <div className="space-y-3">
                    {toolsByCategory.electric_tools && toolsByCategory.electric_tools.length > 0 ? (
                      toolsByCategory.electric_tools.map((tool) => (
                        <div
                          key={tool.id}
                          className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className="material-symbols-outlined text-amber-500 text-2xl shrink-0 mt-0.5"
                              style={{ fontVariationSettings: "'wght' 600" }}
                            >
                              {tool.icon || 'power'}
                            </span>
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-tight mb-1">{tool.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tool.description}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic">No electric tools listed.</p>
                    )}
                  </div>
                </div>

                {/* Lifting Equipment Column */}
                <div>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-purple-500">
                    <div className="size-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <span
                        className="material-symbols-outlined text-purple-500 text-3xl"
                        style={{ fontVariationSettings: "'wght' 600" }}
                      >
                        precision_manufacturing
                      </span>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Lifting Equipment</h3>
                  </div>
                  <div className="space-y-3">
                    {toolsByCategory.lifting_equipment && toolsByCategory.lifting_equipment.length > 0 ? (
                      toolsByCategory.lifting_equipment.map((tool) => (
                        <div
                          key={tool.id}
                          className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className="material-symbols-outlined text-purple-500 text-2xl shrink-0 mt-0.5"
                              style={{ fontVariationSettings: "'wght' 600" }}
                            >
                              {tool.icon || 'precision_manufacturing'}
                            </span>
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-tight mb-1">{tool.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{tool.description}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic">No lifting equipment listed.</p>
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
