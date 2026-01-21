import axios from 'axios';
import { getDeviceId, getDeviceFingerprint, getBrowserFingerprint, getBotScore, getExecutionProof } from '../utils/fingerprint';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json'
  }
});

// ============================================================================
// FINGERPRINT CACHING - Compute once per session, reuse for all requests
// ============================================================================
// Fingerprints don't change during a session, so computing them on every
// request wastes 1-3 seconds (WebGL rendering, audio processing, font detection)
let cachedFingerprints = null;
let fingerprintPromise = null;

const getCachedFingerprints = async () => {
  // Return cached if available
  if (cachedFingerprints) {
    return cachedFingerprints;
  }

  // If computation is in progress, wait for it
  if (fingerprintPromise) {
    return fingerprintPromise;
  }

  // Start computation (only once)
  fingerprintPromise = (async () => {
    const deviceId = getDeviceId(); // Sync, fast
    const botCheck = getBotScore(); // Sync, fast
    const execProof = getExecutionProof(); // Sync, fast (~1-30ms)

    // These are slow - run in parallel
    const [deviceFingerprint, browserFingerprint] = await Promise.all([
      getDeviceFingerprint(),
      getBrowserFingerprint()
    ]);

    cachedFingerprints = {
      deviceId,
      deviceFingerprint,
      browserFingerprint,
      botScore: botCheck.score.toString(),
      botSignals: botCheck.signals.join(','),
      execProof: JSON.stringify(execProof)
    };

    return cachedFingerprints;
  })();

  return fingerprintPromise;
};

// Pre-warm fingerprint cache on module load (non-blocking)
getCachedFingerprints().catch(() => {});

// Endpoints that REQUIRE fingerprints (fraud detection)
// All other endpoints get fingerprints IF already cached, but don't wait
const FINGERPRINT_REQUIRED_PATTERNS = [
  '/referral/',      // Referral click tracking - needs fraud detection
  '/auth/register',  // Registration - needs fraud detection
  '/auth/login',     // Login - needs fraud detection
];

const requiresFingerprints = (url) => {
  return FINGERPRINT_REQUIRED_PATTERNS.some(pattern => url?.includes(pattern));
};

// Interceptor to add fingerprint headers to requests
api.interceptors.request.use(
  async (config) => {
    try {
      if (requiresFingerprints(config.url)) {
        // WAIT for fingerprints - these endpoints need them for fraud detection
        const fps = await getCachedFingerprints();
        config.headers['x-device-id'] = fps.deviceId;
        config.headers['x-device-fingerprint'] = fps.deviceFingerprint;
        config.headers['x-browser-fingerprint'] = fps.browserFingerprint;
        config.headers['x-bot-score'] = fps.botScore;
        config.headers['x-bot-signals'] = fps.botSignals;
        config.headers['x-exec-proof'] = fps.execProof;
      } else if (cachedFingerprints) {
        // Use cached fingerprints if available, but DON'T wait
        // This allows episode fetches etc. to fire immediately
        config.headers['x-device-id'] = cachedFingerprints.deviceId;
        config.headers['x-device-fingerprint'] = cachedFingerprints.deviceFingerprint;
        config.headers['x-browser-fingerprint'] = cachedFingerprints.browserFingerprint;
        config.headers['x-bot-score'] = cachedFingerprints.botScore;
        config.headers['x-bot-signals'] = cachedFingerprints.botSignals;
        config.headers['x-exec-proof'] = cachedFingerprints.execProof;
      }
      // If fingerprints not required and not cached yet, request goes without them
    } catch (error) {
      console.error('Error generating fingerprints:', error);
      // Continue with request even if fingerprinting fails
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors by redirecting to landing (but not during auth operations)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // CRITICAL FIX: Don't redirect on 401 during auth operations
    // Only redirect if it's NOT an auth endpoint (login, register, profile check, etc.)
    const isAuthEndpoint = error.config?.url?.includes('/auth/');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      // Token expired or invalid on a protected route - redirect to landing page
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (email, password, profileData = {}) => api.post('/auth/register', { email, password, ...profileData }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  validateResetToken: (token) => api.post('/auth/validate-reset-token', { token }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  // Email verification
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification'),
  getVerificationStatus: () => api.get('/auth/verification-status')
};

// User endpoints
export const userAPI = {
  getReferralStats: () => api.get('/user/referral-stats'),
  getPurchaseHistory: () => api.get('/user/purchase-history'),
  updateRedirectPlatform: (platform) => api.put('/user/redirect-platform', { platform }),
  getSelectedEpisode: () => api.get('/user/selected-episode'),
  updateSelectedEpisode: (youtubeVideoId, source = 'manual') => api.put('/user/selected-episode', { youtubeVideoId, source })
};

// Product endpoints
export const productAPI = {
  getAll: () => api.get('/products'),
  purchase: (productId) => api.post(`/products/purchase/${productId}`)
};

// Episodes endpoints
export const episodesAPI = {
  getAll: () => api.get('/episodes'),
  getLatest: () => api.get('/episodes/latest'),
  getById: (id) => api.get(`/episodes/${id}`),
  getForReferral: (code, episodeId) => api.get(`/episodes/referral/${code}${episodeId ? `/${episodeId}` : ''}`)
};

// Prize endpoints
export const prizeAPI = {
  getTiers: () => api.get('/prizes'),
  claim: (tierId) => api.post(`/prizes/claim/${tierId}`),
  getClaimed: () => api.get('/prizes/claimed')
};

// Profile completion endpoints
export const profileAPI = {
  getCompletionStatus: () => api.get('/profile/completion-status'),
  completeProfile: (data) => api.post('/profile/complete', data),
  skipProfile: () => api.post('/profile/skip'),
  getInterests: () => api.get('/profile/interests'),
  getMarketingChannels: () => api.get('/profile/marketing-channels'),
  getUserInterests: () => api.get('/profile/user-interests'),
  getUserMarketingPreferences: () => api.get('/profile/user-marketing-preferences'),
  // Full profile management (for edit profile)
  getProfile: () => api.get('/profile/me'),
  updateProfile: (data) => api.put('/profile/me', data)
};

// A/B Experiment endpoints
export const experimentAPI = {
  getVariant: (slug) => api.get(`/experiments/${slug}/variant`),
  recordConversion: (slug, data) => api.post(`/experiments/${slug}/convert`, data)
};

// Admin endpoints
export const adminAPI = {
  // Products
  getAllProducts: () => api.get('/admin/products'),
  createProduct: (data) => api.post('/admin/products', data),
  updateProduct: (id, data) => api.put(`/admin/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/admin/products/${id}`),

  // Users
  getAllUsers: () => api.get('/admin/users'),
  getUserDetails: (id) => api.get(`/admin/users/${id}`),

  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateRedirectUrl: (url) => api.put('/admin/settings/redirect-url', { url }),

  // Analytics
  getAnalytics: () => api.get('/admin/analytics')
};

export default api;
