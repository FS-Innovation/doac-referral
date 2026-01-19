import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  trackSignupStarted,
  trackSignupCompleted,
  trackLoginStarted,
  trackLoginCompleted,
  trackLoginFailed,
  trackPasswordResetRequested,
  trackModalOpened,
  trackModalClosed,
  trackTabChanged,
} from '../services/analytics';

// SIMPLIFIED REGISTRATION: Email, password, name (required), and terms
// Profile data (interests, demographics, marketing prefs) collected after email verification

const AuthModal = ({ mode: initialMode, onClose }) => {
  const [mode, setMode] = useState(() => {
    // Track modal opened on mount
    trackModalOpened(initialMode === 'register' ? 'signup' : initialMode);
    return initialMode;
  }); // 'login', 'register', 'forgot-password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Focus states for floating labels
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [firstNameFocused, setFirstNameFocused] = useState(false);

  // Registration fields - SIMPLIFIED (only name and terms)
  const [firstName, setFirstName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Password reset states
  const [successMessage, setSuccessMessage] = useState('');

  const { login, register, forgotPassword } = useAuth();
  const navigate = useNavigate();

  // Client-side validation and sanitization
  const sanitizeInput = (input) => {
    // Remove any potential SQL injection characters and XSS attempts
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/['";]/g, '') // Remove quotes and semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comments
      .replace(/\*\//g, '')
      .trim();
  };

  const isEmailValid = (email) => {
    // Strict email validation - max 254 chars (RFC 5321)
    if (!email || email.length > 254) return false;

    // Comprehensive email regex
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Additional checks
    const hasValidDomain = email.split('@')[1]?.includes('.');
    const noConsecutiveDots = !email.includes('..');
    const noSpecialStart = /^[a-zA-Z0-9]/.test(email);

    return emailRegex.test(email) && hasValidDomain && noConsecutiveDots && noSpecialStart;
  };

  const isPasswordValid = (password) => {
    // Password must be between 6-128 characters (minimum requirement only)
    if (!password || password.length < 6 || password.length > 128) return false;
    return true;
  };

  const getPasswordError = (password) => {
    if (!password) return '';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password.length > 128) return 'Password too long (max 128 characters)';
    return '';
  };

  // Only show errors after user has interacted and moved away
  // Hide error if field is empty (user erased it to retype)
  const emailError = emailTouched && email && !isEmailValid(email)
    ? 'Please enter a valid email address'
    : '';

  const passwordError = passwordTouched && password ? getPasswordError(password) : '';

  const confirmPasswordError = mode === 'register' && confirmPassword && password !== confirmPassword
    ? 'Passwords do not match'
    : '';

  // For registration, require email, password, confirm, name, and terms
  const canSubmit =
    email &&
    isEmailValid(email) &&
    password &&
    isPasswordValid(password) &&
    (mode === 'login' || (
      firstName.trim() &&  // Name is required
      confirmPassword &&
      password === confirmPassword &&
      termsAccepted
    )) &&
    !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Sanitize inputs before validation
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedPassword = password; // Don't sanitize password (may contain special chars)

    // Final validation
    if (!isEmailValid(sanitizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!isPasswordValid(sanitizedPassword)) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (mode === 'register' && sanitizedPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Check for dangerous patterns
    if (sanitizedEmail !== email.toLowerCase().trim()) {
      setError('Email contains invalid characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        trackSignupStarted('email');
        // Profile data (interests, demographics, marketing) collected after email verification
        const result = await register(sanitizedEmail, sanitizedPassword, {
          firstName: firstName.trim(),  // Required
          termsAccepted  // LEGAL: Send explicit ToS acceptance to backend for audit trail
        });
        trackSignupCompleted(result?.user?.id, sanitizedEmail);
        trackModalClosed('signup', 'completed');
        onClose();
        // After registration, go to email confirmation page (blocking step)
        navigate('/confirm-email');
      } else {
        trackLoginStarted();
        const result = await login(sanitizedEmail, sanitizedPassword);
        trackLoginCompleted(result?.user?.id, sanitizedEmail);
        trackModalClosed('login', 'completed');
        onClose();
        navigate('/dashboard');
      }
    } catch (err) {
      // Display user-friendly error message from backend
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Authentication failed';
      setError(errorMessage);
      if (mode === 'login') {
        trackLoginFailed(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    const previousMode = mode;
    setMode(newMode);
    setError('');
    setSuccessMessage('');
    setPassword('');
    setConfirmPassword('');
    setPasswordTouched(false);
    // Reset registration-only fields
    setFirstName('');
    setTermsAccepted(false);
    // Track tab change
    trackTabChanged(
      newMode === 'register' ? 'signup' : newMode,
      previousMode === 'register' ? 'signup' : previousMode
    );
  };

  // Handle forgot password request
  const handleForgotPassword = async (e) => {
    e.preventDefault();

    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    if (!isEmailValid(sanitizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      await forgotPassword(sanitizedEmail);
      trackPasswordResetRequested(sanitizedEmail);
      // Always show generic success message (security best practice)
      setSuccessMessage('If an account exists with this email, a password reset link has been sent. Please check your inbox.');
    } catch (err) {
      // Always show generic message to prevent email enumeration
      setSuccessMessage('If an account exists with this email, a password reset link has been sent. Please check your inbox.');
    } finally {
      setLoading(false);
    }
  };

  // Render different forms based on mode
  const renderForm = () => {
    // Forgot password form - Step 1: Enter email
    if (mode === 'forgot-password') {
      return (
        <form onSubmit={handleForgotPassword} className="modal-form" noValidate>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email address
            </label>
            <div className="input-wrapper">
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="modal-input"
                autoComplete="email"
                disabled={loading}
                autoFocus
              />
            </div>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
              Enter your email address and we'll send you a code to reset your password.
            </p>
          </div>

          {error && (
            <div className="modal-error" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {error}
            </div>
          )}

          {successMessage && (
            <div className="modal-success" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            className="modal-submit"
            disabled={!email || !isEmailValid(email) || loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Sending code...
              </>
            ) : (
              'Send reset code'
            )}
          </button>

          <div className="modal-footer">
            <button
              type="button"
              className="link-button"
              onClick={() => switchMode('login')}
              style={{ color: '#ffffff', cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', textDecoration: 'underline' }}
            >
              ← Back to login
            </button>
          </div>
        </form>
      );
    }

    // Default: login/register form
    return (
      <form onSubmit={handleSubmit} className="modal-form" noValidate>
          {/* First Name (Register only - REQUIRED) */}
          {mode === 'register' && (
            <div className={`form-group floating-label ${firstNameFocused || firstName ? 'focused' : ''}`}>
              <div className="input-wrapper">
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onFocus={() => setFirstNameFocused(true)}
                  onBlur={() => setFirstNameFocused(false)}
                  maxLength={50}
                  className="modal-input"
                  autoComplete="given-name"
                  disabled={loading}
                  required
                />
                <label htmlFor="firstName" className="floating-label-text">
                  Name
                </label>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div className={`form-group floating-label ${emailFocused || email ? 'focused' : ''} ${emailError ? 'has-error' : ''}`}>
            <div className="input-wrapper">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => { setEmailFocused(false); setEmailTouched(true); }}
                required
                className="modal-input"
                autoComplete="email"
                disabled={loading}
              />
              <label htmlFor="email" className="floating-label-text">
                Email address
              </label>
              {emailTouched && email && isEmailValid(email) && (
                <div className="input-success-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
            </div>
            {emailError && <span className="error-text">{emailError}</span>}
          </div>

          {/* Password Input */}
          <div className={`form-group floating-label ${passwordFocused || password ? 'focused' : ''} ${passwordError ? 'has-error' : ''}`}>
            <div className="input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => { setPasswordFocused(false); setPasswordTouched(true); }}
                required
                minLength={6}
                className="modal-input"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                disabled={loading}
              />
              <label htmlFor="password" className="floating-label-text">
                Password
              </label>
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={loading}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {passwordError && <span className="error-text">{passwordError}</span>}
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('forgot-password')}
                className="forgot-password-link"
              >
                Forgot password?
              </button>
            )}
            {mode === 'register' && password && password.length >= 1 && (() => {
              // Industry-standard password strength (NIST/OWASP guidelines)
              // Primary factor: length (NIST emphasizes length over complexity)
              // Secondary: character diversity
              const len = password.length;
              const hasUpper = /[A-Z]/.test(password);
              const hasLower = /[a-z]/.test(password);
              const hasNumber = /[0-9]/.test(password);
              const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
              const diversityCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

              // Calculate strength based on industry standards
              let displayStrength = 0;
              let strengthClass = 'weak';

              if (len >= 6) {
                displayStrength = 1; // Minimum viable
                strengthClass = 'weak';
              }
              if (len >= 8 && diversityCount >= 2) {
                displayStrength = 2; // Fair - meets basic requirements
                strengthClass = 'fair';
              }
              if ((len >= 12 && diversityCount >= 2) || (len >= 10 && diversityCount >= 3)) {
                displayStrength = 3; // Good
                strengthClass = 'good';
              }
              if ((len >= 16 && diversityCount >= 2) || (len >= 14 && diversityCount >= 3) || (len >= 12 && diversityCount >= 4)) {
                displayStrength = 4; // Strong - exceeds recommendations
                strengthClass = 'strong';
              }

              return (
                <div className="password-strength">
                  <div className="strength-bars">
                    <div className={`strength-bar ${displayStrength >= 1 ? strengthClass : ''}`}></div>
                    <div className={`strength-bar ${displayStrength >= 2 ? strengthClass : ''}`}></div>
                    <div className={`strength-bar ${displayStrength >= 3 ? strengthClass : ''}`}></div>
                    <div className={`strength-bar ${displayStrength >= 4 ? strengthClass : ''}`}></div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Confirm Password (Register only) */}
          {mode === 'register' && (
            <div className={`form-group floating-label ${confirmPasswordFocused || confirmPassword ? 'focused' : ''} ${confirmPasswordError ? 'has-error' : ''}`}>
              <div className="input-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setConfirmPasswordFocused(true)}
                  onBlur={() => setConfirmPasswordFocused(false)}
                  required
                  minLength={6}
                  className="modal-input"
                  autoComplete="new-password"
                  disabled={loading}
                />
                <label htmlFor="confirmPassword" className="floating-label-text">
                  Confirm password
                </label>
                <button
                  type="button"
                  className="input-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
                {confirmPassword && password === confirmPassword && (
                  <div className="input-success-icon" style={{ right: '48px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                )}
              </div>
              {confirmPasswordError && <span className="error-text">{confirmPasswordError}</span>}
            </div>
          )}

          {/* Terms & Conditions - Required (only checkbox needed for simplified registration) */}
          {mode === 'register' && (
            <div style={{ marginTop: '16px' }}>
              <label className="consent-checkbox">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  disabled={loading}
                />
                <span className="checkbox-label">
                  I confirm I am 18+ and agree to the{' '}
                  <a href="/terms-conditions" target="_blank" rel="noopener noreferrer">
                    Terms & Conditions
                  </a>
                  {' '}and{' '}
                  <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                </span>
              </label>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="modal-error" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="modal-submit"
            disabled={!canSubmit}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                {mode === 'register' ? 'Creating account...' : 'Signing in...'}
              </>
            ) : (
              mode === 'register' ? 'Create account' : 'Sign in'
            )}
          </button>

        </form>
      );
    };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close modal"
          type="button"
        >
          ×
        </button>

        <div className="modal-header">
          <h2>
            {mode === 'forgot-password' && 'Reset Password'}
            {(mode === 'login' || mode === 'register') && 'Welcome'}
          </h2>
          <p className="modal-subheading">
            {mode === 'forgot-password' && 'Enter your email to receive a reset link'}
            {mode === 'login' && 'Sign in to access your rewards dashboard'}
            {mode === 'register' && 'Create an account to start earning points'}
          </p>
          {(mode === 'login' || mode === 'register') && (
            <div className="modal-tabs-container">
              <div className="modal-tabs">
                <div
                  className="tab-indicator"
                  style={{ transform: mode === 'register' ? 'translateX(100%)' : 'translateX(0)' }}
                />
                <button
                  className={`tab ${mode === 'login' ? 'active' : ''}`}
                  onClick={() => switchMode('login')}
                  type="button"
                >
                  Sign in
                </button>
                <button
                  className={`tab ${mode === 'register' ? 'active' : ''}`}
                  onClick={() => switchMode('register')}
                  type="button"
                >
                  Create account
                </button>
              </div>
            </div>
          )}
        </div>

        {renderForm()}
      </div>
    </div>
  );
};

export default AuthModal;
