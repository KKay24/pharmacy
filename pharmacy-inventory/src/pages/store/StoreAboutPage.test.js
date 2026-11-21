import React from "react";
import { render, screen } from "@testing-library/react";
import StoreAboutPage from "./StoreAboutPage";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

describe("StoreAboutPage", () => {
  test("presents the pharmacy overview, services, and existing contact details", () => {
    render(<StoreAboutPage />);

    expect(screen.getByRole("heading", { name: "MediQuick Pharmacy" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /everything you need for better health/i })).toBeTruthy();
    expect(screen.getByText("Nationalist Road, 25147")).toBeTruthy();
    expect(screen.getByAltText(/mediquick pharmacy storefront/i).getAttribute("src"))
      .toBe("/images/about/mediquick-storefront.jpg");
    expect(screen.getByRole("link", { name: /get directions/i }).getAttribute("href"))
      .toContain("Nationalist+Road");
    expect(screen.getByRole("link", { name: /prescription & otc medicines/i })).toBeTruthy();
  });
});
