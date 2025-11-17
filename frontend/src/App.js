import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import CookieConsent from './components/CookieConsent';
import LoadingSpinner from './components/LoadingSpinner';

// Pages
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ReferralRedirect from './pages/ReferralRedirect';

// Authenticated route wrapper - redirects to dashboard if logged in
function AuthenticatedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // If authenticated, always go to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Protected route wrapper - redirects to landing if not logged in
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // If not authenticated, go to landing page
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Catch-all redirect based on auth status
function CatchAllRedirect() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return <Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />;
}

function AppContent() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Only show header on dashboard (when authenticated)
  const showHeader = isAuthenticated && location.pathname === '/dashboard';

  return (
    <div className="App">
      {showHeader && <Header />}
      <Routes>
        {/* Landing page - only for unauthenticated users */}
        <Route
          path="/"
          element={
            <AuthenticatedRoute>
              <Landing />
            </AuthenticatedRoute>
          }
        />

        {/* Referral redirect - public */}
        <Route path="/r/:code" element={<ReferralRedirect />} />

        {/* Dashboard - only for authenticated users */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* ALL other routes redirect based on auth status */}
        <Route path="*" element={<CatchAllRedirect />} />
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
