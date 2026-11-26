import React from "react";
import { render, screen } from "@testing-library/react";
import { useStore } from "../../context/StoreContext";
import StoreCheckoutPage from "./StoreCheckoutPage";

jest.mock("react-router-dom", () => ({
  Link: ({ children }) => children,
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../../context/StoreContext", () => ({
  useStore: jest.fn(),
}));

describe("StoreCheckoutPage", () => {
  it("does not estimate Yango delivery at a fixed price", () => {
    useStore.mockReturnValue({
      cart: [{ id: 1, name: "Test product", quantity: 1, price: 100 }],
      cartTotal: 100,
      clearCart: jest.fn(),
      apiFetch: jest.fn().mockResolvedValue({ available: false }),
      storeUser: null,
    });

    render(<StoreCheckoutPage />);

    expect(screen.getByText("Price confirmed when booked with Yango")).toBeTruthy();
    expect(screen.getByText("Confirmed when booked")).toBeTruthy();
    expect(screen.getByText("Items total")).toBeTruthy();
    expect(screen.queryByText(/ZMW 25(?:\.00)?/)).toBeNull();
  });
});
