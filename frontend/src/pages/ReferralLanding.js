import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api, { episodesAPI } from '../services/api';
import { getYouTubeThumbnail, setReferralSourceEpisode } from '../utils/episode';

/**
 * Referral Landing Page - CRT Screen Experience
 * Features: 3D curved screen, scan lines, chromatic aberration,
 * WebGL-style ripple effects, glowing elements, film grain
 * Primary focus: Get user to click through to episode
 */
const ReferralLanding = () => {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [episode, setEpisode] = useState(null);
  const [error, setError] = useState(null);
  const [redirecting, setRedirecting] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // CRT Effect States
  const [scanLinePos, setScanLinePos] = useState(0);
  const [filmGrain, setFilmGrain] = useState([]);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [flickerOpacity, setFlickerOpacity] = useState(1);
  const [cardGlow, setCardGlow] = useState(0.5);

  const containerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Animated scan line
  useEffect(() => {
    const scanInterval = setInterval(() => {
      setScanLinePos(prev => (prev + 0.3) % 120);
    }, 16);
    return () => clearInterval(scanInterval);
  }, []);

  // Film grain generation
  const createFilmGrain = useCallback(() => {
    const grains = [];
    const count = 25;
    for (let i = 0; i < count; i++) {
      grains.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.05 + 0.02,
      });
    }
    return grains;
  }, []);

  useEffect(() => {
    const grainInterval = setInterval(() => {
      setFilmGrain(createFilmGrain());
    }, 100);
    return () => clearInterval(grainInterval);
  }, [createFilmGrain]);

  // Subtle flicker effect
  useEffect(() => {
    const flickerInterval = setInterval(() => {
      if (Math.random() > 0.97) {
        setFlickerOpacity(0.94 + Math.random() * 0.06);
        setTimeout(() => setFlickerOpacity(1), 50 + Math.random() * 100);
      }
    }, 100);
    return () => clearInterval(flickerInterval);
  }, []);

  // Card glow pulse
  useEffect(() => {
    let phase = 0;
    const glowInterval = setInterval(() => {
      phase += 0.025;
      setCardGlow(0.5 + Math.sin(phase) * 0.25);
    }, 30);
    return () => clearInterval(glowInterval);
  }, []);

  // Mouse tracking for effects
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  }, []);

  useEffect(() => {
    trackClickAndLoadEpisode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const trackClickAndLoadEpisode = async () => {
    try {
      console.log('Tracking referral click for code:', code);
      // Track the click
      await api.get(`/referral/${code}`);

      // Get episode ID from query params (e.g., ?e=123)
      const episodeId = searchParams.get('e');

      // Store episode ID in sessionStorage for deep link preservation
      // This allows the Dashboard to pre-select this episode after signup/login
      if (episodeId) {
        setReferralSourceEpisode(episodeId);
      }

      // Fetch the specific episode or latest if not specified
      const response = await episodesAPI.getForReferral(code, episodeId);
      setEpisode(response.data);
    } catch (err) {
      console.error('Failed to track click or load episode:', err);
      setError('Failed to load content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformClick = async (platform) => {
    if (redirecting) return;
    setRedirecting(true);
    try {
      // Pass episode ID so backend uses correct URLs for this episode
      console.log(`Platform click: platform=${platform}, episodeId=${episode?.id}, episode=`, episode);
      const response = await api.post('/referral/award-points', {
        code,
        platform,
        episodeId: episode?.id
      });
      console.log('Award points response:', response.data);
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
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        overflow: 'hidden'
      }}>
        {/* CRT Background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 120% 100% at 50% 50%,
            rgba(8, 8, 12, 1) 0%,
            rgba(5, 5, 8, 1) 40%,
            rgba(0, 0, 3, 1) 70%,
            rgba(0, 0, 0, 1) 100%
          )`
        }} />
        {/* Scan lines */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 2px,
            rgba(0, 0, 0, 0.15) 2px,
            rgba(0, 0, 0, 0.15) 4px
          )`,
          pointerEvents: 'none'
        }} />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 10 }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderTop: '2px solid rgba(255, 220, 180, 0.8)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
            boxShadow: '0 0 20px rgba(255, 220, 180, 0.2)'
          }} />
          <p style={{
            marginTop: '20px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.875rem',
            fontFamily: "'Inter', -apple-system, sans-serif"
          }}>Loading...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        overflow: 'hidden'
      }}>
        {/* CRT Background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 120% 100% at 50% 50%,
            rgba(8, 8, 12, 1) 0%,
            rgba(5, 5, 8, 1) 40%,
            rgba(0, 0, 3, 1) 70%,
            rgba(0, 0, 0, 1) 100%
          )`
        }} />
        {/* Scan lines */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 2px,
            rgba(0, 0, 0, 0.15) 2px,
            rgba(0, 0, 0, 0.15) 4px
          )`,
          pointerEvents: 'none'
        }} />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 10, padding: '20px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(255, 100, 100, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 30px rgba(255, 100, 100, 0.2)'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 150, 150, 0.8)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.7)',
            fontFamily: "'Inter', -apple-system, sans-serif"
          }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      {/* 3D Curved Screen Effect - Multiple layers for depth */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse 120% 100% at 50% 50%,
            rgba(8, 8, 12, 1) 0%,
            rgba(5, 5, 8, 1) 40%,
            rgba(0, 0, 3, 1) 70%,
            rgba(0, 0, 0, 1) 100%
          )
        `,
        opacity: flickerOpacity,
      }} />

      {/* Screen curvature vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse 80% 70% at 50% 50%,
            transparent 0%,
            transparent 50%,
            rgba(0, 0, 0, 0.3) 70%,
            rgba(0, 0, 0, 0.7) 85%,
            rgba(0, 0, 0, 0.95) 100%
          )
        `,
        pointerEvents: 'none',
      }} />

      {/* Subtle glow from content area */}
      <div style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: `radial-gradient(ellipse at center,
          rgba(255, 220, 180, ${0.04 * cardGlow}) 0%,
          rgba(255, 200, 150, ${0.02 * cardGlow}) 40%,
          transparent 70%
        )`,
        pointerEvents: 'none',
        filter: 'blur(80px)',
      }} />

      {/* Horizontal scan lines - CRT signature */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent 0px,
          transparent 2px,
          rgba(0, 0, 0, 0.15) 2px,
          rgba(0, 0, 0, 0.15) 4px
        )`,
        pointerEvents: 'none',
        zIndex: 100,
      }} />

      {/* Moving scan line */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${scanLinePos - 10}%`,
        height: '2px',
        background: `linear-gradient(90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.03) 20%,
          rgba(255, 255, 255, 0.06) 50%,
          rgba(255, 255, 255, 0.03) 80%,
          transparent 100%
        )`,
        boxShadow: '0 0 20px rgba(255, 255, 255, 0.05)',
        pointerEvents: 'none',
        zIndex: 101,
      }} />

      {/* Secondary slower scan line */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${((scanLinePos * 0.7) + 60) % 120 - 10}%`,
        height: '1px',
        background: `linear-gradient(90deg,
          transparent 0%,
          rgba(255, 220, 180, 0.02) 30%,
          rgba(255, 220, 180, 0.04) 50%,
          rgba(255, 220, 180, 0.02) 70%,
          transparent 100%
        )`,
        pointerEvents: 'none',
        zIndex: 101,
      }} />

      {/* Film grain */}
      {filmGrain.map(grain => (
        <div
          key={grain.id}
          style={{
            position: 'absolute',
            left: `${grain.x}%`,
            top: `${grain.y}%`,
            width: `${grain.size}px`,
            height: `${grain.size}px`,
            borderRadius: '50%',
            background: `rgba(255, 255, 255, ${grain.opacity})`,
            pointerEvents: 'none',
            zIndex: 102,
          }}
        />
      ))}

      {/* Mouse-following ambient glow */}
      <div style={{
        position: 'absolute',
        left: `${mousePos.x}%`,
        top: `${mousePos.y}%`,
        transform: 'translate(-50%, -50%)',
        width: '350px',
        height: '350px',
        background: `radial-gradient(circle,
          rgba(255, 240, 220, 0.025) 0%,
          transparent 70%
        )`,
        pointerEvents: 'none',
        transition: 'left 0.3s ease-out, top 0.3s ease-out',
        zIndex: 1,
      }} />

      {/* Screen edge highlight */}
      <div style={{
        position: 'absolute',
        inset: '15px',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.02)',
        boxShadow: `
          inset 0 0 80px rgba(0, 0, 0, 0.4),
          inset 0 2px 0 rgba(255, 255, 255, 0.015)
        `,
        pointerEvents: 'none',
        zIndex: 103,
      }} />

      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: 'transparent',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: isMobile ? '16px 20px' : '24px 32px',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img
              src="https://storage.googleapis.com/doac-perks/e4e508a04084eee9320c875b55dca2cec34de30b.png"
              alt="DOAC Logo"
              style={{
                height: isMobile ? '32px' : '38px',
                width: 'auto',
                objectFit: 'contain',
                cursor: 'pointer',
                filter: `drop-shadow(0 0 12px rgba(255, 220, 180, ${0.12 * cardGlow}))`,
                transition: 'filter 0.3s ease',
              }}
            />
          </a>
        </div>
      </header>

      {/* Main Content - Fixed viewport, no scroll */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 110,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '60px 16px 20px' : '70px 24px 24px',
        overflow: 'hidden',
      }}>
        <div style={{
          maxWidth: '440px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '16px' : '20px',
        }}>
          {/* Platform Selection */}
          <div style={{
            textAlign: 'center',
          }}>
            <h2 style={{
              fontSize: isMobile ? '1.2rem' : '1.4rem',
              fontWeight: '500',
              color: '#FFFFFF',
              marginBottom: '6px',
              textShadow: '0 0 30px rgba(255, 255, 255, 0.1)',
              letterSpacing: '-0.02em',
            }}>
              Choose Your Platform
            </h2>
            <p style={{
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              color: 'rgba(255, 255, 255, 0.5)',
              lineHeight: '1.4',
            }}>
              Select where you'd like to listen
            </p>
          </div>

          {/* Platform Buttons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: isMobile ? '8px' : '10px',
          }}>
          {/* YouTube Button */}
          <button
            onClick={() => handlePlatformClick('youtube')}
            disabled={redirecting}
            style={{
              background: redirecting ? '#333' : 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
              border: 'none',
              color: '#FFF',
              padding: isMobile ? '12px 8px' : '14px 12px',
              borderRadius: '10px',
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: '600',
              cursor: redirecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? '4px' : '8px',
              opacity: redirecting ? 0.5 : 1,
              boxShadow: redirecting ? 'none' : '0 4px 12px rgba(255, 0, 0, 0.25)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <svg width={isMobile ? "18" : "18"} height={isMobile ? "18" : "18"} viewBox="0 0 24 24" fill="currentColor">
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
              padding: isMobile ? '12px 8px' : '14px 12px',
              borderRadius: '10px',
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: '600',
              cursor: redirecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? '4px' : '8px',
              opacity: redirecting ? 0.5 : 1,
              boxShadow: redirecting ? 'none' : '0 4px 12px rgba(29, 185, 84, 0.25)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <svg width={isMobile ? "18" : "18"} height={isMobile ? "18" : "18"} viewBox="0 0 24 24" fill="currentColor">
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
              padding: isMobile ? '12px 8px' : '14px 12px',
              borderRadius: '10px',
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: '600',
              cursor: redirecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? '4px' : '8px',
              opacity: redirecting ? 0.5 : 1,
              boxShadow: redirecting ? 'none' : '0 4px 12px rgba(162, 89, 255, 0.25)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <svg width={isMobile ? "18" : "18"} height={isMobile ? "18" : "18"} viewBox="0 0 300 300" fill="none">
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
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'rgba(255, 255, 255, 0.4)',
            }}>
              Taking you there...
            </p>
          )}

          {/* Episode Card - Glowing CRT style */}
          {episode && (
            <div style={{
              position: 'relative',
            }}>
              {/* Outer glow - simulates CRT phosphor glow */}
              <div style={{
                position: 'absolute',
                inset: '-16px',
                background: `radial-gradient(ellipse at center,
                  rgba(255, 220, 180, ${0.12 * cardGlow}) 0%,
                  rgba(255, 200, 150, ${0.06 * cardGlow}) 40%,
                  transparent 70%
                )`,
                filter: 'blur(16px)',
                pointerEvents: 'none',
              }} />
              {/* Card with glow and silver border */}
              <div style={{
                position: 'relative',
                background: 'rgba(10, 10, 15, 0.95)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: `
                  0 0 ${25 + cardGlow * 20}px rgba(255, 220, 180, ${0.1 * cardGlow}),
                  0 0 ${50 + cardGlow * 30}px rgba(255, 200, 150, ${0.05 * cardGlow}),
                  0 8px 32px rgba(0, 0, 0, 0.5),
                  inset 0 1px 0 rgba(255, 255, 255, 0.08)
                `,
              }}>
                {/* Thumbnail */}
                <div style={{ position: 'relative' }}>
                  <img
                    src={getYouTubeThumbnail(episode.youtube_video_id)}
                    alt={episode.title}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      aspectRatio: '16/9',
                      objectFit: 'cover',
                    }}
                  />
                  {/* CRT scan lines on image */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `repeating-linear-gradient(
                      0deg,
                      transparent 0px,
                      transparent 2px,
                      rgba(0, 0, 0, 0.12) 2px,
                      rgba(0, 0, 0, 0.12) 4px
                    )`,
                    pointerEvents: 'none',
                  }} />
                  {/* Screen curvature illusion */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(ellipse 100% 100% at 50% 50%,
                      transparent 60%,
                      rgba(0, 0, 0, 0.25) 100%
                    )`,
                    pointerEvents: 'none',
                  }} />
                </div>
                {/* Episode info */}
                <div style={{
                  padding: isMobile ? '10px 12px' : '12px 14px',
                }}>
                  <h1 style={{
                    fontSize: isMobile ? '0.85rem' : '0.95rem',
                    fontWeight: '600',
                    marginBottom: '3px',
                    color: '#FFFFFF',
                    lineHeight: '1.3',
                    display: '-webkit-box',
                    WebkitLineClamp: '2',
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {episode.title}
                  </h1>
                  {episode.description && (
                    <p style={{
                      fontSize: isMobile ? '0.7rem' : '0.75rem',
                      color: 'rgba(255, 255, 255, 0.45)',
                      fontWeight: '400',
                      lineHeight: '1.35',
                      display: '-webkit-box',
                      WebkitLineClamp: '2',
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      margin: 0,
                    }}>
                      {episode.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CTA - Subtle text, link pops on new line */}
          <div style={{
            textAlign: 'center',
            padding: isMobile ? '8px 0' : '12px 0',
          }}>
            <p style={{
              margin: '0 0 4px 0',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: isMobile ? '0.75rem' : '0.8rem',
            }}>
              Want to start earning rewards?
            </p>
            <a
              href="/"
              style={{
                display: 'inline-block',
                color: '#FFFFFF',
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                fontWeight: '600',
                textDecoration: 'underline',
                textUnderlineOffset: '4px',
                textDecorationColor: 'rgba(255, 255, 255, 0.5)',
                letterSpacing: '0.01em',
                textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              Get your own link
            </a>
          </div>
        </div>
      </div>

      {/* Corner screen reflections */}
      <div style={{
        position: 'absolute',
        top: '25px',
        left: '25px',
        width: '180px',
        height: '90px',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.015) 0%, transparent 100%)',
        borderRadius: '50%',
        filter: 'blur(15px)',
        pointerEvents: 'none',
        zIndex: 104,
      }} />

      {/* Animations */}
      <style>{`
        @keyframes buttonScan {
          0% { top: -2px; }
          100% { top: calc(100% + 2px); }
        }
      `}</style>
    </div>
  );
};

export default ReferralLanding;
