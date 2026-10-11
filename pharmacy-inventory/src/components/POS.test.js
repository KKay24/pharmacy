import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Pos from "./POS";

const inventory = [{
  id: 7,
  name: "Test Paracetamol",
  quantity: 8,
  price: 12,
}];

function renderPos(handleSale, products = inventory) {
  return render(
    <Pos
      inventory={products}
      categories={[]}
      handleSale={handleSale}
      cashierName="cashier-a"
    />
  );
}

describe("POS checkout", () => {
  it("shows the authenticated cashier and clears the cart only after checkout succeeds", async () => {
    const handleSale = jest.fn().mockResolvedValue({ success: true, confirmed: true });
    renderPos(handleSale);

    expect(screen.getByText("cashier-a")).toBeTruthy();
    fireEvent.click(screen.getByText("Test Paracetamol").closest(".pos-product-card"));
    fireEvent.click(screen.getByRole("button", { name: "Payment Method" }));
    fireEvent.click(screen.getByRole("button", { name: "Cash" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Payment" }));

    await waitFor(() => expect(handleSale).toHaveBeenCalledTimes(1));
    expect(handleSale.mock.calls[0][0].payments).toEqual([{ method: "Cash", amount: 12 }]);
    expect(await screen.findByText("Cart is currently empty")).toBeTruthy();
  });

  it("preserves the cart when the backend does not confirm checkout", async () => {
    const handleSale = jest.fn().mockResolvedValue({ success: false, error: "Insufficient stock" });
    renderPos(handleSale);

    fireEvent.click(screen.getByText("Test Paracetamol").closest(".pos-product-card"));
    fireEvent.click(screen.getByRole("button", { name: "Payment Method" }));
    fireEvent.click(screen.getByRole("button", { name: "Cash" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Payment" }));

    await waitFor(() => expect(handleSale).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Cart is currently empty")).toBeNull();
    expect(screen.getByText("1", { selector: ".pos-qty-val" })).toBeTruthy();
  });

  it("blocks repeated clicks while one checkout request is in progress", async () => {
    let finishCheckout;
    const handleSale = jest.fn(() => new Promise((resolve) => { finishCheckout = resolve; }));
    renderPos(handleSale);

    fireEvent.click(screen.getByText("Test Paracetamol").closest(".pos-product-card"));
    fireEvent.click(screen.getByRole("button", { name: "Payment Method" }));
    fireEvent.click(screen.getByRole("button", { name: "Cash" }));
    const confirmButton = screen.getByRole("button", { name: "Confirm Payment" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    expect(handleSale).toHaveBeenCalledTimes(1);

    finishCheckout({ success: true, confirmed: true });
    expect(await screen.findByText("Cart is currently empty")).toBeTruthy();
  });

  it("submits split cash and manually verified mobile money against one rounded sale total", async () => {
    const handleSale = jest.fn().mockResolvedValue({ success: true, confirmed: true });
    renderPos(handleSale, [{ ...inventory[0], price: 0.105 }]);

    fireEvent.click(screen.getByText("Test Paracetamol").closest(".pos-product-card"));
    fireEvent.click(screen.getByRole("button", { name: "Payment Method" }));
    fireEvent.click(screen.getByRole("button", { name: "Split Payment" }));
    expect(screen.getByText("Sale total:")).toBeTruthy();
    expect(screen.getAllByText("K0.11").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("combobox", { name: "Payment method 2" }), {
      target: { value: "Airtel Money" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Transaction reference" }), {
      target: { value: "AIR-TEST-123" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "I verified this payment succeeded" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Payment" }));

    await waitFor(() => expect(handleSale).toHaveBeenCalledTimes(1));
    expect(handleSale.mock.calls[0][0].payments).toEqual([
      { method: "Cash", amount: 0.05 },
      {
        method: "Airtel Money",
        amount: 0.06,
        transactionReference: "AIR-TEST-123",
        cashierConfirmed: true,
      },
    ]);
  });

  it("rejects underpayment and overpayment without calling checkout", () => {
    const handleSale = jest.fn();
    renderPos(handleSale);
    fireEvent.click(screen.getByText("Test Paracetamol").closest(".pos-product-card"));
    fireEvent.click(screen.getByRole("button", { name: "Payment Method" }));
    fireEvent.click(screen.getByRole("button", { name: "Split Payment" }));

    const amount1 = screen.getByRole("spinbutton", { name: "Payment amount 1" });
    const amount2 = screen.getByRole("spinbutton", { name: "Payment amount 2" });
    const confirmButton = screen.getByRole("button", { name: "Confirm Payment" });
    fireEvent.change(amount1, { target: { value: "-1" } });
    expect(confirmButton.disabled).toBe(true);
    fireEvent.change(amount1, { target: { value: "6.00" } });
    fireEvent.change(amount2, { target: { value: "5.99" } });
    expect(confirmButton.disabled).toBe(true);
    fireEvent.change(amount2, { target: { value: "6.01" } });
    expect(confirmButton.disabled).toBe(true);
    expect(handleSale).not.toHaveBeenCalled();
  });
});
