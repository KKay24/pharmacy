import {
  BABY_PRODUCTS_IMAGES,
  DEFAULT_CATEGORY_FALLBACK_IMAGE,
  HERO_BANNERS,
  MEDICINES_IMAGES,
  PERSONAL_CARE_IMAGES,
  VITAMINS_SUPPLEMENTS_IMAGES,
} from "./homepageMedia";

/**
 * Configurable promotional slides for the Shop PromotionalCarousel.
 * Designed for future admin dashboard management:
 * - Add or remove slide objects
 * - Reorder via `order`
 * - Enable/disable via `active`
 * - Avoid hardcoding unverified discounts or prices
 */
export const SHOP_PROMOTIONAL_SLIDES = [
  {
    id: "prescription-upload",
    order: 1,
    active: true,
    badge: "Licensed Pharmacist Review",
    heading: "Have a Prescription? Upload Online",
    description:
      "Submit your doctor's prescription for fast pharmacist verification, safe dispensing, and discreet delivery or store pickup.",
    ctaLabel: "Upload Prescription",
    ctaTo: "/prescription-upload",
    secondaryCtaLabel: "Ask a Pharmacist",
    secondaryCtaTo: "/contact",
    imageUrl: HERO_BANNERS[1].imageUrl,
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: "Verified prescription medicines prepared by a MediQuick pharmacist",
    theme: "navy-teal",
  },
  {
    id: "baby-care",
    order: 2,
    active: true,
    badge: "Baby Care",
    heading: "Gentle Baby Care & Family Essentials",
    description:
      "Shop soft diapers, baby wipes, mild bath lotions, and feeding essentials selected for everyday comfort and peace of mind.",
    ctaLabel: "Shop Baby Care",
    ctaTo: "/shop?category=baby-products",
    imageUrl: BABY_PRODUCTS_IMAGES[0].src,
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: BABY_PRODUCTS_IMAGES[0].alt,
    theme: "teal-mint",
  },
  {
    id: "vitamins-supplements",
    order: 3,
    active: true,
    badge: "Vitamins & Supplements",
    heading: "Daily Vitamins & Wellness Support",
    description:
      "Support immunity, energy, and balanced nutrition with genuine multivitamins, minerals, and family health supplements.",
    ctaLabel: "Explore Vitamins",
    ctaTo: "/shop?category=vitamins-supplements",
    imageUrl: VITAMINS_SUPPLEMENTS_IMAGES[0].src,
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: VITAMINS_SUPPLEMENTS_IMAGES[0].alt,
    theme: "ocean-teal",
  },
  {
    id: "personal-care-beauty",
    order: 4,
    active: true,
    badge: "Personal Care & Beauty",
    heading: "Trusted Skincare & Personal Care",
    description:
      "Explore pharmacist-approved lotions, gentle cleansers, and daily oral hygiene products for healthy skin and everyday confidence.",
    ctaLabel: "Shop Personal Care",
    ctaTo: "/shop?category=personal-care",
    imageUrl: PERSONAL_CARE_IMAGES[0].src,
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: PERSONAL_CARE_IMAGES[0].alt,
    theme: "navy-ocean",
  },
  {
    id: "special-offers",
    order: 5,
    active: true,
    badge: "Special Offers",
    heading: "Featured Pharmacy Picks & New Arrivals",
    description:
      "Discover popular over-the-counter remedies, seasonal health essentials, and newly stocked products sourced from licensed distributors.",
    ctaLabel: "Browse Featured",
    ctaTo: "/shop?sort=newest",
    imageUrl: MEDICINES_IMAGES[0].src,
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: MEDICINES_IMAGES[0].alt,
    theme: "teal-navy",
  },
  {
    id: "pharmacy-delivery",
    order: 6,
    active: true,
    badge: "Pharmacy Delivery",
    heading: "Fast, Discreet Pharmacy Delivery",
    description:
      "Order genuine medicines online with safe, private packaging, doorstep delivery, or convenient pickup—and track your order anytime.",
    ctaLabel: "Track Your Order",
    ctaTo: "/track-order",
    secondaryCtaLabel: "Contact Pharmacy",
    secondaryCtaTo: "/contact",
    imageUrl: HERO_BANNERS[0].imageUrl,
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: HERO_BANNERS[0].imageAlt,
    theme: "deep-navy",
  },
];

/**
 * Filters out deactivated slides and returns slides sorted by `order` (preserving relative order on ties).
 */
export function getActivePromotionalSlides(slides = SHOP_PROMOTIONAL_SLIDES) {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide && slide.active !== false)
    .sort((a, b) => {
      const orderA = Number.isFinite(Number(a.slide.order)) ? Number(a.slide.order) : a.index + 1;
      const orderB = Number.isFinite(Number(b.slide.order)) ? Number(b.slide.order) : b.index + 1;
      return orderA - orderB || a.index - b.index;
    })
    .map(({ slide }) => slide);
}
