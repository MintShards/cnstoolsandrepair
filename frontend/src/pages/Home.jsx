import { Helmet } from 'react-helmet-async';
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
  return (
    <>
      <Helmet>
        <title>Industrial Pneumatic Tool Repair in Surrey BC | CNS Tools</title>
        <meta
          name="description"
          content="Industrial pneumatic tool repair in Surrey, BC. B2B service with professional diagnostics, OEM-compatible parts, and in-shop industrial repairs for automotive, fleet, manufacturing, construction, oil & gas, aerospace, marine, mining, and MRO sectors."
        />
        <meta
          name="keywords"
          content="pneumatic tool repair Surrey, industrial tool repair BC, air tool repair Vancouver, fleet maintenance tools, automotive tool repair, construction pneumatic tools, oil gas tool service"
        />
        <link rel="canonical" href="https://cnstoolsandrepair.com/" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolsandrepair.com/" />
        <meta property="og:title" content="Industrial Pneumatic Tool Repair in Surrey BC | CNS Tools" />
        <meta property="og:description" content="Professional pneumatic tool repair serving automotive, fleet, manufacturing, and construction industries in Surrey and Metro Vancouver." />
        <meta property="og:image" content="https://cnstoolsandrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolsandrepair.com/" />
        <meta name="twitter:title" content="Industrial Pneumatic Tool Repair in Surrey BC | CNS Tools" />
        <meta name="twitter:description" content="Professional pneumatic tool repair serving automotive, fleet, manufacturing, and construction industries in Surrey and Metro Vancouver." />
        <meta name="twitter:image" content="https://cnstoolsandrepair.com/og-image.jpg" />
      </Helmet>
      <main className="relative">
      {/* Sticky Mobile CTA - Shows after Hero scrolls out */}
      <StickyQuoteCTA />
      {/* 1. Hero - Value proposition + immediate CTA */}
      <Hero />

      {/* 2. QuickFacts - Trust signals (stats) */}
      <QuickFacts />

      {/* 3. IndustriesServed - MOVED UP: Early audience targeting & qualification */}
      <IndustriesServed />

      {/* 3.5. How Our Repair Process Works - SEO trust signal */}
      <RepairProcessIntro />

      {/* 4. Why Choose Us - Value differentiation (Responsive Optimized) */}
      <WhyChooseUs />

      {/* 5. Testimonials - MOVED UP: Social proof reinforcement */}
      <Testimonials />

      {/* 6. HowItWorks - Process education */}
      <HowItWorks />

      {/* 6.5. Industrial Use Cases - Differentiated from Industries section */}
      <IndustrialUseCases />

      {/* 7. BrandsCarousel - MOVED DOWN: Supporting credibility */}
      <BrandsCarousel />

      {/* 8. ToolsPreview - Service catalog exploration */}
      <ToolsPreview />

      {/* 8.5. Local SEO Service Area - Geographic reach */}
      <ServiceArea />

      {/* 9. MapLocation - Location/accessibility info */}
      <MapLocation />

      {/* Mini Divider */}
      <div className="bg-white dark:bg-slate-900">
        <div className="h-px bg-slate-200 dark:bg-slate-800 w-full"></div>
      </div>

      {/* CTA Section - Mobile-Optimized */}
      <FinalCTA />
    </main>
    </>
  );
}
