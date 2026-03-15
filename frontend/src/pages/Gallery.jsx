import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { galleryAPI } from '../services/api';
import DualCTA from '../components/sections/DualCTA';

// Constants
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Fisher-Yates shuffle algorithm for uniform random distribution
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Pinterest-style random height variants for dynamic masonry layout
const getRandomHeight = () => {
  const heights = [
    'h-48',  // Small - 192px
    'h-56',  // Medium-Small - 224px
    'h-64',  // Medium - 256px
    'h-72',  // Medium-Large - 288px
    'h-80',  // Large - 320px
    'h-96',  // Extra Large - 384px
  ];
  return heights[Math.floor(Math.random() * heights.length)];
};

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const data = await galleryAPI.list();
        // Shuffle photos for random display order and assign random heights for Pinterest-style variety
        const shuffled = shuffleArray(data).map(photo => ({
          ...photo,
          randomHeight: getRandomHeight()
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

  const openLightbox = (photo) => {
    setSelectedPhoto(photo);
  };

  const closeLightbox = () => {
    setSelectedPhoto(null);
  };

  return (
    <>
      <Helmet>
        <title>Professional Workshop Gallery | CNS Tools and Repair Surrey BC</title>
        <meta
          name="description"
          content="Browse photos of our Surrey BC pneumatic tool repair facility. See our specialized equipment, diagnostic stations, and industrial tools we service for automotive, manufacturing, construction, and aerospace companies."
        />
        <meta
          name="keywords"
          content="pneumatic tool repair Surrey BC, industrial tool workshop, air tool repair facility, B2B tool repair, professional workshop Surrey, tool repair equipment"
        />
        <link rel="canonical" href="https://cnstoolsandrepair.com/gallery" />

        {/* Open Graph */}
        <meta property="og:title" content="Professional Workshop Gallery | CNS Tools and Repair" />
        <meta property="og:description" content="Browse photos of our Surrey BC pneumatic tool repair facility and specialized equipment." />
        <meta property="og:url" content="https://cnstoolsandrepair.com/gallery" />
        <meta property="og:type" content="website" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Professional Workshop Gallery | CNS Tools and Repair" />
        <meta name="twitter:description" content="Browse photos of our Surrey BC pneumatic tool repair facility and specialized equipment." />
      </Helmet>

      <main className="relative min-h-screen px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 bg-white dark:bg-slate-950">
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
              <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4 lg:gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => {
                  // Random heights matching actual photo grid pattern
                  const heights = ['h-48', 'h-56', 'h-64', 'h-72', 'h-80', 'h-96'];
                  const randomHeight = heights[i % heights.length];

                  return (
                    <div
                      key={i}
                      className={`${randomHeight} bg-slate-200 dark:bg-slate-800 rounded-2xl mb-3 sm:mb-4 lg:mb-6 animate-pulse break-inside-avoid`}
                    ></div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Hero Section */}
              <div className="text-center mb-12 lg:mb-16">
                <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Facility</h2>
                <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Workshop Gallery</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-3xl mx-auto text-base lg:text-lg">
                  Browse photos of our Surrey, BC pneumatic tool repair facility. See our specialized diagnostic equipment, testing stations, and the industrial tools we service for businesses across the Lower Mainland.
                </p>
              </div>

              {/* Photo Grid */}
              {photos.length > 0 ? (
                <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4 lg:gap-6">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="mb-3 sm:mb-4 lg:mb-6 break-inside-avoid cursor-pointer group"
                      onClick={() => openLightbox(photo)}
                    >
                      <img
                        src={`${API_BASE_URL}/uploads/${photo.image_url}`}
                        alt="Workshop gallery"
                        className={`w-full ${photo.randomHeight} object-cover rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]`}
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <span className="material-symbols-outlined text-6xl text-slate-400">photo_library</span>
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
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors"
            onClick={closeLightbox}
          >
            <span className="material-symbols-outlined text-4xl">close</span>
          </button>
          <img
            src={`${API_BASE_URL}/uploads/${selectedPhoto.image_url}`}
            alt="Workshop gallery"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
