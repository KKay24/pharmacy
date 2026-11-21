import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_CATEGORY_FALLBACK_IMAGE } from "../../data/homepageMedia";
import {
  SHOP_PROMOTIONAL_SLIDES,
  getActivePromotionalSlides,
} from "../../data/promotionalSlides";
import useInfiniteScrollTrack from "../../hooks/useInfiniteScrollTrack";

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

  const secondsPerItem = autoPlayInterval > 0 ? autoPlayInterval / 1000 : 0;
  const isPaused = isHovered || isFocused || isTabHidden;

  const {
    viewportRef,
    trackRef,
    activeIndex,
    isDragging,
    stepNext,
    stepPrev,
    goToIndex,
    dragHandlers,
  } = useInfiniteScrollTrack({
    itemCount: totalSlides,
    visibleItems: 1,
    secondsPerItem,
    canScroll: hasMultiple,
    paused: isPaused,
    prefersReducedMotion,
  });

  const handleKeyDown = (event) => {
    if (!hasMultiple) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepNext();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepPrev();
    } else if (event.key === "Home") {
      event.preventDefault();
      goToIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToIndex(totalSlides - 1);
    }
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

  // Duplicate slide list once for seamless continuous infinite right-to-left scrolling
  const renderedSlides = hasMultiple
    ? [
        ...activeSlides.map((slide, idx) => ({
          slide,
          key: `real-${slide.id}`,
          isClone: false,
          logicalIdx: idx,
        })),
        ...activeSlides.map((slide, idx) => ({
          slide,
          key: `clone-${idx}-${slide.id}`,
          isClone: true,
          logicalIdx: idx,
        })),
      ]
    : [{ slide: activeSlides[0], key: `real-${activeSlides[0].id}`, isClone: false, logicalIdx: 0 }];

  return (
    <section
      className="promo-carousel"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      data-testid="promotional-carousel"
      data-active-index={activeIndex}
      data-slide-count={totalSlides}
      data-reduced-motion={prefersReducedMotion ? "true" : "false"}
      data-infinite-scroll={hasMultiple && !prefersReducedMotion ? "active" : "paused"}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocused(false);
        }
      }}
      onKeyDown={handleKeyDown}
      onTouchStart={dragHandlers.onTouchStart}
      onTouchMove={dragHandlers.onTouchMove}
      onTouchEnd={dragHandlers.onTouchEnd}
    >
      <div
        ref={viewportRef}
        className={`promo-carousel__viewport${isDragging ? " is-dragging" : ""}`}
        onMouseDown={dragHandlers.onMouseDown}
        onClickCapture={dragHandlers.onClickCapture}
        onWheel={dragHandlers.onWheel}
      >
        <div
          ref={trackRef}
          className="promo-carousel__track promo-carousel__track--continuous"
          data-testid="promotional-carousel-track"
        >
          {renderedSlides.map(({ slide, key, isClone, logicalIdx }) => {
            const imgSrc =
              failedImages[slide.id] ||
              slide.imageUrl ||
              slide.fallbackImageUrl ||
              DEFAULT_CATEGORY_FALLBACK_IMAGE;

            return (
              <article
                key={key}
                className={`promo-carousel__slide promo-carousel__slide--${slide.theme || "navy-teal"}`}
                aria-roledescription="slide"
                aria-label={isClone ? undefined : `${logicalIdx + 1} of ${totalSlides}: ${slide.heading}`}
                aria-hidden={isClone ? "true" : undefined}
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
            onClick={stepPrev}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="promo-carousel__arrow promo-carousel__arrow--next"
            aria-label="Next promotion"
            onClick={stepNext}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>

          <div className="promo-carousel__dots" role="tablist" aria-label="Choose a promotion slide">
            {activeSlides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={idx === activeIndex}
                aria-label={`Show slide ${idx + 1}: ${slide.badge || slide.heading}`}
                className={`promo-carousel__dot${idx === activeIndex ? " is-active" : ""}`}
                onClick={() => goToIndex(idx)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
