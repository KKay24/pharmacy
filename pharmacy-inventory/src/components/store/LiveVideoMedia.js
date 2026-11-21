import React, { useEffect, useRef } from "react";

export default function LiveVideoMedia({
  src,
  poster,
  alt = "",
  className = "",
  isActive = true,
  decorative = false,
  testId,
  onError,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
      className={`hp-live-video ${isActive ? "is-playing" : "is-paused"} ${className}`.trim()}
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
