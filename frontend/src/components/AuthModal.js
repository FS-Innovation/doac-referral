import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const AuthModal = ({ mode: initialMode, onClose }) => {
  const [mode, setMode] = useState(initialMode); // 'login', 'register', 'forgot-password', 'verify-code', 'reset-password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Password reset specific state
  const [resetCode, setResetCode] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRefs = useRef([]);

  const { login, register } = useAuth();
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

  const canSubmit =
    email &&
    isEmailValid(email) &&
    password &&
    isPasswordValid(password) &&
    (mode === 'login' || (confirmPassword && password === confirmPassword)) &&
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
        await register(sanitizedEmail, sanitizedPassword);
      } else {
        await login(sanitizedEmail, sanitizedPassword);
      }
      onClose();
      navigate('/dashboard');
    } catch (err) {
      // Display user-friendly error message from backend
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Authentication failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
    setPassword('');
    setConfirmPassword('');
    setPasswordTouched(false);
  };

  // Password reset: Send email with code
  const handleForgotPassword = async (e) => {
    e.preventDefault();

    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    if (!isEmailValid(sanitizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await authAPI.forgotPassword(sanitizedEmail);
      setSuccessMessage('If an account exists, a verification code has been sent to your email.');
      setMode('verify-code');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Unable to process request';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle 6-digit code input
  const handleCodeChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...resetCode];
    newCode[index] = value;
    setResetCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !resetCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setResetCode(newCode);
      // Focus last input
      codeInputRefs.current[5]?.focus();
    }
  };

  // Auto-focus first code input when switching to verify-code mode
  useEffect(() => {
    if (mode === 'verify-code' && codeInputRefs.current[0]) {
      codeInputRefs.current[0].focus();
    }
  }, [mode]);

  // Cooldown timer for resend code
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Resend code function
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setError('');
    setSuccessMessage('');
    setResendLoading(true);

    try {
      await authAPI.forgotPassword(email);
      setSuccessMessage('A new verification code has been sent to your email.');
      setResetCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
      // Set 60 second cooldown before allowing another resend
      setResendCooldown(60);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Unable to resend code';
      setError(errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  // Password reset: Verify code
  const handleVerifyCode = async (e) => {
    e.preventDefault();

    const code = resetCode.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await authAPI.verifyResetCode(email, code);
      setResetToken(response.data.resetToken);
      setSuccessMessage('Code verified! Please enter your new password.');
      setMode('reset-password');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Invalid or expired code';
      setError(errorMessage);
      // Clear the code on error
      setResetCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Password reset: Complete reset with new password
  const handleResetPassword = async (e) => {
    e.preventDefault();

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
      await authAPI.resetPassword(resetToken, password);
      setSuccessMessage('Password reset successful! You can now log in.');
      // Reset form and switch to login
      setTimeout(() => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setSuccessMessage('');
        setMode('login');
      }, 2000);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Unable to reset password';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Render different forms based on mode
  const renderForm = () => {
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
                onBlur={() => setEmailTouched(true)}
                required
                className="modal-input"
                autoComplete="email"
                disabled={loading}
                autoFocus
              />
            </div>
            {emailError && <span className="error-text">{emailError}</span>}
          </div>

          {error && (
            <div className="modal-error" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
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
              'Send verification code'
            )}
          </button>

          <div className="modal-footer">
            <p className="footer-text">
              Remember your password?{' '}
              <button type="button" className="footer-link" onClick={() => switchMode('login')}>
                Back to login
              </button>
            </p>
          </div>
        </form>
      );
    }

    if (mode === 'verify-code') {
      return (
        <form onSubmit={handleVerifyCode} className="modal-form" noValidate>
          {successMessage && (
            <div className="modal-success" role="status">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {successMessage}
            </div>
          )}

          <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>

          <div className="code-input-container">
            {resetCode.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (codeInputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength="1"
                className="code-input"
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                onPaste={index === 0 ? handleCodePaste : undefined}
                disabled={loading}
              />
            ))}
          </div>

          {error && (
            <div className="modal-error" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="modal-submit"
            disabled={resetCode.join('').length !== 6 || loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Verifying...
              </>
            ) : (
              'Verify code'
            )}
          </button>

          <div className="modal-footer">
            <p className="footer-text">
              Didn't receive the code?{' '}
              <button
                type="button"
                className="footer-link"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || resendLoading}
              >
                {resendLoading ? (
                  'Sending...'
                ) : resendCooldown > 0 ? (
                  `Resend code (${resendCooldown}s)`
                ) : (
                  'Resend code'
                )}
              </button>
              {' or '}
              <button type="button" className="footer-link" onClick={() => {
                setResetCode(['', '', '', '', '', '']);
                setResendCooldown(0);
                setMode('forgot-password');
              }}>
                use different email
              </button>
            </p>
          </div>
        </form>
      );
    }

    if (mode === 'reset-password') {
      return (
        <form onSubmit={handleResetPassword} className="modal-form" noValidate>
          {successMessage && (
            <div className="modal-success" role="status">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {successMessage}
            </div>
          )}

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
          </div>

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

          {error && (
            <div className="modal-error" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="modal-submit"
            disabled={!password || !isPasswordValid(password) || password !== confirmPassword || loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Resetting password...
              </>
            ) : (
              'Reset password'
            )}
          </button>
        </form>
      );
    }

    // Default: login/register form
    return (
      <form onSubmit={handleSubmit} className="modal-form" noValidate>
          {/* Email Input */}
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
                onBlur={() => setEmailTouched(true)}
                required
                className="modal-input"
                autoComplete="email"
                disabled={loading}
              />
            </div>
            {emailError && <span className="error-text">{emailError}</span>}
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'register' ? 'Choose a secure password' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                required
                minLength={6}
                className="modal-input"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                disabled={loading}
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
            {mode === 'register' && password && password.length >= 1 && (() => {
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

          {/* Confirm Password (Register only) */}
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm password
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
          )}

          {/* Error Message */}
          {error && (
            <div className="modal-error" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
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

          {/* Footer */}
          <div className="modal-footer">
            <p className="footer-text">
              {mode === 'register' ? (
                <>
                  By creating an account, you agree to our{' '}
                  <a href="/terms-conditions" className="footer-link" target="_blank" rel="noopener noreferrer">
                    Terms & Conditions
                  </a>
                  {' '}and{' '}
                  <a href="/privacy-policy" className="footer-link" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                </>
              ) : (
                <>
                  Forgot your password?{' '}
                  <button type="button" className="footer-link" onClick={() => setMode('forgot-password')}>
                    Reset it here
                  </button>
                </>
              )}
            </p>
          </div>
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
            {mode === 'forgot-password' && 'Reset Your Password'}
            {mode === 'verify-code' && 'Verify Your Email'}
            {mode === 'reset-password' && 'Create New Password'}
            {(mode === 'login' || mode === 'register') && 'Start Earning Points'}
          </h2>
          {(mode === 'login' || mode === 'register') && (
            <div className="modal-tabs">
              <button
                className={`tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => switchMode('login')}
                type="button"
              >
                Log in to your account
              </button>
              <button
                className={`tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => switchMode('register')}
                type="button"
              >
                Create a free account
              </button>
            </div>
          )}
        </div>

        {renderForm()}
      </div>
    </div>
  );
};

export default AuthModal;
