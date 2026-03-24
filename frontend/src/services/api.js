import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add Authorization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_login_time');

      // Redirect to login if not already there
      if (!window.location.pathname.includes('/admin/login')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

// Quotes API
export const quotesAPI = {
  create: async (formData) => {
    const response = await api.post('/api/quotes/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/api/quotes/${id}`);
    return response.data;
  },
  list: async (params = {}) => {
    const response = await api.get('/api/quotes/', { params });
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/quotes/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    await api.delete(`/api/quotes/${id}`);
  },
};

// Tools API
export const toolsAPI = {
  list: async (activeOnly = true) => {
    const response = await api.get('/api/tools/', { params: { active_only: activeOnly } });
    return response.data;
  },
  getByCategory: async (activeOnly = true) => {
    const response = await api.get('/api/tools/by-category', { params: { active_only: activeOnly } });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/api/tools/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/api/tools/', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/tools/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    await api.delete(`/api/tools/${id}`);
  },
};

// Brands API
export const brandsAPI = {
  list: async (activeOnly = true) => {
    const response = await api.get('/api/brands/', { params: { active_only: activeOnly } });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/api/brands/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/api/brands/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/brands/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  delete: async (id) => {
    await api.delete(`/api/brands/${id}`);
  },
  reorder: async (brands) => {
    const response = await api.put('/api/brands/reorder', brands);
    return response.data;
  },
};

// Industries API
export const industriesAPI = {
  list: async (activeOnly = true) => {
    const response = await api.get('/api/industries/', { params: { active_only: activeOnly } });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/api/industries/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/api/industries/', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/industries/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    await api.delete(`/api/industries/${id}`);
  },
};

// Contact Form API
export const contactFormAPI = {
  submit: async (data) => {
    const response = await api.post('/api/contact/', data);
    return response.data;
  },
};

// Contact Content API
export const contactContentAPI = {
  get: async () => {
    const response = await api.get('/api/contact-content/');
    return response.data;
  },
  update: async (data) => {
    const response = await api.put('/api/contact-content/', data);
    return response.data;
  },
};

// Business Settings API
export const settingsAPI = {
  get: async () => {
    const response = await api.get('/api/settings/');
    return response.data;
  },
  update: async (data) => {
    const response = await api.put('/api/settings/', data);
    return response.data;
  },
  health: async () => {
    const response = await api.get('/api/settings/health');
    return response.data;
  },
};

// Auth API
export const authAPI = {
  login: async ({ email, password }) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// Gallery API
export const galleryAPI = {
  list: async (activeOnly = true) => {
    const response = await api.get('/api/gallery/', { params: { active_only: activeOnly } });
    return response.data;
  },
  upload: async (photoFile, displayOrder = 0) => {
    const formData = new FormData();
    formData.append('photo', photoFile);
    formData.append('display_order', displayOrder);
    const response = await api.post('/api/gallery/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/api/gallery/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    await api.delete(`/api/gallery/${id}`);
  },
};

// About Content API
export const aboutContentAPI = {
  get: async () => {
    const response = await api.get('/api/about-content/');
    return response.data;
  },
  update: async (data) => {
    const response = await api.put('/api/about-content/', data);
    return response.data;
  },
};

// Home Content API
export const homeContentAPI = {
  get: async () => {
    const response = await api.get('/api/home-content/');
    return response.data;
  },
  update: async (data) => {
    const response = await api.put('/api/home-content/', data);
    return response.data;
  },
};

// Industries Content API
export const industriesContentAPI = {
  get: async () => {
    const response = await api.get('/api/industries-content/');
    return response.data;
  },
  update: async (data) => {
    const response = await api.put('/api/industries-content/', data);
    return response.data;
  },
};

export default api;
