import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import ContactForm from '../components/sections/ContactForm';
import DualCTA from '../components/sections/DualCTA';
import MapLocation from '../components/sections/MapLocation';
import ServiceArea from '../components/sections/ServiceArea';
import { useSettings } from '../contexts/SettingsContext';
import { contactContentAPI } from '../services/api';

export default function Contact() {
  const { settings, loading: settingsLoading } = useSettings();
  const [contactContent, setContactContent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch contact page content
  useEffect(() => {
    const fetchContactContent = async () => {
      try {
        const data = await contactContentAPI.get();
        setContactContent(data);
      } catch (error) {
        console.error('Failed to fetch contact content:', error);
        // Use default fallback content
        setContactContent({
          hero: {
            label: 'Get In Touch',
            heading: 'Contact CNS Tool Repair',
            description: 'Have questions about pneumatic tool repair or maintenance? Contact our Surrey workshop or request a repair assessment below.'
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchContactContent();
  }, []);

  if (loading || settingsLoading || !settings || !contactContent) {
    return (
      <main className="relative min-h-screen bg-white dark:bg-slate-900">
        {/* Hero Skeleton */}
        <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-900">
          <div className="max-w-4xl mx-auto text-center">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-10 sm:h-12 w-full max-w-md bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4 animate-pulse"></div>
            <div className="h-4 w-full max-w-2xl bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="h-4 w-3/4 max-w-xl bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
          </div>
        </section>

        {/* MapLocation Skeleton */}
        <MapLocation />

        {/* ServiceArea Skeleton */}
        <ServiceArea loading={true} />

        {/* ContactForm Skeleton */}
        <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>
              <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-900 p-6 sm:p-8 lg:p-10 rounded-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
              </div>
              <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded mb-6 animate-pulse"></div>
              <div className="h-14 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            </div>
          </div>
        </section>

        {/* DualCTA Skeleton */}
        <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-900">
          <div className="max-w-screen-xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
              <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const { hero } = contactContent;

  return (
    <>
      <Helmet>
        <title>Contact CNS Tool Repair | Pneumatic Tool Repair Surrey BC | Phone & Location</title>
        <meta
          name="description"
          content="Contact CNS Tool Repair in Surrey, BC. Get in touch for industrial pneumatic tool repair services. Phone, email, and location information for Metro Vancouver's premier tool repair specialists."
        />
        <meta
          name="keywords"
          content="contact CNS Tool Repair, pneumatic tool repair contact Surrey, tool repair phone number BC, industrial tool service location, Surrey tool repair address"
        />
        <link rel="canonical" href="https://cnstoolrepair.com/contact" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://cnstoolrepair.com/contact" />
        <meta property="og:title" content="Contact CNS Tool Repair | Pneumatic Tool Repair Surrey BC | Phone & Location" />
        <meta property="og:description" content="Contact CNS Tool Repair in Surrey, BC. Phone, email, and location information for Metro Vancouver's premier tool repair specialists." />
        <meta property="og:image" content="https://cnstoolrepair.com/og-image.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://cnstoolrepair.com/contact" />
        <meta name="twitter:title" content="Contact CNS Tool Repair | Pneumatic Tool Repair Surrey BC | Phone & Location" />
        <meta name="twitter:description" content="Contact CNS Tool Repair in Surrey, BC. Phone, email, and location information for Metro Vancouver's premier tool repair specialists." />
        <meta name="twitter:image" content="https://cnstoolrepair.com/og-image.jpg" />
      </Helmet>
      <main className="relative min-h-screen bg-white dark:bg-slate-900">
      {/* Hero Section */}
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-slate-100 dark:bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">{hero.label}</h2>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">{hero.heading}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 text-base lg:text-lg">
            {hero.description}
          </p>
        </div>
      </section>

      {/* Divider for mobile */}
      <div className="h-px bg-slate-300 dark:bg-slate-700 sm:hidden"></div>

      {/* Map & Location Section */}
      <MapLocation />

      {/* Divider for mobile */}
      <div className="h-px bg-slate-300 dark:bg-slate-700 sm:hidden"></div>

      {/* Service Area Section */}
      <ServiceArea />

      {/* Divider for mobile */}
      <div className="h-px bg-slate-300 dark:bg-slate-700 sm:hidden"></div>

      {/* Contact Form */}
      <ContactForm />

      {/* Divider for mobile */}
      <div className="h-px bg-slate-300 dark:bg-slate-700 sm:hidden"></div>

      {/* Call-to-Action */}
      <DualCTA backgroundColor="bg-slate-100 dark:bg-slate-900" />
    </main>
    </>
  );
}
