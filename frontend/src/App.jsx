import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
  );
}

export default App;
