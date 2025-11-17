import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json'
  }
});

// Handle 401 errors by redirecting to landing (but not during initial auth check)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // CRITICAL FIX: Don't redirect on 401 during profile check (prevents infinite loop)
    // Only redirect if it's NOT the initial auth check endpoint
    const isProfileCheck = error.config?.url?.includes('/auth/profile');

    if (error.response?.status === 401 && !isProfileCheck) {
      // Token expired or invalid on a protected route - redirect to landing page
      console.log('Authentication expired, redirecting to login...');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile')
};

// User endpoints
export const userAPI = {
  getReferralStats: () => api.get('/user/referral-stats'),
  getPurchaseHistory: () => api.get('/user/purchase-history')
};

// Product endpoints
export const productAPI = {
  getAll: () => api.get('/products'),
  purchase: (productId) => api.post(`/products/purchase/${productId}`)
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
