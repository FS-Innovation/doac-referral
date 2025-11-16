import { useState, useEffect } from 'react';
import './CookieConsent.css';

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the notice
    const dismissed = localStorage.getItem('cookie_notice_dismissed');
    if (!dismissed) {
      // Show notice after short delay for better UX
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('cookie_notice_dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="cookie-consent-banner">
      <p className="cookie-text">
        This site uses essential cookies for authentication.{' '}
        <a href="/cookie-policy" target="_blank" rel="noopener noreferrer" className="cookie-link">
          Learn more
        </a>
      </p>
      <div className="cookie-buttons">
        <button onClick={handleDismiss} className="cookie-btn-accept">
          Got it
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
