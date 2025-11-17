import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ReferralRedirect = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // NEW FLOW: Just navigate to the landing page
    // The landing page will handle calling the backend to track the click
    console.log('Redirecting /r/' + code + ' to /listen/' + code);
    navigate(`/listen/${code}`, { replace: true });
  }, [code, navigate]);

  return (
    <div className="loading">
      Redirecting...
    </div>
  );
};

export default ReferralRedirect;
