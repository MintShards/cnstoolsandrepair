import { Link } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';

export default function Footer() {
  const { settings, loading } = useSettings();

  // Loading skeleton
  if (loading || !settings) {
    return (
      <footer role="contentinfo" className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-24 lg:pb-0">
        <div className="max-w-screen-xl mx-auto px-6 py-12">
          {/* Main Footer Grid Skeleton - 4 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-8">

            {/* Column 1: Logo & Social Skeleton */}
            <div>
              {/* Logo Skeleton */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
              </div>
              {/* Description Skeleton */}
              <div className="space-y-2 mb-4">
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
              </div>
              {/* Social Icons Skeleton */}
              <div className="flex gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse"
                  />
                ))}
              </div>
            </div>

            {/* Column 2: Services Skeleton */}
            <div>
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded mb-4 animate-pulse"></div>
              <ul className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <li key={i}>
                    <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Quick Links Skeleton */}
            <div>
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-4 animate-pulse"></div>
              <ul className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <li key={i}>
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Contact Us Skeleton */}
            <div>
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-4 animate-pulse"></div>
              <ul className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0 mt-0.5"></div>
                    <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Bar Skeleton - Copyright & Legal */}
          <div className="pt-8 pb-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
            <div className="h-4 w-72 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse"></div>
            <div className="flex justify-center gap-4">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
              <div className="h-3 w-px bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
              <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
              <div className="h-3 w-px bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
              <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  const getSocialIcon = (icon) => {
    const iconMap = {
      linkedin: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
      facebook: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      instagram: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
        </svg>
      ),
      whatsapp: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      ),
      twitter: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      youtube: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      tiktok: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      ),
      google: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 30" aria-hidden="true">
          {/* Google G */}
          <path d="M22.56 9.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path d="M12 20c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 17.53 7.7 20 12 20z"/>
          <path d="M5.84 11.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V4.07H2.18C1.43 5.55 1 7.22 1 9s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path d="M12 2.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45-.09 14.97-1 12-1 7.7-1 3.99 1.47 2.18 5.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          {/* 5 Stars */}
          <path d="M3.5 24l.5 1.5h1.5l-1.2.9.5 1.5-1.3-.9-1.3.9.5-1.5-1.2-.9H3l.5-1.5z"/>
          <path d="M7.5 24l.5 1.5H10l-1.2.9.5 1.5-1.3-.9-1.3.9.5-1.5-1.2-.9h2l.5-1.5z"/>
          <path d="M12 24l.5 1.5h2l-1.2.9.5 1.5-1.3-.9-1.3.9.5-1.5-1.2-.9h2L12 24z"/>
          <path d="M16.5 24l.5 1.5h2l-1.2.9.5 1.5-1.3-.9-1.3.9.5-1.5-1.2-.9h2l.5-1.5z"/>
          <path d="M20.5 24l.5 1.5H23l-1.2.9.5 1.5-1.3-.9-1.3.9.5-1.5-1.2-.9h2l.5-1.5z"/>
        </svg>
      ),
    };

    return iconMap[icon] || iconMap.facebook;
  };

  const SocialIcon = ({ platform, icon, url }) => (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary hover:text-white hover:scale-110 transition-all duration-300 ease-in-out focus:outline-2 focus:outline-primary focus:outline-offset-2"
      aria-label={`Visit us on ${platform}`}
    >
      {getSocialIcon(icon)}
    </a>
  );

  return (
    <footer role="contentinfo" className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-24 lg:pb-0">
      <div className="max-w-screen-xl mx-auto px-6 py-12">
        {/* Main Footer Grid - 4 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-8">

          {/* Column 1: Logo & Social */}
          <div>
            <h2 className="font-logo text-xl font-bold tracking-wide uppercase mb-3">
              <span className="text-accent-orange">CNS</span>{' '}
              <span className="text-slate-900 dark:text-white">Tools and Repair</span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Professional pneumatic and air tool repair services for industrial businesses across Metro Vancouver.
            </p>

            {/* Social Media Icons */}
            {settings?.socialMedia && settings.socialMedia.filter(s => s.url).length > 0 && (
              <div className="flex gap-3">
                {settings.socialMedia
                  .filter(s => s.url)
                  .map((social, index) => (
                    <SocialIcon
                      key={index}
                      platform={social.platform}
                      icon={social.icon}
                      url={social.url}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Column 2: Services */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
              Services
            </h3>
            <ul className="space-y-3 text-sm font-bold">
              <li>
                <Link
                  to="/services"
                  className="text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  Our Services
                </Link>
              </li>
              <li>
                <Link
                  to="/tools"
                  className="text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  Tools We Repair
                </Link>
              </li>
              <li>
                <Link
                  to="/repair-request"
                  className="text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  Submit Repair Request
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Links */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
              Quick Links
            </h3>
            <ul className="space-y-3 text-sm font-bold">
              <li>
                <Link
                  to="/"
                  className="text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/industries"
                  className="text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  Industries Served
                </Link>
              </li>
              <li>
                <Link
                  to="/gallery"
                  className="text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  Gallery
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Us */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
              Contact Us
            </h3>
            <ul className="space-y-3 text-sm font-bold">
              <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-base text-primary">schedule</span>
                <span>{settings?.hours?.weekdays || 'Monday - Friday: 9:00 AM - 4:00 PM'}</span>
              </li>
              <li>
                <a
                  href={`mailto:${settings?.contact?.email || 'contact@cnstoolsandrepair.com'}`}
                  className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  <span className="material-symbols-outlined text-base text-primary">mail</span>
                  {settings?.contact?.email || 'contact@cnstoolsandrepair.com'}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${settings?.contact?.phoneLink || '6045818930'}`}
                  className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
                >
                  <span className="material-symbols-outlined text-base text-primary">call</span>
                  {settings?.contact?.phone || '(604) 581-8930'}
                </a>
              </li>
              <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-base text-primary">location_on</span>
                <span>
                  {settings?.contact?.address?.city || 'Surrey'}, {settings?.contact?.address?.province || 'BC'}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar - Copyright & Legal */}
        <div className="pt-8 pb-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            © {new Date().getFullYear()} CNS Tools and Repair. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs sm:text-sm">
            <Link
              to="/privacy"
              className="text-slate-600 dark:text-slate-400 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
            >
              Privacy Policy
            </Link>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <Link
              to="/terms-conditions"
              className="text-slate-600 dark:text-slate-400 hover:text-primary transition-colors focus:outline-2 focus:outline-primary focus:outline-offset-2"
            >
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
