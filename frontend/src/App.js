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
import ReferralLanding from './pages/ReferralLanding';
import ResetPassword from './pages/ResetPassword';
import CookiePolicy from './pages/CookiePolicy';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import VerifyEmail from './pages/VerifyEmail';
import EmailConfirmation from './pages/EmailConfirmation';
import ProfileCompletion from './pages/ProfileCompletion';

// Authenticated route wrapper - redirects to dashboard if logged in
function AuthenticatedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  // If authenticated, always go to dashboard (preserve query params like ?e=videoId)
  if (isAuthenticated) {
    return <Navigate to={`/dashboard${location.search}`} replace />;
  }

  return children;
}

// Protected route wrapper - redirects to landing if not logged in
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, emailVerified } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // If not authenticated, go to landing page
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // If authenticated but email not verified, go to email confirmation
  if (!emailVerified) {
    return <Navigate to="/confirm-email" replace />;
  }

  return children;
}

// Route for users who need to confirm their email (authenticated but unverified)
function UnverifiedRoute({ children }) {
  const { isAuthenticated, loading, emailVerified } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // If not authenticated, go to landing page
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // If already verified, go to dashboard
  if (emailVerified) {
    return <Navigate to="/dashboard" replace />;
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

  // Show header on dashboard and profile pages (when authenticated)
  const showHeader = isAuthenticated && (location.pathname === '/dashboard' || location.pathname === '/profile/complete');

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

        {/* Referral landing page - public (where user chooses platform) */}
        <Route path="/listen/:code" element={<ReferralLanding />} />

        {/* Password reset - public */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Email verification - public (link from email) */}
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Email confirmation - for unverified users after registration */}
        <Route
          path="/confirm-email"
          element={
            <UnverifiedRoute>
              <EmailConfirmation />
            </UnverifiedRoute>
          }
        />

        {/* Policy pages - public */}
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />

        {/* Profile completion - only for authenticated users */}
        <Route
          path="/profile/complete"
          element={
            <ProtectedRoute>
              <ProfileCompletion />
            </ProtectedRoute>
          }
        />

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
