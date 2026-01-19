import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthModal from '../components/AuthModal';
import Header from '../components/Header';
import { setReferralSourceEpisode } from '../utils/episode';

/**
 * DOAC Landing Page - CRT Screen Experience
 * Features: 3D curved screen, scan lines, chromatic aberration,
 * WebGL-style ripple effects, glowing logo, film grain
 */
const Landing = () => {
  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('login');

  // CRT Effect States
  const [scanLinePos, setScanLinePos] = useState(0);
  const [filmGrain, setFilmGrain] = useState([]);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [ripples, setRipples] = useState([]);
  const [flickerOpacity, setFlickerOpacity] = useState(1);
  const [logoGlow, setLogoGlow] = useState(0.5);

  const containerRef = useRef(null);
  const rippleIdRef = useRef(0);

  // Capture episode ID from URL
  useEffect(() => {
    const episodeVideoId = searchParams.get('e');
    if (episodeVideoId) {
      setReferralSourceEpisode(episodeVideoId);
    }
  }, [searchParams]);

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
    const count = 30;
    for (let i = 0; i < count; i++) {
      grains.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.06 + 0.02,
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
        setFlickerOpacity(0.92 + Math.random() * 0.08);
        setTimeout(() => setFlickerOpacity(1), 50 + Math.random() * 100);
      }
    }, 100);
    return () => clearInterval(flickerInterval);
  }, []);

  // Logo glow pulse
  useEffect(() => {
    let phase = 0;
    const glowInterval = setInterval(() => {
      phase += 0.03;
      setLogoGlow(0.5 + Math.sin(phase) * 0.3);
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

  // Create ripple on click
  const handleClick = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newRipple = {
      id: rippleIdRef.current++,
      x,
      y,
      startTime: Date.now(),
    };
    setRipples(prev => [...prev, newRipple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 1500);
  }, []);

  const handleOpenModal = (mode) => {
    setModalMode(mode);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Text content
  const subtitleText = "Use your referral link to earn points";

  return (
    <>
      {showModal && <Header />}

      {/* Full Screen CRT Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          overflow: 'hidden',
          cursor: 'default',
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
          borderRadius: '8px',
          opacity: flickerOpacity,
        }} />

        {/* Screen curvature vignette - creates the CRT bulge illusion */}
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

        {/* Subtle inner screen glow from logo */}
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '500px',
          height: '500px',
          background: `radial-gradient(ellipse at center,
            rgba(255, 220, 180, ${0.06 * logoGlow}) 0%,
            rgba(255, 200, 150, ${0.03 * logoGlow}) 40%,
            transparent 70%
          )`,
          pointerEvents: 'none',
          filter: 'blur(60px)',
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
          width: '400px',
          height: '400px',
          background: `radial-gradient(circle,
            rgba(255, 240, 220, 0.03) 0%,
            transparent 70%
          )`,
          pointerEvents: 'none',
          transition: 'left 0.3s ease-out, top 0.3s ease-out',
          zIndex: 1,
        }} />

        {/* WebGL-style Ripples */}
        {ripples.map(ripple => {
          const age = (Date.now() - ripple.startTime) / 1000;
          const size = age * 800;
          const opacity = Math.max(0, 1 - age / 1.5);
          return (
            <div
              key={ripple.id}
              style={{
                position: 'absolute',
                left: `${ripple.x}%`,
                top: `${ripple.y}%`,
                transform: 'translate(-50%, -50%)',
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                border: `1px solid rgba(255, 220, 180, ${opacity * 0.3})`,
                boxShadow: `
                  0 0 20px rgba(255, 220, 180, ${opacity * 0.1}),
                  inset 0 0 30px rgba(255, 220, 180, ${opacity * 0.05})
                `,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          );
        })}

        {/* Screen edge highlight - 3D depth */}
        <div style={{
          position: 'absolute',
          inset: '20px',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          boxShadow: `
            inset 0 0 100px rgba(0, 0, 0, 0.5),
            inset 0 2px 0 rgba(255, 255, 255, 0.02)
          `,
          pointerEvents: 'none',
          zIndex: 103,
        }} />

        {/* Main Content */}
        <div style={{
          position: 'relative',
          zIndex: 110,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '40px 20px',
        }}>
          {/* DOAC Logo - IN FRONT OF SCAN LINES */}
          <div style={{
            position: 'relative',
            marginBottom: '50px',
            zIndex: 110,
          }}>
            {/* Subtle logo glow */}
            <div style={{
              position: 'absolute',
              inset: '-40px',
              background: `radial-gradient(ellipse at center,
                rgba(255, 220, 180, ${0.08 * logoGlow}) 0%,
                rgba(255, 200, 150, ${0.04 * logoGlow}) 50%,
                transparent 80%
              )`,
              filter: 'blur(25px)',
              pointerEvents: 'none',
            }} />

            {/* Main logo */}
            <img
              src="https://storage.googleapis.com/doac-perks/e4e508a04084eee9320c875b55dca2cec34de30b.png"
              alt="DOAC Logo"
              style={{
                position: 'relative',
                width: '280px',
                height: 'auto',
                filter: `drop-shadow(0 0 15px rgba(255, 220, 180, ${0.15 * logoGlow}))`,
              }}
            />
          </div>

          {/* Main tagline - simple and clean */}
          <h2 style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '1.4rem',
            fontWeight: '300',
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            margin: 0,
            marginBottom: '30px',
          }}>
            {subtitleText}
          </h2>

          {/* Description */}
          <p style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '0.95rem',
            fontWeight: '300',
            color: 'rgba(255, 255, 255, 0.45)',
            textAlign: 'center',
            maxWidth: '450px',
            lineHeight: 1.8,
            marginBottom: '50px',
            textShadow: '0 0 20px rgba(255, 220, 180, 0.05)',
          }}>
            Your unique referral link takes you directly to the latest episode of DOAC.
            Every time someone clicks on your link, you earn points.
            These points can then be used to redeem exclusive prizes.
          </p>

          {/* CRT-style Buttons */}
          <div style={{
            display: 'flex',
            gap: '20px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {/* Login Button */}
            <button
              onClick={() => handleOpenModal('login')}
              style={{
                position: 'relative',
                padding: '16px 48px',
                background: 'rgba(255, 250, 240, 0.95)',
                border: 'none',
                borderRadius: '12px',
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontSize: '1rem',
                fontWeight: '600',
                color: '#2a1f10',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: `
                  0 4px 20px rgba(255, 200, 150, 0.3),
                  0 0 40px rgba(255, 220, 180, 0.1)
                `,
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 200, 150, 0.4), 0 0 60px rgba(255, 220, 180, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 200, 150, 0.3), 0 0 40px rgba(255, 220, 180, 0.1)';
              }}
            >
              {/* Button scan line */}
              <span style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                borderRadius: '12px',
                pointerEvents: 'none',
              }}>
                <span style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.08) 50%, transparent 100%)',
                  animation: 'buttonScan 6s ease-in-out infinite',
                  animationDelay: '0.3s',
                }} />
              </span>
              <span style={{ position: 'relative' }}>Login</span>
            </button>

            {/* Get Started Button */}
            <button
              onClick={() => handleOpenModal('register')}
              style={{
                position: 'relative',
                padding: '16px 48px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontSize: '1rem',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.9)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                backdropFilter: 'blur(10px)',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 220, 180, 0.3)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.3), 0 0 40px rgba(255, 220, 180, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Button scan line */}
              <span style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                borderRadius: '12px',
                pointerEvents: 'none',
              }}>
                <span style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%)',
                  animation: 'buttonScan 7s ease-in-out infinite',
                  animationDelay: '2.5s',
                }} />
              </span>
              <span style={{ position: 'relative' }}>Get Started</span>
            </button>
          </div>
        </div>

        {/* Corner screen reflections */}
        <div style={{
          position: 'absolute',
          top: '30px',
          left: '30px',
          width: '200px',
          height: '100px',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)',
          borderRadius: '50%',
          filter: 'blur(20px)',
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

      {showModal && (
        <AuthModal
          mode={modalMode}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default Landing;
