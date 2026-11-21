import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import LoginPage from "./LoginPage";
import { DataContext } from "../context/DataContext";
import { useStore } from "../context/StoreContext";

const mockNavigate = jest.fn();
let mockPathname = "/";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname }),
    useOutletContext: () => ({ openCart: jest.fn() }),
  }),
  { virtual: true }
);

jest.mock("../context/StoreContext", () => ({
  useStore: jest.fn(),
}));

const MOCK_CATEGORIES = [
  { id: 1, name: "Medicines", slug: "medicines" },
  { id: 2, name: "Medical Supplies", slug: "medical-supplies" },
  { id: 3, name: "Personal Care", slug: "personal-care" },
  { id: 4, name: "Baby Products", slug: "baby-products" },
  { id: 5, name: "Vitamins & Supplements", slug: "vitamins-supplements" },
  { id: 6, name: "Medical Devices", slug: "medical-devices" },
  { id: 7, name: "Dental Care", slug: "dental-care" },
];

const MOCK_PRODUCTS = [
  { id: 10, name: "Paracetamol 500mg", category: "Medicines", price: 25, prescriptionRequired: false },
];

describe("Homepage (LoginPage) Carousels & Store Functionality", () => {
  const apiFetch = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockPathname = "/";
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    });
    apiFetch.mockImplementation((url) => {
      if (url === "/api/products/categories") return Promise.resolve(MOCK_CATEGORIES);
      if (url.startsWith("/api/products/popular")) return Promise.resolve(MOCK_PRODUCTS);
      return Promise.resolve([]);
    });
    useStore.mockReturnValue({
      apiFetch,
      addToCart: jest.fn(),
      toggleWishlist: jest.fn(),
      isWishlisted: jest.fn(() => false),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("runs hero and category carousels independently and preserves search and catalogue", async () => {
    render(
      <DataContext.Provider value={{ loginUser: jest.fn() }}>
        <LoginPage />
      </DataContext.Provider>
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("link", { name: "Dental Care" })).toBeInTheDocument();

    // Verify >3 hero banners and all 7 dynamic categories are mounted
    const heroRegion = screen.getByRole("region", { name: /featured pharmacy promotions/i });
    const heroTabs = within(heroRegion).getAllByRole("tab");
    expect(heroTabs.length).toBeGreaterThan(3);

    const catViewport = screen.getByTestId("category-carousel-viewport");
    const catTrack = screen.getByTestId("category-carousel-track");
    expect(catViewport).toHaveAttribute("data-infinite-scroll", "active");
    expect(catTrack.style.animationPlayState).toBe("running");

    // Hovering the hero pauses ONLY the hero carousel; the category carousel keeps running!
    fireEvent.mouseEnter(heroRegion);
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(heroTabs[0]).toHaveAttribute("aria-selected", "true");
    expect(catViewport).toHaveAttribute("data-paused", "false");
    expect(catTrack.style.animationPlayState).toBe("running");

    // Homepage search bar still navigates to /shop?search=...
    const searchInput = screen.getByLabelText(/search medicines/i);
    fireEvent.change(searchInput, { target: { value: "Paracetamol" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(mockNavigate).toHaveBeenCalledWith("/shop?search=Paracetamol");
  });

  it("preserves staff login mode without loading storefront carousels", () => {
    render(
      <DataContext.Provider value={{ loginUser: jest.fn() }}>
        <LoginPage staffMode />
      </DataContext.Provider>
    );

    expect(screen.getByText(/secure staff access/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
