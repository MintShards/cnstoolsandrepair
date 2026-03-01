import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { SettingsProvider } from './contexts/SettingsContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BottomNav from './components/layout/BottomNav';
import Home from './pages/Home';
import Services from './pages/Services';
import Tools from './pages/Tools';
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
      <SettingsProvider>
        <Router>
          <div className="min-h-screen flex flex-col">
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/industries" element={<Industries />} />
              <Route path="/quote" element={<Quote />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/gallery" element={<Gallery />} />

              {/* Hidden Admin Routes - Not linked in navigation */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedAdminRoute>
                    <AdminSettings />
                  </ProtectedAdminRoute>
                }
              />
            </Routes>
            <Footer />
            <BottomNav />
          </div>
        </Router>
      </SettingsProvider>
    </HelmetProvider>
  );
}

export default App;
