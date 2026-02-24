import MapLocation from '../components/sections/MapLocation';
import { useSettings } from '../contexts/SettingsContext';

export default function Contact() {
  const { settings, loading } = useSettings();

  if (loading || !settings) {
    return (
      <main className="relative min-h-screen px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-12 w-64 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>
        </div>
      </main>
    );
  }

  const { contact, hours, serviceArea } = settings;
  const fullAddress = `${contact.address.street}, ${contact.address.city}, ${contact.address.province} ${contact.address.postalCode}`;

  return (
    <main className="relative min-h-screen px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Get In Touch</h2>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Contact Us</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 text-base lg:text-lg">
            Have questions about our services? Need a quote? We're here to help!
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 mb-12 lg:mb-16">
          <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
            <div className="flex gap-4 mb-6">
              <div className="shrink-0">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">call</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-2">Phone</h3>
                <p className="text-slate-600 dark:text-slate-300">Call us during business hours</p>
                <a href={`tel:${contact.phoneLink}`} className="text-primary font-bold mt-2 block hover:underline">
                  {contact.phone}
                </a>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
            <div className="flex gap-4 mb-6">
              <div className="shrink-0">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">mail</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-2">Email</h3>
                <p className="text-slate-600 dark:text-slate-300">Send us a message</p>
                <a href={`mailto:${contact.email}`} className="text-primary font-bold mt-2 block hover:underline">
                  {contact.email}
                </a>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
            <div className="flex gap-4 mb-6">
              <div className="shrink-0">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-2">Location</h3>
                <p className="text-slate-600 dark:text-slate-300">Visit our facility</p>
                <p className="text-primary font-bold mt-2">{fullAddress}</p>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
            <div className="flex gap-4 mb-6">
              <div className="shrink-0">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">schedule</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-2">Business Hours</h3>
                <p className="text-slate-600 dark:text-slate-300">Weekdays</p>
                <p className="text-primary font-bold mt-2">{hours.weekdays}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{hours.weekend}</p>
                {hours.timezone && (
                  <p className="text-slate-400 text-xs mt-1">({hours.timezone})</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Service Area Information */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8 mb-12">
          <div className="flex items-start gap-4 mb-6">
            <div className="size-14 rounded-xl bg-accent-orange/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-accent-orange text-3xl">my_location</span>
            </div>
            <div className="flex-grow">
              <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Service Area</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                We proudly serve businesses across <span className="font-bold text-primary">{serviceArea}</span>, with our workshop centrally located in {contact.address.city}, BC.
              </p>
            </div>
          </div>

          <div className="p-5 lg:p-6 bg-accent-orange/10 border border-accent-orange/30 rounded-xl">
            <div className="flex gap-3 items-start">
              <span className="material-symbols-outlined text-accent-orange text-xl shrink-0">info</span>
              <div>
                <h4 className="font-black text-sm lg:text-base uppercase tracking-tight mb-1">On-Site Service Only</h4>
                <p className="text-xs lg:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  We do not offer shipping services. Customers bring pneumatic tools directly to our {contact.address.city} workshop for professional diagnosis and repair—eliminating shipping delays, damage risk, and extra costs.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['Vancouver', 'Burnaby', 'Richmond', 'Coquitlam', 'Langley', 'Delta'].map((city) => (
              <div key={city} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                <span className="font-medium">{city}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-primary/10 border-2 border-primary/30 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">Need a Quote?</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            The fastest way to get started is to submit a quote request online. Expect a same-day response during business hours.
          </p>
          <a href="/quote">
            <button className="bg-primary text-white font-black px-8 py-4 rounded-xl shadow-xl shadow-primary/30 active:scale-95 transition-transform uppercase">
              Request a Quote
            </button>
          </a>
        </div>
      </div>

      {/* Map Location Section */}
      <MapLocation />
    </main>
  );
}
