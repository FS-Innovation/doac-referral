import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { validateResetToken, resetPassword } = useAuth();

  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [validating, setValidating] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Validate token on component mount
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');

    if (!tokenFromUrl) {
      setError('Invalid reset link. Please request a new password reset.');
      setValidating(false);
      return;
    }

    setToken(tokenFromUrl);

    // Validate the token with the backend
    const validateToken = async () => {
      try {
        const response = await validateResetToken(tokenFromUrl);
        setEmail(response.email);
        setValidating(false);
      } catch (err) {
        const errorMessage = err.response?.data?.error || 'Invalid or expired reset link. Please request a new one.';
        setError(errorMessage);
        setToken(''); // Clear token to prevent showing the form
        setValidating(false);
      }
    };

    validateToken();
  }, [searchParams, validateResetToken]);

  // Client-side validation
  const isPasswordValid = (password) => {
    return password && password.length >= 6 && password.length <= 128;
  };

  const getPasswordError = (password) => {
    if (!password) return '';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password.length > 128) return 'Password too long (max 128 characters)';
    return '';
  };

  const passwordError = passwordTouched && password ? getPasswordError(password) : '';
  const confirmPasswordError = confirmPassword && password !== confirmPassword
    ? 'Passwords do not match'
    : '';

  const canSubmit =
    password &&
    isPasswordValid(password) &&
    confirmPassword &&
    password === confirmPassword &&
    !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Final validation
    if (!isPasswordValid(password)) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await resetPassword(token, password);
      setSuccess(true);

      // Redirect to home page (login modal) after 3 seconds
      setTimeout(() => {
        navigate('/?login=true');
      }, 3000);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to reset password. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while validating token
  if (validating) {
    return (
      <>
        <Header />
        <div className="reset-password-page">
          <div className="reset-password-container">
            <div className="reset-password-card">
              <div className="loading-spinner">
                <span className="spinner"></span>
                <p>Validating reset link...</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show error if token validation failed
  if (error && !token) {
    return (
      <>
        <Header />
        <div className="reset-password-page">
          <div className="reset-password-container">
            <div className="reset-password-card">
              <div className="reset-password-error-state">
                <div className="error-icon-large">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <h2>Reset Link Expired</h2>
                <p className="error-message">This password reset link has expired or is no longer valid. For security reasons, reset links expire after 10 minutes.</p>
                <p className="error-advice">Please request a new password reset link from the login page.</p>
                <button onClick={() => navigate('/?login=true')} className="modal-submit">
                  Return to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show success state
  if (success) {
    return (
      <>
        <Header />
        <div className="reset-password-page">
          <div className="reset-password-container">
            <div className="reset-password-card">
              <div className="success-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <h2>Password Reset Successful!</h2>
                <p>Your password has been successfully reset.</p>
                <p className="redirect-notice">Redirecting you to login...</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show password reset form
  return (
    <>
      <Header />
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-card">
          <div className="reset-password-header">
            <h1>Create New Password</h1>
            <p>Enter a new password for <strong>{email}</strong></p>
          </div>

          <form onSubmit={handleSubmit} className="reset-password-form" noValidate>
            {/* New Password */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                New password
              </label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Choose a secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  required
                  minLength={6}
                  className="modal-input"
                  autoComplete="new-password"
                  disabled={loading}
                  autoFocus
                />
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

              {/* Password Strength Indicator */}
              {password && password.length >= 1 && (() => {
                // Calculate password strength (0-4)
                let strength = 0;
                if (password.length >= 8) strength++;
                if (password.length >= 12) strength++;
                if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
                if (/[0-9]/.test(password)) strength++;
                if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) strength++;

                // Cap at 4 for display
                const displayStrength = Math.min(strength, 4);

                // Determine color class
                let strengthClass = 'weak';
                if (displayStrength >= 4) strengthClass = 'strong';
                else if (displayStrength >= 3) strengthClass = 'good';
                else if (displayStrength >= 2) strengthClass = 'fair';

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

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm new password
              </label>
              <div className="input-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="modal-input"
                  autoComplete="new-password"
                  disabled={loading}
                />
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
              </div>
              {confirmPasswordError && <span className="error-text">{confirmPasswordError}</span>}
            </div>

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
                  Resetting password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>

            {/* Security Notice */}
            <div className="security-notice">
              <svg className="info-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16V12M12 8H12.01" strokeLinecap="round"/>
              </svg>
              <p>After resetting your password, you'll be redirected to login with your new credentials.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
    </>
  );
};

export default ResetPassword;
