/**
 * HowItWorks Component
 *
 * ⚠️ PRODUCTION NOTE:
 * Step 1 promises "same-day response" - ensure business operations
 * can consistently deliver this service level before launch.
 */

export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: 'Request a Quote',
      description: 'Submit tool details online—same-day response to get your repair started fast.',
    },
    {
      number: 2,
      title: 'Bring Tools to Surrey',
      description: 'Drop off at our workshop—no shipping delays or damage risk. Local, on-site service only.',
    },
    {
      number: 3,
      title: 'Diagnosis & Approval',
      description: 'Expert technicians identify root causes and provide transparent pricing before work starts.',
    },
    {
      number: 4,
      title: 'Repair & Testing',
      description: 'OEM parts installation and rigorous quality testing—tools returned ready for production.',
    },
  ];

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-16">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">Our Workflow</h2>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase px-4">How It Works</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
        {steps.map((step) => (
          <div key={step.number} className="flex lg:flex-col gap-4 sm:gap-5 lg:gap-4 items-start lg:items-center lg:text-center">
            <div className="shrink-0 flex items-center justify-center size-12 sm:size-14 lg:size-16 rounded-xl bg-primary text-white font-black text-lg sm:text-xl lg:text-2xl shadow-lg shadow-primary/20">
              {step.number}
            </div>
            <div>
              <h4 className="text-base sm:text-lg lg:text-xl font-black mb-1 sm:mb-1.5 lg:mb-2 uppercase tracking-tight">{step.title}</h4>
              <p className="text-xs sm:text-sm lg:text-base text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
        </div>
        <div className="mt-8 sm:mt-10 lg:mt-16 p-4 sm:p-5 lg:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex gap-2 sm:gap-3">
            <span className="material-symbols-outlined text-accent-orange text-lg sm:text-xl shrink-0">info</span>
            <p className="text-[10px] sm:text-[11px] lg:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
              Note: Final turnaround times are determined by the complexity of the diagnosis and specific parts availability.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
