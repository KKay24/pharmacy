import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PromotionalCarousel from "./PromotionalCarousel";
import {
  SHOP_PROMOTIONAL_SLIDES,
  getActivePromotionalSlides,
} from "../../data/promotionalSlides";
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

describe("PromotionalCarousel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders all 6 initial slides with valid destinations, preserves Prescription Upload, and avoids fabricated discounts", () => {
    render(<PromotionalCarousel slides={SHOP_PROMOTIONAL_SLIDES} />);

    const carousel = screen.getByTestId("promotional-carousel");
    expect(carousel).toHaveAttribute("data-slide-count", "6");
    expect(carousel).toHaveAttribute("data-active-index", "0");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);

    // Prescription Upload slide is active first with preserved upload route
    const uploadLink = screen.getByRole("link", { name: /upload prescription/i });
    expect(uploadLink).toHaveAttribute("href", "/prescription-upload");
    expect(screen.getByRole("link", { name: /ask a pharmacist/i })).toHaveAttribute("href", "/contact");

    // Ensure no invented percentages/prices appear in initial promotional slides
    for (const slide of SHOP_PROMOTIONAL_SLIDES) {
      expect(`${slide.heading} ${slide.description}`).not.toMatch(/\d+%\s*off|ZMW\s*\d+/i);
    }
  });

  it("autoplays every 5 seconds right-to-left, loops infinitely, and pauses on hover", () => {
    render(<PromotionalCarousel slides={SHOP_PROMOTIONAL_SLIDES} autoPlayInterval={5000} />);

    const carousel = screen.getByTestId("promotional-carousel");
    const track = screen.getByTestId("promotional-carousel-track");
    expect(carousel).toHaveAttribute("data-active-index", "0");
    expect(track).toHaveStyle({ transform: "translate3d(-100%, 0, 0)" });

    // 5 seconds -> advances right-to-left to slide 1
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(carousel).toHaveAttribute("data-active-index", "1");
    expect(track).toHaveStyle({ transform: "translate3d(-200%, 0, 0)" });

    // Pause on hover
    fireEvent.mouseEnter(carousel);
    act(() => {
      jest.advanceTimersByTime(15000);
    });
    expect(carousel).toHaveAttribute("data-active-index", "1");

    // Resume and infinitely wrap past slide 5 back to slide 0
    fireEvent.mouseLeave(carousel);
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        jest.advanceTimersByTime(5000);
      });
    }
    expect(carousel).toHaveAttribute("data-active-index", "0");
  });

  it("supports manual arrows, clickable pagination dots, touch swipe, keyboard navigation, and image fallbacks", () => {
    render(<PromotionalCarousel slides={SHOP_PROMOTIONAL_SLIDES} />);

    const carousel = screen.getByTestId("promotional-carousel");

    // Arrow navigation
    fireEvent.click(screen.getByRole("button", { name: /next promotion/i }));
    expect(carousel).toHaveAttribute("data-active-index", "1");

    fireEvent.click(screen.getByRole("button", { name: /previous promotion/i }));
    expect(carousel).toHaveAttribute("data-active-index", "0");

    // Backward infinite wrap from 0 -> 5
    fireEvent.click(screen.getByRole("button", { name: /previous promotion/i }));
    expect(carousel).toHaveAttribute("data-active-index", "5");

    // Pagination dot jump
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[2]);
    expect(carousel).toHaveAttribute("data-active-index", "2");
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");

    // Touch swipe left -> slide 3
    fireEvent.touchStart(carousel, { touches: [{ clientX: 220, clientY: 100 }] });
    fireEvent.touchMove(carousel, { touches: [{ clientX: 110, clientY: 102 }] });
    fireEvent.touchEnd(carousel);
    expect(carousel).toHaveAttribute("data-active-index", "3");

    // Keyboard ArrowRight / ArrowLeft / Home / End
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(carousel).toHaveAttribute("data-active-index", "4");
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(carousel).toHaveAttribute("data-active-index", "3");
    fireEvent.keyDown(carousel, { key: "End" });
    expect(carousel).toHaveAttribute("data-active-index", "5");
    fireEvent.keyDown(carousel, { key: "Home" });
    expect(carousel).toHaveAttribute("data-active-index", "0");

    // Image error fallback
    const firstImg = screen.getByTestId("promo-img-prescription-upload");
    fireEvent.error(firstImg);
    expect(firstImg).toHaveAttribute("src", DEFAULT_CATEGORY_FALLBACK_IMAGE);
  });

  it("supports configurable add, remove, reorder, and deactivate slide data", () => {
    const customSlides = [
      { id: "second", order: 2, active: true, heading: "Second Slide", ctaLabel: "Go", ctaTo: "/shop" },
      { id: "disabled", order: 1, active: false, heading: "Hidden Slide", ctaLabel: "No", ctaTo: "/shop" },
      { id: "first", order: 1, active: true, heading: "First Slide", ctaLabel: "Start", ctaTo: "/shop" },
    ];

    const resolved = getActivePromotionalSlides(customSlides);
    expect(resolved.map((s) => s.id)).toEqual(["first", "second"]);

    render(<PromotionalCarousel slides={customSlides} />);
    const carousel = screen.getByTestId("promotional-carousel");
    expect(carousel).toHaveAttribute("data-slide-count", "2");
    expect(screen.getByRole("heading", { name: "First Slide" })).toBeInTheDocument();
    expect(screen.queryByText("Hidden Slide")).not.toBeInTheDocument();
  });

  it("respects prefers-reduced-motion by pausing autoplay while keeping manual navigation active", () => {
    mockReducedMotion(true);
    render(<PromotionalCarousel slides={SHOP_PROMOTIONAL_SLIDES} />);

    const carousel = screen.getByTestId("promotional-carousel");
    expect(carousel).toHaveAttribute("data-reduced-motion", "true");

    act(() => {
      jest.advanceTimersByTime(20000);
    });
    expect(carousel).toHaveAttribute("data-active-index", "0");

    fireEvent.click(screen.getByRole("button", { name: /next promotion/i }));
    expect(carousel).toHaveAttribute("data-active-index", "1");
  });
});
