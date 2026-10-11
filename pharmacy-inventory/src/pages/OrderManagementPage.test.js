import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiFetch } from "../utils/api";
import OrderManagementPage from "./OrderManagementPage";

jest.mock("../utils/api", () => ({
  apiFetch: jest.fn(),
}));

const order = {
  id: 12,
  orderNumber: "ORD-TEST-12",
  customerName: "Test Customer",
  customerPhone: "+260 977 000 000",
  customerEmail: "customer@example.test",
  deliveryMethod: "pickup",
  paymentMethod: "Mobile Money",
  paymentStatus: "Pending",
  orderStatus: "Order Placed",
  date: "2026-10-11T08:00:00.000Z",
  totalAmount: 50,
  items: [{ id: 4, name: "Test medicine", quantity: 2, price: 25, total: 50 }],
};

const jsonResponse = (payload, ok = true) => ({
  ok,
  json: jest.fn().mockResolvedValue(payload),
});

describe("OrderManagementPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(jsonResponse({
      data: [order],
      pagination: { page: 1, totalPages: 1, total: 1 },
    }));
  });

  it("loads staff order details and updates fulfillment status", async () => {
    render(<OrderManagementPage />);

    expect(await screen.findByText("ORD-TEST-12")).toBeTruthy();
    expect(screen.getByText(/customer@example.test/)).toBeTruthy();
    expect(screen.getByText("Mobile Money · Pending")).toBeTruthy();
    expect(screen.getByText(/confirmed only when the full requested quantity is allocated/i)).toBeTruthy();

    apiFetch.mockResolvedValueOnce(jsonResponse({ ...order, orderStatus: "Confirmed" }));
    fireEvent.change(screen.getByLabelText("Fulfillment status", { selector: "#order-status-12" }), {
      target: { value: "Confirmed" },
    });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenLastCalledWith("/api/orders/12/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Confirmed" }),
      });
    });
    expect(await screen.findByText("Order ORD-TEST-12 updated to Confirmed.")).toBeTruthy();

    apiFetch.mockResolvedValueOnce(jsonResponse({
      ...order,
      orderStatus: "Cancelled",
      cancellationReason: "Customer unreachable",
    }));
    fireEvent.change(screen.getByLabelText("Fulfillment status", { selector: "#order-status-12" }), {
      target: { value: "Cancelled" },
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm cancellation" }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Cancellation reason/), {
      target: { value: "Customer unreachable" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenLastCalledWith("/api/orders/12/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled", reason: "Customer unreachable" }),
      });
    });
    expect(await screen.findByText("Order ORD-TEST-12 updated to Cancelled.")).toBeTruthy();
    expect(screen.getByText("Cancellation reason:")).toBeTruthy();
  });
});
