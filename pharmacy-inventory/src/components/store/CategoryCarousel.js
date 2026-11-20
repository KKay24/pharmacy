import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DEFAULT_CATEGORY_FALLBACK_IMAGE,
  getCategoryImages,
} from "../../data/homepageMedia";
import LiveBpMonitorMedia from "./LiveBpMonitorMedia";
import LiveCapsulesMedia from "./LiveCapsulesMedia";

const SWIPE_THRESHOLD_PX = 40;
const DRAG_CLICK_THRESHOLD_PX = 6;
const CARD_GALLERY_INTERVAL_MS = 3500;
const SLIDE_TRANSITION_MS = 560;

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

function CategoryCardMedia({ category, categoryKey, isClone = false, prefersReducedMotion = false }) {
  const images = getCategoryImages(category);
  const hasGallery = images.length > 1;
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [failedSrcMap, setFailedSrcMap] = useState({});

  useEffect(() => {
    if (!hasGallery || isCardHovered || prefersReducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setActiveImgIndex((prev) => (prev + 1) % images.length);
    }, CARD_GALLERY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasGallery, isCardHovered, prefersReducedMotion, images.length]);

  const handleImgError = (imgKey) => {
    setFailedSrcMap((prev) => {
      if (prev[imgKey] === DEFAULT_CATEGORY_FALLBACK_IMAGE) return prev;
      return { ...prev, [imgKey]: DEFAULT_CATEGORY_FALLBACK_IMAGE };
    });
  };

  const slug = category.slug || categoryKey;

  if (!hasGallery) {
    const single = images[0];
    const singleKey = `${categoryKey}-${single.id}`;
    return (
      <div className="hp-category-card__media">
        <img
          src={failedSrcMap[singleKey] || single.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          data-testid={isClone ? undefined : `category-img-${slug}`}
          onError={() => handleImgError(singleKey)}
        />
      </div>
    );
  }

  return (
    <div
      className="hp-category-card__media hp-category-card__media--gallery"
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      data-testid={isClone ? undefined : `category-gallery-${slug}`}
      data-active-image={activeImgIndex}
    >
      {images.map((item, idx) => {
        const imgKey = `${categoryKey}-${item.id}`;
        const isActive = idx === activeImgIndex;
        if (item.mediaType === "live-bp-monitor" && !failedSrcMap[imgKey]) {
          return (
            <LiveBpMonitorMedia
              key={item.id}
              src={item.src}
              decorative
              isActive={isActive}
              className={`hp-category-card__slide-img${isActive ? " is-active" : ""}`}
              testId={isClone ? undefined : `category-img-${slug}-${item.id}`}
            />
          );
        }
        if (item.mediaType === "live-capsules" && !failedSrcMap[imgKey]) {
          return (
            <LiveCapsulesMedia
              key={item.id}
              src={item.src}
              decorative
              isActive={isActive}
              className={`hp-category-card__slide-img${isActive ? " is-active" : ""}`}
              testId={isClone ? undefined : `category-img-${slug}-${item.id}`}
            />
          );
        }
        return (
          <img
            key={item.id}
            src={failedSrcMap[imgKey] || item.src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className={`hp-category-card__slide-img${isActive ? " is-active" : ""}`}
            data-testid={isClone ? undefined : `category-img-${slug}-${item.id}`}
            data-active={isActive ? "true" : "false"}
            onError={() => handleImgError(imgKey)}
          />
        );
      })}
    </div>
  );
}

/**
 * Responsive card counts:
 * - Wide desktop (>= 1200px): 5 cards
 * - Desktop (1024px - 1199px): 4 cards
 * - Tablet (640px - 1023px): 3 cards
 * - Mobile (< 640px): 2 cards
 */
function getVisibleCardsForWidth(width) {
  if (width >= 1200) return 5;
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

export default function CategoryCarousel({
  categories = [],
  loading = false,
  error = "",
  onRetry,
  autoPlayInterval = 3500,
}) {
  const safeCategories = useMemo(
    () => (Array.isArray(categories) ? categories : []),
    [categories]
  );
  const totalItems = safeCategories.length;
  const prefersReducedMotion = usePrefersReducedMotion();

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const visibleCards = getVisibleCardsForWidth(viewportWidth);
  const canScroll = totalItems > visibleCards;
  const cloneCount = canScroll ? Math.min(visibleCards, totalItems) : 0;

  const [trackIndex, setTrackIndex] = useState(cloneCount);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isTabHidden, setIsTabHidden] = useState(false);

  const interactionResumeRef = useRef(null);
  const snapFallbackTimerRef = useRef(null);
  const wheelLockRef = useRef(0);
  const dragStartXRef = useRef(null);
  const dragStartYRef = useRef(null);
  const dragDeltaXRef = useRef(0);
  const didDragRef = useRef(false);
  const isMouseDragActiveRef = useRef(false);

  // Sync trackIndex cleanly when category count or responsive visibleCards changes
  useEffect(() => {
    setIsTransitioning(false);
    setTrackIndex(cloneCount);
  }, [cloneCount, totalItems]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => {
      setIsTabHidden(document.visibilityState === "hidden");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

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
      if (snapFallbackTimerRef.current) {
        window.clearTimeout(snapFallbackTimerRef.current);
      }
    };
  }, []);

  // Re-enable smooth CSS transition after an invisible loop snap
  useEffect(() => {
    if (isTransitioning || prefersReducedMotion) return undefined;
    const id = window.requestAnimationFrame
      ? window.requestAnimationFrame(() => setIsTransitioning(true))
      : window.setTimeout(() => setIsTransitioning(true), 16);
    return () => {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(id);
      else window.clearTimeout(id);
    };
  }, [isTransitioning, prefersReducedMotion]);

  const snapIfInCloneZone = useCallback(() => {
    if (!canScroll || totalItems === 0) return;
    setTrackIndex((current) => {
      if (current >= cloneCount + totalItems) {
        setIsTransitioning(false);
        return current - totalItems;
      }
      if (current < cloneCount) {
        setIsTransitioning(false);
        return current + totalItems;
      }
      return current;
    });
  }, [canScroll, cloneCount, totalItems]);

  // Fallback snap timer in case CSS transitionend doesn't fire (e.g. reduced motion or background)
  useEffect(() => {
    if (!canScroll) return undefined;
    const inCloneZone = trackIndex >= cloneCount + totalItems || trackIndex < cloneCount;
    if (!inCloneZone) return undefined;

    if (snapFallbackTimerRef.current) {
      window.clearTimeout(snapFallbackTimerRef.current);
    }
    snapFallbackTimerRef.current = window.setTimeout(
      snapIfInCloneZone,
      prefersReducedMotion ? 0 : SLIDE_TRANSITION_MS + 40
    );

    return () => {
      if (snapFallbackTimerRef.current) {
        window.clearTimeout(snapFallbackTimerRef.current);
      }
    };
  }, [canScroll, trackIndex, cloneCount, totalItems, prefersReducedMotion, snapIfInCloneZone]);

  const stepBy = useCallback(
    (delta, fromUser = false) => {
      if (!canScroll || totalItems === 0) return;
      if (fromUser) pauseBrieflyAfterInteraction();
      setIsTransitioning(!prefersReducedMotion);
      setTrackIndex((prev) => {
        let normalized = prev;
        if (normalized >= cloneCount + totalItems) normalized -= totalItems;
        else if (normalized < cloneCount) normalized += totalItems;
        return normalized + delta;
      });
    },
    [canScroll, totalItems, cloneCount, pauseBrieflyAfterInteraction, prefersReducedMotion]
  );

  const stepNext = useCallback((fromUser = false) => stepBy(1, fromUser), [stepBy]);
  const stepPrev = useCallback((fromUser = false) => stepBy(-1, fromUser), [stepBy]);

  const goToLogicalIndex = useCallback(
    (targetIdx) => {
      if (!canScroll || totalItems === 0) return;
      pauseBrieflyAfterInteraction();
      setIsTransitioning(!prefersReducedMotion);
      setTrackIndex(cloneCount + (targetIdx % totalItems));
    },
    [canScroll, totalItems, cloneCount, pauseBrieflyAfterInteraction, prefersReducedMotion]
  );

  const isPaused =
    isHovered || isFocused || isInteracting || isDragging || isTabHidden || prefersReducedMotion;

  // Continuous smooth autoplay every 3.5 seconds (default) with seamless infinite looping
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
      stepNext(false);
    }, autoPlayInterval);

    return () => window.clearInterval(timer);
  }, [loading, canScroll, isPaused, autoPlayInterval, stepNext]);

  // Finish drag or swipe gesture
  const finishDragGesture = useCallback(() => {
    const deltaX = dragDeltaXRef.current;
    setIsDragging(false);
    setDragOffsetPx(0);

    if (deltaX <= -SWIPE_THRESHOLD_PX) {
      stepNext(true);
    } else if (deltaX >= SWIPE_THRESHOLD_PX) {
      stepPrev(true);
    } else {
      pauseBrieflyAfterInteraction();
    }

    dragStartXRef.current = null;
    dragStartYRef.current = null;
    dragDeltaXRef.current = 0;
    isMouseDragActiveRef.current = false;

    if (didDragRef.current) {
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 60);
    }
  }, [stepNext, stepPrev, pauseBrieflyAfterInteraction]);

  // Touch swipe handlers
  const handleTouchStart = (event) => {
    if (!canScroll || !event.touches || event.touches.length === 0) return;
    setIsInteracting(true);
    setIsDragging(true);
    didDragRef.current = false;
    dragStartXRef.current = event.touches[0].clientX;
    dragStartYRef.current = event.touches[0].clientY;
    dragDeltaXRef.current = 0;
    setDragOffsetPx(0);
  };

  const handleTouchMove = (event) => {
    if (dragStartXRef.current === null || !event.touches || event.touches.length === 0) {
      return;
    }
    const deltaX = event.touches[0].clientX - dragStartXRef.current;
    const deltaY = event.touches[0].clientY - dragStartYRef.current;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      dragDeltaXRef.current = deltaX;
      if (Math.abs(deltaX) > DRAG_CLICK_THRESHOLD_PX) {
        didDragRef.current = true;
      }
      setDragOffsetPx(Math.max(-280, Math.min(280, deltaX)));
    }
  };

  const handleTouchEnd = () => {
    if (dragStartXRef.current === null) return;
    finishDragGesture();
  };

  // Mouse drag handlers
  const handleMouseDown = (event) => {
    if (!canScroll || event.button !== 0) return;
    isMouseDragActiveRef.current = true;
    didDragRef.current = false;
    setIsInteracting(true);
    setIsDragging(true);
    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragDeltaXRef.current = 0;
    setDragOffsetPx(0);
  };

  useEffect(() => {
    if (!isDragging || !isMouseDragActiveRef.current) return undefined;

    const handleWindowMouseMove = (event) => {
      if (!isMouseDragActiveRef.current || dragStartXRef.current === null) return;
      const deltaX = event.clientX - dragStartXRef.current;
      dragDeltaXRef.current = deltaX;
      if (Math.abs(deltaX) > DRAG_CLICK_THRESHOLD_PX) {
        didDragRef.current = true;
      }
      setDragOffsetPx(Math.max(-280, Math.min(280, deltaX)));
    };

    const handleWindowMouseUp = () => {
      if (!isMouseDragActiveRef.current) return;
      finishDragGesture();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDragging, finishDragGesture]);

  const handleClickCapture = (event) => {
    if (didDragRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
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

  const extendedSlides = useMemo(() => {
    if (!canScroll) {
      return safeCategories.map((category, idx) => ({
        category,
        key: `real-${category.id ?? category.slug ?? idx}`,
        categoryKey: category.id ?? category.slug ?? idx,
        isClone: false,
      }));
    }

    const tailClones = safeCategories.slice(-cloneCount).map((category, idx) => ({
      category,
      key: `tail-clone-${idx}-${category.id ?? category.slug ?? idx}`,
      categoryKey: `tail-${category.id ?? category.slug ?? idx}`,
      isClone: true,
    }));

    const realSlides = safeCategories.map((category, idx) => ({
      category,
      key: `real-${category.id ?? category.slug ?? idx}`,
      categoryKey: category.id ?? category.slug ?? idx,
      isClone: false,
    }));

    const headClones = safeCategories.slice(0, cloneCount).map((category, idx) => ({
      category,
      key: `head-clone-${idx}-${category.id ?? category.slug ?? idx}`,
      categoryKey: `head-${category.id ?? category.slug ?? idx}`,
      isClone: true,
    }));

    return [...tailClones, ...realSlides, ...headClones];
  }, [safeCategories, canScroll, cloneCount]);

  const logicalIndex =
    totalItems > 0
      ? (((trackIndex - cloneCount) % totalItems) + totalItems) % totalItems
      : 0;

  const baseTranslatePercent = canScroll ? (trackIndex * 100) / visibleCards : 0;
  const trackTransform = isDragging && dragOffsetPx !== 0
    ? `translate3d(calc(-${baseTranslatePercent}% + ${dragOffsetPx}px), 0, 0)`
    : `translate3d(-${baseTranslatePercent}%, 0, 0)`;

  return (
    <section
      className="hp-categories hp-categories--lenco"
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
          <Link to="/shop" className="hp-category-carousel__all-link">
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
          className={`hp-category-carousel__shell${canScroll ? " is-scrollable" : ""}`}
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
            className={`hp-category-carousel__viewport${isDragging ? " is-dragging" : ""}`}
            data-testid="category-carousel-viewport"
            data-active-index={logicalIndex}
            data-visible-cards={visibleCards}
            data-reduced-motion={prefersReducedMotion ? "true" : "false"}
            onMouseDown={handleMouseDown}
            onClickCapture={handleClickCapture}
          >
            <div
              className={`hp-category-carousel__track${
                !isTransitioning || isDragging || prefersReducedMotion ? " is-instant" : ""
              }`}
              data-testid="category-carousel-track"
              style={{
                "--hp-cat-visible": visibleCards,
                transform: trackTransform,
              }}
              onTransitionEnd={snapIfInCloneZone}
            >
              {extendedSlides.map(({ category, key, categoryKey, isClone }) => {
                const slugParam = encodeURIComponent(category.slug || category.name || "");

                return (
                  <div
                    key={key}
                    className="hp-category-carousel__item"
                    aria-hidden={isClone ? "true" : undefined}
                    data-clone={isClone ? "true" : undefined}
                  >
                    <Link
                      to={`/shop?category=${slugParam}`}
                      className="hp-category-card"
                      tabIndex={isClone ? -1 : undefined}
                      draggable={false}
                    >
                      <CategoryCardMedia
                        category={category}
                        categoryKey={categoryKey}
                        isClone={isClone}
                        prefersReducedMotion={prefersReducedMotion}
                      />
                      <span className="hp-category-card__footer">
                        <span className="hp-category-card__name">{category.name}</span>
                        <span className="hp-category-card__arrow" aria-hidden="true">
                          <ChevronRight size={15} />
                        </span>
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

          {canScroll && totalItems > 1 && (
            <div className="hp-category-carousel__dots" role="tablist" aria-label="Category carousel position">
              {safeCategories.map((category, idx) => (
                <button
                  key={category.id ?? category.slug ?? idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === logicalIndex}
                  aria-label={`Show ${category.name} category first`}
                  className={`hp-category-carousel__dot${idx === logicalIndex ? " is-active" : ""}`}
                  onClick={() => goToLogicalIndex(idx)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
