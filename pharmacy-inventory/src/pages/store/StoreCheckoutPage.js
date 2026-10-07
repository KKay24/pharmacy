import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MapPin, User, CreditCard, Smartphone, Banknote, Shield } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { showToast } from "../../components/store/StoreToast";

const DELIVERY_FEE = 25;

export default function StoreCheckoutPage() {
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart, apiFetch, storeUser } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customerName: storeUser?.username || "",
    customerPhone: "",
    customerEmail: storeUser?.email || "",
    deliveryMethod: "delivery",
    deliveryAddress: "",
    deliveryCity: "Lusaka",
    deliveryProvince: "Lusaka",
    paymentMethod: "Mobile Money",
    notes: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (cart.length === 0) {
    return (
      <div className="store-section">
        <div className="store-container" style={{ textAlign: "center", padding: "4rem" }}>
          <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛒</p>
          <h2 style={{ marginBottom: "0.5rem" }}>Your cart is empty</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>Add some items before checking out.</p>
          <Link to="/shop">
            <button style={{ background: "var(--brand-blue)", color: "white", border: "none", padding: "0.8rem 1.75rem", borderRadius: "var(--radius)", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer" }}>
              Browse Products
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const deliveryFee = form.deliveryMethod === "delivery" ? DELIVERY_FEE : 0;
  const total = cartTotal + deliveryFee;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.customerName || !form.customerPhone) {
      return setError("Please fill in your name and phone number.");
    }
    if (form.deliveryMethod === "delivery" && !form.deliveryAddress) {
      return setError("Please enter your delivery address.");
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        items: cart.map(i => ({ id: i.id, medicineId: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        deliveryFee,
        totalAmount: total,
      };
      const result = await apiFetch("/api/orders", { method: "POST", body: JSON.stringify(payload) });
      clearCart();
      showToast("Order placed successfully! 🎉", "success");
      navigate(`/order-success?orderNumber=${result.order?.orderNumber || ""}`);
    } catch (err) {
      setError(err.message || "Failed to place order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="store-section" style={{ paddingTop: "1.5rem" }}>
      <div className="store-container">
        <div className="store-breadcrumb">
          <Link to="/">Home</Link>
          <span className="store-breadcrumb__sep">›</span>
          <Link to="/shop">Shop</Link>
          <span className="store-breadcrumb__sep">›</span>
          <span>Checkout</span>
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "1.5rem" }}>Checkout</h1>

        {error && <div className="store-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="store-checkout-layout">
            {/* Left column */}
            <div>
              {/* Contact */}
              <div className="store-checkout-card">
                <h3><User size={18} /> Contact Details</h3>
                <div className="store-form-grid store-form-grid--2">
                  <div className="store-form-group">
                    <label>Full Name *</label>
                    <input type="text" placeholder="John Banda" value={form.customerName} onChange={e => set("customerName", e.target.value)} required />
                  </div>
                  <div className="store-form-group">
                    <label>Phone Number *</label>
                    <input type="tel" placeholder="+260 97 XXXXXXX" value={form.customerPhone} onChange={e => set("customerPhone", e.target.value)} required />
                  </div>
                  <div className="store-form-group" style={{ gridColumn: "1/-1" }}>
                    <label>Email Address (optional)</label>
                    <input type="email" placeholder="john@email.com" value={form.customerEmail} onChange={e => set("customerEmail", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Delivery */}
              <div className="store-checkout-card">
                <h3><MapPin size={18} /> Delivery Method</h3>
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  {[
                    { value: "delivery", label: "Home Delivery", sub: `ZMW ${DELIVERY_FEE}` },
                    { value: "pickup", label: "Store Pickup", sub: "Free" },
                  ].map(opt => (
                    <label key={opt.value} style={{
                      flex: 1, padding: "0.9rem", borderRadius: "var(--radius)", cursor: "pointer",
                      border: `2px solid ${form.deliveryMethod === opt.value ? "var(--brand-blue)" : "var(--border)"}`,
                      background: form.deliveryMethod === opt.value ? "var(--brand-blue-light)" : "white",
                      display: "flex", alignItems: "center", gap: "0.6rem",
                    }}>
                      <input type="radio" name="deliveryMethod" value={opt.value} checked={form.deliveryMethod === opt.value} onChange={e => set("deliveryMethod", e.target.value)} style={{ accentColor: "var(--brand-blue)" }} />
                      <div>
                        <strong style={{ fontSize: "0.9rem" }}>{opt.label}</strong>
                        <span style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)" }}>{opt.sub}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {form.deliveryMethod === "delivery" && (
                  <div className="store-form-grid">
                    <div className="store-form-group">
                      <label>Delivery Address *</label>
                      <input type="text" placeholder="House/Apt number, street name" value={form.deliveryAddress} onChange={e => set("deliveryAddress", e.target.value)} required={form.deliveryMethod === "delivery"} />
                    </div>
                    <div className="store-form-grid store-form-grid--2">
                      <div className="store-form-group">
                        <label>City</label>
                        <input type="text" placeholder="Lusaka" value={form.deliveryCity} onChange={e => set("deliveryCity", e.target.value)} />
                      </div>
                      <div className="store-form-group">
                        <label>Province</label>
                        <select value={form.deliveryProvince} onChange={e => set("deliveryProvince", e.target.value)}>
                          {["Lusaka","Copperbelt","Central","Eastern","Northern","Southern","North-Western","Western","Muchinga","Luapula"].map(p => <option key={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {form.deliveryMethod === "pickup" && (
                  <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "1rem", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                    📍 <strong style={{ color: "var(--text-primary)" }}>MediQuick Pharmacy</strong><br />
                    Cairo Road, Lusaka | Mon–Sat 8 AM – 8 PM | Sun 9 AM – 5 PM
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className="store-checkout-card">
                <h3><CreditCard size={18} /> Payment Method</h3>
                <p role="status" style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "0.85rem" }}>
                  Payment processing is not connected yet. Your order will remain pending until the pharmacy confirms payment.
                </p>
                <div className="store-payment-options">
                  {[
                    { value: "Mobile Money", label: "Mobile Money", sub: "MTN, Airtel, Zamtel", icon: <Smartphone size={18} /> },
                    { value: "Cash on Delivery", label: "Cash on Delivery", sub: "Pay when you receive", icon: <Banknote size={18} /> },
                    { value: "Bank Transfer", label: "Bank Transfer", sub: "Direct bank deposit", icon: <CreditCard size={18} /> },
                  ].map(opt => (
                    <label key={opt.value} className={`store-payment-option ${form.paymentMethod === opt.value ? "selected" : ""}`}>
                      <input type="radio" name="paymentMethod" value={opt.value} checked={form.paymentMethod === opt.value} onChange={e => set("paymentMethod", e.target.value)} style={{ accentColor: "var(--brand-blue)" }} />
                      <span style={{ color: "var(--brand-blue)" }}>{opt.icon}</span>
                      <div>
                        <strong style={{ fontSize: "0.9rem" }}>{opt.label}</strong>
                        <span style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)" }}>{opt.sub}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="store-checkout-card">
                <h3>Order Notes (optional)</h3>
                <div className="store-form-group">
                  <textarea rows={3} placeholder="Any special instructions for delivery or packaging..." value={form.notes} onChange={e => set("notes", e.target.value)} style={{ resize: "vertical" }} />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <div className="store-order-summary">
                <h3>Order Summary</h3>
                {cart.map(item => (
                  <div key={item.id} className="store-order-item">
                    <span style={{ fontWeight: 600 }}>{item.name} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>×{item.quantity}</span></span>
                    <span style={{ fontWeight: 700 }}>ZMW {((item.price || 0) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", marginTop: "0.75rem" }}>
                  <div className="store-order-total-row">
                    <span>Subtotal</span>
                    <span>ZMW {cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="store-order-total-row">
                    <span>Delivery</span>
                    <span>{deliveryFee === 0 ? "Free" : `ZMW ${deliveryFee.toFixed(2)}`}</span>
                  </div>
                  <div className="store-order-total-row total">
                    <span>Total</span>
                    <span>ZMW {total.toFixed(2)}</span>
                  </div>
                </div>
                <button type="submit" className="store-order-submit" disabled={loading}>
                  {loading ? "Placing Order..." : `Place Order · ZMW ${total.toFixed(2)}`}
                </button>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.75rem" }}>
                  <Shield size={12} style={{ verticalAlign: "middle" }} /> Secure checkout. Your data is protected.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
