import React, { useEffect, useId, useState } from "react";

// Exact 7-segment display bitmasks: [top, topRight, bottomRight, bottom, bottomLeft, topLeft, middle]
const SEGMENT_MAP = {
  "0": [1, 1, 1, 1, 1, 1, 0],
  "1": [0, 1, 1, 0, 0, 0, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "3": [1, 1, 1, 1, 0, 0, 1],
  "4": [0, 1, 1, 0, 0, 1, 1],
  "5": [1, 0, 1, 1, 0, 1, 1],
  "6": [1, 0, 1, 1, 1, 1, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
  "-": [0, 0, 0, 0, 0, 0, 1],
  " ": [0, 0, 0, 0, 0, 0, 0],
};

// Realistic healthy resting readings cycled across measurements
const SETTLED_READINGS = [
  { sys: 120, dia: 80, pulse: 72 },
  { sys: 118, dia: 76, pulse: 70 },
  { sys: 122, dia: 78, pulse: 74 },
];

// Realistic blood-pressure measurement sequence:
// 1. Inflating cuff pressure (0 -> 166 mmHg) with inflation arrow
// 2. Deflating / measuring (162 -> target) with pulsing heartbeat indicator
// 3. Settled final reading (SYS / DIA / PULSE) held cleanly before next reading
function buildMeasurementFrames(target) {
  const frames = [];

  // Phase 1: Inflating cuff pressure (~1.35s across 9 steps @ 150ms)
  const inflateSteps = [18, 42, 68, 94, 118, 140, 156, 166, 170];
  for (let i = 0; i < inflateSteps.length; i += 1) {
    frames.push({
      phase: "inflating",
      sys: String(inflateSteps[i]),
      dia: "--",
      pulse: "--",
      heartOn: false,
      inflateOn: i % 2 === 0,
      durationMs: 150,
    });
  }

  // Phase 2: Deflating & detecting pulse (~1.8s across 9 steps @ 200ms)
  const deflateSteps = [164, 156, 148, 140, 133, 127, 123, target.sys + 1, target.sys];
  for (let i = 0; i < deflateSteps.length; i += 1) {
    frames.push({
      phase: "measuring",
      sys: String(deflateSteps[i]),
      dia: "--",
      pulse: "--",
      heartOn: i % 2 === 0,
      inflateOn: false,
      durationMs: 200,
    });
  }

  // Phase 3: Reading complete — hold clear final reading (~2.2s)
  frames.push({
    phase: "complete",
    sys: String(target.sys),
    dia: String(target.dia),
    pulse: String(target.pulse),
    heartOn: true,
    inflateOn: false,
    durationMs: 2200,
  });

  return frames;
}

const ALL_FRAMES = SETTLED_READINGS.flatMap(buildMeasurementFrames);

// Crisp beveled 7-segment digit in a 20 x 34 local coordinate box
function SevenSegmentDigit({ char, x, y, scale = 1, activeColor = "#344143" }) {
  const bits = SEGMENT_MAP[char] || SEGMENT_MAP[" "];
  const ghostOpacity = 0.075;

  // Slightly italic / slanted clinical LCD polygons inside 20 x 34
  const segPaths = [
    "M3.4,1.2 L16.6,1.2 L14.4,4.2 L5.6,4.2 Z",       // 0: top
    "M17.3,2.0 L18.5,15.6 L15.2,13.6 L14.4,4.8 Z",   // 1: top-right
    "M18.5,18.2 L17.3,31.8 L14.4,29.0 L15.2,20.2 Z", // 2: bottom-right
    "M5.6,29.8 L14.4,29.8 L16.6,32.8 L3.4,32.8 Z",   // 3: bottom
    "M2.7,31.8 L1.5,18.2 L4.8,20.2 L5.6,29.0 Z",     // 4: bottom-left
    "M1.5,15.6 L2.7,2.0 L5.6,4.8 L4.8,13.6 Z",       // 5: top-left
    "M4.6,15.4 L15.4,15.4 L17.4,17.0 L15.4,18.6 L4.6,18.6 L2.6,17.0 Z", // 6: middle
  ];

  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      {segPaths.map((d, idx) => (
        <path
          key={idx}
          d={d}
          fill={activeColor}
          opacity={bits[idx] ? 0.94 : ghostOpacity}
        />
      ))}
    </g>
  );
}

function SevenSegmentRow({ value, digits = 3, x, y, scale = 1, spacing = 22.5 }) {
  const padded = String(value || "").padStart(digits, " ").slice(-digits);
  return (
    <g>
      {padded.split("").map((ch, idx) => (
        <SevenSegmentDigit
          key={idx}
          char={ch}
          x={x + idx * spacing * scale}
          y={y}
          scale={scale}
        />
      ))}
    </g>
  );
}

export default function LiveBpMonitorMedia({
  src = "/images/medical-devices/blood-pressure-monitor.jpg",
  alt = "Automatic digital blood pressure monitor taking a live reading",
  className = "",
  isActive = true,
  decorative = false,
  testId = "live-bp-monitor",
}) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `bpLcdGlass-${safeId}`;
  const clipId = `bpLcdClip-${safeId}`;

  const [reducedMotion, setReducedMotion] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(Boolean(mq.matches));
    const onChange = (event) => setReducedMotion(Boolean(event.matches));
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    return undefined;
  }, []);

  // Start a fresh measurement cycle whenever the slide becomes active
  useEffect(() => {
    if (isActive) {
      setFrameIndex(0);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive || reducedMotion) return undefined;
    const currentFrame = ALL_FRAMES[frameIndex] || ALL_FRAMES[0];
    const timer = window.setTimeout(() => {
      setFrameIndex((prev) => (prev + 1) % ALL_FRAMES.length);
    }, currentFrame.durationMs);
    return () => window.clearTimeout(timer);
  }, [isActive, reducedMotion, frameIndex]);

  const activeFrame = reducedMotion
    ? { phase: "complete", sys: "120", dia: "80", pulse: "72", heartOn: true, inflateOn: false }
    : ALL_FRAMES[frameIndex] || ALL_FRAMES[0];

  return (
    <svg
      viewBox="0 0 1264 848"
      preserveAspectRatio="xMidYMid slice"
      className={`hp-bp-live-svg ${className}`.trim()}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? "true" : undefined}
      data-testid={testId}
      data-src={src}
      data-active={isActive ? "true" : "false"}
      data-phase={activeFrame.phase}
      data-sys={activeFrame.sys}
      data-dia={activeFrame.dia}
      data-pulse={activeFrame.pulse}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#cad9d6" />
          <stop offset="52%" stopColor="#c0cfcb" />
          <stop offset="100%" stopColor="#b1c2bf" />
        </linearGradient>
        <clipPath id={clipId}>
          <polygon points="292,334 442,307 555,465 399,495" />
        </clipPath>
      </defs>

      {/* Base studio photo locked inside the exact same viewBox as the LCD overlay */}
      <image href={src} x="0" y="0" width="1264" height="848" preserveAspectRatio="none" />

      {/* Perspective-locked monochrome LCD screen */}
      <g clipPath={`url(#${clipId})`}>
        <polygon points="290,333 444,306 557,466 398,497" fill={`url(#${gradId})`} />

        {/* Subtle top-left inner bezel glass shadow for realism */}
        <polyline
          points="399,495 292,334 442,307"
          fill="none"
          stroke="#7e9090"
          strokeWidth="3.5"
          opacity="0.45"
        />

        {/* Virtual 100x100 LCD coordinate space mapped directly onto the tilted screen */}
        <g transform="matrix(1.5200 -0.2800 1.0900 1.5900 291.50 335.00)">
          {/* Cuff inflation upward indicator arrow */}
          <path
            d="M10,16 L15,9 L20,16 Z"
            fill="#344143"
            opacity={activeFrame.inflateOn ? 0.9 : 0.08}
          />

          {/* Row 1: SYS (mmHg) */}
          <SevenSegmentRow value={activeFrame.sys} digits={3} x={22} y={5} scale={0.96} spacing={23.5} />

          {/* Row 2: DIA (mmHg) */}
          <SevenSegmentRow value={activeFrame.dia} digits={3} x={22} y={40} scale={0.96} spacing={23.5} />

          {/* Pulsing heartbeat LCD icon beside PULSE */}
          <path
            d="M42,84 C42,81 38.5,79.5 36.5,82 C34.5,79.5 31,81 31,84 C31,87.5 36.5,91.2 36.5,91.2 C36.5,91.2 42,87.5 42,84 Z"
            fill="#344143"
            opacity={activeFrame.heartOn ? 0.92 : 0.1}
          />

          {/* Row 3: PULSE (/min) */}
          <SevenSegmentRow value={activeFrame.pulse} digits={2} x={55} y={74} scale={0.62} spacing={23.5} />
        </g>
      </g>
    </svg>
  );
}
