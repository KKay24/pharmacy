import React, { useCallback, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Package, Heart, FileText, LogOut, ChevronRight, Edit2, Save, X } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { showToast } from "../../components/store/StoreToast";
import StoreAuthModal from "../../components/store/StoreAuthModal";

const STATUS_STYLES = {
  "Order Placed": "status-placed",
  "Confirmed": "status-processing",
  "Preparing": "status-processing",
  "Ready": "status-dispatched",
  "Out for Delivery": "status-dispatched",
  "Delivered": "status-delivered",
  "Cancelled": "status-cancelled",
};

export default function StoreAccountPage() {
  const { storeUser, storeLogout, apiFetch } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [authOpen, setAuthOpen] = useState(!storeUser);
  const [orders, setOrders] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/orders");
      const rows = data.data || data.orders || data.rows || (Array.isArray(data) ? data : []);
      setOrders(rows);
    } catch (error) {
      setOrders([]);
      showToast(error.message || "Could not load your orders", "error");
    }
    finally { setLoading(false); }
  }, [apiFetch]);

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/prescriptions/my");
      setPrescriptions(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      setPrescriptions([]);
      showToast(error.message || "Could not load your prescriptions", "error");
    }
    finally { setLoading(false); }
  }, [apiFetch]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/profile");
      setProfile(data);
      setEditForm({ name: data.customer?.name || data.user?.username || "", phone: data.customer?.phone || "", email: data.user?.email || "", address: data.customer?.address || "" });
    } catch (error) {
      setProfile(null);
      showToast(error.message || "Could not load your profile", "error");
    }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => {
    if (!storeUser) return;
    if (activeTab === "orders") fetchOrders();
    if (activeTab === "prescriptions") fetchPrescriptions();
    if (activeTab === "profile") fetchProfile();
  }, [activeTab, storeUser, fetchOrders, fetchPrescriptions, fetchProfile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/auth/profile", { method: "PUT", body: JSON.stringify(editForm) });
      showToast("Profile updated successfully", "success");
      setEditMode(false);
      fetchProfile();
    } catch (err) {
      showToast(err.message || "Failed to save profile", "error");
    } finally { setSaving(false); }
  };

  if (!storeUser) {
    return (
      <div className="store-section">
        <div className="store-container" style={{ textAlign: "center", padding: "4rem" }}>
          <User size={48} color="var(--text-muted)" style={{ margin: "0 auto 1rem" }} />
          <h2 style={{ marginBottom: "0.5rem" }}>Sign in to your account</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>View your orders, prescriptions, and manage your profile.</p>
          <button onClick={() => setAuthOpen(true)} style={{ background: "var(--brand-blue)", color: "white", border: "none", padding: "0.8rem 1.75rem", borderRadius: "var(--radius)", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer" }}>
            Sign In
          </button>
          {authOpen && <StoreAuthModal mode="login" onClose={() => setAuthOpen(false)} onSwitchMode={() => {}} />}
        </div>
      </div>
    );
  }

  const NAV_ITEMS = [
    { key: "profile", label: "My Profile", icon: <User size={17} /> },
    { key: "orders", label: "My Orders", icon: <Package size={17} /> },
    { key: "prescriptions", label: "Prescriptions", icon: <FileText size={17} /> },
    { key: "wishlist", label: "Wishlist", icon: <Heart size={17} /> },
  ];

  return (
    <div className="store-section">
      <div className="store-container">
        <div className="store-breadcrumb">
          <Link to="/">Home</Link>
          <span className="store-breadcrumb__sep">›</span>
          <span>My Account</span>
        </div>

        <div style={{ display: "flex", align: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: "800" }}>My Account</h1>
          <button onClick={() => { storeLogout(); navigate("/"); }} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "var(--red)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>

        <div className="store-account-layout">
          {/* Nav */}
          <div className="store-account-nav">
            {NAV_ITEMS.map(({ key, label, icon }) => (
              <button key={key} className={`store-account-nav-item ${activeTab === key ? "active" : ""}`} onClick={() => setActiveTab(key)}>
                {icon} {label} <ChevronRight size={14} style={{ marginLeft: "auto" }} />
              </button>
            ))}
          </div>

          {/* Content */}
          <div>
            {/* ─ Profile ─ */}
            {activeTab === "profile" && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "1.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: "800" }}>Profile Information</h2>
                  {!editMode ? (
                    <button onClick={() => setEditMode(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "var(--brand-blue)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                      <Edit2 size={15} /> Edit
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => setEditMode(false)} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                        <X size={15} /> Cancel
                      </button>
                      <button onClick={handleSaveProfile} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem", color: "var(--green)", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                        <Save size={15} /> {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  )}
                </div>

                {loading ? <div className="store-spinner"><div className="store-spinner__ring" /></div> : (
                  <div className="store-form-grid" style={{ maxWidth: 500 }}>
                    {[
                      { label: "Full Name", key: "name", type: "text" },
                      { label: "Email Address", key: "email", type: "email" },
                      { label: "Phone Number", key: "phone", type: "tel" },
                      { label: "Delivery Address", key: "address", type: "text" },
                    ].map(({ label, key, type }) => (
                      <div key={key} className="store-form-group">
                        <label>{label}</label>
                        {editMode ? (
                          <input type={type} value={editForm[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
                        ) : (
                          <div style={{ padding: "0.7rem 0.9rem", background: "var(--bg)", borderRadius: "var(--radius-sm)", fontSize: "0.9rem", color: editForm[key] ? "var(--text-primary)" : "var(--text-muted)", border: "1.5px solid transparent" }}>
                            {editForm[key] || <em>Not set</em>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─ Orders ─ */}
            {activeTab === "orders" && (
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: "800", marginBottom: "1.25rem" }}>My Orders</h2>
                {loading ? <div className="store-spinner"><div className="store-spinner__ring" /></div>
                  : orders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                      <Package size={40} style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
                      <p>No orders yet.</p>
                      <Link to="/shop"><button style={{ marginTop: "1rem", padding: "0.6rem 1.25rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", fontWeight: 600, cursor: "pointer", fontSize: "0.88rem" }}>Start Shopping</button></Link>
                    </div>
                  ) : (
                    <div className="store-order-list">
                      {orders.map(order => (
                        <div key={order.id} className="store-order-card">
                          <div className="store-order-card__header">
                            <div className="store-order-card__num">Order #{order.orderNumber}</div>
                            <div className="store-order-card__date">{new Date(order.date || order.createdAt).toLocaleDateString()}</div>
                            <div className="store-order-card__items">{Array.isArray(order.items) ? `${order.items.length} item${order.items.length > 1 ? "s" : ""}` : ""}</div>
                          </div>
                          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                            <span className={`store-order-card__status ${STATUS_STYLES[order.orderStatus] || "status-placed"}`}>
                              {order.orderStatus}
                            </span>
                            <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--brand-blue)" }}>ZMW {Number(order.totalAmount || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* ─ Prescriptions ─ */}
            {activeTab === "prescriptions" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: "800" }}>My Prescriptions</h2>
                  <Link to="/prescription-upload"><button style={{ padding: "0.5rem 1rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>+ New Prescription</button></Link>
                </div>
                {loading ? <div className="store-spinner"><div className="store-spinner__ring" /></div>
                  : prescriptions.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                      <FileText size={40} style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
                      <p>No prescriptions on file.</p>
                    </div>
                  ) : (
                    <div className="store-order-list">
                      {prescriptions.map(rx => (
                        <div key={rx.id} className="store-order-card">
                          <div className="store-order-card__header">
                            <div className="store-order-card__num">{rx.prescriptionNumber}</div>
                            <div className="store-order-card__date">{new Date(rx.createdAt).toLocaleDateString()}</div>
                            {rx.medications && <div className="store-order-card__items">{rx.medications}</div>}
                          </div>
                          <span style={{ padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 700, background: "var(--brand-blue-light)", color: "var(--brand-blue)", marginLeft: "auto", alignSelf: "flex-start" }}>
                            {rx.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* ─ Wishlist ─ */}
            {activeTab === "wishlist" && <WishlistTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function WishlistTab() {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  return (
    <div>
      <h2 style={{ fontSize: "1rem", fontWeight: "800", marginBottom: "1.25rem" }}>My Wishlist</h2>
      {wishlist.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
          <Heart size={40} style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
          <p>Your wishlist is empty.</p>
          <Link to="/shop"><button style={{ marginTop: "1rem", padding: "0.6rem 1.25rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius)", fontWeight: 600, cursor: "pointer", fontSize: "0.88rem" }}>Browse Products</button></Link>
        </div>
      ) : (
        <div className="store-order-list">
          {wishlist.map(item => (
            <div key={item.id} className="store-order-card" style={{ alignItems: "center" }}>
              <div style={{ width: 52, height: 52, background: "var(--bg)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>💊</div>
              <div className="store-order-card__header">
                <div className="store-order-card__date">{item.name}</div>
                <div className="store-order-card__items" style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--brand-blue)" }}>ZMW {(item.price || 0).toFixed(2)}</div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
                {item.inStock && !item.prescriptionRequired && (
                  <button onClick={() => { addToCart(item); showToast("Added to cart", "success"); }}
                    style={{ padding: "0.5rem 0.85rem", background: "var(--brand-blue)", color: "white", border: "none", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                    Add to Cart
                  </button>
                )}
                <button onClick={() => toggleWishlist(item)}
                  style={{ padding: "0.5rem 0.65rem", background: "var(--red-light)", color: "var(--red)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                  <Heart size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
