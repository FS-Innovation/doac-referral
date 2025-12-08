import React, { useState, useEffect } from 'react';
import { episodesAPI } from '../services/api';
import {
  getYouTubeThumbnail,
  formatViewCount,
  formatRelativeTime,
  truncateText,
  getSelectedEpisodeId,
  setSelectedEpisodeId
} from '../utils/episode';

const EpisodeSelector = ({ onEpisodeSelect, referralCode }) => {
  const [episodes, setEpisodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadEpisodes();
  }, []);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const response = await episodesAPI.getAll();
      const episodeList = response.data.episodes || [];
      setEpisodes(episodeList);

      // Get stored selection or default to latest
      const storedId = getSelectedEpisodeId();
      if (storedId && episodeList.some(ep => ep.id === storedId)) {
        setSelectedId(storedId);
      } else if (episodeList.length > 0) {
        // Default to latest (first in list, sorted by published_at DESC)
        setSelectedId(episodeList[0].id);
        setSelectedEpisodeId(episodeList[0].id);
      }
    } catch (err) {
      console.error('Failed to load episodes:', err);
      setError('Failed to load episodes');
    } finally {
      setLoading(false);
    }
  };

  const handleEpisodeClick = (episode) => {
    setSelectedId(episode.id);
    setSelectedEpisodeId(episode.id);
    setIsExpanded(false);
    setSearchQuery('');
    if (onEpisodeSelect) {
      onEpisodeSelect(episode);
    }
  };

  // Filter episodes based on search query
  const filteredEpisodes = episodes.filter(episode =>
    episode.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    episode.episode_number.toString().includes(searchQuery)
  );

  // Get currently selected episode
  const selectedEpisode = episodes.find(ep => ep.id === selectedId);

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#888'
      }}>
        Loading episodes...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#ff6b6b'
      }}>
        {error}
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#888'
      }}>
        No episodes available
      </div>
    );
  }

  return (
    <div style={{
      background: '#0D0D0D',
      border: '1px solid transparent',
      backgroundImage: 'linear-gradient(#0D0D0D, #0D0D0D), linear-gradient(135deg, #FFF 0%, #5A2F30 100%)',
      backgroundOrigin: 'border-box',
      backgroundClip: 'padding-box, border-box',
      borderRadius: isMobile ? '16px' : '10px',
      padding: isMobile ? '20px 16px' : '24px',
      margin: isMobile ? '0 16px 16px 16px' : '0 0 20px 0'
    }}>
      {/* Collapsed View - Selected Episode Preview */}
      {!isExpanded && selectedEpisode && (
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '16px',
          alignItems: isMobile ? 'stretch' : 'center'
        }}>
          {/* Thumbnail */}
          <div style={{
            flexShrink: 0,
            width: isMobile ? '100%' : '120px',
            aspectRatio: '16/9',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <img
              src={getYouTubeThumbnail(selectedEpisode.youtube_video_id)}
              alt={selectedEpisode.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>

          {/* Episode Info & Button */}
          <div style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {/* Episode Title */}
            <div style={{
              color: '#FFF',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '600',
              lineHeight: '1.4',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
              {truncateText(selectedEpisode.title, 80)}
            </div>

            {/* Meta info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#888',
              fontSize: '12px'
            }}>
              <span>EP {selectedEpisode.episode_number}</span>
              <span>•</span>
              <span>{formatViewCount(selectedEpisode.view_count)}</span>
              <span>•</span>
              <span>{formatRelativeTime(selectedEpisode.published_at)}</span>
            </div>

            {/* Change Button */}
            <button
              onClick={() => setIsExpanded(true)}
              style={{
                background: '#FFF',
                color: '#000',
                border: 'none',
                padding: isMobile ? '12px' : '8px 16px',
                borderRadius: isMobile ? '10px' : '5px',
                fontSize: isMobile ? '14px' : '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                touchAction: 'manipulation',
                width: isMobile ? '100%' : 'fit-content',
                marginTop: isMobile ? '4px' : '0'
              }}
            >
              Change Episode
            </button>
          </div>
        </div>
      )}

      {/* Expanded View - Search + Episode Grid */}
      {isExpanded && (
        <>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            marginBottom: isMobile ? '16px' : '20px',
            gap: '12px'
          }}>
            <h2 style={{
              color: '#FFF',
              margin: 0,
              fontSize: isMobile ? '1.125rem' : '1.5rem'
            }}>
              Select Episode to Share
            </h2>
            <button
              onClick={() => {
                setIsExpanded(false);
                setSearchQuery('');
              }}
              style={{
                background: 'transparent',
                color: '#888',
                border: '1px solid #333',
                padding: isMobile ? '10px 16px' : '8px 16px',
                borderRadius: isMobile ? '12px' : '5px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                touchAction: 'manipulation'
              }}
            >
              Cancel
            </button>
          </div>

          {/* Search Bar */}
          <div style={{
            marginBottom: isMobile ? '16px' : '20px'
          }}>
            <input
              type="text"
              placeholder="Search episodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: isMobile ? '14px 16px' : '12px 16px',
                background: '#1B1B1B',
                border: '1px solid #333',
                borderRadius: isMobile ? '12px' : '8px',
                color: '#FFF',
                fontSize: isMobile ? '15px' : '16px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#666';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#333';
              }}
            />
          </div>

          {/* Episode Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: isMobile ? '16px' : '20px',
            maxHeight: isMobile ? '400px' : '500px',
            overflowY: 'auto'
          }}>
            {filteredEpisodes.length === 0 ? (
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
                const isSelected = episode.id === selectedId;

                return (
                  <div
                    key={episode.id}
                    onClick={() => handleEpisodeClick(episode)}
                    style={{
                      background: isSelected ? '#1a1a1a' : '#141414',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: isSelected ? '2px solid #FFF' : '2px solid transparent',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: isSelected ? '0 8px 24px rgba(255, 255, 255, 0.1)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#1a1a1a';
                        e.currentTarget.style.transform = 'scale(1.01)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#141414';
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    {/* Thumbnail Container */}
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

                      {/* Selected Indicator */}
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

                      {/* Episode Number Badge */}
                      <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '10px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: '#FFF',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        EP {episode.episode_number}
                      </div>
                    </div>

                    {/* Episode Info */}
                    <div style={{
                      padding: '12px'
                    }}>
                      <h3 style={{
                        color: '#FFF',
                        fontSize: '0.9375rem',
                        fontWeight: '600',
                        lineHeight: '1.4',
                        marginBottom: '8px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {truncateText(episode.title, 80)}
                      </h3>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#888',
                        fontSize: '0.8125rem'
                      }}>
                        <span>{formatViewCount(episode.view_count)}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(episode.published_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EpisodeSelector;
