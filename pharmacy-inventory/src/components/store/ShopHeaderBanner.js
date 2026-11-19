import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  CloudUpload,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";

const TRUST_INDICATORS = [
  {
    id: "express-delivery",
    icon: Truck,
    title: "Express Delivery",
    subtitle: "Same-day dispatch on orders before 4 PM",
  },
  {
    id: "genuine-medicines",
    icon: ShieldCheck,
    title: "100% Genuine Medicines",
    subtitle: "Sourced from licensed distributors",
  },
  {
    id: "discreet-packaging",
    icon: Package,
    title: "Discreet Packaging",
    subtitle: "Safe & private delivery",
  },
];

function PrescriptionIllustration() {
  return (
    <svg
      className="store-shop-banner__rx-svg"
      viewBox="0 0 116 112"
      fill="none"
      aria-hidden="true"
    >
      {/* Tilted clipboard backplate */}
      <g transform="rotate(-8 50 56)">
        <rect
          x="14"
          y="14"
          width="68"
          height="88"
          rx="10"
          fill="#263B59"
        />
        <rect
          x="20"
          y="22"
          width="56"
          height="74"
          rx="6"
          fill="#FFFFFF"
        />
        {/* Clipboard metal clip */}
        <rect x="36" y="8" width="24" height="11" rx="5.5" fill="#1C314E" />
        <circle cx="48" cy="13.5" r="2.2" fill="#E6FAF7" />

        {/* Rx emblem & prescription lines */}
        <text
          x="28"
          y="49"
          fill="#1B4F9C"
          fontFamily="Outfit, DM Sans, sans-serif"
          fontWeight="800"
          fontSize="19"
          letterSpacing="-0.5"
        >
          Rx
        </text>
        <rect x="28" y="57" width="38" height="3.5" rx="1.75" fill="#C9DFE8" />
        <rect x="28" y="65" width="32" height="3.5" rx="1.75" fill="#D9EAEF" />
        <rect x="28" y="73" width="24" height="3.5" rx="1.75" fill="#D9EAEF" />
      </g>

      {/* Subtle spark accents */}
      <path
        d="M84 22L88 18M89 29H95M86 35L91 38"
        stroke="#0F294A"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* Teal upload cloud badge */}
      <circle cx="82" cy="77" r="23" fill="#009F91" />
      <circle cx="82" cy="77" r="23" fill="url(#rxUploadGlow)" />
      <path
        d="M73 83.5C69.9 83.5 67.5 81.1 67.5 78.2C67.5 75.5 69.5 73.3 72.1 73C73.2 69.3 76.6 66.8 80.6 66.8C85.4 66.8 89.3 70.6 89.5 75.3C91.9 75.8 93.7 77.9 93.7 80.4C93.7 82.1 92.3 83.5 90.5 83.5H73Z"
        fill="#FFFFFF"
      />
      <path
        d="M81 84.5V75.5M81 75.5L77.5 79M81 75.5L84.5 79"
        stroke="#009F91"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="rxUploadGlow" x1="59" y1="54" x2="105" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14C2B2" stopOpacity="0.4" />
          <stop offset="1" stopColor="#007A70" stopOpacity="0.35" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function ShopHeaderBanner({
  heading = "All Products",
  total = 0,
  loading = false,
  searchQuery = "",
  categoryName = "",
}) {
  return (
    <section
      className="store-shop-banner"
      aria-label="Shop header and prescription services"
    >
      {/* Section 1: Breadcrumb, Heading & Dynamic Product Count */}
      <div className="store-shop-banner__identity">
        <nav className="store-shop-banner__breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="store-shop-banner__sep" aria-hidden="true">›</span>
          <span>Shop</span>
          {categoryName && !searchQuery && (
            <>
              <span className="store-shop-banner__sep" aria-hidden="true">›</span>
              <span>{categoryName}</span>
            </>
          )}
          {searchQuery && (
            <>
              <span className="store-shop-banner__sep" aria-hidden="true">›</span>
              <span>&ldquo;{searchQuery}&rdquo;</span>
            </>
          )}
        </nav>

        <h1 className="store-shop-banner__title">{heading}</h1>

        <p className="store-shop-banner__count" data-testid="shop-product-count">
          {loading
            ? "Loading products…"
            : `${total} product${total !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {/* Section 2: Prescription Illustration, Headline & Actions */}
      <div className="store-shop-banner__rx">
        <div className="store-shop-banner__rx-art">
          <PrescriptionIllustration />
        </div>

        <div className="store-shop-banner__rx-copy">
          <h2 className="store-shop-banner__rx-heading">Have a Prescription?</h2>
          <p className="store-shop-banner__rx-text">
            Upload your Rx for <strong>fast pharmacist</strong> verification &amp; doorstep delivery.
          </p>
        </div>

        <div className="store-shop-banner__rx-actions">
          <Link to="/prescription-upload" className="store-shop-banner__upload-btn">
            <CloudUpload size={17} aria-hidden="true" />
            <span>Upload Prescription</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link to="/contact" className="store-shop-banner__ask-link">
            <span>Ask a Pharmacist</span>
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Section 3: Three Trust Indicators */}
      <div className="store-shop-banner__trust" aria-label="Pharmacy service guarantees">
        {TRUST_INDICATORS.map(({ id, icon: Icon, title, subtitle }) => (
          <div key={id} className="store-shop-banner__trust-item">
            <span className="store-shop-banner__trust-icon" aria-hidden="true">
              <Icon size={21} strokeWidth={2} />
            </span>
            <strong className="store-shop-banner__trust-title">{title}</strong>
            <small className="store-shop-banner__trust-sub">{subtitle}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
