import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * DOAC Points Counter - Cinematic Edition
 * Premium documentary trailer aesthetic with subtle film grain and light effects
 */

const SplitFlapCounter = ({ value, fontSize = '5rem', isMobile = false }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [scrambleText, setScrambleText] = useState('');
  const [showGlitch, setShowGlitch] = useState(false);
  const [flickerOpacity, setFlickerOpacity] = useState(1);
  const [noiseOffset, setNoiseOffset] = useState({ x: 0, y: 0 });
  const [scanLinePos, setScanLinePos] = useState(0);
  const [filmGrain, setFilmGrain] = useState([]);
  const [lightLeak, setLightLeak] = useState({ active: false, x: 0, intensity: 0 });
  const [glitchFragments, setGlitchFragments] = useState([]);
  const prevValueRef = useRef(value);
  const containerRef = useRef(null);
  const animationRef = useRef(null);

  const fontSizeValue = parseFloat(fontSize) * 1.25;
  const fontSizeUnit = fontSize.replace(/[\d.]/g, '') || 'rem';

  const formatNumber = (num) => num.toLocaleString('en-US');

  // Only numbers for scramble
  const scrambleChars = '0123456789';

  const getScrambleText = useCallback((targetText) => {
    return targetText.split('').map(char => {
      if (char === ',') return ',';
      return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
    }).join('');
  }, []);

  // Cinematic film grain - subtle, organic dots
  const createFilmGrain = useCallback(() => {
    const grains = [];
    const count = isMobile ? 12 : 20;
    for (let i = 0; i < count; i++) {
      grains.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.15 + 0.05,
      });
    }
    return grains;
  }, [isMobile]);

  // Subtle glitch fragments - like data corruption
  const createGlitchFragments = useCallback(() => {
    if (Math.random() > 0.7) return []; // Only 30% chance
    const fragments = [];
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      fragments.push({
        id: i,
        x: Math.random() * 80 + 10,
        y: Math.random() * 80 + 10,
        width: Math.random() * 30 + 5,
        height: Math.random() * 2 + 1,
        opacity: Math.random() * 0.2 + 0.1,
        skew: Math.random() * 10 - 5,
      });
    }
    return fragments;
  }, []);

  // Animation loop for all effects
  useEffect(() => {
    if (isAnimating) {
      let frameCount = 0;
      let lastGrainUpdate = 0;
      let lastFragmentUpdate = 0;

      const animate = (timestamp) => {
        frameCount++;

        // Scan line - smooth, slower sweep
        const scanDuration = 2400;
        const scanProgress = ((timestamp % scanDuration) / scanDuration);
        setScanLinePos(scanProgress * 115 - 7.5);

        // Subtle flicker - very gentle
        if (frameCount % 3 === 0) {
          setFlickerOpacity(0.97 + Math.random() * 0.03);
          setNoiseOffset({
            x: (Math.random() - 0.5) * 0.8,
            y: (Math.random() - 0.5) * 0.4
          });
        }

        // Film grain - update every ~100ms
        if (timestamp - lastGrainUpdate > 100) {
          setFilmGrain(createFilmGrain());
          lastGrainUpdate = timestamp;
        }

        // Glitch fragments - update every ~200ms
        if (timestamp - lastFragmentUpdate > 200) {
          setGlitchFragments(createGlitchFragments());
          lastFragmentUpdate = timestamp;
        }

        // Light leak - occasional subtle warm flash
        if (frameCount % 60 === 0 && Math.random() > 0.7) {
          setLightLeak({
            active: true,
            x: Math.random() * 100,
            intensity: Math.random() * 0.15 + 0.05
          });
          setTimeout(() => setLightLeak({ active: false, x: 0, intensity: 0 }), 150);
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
      setFilmGrain(createFilmGrain());
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setFlickerOpacity(1);
      setNoiseOffset({ x: 0, y: 0 });
      setFilmGrain([]);
      setGlitchFragments([]);
      setLightLeak({ active: false, x: 0, intensity: 0 });
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, createFilmGrain, createGlitchFragments]);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      const targetText = formatNumber(value);
      setIsAnimating(true);
      setShowGlitch(true);

      let scrambleCount = 0;
      const maxScrambles = 16;
      const scrambleInterval = setInterval(() => {
        setScrambleText(getScrambleText(targetText));
        scrambleCount++;
        if (scrambleCount >= maxScrambles) {
          clearInterval(scrambleInterval);
          setScrambleText('');
          setDisplayValue(value);
        }
      }, 65);

      setTimeout(() => setShowGlitch(false), 800);
      setTimeout(() => {
        setIsAnimating(false);
        prevValueRef.current = value;
      }, 1600);

      return () => clearInterval(scrambleInterval);
    }
  }, [value, getScrambleText]);

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
      {/* Cinematic screen backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: isMobile ? '-15px' : '-20px',
          background: isAnimating
            ? 'radial-gradient(ellipse 130% 110% at center, rgba(8, 8, 12, 0.96) 0%, rgba(3, 3, 6, 0.98) 60%, rgba(0, 0, 2, 1) 100%)'
            : 'transparent',
          borderRadius: isMobile ? '16px' : '24px',
          opacity: isAnimating ? 1 : 0,
          transition: 'opacity 0.4s ease-out',
          overflow: 'hidden',
          boxShadow: isAnimating ? `
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            inset 0 0 100px rgba(0, 0, 0, 0.8),
            0 0 80px rgba(255, 255, 255, 0.02)
          ` : 'none',
        }}
      >
        {/* Subtle vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 90% 80% at center, transparent 40%, rgba(0, 0, 0, 0.6) 100%)',
            opacity: isAnimating ? 1 : 0,
            pointerEvents: 'none',
          }}
        />

        {/* Film grain overlay */}
        {isAnimating && filmGrain.map(grain => (
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
              zIndex: 12,
            }}
          />
        ))}

        {/* Scan line - subtle, cinematic */}
        {isAnimating && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${scanLinePos}%`,
              height: '2px',
              background: `linear-gradient(90deg,
                transparent 0%,
                rgba(255, 255, 255, 0.04) 15%,
                rgba(255, 255, 255, 0.06) 50%,
                rgba(255, 255, 255, 0.04) 85%,
                transparent 100%
              )`,
              boxShadow: '0 0 12px rgba(255, 255, 255, 0.03)',
              pointerEvents: 'none',
              zIndex: 11,
            }}
          />
        )}

        {/* Data glitch fragments */}
        {isAnimating && glitchFragments.map(frag => (
          <div
            key={frag.id}
            style={{
              position: 'absolute',
              left: `${frag.x}%`,
              top: `${frag.y}%`,
              width: `${frag.width}px`,
              height: `${frag.height}px`,
              background: `linear-gradient(90deg, transparent, rgba(255, 255, 255, ${frag.opacity}), transparent)`,
              transform: `skewX(${frag.skew}deg)`,
              pointerEvents: 'none',
              zIndex: 13,
            }}
          />
        ))}

        {/* Light leak - warm cinematic flash */}
        {lightLeak.active && (
          <div
            style={{
              position: 'absolute',
              left: `${lightLeak.x - 20}%`,
              top: '-10%',
              width: '40%',
              height: '120%',
              background: `radial-gradient(ellipse at center, rgba(255, 240, 220, ${lightLeak.intensity}) 0%, transparent 70%)`,
              pointerEvents: 'none',
              zIndex: 14,
            }}
          />
        )}

        {/* Very subtle horizontal lines - like old film */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 3px,
              rgba(0, 0, 0, 0.03) 3px,
              rgba(0, 0, 0, 0.03) 4px
            )`,
            opacity: isAnimating ? 0.4 : 0,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      </div>

      {/* Chromatic aberration - more subtle */}
      {showGlitch && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 80, 80, 0.35)',
              fontSize: `${fontSizeValue}${fontSizeUnit}`,
              fontWeight: '600',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              transform: `translateX(${-2.5 + noiseOffset.x}px)`,
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
              color: 'rgba(80, 200, 255, 0.35)',
              fontSize: `${fontSizeValue}${fontSizeUnit}`,
              fontWeight: '600',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              transform: `translateX(${2.5 + noiseOffset.x}px)`,
              pointerEvents: 'none',
              zIndex: 15,
              mixBlendMode: 'screen',
            }}
          >
            {scrambleText || formatted}
          </div>
        </>
      )}

      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isAnimating ? '200%' : '130%',
          height: isAnimating ? '250%' : '160%',
          background: `radial-gradient(ellipse at center,
            ${isAnimating ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)'} 0%,
            transparent 70%)`,
          transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
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
            textShadow: isAnimating ? '0 0 8px rgba(255, 255, 255, 0.3)' : 'none',
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
            filter: showGlitch ? 'blur(0.3px)' : 'none',
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
                          ? '0 0 15px rgba(255, 255, 255, 0.4), 0 0 30px rgba(255, 255, 255, 0.2)'
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
