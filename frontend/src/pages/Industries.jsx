import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { industriesContentAPI, homeContentAPI } from '../services/api';
import ServiceArea from '../components/sections/ServiceArea';
import FinalCTA from '../components/sections/FinalCTA';

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
        <title>Industries We Serve | Automotive, Fleet, Manufacturing, Construction | CNS Tools Surrey</title>
        <meta
          name="description"
          content="Pneumatic tool repair for 10 major industrial sectors: Automotive, Fleet Maintenance, Manufacturing, Metal Fabrication, Construction, Oil & Gas, Aerospace, Marine, Mining, and MRO. Serving Surrey and Lower Mainland businesses."
        />
        <meta
          name="keywords"
          content="automotive tool repair, fleet maintenance pneumatic tools, manufacturing tool service, construction air tools, oil gas industrial tools, aerospace tool repair Surrey BC"
        />
        <link rel="canonical" href="https://cnstoolsandrepair.com/industries" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolsandrepair.com/industries" />
        <meta property="og:title" content="Industries We Serve | Automotive, Fleet, Manufacturing, Construction | CNS Tools Surrey" />
        <meta property="og:description" content="Pneumatic tool repair for 10 major industrial sectors serving Surrey and Metro Vancouver businesses." />
        <meta property="og:image" content="https://cnstoolsandrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolsandrepair.com/industries" />
        <meta name="twitter:title" content="Industries We Serve | Automotive, Fleet, Manufacturing, Construction | CNS Tools Surrey" />
        <meta name="twitter:description" content="Pneumatic tool repair for 10 major industrial sectors serving Surrey and Metro Vancouver businesses." />
        <meta name="twitter:image" content="https://cnstoolsandrepair.com/og-image.jpg" />
      </Helmet>
      <main className="relative">
      {/* Hero + Industries Grid - Combined Section */}
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-900 dark:bg-slate-900">
        <div className="max-w-screen-xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
              {hero?.label || 'Who We Serve'}
            </h2>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase px-4 text-white">
              {hero?.heading || 'Industries We Support'}
            </h1>
            <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-sm sm:text-base lg:text-lg px-4">
              {hero?.description || 'Trusted pneumatic tool repair partner for major industrial sectors across Surrey, BC.'}
            </p>
          </div>

          {/* Industries Grid */}
          {loading ? (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
              <p className="mt-4 text-slate-500">Loading industries...</p>
            </div>
          ) : industries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {industries.map((industry, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-slate-800 rounded-2xl border border-slate-700 hover:border-primary transition-colors"
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
                    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">{industry.name}</h3>
                  </div>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {industry.description}
                  </p>

                  {/* Tool Badges */}
                  {industry.toolBadges && industry.toolBadges.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {industry.toolBadges.map((badge, i) => (
                        <span
                          key={i}
                          className="px-2.5 sm:px-3 py-1 bg-slate-700 text-slate-300 text-[10px] sm:text-xs font-bold rounded-full uppercase whitespace-nowrap"
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
        </div>
      </section>

      {/* Service Area - Custom background for Industries page */}
      <section className="px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20 bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed">
              {homeContent?.serviceArea?.highlightedCities ? (
                <>
                  Based in Surrey, BC, CNS Tools and Repair provides industrial pneumatic tool repair services to businesses across{' '}
                  {homeContent.serviceArea.highlightedCities.map((city, index) => (
                    <span key={index}>
                      <span className="font-bold text-slate-300">{city}</span>
                      {index < homeContent.serviceArea.highlightedCities.length - 1 && ', '}
                    </span>
                  ))}
                  , and the Lower Mainland.
                </>
              ) : (
                'Based in Surrey, BC, CNS Tools and Repair provides industrial pneumatic tool repair services to businesses across Surrey, Delta, Burnaby, New Westminster, Coquitlam, Langley, Richmond, Vancouver, and the Lower Mainland.'
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <FinalCTA
        data={homeContent?.finalCta}
        loading={loading}
      />
    </main>
    </>
  );
}
