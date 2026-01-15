import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Complete country list (ISO 3166-1)
const COUNTRIES = [
  { code: '', name: 'Country' },
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo (DRC)' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: 'North Korea' },
  { code: 'KR', name: 'South Korea' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macau' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'São Tomé and Príncipe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' }
];

// Age ranges
const AGE_RANGES = [
  { value: '', label: 'Age' },
  { value: '18-24', label: '18-24' },
  { value: '25-34', label: '25-34' },
  { value: '35-44', label: '35-44' },
  { value: '45-54', label: '45-54' },
  { value: '55+', label: '55+' }
];

const AuthModal = ({ mode: initialMode, onClose }) => {
  const [mode, setMode] = useState(initialMode); // 'login', 'register', 'forgot-password'
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

  // New registration fields
  const [firstName, setFirstName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [country, setCountry] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Custom country dropdown state
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef(null);

  // Filter countries based on search
  const filteredCountries = COUNTRIES.filter(c =>
    c.code === '' || c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
        setCountryDropdownOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const canSubmit =
    email &&
    isEmailValid(email) &&
    password &&
    isPasswordValid(password) &&
    (mode === 'login' || (
      confirmPassword &&
      password === confirmPassword &&
      firstName.trim() &&
      ageRange &&
      country &&
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
        await register(sanitizedEmail, sanitizedPassword, {
          firstName: firstName.trim(),
          ageRange,
          country,
          marketingConsent
        });
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
    // Reset registration-only fields
    setFirstName('');
    setAgeRange('');
    setCountry('');
    setMarketingConsent(false);
    setTermsAccepted(false);
    // Reset country dropdown state
    setCountryDropdownOpen(false);
    setCountrySearch('');
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
          {/* First Name (Register only - appears first) */}
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
                  required
                  maxLength={50}
                  className="modal-input"
                  autoComplete="given-name"
                  disabled={loading}
                />
                <label htmlFor="firstName" className="floating-label-text">
                  First name
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

          {/* Additional Registration Fields */}
          {mode === 'register' && (
            <>
              {/* Age Range & Country - Responsive Grid */}
              <div className="registration-grid">
                {/* Age Range */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="ageRange" className="form-label">
                    Age range
                  </label>
                  <div className="input-wrapper">
                    <select
                      id="ageRange"
                      value={ageRange}
                      onChange={(e) => setAgeRange(e.target.value)}
                      required
                      className="modal-input"
                      disabled={loading}
                      style={{ cursor: 'pointer', appearance: 'none', paddingRight: '40px' }}
                    >
                      {AGE_RANGES.map((range) => (
                        <option key={range.value} value={range.value}>
                          {range.label}
                        </option>
                      ))}
                    </select>
                    <div style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'rgba(255,255,255,0.5)'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 4.5L6 7.5L9 4.5"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Country - Custom Dropdown */}
                <div className="form-group" style={{ marginBottom: 0 }} ref={countryDropdownRef}>
                  <label htmlFor="country" className="form-label">
                    Country
                  </label>
                  <div className="input-wrapper" style={{ position: 'relative' }}>
                    {/* Dropdown trigger button */}
                    <button
                      type="button"
                      id="country"
                      onClick={() => !loading && setCountryDropdownOpen(!countryDropdownOpen)}
                      disabled={loading}
                      className={`custom-dropdown-trigger ${!country ? 'placeholder' : ''}`}
                    >
                      {country ? COUNTRIES.find(c => c.code === country)?.name : 'Country'}
                    </button>
                    <div style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'rgba(255,255,255,0.5)'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d={countryDropdownOpen ? "M3 7.5L6 4.5L9 7.5" : "M3 4.5L6 7.5L9 4.5"}/>
                      </svg>
                    </div>

                    {/* Dropdown panel */}
                    {countryDropdownOpen && (
                      <div className="custom-dropdown-panel">
                        {/* Search input */}
                        <div className="custom-dropdown-search">
                          <input
                            type="text"
                            placeholder="Search countries..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            autoFocus
                          />
                        </div>
                        {/* Scrollable options list */}
                        <div className="custom-dropdown-list">
                          {filteredCountries.filter(c => c.code !== '').map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCountry(c.code);
                                setCountryDropdownOpen(false);
                                setCountrySearch('');
                              }}
                              className={`custom-dropdown-option ${country === c.code ? 'selected' : ''}`}
                            >
                              {c.name}
                            </button>
                          ))}
                          {filteredCountries.filter(c => c.code !== '').length === 0 && (
                            <div className="custom-dropdown-empty">
                              No countries found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Consent Checkboxes */}
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Terms & Conditions - Required */}
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

                {/* Marketing Consent - Optional */}
                <label className="consent-checkbox optional">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    disabled={loading}
                  />
                  <span className="checkbox-label">
                    I'd like to receive marketing emails about products, offers, and news from DOAC
                  </span>
                </label>
              </div>
            </>
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
