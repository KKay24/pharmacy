import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { StoreProvider } from "../../context/StoreContext";
import StoreNavbar from "./StoreNavbar";
import CartDrawer from "./CartDrawer";
import StoreFooter from "./StoreFooter";
import { StoreToast } from "./StoreToast";
import "../../styles/store.css";

export default function StoreLayout() {
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();

  return (
    <StoreProvider>
      <div className="store-page">
        {location.pathname !== "/" && <StoreNavbar onCartOpen={() => setCartOpen(true)} />}
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <main className="store-main">
          <Outlet context={{ openCart: () => setCartOpen(true) }} />
        </main>
        <StoreFooter />
        <StoreToast />
      </div>
    </StoreProvider>
  );
}
