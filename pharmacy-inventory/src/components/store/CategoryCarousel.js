import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DEFAULT_CATEGORY_FALLBACK_IMAGE,
  getCategoryImages,
} from "../../data/homepageMedia";
import useInfiniteScrollTrack from "../../hooks/useInfiniteScrollTrack";
import LiveBpMonitorMedia from "./LiveBpMonitorMedia";
import LiveCapsulesMedia from "./LiveCapsulesMedia";

const CARD_GALLERY_INTERVAL_MS = 3500;

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
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);

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

  const visibleCards = getVisibleCardsForWidth(viewportWidth);
  const canScroll = !loading && totalItems > visibleCards;
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
    itemCount: totalItems,
    visibleItems: visibleCards,
    secondsPerItem,
    canScroll,
    paused: isPaused,
    prefersReducedMotion,
  });

  // Duplicate full set once for seamless 0 -> totalItems continuous infinite scroll
  const renderedSlides = useMemo(() => {
    const realSlides = safeCategories.map((category, idx) => ({
      category,
      key: `real-${category.id ?? category.slug ?? idx}`,
      categoryKey: category.id ?? category.slug ?? idx,
      isClone: false,
    }));

    if (!canScroll) return realSlides;

    const cloneSlides = safeCategories.map((category, idx) => ({
      category,
      key: `clone-${idx}-${category.id ?? category.slug ?? idx}`,
      categoryKey: `clone-${category.id ?? category.slug ?? idx}`,
      isClone: true,
    }));

    return [...realSlides, ...cloneSlides];
  }, [safeCategories, canScroll]);

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
                onClick={stepPrev}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="hp-carousel-arrow hp-carousel-arrow--inline"
                aria-label="Next categories"
                onClick={stepNext}
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
          onWheel={dragHandlers.onWheel}
        >
          {canScroll && (
            <button
              type="button"
              className="hp-carousel-arrow hp-carousel-arrow--prev hp-category-carousel__edge-arrow"
              aria-label="Scroll categories left"
              onClick={stepPrev}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          )}

          <div
            ref={viewportRef}
            className={`hp-category-carousel__viewport${isDragging ? " is-dragging" : ""}`}
            data-testid="category-carousel-viewport"
            data-active-index={activeIndex}
            data-visible-cards={visibleCards}
            data-reduced-motion={prefersReducedMotion ? "true" : "false"}
            data-infinite-scroll={canScroll && !prefersReducedMotion ? "active" : "paused"}
            onMouseDown={dragHandlers.onMouseDown}
            onTouchStart={dragHandlers.onTouchStart}
            onTouchMove={dragHandlers.onTouchMove}
            onTouchEnd={dragHandlers.onTouchEnd}
            onClickCapture={dragHandlers.onClickCapture}
          >
            <div
              ref={trackRef}
              className="hp-category-carousel__track hp-category-carousel__track--continuous"
              data-testid="category-carousel-track"
              style={{ "--hp-cat-visible": visibleCards }}
            >
              {renderedSlides.map(({ category, key, categoryKey, isClone }) => {
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
              onClick={stepNext}
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
                  aria-selected={idx === activeIndex}
                  aria-label={`Show ${category.name} category first`}
                  className={`hp-category-carousel__dot${idx === activeIndex ? " is-active" : ""}`}
                  onClick={() => goToIndex(idx)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
