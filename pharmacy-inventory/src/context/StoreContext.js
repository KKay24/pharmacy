import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiUrl } from "../utils/api";

export const StoreContext = createContext(null);

function withoutInventoryLevels(product) {
  const customerProduct = { ...product };
  delete customerProduct.stock;
  delete customerProduct.inStock;
  delete customerProduct.batches;
  return customerProduct;
}

export function StoreProvider({ children }) {
  // Auth
  const [storeUser, setStoreUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("store_user")); } catch { return null; }
  });
  const [storeToken, setStoreToken] = useState(() => localStorage.getItem("store_token") || null);

  // Cart
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = JSON.parse(localStorage.getItem("store_cart")) || [];
      return Array.isArray(savedCart) ? savedCart.map(withoutInventoryLevels) : [];
    } catch { return []; }
  });

  // Wishlist
  const [wishlist, setWishlist] = useState(() => {
    try {
      const savedWishlist = JSON.parse(localStorage.getItem("store_wishlist")) || [];
      return Array.isArray(savedWishlist) ? savedWishlist.map(withoutInventoryLevels) : [];
    } catch { return []; }
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
    if (!Number.isInteger(qty) || qty < 1) return;
    const customerProduct = withoutInventoryLevels(product);
    setCart(prev => {
      const existing = prev.find(i => i.id === customerProduct.id);
      if (existing) {
        return prev.map(i => i.id === customerProduct.id
          ? { ...i, ...customerProduct, quantity: i.quantity + qty }
          : i);
      }
      return [...prev, { ...customerProduct, quantity: qty }];
    });
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.id !== productId));

  const updateCartQty = (productId, qty) => {
    if (qty < 1) return removeFromCart(productId);
    setCart(prev => prev.map(i => i.id === productId
      ? { ...i, quantity: qty }
      : i).filter(item => item.quantity > 0));
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);

  // --- Wishlist helpers ---
  const toggleWishlist = (product) => {
    const customerProduct = withoutInventoryLevels(product);
    setWishlist(prev => {
      const exists = prev.find(i => i.id === customerProduct.id);
      return exists ? prev.filter(i => i.id !== customerProduct.id) : [...prev, customerProduct];
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
