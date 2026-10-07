import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiUrl } from "../utils/api";

export const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  // Auth
  const [storeUser, setStoreUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("store_user")); } catch { return null; }
  });
  const [storeToken, setStoreToken] = useState(() => localStorage.getItem("store_token") || null);

  // Cart
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("store_cart")) || []; } catch { return []; }
  });

  // Wishlist
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem("store_wishlist")) || []; } catch { return []; }
  });

  // Persist cart & wishlist
  useEffect(() => { localStorage.setItem("store_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("store_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  // --- Auth helpers ---
  const storeLogin = async (username, password) => {
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");
    localStorage.setItem("store_token", data.token);
    localStorage.setItem("store_user", JSON.stringify(data.user));
    setStoreToken(data.token);
    setStoreUser(data.user);
    return data;
  };

  const storeRegister = async (payload) => {
    const res = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Registration failed");
    localStorage.setItem("store_token", data.token);
    localStorage.setItem("store_user", JSON.stringify(data.user));
    setStoreToken(data.token);
    setStoreUser(data.user);
    return data;
  };

  const storeLogout = () => {
    localStorage.removeItem("store_token");
    localStorage.removeItem("store_user");
    setStoreToken(null);
    setStoreUser(null);
  };

  // --- API helpers ---
  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (storeToken) headers["Authorization"] = `Bearer ${storeToken}`;
    const res = await fetch(apiUrl(path), { ...options, headers, credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
    return data;
  }, [storeToken]);

  // --- Cart helpers ---
  const addToCart = (product, qty = 1) => {
    const availableStock = Number(product.stock);
    if (!Number.isInteger(qty) || qty < 1 || availableStock < 1) return;
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id
          ? { ...i, ...product, quantity: Math.min(availableStock, i.quantity + qty) }
          : i);
      }
      return [...prev, { ...product, quantity: Math.min(availableStock, qty) }];
    });
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.id !== productId));

  const updateCartQty = (productId, qty) => {
    if (qty < 1) return removeFromCart(productId);
    setCart(prev => prev.map(i => i.id === productId
      ? { ...i, quantity: Math.min(Number(i.stock) || 0, qty) }
      : i).filter(item => item.quantity > 0));
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);

  // --- Wishlist helpers ---
  const toggleWishlist = (product) => {
    setWishlist(prev => {
      const exists = prev.find(i => i.id === product.id);
      return exists ? prev.filter(i => i.id !== product.id) : [...prev, product];
    });
  };
  const isWishlisted = (productId) => wishlist.some(i => i.id === productId);

  return (
    <StoreContext.Provider value={{
      storeUser, storeToken,
      storeLogin, storeRegister, storeLogout,
      cart, cartCount, cartTotal,
      addToCart, removeFromCart, updateCartQty, clearCart,
      wishlist, toggleWishlist, isWishlisted,
      apiFetch,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
