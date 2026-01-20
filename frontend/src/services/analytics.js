/**
 * Analytics Service - RudderStack Event Tracking
 *
 * Centralized analytics tracking for the DOAC Referral app.
 * Tracks user behavior, conversions, and engagement.
 *
 * Note: RudderStack SDK is only loaded in production (see index.html).
 * In development, window.rudderanalytics will be undefined.
 */

// Helper to safely call RudderStack (returns null if SDK not loaded)
const rudder = () => window.rudderanalytics || null;

/**
 * Track page views - call on route changes
 */
export const trackPage = (pageName, properties = {}) => {
  try {
    rudder()?.page(pageName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Analytics: Failed to track page', e);
  }
};

/**
 * Identify user - call on login/signup
 */
export const identifyUser = (userId, traits = {}) => {
  try {
    rudder()?.identify(userId, {
      ...traits,
      identified_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Analytics: Failed to identify user', e);
  }
};

/**
 * Reset analytics - call on logout
 */
export const resetAnalytics = () => {
  try {
    rudder()?.reset();
  } catch (e) {
    console.warn('Analytics: Failed to reset', e);
  }
};

/**
 * Generic track event
 */
export const trackEvent = (eventName, properties = {}) => {
  try {
    rudder()?.track(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Analytics: Failed to track event', e);
  }
};

// ============================================
// AUTH EVENTS
// ============================================

export const trackSignupStarted = (method = 'email') => {
  trackEvent('Signup Started', { method });
};

export const trackSignupCompleted = (userId, email, referralCode = null) => {
  trackEvent('Signup Completed', {
    user_id: userId,
    email,
    referral_code: referralCode,
    has_referral: !!referralCode,
  });
};

export const trackLoginStarted = () => {
  trackEvent('Login Started');
};

export const trackLoginCompleted = (userId, email) => {
  trackEvent('Login Completed', {
    user_id: userId,
    email,
  });
};

export const trackLoginFailed = (error) => {
  trackEvent('Login Failed', { error });
};

export const trackLogout = () => {
  trackEvent('Logout');
  resetAnalytics();
};

export const trackPasswordResetRequested = (email) => {
  trackEvent('Password Reset Requested', { email });
};

export const trackPasswordResetCompleted = () => {
  trackEvent('Password Reset Completed');
};

export const trackPasswordResetPageViewed = (hasToken = false) => {
  trackEvent('Password Reset Page Viewed', { has_token: hasToken });
};

export const trackPasswordResetSubmitted = () => {
  trackEvent('Password Reset Submitted');
};

export const trackPasswordResetFailed = (error) => {
  trackEvent('Password Reset Failed', { error });
};

export const trackPasswordResetTokenInvalid = () => {
  trackEvent('Password Reset Token Invalid');
};

// ============================================
// EMAIL VERIFICATION EVENTS
// ============================================

export const trackEmailVerificationPageViewed = (hasToken = false) => {
  trackEvent('Email Verification Page Viewed', { has_token: hasToken });
};

export const trackEmailVerificationSent = (email) => {
  trackEvent('Email Verification Sent', { email });
};

export const trackEmailVerificationResent = (email) => {
  trackEvent('Email Verification Resent', { email });
};

export const trackEmailVerified = (email) => {
  trackEvent('Email Verified', { email });
};

export const trackEmailVerificationFailed = (error) => {
  trackEvent('Email Verification Failed', { error });
};

// ============================================
// PROFILE EVENTS
// ============================================

export const trackProfileViewed = () => {
  trackEvent('Profile Viewed');
};

export const trackProfileUpdated = (fields) => {
  trackEvent('Profile Updated', {
    fields_updated: fields,
    field_count: fields.length,
  });
};

export const trackProfileCompleted = (completionPercentage = 100) => {
  trackEvent('Profile Completed', { completion_percentage: completionPercentage });
};

export const trackProfileSkipped = () => {
  trackEvent('Profile Skipped');
};

export const trackInterestsSelected = (interests) => {
  trackEvent('Interests Selected', {
    interests,
    count: interests.length,
  });
};

export const trackMarketingPreferencesUpdated = (channels) => {
  trackEvent('Marketing Preferences Updated', {
    channels,
    count: channels.length,
  });
};

// ============================================
// ONBOARDING EVENTS
// ============================================

export const trackOnboardingViewed = () => {
  trackEvent('Onboarding Viewed');
};

export const trackOnboardingCompleted = (fieldsCompleted = []) => {
  trackEvent('Onboarding Completed', {
    fields_completed: fieldsCompleted,
    field_count: fieldsCompleted.length,
  });
};

export const trackOnboardingSkipped = () => {
  trackEvent('Onboarding Skipped');
};

// ============================================
// EPISODE SELECTION EVENTS
// ============================================

/**
 * Track when user changes their episode selection
 */
export const trackEpisodeSelectionChanged = (previousEpisodeId, newEpisodeId, episodeTitle, source = 'manual') => {
  const isLatestMode = !newEpisodeId;
  trackEvent('Episode Selection Changed', {
    previous_episode_id: previousEpisodeId,
    new_episode_id: newEpisodeId,
    episode_title: episodeTitle,
    selection_mode: isLatestMode ? 'latest' : 'specific',
    source, // 'manual', 'url_param', 'onboarding'
  });
};

/**
 * Track when user opens the episode selector
 */
export const trackEpisodeSelectorOpened = (currentEpisodeId) => {
  trackEvent('Episode Selector Opened', {
    current_episode_id: currentEpisodeId,
    current_mode: currentEpisodeId ? 'specific' : 'latest',
  });
};

/**
 * Track when user searches within episode selector
 */
export const trackEpisodeSearched = (searchQuery, resultsCount) => {
  trackEvent('Episode Searched', {
    search_query: searchQuery,
    results_count: resultsCount,
  });
};

/**
 * Track when user's episode is auto-set from URL parameter
 */
export const trackEpisodeAutoSet = (episodeId, episodeTitle, source) => {
  trackEvent('Episode Auto Set', {
    episode_id: episodeId,
    episode_title: episodeTitle,
    source, // 'url_param', 'referral_link'
  });
};

// ============================================
// REFERRAL EVENTS
// ============================================

export const trackReferralLinkCopied = (referralCode, episodeId = null) => {
  trackEvent('Referral Link Copied', {
    referral_code: referralCode,
    episode_id: episodeId,
    episode_mode: episodeId ? 'specific' : 'latest',
  });
};

export const trackReferralLinkShared = (referralCode, platform) => {
  trackEvent('Referral Link Shared', {
    referral_code: referralCode,
    platform, // 'twitter', 'facebook', 'whatsapp', 'email', etc.
  });
};

export const trackReferralLandingViewed = (referralCode, properties = {}) => {
  trackEvent('Referral Landing Viewed', {
    referral_code: referralCode,
    ...properties,
  });
};

export const trackReferralSignup = (referralCode, referrerId) => {
  trackEvent('Referral Signup', {
    referral_code: referralCode,
    referrer_id: referrerId,
  });
};

// ============================================
// REFERRAL LANDING PAGE EVENTS (Anonymous visitors)
// ============================================

/**
 * Track when a referral landing page loads (anonymous visitor)
 * Captures rich context for funnel analysis
 */
export const trackReferralPageLoaded = (referralCode, episodeId, context = {}) => {
  trackEvent('Referral Page Loaded', {
    referral_code: referralCode,
    episode_id: episodeId,
    // Device & browser info
    device_type: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    user_agent: navigator.userAgent,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio,
    // Traffic source
    referrer: document.referrer,
    referrer_domain: document.referrer ? new URL(document.referrer).hostname : null,
    // URL context
    landing_url: window.location.href,
    utm_source: new URLSearchParams(window.location.search).get('utm_source'),
    utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
    utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
    // Time context
    local_hour: new Date().getHours(),
    local_day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Connection info (if available)
    connection_type: navigator.connection?.effectiveType,
    // Language
    browser_language: navigator.language,
    ...context,
  });
};

/**
 * Track platform button click on referral landing
 */
export const trackReferralPlatformClick = (referralCode, platform, episodeId, context = {}) => {
  trackEvent('Referral Platform Clicked', {
    referral_code: referralCode,
    platform, // 'youtube', 'spotify', 'apple'
    episode_id: episodeId,
    device_type: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    // Time on page before clicking (if provided)
    ...context,
  });
};

/**
 * Track when the episode card becomes visible (engagement signal)
 */
export const trackReferralEpisodeViewed = (referralCode, episodeId, episodeTitle) => {
  trackEvent('Referral Episode Displayed', {
    referral_code: referralCode,
    episode_id: episodeId,
    episode_title: episodeTitle,
  });
};

/**
 * Track redirect success/failure
 */
export const trackReferralRedirect = (referralCode, platform, success, redirectType = 'web') => {
  trackEvent('Referral Redirect', {
    referral_code: referralCode,
    platform,
    success,
    redirect_type: redirectType, // 'app' or 'web'
  });
};

/**
 * Track when user clicks the "Get your own link" CTA
 */
export const trackReferralCTAClicked = (referralCode, ctaType = 'get_own_link') => {
  trackEvent('Referral CTA Clicked', {
    referral_code: referralCode,
    cta_type: ctaType,
  });
};

/**
 * Track errors on referral landing page
 */
export const trackReferralError = (referralCode, errorType, errorMessage) => {
  trackEvent('Referral Page Error', {
    referral_code: referralCode,
    error_type: errorType,
    error_message: errorMessage,
  });
};

/**
 * Track time spent on referral page before action
 */
export const trackReferralEngagement = (referralCode, timeOnPageSeconds, scrollDepth = 0, interactions = {}) => {
  trackEvent('Referral Page Engagement', {
    referral_code: referralCode,
    time_on_page_seconds: timeOnPageSeconds,
    scroll_depth_percentage: scrollDepth,
    ...interactions,
  });
};

/**
 * Track mouse/touch activity for engagement heatmap data
 */
export const trackReferralHover = (referralCode, element, durationMs) => {
  // Only track significant hovers (>500ms)
  if (durationMs > 500) {
    trackEvent('Referral Element Hovered', {
      referral_code: referralCode,
      element,
      duration_ms: durationMs,
    });
  }
};

// ============================================
// POINTS & REWARDS EVENTS
// ============================================

export const trackPointsEarned = (points, source, totalPoints) => {
  trackEvent('Points Earned', {
    points_earned: points,
    source, // 'referral', 'signup', 'profile_completion', etc.
    total_points: totalPoints,
  });
};

export const trackPointsMilestoneReached = (milestone, totalPoints) => {
  trackEvent('Points Milestone Reached', {
    milestone,
    total_points: totalPoints,
  });
};

// ============================================
// PRIZE & REWARD EVENTS
// ============================================

export const trackPrizeViewed = (prizeId, prizeName, pointsRequired) => {
  trackEvent('Prize Viewed', {
    prize_id: prizeId,
    prize_name: prizeName,
    points_required: pointsRequired,
  });
};

export const trackPrizeUnlocked = (prizeId, prizeName, pointsRequired) => {
  trackEvent('Prize Unlocked', {
    prize_id: prizeId,
    prize_name: prizeName,
    points_required: pointsRequired,
  });
};

export const trackPrizeRedeemStarted = (prizeId, prizeName) => {
  trackEvent('Prize Redeem Started', {
    prize_id: prizeId,
    prize_name: prizeName,
  });
};

export const trackPrizeRedeemed = (prizeId, prizeName, prizeType) => {
  trackEvent('Prize Redeemed', {
    prize_id: prizeId,
    prize_name: prizeName,
    prize_type: prizeType,
  });
};

export const trackPrizeRedeemFailed = (prizeId, prizeName, error) => {
  trackEvent('Prize Redeem Failed', {
    prize_id: prizeId,
    prize_name: prizeName,
    error,
  });
};

// ============================================
// UI INTERACTION EVENTS
// ============================================

export const trackButtonClicked = (buttonName, location) => {
  trackEvent('Button Clicked', {
    button_name: buttonName,
    location,
  });
};

export const trackModalOpened = (modalName) => {
  trackEvent('Modal Opened', { modal_name: modalName });
};

export const trackModalClosed = (modalName, action = 'dismissed') => {
  trackEvent('Modal Closed', {
    modal_name: modalName,
    action, // 'dismissed', 'completed', 'cancelled'
  });
};

export const trackFormStarted = (formName) => {
  trackEvent('Form Started', { form_name: formName });
};

export const trackFormCompleted = (formName) => {
  trackEvent('Form Completed', { form_name: formName });
};

export const trackFormAbandoned = (formName, lastField) => {
  trackEvent('Form Abandoned', {
    form_name: formName,
    last_field: lastField,
  });
};

export const trackTabChanged = (tabName, previousTab) => {
  trackEvent('Tab Changed', {
    tab_name: tabName,
    previous_tab: previousTab,
  });
};

export const trackCarouselNavigated = (direction, currentIndex, totalItems) => {
  trackEvent('Carousel Navigated', {
    direction, // 'next', 'previous', 'dot_click'
    current_index: currentIndex,
    total_items: totalItems,
  });
};

// ============================================
// ERROR EVENTS
// ============================================

export const trackError = (errorType, errorMessage, context = {}) => {
  trackEvent('Error Occurred', {
    error_type: errorType,
    error_message: errorMessage,
    ...context,
  });
};

export const trackAPIError = (endpoint, statusCode, errorMessage) => {
  trackEvent('API Error', {
    endpoint,
    status_code: statusCode,
    error_message: errorMessage,
  });
};

// ============================================
// ENGAGEMENT EVENTS
// ============================================

export const trackSessionStarted = () => {
  trackEvent('Session Started', {
    referrer: document.referrer,
    landing_page: window.location.pathname,
  });
};

export const trackTimeOnPage = (pageName, timeSeconds) => {
  trackEvent('Time On Page', {
    page_name: pageName,
    time_seconds: timeSeconds,
  });
};

export const trackScrollDepth = (pageName, depth) => {
  trackEvent('Scroll Depth', {
    page_name: pageName,
    depth_percentage: depth, // 25, 50, 75, 100
  });
};

// ============================================
// EPISODE/CONTENT EVENTS
// ============================================

export const trackEpisodeViewed = (episodeId, episodeName) => {
  trackEvent('Episode Viewed', {
    episode_id: episodeId,
    episode_name: episodeName,
  });
};

export const trackEpisodeLinkClicked = (episodeId, episodeName, platform) => {
  trackEvent('Episode Link Clicked', {
    episode_id: episodeId,
    episode_name: episodeName,
    platform, // 'spotify', 'apple', 'youtube'
  });
};

// ============================================
// A/B TEST EVENTS
// ============================================

export const trackExperimentViewed = (experimentName, variant) => {
  trackEvent('Experiment Viewed', {
    experiment_name: experimentName,
    variant,
  });
};

export const trackExperimentConverted = (experimentName, variant, conversionType) => {
  trackEvent('Experiment Converted', {
    experiment_name: experimentName,
    variant,
    conversion_type: conversionType,
  });
};

export default {
  trackPage,
  identifyUser,
  resetAnalytics,
  trackEvent,
  // Auth
  trackSignupStarted,
  trackSignupCompleted,
  trackLoginStarted,
  trackLoginCompleted,
  trackLoginFailed,
  trackLogout,
  trackPasswordResetRequested,
  trackPasswordResetCompleted,
  trackPasswordResetPageViewed,
  trackPasswordResetSubmitted,
  trackPasswordResetFailed,
  trackPasswordResetTokenInvalid,
  // Email
  trackEmailVerificationPageViewed,
  trackEmailVerificationSent,
  trackEmailVerificationResent,
  trackEmailVerified,
  trackEmailVerificationFailed,
  // Profile
  trackProfileViewed,
  trackProfileUpdated,
  trackProfileCompleted,
  trackProfileSkipped,
  trackInterestsSelected,
  trackMarketingPreferencesUpdated,
  // Onboarding
  trackOnboardingViewed,
  trackOnboardingCompleted,
  trackOnboardingSkipped,
  // Episode Selection
  trackEpisodeSelectionChanged,
  trackEpisodeSelectorOpened,
  trackEpisodeSearched,
  trackEpisodeAutoSet,
  // Referral
  trackReferralLinkCopied,
  trackReferralLinkShared,
  trackReferralLandingViewed,
  trackReferralSignup,
  // Referral Landing (anonymous)
  trackReferralPageLoaded,
  trackReferralPlatformClick,
  trackReferralEpisodeViewed,
  trackReferralRedirect,
  trackReferralCTAClicked,
  trackReferralError,
  trackReferralEngagement,
  trackReferralHover,
  // Points
  trackPointsEarned,
  trackPointsMilestoneReached,
  // Prizes
  trackPrizeViewed,
  trackPrizeUnlocked,
  trackPrizeRedeemStarted,
  trackPrizeRedeemed,
  trackPrizeRedeemFailed,
  // UI
  trackButtonClicked,
  trackModalOpened,
  trackModalClosed,
  trackFormStarted,
  trackFormCompleted,
  trackFormAbandoned,
  trackTabChanged,
  trackCarouselNavigated,
  // Errors
  trackError,
  trackAPIError,
  // Engagement
  trackSessionStarted,
  trackTimeOnPage,
  trackScrollDepth,
  // Content
  trackEpisodeViewed,
  trackEpisodeLinkClicked,
  // Experiments
  trackExperimentViewed,
  trackExperimentConverted,
};
