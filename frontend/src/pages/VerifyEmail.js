import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import {
  trackEmailVerificationPageViewed,
  trackEmailVerified,
  trackEmailVerificationFailed,
} from '../services/analytics';
import './CookiePolicy.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, emailVerified, checkVerificationStatus, refreshUser } = useAuth();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, already-verified
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const token = searchParams.get('token');

    // Track page view
    trackEmailVerificationPageViewed(!!token);

    if (!token) {
      setStatus('error');
      setMessage('No verification token provided. Please check your email for the correct link.');
      trackEmailVerificationFailed('no_token');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await authAPI.verifyEmail(token);

        // Backend now auto-logs in the user by setting auth cookie
        // Refresh the auth context to pick up the new session
        try {
          await refreshUser();
        } catch (e) {
          // If refreshUser fails, the user will still see success and can manually log in
          console.warn('Could not refresh user after verification:', e);
        }

        if (response.data.alreadyVerified) {
          setStatus('already-verified');
          setMessage('Your email is already verified.');
          trackEmailVerified('already_verified');
        } else {
          setStatus('success');
          setMessage(response.data.message || 'Email verified successfully!');
          trackEmailVerified('new_verification');
        }
      } catch (error) {
        // If verification fails but user is logged in and already verified,
        // show success instead of error (they clicked an old/used link)
        if (isAuthenticated && emailVerified) {
          setStatus('already-verified');
          setMessage('Your email is already verified.');
          trackEmailVerified('already_verified');
        } else if (isAuthenticated) {
          // User is logged in but not verified - check their current status
          const isVerified = await checkVerificationStatus();
          if (isVerified) {
            setStatus('already-verified');
            setMessage('Your email is already verified.');
            trackEmailVerified('already_verified');
          } else {
            setStatus('error');
            setMessage(
              error.response?.data?.error ||
              'Failed to verify email. The link may have expired.'
            );
            trackEmailVerificationFailed(error.response?.data?.error || 'token_expired');
          }
        } else {
          setStatus('error');
          setMessage(
            error.response?.data?.error ||
            'Failed to verify email. The link may have expired.'
          );
          trackEmailVerificationFailed(error.response?.data?.error || 'token_expired');
        }
      }
    };

    verifyEmail();
  }, [searchParams, isAuthenticated, emailVerified, checkVerificationStatus, refreshUser]);

  // Countdown and redirect after success
  // For new verifications, redirect to onboarding page
  // For already-verified, go to dashboard
  useEffect(() => {
    if (status === 'success' || status === 'already-verified') {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // New verification: redirect to onboarding
            // Already verified: go to dashboard (they've already had a chance to complete profile)
            navigate(status === 'success' ? '/onboarding' : '/dashboard');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status, navigate]);

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner" style={{ width: '48px', height: '48px', margin: '0 auto 24px' }}></div>
            <h2 style={{ color: '#fff', marginBottom: '12px' }}>Verifying your email...</h2>
            <p style={{ color: '#999' }}>Please wait a moment.</p>
          </div>
        );

      case 'success':
        return (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ marginBottom: '24px' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', marginBottom: '12px' }}>Email Verified!</h2>
            <p style={{ color: '#999', marginBottom: '24px' }}>{message}</p>
            <p style={{ color: '#999', fontSize: '14px' }}>
              Setting up your account in {countdown} seconds...
            </p>
            <button
              onClick={() => navigate('/onboarding')}
              style={{
                marginTop: '20px',
                padding: '12px 32px',
                background: '#0D0D0D',
                border: '2px solid transparent',
                backgroundImage: 'linear-gradient(#0D0D0D, #0D0D0D), linear-gradient(135deg, #919191 0%, #5A2F30 100%)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Get Started
            </button>
          </div>
        );

      case 'already-verified':
        return (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ marginBottom: '24px' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', marginBottom: '12px' }}>Already Verified</h2>
            <p style={{ color: '#999', marginBottom: '24px' }}>{message}</p>
            <p style={{ color: '#999', fontSize: '14px' }}>
              Redirecting to dashboard in {countdown} seconds...
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                marginTop: '20px',
                padding: '12px 32px',
                background: '#0D0D0D',
                border: '2px solid transparent',
                backgroundImage: 'linear-gradient(#0D0D0D, #0D0D0D), linear-gradient(135deg, #919191 0%, #5A2F30 100%)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Go to Dashboard
            </button>
          </div>
        );

      case 'error':
        return (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ marginBottom: '24px' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', marginBottom: '12px' }}>Verification Failed</h2>
            <p style={{ color: '#999', marginBottom: '24px' }}>{message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/')}
                style={{
                  padding: '12px 32px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                Back to Home
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '12px 32px',
                  background: '#0D0D0D',
                  border: '2px solid transparent',
                  backgroundImage: 'linear-gradient(#0D0D0D, #0D0D0D), linear-gradient(135deg, #919191 0%, #5A2F30 100%)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="policy-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="policy-container" style={{ maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img
            src="https://storage.googleapis.com/doac-perks/e4e508a04084eee9320c875b55dca2cec34de30b.png"
            alt="DOAC"
            style={{ maxWidth: '150px', height: 'auto' }}
          />
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default VerifyEmail;
