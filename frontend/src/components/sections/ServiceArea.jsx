export default function ServiceArea({
  data = null,
  loading = false
}) {
  // Default content (fallback)
  const defaultData = {
    highlightedCities: ["Surrey", "Delta", "Burnaby", "New Westminster", "Coquitlam", "Langley", "Richmond", "Vancouver"],
  };

  const content = data || defaultData;

  // Build description dynamically from city list (template approach)
  const buildDescription = () => {
    const cityList = content.highlightedCities.join(', ');
    return `Based in Surrey, BC, CNS Tools and Repair provides industrial pneumatic tool repair services to businesses across ${cityList}, and the Lower Mainland.`;
  };

  const description = buildDescription();

  // Loading skeleton
  if (loading) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20 bg-slate-100 dark:bg-slate-900">
        <div className="max-w-screen-xl mx-auto">
          <div className="max-w-4xl mx-auto text-center space-y-2">
            <div className="h-5 lg:h-6 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            <div className="h-5 lg:h-6 w-3/4 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
          </div>
        </div>
      </section>
    );
  }

  // Render description with highlighted cities
  const renderDescription = () => {
    // Create dynamic regex pattern from highlighted cities
    const highlightTerms = content.highlightedCities;
    const pattern = new RegExp(`(${highlightTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

    const parts = description.split(pattern);
    return parts.map((part, index) => {
      if (content.highlightedCities.includes(part)) {
        return (
          <span key={index} className="font-bold text-slate-700 dark:text-slate-300">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-20 bg-slate-100 dark:bg-slate-900">
      <div className="max-w-screen-xl mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed">
            {renderDescription()}
          </p>
        </div>
      </div>
    </section>
  );
}
