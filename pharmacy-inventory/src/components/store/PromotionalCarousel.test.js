import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
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
    mockReducedMotion(false);
  });

  it("renders all 6 initial slides with valid destinations, preserves Prescription Upload, omits dots and arrows, and avoids fabricated discounts", () => {
    render(<PromotionalCarousel slides={SHOP_PROMOTIONAL_SLIDES} />);

    const carousel = screen.getByTestId("promotional-carousel");
    expect(carousel).toHaveAttribute("data-slide-count", "6");

    // No pagination dots or navigation arrow buttons
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /previous promotion/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next promotion/i })).not.toBeInTheDocument();

    // Prescription Upload slide is preserved with upload & pharmacist routes
    const uploadLink = screen.getByRole("link", { name: /upload prescription/i });
    expect(uploadLink).toHaveAttribute("href", "/prescription-upload");
    expect(screen.getByRole("link", { name: /ask a pharmacist/i })).toHaveAttribute("href", "/contact");

    // Ensure no invented percentages/prices appear in initial promotional slides
    for (const slide of SHOP_PROMOTIONAL_SLIDES) {
      expect(`${slide.heading} ${slide.description}`).not.toMatch(/\d+%\s*off|ZMW\s*\d+/i);
    }
  });

  it("runs a seamless two-group CSS marquee without repeat jumps and pauses cleanly on hover and focus", () => {
    render(<PromotionalCarousel slides={SHOP_PROMOTIONAL_SLIDES} autoPlayInterval={16000} />);

    const carousel = screen.getByTestId("promotional-carousel");
    const track = screen.getByTestId("promotional-carousel-track");
    expect(carousel).toHaveAttribute("data-infinite-scroll", "active");
    expect(carousel).toHaveAttribute("data-paused", "false");
    expect(track).toHaveClass("promo-carousel__track--marquee");
    expect(track.style.getPropertyValue("--promo-count")).toBe("6");
    expect(track.style.getPropertyValue("--promo-duration")).toBe("96s");
    expect(track.style.animationPlayState).toBe("running");

    // Exactly two equal groups (1 accessible real group + 1 aria-hidden clone group) for seamless -50% loop
    const primaryGroup = screen.getByTestId("promotional-carousel-group-primary");
    const cloneGroup = screen.getByTestId("promotional-carousel-group-clone");
    expect(primaryGroup).not.toHaveAttribute("aria-hidden");
    expect(cloneGroup).toHaveAttribute("aria-hidden", "true");
    expect(cloneGroup).toHaveAttribute("data-clone", "true");

    // Pause on hover & resume on mouse leave
    fireEvent.mouseEnter(carousel);
    expect(carousel).toHaveAttribute("data-paused", "true");
    expect(track.style.animationPlayState).toBe("paused");

    fireEvent.mouseLeave(carousel);
    expect(carousel).toHaveAttribute("data-paused", "false");
    expect(track.style.animationPlayState).toBe("running");

    // Media error fallback updates cleanly from video to fallback image
    const firstMedia = screen.getByTestId("promo-img-prescription-upload");
    expect(firstMedia.tagName).toBe("VIDEO");
    expect(firstMedia).toHaveAttribute("loop");
    fireEvent.error(firstMedia);
    expect(screen.getByTestId("promo-img-prescription-upload")).toHaveAttribute(
      "src",
      DEFAULT_CATEGORY_FALLBACK_IMAGE
    );
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

  it("respects prefers-reduced-motion by disabling marquee animation and clone duplication", () => {
    mockReducedMotion(true);
    render(<PromotionalCarousel slides={SHOP_PROMOTIONAL_SLIDES} />);

    const carousel = screen.getByTestId("promotional-carousel");
    const track = screen.getByTestId("promotional-carousel-track");
    expect(carousel).toHaveAttribute("data-reduced-motion", "true");
    expect(carousel).toHaveAttribute("data-infinite-scroll", "paused");
    expect(track).not.toHaveClass("promo-carousel__track--marquee");
    expect(screen.getByTestId("promotional-carousel-group-primary")).toBeInTheDocument();
    expect(screen.queryByTestId("promotional-carousel-group-clone")).not.toBeInTheDocument();
  });
});
