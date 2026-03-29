import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { homeContentAPI } from '../services/api';
import Hero from '../components/sections/Hero';
import QuickFacts from '../components/sections/QuickFacts';
import BrandsCarousel from '../components/sections/BrandsCarousel';
import HowItWorks from '../components/sections/HowItWorks';
import ToolsPreview from '../components/sections/ToolsPreview';
import IndustriesServed from '../components/sections/IndustriesServed';
import Testimonials from '../components/sections/Testimonials';
import MapLocation from '../components/sections/MapLocation';
import StickyQuoteCTA from '../components/sections/StickyQuoteCTA';
import RepairProcessIntro from '../components/sections/RepairProcessIntro';
import WhyChooseUs from '../components/sections/WhyChooseUs';
import IndustrialUseCases from '../components/sections/IndustrialUseCases';
import ServiceArea from '../components/sections/ServiceArea';
import FinalCTA from '../components/sections/FinalCTA';

export default function Home() {
  const [homeContent, setHomeContent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch home page content on mount
  useEffect(() => {
    const fetchHomeContent = async () => {
      try {
        const data = await homeContentAPI.get();
        setHomeContent(data);
      } catch (error) {
        console.error('Failed to fetch home content:', error);
        // Components will use their default fallback content
      } finally {
        setLoading(false);
      }
    };

    fetchHomeContent();
  }, []);

  // Extract SEO data (with fallback)
  const seoData = homeContent?.seo || {
    title: 'Industrial Pneumatic Tool Repair in Surrey BC | CNS Tool Repair',
    description: 'Industrial pneumatic tool repair in Surrey, BC. B2B service with professional diagnostics, OEM-compatible parts, and in-shop industrial repairs for automotive, fleet, manufacturing, construction, oil & gas, aerospace, marine, mining, and MRO sectors.',
    keywords: 'pneumatic tool repair Surrey, industrial tool repair BC, air tool repair Vancouver, fleet maintenance tools, automotive tool repair, construction pneumatic tools, oil gas tool service',
  };

  return (
    <>
      <Helmet>
        <title>{seoData.title}</title>
        <meta name="description" content={seoData.description} />
        <meta name="keywords" content={seoData.keywords} />
        <link rel="canonical" href="https://cnstoolrepair.com/" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolrepair.com/" />
        <meta property="og:title" content={seoData.title} />
        <meta property="og:description" content={seoData.description} />
        <meta property="og:image" content="https://cnstoolrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolrepair.com/" />
        <meta name="twitter:title" content={seoData.title} />
        <meta name="twitter:description" content={seoData.description} />
        <meta name="twitter:image" content="https://cnstoolrepair.com/og-image.jpg" />
      </Helmet>
      <main className="relative">
      {/* Sticky Mobile CTA - Shows after Hero scrolls out */}
      <StickyQuoteCTA />
      {/* 1. Hero - Value proposition + immediate CTA */}
      <Hero
        data={homeContent?.hero}
        loading={loading}
      />

      {/* 2. QuickFacts - Trust signals (stats) */}
      <QuickFacts
        data={homeContent?.quickFacts}
        loading={loading}
      />

      {/* 3. IndustriesServed - MOVED UP: Early audience targeting & qualification */}
      <IndustriesServed />

      {/* 3.5. How Our Repair Process Works - SEO trust signal */}
      <RepairProcessIntro
        data={homeContent?.repairProcessIntro}
        loading={loading}
      />

      {/* 4. Why Choose Us - Value differentiation (Responsive Optimized) */}
      <WhyChooseUs
        data={homeContent?.whyChooseUs}
        loading={loading}
      />

      {/* 5. Testimonials - MOVED UP: Social proof reinforcement */}
      <Testimonials data={homeContent} loading={loading} />

      {/* 6. HowItWorks - Process education */}
      <HowItWorks
        data={homeContent?.howItWorks}
        loading={loading}
      />

      {/* 6.5. Industrial Use Cases - Differentiated from Industries section */}
      <IndustrialUseCases
        data={homeContent?.industrialUseCases}
        loading={loading}
      />

      {/* 7. BrandsCarousel - MOVED DOWN: Supporting credibility */}
      <BrandsCarousel />

      {/* 8. ToolsPreview - Service catalog exploration */}
      <ToolsPreview />

      {/* 8.5. Local SEO Service Area - Geographic reach */}
      <ServiceArea
        data={homeContent?.serviceArea}
        loading={loading}
      />

      {/* 9. MapLocation - Location/accessibility info */}
      <MapLocation />

      {/* Mini Divider */}
      <div className="bg-white dark:bg-slate-900">
        <div className="h-px bg-slate-200 dark:bg-slate-800 w-full"></div>
      </div>

      {/* CTA Section - Mobile-Optimized */}
      <FinalCTA
        data={homeContent?.finalCta}
        loading={loading}
      />
    </main>
    </>
  );
}
