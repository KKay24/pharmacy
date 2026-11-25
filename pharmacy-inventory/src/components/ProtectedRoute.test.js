import React from "react";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { DataContext } from "../context/DataContext";
import ProtectedRoute from "./ProtectedRoute";

jest.mock(
  "react-router-dom",
  () => ({
    Navigate: ({ to }) => require("react").createElement("div", {
      "data-testid": "redirect",
      "data-to": to,
    }),
    useLocation: () => ({ pathname: globalThis.location.pathname }),
  }),
  { virtual: true }
);

const createToken = (expiration) => {
  const payload = btoa(JSON.stringify({ exp: expiration }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
};

function renderProtectedRoute({ role = null, token = null, path = "/dashboard" } = {}) {
  window.localStorage.clear();
  window.history.replaceState({}, "", path);
  if (token) {
    window.localStorage.setItem("mediquick.auth", JSON.stringify({ token, user: { role } }));
  }

  return render(
    <DataContext.Provider value={{ userRole: role }}>
      <ProtectedRoute allowedRoles={["admin", "manager"]}>
        <h1>Dashboard</h1>
      </ProtectedRoute>
    </DataContext.Provider>
  );
}

describe("ProtectedRoute staff session enforcement", () => {
  afterEach(() => {
    jest.useRealTimers();
    window.localStorage.clear();
  });

  it("redirects unauthenticated visitors to staff authentication", () => {
    renderProtectedRoute();
    expect(screen.getByTestId("redirect")).toHaveAttribute("data-to", "/staff/login");
  });

  it("denies customer roles and sends them to the storefront", () => {
    renderProtectedRoute({
      role: "customer",
      token: createToken(Date.now() / 1000 + 3600),
    });
    expect(screen.getByTestId("redirect")).toHaveAttribute("data-to", "/");
  });

  it("redirects an expired staff session to staff authentication", () => {
    renderProtectedRoute({
      role: "manager",
      token: createToken(Date.now() / 1000 - 1),
    });
    expect(screen.getByTestId("redirect")).toHaveAttribute("data-to", "/staff/login");
  });

  it("allows an authorized staff member to open the dashboard", () => {
    renderProtectedRoute({
      role: "manager",
      token: createToken(Date.now() / 1000 + 3600),
    });
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("redirects an active dashboard session when its token expires", () => {
    jest.useFakeTimers();
    const tokenExpiration = Math.ceil(Date.now() / 1000) + 1;
    renderProtectedRoute({
      role: "manager",
      token: createToken(tokenExpiration),
    });
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(screen.getByTestId("redirect")).toHaveAttribute("data-to", "/staff/login");
  });

  it("sends staff members without permission for the requested route to POS", () => {
    window.localStorage.setItem("mediquick.auth", JSON.stringify({
      token: createToken(Date.now() / 1000 + 3600),
      user: { role: "user" },
    }));
    render(
      <DataContext.Provider value={{ userRole: "user" }}>
        <ProtectedRoute allowedRoles={["admin", "manager"]}>
          <h1>Dashboard</h1>
        </ProtectedRoute>
      </DataContext.Provider>
    );
    expect(screen.getByTestId("redirect")).toHaveAttribute("data-to", "/pos");
  });
});
