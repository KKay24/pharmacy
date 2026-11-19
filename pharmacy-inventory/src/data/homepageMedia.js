export const DEFAULT_HERO_FALLBACK_IMAGE = "/logo512.png";

export const DEFAULT_CATEGORY_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80";

/**
 * Array-based hero banner configuration.
 * Add, reorder, or remove banner objects here without changing carousel component logic.
 */
export const HERO_BANNERS = [
  {
    id: "quality-medicines-delivery",
    kicker: "Your online pharmacy",
    title: "Quality Medicines.",
    highlight: "Delivered to Your Door.",
    description:
      "Browse genuine prescription and over-the-counter medicines from our verified pharmacy catalogue with fast delivery or pickup.",
    ctaLabel: "Shop Catalogue",
    ctaTo: "/shop",
    secondaryCtaLabel: "Upload Prescription",
    secondaryCtaTo: "/prescription-upload",
    imageUrl:
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80",
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: "Pharmacist preparing an online pharmacy order on a tablet",
  },
  {
    id: "prescription-review-service",
    kicker: "Licensed Pharmacist Review",
    title: "Easy Prescription",
    highlight: "Uploads & Verification.",
    description:
      "Submit your doctor's prescription online and let our qualified pharmacists review, verify, and prepare your medication safely.",
    ctaLabel: "Upload Prescription",
    ctaTo: "/prescription-upload",
    secondaryCtaLabel: "Track Order",
    secondaryCtaTo: "/track-order",
    imageUrl:
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: "Pharmacist organizing verified prescription medications",
  },
  {
    id: "vitamins-daily-wellness",
    kicker: "Immunity & Daily Health",
    title: "Vitamins & Supplements",
    highlight: "For Everyday Wellness.",
    description:
      "Support immunity, energy, and family nutrition with trusted multivitamins, Vitamin C, zinc, and daily health essentials.",
    ctaLabel: "Explore Vitamins",
    ctaTo: "/shop?category=vitamins-supplements",
    secondaryCtaLabel: "Health & Wellness",
    secondaryCtaTo: "/health-wellness",
    imageUrl:
      "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=1200&q=80",
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: "Assortment of vitamins and daily nutritional supplements",
  },
  {
    id: "family-care-devices",
    kicker: "Home Care & Monitoring",
    title: "Medical Devices &",
    highlight: "Family Care Essentials.",
    description:
      "Shop thermometers, blood pressure monitors, first-aid supplies, personal care, and baby essentials curated for home care.",
    ctaLabel: "Browse Supplies",
    ctaTo: "/shop?category=medical-supplies",
    secondaryCtaLabel: "View All Products",
    secondaryCtaTo: "/shop",
    imageUrl:
      "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=1200&q=80",
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: "Medical monitoring devices and pharmacy supplies",
  },
];

/**
 * Existing category image map + coverage for all taxonomy categories and fallback.
 */
export const CATEGORY_IMAGES = {
  medicines:
    "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80",
  "medical-supplies":
    "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=700&q=80",
  "vitamins-supplements":
    "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=700&q=80",
  "personal-care":
    "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=700&q=80",
  "baby-products":
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=700&q=80",
  "medical-devices":
    "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=700&q=80",
};

export function getCategoryImage(category) {
  if (!category) return DEFAULT_CATEGORY_FALLBACK_IMAGE;
  if (category.imageUrl) return category.imageUrl;

  const slug = String(category.slug || "").toLowerCase();
  if (CATEGORY_IMAGES[slug]) return CATEGORY_IMAGES[slug];

  const name = String(category.name || "").toLowerCase();
  if (name.includes("vitamin") || name.includes("supplement")) {
    return CATEGORY_IMAGES["vitamins-supplements"];
  }
  if (name.includes("device") || name.includes("monitor") || name.includes("diagnostic")) {
    return CATEGORY_IMAGES["medical-devices"];
  }
  if (name.includes("supply") || name.includes("supplies") || name.includes("first aid")) {
    return CATEGORY_IMAGES["medical-supplies"];
  }
  if (name.includes("personal") || name.includes("skin") || name.includes("care")) {
    return CATEGORY_IMAGES["personal-care"];
  }
  if (name.includes("baby") || name.includes("mother") || name.includes("child")) {
    return CATEGORY_IMAGES["baby-products"];
  }

  return DEFAULT_CATEGORY_FALLBACK_IMAGE;
}
