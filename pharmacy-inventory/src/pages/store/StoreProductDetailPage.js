import React, { useState, useEffect } from "react";
import { useParams, Link, useOutletContext } from "react-router-dom";
import { ShoppingCart, Heart, FileText, ArrowLeft, Shield, Truck, Package, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { showToast } from "../../components/store/StoreToast";
import { ProductCard } from "../../components/store/ProductCard";

export default function StoreProductDetailPage() {
  const { id } = useParams();
  const { openCart } = useOutletContext() || {};
  const { apiFetch, addToCart, toggleWishlist, isWishlisted } = useStore();
  const [product, setProduct] = useState(null);
  const [alternatives, setAlternatives] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState("description");

  useEffect(() => {
    setLoading(true);
    setError("");
    setQty(1);
    apiFetch(`/api/products/${id}`)
      .then(data => setProduct(data))
      .catch(err => setError(err.message || "Product not found"))
      .finally(() => setLoading(false));

    apiFetch(`/api/products/${id}/alternatives`)
      .then(data => setAlternatives(data))
      .catch(() => setAlternatives(null));
  }, [id, apiFetch]);

  if (loading) return (
    <div className="store-spinner" style={{ height: "60vh" }}>
      <div className="store-spinner__ring" />
    </div>
  );

  if (error || !product) return (
    <div className="store-section">
      <div className="store-container" style={{ textAlign: "center", padding: "4rem" }}>
        <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>😕</p>
        <h2>Product not found</h2>
        <Link to="/shop" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginTop: "1rem", color: "var(--brand-blue)", fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back to Shop
        </Link>
      </div>
    </div>
  );

  const wished = isWishlisted(product.id);

  const handleAdd = () => {
    addToCart({ ...product }, qty);
    showToast(`${product.name} (×${qty}) added to cart`, "success");
    if (openCart) openCart();
  };

  const descContent = [
    product.description,
    product.dosage ? `Dosage: ${product.dosage}` : null,
    product.strength ? `Strength: ${product.strength}` : null,
    product.manufacturer ? `Manufacturer: ${product.manufacturer}` : null,
  ].filter(Boolean).join("\n\n") || "No description available.";

  const storageContent = "Store below 25°C in a cool, dry place away from direct sunlight and heat. Keep out of reach of children.";

  const sideEffectsContent = product.sideEffects || "Consult your pharmacist or physician for information about potential side effects.";

  return (
    <div className="store-section" style={{ paddingTop: "1.5rem" }}>
      <div className="store-container">
        {/* Breadcrumb */}
        <div className="store-breadcrumb">
          <Link to="/">Home</Link>
          <span className="store-breadcrumb__sep">›</span>
          <Link to="/shop">Shop</Link>
          <span className="store-breadcrumb__sep">›</span>
          {product.MainCategory && (
            <>
              <Link to={`/shop?category=${product.MainCategory.slug}`}>{product.MainCategory.name}</Link>
              <span className="store-breadcrumb__sep">›</span>
            </>
          )}
          <span>{product.name}</span>
        </div>

        <div className="store-product-detail-layout">
          {/* Image */}
          <div>
            <div className="store-product-detail__img-wrap">
              {product.imageUrl
                ? <img src={product.imageUrl} alt={product.name} style={{ maxHeight: 300, objectFit: "contain" }} />
                : <span>💊</span>
              }
            </div>
          </div>

          {/* Info */}
          <div>
            <div className="store-product-detail__cat">
              {product.MainCategory?.name || product.category || "Medicine"}
            </div>
            <h1 className="store-product-detail__name">{product.name}</h1>
            {product.genericName && (
              <p className="store-product-detail__generic">{product.genericName}</p>
            )}

            <div className="store-product-detail__tags">
              {product.prescriptionRequired
                ? <span className="store-product-detail__tag" style={{ borderColor: "var(--red)", color: "var(--red)" }}>⚕️ Prescription Required</span>
                : <span className="store-product-detail__tag" style={{ borderColor: "var(--green)", color: "var(--green)" }}>✓ Over the Counter</span>
              }
              {!product.prescriptionRequired && product.availabilityStatus === "preorder" && (
                <span className="store-product-detail__tag" style={{ borderColor: "#b45309", color: "#b45309" }}>Preorder · awaiting stock</span>
              )}
              {product.dosage && <span className="store-product-detail__tag">{product.dosage}</span>}
              {product.strength && <span className="store-product-detail__tag">{product.strength}</span>}
            </div>

            <div className="store-product-detail__price">
              ZMW {(product.price || 0).toFixed(2)}
            </div>

            {!product.prescriptionRequired && (
              <>
                {product.availabilityStatus === "preorder" && (
                  <p role="note" style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
                    Replenishment timing is not confirmed yet. We will show an estimate only after the supplier confirms it.
                  </p>
                )}
                <div className="store-product-detail__qty-control">
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-secondary)" }}>Qty:</span>
                  <button className="store-product-detail__qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                  <span className="store-product-detail__qty">{qty}</span>
                  <button className="store-product-detail__qty-btn" onClick={() => setQty(q => q + 1)} aria-label="Increase quantity">+</button>
                </div>
                <div className="store-product-detail__actions">
                  <button className="store-product-detail__add" onClick={handleAdd}>
                    <ShoppingCart size={18} /> {product.availabilityStatus === "preorder" ? "Add preorder" : "Add to Cart"}
                  </button>
                  <button
                    className={`store-product-detail__wish-btn ${wished ? "active" : ""}`}
                    onClick={() => { toggleWishlist(product); showToast(wished ? "Removed from wishlist" : "Saved to wishlist", wished ? "error" : "success"); }}
                    aria-label="Toggle wishlist"
                  >
                    <Heart size={18} fill={wished ? "currentColor" : "none"} />
                  </button>
                </div>
              </>
            )}

            {product.prescriptionRequired && (
              <div style={{ background: "var(--red-light)", border: "1px solid #fca5a5", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "1rem" }}>
                <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--red)", marginBottom: "0.5rem" }}>
                  ⚕️ This medicine requires a valid prescription
                </p>
                <Link to="/prescription-upload">
                  <button style={{ background: "var(--red)", color: "white", border: "none", padding: "0.65rem 1.25rem", borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <FileText size={15} /> Upload Prescription
                  </button>
                </Link>
              </div>
            )}

            {/* Trust badges */}
            <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
              {[
                { icon: <Shield size={16} />, label: "Genuine Product" },
                { icon: <Truck size={16} />, label: "Fast Shipping" },
                { icon: <Package size={16} />, label: "Secure Packaging" },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  <span style={{ color: "var(--brand-blue)" }}>{icon}</span> {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: 800, marginTop: "2rem" }}>
          <div className="store-product-detail__tabs">
            {[
              { key: "description", label: "Description" },
              { key: "storage", label: "Storage" },
              { key: "sideeffects", label: "Side Effects" },
            ].map(t => (
              <button
                key={t.key}
                className={`store-product-detail__tab ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="store-product-detail__tab-body">
            {activeTab === "description" && <p style={{ whiteSpace: "pre-line" }}>{descContent}</p>}
            {activeTab === "storage" && <p>{storageContent}</p>}
            {activeTab === "sideeffects" && <p>{sideEffectsContent}</p>}
          </div>
        </div>

        {/* Similar Products & Alternatives with Medical Safety Distinctions */}
        {alternatives && (
          <div className="store-alternatives-container" style={{ marginTop: "3.5rem", borderTop: "1px solid var(--border)", paddingTop: "2.5rem" }}>
            {/* Level 1: Direct Bio-Equivalent Generic Alternatives */}
            {alternatives.directEquivalents?.length > 0 && (
              <div style={{ marginBottom: "2.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--text-primary)" }}>
                    Generic Alternatives
                  </h3>
                  <span className="store-badge store-badge--green" style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}>
                    Same Active Ingredient ({product.genericName || "Equivalent"})
                  </span>
                </div>
                <div className="store-safety-box store-safety-box--green" style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "flex-start", gap: "0.6rem", background: "var(--green-light)", border: "1px solid #a7f3d0" }}>
                  <CheckCircle2 size={18} style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: "0.85rem", color: "#065f46", margin: 0 }}>
                    <strong>Medical Safety Note:</strong> These products contain the exact same active ingredient ({product.genericName || "generic"}), strength, and form. They can serve as direct substitutes under pharmacist supervision.
                  </p>
                </div>
                <div className="store-product-grid store-product-grid--5">
                  {alternatives.directEquivalents.map(({ medicine }) => (
                    <ProductCard key={medicine.id} product={medicine} onCartOpen={openCart} />
                  ))}
                </div>
              </div>
            )}

            {/* Level 2: Same Active Ingredient, Different Strength or Form */}
            {alternatives.differentStrengthOrForm?.length > 0 && (
              <div style={{ marginBottom: "2.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--text-primary)" }}>
                    Different Strengths &amp; Forms
                  </h3>
                  <span className="store-badge" style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                    Dose Adjustment Required
                  </span>
                </div>
                <div className="store-safety-box" style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "flex-start", gap: "0.6rem", background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <AlertTriangle size={18} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: "0.85rem", color: "#92400e", margin: 0 }}>
                    <strong>Dosage Notice:</strong> Contains {product.genericName || "the same ingredient"} in a different strength or formulation. Do not substitute without consulting your doctor or pharmacist for correct dosing.
                  </p>
                </div>
                <div className="store-product-grid store-product-grid--5">
                  {alternatives.differentStrengthOrForm.map(({ medicine }) => (
                    <ProductCard key={medicine.id} product={medicine} onCartOpen={openCart} />
                  ))}
                </div>
              </div>
            )}

            {/* Level 3: Same Therapeutic Category */}
            {alternatives.relatedTherapeutic?.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--text-primary)" }}>
                    Related Products in {product.MainCategory?.name || product.category || "Same Category"}
                  </h3>
                  <span className="store-badge" style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", background: "var(--brand-blue-light)", color: "var(--brand-blue)" }}>
                    Related Category
                  </span>
                </div>
                <div className="store-safety-box" style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "flex-start", gap: "0.6rem", background: "var(--brand-blue-light)", border: "1px solid #bfdbfe" }}>
                  <Info size={18} style={{ color: "var(--brand-blue)", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: "0.85rem", color: "var(--brand-blue)", margin: 0 }}>
                    <strong>Pharmacist Consultation Required:</strong> These products treat similar conditions but contain DIFFERENT active ingredients. They are not direct substitutes.
                  </p>
                </div>
                <div className="store-product-grid store-product-grid--5">
                  {alternatives.relatedTherapeutic.map(({ medicine }) => (
                    <ProductCard key={medicine.id} product={medicine} onCartOpen={openCart} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
