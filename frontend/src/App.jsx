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
import AdminLogin from './pages/admin/AdminLogin';
import AdminSettings from './pages/admin/AdminSettings';
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';

function App() {
  return (
    <HelmetProvider>
      {/* Default meta tags (overridden by page-specific Helmet components) */}
      <Helmet>
        <title>CNS Tools and Repair | Industrial Pneumatic Tool Repair Surrey BC</title>
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
              {/* Admin Routes - No header/footer */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedAdminRoute>
                    <AdminSettings />
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
