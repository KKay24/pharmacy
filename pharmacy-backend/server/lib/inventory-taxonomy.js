const MEDICINE_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Ointment',
  'Cream',
  'Gel',
  'Drops',
  'Suppository',
  'Powder',
  'Inhaler',
  'Other',
];

const TAXONOMY = [
  {
    name: 'Medicines',
    slug: 'medicines',
    subcategories: [
      'Antibiotics',
      'Pain & Fever',
      'Antimalarials',
      'Antihypertensives',
      'Antidiabetics',
      'Gastrointestinal',
      'Respiratory',
      'Dermatology',
      'Antifungals',
      'Antivirals',
      'Cardiovascular',
      'Vitamins',
      'Other',
    ].map((name) => ({ name, forms: MEDICINE_FORMS })),
  },
  {
    name: 'Medical Supplies',
    slug: 'medical-supplies',
    subcategories: [
      { name: 'Injection Supplies', forms: ['Syringe', 'Needle', 'IV Set', 'Other'] },
      { name: 'Wound Care', forms: ['Gauze', 'Bandage', 'Other'] },
      { name: 'Protective Supplies', forms: ['Gloves', 'Mask', 'Other'] },
      { name: 'Other', forms: ['Syringe', 'Needle', 'Gloves', 'Gauze', 'Bandage', 'Mask', 'IV Set', 'Other'] },
    ],
  },
  {
    name: 'Personal Care',
    slug: 'personal-care',
    subcategories: [
      { name: 'Skin Care', forms: ['Lotion', 'Cream', 'Gel', 'Skin Care', 'Other'] },
      { name: 'Hair Care', forms: ['Shampoo', 'Other'] },
      { name: 'Hygiene', forms: ['Soap', 'Deodorant', 'Other'] },
      { name: 'Other', forms: ['Lotion', 'Soap', 'Shampoo', 'Deodorant', 'Skin Care', 'Other'] },
    ],
  },
  {
    name: 'Baby Products',
    slug: 'baby-products',
    subcategories: [
      { name: 'Baby Feeding', forms: ['Baby Formula', 'Other'] },
      { name: 'Diapering', forms: ['Diaper', 'Wipe', 'Other'] },
      { name: 'Baby Care', forms: ['Baby Lotion', 'Baby Soap', 'Wipe', 'Other'] },
      { name: 'Other', forms: ['Baby Formula', 'Diaper', 'Wipe', 'Baby Lotion', 'Baby Soap', 'Other'] },
    ],
  },
  {
    name: 'Vitamins & Supplements',
    slug: 'vitamins-supplements',
    subcategories: [
      { name: 'Vitamins', forms: ['Tablet', 'Capsule', 'Syrup', 'Powder', 'Gummy', 'Other'] },
      { name: 'Nutritional Supplements', forms: ['Tablet', 'Capsule', 'Syrup', 'Powder', 'Gummy', 'Other'] },
      { name: 'Other', forms: ['Tablet', 'Capsule', 'Syrup', 'Powder', 'Gummy', 'Other'] },
    ],
  },
  {
    name: 'Medical Devices',
    slug: 'medical-devices',
    subcategories: [
      { name: 'Diagnostic Devices', forms: ['Thermometer', 'Glucometer', 'BP Machine', 'Pulse Oximeter', 'Device', 'Other'] },
      { name: 'Respiratory Devices', forms: ['Nebulizer', 'Inhaler', 'Device', 'Other'] },
      { name: 'Other', forms: ['Thermometer', 'Glucometer', 'BP Machine', 'Nebulizer', 'Pulse Oximeter', 'Device', 'Other'] },
    ],
  },
];

function taxonomyPath(parentPath, slug) {
  return parentPath ? `${parentPath}/${slug}` : slug;
}

function taxonomySlug(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = { TAXONOMY, taxonomyPath, taxonomySlug };
