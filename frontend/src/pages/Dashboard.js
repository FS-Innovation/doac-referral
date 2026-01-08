import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, episodesAPI, prizeAPI } from '../services/api';
import {
  buildReferralUrl,
  getYouTubeThumbnail,
  formatRelativeTime,
  truncateText,
  consumeReferralSourceEpisode
} from '../utils/episode';

const Dashboard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeCard, setActiveCard] = useState(0);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
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

  // Carousel drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

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

  // Drag handlers for desktop carousel
  const dragHasMoved = React.useRef(false);

  const handleDragStart = (e) => {
    setIsDragging(true);
    setDragStartX(e.clientX || e.touches?.[0]?.clientX || 0);
    setDragOffset(0);
    dragHasMoved.current = false;
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const currentX = e.clientX || e.touches?.[0]?.clientX || 0;
    const newOffset = currentX - dragStartX;
    setDragOffset(newOffset);

    // Mark as actually dragged if moved more than 10px
    if (Math.abs(newOffset) > 10) {
      dragHasMoved.current = true;
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Only change cards if actually dragged
    if (dragHasMoved.current) {
      const threshold = 80;
      if (dragOffset > threshold && activeCard > 0) {
        setActiveCard(activeCard - 1);
      } else if (dragOffset < -threshold && activeCard < prizes.length - 1) {
        setActiveCard(activeCard + 1);
      }
    }
    setDragOffset(0);
  };

  // Handle container click - calculates which card was clicked based on position
  // This bypasses z-index stacking issues so all cards are always clickable
  const handleContainerClick = (e) => {
    if (dragHasMoved.current) return; // Don't process clicks after dragging

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const clickX = e.clientX - rect.left;
    const offsetFromCenter = clickX - centerX;

    const spacing = isMobile ? 160 : 280;
    const clickedOffset = Math.round(offsetFromCenter / spacing);
    const clickedIndex = activeCard + clickedOffset;

    if (clickedIndex >= 0 && clickedIndex < prizes.length) {
      setActiveCard(clickedIndex);
    }
  };

  // Arrow navigation
  const goToPrevCard = () => {
    if (activeCard > 0) {
      setActiveCard(activeCard - 1);
    }
  };

  const goToNextCard = () => {
    if (activeCard < prizes.length - 1) {
      setActiveCard(activeCard + 1);
    }
  };

  useEffect(() => {
    loadStats();
    loadEpisodes(); // Load episodes on mount to show current episode title
    loadPrizeTiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Show confirmation modal before redeeming
  const handleRedeemClick = (tier) => {
    if (tier.status !== 'unlocked' || claimingTier) return;
    setConfirmRedeemPrize(tier);
  };

  // Actually redeem the prize after confirmation
  const handleConfirmRedeem = async () => {
    if (!confirmRedeemPrize || claimingTier) return;

    const tier = confirmRedeemPrize;
    setClaimingTier(tier.id);
    setConfirmRedeemPrize(null);

    try {
      const response = await prizeAPI.claim(tier.id);
      setClaimSuccess(response.data);
      setSelectedPrize({ ...tier, claimedCode: response.data.prize.code });

      // Update local points display immediately
      if (response.data.newPointsBalance !== undefined) {
        setUserPoints(response.data.newPointsBalance);
      }

      // Refresh prize tiers to update status
      await loadPrizeTiers();
      // Also refresh stats to update the main points display
      await loadStats();
    } catch (error) {
      console.error('Failed to redeem prize:', error);
      alert(error.response?.data?.error || 'Failed to redeem prize');
    } finally {
      setClaimingTier(null);
    }
  };

  // Cancel redemption
  const handleCancelRedeem = () => {
    setConfirmRedeemPrize(null);
  };

  // Legacy function name for compatibility
  const handleClaimPrize = handleRedeemClick;

  // Watch for ?e= param in URL and update episode immediately
  useEffect(() => {
    const urlEpisodeId = searchParams.get('e');
    if (urlEpisodeId && episodes.length > 0) {
      const urlEpisode = episodes.find(ep => ep.youtube_video_id === urlEpisodeId);
      if (urlEpisode) {
        // Only update if different from current selection
        if (urlEpisode.youtube_video_id !== selectedVideoId) {
          setSelectedVideoId(urlEpisode.youtube_video_id);
          userAPI.updateSelectedEpisode(urlEpisode.youtube_video_id)
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
        padding: isMobile ? '20px 16px' : '0',
        marginBottom: isMobile ? '16px' : '20px',
        margin: isMobile ? '0 16px 16px 16px' : '0 0 20px 0',
        display: isMobile ? 'block' : 'flex',
        flexWrap: 'wrap',
        overflow: showEpisodeSelector ? 'visible' : 'hidden',
        height: (isMobile || showEpisodeSelector) ? 'auto' : '180px'
      }}>
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
          padding: isMobile ? '0' : '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: isMobile ? 'auto' : '180px',
          overflow: 'hidden'
        }}>
          {/* Header Row - Title + Change Episode Button */}
          {!isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <h2 style={{
                color: '#FFF',
                fontSize: '1.125rem',
                margin: 0,
                fontWeight: '600'
              }}>Your Referral Link</h2>
              <button
                onClick={handleChangeEpisodeClick}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#B5B5B5',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.color = '#FFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.color = '#B5B5B5';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Change Episode
              </button>
            </div>
          )}

          {/* Mobile Title */}
          {isMobile && (
            <h2 style={{
              color: '#FFF',
              fontSize: '1.125rem',
              margin: 0,
              marginBottom: '8px'
            }}>Your Referral Link</h2>
          )}

          <p style={{
            color: '#B5B5B5',
            fontSize: isMobile ? '0.9375rem' : '1rem',
            lineHeight: '1.5',
            margin: 0,
            marginTop: isMobile ? '0' : '6px',
            marginBottom: isMobile ? '20px' : '0'
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

        {isMobile ? (
          // Mobile: Stacked layout
          <div style={{ marginBottom: showEpisodeSelector ? '24px' : '0' }}>
            <div
              onClick={copyToClipboard}
              style={{
                background: '#1B1B1B',
                border: '1px solid rgba(255, 255, 255, 0.6)',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '12px',
                wordBreak: 'break-all',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <code style={{
                color: '#B5B5B5',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '0.9375rem',
                fontWeight: '400',
                lineHeight: '1.5',
                background: 'transparent',
                display: 'block'
              }}>{referralUrlWithEpisode}</code>
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
          // Desktop: Horizontal layout - Compact
          <div
            onClick={copyToClipboard}
            style={{
              background: '#1B1B1B',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              padding: '10px 12px',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#252525';
              e.currentTarget.querySelector('code').style.color = '#FFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1B1B1B';
              e.currentTarget.querySelector('code').style.color = '#B5B5B5';
            }}
          >
            <code
              style={{
                flex: 1,
                color: '#B5B5B5',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '0.875rem',
                fontWeight: '400',
                lineHeight: '1.3',
                background: 'transparent',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'color 0.2s ease',
                padding: '4px 0'
              }}
            >{referralUrlWithEpisode}</code>
            <button onClick={(e) => { e.stopPropagation(); copyToClipboard(); }} style={{
              background: '#FFF',
              color: '#000',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
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
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginTop: isMobile ? '2.5rem' : '4rem',
      marginBottom: isMobile ? '1.5rem' : '2rem'
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
          marginBottom: isMobile ? '1rem' : '1.5rem',
          padding: isMobile ? '0 16px' : '0'
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
          marginBottom: isMobile ? '0.5rem' : '0.5rem',
          padding: isMobile ? '0 16px' : '0'
        }}>
          {prizesLoading ? 'Loading prizes...' : (
            eligibleCount > 0
              ? `You're eligible for ${eligibleCount} prize${eligibleCount > 1 ? 's' : ''}!`
              : 'Earn more points to unlock prizes'
          )}
        </p>


        {/* Prize Cards - Full-width carousel */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: isMobile ? '380px' : '480px',
          overflow: 'hidden'
        }}>
          {/* Left edge bloom glow - visible when cards extend past left edge */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: isMobile ? '80px' : '120px',
            background: 'radial-gradient(ellipse 100% 60% at left center, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.06) 50%, transparent 80%)',
            filter: 'blur(20px)',
            pointerEvents: 'none',
            zIndex: 10,
            opacity: activeCard >= (isMobile ? 2 : 3) ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }} />
          {/* Right edge bloom glow - visible when cards extend past right edge */}
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: isMobile ? '80px' : '120px',
            background: 'radial-gradient(ellipse 100% 60% at right center, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.06) 50%, transparent 80%)',
            filter: 'blur(20px)',
            pointerEvents: 'none',
            zIndex: 10,
            opacity: activeCard <= prizes.length - (isMobile ? 3 : 4) ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }} />
          {/* Centered carousel area */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            perspective: '1500px'
          }}>
          {/* Draggable carousel area */}
          <div
            onClick={handleContainerClick}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'pan-y pinch-zoom',
              userSelect: 'none'
            }}
          >
            {prizes.map((prize, index) => {
              const isMystery = prize.is_mystery;
              const isLocked = prize.status === 'locked';
              const isUnlocked = prize.status === 'unlocked';
              const hasClaimedBefore = prize.has_claimed_before;
              const isClaiming = claimingTier === prize.id;
              const isActive = index === activeCard;
              const isHovered = hoveredCard === index;

              // Calculate position offset from active card
              const offset = index - activeCard;
              const spacing = isMobile ? 160 : 280;
              const xOffset = offset * spacing + (isDragging ? dragOffset * 0.3 : 0);
              const zOffset = Math.abs(offset) * -80;
              const rotation = offset * (isMobile ? 3 : 4);
              const scale = isActive ? (isMobile ? 1 : 1.05) : Math.max(0.8, 1 - Math.abs(offset) * 0.08);
              const cardOpacity = Math.abs(offset) > (isMobile ? 2 : 4) ? 0 : 1;

              // Get product image URL based on prize name
              const getProductImage = () => {
                if (prize.name.includes('Vol. 1') || prize.name.includes('Vol 1')) {
                  return 'https://thediary.com/cdn/shop/files/1_e87b669d-04ab-4f85-81c8-df353bbb2188.png?v=1749210128&width=700';
                }
                if (prize.name.includes('Vol. 2') || prize.name.includes('Vol 2')) {
                  return 'https://thediary.com/cdn/shop/files/1_b75fbc90-9bfe-49f2-baf5-3767c7992627.png?v=1762444332&width=700';
                }
                if (prize.name.includes('Vol. 3') || prize.name.includes('Vol 3')) {
                  return 'https://thediary.com/cdn/shop/files/CC3_Web_Image_3.jpg?v=1762859458&width=700';
                }
                if (prize.name.includes('1% Diary') || prize.name.includes('Diary')) {
                  return 'https://thediary.com/cdn/shop/files/No_matter_your_goal_1_d1605690-ab79-45f3-a83d-f9d21e8223bc.png?v=1763725505&width=1000';
                }
                return null;
              };

              const isDiscountCard = prize.prize_type === 'discount_code';
              const productImage = getProductImage();

              return (
                <div
                  key={prize.id}
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    position: 'absolute',
                    width: isMobile ? '200px' : '300px',
                    background: '#000',
                    border: '1px solid transparent',
                    backgroundImage: isActive || isHovered
                      ? 'linear-gradient(#000, #000), linear-gradient(135deg, #FFF 0%, #5A2F30 100%)'
                      : 'none',
                    backgroundColor: '#000',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                    borderColor: isActive || isHovered ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: isActive
                      ? '0 20px 60px rgba(0, 0, 0, 0.6)'
                      : '0 10px 30px rgba(0, 0, 0, 0.4)',
                    transform: `translateX(${xOffset}px) translateZ(${zOffset}px) rotateY(${rotation}deg) scale(${scale})`,
                    transition: isDragging ? 'none' : 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    zIndex: prizes.length - Math.abs(offset),
                    opacity: cardOpacity,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Image Area */}
                  <div style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {isDiscountCard ? (
                      // Discount card with popup cards image
                      <img
                        src="https://thediary.com/cdn/shop/files/1_DIARY_PopUpCardsWhite.png?v=1764327518&width=800"
                        alt={prize.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: isLocked ? 'grayscale(100%) brightness(0.5)' : 'none',
                          transition: 'filter 0.3s ease'
                        }}
                      />
                    ) : isMystery ? (
                      // Mystery prize
                      <img
                        src="https://storage.googleapis.com/doac-perks/edited-photo.webp"
                        alt="Mystery Prize"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: isLocked ? 'grayscale(100%) brightness(0.5)' : 'none',
                          transition: 'filter 0.3s ease'
                        }}
                      />
                    ) : productImage ? (
                      // Product image
                      <img
                        src={productImage}
                        alt={prize.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: isLocked ? 'grayscale(100%) brightness(0.5)' : 'none',
                          transition: 'filter 0.3s ease'
                        }}
                      />
                    ) : (
                      // Fallback for products without images (diaries)
                      <span style={{
                        color: '#FFF',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                        fontSize: isMobile ? '1rem' : '1.2rem',
                        fontWeight: '500',
                        textAlign: 'center',
                        padding: '20px'
                      }}>
                        {prize.name}
                      </span>
                    )}

                    {/* Locked overlay */}
                    {isLocked && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isMystery ? (
                          <span style={{
                            fontSize: '3rem',
                            fontWeight: '300',
                            color: 'rgba(255, 255, 255, 0.5)',
                            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                          }}>?</span>
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="11" width="16" height="10" rx="2"></rect>
                            <path d="M8 11V8a4 4 0 1 1 8 0v3"></path>
                            <circle cx="12" cy="16" r="1" fill="rgba(255,255,255,0.4)" stroke="none"></circle>
                          </svg>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Title & Progress */}
                  <div style={{
                    padding: isMobile ? '12px' : '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    {/* Title */}
                    <h3 style={{
                      color: '#FFF',
                      fontSize: isMobile ? '0.85rem' : '0.95rem',
                      fontWeight: '500',
                      margin: 0,
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                      textAlign: 'center'
                    }}>
                      {isMystery ? 'For the 1%' : isDiscountCard ? `${prize.name.replace(' Off', '')} off DOAC shop` : prize.name}
                    </h3>

                    {/* Progress Bar - hidden for mystery */}
                    {!isMystery && (
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '100px',
                        height: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          background: prize.progress >= 100
                            ? 'linear-gradient(90deg, rgba(255,255,255,0.8) 0%, #FFF 50%, rgba(255,255,255,0.8) 100%)'
                            : 'rgba(255, 255, 255, 0.5)',
                          height: '100%',
                          width: `${prize.progress}%`,
                          borderRadius: '100px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    )}

                    {/* Points needed or status */}
                    <div style={{
                      color: isUnlocked ? '#FFF' : 'rgba(255, 255, 255, 0.5)',
                      fontSize: isMobile ? '0.7rem' : '0.75rem',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                      textAlign: 'center'
                    }}>
                      {isMystery ? (
                        <span style={{
                          filter: 'blur(3.5px)',
                          userSelect: 'none',
                          fontSize: isMobile ? '0.85rem' : '0.9rem',
                          fontWeight: '600',
                          color: '#FFF'
                        }}>?,???,??? pts</span>
                      ) : `${prize.points_required.toLocaleString()} pts`}
                    </div>

                    {/* Redeemed before indicator */}
                    {hasClaimedBefore && (
                      <div style={{
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontSize: isMobile ? '0.65rem' : '0.7rem',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        Redeemed before
                      </div>
                    )}

                    {/* Luxury Redeem button for unlocked prizes - static gold, shimmer on hover */}
                    {isUnlocked && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClaimPrize(prize); }}
                        disabled={isClaiming}
                        className="redeem-button-luxury"
                        style={{
                          width: '100%',
                          background: isClaiming
                            ? '#333'
                            : 'linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #FFD700 50%, #FFA500 75%, #FFD700 100%)',
                          backgroundSize: '200% 200%',
                          color: '#000',
                          border: 'none',
                          padding: isMobile ? '12px' : '14px',
                          borderRadius: '10px',
                          fontSize: isMobile ? '0.85rem' : '0.9rem',
                          fontWeight: '700',
                          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                          cursor: isClaiming ? 'wait' : 'pointer',
                          transition: 'all 0.3s ease',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                          if (!isClaiming) {
                            e.currentTarget.style.transform = 'scale(1.03)';
                            e.currentTarget.style.animation = 'shimmer 1.5s ease-in-out infinite';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.animation = 'none';
                        }}
                      >
                        {isClaiming ? 'Redeeming...' : 'Redeem'}
                      </button>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* Navigation controls - arrows and dots */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isMobile ? '16px' : '24px',
          marginTop: '8px'
        }}>
          {/* Left Arrow */}
          <button
            onClick={goToPrevCard}
            disabled={activeCard === 0}
            style={{
              background: activeCard === 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: isMobile ? '44px' : '50px',
              height: isMobile ? '44px' : '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: activeCard === 0 ? 'not-allowed' : 'pointer',
              opacity: activeCard === 0 ? 0.3 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (activeCard !== 0) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = activeCard === 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg width={isMobile ? "20" : "24"} height={isMobile ? "20" : "24"} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          {/* Right Arrow */}
          <button
            onClick={goToNextCard}
            disabled={activeCard === prizes.length - 1}
            style={{
              background: activeCard === prizes.length - 1 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: isMobile ? '44px' : '50px',
              height: isMobile ? '44px' : '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: activeCard === prizes.length - 1 ? 'not-allowed' : 'pointer',
              opacity: activeCard === prizes.length - 1 ? 0.3 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (activeCard !== prizes.length - 1) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = activeCard === prizes.length - 1 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg width={isMobile ? "20" : "24"} height={isMobile ? "20" : "24"} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

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
              return 'https://thediary.com/cdn/shop/files/CC3_Web_Image_3.jpg?v=1762859458&width=700';
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
              WebkitBackdropFilter: 'blur(20px)'
            }} onClick={handleCancelRedeem}>
              <div style={{
                background: '#000',
                borderRadius: '16px',
                width: isMobile ? '260px' : '320px',
                overflow: 'hidden',
                border: '2px solid rgba(255, 190, 80, 0.9)',
                boxShadow: `
                  0 0 12px 4px rgba(255, 190, 80, 0.7),
                  0 0 25px 8px rgba(255, 170, 50, 0.45),
                  0 0 40px 15px rgba(255, 150, 30, 0.25),
                  0 0 60px 25px rgba(200, 120, 20, 0.1)
                `,
                position: 'relative'
              }} onClick={e => e.stopPropagation()}>

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

                  {/* Gold Redeem Button - bright gold static, shimmer on hover */}
                  <button
                    onClick={handleConfirmRedeem}
                    disabled={claimingTier}
                    className="gold-button-hover"
                    style={{
                      width: '100%',
                      background: claimingTier
                        ? '#333'
                        : 'linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #FFD700 50%, #FFA500 75%, #FFD700 100%)',
                      backgroundSize: '200% 200%',
                      color: '#000',
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
                      marginBottom: '12px'
                    }}
                    onMouseEnter={(e) => {
                      if (!claimingTier) {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.animation = 'shimmer 1.5s ease-in-out infinite';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.animation = 'none';
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
        `}</style>
      </div>
    </>
  );
};

export default Dashboard;
