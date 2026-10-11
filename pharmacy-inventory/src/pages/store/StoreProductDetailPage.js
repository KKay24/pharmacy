import React, { useState, useEffect } from "react";
import { useParams, Link, useOutletContext } from "react-router-dom";
import { ShoppingCart, Heart, FileText, ArrowLeft, Shield, Truck, Package } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { showToast } from "../../components/store/StoreToast";

export default function StoreProductDetailPage() {
  const { id } = useParams();
  const { openCart } = useOutletContext() || {};
  const { apiFetch, addToCart, toggleWishlist, isWishlisted } = useStore();
  const [product, setProduct] = useState(null);
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
              {product.dosage && <span className="store-product-detail__tag">{product.dosage}</span>}
              {product.strength && <span className="store-product-detail__tag">{product.strength}</span>}
            </div>

            <div className="store-product-detail__price">
              ZMW {(product.price || 0).toFixed(2)}
            </div>

            {!product.prescriptionRequired && (
              <>
                <div className="store-product-detail__qty-control">
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-secondary)" }}>Qty:</span>
                  <button className="store-product-detail__qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                  <span className="store-product-detail__qty">{qty}</span>
                  <button className="store-product-detail__qty-btn" onClick={() => setQty(q => q + 1)} aria-label="Increase quantity">+</button>
                </div>
                <div className="store-product-detail__actions">
                  <button className="store-product-detail__add" onClick={handleAdd}>
                    <ShoppingCart size={18} /> Add to Cart
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
      </div>
    </div>
  );
}
