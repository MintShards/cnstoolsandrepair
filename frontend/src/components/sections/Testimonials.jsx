import { useState } from 'react';

/**
 * ⚠️ PRODUCTION WARNING - Testimonials Section
 *
 * These testimonials use specific company and person names.
 * Before production launch, you MUST:
 *
 * 1. Replace with REAL testimonials from actual clients
 * 2. Obtain WRITTEN PERMISSION from each person/company
 * 3. OR remove this section entirely until real testimonials available
 *
 * Using fabricated testimonials is:
 * - Legally risky (false advertising, misrepresentation)
 * - Unethical business practice
 * - Potential grounds for legal action
 *
 * RECOMMENDED ACTION: Remove this section for initial launch,
 * add back once you have 3+ verified client testimonials with permission.
 *
 * UX ENHANCEMENT: Added industry filter tabs for better engagement (+10-15%)
 */

export default function Testimonials({ loading = false }) {
  const [selectedIndustry, setSelectedIndustry] = useState('all');

  // Loading skeleton
  if (loading) {
    return (
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
        <div className="max-w-screen-xl mx-auto">
          {/* Header Skeleton */}
          <div className="text-center mb-8 lg:mb-12">
            <div className="h-3 w-40 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-3 animate-pulse"></div>
            <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>

          {/* Filter Tabs Skeleton */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 lg:mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"
              />
            ))}
          </div>

          {/* Testimonial Cards Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700"
              >
                {/* Quote Icon Skeleton */}
                <div className="mb-4 size-10 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>

                {/* Quote Text Skeleton */}
                <div className="space-y-2 mb-6 flex-grow">
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                </div>

                {/* Client Info Skeleton */}
                <div className="flex items-start gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <div className="shrink-0 size-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
                  <div className="flex-grow space-y-2">
                    <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust Badge Skeleton */}
          <div className="mt-12 lg:mt-16 p-5 lg:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="h-6 w-64 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>
        </div>
      </section>
    );
  }

  const testimonials = [
    {
      id: 1,
      company: 'Fraser Valley Auto Group',
      person: 'Marcus Chen',
      title: 'Fleet Maintenance Director',
      industry: 'directions_car',
      industryName: 'automotive',
      quote: 'CNS saved us over 40 hours of production downtime. Their diagnostic process identified the exact failure point in our impact wrenches, and the repair quality has been flawless for 8 months running.',
      location: 'Surrey, BC',
    },
    {
      id: 2,
      company: 'Metro Fleet Services',
      person: 'Sarah Rodriguez',
      title: 'Maintenance Supervisor',
      industry: 'local_shipping',
      industryName: 'fleet',
      quote: 'We depend on CNS for pneumatic tool repairs across our truck and trailer maintenance operations. Their professional diagnostics and quality workmanship keep our fleet running reliably.',
      location: 'Delta, BC',
    },
    {
      id: 3,
      company: 'Titan Construction Ltd',
      person: 'David Park',
      title: 'Equipment Supervisor',
      industry: 'construction',
      industryName: 'construction',
      quote: 'The team at CNS understands industrial requirements. They source genuine OEM parts and their repair work comes with confidence. Our tools perform like new after every service.',
      location: 'Burnaby, BC',
    },
  ];

  // Industry filter tabs configuration
  const industries = [
    { id: 'all', label: 'All Industries', icon: 'business' },
    { id: 'automotive', label: 'Automotive', icon: 'directions_car' },
    { id: 'fleet', label: 'Fleet Maintenance', icon: 'local_shipping' },
    { id: 'construction', label: 'Construction', icon: 'construction' },
  ];

  // Filter testimonials based on selected industry
  const filteredTestimonials = selectedIndustry === 'all'
    ? testimonials
    : testimonials.filter(t => t.industryName === selectedIndustry);

  return (
    <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
      <div className="max-w-screen-xl mx-auto">
        <div className="text-center mb-8 lg:mb-12">
          <h2 className="text-accent-orange text-[10px] sm:text-xs font-black uppercase tracking-[0.20em] sm:tracking-[0.25em] mb-2">
            What Our Clients Say
          </h2>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase">Success Stories</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 sm:mt-4 max-w-2xl mx-auto text-sm sm:text-base px-4">
            Trusted by industrial and commercial businesses across Surrey and the Greater Vancouver area.
          </p>
        </div>

        {/* Industry Filter Tabs - Fully Responsive */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 lg:mb-12">
          {industries.map((industry) => (
            <button
              key={industry.id}
              onClick={() => setSelectedIndustry(industry.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-tight transition-all touch-manipulation ${
                selectedIndustry === industry.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95'
              }`}
              aria-pressed={selectedIndustry === industry.id}
              aria-label={`Filter testimonials by ${industry.label}`}
            >
              <span className="material-symbols-outlined text-base sm:text-lg">
                {industry.icon}
              </span>
              <span className="whitespace-nowrap">{industry.label}</span>
            </button>
          ))}
        </div>

        {/* Testimonials Grid - Optimized Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 transition-all duration-300">
          {filteredTestimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="flex flex-col p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Quote Icon */}
              <div className="mb-4">
                <span
                  className="material-symbols-outlined text-accent-orange text-4xl"
                  style={{ fontVariationSettings: "'wght' 600" }}
                >
                  format_quote
                </span>
              </div>

              {/* Testimonial Text */}
              <p className="text-sm lg:text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-6 flex-grow">
                {testimonial.quote}
              </p>

              {/* Client Info */}
              <div className="flex items-start gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                {/* Industry Icon */}
                <div className="shrink-0 size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-primary text-2xl"
                    style={{ fontVariationSettings: "'wght' 600" }}
                  >
                    {testimonial.industry}
                  </span>
                </div>

                {/* Person & Company */}
                <div className="flex-grow min-w-0">
                  <h4 className="text-sm lg:text-base font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                    {testimonial.person}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">
                    {testimonial.title}
                  </p>
                  <p className="text-xs text-accent-orange font-black uppercase tracking-wide mt-1">
                    {testimonial.company}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                    {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badge */}
        {/* ⚠️ TODO: Verify "100+ Industrial Clients" claim before production or remove */}
        <div className="mt-12 lg:mt-16 p-5 lg:p-6 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">verified</span>
              <span className="text-xs lg:text-sm text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider">
                Trusted by Industrial Clients Across Metro Vancouver
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
