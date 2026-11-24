const { Op } = require('sequelize');
const {
  Batch,
  InventoryCategory,
  Medicine,
  SearchAnalytics,
  SearchSynonym,
  sequelize,
} = require('../../models');
const { activeBatchWhere, isBatchInactive } = require('../inventory/batch-utils');

// Damerau-Levenshtein distance for typo tolerance (handles insertions, deletions, substitutions, transpositions)
function editDistance(a, b) {
  if (!a || !b) return (a || b || '').length;
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const m = s1.length;
  const n = s2.length;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return dp[m][n];
}

function normalizeSearchTerm(term) {
  if (!term) return '';
  return String(term)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function splitIngredients(genericName) {
  if (!genericName) return [];
  return String(genericName)
    .split(/[+/,&]|\band\b/i)
    .map((part) => normalizeSearchTerm(part))
    .filter(Boolean);
}

function maxAllowedDistance(wordLength, targetLength = wordLength) {
  const maxLen = Math.max(wordLength, targetLength);
  if (maxLen <= 3) return 0;
  if (maxLen <= 5) return 1;
  if (maxLen <= 8) return 2;
  return 3;
}

function stringSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = editDistance(a, b);
  return (maxLen - dist) / maxLen;
}

function calculateProductPrice(medicine) {
  const plain = typeof medicine.get === 'function' ? medicine.get({ plain: true }) : medicine;
  const activeBatches = Array.isArray(plain.Batches)
    ? plain.Batches.filter((batch) => !isBatchInactive(batch))
    : [];
  if (activeBatches.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const validBatches = activeBatches
      .filter((batch) => Number(batch.quantity) > 0 && String(batch.expiryDate) >= today && Number(batch.sellingPrice) > 0)
      .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
    if (validBatches.length > 0) {
      return Number(validBatches[0].sellingPrice);
    }
    const configuredBatch = activeBatches
      .filter((batch) => Number(batch.sellingPrice) > 0)
      .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)))[0];
    if (configuredBatch) {
      return Number(configuredBatch.sellingPrice);
    }
  }
  return Number(plain.basePrice || 0);
}

function calculateAvailableStock(medicine) {
  const plain = typeof medicine.get === 'function' ? medicine.get({ plain: true }) : medicine;
  const activeBatches = Array.isArray(plain.Batches)
    ? plain.Batches.filter((batch) => !isBatchInactive(batch))
    : [];
  if (activeBatches.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    return activeBatches
      .filter((batch) => String(batch.expiryDate) >= today && Number(batch.quantity || 0) > 0)
      .reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
  }
  return Math.max(0, Number(plain.totalQuantity || 0));
}

function buildSqlAnchorFragments(normalizedQuery, expandedTerms) {
  const fragments = new Set();
  const addTerm = (term) => {
    const clean = normalizeSearchTerm(term);
    if (!clean || clean.length < 2) return;
    fragments.add(clean);
    const tokens = clean.split(' ').filter((t) => t.length >= 3);
    for (const token of tokens) {
      fragments.add(token);
      if (token.length >= 5) {
        // Prefix & suffix anchors allow SQL pre-filtering to catch typos like
        // "paracetmol" (%par% / %mol%), "amoxilin" (%amo% / %lin%), "panadolx" (%pan%)
        fragments.add(token.slice(0, 3));
        fragments.add(token.slice(-3));
      }
    }
  };

  addTerm(normalizedQuery);
  for (const term of expandedTerms) {
    addTerm(term);
  }

  return Array.from(fragments).slice(0, 24);
}

class SearchService {
  constructor() {
    this.synonymCache = null;
    this.synonymCacheTime = 0;
    this.CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  }

  clearSynonymCache() {
    this.synonymCache = null;
    this.synonymCacheTime = 0;
  }

  async getSynonymMap() {
    const now = Date.now();
    if (this.synonymCache && now - this.synonymCacheTime < this.CACHE_TTL_MS) {
      return this.synonymCache;
    }

    try {
      const rows = await SearchSynonym.findAll();
      const map = new Map();
      for (const row of rows) {
        const key = normalizeSearchTerm(row.term);
        if (!key) continue;
        map.set(key, {
          synonyms: Array.isArray(row.synonyms) ? row.synonyms : [],
          category: row.category || null,
        });
      }
      this.synonymCache = map;
      this.synonymCacheTime = now;
      return map;
    } catch (err) {
      return new Map();
    }
  }

  // Dialect-aware case-insensitive LIKE clause (ILIKE on PostgreSQL, LOWER() LIKE on SQLite)
  buildCaseInsensitiveLike(column, pattern) {
    const isPostgres = sequelize.getDialect() === 'postgres';
    if (isPostgres) {
      return { [column]: { [Op.iLike]: pattern } };
    }
    return sequelize.where(
      sequelize.fn('LOWER', sequelize.col(`Medicine.${column}`)),
      'LIKE',
      pattern.toLowerCase()
    );
  }

  async expandQueryWithSynonyms(normalizedQuery) {
    const synonymMap = await this.getSynonymMap();
    const expandedTerms = new Set([normalizedQuery]);
    const targetCategories = new Set();

    // Check full query
    if (synonymMap.has(normalizedQuery)) {
      const { synonyms, category } = synonymMap.get(normalizedQuery);
      synonyms.forEach((s) => expandedTerms.add(normalizeSearchTerm(s)));
      if (category) targetCategories.add(category);
    }

    // Check individual tokens (length >= 3 to avoid noise words like "of", "in")
    const tokens = normalizedQuery.split(' ').filter((t) => t.length >= 3);
    for (const token of tokens) {
      if (synonymMap.has(token)) {
        const { synonyms, category } = synonymMap.get(token);
        synonyms.forEach((s) => expandedTerms.add(normalizeSearchTerm(s)));
        if (category) targetCategories.add(category);
      }
    }

    // Also allow minor typo match against synonym keys (e.g., "painkiler" -> "painkiller")
    if (expandedTerms.size === 1 && normalizedQuery.length >= 5) {
      for (const [key, entry] of synonymMap.entries()) {
        const allowed = maxAllowedDistance(normalizedQuery.length, key.length);
        if (allowed > 0 && editDistance(normalizedQuery, key) <= Math.min(allowed, 2)) {
          expandedTerms.add(key);
          entry.synonyms.forEach((s) => expandedTerms.add(normalizeSearchTerm(s)));
          if (entry.category) targetCategories.add(entry.category);
        }
      }
    }

    return {
      terms: Array.from(expandedTerms).filter(Boolean),
      categories: Array.from(targetCategories),
    };
  }

  // Calculate fuzzy match score
  evaluateFuzzyMatch(normalizedQuery, text) {
    if (!text) return { isMatch: false, distance: 99, score: 0 };
    const normalizedText = normalizeSearchTerm(text);
    if (!normalizedText) return { isMatch: false, distance: 99, score: 0 };

    if (normalizedText === normalizedQuery) {
      return { isMatch: true, distance: 0, score: 42, exact: true };
    }

    // Compare full normalized text
    const fullAllowedDist = maxAllowedDistance(normalizedQuery.length, normalizedText.length);
    const fullDist = editDistance(normalizedQuery, normalizedText);
    const fullSim = stringSimilarity(normalizedQuery, normalizedText);
    if (fullDist <= fullAllowedDist || (fullSim >= 0.75 && normalizedQuery.length >= 5)) {
      const computedScore = Math.min(42, Math.max(28, Math.round(fullSim * 44)));
      return { isMatch: true, distance: fullDist, score: computedScore, fuzzy: true };
    }

    // Word-by-word edit distance & similarity
    const words = normalizedText.split(' ').filter((w) => w.length >= 3);
    let minWordDist = 99;
    let maxWordSim = 0;

    for (const word of words) {
      const allowed = maxAllowedDistance(normalizedQuery.length, word.length);
      const dist = editDistance(normalizedQuery, word);
      const sim = stringSimilarity(normalizedQuery, word);
      const sharesPrefix =
        normalizedQuery.length >= 4 &&
        word.length >= 4 &&
        normalizedQuery.slice(0, 3) === word.slice(0, 3);

      if ((allowed > 0 && dist <= allowed) || (sim >= 0.70 && sharesPrefix)) {
        if (dist < minWordDist) minWordDist = dist;
        if (sim > maxWordSim) maxWordSim = sim;
      }
    }

    if (minWordDist <= 3 || maxWordSim >= 0.70) {
      const computedScore = Math.min(40, Math.max(25, Math.round(maxWordSim * 42)));
      return { isMatch: true, distance: minWordDist, score: computedScore, fuzzy: true };
    }

    return { isMatch: false, distance: 99, score: 0 };
  }

  // Strict relevance ranking order:
  // 1. Exact product name (100)
  // 2. Exact brand match (95)
  // 3. Exact generic name (90)
  // 4. Exact active ingredient match (85)
  // 5. Prefix product name / brand (80)
  // 6. Prefix generic / active ingredient (75)
  // 7. Partial product name / brand (70)
  // 8. Partial generic / active ingredient (66)
  // 9. Pharmacy synonym match (62)
  // 10. Category / taxonomy match (54)
  // 11. Description / manufacturer match (45)
  // 12. Fuzzy / typo match on name, brand, or generic (25-42)
  scoreMedicine(medicine, normalizedQuery, expandedSynonyms) {
    let score = 0;
    let matchType = 'none';
    let matchedField = null;

    const medName = medicine.name || '';
    const brandName = medicine.brandName || '';
    const genericName = medicine.genericName || '';
    const category = medicine.category || '';
    const description = medicine.description || '';
    const manufacturer = medicine.manufacturer || '';

    const normName = normalizeSearchTerm(medName);
    const normBrand = normalizeSearchTerm(brandName);
    const normGeneric = normalizeSearchTerm(genericName);
    const normCategory = normalizeSearchTerm(category);
    const normDesc = normalizeSearchTerm(description);
    const normManufacturer = normalizeSearchTerm(manufacturer);
    const ingredients = splitIngredients(genericName);

    const taxonomyNames = [
      medicine.MainCategory?.name,
      medicine.Subcategory?.name,
      medicine.ProductForm?.name,
      category,
    ]
      .filter(Boolean)
      .map((t) => normalizeSearchTerm(t));

    // 1. Exact product name match
    if (normName && normName === normalizedQuery) {
      return { score: 100, matchType: 'exact_name', matchedField: 'name' };
    }

    // 2. Exact brand match
    if (normBrand && normBrand === normalizedQuery) {
      return { score: 95, matchType: 'exact_brand', matchedField: 'brandName' };
    }

    // 3. Exact generic name match
    if (normGeneric && normGeneric === normalizedQuery) {
      return { score: 90, matchType: 'exact_generic', matchedField: 'genericName' };
    }

    // 4. Exact active ingredient match (e.g., "ascorbic acid" in "Ascorbic Acid + Zinc")
    if (ingredients.some((ing) => ing === normalizedQuery)) {
      return { score: 85, matchType: 'active_ingredient', matchedField: 'genericName' };
    }

    // 5. Prefix match on product name or brand
    const nameWords = normName ? normName.split(' ') : [];
    const brandWords = normBrand ? normBrand.split(' ') : [];
    if (
      (normName && (normName.startsWith(normalizedQuery) || nameWords.some((w) => w.startsWith(normalizedQuery)))) ||
      (normBrand && (normBrand.startsWith(normalizedQuery) || brandWords.some((w) => w.startsWith(normalizedQuery))))
    ) {
      return { score: 80, matchType: 'prefix_name', matchedField: normBrand.startsWith(normalizedQuery) ? 'brandName' : 'name' };
    }

    // 6. Prefix match on generic name / active ingredient
    const genericWords = normGeneric ? normGeneric.split(' ') : [];
    if (
      normGeneric &&
      (normGeneric.startsWith(normalizedQuery) ||
        ingredients.some((ing) => ing.startsWith(normalizedQuery)) ||
        genericWords.some((w) => w.startsWith(normalizedQuery)))
    ) {
      return { score: 75, matchType: 'prefix_generic', matchedField: 'genericName' };
    }

    // 7. Partial match on product name or brand (substring or all query tokens)
    const queryTokens = normalizedQuery.split(' ').filter((t) => t.length >= 2);
    const allTokensInTitle =
      queryTokens.length > 1 &&
      queryTokens.every((t) => normName.includes(t) || normBrand.includes(t) || normGeneric.includes(t));

    if (
      (normName && normName.includes(normalizedQuery)) ||
      (normBrand && normBrand.includes(normalizedQuery)) ||
      allTokensInTitle
    ) {
      score = 70;
      matchType = 'partial_name';
      matchedField = 'name';
    }

    // 8. Partial match on generic name / active ingredient
    if (score < 66 && normGeneric && normGeneric.includes(normalizedQuery)) {
      score = 66;
      matchType = 'partial_generic';
      matchedField = 'genericName';
    }

    // 9. Pharmacy synonym match
    if (score < 62) {
      for (const synTerm of expandedSynonyms.terms) {
        if (synTerm === normalizedQuery) continue;
        if (
          (normName && normName.includes(synTerm)) ||
          (normGeneric && normGeneric.includes(synTerm)) ||
          (normBrand && normBrand.includes(synTerm)) ||
          (normDesc && normDesc.includes(synTerm))
        ) {
          score = 62;
          matchType = 'synonym';
          matchedField = 'synonym';
          break;
        }
      }
    }

    // 10. Category or taxonomy hierarchy match (including synonym target categories)
    if (score < 54) {
      const matchesSynonymCategory = expandedSynonyms.categories.some((c) => {
        const normC = normalizeSearchTerm(c);
        return taxonomyNames.some((t) => t.includes(normC) || normC.includes(t));
      });
      if (matchesSynonymCategory) {
        score = 54;
        matchType = 'category_synonym';
        matchedField = 'category';
      } else if (taxonomyNames.some((t) => t.includes(normalizedQuery)) || (normCategory && normCategory.includes(normalizedQuery))) {
        score = 50;
        matchType = 'category';
        matchedField = 'category';
      }
    }

    // 11. Description or manufacturer match
    if (score < 45) {
      if ((normDesc && normDesc.includes(normalizedQuery)) || (normManufacturer && normManufacturer.includes(normalizedQuery))) {
        score = 45;
        matchType = 'description';
        matchedField = normDesc.includes(normalizedQuery) ? 'description' : 'manufacturer';
      }
    }

    // 12. Fuzzy / typo match on Name, Brand, or Generic Name
    if (score < 42) {
      const nameFuzzy = this.evaluateFuzzyMatch(normalizedQuery, medName);
      if (nameFuzzy.isMatch && nameFuzzy.score > score) {
        score = nameFuzzy.score;
        matchType = 'fuzzy_name';
        matchedField = 'name';
      }

      if (brandName) {
        const brandFuzzy = this.evaluateFuzzyMatch(normalizedQuery, brandName);
        if (brandFuzzy.isMatch && brandFuzzy.score > score) {
          score = brandFuzzy.score;
          matchType = 'fuzzy_brand';
          matchedField = 'brandName';
        }
      }

      if (genericName) {
        const genericFuzzy = this.evaluateFuzzyMatch(normalizedQuery, genericName);
        if (genericFuzzy.isMatch && genericFuzzy.score > score) {
          score = genericFuzzy.score;
          matchType = 'fuzzy_generic';
          matchedField = 'genericName';
        }
      }
    }

    return { score, matchType, matchedField };
  }

  // Find spelling correction suggestion (e.g. "paracetmol" -> "Paracetamol")
  async findSpellingSuggestion(normalizedQuery, candidateMedicines) {
    if (!normalizedQuery || normalizedQuery.length < 3) return null;
    const allowedDist = maxAllowedDistance(normalizedQuery.length);
    if (allowedDist === 0) return null;

    let bestCandidate = null;
    let minDistance = 99;

    for (const med of candidateMedicines) {
      const names = [med.name, med.genericName, med.brandName].filter(Boolean);
      for (const name of names) {
        const norm = normalizeSearchTerm(name);
        if (norm === normalizedQuery) return null; // exact match exists

        const allowed = maxAllowedDistance(normalizedQuery.length, norm.length);
        const dist = editDistance(normalizedQuery, norm);
        const sim = stringSimilarity(normalizedQuery, norm);
        const sharesPrefix =
          normalizedQuery.length >= 3 &&
          norm.length >= 3 &&
          normalizedQuery.slice(0, 3) === norm.slice(0, 3);

        if ((dist <= allowed || (sim >= 0.70 && sharesPrefix)) && dist < minDistance) {
          minDistance = dist;
          bestCandidate = name;
        }

        const tokens = norm.split(' ');
        for (const token of tokens) {
          if (token.length >= 3) {
            const tokenAllowed = maxAllowedDistance(normalizedQuery.length, token.length);
            const tokenDist = editDistance(normalizedQuery, token);
            const tokenSim = stringSimilarity(normalizedQuery, token);
            const tokenPrefix =
              normalizedQuery.length >= 3 &&
              token.length >= 3 &&
              normalizedQuery.slice(0, 3) === token.slice(0, 3);
            if ((tokenDist <= tokenAllowed || (tokenSim >= 0.70 && tokenPrefix)) && tokenDist < minDistance) {
              minDistance = tokenDist;
              bestCandidate = token.charAt(0).toUpperCase() + token.slice(1);
            }
          }
        }
      }
    }

    // Also check synonym terms
    const synonymMap = await this.getSynonymMap();
    for (const term of synonymMap.keys()) {
      const dist = editDistance(normalizedQuery, term);
      if (dist > 0 && dist <= allowedDist && dist < minDistance) {
        minDistance = dist;
        bestCandidate = term.charAt(0).toUpperCase() + term.slice(1);
      }
    }

    return bestCandidate;
  }

  // Two-stage dialect-aware candidate retrieval:
  // Stage 1: SQL pre-filter with bounded limit (avoids loading the entire catalogue + batches)
  // Stage 2: Lightweight projection fallback (no Batch joins) only when Stage 1 yields zero matches,
  //          hydrating only matched IDs with full associations.
  async fetchCandidateMedicines(normalizedQuery, expandedSynonyms, baseWhere) {
    const includes = [
      { model: Batch, where: activeBatchWhere(), required: false },
      { model: InventoryCategory, as: 'MainCategory', attributes: ['id', 'name', 'slug'] },
      { model: InventoryCategory, as: 'Subcategory', attributes: ['id', 'name', 'slug'] },
      { model: InventoryCategory, as: 'ProductForm', attributes: ['id', 'name', 'slug'] },
    ];

    const anchorFragments = buildSqlAnchorFragments(normalizedQuery, expandedSynonyms.terms);
    const searchableCols = ['name', 'brandName', 'genericName', 'category', 'description', 'manufacturer'];
    const orClauses = [];

    for (const fragment of anchorFragments) {
      const pattern = `%${fragment}%`;
      for (const col of searchableCols) {
        orClauses.push(this.buildCaseInsensitiveLike(col, pattern));
      }
    }

    // Include synonym target categories in SQL pre-filter
    for (const cat of expandedSynonyms.categories) {
      orClauses.push(this.buildCaseInsensitiveLike('category', `%${cat}%`));
    }

    // Also include category IDs matching any query/synonym category in InventoryCategories
    const catLookupTerms = [normalizedQuery, ...expandedSynonyms.categories].filter((t) => t && t.length >= 3);
    if (catLookupTerms.length > 0) {
      const isPostgres = sequelize.getDialect() === 'postgres';
      const catOr = catLookupTerms.map((term) =>
        isPostgres
          ? { name: { [Op.iLike]: `%${term}%` } }
          : sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'LIKE', `%${term.toLowerCase()}%`)
      );
      const matchedCats = await InventoryCategory.findAll({
        where: { [Op.or]: catOr },
        attributes: ['id'],
        limit: 25,
      });
      const catIds = matchedCats.map((c) => c.id);
      if (catIds.length > 0) {
        orClauses.push({ mainCategoryId: { [Op.in]: catIds } });
        orClauses.push({ subcategoryId: { [Op.in]: catIds } });
        orClauses.push({ productFormId: { [Op.in]: catIds } });
      }
    }

    let candidates = [];
    if (orClauses.length > 0) {
      candidates = await Medicine.findAll({
        where: {
          ...baseWhere,
          [Op.or]: orClauses,
        },
        include: includes,
        limit: 250,
      });
    }

    if (candidates.length > 0) {
      return candidates;
    }

    // Stage 2: Lightweight projection scan (no Batch/Category joins) bounded to 500 rows
    // catches severe prefix typos (e.g., transposed first letters) and generates spelling suggestions.
    const lightweightRows = await Medicine.findAll({
      where: baseWhere,
      attributes: ['id', 'name', 'brandName', 'genericName', 'category', 'description', 'manufacturer'],
      limit: 500,
    });

    const matchedIds = [];
    for (const row of lightweightRows) {
      const { score } = this.scoreMedicine(row, normalizedQuery, expandedSynonyms);
      if (score > 0) matchedIds.push(row.id);
    }

    if (matchedIds.length === 0) {
      return lightweightRows;
    }

    return Medicine.findAll({
      where: { id: { [Op.in]: matchedIds.slice(0, 100) } },
      include: includes,
    });
  }

  async buildSuggestedSearchTerms(normalizedQuery, spellingSuggestion, expandedSynonyms) {
    const terms = new Set();
    if (spellingSuggestion) terms.add(spellingSuggestion);

    for (const syn of expandedSynonyms.terms) {
      if (syn !== normalizedQuery) {
        terms.add(syn.charAt(0).toUpperCase() + syn.slice(1));
      }
      if (terms.size >= 5) break;
    }

    if (terms.size < 4) {
      const synonymMap = await this.getSynonymMap();
      const defaults = ['Pain relief', 'Vitamin C', 'ORS', 'Antibiotics', 'Allergy'];
      for (const fallback of defaults) {
        if (terms.size >= 5) break;
        if (normalizeSearchTerm(fallback) !== normalizedQuery && (synonymMap.has(normalizeSearchTerm(fallback)) || terms.size < 4)) {
          terms.add(fallback);
        }
      }
    }

    return Array.from(terms).slice(0, 5);
  }

  // Main intelligent search method
  async searchProducts({
    query,
    subcategoryId,
    productFormId,
    prescriptionRequired,
    sessionId = null,
    trackAnalytics = true,
  }) {
    const rawQuery = String(query || '').trim();
    const normalizedQuery = normalizeSearchTerm(rawQuery);

    if (!normalizedQuery) {
      return null;
    }

    const expandedSynonyms = await this.expandQueryWithSynonyms(normalizedQuery);

    const candidateWhere = { isCustomerVisible: true };
    if (prescriptionRequired !== undefined && prescriptionRequired !== '') {
      candidateWhere.prescriptionRequired = String(prescriptionRequired) === 'true';
    }
    if (subcategoryId && !isNaN(Number(subcategoryId))) {
      candidateWhere.subcategoryId = Number(subcategoryId);
    }
    if (productFormId && !isNaN(Number(productFormId))) {
      candidateWhere.productFormId = Number(productFormId);
    }

    const candidates = await this.fetchCandidateMedicines(normalizedQuery, expandedSynonyms, candidateWhere);

    // Score, deduplicate, and rank each candidate medicine
    const scoredProducts = [];
    const seenIds = new Set();

    for (const med of candidates) {
      if (seenIds.has(med.id)) continue;

      const { score, matchType, matchedField } = this.scoreMedicine(med, normalizedQuery, expandedSynonyms);

      if (score > 0) {
        seenIds.add(med.id);
        scoredProducts.push({
          medicine: med,
          score,
          matchType,
          matchedField,
          inStock: calculateAvailableStock(med) > 0,
        });
      }
    }

    // Sort by: 1. Relevance score desc, 2. In-stock first, 3. Product name asc
    scoredProducts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.inStock !== a.inStock) return (b.inStock ? 1 : 0) - (a.inStock ? 1 : 0);
      return String(a.medicine.name || '').localeCompare(String(b.medicine.name || ''));
    });

    // Spelling suggestion when zero results or top match is fuzzy/weak
    let spellingSuggestion = null;
    if (scoredProducts.length === 0 || scoredProducts[0].score < 75) {
      spellingSuggestion = await this.findSpellingSuggestion(normalizedQuery, candidates);
    }

    // Related category suggestions
    const categorySuggestions = new Set();
    expandedSynonyms.categories.forEach((c) => categorySuggestions.add(c));
    if (categorySuggestions.size === 0 && scoredProducts.length > 0) {
      scoredProducts.slice(0, 3).forEach((p) => {
        const catLabel = p.medicine.Subcategory?.name || p.medicine.MainCategory?.name || p.medicine.category;
        if (catLabel) categorySuggestions.add(catLabel);
      });
    }

    const suggestedSearchTerms = await this.buildSuggestedSearchTerms(
      normalizedQuery,
      spellingSuggestion,
      expandedSynonyms
    );

    if (trackAnalytics) {
      this.recordSearchAnalytics({
        query: rawQuery,
        normalizedQuery,
        resultsCount: scoredProducts.length,
        sessionId,
      }).catch(() => {});
    }

    return {
      scoredProducts,
      totalCount: scoredProducts.length,
      spellingSuggestion,
      categorySuggestions: Array.from(categorySuggestions),
      suggestedSearchTerms,
      expandedSynonyms: expandedSynonyms.terms.filter((t) => t !== normalizedQuery),
    };
  }

  // Fast autocomplete suggestions for live typing (does not inflate search analytics on every keystroke)
  async getAutocompleteSuggestions(query, limit = 8) {
    const rawQuery = String(query || '').trim();
    const normalizedQuery = normalizeSearchTerm(rawQuery);
    const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 15);

    if (!normalizedQuery || normalizedQuery.length < 1) {
      return { products: [], suggestions: [], categories: [], didYouMean: null };
    }

    const searchResult = await this.searchProducts({
      query: rawQuery,
      trackAnalytics: false,
    });

    if (!searchResult) {
      return { products: [], suggestions: [], categories: [], didYouMean: null };
    }

    const { scoredProducts, spellingSuggestion, categorySuggestions } = searchResult;

    const topProducts = scoredProducts.slice(0, safeLimit).map(({ medicine, matchType, score }) => ({
      id: medicine.id,
      name: medicine.name,
      genericName: medicine.genericName,
      brandName: medicine.brandName,
      strength: medicine.strength,
      dosage: medicine.dosage,
      category: medicine.MainCategory?.name || medicine.category,
      price: calculateProductPrice(medicine),
      imageUrl: medicine.imageUrl,
      prescriptionRequired: Boolean(medicine.prescriptionRequired),
      matchType,
      score,
    }));

    const suggestions = [];
    if (spellingSuggestion) {
      suggestions.push(spellingSuggestion);
    }

    topProducts.slice(0, 4).forEach((p) => {
      if (p.name && !suggestions.includes(p.name)) suggestions.push(p.name);
      if (p.genericName && !suggestions.includes(p.genericName)) suggestions.push(p.genericName);
    });

    return {
      products: topProducts,
      suggestions: suggestions.slice(0, 6),
      categories: categorySuggestions.slice(0, 3),
      didYouMean: spellingSuggestion,
    };
  }

  // Similar Products with Strict Medical Safety Rules:
  // - Never classify products with different or unknown active ingredients/strengths as DIRECT_EQUIVALENT.
  // - Clearly separate direct generic equivalents, different strengths/forms, and related therapeutic class.
  async getProductAlternatives(productId) {
    const target = await Medicine.findByPk(productId, {
      include: [
        { model: Batch, where: activeBatchWhere(), required: false },
        { model: InventoryCategory, as: 'MainCategory' },
        { model: InventoryCategory, as: 'Subcategory' },
        { model: InventoryCategory, as: 'ProductForm' },
      ],
    });

    if (!target || target.isCustomerVisible === false) return null;

    const targetGeneric = normalizeSearchTerm(target.genericName);
    const targetStrength = normalizeSearchTerm(target.strength);
    const targetDosage = normalizeSearchTerm(target.dosage);
    const targetSubcategoryId = target.subcategoryId;
    const targetMainCategoryId = target.mainCategoryId;
    const targetCategory = normalizeSearchTerm(target.category);

    // Query only bounded, relevant candidates rather than loading the entire catalogue
    const matchClauses = [];
    if (targetGeneric) {
      matchClauses.push(this.buildCaseInsensitiveLike('genericName', `%${targetGeneric}%`));
    }
    if (targetSubcategoryId) {
      matchClauses.push({ subcategoryId: targetSubcategoryId });
    } else if (targetMainCategoryId) {
      matchClauses.push({ mainCategoryId: targetMainCategoryId });
    } else if (targetCategory) {
      matchClauses.push(this.buildCaseInsensitiveLike('category', `%${targetCategory}%`));
    }

    if (matchClauses.length === 0) {
      return {
        targetProduct: {
          id: target.id,
          name: target.name,
          genericName: target.genericName,
          brandName: target.brandName,
          strength: target.strength,
          dosage: target.dosage,
          category: target.MainCategory?.name || target.category,
        },
        directEquivalents: [],
        differentStrengthOrForm: [],
        relatedTherapeutic: [],
      };
    }

    const candidates = await Medicine.findAll({
      where: {
        id: { [Op.ne]: target.id },
        isCustomerVisible: true,
        [Op.or]: matchClauses,
      },
      include: [
        { model: Batch, where: activeBatchWhere(), required: false },
        { model: InventoryCategory, as: 'MainCategory' },
        { model: InventoryCategory, as: 'Subcategory' },
        { model: InventoryCategory, as: 'ProductForm' },
      ],
      limit: 100,
    });

    // Prioritize in-stock items within each safety tier
    candidates.sort((a, b) => {
      const aStock = calculateAvailableStock(a) > 0 ? 1 : 0;
      const bStock = calculateAvailableStock(b) > 0 ? 1 : 0;
      if (bStock !== aStock) return bStock - aStock;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const directEquivalents = [];
    const differentStrengthOrForm = [];
    const relatedTherapeutic = [];

    for (const cand of candidates) {
      const candGeneric = normalizeSearchTerm(cand.genericName);
      const candStrength = normalizeSearchTerm(cand.strength);
      const candDosage = normalizeSearchTerm(cand.dosage);

      // Rule 1: Same active ingredient
      if (targetGeneric && candGeneric && targetGeneric === candGeneric) {
        const hasVerifiedMatchingStrengthAndForm =
          Boolean(targetStrength) &&
          Boolean(candStrength) &&
          targetStrength === candStrength &&
          Boolean(targetDosage) &&
          Boolean(candDosage) &&
          targetDosage === candDosage;

        if (hasVerifiedMatchingStrengthAndForm) {
          directEquivalents.push({
            medicine: cand,
            level: 'DIRECT_EQUIVALENT',
            badge: 'Generic Equivalent',
            pharmacistReviewRequired: true,
            medicalSafetyNotice:
              'Equivalent active ingredient, strength, and dosage form. Suitable direct alternative under pharmacist supervision.',
          });
        } else {
          differentStrengthOrForm.push({
            medicine: cand,
            level: 'DIFFERENT_STRENGTH_OR_FORM',
            badge: 'Same Ingredient (Verify Strength/Form)',
            pharmacistReviewRequired: true,
            medicalSafetyNotice: `Contains ${cand.genericName || 'the same active ingredient'} in a different or unverified strength/form (${[cand.strength, cand.dosage].filter(Boolean).join(' ') || 'check label'}). Do not substitute without pharmacist review.`,
          });
        }
      } else {
        // Rule 2: Same therapeutic subcategory or category (NOT an automatic substitute!)
        const sameSubcategory = targetSubcategoryId && cand.subcategoryId === targetSubcategoryId;
        const sameFallbackCategory =
          !targetSubcategoryId &&
          ((targetMainCategoryId && cand.mainCategoryId === targetMainCategoryId) ||
            (targetCategory && normalizeSearchTerm(cand.category) === targetCategory));

        if (sameSubcategory || sameFallbackCategory) {
          relatedTherapeutic.push({
            medicine: cand,
            level: 'THERAPEUTIC_CLASS',
            badge: 'Related Category',
            pharmacistReviewRequired: true,
            medicalSafetyNotice:
              'Related product in the same category. Contains a different or unverified active ingredient and is NOT a direct substitute. Consult a pharmacist before changing medicines.',
          });
        }
      }
    }

    return {
      targetProduct: {
        id: target.id,
        name: target.name,
        genericName: target.genericName,
        brandName: target.brandName,
        strength: target.strength,
        dosage: target.dosage,
        category: target.MainCategory?.name || target.category,
      },
      directEquivalents: directEquivalents.slice(0, 6),
      differentStrengthOrForm: differentStrengthOrForm.slice(0, 4),
      relatedTherapeutic: relatedTherapeutic.slice(0, 6),
    };
  }

  // Record Search Analytics
  async recordSearchAnalytics({ query, normalizedQuery, resultsCount, sessionId }) {
    if (!normalizedQuery || normalizedQuery.length < 2) return;
    try {
      await SearchAnalytics.create({
        query: String(query || '').slice(0, 255),
        normalizedQuery: normalizedQuery.slice(0, 255),
        resultsCount: Math.max(0, Number(resultsCount || 0)),
        hasResults: Number(resultsCount || 0) > 0,
        sessionId: sessionId ? String(sessionId).slice(0, 128) : null,
      });
    } catch (err) {
      // Non-blocking
    }
  }

  // Track product click from search
  async recordSearchClick({ query, productId, sessionId }) {
    const parsedProductId = Number(productId);
    if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
      return { recorded: false };
    }
    try {
      const normalizedQuery = normalizeSearchTerm(query);
      await SearchAnalytics.create({
        query: String(query || '').slice(0, 255),
        normalizedQuery: (normalizedQuery || '').slice(0, 255),
        resultsCount: 1,
        hasResults: true,
        clickedProductId: parsedProductId,
        sessionId: sessionId ? String(sessionId).slice(0, 128) : null,
      });
      return { recorded: true };
    } catch (err) {
      return { recorded: false };
    }
  }

  // Retrieve popular search terms, zero-result searches, and clicked products for admin analytics
  async getSearchAnalyticsSummary(days = 30) {
    const safeDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - safeDays);

    const searchWhere = {
      createdAt: { [Op.gte]: sinceDate },
      clickedProductId: { [Op.is]: null },
    };

    const [totalSearches, zeroResultCount, totalClicks, popularTerms, zeroResultSearches, topClickedRows] =
      await Promise.all([
        SearchAnalytics.count({ where: searchWhere }),
        SearchAnalytics.count({ where: { ...searchWhere, hasResults: false } }),
        SearchAnalytics.count({
          where: {
            createdAt: { [Op.gte]: sinceDate },
            clickedProductId: { [Op.not]: null },
          },
        }),
        SearchAnalytics.findAll({
          attributes: [
            'normalizedQuery',
            [sequelize.fn('COUNT', sequelize.col('id')), 'searchCount'],
            [sequelize.fn('MAX', sequelize.col('resultsCount')), 'maxResults'],
          ],
          where: searchWhere,
          group: ['normalizedQuery'],
          order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
          limit: 20,
        }),
        SearchAnalytics.findAll({
          attributes: [
            'normalizedQuery',
            [sequelize.fn('COUNT', sequelize.col('id')), 'failCount'],
          ],
          where: {
            ...searchWhere,
            hasResults: false,
          },
          group: ['normalizedQuery'],
          order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
          limit: 20,
        }),
        SearchAnalytics.findAll({
          attributes: [
            'clickedProductId',
            [sequelize.fn('COUNT', sequelize.col('id')), 'clickCount'],
          ],
          where: {
            createdAt: { [Op.gte]: sinceDate },
            clickedProductId: { [Op.not]: null },
          },
          group: ['clickedProductId'],
          order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
          limit: 20,
        }),
      ]);

    const clickedIds = topClickedRows.map((row) => row.clickedProductId).filter(Boolean);
    const clickedMedicines = clickedIds.length > 0
      ? await Medicine.findAll({
          where: { id: { [Op.in]: clickedIds } },
          attributes: ['id', 'name', 'brandName', 'genericName'],
        })
      : [];
    const medicineById = new Map(clickedMedicines.map((med) => [med.id, med]));

    return {
      periodDays: safeDays,
      totals: {
        totalSearches,
        zeroResultCount,
        totalClicks,
      },
      popularTerms: popularTerms.map((t) => ({
        query: t.normalizedQuery,
        count: Number(t.getDataValue('searchCount')),
        maxResults: Number(t.getDataValue('maxResults')),
      })),
      zeroResultSearches: zeroResultSearches.map((t) => ({
        query: t.normalizedQuery,
        count: Number(t.getDataValue('failCount')),
      })),
      topClickedProducts: topClickedRows.map((row) => {
        const med = medicineById.get(row.clickedProductId);
        return {
          productId: row.clickedProductId,
          name: med?.name || null,
          brandName: med?.brandName || null,
          genericName: med?.genericName || null,
          clicks: Number(row.getDataValue('clickCount')),
        };
      }),
    };
  }
}

const searchService = new SearchService();
searchService.calculateProductPrice = calculateProductPrice;
searchService.calculateAvailableStock = calculateAvailableStock;
searchService.normalizeSearchTerm = normalizeSearchTerm;

module.exports = searchService;
