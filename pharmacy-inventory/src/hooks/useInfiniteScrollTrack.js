import { useCallback, useEffect, useRef, useState } from "react";

const DRAG_CLICK_THRESHOLD_PX = 6;
const SWIPE_THRESHOLD_PX = 40;
const GLIDE_DURATION_MS = 480;

function wrapProgress(value, count) {
  if (!count || count <= 0) return 0;
  return ((value % count) + count) % count;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Drives a continuous 60fps infinite horizontal scroll track using requestAnimationFrame
 * with zero per-frame React re-renders, while supporting:
 * - Seamless infinite right-to-left looping (with 2x duplicated slides)
 * - Instant pause on hover, focus, hidden tab, or active drag/swipe
 * - Manual arrows, pagination dots, keyboard nav, mouse dragging, touch swipe, and horizontal wheel
 * - Full prefers-reduced-motion accessibility and clean timer/listener teardown
 */
export default function useInfiniteScrollTrack({
  itemCount = 0,
  visibleItems = 1,
  secondsPerItem = 4,
  canScroll = false,
  paused = false,
  prefersReducedMotion = false,
}) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);

  const progressRef = useRef(0);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const isMouseDragRef = useRef(false);
  const dragStartXRef = useRef(null);
  const dragStartYRef = useRef(null);
  const dragStartProgressRef = useRef(0);
  const dragDeltaXRef = useRef(0);
  const didDragRef = useRef(false);
  const dragResetTimerRef = useRef(null);
  const wheelLockRef = useRef(0);

  // Smooth manual glide animation state: { from, to, startTime, duration }
  const glideRef = useRef(null);
  const pausedRef = useRef(paused);
  const canScrollRef = useRef(canScroll);
  const itemCountRef = useRef(itemCount);
  const visibleItemsRef = useRef(visibleItems);
  const secondsPerItemRef = useRef(secondsPerItem);
  const reducedMotionRef = useRef(prefersReducedMotion);

  pausedRef.current = paused;
  canScrollRef.current = canScroll;
  itemCountRef.current = itemCount;
  visibleItemsRef.current = visibleItems;
  secondsPerItemRef.current = secondsPerItem;
  reducedMotionRef.current = prefersReducedMotion;

  const applyVisualTransform = useCallback((rawProgress, forceIndex = null) => {
    const count = itemCountRef.current;
    const visible = Math.max(1, visibleItemsRef.current);
    const wrapped = canScrollRef.current && count > 0 ? wrapProgress(rawProgress, count) : 0;
    progressRef.current = wrapped;

    if (trackRef.current) {
      const translatePct = (wrapped * 100) / visible;
      trackRef.current.style.transform = `translate3d(-${translatePct}%, 0, 0)`;
    }

    const nextIdx =
      forceIndex !== null
        ? wrapProgress(forceIndex, count)
        : count > 0
          ? Math.floor(wrapProgress(wrapped + 1e-4, count))
          : 0;

    if (nextIdx !== activeIndexRef.current) {
      activeIndexRef.current = nextIdx;
      setActiveIndex(nextIdx);
    }
  }, []);

  // Reset cleanly when item count or scrollability changes
  useEffect(() => {
    glideRef.current = null;
    applyVisualTransform(0, 0);
  }, [itemCount, canScroll, visibleItems, applyVisualTransform]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragResetTimerRef.current) {
        window.clearTimeout(dragResetTimerRef.current);
      }
    };
  }, []);

  // Continuous 60fps infinite scroll + smooth manual glide loop
  useEffect(() => {
    if (!canScroll || itemCount <= 0) {
      applyVisualTransform(0, 0);
      return undefined;
    }

    let rafId = null;
    let lastTimestamp =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    const tick = (timestamp) => {
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : typeof timestamp === "number"
            ? timestamp
            : Date.now();
      // Clamp dt to prevent giant jumps when resuming from background
      const dtSec = Math.min(Math.max(0, (now - lastTimestamp) / 1000), 0.1);
      lastTimestamp = now;

      const count = itemCountRef.current;

      if (glideRef.current) {
        const glide = glideRef.current;
        const elapsed = now - glide.startTime;
        const ratio = Math.min(1, elapsed / glide.duration);
        const eased = easeOutCubic(ratio);
        const interpolated = glide.from + (glide.to - glide.from) * eased;
        applyVisualTransform(interpolated);
        if (ratio >= 1) {
          glideRef.current = null;
        }
      } else if (
        !pausedRef.current &&
        !isDraggingRef.current &&
        !reducedMotionRef.current &&
        secondsPerItemRef.current > 0 &&
        count > 0
      ) {
        const nextProgress = progressRef.current + dtSec / secondsPerItemRef.current;
        applyVisualTransform(nextProgress);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId !== null && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [canScroll, itemCount, applyVisualTransform]);

  const animateToTarget = useCallback(
    (targetUnwrapped, targetLogicalIndex) => {
      const count = itemCountRef.current;
      if (!canScrollRef.current || count <= 0) return;

      const finalLogical = wrapProgress(targetLogicalIndex, count);
      if (reducedMotionRef.current) {
        glideRef.current = null;
        applyVisualTransform(finalLogical, finalLogical);
        return;
      }

      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();

      glideRef.current = {
        from: progressRef.current,
        to: targetUnwrapped,
        startTime: now,
        duration: GLIDE_DURATION_MS,
      };

      // Update active indicator immediately for crisp UI feedback
      if (finalLogical !== activeIndexRef.current) {
        activeIndexRef.current = finalLogical;
        setActiveIndex(finalLogical);
      }
    },
    [applyVisualTransform]
  );

  const stepNext = useCallback(() => {
    const count = itemCountRef.current;
    if (!canScrollRef.current || count <= 0) return;
    const base = glideRef.current ? glideRef.current.to : progressRef.current;
    const target = Math.floor(base + 1e-4) + 1;
    animateToTarget(target, target);
  }, [animateToTarget]);

  const stepPrev = useCallback(() => {
    const count = itemCountRef.current;
    if (!canScrollRef.current || count <= 0) return;
    const base = glideRef.current ? glideRef.current.to : progressRef.current;
    const target = Math.ceil(base - 1e-4) - 1;
    animateToTarget(target, target);
  }, [animateToTarget]);

  const goToIndex = useCallback(
    (targetIdx) => {
      const count = itemCountRef.current;
      if (!canScrollRef.current || count <= 0) return;
      const clamped = wrapProgress(targetIdx, count);
      const current = progressRef.current;
      let delta = clamped - current;
      // Pick shortest wrap path around the ring
      if (delta > count / 2) delta -= count;
      else if (delta < -count / 2) delta += count;
      animateToTarget(current + delta, clamped);
    },
    [animateToTarget]
  );

  const getItemWidthPx = () => {
    const width = viewportRef.current?.clientWidth || 1000;
    return Math.max(120, width / Math.max(1, visibleItemsRef.current));
  };

  const finishDrag = useCallback(() => {
    const deltaX = dragDeltaXRef.current;
    const startProgress = dragStartProgressRef.current;
    isDraggingRef.current = false;
    isMouseDragRef.current = false;
    setIsDragging(false);

    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) {
      if (deltaX < 0) {
        const target = Math.floor(startProgress + 1e-4) + 1;
        animateToTarget(target, target);
      } else {
        const target = Math.ceil(startProgress - 1e-4) - 1;
        animateToTarget(target, target);
      }
    }

    dragStartXRef.current = null;
    dragStartYRef.current = null;
    dragDeltaXRef.current = 0;

    if (didDragRef.current) {
      if (dragResetTimerRef.current) window.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = window.setTimeout(() => {
        didDragRef.current = false;
      }, 60);
    }
  }, [animateToTarget]);

  const settleActiveGlide = useCallback(() => {
    if (!glideRef.current) return;
    const target = wrapProgress(glideRef.current.to, itemCountRef.current);
    glideRef.current = null;
    applyVisualTransform(target, target);
  }, [applyVisualTransform]);

  const handleMouseDown = useCallback((event) => {
    if (!canScrollRef.current || event.button !== 0) return;
    settleActiveGlide();
    isMouseDragRef.current = true;
    isDraggingRef.current = true;
    didDragRef.current = false;
    setIsDragging(true);
    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragStartProgressRef.current = progressRef.current;
    dragDeltaXRef.current = 0;
  }, [settleActiveGlide]);

  useEffect(() => {
    if (!isDragging || !isMouseDragRef.current) return undefined;

    const handleWindowMouseMove = (event) => {
      if (!isMouseDragRef.current || dragStartXRef.current === null) return;
      const deltaX = event.clientX - dragStartXRef.current;
      dragDeltaXRef.current = deltaX;
      if (Math.abs(deltaX) > DRAG_CLICK_THRESHOLD_PX) {
        didDragRef.current = true;
      }
      const deltaItems = -deltaX / getItemWidthPx();
      applyVisualTransform(dragStartProgressRef.current + deltaItems);
    };

    const handleWindowMouseUp = () => {
      if (!isMouseDragRef.current) return;
      finishDrag();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDragging, applyVisualTransform, finishDrag]);

  const handleTouchStart = useCallback((event) => {
    if (!canScrollRef.current || !event.touches || event.touches.length === 0) return;
    settleActiveGlide();
    isDraggingRef.current = true;
    didDragRef.current = false;
    setIsDragging(true);
    dragStartXRef.current = event.touches[0].clientX;
    dragStartYRef.current = event.touches[0].clientY;
    dragStartProgressRef.current = progressRef.current;
    dragDeltaXRef.current = 0;
  }, [settleActiveGlide]);

  const handleTouchMove = useCallback(
    (event) => {
      if (dragStartXRef.current === null || !event.touches || event.touches.length === 0) return;
      const deltaX = event.touches[0].clientX - dragStartXRef.current;
      const deltaY = event.touches[0].clientY - dragStartYRef.current;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        dragDeltaXRef.current = deltaX;
        if (Math.abs(deltaX) > DRAG_CLICK_THRESHOLD_PX) {
          didDragRef.current = true;
        }
        const deltaItems = -deltaX / getItemWidthPx();
        applyVisualTransform(dragStartProgressRef.current + deltaItems);
      }
    },
    [applyVisualTransform]
  );

  const handleTouchEnd = useCallback(() => {
    if (dragStartXRef.current === null) return;
    finishDrag();
  }, [finishDrag]);

  const handleClickCapture = useCallback((event) => {
    if (didDragRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  const handleWheel = useCallback(
    (event) => {
      if (!canScrollRef.current) return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 18) {
        return;
      }
      const now = Date.now();
      if (now - wheelLockRef.current < 300) return;
      wheelLockRef.current = now;
      if (event.deltaX > 0) stepNext();
      else stepPrev();
    },
    [stepNext, stepPrev]
  );

  return {
    viewportRef,
    trackRef,
    activeIndex,
    isDragging,
    stepNext,
    stepPrev,
    goToIndex,
    dragHandlers: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onClickCapture: handleClickCapture,
      onWheel: handleWheel,
    },
  };
}
