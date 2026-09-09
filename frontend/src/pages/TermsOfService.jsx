import { Helmet } from 'react-helmet-async';

export default function TermsOfService() {
  const lastUpdated = 'September 8, 2026';

  return (
    <>
      <Helmet>
        <title>Terms of Service | CNS Tool Repair</title>
        <meta
          name="description"
          content="CNS Tool Repair's terms of service. Understand the terms governing our industrial tool repair services in Surrey, BC."
        />
        <link rel="canonical" href="https://cnstoolrepair.com/terms-of-service" />
        <meta property="og:title" content="Terms of Service | CNS Tool Repair" />
        <meta
          property="og:description"
          content="Terms governing CNS Tool Repair's industrial pneumatic tool repair services."
        />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      {/* Hero */}
      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto">
          <p className="text-red-700 dark:text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">
            Legal
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase text-slate-900 dark:text-white mb-4">
            Terms of Service
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 sm:px-8 lg:px-12 pb-16 sm:pb-20 lg:pb-24 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-10 text-slate-700 dark:text-slate-300 leading-relaxed">

            {/* Introduction */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                1. Agreement to Terms
              </h2>
              <p>
                These Terms of Service (“Terms”) govern your use of the CNS Tool Repair website at <strong>cnstoolrepair.com</strong> and our industrial tool repair services. By accessing our website or submitting a repair request, you agree to be bound by these Terms. If you do not agree, please do not use our website or services.
              </p>
              <p className="mt-3">
                These Terms apply to business customers and commercial clients. CNS Tool Repair primarily serves B2B industrial clients in Surrey, BC and the surrounding Lower Mainland.
              </p>
            </div>

            {/* Services */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                2. Our Services
              </h2>
              <p className="mb-3">
                CNS Tool Repair provides professional repair and maintenance services for industrial pneumatic and power tools. Our services include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Tool diagnosis and inspection</li>
                <li>Repair and parts replacement</li>
                <li>Maintenance and servicing</li>
                <li>Repair cost estimation</li>
              </ul>
              <p className="mt-3">
                Submitting a repair request through our website initiates a service inquiry only — it does not constitute a binding service agreement. A formal repair agreement is established when we provide a written quote and you authorize the repair.
              </p>
            </div>

            {/* Repair requests and estimates */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                3. Repair Requests and Estimates
              </h2>
              <p>
                Repair estimates provided via our website or by phone are based on the information you supply and are subject to change upon physical inspection of the tool. A final price will be confirmed before any repair work begins. We will not proceed with repairs without your explicit authorization, and any additional work beyond the approved quote requires your further approval.
              </p>
              <p className="mt-3">
                <strong className="text-slate-900 dark:text-white">Cancellation:</strong> you may cancel an approved repair at any time before the work is complete, at no charge.
              </p>
              <p className="mt-3">
                A diagnostic or inspection fee may apply to all tools submitted for evaluation. This fee may be waived if the customer approves and proceeds with the repair.
              </p>
              <p className="mt-3">
                You are responsible for ensuring that the information provided in your repair request — including tool type, brand, model, and problem description — is accurate and complete. Inaccurate information may result in delays or a revised estimate.
              </p>
              <p className="mt-3">
                Repair timelines are estimates only and may vary depending on parts availability, workload, and complexity of the repair. CNS Tool Repair is not liable for delays beyond its reasonable control.
              </p>
              <p className="mt-3">
                <strong className="text-slate-900 dark:text-white">If you choose not to proceed with a repair</strong>, your tool will be returned in its current condition at the time of that decision. If disassembly was required to perform the diagnosis, the tool will be returned in its disassembled state and may not be safe or functional to use. CNS Tool Repair is not responsible for the condition of tools returned following a declined repair. As an alternative, you may request that we dispose of or scrap the tool at our facility at no additional cost.
              </p>
            </div>

            {/* Photo uploads */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                4. Photo Uploads
              </h2>
              <p>
                You may upload photos of your tools when submitting a repair request. By uploading photos, you confirm that:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-2">
                <li>You own or have the right to share the images</li>
                <li>The images do not contain sensitive, confidential, or proprietary information beyond what is necessary to describe the repair issue</li>
                <li>You grant CNS Tool Repair permission to use the images solely for the purpose of assessing and fulfilling your service request</li>
              </ul>
              <p className="mt-3">
                Uploaded photos are stored securely and are not used for marketing or shared publicly without your consent.
              </p>
            </div>

            {/* Liability */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                5. Liability and Limitation
              </h2>
              <p>
                CNS Tool Repair will exercise reasonable care and skill in servicing your tools. However, we are not liable for:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-2">
                <li>Pre-existing damage or defects not disclosed at the time of submission</li>
                <li>Tools that are beyond economical repair</li>
                <li>Consequential, indirect, or incidental losses arising from tool downtime or failure</li>
                <li>Loss of productivity, revenue, or business opportunity due to delays in repair</li>
              </ul>
              <p className="mt-3">
                In all cases, CNS Tool Repair’s total liability shall not exceed the amount paid by the customer for the specific repair service in question.
              </p>
              <p className="mt-3">
                Nothing in these Terms excludes or limits any right, warranty, or remedy that cannot be excluded or limited under the <em>Business Practices and Consumer Protection Act</em> (British Columbia), the <em>Sale of Goods Act</em> (British Columbia), or other applicable law. Where such a law applies to you, these Terms operate subject to it.
              </p>
            </div>

            {/* Warranty */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                6. Warranty
              </h2>
              <p>
                CNS Tool Repair warrants that repair work will be performed in a workmanlike manner using quality parts. Any warranty on specific repairs will be communicated to you in writing at the time of service completion. This warranty does not cover:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-2">
                <li>Damage caused by misuse, abuse, or improper operation after repair</li>
                <li>Normal wear and tear</li>
                <li>Issues unrelated to the original repair</li>
                <li>Tools deemed to be heavily worn, obsolete, or beyond economical repair, unless a warranty is explicitly stated in writing</li>
              </ul>
              <p className="mt-3">
                Replacement parts may include OEM or equivalent components. Exact brand matching is not guaranteed unless specifically requested and agreed upon in writing prior to repair.
              </p>
            </div>

            {/* Payment */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                7. Payment
              </h2>
              <p>
                Payment terms will be communicated at the time of service authorization. Tools will not be returned until payment has been received in full. Unpaid tools are subject to a repairer’s lien under the <em>Commercial Liens Act</em> (British Columbia) — see Section 8.
              </p>
            </div>

            {/* Tool Storage and Abandonment */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                8. Tool Storage and Abandonment
              </h2>
              <p>
                Customers are responsible for picking up their tools promptly after repair completion or repair refusal. Tools not picked up within 30 days of notification may be subject to storage fees. Unpaid or uncollected tools are subject to a lien under the <em>Commercial Liens Act</em> (British Columbia). Where that Act permits, CNS Tool Repair may sell or otherwise dispose of a tool to recover unpaid service, storage, and administrative costs — but only after giving written notice of the intended disposition, at least 20 days in advance, to the customer’s contact details on file and to any other party the Act requires to be notified.
              </p>
            </div>

            {/* Tools for sale */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                9. Tools for Sale
              </h2>
              <p>
                CNS Tool Repair lists selected tools and equipment for sale on this website. All listings are invitations to inquire only: submitting a product quote request does not create a contract of sale, and prices, availability, and specifications may change without notice. A quoted price is valid for the period stated in the quote itself. The terms of any sale — including price, payment, and any warranty on the tool sold — are confirmed in writing at the time of sale.
              </p>
            </div>

            {/* Website use */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                10. Website Use
              </h2>
              <p>
                You agree to use this website only for lawful purposes and in a manner that does not infringe the rights of others. You may not:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-2">
                <li>Submit false, misleading, or fraudulent information</li>
                <li>Attempt to gain unauthorized access to any part of the website</li>
                <li>Use automated means to submit requests or scrape data</li>
              </ul>
            </div>

            {/* Website Disclaimer */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                11. Website Disclaimer
              </h2>
              <p>
                This website is provided on an “as is” and “as available” basis. CNS Tool Repair makes no warranties or representations regarding the accuracy, reliability, or availability of the website. We do not guarantee uninterrupted access and are not liable for any errors, downtime, or technical issues.
              </p>
            </div>

            {/* Indemnification */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                12. Indemnification
              </h2>
              <p>
                You agree to indemnify and hold CNS Tool Repair harmless from any claims, damages, or expenses arising from your use of our website, your violation of these Terms, or your submission of inaccurate or misleading information — including misrepresentation of tool ownership or condition.
              </p>
            </div>

            {/* Intellectual property */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                13. Intellectual Property
              </h2>
              <p>
                All content on this website — including text, images, logos, and design — is the property of CNS Tool Repair or its licensors and is protected by Canadian copyright law. You may not reproduce, distribute, or use any content from this website without our written permission.
              </p>
            </div>

            {/* Governing law */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                14. Governing Law
              </h2>
              <p>
                These Terms are governed by and construed in accordance with the laws of the Province of British Columbia and the federal laws of Canada applicable therein. Any disputes arising from these Terms or our services shall be subject to the exclusive jurisdiction of the courts of British Columbia.
              </p>
            </div>

            {/* Severability */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                15. Severability
              </h2>
              <p>
                If any provision of these Terms is found to be invalid or unenforceable, that provision will be enforced to the maximum extent permitted, and the remaining provisions will continue in full force and effect.
              </p>
            </div>

            {/* Changes */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                16. Changes to These Terms
              </h2>
              <p>
                We may update these Terms from time to time. The “Last updated” date at the top of this page reflects the most recent revision. Continued use of our website after changes are posted constitutes your acceptance of the updated Terms.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-3">
                17. Contact Us
              </h2>
              <p className="mb-2">
                If you have questions about these Terms, please contact us:
              </p>
              <address className="not-italic space-y-1 text-slate-600 dark:text-slate-400">
                <p><strong className="text-slate-900 dark:text-white">CNS Tool Repair</strong></p>
                <p>Unit 65, 13335 115 Ave, Surrey, British Columbia V3R 0R8, Canada</p>
                <p>
                  Email:{' '}
                  <a href="mailto:service@cnstoolrepair.com" className="text-primary hover:underline font-bold">
                    service@cnstoolrepair.com
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
