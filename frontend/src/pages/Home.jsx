import Hero from '../components/sections/Hero';
import HowItWorks from '../components/sections/HowItWorks';

export default function Home() {
  return (
    <main className="relative">
      <Hero />
      <HowItWorks />

      {/* Why Choose Us Section */}
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-[0.25em] mb-2">
              Why CNS Tools and Repair
            </h2>
            <h3 className="text-3xl lg:text-4xl font-black tracking-tight uppercase">Built for Industry</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: 'query_stats',
              title: 'Expert Diagnostics',
              description: 'Comprehensive analysis to identify tool failure and prevent future downtime.',
            },
            {
              icon: 'inventory_2',
              title: 'Reliable Sourcing',
              description: 'Direct access to OEM suppliers ensures your equipment is repaired with genuine components.',
            },
            {
              icon: 'verified_user',
              title: 'Certified Team',
              description: 'Factory-trained technicians with years of hands-on industrial tool experience.',
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800"
            >
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <span
                  className="material-symbols-outlined text-primary text-4xl"
                  style={{ fontVariationSettings: "'wght' 600" }}
                >
                  {feature.icon}
                </span>
              </div>
              <h4 className="text-lg font-black mb-2 uppercase tracking-tight">{feature.title}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">{feature.description}</p>
            </div>
          ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 sm:px-8 lg:px-12 py-20 sm:py-24 lg:py-28 bg-slate-900 relative overflow-hidden text-center">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col items-center gap-6 relative z-10">
            <div className="bg-accent-orange size-12 rounded-full flex items-center justify-center shadow-lg shadow-accent-orange/20">
              <span className="material-symbols-outlined text-white text-2xl">mail</span>
            </div>
            <h3 className="text-3xl lg:text-4xl font-black text-white leading-tight uppercase tracking-tight">Get Back Online</h3>
            <p className="text-slate-300 max-w-sm lg:max-w-2xl font-medium mx-auto text-base lg:text-lg">
              Initiate the CNS diagnostic process today. Our specialists provide detailed quotes for every repair.
            </p>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 lg:gap-4 mt-4">
              <a href="/quote" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto sm:px-8 h-16 bg-primary text-white font-black rounded-xl flex items-center justify-center gap-3 shadow-2xl shadow-primary/40 border border-primary/50 uppercase hover:bg-primary/90 transition-all">
                  <span className="material-symbols-outlined">fact_check</span>
                  Request a Quote
                </button>
              </a>
              <a href="/contact" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto sm:px-8 h-16 bg-white/5 text-white font-black rounded-xl border border-white/20 backdrop-blur-md flex items-center justify-center gap-2 uppercase hover:bg-white/10 transition-all">
                  <span className="material-symbols-outlined">call</span>
                  Call Support
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
