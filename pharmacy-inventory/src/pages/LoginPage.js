import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, ChevronRight, HeartPulse, Lock, Menu, Pill,
  Search, ShieldCheck, ShoppingCart, Truck, User, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch } from "../utils/api";
import { DataContext } from "../context/DataContext";
import "../styles/login-modern.css";

const categories = [
  ["Prescription Medicines", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80"],
  ["Over-the-Counter", "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=700&q=80"],
  ["Vitamins & Supplements", "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=700&q=80"],
  ["Personal Care", "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=700&q=80"],
  ["Baby & Child Care", "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=700&q=80"],
  ["Health Devices", "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?auto=format&fit=crop&w=700&q=80"],
];

function SignInModal({ onClose, onSubmit, username, password, setUsername, setPassword, isLoading }) {
  return (
    <div className="hp-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="hp-login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="hp-modal-close" type="button" onClick={onClose} aria-label="Close sign in"><X size={19} /></button>
        <div className="hp-modal-icon"><ShieldCheck size={24} /></div>
        <p className="hp-kicker">Secure staff access</p>
        <h2 id="login-title">Welcome back</h2>
        <p className="hp-modal-copy">Sign in to manage pharmacy operations.</p>
        <form onSubmit={onSubmit} className="hp-login-form">
          <label>Username<span className="hp-field-wrap"><User size={17} /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username or Staff ID" autoFocus disabled={isLoading} /></span></label>
          <label>Password<span className="hp-field-wrap"><Lock size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Secure password" disabled={isLoading} /></span></label>
          <button className="hp-primary-btn hp-login-submit" type="submit" disabled={isLoading}>{isLoading ? "Signing in..." : "Sign in"} {!isLoading && <ArrowRight size={17} />}</button>
        </form>
        <div className="hp-secure-note"><ShieldCheck size={15} /> Your account is protected</div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { loginUser } = useContext(DataContext);

  const getLandingRoute = (role) => role === "admin" || role === "manager" ? "/dashboard" : "/pos";

  const handleLogin = async (event) => {
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
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername, password: trimmedPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Invalid credentials", { id: toastId });
        return;
      }
      toast.success(`Welcome back, ${data.user?.username || "Staff"}`, { id: toastId });
      loginUser(data);
      navigate(getLandingRoute(data.user?.role));
    } catch (error) {
      console.error("Login error", error);
      toast.error("Network error: verification failed", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hp-page">
      <header className="hp-header">
        <a href="#top" className="hp-brand" aria-label="MediQuick Pharmacy home"><span className="hp-brand-mark"><HeartPulse size={26} strokeWidth={2.8} /></span><span><strong>MediQuick <em>Pharmacy</em></strong><small>Better health. Delivered.</small></span></a>
        <nav className="hp-nav" aria-label="Main navigation"><a className="active" href="#top">Home</a><a href="#categories">Shop</a><a href="#services">Prescriptions</a><a href="#services">Health &amp; Wellness</a><a href="#about">About Us</a></nav>
        <div className="hp-header-actions"><button type="button" className="hp-icon-button" aria-label="Search"><Search size={19} /></button><button type="button" className="hp-signin-link" aria-label="Sign in or register" onClick={() => setIsModalOpen(true)}><User size={18} /> <span>Sign In / Register</span></button><button type="button" className="hp-cart-button" aria-label="Shopping cart"><ShoppingCart size={21} /><b>0</b></button></div>
        <button type="button" className="hp-menu-button" aria-label="Open menu"><Menu size={23} /></button>
      </header>

      <main id="top">
        <section className="hp-hero"><div className="hp-hero-content"><p className="hp-kicker">Your online pharmacy</p><h1>Quality Medicines.<br /><span>Delivered to Your Door.</span></h1><p className="hp-hero-copy">Prescriptions, over-the-counter medicines, vitamins, and more &mdash; all in one place. Safe. Convenient. Affordable.</p><div className="hp-search-bar"><Search size={20} /><input aria-label="Search medicines" placeholder="Search for medicines, health products, or conditions..." /><button type="button">Search</button></div><div className="hp-hero-benefits"><div><Truck size={24} /><span><strong>Fast &amp; Reliable Delivery</strong><small>Get your order, on time.</small></span></div><div><ShieldCheck size={24} /><span><strong>Licensed Pharmacy</strong><small>100% genuine products.</small></span></div><div><Lock size={24} /><span><strong>Secure Checkout</strong><small>Your information is safe.</small></span></div></div></div><div className="hp-hero-image" aria-label="Pharmacist holding a tablet"></div></section>
        <section className="hp-services" id="services"><div><span className="hp-service-icon"><Pill size={24} /></span><span><strong>Wide Range<br />of Products</strong><small>From everyday essentials<br />to specialist care.</small></span></div><div><span className="hp-service-icon"><Check size={25} /></span><span><strong>Great Prices</strong><small>Quality healthcare<br />within your budget.</small></span></div><div><span className="hp-service-icon"><Truck size={24} /></span><span><strong>Fast Delivery</strong><small>Get what you need,<br />when you need it.</small></span></div><div><span className="hp-service-icon"><HeartPulse size={24} /></span><span><strong>Expert Support</strong><small>Our pharmacists are<br />here to help.</small></span></div></section>
        <section className="hp-categories" id="categories"><div className="hp-section-heading"><h2>Shop by Category</h2><a href="#categories">View All Categories <ArrowRight size={16} /></a></div><div className="hp-category-grid">{categories.map(([name, image]) => <a href="#categories" className="hp-category-card" key={name}><img src={image} alt="" /><span>{name}<ChevronRight size={17} /></span></a>)}</div></section>
        <section className="hp-about" id="about"><p className="hp-kicker">Care you can count on</p><h2>Your health, made simpler.</h2><p>From trusted medicines to everyday wellness essentials, MediQuick Pharmacy helps your family feel ready for every day.</p></section>
      </main>
      {isModalOpen && <SignInModal onClose={() => setIsModalOpen(false)} onSubmit={handleLogin} username={username} password={password} setUsername={setUsername} setPassword={setPassword} isLoading={isLoading} />}
    </div>
  );
}
