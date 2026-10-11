import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Pos from "./POS";

const inventory = [{
  id: 7,
  name: "Test Paracetamol",
  quantity: 8,
  price: 12,
}];

function renderPos(handleSale) {
  return render(
    <Pos
      inventory={inventory}
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
    fireEvent.click(screen.getByRole("button", { name: /cash/i }));

    await waitFor(() => expect(handleSale).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Cart is currently empty")).toBeTruthy();
  });

  it("preserves the cart when the backend does not confirm checkout", async () => {
    const handleSale = jest.fn().mockResolvedValue({ success: false, error: "Insufficient stock" });
    renderPos(handleSale);

    fireEvent.click(screen.getByText("Test Paracetamol").closest(".pos-product-card"));
    fireEvent.click(screen.getByRole("button", { name: /cash/i }));

    await waitFor(() => expect(handleSale).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Cart is currently empty")).toBeNull();
    expect(screen.getByText("1", { selector: ".pos-qty-val" })).toBeTruthy();
  });

  it("blocks repeated clicks while one checkout request is in progress", async () => {
    let finishCheckout;
    const handleSale = jest.fn(() => new Promise((resolve) => { finishCheckout = resolve; }));
    renderPos(handleSale);

    fireEvent.click(screen.getByText("Test Paracetamol").closest(".pos-product-card"));
    const cashButton = screen.getByRole("button", { name: /cash/i });
    fireEvent.click(cashButton);
    fireEvent.click(cashButton);
    expect(handleSale).toHaveBeenCalledTimes(1);

    finishCheckout({ success: true, confirmed: true });
    expect(await screen.findByText("Cart is currently empty")).toBeTruthy();
  });
});
