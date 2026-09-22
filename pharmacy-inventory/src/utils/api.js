import { clearAuthSession, emitForcedLogout, getAccessToken } from './authStorage';

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1']);

const resolveApiBaseUrl = () => {
  const explicitBase = process.env.REACT_APP_API_BASE_URL;
  if (explicitBase) {
    return explicitBase.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && LOCALHOST_NAMES.has(window.location.hostname)) {
    return 'http://localhost:5001';
  }

  throw new Error('REACT_APP_API_BASE_URL is required outside local development.');
};

const API_BASE_URL = resolveApiBaseUrl();

export const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const apiFetch = async (path, options = {}) => {
  const token = getAccessToken();
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const response = await fetch(apiUrl(path), { ...options, headers, credentials: 'include' });

  if (response.status === 401 && token) {
    clearAuthSession();
    emitForcedLogout();
  }

  return response;
};
