import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * DOAC Points Counter - Igloo.inc / Awwwards Level
 * Featuring: Text scramble, chromatic aberration, particle burst, glitch effects
 * SLOWED DOWN for maximum anticipation
 */

const SplitFlapCounter = ({ value, fontSize = '5rem', isMobile = false }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [scrambleText, setScrambleText] = useState('');
  const [showGlitch, setShowGlitch] = useState(false);
  const [particles, setParticles] = useState([]);
  const prevValueRef = useRef(value);
  const containerRef = useRef(null);

  // BIGGER font size multiplier
  const fontSizeValue = parseFloat(fontSize) * 1.25;
  const fontSizeUnit = fontSize.replace(/[\d.]/g, '') || 'rem';

  const formatNumber = (num) => num.toLocaleString('en-US');

  // Scramble characters for the effect
  const scrambleChars = '0123456789!@#$%&*';

  // Generate random scramble text
  const getScrambleText = useCallback((targetText) => {
    return targetText.split('').map(char => {
      if (char === ',') return ',';
      return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
    }).join('');
  }, []);

  // Create particle burst
  const createParticles = useCallback(() => {
    const newParticles = [];
    const particleCount = isMobile ? 15 : 25;
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 20,
        y: 50 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200 - 60,
        size: Math.random() * 4 + 2,
        opacity: 1,
      });
    }
    setParticles(newParticles);

    // Fade out particles - SLOWER
    setTimeout(() => setParticles([]), 1500);
  }, [isMobile]);

  // Main animation sequence - SLOWED DOWN
  useEffect(() => {
    if (value !== prevValueRef.current) {
      const targetText = formatNumber(value);
      setIsAnimating(true);
      setShowGlitch(true);
      createParticles();

      // Scramble phase - SLOWER (80ms intervals, 12 iterations)
      let scrambleCount = 0;
      const maxScrambles = 12;
      const scrambleInterval = setInterval(() => {
        setScrambleText(getScrambleText(targetText));
        scrambleCount++;
        if (scrambleCount >= maxScrambles) {
          clearInterval(scrambleInterval);
          setScrambleText('');
          setDisplayValue(value);
        }
      }, 80);

      // End glitch effect - SLOWER
      setTimeout(() => setShowGlitch(false), 600);

      // End animation state - SLOWER
      setTimeout(() => {
        setIsAnimating(false);
        prevValueRef.current = value;
      }, 1200);

      return () => clearInterval(scrambleInterval);
    }
  }, [value, getScrambleText, createParticles]);

  const formatted = formatNumber(displayValue);
  const digitHeight = fontSizeValue * 1.2;
  const digitWidth = fontSizeValue * 0.64;

  const digitStyle = {
    height: `${digitHeight}${fontSizeUnit}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${fontSizeValue}${fontSizeUnit}`,
    fontWeight: '600',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
    color: '#FFFFFF',
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: isMobile ? '2rem 2.5rem' : '2.5rem 4rem',
      }}
    >
      {/* Particle burst effect */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: `0 0 ${p.size * 3}px rgba(255,255,255,0.9)`,
            opacity: p.opacity,
            transform: `translate(${p.vx}px, ${p.vy}px)`,
            transition: 'transform 1.5s cubic-bezier(0.23, 1, 0.32, 1), opacity 1.5s ease-out',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      ))}

      {/* Chromatic aberration layers - only during animation */}
      {showGlitch && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 0, 0, 0.4)',
              fontSize: `${fontSizeValue}${fontSizeUnit}`,
              fontWeight: '600',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              transform: 'translateX(-4px)',
              pointerEvents: 'none',
              zIndex: 5,
              mixBlendMode: 'screen',
            }}
          >
            {scrambleText || formatted}
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(0, 255, 255, 0.4)',
              fontSize: `${fontSizeValue}${fontSizeUnit}`,
              fontWeight: '600',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              transform: 'translateX(4px)',
              pointerEvents: 'none',
              zIndex: 5,
              mixBlendMode: 'screen',
            }}
          >
            {scrambleText || formatted}
          </div>
        </>
      )}

      {/* Background glow pulse */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isAnimating ? '220%' : '130%',
          height: isAnimating ? '280%' : '160%',
          background: `radial-gradient(ellipse at center,
            ${isAnimating ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)'} 0%,
            transparent 70%)`,
          transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Scan line effect - SLOWER */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '-10%',
          right: '-10%',
          height: '3px',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
          opacity: isAnimating ? 1 : 0,
          transform: `translateY(${isAnimating ? '500%' : '0'})`,
          transition: isAnimating
            ? 'transform 0.8s ease-in-out, opacity 0.15s ease'
            : 'opacity 0.5s ease',
          pointerEvents: 'none',
          zIndex: 15,
          boxShadow: '0 0 20px rgba(255,255,255,0.8)',
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Top label with reveal animation */}
        <div
          style={{
            fontSize: isMobile ? '0.6875rem' : '0.75rem',
            fontWeight: '500',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.4)',
            marginBottom: isMobile ? '1rem' : '1.5rem',
            position: 'relative',
          }}
        >
          <span style={{ position: 'relative' }}>
            Total Points
            {/* Underline accent */}
            <span
              style={{
                position: 'absolute',
                bottom: '-6px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: isAnimating ? '100%' : '30%',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </span>
        </div>

        {/* Digits */}
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: showGlitch ? 'blur(0.8px)' : 'none',
            transition: 'filter 0.2s ease',
          }}
        >
          {(scrambleText || formatted).split('').map((char, i) => {
            if (char === ',') {
              return (
                <span
                  key={`comma-${i}`}
                  style={{
                    fontSize: `${fontSizeValue * 0.5}${fontSizeUnit}`,
                    fontWeight: '400',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                    color: 'rgba(255, 255, 255, 0.25)',
                    width: `${fontSizeValue * 0.2}${fontSizeUnit}`,
                    height: `${digitHeight}${fontSizeUnit}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ,
                </span>
              );
            }

            const isScrambling = scrambleText && scrambleText[i] !== formatted[i];

            return (
              <div
                key={`digit-${i}`}
                style={{
                  position: 'relative',
                  width: `${digitWidth}${fontSizeUnit}`,
                  height: `${digitHeight}${fontSizeUnit}`,
                  overflow: 'hidden',
                  display: 'inline-block',
                }}
              >
                {/* Rolling digit strip */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    transform: isScrambling
                      ? `translateY(-${(parseInt(char) || 0) * digitHeight}${fontSizeUnit})`
                      : `translateY(-${(parseInt(formatted[i]) || 0) * digitHeight}${fontSizeUnit})`,
                    transition: isScrambling ? 'none' : 'transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <div key={n} style={digitStyle}>
                      {n}
                    </div>
                  ))}
                </div>

                {/* Top mask */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '38%',
                    background: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.7) 50%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />

                {/* Bottom mask */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '38%',
                    background: 'linear-gradient(0deg, #000 0%, rgba(0,0,0,0.7) 50%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            marginTop: isMobile ? '1.25rem' : '1.75rem',
            width: '100%',
            height: '2px',
            position: 'relative',
            borderRadius: '1px',
            overflow: 'hidden',
          }}
        >
          {/* Static base */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255, 255, 255, 0.08)',
            }}
          />
          {/* Animated fill - SLOWER */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: isAnimating ? '100%' : '0%',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.9), rgba(255,255,255,0.5))',
              transition: isAnimating
                ? 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                : 'width 0.5s ease-out',
              boxShadow: '0 0 15px rgba(255,255,255,0.6)',
            }}
          />
        </div>

        {/* Micro text */}
        <div
          style={{
            marginTop: isMobile ? '0.875rem' : '1.125rem',
            fontSize: isMobile ? '0.5625rem' : '0.6875rem',
            fontWeight: '400',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            letterSpacing: '0.08em',
            color: 'rgba(255, 255, 255, 0.2)',
            textTransform: 'uppercase',
          }}
        >
          Redeem for exclusive rewards
        </div>
      </div>
    </div>
  );
};

export default SplitFlapCounter;
