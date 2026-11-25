import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { loadAuthSession, saveAuthSession } from "../utils/authStorage";
import { DataContext } from "./DataContext";
import { StoreProvider, useStore } from "./StoreContext";
import StoreFooter from "../components/store/StoreFooter";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  }),
  { virtual: true }
);

function CartHarness() {
  const { cart, addToCart, updateCartQty } = useStore();
  return (
    <div>
      <button type="button" onClick={() => addToCart({
        id: 17,
        name: "Backorder medicine",
        price: 10,
        stock: 0,
        inStock: false,
        batches: [{ quantity: 0 }],
      })}>
        Add zero-stock item
      </button>
      <button type="button" onClick={() => updateCartQty(17, 4)}>Set quantity</button>
      <output data-testid="cart">{JSON.stringify(cart)}</output>
    </div>
  );
}

function LoginHarness() {
  const { storeLogin } = useStore();
  return (
    <button type="button" onClick={() => storeLogin("admin", "password")}>
      Sign in as staff
    </button>
  );
}

const createToken = (expiration) => {
  const payload = btoa(JSON.stringify({ exp: expiration }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
};

function StaffAuthHarness({ children, onLogin }) {
  const [userRole, setUserRole] = React.useState(null);
  const loginUser = React.useCallback((payload) => {
    saveAuthSession(payload);
    setUserRole(payload.user.role);
    onLogin?.(payload);
  }, [onLogin]);
  const logoutUser = React.useCallback(() => {
    localStorage.removeItem("mediquick.auth");
    setUserRole(null);
  }, []);

  return (
    <DataContext.Provider value={{ userRole, loginUser, logoutUser }}>
      {children}
    </DataContext.Provider>
  );
}

describe("StoreContext customer cart", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("store_cart", JSON.stringify([{
      id: 17,
      name: "Saved medicine",
      quantity: 1,
      stock: 0,
      inStock: false,
      batches: [{ quantity: 0 }],
    }]));
  });

  it("removes saved stock details and permits quantities above stock", async () => {
    render(
      <StoreProvider>
        <CartHarness />
      </StoreProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("cart").textContent).not.toMatch(/stock|inStock|batches/i);
    });
    fireEvent.click(screen.getByRole("button", { name: "Add zero-stock item" }));
    fireEvent.click(screen.getByRole("button", { name: "Set quantity" }));

    await waitFor(() => {
      const cart = JSON.parse(screen.getByTestId("cart").textContent);
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(4);
      expect(cart[0].stock).toBeUndefined();
      expect(cart[0].inStock).toBeUndefined();
      expect(cart[0].batches).toBeUndefined();
    });
  });

  describe("StoreContext staff authentication integration", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("synchronizes a staff login through the storefront into the staff session", async () => {
      const loginUser = jest.fn();
      const user = { id: 8, username: "pharmacy-admin", role: "admin" };
      const token = createToken(Date.now() / 1000 + 3600);
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ token, user }),
      });

      render(
        <StaffAuthHarness onLogin={loginUser}>
          <StoreProvider>
            <LoginHarness />
            <StoreFooter />
          </StoreProvider>
        </StaffAuthHarness>
      );

      fireEvent.click(screen.getByRole("button", { name: "Sign in as staff" }));
      await waitFor(() => {
        expect(loginUser).toHaveBeenCalledWith({ token, user });
      });
      expect(JSON.parse(localStorage.getItem("mediquick.auth"))).toEqual({
        token,
        user,
      });
      expect(await screen.findByRole("link", { name: "Staff Workspace" })).toHaveAttribute("href", "/dashboard");
    });

    it("loads an existing storefront staff session for workspace access", async () => {
      const loginUser = jest.fn();
      localStorage.setItem("store_token", "signed-staff-token");
      localStorage.setItem("store_user", JSON.stringify({
        id: 8,
        username: "pharmacy-admin",
        role: "admin",
      }));

      render(
        <DataContext.Provider value={{ loginUser }}>
          <StoreProvider>
            <div>Storefront</div>
          </StoreProvider>
        </DataContext.Provider>
      );

      expect(loadAuthSession()).toEqual({
        token: "signed-staff-token",
        user: {
          id: 8,
          username: "pharmacy-admin",
          role: "admin",
        },
      });
    });

    it("does not treat a storefront customer session as staff authentication", () => {
      localStorage.setItem("store_token", "customer-token");
      localStorage.setItem("store_user", JSON.stringify({ role: "customer" }));
      expect(loadAuthSession()).toBeNull();
    });
  });
});
