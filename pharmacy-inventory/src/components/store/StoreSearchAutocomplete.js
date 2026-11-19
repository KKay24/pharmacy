import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ArrowRight, CornerDownLeft, Sparkles, AlertCircle } from "lucide-react";
import { useStore } from "../../context/StoreContext";

export default function StoreSearchAutocomplete({
  initialValue = "",
  placeholder = "Search medicines, brands, active ingredients...",
  onSearchSubmit,
  autoFocus = false,
  className = "",
}) {
  const { apiFetch } = useStore();
  const navigate = useNavigate();

  const [query, setQuery] = useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ products: [], suggestions: [], categories: [], didYouMean: null });
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Sync external initialValue if changed
  useEffect(() => {
    setQuery(initialValue);
    setDebouncedQuery(initialValue);
  }, [initialValue]);

  // Debounce input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch autocomplete suggestions with AbortController
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults({ products: [], suggestions: [], categories: [], didYouMean: null });
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);

    apiFetch(`/api/products/autocomplete?q=${encodeURIComponent(debouncedQuery)}&limit=6`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResults({
            products: Array.isArray(data?.products) ? data.products : [],
            suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
            categories: Array.isArray(data?.categories) ? data.categories : [],
            didYouMean: data?.didYouMean || null,
          });
          setIsOpen(true);
          setActiveIndex(-1);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, apiFetch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const executeSearch = useCallback((searchTerm) => {
    const term = (searchTerm !== undefined ? searchTerm : query).trim();
    if (!term) return;
    setIsOpen(false);
    if (onSearchSubmit) {
      onSearchSubmit(term);
    } else {
      navigate(`/shop?search=${encodeURIComponent(term)}`);
    }
  }, [query, onSearchSubmit, navigate]);

  const handleProductSelect = (product) => {
    setIsOpen(false);
    // Track search click asynchronously
    try {
      apiFetch?.("/api/products/search/click", {
        method: "POST",
        body: JSON.stringify({ query: debouncedQuery, productId: product.id }),
      })?.catch?.(() => {});
    } catch (e) {
      // Non-blocking
    }

    navigate(`/product/${product.id}`);
  };

  const handleKeyDown = (e) => {
    const totalItems = results.products.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && results.products.length > 0) {
        setIsOpen(true);
        setActiveIndex(0);
      } else if (totalItems > 0) {
        setActiveIndex((prev) => (prev + 1 < totalItems ? prev + 1 : -1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (totalItems > 0) {
        setActiveIndex((prev) => (prev > -1 ? prev - 1 : totalItems - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results.products[activeIndex]) {
        handleProductSelect(results.products[activeIndex]);
      } else {
        executeSearch();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleClear = () => {
    setQuery("");
    setDebouncedQuery("");
    setResults({ products: [], suggestions: [], categories: [], didYouMean: null });
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const hasContent = results.products.length > 0 || results.suggestions.length > 0 || results.didYouMean;

  return (
    <div ref={containerRef} className={`store-search-autocomplete ${className}`}>
      <form
        className="customer-navbar__search"
        onSubmit={(e) => {
          e.preventDefault();
          executeSearch();
        }}
        role="search"
      >
        <Search size={18} aria-hidden="true" className="store-search-icon" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search pharmacy products"
          aria-autocomplete="list"
          aria-controls="store-search-listbox"
          aria-expanded={isOpen && (hasContent || loading)}
          aria-activedescendant={activeIndex >= 0 ? `store-search-option-${activeIndex}` : undefined}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (hasContent) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck="false"
        />
        {query && (
          <button
            type="button"
            className="store-search-clear"
            aria-label="Clear search input"
            onClick={handleClear}
          >
            <X size={15} />
          </button>
        )}
        <button type="submit">Search</button>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && (hasContent || loading) && (
        <div id="store-search-listbox" className="store-search-dropdown" role="listbox">
          {loading && (
            <div className="store-search-dropdown__loading">
              <span className="store-spinner__ring" style={{ width: 18, height: 18, borderWidth: 2 }} />
              <span>Searching medicines &amp; health products...</span>
            </div>
          )}

          {/* Spelling Suggestion ("Did you mean?") */}
          {results.didYouMean && (
            <div className="store-search-dropdown__did-you-mean">
              <Sparkles size={14} className="store-search-dropdown__sparkle" />
              <span>Did you mean:</span>
              <button
                type="button"
                className="store-search-dropdown__suggestion-pill"
                onClick={() => {
                  setQuery(results.didYouMean);
                  executeSearch(results.didYouMean);
                }}
              >
                <strong>{results.didYouMean}</strong>
              </button>
            </div>
          )}

          {/* Suggested Search Query Pills */}
          {results.suggestions.length > 0 && (
            <div className="store-search-dropdown__queries">
              <span className="store-search-dropdown__section-title">Suggestions</span>
              <div className="store-search-dropdown__pill-group">
                {results.suggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    className="store-search-dropdown__pill"
                    onClick={() => {
                      setQuery(sug);
                      executeSearch(sug);
                    }}
                  >
                    <Search size={12} />
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product Items */}
          {results.products.length > 0 && (
            <div className="store-search-dropdown__products">
              <span className="store-search-dropdown__section-title">Matching Products</span>
              {results.products.map((p, idx) => (
                <div
                  key={p.id}
                  id={`store-search-option-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`store-search-item ${idx === activeIndex ? "active" : ""}`}
                  onClick={() => handleProductSelect(p)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <div className="store-search-item__thumb">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" />
                    ) : (
                      <span className="store-search-item__placeholder">💊</span>
                    )}
                  </div>
                  <div className="store-search-item__info">
                    <div className="store-search-item__title-row">
                      <span className="store-search-item__name">{p.name}</span>
                      {p.prescriptionRequired && (
                        <span className="store-badge store-badge--rx">Rx</span>
                      )}
                    </div>
                    <div className="store-search-item__meta">
                      {p.brandName && <span className="store-search-item__brand">{p.brandName}</span>}
                      {p.genericName && (
                        <span className="store-search-item__generic">
                          {p.brandName ? `• ${p.genericName}` : p.genericName}
                        </span>
                      )}
                      {p.strength && <span className="store-search-item__strength">• {p.strength}</span>}
                      {p.dosage && <span className="store-search-item__dosage">• {p.dosage}</span>}
                    </div>
                    {p.category && (
                      <span className="store-search-item__category">{p.category}</span>
                    )}
                  </div>
                  <div className="store-search-item__right">
                    <span className="store-search-item__price">
                      ZMW {(p.price || 0).toFixed(2)}
                    </span>
                    <span className="store-search-item__action">
                      <CornerDownLeft size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* View all results footer */}
          {debouncedQuery && (
            <div className="store-search-dropdown__footer">
              <button
                type="button"
                className="store-search-dropdown__view-all"
                onClick={() => executeSearch()}
              >
                <span>View all results for &ldquo;<strong>{debouncedQuery}</strong>&rdquo;</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* No results prompt */}
          {!loading && results.products.length === 0 && !results.didYouMean && (
            <div className="store-search-dropdown__empty">
              <AlertCircle size={18} />
              <p>No exact product matches found for &ldquo;{debouncedQuery}&rdquo;</p>
              <button
                type="button"
                className="store-search-dropdown__browse-link"
                onClick={() => executeSearch()}
              >
                Search all catalogue &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
