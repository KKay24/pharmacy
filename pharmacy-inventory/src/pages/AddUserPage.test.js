import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TeamHubPage from "./AddUserPage";
import { DataContext } from "../context/DataContext";
import { apiFetch } from "../utils/api";

jest.mock("../utils/api", () => ({
  apiFetch: jest.fn(),
  getApiErrorMessage: jest.fn(async (res, fallback) => {
    try {
      const payload = await res.json();
      return payload?.message || payload?.error || fallback;
    } catch {
      return fallback;
    }
  }),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const sampleUsers = [
  { id: 1, username: "admin", email: "admin@mediquick.online", role: "admin", status: "active", locations: ["Main Pharmacy"] },
  { id: 2, username: "cashier_grace", email: "grace@mediquick.online", role: "user", status: "active", locations: ["Main Pharmacy"] },
];

describe("TeamHubPage admin password change and user deletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("allows admin to change a non-admin user password and hides reset/delete buttons on admin cards", async () => {
    apiFetch
      .mockResolvedValueOnce({ ok: true, json: async () => sampleUsers })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, message: "User password updated successfully" }) });

    render(
      <DataContext.Provider value={{ username: "admin", userRole: "admin" }}>
        <TeamHubPage />
      </DataContext.Provider>
    );

    expect(await screen.findByRole("heading", { name: "cashier_grace" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change password for admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete user admin" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Change password for cashier_grace" }));

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "NewSecurePass123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "NewSecurePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/auth/users/2/password",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ newPassword: "NewSecurePass123!" }),
        })
      )
    );
  });

  test("allows admin to confirm and delete a non-admin user and refreshes the user list", async () => {
    apiFetch
      .mockResolvedValueOnce({ ok: true, json: async () => sampleUsers })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [sampleUsers[0]] });

    render(
      <DataContext.Provider value={{ username: "admin", userRole: "admin" }}>
        <TeamHubPage />
      </DataContext.Provider>
    );

    expect(await screen.findByRole("heading", { name: "cashier_grace" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete user cashier_grace" }));

    expect(screen.getByRole("dialog", { name: "Delete user cashier_grace" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/api/auth/users/2", { method: "DELETE" })
    );
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "cashier_grace" })).not.toBeInTheDocument();
    });
  });
});
