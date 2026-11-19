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

describe("CategoryCarousel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setViewportWidth(1280);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders all available categories dynamically with no slice(0, 3) truncation and clickable links", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    EIGHT_CATEGORIES.forEach((cat) => {
      const link = screen.getByRole("link", { name: cat.name });
      expect(link).toHaveAttribute("href", `/shop?category=${encodeURIComponent(cat.slug)}`);
    });
  });

  it("adapts visible card counts for desktop (5-6), tablet (3-4), and mobile (2)", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);
    const viewport = screen.getByTestId("category-carousel-viewport");

    // 1440px desktop with 8 categories -> 6 cards
    act(() => setViewportWidth(1440));
    expect(viewport).toHaveAttribute("data-visible-cards", "6");

    // 1200px desktop -> 5 cards
    act(() => setViewportWidth(1200));
    expect(viewport).toHaveAttribute("data-visible-cards", "5");

    // 900px tablet -> 4 cards
    act(() => setViewportWidth(900));
    expect(viewport).toHaveAttribute("data-visible-cards", "4");

    // 700px small tablet -> 3 cards
    act(() => setViewportWidth(700));
    expect(viewport).toHaveAttribute("data-visible-cards", "3");

    // 480px mobile -> 2 cards
    act(() => setViewportWidth(480));
    expect(viewport).toHaveAttribute("data-visible-cards", "2");
  });

  it("autoplays every 5 seconds, loops smoothly, and pauses on hover", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} autoPlayInterval={5000} />);

    const region = screen.getByRole("region", { name: /shop by category/i });
    const viewport = screen.getByTestId("category-carousel-viewport");
    // 1280px -> 5 visible cards -> maxIndex = 3 (positions 0, 1, 2, 3)
    expect(viewport).toHaveAttribute("data-active-index", "0");

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(viewport).toHaveAttribute("data-active-index", "1");

    // Pause on hover
    fireEvent.mouseEnter(region);
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(viewport).toHaveAttribute("data-active-index", "1");

    // Resume and loop cleanly back to 0 after maxIndex (3)
    fireEvent.mouseLeave(region);
    act(() => {
      jest.advanceTimersByTime(15000);
    });
    expect(viewport).toHaveAttribute("data-active-index", "0");
  });

  it("supports arrow clicks, touch swipe, and image error fallback", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    const viewport = screen.getByTestId("category-carousel-viewport");
    const nextBtn = screen.getByRole("button", { name: /next categories/i });
    const prevBtn = screen.getByRole("button", { name: /previous categories/i });

    fireEvent.click(nextBtn);
    expect(viewport).toHaveAttribute("data-active-index", "1");

    fireEvent.click(prevBtn);
    expect(viewport).toHaveAttribute("data-active-index", "0");

    // Wrapping backward from 0 goes to maxIndex (3)
    fireEvent.click(prevBtn);
    expect(viewport).toHaveAttribute("data-active-index", "3");

    // Swipe right moves back to index 2
    fireEvent.touchStart(viewport, { touches: [{ clientX: 60, clientY: 80 }] });
    fireEvent.touchMove(viewport, { touches: [{ clientX: 160, clientY: 82 }] });
    fireEvent.touchEnd(viewport);
    expect(viewport).toHaveAttribute("data-active-index", "2");

    // Image error falls back cleanly
    const img = screen.getByTestId("category-img-eye-ear-care");
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", DEFAULT_CATEGORY_FALLBACK_IMAGE);
  });

  it("renders error state with retry callback", () => {
    const onRetry = jest.fn();
    render(<CategoryCarousel categories={[]} error="Failed to load" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
