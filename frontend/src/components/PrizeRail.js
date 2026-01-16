import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * PrizeRail - CRT/Old-School TV aesthetic matching DOAC trailer vibes
 * Features: scan lines, glitch effects, chromatic aberration, interactive progress
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [globalMousePos, setGlobalMousePos] = useState({ x: 0, y: 0 });
  const [scanLinePos, setScanLinePos] = useState(0);
  const [glitchActive, setGlitchActive] = useState(false);
  const [progressGlitch, setProgressGlitch] = useState(false);
  const [hoveredMilestone, setHoveredMilestone] = useState(null);
  const [milestoneGlitchChars, setMilestoneGlitchChars] = useState({});
  const railRef = useRef(null);
  const containerRef = useRef(null);
  const glitchTimerRef = useRef(null);
  const milestoneGlitchTimers = useRef({});

  const glitchChars = '░▒▓█▀▄@#$%&*!?<>[]{}~^';

  // Find the first unlocked prize index to start there
  useEffect(() => {
    const firstUnlockedIndex = prizes.findIndex(p => p.status === 'unlocked');
    if (firstUnlockedIndex !== -1) {
      setActiveIndex(firstUnlockedIndex);
    }
  }, [prizes]);

  // Continuous scan line animation
  useEffect(() => {
    let animFrame;
    let lastTime = 0;
    const animate = (time) => {
      if (time - lastTime > 16) {
        setScanLinePos(prev => (prev + 0.5) % 100);
        lastTime = time;
      }
      animFrame = requestAnimationFrame(animate);
    };
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, []);

  // Random glitch effect
  useEffect(() => {
    const triggerGlitch = () => {
      if (Math.random() > 0.7) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 50 + Math.random() * 100);
      }
      glitchTimerRef.current = setTimeout(triggerGlitch, 2000 + Math.random() * 4000);
    };
    glitchTimerRef.current = setTimeout(triggerGlitch, 1000);
    return () => clearTimeout(glitchTimerRef.current);
  }, []);

  // Card dimensions
  const cardWidth = isMobile ? 260 : 300;
  const cardGap = isMobile ? 16 : 24;
  const visibleCards = isMobile ? 1.2 : 2.8;

  // Track mouse for effects
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
    setGlobalMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  // Navigation
  const goToCard = useCallback((index) => {
    const maxIndex = Math.max(0, prizes.length - Math.floor(visibleCards));
    setActiveIndex(Math.max(0, Math.min(index, maxIndex)));
  }, [prizes.length, visibleCards]);

  const goNext = () => goToCard(activeIndex + 1);
  const goPrev = () => goToCard(activeIndex - 1);

  // Drag handling
  const handleDragStart = (e) => {
    setIsDragging(true);
    setDragStartX(e.clientX || e.touches?.[0]?.clientX || 0);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const currentX = e.clientX || e.touches?.[0]?.clientX || 0;
    setDragOffset(currentX - dragStartX);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = cardWidth / 3;
    if (dragOffset > threshold) goPrev();
    else if (dragOffset < -threshold) goNext();
    setDragOffset(0);
  };

  // Touch handling
  const [touchStart, setTouchStart] = useState(0);
  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    const delta = touchStart - e.changedTouches[0].clientX;
    if (delta > 50) goNext();
    else if (delta < -50) goPrev();
  };

  // Calculate rail transform
  const railTransform = -(activeIndex * (cardWidth + cardGap)) + dragOffset;

  // Get product image URL
  const getProductImage = (prize) => {
    if (prize.prize_type === 'discount_code') {
      return 'https://thediary.com/cdn/shop/files/1_DIARY_PopUpCardsWhite.png?v=1764327518&width=800';
    }
    if (prize.name?.includes('Vol. 1') || prize.name?.includes('Vol 1')) {
      return 'https://thediary.com/cdn/shop/files/1_e87b669d-04ab-4f85-81c8-df353bbb2188.png?v=1749210128&width=700';
    }
    if (prize.name?.includes('Vol. 2') || prize.name?.includes('Vol 2')) {
      return 'https://thediary.com/cdn/shop/files/1_b75fbc90-9bfe-49f2-baf5-3767c7992627.png?v=1762444332&width=700';
    }
    if (prize.name?.includes('Vol. 3') || prize.name?.includes('Vol 3') || prize.name?.includes('Game Edition')) {
      return 'https://thediary.com/cdn/shop/files/CC3_Web_Image_3.jpg?v=1762859458&width=1000';
    }
    if (prize.name?.includes('1% Diary') || prize.name?.includes('Diary')) {
      return 'https://thediary.com/cdn/shop/files/No_matter_your_goal_1_d1605690-ab79-45f3-a83d-f9d21e8223bc.png?v=1763725505&width=1000';
    }
    if (prize.is_mystery) {
      return 'https://storage.googleapis.com/doac-perks/edited-photo.webp';
    }
    return null;
  };

  // Milestone glitch effect on hover
  const triggerMilestoneGlitch = useCallback((index) => {
    if (milestoneGlitchTimers.current[index]) return;

    let glitchCount = 0;
    const maxGlitches = 8;
    const interval = 60;

    const glitch = () => {
      glitchCount++;
      if (glitchCount < maxGlitches) {
        setMilestoneGlitchChars(prev => ({
          ...prev,
          [index]: glitchChars[Math.floor(Math.random() * glitchChars.length)]
        }));
        milestoneGlitchTimers.current[index] = setTimeout(glitch, interval);
      } else {
        setMilestoneGlitchChars(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
        delete milestoneGlitchTimers.current[index];
      }
    };

    milestoneGlitchTimers.current[index] = setTimeout(glitch, 0);
    glitch();
  }, []);

  // Cleanup glitch timers
  useEffect(() => {
    return () => {
      Object.values(milestoneGlitchTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Progress calculation
  const getOverallProgress = () => {
    const maxPoints = Math.max(...prizes.filter(p => !p.is_mystery).map(p => p.points_required));
    return Math.min(100, (userPoints / maxPoints) * 100);
  };

  // Get glitch character for display
  const getGlitchChar = () => glitchChars[Math.floor(Math.random() * glitchChars.length)];

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        width: '100%',
        position: 'relative',
        padding: isMobile ? '0' : '0 60px',
        overflow: 'hidden',
      }}
    >
      {/* CRT Background Effect */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 120% 100% at 50% 50%, rgba(10, 10, 15, 0.98) 0%, rgba(5, 5, 10, 1) 100%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Scan Lines Overlay - Matching SplitFlapCounter */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent 0px,
          transparent 3px,
          rgba(0, 0, 0, 0.04) 3px,
          rgba(0, 0, 0, 0.04) 4px
        )`,
        pointerEvents: 'none',
        zIndex: 10,
      }} />

      {/* Moving Scan Line */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${scanLinePos}%`,
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.03) 80%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 11,
        opacity: 0.8,
      }} />

      {/* Ambient Mouse-following Glow */}
      {!isMobile && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(ellipse 500px 300px at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255, 255, 255, 0.04) 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 1,
          transition: 'background 0.15s ease-out',
        }} />
      )}

      {/* Section Header - CRT Style */}
      <div style={{
        textAlign: 'center',
        marginBottom: isMobile ? '28px' : '40px',
        position: 'relative',
        zIndex: 5,
      }}>
        {/* Chromatic aberration on title */}
        <div style={{ position: 'relative' }}>
          {/* Red offset */}
          <h2 style={{
            position: 'absolute',
            left: '50%',
            transform: `translateX(calc(-50% + ${glitchActive ? -2 : 0}px))`,
            color: 'rgba(255, 0, 0, 0.4)',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: '500',
            letterSpacing: '-0.02em',
            margin: 0,
            opacity: glitchActive ? 1 : 0.3,
            transition: 'opacity 0.1s, transform 0.05s',
            pointerEvents: 'none',
          }}>
            Unlock Rewards
          </h2>
          {/* Blue offset */}
          <h2 style={{
            position: 'absolute',
            left: '50%',
            transform: `translateX(calc(-50% + ${glitchActive ? 2 : 0}px))`,
            color: 'rgba(0, 100, 255, 0.4)',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: '500',
            letterSpacing: '-0.02em',
            margin: 0,
            opacity: glitchActive ? 1 : 0.3,
            transition: 'opacity 0.1s, transform 0.05s',
            pointerEvents: 'none',
          }}>
            Unlock Rewards
          </h2>
          {/* Main text */}
          <h2 style={{
            position: 'relative',
            color: '#FFF',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: '500',
            letterSpacing: '-0.02em',
            margin: 0,
            marginBottom: '8px',
            textShadow: '0 0 20px rgba(255, 255, 255, 0.15)',
          }}>
            Unlock Rewards
          </h2>
        </div>
        <p style={{
          color: 'rgba(255, 255, 255, 0.4)',
          fontFamily: "'SF Mono', Monaco, monospace",
          fontSize: isMobile ? '0.75rem' : '0.8rem',
          margin: 0,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {glitchActive ? (
            <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              {`${getGlitchChar()}${getGlitchChar()}${getGlitchChar()}${getGlitchChar()}${getGlitchChar()} pts`}
            </span>
          ) : (
            `${userPoints.toLocaleString()} pts`
          )}
        </p>
      </div>

      {/* ====== INTERACTIVE PROGRESS TIMELINE ====== */}
      <div style={{
        position: 'relative',
        height: isMobile ? '80px' : '100px',
        marginBottom: isMobile ? '28px' : '40px',
        marginLeft: isMobile ? '20px' : '0',
        marginRight: isMobile ? '20px' : '0',
        zIndex: 5,
      }}>
        {/* Main progress track - CRT style */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '2px',
        }}>
          {/* Scan line effect on track */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg,
              transparent 0%,
              rgba(255,255,255,0.1) ${scanLinePos}%,
              transparent ${scanLinePos + 5}%
            )`,
            borderRadius: '2px',
          }} />
        </div>

        {/* Progress fill with glow and scan effect */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          height: '3px',
          width: `${getOverallProgress()}%`,
          background: progressGlitch
            ? 'linear-gradient(90deg, rgba(255,0,0,0.8) 0%, rgba(255,255,255,0.9) 50%, rgba(0,100,255,0.8) 100%)'
            : 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.8) 100%)',
          borderRadius: '2px',
          boxShadow: '0 0 15px rgba(255, 255, 255, 0.4), 0 0 30px rgba(255, 255, 255, 0.2)',
          transition: progressGlitch ? 'none' : 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {/* Animated glow pulse at end */}
          <div style={{
            position: 'absolute',
            right: '-4px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#FFF',
            boxShadow: '0 0 10px #FFF, 0 0 20px #FFF, 0 0 30px rgba(255,255,255,0.5)',
            animation: 'progressPulse 1.5s ease-in-out infinite',
          }} />
        </div>

        {/* Milestone nodes */}
        {prizes.map((prize, index) => {
          const position = prizes.length > 1 ? (index / (prizes.length - 1)) * 100 : 50;
          const isUnlocked = prize.status === 'unlocked';
          const isActive = index === activeIndex;
          const isHoveredMilestone = hoveredMilestone === index;
          const pointsProgress = prize.is_mystery ? 0 : Math.min(100, (userPoints / prize.points_required) * 100);
          const hasGlitchChar = milestoneGlitchChars[index];

          return (
            <div
              key={prize.id}
              style={{
                position: 'absolute',
                left: `${position}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: isHoveredMilestone ? 20 : 15,
              }}
            >
              {/* Connecting line to card position */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '100%',
                  width: '1px',
                  height: isMobile ? '30px' : '40px',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 100%)',
                  transform: 'translateX(-50%)',
                }} />
              )}

              {/* Milestone node */}
              <div
                onClick={() => goToCard(index)}
                onMouseEnter={() => {
                  setHoveredMilestone(index);
                  triggerMilestoneGlitch(index);
                }}
                onMouseLeave={() => setHoveredMilestone(null)}
                style={{
                  position: 'relative',
                  width: isActive ? (isMobile ? '48px' : '56px') : isHoveredMilestone ? (isMobile ? '44px' : '52px') : (isMobile ? '36px' : '44px'),
                  height: isActive ? (isMobile ? '48px' : '56px') : isHoveredMilestone ? (isMobile ? '44px' : '52px') : (isMobile ? '36px' : '44px'),
                  borderRadius: '50%',
                  background: isUnlocked
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isUnlocked
                    ? '2px solid rgba(255,255,255,0.4)'
                    : isActive
                      ? '2px solid rgba(255,255,255,0.2)'
                      : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isUnlocked
                    ? '0 0 20px rgba(255,255,255,0.3), inset 0 0 15px rgba(255,255,255,0.1)'
                    : isHoveredMilestone
                      ? '0 0 15px rgba(255,255,255,0.2)'
                      : 'none',
                  overflow: 'hidden',
                }}
              >
                {/* Internal scan lines */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  backgroundImage: `repeating-linear-gradient(
                    0deg,
                    transparent 0px,
                    transparent 2px,
                    rgba(0, 0, 0, 0.1) 2px,
                    rgba(0, 0, 0, 0.1) 3px
                  )`,
                  pointerEvents: 'none',
                }} />

                {/* Progress ring for locked items */}
                {!isUnlocked && !prize.is_mystery && (
                  <svg
                    style={{
                      position: 'absolute',
                      inset: '-2px',
                      width: 'calc(100% + 4px)',
                      height: 'calc(100% + 4px)',
                      transform: 'rotate(-90deg)',
                    }}
                  >
                    <circle
                      cx="50%"
                      cy="50%"
                      r="48%"
                      fill="none"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="2"
                    />
                    <circle
                      cx="50%"
                      cy="50%"
                      r="48%"
                      fill="none"
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth="2"
                      strokeDasharray={`${pointsProgress * 3.14} 314`}
                      strokeLinecap="round"
                      style={{
                        filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))',
                        transition: 'stroke-dasharray 0.5s ease',
                      }}
                    />
                  </svg>
                )}

                {/* Inner content */}
                <span style={{
                  fontFamily: "'SF Mono', Monaco, monospace",
                  fontSize: isActive ? (isMobile ? '0.7rem' : '0.8rem') : (isMobile ? '0.6rem' : '0.7rem'),
                  fontWeight: '600',
                  color: isUnlocked ? '#FFF' : 'rgba(255,255,255,0.5)',
                  letterSpacing: '0.05em',
                  textShadow: isUnlocked ? '0 0 10px rgba(255,255,255,0.5)' : 'none',
                  position: 'relative',
                  zIndex: 2,
                }}>
                  {hasGlitchChar ? (
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{hasGlitchChar}</span>
                  ) : prize.is_mystery ? (
                    '?'
                  ) : isUnlocked ? (
                    '✓'
                  ) : (
                    `${Math.round(pointsProgress)}%`
                  )}
                </span>

                {/* Chromatic aberration on hover */}
                {isHoveredMilestone && (
                  <>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: '1px solid rgba(255, 0, 0, 0.3)',
                      transform: 'translate(-1px, 0)',
                      pointerEvents: 'none',
                    }} />
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: '1px solid rgba(0, 100, 255, 0.3)',
                      transform: 'translate(1px, 0)',
                      pointerEvents: 'none',
                    }} />
                  </>
                )}
              </div>

              {/* Tooltip on hover */}
              {isHoveredMilestone && !isMobile && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '12px',
                  padding: '10px 14px',
                  background: 'rgba(0, 0, 0, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap',
                  zIndex: 30,
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}>
                  {/* Scan line in tooltip */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${(scanLinePos * 2) % 100}%`,
                      height: '1px',
                      background: 'rgba(255,255,255,0.1)',
                    }} />
                  </div>

                  <div style={{
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    color: '#FFF',
                    marginBottom: '4px',
                  }}>
                    {prize.is_mystery ? 'For the 1%' : prize.name}
                  </div>
                  <div style={{
                    fontFamily: "'SF Mono', Monaco, monospace",
                    fontSize: '0.7rem',
                    color: isUnlocked ? 'rgba(100, 255, 100, 0.8)' : 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.05em',
                  }}>
                    {prize.is_mystery ? '???,???' : prize.points_required?.toLocaleString()} PTS
                    {isUnlocked && ' ✓ UNLOCKED'}
                  </div>

                  {/* Arrow */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%) rotate(45deg)',
                    width: '10px',
                    height: '10px',
                    background: 'rgba(0, 0, 0, 0.95)',
                    borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cards Container */}
      <div
        ref={railRef}
        onMouseDown={!isMobile ? handleDragStart : undefined}
        onMouseMove={!isMobile ? handleDragMove : undefined}
        onMouseUp={!isMobile ? handleDragEnd : undefined}
        onMouseLeave={!isMobile ? handleDragEnd : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'grab',
          marginLeft: isMobile ? '20px' : '0',
          marginRight: isMobile ? '20px' : '0',
          zIndex: 5,
        }}
      >
        {/* Cards Rail */}
        <div style={{
          display: 'flex',
          gap: `${cardGap}px`,
          transform: `translateX(${railTransform}px)`,
          transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {prizes.map((prize, index) => {
            const isLocked = prize.status === 'locked';
            const isUnlocked = prize.status === 'unlocked';
            const isHovered = hoveredIndex === index;
            const isMystery = prize.is_mystery;
            const productImage = getProductImage(prize);
            const isClaiming = claimingId === prize.id;
            const isActive = index === activeIndex;

            // Depth effect
            const offset = index - activeIndex;
            const depth = Math.abs(offset);
            const scale = isHovered ? 1.02 : 1 - depth * 0.02;
            const opacity = 1 - depth * 0.12;

            return (
              <div
                key={prize.id}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => !isMobile && goToCard(index)}
                style={{
                  flexShrink: 0,
                  width: `${cardWidth}px`,
                  background: '#0A0A0C',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  position: 'relative',
                  transform: `scale(${scale})`,
                  opacity: opacity,
                  transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                  border: isActive || isHovered
                    ? '1px solid rgba(255,255,255,0.15)'
                    : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: isHovered
                    ? '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(255,255,255,0.05)'
                    : isActive
                      ? '0 15px 50px rgba(0,0,0,0.4)'
                      : '0 8px 30px rgba(0,0,0,0.3)',
                }}
              >
                {/* Card scan lines */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '16px',
                  backgroundImage: `repeating-linear-gradient(
                    0deg,
                    transparent 0px,
                    transparent 2px,
                    rgba(0, 0, 0, 0.03) 2px,
                    rgba(0, 0, 0, 0.03) 3px
                  )`,
                  pointerEvents: 'none',
                  zIndex: 20,
                }} />

                {/* Moving scan line on hover */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: `${scanLinePos}%`,
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex: 21,
                  }} />
                )}

                {/* Chromatic aberration border on hover */}
                {isHovered && (
                  <>
                    <div style={{
                      position: 'absolute',
                      inset: '-1px',
                      borderRadius: '17px',
                      border: '1px solid rgba(255, 0, 0, 0.15)',
                      transform: 'translate(-1px, 0)',
                      pointerEvents: 'none',
                      zIndex: 22,
                    }} />
                    <div style={{
                      position: 'absolute',
                      inset: '-1px',
                      borderRadius: '17px',
                      border: '1px solid rgba(0, 100, 255, 0.15)',
                      transform: 'translate(1px, 0)',
                      pointerEvents: 'none',
                      zIndex: 22,
                    }} />
                  </>
                )}

                {/* Image Area */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1',
                  background: '#050506',
                  overflow: 'hidden',
                }}>
                  {productImage ? (
                    <>
                      <img
                        src={productImage}
                        alt={prize.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: isLocked ? 'grayscale(100%) brightness(0.3)' : 'none',
                          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                      {/* CRT vignette */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)`,
                        pointerEvents: 'none',
                      }} />
                      {/* Bottom fade */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '60%',
                        background: 'linear-gradient(transparent 0%, rgba(10,10,12,0.9) 70%, #0A0A0C 100%)',
                        pointerEvents: 'none',
                      }} />
                    </>
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255,255,255,0.2)',
                      fontSize: '0.875rem',
                    }}>
                      No image
                    </div>
                  )}

                  {/* Locked overlay */}
                  {isLocked && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(2px)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                    }}>
                      {isMystery ? (
                        <span style={{
                          fontSize: '2.5rem',
                          color: 'rgba(255,255,255,0.25)',
                          fontFamily: "'SF Mono', Monaco, monospace",
                          fontWeight: '300',
                          textShadow: '0 0 20px rgba(255,255,255,0.1)',
                        }}>?</span>
                      ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5">
                          <rect x="4" y="11" width="16" height="10" rx="2" />
                          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
                        </svg>
                      )}
                      <span style={{
                        color: 'rgba(255,255,255,0.35)',
                        fontSize: '0.65rem',
                        fontWeight: '500',
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        fontFamily: "'SF Mono', Monaco, monospace",
                      }}>
                        {isMystery ? 'CLASSIFIED' : 'LOCKED'}
                      </span>
                    </div>
                  )}

                  {/* Unlocked badge - CRT style */}
                  {isUnlocked && (
                    <div style={{
                      position: 'absolute',
                      top: '14px',
                      right: '14px',
                      padding: '6px 10px',
                      background: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backdropFilter: 'blur(4px)',
                    }}>
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#4ADE80',
                        boxShadow: '0 0 8px #4ADE80, 0 0 16px #4ADE80',
                        animation: 'statusPulse 2s ease-in-out infinite',
                      }} />
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: '600',
                        color: 'rgba(255,255,255,0.9)',
                        letterSpacing: '0.1em',
                        fontFamily: "'SF Mono', Monaco, monospace",
                      }}>
                        READY
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div style={{
                  padding: isMobile ? '16px' : '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '10px' : '12px',
                }}>
                  {/* Prize Name */}
                  <h3 style={{
                    color: '#FFF',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    fontSize: isMobile ? '0.9rem' : '1rem',
                    fontWeight: '500',
                    margin: 0,
                    lineHeight: 1.3,
                  }}>
                    {isMystery ? 'For the 1%' : prize.name}
                  </h3>

                  {/* Points - Monospace CRT style */}
                  <div style={{
                    fontFamily: "'SF Mono', Monaco, monospace",
                    fontSize: isMobile ? '0.75rem' : '0.8rem',
                    color: isUnlocked ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)',
                    letterSpacing: '0.05em',
                  }}>
                    {isMystery ? (
                      <span style={{ filter: 'blur(4px)', userSelect: 'none' }}>
                        ???,??? PTS
                      </span>
                    ) : (
                      `${prize.points_required?.toLocaleString()} PTS`
                    )}
                  </div>

                  {/* Previously redeemed */}
                  {prize.has_claimed_before && (
                    <div style={{
                      fontSize: '0.65rem',
                      color: 'rgba(255,255,255,0.3)',
                      fontStyle: 'italic',
                      fontFamily: "'SF Mono', Monaco, monospace",
                      letterSpacing: '0.02em',
                    }}>
                      // PREVIOUSLY_REDEEMED
                    </div>
                  )}

                  {/* Redeem Button */}
                  {isUnlocked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isClaiming) onRedeem?.(prize);
                      }}
                      disabled={isClaiming}
                      style={{
                        width: '100%',
                        height: isMobile ? '44px' : '48px',
                        background: isClaiming
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(255, 255, 255, 0.95)',
                        color: isClaiming ? 'rgba(255,255,255,0.4)' : '#000',
                        border: 'none',
                        borderRadius: '8px',
                        fontFamily: "'SF Mono', Monaco, monospace",
                        fontSize: isMobile ? '0.75rem' : '0.8rem',
                        fontWeight: '600',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        cursor: isClaiming ? 'wait' : 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: isClaiming
                          ? 'none'
                          : '0 0 20px rgba(255,255,255,0.2), 0 4px 15px rgba(255,255,255,0.1)',
                        marginTop: '4px',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Button scan line */}
                      {!isClaiming && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: `${(scanLinePos * 2) % 100}%`,
                          height: '1px',
                          background: 'rgba(0,0,0,0.1)',
                          pointerEvents: 'none',
                        }} />
                      )}
                      {isClaiming ? 'PROCESSING...' : 'REDEEM'}
                    </button>
                  )}

                  {/* Progress bar for locked */}
                  {isLocked && !isMystery && (
                    <div style={{
                      width: '100%',
                      height: '2px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '1px',
                      overflow: 'hidden',
                      marginTop: '4px',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: `${Math.min(100, (userPoints / prize.points_required) * 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.5) 100%)',
                        borderRadius: '1px',
                        transition: 'width 0.5s ease',
                        boxShadow: '0 0 8px rgba(255,255,255,0.3)',
                      }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Arrows - CRT Style */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: isMobile ? '16px' : '20px',
        marginTop: isMobile ? '28px' : '36px',
        position: 'relative',
        zIndex: 5,
      }}>
        <button
          onClick={goPrev}
          disabled={activeIndex === 0}
          aria-label="Previous prize"
          style={{
            width: isMobile ? '44px' : '52px',
            height: isMobile ? '44px' : '52px',
            borderRadius: '50%',
            background: activeIndex === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: activeIndex === 0 ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Scan line in button */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 2px,
              rgba(0, 0, 0, 0.05) 2px,
              rgba(0, 0, 0, 0.05) 3px
            )`,
            pointerEvents: 'none',
          }} />
          <svg width={isMobile ? '18' : '22'} height={isMobile ? '18' : '22'} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="1.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          onClick={goNext}
          disabled={activeIndex >= prizes.length - Math.floor(visibleCards)}
          aria-label="Next prize"
          style={{
            width: isMobile ? '44px' : '52px',
            height: isMobile ? '44px' : '52px',
            borderRadius: '50%',
            background: activeIndex >= prizes.length - Math.floor(visibleCards)
              ? 'rgba(255,255,255,0.02)'
              : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: activeIndex >= prizes.length - Math.floor(visibleCards) ? 'not-allowed' : 'pointer',
            opacity: activeIndex >= prizes.length - Math.floor(visibleCards) ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Scan line in button */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 2px,
              rgba(0, 0, 0, 0.05) 2px,
              rgba(0, 0, 0, 0.05) 3px
            )`,
            pointerEvents: 'none',
          }} />
          <svg width={isMobile ? '18' : '22'} height={isMobile ? '18' : '22'} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="1.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes progressPulse {
          0%, 100% {
            opacity: 0.8;
            transform: translateY(-50%) scale(1);
            box-shadow: 0 0 10px #FFF, 0 0 20px #FFF;
          }
          50% {
            opacity: 1;
            transform: translateY(-50%) scale(1.3);
            box-shadow: 0 0 15px #FFF, 0 0 30px #FFF, 0 0 45px rgba(255,255,255,0.5);
          }
        }
        @keyframes statusPulse {
          0%, 100% {
            opacity: 0.8;
            box-shadow: 0 0 8px #4ADE80, 0 0 16px #4ADE80;
          }
          50% {
            opacity: 1;
            box-shadow: 0 0 12px #4ADE80, 0 0 24px #4ADE80, 0 0 36px rgba(74, 222, 128, 0.3);
          }
        }
      `}</style>
    </div>
  );
};

export default PrizeRail;
