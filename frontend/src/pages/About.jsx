import { Helmet } from 'react-helmet-async';

export default function About() {
  return (
    <>
      <Helmet>
        <title>About CNS Tools and Repair | Industrial Pneumatic Tool Repair Surrey BC</title>
        <meta
          name="description"
          content="CNS Tools and Repair is Surrey BC's premier industrial pneumatic tool repair specialist. Certified technicians, OEM parts sourcing, and professional service for automotive, fleet, manufacturing, construction, oil & gas, aerospace, marine, mining, and MRO sectors."
        />
        <meta
          name="keywords"
          content="about CNS Tools, pneumatic tool repair company Surrey, industrial tool repair specialist, certified technicians BC, OEM parts Surrey"
        />
        <link rel="canonical" href="https://cnstoolsandrepair.com/about" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolsandrepair.com/about" />
        <meta property="og:title" content="About CNS Tools and Repair | Industrial Pneumatic Tool Repair Surrey BC" />
        <meta property="og:description" content="Surrey BC's premier industrial pneumatic tool repair specialist. Certified technicians, OEM parts sourcing, and professional service." />
        <meta property="og:image" content="https://cnstoolsandrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolsandrepair.com/about" />
        <meta name="twitter:title" content="About CNS Tools and Repair | Industrial Pneumatic Tool Repair Surrey BC" />
        <meta name="twitter:description" content="Surrey BC's premier industrial pneumatic tool repair specialist. Certified technicians, OEM parts sourcing, and professional service." />
        <meta name="twitter:image" content="https://cnstoolsandrepair.com/og-image.jpg" />
      </Helmet>
      <main className="relative min-h-screen px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Story</h2>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">About CNS Tools and Repair</h1>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 mb-8">
            <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">Who We Are</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              CNS Tools and Repair is Surrey, BC&apos;s premier industrial pneumatic tool repair specialist. We provide comprehensive repair,
              calibration, rental, and sales services for businesses across automotive, fleet maintenance, manufacturing, metal fabrication, construction, oil & gas, aerospace, marine, mining, and MRO sectors.
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Our on-site facility is equipped with state-of-the-art diagnostic tools and staffed by certified technicians with
              years of hands-on experience repairing pneumatic tools from all major brands.
            </p>
          </div>

          <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 mb-8">
            <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">Our Commitment</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary">check_circle</span>
                <span className="text-slate-600 dark:text-slate-300">Professional diagnostic services to identify root causes</span>
              </li>
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary">check_circle</span>
                <span className="text-slate-600 dark:text-slate-300">Genuine OEM parts sourcing for quality repairs</span>
              </li>
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary">check_circle</span>
                <span className="text-slate-600 dark:text-slate-300">Transparent pricing and detailed quotes</span>
              </li>
              <li className="flex gap-3">
                <span className="material-symbols-outlined text-primary">check_circle</span>
                <span className="text-slate-600 dark:text-slate-300">Quality workmanship to minimize repeat failures</span>
              </li>
            </ul>
          </div>

          <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">Location</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              We are proudly based in Surrey, British Columbia, Canada. All services are performed on-site at our facility,
              ensuring quality control and fast service for local businesses.
            </p>
            <div className="flex gap-3 text-slate-600 dark:text-slate-300">
              <span className="material-symbols-outlined text-primary">location_on</span>
              <span className="font-bold">Surrey, BC, Canada</span>
            </div>
          </div>
        </div>

        <div className="mt-12 lg:mt-16 text-center">
          <a href="/quote">
            <button className="bg-primary text-white font-black px-8 py-4 rounded-xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 active:scale-95 transition-all uppercase">
              Request a Quote
            </button>
          </a>
        </div>
      </div>
    </main>
    </>
  );
}
