export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: 'Request a Quote',
      description: 'Submit tool details online via our quote form to initiate the service request.',
    },
    {
      number: 2,
      title: 'Professional Diagnosis',
      description: 'Our technicians thoroughly inspect and identify the root cause of the issue.',
    },
    {
      number: 3,
      title: 'Parts & Approval',
      description: 'We source high-quality OEM parts and provide a final estimate for your approval.',
    },
    {
      number: 4,
      title: 'Expert Repair',
      description: 'Precision repair by certified experts followed by rigorous industrial quality testing.',
    },
  ];

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Workflow</h2>
          <h3 className="text-3xl lg:text-4xl font-black tracking-tight uppercase">How It Works</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
        {steps.map((step) => (
          <div key={step.number} className="flex lg:flex-col gap-5 lg:gap-4 items-start lg:items-center lg:text-center">
            <div className="shrink-0 flex items-center justify-center size-12 lg:size-16 rounded-xl bg-primary text-white font-black text-xl lg:text-2xl shadow-lg shadow-primary/20">
              {step.number}
            </div>
            <div>
              <h4 className="text-lg lg:text-xl font-black mb-1 lg:mb-2 uppercase tracking-tight">{step.title}</h4>
              <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
        </div>
        <div className="mt-12 lg:mt-16 p-5 lg:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-accent-orange">info</span>
            <p className="text-[11px] lg:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
              Note: Final turnaround times are determined by the complexity of the diagnosis and specific parts availability.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
