export default function Contact() {
  return (
    <main className="relative min-h-screen px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-50 dark:bg-slate-950">
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
                <a href="tel:+16045550123" className="text-primary font-bold mt-2 block hover:underline">
                  (604) 555-0123
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
                <a href="mailto:info@cnstools.com" className="text-primary font-bold mt-2 block hover:underline">
                  info@cnstools.com
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
                <p className="text-primary font-bold mt-2">Surrey, BC, Canada</p>
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
                <p className="text-slate-600 dark:text-slate-300">Monday - Friday</p>
                <p className="text-primary font-bold mt-2">8:00 AM - 5:00 PM PST</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-primary/10 border-2 border-primary/30 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">Need a Quote?</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            The fastest way to get started is to submit a quote request online.
          </p>
          <a href="/quote">
            <button className="bg-primary text-white font-black px-8 py-4 rounded-xl shadow-xl shadow-primary/30 active:scale-95 transition-transform uppercase">
              Request a Quote
            </button>
          </a>
        </div>
      </div>
    </main>
  );
}
