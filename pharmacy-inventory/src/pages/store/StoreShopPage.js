import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { ProductCard, ProductCardSkeleton } from "../../components/store/ProductCard";
import { useOutletContext } from "react-router-dom";

export default function StoreShopPage() {
  const { openCart } = useOutletContext() || {};
  const { apiFetch } = useStore();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
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
    inStock: searchParams.get("inStock") || "",
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
      if (filters.inStock) params.set("inStock", filters.inStock);
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      params.set("page", String(page));
      params.set("limit", String(PER_PAGE));

      const data = await apiFetch(`/api/products?${params}`);
      const rows = data.data || data.products || data.rows || (Array.isArray(data) ? data : []);
      setProducts(rows);
      setTotal(data.pagination?.total ?? data.total ?? data.count ?? rows.length);
      setProductsError("");
    } catch (error) {
      setProducts([]);
      setProductsError(error.message || "Products could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, apiFetch]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Sync URL search param → filter
  useEffect(() => {
    const s = searchParams.get("search");
    const c = searchParams.get("category");
    if (s || c) {
      setFilters(f => ({ ...f, search: s || f.search, category: c || f.category }));
    }
  }, [searchParams]);

  const setFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "category" ? { subcategoryId: "", productFormId: "" } : {}),
      ...(key === "subcategoryId" ? { productFormId: "" } : {}),
    }));
    setPage(1);
  };
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

  return (
    <div className="store-section" style={{ paddingTop: "1.5rem" }}>
      <div className="store-container">
        {/* Breadcrumb */}
        <div className="store-breadcrumb">
          <Link to="/">Home</Link>
          <span className="store-breadcrumb__sep">›</span>
          <span>Shop</span>
          {filters.search && <><span className="store-breadcrumb__sep">›</span><span>"{filters.search}"</span></>}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: "800" }}>
              {filters.search ? `Search: "${filters.search}"` : filters.category ? `${filters.category.charAt(0).toUpperCase() + filters.category.slice(1)}` : "All Products"}
            </h1>
            {!loading && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>{total} product{total !== 1 ? "s" : ""} found</p>}
          </div>

          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button className="store-filter-option" style={{ gap: "0.4rem", padding: "0.5rem 0.85rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
              onClick={() => setFiltersOpen(!filtersOpen)}>
              <SlidersHorizontal size={15} /> Filters
            </button>
            <select
              value={filters.sort}
              onChange={e => setFilter("sort", e.target.value)}
              style={{ padding: "0.5rem 0.75rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Active filters */}
        {(filters.search || filters.category || filters.subcategoryId || filters.productFormId || filters.prescriptionRequired !== "" || filters.inStock) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
            {filters.search && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.75rem", background: "var(--brand-blue-light)", color: "var(--brand-blue)", borderRadius: "999px", fontSize: "0.82rem", fontWeight: 600 }}>
                Search: {filters.search}
                <button onClick={() => setFilter("search", "")} style={{ color: "var(--brand-blue)", display: "flex" }}><X size={12} /></button>
              </span>
            )}
            {filters.category && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.75rem", background: "var(--brand-blue-light)", color: "var(--brand-blue)", borderRadius: "999px", fontSize: "0.82rem", fontWeight: 600 }}>
                Category: {filters.category}
                <button onClick={() => setFilter("category", "")} style={{ color: "var(--brand-blue)", display: "flex" }}><X size={12} /></button>
              </span>
            )}
            {filters.prescriptionRequired === "false" && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.75rem", background: "var(--green-light)", color: "var(--green)", borderRadius: "999px", fontSize: "0.82rem", fontWeight: 600 }}>
                OTC Only
                <button onClick={() => setFilter("prescriptionRequired", "")} style={{ color: "var(--green)", display: "flex" }}><X size={12} /></button>
              </span>
            )}
            {filters.inStock && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.75rem", background: "var(--green-light)", color: "var(--green)", borderRadius: "999px", fontSize: "0.82rem", fontWeight: 600 }}>
                In Stock
                <button onClick={() => setFilter("inStock", "")} style={{ color: "var(--green)", display: "flex" }}><X size={12} /></button>
              </span>
            )}
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
              <div className="store-filter-group__label">Availability</div>
              <label className="store-filter-option">
                <input type="checkbox" checked={filters.inStock === "true"} onChange={e => setFilter("inStock", e.target.checked ? "true" : "")} />
                <span>In Stock Only</span>
              </label>
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
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "4rem 1rem", color: "var(--text-muted)" }}>
                  <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔍</p>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "0.5rem" }}>No products found</h3>
                  <p style={{ fontSize: "0.9rem" }}>Try adjusting your filters or search term.</p>
                  <button onClick={() => { setFilters({ search: "", category: "", subcategoryId: "", productFormId: "", prescriptionRequired: "", inStock: "", sort: "", minPrice: "", maxPrice: "" }); setPage(1); }}
                    style={{ marginTop: "1rem", padding: "0.6rem 1.25rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem" }}>
                    Clear Filters
                  </button>
                </div>
              )
              : products.map(p => <ProductCard key={p.id} product={p} onCartOpen={openCart} />)
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
  );
}
