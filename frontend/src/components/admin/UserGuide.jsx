import { useEffect } from 'react';

const STATUS_LIST = [
  { key: 'received',      label: 'Received',         step: 1,    color: '#64748b', bg: '#f1f5f9', desc: 'The tool has arrived at the shop. We are waiting to look at it.' },
  { key: 'diagnosed',     label: 'Diagnosed',        step: 2,    color: '#d97706', bg: '#fffbeb', desc: 'A technician has looked at the tool and found the problem.' },
  { key: 'quoted',        label: 'Quoted',           step: 3,    color: '#7c3aed', bg: '#f5f3ff', desc: 'We have prepared a repair estimate and sent it to the customer.' },
  { key: 'approved',      label: 'Approved',         step: 4,    color: '#16a34a', bg: '#f0fdf4', desc: 'The customer said yes — they want us to go ahead with the repair.' },
  { key: 'parts_pending', label: 'Parts Pending',    step: 5,    color: '#ea580c', bg: '#fff7ed', desc: 'We are waiting for parts to arrive before we can start.' },
  { key: 'in_repair',     label: 'In Repair',        step: 6,    color: '#2563eb', bg: '#eff6ff', desc: 'A technician is actively working on the tool right now.' },
  { key: 'ready',         label: 'Ready for Pickup', step: 7,    color: '#059669', bg: '#ecfdf5', desc: 'The tool is fixed and waiting for the customer to come pick it up.' },
  { key: 'invoiced',      label: 'Invoiced',         step: 8,    color: '#06b6d4', bg: '#ecfeff', desc: 'We have sent the customer a bill.' },
  { key: 'completed',     label: 'Completed',        step: null, color: '#15803d', bg: '#dcfce7', desc: 'The customer picked up their tool and paid. The job is done.' },
  { key: 'beyond_economical_repair', label: 'Beyond Economical Repair', step: null, color: '#b91c1c', bg: '#fef2f2', desc: 'The cost to repair the tool is more than the tool is worth. It does not make financial sense to fix it. Also shown as "BER".' },
  { key: 'declined',      label: 'Declined',         step: null, color: '#dc2626', bg: '#fef2f2', desc: 'The customer said no — they did not want us to do the repair.' },
  { key: 'abandoned',     label: 'Abandoned',        step: null, color: '#f43f5e', bg: '#fff1f2', desc: 'The job was stopped — the customer stopped responding or never picked up.' },
  { key: 'closed',        label: 'Closed',           step: null, color: '#94a3b8', bg: '#f8fafc', desc: 'The job is fully finished and filed away.' },
];

const TRANSITIONS = {
  received:      ['diagnosed', 'abandoned'],
  diagnosed:     ['quoted', 'beyond_economical_repair', 'received', 'abandoned'],
  quoted:        ['approved', 'declined', 'diagnosed', 'abandoned'],
  approved:      ['parts_pending', 'in_repair', 'quoted', 'abandoned'],
  beyond_economical_repair: ['closed', 'quoted', 'abandoned'],
  declined:      ['closed', 'abandoned'],
  parts_pending: ['in_repair', 'quoted', 'approved', 'abandoned'],
  in_repair:     ['ready', 'parts_pending', 'approved', 'abandoned'],
  ready:         ['invoiced', 'in_repair', 'abandoned'],
  invoiced:      ['completed', 'ready', 'abandoned'],
  completed:     ['closed'],
  abandoned:     ['closed'],
  closed:        [],
};

export default function UserGuide({ onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handlePrint = () => {
    let root = document.getElementById('print-guide-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'print-guide-root';
      document.body.appendChild(root);
    }
    const content = document.getElementById('user-guide-content');
    if (!content) return;

    const p = '#print-guide-root';
    const printStyles = `
      <style>
        ${p} { display: none; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000; background: #fff; padding: 24px; }
        ${p} * { box-sizing: border-box; }
        @media print {
          @page { margin: 15mm; size: letter; }
          ${p} { display: block !important; padding: 0; }
          ${p} h2 { font-size: 14pt; color: #000; }
          ${p} h3 { font-size: 11pt; color: #000; }
          ${p} p, ${p} li, ${p} td, ${p} span, ${p} div { color: #1e293b; }
          ${p} strong { color: #000; }
          ${p} code { color: #2563eb; background: #eff6ff; padding: 1px 4px; border-radius: 3px; font-size: 10pt; }
          ${p} table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          ${p} th { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 4px 8px; text-align: left; font-weight: 700; }
          ${p} td { border: 1px solid #e2e8f0; padding: 4px 8px; }
          ${p} .guide-section { break-before: page; }
          ${p} .guide-section:first-child { break-before: avoid; }
          ${p} .guide-no-break { break-inside: avoid; }
          ${p} .guide-no-print { display: none !important; }
          ${p} .guide-cover { text-align: center; padding: 60pt 0; }
        }
      </style>
    `;
    root.innerHTML = printStyles + content.innerHTML;

    const cleanup = () => { root.innerHTML = ''; };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(() => {
      window.removeEventListener('afterprint', cleanup);
      root.innerHTML = '';
    }, 60000);
  };

  return (
    <>
      <div className="guide-modal-backdrop fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-stretch justify-center overflow-auto">
        <div className="guide-modal-panel bg-white dark:bg-slate-950 w-full max-w-4xl mx-auto flex flex-col min-h-screen">

          {/* Sticky guide header */}
          <div className="guide-no-print sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-accent-orange text-2xl">menu_book</span>
              <div>
                <h1 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Repair Tracker User Guide</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">CNS Tool Repair — Internal Reference</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print Guide
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
                Close
              </button>
            </div>
          </div>

          {/* Guide Content */}
          <div id="user-guide-content" className="flex-1 overflow-y-auto px-8 py-8 text-slate-800 dark:text-slate-200 space-y-0">

            {/* ─── COVER ─── */}
            <div className="guide-cover guide-no-break text-center py-16 border-b-2 border-slate-200 dark:border-slate-700 mb-10">
              <div className="inline-block mb-6">
                <span className="font-logo text-4xl font-bold tracking-wide uppercase">
                  <span className="text-accent-orange">CNS</span>{' '}
                  <span className="text-slate-900 dark:text-white">Tool Repair</span>
                </span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-3">
                Repair Tracker User Guide
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-base mb-8">
                A complete guide for anyone who manages repair jobs — no experience needed
              </p>
              <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-2 rounded-lg text-sm font-bold">
                <span className="material-symbols-outlined text-base">lock</span>
                Internal Use Only — Not Customer Facing
              </div>
            </div>

            {/* ─── TABLE OF CONTENTS ─── */}
            <div className="guide-no-break mb-10 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Table of Contents</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                {[
                  ['1', 'Getting Started'],
                  ['2', 'Website Content Management'],
                  ['3', 'Repair Tracker Overview'],
                  ['4', 'Customers'],
                  ['5', 'Repair Requests'],
                  ['6', 'Repair Jobs — Core Workflow'],
                  ['7', 'Parts Library'],
                  ['8', 'Common Workflows'],
                  ['9', 'Quick Reference'],
                  ['10', 'Zoho Books — Quotes & Invoices'],
                  ['11', 'How To — Step-by-Step'],
                  ['12', 'Glossary'],
                ].map(([num, title]) => (
                  <div key={num} className="flex items-center gap-2 py-1">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full text-xs font-black flex items-center justify-center flex-shrink-0">{num}</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── SECTION 1: GETTING STARTED ─── */}
            <div className="guide-section pt-2">
              <SectionHeader num="1" title="Getting Started" icon="rocket_launch" />

              <SubSection title="What This System Does">
                <p>The CNS Tool Repair admin system has two main areas:</p>
                <ul className="mt-2 space-y-1.5">
                  <li><strong>Website CMS</strong> (<code>/admin/settings</code>) — Edit all the words and pictures that appear on the public website: the homepage, services list, industry pages, photo gallery, about page, and contact information.</li>
                  <li><strong>Repair Tracker</strong> (<code>/admin/repair-tracker</code>) — Manage repair jobs, customers, incoming repair requests, and the parts library. This is where day-to-day work happens.</li>
                </ul>
                <p className="mt-3 text-slate-500 dark:text-slate-400 italic">Don&apos;t worry — this looks like a lot, but you only need to learn the steps that apply to your daily work. Most people only use the Repair Tracker.</p>
              </SubSection>

              <SubSection title="Accessing the Admin Panel">
                <InfoBox icon="info" color="blue">
                  There are no public links to the admin area. You must type the address directly into your browser. Bookmark it after your first login so you can find it again easily.
                </InfoBox>
                <div className="mt-3 space-y-2">
                  <UrlRow label="Login Page" url="/admin/login" />
                  <UrlRow label="Website CMS" url="/admin/settings" />
                  <UrlRow label="Repair Tracker" url="/admin/repair-tracker" />
                </div>
              </SubSection>

              <SubSection title="Logging In">
                <p>Go to <code>/admin/login</code> and type your admin email address and password. Click the blue <strong>Sign In</strong> button. Your login lasts <strong>8 hours</strong>. After 8 hours, you will be automatically signed out.</p>
                <InfoBox icon="warning" color="amber" className="mt-3">
                  If you are suddenly taken back to the login page, your session has expired. Just sign in again — your work may need to be re-entered.
                </InfoBox>
              </SubSection>

              <SubSection title="Logging Out">
                <p>Click the <strong>red Logout button</strong> (<span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm align-middle">logout</span> logout icon</span>) in the top-right corner of any admin page. This signs you out right away.</p>
              </SubSection>
            </div>

            {/* ─── SECTION 2: WEBSITE CMS ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="2" title="Website Content Management" icon="web" />
              <p className="mb-4 text-slate-600 dark:text-slate-400">Go to <code>/admin/settings</code>. On the left side you will see a list of 7 sections. Click a section name to switch to it.</p>

              <InfoBox icon="warning" color="amber" className="mb-6">
                Any change you save here appears on the live public website <strong>right away</strong>. There is no preview. Double-check your work before clicking Save.
              </InfoBox>

              <div className="space-y-3">
                {[
                  { tab: 'Home', icon: 'home', desc: 'Change the main headline, the text below it, the statistics (e.g. "500+ repairs"), customer reviews, and the "Get a Quote" call-to-action block.' },
                  { tab: 'Services', icon: 'build', desc: 'Add, edit, or remove services. You can drag services up and down to change the order they appear on the website.' },
                  { tab: 'Industries', icon: 'factory', desc: 'Manage the industry cards (Automotive, Fleet, etc.) — each card has a title, description, and a list of tools.' },
                  { tab: 'Gallery', icon: 'photo_library', desc: 'Upload shop photos. Drag to change the order. Click the trash icon to remove a photo.' },
                  { tab: 'About', icon: 'groups', desc: 'Edit the company story and manage team member profiles (name, job title, and photo).' },
                  { tab: 'Contact', icon: 'contact_phone', desc: 'Edit business hours, phone number, email, address, and the map that shows your location.' },
                  { tab: 'Global Settings', icon: 'settings', desc: 'Business name, phone, email, address, and social media links. These are used across the whole website.' },
                ].map(({ tab, icon, desc }) => (
                  <div key={tab} className="guide-no-break flex gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="material-symbols-outlined text-accent-orange text-xl mt-0.5 flex-shrink-0">{icon}</span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{tab} Tab</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── SECTION 3: REPAIR TRACKER OVERVIEW ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="3" title="Repair Tracker Overview" icon="build_circle" />
              <p className="mb-4 text-slate-600 dark:text-slate-400">Go to <code>/admin/repair-tracker</code>. This is your main workspace for daily operations. At the top you will see 5 tabs — click any tab to switch to it:</p>

              <div className="space-y-3 mb-6">
                {[
                  { tab: 'Dashboard', icon: 'dashboard', desc: 'A quick summary of everything happening right now: how many active jobs, how many need attention, how many are overdue, and how many were completed today. Also shows each technician\'s current workload. Clicking a summary card filters the Repair Jobs tab automatically. Updates every 60 seconds.' },
                  { tab: 'Repair Jobs', icon: 'build_circle', desc: 'The main tab you will use every day. Create new jobs, update existing ones, change statuses, and print work orders for customers.' },
                  { tab: 'Repair Requests', icon: 'inbox', desc: 'When a customer fills in the repair form on the website, their submission lands here. Review it and turn it into an official job with one click.' },
                  { tab: 'Customers', icon: 'group', desc: 'A list of all customers. Search for someone, view their past jobs, or add a new customer.' },
                  { tab: 'Parts Library', icon: 'inventory_2', desc: 'Your internal catalog of parts, organized by tool brand and model. Used to quickly fill in part details when adding parts to a repair job.' },
                ].map(({ tab, icon, desc }) => (
                  <div key={tab} className="guide-no-break flex gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="material-symbols-outlined text-primary text-xl mt-0.5 flex-shrink-0">{icon}</span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{tab}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── SECTION 4: CUSTOMERS ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="4" title="Customers" icon="group" />

              <SubSection title="Finding a Customer">
                <p>Click the <strong>Customers</strong> tab. You will see a list of all customers. Type a name, company, email, or phone number into the search box at the top — the list will filter as you type. Use the page numbers at the bottom to see more customers if the list is long.</p>
              </SubSection>

              <SubSection title="Adding a New Customer">
                <p>Click the orange <strong>New Customer</strong> button (<span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm align-middle">person_add</span> person add icon</span>). A pop-up window will appear. Fill in the required fields:</p>
                <table className="guide-no-break w-full text-sm mt-3 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="text-left p-2 border border-slate-200 dark:border-slate-700 font-bold">Field</th>
                      <th className="text-left p-2 border border-slate-200 dark:border-slate-700 font-bold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['First Name', 'Required'],
                      ['Last Name', 'Required'],
                      ['Email', 'Required — used for job updates'],
                      ['Phone', 'Format: 604-555-1234'],
                      ['Company Name', 'Optional — for business customers'],
                      ['Address', 'Optional'],
                      ['Customer Notes', 'Internal notes only — the customer never sees these'],
                    ].map(([field, note]) => (
                      <tr key={field} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-medium">{field}</td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400"><strong>What you will see:</strong> After clicking Save, the pop-up window closes and the new customer appears in the list.</p>
              </SubSection>

              <SubSection title="Viewing a Customer's Repair History">
                <p>Click on any customer row to open their profile. You will see all their past and current repair jobs, with the current status and total cost for each job. Click <strong>New Job</strong> directly from this screen to start a job — it will automatically fill in the customer&apos;s information for you.</p>
              </SubSection>
            </div>

            {/* ─── SECTION 5: REPAIR REQUESTS ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="5" title="Repair Requests" icon="inbox" />

              <SubSection title="What Are Repair Requests?">
                <p>When a customer fills out the <strong>Repair Request form</strong> on the public website (<code>/repair-request</code>), their message appears here. Each request includes their name, contact details, a description of the problem, and any photos they uploaded.</p>
              </SubSection>

              <SubSection title="Reviewing a Request">
                <p>Click on a request to open it and read the details. You can filter requests using the buttons at the top:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><strong>Pending</strong> — New requests that no one has looked at yet</li>
                  <li><strong>Reviewed</strong> — Requests that have been read but not yet turned into a job</li>
                  <li><strong>Converted</strong> — Requests that have already been turned into a repair job</li>
                </ul>
              </SubSection>

              <SubSection title="Turning a Request into a Repair Job">
                <p>Click the <strong>Convert to Job</strong> button (green button at the bottom of the request). A new repair job will be created automatically, with the customer&apos;s information and tool details already filled in.</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400"><strong>What you will see:</strong> The request status changes to &quot;Converted&quot; and a link to the new job appears.</p>
                <InfoBox icon="tips_and_updates" color="green" className="mt-3">
                  The original request is never deleted. You can always go back to see what the customer originally wrote.
                </InfoBox>
              </SubSection>
            </div>

            {/* ─── SECTION 6: REPAIR JOBS ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="6" title="Repair Jobs — Core Workflow" icon="build_circle" />

              <SubSection title="Creating a New Job">
                <p>Click the orange <strong>+ New Job</strong> button at the top of the Repair Jobs tab. Fill in:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><strong>Source</strong> — How the job came in: click the list that opens and choose Drop-off, Online Request, Phone-in, or Email</li>
                  <li><strong>Customer</strong> — Start typing the customer&apos;s name or company name — suggestions will appear as you type. Select the right customer. If they are new, click &quot;Create new customer&quot; right there.</li>
                  <li><strong>Tools</strong> — Click <strong>Add Tool</strong> to add each tool. A single job can have multiple tools (e.g., a customer brings in 3 drills at once).</li>
                </ul>
                <InfoBox icon="info" color="blue" className="mt-3">
                  Each tool in a job tracks its own status, technician, parts, and remarks independently. They do not need to be at the same stage.
                </InfoBox>
              </SubSection>

              <SubSection title="The 13-Status Job Lifecycle">
                <p className="mb-4">Every repair job moves through a series of steps called statuses. There are 8 main steps in order, plus 4 end states for jobs that are finished or stopped early:</p>

                {/* Linear flow */}
                <div className="guide-no-break">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Main Steps (in order)</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {STATUS_LIST.filter(s => s.step !== null).map((s, i, arr) => (
                      <div key={s.key} className="flex items-center gap-1">
                        <span
                          className="px-3 py-1.5 rounded-full text-xs font-bold border"
                          style={{ backgroundColor: s.bg, color: s.color, borderColor: s.color + '60' }}
                        >
                          {s.step}. {s.label}
                        </span>
                        {i < arr.length - 1 && <span className="text-slate-400 text-lg">→</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">End States (job is finished or stopped)</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {STATUS_LIST.filter(s => s.step === null).map(s => (
                      <span
                        key={s.key}
                        className="px-3 py-1.5 rounded-full text-xs font-bold border"
                        style={{ backgroundColor: s.bg, color: s.color, borderColor: s.color + '60' }}
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status descriptions table */}
                <table className="guide-no-break w-full text-sm border-collapse mt-2">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="text-left p-2 border border-slate-200 dark:border-slate-700">Status</th>
                      <th className="text-left p-2 border border-slate-200 dark:border-slate-700">What it means</th>
                      <th className="text-left p-2 border border-slate-200 dark:border-slate-700">Can move to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STATUS_LIST.map(s => (
                      <tr key={s.key} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="p-2 border border-slate-200 dark:border-slate-700">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
                            style={{ backgroundColor: s.bg, color: s.color }}>
                            {s.label}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs">{s.desc}</td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-500">
                          {TRANSITIONS[s.key].length > 0
                            ? TRANSITIONS[s.key].join(', ').replace(/_/g, ' ')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SubSection>

              <SubSection title="Priority Levels">
                <div className="guide-no-break grid grid-cols-3 gap-3 mt-2">
                  {[
                    { label: 'Standard', color: '#64748b', bg: '#f1f5f9', desc: 'Normal speed. This is the default for all new jobs.' },
                    { label: 'Rush', color: '#ea580c', bg: '#fff7ed', desc: 'Faster service. Target: 2–3 days.' },
                    { label: 'Urgent', color: '#dc2626', bg: '#fef2f2', desc: 'As fast as possible. Same-day or next-day.' },
                  ].map(p => (
                    <div key={p.label} className="p-3 rounded-xl border text-center" style={{ backgroundColor: p.bg, borderColor: p.color + '40' }}>
                      <p className="font-black text-sm mb-1" style={{ color: p.color }}>{p.label}</p>
                      <p className="text-xs text-slate-600">{p.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">If a job has multiple tools with different priorities, the job card shows the highest priority.</p>
              </SubSection>

              <SubSection title="Managing Parts on a Tool">
                <p className="mb-3">Each tool in a job has its own parts list. Click <strong>Add Part</strong> to add a part. Start typing a part name or number — suggestions from the Parts Library will appear as you type. Clicking a suggestion fills in the part number, price, and supplier automatically.</p>
                <table className="guide-no-break w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="text-left p-2 border border-slate-200 dark:border-slate-700">Field</th>
                      <th className="text-left p-2 border border-slate-200 dark:border-slate-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Part Name', 'Required — type to search the Parts Library'],
                      ['Part #', 'Part number / SKU from the manufacturer'],
                      ['Qty', 'How many of this part you need'],
                      ['Price', 'Cost per part for this job'],
                      ['Supplier', 'Which company you are ordering it from'],
                      ['Status', 'Pending → Ordered → Received → Installed'],
                      ['Tracking', 'The tracking number from the shipping company'],
                      ['ETA', 'The date you expect the part to arrive'],
                    ].map(([field, note]) => (
                      <tr key={field} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-medium text-xs">{field}</td>
                        <td className="p-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs">{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SubSection>

              <SubSection title="Assigning a Technician and Marking Warranty">
                <p>Each tool in a job can be assigned to a specific technician. Click the <strong>Technician</strong> field and choose a name from the list that opens. The Dashboard shows how many jobs each technician currently has, so you can see who has room for more work.</p>
                <p className="mt-2">If the repair is covered under warranty, check the <strong>Warranty</strong> checkbox on the tool. Warranty jobs show a special label on their card so you can spot them quickly.</p>
              </SubSection>

              <SubSection title="Searching and Filtering Jobs">
                <p>The Repair Jobs tab has several ways to narrow down the list:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><strong>Status filter</strong> — Click to show only jobs with a particular status (e.g., only jobs that are &quot;In Repair&quot;)</li>
                  <li><strong>Priority filter</strong> — Show only Rush or Urgent jobs</li>
                  <li><strong>Technician filter</strong> — Show only jobs assigned to one person</li>
                  <li><strong>Search box</strong> — Type a customer name, company, request number, or tool brand/model</li>
                  <li><strong>Sort</strong> — Change the order the jobs are listed</li>
                </ul>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The list shows a limited number of jobs at a time. Use the page numbers at the bottom to see the next group.</p>
              </SubSection>

              <SubSection title="Changing Many Jobs at Once">
                <p>Check the checkbox on two or more job cards. A toolbar appears at the top with a <strong>Change Status</strong> option. Choose the new status and click <strong>Apply</strong> — all selected jobs will be updated at once. This is useful after a morning inspection session when you want to mark several jobs as Diagnosed at the same time.</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400"><strong>What you will see:</strong> A green confirmation message appears at the bottom of the screen, and all selected job cards update to the new status.</p>
              </SubSection>

              <SubSection title="Printing Work Orders">
                <p>Click the <strong>print icon</strong> (<span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm align-middle">print</span> printer icon</span>) on any job card to print a work order. The work order includes:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>Shop name, address, and contact info</li>
                  <li>Job number and date</li>
                  <li>Customer information</li>
                  <li>All tools with brand, model, serial number, priority, and remarks</li>
                  <li>Parts list with quantities, prices, and current status</li>
                  <li>A signature line for the customer</li>
                </ul>
                <InfoBox icon="devices" color="blue" className="mt-3">
                  <strong>Desktop computer:</strong> Your browser&apos;s print window opens right away.<br />
                  <strong>Phone or tablet:</strong> The work order opens in a new browser window — use your device&apos;s share or print option.
                </InfoBox>
              </SubSection>
            </div>

            {/* ─── SECTION 7: PARTS LIBRARY ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="7" title="Parts Library" icon="inventory_2" />

              <SubSection title="How It Is Organized">
                <p>The Parts Library is organized in three levels — like folders inside folders:</p>
                <div className="guide-no-break mt-3 flex items-center gap-3 text-sm font-bold">
                  <span className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-xl">Brands</span>
                  <span className="text-slate-400 text-lg">→</span>
                  <span className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-xl">Models</span>
                  <span className="text-slate-400 text-lg">→</span>
                  <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-xl">Parts</span>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Click a brand name to see its models. Click a model name to see its parts. Use the breadcrumb trail at the top (e.g., &quot;Brands &gt; DeWalt &gt; DW887&quot;) to go back up a level.</p>
              </SubSection>

              <SubSection title="Adding a Brand">
                <p>Click <strong>Add Brand</strong> (button at the top right). Type the brand name and click Save. Brands are listed in alphabetical order.</p>
              </SubSection>

              <SubSection title="Adding a Model">
                <p>Click into a brand first. Then click <strong>Add Model</strong>. Type the model name, choose a category (type of tool), and click Save. You can also upload <strong>parts diagrams</strong> to a model — these are images or PDF files that show how the tool comes apart, which technicians use when ordering parts.</p>
              </SubSection>

              <SubSection title="Adding a Part">
                <p>Click into a model. Then click <strong>Add Part</strong>. Fill in:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><strong>Part Name</strong> — A clear description (e.g., &quot;Drive Bearing&quot;)</li>
                  <li><strong>Part Number</strong> — The number the manufacturer uses (their SKU)</li>
                  <li><strong>Price</strong> — The standard cost for this part</li>
                  <li><strong>Suppliers</strong> — Which companies sell this part</li>
                  <li><strong>Notes</strong> — Any internal notes for technicians</li>
                </ul>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400"><strong>What you will see:</strong> After saving, the part appears in the model&apos;s parts list and becomes searchable from repair jobs.</p>
              </SubSection>

              <SubSection title="Compatibility Groups">
                <p>Sometimes the same part fits tools from different brands — it is interchangeable. A <strong>Compatibility Group</strong> lets you link these parts together so that when a technician searches for a part in a repair job, they also see matching parts from other brands.</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Example: A bearing that fits both a Snap-on and an Ingersoll Rand model can be put in the same group. When either model is being repaired, both parts show up as options.</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">To create a group: go to the <strong>Compatibility Groups</strong> tab in Parts Library, click <strong>New Group</strong>, give it a name, and add the interchangeable parts.</p>
              </SubSection>

              <SubSection title="How the Parts Library Connects to Repair Jobs">
                <p>When you add a part to a repair job, start typing the part name or number. The system will search the Parts Library and show matching suggestions as you type. Click a suggestion — the part number, price, and supplier fill in automatically. You do not have to type them yourself.</p>
                <InfoBox icon="tips_and_updates" color="green" className="mt-2">
                  The &quot;Suggested Parts&quot; section also shows parts that are commonly used for that tool&apos;s brand and model — so you may not need to type anything at all.
                </InfoBox>
              </SubSection>
            </div>

            {/* ─── SECTION 8: COMMON WORKFLOWS ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="8" title="Common Workflows" icon="checklist" />

              <SubSection title="Workflow A: Customer Drops Off a Tool">
                <ol className="space-y-2 text-sm">
                  {[
                    'Go to the Customers tab. Search for the customer. If they are new, click New Customer and fill in their name, email, and phone.',
                    'Click New Job (you can do this from the customer\'s profile, or from the Repair Jobs tab).',
                    'Set Source to "Drop-off". Confirm the customer\'s information looks correct.',
                    'Click Add Tool. Fill in: Tool Type, Brand, Model Number. Add Serial Number, Priority, and any notes in the Remarks field.',
                    'Click Save. The job is created with status set to Received automatically.',
                    'After you inspect the tool: open the job, change the status to Diagnosed. Add a note in Remarks describing what you found.',
                    'Prepare a quote: change status to Quoted. Note the estimated cost in Remarks.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 bg-primary text-white rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="my-4 flex gap-3 p-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl">
                  <span className="material-symbols-outlined text-violet-600 dark:text-violet-400 text-xl flex-shrink-0 mt-0.5">open_in_new</span>
                  <div className="text-sm">
                    <p className="font-bold text-violet-800 dark:text-violet-300 mb-1">Switch to Zoho Books now — Send the Quote</p>
                    <p className="text-violet-700 dark:text-violet-400">Open Zoho Books in another browser tab. If this is a new customer, create them in Zoho Books too. Then create a new Quote, add the tools and parts with their prices, and send it to the customer by email. See <strong>Section 10</strong> for step-by-step instructions.</p>
                  </div>
                </div>

                <ol className="space-y-2 text-sm" start={8}>
                  {[
                    'Customer approves the quote: in Zoho Books, mark the quote as Accepted. Back in the Repair Tracker, change the job status to Approved.',
                    'If you need to order parts: change status to Parts Pending. Add the part to the parts list and enter the order details.',
                    'Start the repair: change status to In Repair.',
                    'Repair is done: change status to Ready for Pickup. Contact the customer to let them know.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 bg-primary text-white rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 8}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="my-4 flex gap-3 p-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl">
                  <span className="material-symbols-outlined text-violet-600 dark:text-violet-400 text-xl flex-shrink-0 mt-0.5">open_in_new</span>
                  <div className="text-sm">
                    <p className="font-bold text-violet-800 dark:text-violet-300 mb-1">Switch to Zoho Books now — Send the Invoice</p>
                    <p className="text-violet-700 dark:text-violet-400">Open Zoho Books. Convert the approved quote into an Invoice and send it to the customer. Once payment is received, mark the invoice as Paid in Zoho Books. See <strong>Section 10</strong> for step-by-step instructions.</p>
                  </div>
                </div>

                <ol className="space-y-2 text-sm" start={12}>
                  {[
                    'Change the job status to Invoiced in the Repair Tracker.',
                    'Customer picks up their tools and pays: change the status to Completed, then Closed.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 bg-primary text-white rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 12}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
              </SubSection>

              <SubSection title="Workflow B: Customer Submits an Online Request">
                <ol className="space-y-2 text-sm">
                  {[
                    'Go to the Repair Requests tab. New submissions appear here with a yellow "Pending" label.',
                    'Click on the request to read the customer\'s description and see any photos they uploaded.',
                    'Click Convert to Job (green button). A new repair job is created automatically with the customer\'s information already filled in.',
                    'Continue from Step 6 of Workflow A (Diagnose → Quote → etc.).',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 bg-primary text-white rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
              </SubSection>

              <SubSection title="Workflow C: Adding a Part from the Library">
                <ol className="space-y-2 text-sm">
                  {[
                    'Open the repair job and find the tool you want to add a part to.',
                    'Click Add Part (below the parts list for that tool).',
                    'In the Part Name field, start typing the part name or number.',
                    'A list of matching parts from the library appears below the field. Click the correct one.',
                    'The part number, price, and supplier fill in automatically. Change the quantity if needed.',
                    'Click Save.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 bg-primary text-white rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
              </SubSection>

              <SubSection title="Workflow D: Printing a Work Order">
                <ol className="space-y-2 text-sm">
                  {[
                    'Open the repair job.',
                    'Click the print icon (🖨) in the top-right area of the job.',
                    'Desktop: your browser\'s print window opens. Choose your printer or "Save as PDF".',
                    'Phone or tablet: the work order opens in a new window. Use your device\'s share or print option.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 bg-primary text-white rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
              </SubSection>
            </div>

            {/* ─── SECTION 9: QUICK REFERENCE ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="9" title="Quick Reference" icon="quick_reference_all" />

              <SubSection title="URL Cheat Sheet">
                <div className="space-y-2">
                  <UrlRow label="Admin Login" url="/admin/login" />
                  <UrlRow label="Website CMS" url="/admin/settings" />
                  <UrlRow label="Repair Tracker" url="/admin/repair-tracker" />
                  <UrlRow label="Public Website" url="/" />
                  <UrlRow label="Repair Request Form" url="/repair-request" />
                </div>
              </SubSection>

              <SubSection title="Status Color Guide">
                <div className="guide-no-break grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {STATUS_LIST.map(s => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full text-xs font-bold border whitespace-nowrap"
                        style={{ backgroundColor: s.bg, color: s.color, borderColor: s.color + '60' }}>
                        {s.label}
                      </span>
                      {s.step && <span className="text-xs text-slate-400">Step {s.step}</span>}
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Part Status Guide">
                <div className="guide-no-break grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {[
                    { label: 'Pending', color: '#94a3b8', bg: '#f8fafc', desc: 'Not yet ordered' },
                    { label: 'Ordered', color: '#2563eb', bg: '#eff6ff', desc: 'Order placed' },
                    { label: 'Received', color: '#d97706', bg: '#fffbeb', desc: 'Part arrived at shop' },
                    { label: 'Installed', color: '#16a34a', bg: '#f0fdf4', desc: 'Fitted to the tool' },
                  ].map(p => (
                    <div key={p.label} className="p-2 rounded-lg border text-center" style={{ backgroundColor: p.bg, borderColor: p.color + '40' }}>
                      <p className="font-bold text-xs" style={{ color: p.color }}>{p.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Helpful Tips">
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2"><span className="text-accent-orange font-black">→</span> Your login lasts <strong>8 hours</strong>. If you get signed out unexpectedly, just log in again — it is normal.</li>
                  <li className="flex gap-2"><span className="text-accent-orange font-black">→</span> Changes in Admin Settings go <strong>live on the website right away</strong>. Read it back before clicking Save.</li>
                  <li className="flex gap-2"><span className="text-accent-orange font-black">→</span> Check the <strong>Dashboard every morning</strong> — the &quot;Needs Attention&quot; and &quot;Overdue&quot; cards tell you which jobs need action today.</li>
                  <li className="flex gap-2"><span className="text-accent-orange font-black">→</span> Use <strong>Customer Notes</strong> to remember things like preferred contact method or account history — the customer never sees these notes.</li>
                  <li className="flex gap-2"><span className="text-accent-orange font-black">→</span> The more parts you add to the <strong>Parts Library</strong>, the faster it is to fill in part details on new jobs — the suggestions appear as you type.</li>
                  <li className="flex gap-2"><span className="text-accent-orange font-black">→</span> Use <strong>Change Many Jobs at Once</strong> (batch update) to move multiple jobs to the same status — great after a busy morning inspection session.</li>
                </ul>
              </SubSection>

            </div>

            {/* ─── SECTION 10: ZOHO BOOKS ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="10" title="Zoho Books — Quotes & Invoices" icon="receipt_long" />

              <InfoBox icon="info" color="blue" className="mb-6">
                <strong>Two systems work together.</strong> The Repair Tracker tracks the physical repair. Zoho Books handles the money — quotes, invoices, and payments. You need to do steps in both systems. This section tells you exactly when and what to do in Zoho Books.
              </InfoBox>

              <SubSection title="When to Use Zoho Books">
                <p>You will open Zoho Books at two key moments in every job:</p>
                <div className="mt-3 space-y-3">
                  <div className="flex gap-3 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl">
                    <span className="w-7 h-7 bg-violet-600 text-white rounded-full text-sm font-black flex items-center justify-center flex-shrink-0">1</span>
                    <div className="text-sm">
                      <p className="font-bold text-violet-800 dark:text-violet-300">After Diagnosis — Send a Quote</p>
                      <p className="text-violet-700 dark:text-violet-400 mt-0.5">Once you know what is wrong and what it will cost to fix, create a Quote in Zoho Books and email it to the customer.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl">
                    <span className="w-7 h-7 bg-violet-600 text-white rounded-full text-sm font-black flex items-center justify-center flex-shrink-0">2</span>
                    <div className="text-sm">
                      <p className="font-bold text-violet-800 dark:text-violet-300">After Repair is Ready — Send an Invoice</p>
                      <p className="text-violet-700 dark:text-violet-400 mt-0.5">Once the tool is fixed and ready for pickup, convert the quote into an Invoice in Zoho Books and send it to the customer.</p>
                    </div>
                  </div>
                </div>
              </SubSection>

              <SubSection title="Step 1 — Create the Customer in Zoho Books">
                <p>If this is a new customer, you need to add them in Zoho Books too (the two systems do not share customer records automatically).</p>
                <ol className="mt-2 space-y-1.5 text-sm">
                  {[
                    'Open Zoho Books in your browser (log in if needed).',
                    'Go to Contacts in the left menu.',
                    'Click New Contact.',
                    'Fill in the customer\'s name, company (if any), email, and phone — use the same details you entered in the Repair Tracker.',
                    'Click Save.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-5 h-5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 font-black text-xs rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
              </SubSection>

              <SubSection title="Step 2 — Create and Send a Quote">
                <p>Do this after you have diagnosed the tool and know what the repair will cost.</p>
                <ol className="mt-2 space-y-1.5 text-sm">
                  {[
                    'In Zoho Books, go to Sales → Quotes.',
                    'Click New Quote.',
                    'In the Customer Name field, search for and select the customer.',
                    'Add a line item for each tool being repaired. In the Item Name field, type a clear description (e.g., "Ingersoll Rand 2235TiMAX — Diagnose and repair impact mechanism").',
                    'Add line items for each part that will be needed. Enter the part name, quantity, and price.',
                    'Add a line for labor if applicable.',
                    'Review the total. Add any notes or terms at the bottom.',
                    'Click Save and Send (or Save first, then Send later).',
                    'The customer will receive the quote by email. They can approve or decline it.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-5 h-5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 font-black text-xs rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400"><strong>Then:</strong> Come back to the Repair Tracker and update the job status to <strong>Quoted</strong>.</p>
              </SubSection>

              <SubSection title="Step 3 — Customer Approves or Declines">
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm">
                    <p className="font-bold text-green-800 dark:text-green-300 mb-1">If the customer approves:</p>
                    <ul className="text-green-700 dark:text-green-400 space-y-1">
                      <li>In Zoho Books: open the quote and click <strong>Mark as Accepted</strong>.</li>
                      <li>In the Repair Tracker: change the job status to <strong>Approved</strong>. Then proceed with ordering parts and starting the repair.</li>
                    </ul>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm">
                    <p className="font-bold text-red-800 dark:text-red-300 mb-1">If the customer declines:</p>
                    <ul className="text-red-700 dark:text-red-400 space-y-1">
                      <li>In Zoho Books: open the quote and click <strong>Mark as Declined</strong>.</li>
                      <li>In the Repair Tracker: change the job status to <strong>Declined</strong>. Then close the job.</li>
                    </ul>
                  </div>
                </div>
              </SubSection>

              <SubSection title="Step 4 — Convert the Quote to an Invoice and Send It">
                <p>Do this after the repair is complete and the tool is ready for pickup.</p>
                <ol className="mt-2 space-y-1.5 text-sm">
                  {[
                    'In Zoho Books, go to Sales → Quotes and open the accepted quote for this job.',
                    'Click Convert to Invoice (button near the top).',
                    'Review the invoice — add or adjust any line items if the final cost changed during the repair (e.g., extra parts were needed).',
                    'Set the due date.',
                    'Click Save and Send. The customer receives the invoice by email.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-5 h-5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 font-black text-xs rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400"><strong>Then:</strong> Come back to the Repair Tracker and update the job status to <strong>Invoiced</strong>.</p>
              </SubSection>

              <SubSection title="Step 5 — Mark Invoice as Paid">
                <ol className="mt-2 space-y-1.5 text-sm">
                  {[
                    'In Zoho Books, open the invoice.',
                    'Click Record Payment when the customer pays.',
                    'Enter the amount, date, and payment method.',
                    'Click Save.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-5 h-5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 font-black text-xs rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-slate-700 dark:text-slate-300">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400"><strong>Then:</strong> Come back to the Repair Tracker and update the job status to <strong>Completed</strong>, then <strong>Closed</strong>.</p>
              </SubSection>

              <SubSection title="Summary — Which System Does What">
                <div className="guide-no-break overflow-x-auto mt-2">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <th className="text-left p-2 border border-slate-200 dark:border-slate-700">Step</th>
                        <th className="text-left p-2 border border-slate-200 dark:border-slate-700">Repair Tracker</th>
                        <th className="text-left p-2 border border-slate-200 dark:border-slate-700">Zoho Books</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Tool arrives', 'Create job → status: Received', '—'],
                        ['Inspect tool', 'Status → Diagnosed', '—'],
                        ['Prepare quote', 'Status → Quoted, note cost in Remarks', 'Create Quote, add tools/parts/labor, Send to customer'],
                        ['Customer approves', 'Status → Approved', 'Mark Quote as Accepted'],
                        ['Customer declines', 'Status → Declined → Closed', 'Mark Quote as Declined'],
                        ['Order parts', 'Status → Parts Pending, track parts', '—'],
                        ['Start repair', 'Status → In Repair', '—'],
                        ['Repair done', 'Status → Ready for Pickup', '—'],
                        ['Send invoice', 'Status → Invoiced', 'Convert Quote to Invoice, Send to customer'],
                        ['Customer pays & picks up', 'Status → Completed → Closed', 'Record Payment on invoice'],
                      ].map(([step, tracker, zoho]) => (
                        <tr key={step} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-2 border border-slate-200 dark:border-slate-700 font-medium text-xs">{step}</td>
                          <td className="p-2 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">{tracker}</td>
                          <td className="p-2 border border-slate-200 dark:border-slate-700 text-xs text-violet-700 dark:text-violet-400 font-medium">{zoho}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SubSection>
            </div>

            {/* ─── SECTION 11: HOW TO ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="11" title="How To — Step-by-Step" icon="help" />
              <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">Quick answers to the most common tasks. Each entry walks you through exactly what to click.</p>

              <div className="space-y-6">

                <HowTo title="How to Edit an Existing Repair Job">
                  {[
                    'Go to the Repair Jobs tab.',
                    'Find the job — scroll through the list, or type the customer name or job number in the search box.',
                    'Click on the job card to open it.',
                    'Click the Edit button (pencil icon ✏ at the top of the job).',
                    'Change any fields you need — customer info, source, remarks, or tool details.',
                    'Click the blue Save button.',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> A green message appears at the bottom saying the job was saved. The job card updates right away.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Change a Job's Status">
                  {[
                    'Open the repair job by clicking its card.',
                    'Find the Status field — it shows the current status as a colored label.',
                    'Click the status label. A list of allowed next statuses opens.',
                    'Click the new status you want. (You can only move to valid next steps — the system prevents mistakes.)',
                    'Click Save.',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> The colored status label on the job card changes to the new status.</span>,
                    <span key="tip" className="text-slate-500 dark:text-slate-400 italic text-xs">Tip: To change many jobs at once, see &quot;How to Change Many Jobs at Once&quot; below.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Add a New Customer">
                  {[
                    'Go to the Customers tab.',
                    'Click the New Customer button (top right area).',
                    'A pop-up window appears. Fill in First Name, Last Name, Email, and Phone.',
                    'Add Company Name, Address, or Customer Notes if you have them (all optional).',
                    'Click Save.',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> The pop-up closes and the new customer appears in the list.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Edit a Customer's Information">
                  {[
                    'Go to the Customers tab.',
                    'Search for the customer by typing their name, company, email, or phone.',
                    'Click on the customer row to open their profile.',
                    'Click the Edit button (pencil icon ✏).',
                    'Update the fields you need to change.',
                    'Click Save.',
                  ]}
                </HowTo>

                <HowTo title="How to Add a Tool to an Existing Job">
                  {[
                    'Open the repair job.',
                    'Click the Edit button (pencil icon ✏).',
                    'Scroll down to the Tools section and click Add Tool.',
                    'Fill in: Tool Type, Brand, Model Number. Add Serial Number, Priority, Technician, and Remarks if needed.',
                    'Click Save.',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> The new tool appears in the job&apos;s tool list.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Add Parts to a Tool">
                  {[
                    'Open the repair job and find the tool you want to add a part to.',
                    'Click Add Part (below that tool\'s parts list).',
                    'Start typing a part name or number in the Part Name field — a list of matching parts appears.',
                    'Click a suggestion to fill in the part number, price, and supplier automatically. Or type the details in yourself.',
                    'Set the quantity. Adjust the price if needed.',
                    'Click Save.',
                  ]}
                </HowTo>

                <HowTo title="How to Order and Track a Part">
                  {[
                    'Open the repair job → find the tool → look at the parts list.',
                    'Click the part\'s Status field and change it from Pending to Ordered.',
                    'Enter the tracking number (if you have one) and the date you expect it to arrive.',
                    'Click Save.',
                    <span key="see1" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> The part status badge changes to blue &quot;Ordered&quot;. The job status should be updated to &quot;Parts Pending&quot;.</span>,
                    'When the part arrives at the shop: change its status to Received.',
                    'After the technician installs it: change its status to Installed.',
                  ]}
                </HowTo>

                <HowTo title="How to Assign a Technician to a Tool">
                  {[
                    'Open or edit the repair job.',
                    'Find the tool you want to assign.',
                    'Click the Technician field — a list of technicians opens.',
                    'Click a name to select them.',
                    'Click Save.',
                    <span key="tip" className="text-slate-500 dark:text-slate-400 italic text-xs">Tip: Check the Dashboard → Technician section first to see who has the lightest workload.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Mark a Job as Urgent or Rush">
                  {[
                    'Open or edit the repair job.',
                    'Find the tool entry and look for the Priority field.',
                    'Click the Priority field — a list opens with Standard, Rush, and Urgent.',
                    'Click Rush (2–3 days) or Urgent (same/next day).',
                    'Click Save.',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> The job card shows an orange (Rush) or red (Urgent) badge. The Dashboard &quot;Needs Attention&quot; section highlights these jobs.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Print a Work Order">
                  {[
                    'Open the repair job.',
                    'Click the print icon (🖨 printer icon) in the top area of the job.',
                    'Desktop: your browser\'s print window opens. Choose your printer or select "Save as PDF".',
                    'Phone or tablet: the work order opens in a new window. Use your device\'s share menu to print or save.',
                  ]}
                </HowTo>

                <HowTo title="How to Change Many Jobs at Once">
                  {[
                    'Go to the Repair Jobs tab.',
                    'Check the small checkbox on two or more job cards.',
                    'A toolbar appears at the top with a "Change Status" option.',
                    'Click the status list in the toolbar and choose the new status.',
                    'Click Apply.',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> All selected job cards update to the new status. A green confirmation message appears at the bottom.</span>,
                    <span key="tip" className="text-slate-500 dark:text-slate-400 italic text-xs">Tip: Select all jobs you diagnosed this morning and move them to &quot;Quoted&quot; in one go instead of one at a time.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Turn an Online Request into a Job">
                  {[
                    'Go to the Repair Requests tab.',
                    'Find the request you want to act on (look for the yellow &quot;Pending&quot; label). Click it to open it.',
                    'Read the customer\'s description and look at any photos they uploaded.',
                    'Click Convert to Job (green button).',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> A new repair job is created with the customer&apos;s information already filled in. The request shows a &quot;Converted&quot; label and a link to the new job.</span>,
                    'Continue the job through the normal steps (Diagnose → Quote → etc.).',
                  ]}
                </HowTo>

                <HowTo title="How to Handle a Declined Quote">
                  {[
                    'Open the repair job.',
                    'Change the status to Declined.',
                    'If the customer wants to discuss a lower price: change the status back to Diagnosed, update your remarks, then re-quote.',
                    'If the job is completely finished: change the status to Closed to file it away.',
                  ]}
                </HowTo>

                <HowTo title="How to Abandon or Close a Job">
                  {[
                    'Open the repair job.',
                    'Change the status to Abandoned — use this when a customer stops responding, does not come to pick up their tool, or cancels.',
                    'Once everything is resolved, change the status to Closed to file it away.',
                    <span key="note" className="text-slate-500 dark:text-slate-400 italic text-xs">Note: Closed jobs are never deleted. They still appear in search results and in the customer&apos;s history.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Edit Website Content">
                  {[
                    'Go to /admin/settings.',
                    'Click the section name on the left side (Home, Services, Industries, etc.) that you want to change.',
                    'Make your changes in the fields.',
                    'Click Save.',
                    <span key="warn" className="font-bold text-amber-700 dark:text-amber-400 text-xs">⚠ Changes go live on the public website right away. Read your changes before saving.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Add a Photo to the Gallery">
                  {[
                    'Go to /admin/settings and click the Gallery tab on the left.',
                    'Click Upload Photo.',
                    'Choose one or more image files from your computer (JPG, PNG, or WebP).',
                    <span key="see1" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> The photos appear in the gallery grid.</span>,
                    'Drag photos left or right to change the order they appear on the website.',
                    'Click Save to publish the updated gallery.',
                  ]}
                </HowTo>

                <HowTo title="How to Add a New Part to the Parts Library">
                  {[
                    'Go to the Parts Library tab in the Repair Tracker.',
                    'If the brand does not exist yet: click Add Brand, type the name, click Save.',
                    'Click into the brand. If the model does not exist yet: click Add Model, fill in the name and category, click Save.',
                    'Click into the model.',
                    'Click Add Part. Fill in Part Name, Part Number, Price, Supplier(s), and any Notes.',
                    'Click Save.',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> The part appears in the model&apos;s list and is now searchable when adding parts to repair jobs.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Upload a Parts Diagram">
                  {[
                    'Go to Parts Library → click into the brand → click into the model.',
                    'Find the Diagrams section on the model page.',
                    'Click Upload Diagram.',
                    'Choose a PDF or image file from your computer (JPG, PNG, WebP, or PDF are all accepted).',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> The diagram is saved and appears in the model&apos;s diagram list. Technicians can view it when looking up parts for that model.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Create a Quote in Zoho Books">
                  {[
                    'Open Zoho Books in your browser.',
                    'Go to Sales → Quotes in the left menu.',
                    'Click New Quote.',
                    'Search for the customer in the Customer Name field. If they are not there yet, add them first under Contacts.',
                    'Click Add Line Item for each tool being repaired — type a clear description and the price.',
                    'Add more line items for parts and labor.',
                    'Review the total at the bottom.',
                    'Click Save and Send to email it to the customer right away. Or click Save to send it later.',
                    <span key="then" className="text-violet-700 dark:text-violet-400 text-xs font-bold">Then: go back to the Repair Tracker and change the job status to Quoted.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Convert a Zoho Books Quote to an Invoice">
                  {[
                    'Open Zoho Books and go to Sales → Quotes.',
                    'Find the quote for this job and open it.',
                    'Click Convert to Invoice (button near the top of the quote).',
                    'Review the invoice — adjust any line items if the final cost changed.',
                    'Set the due date.',
                    'Click Save and Send to email the invoice to the customer.',
                    'When the customer pays: click Record Payment, enter the amount and payment method, click Save.',
                    <span key="then" className="text-violet-700 dark:text-violet-400 text-xs font-bold">Then: go back to the Repair Tracker and change the job status to Invoiced, then Completed, then Closed.</span>,
                  ]}
                </HowTo>

                <HowTo title="How to Create a Compatibility Group">
                  {[
                    'Go to the Parts Library tab.',
                    'Click the Compatibility Groups section (usually a sub-tab or link at the top).',
                    'Click New Group. Give it a clear name that describes what is interchangeable (e.g., "3/8 Drive Bearing — Snap-on / IR").',
                    'Click Add Part to Group and search for the parts from different brands that fit the same way.',
                    'Click Save.',
                    <span key="see" className="text-green-700 dark:text-green-400 text-xs"><strong>What you will see:</strong> When a technician searches for parts in a repair job, parts from this group will appear as compatible options.</span>,
                  ]}
                </HowTo>

              </div>
            </div>

            {/* ─── SECTION 12: GLOSSARY ─── */}
            <div className="guide-section pt-10">
              <SectionHeader num="12" title="Glossary" icon="menu_book" />
              <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">Plain-English definitions of every word or term used in this guide.</p>

              <div className="space-y-3">
                {[
                  { term: 'Badge', def: 'A small colored label that appears on a job card to show its status or priority at a glance — for example, a green "Ready for Pickup" badge.' },
                  { term: 'Brand', def: 'The company that made the tool — for example, DeWalt, Ingersoll Rand, or Snap-on.' },
                  { term: 'Breadcrumb', def: 'A trail of links near the top of the page that shows where you are, like "Brands → DeWalt → DW887". Click any part to go back to that level.' },
                  { term: 'Checkbox', def: 'A small square you click to select something. A checkmark appears inside when it is selected.' },
                  { term: 'Close (status)', def: 'A job status meaning the job has been fully finished and filed away. Closed jobs are never deleted.' },
                  { term: 'Compatibility Group', def: 'A collection of parts from different brands that are interchangeable — they fit the same function on different tools.' },
                  { term: 'Convert to Job', def: 'A button in the Repair Requests tab that turns a customer\'s online submission into an official repair job.' },
                  { term: 'Customer Notes', def: 'Internal notes you write about a customer — preferred contact method, account history, etc. The customer never sees these.' },
                  { term: 'Dashboard', def: 'The first tab in the Repair Tracker. Shows a summary of what is happening right now: active jobs, jobs that need attention, and technician workloads.' },
                  { term: 'Diagram', def: 'A picture or PDF file that shows how a tool is assembled. Uploaded to a model in the Parts Library so technicians can see which parts go where.' },
                  { term: 'Drop-down list (or just "list")', def: 'A field that opens to show choices when you click it. You pick one option and the list closes.' },
                  { term: 'Filter', def: 'A way to narrow down a list so it only shows items that match what you are looking for — for example, showing only "Rush" priority jobs.' },
                  { term: 'Job', def: 'A repair job. One record in the system representing a customer\'s tool (or tools) being repaired. Has a unique job number.' },
                  { term: 'KPI', def: 'Short for "Key Performance Indicator". The four summary boxes on the Dashboard (Active Jobs, Needs Attention, Overdue, Completed Today) are KPI cards.' },
                  { term: 'Model', def: 'The specific version of a tool made by a brand — for example, "DW887" is a model made by DeWalt.' },
                  { term: 'Part', def: 'A component used during a repair — for example, a bearing, a switch, or a chuck.' },
                  { term: 'Part Number', def: 'The code the manufacturer uses to identify a specific part. Also called a SKU.' },
                  { term: 'Parts Library', def: 'The internal catalog of all parts you have entered, organized by brand and model. Used to quickly fill in part details when creating a repair job.' },
                  { term: 'Pending (repair request)', def: 'A repair request that arrived from the website and has not been reviewed yet.' },
                  { term: 'Pop-up window', def: 'A small window that appears on top of the page when you click a button like "New Customer" or "Add Part". Fill it in and click Save or Close.' },
                  { term: 'Priority', def: 'How urgent a job is: Standard (normal), Rush (2–3 days), or Urgent (same/next day).' },
                  { term: 'Remarks', def: 'A text field on a tool where technicians write notes about the problem, diagnosis, or any special instructions.' },
                  { term: 'Repair Request', def: 'A message sent by a customer through the public website form at /repair-request. Appears in the Repair Requests tab.' },
                  { term: 'Request Number', def: 'A unique ID for each repair job, in the format REQ-2026-0001. Use this number when talking to customers about their job.' },
                  { term: 'Session', def: 'The period of time you are logged in. Lasts 8 hours, then you are automatically signed out.' },
                  { term: 'SKU', def: 'A unique code used to identify a part. Same as a Part Number.' },
                  { term: 'Source', def: 'How the repair job came in: Drop-off (customer brought it in), Online Request (from the website), Phone-in (called us), or Email.' },
                  { term: 'Status', def: 'Where a repair job currently is in the process. There are 13 possible statuses, from Received to Closed.' },
                  { term: 'Suggestions', def: 'Matching options that appear below a field as you type. Click one to select it and fill in the field automatically.' },
                  { term: 'Tab', def: 'One of the clickable labels at the top of a page that switches between different sections — for example, the Dashboard tab, Repair Jobs tab, etc.' },
                  { term: 'Technician', def: 'A staff member who works on the tools. Each tool in a job can be assigned to a technician.' },
                  { term: 'Tool', def: 'The physical item being repaired — for example, an impact wrench or a drill. A single repair job can contain multiple tools.' },
                  { term: 'Warranty', def: 'A checkbox on a tool that marks the repair as covered under warranty. Warranty jobs are labeled with a special badge.' },
                  { term: 'Work Order', def: 'A printed document that summarizes a repair job — includes the customer\'s information, the tools, parts, and a signature line. Generated by clicking the print icon on a job.' },
                  { term: 'Zoho Books', def: 'A separate accounting program used to create quotes, send invoices, and record payments. The Repair Tracker handles the physical repair; Zoho Books handles the money. You need to use both systems on every job.' },
                  { term: 'Zoho Quote', def: 'A document created in Zoho Books that lists the tools, parts, and labor costs for a repair, and is emailed to the customer for approval before the work begins.' },
                  { term: 'Zoho Invoice', def: 'A bill created in Zoho Books and sent to the customer after the repair is complete. Created by converting the approved quote into an invoice.' },
                ].map(({ term, def }) => (
                  <div key={term} className="guide-no-break flex gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="font-bold text-slate-900 dark:text-white text-sm w-44 flex-shrink-0">{term}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{def}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── END OF GUIDE ─── */}
            <div className="guide-section pt-10">
              <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400 dark:text-slate-600">
                CNS Tool Repair — Admin User Guide — Internal Use Only — {new Date().getFullYear()}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

/* ── Helper Components ─────────────────────────────── */

function SectionHeader({ num, title, icon }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-orange-400">
      <span className="w-9 h-9 bg-orange-500 text-white rounded-xl font-black text-lg flex items-center justify-center flex-shrink-0">{num}</span>
      <span className="material-symbols-outlined text-orange-500 text-2xl">{icon}</span>
      <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h2>
    </div>
  );
}

function SubSection({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">{title}</h3>
      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

function InfoBox({ icon, color, children, className = '' }) {
  const colors = {
    blue:  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
  };
  return (
    <div className={`flex gap-2 p-3 rounded-xl border text-xs leading-relaxed ${colors[color]} ${className}`}>
      <span className="material-symbols-outlined text-base flex-shrink-0 mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function HowTo({ title, children }) {
  return (
    <div className="guide-no-break p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
      <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-accent-orange text-base">arrow_right</span>
        {title}
      </h3>
      <ol className="space-y-1.5 text-sm">
        {children.map((step, i) => (
          <li key={i} className="flex gap-3">
            {typeof step === 'string' ? (
              <>
                <span className="w-5 h-5 bg-primary/10 dark:bg-primary/20 text-primary font-black text-xs rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-slate-700 dark:text-slate-300">{step}</span>
              </>
            ) : (
              <span className="pl-8 text-xs">{step}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function UrlRow({ label, url }) {
  return (
    <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-36 flex-shrink-0">{label}</span>
      <code className="text-xs font-mono text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{url}</code>
    </div>
  );
}
