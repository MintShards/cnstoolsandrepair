import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { galleryAPI } from '../services/api';
import DualCTA from '../components/sections/DualCTA';

// Constants
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Spaces URLs come through absolute; local dev filenames are served from /uploads
const resolvePhotoUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}/uploads/${url}`);

// Fisher-Yates shuffle algorithm for uniform random distribution
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Pinterest-style aspect variants: tile height scales with column width, so
// crops stay bounded on narrow mobile columns instead of showing thin slivers
const ASPECT_VARIANTS = ['aspect-[4/5]', 'aspect-square', 'aspect-[4/3]', 'aspect-[3/2]'];

const getRandomAspect = () => {
  return ASPECT_VARIANTS[Math.floor(Math.random() * ASPECT_VARIANTS.length)];
};

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const data = await galleryAPI.list();
        // Shuffle photos for random display order and assign random heights for Pinterest-style variety
        const shuffled = shuffleArray(data).map(photo => ({
          ...photo,
          randomAspect: getRandomAspect()
        }));
        setPhotos(shuffled);
      } catch (error) {
        console.error('Failed to fetch gallery photos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, []);

  const openLightbox = (photo, event) => {
    triggerRef.current = event?.currentTarget || null;
    setSelectedPhoto(photo);
  };

  const closeLightbox = () => {
    setSelectedPhoto(null);
  };

  // Escape-close and body scroll lock while the lightbox is open
  useEffect(() => {
    if (!selectedPhoto) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedPhoto(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      triggerRef.current?.focus();
    };
  }, [selectedPhoto]);

  return (
    <>
      <Helmet>
        <title>Workshop Gallery | CNS Tool Repair Surrey BC</title>
        <meta
          name="description"
          content="Photos of our Surrey, BC pneumatic tool repair facility - diagnostic equipment, testing stations, and the industrial tools we service."
        />
        <meta
          name="keywords"
          content="pneumatic tool repair Surrey BC, industrial tool workshop, air tool repair facility, B2B tool repair, professional workshop Surrey, tool repair equipment"
        />
        <link rel="canonical" href="https://cnstoolrepair.com/gallery" />

        {/* Open Graph */}
        <meta property="og:title" content="Professional Workshop Gallery | CNS Tool Repair Surrey BC" />
        <meta property="og:description" content="Browse photos of our Surrey BC pneumatic tool repair facility and specialized equipment." />
        <meta property="og:url" content="https://cnstoolrepair.com/gallery" />
        <meta property="og:type" content="website" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Professional Workshop Gallery | CNS Tool Repair Surrey BC" />
        <meta name="twitter:description" content="Browse photos of our Surrey BC pneumatic tool repair facility and specialized equipment." />
      </Helmet>

      <main id="main-content" tabIndex={-1} className="relative min-h-screen px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-screen-xl mx-auto">
          {loading ? (
            <>
              {/* Hero Skeleton */}
              <div className="text-center mb-12 lg:mb-16">
                {/* Orange label skeleton */}
                <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-2 animate-pulse"></div>

                {/* H1 heading skeleton */}
                <div className="h-10 lg:h-12 w-64 max-w-full bg-slate-200 dark:bg-slate-800 rounded mx-auto mb-4 animate-pulse"></div>

                {/* Description skeleton (3 lines) */}
                <div className="max-w-3xl mx-auto space-y-2">
                  <div className="h-4 lg:h-5 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-4 lg:h-5 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-4 lg:h-5 w-4/5 mx-auto bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                </div>
              </div>

              {/* Gallery Grid Skeleton - Pinterest masonry style */}
              <div className="columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4 lg:gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => {
                  // Aspect variants matching the actual photo grid pattern
                  const randomAspect = ASPECT_VARIANTS[i % ASPECT_VARIANTS.length];

                  return (
                    <div
                      key={i}
                      className={`w-full ${randomAspect} bg-slate-200 dark:bg-slate-800 rounded-2xl mb-3 sm:mb-4 lg:mb-6 animate-pulse break-inside-avoid`}
                    ></div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Hero Section */}
              <div className="text-center mb-12 lg:mb-16">
                <p className="text-red-700 dark:text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Facility</p>
                <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Workshop Gallery</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-3xl mx-auto text-base lg:text-lg">
                  Browse photos of our Surrey, BC pneumatic tool repair facility. See our specialized diagnostic equipment, testing stations, and the industrial tools we service for businesses across the Lower Mainland.
                </p>
              </div>

              {/* Photo Grid */}
              {photos.length > 0 ? (
                <div className="columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4 lg:gap-6">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      aria-label={`View workshop photo ${index + 1} of ${photos.length}`}
                      className="block w-full mb-3 sm:mb-4 lg:mb-6 break-inside-avoid cursor-pointer group"
                      onClick={(e) => openLightbox(photo, e)}
                    >
                      <img
                        src={resolvePhotoUrl(photo.thumb_url || photo.image_url)}
                        alt={`Workshop photo ${index + 1} of ${photos.length}`}
                        className={`w-full ${photo.randomAspect} object-cover rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]`}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <span className="material-symbols-outlined text-6xl text-slate-400" aria-hidden="true">photo_library</span>
                  <p className="mt-4 text-slate-500">No photos yet. Check back soon!</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Call-to-Action Section */}
      <DualCTA backgroundColor="bg-slate-100 dark:bg-slate-900" />

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={closeLightbox}
        >
          <button
            ref={closeButtonRef}
            className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors"
            aria-label="Close"
            onClick={closeLightbox}
          >
            <span className="material-symbols-outlined text-4xl">close</span>
          </button>
          <img
            src={resolvePhotoUrl(selectedPhoto.image_url)}
            alt={`Workshop photo ${photos.indexOf(selectedPhoto) + 1} of ${photos.length}`}
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
