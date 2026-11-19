const searchService = require('../store/search.service');

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'available', 'be', 'buy', 'can', 'cost',
  'do', 'does', 'for', 'from', 'get', 'got', 'have', 'help', 'hi', 'hello',
  'how', 'i', 'in', 'is', 'it', 'me', 'mediquick', 'much', 'my', 'need', 'of',
  'on', 'or', 'order', 'pharmacy', 'please', 'price', 'product', 'products',
  'recommend', 'sell', 'shop', 'stock', 'store', 'take', 'that', 'the', 'there',
  'this', 'to', 'want', 'what', 'where', 'which', 'with', 'you', 'your',
]);

const GENERIC_FORM_WORDS = new Set([
  'tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps',
  'syrup', 'cream', 'gel', 'ointment', 'drops', 'powder', 'spray', 'bottle',
  'pack', 'box', 'sachet', 'sachets', 'injection', 'solution', 'suspension',
]);

function isStandaloneUnitOrForm(token) {
  return GENERIC_FORM_WORDS.has(token) || /^\d+(?:mg|mcg|g|ml|iu|%)?$/i.test(token);
}

function extractSearchPhrases(message) {
  const normalized = searchService.normalizeSearchTerm(message);
  if (!normalized) return [];

  const tokens = normalized
    .split(' ')
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  const phrases = [];
  if (tokens.length > 0) {
    phrases.push(tokens.slice(0, 4).join(' '));
  }
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].length >= 3 && !isStandaloneUnitOrForm(tokens[i])) {
      phrases.push(tokens[i]);
    }
    if (i + 1 < tokens.length && (!isStandaloneUnitOrForm(tokens[i]) || !isStandaloneUnitOrForm(tokens[i + 1]))) {
      phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
  }

  return Array.from(new Set(phrases)).slice(0, 6);
}

function formatVerifiedProduct(medicine) {
  const plain = typeof medicine.get === 'function' ? medicine.get({ plain: true }) : medicine;
  const availableQuantity = searchService.calculateAvailableStock(plain);
  const price = searchService.calculateProductPrice(plain);

  return {
    id: plain.id,
    name: plain.name,
    brandName: plain.brandName || null,
    genericName: plain.genericName || null,
    strength: plain.strength || null,
    dosage: plain.dosage || null,
    category: plain.MainCategory?.name || plain.category || null,
    price,
    currency: 'ZMW',
    inStock: availableQuantity > 0,
    prescriptionRequired: Boolean(plain.prescriptionRequired),
    imageUrl: plain.imageUrl || null,
    url: `/product/${plain.id}`,
  };
}

/**
 * Retrieves real MediQuick catalogue products and verified in-stock direct alternatives
 * (strictly same active ingredient, verified strength, and verified dosage form).
 */
async function lookupVerifiedCatalogueContext(message, { maxProducts = 4 } = {}) {
  const phrases = extractSearchPhrases(message);
  if (phrases.length === 0) {
    return { products: [], verifiedAlternatives: [] };
  }

  const matchedById = new Map();

  for (const phrase of phrases) {
    const result = await searchService.searchProducts({
      query: phrase,
      trackAnalytics: false,
    });
    if (!result || !Array.isArray(result.scoredProducts)) continue;

    for (const item of result.scoredProducts.slice(0, maxProducts)) {
      // Only include strong/relevant matches (exclude weak noise)
      if (item.score < 50) continue;
      const existing = matchedById.get(item.medicine.id);
      if (!existing || item.score > existing.score) {
        matchedById.set(item.medicine.id, item);
      }
    }
  }

  const topMatches = Array.from(matchedById.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.inStock !== a.inStock) return (b.inStock ? 1 : 0) - (a.inStock ? 1 : 0);
      return String(a.medicine.name || '').localeCompare(String(b.medicine.name || ''));
    })
    .slice(0, maxProducts);

  const products = topMatches.map((item) => formatVerifiedProduct(item.medicine));

  // For any matched product that is currently out of stock, check strictly verified direct equivalents
  // (identical active ingredient + verified matching strength + verified matching dosage form)
  // that are actually IN STOCK.
  const verifiedAlternatives = [];
  const seenAltIds = new Set();

  for (const product of products) {
    if (product.inStock) continue;
    const altResult = await searchService.getProductAlternatives(product.id);
    if (!altResult || !Array.isArray(altResult.directEquivalents)) continue;

    for (const equiv of altResult.directEquivalents) {
      const formattedAlt = formatVerifiedProduct(equiv.medicine);
      if (!formattedAlt.inStock || formattedAlt.id === product.id || seenAltIds.has(formattedAlt.id)) {
        continue;
      }
      seenAltIds.add(formattedAlt.id);
      verifiedAlternatives.push({
        forProductId: product.id,
        forProductName: product.name,
        product: formattedAlt,
        level: equiv.level,
        pharmacistReviewRequired: true,
        medicalSafetyNotice: equiv.medicalSafetyNotice,
      });
    }
  }

  return {
    products,
    verifiedAlternatives: verifiedAlternatives.slice(0, 3),
  };
}

module.exports = {
  extractSearchPhrases,
  formatVerifiedProduct,
  lookupVerifiedCatalogueContext,
};
