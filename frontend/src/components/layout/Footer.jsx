import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="p-8 pb-32 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center">
            <h2 className="logo-font text-xl font-extrabold tracking-tight">
              <span className="font-black text-accent-orange">CNS</span>{' '}
              <span className="text-slate-900 dark:text-white uppercase">Tools and Repair</span>
            </h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium">
            Setting the gold standard for industrial pneumatic tool maintenance. Precision, speed, and CNS reliability.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8">
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
                  Request Quote
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" to="/tools">
                  Tools We Repair
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" to="/industries">
                  Industries
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4 text-[10px] text-slate-400 font-black uppercase tracking-widest">
          <p>© 2024 CNS TOOLS AND REPAIR. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
