import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams, useOutletContext } from "react-router-dom";
import { SlidersHorizontal, X, Sparkles } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { ProductCard, ProductCardSkeleton } from "../../components/store/ProductCard";
import PromotionalCarousel from "../../components/store/PromotionalCarousel";
import { SHOP_PROMOTIONAL_SLIDES } from "../../data/promotionalSlides";

export default function StoreShopPage() {
  const { openCart } = useOutletContext() || {};
  const { apiFetch } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchMeta, setSearchMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [productsError, setProductsError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Filter state
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "",
    subcategoryId: searchParams.get("subcategoryId") || "",
    productFormId: searchParams.get("productFormId") || "",
    prescriptionRequired: searchParams.get("prescriptionRequired") || "",
    sort: searchParams.get("sort") || "",
    minPrice: "",
    maxPrice: "",
  });

  const PER_PAGE = 20;

  useEffect(() => {
    apiFetch("/api/products/categories")
      .then(data => {
        setCategories(Array.isArray(data) ? data : []);
        setCategoriesError("");
      })
      .catch(error => setCategoriesError(error.message || "Product categories could not be loaded."));
  }, [apiFetch]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.category) params.set("category", filters.category);
      if (filters.subcategoryId) params.set("subcategoryId", filters.subcategoryId);
      if (filters.productFormId) params.set("productFormId", filters.productFormId);
      if (filters.prescriptionRequired !== "") params.set("prescriptionRequired", filters.prescriptionRequired);
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      params.set("page", String(page));
      params.set("limit", String(PER_PAGE));

      const data = await apiFetch(`/api/products?${params}`);
      const rows = data.data || data.products || data.rows || (Array.isArray(data) ? data : []);
      setProducts(rows);
      setTotal(data.pagination?.total ?? data.total ?? data.count ?? rows.length);
      setSearchMeta(data.search || null);
      setProductsError("");
    } catch (error) {
      setProducts([]);
      setSearchMeta(null);
      setProductsError(error.message || "Products could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, apiFetch]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Sync URL search param → filter
  useEffect(() => {
    const s = searchParams.get("search") || "";
    const c = searchParams.get("category") || "";
    const sort = searchParams.get("sort") || "";
    setFilters((f) => {
      if (f.search === s && f.category === c && f.sort === sort) return f;
      return { ...f, search: s, category: c, sort };
    });
    setPage(1);
  }, [searchParams]);

  const setFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "category" ? { subcategoryId: "", productFormId: "" } : {}),
      ...(key === "subcategoryId" ? { productFormId: "" } : {}),
    }));
    if (key === "search" || key === "category" || key === "sort") {
      const nextParams = new URLSearchParams(searchParams);
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
      setSearchParams(nextParams, { replace: true });
    }
    setPage(1);
  };

  const trackSearchResultClick = useCallback((productId) => {
    if (!filters.search || !productId) return;
    try {
      apiFetch?.("/api/products/search/click", {
        method: "POST",
        body: JSON.stringify({ query: filters.search, productId }),
      })?.catch?.(() => {});
    } catch (e) {
      // Non-blocking analytics
    }
  }, [filters.search, apiFetch]);
  const totalPages = Math.ceil(total / PER_PAGE);
  const selectedCategory = categories.find((category) => (
    category.slug === filters.category || String(category.id) === filters.category
  ));
  const subcategories = selectedCategory?.Children || [];
  const selectedSubcategory = subcategories.find((category) => String(category.id) === filters.subcategoryId);
  const productForms = selectedSubcategory?.Children || [];

  const SORT_OPTIONS = [
    { label: "Name (A–Z)", value: "" },
    { label: "Price: Low → High", value: "price_asc" },
    { label: "Price: High → Low", value: "price_desc" },
    { label: "Newest First", value: "newest" },
  ];

  const formattedCategoryTitle = selectedCategory?.name
    || (filters.category
      ? filters.category
          .split("-")
          .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
          .join(" ")
      : "");

  const headerTitle = filters.search
    ? `Search: "${filters.search}"`
    : formattedCategoryTitle || "All Products";

  const activeFilterCount = [
    filters.category,
    filters.subcategoryId,
    filters.productFormId,
    filters.prescriptionRequired,
    filters.minPrice,
    filters.maxPrice,
  ].filter(Boolean).length;

  return (
    <div className="store-shop-page">
      {/* Full-width, edge-to-edge promotional carousel */}
      <PromotionalCarousel
        slides={SHOP_PROMOTIONAL_SLIDES}
        autoPlayInterval={16000}
        ariaLabel="MediQuick Shop Promotions"
      />

      <div className="store-section store-shop-section">
        <div className="store-container">
          {/* Compact Shop identity + Filters & Sort toolbar */}
          <div className="store-shop-heading-bar">
            <div className="store-shop-heading-bar__identity">
              <nav className="store-shop-banner__breadcrumb" aria-label="Breadcrumb">
                <Link to="/">Home</Link>
                <span className="store-shop-banner__sep" aria-hidden="true">›</span>
                <span>Shop</span>
                {formattedCategoryTitle && !filters.search && (
                  <>
                    <span className="store-shop-banner__sep" aria-hidden="true">›</span>
                    <span>{formattedCategoryTitle}</span>
                  </>
                )}
                {filters.search && (
                  <>
                    <span className="store-shop-banner__sep" aria-hidden="true">›</span>
                    <span>&ldquo;{filters.search}&rdquo;</span>
                  </>
                )}
              </nav>
              <div className="store-shop-heading-bar__title-row">
                <h1 className="store-shop-banner__title">{headerTitle}</h1>
                <p className="store-shop-banner__count" data-testid="shop-product-count">
                  {loading
                    ? "Loading products…"
                    : `${total} product${total !== 1 ? "s" : ""} found`}
                </p>
              </div>
            </div>

            <div className="store-shop-toolbar__controls">
              <button
                type="button"
                className={`store-shop-toolbar__filter-btn${filtersOpen ? " is-open" : ""}`}
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="store-shop-toolbar__filter-badge">{activeFilterCount}</span>
                )}
              </button>
              <select
                aria-label="Sort products"
                className="store-shop-toolbar__sort-select"
                value={filters.sort}
                onChange={e => setFilter("sort", e.target.value)}
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {(filters.search || filters.category || filters.prescriptionRequired) && (
            <div className="store-shop-toolbar store-shop-toolbar--chips-only">
              <div className="store-shop-toolbar__chips">
                {filters.search && (
                  <span className="store-shop-chip">
                    Search: {filters.search}
                    <button
                      type="button"
                      aria-label="Clear search filter"
                      onClick={() => setFilter("search", "")}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {filters.category && (
                  <span className="store-shop-chip">
                    Category: {formattedCategoryTitle || filters.category}
                    <button
                      type="button"
                      aria-label="Clear category filter"
                      onClick={() => setFilter("category", "")}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {filters.prescriptionRequired === "false" && (
                  <span className="store-shop-chip store-shop-chip--otc">
                    OTC Only
                    <button
                      type="button"
                      aria-label="Clear OTC filter"
                      onClick={() => setFilter("prescriptionRequired", "")}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {filters.prescriptionRequired === "true" && (
                  <span className="store-shop-chip store-shop-chip--rx">
                    Prescription Only
                    <button
                      type="button"
                      aria-label="Clear prescription filter"
                      onClick={() => setFilter("prescriptionRequired", "")}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

        {/* Spelling suggestion banner ("Did you mean?") */}
        {filters.search && searchMeta?.spellingSuggestion && (
          <div className="store-did-you-mean-banner">
            <Sparkles size={16} className="store-did-you-mean-icon" />
            <span>Did you mean:</span>
            <button
              type="button"
              className="store-did-you-mean-link"
              onClick={() => setFilter("search", searchMeta.spellingSuggestion)}
            >
              <strong>{searchMeta.spellingSuggestion}</strong>
            </button>
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>?</span>
          </div>
        )}

        {/* Related Category Suggestions from Search */}
        {filters.search && searchMeta?.categorySuggestions && searchMeta.categorySuggestions.length > 0 && (
          <div className="store-search-cat-suggestions">
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>Suggested Categories:</span>
            {searchMeta.categorySuggestions.map((catName) => (
              <button
                key={catName}
                type="button"
                className="store-search-cat-pill"
                onClick={() => setFilter("category", catName)}
              >
                {catName}
              </button>
            ))}
          </div>
        )}

        {/* Filters panel (mobile collapsible / always visible on desktop) */}
        {filtersOpen && (
          <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "1.25rem", marginBottom: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
            <div className="store-filter-group">
              <div className="store-filter-group__label">Search</div>
              <input
                type="text" placeholder="Search products..."
                className="store-price-input" style={{ width: "100%" }}
                value={filters.search} onChange={e => setFilter("search", e.target.value)}
              />
            </div>
            <div className="store-filter-group">
              <div className="store-filter-group__label">Category</div>
              <select
                className="store-price-input"
                style={{ width: "100%", cursor: "pointer", background: "white" }}
                value={filters.category}
                onChange={e => setFilter("category", e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
              </select>
            </div>
            {selectedCategory && subcategories.length > 0 && (
              <div className="store-filter-group">
                <div className="store-filter-group__label">Subcategory</div>
                <select className="store-price-input" style={{ width: "100%", cursor: "pointer", background: "white" }} value={filters.subcategoryId} onChange={e => setFilter("subcategoryId", e.target.value)}>
                  <option value="">All {selectedCategory.name}</option>
                  {subcategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
            )}
            {selectedSubcategory && productForms.length > 0 && (
              <div className="store-filter-group">
                <div className="store-filter-group__label">Product form</div>
                <select className="store-price-input" style={{ width: "100%", cursor: "pointer", background: "white" }} value={filters.productFormId} onChange={e => setFilter("productFormId", e.target.value)}>
                  <option value="">All forms</option>
                  {productForms.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
            )}
            <div className="store-filter-group">
              <div className="store-filter-group__label">Type</div>
              <label className="store-filter-option">
                <input type="radio" name="rxFilter" checked={filters.prescriptionRequired === ""} onChange={() => setFilter("prescriptionRequired", "")} />
                <span>All</span>
              </label>
              <label className="store-filter-option">
                <input type="radio" name="rxFilter" checked={filters.prescriptionRequired === "false"} onChange={() => setFilter("prescriptionRequired", "false")} />
                <span>OTC Only</span>
              </label>
              <label className="store-filter-option">
                <input type="radio" name="rxFilter" checked={filters.prescriptionRequired === "true"} onChange={() => setFilter("prescriptionRequired", "true")} />
                <span>Prescription Required</span>
              </label>
            </div>
            <div className="store-filter-group">
              <div className="store-filter-group__label">Price Range (ZMW)</div>
              <div className="store-price-inputs">
                <input type="number" placeholder="Min" className="store-price-input" value={filters.minPrice} onChange={e => setFilter("minPrice", e.target.value)} />
                <input type="number" placeholder="Max" className="store-price-input" value={filters.maxPrice} onChange={e => setFilter("maxPrice", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {categoriesError && <div className="store-error" role="alert">{categoriesError}</div>}
        {productsError && <div className="store-error" role="alert">{productsError} <button type="button" onClick={fetchProducts}>Retry</button></div>}
        <div className="store-product-grid store-product-grid--5">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : productsError
              ? null
              : products.length === 0
              ? (
                <div className="store-no-results">
                  <p style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</p>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                    No products found {filters.search && <span>for &ldquo;<strong>{filters.search}</strong>&rdquo;</span>}
                  </h3>

                  {/* Spelling correction prompt */}
                  {searchMeta?.spellingSuggestion && (
                    <div className="store-no-results__correction">
                      <p style={{ fontSize: "0.92rem", marginBottom: "0.5rem", color: "var(--brand-blue)" }}>
                        Did you mean to search for:
                      </p>
                      <button
                        type="button"
                        onClick={() => setFilter("search", searchMeta.spellingSuggestion)}
                        className="store-no-results__correction-btn"
                      >
                        Search for &ldquo;{searchMeta.spellingSuggestion}&rdquo; &rarr;
                      </button>
                    </div>
                  )}

                  {/* Suggested Related Search Terms */}
                  {searchMeta?.suggestedSearchTerms && searchMeta.suggestedSearchTerms.length > 0 && (
                    <div style={{ marginTop: "1rem", marginBottom: "0.75rem" }}>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                        Try searching for:
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                        {searchMeta.suggestedSearchTerms.map((term) => (
                          <button
                            key={term}
                            type="button"
                            className="store-search-cat-pill"
                            onClick={() => setFilter("search", term)}
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related search category pills */}
                  {searchMeta?.categorySuggestions && searchMeta.categorySuggestions.length > 0 && (
                    <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                        Browse related categories:
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                        {searchMeta.categorySuggestions.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            className="store-search-cat-pill"
                            onClick={() => {
                              setFilters((current) => ({ ...current, category: cat, search: "", subcategoryId: "", productFormId: "" }));
                              setSearchParams({ category: cat }, { replace: true });
                              setPage(1);
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p style={{ fontSize: "0.88rem", marginTop: "0.5rem", color: "var(--text-secondary)" }}>
                    Check your spelling, or try searching by generic active ingredient or brand name.
                  </p>
                  <button
                    onClick={() => {
                      setFilters({ search: "", category: "", subcategoryId: "", productFormId: "", prescriptionRequired: "", sort: "", minPrice: "", maxPrice: "" });
                      setSearchParams({}, { replace: true });
                      setPage(1);
                    }}
                    className="store-no-results__clear-btn"
                  >
                    Clear All Filters
                  </button>

                  {/* Related products when no exact match */}
                  {searchMeta?.relatedProducts && searchMeta.relatedProducts.length > 0 && (
                    <div style={{ marginTop: "3rem", textAlign: "left" }}>
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.75rem", marginBottom: "1.25rem" }}>
                        <h4 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)" }}>
                          Related Products You Might Be Interested In
                        </h4>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                          Health products related to your search
                        </p>
                      </div>
                      <div className="store-product-grid store-product-grid--5">
                        {searchMeta.relatedProducts.map((p) => (
                          <ProductCard key={p.id} product={p} onCartOpen={openCart} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
              : products.map(p => (
                <div key={p.id} onClickCapture={() => trackSearchResultClick(p.id)}>
                  <ProductCard product={p} onCartOpen={openCart} />
                </div>
              ))
          }
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="store-pagination">
            <button className="store-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = i + Math.max(1, page - 3);
              if (p > totalPages) return null;
              return (
                <button key={p} className={`store-page-btn ${page === p ? "active" : ""}`} onClick={() => setPage(p)}>
                  {p}
                </button>
              );
            })}
            <button className="store-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
