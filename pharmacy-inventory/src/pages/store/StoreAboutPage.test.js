import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import StoreAboutPage from "./StoreAboutPage";

jest.mock("react-router-dom", () => ({ Link: "a" }), { virtual: true });

describe("StoreAboutPage", () => {
  test("presents the pharmacy overview, services, and existing contact details", () => {
    render(<StoreAboutPage />);

    expect(screen.getByRole("heading", { name: "MediQuick Pharmacy" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /everything you need for better health/i })).toBeTruthy();
    expect(screen.getByText("Cairo Road, Lusaka")).toBeTruthy();
    expect(screen.getByRole("link", { name: /get directions/i }).getAttribute("href"))
      .toContain("Cairo+Road");
    expect(screen.getByText("Prescription & OTC Medicines").closest("a")).toBeTruthy();
  });
});
