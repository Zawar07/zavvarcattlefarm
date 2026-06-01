import axios from 'axios';

const api = axios.create({
  // Vercel serverless functions live at /api/*  (no /v1 prefix)
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.clear();
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
