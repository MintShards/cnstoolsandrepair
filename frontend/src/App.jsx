import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import ScrollToTop from './components/ScrollToTop';
import AnnouncementBanner from './components/layout/AnnouncementBanner';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BottomNav from './components/layout/BottomNav';
import Home from './pages/Home';
import Services from './pages/Services';
import Industries from './pages/Industries';
import Quote from './pages/Quote';
import About from './pages/About';
import Contact from './pages/Contact';
import Gallery from './pages/Gallery';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import { lazy, Suspense } from 'react';
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';

// Admin pages are lazy-loaded so the CMS bundle never ships to public visitors
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const RepairTracker = lazy(() => import('./pages/admin/RepairTracker'));

function AdminFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="size-10 rounded-full border-4 border-slate-700 border-t-primary animate-spin" aria-label="Loading" />
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
      {/* Default meta tags (overridden by page-specific Helmet components) */}
      <Helmet>
        <title>CNS Tool Repair | Industrial Pneumatic Tool Repair Surrey BC</title>
        <meta
          name="description"
          content="Industrial pneumatic tool repair services in Surrey, BC. Professional diagnostics, OEM parts, and expert service for automotive, fleet, manufacturing, and construction industries."
        />
      </Helmet>
      <ThemeProvider>
        <SettingsProvider>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <ScrollToTop />
            <Routes>
              {/* Admin Routes - No header/footer, lazy-loaded */}
              <Route
                path="/admin/login"
                element={
                  <Suspense fallback={<AdminFallback />}>
                    <AdminLogin />
                  </Suspense>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedAdminRoute>
                    <Suspense fallback={<AdminFallback />}>
                      <AdminSettings />
                    </Suspense>
                  </ProtectedAdminRoute>
                }
              />
              <Route
                path="/admin/repair-tracker"
                element={
                  <ProtectedAdminRoute>
                    <Suspense fallback={<AdminFallback />}>
                      <RepairTracker />
                    </Suspense>
                  </ProtectedAdminRoute>
                }
              />

              {/* Public Routes - With header/footer */}
              <Route
                path="*"
                element={
                  <div className="min-h-screen flex flex-col">
                    <AnnouncementBanner />
                    <Header />
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/services" element={<Services />} />
                      <Route path="/tools" element={<Navigate to="/services" replace />} />
                      <Route path="/industries" element={<Industries />} />
                      <Route path="/repair-request" element={<Quote />} />
                      <Route path="/quote" element={<Navigate to="/repair-request" replace />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/gallery" element={<Gallery />} />
                      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                      <Route path="/terms-of-service" element={<TermsOfService />} />
                    </Routes>
                    <Footer />
                    <BottomNav />
                  </div>
                }
              />
            </Routes>
          </Router>
        </SettingsProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
