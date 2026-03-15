import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { aboutContentAPI, homeContentAPI } from '../services/api';
import WhyChooseUs from '../components/sections/WhyChooseUs';

export default function About() {
  const [aboutContent, setAboutContent] = useState(null);
  const [homeContent, setHomeContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aboutData, homeData] = await Promise.all([
          aboutContentAPI.get(),
          homeContentAPI.get()
        ]);
        setAboutContent(aboutData);
        setHomeContent(homeData);
      } catch (error) {
        console.error('Failed to fetch about page data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <>
        {/* Section 1: Our Story Skeleton */}
        <section className="relative px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              {/* Orange label skeleton */}
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>

              {/* H1 heading skeleton (2 lines for long title) */}
              <div className="space-y-3 mb-6">
                <div className="h-10 lg:h-12 w-full max-w-3xl bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
                <div className="h-10 lg:h-12 w-3/4 max-w-2xl bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
              </div>

              {/* Company story paragraph skeleton (3 lines) */}
              <div className="max-w-3xl mx-auto space-y-3">
                <div className="h-4 lg:h-5 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                <div className="h-4 lg:h-5 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                <div className="h-4 lg:h-5 w-5/6 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Why Choose Us Skeleton */}
        <WhyChooseUs data={null} loading={true} />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Industrial pneumatic tool repair and maintenance services in Surrey, BC | CNS Tools and Repair</title>
        <meta
          name="description"
          content="Industrial pneumatic tool repair services based in Surrey, British Columbia. Certified technicians with years of hands-on experience servicing pneumatic tools for automotive, fleet, manufacturing, construction, oil & gas, aerospace, marine, mining, and MRO sectors."
        />
        <meta
          name="keywords"
          content="pneumatic tool repair Surrey, industrial tool repair Surrey BC, pneumatic tool repair specialists, certified technicians BC, OEM parts Surrey, air tool repair Surrey"
        />
        <link rel="canonical" href="https://cnstoolsandrepair.com/about" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolsandrepair.com/about" />
        <meta property="og:title" content="Industrial pneumatic tool repair and maintenance services in Surrey, BC | CNS Tools and Repair" />
        <meta property="og:description" content="Industrial pneumatic tool repair services based in Surrey, British Columbia. Certified technicians with years of hands-on experience servicing pneumatic tools." />
        <meta property="og:image" content="https://cnstoolsandrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolsandrepair.com/about" />
        <meta name="twitter:title" content="Industrial pneumatic tool repair and maintenance services in Surrey, BC | CNS Tools and Repair" />
        <meta name="twitter:description" content="Industrial pneumatic tool repair services based in Surrey, British Columbia. Certified technicians with years of hands-on experience servicing pneumatic tools." />
        <meta name="twitter:image" content="https://cnstoolsandrepair.com/og-image.jpg" />
      </Helmet>

      {/* Section 1: Our Story */}
      <section className="relative px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Story</h2>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase mb-6">
              {aboutContent?.page_heading || 'Industrial pneumatic tool repair and maintenance services in Surrey, BC'}
            </h1>
            {aboutContent?.company_story && (
              <p className="text-slate-600 dark:text-slate-400 text-base lg:text-lg leading-relaxed max-w-3xl mx-auto">
                {aboutContent.company_story}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Why Choose Us */}
      <WhyChooseUs data={homeContent?.whyChooseUs} loading={loading} />
    </>
  );
}
