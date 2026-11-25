import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { DataContext } from "../../context/DataContext";
import StoreFooter from "./StoreFooter";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
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

function renderFooter({ role = null, token = null, customerSession = false, path = "/" } = {}) {
  window.localStorage.clear();
  if (token) {
    window.localStorage.setItem("mediquick.auth", JSON.stringify({
      token,
      user: { role },
    }));
  }
  if (customerSession) {
    window.localStorage.setItem("store_token", createToken(Date.now() / 1000 + 3600));
    window.localStorage.setItem("store_user", JSON.stringify({ role: "customer" }));
  }

  return render(
    <DataContext.Provider value={{ userRole: role }}>
      <div data-path={path}>
        <StoreFooter />
      </div>
    </DataContext.Provider>
  );
}

describe("StoreFooter staff workspace link", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("hides the link for logged-out visitors and customers", () => {
    const { unmount } = renderFooter();
    expect(screen.queryByRole("link", { name: "Staff Workspace" })).not.toBeInTheDocument();

    unmount();
    renderFooter({ customerSession: true });
    expect(screen.queryByRole("link", { name: "Staff Workspace" })).not.toBeInTheDocument();
  });

  it.each([
    ["admin", "/dashboard"],
    ["manager", "/dashboard"],
    ["user", "/pos"],
  ])("shows the workspace link for %s and navigates to %s", (role, path) => {
    renderFooter({ role, token: createToken(Date.now() / 1000 + 3600) });

    const workspaceLink = screen.getByRole("link", { name: "Staff Workspace" });
    fireEvent.click(workspaceLink);
    expect(workspaceLink).toHaveAttribute("href", path);
  });

  it("hides the link for an expired staff session", () => {
    renderFooter({ role: "manager", token: createToken(Date.now() / 1000 - 1) });
    expect(screen.queryByRole("link", { name: "Staff Workspace" })).not.toBeInTheDocument();
  });
});
