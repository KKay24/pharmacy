import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import CategoryCarousel from "./CategoryCarousel";
import {
  BABY_PRODUCTS_VIDEO,
  BLOOD_PRESSURE_MONITOR_VIDEO,
  DEFAULT_CATEGORY_FALLBACK_IMAGE,
  PERSONAL_CARE_VIDEO,
  PRESCRIPTION_CAPSULES_VIDEO,
} from "../../data/homepageMedia";

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
    mockReducedMotion(false);
    setViewportWidth(1280);
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: jest.fn(() => Promise.resolve()),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
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

    act(() => setViewportWidth(1440));
    expect(viewport).toHaveAttribute("data-visible-cards", "5");

    act(() => setViewportWidth(1100));
    expect(viewport).toHaveAttribute("data-visible-cards", "4");

    act(() => setViewportWidth(800));
    expect(viewport).toHaveAttribute("data-visible-cards", "3");

    act(() => setViewportWidth(480));
    expect(viewport).toHaveAttribute("data-visible-cards", "2");
  });

  it("runs a seamless two-group CSS marquee, pauses on hover, and handles media error fallback", () => {
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

    // Pause on hover & resume on mouse leave
    fireEvent.mouseEnter(region);
    expect(viewport).toHaveAttribute("data-paused", "true");
    expect(track.style.animationPlayState).toBe("paused");

    fireEvent.mouseLeave(region);
    expect(viewport).toHaveAttribute("data-paused", "false");
    expect(track.style.animationPlayState).toBe("running");

    // Image error falls back cleanly
    const img = screen.getByTestId("category-img-eye-ear-care");
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", DEFAULT_CATEGORY_FALLBACK_IMAGE);
  });

  it("shows looping videos on Medicines, Medical Devices, Baby Products, and Personal Care and a single static image on all other categories (no per-card slideshow)", () => {
    render(<CategoryCarousel categories={EIGHT_CATEGORIES} />);

    // Medicines, Medical Devices, Baby Products, and Personal Care play infinitely looping videos
    const medicinesVideo = screen.getByTestId("category-img-medicines");
    expect(medicinesVideo.tagName).toBe("VIDEO");
    expect(medicinesVideo).toHaveAttribute("src", PRESCRIPTION_CAPSULES_VIDEO);
    expect(medicinesVideo).toHaveAttribute("loop");
    expect(medicinesVideo).toHaveAttribute("autoplay");
    expect(medicinesVideo).toHaveAttribute("playsinline");

    const devicesVideo = screen.getByTestId("category-img-medical-devices");
    expect(devicesVideo.tagName).toBe("VIDEO");
    expect(devicesVideo).toHaveAttribute("src", BLOOD_PRESSURE_MONITOR_VIDEO);
    expect(devicesVideo).toHaveAttribute("loop");
    expect(devicesVideo).toHaveAttribute("autoplay");
    expect(devicesVideo).toHaveAttribute("playsinline");

    const babyVideo = screen.getByTestId("category-img-baby-products");
    expect(babyVideo.tagName).toBe("VIDEO");
    expect(babyVideo).toHaveAttribute("src", BABY_PRODUCTS_VIDEO);
    expect(babyVideo).toHaveAttribute("loop");
    expect(babyVideo).toHaveAttribute("autoplay");
    expect(babyVideo).toHaveAttribute("playsinline");

    const personalCareVideo = screen.getByTestId("category-img-personal-care");
    expect(personalCareVideo.tagName).toBe("VIDEO");
    expect(personalCareVideo).toHaveAttribute("src", PERSONAL_CARE_VIDEO);
    expect(personalCareVideo).toHaveAttribute("loop");
    expect(personalCareVideo).toHaveAttribute("autoplay");
    expect(personalCareVideo).toHaveAttribute("playsinline");

    // All other categories render a single static photo without a rotating gallery slideshow
    for (const slug of [
      "medical-supplies",
      "vitamins-supplements",
      "first-aid",
      "eye-ear-care",
    ]) {
      const media = screen.getByTestId(`category-img-${slug}`);
      expect(media.tagName).toBe("IMG");
      expect(screen.queryByTestId(`category-gallery-${slug}`)).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId("category-gallery-medicines")).not.toBeInTheDocument();
    expect(screen.queryByTestId("category-gallery-medical-devices")).not.toBeInTheDocument();
    expect(screen.queryByTestId("category-gallery-baby-products")).not.toBeInTheDocument();
    expect(screen.queryByTestId("category-gallery-personal-care")).not.toBeInTheDocument();
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
});
