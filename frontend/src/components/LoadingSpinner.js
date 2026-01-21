import React from 'react';

/**
 * Retro digital "LOADING..." text
 * Pure CSS animation - no JS, no timers, no state
 * Ultra-lightweight and fast
 */
const LoadingSpinner = () => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#000',
      width: '100%'
    }}>
      <div
        className="loading-text"
        style={{
          fontFamily: "'Inter', -apple-system, monospace",
          fontSize: '1.2rem',
          fontWeight: '500',
          letterSpacing: '0.3em',
          color: 'rgba(255, 255, 255, 0.8)',
          textTransform: 'uppercase',
        }}
      >
        LOADING<span className="loading-dots">...</span>
      </div>
      <style>{`
        .loading-text {
          animation: flicker 0.15s infinite;
        }
        .loading-dots {
          animation: blink 1s steps(4, end) infinite;
        }
        @keyframes flicker {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.75; }
        }
        @keyframes blink {
          0% { content: ''; opacity: 0; }
          25% { content: '.'; opacity: 0.8; }
          50% { content: '..'; opacity: 0.8; }
          75%, 100% { content: '...'; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
