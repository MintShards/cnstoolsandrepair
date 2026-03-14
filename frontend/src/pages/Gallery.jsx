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

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const data = await galleryAPI.list();
        // Shuffle photos for random display order
        const shuffled = shuffleArray(data);
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
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-accent-orange text-xs font-black uppercase tracking-[0.25em] mb-2">Our Facility</h2>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight uppercase">Workshop Gallery</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-3xl mx-auto text-base lg:text-lg">
              Browse photos of our Surrey, BC pneumatic tool repair facility. See our specialized diagnostic equipment, testing stations, and the industrial tools we service for businesses across the Lower Mainland.
            </p>
          </div>

        {loading ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-primary animate-spin">refresh</span>
            <p className="mt-4 text-slate-500">Loading photos...</p>
          </div>
        ) : photos.length > 0 ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 lg:gap-6">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="mb-4 lg:mb-6 break-inside-avoid cursor-pointer group"
                onClick={() => openLightbox(photo)}
              >
                <img
                  src={`${API_BASE_URL}/uploads/${photo.image_url}`}
                  alt="Workshop gallery"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]"
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
