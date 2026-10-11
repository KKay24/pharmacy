import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useStore } from "../../context/StoreContext";
import { ProductCard } from "./ProductCard";

jest.mock("react-router-dom", () => ({
  Link: ({ children }) => children,
}), { virtual: true });

jest.mock("../../context/StoreContext", () => ({
  useStore: jest.fn(),
}));

const product = {
  id: 17,
  name: "Test product",
  category: "Medicine",
  price: 24.5,
  stock: 0,
  inStock: false,
  batches: [],
  prescriptionRequired: false,
};

describe("ProductCard", () => {
  const addToCart = jest.fn();

  beforeEach(() => {
    addToCart.mockReset();
    useStore.mockReturnValue({
      addToCart,
      toggleWishlist: jest.fn(),
      isWishlisted: jest.fn(() => false),
    });
  });

  it("hides inventory levels and allows adding an out-of-stock product", () => {
    render(<ProductCard product={product} />);

    expect(screen.queryByText(/in stock|out of stock|low stock/i)).toBeNull();
    const addButton = screen.getByRole("button", { name: /add to cart/i });
    expect(addButton.disabled).toBe(false);
    fireEvent.click(addButton);
    expect(addToCart).toHaveBeenCalledWith(product);
  });
});
