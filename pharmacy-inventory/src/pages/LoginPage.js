import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  HeartPulse,
  Lock,
  Pill,
  Search,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch as staffApiFetch } from "../utils/api";
import { DataContext } from "../context/DataContext";
import { useStore } from "../context/StoreContext";
import { ProductCard, ProductCardSkeleton } from "../components/store/ProductCard";
import "../styles/login-modern.css";

const CATEGORY_IMAGES = {
  medicines: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80",
  "medical-supplies": "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=700&q=80",
  "vitamins-supplements": "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=700&q=80",
  "personal-care": "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=700&q=80",
  "baby-products": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=700&q=80",
};

function StaffLogin({ onSubmit, username, password, setUsername, setPassword, loading }) {
  return (
    <main className="hp-staff-login">
      <form className="hp-login-modal" onSubmit={onSubmit}>
        <div className="hp-modal-icon"><ShieldCheck size={24} /></div>
        <p className="hp-kicker">Secure staff access</p>
        <h1>Welcome back</h1>
        <p className="hp-modal-copy">Sign in to manage pharmacy operations.</p>
        <div className="hp-login-form">
          <label>
            Username
            <span className="hp-field-wrap"><User size={17} /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username or Staff ID" autoFocus disabled={loading} /></span>
          </label>
          <label>
            Password
            <span className="hp-field-wrap"><Lock size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" disabled={loading} /></span>
          </label>
          <button className="hp-primary-btn hp-login-submit" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"} {!loading && <ArrowRight size={17} />}
          </button>
        </div>
        <Link className="hp-back-to-store" to="/">Back to the pharmacy store</Link>
      </form>
    </main>
  );
}

export default function LoginPage({ staffMode = false }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser } = useContext(DataContext);
  const { apiFetch } = useStore();
  const { openCart } = useOutletContext() || {};
  const isStaffLogin = staffMode || location.pathname === "/staff/login";

  const loadHomeCatalog = useCallback(async () => {
    setCatalogError("");
    setLoadingProducts(true);
    try {
      const [categoryRows, popularRows] = await Promise.all([
        apiFetch("/api/products/categories"),
        apiFetch("/api/products/popular?limit=8"),
      ]);
      setCategories(Array.isArray(categoryRows) ? categoryRows : []);
      setFeatured(Array.isArray(popularRows) ? popularRows : []);
    } catch (error) {
      setCatalogError(error.message || "The pharmacy catalogue could not be loaded.");
      setCategories([]);
      setFeatured([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!isStaffLogin) loadHomeCatalog();
  }, [isStaffLogin, loadHomeCatalog]);

  const handleStaffLogin = async (event) => {
    event.preventDefault();
    if (isLoading) return;
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    if (!trimmedUsername || !trimmedPassword) {
      toast.error("Please enter both credentials");
      return;
    }
    setIsLoading(true);
    const toastId = toast.loading("Signing you in...");
    try {
      const response = await staffApiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername, password: trimmedPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || data.message || "Invalid credentials", { id: toastId });
        return;
      }
      toast.success(`Welcome back, ${data.user?.username || "Staff"}`, { id: toastId });
      loginUser(data);
      navigate(data.user?.role === "admin" || data.user?.role === "manager" ? "/dashboard" : "/pos");
    } catch (error) {
      console.error("Login error", error);
      toast.error("Network error: verification failed", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  if (isStaffLogin) {
    return (
      <div className="hp-page">
        <StaffLogin onSubmit={handleStaffLogin} username={username} password={password} setUsername={setUsername} setPassword={setPassword} loading={isLoading} />
      </div>
    );
  }

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    if (query) navigate(`/shop?search=${encodeURIComponent(query)}`);
  };

  return (
    <div className="hp-page">
      <main id="top">
        <section className="hp-hero">
          <div className="hp-hero-content">
            <p className="hp-kicker">Your online pharmacy</p>
            <h1>Quality Medicines.<br /><span>Delivered to Your Door.</span></h1>
            <p className="hp-hero-copy">Browse medicines and health products from the pharmacy's current inventory. Search the catalogue or explore categories below.</p>
            <form className="hp-search-bar" onSubmit={submitSearch}>
              <Search size={20} />
              <input aria-label="Search medicines" placeholder="Search medicines and health products..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <button type="submit">Search</button>
            </form>
            <div className="hp-hero-benefits">
              <div><Pill size={24} /><span><strong>Pharmacy Products</strong><small>Browse current inventory.</small></span></div>
              <div><ShieldCheck size={24} /><span><strong>Prescription Services</strong><small>Submit a prescription for review.</small></span></div>
              <div><Lock size={24} /><span><strong>Order Checkout</strong><small>Orders are verified by the pharmacy.</small></span></div>
            </div>
          </div>
          <div className="hp-hero-image" role="img" aria-label="Pharmacist holding a tablet" />
        </section>

        <section className="hp-services" id="services">
          <div><span className="hp-service-icon"><Pill size={24} /></span><span><strong>Pharmacy Products</strong><small>Browse available items<br />from pharmacy inventory.</small></span></div>
          <div><span className="hp-service-icon"><Check size={25} /></span><span><strong>Live Availability</strong><small>Stock status is read<br />from the inventory system.</small></span></div>
          <div><span className="hp-service-icon"><Truck size={24} /></span><span><strong>Delivery or Pickup</strong><small>Choose an option<br />during checkout.</small></span></div>
          <div><span className="hp-service-icon"><HeartPulse size={24} /></span><span><strong>Prescription Support</strong><small>Prescription products<br />require pharmacy review.</small></span></div>
        </section>

        <section className="hp-categories" id="categories">
          <div className="hp-section-heading">
            <h2>Shop by Category</h2>
            <Link to="/shop">View all products <ArrowRight size={16} /></Link>
          </div>
          {catalogError && <div className="hp-catalog-error" role="alert">{catalogError} <button type="button" onClick={loadHomeCatalog}>Try again</button></div>}
          <div className="hp-category-grid">
            {categories.map((category) => (
              <Link to={`/shop?category=${encodeURIComponent(category.slug)}`} className="hp-category-card" key={category.id}>
                <img src={CATEGORY_IMAGES[category.slug] || CATEGORY_IMAGES.medicines} alt="" loading="lazy" />
                <span>{category.name}<ChevronRight size={17} /></span>
              </Link>
            ))}
            {!loadingProducts && !catalogError && categories.length === 0 && <p className="hp-empty-state">No product categories are available yet.</p>}
            {loadingProducts && <p className="hp-loading-state">Loading pharmacy categories…</p>}
          </div>
        </section>

        <section className="hp-products">
          <div className="hp-section-heading">
            <div><h2>Available Products</h2><p>Products and availability from the pharmacy inventory.</p></div>
            <Link to="/shop">Browse all <ArrowRight size={16} /></Link>
          </div>
          {catalogError ? (
            <div className="hp-catalog-error" role="alert">Products could not be loaded. <button type="button" onClick={loadHomeCatalog}>Retry</button></div>
          ) : (
            <div className="hp-product-grid">
              {loadingProducts
                ? Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)
                : featured.map((product) => <ProductCard key={product.id} product={product} onCartOpen={openCart} />)}
              {!loadingProducts && !catalogError && featured.length === 0 && <p className="hp-empty-state">There are no customer-visible products in stock right now.</p>}
            </div>
          )}
        </section>

        <section className="hp-about" id="about">
          <p className="hp-kicker">MediQuick Pharmacy</p>
          <h2>Your health, made simpler.</h2>
          <p>Browse pharmacy products, check availability, and send your order to the pharmacy for processing.</p>
          <Link to="/shop" className="hp-about-link">Browse products <ArrowRight size={16} /></Link>
        </section>
      </main>
    </div>
  );
}
