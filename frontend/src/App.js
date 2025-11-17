import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import CookieConsent from './components/CookieConsent';
import PrivateRoute from './components/PrivateRoute';

// User pages
import Landing from './pages/Landing';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ReferralRedirect from './pages/ReferralRedirect';
import CookiePolicy from './pages/CookiePolicy';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductManagement from './pages/admin/ProductManagement';
import UserManagement from './pages/admin/UserManagement';
import Settings from './pages/admin/Settings';

// 404 component that redirects based on auth status
function NotFound() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Redirect logged-in users to dashboard, others to landing
  return <Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />;
}

function AppContent() {
  const location = useLocation();

  // Don't show header on landing page
  const showHeader = location.pathname !== '/';

  return (
    <div className="App">
      {showHeader && <Header />}
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path="/r/:code" element={<ReferralRedirect />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/privacy" element={<CookiePolicy />} /> {/* Temporary - create separate privacy page later */}

        {/* Protected user routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/products"
          element={
            <PrivateRoute>
              <Products />
            </PrivateRoute>
          }
        />

        {/* Protected admin routes */}
        <Route
          path="/admin"
          element={
            <PrivateRoute adminOnly>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <PrivateRoute adminOnly>
              <ProductManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <PrivateRoute adminOnly>
              <UserManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <PrivateRoute adminOnly>
              <Settings />
            </PrivateRoute>
          }
        />

        {/* 404 fallback - doesn't log users out */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
        <CookieConsent />
      </AuthProvider>
    </Router>
  );
}

export default App;
