import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import {
  DEFAULT_CATEGORY_FALLBACK_IMAGE,
  getCategoryImages,
} from "../../data/homepageMedia";
import LiveBpMonitorMedia from "./LiveBpMonitorMedia";
import LiveCapsulesMedia from "./LiveCapsulesMedia";
import LiveVideoMedia from "./LiveVideoMedia";

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
  failedSrcMap = {},
  onImgError,
}) {
  const images = getCategoryImages(category);
  const primary =
    images.find(
      (item) =>
        item.mediaType === "live-capsules" ||
        item.mediaType === "live-bp-monitor" ||
        item.mediaType === "live-video"
    ) || images[0];
  const slug = category.slug || categoryKey;
  const mediaKey = `${categoryKey}-${primary.id}`;
  const testId = isClone ? undefined : `category-img-${slug}`;

  return (
    <div className="hp-category-card__media">
      {primary.mediaType === "live-bp-monitor" && !failedSrcMap[mediaKey] ? (
        <LiveBpMonitorMedia
          src={primary.src}
          decorative
          isActive
          testId={testId}
          onError={() => onImgError(mediaKey)}
        />
      ) : primary.mediaType === "live-capsules" && !failedSrcMap[mediaKey] ? (
        <LiveCapsulesMedia
          src={primary.src}
          decorative
          isActive
          testId={testId}
          onError={() => onImgError(mediaKey)}
        />
      ) : primary.mediaType === "live-video" && !failedSrcMap[mediaKey] ? (
        <LiveVideoMedia
          src={primary.src}
          poster={primary.poster}
          decorative
          isActive
          testId={testId}
          onError={() => onImgError(mediaKey)}
        />
      ) : (
        <img
          src={failedSrcMap[mediaKey] || primary.src}
          alt=""
          loading="eager"
          decoding="async"
          draggable={false}
          data-testid={testId}
          onError={() => onImgError(mediaKey)}
        />
      )}
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
