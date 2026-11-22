export const DEFAULT_HERO_FALLBACK_IMAGE = "/logo512.png";

export const DEFAULT_CATEGORY_FALLBACK_IMAGE = "/images/medicines/tablets-blister.jpg";

export const PRESCRIPTION_CAPSULES_VIDEO = "/videos/prescription-capsules.mp4";
export const BLOOD_PRESSURE_MONITOR_VIDEO = "/videos/blood-pressure-monitor.mp4";
export const BLOOD_PRESSURE_MONITOR_POSTER = "/images/medical-devices/blood-pressure-monitor.jpg";
export const BABY_PRODUCTS_VIDEO = "/videos/baby-products.mp4";
export const BABY_PRODUCTS_POSTER = "/images/baby-products/baby-diapers.jpg";
export const PERSONAL_CARE_VIDEO = "/videos/personal-care.mp4";
export const PERSONAL_CARE_POSTER = "/images/personal-care/skincare-lotion.jpg";
export const MEDICAL_SUPPLIES_VIDEO = "/videos/medical-supplies.mp4";

/**
 * Three distinct studio images for Medical Devices:
 * digital thermometers, blood pressure monitors, and stethoscopes.
 */
export const MEDICAL_DEVICE_IMAGES = [
  {
    id: "digital-thermometer",
    label: "Digital Thermometers",
    src: "/images/medical-devices/digital-thermometer.jpg",
    alt: "Digital medical thermometer",
  },
  {
    id: "blood-pressure-monitor",
    label: "Blood Pressure Monitors",
    src: BLOOD_PRESSURE_MONITOR_VIDEO,
    alt: "Automatic digital blood pressure monitor",
    mediaType: "live-bp-monitor",
  },
  {
    id: "stethoscope",
    label: "Stethoscopes",
    src: "/images/medical-devices/stethoscope.jpg",
    alt: "Clinical dual-head stethoscope",
  },
];

/**
 * Three distinct studio images for Personal Care:
 * skincare & lotions, gentle cleansers & soaps, and oral hygiene essentials.
 */
export const PERSONAL_CARE_IMAGES = [
  {
    id: "skincare-lotion",
    label: "Skincare & Lotions",
    src: PERSONAL_CARE_POSTER,
    alt: "Moisturizing skincare lotion bottle and facial cream jar",
  },
  {
    id: "gentle-cleansers",
    label: "Cleansers & Soaps",
    src: "/images/personal-care/gentle-cleansers.jpg",
    alt: "Gentle dermatological wash bottle and soap bars",
  },
  {
    id: "oral-hygiene",
    label: "Oral Hygiene",
    src: "/images/personal-care/oral-hygiene.jpg",
    alt: "Toothbrushes, toothpaste, and dental floss essentials",
  },
  {
    id: "personal-care-video",
    label: "Personal Care Essentials",
    src: PERSONAL_CARE_VIDEO,
    poster: PERSONAL_CARE_POSTER,
    alt: "Skincare, cleansers, and daily personal care essentials",
    mediaType: "live-video",
  },
];

/**
 * Three distinct studio images for Baby Products:
 * diapers & wipes, baby bath & skin care, and baby feeding essentials.
 */
export const BABY_PRODUCTS_IMAGES = [
  {
    id: "baby-diapers",
    label: "Diapers & Wipes",
    src: BABY_PRODUCTS_POSTER,
    alt: "Soft baby diapers and gentle baby wipes",
  },
  {
    id: "baby-bath-care",
    label: "Baby Bath & Lotion",
    src: "/images/baby-products/baby-bath-care.jpg",
    alt: "Gentle baby lotion, shampoo, and soft bath sponge",
  },
  {
    id: "baby-feeding",
    label: "Baby Feeding",
    src: "/images/baby-products/baby-feeding.jpg",
    alt: "Baby feeding bottle and silicone pacifier",
  },
  {
    id: "baby-products-video",
    label: "Baby Care Essentials",
    src: BABY_PRODUCTS_VIDEO,
    poster: BABY_PRODUCTS_POSTER,
    alt: "Baby products and gentle family care essentials",
    mediaType: "live-video",
  },
];

/**
 * Three distinct images for Medicines:
 * tablets & blister packs, capsules & vials, and prescription pharmacy medications.
 */
export const MEDICINES_IMAGES = [
  {
    id: "tablets-blister",
    label: "Tablets & Blister Packs",
    src: "/images/medicines/tablets-blister.jpg",
    alt: "Pharmaceutical tablet blister packs and medicine bottle",
  },
  {
    id: "capsules-vial",
    label: "Capsules & Vials",
    src: "/images/medicines/capsules-vial.jpg",
    alt: "Pharmaceutical capsules beside medicine vial",
  },
  {
    id: "dispensary-medicines",
    label: "Prescription Medicines",
    src: PRESCRIPTION_CAPSULES_VIDEO,
    alt: "Assorted pharmacy medications",
    mediaType: "live-capsules",
  },
];

/**
 * Three distinct images for Medical Supplies:
 * first aid & dressings, protective gloves/masks & syringes, and clinical wound care.
 */
export const MEDICAL_SUPPLIES_IMAGES = [
  {
    id: "first-aid-supplies",
    label: "First Aid Supplies",
    src: "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=700&q=80",
    alt: "First aid and pharmacy medical supplies",
  },
  {
    id: "protective-gloves-syringes",
    label: "Gloves, Masks & Syringes",
    src: "https://images.unsplash.com/photo-1651760301007-5080dc7fc6a9?auto=format&fit=crop&w=700&q=80",
    alt: "Protective medical gloves, face mask, and sterile syringe",
  },
  {
    id: "clinical-care-supplies",
    label: "Clinical Care Packaging",
    src: "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=700&q=80",
    alt: "Clinical medical care supplies and sprays",
  },
  {
    id: "medical-supplies-video",
    label: "Medical Supplies",
    src: MEDICAL_SUPPLIES_VIDEO,
    poster: "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=700&q=80",
    alt: "Clinical and first aid medical supplies",
    mediaType: "live-video",
  },
];

/**
 * Three distinct images for Vitamins & Supplements:
 * daily vitamins, supplement bottles & tablets, and wellness/mineral capsules.
 */
export const VITAMINS_SUPPLEMENTS_IMAGES = [
  {
    id: "daily-vitamins",
    label: "Daily Vitamins",
    src: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=700&q=80",
    alt: "Daily vitamins and nutritional supplements",
  },
  {
    id: "supplement-bottles",
    label: "Vitamin Bottles & Tablets",
    src: "https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=700&q=80",
    alt: "Nutritional supplement bottles and tablets",
  },
  {
    id: "wellness-minerals",
    label: "Omega & Minerals",
    src: "https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=700&q=80",
    alt: "Wellness vitamins and mineral supplements",
  },
];

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
    imageUrl: PRESCRIPTION_CAPSULES_VIDEO,
    fallbackImageUrl: DEFAULT_CATEGORY_FALLBACK_IMAGE,
    imageAlt: "Pharmacist organizing verified prescription medications",
    mediaType: "live-capsules",
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
      "Shop digital thermometers, blood pressure monitors, stethoscopes, and everyday diagnostic equipment curated for reliable care.",
    ctaLabel: "Browse Medical Devices",
    ctaTo: "/shop?category=medical-devices",
    secondaryCtaLabel: "View All Products",
    secondaryCtaTo: "/shop",
    imageUrl: MEDICAL_DEVICE_IMAGES[1].src,
    fallbackImageUrl: MEDICAL_DEVICE_IMAGES[0].src,
    imageAlt: MEDICAL_DEVICE_IMAGES[1].alt,
    mediaType: "live-bp-monitor",
  },
];

/**
 * Primary category image map + specific subcategory/device slug mappings.
 */
export const CATEGORY_IMAGES = {
  medicines: MEDICINES_IMAGES[0].src,
  "medical-supplies": MEDICAL_SUPPLIES_IMAGES[0].src,
  "vitamins-supplements": VITAMINS_SUPPLEMENTS_IMAGES[0].src,
  "personal-care": PERSONAL_CARE_IMAGES[0].src,
  "baby-products": BABY_PRODUCTS_IMAGES[0].src,
  "medical-devices": MEDICAL_DEVICE_IMAGES[0].src,
  "digital-thermometers": MEDICAL_DEVICE_IMAGES[0].src,
  thermometer: MEDICAL_DEVICE_IMAGES[0].src,
  "blood-pressure-monitors": BLOOD_PRESSURE_MONITOR_POSTER,
  "bp-machine": BLOOD_PRESSURE_MONITOR_POSTER,
  stethoscopes: MEDICAL_DEVICE_IMAGES[2].src,
  stethoscope: MEDICAL_DEVICE_IMAGES[2].src,
};

/**
 * Multi-image category galleries (3 distinct images per main pharmacy category).
 */
export const CATEGORY_IMAGE_GALLERIES = {
  medicines: MEDICINES_IMAGES,
  "medical-supplies": MEDICAL_SUPPLIES_IMAGES,
  "personal-care": PERSONAL_CARE_IMAGES,
  "baby-products": BABY_PRODUCTS_IMAGES,
  "vitamins-supplements": VITAMINS_SUPPLEMENTS_IMAGES,
  "medical-devices": MEDICAL_DEVICE_IMAGES,
};

export function getCategoryImage(category) {
  if (!category) return DEFAULT_CATEGORY_FALLBACK_IMAGE;
  if (category.imageUrl) return category.imageUrl;

  const slug = String(category.slug || "").toLowerCase();
  if (CATEGORY_IMAGES[slug]) return CATEGORY_IMAGES[slug];

  const name = String(category.name || "").toLowerCase();
  if (name.includes("thermometer")) return MEDICAL_DEVICE_IMAGES[0].src;
  if (name.includes("blood pressure") || name.includes("bp")) return BLOOD_PRESSURE_MONITOR_POSTER;
  if (name.includes("stethoscope")) return MEDICAL_DEVICE_IMAGES[2].src;
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

export function getCategoryImages(category) {
  if (!category) {
    return [{ id: "default", src: DEFAULT_CATEGORY_FALLBACK_IMAGE, label: "" }];
  }
  if (category.imageUrl) {
    return [{ id: category.slug || "custom", src: category.imageUrl, label: category.name || "" }];
  }

  const slug = String(category.slug || "").toLowerCase();
  if (CATEGORY_IMAGE_GALLERIES[slug]) {
    return CATEGORY_IMAGE_GALLERIES[slug];
  }

  const name = String(category.name || "").toLowerCase();
  if (name.includes("medical device")) return MEDICAL_DEVICE_IMAGES;
  if (name.includes("personal care")) return PERSONAL_CARE_IMAGES;
  if (name.includes("baby")) return BABY_PRODUCTS_IMAGES;
  if (name.includes("medical suppl")) return MEDICAL_SUPPLIES_IMAGES;
  if (name.includes("vitamin") || name.includes("supplement")) return VITAMINS_SUPPLEMENTS_IMAGES;
  if (name === "medicines" || name === "medicine") return MEDICINES_IMAGES;

  return [{ id: slug || "default", src: getCategoryImage(category), label: category.name || "" }];
}
