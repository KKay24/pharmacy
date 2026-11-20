import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_CATEGORY_FALLBACK_IMAGE } from "../../data/homepageMedia";
import {
  SHOP_PROMOTIONAL_SLIDES,
  getActivePromotionalSlides,
} from "../../data/promotionalSlides";

const SWIPE_THRESHOLD_PX = 40;
const TRANSITION_DURATION_MS = 750;

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
  autoPlayInterval = 5000,
  ariaLabel = "Shop promotions",
}) {
  const activeSlides = useMemo(() => getActivePromotionalSlides(slides), [slides]);
  const totalSlides = activeSlides.length;
  const hasMultiple = totalSlides > 1;
  const prefersReducedMotion = usePrefersReducedMotion();

  // Cloned head/tail layout: [lastClone, ...activeSlides, firstClone]
  // Index 1 corresponds to activeSlides[0].
  const [trackIndex, setTrackIndex] = useState(hasMultiple ? 1 : 0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  const snapTimerRef = useRef(null);
  const rafRef = useRef(null);
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const touchDeltaXRef = useRef(0);

  // Reset track position cleanly if slides configuration changes (add/remove/reorder/deactivate)
  useEffect(() => {
    setIsTransitioning(false);
    setTrackIndex(hasMultiple ? 1 : 0);
  }, [hasMultiple, totalSlides]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => {
      setIsTabHidden(document.visibilityState === "hidden");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    return () => {
      if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
      if (rafRef.current && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Re-enable smooth CSS transition after a seamless loop reset
  useEffect(() => {
    if (isTransitioning || prefersReducedMotion) return undefined;
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      rafRef.current = window.requestAnimationFrame(() => setIsTransitioning(true));
      return () => {
        if (rafRef.current && window.cancelAnimationFrame) {
          window.cancelAnimationFrame(rafRef.current);
        }
      };
    }
    const timer = window.setTimeout(() => setIsTransitioning(true), 16);
    return () => window.clearTimeout(timer);
  }, [isTransitioning, prefersReducedMotion]);

  const snapIfInClone = useCallback(() => {
    if (!hasMultiple) return;
    setTrackIndex((current) => {
      if (current >= totalSlides + 1) {
        setIsTransitioning(false);
        return 1;
      }
      if (current <= 0) {
        setIsTransitioning(false);
        return totalSlides;
      }
      return current;
    });
  }, [hasMultiple, totalSlides]);

  // Fallback snap timer if transitionend does not fire (e.g., background tab or JSDOM)
  useEffect(() => {
    if (!hasMultiple) return undefined;
    const inClone = trackIndex >= totalSlides + 1 || trackIndex <= 0;
    if (!inClone) return undefined;

    if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(
      snapIfInClone,
      prefersReducedMotion ? 0 : TRANSITION_DURATION_MS + 40
    );

    return () => {
      if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    };
  }, [hasMultiple, trackIndex, totalSlides, prefersReducedMotion, snapIfInClone]);

  const stepBy = useCallback(
    (delta) => {
      if (!hasMultiple) return;
      setIsTransitioning(!prefersReducedMotion);
      setTrackIndex((prev) => {
        let base = prev;
        if (base >= totalSlides + 1) base = 1;
        else if (base <= 0) base = totalSlides;
        return base + delta;
      });
    },
    [hasMultiple, totalSlides, prefersReducedMotion]
  );

  const goNext = useCallback(() => stepBy(1), [stepBy]);
  const goPrev = useCallback(() => stepBy(-1), [stepBy]);

  const goToSlide = useCallback(
    (logicalIdx) => {
      if (!hasMultiple) return;
      const clamped = ((logicalIdx % totalSlides) + totalSlides) % totalSlides;
      setIsTransitioning(!prefersReducedMotion);
      setTrackIndex(clamped + 1);
    },
    [hasMultiple, totalSlides, prefersReducedMotion]
  );

  const isPaused = isHovered || isFocused || isTabHidden || prefersReducedMotion;

  // Autoplay every 5 seconds with right-to-left transitions
  useEffect(() => {
    if (!hasMultiple || isPaused || !autoPlayInterval || autoPlayInterval <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      goNext();
    }, autoPlayInterval);
    return () => window.clearInterval(timer);
  }, [hasMultiple, isPaused, autoPlayInterval, goNext]);

  const handleKeyDown = (event) => {
    if (!hasMultiple) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    } else if (event.key === "Home") {
      event.preventDefault();
      goToSlide(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToSlide(totalSlides - 1);
    }
  };

  const handleTouchStart = (event) => {
    if (!hasMultiple || !event.touches || event.touches.length === 0) return;
    touchStartXRef.current = event.touches[0].clientX;
    touchStartYRef.current = event.touches[0].clientY;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (event) => {
    if (touchStartXRef.current === null || !event.touches || event.touches.length === 0) return;
    const deltaX = event.touches[0].clientX - touchStartXRef.current;
    const deltaY = event.touches[0].clientY - touchStartYRef.current;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      touchDeltaXRef.current = deltaX;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    if (touchDeltaXRef.current <= -SWIPE_THRESHOLD_PX) {
      goNext();
    } else if (touchDeltaXRef.current >= SWIPE_THRESHOLD_PX) {
      goPrev();
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchDeltaXRef.current = 0;
  };

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

  const extendedSlides = hasMultiple
    ? [
        { slide: activeSlides[totalSlides - 1], key: `clone-tail-${activeSlides[totalSlides - 1].id}`, isClone: true, logicalIdx: totalSlides - 1 },
        ...activeSlides.map((slide, idx) => ({ slide, key: `real-${slide.id}`, isClone: false, logicalIdx: idx })),
        { slide: activeSlides[0], key: `clone-head-${activeSlides[0].id}`, isClone: true, logicalIdx: 0 },
      ]
    : [{ slide: activeSlides[0], key: `real-${activeSlides[0].id}`, isClone: false, logicalIdx: 0 }];

  const logicalIndex = hasMultiple
    ? (((trackIndex - 1) % totalSlides) + totalSlides) % totalSlides
    : 0;

  return (
    <section
      className="promo-carousel"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      data-testid="promotional-carousel"
      data-active-index={logicalIndex}
      data-slide-count={totalSlides}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocused(false);
        }
      }}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="promo-carousel__viewport">
        <div
          className={`promo-carousel__track${!isTransitioning || prefersReducedMotion ? " is-instant" : ""}`}
          data-testid="promotional-carousel-track"
          style={{ transform: `translate3d(-${trackIndex * 100}%, 0, 0)` }}
          onTransitionEnd={snapIfInClone}
        >
          {extendedSlides.map(({ slide, key, isClone, logicalIdx }) => {
            const isActiveSlide = !isClone && logicalIdx === logicalIndex;
            const imgSrc = failedImages[slide.id] || slide.imageUrl || slide.fallbackImageUrl || DEFAULT_CATEGORY_FALLBACK_IMAGE;

            return (
              <article
                key={key}
                className={`promo-carousel__slide promo-carousel__slide--${slide.theme || "navy-teal"}`}
                aria-roledescription="slide"
                aria-label={isClone ? undefined : `${logicalIdx + 1} of ${totalSlides}: ${slide.heading}`}
                aria-hidden={isClone || !isActiveSlide ? "true" : "false"}
                data-clone={isClone ? "true" : undefined}
                data-slide-id={isClone ? undefined : slide.id}
              >
                <div className="promo-carousel__inner">
                  <div className="promo-carousel__copy">
                    {slide.badge && (
                      <span className="promo-carousel__badge">{slide.badge}</span>
                    )}
                    <h2 className="promo-carousel__heading">{slide.heading}</h2>
                    {slide.description && (
                      <p className="promo-carousel__description">{slide.description}</p>
                    )}
                    <div className="promo-carousel__actions">
                      {slide.ctaLabel && slide.ctaTo && (
                        <Link
                          to={slide.ctaTo}
                          className="promo-carousel__cta"
                          tabIndex={isActiveSlide ? 0 : -1}
                        >
                          <span>{slide.ctaLabel}</span>
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      )}
                      {slide.secondaryCtaLabel && slide.secondaryCtaTo && (
                        <Link
                          to={slide.secondaryCtaTo}
                          className="promo-carousel__secondary-cta"
                          tabIndex={isActiveSlide ? 0 : -1}
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
                        loading={logicalIdx === 0 && !isClone ? "eager" : "lazy"}
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
          })}
        </div>
      </div>

      {hasMultiple && (
        <>
          <button
            type="button"
            className="promo-carousel__arrow promo-carousel__arrow--prev"
            aria-label="Previous promotion"
            onClick={goPrev}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="promo-carousel__arrow promo-carousel__arrow--next"
            aria-label="Next promotion"
            onClick={goNext}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>

          <div className="promo-carousel__dots" role="tablist" aria-label="Choose a promotion slide">
            {activeSlides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={idx === logicalIndex}
                aria-label={`Show slide ${idx + 1}: ${slide.badge || slide.heading}`}
                className={`promo-carousel__dot${idx === logicalIndex ? " is-active" : ""}`}
                onClick={() => goToSlide(idx)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
