import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && activeCard < prizes.length - 1) {
      setActiveCard(activeCard + 1);
    }
    if (isRightSwipe && activeCard > 0) {
      setActiveCard(activeCard - 1);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await userAPI.getReferralStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(stats.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const prizes = [
    { id: 1, name: 'Prize 1', color: '#5C5C5C', image: 'https://storage.googleapis.com/doac-perks/Rectangle%20160.png' },
    { id: 2, name: 'Prize 2', color: '#4C4C4C', image: 'https://storage.googleapis.com/doac-perks/Rectangle%20164.png' },
    { id: 3, name: 'Prize 3', color: '#3C3C3C', image: 'https://storage.googleapis.com/doac-perks/Rectangle%20166.png' },
    { id: 4, name: 'Prize 4', color: '#2C2C2C', image: 'https://storage.googleapis.com/doac-perks/Rectangle%20165.png' }
  ];

  const handleCardClick = (index) => {
    setActiveCard(index);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container" style={{ padding: isMobile ? '10px' : '20px' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: isMobile ? '2rem' : '3rem'
      }}>
        <h1 style={{
          color: '#FFF',
          textAlign: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: isMobile ? '1.5rem' : '2.1875rem',
          fontStyle: 'normal',
          fontWeight: '500',
          lineHeight: isMobile ? '1.5rem' : '1.875rem',
          letterSpacing: '0',
          margin: '0',
          marginBottom: isMobile ? '1rem' : '1.5rem',
          padding: isMobile ? '0 20px' : '0'
        }}>
          Use your referral link<br />to earn points
        </h1>
        <p style={{
          color: '#FFF',
          textAlign: isMobile ? 'left' : 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '0.9375rem',
          fontStyle: 'normal',
          fontWeight: '400',
          lineHeight: '1.25rem',
          letterSpacing: '0',
          margin: '0',
          maxWidth: '600px',
          padding: isMobile ? '0 20px' : '0'
        }}>
          {isMobile ? (
            'Your unique referral link takes you directly to the latest episode of DOAC. Every time someone clicks on your link, you earn points. These points can then be used to redeem prizes'
          ) : (
            <>Your unique referral link takes you directly to the latest episode of DOAC.<br />Every time someone clicks on your link, you earn points.<br />These points can then be used to redeem prizes</>
          )}
        </p>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: isMobile ? '4rem' : '6rem'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{
            color: '#FFF',
            textAlign: 'center',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: isMobile ? '0.8125rem' : '0.9375rem',
            fontStyle: 'normal',
            fontWeight: '600',
            lineHeight: '1.25rem',
            letterSpacing: '0',
            marginBottom: isMobile ? '2rem' : '3.25rem'
          }}>
            TOTAL POINTS
          </div>
          <div style={{
            color: '#FFF',
            textAlign: 'center',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: isMobile ? '3.5rem' : '6.25rem',
            fontStyle: 'normal',
            fontWeight: '500',
            lineHeight: isMobile ? '1.5rem' : '1.875rem',
            letterSpacing: '0'
          }}>
            {user.points.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{
        background: '#0D0D0D',
        border: '1px solid transparent',
        backgroundImage: 'linear-gradient(#0D0D0D, #0D0D0D), linear-gradient(135deg, #FFF 0%, #5A2F30 100%)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        borderRadius: isMobile ? '16px' : '10px',
        padding: isMobile ? '20px 16px' : '24px',
        marginBottom: isMobile ? '16px' : '20px',
        margin: isMobile ? '0 16px 16px 16px' : '0 0 20px 0'
      }}>
        <h2 style={{
          color: '#FFF',
          marginBottom: isMobile ? '12px' : '16px',
          fontSize: isMobile ? '1.125rem' : '1.5rem'
        }}>Your Referral Link</h2>
        <p style={{
          color: '#B5B5B5',
          marginBottom: isMobile ? '16px' : '20px',
          fontSize: isMobile ? '0.875rem' : '1rem',
          lineHeight: '1.5'
        }}>Share this link to earn points! Each unique click gives you 1 point.</p>

        {isMobile ? (
          // Mobile: Stacked layout
          <div>
            <div style={{
              background: '#1B1B1B',
              border: '1px solid transparent',
              backgroundImage: 'linear-gradient(#1B1B1B, #1B1B1B), linear-gradient(135deg, #919191 0%, #5A2F30 100%)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '12px',
              wordBreak: 'break-all'
            }}>
              <code style={{
                color: '#B5B5B5',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '0.8125rem',
                fontWeight: '400',
                lineHeight: '1.4',
                background: 'transparent',
                display: 'block'
              }}>{stats?.referralUrl}</code>
            </div>
            <button onClick={copyToClipboard} style={{
              background: '#FFF',
              color: '#000',
              border: 'none',
              padding: '14px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              width: '100%',
              touchAction: 'manipulation'
            }}>
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
        ) : (
          // Desktop: Horizontal layout
          <div style={{
            background: '#1B1B1B',
            border: '1px solid transparent',
            backgroundImage: 'linear-gradient(#1B1B1B, #1B1B1B), linear-gradient(135deg, #919191 0%, #5A2F30 100%)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            padding: '15px',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <code style={{
              flex: 1,
              color: '#B5B5B5',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: '0.9375rem',
              fontStyle: 'normal',
              fontWeight: '400',
              lineHeight: '1.25rem',
              letterSpacing: '0',
              marginRight: '10px',
              background: 'transparent'
            }}>{stats?.referralUrl}</code>
            <button onClick={copyToClipboard} style={{
              background: '#FFF',
              color: '#000',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: isMobile ? '2.5rem' : '4rem',
        marginBottom: isMobile ? '1.5rem' : '2rem',
        padding: isMobile ? '0 16px' : '0'
      }}>
        <h2 style={{
          color: '#FFF',
          textAlign: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: isMobile ? '1.75rem' : '2.1875rem',
          fontStyle: 'normal',
          fontWeight: '500',
          lineHeight: isMobile ? '1.5rem' : '1.875rem',
          letterSpacing: '0',
          margin: '0',
          marginBottom: isMobile ? '1rem' : '1.5rem'
        }}>
          Unlock Prizes
        </h2>
        <p style={{
          color: '#B5B5B5',
          textAlign: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: isMobile ? '0.875rem' : '0.9375rem',
          fontStyle: 'normal',
          fontWeight: '400',
          lineHeight: '1.25rem',
          letterSpacing: '0',
          margin: '0',
          marginBottom: isMobile ? '2rem' : '3rem'
        }}>
          You're eligible for 0 prizes
        </p>


        {/* Stacked Prize Cards */}
        <div
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchMove={isMobile ? handleTouchMove : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: isMobile ? '100%' : '1200px',
            height: isMobile ? '280px' : '500px',
            margin: '0 auto',
            cursor: isMobile ? 'grab' : 'pointer',
            userSelect: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'visible',
            padding: isMobile ? '0 16px' : '0'
          }}
        >
          <div style={{
            position: 'relative',
            width: isMobile ? '100%' : '900px',
            height: isMobile ? '280px' : '500px',
            maxWidth: isMobile ? '400px' : '900px'
          }}
          >
          {prizes.map((prize, index) => {
            const isActive = index === activeCard;

            // Mobile vs Desktop spacing
            const cardWidth = isMobile ? '85%' : '28.625rem';
            const cardHeight = isMobile ? '180px' : '21.625rem';

            // Mobile: Static cascade with more vertical than horizontal
            // Desktop: Original cascade effect
            let top, left, opacity, zIndex;

            if (isMobile) {
              // Mobile: Static cascade - more down, less right
              const horizontalSpacing = 1; // Small right shift (1rem)
              const verticalSpacing = 2; // Larger down shift (2rem)

              top = `${index * verticalSpacing}rem`;
              left = `${index * horizontalSpacing}rem`;
              opacity = 1;
              zIndex = prizes.length - index; // Stack naturally
            } else {
              // Desktop cascade layout
              const horizontalSpacing = 5.63; // rem
              const verticalSpacing = 1; // rem
              const centerOffset = -5.5;

              if (isActive) {
                top = `${index * verticalSpacing}rem`;
                left = `${index * horizontalSpacing - centerOffset}rem`;
                zIndex = 100;
              } else if (index < activeCard) {
                const steps = activeCard - index;
                top = `${activeCard * verticalSpacing + steps * verticalSpacing}rem`;
                left = `${activeCard * horizontalSpacing - steps * horizontalSpacing - centerOffset}rem`;
                zIndex = 50 + index;
              } else {
                const steps = index - activeCard;
                top = `${activeCard * verticalSpacing + steps * verticalSpacing}rem`;
                left = `${activeCard * horizontalSpacing + steps * horizontalSpacing - centerOffset}rem`;
                zIndex = 50 - steps;
              }
              opacity = 1;
            }

            const isHovered = hoveredCard === index;

            return (
              <div
                key={prize.id}
                onClick={() => handleCardClick(index)}
                onMouseEnter={() => !isMobile && setHoveredCard(index)}
                onMouseLeave={() => !isMobile && setHoveredCard(null)}
                onTouchStart={() => setHoveredCard(index)}
                onTouchEnd={() => setHoveredCard(null)}
                style={{
                  position: 'absolute',
                  top: top,
                  left: left,
                  width: cardWidth,
                  height: cardHeight,
                  flexShrink: 0,
                  background: `linear-gradient(135deg, ${prize.color} 0%, ${prize.color}DD 100%)`,
                  border: `1px solid rgba(255, 255, 255, ${0.1 + index * 0.05})`,
                  borderRadius: isMobile ? '8px' : '12px',
                  boxShadow: isActive
                    ? '0 20px 60px rgba(0, 0, 0, 0.6)'
                    : '0 8px 24px rgba(0, 0, 0, 0.4)',
                  zIndex: zIndex,
                  opacity: opacity,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFF',
                  fontSize: isMobile ? '0.875rem' : '1.25rem',
                  fontWeight: '600',
                  transition: 'top 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), left 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.3s ease-out, box-shadow 0.3s ease-out, opacity 0.6s ease, z-index 0s',
                  transform: isActive && !isMobile
                    ? 'scale(1.05) translateY(-10px)'
                    : isHovered && !isMobile
                    ? 'translateY(-5px) rotate(1deg)'
                    : 'scale(1)',
                  willChange: 'top, left, transform',
                  touchAction: 'manipulation',
                  pointerEvents: isMobile ? 'none' : 'auto'
                }}
              >
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%'
                }}>
                  <img
                    src={prize.image}
                    alt={prize.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: isMobile ? '8px' : '12px'
                    }}
                  />
                  {index === 0 && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.5)',
                      borderRadius: isMobile ? '8px' : '12px'
                    }}>
                      <div style={{
                        color: '#FFF',
                        textAlign: 'center',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                        fontSize: '0.9375rem',
                        fontStyle: 'normal',
                        fontWeight: '600',
                        lineHeight: '1.25rem',
                        letterSpacing: '0'
                      }}>
                        PRIZES
                      </div>
                      <div style={{
                        color: '#FFF',
                        textAlign: 'center',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                        fontSize: '2.1875rem',
                        fontStyle: 'normal',
                        fontWeight: '500',
                        lineHeight: '2.375rem',
                        letterSpacing: '0',
                        textTransform: 'uppercase'
                      }}>
                        COMING SOON
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
