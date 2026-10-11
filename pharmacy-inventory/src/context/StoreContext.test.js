import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StoreProvider, useStore } from "./StoreContext";

function CartHarness() {
  const { cart, addToCart, updateCartQty } = useStore();
  return (
    <div>
      <button type="button" onClick={() => addToCart({
        id: 17,
        name: "Backorder medicine",
        price: 10,
        stock: 0,
        inStock: false,
        batches: [{ quantity: 0 }],
      })}>
        Add zero-stock item
      </button>
      <button type="button" onClick={() => updateCartQty(17, 4)}>Set quantity</button>
      <output data-testid="cart">{JSON.stringify(cart)}</output>
    </div>
  );
}

describe("StoreContext customer cart", () => {
  beforeEach(() => {
    localStorage.setItem("store_cart", JSON.stringify([{
      id: 17,
      name: "Saved medicine",
      quantity: 1,
      stock: 0,
      inStock: false,
      batches: [{ quantity: 0 }],
    }]));
  });

  it("removes saved stock details and permits quantities above stock", async () => {
    render(
      <StoreProvider>
        <CartHarness />
      </StoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("cart").textContent).not.toMatch(/stock|inStock|batches/i);
    });
    fireEvent.click(screen.getByRole("button", { name: "Add zero-stock item" }));
    fireEvent.click(screen.getByRole("button", { name: "Set quantity" }));

    await waitFor(() => {
      const cart = JSON.parse(screen.getByTestId("cart").textContent);
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(4);
      expect(cart[0].stock).toBeUndefined();
      expect(cart[0].inStock).toBeUndefined();
      expect(cart[0].batches).toBeUndefined();
    });
  });
});
