import { Helmet } from 'react-helmet-async';

export default function Services() {
  const services = [
    {
      title: 'Pneumatic Tool Repair',
      description: 'Complete diagnostic and repair services for all types of pneumatic tools including impact wrenches, grinders, drills, sanders, and more.',
      icon: 'build',
    },
    {
      title: 'Tool Calibration',
      description: 'Precision calibration services for specialty pneumatic tools to ensure optimal performance and accuracy.',
      icon: 'tune',
    },
    {
      title: 'Equipment Rental',
      description: 'Short-term and long-term rental of quality pneumatic tools while your equipment is being repaired.',
      icon: 'handshake',
    },
    {
      title: 'Used Tool Sales',
      description: 'Quality refurbished pneumatic tools available for purchase at competitive prices.',
      icon: 'sell',
    },
  ];

  return (
    <>
      <Helmet>
        <title>Pneumatic Tool Services | Repair, Calibration & Rental | CNS Tools Surrey</title>
        <meta
          name="description"
          content="Expert pneumatic tool repair, precision calibration, equipment rental, and used tool sales in Surrey, BC. Comprehensive services for automotive, fleet, manufacturing, construction, and industrial sectors."
        />
        <meta
          name="keywords"
          content="pneumatic tool repair services, air tool calibration, tool rental Surrey, industrial equipment repair, used pneumatic tools, tool service Surrey BC"
        />
        <link rel="canonical" href="https://cnstoolsandrepair.com/services" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolsandrepair.com/services" />
        <meta property="og:title" content="Pneumatic Tool Services | Repair, Calibration & Rental | CNS Tools Surrey" />
        <meta property="og:description" content="Expert pneumatic tool repair, precision calibration, equipment rental, and used tool sales in Surrey, BC." />
        <meta property="og:image" content="https://cnstoolsandrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolsandrepair.com/services" />
        <meta name="twitter:title" content="Pneumatic Tool Services | Repair, Calibration & Rental | CNS Tools Surrey" />
        <meta name="twitter:description" content="Expert pneumatic tool repair, precision calibration, equipment rental, and used tool sales in Surrey, BC." />
        <meta name="twitter:image" content="https://cnstoolsandrepair.com/og-image.jpg" />
      </Helmet>
      <main className="relative min-h-screen">
      <div className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">What We Offer</h2>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Our Services</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-2xl mx-auto text-base lg:text-lg">
              Comprehensive pneumatic tool solutions for automotive, fleet maintenance, manufacturing, metal fabrication, construction, oil & gas, aerospace, marine, mining, and MRO operations across Surrey, BC.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto">
          {services.map((service, index) => (
            <div
              key={index}
              className="flex flex-col md:flex-row gap-6 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700"
            >
              <div className="shrink-0">
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
                <h3 className="text-xl font-black mb-2 uppercase tracking-tight">{service.title}</h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{service.description}</p>
              </div>
            </div>
          ))}
          </div>

          <div className="mt-16 lg:mt-20 text-center">
            <a href="/quote">
              <button className="bg-primary text-white font-black px-8 py-4 rounded-xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 active:scale-95 transition-all uppercase">
                Request a Quote
              </button>
            </a>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
