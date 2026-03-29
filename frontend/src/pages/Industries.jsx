import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { industriesContentAPI, homeContentAPI } from '../services/api';
import DualCTA from '../components/sections/DualCTA';
import ServiceArea from '../components/sections/ServiceArea';

export default function Industries() {
  const [hero, setHero] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [homeContent, setHomeContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [industriesData, homeData] = await Promise.all([
          industriesContentAPI.get(),
          homeContentAPI.get()
        ]);
        setHero(industriesData.hero);
        setIndustries(industriesData.industries);
        setHomeContent(homeData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <Helmet>
        <title>Industries We Serve | Automotive, Fleet, Manufacturing, Construction | CNS Tool Repair Surrey BC</title>
        <meta
          name="description"
          content="Pneumatic tool repair for 10 major industrial sectors: Automotive, Fleet Maintenance, Manufacturing, Metal Fabrication, Construction, Oil & Gas, Aerospace, Marine, Mining, and MRO. Serving Surrey and Lower Mainland businesses."
        />
        <meta
          name="keywords"
          content="automotive tool repair, fleet maintenance pneumatic tools, manufacturing tool service, construction air tools, oil gas industrial tools, aerospace tool repair Surrey BC"
        />
        <link rel="canonical" href="https://cnstoolrepair.com/industries" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolrepair.com/industries" />
        <meta property="og:title" content="Industries We Serve | Automotive, Fleet, Manufacturing, Construction | CNS Tool Repair Surrey BC" />
        <meta property="og:description" content="Pneumatic tool repair for 10 major industrial sectors serving Surrey and Metro Vancouver businesses." />
        <meta property="og:image" content="https://cnstoolrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolrepair.com/industries" />
        <meta name="twitter:title" content="Industries We Serve | Automotive, Fleet, Manufacturing, Construction | CNS Tool Repair Surrey BC" />
        <meta name="twitter:description" content="Pneumatic tool repair for 10 major industrial sectors serving Surrey and Metro Vancouver businesses." />
        <meta name="twitter:image" content="https://cnstoolrepair.com/og-image.jpg" />
      </Helmet>
      <main className="relative">
        {/* Hero + Industries Grid - Combined Section */}
        <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-900">
        <div className="max-w-screen-xl mx-auto">
          {loading ? (
            <>
              {/* Hero Skeleton */}
              <div className="text-center mb-12 lg:mb-16">
                {/* Orange label skeleton */}
                <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>

                {/* H1 heading skeleton */}
                <div className="h-10 sm:h-11 lg:h-12 w-80 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4 animate-pulse"></div>

                {/* Description skeleton (2 lines) */}
                <div className="max-w-2xl mx-auto space-y-2">
                  <div className="h-4 lg:h-5 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-4 lg:h-5 w-4/5 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                </div>
              </div>

              {/* Industries Grid Skeleton (6 cards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800"
                  >
                    {/* Icon + Name Row Skeleton */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="size-12 sm:size-14 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
                      <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>

                    {/* Description Skeleton (3 lines) */}
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                      <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>

                    {/* Tool Badges Skeleton */}
                    <div className="flex flex-wrap gap-2">
                      <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                      <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                      <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Hero */}
              <div className="text-center mb-12 lg:mb-16">
                <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
                  {hero?.label || 'Who We Serve'}
                </h2>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase px-4 text-slate-900 dark:text-white">
                  {hero?.heading || 'Industries We Support'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto text-sm sm:text-base lg:text-lg px-4">
                  {hero?.description || 'Trusted pneumatic tool repair partner for major industrial sectors across Surrey, BC.'}
                </p>
              </div>

              {/* Industries Grid */}
              {industries.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                  {industries.map((industry, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary dark:hover:border-primary transition-colors"
                    >
                      {/* Icon + Name Row */}
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="size-12 sm:size-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <span
                            className="material-symbols-outlined text-primary text-2xl sm:text-3xl"
                            style={{ fontVariationSettings: "'wght' 600" }}
                          >
                            {industry.icon || 'business'}
                          </span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{industry.name}</h3>
                      </div>

                      {/* Description */}
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {industry.description}
                      </p>

                      {/* Tool Badges */}
                      {industry.toolBadges && industry.toolBadges.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {industry.toolBadges.map((badge, i) => (
                            <span
                              key={i}
                              className="px-2.5 sm:px-3 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs font-bold rounded-full uppercase whitespace-nowrap"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <span className="material-symbols-outlined text-6xl text-slate-400">business</span>
                  <p className="mt-4 text-slate-500">No industries listed yet. Check back soon!</p>
                </div>
              )}
            </>
          )}
          </div>
        </section>

        {/* Service Area */}
        <ServiceArea data={homeContent?.serviceArea} loading={loading} backgroundColor="bg-white dark:bg-slate-950" />

        {/* Call-to-Action */}
        <DualCTA backgroundColor="bg-slate-100 dark:bg-slate-900" />
      </main>
    </>
  );
}
