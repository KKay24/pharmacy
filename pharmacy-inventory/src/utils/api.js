import { clearAuthSession, emitForcedLogout, getAccessToken } from './authStorage';
import {
  extractPayloadMessage,
  getHttpErrorMessage,
  getNetworkErrorMessage,
  isBrowserOffline,
} from './errorMessages';

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1']);

const resolveApiBaseUrl = () => {
  const explicitBase = process.env.REACT_APP_API_BASE_URL;
  if (explicitBase) {
    return explicitBase.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && LOCALHOST_NAMES.has(window.location.hostname)) {
    return 'http://localhost:5001';
  }

  // In production without an explicit backend base URL, fall back to relative URLs (e.g. Vercel /api proxy)
  return '';
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
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers, credentials: 'include' });
  } catch (error) {
    const friendly = new Error(getNetworkErrorMessage(error));
    friendly.code = isBrowserOffline() ? 'OFFLINE' : 'BACKEND_UNAVAILABLE';
    friendly.cause = error;
    throw friendly;
  }

  if (response.status === 401 && token) {
    clearAuthSession();
    emitForcedLogout();
  }

  return response;
};

export const getApiErrorMessage = async (response, fallback = "Request failed", options = {}) => {
  let payloadMessage = "";
  try {
    if (response && typeof response.json === "function") {
      const payload = await response.json();
      payloadMessage = extractPayloadMessage(payload);
    }
  } catch (error) {
    payloadMessage = "";
  }

  return getHttpErrorMessage(response?.status, payloadMessage, { ...options, fallback });
};
