import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import StoreShopPage from "./StoreShopPage";
import { useStore } from "../../context/StoreContext";

let mockSearchParams = new URLSearchParams();
const mockSetSearchParams = jest.fn((next) => {
  mockSearchParams = new URLSearchParams(next);
});

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useOutletContext: () => ({ openCart: jest.fn() }),
  }),
  { virtual: true }
);

jest.mock("../../context/StoreContext", () => ({
  useStore: jest.fn(),
}));

const MOCK_CATEGORIES = [
  { id: 1, name: "Medicines", slug: "medicines", Children: [] },
  { id: 2, name: "Medical Supplies", slug: "medical-supplies", Children: [] },
];

const MOCK_PRODUCTS = [
  {
    id: 1,
    name: "Paracetamol 500mg Tablets",
    category: "Medicines",
    price: 25,
    prescriptionRequired: false,
  },
  {
    id: 2,
    name: "Amoxicillin 500mg Capsules",
    category: "Medicines",
    price: 65,
    prescriptionRequired: true,
  },
];

describe("StoreShopPage promotional carousel, heading bar, and toolbar", () => {
  const apiFetch = jest.fn();
  const addToCart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    apiFetch.mockImplementation((url) => {
      if (url === "/api/products/categories") return Promise.resolve(MOCK_CATEGORIES);
      if (url.startsWith("/api/products?")) {
        return Promise.resolve({
          data: MOCK_PRODUCTS,
          pagination: { page: 1, limit: 20, total: 399, totalPages: 20 },
        });
      }
      return Promise.resolve({});
    });
    useStore.mockReturnValue({
      apiFetch,
      addToCart,
      toggleWishlist: jest.fn(),
      isWishlisted: jest.fn(() => false),
    });
  });

  it("renders the full-width 6-slide promotional carousel, preserves Prescription Upload, and displays dynamic product count", async () => {
    render(<StoreShopPage />);

    await waitFor(() => {
      expect(screen.getByTestId("shop-product-count")).toHaveTextContent("399 products found");
    });

    // Edge-to-edge promotional carousel with 6 slides & Prescription Upload workflow preserved
    const carousel = screen.getByTestId("promotional-carousel");
    expect(carousel).toHaveAttribute("data-slide-count", "6");
    expect(within(carousel).getByRole("link", { name: /upload prescription/i })).toHaveAttribute(
      "href",
      "/prescription-upload"
    );
    expect(within(carousel).getByRole("link", { name: /ask a pharmacist/i })).toHaveAttribute(
      "href",
      "/contact"
    );

    // Breadcrumb & Heading below carousel
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("heading", { level: 1, name: "All Products" })).toBeInTheDocument();

    // Product cards & cart workflow remain intact
    expect(screen.getByText("Paracetamol 500mg Tablets")).toBeInTheDocument();
    expect(screen.getByText("Amoxicillin 500mg Capsules")).toBeInTheDocument();
  });

  it("preserves Filters toggle, Sort dropdown, and dynamic query updates", async () => {
    render(<StoreShopPage />);

    await waitFor(() => {
      expect(screen.getByText("Paracetamol 500mg Tablets")).toBeInTheDocument();
    });

    const filtersBtn = screen.getByRole("button", { name: /filters/i });
    expect(filtersBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(filtersBtn);
    expect(filtersBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();

    const sortSelect = screen.getByLabelText(/sort products/i);
    fireEvent.change(sortSelect, { target: { value: "price_asc" } });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("sort=price_asc"));
    });
  });
});
