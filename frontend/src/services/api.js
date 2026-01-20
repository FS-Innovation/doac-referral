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

// Interceptor to add fingerprint headers to all requests
api.interceptors.request.use(
  async (config) => {
    try {
      // Add device/browser fingerprints to all requests for fraud detection
      const deviceId = getDeviceId();
      const deviceFingerprint = await getDeviceFingerprint();
      const browserFingerprint = await getBrowserFingerprint();
      const botCheck = getBotScore();
      const execProof = getExecutionProof();

      config.headers['x-device-id'] = deviceId;
      config.headers['x-device-fingerprint'] = deviceFingerprint;
      config.headers['x-browser-fingerprint'] = browserFingerprint;
      config.headers['x-bot-score'] = botCheck.score.toString();
      config.headers['x-bot-signals'] = botCheck.signals.join(',');
      config.headers['x-exec-proof'] = JSON.stringify(execProof);
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
