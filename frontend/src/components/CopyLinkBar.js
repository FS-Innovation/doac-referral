import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * CopyLinkBar - Award-Winning Interactive Copy Link Component
 * Subtle CRT/retro-tech aesthetic with delightful micro-interactions
 * Features: Gentle glow, soft scan line, creative success states
 */
const CopyLinkBar = ({ url, onCopy, copied, isMobile = false }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scanLinePos, setScanLinePos] = useState(0);
  const [buttonPulse, setButtonPulse] = useState(0);
  const [linkGlow, setLinkGlow] = useState(0);
  const [ripples, setRipples] = useState([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayText, setDisplayText] = useState('Copy Link');
  const [iconGlitching, setIconGlitching] = useState(false);
  const [glitchIcon, setGlitchIcon] = useState('');
  const [showIcon, setShowIcon] = useState(true);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const animationRef = useRef(null);
  const iconGlitchRef = useRef(null);

  const glitchChars = '░▒▓█▀▄@#$%&*!?<>[]{}~^';

  // Handle mouse movement - subtle tracking
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || isMobile) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  }, [isMobile]);

  // Subtle animation loop
  useEffect(() => {
    if (isHovering && !isMobile) {
      const animate = () => {
        // Gentle scan line - slower, more cinematic
        setScanLinePos(prev => (prev + 0.4) % 120);

        // Subtle link glow pulse
        setLinkGlow(prev => {
          const target = isButtonHovered ? 0.3 : 0.15;
          return prev + (target - prev) * 0.08;
        });

        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Smooth decay
      const decay = () => {
        let stillDecaying = false;
        setLinkGlow(prev => {
          if (prev < 0.01) return 0;
          stillDecaying = true;
          return prev * 0.94;
        });
        if (stillDecaying) {
          animationRef.current = requestAnimationFrame(decay);
        }
      };
      animationRef.current = requestAnimationFrame(decay);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isHovering, isButtonHovered, isMobile]);

  // Button pulse animation on hover
  useEffect(() => {
    if (isButtonHovered && !copied) {
      const pulse = () => {
        setButtonPulse(prev => (prev + 0.03) % (Math.PI * 2));
        animationRef.current = requestAnimationFrame(pulse);
      };
      animationRef.current = requestAnimationFrame(pulse);
    } else {
      setButtonPulse(0);
    }
  }, [isButtonHovered, copied]);

  // Morphing text animation: "Copy Link" → "COPIED..."
  // C stays C, o→O, p→P, y→I, " "→E, L→D, i→., n→., k→.
  const animateMorphText = useCallback(() => {
    const startText = 'Copy Link';
    const endText = 'COPIED...';

    // Character mapping with glitch frames before settling
    // Each entry: [startChar, endChar, glitchFrames]
    const morphMap = [
      { start: 'C', end: 'C', delay: 0 },
      { start: 'o', end: 'O', delay: 1 },
      { start: 'p', end: 'P', delay: 2 },
      { start: 'y', end: 'I', delay: 4 },  // y→I with more glitch
      { start: ' ', end: 'E', delay: 5 },  // space→E
      { start: 'L', end: 'D', delay: 6 },  // L→D
      { start: 'i', end: '.', delay: 8 },  // ink→...
      { start: 'n', end: '.', delay: 9 },
      { start: 'k', end: '.', delay: 10 },
    ];

    let frame = 0;
    const totalFrames = 18;
    const glitchDuration = 4; // frames of glitching per character

    setIsTransitioning(true);

    // Icon glitch - rapidly cycle through glitch characters (slower)
    setIconGlitching(true);
    let glitchFrame = 0;
    const totalGlitchFrames = 10;

    const animateIcon = () => {
      if (glitchFrame < totalGlitchFrames) {
        setGlitchIcon(glitchChars[Math.floor(Math.random() * glitchChars.length)]);
        glitchFrame++;
        iconGlitchRef.current = setTimeout(animateIcon, 50); // Slower: 50ms per frame
      } else {
        setShowIcon(false);
        setIconGlitching(false);
        setGlitchIcon('');
      }
    };
    animateIcon();

    const animate = () => {
      frame++;

      if (frame <= totalFrames) {
        let text = '';

        morphMap.forEach((char, i) => {
          const charFrame = frame - char.delay;

          if (charFrame <= 0) {
            // Not started yet - show original
            text += char.start;
          } else if (charFrame <= glitchDuration) {
            // Glitching phase - random chars
            text += glitchChars[Math.floor(Math.random() * glitchChars.length)];
          } else {
            // Settled - show final
            text += char.end;
          }
        });

        setDisplayText(text);
        setTimeout(animate, 45);
      } else {
        setDisplayText(endText);
        setIsTransitioning(false);
      }
    };

    animate();
  }, []);

  // Reset text and icon when copied becomes false
  useEffect(() => {
    if (!copied && !isTransitioning) {
      setDisplayText('Copy Link');
      setShowIcon(true);
      setIconGlitching(false);
      setGlitchIcon('');
      if (iconGlitchRef.current) {
        clearTimeout(iconGlitchRef.current);
      }
    }
  }, [copied, isTransitioning]);

  // Copy success animation with ripple effect
  useEffect(() => {
    if (copied && buttonRef.current) {
      // Trigger morphing text animation
      animateMorphText();

      // Create expanding ripple
      const rect = buttonRef.current.getBoundingClientRect();
      const newRipple = {
        id: Date.now(),
        x: rect.width / 2,
        y: rect.height / 2,
      };
      setRipples(prev => [...prev, newRipple]);

      // Clean up ripple after animation
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, 600);
    }
  }, [copied, animateMorphText]);

  const pulseScale = 1 + Math.sin(buttonPulse) * 0.012;
  const pulseGlow = 12 + Math.sin(buttonPulse) * 4;

  if (isMobile) {
    // Mobile: Clean, accessible design
    return (
      <div style={{ marginBottom: '12px' }}>
        <div
          onClick={onCopy}
          role="button"
          tabIndex={0}
          aria-label={`Copy referral link: ${url}`}
          onKeyDown={(e) => e.key === 'Enter' && onCopy()}
          style={{
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '12px',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          {/* Subtle scan lines */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 3px,
              rgba(255, 255, 255, 0.015) 3px,
              rgba(255, 255, 255, 0.015) 4px
            )`,
            pointerEvents: 'none',
          }} />
          <code style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
            fontSize: '0.8125rem',
            fontWeight: '400',
            lineHeight: '1.5',
            background: 'transparent',
            display: 'block',
            wordBreak: 'break-all',
          }}>{url}</code>
        </div>
        <button
          onClick={onCopy}
          aria-label={copied ? 'Link copied to clipboard' : 'Copy link to clipboard'}
          style={{
            position: 'relative',
            background: copied
              ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 240, 245, 0.95) 100%)'
              : 'rgba(255, 255, 255, 0.95)',
            color: '#000',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: 0,
            borderRadius: '10px',
            fontSize: '0.9375rem',
            fontWeight: '600',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            letterSpacing: '0.02em',
            cursor: 'pointer',
            transition: 'background 0.3s, box-shadow 0.3s',
            width: '100%',
            height: '48px',
            overflow: 'hidden',
            boxShadow: copied
              ? '0 0 30px rgba(255, 255, 255, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)'
              : '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Continuous scan line */}
          <div style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            borderRadius: '9px',
            pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.05) 20%, rgba(0, 0, 0, 0.07) 50%, rgba(0, 0, 0, 0.05) 80%, transparent 100%)',
              animation: 'buttonScanLine 3s linear infinite',
            }} />
          </div>
          <span style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            {/* Icon */}
            {showIcon && (
              iconGlitching ? (
                <span style={{
                  fontSize: '14px',
                  fontFamily: "'SF Mono', monospace",
                }}>
                  {glitchIcon}
                </span>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )
            )}
            {/* Text */}
            <span>
              {displayText}
            </span>
          </span>
          {/* Mobile keyframes */}
          <style>{`
            @keyframes buttonScanLine {
              0% { top: -2px; }
              100% { top: calc(100% + 2px); }
            }
          `}</style>
        </button>
      </div>
    );
  }

  // Desktop: Refined interactive experience
  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
      role="group"
      aria-label="Referral link section"
      style={{
        position: 'relative',
        background: isHovering
          ? 'rgba(255, 255, 255, 0.025)'
          : 'rgba(255, 255, 255, 0.015)',
        border: `1px solid rgba(255, 255, 255, ${isHovering ? 0.1 : 0.06})`,
        padding: '14px 18px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glow following cursor - very subtle */}
      {isHovering && (
        <div
          style={{
            position: 'absolute',
            left: mousePos.x,
            top: mousePos.y,
            width: '120px',
            height: '120px',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, rgba(255, 255, 255, ${0.03 + linkGlow * 0.05}) 0%, transparent 70%)`,
            pointerEvents: 'none',
            zIndex: 0,
            filter: 'blur(20px)',
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      {/* Gentle scan line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${scanLinePos - 10}%`,
          height: '1px',
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(255, 255, 255, ${isHovering ? 0.04 : 0}) 30%,
            rgba(255, 255, 255, ${isHovering ? 0.06 : 0}) 50%,
            rgba(255, 255, 255, ${isHovering ? 0.04 : 0}) 70%,
            transparent 100%
          )`,
          pointerEvents: 'none',
          zIndex: 5,
          opacity: isHovering ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* Subtle scan lines texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 3px,
            rgba(0, 0, 0, 0.02) 3px,
            rgba(0, 0, 0, 0.02) 4px
          )`,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.5,
        }}
      />

      {/* Link icon */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '38px',
        height: '38px',
        borderRadius: '9px',
        background: `rgba(255, 255, 255, ${isHovering ? 0.06 : 0.04})`,
        flexShrink: 0,
        zIndex: 2,
        transition: 'all 0.4s ease',
      }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={`rgba(255, 255, 255, ${isHovering ? 0.7 : 0.45})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'stroke 0.4s ease' }}
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </div>

      {/* URL Text */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        zIndex: 2,
      }}>
        <code style={{
          position: 'relative',
          color: `rgba(255, 255, 255, ${isHovering ? 0.75 : 0.55})`,
          fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
          fontSize: '0.875rem',
          fontWeight: '400',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
          transition: 'color 0.4s ease',
          textShadow: isHovering ? `0 0 ${8 + linkGlow * 10}px rgba(255, 255, 255, ${linkGlow * 0.4})` : 'none',
        }}>
          {url}
        </code>
      </div>

      {/* Copy button - award-winning design with delightful interactions */}
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); onCopy(); }}
        onMouseEnter={() => setIsButtonHovered(true)}
        onMouseLeave={() => setIsButtonHovered(false)}
        onFocus={() => setIsButtonHovered(true)}
        onBlur={() => setIsButtonHovered(false)}
        aria-label={copied ? 'Link copied to clipboard' : 'Copy link to clipboard'}
        style={{
          position: 'relative',
          width: '120px',
          height: '40px',
          background: copied
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(245, 245, 250, 1) 100%)'
            : isButtonHovered
              ? 'rgba(255, 255, 255, 1)'
              : 'rgba(255, 255, 255, 0.92)',
          color: '#000',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: 0,
          borderRadius: '9px',
          fontSize: '0.875rem',
          fontWeight: '600',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          letterSpacing: '0.01em',
          cursor: 'pointer',
          transition: 'background 0.35s, box-shadow 0.35s, border 0.35s',
          flexShrink: 0,
          zIndex: 2,
          boxShadow: copied
            ? '0 0 40px rgba(255, 255, 255, 0.4), 0 0 80px rgba(255, 255, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
            : isButtonHovered
              ? `0 0 ${pulseGlow}px rgba(255, 255, 255, 0.25), 0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)`
              : '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
          outline: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Continuous scan line - CSS animation, very lightweight */}
        <div style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: '8px',
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.06) 20%, rgba(0, 0, 0, 0.08) 50%, rgba(0, 0, 0, 0.06) 80%, transparent 100%)',
            animation: 'buttonScanLine 3s linear infinite',
          }} />
        </div>

        {/* Ripple effect on copy */}
        {ripples.map(ripple => (
          <div
            key={ripple.id}
            style={{
              position: 'absolute',
              left: ripple.x,
              top: ripple.y,
              width: '200%',
              paddingBottom: '200%',
              marginLeft: '-100%',
              marginTop: '-100%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 70%)',
              animation: 'ripple 0.6s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Button inner glow on hover */}
        {isButtonHovered && !copied && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, transparent 40%)',
            pointerEvents: 'none',
            borderRadius: '8px',
          }} />
        )}

        {/* Subtle noise texture */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: copied ? 0.08 : 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          pointerEvents: 'none',
          borderRadius: '8px',
          transition: 'opacity 0.3s ease',
        }} />

        <span style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          {/* Icon */}
          {showIcon && (
            iconGlitching ? (
              <span style={{
                fontSize: '13px',
                fontFamily: "'SF Mono', monospace",
              }}>
                {glitchIcon}
              </span>
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: isButtonHovered
                    ? 'translateY(-2px) rotate(-3deg)'
                    : 'translateY(0) rotate(0)',
                }}
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )
          )}
          {/* Text */}
          <span style={{
            letterSpacing: isButtonHovered ? '0.03em' : '0.01em',
            transition: isTransitioning ? 'none' : 'letter-spacing 0.25s ease',
          }}>
            {displayText}
          </span>
        </span>
      </button>

      {/* Keyframe animations */}
      <style>{`
        @keyframes buttonScanLine {
          0% { top: -2px; }
          100% { top: calc(100% + 2px); }
        }
        @keyframes ripple {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CopyLinkBar;
