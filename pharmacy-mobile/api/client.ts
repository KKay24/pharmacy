import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { NativeModules, Platform } from 'react-native';

const API_PORT = '5001';
const PRODUCTION_API_URL = 'https://pharmacy-inventory-backend-4.onrender.com';
const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1']);
const TOKEN_KEY = 'mediquick.token';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const normalizeHostCandidate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const normalizedValue = value.includes('://') ? value : `http://${value}`;

  try {
    return new URL(normalizedValue).hostname || null;
  } catch (error) {
    return null;
  }
};

const getScriptHost = () => {
  const sourceCodeModule = (NativeModules as {
    SourceCode?: {
      scriptURL?: string;
      getConstants?: () => { scriptURL?: string };
    };
  }).SourceCode;

  const scriptUrl =
    sourceCodeModule?.scriptURL ||
    sourceCodeModule?.getConstants?.().scriptURL ||
    null;

  return normalizeHostCandidate(scriptUrl);
};

const getExpoHost = () => {
  const constantsWithLegacyManifest = Constants as typeof Constants & {
    manifest2?: {
      extra?: {
        expoClient?: { hostUri?: string };
        expoGo?: { debuggerHost?: string };
      };
    };
    manifest?: { debuggerHost?: string };
    expoGoConfig?: { debuggerHost?: string } | null;
  };

  const hostCandidates = [
    Constants.expoConfig?.hostUri ||
      null,
    constantsWithLegacyManifest.expoGoConfig?.debuggerHost || null,
    constantsWithLegacyManifest.manifest2?.extra?.expoClient?.hostUri || null,
    constantsWithLegacyManifest.manifest2?.extra?.expoGo?.debuggerHost || null,
    constantsWithLegacyManifest.manifest?.debuggerHost || null,
    getScriptHost(),
  ];

  for (const candidate of hostCandidates) {
    const host = normalizeHostCandidate(candidate);
    if (host) {
      return host;
    }
  }

  return null;
};

const getDevBaseUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:${API_PORT}`;
  }

  const expoHost = getExpoHost();
  if (expoHost && !LOCALHOST_NAMES.has(expoHost)) {
    return `http://${expoHost}:${API_PORT}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
};

export const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return trimTrailingSlash(process.env.EXPO_PUBLIC_API_URL);
  }

  if (__DEV__) {
    return getDevBaseUrl();
  }

  return PRODUCTION_API_URL;
};

export const API_URL = getBaseUrl();

if (__DEV__) {
  console.log(`[API] Using base URL: ${API_URL}`);
}

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
  },
});

// Interceptor to add bearer auth.
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.error('Error fetching auth token from SecureStore', err);
  }
  return config;
});

export default apiClient;
