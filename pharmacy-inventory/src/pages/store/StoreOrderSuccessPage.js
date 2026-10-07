import React from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle, Package, Shield } from "lucide-react";

export default function StoreOrderSuccessPage() {
  const [params] = useSearchParams();
  const orderNumber = params.get("orderNumber") || "ORD-XXXXXX";

  return (
    <div className="store-section">
      <div className="store-container">
        <div style={{ maxWidth: 560, margin: "3rem auto", textAlign: "center", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "3rem 2rem" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--green-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
            <CheckCircle size={40} color="var(--green)" />
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: "900", marginBottom: "0.5rem" }}>Order Placed! 🎉</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "1.5rem" }}>
            Your order has been recorded and inventory updated. Payment is not collected online; the pharmacy must confirm your order.
          </p>

          <div style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "1rem 1.5rem", marginBottom: "2rem", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>Your Order Number</p>
            <p style={{ fontSize: "1.3rem", fontWeight: "900", color: "var(--brand-blue)" }}>{orderNumber}</p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Save this for tracking your order</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem", textAlign: "left" }}>
            {[
              { icon: <Package size={18} />, title: "Order status", sub: "Your order is awaiting pharmacy confirmation" },
              { icon: <Shield size={18} />, title: "Payment", sub: "Payment status remains pending until confirmed" },
            ].map(({ icon, title, sub }) => (
              <div key={title} style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.75rem", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ color: "var(--brand-blue)", flexShrink: 0 }}>{icon}</div>
                <div>
                  <strong style={{ fontSize: "0.88rem" }}>{title}</strong>
                  <span style={{ display: "block", fontSize: "0.78rem", color: "var(--text-secondary)" }}>{sub}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <Link to={`/track-order?orderNumber=${orderNumber}`}>
              <button style={{ padding: "0.8rem 1.5rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}>
                Track Order
              </button>
            </Link>
            <Link to="/shop">
              <button style={{ padding: "0.8rem 1.5rem", background: "white", color: "var(--brand-blue)", border: "2px solid var(--brand-blue)", borderRadius: "var(--radius)", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}>
                Continue Shopping
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
