import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DataContext } from "../context/DataContext";
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
  paymentStatus: "Paid",
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
    expect(screen.getByText("Mobile Money · Paid")).toBeTruthy();
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

  it("shows preorder replenishment tasks and saves supplier-confirmed estimates", async () => {
    const task = {
      id: 21,
      orderNumber: "ORD-PREORDER-21",
      productName: "Preorder medicine",
      outstandingQuantity: 3,
      status: "Open",
      supplierConfirmedAt: null,
      estimatedFulfillmentAt: null,
    };
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (path === "/api/orders/replenishment-tasks") return jsonResponse([task]);
      if (path.endsWith("/estimate")) return jsonResponse({ success: true });
      return jsonResponse({ data: [order], pagination: { page: 1, totalPages: 1, total: 1 } });
    });

    render(
      <DataContext.Provider value={{ userRole: "user" }}>
        <OrderManagementPage />
      </DataContext.Provider>,
    );

    expect(await screen.findByText(/Preorder medicine · 3 outstanding/)).toBeTruthy();
    expect(screen.getByText(/Only enter an ETA after the supplier confirms/i)).toBeTruthy();
    const confirmedAt = new Date(Date.now() - 60_000);
    const estimateAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localDateTime = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    fireEvent.change(screen.getByLabelText("Supplier confirmed at"), {
      target: { value: localDateTime(confirmedAt) },
    });
    fireEvent.change(screen.getByLabelText("Estimated fulfillment"), {
      target: { value: localDateTime(estimateAt) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save confirmed ETA" }));

    await waitFor(() => {
      const estimateCall = apiFetch.mock.calls.find(([path]) => path.endsWith("/estimate"));
      expect(estimateCall).toBeTruthy();
      expect(estimateCall[0]).toBe("/api/orders/replenishment-tasks/21/estimate");
      expect(JSON.parse(estimateCall[1].body)).toEqual({
        supplierConfirmedAt: new Date(localDateTime(confirmedAt)).toISOString(),
        estimatedFulfillmentAt: new Date(localDateTime(estimateAt)).toISOString(),
      });
    });
    expect(await screen.findByText("Supplier-confirmed estimate saved for ORD-PREORDER-21.")).toBeTruthy();
  });
});
