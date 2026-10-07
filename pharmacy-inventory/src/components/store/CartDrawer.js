import React from "react";
import { X, ShoppingCart, Trash2, Minus, Plus } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { Link } from "react-router-dom";

export default function CartDrawer({ open, onClose }) {
  const { cart, cartCount, cartTotal, updateCartQty, removeFromCart, clearCart } = useStore();

  return (
    <>
      <div className={`store-cart-overlay ${open ? "open" : ""}`} onClick={onClose} aria-hidden="true" />
      <div
        className={`store-cart-drawer ${open ? "open" : ""}`}
        role="dialog"
        aria-label="Shopping cart"
        aria-modal={open || undefined}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="store-cart-drawer__header">
          <div className="store-cart-drawer__title">
            <ShoppingCart size={18} style={{ marginRight: "0.5rem", verticalAlign: "middle" }} />
            Cart ({cartCount} {cartCount === 1 ? "item" : "items"})
          </div>
          <button className="store-cart-drawer__close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="store-cart-drawer__body">
          {cart.length === 0 ? (
            <div className="store-cart-empty">
              <div className="store-cart-empty__icon">🛒</div>
              <p>Your cart is empty</p>
              <p style={{ marginTop: "0.5rem", fontSize: "0.82rem" }}>Browse our products and add items to get started.</p>
            </div>
          ) : (
            <>
              {cart.map(item => (
                <div key={item.id} className="store-cart-item">
                  <div className="store-cart-item__img">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : "💊"}
                  </div>
                  <div className="store-cart-item__info">
                    <div className="store-cart-item__name">{item.name}</div>
                    {item.dosage && <div className="store-cart-item__dosage">{item.dosage} {item.strength}</div>}
                    <div className="store-cart-item__controls">
                      <button className="store-cart-qty-btn" onClick={() => updateCartQty(item.id, item.quantity - 1)}>
                        <Minus size={12} />
                      </button>
                      <span className="store-cart-item__qty">{item.quantity}</span>
                      <button className="store-cart-qty-btn" disabled={item.quantity >= Number(item.stock)} onClick={() => updateCartQty(item.id, item.quantity + 1)} aria-label={`Increase ${item.name} quantity`}>
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                    <span className="store-cart-item__price">ZMW {((item.price || 0) * item.quantity).toFixed(2)}</span>
                    <button className="store-cart-item__remove" onClick={() => removeFromCart(item.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="store-cart-drawer__footer">
            <div className="store-cart-summary">
              <div className="store-cart-summary-row">
                <span>Subtotal</span>
                <span>ZMW {cartTotal.toFixed(2)}</span>
              </div>
              <div className="store-cart-summary-row">
                <span>Delivery</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="store-cart-summary-row total" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                <span>Estimated Total</span>
                <span>ZMW {cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <Link to="/checkout" onClick={onClose}>
              <button className="store-cart-checkout-btn">
                Proceed to Checkout →
              </button>
            </Link>

            <button onClick={clearCart} style={{ width: "100%", marginTop: "0.5rem", padding: "0.55rem", fontSize: "0.82rem", color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}>
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
