import { clearAuthSession, emitForcedLogout, getAccessToken } from './authStorage';
import {
  extractPayloadMessage,
  getHttpErrorMessage,
  getNetworkErrorMessage,
  isBrowserOffline,
} from './errorMessages';

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1']);

export const resolveApiBaseUrl = (
  explicitBase = process.env.REACT_APP_API_BASE_URL,
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
) => {
  if (LOCALHOST_NAMES.has(hostname)) {
    if (explicitBase) return explicitBase.replace(/\/$/, '');
    return 'http://localhost:5001';
  }

  // Browser requests in production use the same-origin Vercel proxy.
  return '';
};

const API_BASE_URL = resolveApiBaseUrl();

export const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath === '/api/health') {
    return normalizedPath;
  }
  return `${API_BASE_URL}${normalizedPath}`;
};

export const apiHealthPath = (
  baseUrl = API_BASE_URL,
  isLocalDevelopment = typeof window !== 'undefined' && LOCALHOST_NAMES.has(window.location.hostname)
) => (baseUrl && isLocalDevelopment ? '/health' : '/api/health');

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
  let payloadCode;
  try {
    if (response && typeof response.json === "function") {
      const payload = await response.json();
      payloadMessage = extractPayloadMessage(payload);
      payloadCode = payload?.code;
    }
  } catch (error) {
    payloadMessage = "";
  }

  return getHttpErrorMessage(response?.status, payloadMessage, { ...options, fallback, code: payloadCode });
};
