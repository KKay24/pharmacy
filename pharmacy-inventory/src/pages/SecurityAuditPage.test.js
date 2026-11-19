import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SecurityAuditPage from "./SecurityAuditPage";
import { apiFetch } from "../utils/api";

jest.mock("../utils/api", () => ({
  apiFetch: jest.fn(),
  getApiErrorMessage: async (response, fallback) => {
    try {
      const data = await response.json();
      return data?.message || data?.error || fallback;
    } catch (error) {
      return fallback;
    }
  },
}));

const MOCK_ACTIVITY_PAYLOAD = {
  data: [
    {
      id: 101,
      userId: null,
      attemptedEmail: "i.m.o.zoz.o.9.80@gmail.com",
      ipAddress: "41.72.200.10",
      userAgent: "Mozilla/5.0 Chrome/130.0.0.0",
      deviceType: "desktop",
      operatingSystem: "Windows",
      browser: "Chrome",
      status: "FAILED",
      failureReason: "unknown_user",
      location: {
        country: "Zambia",
        region: "Lusaka Province",
        city: "Lusaka",
        isp: "Zamtel",
      },
      suspicious: true,
      suspiciousFlags: ["repeated_ip_failures", "short_burst_attempts"],
      suspiciousFlagLabels: [
        "Multiple failed attempts from this IP",
        "Rapid repeated login attempts",
      ],
      createdAt: "2026-11-14T04:21:16.000Z",
    },
  ],
  pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
  summary: {
    totalAttempts: 1,
    successfulAttempts: 0,
    failedAttempts: 1,
    suspiciousAttempts: 1,
    uniqueIps: 1,
    topSuspiciousIps: [
      {
        ipAddress: "41.72.200.10",
        suspiciousEvents: 1,
        failedEvents: 1,
        country: "Zambia",
        city: "Lusaka",
      },
    ],
  },
  geolocationDisclaimer:
    "IP geolocation provides an approximate network location only and does not identify an exact physical address or individual.",
};

const MOCK_IP_REPORT = {
  ipAddress: "41.72.200.10",
  approximateLocation: {
    country: "Zambia",
    region: "Lusaka Province",
    city: "Lusaka",
    isp: "Zamtel",
    disclaimer:
      "Approximate network geolocation only. IP addresses cannot reliably identify an exact physical location or a specific person.",
  },
  stats: {
    totalAttempts: 3,
    successfulAttempts: 0,
    failedAttempts: 3,
    suspiciousAttempts: 1,
    distinctAccountsTargeted: 1,
    currentlyRateLimited: true,
    firstSeen: "2026-11-14T04:21:06.000Z",
    lastSeen: "2026-11-14T04:21:16.000Z",
  },
  targetedAccounts: [
    {
      attemptedEmail: "i.m.o.zoz.o.9.80@gmail.com",
      attempts: 3,
      failed: 3,
      succeeded: 0,
    },
  ],
  attempts: {
    data: MOCK_ACTIVITY_PAYLOAD.data,
    pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
  },
};

function okJson(payload) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => payload,
  });
}

describe("SecurityAuditPage (Security & Login Activity)", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  test("renders login attempts, suspicious indicators, filters, and IP investigation panel", async () => {
    apiFetch.mockImplementation((url) => {
      if (url.startsWith("/api/security/login-activity/ip/")) {
        return okJson(MOCK_IP_REPORT);
      }
      return okJson(MOCK_ACTIVITY_PAYLOAD);
    });

    render(<SecurityAuditPage />);

    expect(await screen.findByText("i.m.o.zoz.o.9.80@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("Unknown account")).toBeInTheDocument();
    expect(screen.getByText("Lusaka, Lusaka Province, Zambia")).toBeInTheDocument();
    expect(screen.getByText("Multiple failed attempts from this IP")).toBeInTheDocument();
    expect(screen.getByText(/approximate network location only/i)).toBeInTheDocument();

    // Filter by status and email
    fireEvent.change(screen.getByLabelText("Filter by login status"), {
      target: { value: "FAILED" },
    });
    fireEvent.change(screen.getByLabelText("Filter by email or username"), {
      target: { value: "i.m.o.zoz" },
    });

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("status=FAILED")
      )
    );
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("email=i.m.o.zoz")
      )
    );

    // Investigate IP address
    const ipButtons = screen.getAllByRole("button", { name: /41\.72\.200\.10/i });
    fireEvent.click(ipButtons[0]);

    expect(
      await screen.findByRole("region", { name: /IP investigation for 41\.72\.200\.10/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Temporarily Rate-Limited")).toBeInTheDocument();
    expect(screen.getByText(/Approximate network geolocation only/i)).toBeInTheDocument();
  });

  test("shows an error alert when access is denied", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "Insufficient permissions" }),
    });

    render(<SecurityAuditPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient permissions");
  });
});
