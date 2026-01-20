import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, episodesAPI, prizeAPI, profileAPI } from '../services/api';
import SplitFlapCounter from '../components/SplitFlapCounter';
import CopyLinkBar from '../components/CopyLinkBar';
import PrizeRail from '../components/PrizeRail';
import {
  buildReferralUrl,
  getYouTubeThumbnail,
  formatRelativeTime,
  truncateText,
  consumeReferralSourceEpisode
} from '../utils/episode';
import {
  trackReferralLinkCopied,
  trackPrizeViewed,
  trackPrizeRedeemStarted,
  trackPrizeRedeemed,
  trackPrizeRedeemFailed,
  trackProfileSkipped,
  trackEmailVerificationResent,
  trackEpisodeViewed,
  trackEpisodeAutoSet,
  trackEpisodeSelectionChanged,
  identifyUser,
} from '../services/analytics';

const Dashboard = () => {
  const { user, emailVerified, resendVerificationEmail, updateUserPoints, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  // Selected episode YouTube video ID from backend (null = "LATEST" mode)
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [backendLoaded, setBackendLoaded] = useState(false);

  // Episode selector state
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [thumbnailHovered, setThumbnailHovered] = useState(false);

  // Prize tiers state
  const [prizeTiers, setPrizeTiers] = useState([]);
  const [prizesLoading, setPrizesLoading] = useState(true);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [claimingTier, setClaimingTier] = useState(null);
  const [claimSuccess, setClaimSuccess] = useState(null);
  const [selectedPrize, setSelectedPrize] = useState(null);
  const [confirmRedeemPrize, setConfirmRedeemPrize] = useState(null); // Prize pending confirmation
  const [userPoints, setUserPoints] = useState(user?.points || 0);

  // Email verification state
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationBannerDismissed, setVerificationBannerDismissed] = useState(false);

  // Profile completion banner state
  const [showProfileBanner, setShowProfileBanner] = useState(false);
  const [profileBannerDismissing, setProfileBannerDismissing] = useState(false);
  const navigate = useNavigate();

  // 3D Tilt effect state for confirmation card
  const [cardTilt, setCardTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [glowOffset, setGlowOffset] = useState({ x: 0, y: 0 });
  const [glowIntensity, setGlowIntensity] = useState(0); // 0-1 based on tilt amount

  // Handle resend verification email
  const handleResendVerification = async () => {
    if (resendingVerification) return;

    setResendingVerification(true);
    setVerificationMessage('');

    try {
      await resendVerificationEmail();
      trackEmailVerificationResent(user?.email);
      setVerificationMessage('Verification email sent! Check your inbox.');
    } catch (error) {
      if (error.response?.status === 429) {
        const waitTime = error.response?.data?.retryAfter || 60;
        setVerificationMessage(`Please wait ${waitTime} seconds before requesting again.`);
      } else {
        setVerificationMessage(error.response?.data?.error || 'Failed to send email. Please try again.');
      }
    } finally {
      setResendingVerification(false);
    }
  };

  // Identify user for analytics on mount (builds user profile in RudderStack)
  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id, {
        // Core identity
        email: user.email,
        name: user.name,
        first_name: user.firstName || user.name,
        // Engagement metrics
        points: user.points,
        email_verified: emailVerified,
        // Referral performance (when stats load)
        referral_code: stats?.referralCode,
        total_referrals: stats?.totalReferrals || 0,
        successful_referrals: stats?.successfulReferrals || 0,
        // Lifecycle
        created_at: user.createdAt,
      });
    }
  }, [user?.id, user?.email, user?.name, user?.firstName, user?.points, user?.createdAt, emailVerified, stats?.referralCode, stats?.totalReferrals, stats?.successfulReferrals]);

  // Check profile completion status on mount
  useEffect(() => {
    const checkProfileStatus = async () => {
      try {
        const response = await profileAPI.getCompletionStatus();
        const { profileCompleted, profileSkipped } = response.data;
        // Show banner if profile not completed and not skipped
        if (!profileCompleted && !profileSkipped) {
          setShowProfileBanner(true);
        }
      } catch (error) {
        // Silent fail - don't block dashboard for profile check
        console.error('Failed to check profile status:', error);
      }
    };
    checkProfileStatus();
  }, []);

  // Handle profile banner dismiss (skip profile completion)
  const handleDismissProfileBanner = async () => {
    setProfileBannerDismissing(true);
    try {
      await profileAPI.skipProfile();
      trackProfileSkipped();
      setShowProfileBanner(false);
    } catch (error) {
      console.error('Failed to dismiss profile banner:', error);
    } finally {
      setProfileBannerDismissing(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadStats();
    loadEpisodes(); // Load episodes on mount to show current episode title
    loadPrizeTiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live update polling - check for point changes every 30 seconds
  // This triggers the split-flap animation when someone uses the referral code
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const updatedUser = await refreshUser();
        if (updatedUser && updatedUser.points !== user?.points) {
          // Points changed! The split-flap counter will animate automatically
          console.log('Points updated:', user?.points, '->', updatedUser.points);
          // Also refresh prize tiers to update unlock status
          loadPrizeTiers();
        }
      } catch (error) {
        // Silent fail - don't spam console with polling errors
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.points]);

  const loadPrizeTiers = async () => {
    setPrizesLoading(true);
    try {
      const response = await prizeAPI.getTiers();
      setPrizeTiers(response.data.tiers || []);
      setEligibleCount(response.data.eligibleCount || 0);
    } catch (error) {
      console.error('Failed to load prize tiers:', error);
    } finally {
      setPrizesLoading(false);
    }
  };

  // Actually redeem the prize after confirmation
  const handleConfirmRedeem = async () => {
    if (!confirmRedeemPrize || claimingTier) return;

    const tier = confirmRedeemPrize;
    setClaimingTier(tier.id);
    setConfirmRedeemPrize(null);
    trackPrizeRedeemStarted(tier.id, tier.name);

    try {
      const response = await prizeAPI.claim(tier.id);
      setClaimSuccess(response.data);
      setSelectedPrize({ ...tier, claimedCode: response.data.prize.code });
      trackPrizeRedeemed(tier.id, tier.name, tier.prize_type);

      // Update points in auth context immediately (triggers split-flap animation)
      if (response.data.newPointsBalance !== undefined) {
        setUserPoints(response.data.newPointsBalance);
        updateUserPoints(response.data.newPointsBalance);
      }

      // Refresh prize tiers to update status
      await loadPrizeTiers();
    } catch (error) {
      console.error('Failed to redeem prize:', error);
      trackPrizeRedeemFailed(tier.id, tier.name, error.response?.data?.error || 'Unknown error');
      alert(error.response?.data?.error || 'Failed to redeem prize');
    } finally {
      setClaimingTier(null);
    }
  };

  // Cancel redemption
  const handleCancelRedeem = () => {
    setConfirmRedeemPrize(null);
    // Reset tilt when modal closes
    setCardTilt({ rotateX: 0, rotateY: 0 });
    setGlowOffset({ x: 0, y: 0 });
    setGlowIntensity(0);
  };

  // Throttle ref for mouse handler - limits updates to ~30fps for performance
  const lastMouseUpdate = useRef(0);
  const rafId = useRef(null);

  // 3D Tilt effect handler for confirmation card - tracks mouse anywhere on screen
  // Creates "Pulp Fiction briefcase" effect where glow intensifies as card tilts
  // Throttled to 30fps for smooth performance on lower-end devices
  const handleModalMouseMove = useCallback((e) => {
    const now = Date.now();

    // Throttle to ~30fps (33ms intervals) - halves CPU usage with minimal visual difference
    if (now - lastMouseUpdate.current < 33) return;
    lastMouseUpdate.current = now;

    // Cancel any pending animation frame
    if (rafId.current) cancelAnimationFrame(rafId.current);

    // Use requestAnimationFrame to sync with browser paint cycle
    rafId.current = requestAnimationFrame(() => {
      // Calculate mouse position relative to viewport center (-1 to 1)
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Use viewport dimensions for normalization (smoother across whole screen)
      const mouseX = (e.clientX - centerX) / (window.innerWidth / 2);
      const mouseY = (e.clientY - centerY) / (window.innerHeight / 2);

      // Clamp values to prevent extreme tilts at screen edges
      const clampedX = Math.max(-1, Math.min(1, mouseX));
      const clampedY = Math.max(-1, Math.min(1, mouseY));

      // Apply tilt with max 8 degrees rotation for more dramatic effect
      const maxTilt = 8;
      const rotateY = clampedX * maxTilt;
      const rotateX = -clampedY * maxTilt; // Inverted for natural feel

      setCardTilt({ rotateX, rotateY });

      // Calculate tilt intensity (0-1) based on distance from center
      // This drives the "briefcase opening" glow effect
      const tiltMagnitude = Math.sqrt(clampedX * clampedX + clampedY * clampedY);
      const intensity = Math.min(1, tiltMagnitude * 1.2); // Slightly boost for more drama
      setGlowIntensity(intensity);

      // Glow offset: light follows the mouse/tilt direction
      // When tilting right, glow expands to the right towards the mouse
      setGlowOffset({
        x: clampedX * 30,
        y: clampedY * 30
      });
    });
  }, []);

  // Gyroscope support for mobile devices
  useEffect(() => {
    if (!confirmRedeemPrize || !isMobile) return;

    const handleOrientation = (e) => {
      if (e.gamma === null || e.beta === null) return;

      // gamma: left/right tilt (-90 to 90), beta: front/back tilt (-180 to 180)
      // Clamp and normalize to -1 to 1 range, with max 20 degree device tilt
      const maxDeviceTilt = 20;
      const normalizedX = Math.max(-1, Math.min(1, e.gamma / maxDeviceTilt));
      const normalizedY = Math.max(-1, Math.min(1, (e.beta - 45) / maxDeviceTilt)); // 45 is typical holding angle

      const maxTilt = 8;
      setCardTilt({
        rotateX: -normalizedY * maxTilt,
        rotateY: normalizedX * maxTilt
      });

      // Calculate intensity for briefcase effect
      const tiltMagnitude = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
      setGlowIntensity(Math.min(1, tiltMagnitude * 1.2));

      setGlowOffset({
        x: normalizedX * 30,
        y: normalizedY * 30
      });
    };

    // Add gyroscope listener (iOS 13+ requires permission on user gesture, but we add listener anyway)
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [confirmRedeemPrize, isMobile]);

  // Document-level mouse tracking for 3D tilt effect
  // This allows tracking even over the nav header (which has higher z-index visually)
  useEffect(() => {
    if (!confirmRedeemPrize || isMobile) return;

    // Attach to document so mouse tracking works over any element including nav header
    document.addEventListener('mousemove', handleModalMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleModalMouseMove);
    };
  }, [confirmRedeemPrize, isMobile, handleModalMouseMove]);

  // Watch for ?e= param in URL and update episode immediately
  useEffect(() => {
    const urlEpisodeId = searchParams.get('e');
    if (urlEpisodeId && episodes.length > 0) {
      const urlEpisode = episodes.find(ep => ep.youtube_video_id === urlEpisodeId);
      if (urlEpisode) {
        // Only update if different from current selection
        if (urlEpisode.youtube_video_id !== selectedVideoId) {
          setSelectedVideoId(urlEpisode.youtube_video_id);
          // Track the auto-set from URL parameter
          trackEpisodeAutoSet(urlEpisode.youtube_video_id, urlEpisode.title, 'url_param');
          // Save to backend with source context
          userAPI.updateSelectedEpisode(urlEpisode.youtube_video_id, 'url_param')
            .then(() => console.log(`✅ Episode set from URL param: ${urlEpisode.youtube_video_id}`))
            .catch(err => console.error('Failed to save episode preference:', err));
        }
        // Clear the ?e= param from URL so it doesn't keep overwriting manual selections
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('e');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, episodes, selectedVideoId, setSearchParams]);

  const loadStats = async () => {
    try {
      const response = await userAPI.getReferralStats();
      setStats(response.data);
      // Load user's stored episode preference from backend
      if (response.data.selectedEpisodeId !== undefined) {
        setSelectedVideoId(response.data.selectedEpisodeId);
        setBackendLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get the selected episode object - if selectedVideoId is null, use latest (first in list)
  const latestEpisode = episodes[0] || null;
  const selectedEpisode = selectedVideoId
    ? episodes.find(ep => ep.youtube_video_id === selectedVideoId) || latestEpisode
    : latestEpisode;

  // Check if in "LATEST" mode (no specific episode selected)
  const isLatestMode = selectedVideoId === null;

  // Build referral URL with YouTube video ID (e.g., ?e=4QLWlcneJig)
  // For LATEST mode, don't include episode param so they always get the newest
  const referralUrlWithEpisode = stats?.referralCode
    ? buildReferralUrl(stats.referralCode, isLatestMode ? null : selectedEpisode?.youtube_video_id)
    : stats?.referralUrl;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralUrlWithEpisode);
    setCopied(true);
    trackReferralLinkCopied(stats?.referralCode, selectedVideoId);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadEpisodes = async () => {
    if (episodes.length > 0) return; // Already loaded
    setEpisodesLoading(true);
    try {
      const response = await episodesAPI.getAll();
      const episodeList = response.data.episodes || [];
      setEpisodes(episodeList);

      // URL ?e= param is handled by the useEffect watching searchParams
      // This ensures it triggers properly after episodes are loaded

      // Check for referral source episode (from sessionStorage - new users)
      // This is consumed (read and cleared) so it only applies once
      if (episodeList.length > 0 && !backendLoaded) {
        const referralSourceVideoId = consumeReferralSourceEpisode();
        const referralSourceEpisode = referralSourceVideoId
          ? episodeList.find(ep => ep.youtube_video_id === referralSourceVideoId)
          : null;

        if (referralSourceEpisode) {
          setSelectedVideoId(referralSourceEpisode.youtube_video_id);
          try {
            await userAPI.updateSelectedEpisode(referralSourceEpisode.youtube_video_id);
          } catch (err) {
            console.error('Failed to save episode preference:', err);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load episodes:', error);
    } finally {
      setEpisodesLoading(false);
    }
  };

  const handleChangeEpisodeClick = () => {
    if (showEpisodeSelector) {
      setShowEpisodeSelector(false);
      setSearchQuery('');
    } else {
      setShowEpisodeSelector(true);
      loadEpisodes();
    }
  };

  // Handle selecting "LATEST" option
  const handleLatestSelect = async () => {
    setSelectedVideoId(null);
    setShowEpisodeSelector(false);
    setSearchQuery('');
    try {
      await userAPI.updateSelectedEpisode(null);
    } catch (err) {
      console.error('Failed to save episode preference:', err);
    }
  };

  // Handle selecting a specific episode
  const handleEpisodeSelect = async (episode) => {
    setSelectedVideoId(episode.youtube_video_id);
    setShowEpisodeSelector(false);
    setSearchQuery('');
    trackEpisodeViewed(episode.youtube_video_id, episode.title);
    try {
      await userAPI.updateSelectedEpisode(episode.youtube_video_id);
    } catch (err) {
      console.error('Failed to save episode preference:', err);
    }
  };

  // Filter episodes based on search query
  const filteredEpisodes = episodes.filter(episode =>
    episode.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    episode.episode_number.toString().includes(searchQuery)
  );

  // Prize tier colors and styling
  const tierStyles = {
    1: { gradient: 'linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 100%)', border: 'rgba(255, 255, 255, 0.1)' },
    2: { gradient: 'linear-gradient(135deg, #3D3D3D 0%, #252525 100%)', border: 'rgba(255, 255, 255, 0.15)' },
    3: { gradient: 'linear-gradient(135deg, #4D4D4D 0%, #353535 100%)', border: 'rgba(255, 255, 255, 0.2)' },
    4: { gradient: 'linear-gradient(135deg, #1a2a1a 0%, #2d3d2d 100%)', border: 'rgba(34, 197, 94, 0.2)' }, // Green for physical
    5: { gradient: 'linear-gradient(135deg, #1a2a1a 0%, #2d3d2d 100%)', border: 'rgba(34, 197, 94, 0.2)' },
    6: { gradient: 'linear-gradient(135deg, #1a2a1a 0%, #2d3d2d 100%)', border: 'rgba(34, 197, 94, 0.2)' },
    7: { gradient: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', border: 'rgba(255, 255, 255, 0.2)' }, // 1% Diary
    8: { gradient: 'linear-gradient(135deg, #1a0a1a 0%, #2d0a2d 50%, #0a1a2d 100%)', border: 'rgba(147, 51, 234, 0.4)' }  // Mystery purple
  };

  // Helper to calculate status based on points
  const getStatus = (pointsRequired) => {
    if (user.points >= pointsRequired) return 'unlocked';
    return 'locked';
  };

  // Default prize tiers (shown while loading or if API fails)
  const defaultPrizeTiers = [
    // TIER 1: Discount Codes
    {
      id: 1, tier_number: 1, name: '10% Off', description: 'Get 10% off your next purchase',
      points_required: 1000, prize_type: 'discount_code', is_mystery: false,
      status: getStatus(1000), progress: Math.min(100, Math.round((user.points / 1000) * 100))
    },
    {
      id: 2, tier_number: 2, name: '25% Off', description: 'Get 25% off your next purchase',
      points_required: 2000, prize_type: 'discount_code', is_mystery: false,
      status: getStatus(2000), progress: Math.min(100, Math.round((user.points / 2000) * 100))
    },
    {
      id: 3, tier_number: 3, name: '50% Off', description: 'Get 50% off your next purchase',
      points_required: 3000, prize_type: 'discount_code', is_mystery: false,
      status: getStatus(3000), progress: Math.min(100, Math.round((user.points / 3000) * 100))
    },
    // TIER 2: Physical Products
    {
      id: 4, tier_number: 4, name: 'Conversation Cards Vol. 1', description: 'The original DOAC Conversation Cards deck',
      points_required: 4000, prize_type: 'physical_product', is_mystery: false,
      status: getStatus(4000), progress: Math.min(100, Math.round((user.points / 4000) * 100))
    },
    {
      id: 5, tier_number: 5, name: 'Conversation Cards Vol. 2', description: 'Deeper conversations, stronger connections',
      points_required: 4000, prize_type: 'physical_product', is_mystery: false,
      status: getStatus(4000), progress: Math.min(100, Math.round((user.points / 4000) * 100))
    },
    {
      id: 6, tier_number: 6, name: 'Conversation Cards Vol. 3', description: 'The latest edition of our bestselling cards',
      points_required: 4000, prize_type: 'physical_product', is_mystery: false,
      status: getStatus(4000), progress: Math.min(100, Math.round((user.points / 4000) * 100))
    },
    {
      id: 7, tier_number: 7, name: '1% Diary', description: 'The iconic DOAC diary',
      points_required: 5000, prize_type: 'physical_product', is_mystery: false,
      status: getStatus(5000), progress: Math.min(100, Math.round((user.points / 5000) * 100))
    },
    // TIER 3: Mystery Prize (completely hidden - points TBD)
    {
      id: 8, tier_number: 8, name: '???', description: '???',
      points_required: 999999, prize_type: 'mystery', is_mystery: true,
      status: 'locked', progress: 0
    }
  ];

  // Use API data if available, otherwise show defaults
  const displayPrizeTiers = prizeTiers.length > 0 ? prizeTiers : defaultPrizeTiers;

  // Map prize tiers to display cards
  const prizes = displayPrizeTiers.map(tier => ({
    ...tier,
    color: tierStyles[tier.tier_number]?.gradient || tierStyles[1].gradient,
    borderColor: tierStyles[tier.tier_number]?.border || tierStyles[1].border
  }));

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
    {/* Email Verification Notice - Small non-intrusive popup */}
    {!emailVerified && !verificationBannerDismissed && (
      <div style={{
        position: 'fixed',
        bottom: isMobile ? '16px' : '24px',
        right: isMobile ? '16px' : '24px',
        background: '#0D0D0D',
        border: '1px solid transparent',
        backgroundImage: 'linear-gradient(#0D0D0D, #0D0D0D), linear-gradient(135deg, #919191 0%, #5A2F30 100%)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        borderRadius: '12px',
        padding: '16px',
        maxWidth: isMobile ? 'calc(100% - 32px)' : '320px',
        zIndex: 1000,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Close button */}
        <button
          onClick={() => setVerificationBannerDismissed(true)}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Icon and message */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#919191" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <div>
            <p style={{
              color: '#FFF',
              fontSize: '13px',
              fontWeight: '500',
              margin: '0 0 4px 0',
              lineHeight: '1.4',
              paddingRight: '16px'
            }}>
              Verify your email
            </p>
            <p style={{
              color: '#999',
              fontSize: '12px',
              margin: 0,
              lineHeight: '1.4'
            }}>
              Check your inbox to complete verification
            </p>
          </div>
        </div>

        {/* Feedback message */}
        {verificationMessage && (
          <p style={{
            color: verificationMessage.includes('sent') ? '#4ade80' : '#999',
            fontSize: '12px',
            margin: '0 0 10px 0'
          }}>
            {verificationMessage}
          </p>
        )}

        {/* Resend button */}
        <button
          onClick={handleResendVerification}
          disabled={resendingVerification}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: '#0D0D0D',
            border: '1px solid rgba(145, 145, 145, 0.3)',
            borderRadius: '8px',
            color: '#FFF',
            fontSize: '13px',
            fontWeight: '500',
            cursor: resendingVerification ? 'not-allowed' : 'pointer',
            opacity: resendingVerification ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
        >
          {resendingVerification ? 'Sending...' : 'Resend verification email'}
        </button>
      </div>
    )}

    {/* Profile Completion Banner - CRT/Glitch Style */}
    {emailVerified && showProfileBanner && (
      <div style={{
        position: 'fixed',
        bottom: isMobile ? '16px' : '24px',
        right: isMobile ? '16px' : '24px',
        background: 'rgba(8, 8, 12, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '20px',
        maxWidth: isMobile ? 'calc(100% - 32px)' : '340px',
        zIndex: 1000,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 60px rgba(255, 200, 150, 0.05)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
      }}>
        {/* CRT scan lines overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '16px',
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 2px,
            rgba(255, 255, 255, 0.015) 2px,
            rgba(255, 255, 255, 0.015) 3px
          )`,
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Subtle vignette */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '16px',
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.3) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Warm glow accent */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-20%',
          width: '140%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, rgba(255, 200, 150, 0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Close button */}
        <button
          onClick={handleDismissProfileBanner}
          disabled={profileBannerDismissing}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: profileBannerDismissing ? 'wait' : 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: profileBannerDismissing ? 0.5 : 1,
            transition: 'all 0.2s ease',
            zIndex: 2,
          }}
          title="Dismiss"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Title */}
          <h3 style={{
            color: '#FFF',
            fontSize: '15px',
            fontWeight: '500',
            margin: '0 0 6px 0',
            lineHeight: '1.3',
            fontFamily: 'Inter, -apple-system, sans-serif',
            letterSpacing: '-0.01em',
          }}>
            Complete your profile
          </h3>

          {/* Description */}
          <p style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '13px',
            margin: '0 0 20px 0',
            lineHeight: '1.5',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}>
            Tell us more about yourself to personalize your experience
          </p>

          {/* Complete profile button */}
          <button
            onClick={() => navigate('/profile/complete')}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'rgba(255, 255, 255, 0.95)',
              border: 'none',
              borderRadius: '10px',
              color: '#0a0a0a',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              fontFamily: 'Inter, -apple-system, sans-serif',
              boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 255, 255, 0.1)';
            }}
          >
            Complete Profile
          </button>
        </div>
      </div>
    )}

    <div className="container" style={{ padding: isMobile ? '10px' : '20px', paddingTop: isMobile ? '80px' : '100px' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: isMobile ? '2rem' : '3rem'
      }}>
        <h1 style={{
          margin: 0,
          marginBottom: isMobile ? '1rem' : '0',
          padding: isMobile ? '0 20px' : '0',
          textAlign: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: isMobile ? '2rem' : '3.5rem',
          fontWeight: '400',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          color: '#FFFFFF',
        }}>
          Use your referral link
          <br />
          to earn points
        </h1>
        </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: isMobile ? '4rem' : '6rem'
      }}>
        <SplitFlapCounter
          value={user.points}
          fontSize={isMobile ? '3rem' : '5rem'}
          isMobile={isMobile}
        />
      </div>

      <div style={{
        position: 'relative',
        background: 'radial-gradient(ellipse 120% 100% at 50% 50%, rgba(10, 10, 15, 0.98) 0%, rgba(5, 5, 10, 1) 100%)',
        borderRadius: isMobile ? '16px' : '20px',
        padding: isMobile ? '24px 20px' : '0',
        marginBottom: isMobile ? '16px' : '24px',
        margin: isMobile ? '0 16px 16px 16px' : '0 0 24px 0',
        display: isMobile ? 'block' : 'flex',
        flexWrap: 'wrap',
        overflow: showEpisodeSelector ? 'visible' : 'hidden',
        height: (isMobile || showEpisodeSelector) ? 'auto' : '200px',
        boxShadow: `
          inset 0 1px 0 rgba(255, 255, 255, 0.03),
          inset 0 0 80px rgba(0, 0, 0, 0.6),
          0 0 60px rgba(255, 255, 255, 0.02)
        `,
      }}>
        {/* Scan lines overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: isMobile ? '16px' : '20px',
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 3px,
            rgba(0, 0, 0, 0.04) 3px,
            rgba(0, 0, 0, 0.04) 4px
          )`,
          pointerEvents: 'none',
          zIndex: 10,
        }} />
        {/* Ambient glow */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '150%',
          height: '200%',
          background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        {/* Desktop: Thumbnail on Left - Clickable */}
        {!isMobile && selectedEpisode && (
          <div
            onClick={handleChangeEpisodeClick}
            onMouseEnter={() => setThumbnailHovered(true)}
            onMouseLeave={() => setThumbnailHovered(false)}
            style={{
              flexShrink: 0,
              width: '320px',
              height: '180px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
              position: 'relative',
              cursor: 'pointer',
              borderRadius: '10px 0 0 10px',
              overflow: 'hidden'
            }}
          >
            <img
              src={getYouTubeThumbnail(selectedEpisode.youtube_video_id, 'maxresdefault')}
              alt={`Video Thumbnail: ${selectedEpisode.title}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            {/* Hover Overlay */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: thumbnailHovered ? 1 : 0,
              transition: 'opacity 0.2s ease'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span style={{
                color: '#FFF',
                fontSize: '14px',
                fontWeight: '500',
                marginTop: '8px'
              }}>Change Episode</span>
            </div>
          </div>
        )}

        {/* Content Section */}
        <div style={{
          flex: 1,
          padding: isMobile ? '0' : '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: isMobile ? 'auto' : '200px',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 5,
        }}>
          {/* Header Row - Title + Change Episode Button */}
          {!isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <div style={{
                  fontSize: '0.65rem',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.4)',
                  marginBottom: '6px',
                }}>Share & Earn</div>
                <h2 style={{
                  color: '#FFF',
                  fontSize: '1.25rem',
                  margin: 0,
                  fontWeight: '600',
                  textShadow: '0 0 20px rgba(255, 255, 255, 0.15)',
                }}>Your Referral Link</h2>
              </div>
              <button
                onClick={handleChangeEpisodeClick}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.5)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Change Episode
              </button>
            </div>
          )}

          {/* Mobile Title */}
          {isMobile && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '0.625rem',
                fontWeight: '500',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.4)',
                marginBottom: '6px',
              }}>Share & Earn</div>
              <h2 style={{
                color: '#FFF',
                fontSize: '1.25rem',
                margin: 0,
                fontWeight: '600',
                textShadow: '0 0 20px rgba(255, 255, 255, 0.15)',
              }}>Your Referral Link</h2>
            </div>
          )}

          <p style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: isMobile ? '0.875rem' : '0.9375rem',
            lineHeight: '1.6',
            margin: 0,
            marginTop: isMobile ? '0' : '8px',
            marginBottom: isMobile ? '20px' : '0',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          }}>
            {isMobile ? (
              <>Share this link to earn points!<br />Each unique click gives you 1 point.</>
            ) : (
              'Share this link to earn points! Each unique click gives you 1 point.'
            )}
          </p>

          {/* Mobile: Thumbnail - Clickable */}
          {isMobile && selectedEpisode && (
            <div
              onClick={handleChangeEpisodeClick}
              style={{
                width: '100%',
                aspectRatio: '16/9',
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '12px',
                position: 'relative',
                cursor: 'pointer'
              }}
            >
              <img
                src={getYouTubeThumbnail(selectedEpisode.youtube_video_id)}
                alt={`Video Thumbnail: ${selectedEpisode.title}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              {/* Tap hint overlay - always slightly visible on mobile */}
              <div style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '4px',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span style={{ color: '#FFF', fontSize: '12px', fontWeight: '500' }}>Change</span>
              </div>
            </div>
          )}

        <CopyLinkBar
          url={referralUrlWithEpisode}
          onCopy={copyToClipboard}
          copied={copied}
          isMobile={isMobile}
        />
        </div>

        {/* Episode Selector - Expanded (Full Width) */}
        <div style={{
          width: '100%',
          padding: isMobile ? '0 16px 16px 16px' : '20px 24px',
          maxHeight: showEpisodeSelector ? '800px' : '0',
          opacity: showEpisodeSelector ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out, transform 0.3s ease-out',
          transform: showEpisodeSelector ? 'translateY(0)' : 'translateY(-20px)',
          visibility: showEpisodeSelector ? 'visible' : 'hidden',
          boxSizing: 'border-box'
        }}>
          {/* Mobile: Cleaner stacked layout with more spacing */}
          {isMobile ? (
            <>
              {/* Header with title and cancel */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: '1px solid #333'
              }}>
                <h3 style={{
                  color: '#FFF',
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: '600'
                }}>
                  Select Episode
                </h3>
                <button
                  onClick={() => {
                    setShowEpisodeSelector(false);
                    setSearchQuery('');
                  }}
                  style={{
                    background: '#333',
                    color: '#FFF',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    touchAction: 'manipulation'
                  }}
                >
                  Cancel
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Search episodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: '#1B1B1B',
                    border: '1px solid #333',
                    borderRadius: '12px',
                    color: '#FFF',
                    fontSize: '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#666'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#333'; }}
                />
              </div>
            </>
          ) : (
            <>
              {/* Desktop layout */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                gap: '12px'
              }}>
                <h3 style={{
                  color: '#FFF',
                  margin: 0,
                  fontSize: '1.125rem'
                }}>
                  Select Episode to Share
                </h3>
                <button
                  onClick={() => {
                    setShowEpisodeSelector(false);
                    setSearchQuery('');
                  }}
                  style={{
                    background: 'transparent',
                    color: '#B5B5B5',
                    border: '1px solid #444',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Cancel
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Search episodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#1B1B1B',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#666'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#333'; }}
                />
              </div>
            </>
          )}

            {/* Episode Grid */}
            {episodesLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                Loading episodes...
              </div>
            ) : (
              <div style={{
                maxHeight: isMobile ? '400px' : '500px',
                overflowY: 'auto',
                overflowX: 'hidden',
                margin: isMobile ? '-12px' : '-8px',
                padding: isMobile ? '12px' : '8px'
              }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: isMobile ? '16px' : '20px'
              }}>
                {/* LATEST Option - White box with "LATEST" text */}
                <div
                  onClick={handleLatestSelect}
                  style={{
                    background: isLatestMode ? '#1a1a1a' : '#141414',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: isLatestMode ? '2px solid #FFF' : '2px solid transparent',
                    transform: isLatestMode && !isMobile ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isLatestMode ? '0 8px 24px rgba(255, 255, 255, 0.1)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLatestMode && !isMobile) {
                      e.currentTarget.style.background = '#1a1a1a';
                      e.currentTarget.style.transform = 'scale(1.01)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLatestMode && !isMobile) {
                      e.currentTarget.style.background = '#141414';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  {/* Black Box Thumbnail with LATEST text */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16/9',
                    overflow: 'hidden',
                    background: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{
                      color: '#FFFFFF',
                      fontSize: isMobile ? '1.5rem' : '2rem',
                      fontWeight: '700',
                      letterSpacing: '0.1em'
                    }}>LATEST</span>
                    {isLatestMode && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: '#FFF',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* LATEST Info */}
                  <div style={{ padding: '12px' }}>
                    <h4 style={{
                      color: '#FFF',
                      fontSize: '0.9375rem',
                      fontWeight: '600',
                      lineHeight: '1.4',
                      marginBottom: '8px',
                      margin: 0
                    }}>
                      Always Share Latest Episode
                    </h4>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#888',
                      fontSize: '0.8125rem',
                      marginTop: '8px'
                    }}>
                      <span>Auto-updates to newest</span>
                    </div>
                  </div>
                </div>

                {filteredEpisodes.length === 0 && searchQuery ? (
                  <div style={{
                    gridColumn: '1 / -1',
                    padding: '40px',
                    textAlign: 'center',
                    color: '#888'
                  }}>
                    No episodes found matching "{searchQuery}"
                  </div>
                ) : (
                  filteredEpisodes.map((episode) => {
                    const isSelected = !isLatestMode && episode.youtube_video_id === selectedVideoId;

                    return (
                      <div
                        key={episode.id}
                        onClick={() => handleEpisodeSelect(episode)}
                        style={{
                          background: isSelected ? '#1a1a1a' : '#141414',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: isSelected ? '2px solid #FFF' : '2px solid transparent',
                          transform: isSelected && !isMobile ? 'scale(1.02)' : 'scale(1)',
                          boxShadow: isSelected ? '0 8px 24px rgba(255, 255, 255, 0.1)' : 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected && !isMobile) {
                            e.currentTarget.style.background = '#1a1a1a';
                            e.currentTarget.style.transform = 'scale(1.01)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected && !isMobile) {
                            e.currentTarget.style.background = '#141414';
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                      >
                        {/* Thumbnail */}
                        <div style={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '16/9',
                          overflow: 'hidden'
                        }}>
                          <img
                            src={getYouTubeThumbnail(episode.youtube_video_id)}
                            alt={episode.title}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              background: '#FFF',
                              borderRadius: '50%',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                            }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Episode Info */}
                        <div style={{ padding: '12px' }}>
                          <h4 style={{
                            color: '#FFF',
                            fontSize: '0.9375rem',
                            fontWeight: '600',
                            lineHeight: '1.4',
                            marginBottom: '8px',
                            margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {truncateText(episode.title, 80)}
                          </h4>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#888',
                            fontSize: '0.8125rem',
                            marginTop: '8px'
                          }}>
                            <span>{formatRelativeTime(episode.published_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              </div>
            )}
        </div>
      </div>
    </div>

    {/* Prize Section - Full width, outside container */}
    <div style={{
      width: '100%',
      marginTop: isMobile ? '2.5rem' : '4rem',
      marginBottom: isMobile ? '1.5rem' : '2rem'
    }}>
        <PrizeRail
          prizes={prizes}
          userPoints={userPoints}
          onRedeem={(prize) => setConfirmRedeemPrize(prize)}
          isMobile={isMobile}
          claimingId={claimingTier}
        />

        {/* Confirmation Modal - Before Redeeming */}
        {confirmRedeemPrize && (() => {
          // Get the prize image for the modal
          const getPrizeImage = () => {
            if (confirmRedeemPrize.prize_type === 'discount_code') {
              return 'https://thediary.com/cdn/shop/files/1_DIARY_PopUpCardsWhite.png?v=1764327518&width=800';
            }
            if (confirmRedeemPrize.name.includes('Vol. 1') || confirmRedeemPrize.name.includes('Vol 1')) {
              return 'https://thediary.com/cdn/shop/files/1_e87b669d-04ab-4f85-81c8-df353bbb2188.png?v=1749210128&width=700';
            }
            if (confirmRedeemPrize.name.includes('Vol. 2') || confirmRedeemPrize.name.includes('Vol 2')) {
              return 'https://thediary.com/cdn/shop/files/1_b75fbc90-9bfe-49f2-baf5-3767c7992627.png?v=1762444332&width=700';
            }
            if (confirmRedeemPrize.name.includes('Game Edition') || confirmRedeemPrize.name.includes('Vol. 3')) {
              return 'https://thediary.com/cdn/shop/files/CC3_Web_Image_3.jpg?v=1762859458&width=1000';
            }
            if (confirmRedeemPrize.name.includes('1% Diary') || confirmRedeemPrize.name.includes('Diary')) {
              return 'https://thediary.com/cdn/shop/files/No_matter_your_goal_1_d1605690-ab79-45f3-a83d-f9d21e8223bc.png?v=1763725505&width=1000';
            }
            if (confirmRedeemPrize.prize_type === 'mystery') {
              return 'https://storage.googleapis.com/doac-perks/edited-photo.webp';
            }
            return 'https://thediary.com/cdn/shop/files/1_DIARY_PopUpCardsWhite.png?v=1764327518&width=800';
          };

          return (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              perspective: '1000px'
            }} onClick={handleCancelRedeem}>

              {/* ===== DRAMATIC BLOOM - GPU OPTIMIZED ===== */}
              {/* Trick: Pre-baked blur at different sizes, animate with transform/opacity only */}
              {/* Each layer has STATIC blur, we scale them up to simulate "bloom expanding" */}

              {/* Layer 1: Outer atmospheric wash - massive scale range */}
              <div
                className="glow-layer-1"
                style={{
                  position: 'absolute',
                  width: isMobile ? '200px' : '250px',
                  height: isMobile ? '250px' : '300px',
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 180, 80, 0.5) 0%, rgba(255, 150, 40, 0.2) 50%, transparent 70%)',
                  filter: 'blur(60px)',
                  pointerEvents: 'none',
                  transform: `translate3d(${glowOffset.x * 2.5}px, ${glowOffset.y * 2.5}px, 0) scale3d(${1.5 + glowIntensity * 2.5}, ${1.5 + glowIntensity * 3}, 1)`,
                  opacity: 0.4 + glowIntensity * 0.5,
                  transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
                  willChange: 'transform, opacity'
                }}
              />

              {/* Layer 2: Mid bloom - follows mouse more closely */}
              <div
                className="glow-layer-2"
                style={{
                  position: 'absolute',
                  width: isMobile ? '220px' : '280px',
                  height: isMobile ? '280px' : '350px',
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 200, 100, 0.7) 0%, rgba(255, 170, 60, 0.4) 40%, transparent 70%)',
                  filter: 'blur(45px)',
                  pointerEvents: 'none',
                  transform: `translate3d(${glowOffset.x * 1.8}px, ${glowOffset.y * 1.8}px, 0) scale3d(${1.2 + glowIntensity * 1.5}, ${1.2 + glowIntensity * 1.8}, 1)`,
                  opacity: 0.5 + glowIntensity * 0.4,
                  transition: 'transform 0.15s ease-out, opacity 0.15s ease-out',
                  willChange: 'transform, opacity'
                }}
              />

              {/* Layer 3: Inner glow - tight to card, scales less */}
              <div
                className="glow-layer-3"
                style={{
                  position: 'absolute',
                  width: isMobile ? '260px' : '320px',
                  height: isMobile ? '340px' : '420px',
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 220, 140, 0.8) 0%, rgba(255, 190, 80, 0.5) 35%, transparent 65%)',
                  filter: 'blur(30px)',
                  pointerEvents: 'none',
                  transform: `translate3d(${glowOffset.x * 1.2}px, ${glowOffset.y * 1.2}px, 0) scale3d(${1 + glowIntensity * 0.6}, ${1 + glowIntensity * 0.7}, 1)`,
                  opacity: 0.6 + glowIntensity * 0.35,
                  transition: 'transform 0.12s ease-out, opacity 0.12s ease-out',
                  willChange: 'transform, opacity'
                }}
              />

              {/* Layer 4: Hot core - divine light center */}
              <div
                style={{
                  position: 'absolute',
                  width: isMobile ? '160px' : '200px',
                  height: isMobile ? '200px' : '260px',
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 250, 230, 1) 0%, rgba(255, 230, 180, 0.8) 25%, rgba(255, 200, 120, 0.4) 50%, transparent 70%)',
                  filter: 'blur(15px)',
                  pointerEvents: 'none',
                  transform: `translate3d(${glowOffset.x * 0.8}px, ${glowOffset.y * 0.8}px, 0) scale3d(${1 + glowIntensity * 0.4}, ${1 + glowIntensity * 0.5}, 1)`,
                  opacity: 0.7 + glowIntensity * 0.3,
                  transition: 'transform 0.1s ease-out, opacity 0.1s ease-out',
                  willChange: 'transform, opacity'
                }}
              />

              {/* Layer 5: Light spill - stretches toward mouse direction without rotation */}
              <div
                style={{
                  position: 'absolute',
                  width: isMobile ? '200px' : '250px',
                  height: isMobile ? '200px' : '250px',
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 240, 200, 0.5) 0%, rgba(255, 220, 150, 0.25) 40%, transparent 65%)',
                  filter: 'blur(30px)',
                  pointerEvents: 'none',
                  /* Stretch in direction of mouse using asymmetric scale */
                  transform: `translate3d(${glowOffset.x * 2.5}px, ${glowOffset.y * 2.5}px, 0) scale3d(${1 + Math.abs(glowOffset.x / 30) * 1.5 + glowIntensity * 0.5}, ${1 + Math.abs(glowOffset.y / 30) * 1.5 + glowIntensity * 0.5}, 1)`,
                  opacity: 0.3 + glowIntensity * 0.5,
                  transition: 'transform 0.15s ease-out, opacity 0.15s ease-out',
                  willChange: 'transform, opacity'
                }}
              />

              {/* ===== THE CARD ===== */}
              <div
                style={{
                  background: '#000',
                  borderRadius: '16px',
                  width: isMobile ? '260px' : '320px',
                  overflow: 'hidden',
                  border: '2px solid rgba(255, 190, 80, 0.9)',
                  /* Box-shadows shift with glow direction */
                  boxShadow: `
                    0 0 ${15 + glowIntensity * 15}px ${3 + glowIntensity * 5}px rgba(255, 210, 120, ${0.5 + glowIntensity * 0.4}),
                    ${glowOffset.x * 0.4}px ${glowOffset.y * 0.4}px ${30 + glowIntensity * 30}px ${8 + glowIntensity * 12}px rgba(255, 180, 80, ${0.35 + glowIntensity * 0.35}),
                    ${glowOffset.x * 0.6}px ${glowOffset.y * 0.6}px ${50 + glowIntensity * 50}px ${15 + glowIntensity * 20}px rgba(255, 150, 50, ${0.2 + glowIntensity * 0.25}),
                    ${glowOffset.x * 0.8}px ${glowOffset.y * 0.8}px ${80 + glowIntensity * 70}px ${25 + glowIntensity * 30}px rgba(200, 120, 30, ${0.1 + glowIntensity * 0.15})
                  `,
                  position: 'relative',
                  zIndex: 1,
                  transform: `perspective(1000px) rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg) translateZ(0)`,
                  transition: 'transform 0.15s ease-out, box-shadow 0.12s ease-out',
                  transformStyle: 'preserve-3d',
                  willChange: 'transform'
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Subtle ambient reflection - soft since card is backlit */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: '14px',
                    pointerEvents: 'none',
                    zIndex: 10,
                    overflow: 'hidden'
                  }}
                >
                  {/* Soft elongated reflection - subtle but visible for backlit scenario */}
                  <div
                    style={{
                      position: 'absolute',
                      top: `${15 - cardTilt.rotateX * 6}%`,
                      left: `${5 - cardTilt.rotateY * 10}%`,
                      width: '200%',
                      height: '35%',
                      background: `radial-gradient(
                        ellipse 60% 30% at 50% 50%,
                        rgba(255, 255, 255, ${0.12 + glowIntensity * 0.06}) 0%,
                        rgba(255, 255, 255, ${0.04 + glowIntensity * 0.03}) 60%,
                        transparent 100%
                      )`,
                      transform: `rotate(${-30 + cardTilt.rotateY * 2}deg)`,
                      opacity: 0.55 + glowIntensity * 0.3,
                      transition: 'top 0.15s ease-out, left 0.15s ease-out, transform 0.15s ease-out, opacity 0.15s ease-out',
                      willChange: 'top, left, transform'
                    }}
                  />
                </div>

                {/* Edge definition - very subtle depth */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: '14px',
                    pointerEvents: 'none',
                    zIndex: 11,
                    boxShadow: `
                      inset ${-cardTilt.rotateY * 0.4}px ${cardTilt.rotateX * 0.4}px 20px rgba(255, 255, 255, ${0.03 + glowIntensity * 0.025}),
                      inset ${cardTilt.rotateY * 0.25}px ${-cardTilt.rotateX * 0.25}px 12px rgba(0, 0, 0, ${0.08 + glowIntensity * 0.04})
                    `,
                    transition: 'box-shadow 0.15s ease-out'
                  }}
                />

                {/* Prize Image - Square like carousel cards */}
                <div style={{
                  width: '100%',
                  aspectRatio: '1',
                  overflow: 'hidden',
                  position: 'relative',
                  background: '#000'
                }}>
                  <img
                    src={getPrizeImage()}
                    alt={confirmRedeemPrize.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '80px',
                    background: 'linear-gradient(transparent, #000)'
                  }} />
                </div>

                {/* Content */}
                <div style={{
                  padding: isMobile ? '16px 20px 24px' : '20px 24px 28px',
                  textAlign: 'center'
                }}>
                  <h3 style={{
                    color: '#FFF',
                    margin: '0 0 6px 0',
                    fontSize: isMobile ? '0.95rem' : '1.05rem',
                    fontWeight: '500',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                  }}>
                    {confirmRedeemPrize.name}
                  </h3>

                  <p style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    margin: '0 0 16px 0',
                    fontSize: isMobile ? '0.75rem' : '0.8rem',
                    lineHeight: '1.4',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                  }}>
                    Are you sure? This will use <span style={{ color: '#FFF' }}>{confirmRedeemPrize.points_required.toLocaleString()} pts</span>
                  </p>

                  {/* White Redeem Button - clean premium look */}
                  <button
                    onClick={handleConfirmRedeem}
                    disabled={claimingTier}
                    style={{
                      width: '100%',
                      background: claimingTier
                        ? '#333'
                        : 'linear-gradient(135deg, #FFFFFF 0%, #F0F0F0 50%, #FFFFFF 100%)',
                      color: claimingTier ? '#666' : '#000',
                      border: 'none',
                      padding: isMobile ? '14px' : '16px',
                      borderRadius: '10px',
                      fontSize: isMobile ? '0.9rem' : '0.95rem',
                      fontWeight: '700',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                      cursor: claimingTier ? 'wait' : 'pointer',
                      transition: 'all 0.3s ease',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '12px',
                      boxShadow: '0 4px 15px rgba(255, 255, 255, 0.2)'
                    }}
                    onMouseEnter={(e) => {
                      if (!claimingTier) {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    {claimingTier ? 'Redeeming...' : 'Yes, continue'}
                  </button>

                  {/* Cancel link */}
                  <button
                    onClick={handleCancelRedeem}
                    style={{
                      background: 'transparent',
                      color: 'rgba(255, 255, 255, 0.4)',
                      border: 'none',
                      padding: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '400',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Claim Success Modal */}
        {selectedPrize && claimSuccess && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }} onClick={() => { setSelectedPrize(null); setClaimSuccess(null); }}>
            {/* Pulsing glow */}
            <div style={{
              position: 'absolute',
              width: isMobile ? '380px' : '450px',
              height: isMobile ? '450px' : '500px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 40%, transparent 70%)',
              filter: 'blur(50px)',
              animation: 'modal-pulse 2s ease-in-out infinite',
              pointerEvents: 'none'
            }} />
            <div style={{
              background: '#000',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '340px',
              width: '100%',
              textAlign: 'center',
              border: '1px solid transparent',
              backgroundImage: 'linear-gradient(#000, #000), linear-gradient(135deg, #FFF 0%, #5A2F30 100%)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              boxShadow: '0 0 60px rgba(255, 255, 255, 0.1)',
              position: 'relative',
              zIndex: 1
            }} onClick={e => e.stopPropagation()}>
              <h2 style={{ color: '#FFF', margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: '500' }}>
                Prize Redeemed
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', margin: '0 0 20px 0', fontSize: '0.9rem' }}>
                {selectedPrize.is_mystery ? 'Mystery prize unlocked!' : selectedPrize.name}
              </p>
              {selectedPrize.claimedCode && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Your code
                  </div>
                  <code style={{
                    color: '#FFD700',
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    letterSpacing: '0.1em',
                    display: 'block',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                  }}>
                    {selectedPrize.claimedCode}
                  </code>
                </div>
              )}
              <p style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 0 20px 0', fontSize: '0.8rem' }}>
                Check your email for redemption details
              </p>
              <button
                onClick={() => { setSelectedPrize(null); setClaimSuccess(null); }}
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #FFD700 50%, #FFA500 75%, #FFD700 100%)',
                  backgroundSize: '200% 200%',
                  color: '#000',
                  border: 'none',
                  padding: '14px 32px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: '100%'
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* CSS Animations */}
        <style>{`
          @keyframes mysteryShimmer {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes mysteryText {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes shimmer {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); }
            50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.8); }
          }
          @keyframes glow-breathe {
            0%, 100% { opacity: 0.6; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.05); }
          }
          @keyframes glow-pulse {
            0%, 100% { opacity: 0.7; transform: scale(0.92); }
            50% { opacity: 1; transform: scale(1.08); }
          }
          @keyframes glow-core {
            0%, 100% { opacity: 0.8; transform: scale(0.96); }
            50% { opacity: 1; transform: scale(1.04); }
          }
          @keyframes modal-pulse {
            0%, 100% { opacity: 0.5; transform: scale(0.92); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          @keyframes sparkle {
            0%, 100% { opacity: 0; transform: scale(0); }
            50% { opacity: 1; transform: scale(1); }
          }

          /* GPU-optimized breathing - staggered timing for organic feel */
          /* Only animates opacity (composited), transform handled by JS */
          @keyframes glow-breathe-1 {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.6; }
          }
          @keyframes glow-breathe-2 {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.7; }
          }
          @keyframes glow-breathe-3 {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.8; }
          }
          .glow-layer-1 { animation: glow-breathe-1 3s ease-in-out infinite; }
          .glow-layer-2 { animation: glow-breathe-2 2.5s ease-in-out infinite 0.3s; }
          .glow-layer-3 { animation: glow-breathe-3 2s ease-in-out infinite 0.6s; }
        `}</style>
      </div>

      {/* Footer */}
      <footer style={{
        padding: isMobile ? '24px 16px 32px' : '20px 40px',
        marginTop: isMobile ? '2rem' : '3rem',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: isMobile ? 'center' : 'space-between',
        alignItems: 'center',
        gap: isMobile ? '16px' : '0'
      }}>
        {!isMobile && (
          <span style={{
            color: 'rgba(255, 255, 255, 0.55)',
            fontSize: '0.75rem',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            letterSpacing: '0.02em'
          }}>
            © 2026, The Diary.
          </span>
        )}
        <div style={{
          display: 'flex',
          gap: '20px'
        }}>
          <a
            href="https://thediary.com/policies/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'rgba(255, 255, 255, 0.55)',
              fontSize: '0.75rem',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              textDecoration: 'none',
              letterSpacing: '0.02em',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)'}
          >
            Terms
          </a>
          <a
            href="https://thediary.com/policies/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'rgba(255, 255, 255, 0.55)',
              fontSize: '0.75rem',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              textDecoration: 'none',
              letterSpacing: '0.02em',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)'}
          >
            Privacy
          </a>
        </div>
        {isMobile && (
          <span style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.6875rem',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            letterSpacing: '0.02em'
          }}>
            © 2026, The Diary.
          </span>
        )}
      </footer>
    </>
  );
};

export default Dashboard;
