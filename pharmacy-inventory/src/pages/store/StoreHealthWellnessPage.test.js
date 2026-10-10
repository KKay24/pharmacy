import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import StoreHealthWellnessPage from "./StoreHealthWellnessPage";

jest.mock("react-router-dom", () => ({ Link: "a" }), { virtual: true });

describe("StoreHealthWellnessPage", () => {
  test("shows wellness topics and featured health guides", () => {
    render(<StoreHealthWellnessPage />);

    expect(screen.getByRole("heading", { name: /healthier choices/i })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /explore/i })).toHaveLength(8);
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getByText(/MedlinePlus, a service of the U.S. National Library of Medicine/i)).toBeTruthy();
  });

  test("filters reading cards by the selected category", () => {
    render(<StoreHealthWellnessPage />);

    fireEvent.click(screen.getByRole("button", { name: /sleep & rest/i }));

    const article = screen.getByRole("article");
    expect(within(article).getByRole("heading", { name: "Why healthy sleep matters" })).toBeTruthy();
    expect(within(article).getByRole("link", { name: /read on medlineplus/i }).getAttribute("href"))
      .toBe("https://medlineplus.gov/sleepdisorders.html");
  });
});
