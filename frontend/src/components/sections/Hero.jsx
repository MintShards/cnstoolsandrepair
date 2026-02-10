import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="@container">
      <div className="relative overflow-hidden">
        <div
          className="flex min-h-[580px] lg:min-h-[680px] flex-col gap-6 lg:gap-8 bg-cover bg-center bg-no-repeat items-start justify-end px-6 sm:px-8 lg:px-12 pb-16 sm:pb-20 lg:pb-24 pt-24"
          style={{
            backgroundImage: `linear-gradient(to top, rgba(15, 23, 42, 1) 15%, rgba(15, 23, 42, 0.4) 50%, rgba(15, 23, 42, 0.2) 100%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuBVY9oVlYHk3YDP8F5ZqhKSCI-d438S7Ad75AX_nQVjQG0shXjjlF6tubzdIqLsaHbfOpXOzhwmoxZ8Cn6Scjj0JJbJnSOVM8-5NBC_W4ylLgXV6Z9NzL12nd4iMChHk-p_4JZLYXzOmsHEudtY2uqg9EE3MVHZeAWOVf09g5kdMFk5oPH677r68aBDNi_JCjqyOZ9aZav4xM1f1k_u5AjSh5uUINhMprEYnMdJVh6jh9dkEPAUmOuK9qxoAFlWF-SoFGiXe4LxVpk")`,
          }}
        >
          <div className="max-w-screen-xl mx-auto w-full">
            <div className="flex flex-col gap-4 lg:gap-6 max-w-lg lg:max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-orange/20 border border-accent-orange/30 text-accent-orange text-[10px] lg:text-xs font-black uppercase tracking-widest w-fit">
                <span className="size-2 rounded-full bg-accent-orange animate-pulse"></span>
                Industrial Repair Excellence
              </div>
              <h1 className="text-white text-4xl lg:text-5xl xl:text-6xl font-black leading-tight tracking-tight uppercase">
                Restore Peak Performance To Your Tools
              </h1>
              <p className="text-slate-300 text-base lg:text-lg font-medium leading-relaxed">
                The industry leader in pneumatic equipment repair. Professional CNS diagnostics to keep your production
                lines moving.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 lg:gap-4 mt-6">
              <Link to="/quote" className="w-full sm:w-auto">
                <button className="flex items-center justify-center gap-3 rounded-xl h-14 px-8 bg-primary text-white text-base font-bold shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 active:scale-95 transition-all border border-primary/50 w-full sm:w-auto">
                  <span className="material-symbols-outlined">request_quote</span>
                  <span>Request a Quote</span>
                </button>
              </Link>
              <Link to="/services" className="w-full sm:w-auto">
                <button className="flex items-center justify-center gap-2 rounded-xl h-14 px-8 bg-white/10 backdrop-blur-md border border-white/20 text-white text-base font-bold hover:bg-white/20 active:scale-95 transition-all w-full sm:w-auto">
                  <span>Our Capabilities</span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
