import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { apiFetch } from "../utils/api";
import SupportCenterPage from "./SupportCenterPage";

jest.mock("../utils/api", () => ({
  ...jest.requireActual("../utils/api"),
  apiFetch: jest.fn(),
}));

const inquiry = {
  id: 17,
  name: "Test Customer",
  phone: "+260 977 000 000",
  email: "customer@example.test",
  inquiryType: "Order issue",
  message: "Please help me check my order.",
  status: "New",
  date: "2026-10-11T08:00:00.000Z",
};

const jsonResponse = (payload, ok = true) => ({
  ok,
  json: jest.fn().mockResolvedValue(payload),
});

describe("SupportCenterPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(jsonResponse({
      data: [inquiry],
      pagination: { page: 1, totalPages: 1, total: 1 },
    }));
  });

  it("loads customer messages with contact links and updates inquiry status", async () => {
    render(<SupportCenterPage />);

    expect(await screen.findByText("Please help me check my order.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+260 977 000 000/ })).toHaveAttribute("href", "tel:+260 977 000 000");
    expect(screen.getByRole("link", { name: /customer@example.test/ })).toHaveAttribute("href", "mailto:customer@example.test");
    expect(apiFetch).toHaveBeenCalledWith("/api/support/inquiries?page=1&limit=100");

    const contactedInquiry = { ...inquiry, status: "Contacted" };
    apiFetch
      .mockResolvedValueOnce(jsonResponse(contactedInquiry))
      .mockResolvedValueOnce(jsonResponse({
        data: [contactedInquiry],
        pagination: { page: 1, totalPages: 1, total: 1 },
      }));
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "Contacted" },
    });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/support/inquiries/17/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Contacted" }),
      });
    });
    expect(await screen.findByText("Inquiry from Test Customer marked Contacted.")).toBeInTheDocument();
  });

  it("surfaces inbox load failures", async () => {
    apiFetch.mockResolvedValueOnce(jsonResponse({ message: "Support inbox unavailable" }, false));

    render(<SupportCenterPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Support inbox unavailable");
  });
});
