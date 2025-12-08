/**
 * Utility functions for episode display
 */

/**
 * Get YouTube thumbnail URL from video ID
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Thumbnail quality: 'default', 'medium', 'high', 'standard', 'maxres'
 * @returns {string} Thumbnail URL
 */
export const getYouTubeThumbnail = (videoId, quality = 'hqdefault') => {
  // Quality options:
  // - default: 120x90
  // - mqdefault: 320x180
  // - hqdefault: 480x360
  // - sddefault: 640x480
  // - maxresdefault: 1280x720 (may not be available for all videos)
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
};

/**
 * Format view count for display (e.g., "180K views", "1.2M views")
 * @param {number} count - View count
 * @returns {string} Formatted view count
 */
export const formatViewCount = (count) => {
  if (!count || count === 0) return '0 views';

  if (count >= 1000000) {
    const millions = count / 1000000;
    return `${millions.toFixed(millions >= 10 ? 0 : 1)}M views`;
  }

  if (count >= 1000) {
    const thousands = count / 1000;
    return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}K views`;
  }

  return `${count} views`;
};

/**
 * Format date as relative time (e.g., "2 weeks ago", "3 months ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (date) => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears >= 1) {
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
  if (diffMonths >= 1) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  }
  if (diffWeeks >= 1) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  }
  if (diffDays >= 1) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  if (diffHours >= 1) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffMinutes >= 1) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }
  return 'Just now';
};

/**
 * Format duration in seconds to display string (e.g., "1:23:45")
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (!seconds) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Truncate text to a maximum length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 60) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Get selected episode ID from localStorage
 * @returns {number|null} Selected episode ID or null
 */
export const getSelectedEpisodeId = () => {
  const stored = localStorage.getItem('selectedEpisodeId');
  return stored ? parseInt(stored, 10) : null;
};

/**
 * Save selected episode ID to localStorage
 * @param {number} episodeId - Episode ID to save
 */
export const setSelectedEpisodeId = (episodeId) => {
  localStorage.setItem('selectedEpisodeId', episodeId.toString());
};

/**
 * Clear selected episode from localStorage
 */
export const clearSelectedEpisodeId = () => {
  localStorage.removeItem('selectedEpisodeId');
};

/**
 * Build referral URL with optional YouTube video ID as query parameter
 * @param {string} referralCode - User's referral code
 * @param {string|null} youtubeVideoId - Optional YouTube video ID (e.g., "4QLWlcneJig")
 * @returns {string} Full referral URL
 */
export const buildReferralUrl = (referralCode, youtubeVideoId = null) => {
  // Use current origin in development, or env variable, or fallback to production
  const isDev = process.env.NODE_ENV === 'development';
  const baseUrl = isDev
    ? window.location.origin
    : (process.env.REACT_APP_SITE_URL || 'https://doac-perks.com');
  let url = `${baseUrl}/r/${referralCode}`;
  if (youtubeVideoId) {
    url += `?e=${youtubeVideoId}`;
  }
  return url;
};

// ============================================================================
// Referral Source Episode (sessionStorage)
// Used to preserve the episode context when a user clicks a referral link
// or visits the site from a video description and needs to sign up.
// Stores YouTube video ID for stable, shareable URLs.
// ============================================================================

const REFERRAL_SOURCE_KEY = 'referralSourceEpisode';

/**
 * Store the YouTube video ID from a referral/direct link in sessionStorage.
 * This persists through the auth flow but clears when the tab closes.
 * @param {string} youtubeVideoId - YouTube video ID (e.g., "4QLWlcneJig")
 */
export const setReferralSourceEpisode = (youtubeVideoId) => {
  if (youtubeVideoId) {
    sessionStorage.setItem(REFERRAL_SOURCE_KEY, youtubeVideoId);
  }
};

/**
 * Get the referral source YouTube video ID without clearing it.
 * @returns {string|null} YouTube video ID or null
 */
export const getReferralSourceEpisode = () => {
  return sessionStorage.getItem(REFERRAL_SOURCE_KEY);
};

/**
 * Consume the referral source YouTube video ID (read and clear).
 * Use this when applying the episode on Dashboard to ensure one-time use.
 * @returns {string|null} YouTube video ID or null
 */
export const consumeReferralSourceEpisode = () => {
  const youtubeVideoId = getReferralSourceEpisode();
  if (youtubeVideoId) {
    sessionStorage.removeItem(REFERRAL_SOURCE_KEY);
  }
  return youtubeVideoId;
};
