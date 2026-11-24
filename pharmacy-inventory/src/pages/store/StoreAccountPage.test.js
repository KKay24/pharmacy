import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StoreAccountPage from "./StoreAccountPage";
import { useStore } from "../../context/StoreContext";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useNavigate: () => jest.fn(),
  }),
  { virtual: true }
);

jest.mock("../../context/StoreContext", () => ({
  useStore: jest.fn(),
}));

describe("StoreAccountPage customer authentication", () => {
  beforeEach(() => {
    useStore.mockReturnValue({
      storeUser: null,
      storeLogout: jest.fn(),
      apiFetch: jest.fn(),
    });
  });

  it("switches from sign in to account registration", () => {
    render(<StoreAccountPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(screen.getByText("Join MediQuick for a faster checkout experience")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("John Banda")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Min 12 characters")).toBeInTheDocument();
  });

  it("loads additional customer prescription pages on demand", async () => {
    const apiFetch = jest.fn(async (path) => {
      if (path.startsWith("/api/prescriptions/my?page=1")) {
        return {
          data: [{ id: 1, prescriptionNumber: "RX-ONE", status: "Pending", createdAt: new Date().toISOString() }],
          pagination: { page: 1, totalPages: 2, total: 2 },
        };
      }
      if (path.startsWith("/api/prescriptions/my?page=2")) {
        return {
          data: [{ id: 2, prescriptionNumber: "RX-TWO", status: "Pending", createdAt: new Date().toISOString() }],
          pagination: { page: 2, totalPages: 2, total: 2 },
        };
      }
      return { user: { username: "customer" }, customer: null };
    });
    useStore.mockReturnValue({
      storeUser: { id: 1, username: "customer" },
      storeLogout: jest.fn(),
      apiFetch,
    });

    render(<StoreAccountPage />);
    fireEvent.click(screen.getByRole("button", { name: /prescriptions/i }));
    expect(await screen.findByText("RX-ONE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more prescriptions" }));
    expect(await screen.findByText("RX-TWO")).toBeInTheDocument();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/prescriptions/my?page=2&limit=25"));
  });
});
