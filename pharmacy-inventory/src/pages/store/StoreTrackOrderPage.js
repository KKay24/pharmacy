import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Package } from "lucide-react";
import { useStore } from "../../context/StoreContext";

const STATUS_STEPS = ["Order Placed", "Confirmed", "Preparing", "Ready", "Out for Delivery", "Delivered"];

function getStatusStep(status) {
  const idx = STATUS_STEPS.findIndex(s => s.toLowerCase() === (status || "").toLowerCase());
  return idx === -1 ? 0 : idx;
}

export default function StoreTrackOrderPage() {
  const { apiFetch } = useStore();
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get("orderNumber") || "");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e) => {
    e.preventDefault();
    setError(""); setResult(null);
    if (!orderNumber.trim() || !phone.trim()) return setError("Please enter your order number and phone number.");
    setLoading(true);
    try {
      const data = await apiFetch(`/api/orders?orderNumber=${encodeURIComponent(orderNumber.trim())}&phone=${encodeURIComponent(phone.trim())}`);
      const orders = data.data || data.orders || (Array.isArray(data) ? data : []);
      if (orders.length === 0) throw new Error("No order found with those details.");
      setResult(orders[0]);
    } catch (err) {
      setError(err.message || "Order not found. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const step = result ? getStatusStep(result.orderStatus) : -1;

  return (
    <div className="store-section">
      <div className="store-container" style={{ maxWidth: 640 }}>
        <div className="store-breadcrumb">
          <Link to="/">Home</Link>
          <span className="store-breadcrumb__sep">›</span>
          <span>Track Order</span>
        </div>

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <Package size={48} color="var(--brand-blue)" style={{ margin: "0 auto 1rem" }} />
          <h1 style={{ fontSize: "1.5rem", fontWeight: "900", marginBottom: "0.4rem" }}>Track Your Order</h1>
          <p style={{ color: "var(--text-secondary)" }}>Enter your order number and phone number to check the status.</p>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "2rem", marginBottom: "1.5rem" }}>
          {error && <div className="store-error">{error}</div>}
          <form onSubmit={handleTrack}>
            <div className="store-form-grid" style={{ gap: "1rem" }}>
              <div className="store-form-group">
                <label>Order Number</label>
                <input type="text" placeholder="e.g. ORD-123456-7890" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} required />
              </div>
              <div className="store-form-group">
                <label>Phone Number</label>
                <input type="tel" placeholder="+260 97 XXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
            </div>
            <button type="submit" disabled={loading} style={{ width: "100%", marginTop: "1.25rem", padding: "0.9rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              {loading ? "Searching..." : <><Search size={18} /> Track Order</>}
            </button>
          </form>
        </div>

        {result && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Order Number</p>
                <p style={{ fontSize: "1.2rem", fontWeight: "900", color: "var(--brand-blue)" }}>{result.orderNumber}</p>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Placed: {new Date(result.date || result.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Total</p>
                <p style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)" }}>ZMW {Number(result.totalAmount || 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Progress */}
            {result.orderStatus !== "Cancelled" && (
              <div style={{ marginBottom: "1.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                  <div style={{ position: "absolute", top: 16, left: 16, right: 16, height: 3, background: "var(--border)", zIndex: 0 }} />
                  <div style={{ position: "absolute", top: 16, left: 16, height: 3, background: "var(--brand-blue)", zIndex: 1, width: `${(step / (STATUS_STEPS.length - 1)) * 100}%`, transition: "width 0.5s ease" }} />
                  {STATUS_STEPS.map((s, i) => (
                    <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", zIndex: 2, flex: 1 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", border: `3px solid ${i <= step ? "var(--brand-blue)" : "var(--border)"}`,
                        background: i <= step ? "var(--brand-blue)" : "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontSize: "0.75rem", fontWeight: "800",
                      }}>
                        {i < step ? "✓" : i === step ? "●" : ""}
                      </div>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, textAlign: "center", color: i <= step ? "var(--brand-blue)" : "var(--text-muted)" }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.orderStatus === "Cancelled" && (
              <div style={{ background: "var(--red-light)", color: "var(--red)", padding: "1rem", borderRadius: "var(--radius-sm)", marginBottom: "1rem", fontWeight: 600, fontSize: "0.88rem" }}>
                ⚠️ This order has been cancelled.
              </div>
            )}

            {/* Order items */}
            {Number.isInteger(result.itemCount) && (
              <div>
                <p style={{ padding: "0.6rem 0", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                  {result.itemCount} item{result.itemCount === 1 ? "" : "s"} in this order
                </p>
              </div>
            )}

            {result.deliveryMethod && (
              <div style={{ marginTop: "1rem", padding: "0.85rem", background: "var(--bg)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                <strong>Fulfilment:</strong> {result.deliveryMethod}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
