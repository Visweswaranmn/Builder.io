import axios, { AxiosError } from 'axios';
import { env } from '@/config/env';

/**
 * Shared Axios instance. Interceptors here will carry auth tokens (Phase 3)
 * and normalize error handling app-wide.
 */
export const api = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Placeholder request interceptor — attach access token once auth lands (Phase 3).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize server error envelope { success, message } into a thrown Error.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const message =
      error.response?.data?.message ?? error.message ?? 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  },
);
