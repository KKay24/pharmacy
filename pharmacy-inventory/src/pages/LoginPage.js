import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowRight,
  Check,
  HeartPulse,
  Lock,
  Pill,
  Search,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch as staffApiFetch, getApiErrorMessage } from "../utils/api";
import { getNetworkErrorMessage } from "../utils/errorMessages";
import { DataContext } from "../context/DataContext";
import { useStore } from "../context/StoreContext";
import { ProductCard, ProductCardSkeleton } from "../components/store/ProductCard";
import HeroBannerCarousel from "../components/store/HeroBannerCarousel";
import CategoryCarousel from "../components/store/CategoryCarousel";
import { HERO_BANNERS } from "../data/homepageMedia";
import "../styles/login-modern.css";

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

export default function LoginPage({ staffMode = false, heroBanners = HERO_BANNERS }) {
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
      if (!response.ok) {
        const message = await getApiErrorMessage(response, "Invalid credentials", { context: "login" });
        toast.error(message, { id: toastId });
        return;
      }
      const data = await response.json();
      toast.success(`Welcome back, ${data.user?.username || "Staff"}`, { id: toastId });
      loginUser(data);
      navigate(data.user?.role === "admin" || data.user?.role === "manager" ? "/dashboard" : "/pos");
    } catch (error) {
      console.error("Login error", error);
      toast.error(getNetworkErrorMessage(error), { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  if (isStaffLogin) {
    return (
      <div className="hp-page">
        <StaffLogin
          onSubmit={handleStaffLogin}
          username={username}
          password={password}
          setUsername={setUsername}
          setPassword={setPassword}
          loading={isLoading}
        />
      </div>
    );
  }

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    if (query) navigate(`/shop?search=${encodeURIComponent(query)}`);
  };

  const heroSearchBar = (
    <form className="hp-search-bar" onSubmit={submitSearch} role="search">
      <Search size={19} aria-hidden="true" />
      <input
        aria-label="Search medicines"
        placeholder="Search medicines, brands, or active ingredients..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <button type="submit">Search</button>
    </form>
  );

  return (
    <div className="hp-page">
      <main id="top">
        <HeroBannerCarousel
          banners={heroBanners}
          autoPlayInterval={5000}
          searchSlot={heroSearchBar}
        />

        <section className="hp-services" id="services">
          <div><span className="hp-service-icon"><Pill size={24} /></span><span><strong>Pharmacy Products</strong><small>Explore products<br />in the pharmacy catalogue.</small></span></div>
          <div><span className="hp-service-icon"><Check size={25} /></span><span><strong>Pharmacy Review</strong><small>Orders are reviewed<br />by our pharmacy team.</small></span></div>
          <div><span className="hp-service-icon"><Truck size={24} /></span><span><strong>Delivery or Pickup</strong><small>Choose an option<br />during checkout.</small></span></div>
          <div><span className="hp-service-icon"><HeartPulse size={24} /></span><span><strong>Prescription Support</strong><small>Prescription products<br />require pharmacy review.</small></span></div>
        </section>

        <CategoryCarousel
          categories={categories}
          loading={loadingProducts}
          error={catalogError}
          onRetry={loadHomeCatalog}
          autoPlayInterval={3500}
        />

        <section className="hp-products">
          <div className="hp-section-heading">
            <div><h2>Pharmacy Products</h2><p>Browse medicines and health products from our catalogue.</p></div>
            <Link to="/shop">Browse all <ArrowRight size={16} /></Link>
          </div>
          {catalogError ? (
            <div className="hp-catalog-error" role="alert">Products could not be loaded. <button type="button" onClick={loadHomeCatalog}>Retry</button></div>
          ) : (
            <div className="hp-product-grid">
              {loadingProducts
                ? Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)
                : featured.map((product) => <ProductCard key={product.id} product={product} onCartOpen={openCart} />)}
              {!loadingProducts && !catalogError && featured.length === 0 && <p className="hp-empty-state">No products are currently listed in the catalogue.</p>}
            </div>
          )}
        </section>

        <section className="hp-about" id="about">
          <p className="hp-kicker">MediQuick Pharmacy</p>
          <h2>Your health, made simpler.</h2>
          <p>Browse pharmacy products and send your order to the pharmacy for processing.</p>
          <Link to="/shop" className="hp-about-link">Browse products <ArrowRight size={16} /></Link>
        </section>
      </main>
    </div>
  );
}
