import React, { useId } from "react";

// Six realistic orange-and-white capsules tumbling out of the open prescription bottle
// mouth (located around x=855..885, y=470..620 in the 1200x800 photo coordinate space)
const ANIMATED_CAPSULES = [
  { id: "cap-1", variantClass: "hp-cap-anim--1", scale: 1.02 },
  { id: "cap-2", variantClass: "hp-cap-anim--2", scale: 0.96 },
  { id: "cap-3", variantClass: "hp-cap-anim--3", scale: 1.05 },
  { id: "cap-4", variantClass: "hp-cap-anim--4", scale: 0.94 },
  { id: "cap-5", variantClass: "hp-cap-anim--5", scale: 1.0 },
  { id: "cap-6", variantClass: "hp-cap-anim--6", scale: 0.92 },
];

// Photorealistic 3D-shaded orange-and-white gelatin capsule centered at (0, 0),
// matching the color, gloss, seam, and lighting of the real capsules in the photo.
function RealisticCapsule({ orangeGradId, whiteGradId, glossGradId, shadowFilterId, scale = 1 }) {
  return (
    <g transform={`scale(${scale})`}>
      {/* Soft warm shadow cast onto the orange tabletop */}
      <ellipse
        cx="-5"
        cy="13"
        rx="44"
        ry="15"
        fill="#a84308"
        opacity="0.34"
        filter={`url(#${shadowFilterId})`}
      />

      {/* Capsule body: right half white, left half vivid pharmacy orange */}
      <g>
        {/* White lower-shell half */}
        <path
          d="M-2,-17 L28,-17 A17,17 0 0 1 28,17 L-2,17 Z"
          fill={`url(#${whiteGradId})`}
        />
        {/* Orange outer-cap half (slightly wider by 0.8px like real gelatin cap) */}
        <path
          d="M-28,-17.8 L2,-17.8 L2,17.8 L-28,17.8 A17.8,17.8 0 0 1 -28,-17.8 Z"
          fill={`url(#${orangeGradId})`}
        />
        {/* Subtle cap-over-body seam shadow */}
        <line
          x1="2"
          y1="-17.5"
          x2="2"
          y2="17.5"
          stroke="#9e2a00"
          strokeWidth="1.4"
          opacity="0.35"
        />
        {/* Glossy curved studio reflection along the top ridge */}
        <rect
          x="-35"
          y="-12.5"
          width="70"
          height="6.2"
          rx="3.1"
          fill={`url(#${glossGradId})`}
          opacity="0.72"
        />
        {/* Subtle bottom bounce-light rim */}
        <rect
          x="-30"
          y="10.5"
          width="58"
          height="2.8"
          rx="1.4"
          fill="#ffd1a8"
          opacity="0.28"
        />
      </g>
    </g>
  );
}

export default function LiveCapsulesMedia({
  src = "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
  alt = "Pharmacist organizing verified prescription medications",
  className = "",
  isActive = true,
  decorative = false,
  testId = "live-capsules-media",
}) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const orangeGradId = `capOrange-${safeId}`;
  const whiteGradId = `capWhite-${safeId}`;
  const glossGradId = `capGloss-${safeId}`;
  const shadowFilterId = `capShadow-${safeId}`;
  const mouthClipId = `capMouthClip-${safeId}`;

  return (
    <svg
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      className={`hp-capsules-live-svg ${isActive ? "is-playing" : "is-paused"} ${className}`.trim()}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? "true" : undefined}
      data-testid={testId}
      data-src={src}
      data-active={isActive ? "true" : "false"}
      data-playing={isActive ? "true" : "false"}
    >
      <defs>
        <linearGradient id={orangeGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ff7c38" />
          <stop offset="38%" stopColor="#f95716" />
          <stop offset="78%" stopColor="#d93c06" />
          <stop offset="100%" stopColor="#a62800" />
        </linearGradient>

        <linearGradient id={whiteGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="52%" stopColor="#f3f1ef" />
          <stop offset="85%" stopColor="#dad4ce" />
          <stop offset="100%" stopColor="#bfb7af" />
        </linearGradient>

        <linearGradient id={glossGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="75%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>

        <filter id={shadowFilterId} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="5.5" />
        </filter>

        {/* Clip right edge along the bottle's open translucent rim so capsules emerge from inside the bottle */}
        <clipPath id={mouthClipId}>
          <polygon points="0,0 892,0 892,430 858,695 835,800 0,800" />
        </clipPath>
      </defs>

      {/* Base prescription bottle & capsules photo */}
      <image href={src} x="0" y="0" width="1200" height="800" preserveAspectRatio="none" />

      {/* Live tumbling capsules spilling smoothly out of the open container */}
      <g clipPath={`url(#${mouthClipId})`}>
        {ANIMATED_CAPSULES.map((capsule) => (
          <g
            key={capsule.id}
            className={`hp-cap-anim ${capsule.variantClass}`}
            data-testid={`${testId}-${capsule.id}`}
          >
            <RealisticCapsule
              orangeGradId={orangeGradId}
              whiteGradId={whiteGradId}
              glossGradId={glossGradId}
              shadowFilterId={shadowFilterId}
              scale={capsule.scale}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
