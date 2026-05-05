import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { 
    User, 
    Lock, 
    ArrowRight, 
    ShieldCheck, 
    Cross 
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch } from "../utils/api";
import { DataContext } from "../context/DataContext";
import "../styles/login-modern.css";

export default function LoginPage() {
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { loginUser } = useContext(DataContext);

  const getLandingRoute = (role) => {
    if (role === "admin") return "/dashboard";
    if (role === "manager") return "/reports";
    return "/pos";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const username = adminUser.trim();
    const password = adminPass.trim();

    if (!username || !password) {
      toast.error("Please enter both credentials");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Authenticating...");

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Welcome back, ${data.user?.username || 'Staff'}`, { id: toastId });
        if (data.user && data.token) {
          loginUser(data);
        }
        navigate(getLandingRoute(data.user?.role));
      } else {
        toast.error(data.error || "Access Denied: Invalid Credentials", { id: toastId });
      }
    } catch (err) {
      console.error("Login error", err);
      toast.error("Network Error: Verification failed", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-glass-card">
        {/* Brand Header */}
        <div className="login-brand">
          <div className="login-logo">
            <Cross size={32} color="white" />
          </div>
          <h1 className="login-title">Mediquick</h1>
          <p className="login-subtitle">Enterprise Pharmacy Management</p>
        </div>

        {/* Login Form */}
        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-input-group">
            <div className="login-input-wrapper">
              <User size={18} className="login-input-icon" />
              <input
                type="text"
                className="login-field"
                placeholder="Username or Staff ID"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                autoFocus
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="login-input-group">
            <div className="login-input-wrapper">
              <Lock size={18} className="login-input-icon" />
              <input
                type="password"
                className="login-field"
                placeholder="Secure Password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? (
              <div className="login-spinner"></div>
            ) : (
              <>
                Initialize Access <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <ShieldCheck size={14} />
          Authorized Personnel Access Only
        </div>
      </div>
    </div>
  );
}
