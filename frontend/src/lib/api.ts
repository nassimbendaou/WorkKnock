import axios from 'axios';

// Normalize VITE_API_URL to always point to /api regardless of how it was set:
// Handles: "https://host/", "https://host", "https://host/api" → always "https://host/api"
const _raw = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, ''); // strip trailing slashes
const BASE_URL = _raw ? (_raw.endsWith('/api') ? _raw : `${_raw}/api`) : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wk_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('wk_token');
      localStorage.removeItem('wk_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
