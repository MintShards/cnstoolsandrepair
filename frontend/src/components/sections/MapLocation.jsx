import { useSettings } from '../../contexts/SettingsContext';

export default function MapLocation() {
  const { settings, loading } = useSettings();

  if (loading || !settings) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-12">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>
        </div>
      </section>
    );
  }

  const { contact, hours, map } = settings;

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-950">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-16">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
            Our Location
          </h2>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase px-4">Visit Our Facility</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto px-4">
            Conveniently located in {contact.address.city}, BC. Bring your tools directly to our facility for expert diagnosis and repair.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-10">
          {/* Map Container */}
          <div className="lg:col-span-3">
            <div className="relative w-full h-[300px] sm:h-[400px] lg:h-[500px] rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
              <iframe
                src={map.embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`CNS Tools and Repair Location - ${contact.address.city}, ${contact.address.province}`}
                className="absolute inset-0"
              />
            </div>
          </div>

          {/* Contact Info & Directions */}
          <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-5 lg:gap-6">
            {/* Address Card with Plain-Text NAP for SEO */}
            <div className="p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="shrink-0">
                  <div className="size-12 sm:size-14 rounded-xl bg-accent-orange/10 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-accent-orange text-2xl sm:text-3xl"
                      style={{ fontVariationSettings: "'wght' 600" }}
                    >
                      location_on
                    </span>
                  </div>
                </div>
                <div className="flex-grow">
                  <h4 className="text-base sm:text-lg lg:text-xl font-black uppercase tracking-tight mb-1 sm:mb-2">CNS Tools and Repair</h4>
                  {/* Plain-text NAP format for Google Maps SEO */}
                  <div className="text-xs sm:text-sm lg:text-base text-slate-600 dark:text-slate-300 font-medium space-y-0.5">
                    <p>{contact.address.street}</p>
                    <p>{contact.address.city}, {contact.address.province} {contact.address.postalCode}</p>
                    <p>Canada</p>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="material-symbols-outlined text-primary text-lg sm:text-xl">call</span>
                  <a
                    href={`tel:${contact.phoneLink}`}
                    className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
                  >
                    {contact.phone}
                  </a>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="material-symbols-outlined text-primary text-lg sm:text-xl">mail</span>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors break-all"
                  >
                    {contact.email}
                  </a>
                </div>
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="material-symbols-outlined text-primary text-lg sm:text-xl shrink-0">schedule</span>
                  <div className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                    <p>{hours.weekdays}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs mt-1">{hours.weekend}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Get Directions Button */}
            <a
              href={map.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              <button className="w-full h-12 sm:h-14 lg:h-16 bg-primary text-white font-black rounded-xl flex items-center justify-center gap-2 sm:gap-3 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 active:scale-95 transition-all border border-primary/50 uppercase text-sm sm:text-base touch-manipulation">
                <span className="material-symbols-outlined text-xl sm:text-2xl">directions</span>
                <span>Get Directions</span>
              </button>
            </a>

            {/* Service Note */}
            <div className="p-4 sm:p-5 lg:p-6 bg-accent-orange/10 border border-accent-orange/30 rounded-2xl">
              <div className="flex gap-2 sm:gap-3 items-start">
                <span className="material-symbols-outlined text-accent-orange text-lg sm:text-xl shrink-0">info</span>
                <div>
                  <h4 className="font-black text-[10px] sm:text-xs lg:text-sm uppercase tracking-tight mb-1">On-Site Service Only</h4>
                  <p className="text-[10px] sm:text-[11px] lg:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    We do not offer shipping. Customers bring tools directly to our {contact.address.city} workshop—eliminating shipping delays and damage risk.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
