import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

const ReferralRedirect = () => {
  const { code } = useParams();

  useEffect(() => {
    // Redirect to backend referral tracking endpoint
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    window.location.href = `${API_URL}/api/referral/${code}`;
  }, [code]);

  return (
    <div className="loading">
      Redirecting...
    </div>
  );
};

export default ReferralRedirect;
