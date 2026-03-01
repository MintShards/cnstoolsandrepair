import { Link } from 'react-router-dom';

export default function IndustriesServed() {
  const industries = [
    {
      name: 'Automotive Repair & Body Shops',
      icon: 'directions_car',
      description: 'Auto repair shops and body shops rely on pneumatic tools for precision work, from impact wrenches to spray guns.',
      useCases: ['Impact wrenches', 'Air ratchets', 'Spray guns', 'Sanders'],
    },
    {
      name: 'Fleet & Truck Maintenance',
      icon: 'local_shipping',
      description: 'Fleet maintenance operations depend on reliable pneumatic equipment for heavy-duty truck and trailer repairs.',
      useCases: ['Impact tools', 'Grinders', 'Air hammers', 'Drills'],
    },
    {
      name: 'Manufacturing & Assembly',
      icon: 'precision_manufacturing',
      description: 'Industrial manufacturing plants use pneumatic tools for assembly lines, fabrication, and quality control.',
      useCases: ['Assembly tools', 'Grinders', 'Specialty tools', 'Torque tools'],
    },
    {
      name: 'Metal Fabrication & Welding',
      icon: 'manufacturing',
      description: 'Metal fabrication shops require precision pneumatic tools for cutting, grinding, and finishing metalwork.',
      useCases: ['Cut-off tools', 'Die grinders', 'Needle scalers', 'Sanders'],
    },
    {
      name: 'Construction & Concrete',
      icon: 'apartment',
      description: 'Construction sites depend on pneumatic tools for framing, finishing, concrete work, and heavy-duty applications.',
      useCases: ['Nail guns', 'Drills', 'Breakers', 'Chipping hammers'],
    },
    {
      name: 'Oil, Gas & Energy',
      icon: 'oil_barrel',
      description: 'Energy sector operations in hazardous environments require certified pneumatic tools for safe, spark-free operation.',
      useCases: ['Hazloc tools', 'Impact wrenches', 'Grinders', 'Drills'],
    },
  ];

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-16">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
            Who We Serve
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-3 sm:mb-4 max-w-2xl mx-auto text-sm sm:text-base px-4">
            We provide industrial pneumatic tool repair services for businesses operating in demanding environments across Surrey and Metro Vancouver.
          </p>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase px-4">
            Industries We Support
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {industries.map((industry, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary dark:hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="size-12 sm:size-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span
                    className="material-symbols-outlined text-primary text-2xl sm:text-3xl"
                    style={{ fontVariationSettings: "'wght' 600" }}
                  >
                    {industry.icon}
                  </span>
                </div>
                <h4 className="text-lg sm:text-xl font-black uppercase tracking-tight">{industry.name}</h4>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {industry.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {industry.useCases.map((useCase, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 sm:px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs font-bold rounded-full uppercase whitespace-nowrap"
                  >
                    {useCase}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 sm:mt-10 lg:mt-16 text-center">
          <Link to="/industries" className="inline-block w-full sm:w-auto">
            <button className="w-full sm:w-auto bg-primary text-white font-black px-6 sm:px-8 h-12 sm:h-14 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-95 transition-all uppercase text-sm touch-manipulation">
              View All Industries
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
