import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function PrivacyPolicy() {
  const lastUpdated = 'March 30, 2026';

  return (
    <>
      <Helmet>
        <title>Privacy Policy | CNS Tool Repair</title>
        <meta
          name="description"
          content="CNS Tool Repair's privacy policy. Learn how we collect, use, and protect your personal information in compliance with Canadian privacy laws (PIPEDA/PIPA BC)."
        />
        <link rel="canonical" href="https://cnstoolrepair.com/privacy-policy" />
        <meta property="og:title" content="Privacy Policy | CNS Tool Repair" />
        <meta
          property="og:description"
          content="How CNS Tool Repair collects, uses, and protects your personal information."
        />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      {/* Hero */}
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto">
          <p className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">
            Legal
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase text-slate-900 dark:text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 sm:px-8 lg:px-12 pb-16 sm:pb-20 lg:pb-24 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto prose-styles">
          <div className="space-y-10 text-slate-700 dark:text-slate-300 leading-relaxed">

            {/* Introduction */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                1. Introduction
              </h2>
              <p>
                CNS Tool Repair ("we," "our," or "us") is committed to protecting the privacy of our clients and website visitors. This Privacy Policy explains how we collect, use, disclose, and safeguard personal information in accordance with Canada's <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA) and British Columbia's <em>Personal Information Protection Act</em> (PIPA).
              </p>
              <p className="mt-3">
                By using our website at <strong>cnstoolrepair.com</strong> or submitting information through our forms, you consent to the practices described in this policy.
              </p>
            </div>

            {/* What we collect */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                2. Information We Collect
              </h2>
              <p className="mb-3">We primarily collect business contact information related to commercial service inquiries. Personal information is collected only when you voluntarily provide it through our contact or repair request forms. This may include:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Contact information:</strong> name, company name, email address, phone number</li>
                <li><strong>Service information:</strong> tool type, brand, model, quantity, and description of the problem</li>
                <li><strong>Photos:</strong> images of tools or equipment you upload with your repair request</li>
                <li><strong>Communication records:</strong> messages sent through our contact form</li>
              </ul>
              <p className="mt-3">
                We do <strong>not</strong> collect payment information through this website. We do not use tracking cookies or analytics tools. Our website uses a technical cookie solely for security purposes (CSRF protection) to prevent fraudulent form submissions — this cookie does not track your browsing activity.
              </p>
            </div>

            {/* How we use it */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                3. How We Use Your Information
              </h2>
              <p className="mb-3">We use the information you provide solely for the following purposes:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>To respond to your repair request or inquiry</li>
                <li>To prepare a service quote or diagnosis</li>
                <li>To communicate with you about your service request</li>
                <li>To maintain records of completed services</li>
              </ul>
              <p className="mt-3">
                We collect and use your personal information based on your consent, which you provide when you voluntarily submit information through our website or communicate with us directly.
              </p>
              <p className="mt-3">
                We do not use your information for marketing purposes, and we do not sell, rent, or trade your personal information to third parties.
              </p>
            </div>

            {/* Third parties */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                4. Third-Party Service Providers
              </h2>
              <p className="mb-3">
                To operate our website and deliver our services, we work with the following third-party providers. Each is bound by their own privacy policies and applicable data protection laws:
              </p>
              <ul className="list-disc pl-6 space-y-3">
                <li>
                  <strong>SendGrid (Twilio):</strong> Used to deliver email notifications when you submit a form. Your contact details are transmitted through SendGrid's servers to reach us. SendGrid is a U.S.-based service operating under Twilio's privacy policy.
                </li>
                <li>
                  <strong>MongoDB Atlas:</strong> Your submitted data is stored in a cloud database hosted by MongoDB Atlas (MongoDB, Inc.), a U.S.-based cloud provider. Data is stored on servers that may be located outside Canada but is protected by contractual data processing agreements.
                </li>
                <li>
                  <strong>Google Maps:</strong> Our website embeds a Google Maps widget to display our business location. When the map loads, Google may collect technical information such as your IP address and browser details in accordance with Google's privacy policy. We do not control Google's data collection practices.
                </li>
              </ul>
              <p className="mt-3">
                By submitting information through our website, you consent to the transfer, storage, and processing of your information outside of Canada, where privacy laws may differ from those in Canada.
              </p>
            </div>

            {/* Data retention */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                5. Data Retention
              </h2>
              <p>
                We retain your personal information for as long as necessary to fulfill the purpose for which it was collected — typically for the duration of our service relationship and a reasonable period afterward for record-keeping and legal compliance. You may request deletion of your data at any time (see Section 7).
              </p>
            </div>

            {/* Security */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                6. Security
              </h2>
              <p>
                We implement reasonable technical and organizational measures to protect your personal information from unauthorized access, use, or disclosure. These include secure cloud storage, access controls, and encrypted data transmission (HTTPS). Access to personal information is restricted to authorized personnel only. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.
              </p>
            </div>

            {/* Your rights */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                7. Your Rights
              </h2>
              <p className="mb-3">Under PIPEDA and PIPA BC, you have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Request access to the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your personal information (subject to legal retention requirements)</li>
                <li>Withdraw consent for our use of your information</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, contact us at <a href="mailto:contact@cnstoolrepair.com" className="text-primary hover:underline font-bold">contact@cnstoolrepair.com</a>. We will respond within 30 days.
              </p>
            </div>

            {/* Children */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                8. Children's Privacy
              </h2>
              <p>
                Our website and services are directed at businesses and adult professionals. We do not knowingly collect personal information from individuals under 18 years of age.
              </p>
            </div>

            {/* Changes */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                9. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. The "Last updated" date at the top of this page reflects the most recent revision. Continued use of our website after any changes constitutes your acceptance of the updated policy.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                10. Contact Us
              </h2>
              <p className="mb-2">
                If you have questions or concerns about this Privacy Policy, please contact us:
              </p>
              <address className="not-italic space-y-1 text-slate-600 dark:text-slate-400">
                <p><strong className="text-slate-900 dark:text-white">CNS Tool Repair</strong></p>
                <p>Surrey, British Columbia, Canada</p>
                <p>
                  Email:{' '}
                  <a href="mailto:contact@cnstoolrepair.com" className="text-primary hover:underline font-bold">
                    contact@cnstoolrepair.com
                  </a>
                </p>
              </address>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
