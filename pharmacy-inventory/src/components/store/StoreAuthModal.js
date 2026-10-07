import React, { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { showToast } from "./StoreToast";

export default function StoreAuthModal({ mode, onClose, onSwitchMode }) {
  const { storeLogin, storeRegister } = useStore();
  const [form, setForm] = useState({ name: "", email: "", phone: "", username: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "register" && form.password !== form.confirmPassword) {
      return setError("Passwords do not match");
    }
    if (mode === "register" && form.password.length < 12) {
      return setError("Password must be at least 12 characters");
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await storeLogin(form.username || form.email, form.password);
        showToast("Welcome back!", "success");
      } else {
        await storeRegister({
          username: form.email || form.phone,
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
        });
        showToast("Account created successfully!", "success");
      }
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="store-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="store-modal">
        <button className="store-modal__close" onClick={onClose}><X size={20} /></button>

        {mode === "login" ? (
          <>
            <div className="store-modal__title">Sign In</div>
            <p className="store-modal__subtitle">Access your orders, prescriptions, and wishlist</p>
          </>
        ) : (
          <>
            <div className="store-modal__title">Create Account</div>
            <p className="store-modal__subtitle">Join MediQuick for a faster checkout experience</p>
          </>
        )}

        {error && <div className="store-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="store-form-grid" style={{ gap: "0.85rem" }}>
            {mode === "register" && (
              <>
                <div className="store-form-group">
                  <label>Full Name</label>
                  <input type="text" placeholder="John Banda" value={form.name} onChange={e => set("name", e.target.value)} required />
                </div>
                <div className="store-form-group">
                  <label>Email Address</label>
                  <input type="email" placeholder="john@email.com" value={form.email} onChange={e => set("email", e.target.value)} />
                </div>
                <div className="store-form-group">
                  <label>Phone Number</label>
                  <input type="tel" placeholder="+260 97 XXXXXXX" value={form.phone} onChange={e => set("phone", e.target.value)} />
                </div>
              </>
            )}

            {mode === "login" && (
              <div className="store-form-group">
                <label>Email or Username</label>
                <input type="text" placeholder="your@email.com" value={form.username} onChange={e => set("username", e.target.value)} required />
              </div>
            )}

            <div className="store-form-group">
              <label>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder={mode === "register" ? "Min 12 characters" : "Your password"}
                  value={form.password} onChange={e => set("password", e.target.value)} required
                  style={{ paddingRight: "2.5rem" }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div className="store-form-group">
                <label>Confirm Password</label>
                <input type={showPass ? "text" : "password"} placeholder="Repeat password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} required />
              </div>
            )}
          </div>

          <button type="submit" className="store-modal__submit" disabled={loading} style={{ marginTop: "1.25rem" }}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="store-modal__switch">
          {mode === "login" ? (
            <>Don't have an account? <button type="button" onClick={() => onSwitchMode("register")}>Sign Up</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => onSwitchMode("login")}>Sign In</button></>
          )}
        </div>
      </div>
    </div>
  );
}
