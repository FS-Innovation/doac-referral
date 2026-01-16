import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * DOAC Points Counter - CRT Monitor Edition
 * Real retro CRT effects: scan lines, flicker, noise
 */

const SplitFlapCounter = ({ value, fontSize = '5rem', isMobile = false }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [scrambleText, setScrambleText] = useState('');
  const [showGlitch, setShowGlitch] = useState(false);
  const [particles, setParticles] = useState([]);
  const [staticNoise, setStaticNoise] = useState([]);
  const [glitchChar, setGlitchChar] = useState(null);
  const [flickerOpacity, setFlickerOpacity] = useState(1);
  const [noiseOffset, setNoiseOffset] = useState({ x: 0, y: 0 });
  const [scanLinePos, setScanLinePos] = useState(0);
  const prevValueRef = useRef(value);
  const containerRef = useRef(null);
  const flickerIntervalRef = useRef(null);
  const staticIntervalRef = useRef(null);
  const scanAnimationRef = useRef(null);

  const fontSizeValue = parseFloat(fontSize) * 1.25;
  const fontSizeUnit = fontSize.replace(/[\d.]/g, '') || 'rem';

  const formatNumber = (num) => num.toLocaleString('en-US');

  // Only numbers for scramble - no special characters
  const scrambleChars = '0123456789';

  const getScrambleText = useCallback((targetText) => {
    return targetText.split('').map(char => {
      if (char === ',') return ',';
      return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
    }).join('');
  }, []);

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
    setTimeout(() => setParticles([]), 1500);
  }, [isMobile]);

  // Create realistic static noise particles
  const createStaticNoise = useCallback(() => {
    const noise = [];
    const count = isMobile ? 40 : 80;
    for (let i = 0; i < count; i++) {
      noise.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        width: Math.random() * 3 + 1,
        height: Math.random() > 0.7 ? Math.random() * 8 + 2 : Math.random() * 2 + 1,
        opacity: Math.random() * 0.4 + 0.1,
        isLine: Math.random() > 0.85,
      });
    }
    return noise;
  }, [isMobile]);

  // Occasional glitch character overlay
  const glitchChars = '█▓▒░╔╗╚╝║═┌┐└┘│─';
  const triggerGlitchChar = useCallback(() => {
    if (Math.random() > 0.6) {
      const char = glitchChars[Math.floor(Math.random() * glitchChars.length)];
      const x = 20 + Math.random() * 60;
      const y = 20 + Math.random() * 60;
      setGlitchChar({ char, x, y, id: Date.now() });
      setTimeout(() => setGlitchChar(null), 80 + Math.random() * 120);
    }
  }, []);

  // CRT Flicker effect during animation
  useEffect(() => {
    if (isAnimating) {
      // Flicker and jitter
      flickerIntervalRef.current = setInterval(() => {
        setFlickerOpacity(0.92 + Math.random() * 0.08);
        setNoiseOffset({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 1
        });
        triggerGlitchChar();
      }, 50);

      // Static noise regeneration
      staticIntervalRef.current = setInterval(() => {
        setStaticNoise(createStaticNoise());
      }, 60);

      // Smooth scan line animation
      let startTime = null;
      const animateScan = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const duration = 1800; // ms for one sweep
        const progress = (elapsed % duration) / duration;
        setScanLinePos(progress * 110 - 5); // -5% to 105%
        scanAnimationRef.current = requestAnimationFrame(animateScan);
      };
      scanAnimationRef.current = requestAnimationFrame(animateScan);

      // Initial static
      setStaticNoise(createStaticNoise());
    } else {
      if (flickerIntervalRef.current) {
        clearInterval(flickerIntervalRef.current);
      }
      if (staticIntervalRef.current) {
        clearInterval(staticIntervalRef.current);
      }
      if (scanAnimationRef.current) {
        cancelAnimationFrame(scanAnimationRef.current);
      }
      setFlickerOpacity(1);
      setNoiseOffset({ x: 0, y: 0 });
      setStaticNoise([]);
      setGlitchChar(null);
    }
    return () => {
      if (flickerIntervalRef.current) {
        clearInterval(flickerIntervalRef.current);
      }
      if (staticIntervalRef.current) {
        clearInterval(staticIntervalRef.current);
      }
      if (scanAnimationRef.current) {
        cancelAnimationFrame(scanAnimationRef.current);
      }
    };
  }, [isAnimating, createStaticNoise, triggerGlitchChar]);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      const targetText = formatNumber(value);
      setIsAnimating(true);
      setShowGlitch(true);
      createParticles();

      let scrambleCount = 0;
      const maxScrambles = 14;
      const scrambleInterval = setInterval(() => {
        setScrambleText(getScrambleText(targetText));
        scrambleCount++;
        if (scrambleCount >= maxScrambles) {
          clearInterval(scrambleInterval);
          setScrambleText('');
          setDisplayValue(value);
        }
      }, 70);

      setTimeout(() => setShowGlitch(false), 700);
      setTimeout(() => {
        setIsAnimating(false);
        prevValueRef.current = value;
      }, 1400);

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

  // Generate CSS for scan lines
  const scanLinesStyle = {
    backgroundImage: `repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.15),
      rgba(0, 0, 0, 0.15) 1px,
      transparent 1px,
      transparent 2px
    )`,
    backgroundSize: '100% 2px',
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
      {/* CRT Monitor Frame - 3D curved screen effect */}
      <div
        style={{
          position: 'absolute',
          inset: isMobile ? '-12px' : '-18px',
          background: isAnimating
            ? 'radial-gradient(ellipse 120% 100% at center, rgba(15, 15, 20, 0.97) 0%, rgba(5, 5, 10, 0.99) 70%, rgba(0, 0, 5, 1) 100%)'
            : 'transparent',
          borderRadius: isMobile ? '20px' : '28px',
          opacity: isAnimating ? 1 : 0,
          transition: 'opacity 0.3s ease',
          overflow: 'hidden',
          // 3D curved screen illusion
          boxShadow: isAnimating ? `
            inset 0 0 80px rgba(0, 0, 0, 0.9),
            inset 0 0 40px rgba(0, 0, 0, 0.5),
            inset 2px 2px 20px rgba(255, 255, 255, 0.03),
            inset -2px -2px 20px rgba(0, 0, 0, 0.8),
            0 0 60px rgba(255, 255, 255, 0.03),
            0 4px 20px rgba(0, 0, 0, 0.5)
          ` : 'none',
          // Subtle 3D perspective
          transform: isAnimating ? 'perspective(800px) rotateX(1deg)' : 'none',
        }}
      >
        {/* Glass reflection on curved screen */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              linear-gradient(
                135deg,
                rgba(255, 255, 255, 0.04) 0%,
                transparent 40%,
                transparent 60%,
                rgba(255, 255, 255, 0.02) 100%
              )
            `,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />

        {/* Scan lines overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            ...scanLinesStyle,
            opacity: isAnimating ? 0.5 : 0,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />

        {/* Screen edge vignette - stronger for 3D depth */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 80% 70% at center, transparent 30%, rgba(0, 0, 0, 0.4) 70%, rgba(0, 0, 0, 0.85) 100%)
            `,
            opacity: isAnimating ? 1 : 0,
            pointerEvents: 'none',
            zIndex: 8,
          }}
        />

        {/* 3D Scan bar with glow and depth */}
        {isAnimating && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${scanLinePos}%`,
              height: '12px',
              background: `
                linear-gradient(180deg,
                  transparent 0%,
                  rgba(255, 255, 255, 0.03) 20%,
                  rgba(255, 255, 255, 0.08) 45%,
                  rgba(200, 220, 255, 0.15) 50%,
                  rgba(255, 255, 255, 0.08) 55%,
                  rgba(255, 255, 255, 0.03) 80%,
                  transparent 100%
                )
              `,
              boxShadow: `
                0 0 20px rgba(200, 220, 255, 0.2),
                0 0 40px rgba(200, 220, 255, 0.1),
                0 0 60px rgba(200, 220, 255, 0.05)
              `,
              pointerEvents: 'none',
              zIndex: 11,
            }}
          />
        )}

        {/* Secondary subtle scan line */}
        {isAnimating && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${(scanLinePos + 50) % 110}%`,
              height: '4px',
              background: `
                linear-gradient(180deg,
                  transparent 0%,
                  rgba(255, 255, 255, 0.02) 40%,
                  rgba(255, 255, 255, 0.04) 50%,
                  rgba(255, 255, 255, 0.02) 60%,
                  transparent 100%
                )
              `,
              pointerEvents: 'none',
              zIndex: 11,
              opacity: 0.6,
            }}
          />
        )}

        {/* Realistic static noise particles */}
        {isAnimating && staticNoise.map(particle => (
          <div
            key={particle.id}
            style={{
              position: 'absolute',
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.isLine ? `${particle.width + 10}px` : `${particle.width}px`,
              height: `${particle.height}px`,
              background: particle.isLine
                ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)'
                : `rgba(255, 255, 255, ${particle.opacity})`,
              pointerEvents: 'none',
              zIndex: 12,
            }}
          />
        ))}

        {/* Occasional glitch character */}
        {glitchChar && (
          <div
            style={{
              position: 'absolute',
              left: `${glitchChar.x}%`,
              top: `${glitchChar.y}%`,
              fontSize: isMobile ? '1rem' : '1.5rem',
              fontFamily: 'monospace',
              color: `rgba(255, 255, 255, ${0.3 + Math.random() * 0.4})`,
              textShadow: '0 0 5px rgba(255, 255, 255, 0.5)',
              pointerEvents: 'none',
              zIndex: 13,
              transform: `rotate(${Math.random() * 20 - 10}deg)`,
            }}
          >
            {glitchChar.char}
          </div>
        )}

        {/* RGB pixel grid effect */}
        {isAnimating && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `repeating-linear-gradient(
                90deg,
                rgba(255, 0, 0, 0.015) 0px,
                rgba(255, 0, 0, 0.015) 1px,
                rgba(0, 255, 0, 0.015) 1px,
                rgba(0, 255, 0, 0.015) 2px,
                rgba(0, 0, 255, 0.015) 2px,
                rgba(0, 0, 255, 0.015) 3px
              )`,
              opacity: 0.5,
              pointerEvents: 'none',
              zIndex: 9,
            }}
          />
        )}

        {/* Phosphor persistence / ghosting effect */}
        {isAnimating && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center, rgba(200, 220, 255, 0.02) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 7,
            }}
          />
        )}
      </div>

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
            zIndex: 20,
          }}
        />
      ))}

      {/* Chromatic aberration */}
      {showGlitch && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 50, 50, 0.5)',
              fontSize: `${fontSizeValue}${fontSizeUnit}`,
              fontWeight: '600',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              transform: `translateX(${-4 + noiseOffset.x}px)`,
              pointerEvents: 'none',
              zIndex: 15,
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
              color: 'rgba(50, 255, 255, 0.5)',
              fontSize: `${fontSizeValue}${fontSizeUnit}`,
              fontWeight: '600',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              transform: `translateX(${4 + noiseOffset.x}px)`,
              pointerEvents: 'none',
              zIndex: 15,
              mixBlendMode: 'screen',
            }}
          >
            {scrambleText || formatted}
          </div>
        </>
      )}

      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isAnimating ? '220%' : '130%',
          height: isAnimating ? '280%' : '160%',
          background: `radial-gradient(ellipse at center,
            ${isAnimating ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)'} 0%,
            transparent 70%)`,
          transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: flickerOpacity,
          transform: `translate(${noiseOffset.x}px, ${noiseOffset.y}px)`,
          transition: isAnimating ? 'none' : 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        {/* Top label */}
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
            textShadow: isAnimating ? '0 0 10px rgba(255, 255, 255, 0.5)' : 'none',
            transition: 'text-shadow 0.3s ease',
          }}
        >
          Total Points
        </div>

        {/* Digits */}
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: showGlitch ? 'blur(0.5px)' : 'none',
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
                    <div
                      key={n}
                      style={{
                        ...digitStyle,
                        textShadow: isAnimating
                          ? '0 0 20px rgba(255, 255, 255, 0.6), 0 0 40px rgba(255, 255, 255, 0.3)'
                          : 'none',
                        transition: 'text-shadow 0.3s ease',
                      }}
                    >
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

        {/* Micro text */}
        <div
          style={{
            marginTop: isMobile ? '1.25rem' : '1.75rem',
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
