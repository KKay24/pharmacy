import React, { useEffect, useRef } from "react";

export const DEFAULT_CAPSULES_VIDEO_SRC = "/videos/prescription-capsules.mp4";
const DEFAULT_CAPSULES_POSTER_SRC = "/images/medicines/capsules-vial.jpg";

export default function LiveCapsulesMedia({
  src = DEFAULT_CAPSULES_VIDEO_SRC,
  poster = DEFAULT_CAPSULES_POSTER_SRC,
  alt = "Pharmacist organizing verified prescription medications",
  className = "",
  isActive = true,
  decorative = false,
  testId = "live-capsules-media",
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
      className={`hp-capsules-live-video ${isActive ? "is-playing" : "is-paused"} ${className}`.trim()}
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
