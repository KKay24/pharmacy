import React, { useEffect, useRef } from "react";

export const DEFAULT_BP_MONITOR_VIDEO_SRC = "/videos/blood-pressure-monitor.mp4";
const DEFAULT_BP_MONITOR_POSTER_SRC = "/images/medical-devices/blood-pressure-monitor.jpg";

export default function LiveBpMonitorMedia({
  src = DEFAULT_BP_MONITOR_VIDEO_SRC,
  poster = DEFAULT_BP_MONITOR_POSTER_SRC,
  alt = "Automatic digital blood pressure monitor taking a live reading",
  className = "",
  isActive = true,
  decorative = false,
  testId = "live-bp-monitor",
  onError,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ensure muted property is explicitly set on the DOM node for browser autoplay policies
    video.muted = true;
    video.defaultMuted = true;

    if (isActive) {
      if (typeof video.play === "function") {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      }
    } else if (typeof video.pause === "function") {
      video.pause();
    }
  }, [isActive, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      draggable={false}
      className={`hp-bp-live-video ${isActive ? "is-playing" : "is-paused"} ${className}`.trim()}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? "true" : undefined}
      data-testid={testId}
      data-src={src}
      data-active={isActive ? "true" : "false"}
      data-playing={isActive ? "true" : "false"}
      onError={onError}
    />
  );
}
