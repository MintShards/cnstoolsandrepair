import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
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
import NotFound from './pages/NotFound';
import { lazy, Suspense } from 'react';
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';
import ProtectedSalesRoute from './components/sales/ProtectedSalesRoute';

// Admin pages are lazy-loaded so the CMS bundle never ships to public visitors
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const RepairTracker = lazy(() => import('./pages/admin/RepairTracker'));

// Sales pages are lazy-loaded — never ships to public visitors
const SalesLogin = lazy(() => import('./pages/sales/SalesLogin'));
const SalesDashboard = lazy(() => import('./pages/sales/SalesDashboard'));
const ShopWorkspace = lazy(() => import('./pages/admin/ShopWorkspace'));

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
        <title>Pneumatic Tool Repair in Surrey, BC | CNS Tool Repair</title>
        <meta
          name="description"
          content="Industrial pneumatic tool repair in Surrey, BC. Professional diagnostics, OEM-compatible parts, and in-shop service for automotive, fleet, and manufacturing."
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
            <ErrorBoundary>
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
                <Route
                  path="/admin/workspace"
                  element={
                    <ProtectedAdminRoute>
                      <Suspense fallback={<AdminFallback />}>
                        <ShopWorkspace />
                      </Suspense>
                    </ProtectedAdminRoute>
                  }
                />

                {/* Sales Routes - No header/footer, lazy-loaded */}
                <Route
                  path="/sales/login"
                  element={
                    <Suspense fallback={<AdminFallback />}>
                      <SalesLogin />
                    </Suspense>
                  }
                />
                <Route
                  path="/sales/dashboard"
                  element={
                    <ProtectedSalesRoute>
                      <Suspense fallback={<AdminFallback />}>
                        <SalesDashboard />
                      </Suspense>
                    </ProtectedSalesRoute>
                  }
                />
                <Route path="/sales" element={<Navigate to="/sales/dashboard" replace />} />
                <Route path="/sales/*" element={<Navigate to="/sales/dashboard" replace />} />

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
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                      <Footer />
                      <BottomNav />
                    </div>
                  }
                />
              </Routes>
            </ErrorBoundary>
          </Router>
        </SettingsProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
