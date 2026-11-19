import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_HERO_FALLBACK_IMAGE, HERO_BANNERS } from "../../data/homepageMedia";
import LiveBpMonitorMedia from "./LiveBpMonitorMedia";
import LiveCapsulesMedia from "./LiveCapsulesMedia";

const SWIPE_THRESHOLD_PX = 40;

export default function HeroBannerCarousel({
  banners = HERO_BANNERS,
  autoPlayInterval = 5000,
  searchSlot = null,
}) {
  const safeBanners = Array.isArray(banners) ? banners.filter(Boolean) : [];
  const totalSlides = safeBanners.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const touchDeltaXRef = useRef(0);

  // Keep activeIndex valid if banners array length changes dynamically
  useEffect(() => {
    if (totalSlides > 0 && activeIndex >= totalSlides) {
      setActiveIndex(0);
    }
  }, [totalSlides, activeIndex]);

  const goToSlide = useCallback(
    (index) => {
      if (totalSlides <= 1) return;
      const wrapped = ((index % totalSlides) + totalSlides) % totalSlides;
      setActiveIndex(wrapped);
    },
    [totalSlides]
  );

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (totalSlides <= 1 ? 0 : (prev + 1) % totalSlides));
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) =>
      totalSlides <= 1 ? 0 : (prev - 1 + totalSlides) % totalSlides
    );
  }, [totalSlides]);

  const isPaused = isHovered || isFocused || isTouching;

  // Independent 5-second autoplay timer (resets on slide change or pause state change)
  useEffect(() => {
    if (totalSlides <= 1 || isPaused || !autoPlayInterval || autoPlayInterval <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalSlides);
    }, autoPlayInterval);
    return () => window.clearInterval(timer);
  }, [totalSlides, isPaused, autoPlayInterval, activeIndex]);

  const handleTouchStart = (event) => {
    if (!event.touches || event.touches.length === 0) return;
    setIsTouching(true);
    touchStartXRef.current = event.touches[0].clientX;
    touchStartYRef.current = event.touches[0].clientY;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (event) => {
    if (touchStartXRef.current === null || !event.touches || event.touches.length === 0) {
      return;
    }
    const deltaX = event.touches[0].clientX - touchStartXRef.current;
    const deltaY = event.touches[0].clientY - touchStartYRef.current;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      touchDeltaXRef.current = deltaX;
    }
  };

  const handleTouchEnd = () => {
    if (touchDeltaXRef.current <= -SWIPE_THRESHOLD_PX) {
      goNext();
    } else if (touchDeltaXRef.current >= SWIPE_THRESHOLD_PX) {
      goPrev();
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchDeltaXRef.current = 0;
    setIsTouching(false);
  };

  const handleKeyDown = (event) => {
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    }
  };

  const handleImageError = (slideKey, fallbackUrl) => {
    setFailedImages((prev) => {
      if (prev[slideKey] === DEFAULT_HERO_FALLBACK_IMAGE) return prev;
      const nextUrl =
        prev[slideKey] || !fallbackUrl ? DEFAULT_HERO_FALLBACK_IMAGE : fallbackUrl;
      return { ...prev, [slideKey]: nextUrl };
    });
  };

  if (totalSlides === 0) {
    return null;
  }

  return (
    <section
      className="hp-hero-carousel"
      aria-roledescription="carousel"
      aria-label="Featured Pharmacy Promotions"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocused(false);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
    >
      <div className="hp-hero-carousel__viewport">
        <div
          className="hp-hero-carousel__track"
          style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
        >
          {safeBanners.map((banner, index) => {
            const slideKey = banner.id || `hero-slide-${index}`;
            const isActive = index === activeIndex;
            const imageSrc = failedImages[slideKey] || banner.imageUrl;
            const HeadingTag = index === 0 ? "h1" : "h2";

            return (
              <div
                key={slideKey}
                className={`hp-hero-slide${isActive ? " is-active" : ""}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${index + 1} of ${totalSlides}: ${banner.title || ""}`}
                aria-hidden={!isActive}
              >
                <div className="hp-hero-content">
                  {banner.kicker && <p className="hp-kicker">{banner.kicker}</p>}
                  <HeadingTag className="hp-hero-title">
                    {banner.title}
                    {banner.highlight && (
                      <>
                        <br />
                        <span>{banner.highlight}</span>
                      </>
                    )}
                  </HeadingTag>
                  {banner.description && (
                    <p className="hp-hero-copy">{banner.description}</p>
                  )}

                  {(banner.ctaLabel || banner.secondaryCtaLabel) && (
                    <div className="hp-hero-actions">
                      {banner.ctaLabel && banner.ctaTo && (
                        <Link
                          to={banner.ctaTo}
                          className="hp-hero-cta hp-hero-cta--primary"
                          tabIndex={isActive ? 0 : -1}
                        >
                          {banner.ctaLabel}
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      )}
                      {banner.secondaryCtaLabel && banner.secondaryCtaTo && (
                        <Link
                          to={banner.secondaryCtaTo}
                          className="hp-hero-cta hp-hero-cta--secondary"
                          tabIndex={isActive ? 0 : -1}
                        >
                          {banner.secondaryCtaLabel}
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                <div className="hp-hero-media">
                  {banner.mediaType === "live-bp-monitor" && !failedImages[slideKey] ? (
                    <LiveBpMonitorMedia
                      src={imageSrc}
                      alt={banner.imageAlt || banner.title || "MediQuick Pharmacy"}
                      className="hp-hero-media__img"
                      isActive={isActive}
                      testId={`hero-live-bp-${slideKey}`}
                    />
                  ) : banner.mediaType === "live-capsules" && !failedImages[slideKey] ? (
                    <LiveCapsulesMedia
                      src={imageSrc}
                      alt={banner.imageAlt || banner.title || "MediQuick Pharmacy"}
                      className="hp-hero-media__img"
                      isActive={isActive}
                      testId={`hero-live-capsules-${slideKey}`}
                    />
                  ) : (
                    <img
                      src={imageSrc}
                      alt={banner.imageAlt || banner.title || "MediQuick Pharmacy"}
                      className="hp-hero-media__img"
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      onError={() => handleImageError(slideKey, banner.fallbackImageUrl)}
                    />
                  )}
                  <div className="hp-hero-media__fade" aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Persistent search bar overlay anchored cleanly below hero copy on desktop/mobile */}
        {searchSlot && <div className="hp-hero-search-wrap">{searchSlot}</div>}

        {/* Previous / Next Navigation Arrows */}
        {totalSlides > 1 && (
          <>
            <button
              type="button"
              className="hp-carousel-arrow hp-carousel-arrow--prev hp-hero-carousel__arrow"
              aria-label="Previous promotional banner"
              onClick={goPrev}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hp-carousel-arrow hp-carousel-arrow--next hp-hero-carousel__arrow"
              aria-label="Next promotional banner"
              onClick={goNext}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </>
        )}

        {/* Pagination Dots */}
        {totalSlides > 1 && (
          <div className="hp-hero-carousel__dots" role="tablist" aria-label="Hero banner slides">
            {safeBanners.map((banner, index) => (
              <button
                key={banner.id || index}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Go to banner ${index + 1}: ${banner.title || ""}`}
                className={`hp-hero-carousel__dot${index === activeIndex ? " is-active" : ""}`}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
