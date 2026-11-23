import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
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
});
