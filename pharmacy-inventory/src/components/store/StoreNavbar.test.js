import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import StoreNavbar from "./StoreNavbar";
import { useStore } from "../../context/StoreContext";

let mockLocation = { pathname: "/", hash: "" };
const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useLocation: () => mockLocation,
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../../context/StoreContext", () => ({
  useStore: jest.fn(),
}));

describe("StoreNavbar search icon visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation = { pathname: "/", hash: "" };
    useStore.mockReturnValue({
      cartCount: 0,
      storeUser: null,
      storeLogout: jest.fn(),
      apiFetch: jest.fn(() => Promise.resolve({ products: [], suggestions: [], categories: [] })),
    });
  });

  it("hides the search icon on the homepage until the user scrolls past the hero section", () => {
    render(
      <div>
        <StoreNavbar onCartOpen={jest.fn()} />
        <section className="hp-hero-carousel" data-testid="hero-section" />
      </div>
    );

    const hero = screen.getByTestId("hero-section");
    let heroBottom = 420;
    jest.spyOn(hero, "getBoundingClientRect").mockImplementation(() => ({
      top: heroBottom - 420,
      bottom: heroBottom,
      left: 0,
      right: 1200,
      width: 1200,
      height: 420,
    }));

    // At top of homepage: search icon is hidden
    fireEvent.scroll(window);
    expect(screen.queryByRole("button", { name: /search products/i })).toBeNull();

    // Scroll past hero section: search icon appears
    heroBottom = 40;
    fireEvent.scroll(window);
    const searchButton = screen.getByRole("button", { name: /search products/i });
    expect(searchButton).toBeInTheDocument();

    // Open search, then scroll back up into hero: search icon and input hide again
    fireEvent.click(searchButton);
    expect(screen.getByRole("combobox", { name: /search pharmacy products/i })).toBeInTheDocument();

    heroBottom = 380;
    fireEvent.scroll(window);
    expect(screen.queryByRole("button", { name: /search products/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /search pharmacy products/i })).toBeNull();
  });

  it("shows the search icon immediately on non-homepage routes", () => {
    mockLocation = { pathname: "/shop", hash: "" };
    render(<StoreNavbar onCartOpen={jest.fn()} />);

    expect(screen.getByRole("button", { name: /search products/i })).toBeInTheDocument();
  });
});
