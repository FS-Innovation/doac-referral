import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDeviceId, getDeviceFingerprint, getBrowserFingerprint } from '../utils/fingerprint';

const ReferralRedirect = () => {
  const { code } = useParams();

  useEffect(() => {
    const trackAndRedirect = async () => {
      try {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

        // Get all three device/browser identifiers (industry standard fraud detection)
        const deviceId = getDeviceId(); // Persistent UUID in localStorage
        const deviceFingerprint = await getDeviceFingerprint(); // Hardware characteristics
        const browserFingerprint = await getBrowserFingerprint(); // Browser/software characteristics

        // Send tracking request with all fraud detection headers
        const response = await fetch(`${API_URL}/api/referral/${code}`, {
          method: 'GET',
          headers: {
            'x-device-id': deviceId,
            'x-device-fingerprint': deviceFingerprint,
            'x-browser-fingerprint': browserFingerprint,
          },
          redirect: 'manual', // Don't auto-redirect
        });

        // Get the redirect URL from the response
        if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 301) {
          // For redirects, we need to manually redirect
          const redirectUrl = response.headers.get('Location') || 'https://youtu.be/qxxnRMT9C-8';
          window.location.href = redirectUrl;
        } else {
          // Fallback: redirect to default video
          window.location.href = 'https://youtu.be/qxxnRMT9C-8';
        }
      } catch (error) {
        console.error('Error tracking referral:', error);
        // Fallback: redirect to default video even on error
        window.location.href = 'https://youtu.be/qxxnRMT9C-8';
      }
    };

    trackAndRedirect();
  }, [code]);

  return (
    <div className="loading">
      Redirecting...
    </div>
  );
};

export default ReferralRedirect;
