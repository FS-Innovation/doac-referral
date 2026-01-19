import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

/**
 * Email Confirmation Page - Shown after registration
 * User must verify their email before proceeding to dashboard
 * This is a BLOCKING step - they can't continue without verification
 */
const EmailConfirmation = () => {
  const { user, emailVerified, checkVerificationStatus, logout } = useAuth();
  const navigate = useNavigate();

  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);

  // If already verified, redirect to profile completion (or dashboard if profile done)
  useEffect(() => {
    if (emailVerified) {
      navigate('/profile/complete');
    }
  }, [emailVerified, navigate]);

  // Poll for verification status every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!emailVerified) {
        setChecking(true);
        await checkVerificationStatus();
        setChecking(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [emailVerified, checkVerificationStatus]);

  const handleResend = async () => {
    if (resending) return;

    setResending(true);
    setMessage('');

    try {
      await authAPI.resendVerification();
      setMessage('Verification email sent! Check your inbox.');
    } catch (error) {
      if (error.response?.status === 429) {
        const waitTime = error.response?.data?.waitTime || 60;
        setMessage(`Please wait ${waitTime} seconds before requesting again.`);
      } else {
        setMessage(error.response?.data?.error || 'Failed to send email. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    await checkVerificationStatus();
    setChecking(false);

    if (!emailVerified) {
      setMessage('Email not verified yet. Please check your inbox and click the verification link.');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0D0D',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Email Icon */}
        <div style={{ marginBottom: '24px' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#919191" strokeWidth="1.5" style={{ opacity: 0.8 }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>

        <h1 style={{
          color: '#FFF',
          fontSize: '28px',
          fontWeight: '600',
          marginBottom: '12px'
        }}>
          Check your email
        </h1>

        <p style={{
          color: '#999',
          fontSize: '16px',
          marginBottom: '8px',
          lineHeight: '1.5'
        }}>
          We sent a verification link to
        </p>

        <p style={{
          color: '#FFF',
          fontSize: '16px',
          fontWeight: '500',
          marginBottom: '32px'
        }}>
          {user?.email}
        </p>

        <p style={{
          color: '#666',
          fontSize: '14px',
          marginBottom: '24px',
          lineHeight: '1.5'
        }}>
          Click the link in your email to verify your account and continue.
        </p>

        {/* Feedback message */}
        {message && (
          <p style={{
            color: message.includes('sent') ? '#4ade80' : '#999',
            fontSize: '14px',
            marginBottom: '16px',
            padding: '12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px'
          }}>
            {message}
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleCheckNow}
            disabled={checking}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #919191 0%, #5A2F30 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#FFF',
              fontSize: '16px',
              fontWeight: '600',
              cursor: checking ? 'not-allowed' : 'pointer',
              opacity: checking ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
          >
            {checking ? 'Checking...' : "I've verified my email"}
          </button>

          <button
            onClick={handleResend}
            disabled={resending}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: 'transparent',
              border: '1px solid rgba(145, 145, 145, 0.3)',
              borderRadius: '8px',
              color: '#999',
              fontSize: '14px',
              fontWeight: '500',
              cursor: resending ? 'not-allowed' : 'pointer',
              opacity: resending ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
          >
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>
        </div>

        {/* Wrong email? */}
        <p style={{
          color: '#666',
          fontSize: '13px',
          marginTop: '32px'
        }}>
          Wrong email?{' '}
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#919191',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Sign up with a different email
          </button>
        </p>
      </div>
    </div>
  );
};

export default EmailConfirmation;
