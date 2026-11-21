import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import {
  DEFAULT_CATEGORY_FALLBACK_IMAGE,
  getCategoryImages,
} from "../../data/homepageMedia";
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

function CategoryCardMedia({
  category,
  categoryKey,
  isClone = false,
  galleryTick = 0,
  failedSrcMap = {},
  onImgError,
}) {
  const images = getCategoryImages(category);
  const hasGallery = images.length > 1;
  const activeImgIndex = hasGallery ? galleryTick % images.length : 0;
  const slug = category.slug || categoryKey;

  if (!hasGallery) {
    const single = images[0];
    const singleKey = `${categoryKey}-${single.id}`;
    return (
      <div className="hp-category-card__media">
        <img
          src={failedSrcMap[singleKey] || single.src}
          alt=""
          loading="eager"
          decoding="async"
          draggable={false}
          data-testid={isClone ? undefined : `category-img-${slug}`}
          onError={() => onImgError(singleKey)}
        />
      </div>
    );
  }

  return (
    <div
      className="hp-category-card__media hp-category-card__media--gallery"
      data-testid={isClone ? `category-gallery-clone-${slug}` : `category-gallery-${slug}`}
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
            loading="eager"
            decoding="async"
            draggable={false}
            className={`hp-category-card__slide-img${isActive ? " is-active" : ""}`}
            data-testid={isClone ? undefined : `category-img-${slug}-${item.id}`}
            data-active={isActive ? "true" : "false"}
            onError={() => onImgError(imgKey)}
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
  const [galleryTick, setGalleryTick] = useState(0);
  const [failedSrcMap, setFailedSrcMap] = useState({});

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
  const canAnimate = canScroll && !prefersReducedMotion && autoPlayInterval > 0;
  const isPaused = isHovered || isFocused || isTabHidden;

  // Shared gallery tick keeps real cards and cloned seam cards 100% image-synced
  useEffect(() => {
    if (loading || totalItems === 0 || isPaused || prefersReducedMotion) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setGalleryTick((prev) => prev + 1);
    }, CARD_GALLERY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loading, totalItems, isPaused, prefersReducedMotion]);

  const handleImgError = (imgKey) => {
    setFailedSrcMap((prev) => {
      if (prev[imgKey] === DEFAULT_CATEGORY_FALLBACK_IMAGE) return prev;
      return { ...prev, [imgKey]: DEFAULT_CATEGORY_FALLBACK_IMAGE };
    });
  };

  const totalDurationSec = canAnimate ? (totalItems * autoPlayInterval) / 1000 : 0;

  const trackStyle = canAnimate
    ? {
        "--hp-cat-visible": visibleCards,
        "--hp-cat-count": totalItems,
        "--hp-cat-duration": `${totalDurationSec}s`,
        animationPlayState: isPaused ? "paused" : "running",
      }
    : {
        "--hp-cat-visible": visibleCards,
      };

  const renderCategoryItem = (category, idx, isClone) => {
    const baseKey = category.id ?? category.slug ?? idx;
    const slugParam = encodeURIComponent(category.slug || category.name || "");

    return (
      <div
        key={isClone ? `clone-${idx}-${baseKey}` : `real-${baseKey}`}
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
            categoryKey={baseKey}
            isClone={isClone}
            galleryTick={galleryTick}
            failedSrcMap={failedSrcMap}
            onImgError={handleImgError}
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
  };

  return (
    <section
      className={`hp-categories hp-categories--lenco${isPaused ? " is-paused" : ""}`}
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
        <div className={`hp-category-carousel__shell${canAnimate ? " is-scrollable" : ""}`}>
          <div
            className="hp-category-carousel__viewport"
            data-testid="category-carousel-viewport"
            data-visible-cards={visibleCards}
            data-reduced-motion={prefersReducedMotion ? "true" : "false"}
            data-infinite-scroll={canAnimate ? "active" : "paused"}
            data-paused={isPaused ? "true" : "false"}
          >
            <div
              className={`hp-category-carousel__track${canAnimate ? " hp-category-carousel__track--marquee" : ""}`}
              data-testid="category-carousel-track"
              style={trackStyle}
            >
              <div className="hp-category-carousel__group" data-testid="category-carousel-group-primary">
                {safeCategories.map((category, idx) => renderCategoryItem(category, idx, false))}
              </div>
              {canAnimate && (
                <div
                  className="hp-category-carousel__group"
                  aria-hidden="true"
                  data-clone="true"
                  data-testid="category-carousel-group-clone"
                >
                  {safeCategories.map((category, idx) => renderCategoryItem(category, idx, true))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
