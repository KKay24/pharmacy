import React from "react";
import { Link } from "react-router-dom";
import { FileText, Heart, ShoppingCart } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { showToast } from "./StoreToast";

export function ProductCard({ product, onCartOpen }) {
  const { addToCart, cart, toggleWishlist, isWishlisted } = useStore();
  const wished = isWishlisted(product.id);
  const stockLow = product.stock > 0 && product.stock <= 10;
  const cartQuantity = cart.find((item) => item.id === product.id)?.quantity || 0;
  const atStockLimit = cartQuantity >= Number(product.stock);

  const handleAdd = () => {
    if (!product.inStock || product.prescriptionRequired) return;
    addToCart(product);
    showToast(`${product.name} added to cart`, "success");
    onCartOpen?.();
  };

  const handleWish = () => {
    toggleWishlist(product);
    showToast(wished ? "Removed from wishlist" : "Added to wishlist", wished ? "error" : "success");
  };

  return (
    <article className="store-product-card">
      {product.prescriptionRequired && (
        <span className="store-product-card__badge store-product-card__badge--rx">Prescription</span>
      )}
      {stockLow && (
        <span className="store-product-card__badge store-product-card__badge--low">
          Low stock
        </span>
      )}
      <button
        type="button"
        className={`store-product-card__wish ${wished ? "active" : ""}`}
        onClick={handleWish}
        aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
      >
        <Heart size={14} fill={wished ? "currentColor" : "none"} />
      </button>

      <Link to={`/product/${product.id}`} className="store-product-card__details">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="store-product-card__img" loading="lazy" />
        ) : (
          <div className="store-product-card__img-placeholder" aria-hidden="true">
            {getCategoryEmoji(product.category || product.MainCategory?.name)}
          </div>
        )}
        <div className="store-product-card__body">
          <div className="store-product-card__cat">
            {product.MainCategory?.name || product.category || "Pharmacy product"}
            {product.Subcategory?.name ? ` · ${product.Subcategory.name}` : ""}
          </div>
          <div className="store-product-card__name" title={product.name}>{product.name}</div>
          {product.genericName && <div className="store-product-card__generic">{product.genericName}</div>}
          {(product.dosage || product.strength) && (
            <div className="store-product-card__dosage">{[product.dosage, product.strength].filter(Boolean).join(" · ")}</div>
          )}
        </div>
      </Link>

      <div className="store-product-card__footer">
        <div className="store-product-card__price">ZMW {Number(product.price || 0).toFixed(2)}</div>
        <div className={`store-product-card__availability ${product.inStock ? "available" : "unavailable"}`}>
          {product.inStock ? `In stock (${product.stock})` : "Out of stock"}
        </div>
        {product.inStock && (product.prescriptionRequired ? (
          <Link to="/prescription-upload" className="store-product-card__add store-product-card__add--rx">
            <FileText size={14} /> Upload prescription
          </Link>
        ) : (
          <button type="button" className="store-product-card__add store-product-card__add--primary" onClick={handleAdd} disabled={atStockLimit}>
            <ShoppingCart size={14} /> {atStockLimit ? "Stock limit reached" : "Add to cart"}
          </button>
        ))}
      </div>
    </article>
  );
}

function getCategoryEmoji(category = "") {
  const name = category.toLowerCase();
  if (name.includes("vitamin") || name.includes("supplement")) return "🌿";
  if (name.includes("skin") || name.includes("personal care")) return "🧴";
  if (name.includes("baby") || name.includes("child")) return "👶";
  if (name.includes("medical") || name.includes("device")) return "🩺";
  return "💊";
}

export function ProductCardSkeleton() {
  return (
    <article className="store-product-card" aria-hidden="true">
      <div className="store-skeleton" style={{ aspectRatio: "1/1", width: "100%" }} />
      <div className="store-product-card__body">
        <div className="store-skeleton" style={{ height: "12px", width: "60%", marginBottom: "0.5rem" }} />
        <div className="store-skeleton" style={{ height: "16px", width: "85%", marginBottom: "0.35rem" }} />
        <div className="store-skeleton" style={{ height: "12px", width: "50%" }} />
      </div>
      <div className="store-product-card__footer">
        <div className="store-skeleton" style={{ height: "20px", width: "40%", marginBottom: "0.6rem" }} />
        <div className="store-skeleton" style={{ height: "36px", width: "100%", borderRadius: "8px" }} />
      </div>
    </article>
  );
}
