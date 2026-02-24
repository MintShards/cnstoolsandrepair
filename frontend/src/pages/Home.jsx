import Hero from '../components/sections/Hero';
import QuickFacts from '../components/sections/QuickFacts';
import BrandsCarousel from '../components/sections/BrandsCarousel';
import HowItWorks from '../components/sections/HowItWorks';
import ToolsPreview from '../components/sections/ToolsPreview';
import IndustriesServed from '../components/sections/IndustriesServed';
import Testimonials from '../components/sections/Testimonials';
import MapLocation from '../components/sections/MapLocation';
import StickyQuoteCTA from '../components/sections/StickyQuoteCTA';

export default function Home() {
  return (
    <main className="relative">
      {/* Sticky Mobile CTA - Shows after Hero scrolls out */}
      <StickyQuoteCTA />
      {/* 1. Hero - Value proposition + immediate CTA */}
      <Hero />

      {/* 2. QuickFacts - Trust signals (stats) */}
      <QuickFacts />

      {/* 3. IndustriesServed - MOVED UP: Early audience targeting & qualification */}
      <IndustriesServed />

      {/* 4. Why Choose Us - Value differentiation (Responsive Optimized) */}
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
              Why Choose CNS
            </h2>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase px-4">
              Minimize Downtime, Maximize Productivity
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mt-3 sm:mt-4 max-w-3xl mx-auto text-sm sm:text-base lg:text-lg leading-relaxed px-4">
              <span className="font-bold text-slate-700 dark:text-slate-300">The Problem:</span> Tool failures cost industrial operations thousands in lost productivity per hour.
              <br className="hidden sm:block" />
              <span className="block sm:inline mt-2 sm:mt-0"><span className="font-bold text-slate-700 dark:text-slate-300">Our Solution:</span> Expert diagnosis, genuine OEM parts, and fast turnaround to get you back online.</span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {[
            {
              icon: 'query_stats',
              title: 'Expert Diagnostics',
              description: 'Identify root causes and prevent repeat failures with comprehensive analysis.',
            },
            {
              icon: 'inventory_2',
              title: 'OEM Parts Direct',
              description: 'Genuine components from authorized suppliers—no knockoff parts that fail again.',
            },
            {
              icon: 'schedule',
              title: 'Fast Turnaround',
              description: '3-7 day average repair time to minimize operational impact and lost revenue.',
            },
            {
              icon: 'location_on',
              title: 'Local Service',
              description: 'Surrey, BC workshop—no shipping delays or damage risk. Bring tools directly to us.',
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow"
            >
              <div className="size-14 sm:size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                <span
                  className="material-symbols-outlined text-primary text-3xl sm:text-4xl"
                  style={{ fontVariationSettings: "'wght' 600" }}
                >
                  {feature.icon}
                </span>
              </div>
              <h4 className="text-base sm:text-lg font-black mb-2 uppercase tracking-tight">{feature.title}</h4>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
          </div>
        </div>
      </section>

      {/* 5. Testimonials - MOVED UP: Social proof reinforcement */}
      <Testimonials />

      {/* 6. HowItWorks - Process education */}
      <HowItWorks />

      {/* 7. BrandsCarousel - MOVED DOWN: Supporting credibility */}
      <BrandsCarousel />

      {/* 8. ToolsPreview - Service catalog exploration */}
      <ToolsPreview />

      {/* 9. MapLocation - Location/accessibility info */}
      <MapLocation />

      {/* CTA Section - Mobile-Optimized */}
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-28 bg-slate-900 dark:bg-slate-900 relative overflow-hidden text-center">
        <div className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col items-center gap-4 sm:gap-6 relative z-10">
            <div className="bg-accent-orange size-12 sm:size-14 rounded-full flex items-center justify-center shadow-lg shadow-accent-orange/20">
              <span className="material-symbols-outlined text-white text-2xl sm:text-3xl">mail</span>
            </div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight uppercase tracking-tight px-4">Get Back Online Fast</h3>
            <p className="text-slate-300 max-w-sm lg:max-w-2xl font-medium mx-auto text-sm sm:text-base lg:text-lg leading-relaxed px-4">
              Start the CNS diagnostic process today. Our specialists provide detailed quotes for every repair within 24 hours.
            </p>
            {/* Mobile-First CTA Buttons */}
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 lg:gap-4 mt-2 sm:mt-4 px-4 sm:px-0">
              <a href="/quote" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto sm:px-8 h-14 sm:h-16 bg-primary text-white font-black rounded-xl flex items-center justify-center gap-2 sm:gap-3 shadow-2xl shadow-primary/40 border-2 border-primary/50 uppercase text-sm sm:text-base hover:bg-primary/90 transition-all active:scale-95 touch-manipulation">
                  <span className="material-symbols-outlined text-xl sm:text-2xl">fact_check</span>
                  <span>Request a Quote</span>
                </button>
              </a>
              <a href="/contact" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto sm:px-8 h-12 sm:h-16 bg-white/5 text-white font-black rounded-xl border-2 border-white/30 backdrop-blur-md flex items-center justify-center gap-2 uppercase text-sm sm:text-base hover:bg-white/10 transition-all active:scale-95 touch-manipulation">
                  <span className="material-symbols-outlined text-lg sm:text-xl">call</span>
                  <span>Call Support</span>
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
