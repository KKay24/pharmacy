import React from "react";
import { Link } from "react-router-dom";
import { Shield, Truck } from "lucide-react";

export default function StoreFooter() {
  return (
    <footer className="store-footer">
      <div className="store-footer__top">
        <div className="store-footer__brand">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--brand-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="store-footer__logo-text">MediQuick</span>
          </div>
          <p>Browse customer-visible pharmacy products using the current inventory and stock records.</p>
        </div>

        <div className="store-footer__col">
          <h4>Shop</h4>
          <ul>
            <li><Link to="/shop">All Products</Link></li>
            <li><Link to="/shop?prescriptionRequired=false">OTC Medicines</Link></li>
          </ul>
        </div>

        <div className="store-footer__col">
          <h4>Services</h4>
          <ul>
            <li><Link to="/prescription-upload">Submit Prescription</Link></li>
            <li><Link to="/track-order">Track Your Order</Link></li>
            <li><Link to="/account">My Account</Link></li>
            <li><Link to="/health-wellness">Health &amp; Wellness</Link></li>
            <li><Link to="/contact">Contact Us</Link></li>
          </ul>
        </div>

        <div className="store-footer__col">
          <h4>Pharmacy</h4>
          <ul>
            <li><Link to="/about">About MediQuick</Link></li>
            <li><Link to="/staff/login">Staff sign in</Link></li>
            <li><Link to="/account">Order history</Link></li>
          </ul>
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.05)", padding: "1.25rem 1.5rem" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: "1.25rem" }}>
          {[
          { icon: <Truck size={18} />, label: "Delivery options", sub: "Delivery or pickup at checkout" },
          { icon: <Shield size={18} />, label: "Pharmacy inventory", sub: "Product stock checked at checkout" },
          ].map(({ icon, label, sub }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "rgba(255,255,255,0.75)" }}>
              <div style={{ color: "var(--brand-teal-light)" }}>{icon}</div>
              <div>
                <strong style={{ display: "block", fontSize: "0.85rem", color: "white" }}>{label}</strong>
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="store-footer__bottom">
        <span>© {new Date().getFullYear()} MediQuick Pharmacy. All rights reserved.</span>
      </div>
    </footer>
  );
}
