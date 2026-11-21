import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import CategoryCarousel from "./CategoryCarousel";
import { DEFAULT_CATEGORY_FALLBACK_IMAGE } from "../../data/homepageMedia";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

const EIGHT_CATEGORIES = [
  { id: 1, name: "Medicines", slug: "medicines" },
  { id: 2, name: "Medical Supplies", slug: "medical-supplies" },
  { id: 3, name: "Personal Care", slug: "personal-care" },
  { id: 4, name: "Baby Products", slug: "baby-products" },
  { id: 5, name: "Vitamins & Supplements", slug: "vitamins-supplements" },
  { id: 6, name: "Medical Devices", slug: "medical-devices" },
  { id: 7, name: "First Aid", slug: "first-aid" },
  { id: 8, name: "Eye & Ear Care", slug: "eye-ear-care" },
];

function setViewportWidth(width) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  fireEvent(window, new Event("resize"));
}

function mockReducedMotion(matches) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
  });
}

describe("CategoryCarousel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion(false);
    setViewportWidth(1280);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders all available categories dynamically without duplicate accessible clone links, dots, or arrows", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    EIGHT_CATEGORIES.forEach((cat) => {
      const link = screen.getByRole("link", { name: cat.name });
      expect(link).toHaveAttribute("href", `/shop?category=${encodeURIComponent(cat.slug)}`);
    });

    // Dots and prev/next arrows are removed
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /previous categories/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next categories/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /scroll categories/i })).not.toBeInTheDocument();
  });

  it("adapts visible card counts to 4-5 on desktop, 3 on tablet, and 2 on mobile", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);
    const viewport = screen.getByTestId("category-carousel-viewport");

    // Wide desktop (>= 1200px) -> 5 cards
    act(() => setViewportWidth(1440));
    expect(viewport).toHaveAttribute("data-visible-cards", "5");

    // Standard desktop (1024px - 1199px) -> 4 cards
    act(() => setViewportWidth(1100));
    expect(viewport).toHaveAttribute("data-visible-cards", "4");

    // Tablet (640px - 1023px) -> 3 cards
    act(() => setViewportWidth(800));
    expect(viewport).toHaveAttribute("data-visible-cards", "3");

    // Mobile (< 640px) -> 2 cards
    act(() => setViewportWidth(480));
    expect(viewport).toHaveAttribute("data-visible-cards", "2");
  });

  it("runs a seamless two-group CSS marquee with synced card galleries, pauses on hover, and handles image fallback", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    const region = screen.getByRole("region", { name: /shop by category/i });
    const viewport = screen.getByTestId("category-carousel-viewport");
    const track = screen.getByTestId("category-carousel-track");
    expect(viewport).toHaveAttribute("data-infinite-scroll", "active");
    expect(viewport).toHaveAttribute("data-paused", "false");
    expect(track).toHaveClass("hp-category-carousel__track--marquee");
    expect(track.style.getPropertyValue("--hp-cat-count")).toBe("8");
    expect(track.style.getPropertyValue("--hp-cat-duration")).toBe("28s");
    expect(track.style.animationPlayState).toBe("running");

    // Exactly two equal groups (real + aria-hidden clone) so -50% repeats with zero jump
    const primaryGroup = screen.getByTestId("category-carousel-group-primary");
    const cloneGroup = screen.getByTestId("category-carousel-group-clone");
    expect(primaryGroup).not.toHaveAttribute("aria-hidden");
    expect(cloneGroup).toHaveAttribute("aria-hidden", "true");
    expect(cloneGroup).toHaveAttribute("data-clone", "true");

    // Real and cloned card galleries stay synchronized on the same active image index
    const realGallery = screen.getByTestId("category-gallery-medicines");
    const cloneGallery = screen.getByTestId("category-gallery-clone-medicines");
    expect(realGallery).toHaveAttribute("data-active-image", "0");
    expect(cloneGallery).toHaveAttribute("data-active-image", "0");

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(realGallery).toHaveAttribute("data-active-image", "1");
    expect(cloneGallery).toHaveAttribute("data-active-image", "1");

    // Pause on hover freezes both marquee animation and gallery rotation
    fireEvent.mouseEnter(region);
    expect(viewport).toHaveAttribute("data-paused", "true");
    expect(track.style.animationPlayState).toBe("paused");
    act(() => {
      jest.advanceTimersByTime(7000);
    });
    expect(realGallery).toHaveAttribute("data-active-image", "1");
    expect(cloneGallery).toHaveAttribute("data-active-image", "1");

    // Resume on mouse leave
    fireEvent.mouseLeave(region);
    expect(viewport).toHaveAttribute("data-paused", "false");
    expect(track.style.animationPlayState).toBe("running");

    // Image error falls back cleanly
    const img = screen.getByTestId("category-img-eye-ear-care");
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", DEFAULT_CATEGORY_FALLBACK_IMAGE);
  });

  it("respects prefers-reduced-motion by disabling marquee animation and clone duplication", () => {
    mockReducedMotion(true);
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    const viewport = screen.getByTestId("category-carousel-viewport");
    const track = screen.getByTestId("category-carousel-track");
    expect(viewport).toHaveAttribute("data-reduced-motion", "true");
    expect(viewport).toHaveAttribute("data-infinite-scroll", "paused");
    expect(track).not.toHaveClass("hp-category-carousel__track--marquee");
    expect(screen.getByTestId("category-carousel-group-primary")).toBeInTheDocument();
    expect(screen.queryByTestId("category-carousel-group-clone")).not.toBeInTheDocument();
  });

  it("renders responsive loading skeletons and error state with retry callback", () => {
    const { rerender } = render(<CategoryCarousel categories={[]} loading />);
    expect(screen.getByText(/loading pharmacy categories/i)).toBeInTheDocument();

    const onRetry = jest.fn();
    rerender(<CategoryCarousel categories={[]} loading={false} error="Failed to load" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("preserves all 3 distinct rotating images for each main category (18 unique images total)", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    const expectedGalleries = [
      ["medicines", ["tablets-blister", "capsules-vial", "dispensary-medicines"]],
      ["medical-supplies", ["first-aid-supplies", "protective-gloves-syringes", "clinical-care-supplies"]],
      ["personal-care", ["skincare-lotion", "gentle-cleansers", "oral-hygiene"]],
      ["baby-products", ["baby-diapers", "baby-bath-care", "baby-feeding"]],
      ["vitamins-supplements", ["daily-vitamins", "supplement-bottles", "wellness-minerals"]],
      ["medical-devices", ["digital-thermometer", "blood-pressure-monitor", "stethoscope"]],
    ];

    const allSrcs = new Set();
    for (const [slug, imageIds] of expectedGalleries) {
      const categorySrcs = new Set();
      imageIds.forEach((id, idx) => {
        const img = screen.getByTestId(`category-img-${slug}-${id}`);
        const src = img.getAttribute("src") || img.getAttribute("data-src");
        categorySrcs.add(src);
        allSrcs.add(src);
        expect(img).toHaveAttribute("data-active", idx === 0 ? "true" : "false");
      });
      expect(categorySrcs.size).toBe(3);
    }

    expect(allSrcs.size).toBe(18);
  });
});
