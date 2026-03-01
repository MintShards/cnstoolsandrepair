import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { industriesAPI } from '../services/api';

export default function Industries() {
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIndustries = async () => {
      try {
        const data = await industriesAPI.list();
        setIndustries(data);
      } catch (error) {
        console.error('Failed to fetch industries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIndustries();
  }, []);

  return (
    <>
      <Helmet>
        <title>Industries We Serve | Automotive, Fleet, Manufacturing, Construction | CNS Tools Surrey</title>
        <meta
          name="description"
          content="Pneumatic tool repair for 10 major industrial sectors: Automotive, Fleet Maintenance, Manufacturing, Metal Fabrication, Construction, Oil & Gas, Aerospace, Marine, Mining, and MRO. Serving Surrey and Metro Vancouver businesses."
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
      <main className="relative min-h-screen px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Who We Serve</h2>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Industries We Support</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto text-base lg:text-lg">
            Trusted pneumatic tool repair partner for major industrial sectors across Surrey, BC.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
            <p className="mt-4 text-slate-500">Loading industries...</p>
          </div>
        ) : industries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 lg:gap-10">
            {industries.map((industry) => (
              <div
                key={industry.id}
                className="flex gap-6 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800"
              >
                <div className="shrink-0">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-primary text-4xl"
                      style={{ fontVariationSettings: "'wght' 600" }}
                    >
                      {industry.icon || 'business'}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-black mb-2 uppercase tracking-tight">{industry.name}</h3>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{industry.description}</p>
                </div>
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
    </main>
    </>
  );
}
