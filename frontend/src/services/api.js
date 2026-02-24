import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
};

// Tools API
export const toolsAPI = {
  list: async (activeOnly = true) => {
    const response = await api.get('/api/tools/', { params: { active_only: activeOnly } });
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
    const response = await api.post('/api/brands/', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/api/brands/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    await api.delete(`/api/brands/${id}`);
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

// Contact API
export const contactAPI = {
  send: async (data) => {
    const response = await api.post('/api/contact/', data);
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
  login: async (password) => {
    const response = await api.post('/api/admin/login', { password });
    return response.data;
  },
  verify: async (token) => {
    const response = await api.post('/api/admin/verify', null, {
      params: { token }
    });
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

export default api;
