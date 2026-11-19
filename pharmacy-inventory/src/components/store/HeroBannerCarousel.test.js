import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import HeroBannerCarousel from "./HeroBannerCarousel";
import { DEFAULT_HERO_FALLBACK_IMAGE } from "../../data/homepageMedia";

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

const FIVE_BANNERS = [
  {
    id: "banner-1",
    kicker: "Promo 1",
    title: "Banner One",
    highlight: "Highlight One",
    description: "Description one",
    ctaLabel: "CTA One",
    ctaTo: "/shop",
    imageUrl: "https://example.com/hero-1.jpg",
    fallbackImageUrl: "https://example.com/fallback-1.jpg",
    imageAlt: "Banner One Image",
  },
  {
    id: "banner-2",
    kicker: "Promo 2",
    title: "Banner Two",
    highlight: "Highlight Two",
    description: "Description two",
    ctaLabel: "CTA Two",
    ctaTo: "/prescription-upload",
    imageUrl: "https://example.com/hero-2.jpg",
    imageAlt: "Banner Two Image",
  },
  {
    id: "banner-3",
    kicker: "Promo 3",
    title: "Banner Three",
    highlight: "Highlight Three",
    description: "Description three",
    ctaLabel: "CTA Three",
    ctaTo: "/shop?category=vitamins-supplements",
    imageUrl: "https://example.com/hero-3.jpg",
    imageAlt: "Banner Three Image",
  },
  {
    id: "banner-4",
    kicker: "Promo 4",
    title: "Banner Four",
    highlight: "Highlight Four",
    description: "Description four",
    ctaLabel: "CTA Four",
    ctaTo: "/shop?category=medical-devices",
    imageUrl: "https://example.com/hero-4.jpg",
    imageAlt: "Banner Four Image",
  },
  {
    id: "banner-5",
    kicker: "Promo 5",
    title: "Banner Five",
    highlight: "Highlight Five",
    description: "Description five",
    ctaLabel: "CTA Five",
    ctaTo: "/about",
    imageUrl: "https://example.com/hero-5.jpg",
    imageAlt: "Banner Five Image",
  },
];

describe("HeroBannerCarousel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders all configured banners (>3) with titles, descriptions, CTAs, and optimized lazy loading", () => {
    render(<HeroBannerCarousel banners={FIVE_BANNERS} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    expect(screen.getByText("Description one")).toBeInTheDocument();
    expect(screen.getByText("Description five")).toBeInTheDocument();

    const firstImg = screen.getByAltText("Banner One Image");
    const fifthImg = screen.getByAltText("Banner Five Image");
    expect(firstImg).toHaveAttribute("loading", "eager");
    expect(fifthImg).toHaveAttribute("loading", "lazy");
  });

  it("autoplays every 5 seconds, loops smoothly, and pauses on hover", () => {
    render(<HeroBannerCarousel banners={FIVE_BANNERS} autoPlayInterval={5000} />);

    const carousel = screen.getByRole("region", { name: /featured pharmacy promotions/i });
    const tabs = screen.getAllByRole("tab");

    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    // Hover pauses autoplay
    fireEvent.mouseEnter(carousel);
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    // Leaving resumes autoplay and loops cleanly past banner 5 back to banner 1
    fireEvent.mouseLeave(carousel);
    act(() => {
      jest.advanceTimersByTime(20000);
    });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("supports arrow buttons, pagination dots, and mobile swipe gestures", () => {
    render(<HeroBannerCarousel banners={FIVE_BANNERS} />);

    const carousel = screen.getByRole("region", { name: /featured pharmacy promotions/i });
    const tabs = screen.getAllByRole("tab");

    fireEvent.click(screen.getByRole("button", { name: /next promotional banner/i }));
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: /previous promotional banner/i }));
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    // Clicking dot 4 (0-indexed 3)
    fireEvent.click(tabs[3]);
    expect(tabs[3]).toHaveAttribute("aria-selected", "true");

    // Swipe left -> next slide (index 4)
    fireEvent.touchStart(carousel, { touches: [{ clientX: 220, clientY: 100 }] });
    fireEvent.touchMove(carousel, { touches: [{ clientX: 120, clientY: 102 }] });
    fireEvent.touchEnd(carousel);
    expect(tabs[4]).toHaveAttribute("aria-selected", "true");

    // Swipe right -> previous slide (index 3)
    fireEvent.touchStart(carousel, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(carousel, { touches: [{ clientX: 190, clientY: 100 }] });
    fireEvent.touchEnd(carousel);
    expect(tabs[3]).toHaveAttribute("aria-selected", "true");
  });

  it("falls back cleanly when a banner image fails to load", () => {
    render(<HeroBannerCarousel banners={FIVE_BANNERS} />);

    const firstImg = screen.getByAltText("Banner One Image");
    fireEvent.error(firstImg);
    expect(firstImg).toHaveAttribute("src", "https://example.com/fallback-1.jpg");

    fireEvent.error(firstImg);
    expect(firstImg).toHaveAttribute("src", DEFAULT_HERO_FALLBACK_IMAGE);
  });
});
