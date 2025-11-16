import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json'
  }
});

// Handle 401 errors by redirecting to landing
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to landing page
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
