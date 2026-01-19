import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * PrizeRail - DOAC Trailer-Inspired CRT Glitch Experience
 * Matching the aesthetic of SplitFlapCounter and CopyLinkBar
 * Features: Glitch text, chromatic aberration, scan lines, film grain
 */
const PrizeRail = ({
  prizes = [],
  userPoints = 0,
  onRedeem,
  isMobile = false,
  claimingId = null,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredProgress, setHoveredProgress] = useState(null);
  const [hoveredCardPosition, setHoveredCardPosition] = useState({ pullX: 0, pullY: 0, rotateX: 0, rotateY: 0 });
  const [buttonHovered, setButtonHovered] = useState(null);
  const [globalTime, setGlobalTime] = useState(0);

  // Glitch state for progress indicators
  const [progressGlitchChars, setProgressGlitchChars] = useState({});

  // Mouse tracking for reactive effects (matching points section - smooth interpolation)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const targetMousePos = useRef({ x: 50, y: 50 });

  // Card-specific hover effects - small static particles (matching points section)
  const [staticParticles, setStaticParticles] = useState([]);
  const [filmGrain, setFilmGrain] = useState([]);

  const containerRef = useRef(null);
  const cardRefs = useRef({});
  const progressGlitchTimers = useRef({});
  const hoverAnimationRef = useRef(null);

  const glitchChars = '0123456789@#$%&*!?░▒▓█▀▄';

  // Card dimensions
  const cardWidth = isMobile ? 280 : 320;
  const cardGap = isMobile ? 16 : 24;
  const visibleCards = isMobile ? 1.15 : 2.5;

  // Animate global time for effects
  useEffect(() => {
    let animFrame;
    const animate = () => {
      setGlobalTime(t => t + 0.016);
      animFrame = requestAnimationFrame(animate);
    };
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, []);

  // Create small static particles for card hover effect - slower, more intentional
  const createStaticParticles = useCallback((centerX, centerY) => {
    const particles = [];
    const count = 6 + Math.floor(Math.random() * 4); // 6-10 particles (fewer, more intentional)
    const spread = 80; // Wider spread for more ambient feel

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * spread; // Start further from center
      particles.push({
        id: i,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        size: Math.random() * 2 + 1, // Slightly larger, more visible
        opacity: Math.random() * 0.25 + 0.08, // Subtler
        char: Math.random() > 0.8 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : null,
        lifetime: Math.random() * 1.5 + 1, // Longer lifetime
      });
    }
    return particles;
  }, [glitchChars]);

  // Create film grain for hover effect
  const createFilmGrain = useCallback((centerX = 50, centerY = 50) => {
    const grains = [];
    const count = isMobile ? 15 : 25;
    for (let i = 0; i < count; i++) {
      // Some grains cluster near mouse, others are random
      const nearMouse = Math.random() > 0.4;
      const x = nearMouse
        ? centerX + (Math.random() - 0.5) * 50
        : Math.random() * 100;
      const y = nearMouse
        ? centerY + (Math.random() - 0.5) * 40
        : Math.random() * 100;
      grains.push({
        id: i,
        x,
        y,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.15 + 0.03,
      });
    }
    return grains;
  }, [isMobile]);

  // Mouse tracking - update target, animation loop handles smooth interpolation
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || isMobile) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    targetMousePos.current = { x, y };
  }, [isMobile]);

  const handleMouseEnter = useCallback(() => {
    if (isMobile) return;
    setIsHovering(true);
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  // Smooth hover animation loop with static particles (matching points section physics)
  useEffect(() => {
    let frameCount = 0;

    if (isHovering && !isMobile) {
      const animateHover = () => {
        frameCount++;

        // Smooth interpolation toward target (easing factor 0.08 for smooth movement)
        setMousePos(prev => ({
          x: prev.x + (targetMousePos.current.x - prev.x) * 0.08,
          y: prev.y + (targetMousePos.current.y - prev.y) * 0.08,
        }));

        // Create static particles following mouse (every 8 frames - slower, more intentional)
        if (frameCount % 8 === 0 && hoveredIndex !== null) {
          setStaticParticles(createStaticParticles(targetMousePos.current.x, targetMousePos.current.y));
        }

        // Update film grain (every 12 frames - slower)
        if (frameCount % 12 === 0 && hoveredIndex !== null) {
          setFilmGrain(createFilmGrain(targetMousePos.current.x, targetMousePos.current.y));
        }

        hoverAnimationRef.current = requestAnimationFrame(animateHover);
      };
      hoverAnimationRef.current = requestAnimationFrame(animateHover);
    } else {
      // Smooth decay when not hovering
      const decay = () => {
        let stillDecaying = false;

        setMousePos(prev => {
          const targetX = 50;
          const targetY = 50;
          const newX = prev.x + (targetX - prev.x) * 0.05;
          const newY = prev.y + (targetY - prev.y) * 0.05;
          if (Math.abs(newX - targetX) > 0.5 || Math.abs(newY - targetY) > 0.5) {
            stillDecaying = true;
          }
          return { x: newX, y: newY };
        });

        // Fade out particles naturally
        setStaticParticles(prev => {
          if (prev.length === 0) return prev;
          stillDecaying = true;
          return prev.map(p => ({ ...p, opacity: p.opacity * 0.92 }))
            .filter(p => p.opacity > 0.02);
        });

        // Fade out film grain naturally
        setFilmGrain(prev => {
          if (prev.length === 0) return prev;
          stillDecaying = true;
          return prev.map(g => ({ ...g, opacity: g.opacity * 0.95 }))
            .filter(g => g.opacity > 0.01);
        });

        if (stillDecaying) {
          hoverAnimationRef.current = requestAnimationFrame(decay);
        }
      };
      hoverAnimationRef.current = requestAnimationFrame(decay);
    }

    return () => {
      if (hoverAnimationRef.current) {
        cancelAnimationFrame(hoverAnimationRef.current);
      }
    };
  }, [isHovering, isMobile, hoveredIndex, createStaticParticles, createFilmGrain]);

  // Generate glitch string matching the length of progress text (e.g., "10%" = 3 chars)
  const generateGlitchString = useCallback((length) => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += glitchChars[Math.floor(Math.random() * glitchChars.length)];
    }
    return result;
  }, []);

  // Trigger glitch effect on progress indicator
  const triggerProgressGlitch = useCallback((index, progress) => {
    if (progressGlitchTimers.current[index]) return;

    // Calculate the length of the progress text (e.g., "5%" = 2, "10%" = 3, "100%" = 4)
    const progressText = `${Math.round(progress)}%`;
    const textLength = progressText.length;

    let glitchCount = 0;
    const maxGlitches = 6 + Math.floor(Math.random() * 4);
    const interval = 60 + Math.random() * 30;

    const glitch = () => {
      glitchCount++;
      if (glitchCount < maxGlitches) {
        setProgressGlitchChars(prev => ({
          ...prev,
          [index]: generateGlitchString(textLength)
        }));
      } else {
        setProgressGlitchChars(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
        clearInterval(progressGlitchTimers.current[index]);
        delete progressGlitchTimers.current[index];
      }
    };

    progressGlitchTimers.current[index] = setInterval(glitch, interval);
    glitch();
  }, [generateGlitchString]);

  // Cleanup glitch timers
  useEffect(() => {
    const timers = progressGlitchTimers.current;
    return () => {
      Object.values(timers).forEach(timer => clearInterval(timer));
    };
  }, []);

  // Find first unlocked prize
  useEffect(() => {
    const firstUnlockedIndex = prizes.findIndex(p => p.status === 'unlocked');
    if (firstUnlockedIndex !== -1) setActiveIndex(firstUnlockedIndex);
  }, [prizes]);

  // Calculate pull direction toward mouse position
  const calculatePullTowardMouse = useCallback((cardElement, mouseX, mouseY) => {
    if (!cardElement) return { pullX: 0, pullY: 0, rotateX: 0, rotateY: 0 };

    const rect = cardElement.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const cardCenterY = rect.top + rect.height / 2;

    // Calculate mouse position relative to card center
    const deltaX = mouseX - cardCenterX;
    const deltaY = mouseY - cardCenterY;

    // Scale the pull (subtle - max ~20px)
    const maxPull = 20;
    const pullX = (deltaX / rect.width) * maxPull;
    const pullY = (deltaY / rect.height) * maxPull * 0.6; // Less vertical

    // Calculate rotation to "point" toward mouse (card tilts toward cursor)
    const rotateY = (deltaX / rect.width) * 15; // Rotate around Y axis
    const rotateX = -(deltaY / rect.height) * 10; // Tilt forward/back

    return { pullX, pullY, rotateX, rotateY };
  }, []);

  // Update pull position on mouse move
  const handleCardMouseMove = useCallback((e, index, cardElement) => {
    if (isMobile || !cardElement) return;
    const pullData = calculatePullTowardMouse(cardElement, e.clientX, e.clientY);
    setHoveredCardPosition(pullData);
  }, [calculatePullTowardMouse, isMobile]);

  // Handle card hover enter
  const handleCardHover = useCallback((index, cardElement, e) => {
    setHoveredIndex(index);
    if (cardElement && !isMobile && e) {
      const pullData = calculatePullTowardMouse(cardElement, e.clientX, e.clientY);
      setHoveredCardPosition(pullData);
    }
  }, [calculatePullTowardMouse, isMobile]);

  // Navigation - center-focused carousel
  const goToCard = useCallback((index) => {
    // Clamp to valid range (0 to last card)
    const clampedIndex = Math.max(0, Math.min(index, prizes.length - 1));
    setActiveIndex(clampedIndex);
  }, [prizes.length]);

  const goNext = () => goToCard(activeIndex + 1);
  const goPrev = () => goToCard(activeIndex - 1);

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < prizes.length - 1;

  // Touch swipe for mobile only
  const [touchStart, setTouchStart] = useState(0);
  const [touchDelta, setTouchDelta] = useState(0);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
    setTouchDelta(0);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;
    const delta = e.touches[0].clientX - touchStart;
    setTouchDelta(delta);
  };

  const handleTouchEnd = () => {
    if (touchDelta > 50) goPrev();
    else if (touchDelta < -50) goNext();
    setTouchStart(0);
    setTouchDelta(0);
  };

  // Handle card click - if centered and unlocked, redeem; otherwise center the card
  const handleCardClick = useCallback((prize, index) => {
    if (index === activeIndex) {
      // Card is already centered - trigger action if unlocked
      if (prize.status === 'unlocked' && !claimingId) {
        onRedeem?.(prize);
      }
    } else {
      // Card is not centered - center it
      goToCard(index);
    }
  }, [activeIndex, claimingId, onRedeem, goToCard]);

  // Calculate transform to center the active card
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const padding = isMobile ? 40 : 120; // Account for padding (20px each side mobile, 60px desktop)
        setContainerWidth(containerRef.current.offsetWidth - padding);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isMobile]);

  // Center the active card: move rail so active card is in center
  const centerOffset = containerWidth / 2 - cardWidth / 2;
  const railTransform = centerOffset - (activeIndex * (cardWidth + cardGap)) + (isMobile ? touchDelta : 0);

  // Product images
  const getProductImage = (prize) => {
    if (prize.prize_type === 'discount_code') return 'https://thediary.com/cdn/shop/files/1_DIARY_PopUpCardsWhite.png?v=1764327518&width=800';
    if (prize.name?.includes('Vol. 1') || prize.name?.includes('Vol 1')) return 'https://thediary.com/cdn/shop/files/1_e87b669d-04ab-4f85-81c8-df353bbb2188.png?v=1749210128&width=700';
    if (prize.name?.includes('Vol. 2') || prize.name?.includes('Vol 2')) return 'https://thediary.com/cdn/shop/files/1_b75fbc90-9bfe-49f2-baf5-3767c7992627.png?v=1762444332&width=700';
    if (prize.name?.includes('Vol. 3') || prize.name?.includes('Vol 3') || prize.name?.includes('Game Edition')) return 'https://thediary.com/cdn/shop/files/CC3_Web_Image_3.jpg?v=1762859458&width=1000';
    if (prize.name?.includes('1% Diary') || prize.name?.includes('Diary')) return 'https://thediary.com/cdn/shop/files/No_matter_your_goal_1_d1605690-ab79-45f3-a83d-f9d21e8223bc.png?v=1763725505&width=1000';
    if (prize.is_mystery) return 'https://storage.googleapis.com/doac-perks/edited-photo.webp';
    return null;
  };

  const getProgress = (prize) => {
    if (prize.is_mystery) return 0;
    if (prize.status === 'unlocked') return 100;
    return Math.min(100, (userPoints / prize.points_required) * 100);
  };

  const getPointsNeeded = (prize) => {
    if (prize.is_mystery) return '???';
    return Math.max(0, prize.points_required - userPoints).toLocaleString();
  };

  // Format progress as glitchy text
  const formatProgressText = (progress, index, isGlitching) => {
    if (isGlitching && progressGlitchChars[index]) {
      return progressGlitchChars[index];
    }
    return `${Math.round(progress)}%`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: '100%',
        maxWidth: '100vw',
        position: 'relative',
        padding: isMobile ? '0' : '0 60px',
        overflow: 'hidden', // Prevent particles from leaking outside
      }}
    >
      {/* Deep black CRT background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(10, 10, 15, 1) 0%, rgba(5, 5, 8, 1) 50%, rgba(0, 0, 3, 1) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Screen curvature vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse 85% 70% at 50% 50%,
          transparent 0%,
          transparent 50%,
          rgba(0, 0, 0, 0.2) 70%,
          rgba(0, 0, 0, 0.5) 90%,
          rgba(0, 0, 0, 0.8) 100%
        )`,
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Mouse-following ambient glow - smooth via RAF interpolation */}
      {!isMobile && (
        <div style={{
          position: 'absolute',
          left: `${mousePos.x}%`,
          top: `${mousePos.y}%`,
          transform: 'translate(-50%, -50%)',
          width: '500px',
          height: '500px',
          background: `radial-gradient(circle,
            rgba(255, 240, 220, ${isHovering ? 0.08 : 0.04}) 0%,
            rgba(255, 220, 180, ${isHovering ? 0.04 : 0.02}) 30%,
            transparent 70%
          )`,
          pointerEvents: 'none',
          zIndex: 2,
        }} />
      )}

      {/* Static particles that follow mouse - behind the card, slower, more intentional */}
      {!isMobile && hoveredIndex !== null && staticParticles.map(particle => (
        <div
          key={`static-${particle.id}`}
          style={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 5, // Behind the cards (cards are at zIndex 10+)
            transition: 'opacity 0.3s ease', // Smooth fade
          }}
        >
          {particle.char ? (
            <span
              style={{
                fontSize: `${10 + particle.size * 3}px`,
                fontFamily: 'monospace',
                color: `rgba(255, 255, 255, ${particle.opacity})`,
                textShadow: `0 0 8px rgba(255, 255, 255, ${particle.opacity * 0.4})`,
              }}
            >
              {particle.char}
            </span>
          ) : (
            <div
              style={{
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                borderRadius: '50%',
                background: `rgba(255, 255, 255, ${particle.opacity})`,
                boxShadow: `0 0 ${particle.size * 3}px rgba(255, 255, 255, ${particle.opacity * 0.25})`,
              }}
            />
          )}
        </div>
      ))}

      {/* Film grain - also behind cards */}
      {!isMobile && hoveredIndex !== null && filmGrain.map(grain => (
        <div
          key={`grain-${grain.id}`}
          style={{
            position: 'absolute',
            left: `${grain.x}%`,
            top: `${grain.y}%`,
            width: `${grain.size}px`,
            height: `${grain.size}px`,
            borderRadius: '50%',
            background: `rgba(255, 255, 255, ${grain.opacity})`,
            pointerEvents: 'none',
            zIndex: 4, // Behind particles and cards
          }}
        />
      ))}

      {/* CSS-animated glitch lines - no JS overhead */}
      <div className="glitch-line glitch-line-1" style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 30%, rgba(255, 255, 255, 0.08) 70%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 3,
        opacity: 0,
        animation: 'glitchLine1 8s ease-in-out infinite',
      }} />
      <div className="glitch-line glitch-line-2" style={{
        position: 'absolute',
        left: '20%',
        width: '60%',
        height: '2px',
        background: 'rgba(255, 100, 100, 0.06)',
        pointerEvents: 'none',
        zIndex: 3,
        opacity: 0,
        animation: 'glitchLine2 12s ease-in-out infinite',
        animationDelay: '3s',
      }} />
      <div className="glitch-line glitch-line-3" style={{
        position: 'absolute',
        left: '10%',
        width: '40%',
        height: '1px',
        background: 'rgba(100, 200, 255, 0.06)',
        pointerEvents: 'none',
        zIndex: 3,
        opacity: 0,
        animation: 'glitchLine3 10s ease-in-out infinite',
        animationDelay: '6s',
      }} />

      {/* Static noise overlay - CSS only, GPU accelerated */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        opacity: 0.025,
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Scan lines overlay - static, no animation needed */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent 0px,
          transparent 2px,
          rgba(0, 0, 0, 0.05) 2px,
          rgba(0, 0, 0, 0.05) 3px
        )`,
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      {/* CSS-animated scan line sweep - GPU accelerated */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: '2px',
        background: `linear-gradient(90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.04) 20%,
          rgba(255, 255, 255, 0.08) 50%,
          rgba(255, 255, 255, 0.04) 80%,
          transparent 100%
        )`,
        pointerEvents: 'none',
        zIndex: 3,
        animation: 'scanLineSweep 6s linear infinite',
      }} />


      {/* Cinematic top light */}
      <div style={{
        position: 'absolute',
        top: '-100px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '120%',
        height: '300px',
        background: 'radial-gradient(ellipse at center, rgba(255,240,220,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
        filter: 'blur(30px)',
      }} />

      {/* Header */}
      <div style={{
        textAlign: 'center',
        paddingTop: isMobile ? '48px' : '72px',
        marginBottom: isMobile ? '28px' : '40px',
        position: 'relative',
        zIndex: 5,
      }}>
        <h2 style={{
          color: '#FFF',
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: isMobile ? '1.75rem' : '2.25rem',
          fontWeight: '300',
          letterSpacing: '-0.02em',
          margin: 0,
          marginBottom: '10px',
          textShadow: '0 0 20px rgba(255, 255, 255, 0.15)',
        }}>
          Unlock Rewards
        </h2>
        <p style={{
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: isMobile ? '0.85rem' : '0.9rem',
          margin: 0,
        }}>
          {userPoints.toLocaleString()} points earned
        </p>
      </div>

      {/* ═══════════ GLITCHY PROGRESS RAIL ═══════════ */}
      <div style={{
        position: 'relative',
        marginBottom: isMobile ? '16px' : '24px',
        paddingLeft: isMobile ? '20px' : '0',
        paddingRight: isMobile ? '20px' : '0',
        zIndex: 10,
        height: isMobile ? '55px' : '65px',
        overflow: 'hidden',
      }}>
        {/* Progress indicators aligned with cards */}
        <div style={{
          display: 'flex',
          gap: `${cardGap}px`,
          transform: `translateX(${railTransform}px)`,
          transition: touchDelta !== 0 ? 'none' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
          position: 'relative',
          zIndex: 2,
        }}>
          {prizes.map((prize, index) => {
            const progress = getProgress(prize);
            const isUnlocked = prize.status === 'unlocked';
            const isMystery = prize.is_mystery;
            const isHovered = hoveredProgress === index;
            const hasGlitch = progressGlitchChars[index] !== undefined;

            return (
              <div
                key={`progress-${prize.id}`}
                style={{
                  width: `${cardWidth}px`,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                {/* CRT-style progress container */}
                <button
                  onClick={() => goToCard(index)}
                  onMouseEnter={() => {
                    setHoveredProgress(index);
                    if (!isMobile) triggerProgressGlitch(index, progress);
                  }}
                  onMouseLeave={() => setHoveredProgress(null)}
                  style={{
                    position: 'relative',
                    background: 'rgba(10, 10, 15, 0.95)',
                    border: `1px solid rgba(255, 255, 255, ${isHovered ? 0.12 : 0.06})`,
                    borderRadius: '8px',
                    padding: isMobile ? '8px 16px' : '10px 20px',
                    cursor: 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: isHovered ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
                    boxShadow: isHovered
                      ? '0 8px 25px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                      : '0 4px 12px rgba(0, 0, 0, 0.3)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Inner CRT scan lines */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `repeating-linear-gradient(
                      0deg,
                      transparent 0px,
                      transparent 2px,
                      rgba(0, 0, 0, 0.08) 2px,
                      rgba(0, 0, 0, 0.08) 3px
                    )`,
                    borderRadius: '8px',
                    pointerEvents: 'none',
                    opacity: 0.6,
                  }} />

                  {/* Hover scan line */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: '1px',
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.15) 50%, transparent 100%)',
                      animation: 'progressScan 1.5s linear infinite',
                      pointerEvents: 'none',
                    }} />
                  )}

                  {/* Progress text with glitch effect */}
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    {/* Chromatic aberration layers */}
                    {(isHovered || hasGlitch) && !isMobile && (
                      <>
                        <span style={{
                          position: 'absolute',
                          left: 0,
                          color: 'rgba(255, 80, 80, 0.4)',
                          fontSize: isMobile ? '0.9rem' : '1rem',
                          fontWeight: '600',
                          fontFamily: "'SF Mono', 'Monaco', monospace",
                          transform: `translateX(${hasGlitch ? -2 + Math.random() * 2 : -1}px)`,
                          mixBlendMode: 'screen',
                          pointerEvents: 'none',
                        }}>
                          {isMystery ? '???' : formatProgressText(progress, index, hasGlitch)}
                        </span>
                        <span style={{
                          position: 'absolute',
                          left: 0,
                          color: 'rgba(80, 200, 255, 0.4)',
                          fontSize: isMobile ? '0.9rem' : '1rem',
                          fontWeight: '600',
                          fontFamily: "'SF Mono', 'Monaco', monospace",
                          transform: `translateX(${hasGlitch ? 2 - Math.random() * 2 : 1}px)`,
                          mixBlendMode: 'screen',
                          pointerEvents: 'none',
                        }}>
                          {isMystery ? '???' : formatProgressText(progress, index, hasGlitch)}
                        </span>
                      </>
                    )}

                    {/* Main progress text */}
                    <span style={{
                      position: 'relative',
                      fontSize: isMobile ? '0.9rem' : '1rem',
                      fontWeight: '600',
                      fontFamily: "'SF Mono', 'Monaco', monospace",
                      color: isUnlocked ? 'rgba(255, 220, 180, 1)' : '#FFF',
                      textShadow: hasGlitch
                        ? '0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(255, 255, 255, 0.4)'
                        : isHovered
                          ? '0 0 8px rgba(255, 255, 255, 0.3)'
                          : 'none',
                      letterSpacing: '0.05em',
                    }}>
                      {isMystery ? '???' : formatProgressText(progress, index, hasGlitch)}
                    </span>

                    {/* Unlocked indicator */}
                    {isUnlocked && (
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#10B981',
                        boxShadow: '0 0 8px #10B981, 0 0 16px rgba(16, 185, 129, 0.4)',
                        animation: 'pulse 2s ease-in-out infinite',
                      }} />
                    )}
                  </div>

                  {/* Progress bar underneath */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '3px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: '2px',
                    marginTop: '8px',
                    overflow: 'hidden',
                  }}>
                    {/* Fill */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${progress}%`,
                      background: isUnlocked
                        ? 'linear-gradient(90deg, rgba(255, 200, 150, 0.8) 0%, rgba(255, 220, 180, 1) 100%)'
                        : 'linear-gradient(90deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.6) 100%)',
                      borderRadius: '2px',
                      transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: isUnlocked
                        ? '0 0 10px rgba(255, 200, 150, 0.5)'
                        : '0 0 6px rgba(255, 255, 255, 0.2)',
                    }} />

                    {/* Shimmer effect */}
                    {progress > 5 && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: '-30%',
                        width: '30%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                        animation: 'progressShimmer 2s ease-in-out infinite',
                      }} />
                    )}
                  </div>
                </button>

                {/* Tooltip */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 10px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '10px 14px',
                    background: 'rgba(10, 10, 15, 0.98)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    whiteSpace: 'nowrap',
                    zIndex: 100,
                    animation: 'tooltipIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                  }}>
                    {/* Tooltip scan lines */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: `repeating-linear-gradient(
                        0deg,
                        transparent 0px,
                        transparent 2px,
                        rgba(0, 0, 0, 0.05) 2px,
                        rgba(0, 0, 0, 0.05) 3px
                      )`,
                      borderRadius: '10px',
                      pointerEvents: 'none',
                    }} />
                    <div style={{ position: 'relative', fontSize: '0.8rem', fontWeight: '500', color: '#FFF', marginBottom: '3px' }}>
                      {isMystery ? 'For the 1%' : prize.name}
                    </div>
                    <div style={{ position: 'relative', fontSize: '0.7rem', color: isUnlocked ? 'rgba(255, 200, 150, 1)' : 'rgba(255, 255, 255, 0.5)' }}>
                      {isUnlocked ? 'Ready to redeem' : isMystery ? 'Keep earning' : `${getPointsNeeded(prize)} points to go`}
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%) rotate(45deg)',
                      width: '10px',
                      height: '10px',
                      background: 'rgba(10, 10, 15, 0.98)',
                      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════ CARDS ═══════════ */}
      <div
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        style={{
          position: 'relative',
          paddingLeft: isMobile ? '20px' : '0',
          paddingRight: isMobile ? '20px' : '0',
          // Cards container - keep overflow visible for hover effects
          zIndex: 10,
          perspective: '1200px',
        }}
      >
        <div style={{
          display: 'flex',
          gap: `${cardGap}px`,
          transform: `translateX(${railTransform}px)`,
          transition: touchDelta !== 0 ? 'none' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
        }}>
          {prizes.map((prize, index) => {
            const isLocked = prize.status === 'locked';
            const isUnlocked = prize.status === 'unlocked';
            const isActive = index === activeIndex; // Is this the centered card?
            const isHovered = hoveredIndex === index && !isMobile && !isLocked;
            const isMystery = prize.is_mystery;
            const productImage = getProductImage(prize);
            const isClaiming = claimingId === prize.id;

            const offset = index - activeIndex;
            const depth = Math.abs(offset);
            const baseScale = 1 - depth * 0.03; // Slightly more scale difference for depth
            // Opacity: active card full, others slightly dimmed, locked more dimmed
            const opacity = isLocked ? 0.5 : isActive ? 1 : 0.85;

            // Dynamic hover intensity based on globalTime for pulsing effect
            const pulseIntensity = isHovered ? 0.5 + Math.sin(globalTime * 4) * 0.3 : 0;

            // Get the dynamic pull values when this card is hovered
            const { pullX, pullY, rotateX, rotateY } = isHovered ? hoveredCardPosition : { pullX: 0, pullY: 0, rotateX: 0, rotateY: 0 };

            return (
              <div
                key={prize.id}
                ref={el => cardRefs.current[index] = el}
                onMouseEnter={(e) => handleCardHover(index, e.currentTarget, e)}
                onMouseMove={(e) => handleCardMouseMove(e, index, e.currentTarget)}
                onMouseLeave={() => {
                  setHoveredIndex(null);
                  setHoveredCardPosition({ pullX: 0, pullY: 0, rotateX: 0, rotateY: 0 });
                }}
                onClick={() => handleCardClick(prize, index)}
                style={{
                  flexShrink: 0,
                  width: `${cardWidth}px`,
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  cursor: 'pointer', // All cards clickable - non-active centers, active+unlocked redeems
                  // "Pulled toward mouse" effect - card stretches toward cursor like bursting out
                  transform: isHovered
                    ? `scale(1.06) translateX(${pullX}px) translateY(${pullY - 20}px) translateZ(70px) rotateX(${rotateX - 5}deg) rotateY(${rotateY}deg)`
                    : `scale(${baseScale}) translateX(0) translateY(0) translateZ(0) rotateX(0) rotateY(0)`,
                  opacity,
                  transition: isHovered
                    ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease'
                    : 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                  zIndex: isHovered ? 20 : 1,
                }}
              >
                {/* ═══ ENERGY BURST - Pulled toward viewport center ═══ */}
                {isHovered && (
                  <>
                    {/* Directional light burst - emanates toward center */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '160%',
                      height: '160%',
                      transform: `translate(-50%, -50%) translateX(${pullX * 0.3}px) translateY(${pullY * 0.3}px) translateZ(-20px)`,
                      background: `radial-gradient(ellipse 60% 60% at ${50 + pullX * 0.5}% ${50 + pullY * 0.5}%,
                        rgba(255, 220, 180, ${0.12 + pulseIntensity * 0.08}) 0%,
                        rgba(255, 180, 120, ${0.06 + pulseIntensity * 0.04}) 40%,
                        transparent 70%
                      )`,
                      borderRadius: '50%',
                      pointerEvents: 'none',
                      filter: 'blur(25px)',
                    }} />

                    {/* Stretch lines toward center - creates "being pulled" effect */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '200%',
                      height: '4px',
                      transform: `translate(-50%, -50%) rotate(${Math.atan2(pullY, pullX) * (180 / Math.PI)}deg) translateZ(-15px)`,
                      background: `linear-gradient(90deg,
                        transparent 0%,
                        rgba(255, 240, 220, ${0.03 + pulseIntensity * 0.02}) 30%,
                        rgba(255, 220, 180, ${0.08 + pulseIntensity * 0.05}) 50%,
                        rgba(255, 240, 220, ${0.03 + pulseIntensity * 0.02}) 70%,
                        transparent 100%
                      )`,
                      pointerEvents: 'none',
                      filter: 'blur(3px)',
                    }} />

                    {/* Chromatic aberration - offset based on pull direction */}
                    <div style={{
                      position: 'absolute',
                      inset: '-3px',
                      borderRadius: '23px',
                      background: 'transparent',
                      boxShadow: `
                        ${-pullX * 0.15}px ${-pullY * 0.1}px 20px rgba(255, 80, 80, ${0.18 + pulseIntensity * 0.12}),
                        ${-pullX * 0.25}px ${-pullY * 0.15}px 35px rgba(255, 60, 60, ${0.1 + pulseIntensity * 0.06})
                      `,
                      pointerEvents: 'none',
                      transform: 'translateZ(-5px)',
                    }} />

                    {/* Chromatic aberration - opposite direction (cyan/blue) */}
                    <div style={{
                      position: 'absolute',
                      inset: '-3px',
                      borderRadius: '23px',
                      background: 'transparent',
                      boxShadow: `
                        ${pullX * 0.15}px ${pullY * 0.1}px 20px rgba(80, 200, 255, ${0.18 + pulseIntensity * 0.12}),
                        ${pullX * 0.25}px ${pullY * 0.15}px 35px rgba(60, 180, 255, ${0.1 + pulseIntensity * 0.06})
                      `,
                      pointerEvents: 'none',
                      transform: 'translateZ(-5px)',
                    }} />

                    {/* Energy trail toward center */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '80px',
                      height: '80px',
                      transform: `translate(${pullX * 1.5 - 40}px, ${pullY * 1.5 - 40}px) translateZ(-25px)`,
                      background: `radial-gradient(circle,
                        rgba(255, 230, 200, ${0.15 + pulseIntensity * 0.1}) 0%,
                        rgba(255, 200, 150, ${0.08 + pulseIntensity * 0.05}) 40%,
                        transparent 70%
                      )`,
                      borderRadius: '50%',
                      pointerEvents: 'none',
                      filter: 'blur(15px)',
                    }} />
                  </>
                )}

                {/* Main card container */}
                <div style={{
                  borderRadius: '20px',
                  overflow: 'hidden',
                  position: 'relative',
                  // Subtle shake on hover for tension
                  animation: isHovered ? 'cardTension 0.15s ease-in-out infinite' : 'none',
                }}>
                  {/* Card base - "Screen" effect: bright when unlocked, dim when locked */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: isLocked
                      ? 'linear-gradient(145deg, #0a0a0c 0%, #050507 100%)'
                      : isHovered
                        ? 'linear-gradient(145deg, #1e1e26 0%, #121216 100%)' // Brighter on hover
                        : 'linear-gradient(145deg, #18181e 0%, #0e0e12 100%)',
                    borderRadius: '20px',
                    border: `1px solid ${isHovered ? 'rgba(255, 220, 180, 0.2)' : isLocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)'}`,
                    boxShadow: isLocked
                      ? '0 15px 40px rgba(0,0,0,0.5)'
                      : isHovered
                        ? `0 30px 60px rgba(0,0,0,0.7),
                           0 0 30px rgba(255, 200, 150, ${0.1 + pulseIntensity * 0.08}),
                           inset 0 1px 0 rgba(255, 255, 255, 0.06)`
                        : '0 20px 50px rgba(0,0,0,0.4), 0 0 20px rgba(255,250,240,0.02)',
                    transition: 'all 0.4s ease',
                  }} />

                  {/* CRT scan lines */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '20px',
                    backgroundImage: `repeating-linear-gradient(
                      0deg,
                      transparent 0px,
                      transparent 2px,
                      ${isLocked ? 'rgba(255, 255, 255, 0.008)' : isHovered ? 'rgba(255, 255, 255, 0.025)' : 'rgba(255, 255, 255, 0.015)'} 2px,
                      ${isLocked ? 'rgba(255, 255, 255, 0.008)' : isHovered ? 'rgba(255, 255, 255, 0.025)' : 'rgba(255, 255, 255, 0.015)'} 3px
                    )`,
                    pointerEvents: 'none',
                    zIndex: 2,
                  }} />

                  {/* Screen glow effect for unlocked cards */}
                  {!isLocked && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '20px',
                      background: isHovered
                        ? 'radial-gradient(ellipse 90% 60% at 50% 30%, rgba(255, 240, 220, 0.06) 0%, transparent 70%)'
                        : 'radial-gradient(ellipse 80% 50% at 50% 30%, rgba(255, 250, 240, 0.025) 0%, transparent 70%)',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }} />
                  )}

                  {/* Hover edge highlight - "about to crack open" effect */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '20px',
                      border: `1px solid rgba(255, 220, 180, ${0.1 + pulseIntensity * 0.15})`,
                      pointerEvents: 'none',
                      zIndex: 10,
                    }} />
                  )}

                  {/* Image Area */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1',
                    background: isLocked ? '#050507' : '#0a0a0c',
                    overflow: 'hidden',
                    zIndex: 3,
                  }}>
                    {productImage && (
                      <>
                        <img
                          src={productImage}
                          alt={prize.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: isLocked
                              ? 'grayscale(1) brightness(0.25) contrast(0.9)'
                              : isHovered
                                ? 'brightness(1.1) contrast(1.05) saturate(1.1)'
                                : 'brightness(1) contrast(1)',
                            transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: isLocked
                            ? 'radial-gradient(ellipse 70% 60% at center, transparent 10%, rgba(0,0,0,0.7) 100%)'
                            : isHovered
                              ? 'radial-gradient(ellipse 80% 70% at center, transparent 40%, rgba(0,0,0,0.3) 100%)'
                              : 'radial-gradient(ellipse 70% 60% at center, transparent 30%, rgba(0,0,0,0.4) 100%)',
                          pointerEvents: 'none',
                        }} />
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: '70%',
                          background: isLocked
                            ? 'linear-gradient(transparent, rgba(5,5,7,0.97) 70%, #050507 100%)'
                            : isHovered
                              ? 'linear-gradient(transparent, rgba(18,18,22,0.95) 70%, #121216 100%)'
                              : 'linear-gradient(transparent, rgba(14,14,18,0.95) 70%, #0e0e12 100%)',
                          pointerEvents: 'none',
                        }} />
                      </>
                    )}

                  {isLocked && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                    }}>
                      {isMystery ? (
                        <span style={{ fontSize: '3rem', color: 'rgba(255,255,255,0.1)', fontWeight: '200' }}>?</span>
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1">
                          <rect x="4" y="11" width="16" height="10" rx="2" />
                          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
                        </svg>
                      )}
                      <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.6rem', fontWeight: '500', letterSpacing: '0.2em' }}>
                        {isMystery ? 'EXCLUSIVE' : 'LOCKED'}
                      </span>
                    </div>
                  )}

                </div>

                {/* Content */}
                <div style={{
                  position: 'relative',
                  padding: isMobile ? '18px' : '22px',
                  paddingTop: isMobile ? '22px' : '26px',
                  marginTop: '-4px', // Overlap with image area to hide any seam
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  zIndex: 4,
                  background: isLocked
                    ? '#050507'
                    : isHovered
                      ? '#121216'
                      : '#0e0e12',
                }}>
                  <h3 style={{
                    color: '#FFF',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    fontSize: isMobile ? '1rem' : '1.05rem',
                    fontWeight: '500',
                    margin: 0,
                    lineHeight: 1.35,
                  }}>
                    {isMystery ? 'For the 1%' : prize.name}
                  </h3>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                    color: isUnlocked ? 'rgba(255, 200, 150, 0.9)' : 'rgba(255,255,255,0.35)',
                  }}>
                    <span>{isMystery ? '??? points' : `${prize.points_required?.toLocaleString()} points`}</span>
                    {prize.has_claimed_before && (
                      <>
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                          Previously redeemed
                        </span>
                      </>
                    )}
                  </div>

                  {isUnlocked && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!isClaiming) onRedeem?.(prize); }}
                      onMouseEnter={() => setButtonHovered(prize.id)}
                      onMouseLeave={() => setButtonHovered(null)}
                      disabled={isClaiming}
                      style={{
                        width: '100%',
                        height: '48px',
                        background: isClaiming
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(255, 250, 240, 0.95)',
                        color: isClaiming ? 'rgba(255,255,255,0.3)' : '#3d2a15',
                        border: 'none',
                        borderRadius: '12px',
                        fontFamily: 'Inter, -apple-system, sans-serif',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        cursor: isClaiming ? 'wait' : 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: isClaiming ? 'none' : buttonHovered === prize.id
                          ? '0 10px 30px rgba(255, 180, 100, 0.35)'
                          : '0 5px 15px rgba(255, 180, 100, 0.2)',
                        marginTop: '6px',
                        transform: buttonHovered === prize.id && !isClaiming ? 'translateY(-2px)' : 'none',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Button scan line */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        overflow: 'hidden',
                        borderRadius: '12px',
                        pointerEvents: 'none',
                      }}>
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          height: '1px',
                          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.06) 20%, rgba(0, 0, 0, 0.08) 50%, rgba(0, 0, 0, 0.06) 80%, transparent 100%)',
                          animation: 'buttonScanLine 2.5s linear infinite',
                        }} />
                      </div>
                      {buttonHovered === prize.id && !isClaiming && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                          animation: 'btnShimmer 1.5s ease-in-out infinite',
                        }} />
                      )}
                      <span style={{ position: 'relative' }}>{isClaiming ? 'Processing...' : 'Redeem'}</span>
                    </button>
                  )}

                  {isLocked && !isMystery && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>Progress</span>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', fontWeight: '500', fontFamily: "'SF Mono', monospace" }}>{Math.round(getProgress(prize))}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '3px',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${getProgress(prize)}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, rgba(255, 180, 120, 0.5) 0%, rgba(255, 200, 150, 0.7) 100%)',
                          borderRadius: '2px',
                          transition: 'width 0.8s ease',
                          boxShadow: '0 0 6px rgba(255, 180, 120, 0.25)',
                        }} />
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation - positioned on sides of carousel with gradient shadows */}
      {!isMobile && (
        <>
          {/* Left shadow gradient */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '120px',
            background: 'linear-gradient(90deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 20,
          }} />

          {/* Right shadow gradient */}
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '120px',
            background: 'linear-gradient(270deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 20,
          }} />

          {/* Left Arrow */}
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: canGoPrev ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.25)',
              cursor: canGoPrev ? 'pointer' : 'not-allowed',
              opacity: canGoPrev ? 1 : 0.4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              zIndex: 25,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
            onMouseEnter={(e) => canGoPrev && (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = canGoPrev ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Right Arrow */}
          <button
            onClick={goNext}
            disabled={!canGoNext}
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: canGoNext ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.25)',
              cursor: canGoNext ? 'pointer' : 'not-allowed',
              opacity: canGoNext ? 1 : 0.4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              zIndex: 25,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
            onMouseEnter={(e) => canGoNext && (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = canGoNext ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators for mobile */}
      {isMobile && prizes.length > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '20px',
          position: 'relative',
          zIndex: 5,
        }}>
          {prizes.map((_, index) => (
            <button
              key={index}
              onClick={() => goToCard(index)}
              style={{
                width: index === activeIndex ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: index === activeIndex ? 'rgba(255, 200, 150, 0.9)' : 'rgba(255,255,255,0.2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
        @keyframes tooltipIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.96); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes btnShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes progressScan {
          0% { top: -2px; }
          100% { top: calc(100% + 2px); }
        }
        @keyframes progressShimmer {
          0% { left: -30%; }
          100% { left: 130%; }
        }
        @keyframes buttonScanLine {
          0% { top: -2px; }
          100% { top: calc(100% + 2px); }
        }
        @keyframes scanLineSweep {
          0% { top: -2%; transform: translateY(0); }
          100% { top: 102%; transform: translateY(0); }
        }
        @keyframes glitchLine1 {
          0%, 90%, 100% { opacity: 0; top: 20%; }
          92%, 94% { opacity: 1; top: 20%; }
          93% { opacity: 0.5; top: 21%; }
          95%, 97% { opacity: 0; top: 60%; }
          96% { opacity: 0.8; top: 60%; }
        }
        @keyframes glitchLine2 {
          0%, 85%, 100% { opacity: 0; top: 45%; }
          87%, 89% { opacity: 1; top: 45%; }
          88% { opacity: 0; top: 46%; }
        }
        @keyframes glitchLine3 {
          0%, 80%, 100% { opacity: 0; top: 70%; }
          82%, 84% { opacity: 1; top: 70%; }
          83% { opacity: 0.3; top: 71%; }
        }
        @keyframes cardTension {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-0.5px, 0.3px); }
          50% { transform: translate(0.5px, -0.3px); }
          75% { transform: translate(-0.3px, -0.5px); }
        }
      `}</style>
    </div>
  );
};

export default PrizeRail;
