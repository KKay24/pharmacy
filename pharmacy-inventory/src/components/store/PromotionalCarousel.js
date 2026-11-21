import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { DEFAULT_CATEGORY_FALLBACK_IMAGE } from "../../data/homepageMedia";
import {
  SHOP_PROMOTIONAL_SLIDES,
  getActivePromotionalSlides,
} from "../../data/promotionalSlides";

function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event) => setPrefersReduced(Boolean(event.matches));

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
    return undefined;
  }, []);

  return prefersReduced;
}

export default function PromotionalCarousel({
  slides = SHOP_PROMOTIONAL_SLIDES,
  autoPlayInterval = 16000,
  ariaLabel = "Shop promotions",
}) {
  const activeSlides = useMemo(() => getActivePromotionalSlides(slides), [slides]);
  const totalSlides = activeSlides.length;
  const hasMultiple = totalSlides > 1;
  const prefersReducedMotion = usePrefersReducedMotion();

  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => {
      setIsTabHidden(document.visibilityState === "hidden");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const canAnimate = hasMultiple && !prefersReducedMotion && autoPlayInterval > 0;
  const isPaused = isHovered || isFocused || isTabHidden;
  const totalDurationSec = canAnimate ? (totalSlides * autoPlayInterval) / 1000 : 0;

  const handleImageError = (slideId, fallbackUrl) => {
    setFailedImages((prev) => {
      const target = fallbackUrl || DEFAULT_CATEGORY_FALLBACK_IMAGE;
      if (prev[slideId] === target) return prev;
      return { ...prev, [slideId]: target };
    });
  };

  if (totalSlides === 0) {
    return null;
  }

  const renderSlide = (slide, idx, isClone) => {
    const imgSrc =
      failedImages[slide.id] ||
      slide.imageUrl ||
      slide.fallbackImageUrl ||
      DEFAULT_CATEGORY_FALLBACK_IMAGE;

    return (
      <article
        key={isClone ? `clone-${idx}-${slide.id}` : `real-${slide.id}`}
        className={`promo-carousel__slide promo-carousel__slide--${slide.theme || "navy-teal"}`}
        aria-roledescription="slide"
        aria-label={isClone ? undefined : `${idx + 1} of ${totalSlides}: ${slide.heading}`}
        aria-hidden={isClone ? "true" : undefined}
        data-clone={isClone ? "true" : undefined}
        data-slide-id={isClone ? undefined : slide.id}
      >
        <div className="promo-carousel__inner">
          <div className="promo-carousel__copy">
            {slide.badge && <span className="promo-carousel__badge">{slide.badge}</span>}
            <h2 className="promo-carousel__heading">{slide.heading}</h2>
            {slide.description && (
              <p className="promo-carousel__description">{slide.description}</p>
            )}
            <div className="promo-carousel__actions">
              {slide.ctaLabel && slide.ctaTo && (
                <Link
                  to={slide.ctaTo}
                  className="promo-carousel__cta"
                  tabIndex={isClone ? -1 : 0}
                  draggable={false}
                >
                  <span>{slide.ctaLabel}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
              {slide.secondaryCtaLabel && slide.secondaryCtaTo && (
                <Link
                  to={slide.secondaryCtaTo}
                  className="promo-carousel__secondary-cta"
                  tabIndex={isClone ? -1 : 0}
                  draggable={false}
                >
                  <span>{slide.secondaryCtaLabel}</span>
                </Link>
              )}
            </div>
          </div>

          <div className="promo-carousel__media">
            <div className="promo-carousel__media-frame">
              <img
                src={imgSrc}
                alt={isClone ? "" : slide.imageAlt || slide.heading}
                loading="eager"
                decoding="async"
                draggable={false}
                data-testid={isClone ? undefined : `promo-img-${slide.id}`}
                onError={() => handleImageError(slide.id, slide.fallbackImageUrl)}
              />
            </div>
          </div>
        </div>
      </article>
    );
  };

  const trackStyle = canAnimate
    ? {
        "--promo-count": totalSlides,
        "--promo-duration": `${totalDurationSec}s`,
        animationPlayState: isPaused ? "paused" : "running",
      }
    : undefined;

  return (
    <section
      className={`promo-carousel${isPaused ? " is-paused" : ""}`}
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      data-testid="promotional-carousel"
      data-slide-count={totalSlides}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      data-infinite-scroll={canAnimate ? "active" : "paused"}
      data-paused={isPaused ? "true" : "false"}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocused(false);
        }
      }}
    >
      <div className="promo-carousel__viewport">
        <div
          className={`promo-carousel__track${canAnimate ? " promo-carousel__track--marquee" : ""}`}
          data-testid="promotional-carousel-track"
          style={trackStyle}
        >
          <div className="promo-carousel__group" data-testid="promotional-carousel-group-primary">
            {activeSlides.map((slide, idx) => renderSlide(slide, idx, false))}
          </div>
          {canAnimate && (
            <div
              className="promo-carousel__group"
              aria-hidden="true"
              data-clone="true"
              data-testid="promotional-carousel-group-clone"
            >
              {activeSlides.map((slide, idx) => renderSlide(slide, idx, true))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
