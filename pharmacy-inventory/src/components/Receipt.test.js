import React from "react";
import { render, screen } from "@testing-library/react";
import Receipt from "./Receipt";

describe("Receipt", () => {
  it("shows receipt identity, cashier, customer contact, item values, and total", () => {
    render(
      <Receipt transaction={{
        items: [{ name: "Paracetamol", quantity: 2, price: 5, total: 10 }],
        paymentMethod: "Cash",
        subTotal: 10,
        discount: 0,
        totalToPay: 10,
        date: "10/10/2026, 10:00:00 PM",
        receiptNo: "MQ-RECEIPT-1",
        cashierName: "cashier-a",
        customerName: "Customer One",
        customerPhone: "+260 977 000 000",
        customerEmail: "customer@example.test",
      }} />
    );

    expect(screen.getByText(/MQ-RECEIPT-1/)).toBeTruthy();
    expect(screen.getByText(/Sold By: cashier-a/)).toBeTruthy();
    expect(screen.getByText(/Customer: Customer One/)).toBeTruthy();
    expect(screen.getByText(/customer@example.test/)).toBeTruthy();
    expect(screen.getByText("Paracetamol")).toBeTruthy();
    expect(screen.getByText("10.00")).toBeTruthy();
  });
});
