import {
  ERROR_MESSAGES,
  getHttpErrorMessage,
  getNetworkErrorMessage,
} from "./errorMessages";
import { apiFetch, getApiErrorMessage } from "./api";

describe("MediQuick error message mapping", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    jest.restoreAllMocks();
  });

  it("maps backend unavailable (502/503/504 and network errors when online)", async () => {
    expect(getHttpErrorMessage(502, "Unable to reach the backend API")).toBe(
      "We're temporarily unable to connect. Please try again."
    );
    expect(getHttpErrorMessage(503)).toBe(
      "We're temporarily unable to connect. Please try again."
    );
    expect(getHttpErrorMessage(504)).toBe(
      "We're temporarily unable to connect. Please try again."
    );
    expect(getNetworkErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "We're temporarily unable to connect. Please try again."
    );

    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetch("/api/inventory")).rejects.toThrow(
      ERROR_MESSAGES.BACKEND_UNAVAILABLE
    );
  });

  it("maps exhausted AI credits to the retry-later message", async () => {
    const message = "The AI assistant is temporarily unavailable. Please try again later.";
    expect(
      getHttpErrorMessage(503, "Upstream credit balance exhausted", {
        code: "AI_CREDITS_EXHAUSTED",
      })
    ).toBe(message);

    await expect(
      getApiErrorMessage({
        status: 503,
        json: async () => ({
          code: "AI_CREDITS_EXHAUSTED",
          message: "Upstream credit balance exhausted",
        }),
      })
    ).resolves.toBe(message);
  });

  it("maps 500 server errors without exposing internal details", async () => {
    const response = {
      status: 500,
      json: async () => ({ error: "SequelizeDatabaseError: internal trace" }),
    };
    await expect(getApiErrorMessage(response)).resolves.toBe(
      "Something went wrong. Your information has been preserved."
    );
  });

  it("maps offline / internet disconnected errors", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    expect(getNetworkErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "It looks like you're offline. Check your internet connection and try again."
    );

    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetch("/api/inventory")).rejects.toThrow(ERROR_MESSAGES.OFFLINE);
  });

  it("maps 401 session expired while preserving login credential errors", async () => {
    const response = {
      status: 401,
      json: async () => ({ message: "jwt expired" }),
    };
    await expect(getApiErrorMessage(response)).resolves.toBe(
      "Your session has expired for your security. Please sign in again to continue."
    );

    const loginResponse = {
      status: 401,
      json: async () => ({ message: "Invalid credentials" }),
    };
    await expect(
      getApiErrorMessage(loginResponse, "Login failed", { context: "login" })
    ).resolves.toBe("Invalid credentials");
  });

  it("maps 403 permission denied", async () => {
    const response = {
      status: 403,
      json: async () => ({ message: "Forbidden resource" }),
    };
    await expect(getApiErrorMessage(response)).resolves.toBe(
      "You don't have permission to view this. Please contact your administrator for access."
    );
  });

  it("maps prescription upload failures cleanly while preserving field validation", () => {
    expect(
      getHttpErrorMessage(413, "Payload too large", { context: "prescription-upload" })
    ).toBe("We couldn't upload your prescription. Please check the file size and try again.");
    expect(
      getHttpErrorMessage(400, "File size exceeds limit", { context: "prescription-upload" })
    ).toBe("We couldn't upload your prescription. Please check the file size and try again.");
    expect(
      getHttpErrorMessage(400, "Please enter a valid Zambian phone number", {
        context: "general",
      })
    ).toBe("Please enter a valid Zambian phone number");
  });
});
