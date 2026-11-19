import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DEFAULT_CATEGORY_FALLBACK_IMAGE,
  getCategoryImage,
} from "../../data/homepageMedia";

const SWIPE_THRESHOLD_PX = 35;

function getVisibleCardsForWidth(width, totalItems) {
  if (width >= 1400) {
    // Show 6 cards on ultra-wide screens when >6 categories exist, or 5 when exactly 6 exist
    // so the carousel remains interactive and autoplays smoothly.
    return totalItems === 6 ? 5 : 6;
  }
  if (width >= 1024) return 5;
  if (width >= 820) return 4;
  if (width > 650) return 3;
  return 2;
}

export default function CategoryCarousel({
  categories = [],
  loading = false,
  error = "",
  onRetry,
  autoPlayInterval = 5000,
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const totalItems = safeCategories.length;

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [startIndex, setStartIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  const interactionResumeRef = useRef(null);
  const wheelLockRef = useRef(0);
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const touchDeltaXRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const visibleCards = getVisibleCardsForWidth(viewportWidth, totalItems);
  const maxIndex = Math.max(0, totalItems - visibleCards);
  const canScroll = totalItems > visibleCards;

  useEffect(() => {
    if (startIndex > maxIndex) {
      setStartIndex(maxIndex);
    }
  }, [maxIndex, startIndex]);

  const pauseBrieflyAfterInteraction = useCallback(() => {
    setIsInteracting(true);
    if (interactionResumeRef.current) {
      window.clearTimeout(interactionResumeRef.current);
    }
    interactionResumeRef.current = window.setTimeout(() => {
      setIsInteracting(false);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (interactionResumeRef.current) {
        window.clearTimeout(interactionResumeRef.current);
      }
    };
  }, []);

  const stepNext = useCallback(
    (fromUser = false) => {
      if (!canScroll) return;
      if (fromUser) pauseBrieflyAfterInteraction();
      setStartIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    },
    [canScroll, maxIndex, pauseBrieflyAfterInteraction]
  );

  const stepPrev = useCallback(
    (fromUser = false) => {
      if (!canScroll) return;
      if (fromUser) pauseBrieflyAfterInteraction();
      setStartIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
    },
    [canScroll, maxIndex, pauseBrieflyAfterInteraction]
  );

  const isPaused = isHovered || isFocused || isInteracting;

  // Independent 5-second autoplay timer with smooth looping back to start
  useEffect(() => {
    if (
      loading ||
      !canScroll ||
      isPaused ||
      !autoPlayInterval ||
      autoPlayInterval <= 0
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setStartIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, autoPlayInterval);

    return () => window.clearInterval(timer);
  }, [loading, canScroll, isPaused, autoPlayInterval, maxIndex]);

  const handleTouchStart = (event) => {
    if (!event.touches || event.touches.length === 0) return;
    setIsInteracting(true);
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
      stepNext(true);
    } else if (touchDeltaXRef.current >= SWIPE_THRESHOLD_PX) {
      stepPrev(true);
    } else {
      pauseBrieflyAfterInteraction();
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchDeltaXRef.current = 0;
  };

  const handleWheel = (event) => {
    if (!canScroll) return;
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 18) {
      return;
    }
    const now = Date.now();
    if (now - wheelLockRef.current < 350) return;
    wheelLockRef.current = now;
    if (event.deltaX > 0) {
      stepNext(true);
    } else {
      stepPrev(true);
    }
  };

  const handleImageError = (categoryKey) => {
    setFailedImages((prev) => {
      if (prev[categoryKey] === DEFAULT_CATEGORY_FALLBACK_IMAGE) return prev;
      return { ...prev, [categoryKey]: DEFAULT_CATEGORY_FALLBACK_IMAGE };
    });
  };

  const totalPositions = maxIndex + 1;

  return (
    <section
      className="hp-categories"
      id="categories"
      aria-roledescription="carousel"
      aria-label="Shop by Category"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocused(false);
        }
      }}
    >
      <div className="hp-section-heading hp-category-carousel__header">
        <div>
          <h2>Shop by Category</h2>
          {!loading && totalItems > 0 && (
            <p className="hp-category-carousel__subtitle">
              Explore all {totalItems} pharmacy categories
            </p>
          )}
        </div>
        <div className="hp-category-carousel__controls">
          {!loading && canScroll && (
            <div className="hp-category-carousel__arrows">
              <button
                type="button"
                className="hp-carousel-arrow hp-carousel-arrow--inline"
                aria-label="Previous categories"
                onClick={() => stepPrev(true)}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="hp-carousel-arrow hp-carousel-arrow--inline"
                aria-label="Next categories"
                onClick={() => stepNext(true)}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
          <Link to="/shop">
            View all products <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="hp-catalog-error" role="alert">
          {error}{" "}
          {onRetry && (
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div
          className="hp-category-carousel__skeletons"
          style={{ "--hp-cat-visible": visibleCards }}
          aria-busy="true"
        >
          {Array.from({ length: visibleCards }, (_, idx) => (
            <div key={idx} className="hp-category-card hp-category-card--skeleton" aria-hidden="true">
              <div className="hp-category-card__img-skeleton" />
              <div className="hp-category-card__label-skeleton" />
            </div>
          ))}
          <span className="hp-sr-only">Loading pharmacy categories…</span>
        </div>
      ) : !error && totalItems === 0 ? (
        <p className="hp-empty-state">No product categories have been added yet.</p>
      ) : totalItems > 0 ? (
        <div
          className="hp-category-carousel__shell"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {canScroll && (
            <button
              type="button"
              className="hp-carousel-arrow hp-carousel-arrow--prev hp-category-carousel__edge-arrow"
              aria-label="Scroll categories left"
              onClick={() => stepPrev(true)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          )}

          <div
            className="hp-category-carousel__viewport"
            data-testid="category-carousel-viewport"
            data-active-index={startIndex}
            data-visible-cards={visibleCards}
            onPointerDown={pauseBrieflyAfterInteraction}
          >
            <div
              className="hp-category-carousel__track"
              style={{
                "--hp-cat-visible": visibleCards,
                transform: `translate3d(-${(startIndex * 100) / visibleCards}%, 0, 0)`,
              }}
            >
              {safeCategories.map((category, index) => {
                const key = category.id ?? category.slug ?? index;
                const imageSrc = failedImages[key] || getCategoryImage(category);
                const slugParam = encodeURIComponent(category.slug || category.name || "");

                return (
                  <div key={key} className="hp-category-carousel__item">
                    <Link
                      to={`/shop?category=${slugParam}`}
                      className="hp-category-card"
                    >
                      <div className="hp-category-card__media">
                        <img
                          src={imageSrc}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          data-testid={`category-img-${category.slug || key}`}
                          onError={() => handleImageError(key)}
                        />
                      </div>
                      <span className="hp-category-card__footer">
                        <span className="hp-category-card__name">{category.name}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {canScroll && (
            <button
              type="button"
              className="hp-carousel-arrow hp-carousel-arrow--next hp-category-carousel__edge-arrow"
              aria-label="Scroll categories right"
              onClick={() => stepNext(true)}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}

          {canScroll && totalPositions > 1 && (
            <div className="hp-category-carousel__dots" role="tablist" aria-label="Category carousel position">
              {Array.from({ length: totalPositions }, (_, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === startIndex}
                  aria-label={`Show categories starting at position ${idx + 1}`}
                  className={`hp-category-carousel__dot${idx === startIndex ? " is-active" : ""}`}
                  onClick={() => {
                    pauseBrieflyAfterInteraction();
                    setStartIndex(idx);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
