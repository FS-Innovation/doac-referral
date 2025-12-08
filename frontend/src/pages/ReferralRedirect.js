import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

const ReferralRedirect = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // NEW FLOW: Just navigate to the landing page
    // The landing page will handle calling the backend to track the click
    // Pass along the episode ID if present in URL query param
    const episodeId = searchParams.get('e');
    const targetUrl = episodeId
      ? `/listen/${code}?e=${episodeId}`
      : `/listen/${code}`;

    console.log('Redirecting /r/' + code + ' to ' + targetUrl);
    navigate(targetUrl, { replace: true });
  }, [code, navigate, searchParams]);

  return (
    <div className="loading">
      Redirecting...
    </div>
  );
};

export default ReferralRedirect;
