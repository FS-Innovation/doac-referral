import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const ReferralLanding = () => {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [redirecting, setRedirecting] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    trackClickAndLoadSettings();
  }, [code]);

  const trackClickAndLoadSettings = async () => {
    try {
      // STEP 1: Track the referral click on the backend (fraud detection happens here)
      console.log('Tracking referral click for code:', code);
      await api.get(`/referral/${code}`);

      // STEP 2: Load platform settings for the buttons
      const response = await api.get('/referral/settings');
      setSettings(response.data);
    } catch (err) {
      console.error('Failed to track click or load settings:', err);
      setError('Failed to load content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformClick = async (platform) => {
    if (redirecting) return;

    setRedirecting(true);
    try {
      // Award points and get redirect URL
      const response = await api.post('/referral/award-points', {
        code,
        platform
      });

      const { redirectUrl } = response.data;

      // Redirect to the platform
      window.location.href = redirectUrl;
    } catch (err) {
      console.error('Failed to process click:', err);
      setError('Failed to redirect. Please try again.');
      setRedirecting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#FFF'
      }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#FFF',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div>
          <h1 style={{ marginBottom: '20px' }}>Oops!</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      color: '#FFF',
      padding: isMobile ? '20px' : '40px'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* DOAC Logo */}
        <img
          src="https://storage.googleapis.com/doac-perks/doac-icon.png"
          alt="DOAC"
          style={{
            width: isMobile ? '80px' : '120px',
            height: isMobile ? '80px' : '120px',
            marginBottom: isMobile ? '30px' : '40px',
            borderRadius: '20px'
          }}
        />

        <h1 style={{
          fontSize: isMobile ? '1.75rem' : '2.5rem',
          fontWeight: '500',
          marginBottom: isMobile ? '16px' : '24px',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          Choose Your Platform
        </h1>

        <p style={{
          fontSize: isMobile ? '1rem' : '1.125rem',
          color: '#B5B5B5',
          marginBottom: isMobile ? '40px' : '60px',
          lineHeight: '1.6',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          Listen to the latest episode of DOAC on your preferred platform
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '16px' : '20px',
          marginBottom: '40px'
        }}>
          {/* YouTube Button */}
          <button
            onClick={() => handlePlatformClick('youtube')}
            disabled={redirecting}
            style={{
              background: redirecting ? '#444' : 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
              border: 'none',
              color: '#FFF',
              padding: isMobile ? '20px 24px' : '24px 32px',
              borderRadius: '12px',
              fontSize: isMobile ? '1.125rem' : '1.25rem',
              fontWeight: '600',
              cursor: redirecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              opacity: redirecting ? 0.6 : 1,
              transform: redirecting ? 'scale(0.98)' : 'scale(1)'
            }}
            onMouseEnter={(e) => {
              if (!redirecting) {
                e.target.style.transform = 'scale(1.02)';
                e.target.style.boxShadow = '0 8px 24px rgba(255, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!redirecting) {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = 'none';
              }
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            Listen on YouTube
          </button>

          {/* Spotify Button */}
          <button
            onClick={() => handlePlatformClick('spotify')}
            disabled={redirecting}
            style={{
              background: redirecting ? '#444' : 'linear-gradient(135deg, #1DB954 0%, #1AA34A 100%)',
              border: 'none',
              color: '#FFF',
              padding: isMobile ? '20px 24px' : '24px 32px',
              borderRadius: '12px',
              fontSize: isMobile ? '1.125rem' : '1.25rem',
              fontWeight: '600',
              cursor: redirecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              opacity: redirecting ? 0.6 : 1,
              transform: redirecting ? 'scale(0.98)' : 'scale(1)'
            }}
            onMouseEnter={(e) => {
              if (!redirecting) {
                e.target.style.transform = 'scale(1.02)';
                e.target.style.boxShadow = '0 8px 24px rgba(29, 185, 84, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!redirecting) {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = 'none';
              }
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Listen on Spotify
          </button>
        </div>

        {redirecting && (
          <p style={{
            fontSize: isMobile ? '0.875rem' : '1rem',
            color: '#666',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
          }}>
            Redirecting...
          </p>
        )}
      </div>
    </div>
  );
};

export default ReferralLanding;
