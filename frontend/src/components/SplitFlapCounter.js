import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * DOAC Points Counter - Award-Winning Interactive Edition
 * Mouse-reactive environment with digit-specific glitching
 * Background follows mouse, digits glitch only on direct hover
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

  // Advanced interaction state
  const [isHovering, setIsHovering] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [rawMousePos, setRawMousePos] = useState({ x: 0, y: 0 }); // Actual pixel position
  const [mouseVelocity, setMouseVelocity] = useState({ x: 0, y: 0 });
  const [displacement, setDisplacement] = useState(0);
  const [chromaticOffset, setChromaticOffset] = useState({ r: 0, g: 0, b: 0 });
  const [magneticPull, setMagneticPull] = useState({ x: 0, y: 0 });
  const [wavePhase, setWavePhase] = useState(0);

  // Per-digit hover state for character glitching
  const [hoveredDigitIndex, setHoveredDigitIndex] = useState(-1);
  const [digitGlitchChars, setDigitGlitchChars] = useState({});
  const [staticParticles, setStaticParticles] = useState([]);
  const [ambientScanPos, setAmbientScanPos] = useState(-10);
  const [ambientScanActive, setAmbientScanActive] = useState(false);

  const prevValueRef = useRef(value);
  const containerRef = useRef(null);
  const digitsRef = useRef(null);
  const animationRef = useRef(null);
  const hoverAnimationRef = useRef(null);
  const animationQueueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastMouseTime = useRef(Date.now());
  const velocitySmooth = useRef({ x: 0, y: 0 });
  const digitGlitchTimers = useRef({});

  const fontSizeValue = parseFloat(fontSize) * 1.25;
  const fontSizeUnit = fontSize.replace(/[\d.]/g, '') || 'rem';
  const formatNumber = (num) => num.toLocaleString('en-US');
  const scrambleChars = '0123456789';
  const glitchChars = '0123456789@#$%&*!?░▒▓█▀▄';

  const getScrambleText = useCallback((targetText) => {
    return targetText.split('').map(char => {
      if (char === ',') return ',';
      // Use glitch characters for the scramble animation (matching hover effect)
      return glitchChars[Math.floor(Math.random() * glitchChars.length)];
    }).join('');
  }, []);

  // Get a random glitch character for digit hover effect
  const getGlitchChar = useCallback(() => {
    return glitchChars[Math.floor(Math.random() * glitchChars.length)];
  }, []);

  // Create static particles that follow mouse
  const createStaticParticles = useCallback((centerX, centerY, velocity) => {
    const particles = [];
    const count = Math.min(12 + Math.floor(velocity * 2), 25);
    const spread = 80 + velocity * 15;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spread;
      particles.push({
        id: i,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        char: Math.random() > 0.7 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : null,
        lifetime: Math.random() * 0.5 + 0.3,
      });
    }
    return particles;
  }, []);

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
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.25 + 0.08,
      });
    }
    return grains;
  }, [isMobile]);

  const createGlitchFragments = useCallback((mouseX = 50, mouseY = 50) => {
    if (Math.random() > 0.55) return [];
    const fragments = [];
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      // Fragments appear near mouse position
      const offsetX = (Math.random() - 0.5) * 60;
      const offsetY = (Math.random() - 0.5) * 40;
      fragments.push({
        id: i,
        x: Math.max(5, Math.min(95, mouseX + offsetX)),
        y: Math.max(5, Math.min(95, mouseY + offsetY)),
        width: Math.random() * 35 + 10,
        height: Math.random() * 2 + 1,
        opacity: Math.random() * 0.25 + 0.1,
        skew: Math.random() * 10 - 5,
      });
    }
    return fragments;
  }, []);

  // Trigger glitch effect on a specific digit (defined before handleMouseMove to avoid reference error)
  const triggerDigitGlitch = useCallback((index) => {
    // If timer already running for this digit, let it continue naturally
    if (digitGlitchTimers.current[index]) {
      return; // Don't interrupt - let current animation finish
    }

    let glitchCount = 0;
    const maxGlitches = 6 + Math.floor(Math.random() * 4); // 6-9 cycles
    const timers = digitGlitchTimers.current;
    const interval = 70 + Math.random() * 40; // 70-110ms per cycle - slower, more readable

    const glitch = () => {
      glitchCount++;
      if (glitchCount < maxGlitches) {
        setDigitGlitchChars(prev => ({
          ...prev,
          [index]: getGlitchChar()
        }));
      } else {
        // Return to normal - timer cleans itself up
        setDigitGlitchChars(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
        clearInterval(timers[index]);
        delete timers[index];
      }
    };

    timers[index] = setInterval(glitch, interval);
    glitch(); // Immediate first glitch
  }, [getGlitchChar]);

  // Handle mouse movement with velocity tracking
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || isMobile) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normalizedX = (x / rect.width) * 2 - 1; // -1 to 1
    const normalizedY = (y / rect.height) * 2 - 1; // -1 to 1

    // Calculate velocity
    const now = Date.now();
    const dt = Math.max(1, now - lastMouseTime.current);
    const vx = (x - lastMousePos.current.x) / dt * 16; // Normalize to ~60fps
    const vy = (y - lastMousePos.current.y) / dt * 16;

    // Smooth velocity
    velocitySmooth.current = {
      x: velocitySmooth.current.x * 0.7 + vx * 0.3,
      y: velocitySmooth.current.y * 0.7 + vy * 0.3,
    };

    lastMousePos.current = { x, y };
    lastMouseTime.current = now;

    setMousePos({ x: normalizedX, y: normalizedY });
    setRawMousePos({ x, y });
    setMouseVelocity({ ...velocitySmooth.current });

    // Detect which digit is being hovered
    if (digitsRef.current) {
      const digitsRect = digitsRef.current.getBoundingClientRect();
      const relativeX = e.clientX - digitsRect.left;
      const relativeY = e.clientY - digitsRect.top;

      // Check if mouse is within digits area
      if (relativeX >= 0 && relativeX <= digitsRect.width &&
          relativeY >= 0 && relativeY <= digitsRect.height) {
        const digitElements = digitsRef.current.children;
        let foundIndex = -1;

        for (let i = 0; i < digitElements.length; i++) {
          const digitRect = digitElements[i].getBoundingClientRect();
          if (e.clientX >= digitRect.left && e.clientX <= digitRect.right) {
            // Map element index to actual character index
            foundIndex = i;
            break;
          }
        }

        if (foundIndex !== -1 && foundIndex !== hoveredDigitIndex) {
          setHoveredDigitIndex(foundIndex);
          // Start glitching this digit
          triggerDigitGlitch(foundIndex);
        }
      } else {
        setHoveredDigitIndex(-1);
      }
    }
  }, [isMobile, displayValue, hoveredDigitIndex, triggerDigitGlitch]);

  const handleMouseEnter = useCallback(() => {
    if (isMobile) return;
    setIsHovering(true);
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    // Animate out smoothly
    velocitySmooth.current = { x: 0, y: 0 };
  }, []);

  // Advanced hover animation with physics-based effects
  useEffect(() => {
    if (isHovering && !isAnimating) {
      let frameCount = 0;
      let phase = wavePhase;

      const animateHover = () => {
        frameCount++;
        phase += 0.03;
        setWavePhase(phase);

        // Calculate displacement based on velocity magnitude
        const velocityMag = Math.sqrt(
          mouseVelocity.x * mouseVelocity.x +
          mouseVelocity.y * mouseVelocity.y
        );
        const targetDisplacement = Math.min(velocityMag * 2, 20);
        setDisplacement(prev => prev + (targetDisplacement - prev) * 0.15);

        // Chromatic aberration based on velocity direction (subtle)
        setChromaticOffset({
          r: mouseVelocity.x * 0.4,
          g: 0,
          b: -mouseVelocity.x * 0.4,
        });

        // Magnetic pull - content slightly follows mouse
        setMagneticPull(prev => ({
          x: prev.x + (mousePos.x * 6 - prev.x) * 0.06,
          y: prev.y + (mousePos.y * 3 - prev.y) * 0.06,
        }));

        // Static particles follow mouse
        if (frameCount % 2 === 0 && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const particleX = (rawMousePos.x / rect.width) * 100;
          const particleY = (rawMousePos.y / rect.height) * 100;
          setStaticParticles(createStaticParticles(particleX, particleY, velocityMag));
        }

        // Subtle flicker
        if (frameCount % 4 === 0) {
          setFlickerOpacity(0.98 + Math.random() * 0.02);
          setNoiseOffset({
            x: (Math.random() - 0.5) * (0.8 + velocityMag * 0.2),
            y: (Math.random() - 0.5) * (0.4 + velocityMag * 0.1)
          });
        }

        // Film grain follows mouse area
        if (frameCount % 6 === 0 && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const grainX = (rawMousePos.x / rect.width) * 100;
          const grainY = (rawMousePos.y / rect.height) * 100;
          setFilmGrain(createFilmGrain(grainX, grainY));
        }

        // Glitch fragments appear near mouse with velocity
        if (frameCount % 8 === 0 && velocityMag > 1.5 && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const fragX = (rawMousePos.x / rect.width) * 100;
          const fragY = (rawMousePos.y / rect.height) * 100;
          setGlitchFragments(createGlitchFragments(fragX, fragY));
        } else if (frameCount % 15 === 0) {
          setGlitchFragments([]);
        }

        // Scan line
        const scanDuration = 2800;
        const scanProgress = ((performance.now() % scanDuration) / scanDuration);
        setScanLinePos(scanProgress * 115 - 7.5);

        hoverAnimationRef.current = requestAnimationFrame(animateHover);
      };

      hoverAnimationRef.current = requestAnimationFrame(animateHover);
      setFilmGrain(createFilmGrain());
    } else if (!isHovering && !isAnimating) {
      if (hoverAnimationRef.current) {
        cancelAnimationFrame(hoverAnimationRef.current);
      }

      // Smooth decay of effects - everything fades naturally at a relaxed pace
      // Using much slower decay rates (closer to 1.0 = slower fade)
      const decay = () => {
        let stillDecaying = false;

        setDisplacement(prev => {
          if (prev < 0.05) return 0;
          stillDecaying = true;
          return prev * 0.97; // Much slower decay
        });
        setChromaticOffset(prev => ({
          r: prev.r * 0.96,
          g: 0,
          b: prev.b * 0.96,
        }));
        setMagneticPull(prev => {
          if (Math.abs(prev.x) > 0.01 || Math.abs(prev.y) > 0.01) stillDecaying = true;
          return {
            x: prev.x * 0.97,
            y: prev.y * 0.97,
          };
        });
        // Decay mouse position back to center so digit wave returns to normal
        setMousePos(prev => {
          if (Math.abs(prev.x) > 0.01 || Math.abs(prev.y) > 0.01) stillDecaying = true;
          return {
            x: prev.x * 0.96,
            y: prev.y * 0.96,
          };
        });
        setFlickerOpacity(prev => prev + (1 - prev) * 0.03); // Slower return to 1
        setNoiseOffset(prev => ({
          x: prev.x * 0.96,
          y: prev.y * 0.96,
        }));
        // Fade out particles naturally - slow fade
        setStaticParticles(prev => {
          if (prev.length === 0) return prev;
          stillDecaying = true;
          return prev.map(p => ({ ...p, opacity: p.opacity * 0.97 }))
            .filter(p => p.opacity > 0.02);
        });
        // Fade out film grain naturally - slow fade
        setFilmGrain(prev => {
          if (prev.length === 0) return prev;
          stillDecaying = true;
          return prev.map(g => ({ ...g, opacity: g.opacity * 0.98 }))
            .filter(g => g.opacity > 0.01);
        });
        // Fade out glitch fragments naturally - slow fade
        setGlitchFragments(prev => {
          if (prev.length === 0) return prev;
          stillDecaying = true;
          return prev.map(f => ({ ...f, opacity: f.opacity * 0.96 }))
            .filter(f => f.opacity > 0.01);
        });

        if (stillDecaying) {
          hoverAnimationRef.current = requestAnimationFrame(decay);
        } else {
          // Final cleanup only after everything has naturally faded
          // Don't clear digitGlitchChars - let the timers finish naturally
          setHoveredDigitIndex(-1);
          setWavePhase(0);
        }
      };
      hoverAnimationRef.current = requestAnimationFrame(decay);
    }

    return () => {
      if (hoverAnimationRef.current) {
        cancelAnimationFrame(hoverAnimationRef.current);
      }
    };
  }, [isHovering, isAnimating, mousePos, rawMousePos, mouseVelocity, createFilmGrain, createGlitchFragments, createStaticParticles, wavePhase]);

  // Cleanup digit glitch timers on unmount
  useEffect(() => {
    const timers = digitGlitchTimers.current;
    return () => {
      Object.values(timers).forEach(timer => clearInterval(timer));
    };
  }, []);

  // Ambient scan line - runs periodically when not hovering (not constant)
  useEffect(() => {
    if (isHovering || isAnimating) {
      setAmbientScanActive(false);
      return;
    }

    // Schedule scans with random delays (3-6 seconds between each)
    let timeoutId;
    const scheduleScan = () => {
      const delay = 3000 + Math.random() * 3000; // 3-6 seconds
      timeoutId = setTimeout(() => {
        if (!isHovering && !isAnimating) {
          setAmbientScanActive(true);
          setAmbientScanPos(-5);
        }
        scheduleScan(); // Schedule next one
      }, delay);
    };

    // Start first scan after a short delay
    const initialTimeout = setTimeout(() => {
      if (!isHovering && !isAnimating) {
        setAmbientScanActive(true);
        setAmbientScanPos(-5);
      }
      scheduleScan();
    }, 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeoutId);
    };
  }, [isHovering, isAnimating]);

  // Animate the ambient scan line when active
  useEffect(() => {
    if (!ambientScanActive) return;

    let animFrame;
    const animate = () => {
      setAmbientScanPos(prev => {
        const next = prev + 0.8;
        if (next > 110) {
          setAmbientScanActive(false);
          return -5;
        }
        return next;
      });
      animFrame = requestAnimationFrame(animate);
    };
    animFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animFrame);
  }, [ambientScanActive]);

  // Always show the CRT background effect, intensify on hover/animation
  const isActive = true;
  const isIntense = isAnimating || isHovering || displacement > 0.1;

  // Value change animation
  useEffect(() => {
    if (isAnimating) {
      let frameCount = 0;
      let lastGrainUpdate = 0;
      let lastFragmentUpdate = 0;

      const animate = (timestamp) => {
        frameCount++;
        const scanDuration = 2400;
        const scanProgress = ((timestamp % scanDuration) / scanDuration);
        setScanLinePos(scanProgress * 115 - 7.5);

        if (frameCount % 3 === 0) {
          setFlickerOpacity(0.97 + Math.random() * 0.03);
          setNoiseOffset({
            x: (Math.random() - 0.5) * 0.8,
            y: (Math.random() - 0.5) * 0.4
          });
        }

        if (timestamp - lastGrainUpdate > 100) {
          setFilmGrain(createFilmGrain());
          lastGrainUpdate = timestamp;
        }

        if (timestamp - lastFragmentUpdate > 200) {
          setGlitchFragments(createGlitchFragments());
          lastFragmentUpdate = timestamp;
        }

        if (frameCount % 60 === 0 && Math.random() > 0.7) {
          setLightLeak({
            active: true,
            x: Math.random() * 100,
            intensity: Math.random() * 0.2 + 0.08
          });
          setTimeout(() => setLightLeak({ active: false, x: 0, intensity: 0 }), 180);
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
      setFilmGrain(createFilmGrain());
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (!isHovering) {
        setLightLeak({ active: false, x: 0, intensity: 0 });
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, isHovering, createFilmGrain, createGlitchFragments]);

  const processQueue = useCallback(() => {
    if (isProcessingRef.current || animationQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    const targetValue = animationQueueRef.current.shift();
    const targetText = formatNumber(targetValue);

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
        setDisplayValue(targetValue);
      }
    }, 65);

    setTimeout(() => setShowGlitch(false), 800);
    setTimeout(() => {
      setIsAnimating(false);
      prevValueRef.current = targetValue;
      isProcessingRef.current = false;
      processQueue();
    }, 1600);
  }, [getScrambleText]);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      const lastQueued = animationQueueRef.current[animationQueueRef.current.length - 1];
      if (lastQueued !== value) {
        animationQueueRef.current.push(value);
      }
      processQueue();
    }
  }, [value, processQueue]);

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

  // Calculate wave displacement for each digit
  const getDigitWave = (index, total) => {
    if (!isHovering && displacement < 0.1) return { x: 0, y: 0, scale: 1 };
    const normalizedIndex = (index / total) * 2 - 1;
    const distanceFromMouse = Math.abs(normalizedIndex - mousePos.x);
    const influence = Math.max(0, 1 - distanceFromMouse * 1.5);

    return {
      x: Math.sin(wavePhase + index * 0.5) * displacement * influence * 0.3,
      y: Math.cos(wavePhase + index * 0.3) * displacement * influence * 0.2,
      scale: 1 + influence * displacement * 0.008,
    };
  };

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Your Points: ${formatNumber(displayValue)}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: isMobile ? '2rem 2.5rem' : '2.5rem 4rem',
        cursor: isMobile ? 'default' : 'none',
      }}
    >
      {/* Custom cursor - refined */}
      {isHovering && !isMobile && containerRef.current && (
        <>
          {/* Main cursor ring */}
          <div
            style={{
              position: 'fixed',
              left: lastMousePos.current.x + containerRef.current.getBoundingClientRect().left,
              top: lastMousePos.current.y + containerRef.current.getBoundingClientRect().top,
              width: 6 + displacement * 1.5,
              height: 6 + displacement * 1.5,
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 100,
              transition: 'width 0.08s, height 0.08s',
              mixBlendMode: 'difference',
            }}
          />
          {/* Inner dot */}
          <div
            style={{
              position: 'fixed',
              left: lastMousePos.current.x + containerRef.current.getBoundingClientRect().left,
              top: lastMousePos.current.y + containerRef.current.getBoundingClientRect().top,
              width: 2,
              height: 2,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.8)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 101,
              mixBlendMode: 'difference',
            }}
          />
        </>
      )}

      {/* Screen reader only */}
      <span style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}>
        Your Points: {formatNumber(displayValue)}
      </span>

      {/* Cinematic backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: isMobile ? '-15px' : '-20px',
          background: isActive
            ? `radial-gradient(ellipse 130% 110% at ${50 + mousePos.x * 20}% ${50 + mousePos.y * 20}%, rgba(10, 10, 15, 0.95) 0%, rgba(5, 5, 10, 0.98) 50%, rgba(0, 0, 5, 1) 100%)`
            : 'transparent',
          borderRadius: isMobile ? '16px' : '24px',
          opacity: isActive ? 1 : 0,
          transition: 'opacity 0.15s ease-out',
          overflow: 'hidden',
          boxShadow: isActive ? `
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            inset 0 0 100px rgba(0, 0, 0, 0.8),
            0 0 80px rgba(255, 255, 255, 0.02)
          ` : 'none',
        }}
      >
        {/* Displacement field - follows mouse exactly */}
        {isHovering && containerRef.current && (
          <div
            style={{
              position: 'absolute',
              left: rawMousePos.x,
              top: rawMousePos.y,
              width: `${40 + displacement * 6}px`,
              height: `${40 + displacement * 6}px`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(255, 255, 255, ${0.04 + displacement * 0.008}) 0%, transparent 70%)`,
              filter: `blur(${8 + displacement * 0.5}px)`,
              pointerEvents: 'none',
              zIndex: 5,
              transition: 'width 0.1s, height 0.1s',
            }}
          />
        )}

        {/* Secondary glow trail */}
        {isHovering && displacement > 0.5 && containerRef.current && (
          <div
            style={{
              position: 'absolute',
              left: rawMousePos.x - mouseVelocity.x * 3,
              top: rawMousePos.y - mouseVelocity.y * 3,
              width: `${25 + displacement * 3}px`,
              height: `${25 + displacement * 3}px`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(255, 255, 255, ${0.02 + displacement * 0.003}) 0%, transparent 60%)`,
              filter: `blur(${12}px)`,
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />
        )}

        {/* Static particles that follow mouse */}
        {isActive && staticParticles.map(particle => (
          <div
            key={`static-${particle.id}`}
            style={{
              position: 'absolute',
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 15,
            }}
          >
            {particle.char ? (
              <span
                style={{
                  fontSize: `${8 + particle.size * 2}px`,
                  fontFamily: 'monospace',
                  color: `rgba(255, 255, 255, ${particle.opacity})`,
                  textShadow: `0 0 4px rgba(255, 255, 255, ${particle.opacity * 0.5})`,
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
                  boxShadow: `0 0 ${particle.size * 2}px rgba(255, 255, 255, ${particle.opacity * 0.3})`,
                }}
              />
            )}
          </div>
        ))}

        {/* Film grain */}
        {isActive && filmGrain.map(grain => (
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

        {/* Etch-a-sketch crosshair - X and Y lines meeting at cursor */}
        {isHovering && containerRef.current && (() => {
          // The backdrop has inset: -20px, so we need to offset the mouse position
          const backdropOffset = isMobile ? 15 : 20;
          const adjustedX = rawMousePos.x + backdropOffset;
          const adjustedY = rawMousePos.y + backdropOffset;
          const rect = containerRef.current.getBoundingClientRect();
          const backdropWidth = rect.width + (backdropOffset * 2);
          const backdropHeight = rect.height + (backdropOffset * 2);
          const xPercent = (adjustedX / backdropWidth) * 100;
          const yPercent = (adjustedY / backdropHeight) * 100;
          return (
            <>
              {/* Horizontal scan line (follows mouse Y) */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: adjustedY,
                  height: '1px',
                  background: `linear-gradient(90deg,
                    transparent 0%,
                    rgba(255, 255, 255, ${0.02 + displacement * 0.002}) ${Math.max(0, xPercent - 40)}%,
                    rgba(255, 255, 255, ${0.12 + displacement * 0.01}) ${xPercent}%,
                    rgba(255, 255, 255, ${0.02 + displacement * 0.002}) ${Math.min(100, xPercent + 40)}%,
                    transparent 100%
                  )`,
                  boxShadow: `0 0 ${6 + displacement}px rgba(255, 255, 255, ${0.03 + displacement * 0.003})`,
                  pointerEvents: 'none',
                  zIndex: 11,
                }}
              />
              {/* Vertical scan line (follows mouse X) */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: adjustedX,
                  width: '1px',
                  background: `linear-gradient(180deg,
                    transparent 0%,
                    rgba(255, 255, 255, ${0.02 + displacement * 0.002}) ${Math.max(0, yPercent - 40)}%,
                    rgba(255, 255, 255, ${0.12 + displacement * 0.01}) ${yPercent}%,
                    rgba(255, 255, 255, ${0.02 + displacement * 0.002}) ${Math.min(100, yPercent + 40)}%,
                    transparent 100%
                  )`,
                  boxShadow: `0 0 ${6 + displacement}px rgba(255, 255, 255, ${0.03 + displacement * 0.003})`,
                  pointerEvents: 'none',
                  zIndex: 11,
                }}
              />
              {/* Intersection glow - brighter where lines meet */}
              <div
                style={{
                  position: 'absolute',
                  left: adjustedX,
                  top: adjustedY,
                  width: `${4 + displacement * 0.6}px`,
                  height: `${4 + displacement * 0.6}px`,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, rgba(255, 255, 255, ${0.35 + displacement * 0.03}) 0%, transparent 70%)`,
                  pointerEvents: 'none',
                  zIndex: 12,
                }}
              />
            </>
          );
        })()}

        {/* Ambient scan line when not hovering - sweeps occasionally */}
        {!isHovering && ambientScanActive && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${ambientScanPos}%`,
              height: '1px',
              background: `linear-gradient(90deg,
                transparent 0%,
                rgba(255, 255, 255, 0.04) 15%,
                rgba(255, 255, 255, 0.08) 50%,
                rgba(255, 255, 255, 0.04) 85%,
                transparent 100%
              )`,
              boxShadow: '0 0 8px rgba(255, 255, 255, 0.03)',
              pointerEvents: 'none',
              zIndex: 11,
            }}
          />
        )}

        {/* Glitch fragments */}
        {isActive && glitchFragments.map(frag => (
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

        {/* Light leak */}
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

        {/* Horizontal lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 3px,
              rgba(0, 0, 0, 0.05) 3px,
              rgba(0, 0, 0, 0.05) 4px
            )`,
            opacity: isActive ? 0.5 : 0,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      </div>

      {/* Chromatic aberration layers - velocity based */}
      {(showGlitch || (isHovering && Math.abs(chromaticOffset.r) > 0.3)) && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: `rgba(255, 80, 80, ${showGlitch ? 0.4 : Math.min(0.35, Math.abs(chromaticOffset.r) * 0.08)})`,
              fontSize: `${fontSizeValue}${fontSizeUnit}`,
              fontWeight: '600',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              transform: `translateX(${showGlitch ? (-3 + noiseOffset.x) : chromaticOffset.r}px)`,
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
              color: `rgba(80, 200, 255, ${showGlitch ? 0.4 : Math.min(0.35, Math.abs(chromaticOffset.b) * 0.08)})`,
              fontSize: `${fontSizeValue}${fontSizeUnit}`,
              fontWeight: '600',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              transform: `translateX(${showGlitch ? (3 + noiseOffset.x) : chromaticOffset.b}px)`,
              pointerEvents: 'none',
              zIndex: 15,
              mixBlendMode: 'screen',
            }}
          >
            {scrambleText || formatted}
          </div>
        </>
      )}

      {/* Ambient glow - constant CRT screen look */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '200%',
          height: '250%',
          background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Main content with magnetic pull */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: flickerOpacity,
          transform: `translate(${magneticPull.x + noiseOffset.x}px, ${magneticPull.y + noiseOffset.y}px)`,
          transition: isActive ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
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
            textShadow: isActive ? '0 0 8px rgba(255, 255, 255, 0.3)' : 'none',
            transition: 'text-shadow 0.3s ease',
          }}
        >
          Your Points
        </div>

        {/* Digits with wave displacement */}
        <div
          ref={digitsRef}
          aria-hidden="true"
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: showGlitch ? 'blur(0.3px)' : 'none',
          }}
        >
          {(scrambleText || formatted).split('').map((char, i, arr) => {
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
            const wave = getDigitWave(i, arr.length);
            const hasGlitchChar = digitGlitchChars[i] !== undefined;
            const glitchChar = digitGlitchChars[i];
            const isDigitHovered = hoveredDigitIndex === i;

            return (
              <div
                key={`digit-${i}`}
                style={{
                  position: 'relative',
                  width: `${digitWidth}${fontSizeUnit}`,
                  height: `${digitHeight}${fontSizeUnit}`,
                  overflow: 'hidden',
                  display: 'inline-block',
                  transform: `translate(${wave.x}px, ${wave.y}px) scale(${wave.scale})`,
                  transition: isHovering ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* Glitch character overlay - shows when digit is hovered */}
                {hasGlitchChar && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10,
                      fontSize: `${fontSizeValue}${fontSizeUnit}`,
                      fontWeight: '600',
                      fontFamily: 'Inter, monospace',
                      color: '#FFFFFF',
                      textShadow: `
                        0 0 20px rgba(255, 255, 255, 0.8),
                        0 0 40px rgba(255, 255, 255, 0.4),
                        -2px 0 rgba(255, 80, 80, 0.6),
                        2px 0 rgba(80, 200, 255, 0.6)
                      `,
                      transform: `translateX(${(Math.random() - 0.5) * 3}px)`,
                    }}
                  >
                    {glitchChar}
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    transform: isScrambling
                      ? `translateY(-${(parseInt(char) || 0) * digitHeight}${fontSizeUnit})`
                      : `translateY(-${(parseInt(formatted[i]) || 0) * digitHeight}${fontSizeUnit})`,
                    transition: isScrambling ? 'none' : 'transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
                    opacity: hasGlitchChar ? 0.15 : 1,
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                    // Calculate glow intensity based on displacement (decays gradually)
                    const glowIntensity = Math.min(1, displacement / 5); // 0 to 1 based on displacement
                    const baseGlow = 10;
                    const maxExtraGlow = 15;
                    const glowSize = baseGlow + (maxExtraGlow * glowIntensity) + (displacement * 0.5);
                    const glowOpacity = 0.2 + (0.25 * glowIntensity);

                    return (
                      <div
                        key={n}
                        style={{
                          ...digitStyle,
                          textShadow: `0 0 ${glowSize}px rgba(255, 255, 255, ${glowOpacity}), 0 0 ${glowSize * 1.8}px rgba(255, 255, 255, ${glowOpacity * 0.5})`,
                        }}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>

                {/* Digit-specific chromatic on hover */}
                {isDigitHovered && !hasGlitchChar && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255, 80, 80, 0.3)',
                        fontSize: `${fontSizeValue}${fontSizeUnit}`,
                        fontWeight: '600',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                        transform: 'translateX(-2px)',
                        pointerEvents: 'none',
                        zIndex: 8,
                        mixBlendMode: 'screen',
                      }}
                    >
                      {formatted[i]}
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(80, 200, 255, 0.3)',
                        fontSize: `${fontSizeValue}${fontSizeUnit}`,
                        fontWeight: '600',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                        transform: 'translateX(2px)',
                        pointerEvents: 'none',
                        zIndex: 8,
                        mixBlendMode: 'screen',
                      }}
                    >
                      {formatted[i]}
                    </div>
                  </>
                )}

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

        {/* Redeem text */}
        <div
          style={{
            marginTop: isMobile ? '1.25rem' : '1.75rem',
            fontSize: isMobile ? '0.625rem' : '0.75rem',
            fontWeight: '500',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            letterSpacing: '0.15em',
            color: 'rgba(255, 255, 255, 0.45)',
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
