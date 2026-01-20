import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './PrivacyPolicy.css';

const TermsConditions = () => {
  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);

    // Remove existing Termly script to force reload
    const existingScript = document.getElementById('termly-jssdk');
    if (existingScript) {
      existingScript.remove();
    }

    // Load Termly embed script fresh
    const script = document.createElement('script');
    script.id = 'termly-jssdk';
    script.src = 'https://app.termly.io/embed-policy.min.js';
    script.async = true;
    document.body.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById('termly-jssdk');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, []);

  return (
    <div className="privacy-policy-page">
      {/* Navigation Header */}
      <header className="policy-header">
        <div className="policy-header-container">
          <Link to="/dashboard" className="policy-logo-link">
            <img
              src="https://storage.googleapis.com/doac-perks/e4e508a04084eee9320c875b55dca2cec34de30b.png"
              alt="DOAC Logo"
              className="policy-logo-image"
            />
          </Link>
        </div>
      </header>

      <div className="privacy-policy-container">
        <div
          name="termly-embed"
          data-id="90be1628-e23c-4bcd-9a73-5a3f666a5f9d"
        />

        <div className="policy-footer">
          <div className="policy-links">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/cookie-policy">Cookie Policy</Link>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (window.displayPreferenceModal) {
                  window.displayPreferenceModal();
                } else if (window.Termly && window.Termly.displayPreferenceModal) {
                  window.Termly.displayPreferenceModal();
                }
              }}
            >
              Consent Preferences
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsConditions;
