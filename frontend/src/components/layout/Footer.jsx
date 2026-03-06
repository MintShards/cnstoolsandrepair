import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="p-8 pb-32 lg:pb-12 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:justify-between gap-10 lg:gap-16">
          <div className="flex flex-col gap-4 lg:max-w-md">
            <div className="flex items-center">
              <h2 className="font-logo text-xl md:text-2xl font-bold tracking-wide uppercase">
                <span className="text-accent-orange">CNS</span>{' '}
                <span className="text-slate-900 dark:text-white">Tools and Repair</span>
              </h2>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium">
              Industrial pneumatic tool repair services in Surrey, British Columbia.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-8 lg:gap-12">
            <div className="flex flex-col gap-4">
              <h5 className="font-black text-xs uppercase text-slate-400 tracking-widest">Company</h5>
              <ul className="flex flex-col gap-3 text-sm font-bold uppercase tracking-tight">
                <li>
                  <Link className="hover:text-primary transition-colors" to="/">
                    Home
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-primary transition-colors" to="/services">
                    Services
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-primary transition-colors" to="/about">
                    About
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-primary transition-colors" to="/contact">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="font-black text-xs uppercase text-slate-400 tracking-widest">Service</h5>
              <ul className="flex flex-col gap-3 text-sm font-bold uppercase tracking-tight">
                <li>
                  <Link className="hover:text-primary transition-colors" to="/quote">
                    Pneumatic Tool Repair Assessment
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-primary transition-colors" to="/tools">
                    Tools We Repair
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-primary transition-colors" to="/industries">
                    Industries Served
                  </Link>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="font-black text-xs uppercase text-slate-400 tracking-widest">Contact</h5>
              <ul className="flex flex-col gap-3 text-sm font-bold">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-base text-primary shrink-0">location_on</span>
                  <div className="text-slate-600 dark:text-slate-300">
                    <p>Unit 65, 13335 115 Ave</p>
                    <p>Surrey, BC V3R 2X1</p>
                    <p>Canada</p>
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary">mail</span>
                  <a href="mailto:cnstoolsandrepair@gmail.com" className="hover:text-primary transition-colors text-slate-600 dark:text-slate-300">
                    cnstoolsandrepair@gmail.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary">schedule</span>
                  <span className="text-slate-600 dark:text-slate-300">Mon-Fri: 8AM-5PM</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="pt-8 mt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4 text-[10px] text-slate-400 font-black uppercase tracking-widest">
          <p>© 2024 CNS TOOLS AND REPAIR. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
