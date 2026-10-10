import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { StoreProvider } from "../../context/StoreContext";
import StoreNavbar from "./StoreNavbar";
import CartDrawer from "./CartDrawer";
import StoreFooter from "./StoreFooter";
import { StoreToast } from "./StoreToast";
import CustomerSupportChat from "./CustomerSupportChat";
import "../../styles/store.css";

export default function StoreLayout() {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <StoreProvider>
      <div className="store-page">
        <StoreNavbar onCartOpen={() => setCartOpen(true)} />
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <main className="store-main">
          <Outlet context={{ openCart: () => setCartOpen(true) }} />
        </main>
        <StoreFooter />
        <CustomerSupportChat />
        <StoreToast />
      </div>
    </StoreProvider>
  );
}
