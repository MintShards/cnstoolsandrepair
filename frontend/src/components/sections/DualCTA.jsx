import { useSettings } from '../../contexts/SettingsContext';
import { BUSINESS_INFO } from '../../config/business';

export default function DualCTA({ backgroundColor = 'bg-white dark:bg-slate-900' }) {
  const { settings } = useSettings();

  // Use settings or fallback to business config
  const phone = settings?.phone || BUSINESS_INFO.phone;
  const phoneLink = phone.replace(/[^0-9]/g, '');

  return (
    <section className={`px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 ${backgroundColor}`}>
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center">
          {/* Main Heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase mb-4">
            Ready to Get Your Tools Back in Action?
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg lg:text-xl max-w-2xl mx-auto mb-8 sm:mb-10">
            Professional pneumatic tool repair in Surrey, BC with factory-trained technicians and quality workmanship you can trust.
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 sm:mb-12">
            {/* Primary CTA - Request Quote */}
            <a href="/quote" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto bg-primary text-white font-black px-8 py-4 rounded-xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 active:scale-95 transition-all uppercase flex items-center justify-center gap-2">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 600" }}>
                  request_quote
                </span>
                Request a Quote
              </button>
            </a>

            {/* Secondary CTA - Call Now */}
            <a href={`tel:${phoneLink}`} className="w-full sm:w-auto">
              <button className="w-full sm:w-auto bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black px-8 py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary active:scale-95 transition-all uppercase flex items-center justify-center gap-2">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 600" }}>
                  phone
                </span>
                Call {phone}
              </button>
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}
