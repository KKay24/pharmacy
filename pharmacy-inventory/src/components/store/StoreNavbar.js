import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import StoreAuthModal from "./StoreAuthModal";

const NAV_LINKS = [
  { label: "Home", href: "/", activePath: "/" },
  { label: "Shop", href: "/shop", activePath: "/shop" },
  { label: "Prescriptions", href: "/prescription-upload", activePath: "/prescription-upload" },
  { label: "Health & Wellness", href: "/health-wellness", activePath: "/health-wellness" },
  { label: "About Us", href: "/about", activePath: "/about" },
];

export default function StoreNavbar({ onCartOpen }) {
  const { cartCount, storeUser, storeLogout } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [search, setSearch] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const activePath = location.hash
    ? `${location.pathname}${location.hash}`
    : location.pathname;

  const handleSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    navigate(`/shop?search=${encodeURIComponent(query)}`);
    setSearch("");
    setSearchOpen(false);
    setMenuOpen(false);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="customer-navbar">
      <div className="customer-navbar__topline" />
      <div className="customer-navbar__bar">
        <Link to="/" className="customer-navbar__brand" aria-label="MediQuick Pharmacy home">
          <span className="customer-navbar__logo">
            <img src="/logo512.png" alt="" />
          </span>
          <span className="customer-navbar__brand-copy">
            <strong>MediQuick <em>Pharmacy</em></strong>
            <small>Better health. Delivered.</small>
          </span>
        </Link>

        <nav className="customer-navbar__links" aria-label="Customer navigation">
          {NAV_LINKS.map(({ label, href, activePath: linkPath }) => (
            <Link
              key={label}
              to={href}
              className={activePath === linkPath ? "active" : ""}
              aria-current={activePath === linkPath ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="customer-navbar__actions">
          <button
            type="button"
            className="customer-navbar__icon"
            aria-label={searchOpen ? "Close product search" : "Search products"}
            onClick={() => setSearchOpen((open) => !open)}
          >
            {searchOpen ? <X size={22} /> : <Search size={22} />}
          </button>
          {storeUser ? (
            <Link to="/account" className="customer-navbar__account">
              <User size={21} />
              <span>My Account</span>
            </Link>
          ) : (
            <button
              type="button"
              className="customer-navbar__account"
              onClick={() => { setAuthMode("login"); setAuthOpen(true); }}
            >
              <User size={21} />
              <span>My Account</span>
            </button>
          )}
          <button
            type="button"
            className="customer-navbar__cart"
            aria-label={`Shopping cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
            onClick={onCartOpen}
          >
            <ShoppingCart size={25} />
            <span>{cartCount > 99 ? "99+" : cartCount}</span>
          </button>
          <button
            type="button"
            className="customer-navbar__menu-toggle"
            aria-label={menuOpen ? "Close customer navigation" : "Open customer navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <form className="customer-navbar__search" onSubmit={handleSearch}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search pharmacy products"
            placeholder="Search medicines and health products..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
          <button type="submit">Search</button>
        </form>
      )}

      <nav
        className={`customer-navbar__mobile${menuOpen ? " open" : ""}`}
        aria-label="Customer navigation"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        {NAV_LINKS.map(({ label, href }) => (
          <Link key={label} to={href} onClick={closeMenu}>{label}</Link>
        ))}
        {storeUser ? (
          <>
            <Link to="/account" onClick={closeMenu}>My Account &amp; Orders</Link>
            <button
              type="button"
              onClick={() => { storeLogout(); closeMenu(); }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { setAuthMode("login"); setAuthOpen(true); closeMenu(); }}
          >
            Sign In / Register
          </button>
        )}
      </nav>

      {authOpen && (
        <StoreAuthModal
          mode={authMode}
          onClose={() => setAuthOpen(false)}
          onSwitchMode={setAuthMode}
        />
      )}
    </header>
  );
}
