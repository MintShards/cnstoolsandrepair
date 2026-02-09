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
    <section className="px-6 py-16 bg-white dark:bg-slate-900">
      <div className="text-center mb-12">
        <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Workflow</h2>
        <h3 className="text-3xl font-black tracking-tight uppercase">How It Works</h3>
      </div>
      <div className="grid grid-cols-1 gap-10">
        {steps.map((step) => (
          <div key={step.number} className="flex gap-5 items-start">
            <div className="shrink-0 flex items-center justify-center size-12 rounded-xl bg-primary text-white font-black text-xl shadow-lg shadow-primary/20">
              {step.number}
            </div>
            <div>
              <h4 className="text-lg font-black mb-1 uppercase tracking-tight">{step.title}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-12 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-accent-orange">info</span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
            Note: Final turnaround times are determined by the complexity of the diagnosis and specific parts availability.
          </p>
        </div>
      </div>
    </section>
  );
}
