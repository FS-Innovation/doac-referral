import { useState, useEffect } from 'react';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const trackClickAndLoadSettings = async () => {
    try {
      console.log('Tracking referral click for code:', code);
      await api.get(`/referral/${code}`);
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
      const response = await api.post('/referral/award-points', { code, platform });
      const webUrl = response.data.webUrl;
      const appUrl = response.data.redirectUrl;

      // For mobile: Try app link with fallback using iframe (silent attempt)
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        let didOpen = false;

        // Create invisible iframe to attempt app launch (prevents error messages)
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = appUrl;
        document.body.appendChild(iframe);

        // Clean up iframe
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);

        // Check if page became hidden (app opened)
        const visibilityChange = () => {
          if (document.hidden) {
            didOpen = true;
          }
        };
        document.addEventListener('visibilitychange', visibilityChange);

        // Fallback to web URL after 2 seconds if app didn't open
        setTimeout(() => {
          document.removeEventListener('visibilitychange', visibilityChange);
          if (!didOpen) {
            window.location.href = webUrl;
          }
        }, 2000);
      } else {
        // Desktop: Use web URL directly (YouTube/Spotify apps auto-open from browser)
        window.location.href = webUrl;
      }
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
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
        color: '#FFF'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #333',
            borderTop: '4px solid #FF0000',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
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
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
        color: '#FFF',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</h1>
          <p style={{ fontSize: '1.125rem' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
        background: '#000000',
        borderBottom: 'none'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: isMobile ? '12px 16px' : '20px 20px',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          height: isMobile ? '60px' : '80px'
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img
              src="https://storage.googleapis.com/doac-perks/e4e508a04084eee9320c875b55dca2cec34de30b.png"
              alt="DOAC Logo"
              style={{
                height: isMobile ? '35px' : '40px',
                width: 'auto',
                objectFit: 'contain',
                cursor: 'pointer'
              }}
            />
          </a>
        </div>
      </header>

      {/* Content */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '16px' : '24px',
        minHeight: 'calc(100vh - 80px)'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%'
        }}>
        {/* Video Thumbnail Card */}
        {settings?.youtube && (
          <div style={{
            padding: '1px',
            borderRadius: '16px',
            background: 'linear-gradient(239.85deg, #FFFFFF 3.78%, #5A2F30 100%)',
            marginBottom: '24px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              background: '#0d0d0d',
              borderRadius: '15px',
              overflow: 'hidden'
            }}>
              <img
                src={settings.youtube.thumbnail}
                alt={settings.youtube.title}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  aspectRatio: '16/9',
                  objectFit: 'cover'
                }}
              />
              <div style={{
                padding: isMobile ? '20px' : '24px'
              }}>
                <h1 style={{
                  fontSize: isMobile ? '1.125rem' : '1.25rem',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#FFF',
                  lineHeight: '1.4',
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {settings.youtube.title}
                </h1>
                <p style={{
                  fontSize: '0.9375rem',
                  color: '#888',
                  fontWeight: '500'
                }}>
                  {settings.youtube.channel}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Platform Selection */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.25rem' : '1.5rem',
            fontWeight: '600',
            color: '#FFF',
            marginBottom: '8px'
          }}>
            Choose Your Platform
          </h2>
          <p style={{
            fontSize: '0.9375rem',
            color: '#888',
            lineHeight: '1.5'
          }}>
            Select where you'd like to listen
          </p>
        </div>

        {/* Platform Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
          gap: '12px'
        }}>
          {/* YouTube Button */}
          <button
            onClick={() => handlePlatformClick('youtube')}
            disabled={redirecting}
            style={{
              background: redirecting ? '#333' : 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
              border: 'none',
              color: '#FFF',
              padding: isMobile ? '18px 24px' : '20px 28px',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: redirecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              opacity: redirecting ? 0.5 : 1,
              boxShadow: redirecting ? 'none' : '0 4px 16px rgba(255, 0, 0, 0.3)',
              transform: redirecting ? 'scale(0.98)' : 'scale(1)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!redirecting) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 0, 0, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!redirecting) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 0, 0, 0.3)';
              }
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            YouTube
          </button>

          {/* Spotify Button */}
          <button
            onClick={() => handlePlatformClick('spotify')}
            disabled={redirecting}
            style={{
              background: redirecting ? '#333' : 'linear-gradient(135deg, #1DB954 0%, #1AA34A 100%)',
              border: 'none',
              color: '#FFF',
              padding: isMobile ? '18px 24px' : '20px 28px',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: redirecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              opacity: redirecting ? 0.5 : 1,
              boxShadow: redirecting ? 'none' : '0 4px 16px rgba(29, 185, 84, 0.3)',
              transform: redirecting ? 'scale(0.98)' : 'scale(1)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!redirecting) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(29, 185, 84, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!redirecting) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(29, 185, 84, 0.3)';
              }
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Spotify
          </button>

          {/* Apple Podcasts Button */}
          <button
            onClick={() => handlePlatformClick('apple')}
            disabled={redirecting}
            style={{
              background: redirecting ? '#333' : 'linear-gradient(135deg, #A259FF 0%, #8B44E6 100%)',
              border: 'none',
              color: '#FFF',
              padding: isMobile ? '18px 24px' : '20px 28px',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: redirecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              opacity: redirecting ? 0.5 : 1,
              boxShadow: redirecting ? 'none' : '0 4px 16px rgba(162, 89, 255, 0.3)',
              transform: redirecting ? 'scale(0.98)' : 'scale(1)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!redirecting) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(162, 89, 255, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!redirecting) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(162, 89, 255, 0.3)';
              }
            }}
          >
            <svg width="28" height="28" viewBox="0 0 300 300" fill="none">
              <path fill="#FFFFFF" d="M175.7,181.1c-0.4-3.6-1.6-6.2-4-8.6c-4.5-4.7-12.4-7.8-21.7-7.8c-9.3,0-17.2,3-21.7,7.8c-2.3,2.5-3.6,5-4,8.6c-0.8,7-0.3,13,0.5,22.7c0.8,9.2,2.3,21.5,4.2,33.9c1.4,8.9,2.5,13.7,3.5,17.1c1.7,5.6,7.8,10.4,17.5,10.4c9.7,0,15.9-4.9,17.5-10.4c1-3.4,2.1-8.2,3.5-17.1c1.9-12.5,3.4-24.7,4.2-33.9C176.1,194.1,176.5,188.1,175.7,181.1z"/>
              <path fill="#FFFFFF" d="M174.6,130.1c0,13.6-11,24.6-24.6,24.6s-24.6-11-24.6-24.6c0-13.6,11-24.6,24.6-24.6S174.6,116.6,174.6,130.1z"/>
              <path fill="#FFFFFF" d="M149.7,33.2C92.3,33.4,45.3,80,44.5,137.4c-0.6,46.5,29.1,86.3,70.6,100.9c1,0.4,2-0.5,1.9-1.5c-0.5-3.6-1.1-7.2-1.5-10.8c-0.2-1.3-1-2.3-2.1-2.9c-32.8-14.3-55.7-47.2-55.3-85.3c0.5-50,41.3-90.7,91.2-91.1c51.1-0.4,92.8,41,92.8,92c0,37.7-22.8,70.1-55.3,84.4c-1.2,0.5-2,1.6-2.1,2.9c-0.5,3.6-1,7.2-1.5,10.8c-0.2,1.1,0.9,1.9,1.9,1.5c41.1-14.4,70.6-53.6,70.6-99.6C255.5,80.5,208,33.1,149.7,33.2z"/>
              <path fill="#FFFFFF" d="M147.3,68.2c-37.4,1.4-67.4,32.3-67.9,69.7c-0.3,24.6,12,46.4,30.9,59.3c0.9,0.6,2.2-0.1,2.2-1.2c-0.3-4.3-0.3-8.1-0.1-12.1c0.1-1.3-0.4-2.5-1.4-3.4c-11.5-10.8-18.5-26.2-18.1-43.2c0.8-30,24.9-54.4,54.9-55.6c32.6-1.3,59.4,24.9,59.4,57.1c0,16.4-7,31.2-18.1,41.7c-0.9,0.9-1.4,2.1-1.4,3.4c0.2,3.9,0.1,7.7-0.1,12c-0.1,1.1,1.2,1.9,2.2,1.2c18.6-12.7,30.9-34.2,30.9-58.4C220.8,98.9,187.5,66.6,147.3,68.2z"/>
            </svg>
            Apple
          </button>
        </div>

        {redirecting && (
          <p style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#666'
          }}>
            Taking you there...
          </p>
        )}
        </div>
      </div>
    </div>
  );
};

export default ReferralLanding;
