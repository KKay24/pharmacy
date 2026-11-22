export const ERROR_MESSAGES = Object.freeze({
  BACKEND_UNAVAILABLE: "We're temporarily unable to connect. Please try again.",
  AI_CREDITS_EXHAUSTED: "The AI assistant is temporarily unavailable. Please try again later.",
  SERVER_ERROR: "Something went wrong. Your information has been preserved.",
  OFFLINE: "It looks like you're offline. Check your internet connection and try again.",
  SESSION_EXPIRED: "Your session has expired for your security. Please sign in again to continue.",
  PERMISSION_DENIED: "You don't have permission to view this. Please contact your administrator for access.",
  UPLOAD_FAILED: "We couldn't upload your prescription. Please check the file size and try again.",
});

const NETWORK_ERROR_PATTERN =
  /failed to fetch|networkerror|network request failed|load failed|err_network|econnrefused|econnreset|etimedout|econnaborted|unable to reach|fetch failed/i;

export function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function extractPayloadMessage(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (Array.isArray(payload.message)) {
    return payload.message.filter(Boolean).join(", ").trim();
  }
  const raw = payload.message || payload.error || "";
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Maps an HTTP status + optional backend payload message to a clear,
 * user-friendly MediQuick error message while preserving field-level
 * validation messages on 4xx responses.
 */
export function getHttpErrorMessage(
  status,
  payloadMessage = "",
  { context = "general", fallback = "Request failed", code } = {}
) {
  const numericStatus = Number(status);

  if (numericStatus === 503 && code === "AI_CREDITS_EXHAUSTED") {
    return ERROR_MESSAGES.AI_CREDITS_EXHAUSTED;
  }

  if (numericStatus === 401) {
    if (context === "login") {
      return payloadMessage || fallback;
    }
    return ERROR_MESSAGES.SESSION_EXPIRED;
  }

  if (numericStatus === 403) {
    return ERROR_MESSAGES.PERMISSION_DENIED;
  }

  if (numericStatus === 502 || numericStatus === 503 || numericStatus === 504) {
    return ERROR_MESSAGES.BACKEND_UNAVAILABLE;
  }

  if (numericStatus >= 500 && numericStatus < 600) {
    return ERROR_MESSAGES.SERVER_ERROR;
  }

  if (context === "prescription-upload") {
    if (numericStatus === 413 || /file|size|upload|image|payload too large/i.test(payloadMessage)) {
      return ERROR_MESSAGES.UPLOAD_FAILED;
    }
    return payloadMessage || ERROR_MESSAGES.UPLOAD_FAILED;
  }

  return payloadMessage || fallback;
}

/**
 * Maps a thrown fetch/runtime error to a friendly MediQuick message.
 */
export function getNetworkErrorMessage(
  error,
  { context = "general", fallback } = {}
) {
  if (isBrowserOffline()) {
    return ERROR_MESSAGES.OFFLINE;
  }

  const rawMessage = typeof error?.message === "string" ? error.message.trim() : "";
  const alreadyFriendly = Object.values(ERROR_MESSAGES).includes(rawMessage);
  if (alreadyFriendly) {
    return rawMessage;
  }

  const isNetworkFailure =
    error?.name === "TypeError" ||
    error?.name === "AbortError" ||
    NETWORK_ERROR_PATTERN.test(rawMessage);

  if (isNetworkFailure) {
    return ERROR_MESSAGES.BACKEND_UNAVAILABLE;
  }

  if (context === "prescription-upload") {
    return rawMessage || ERROR_MESSAGES.UPLOAD_FAILED;
  }

  return rawMessage || fallback || ERROR_MESSAGES.BACKEND_UNAVAILABLE;
}
