export const ERROR_MESSAGES = {
  BACKEND_UNAVAILABLE: "We're temporarily unable to connect. Please try again.",
  SERVER_ERROR: 'Something went wrong. Your information has been preserved.',
  OFFLINE: "It looks like you're offline. Check your internet connection and try again.",
  SESSION_EXPIRED: 'Your session has expired for your security. Please sign in again to continue.',
  PERMISSION_DENIED: "You don't have permission to view this. Please contact your administrator for access.",
  UPLOAD_FAILED: "We couldn't upload your prescription. Please check the file size and try again.",
} as const;

export type ErrorContext = 'general' | 'login' | 'prescription-upload';

interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
}

interface HttpLikeError {
  code?: string;
  message?: string;
  userMessage?: string;
  config?: { url?: string };
  response?: {
    status?: number;
    data?: ApiErrorPayload | string | null;
  };
}

const OFFLINE_PATTERN = /offline|no internet|internet connection appears to be offline|enotfound|enetunreach/i;
const NETWORK_PATTERN = /network error|err_network|econnaborted|econnrefused|timeout|failed to fetch|unable to reach/i;

function extractPayloadMessage(data?: ApiErrorPayload | string | null): string {
  if (!data) return '';
  if (typeof data === 'string') return data.trim();
  if (Array.isArray(data.message)) {
    return data.message.filter(Boolean).join(', ').trim();
  }
  const raw = data.message || data.error || '';
  return typeof raw === 'string' ? raw.trim() : '';
}

function isWebNavigatorOffline(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.onLine === 'boolean' &&
    navigator.onLine === false
  );
}

export function resolveMobileErrorMessage(
  error: unknown,
  options: { context?: ErrorContext; fallback?: string } = {}
): string {
  const err = (error && typeof error === 'object' ? error : {}) as HttpLikeError;
  const url = String(err.config?.url || '');
  const context: ErrorContext =
    options.context ||
    (url.includes('/auth/login')
      ? 'login'
      : url.includes('/prescriptions/upload')
        ? 'prescription-upload'
        : 'general');

  const status = err.response?.status;
  const payloadMessage = extractPayloadMessage(err.response?.data);

  if (typeof status === 'number') {
    if (status === 401) {
      return context === 'login'
        ? payloadMessage || options.fallback || 'Invalid credentials'
        : ERROR_MESSAGES.SESSION_EXPIRED;
    }

    if (status === 403) {
      return ERROR_MESSAGES.PERMISSION_DENIED;
    }

    if (status === 502 || status === 503 || status === 504) {
      return ERROR_MESSAGES.BACKEND_UNAVAILABLE;
    }

    if (status >= 500 && status < 600) {
      return ERROR_MESSAGES.SERVER_ERROR;
    }

    if (context === 'prescription-upload') {
      if (status === 413 || /file|size|upload|image|payload too large/i.test(payloadMessage)) {
        return ERROR_MESSAGES.UPLOAD_FAILED;
      }
      return payloadMessage || ERROR_MESSAGES.UPLOAD_FAILED;
    }

    return payloadMessage || options.fallback || 'Request failed';
  }

  const rawMessage = typeof err.message === 'string' ? err.message.trim() : '';

  if (isWebNavigatorOffline() || OFFLINE_PATTERN.test(rawMessage)) {
    return ERROR_MESSAGES.OFFLINE;
  }

  if (
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    NETWORK_PATTERN.test(rawMessage)
  ) {
    return ERROR_MESSAGES.BACKEND_UNAVAILABLE;
  }

  if (err.userMessage) {
    return err.userMessage;
  }

  if (context === 'prescription-upload') {
    return rawMessage || ERROR_MESSAGES.UPLOAD_FAILED;
  }

  return rawMessage || options.fallback || ERROR_MESSAGES.BACKEND_UNAVAILABLE;
}
