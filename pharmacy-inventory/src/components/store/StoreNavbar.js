import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, User, Search, X, Package, FileText, LogOut } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import StoreAuthModal from "./StoreAuthModal";

export default function StoreNavbar({ onCartOpen }) {
  const { cartCount, storeUser, storeLogout } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/shop?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setMenuOpen(false);
    }
  };

  const openAuth = (mode = "login") => { setAuthMode(mode); setAuthOpen(true); };

  const NAV_LINKS = [
    { label: "Shop", href: "/shop" },
    { label: "Prescriptions", href: "/prescription-upload" },
    { label: "Track Order", href: "/track-order" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <>
      {/* Announcement */}
      <div className="store-announcement">
        MediQuick Pharmacy &nbsp;|&nbsp;
        <Link to="/shop">Shop Now →</Link>
      </div>

      <nav className="store-navbar">
        <div className="store-navbar__inner">
          {/* Logo */}
          <Link to="/" className="store-navbar__logo">
            <div className="store-navbar__logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="store-navbar__logo-text">
              MediQuick
              <span>Online Pharmacy</span>
            </div>
          </Link>

          {/* Search */}
          <div className="store-navbar__search">
            <form onSubmit={handleSearch} style={{ display: "contents" }}>
              <Search size={16} className="store-navbar__search-icon" />
              <input
                type="text" placeholder="Search medicines, vitamins..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
              <button type="submit" className="store-navbar__search-btn">Search</button>
            </form>
          </div>

          {/* Actions */}
          <div className="store-navbar__actions">
            {NAV_LINKS.slice(0, 2).map(l => (
              <Link key={l.label} to={l.href} className="store-nav-btn">
                {l.label === "Prescriptions" ? <FileText size={16} /> : null}
                {l.label}
              </Link>
            ))}

            {storeUser ? (
              <Link to="/account" className="store-nav-btn">
                <User size={17} />
                <span className="mobile-hide">{storeUser.username?.split(" ")[0] || "My Account"}</span>
              </Link>
            ) : (
              <button className="store-nav-btn" onClick={() => openAuth("login")}>
                <User size={17} /> Sign In
              </button>
            )}

            <button className="store-nav-btn store-cart-nav-btn" onClick={onCartOpen} style={{ position: "relative" }}>
              <ShoppingCart size={20} />
              {cartCount > 0 && <span className="store-nav-btn__badge">{cartCount > 99 ? "99+" : cartCount}</span>}
            </button>

            <button className="store-nav__hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu">
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`store-nav__mobile-menu ${menuOpen ? "open" : ""}`}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <button className="store-nav__mobile-close" onClick={() => setMenuOpen(false)}>
          <X size={24} />
        </button>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <input
            type="text" placeholder="Search medicines..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, padding: "0.65rem 1rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.9rem", fontFamily: "inherit", outline: "none" }}
          />
          <button type="submit" style={{ background: "var(--brand-blue)", color: "white", padding: "0 1rem", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontWeight: 600 }}>Go</button>
        </form>

        {NAV_LINKS.map(l => (
          <Link key={l.label} to={l.href} className="store-nav__mobile-link" onClick={() => setMenuOpen(false)}>
            {l.label}
          </Link>
        ))}

        <div style={{ borderTop: "1px solid var(--border)", marginTop: "1rem", paddingTop: "1rem" }}>
          {storeUser ? (
            <>
              <Link to="/account" className="store-nav__mobile-link" onClick={() => setMenuOpen(false)}>
                <User size={18} /> My Account
              </Link>
              <Link to="/account" className="store-nav__mobile-link" onClick={() => setMenuOpen(false)}>
                <Package size={18} /> My Orders
              </Link>
              <button className="store-nav__mobile-link" style={{ width: "100%", cursor: "pointer", color: "var(--red)" }}
                onClick={() => { storeLogout(); setMenuOpen(false); }}>
                <LogOut size={18} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <button className="store-nav__mobile-link" style={{ width: "100%", cursor: "pointer" }}
                onClick={() => { openAuth("login"); setMenuOpen(false); }}>
                <User size={18} /> Sign In
              </button>
              <button className="store-nav__mobile-link" style={{ width: "100%", cursor: "pointer", background: "var(--brand-blue)", color: "white", borderRadius: "var(--radius)" }}
                onClick={() => { openAuth("register"); setMenuOpen(false); }}>
                <User size={18} /> Create Account
              </button>
            </>
          )}
        </div>
      </div>

      {authOpen && <StoreAuthModal mode={authMode} onClose={() => setAuthOpen(false)} onSwitchMode={setAuthMode} />}
    </>
  );
}
