import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

/**
 * 404 page for unmatched routes.
 *
 * The SPA is served with a catch-all rewrite (public/_redirects), so unknown
 * URLs return HTTP 200 with the app shell rather than a real 404. The noindex
 * tag is what keeps Google from indexing those URLs as thin duplicate pages.
 */
function NotFound() {
  return (
    <>
      <Helmet>
        <title>Page Not Found | CNS Tool Repair</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <section className="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-900">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-accent-orange text-xs uppercase tracking-[0.25em] font-black mb-4">
            Error 404
          </p>
          <h1 className="text-4xl sm:text-5xl font-black uppercase text-slate-900 dark:text-white mb-6">
            Page Not Found
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mb-10">
            The page you&rsquo;re looking for doesn&rsquo;t exist or has moved. Try one of
            the links below, or get in touch and we&rsquo;ll point you in the right direction.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="bg-primary text-white font-black px-8 py-4 rounded-xl uppercase hover:bg-primary/90 transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
            >
              Back to Home
            </Link>
            <Link
              to="/repair-request"
              className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black px-8 py-4 rounded-xl uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
            >
              Request a Repair
            </Link>
          </div>

          <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm font-bold">
            <Link to="/services" className="text-primary hover:underline">Services</Link>
            <Link to="/industries" className="text-primary hover:underline">Industries</Link>
            <Link to="/gallery" className="text-primary hover:underline">Gallery</Link>
            <Link to="/about" className="text-primary hover:underline">About</Link>
            <Link to="/contact" className="text-primary hover:underline">Contact</Link>
          </nav>
        </div>
      </section>
    </>
  );
}

export default NotFound;
