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

  it("renders all available categories dynamically without exposing duplicate accessible clone links", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    EIGHT_CATEGORIES.forEach((cat) => {
      const link = screen.getByRole("link", { name: cat.name });
      expect(link).toHaveAttribute("href", `/shop?category=${encodeURIComponent(cat.slug)}`);
    });
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

  it("autoplays every 3.5 seconds, loops infinitely without rewind jumps, and pauses on hover", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    const region = screen.getByRole("region", { name: /shop by category/i });
    const viewport = screen.getByTestId("category-carousel-viewport");
    expect(viewport).toHaveAttribute("data-active-index", "0");

    // Advances every 3.5s
    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(viewport).toHaveAttribute("data-active-index", "1");

    // Pause on hover
    fireEvent.mouseEnter(region);
    act(() => {
      jest.advanceTimersByTime(10500);
    });
    expect(viewport).toHaveAttribute("data-active-index", "1");

    // Resume and loop cleanly around all 8 items back to 0
    fireEvent.mouseLeave(region);
    for (let step = 0; step < 7; step += 1) {
      act(() => {
        jest.advanceTimersByTime(3500);
      });
    }
    expect(viewport).toHaveAttribute("data-active-index", "0");
  });

  it("supports manual arrows, touch swipe, mouse dragging, and image error fallback", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    const viewport = screen.getByTestId("category-carousel-viewport");
    const nextBtn = screen.getByRole("button", { name: /next categories/i });
    const prevBtn = screen.getByRole("button", { name: /previous categories/i });

    fireEvent.click(nextBtn);
    expect(viewport).toHaveAttribute("data-active-index", "1");

    fireEvent.click(prevBtn);
    expect(viewport).toHaveAttribute("data-active-index", "0");

    // Seamless backward wrap from 0 goes to index 7 (last item)
    fireEvent.click(prevBtn);
    expect(viewport).toHaveAttribute("data-active-index", "7");

    // Touch swipe right moves back to index 6
    fireEvent.touchStart(viewport, { touches: [{ clientX: 60, clientY: 80 }] });
    fireEvent.touchMove(viewport, { touches: [{ clientX: 180, clientY: 82 }] });
    fireEvent.touchEnd(viewport);
    expect(viewport).toHaveAttribute("data-active-index", "6");

    // Mouse drag left advances to index 7
    fireEvent.mouseDown(viewport, { button: 0, clientX: 240, clientY: 90 });
    fireEvent.mouseMove(window, { clientX: 120, clientY: 92 });
    fireEvent.mouseUp(window);
    expect(viewport).toHaveAttribute("data-active-index", "7");

    // Image error falls back cleanly
    const img = screen.getByTestId("category-img-eye-ear-care");
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", DEFAULT_CATEGORY_FALLBACK_IMAGE);
  });

  it("respects prefers-reduced-motion by disabling autoplay while keeping manual arrows functional", () => {
    mockReducedMotion(true);
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    const viewport = screen.getByTestId("category-carousel-viewport");
    expect(viewport).toHaveAttribute("data-reduced-motion", "true");
    expect(viewport).toHaveAttribute("data-active-index", "0");

    act(() => {
      jest.advanceTimersByTime(14000);
    });
    expect(viewport).toHaveAttribute("data-active-index", "0");

    // Manual navigation still works
    fireEvent.click(screen.getByRole("button", { name: /next categories/i }));
    expect(viewport).toHaveAttribute("data-active-index", "1");
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
