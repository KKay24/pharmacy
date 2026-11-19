import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StoreSearchAutocomplete from "./StoreSearchAutocomplete";
import { useStore } from "../../context/StoreContext";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../context/StoreContext", () => ({
  useStore: jest.fn(),
}));

describe("StoreSearchAutocomplete", () => {
  const apiFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useStore.mockReturnValue({ apiFetch });
  });

  it("renders search input with combobox ARIA attributes and placeholder", () => {
    render(<StoreSearchAutocomplete placeholder="Search medicines..." />);
    const input = screen.getByRole("combobox", { name: /search pharmacy products/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-controls", "store-search-listbox");
    expect(input.placeholder).toBe("Search medicines...");
  });

  it("debounces user input and displays product name, brand, strength, price, and suggestions", async () => {
    apiFetch.mockResolvedValueOnce({
      products: [
        {
          id: 101,
          name: "Panadol Extra Tablets",
          brandName: "Panadol",
          genericName: "Paracetamol",
          strength: "500mg",
          dosage: "Tablet",
          price: 42.0,
          imageUrl: "https://example.com/panadol.png",
          prescriptionRequired: false,
        },
      ],
      suggestions: ["Panadol Extra", "Paracetamol"],
      categories: ["Pain & Fever"],
      didYouMean: null,
    });

    render(<StoreSearchAutocomplete />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "panad" } });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/products/autocomplete?q=panad"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Panadol Extra Tablets")).toBeInTheDocument();
    });
    expect(screen.getByText("Panadol")).toBeInTheDocument();
    expect(screen.getByText(/500mg/)).toBeInTheDocument();
    expect(screen.getByText("ZMW 42.00")).toBeInTheDocument();
    expect(screen.getByText("Panadol Extra")).toBeInTheDocument();
  });

  it("submits search when Enter is pressed without active suggestion", async () => {
    const onSearchSubmit = jest.fn();
    render(<StoreSearchAutocomplete onSearchSubmit={onSearchSubmit} />);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "amoxicillin" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onSearchSubmit).toHaveBeenCalledWith("amoxicillin");
  });

  it("supports keyboard navigation with ArrowDown, ArrowUp, and Enter", async () => {
    apiFetch.mockResolvedValueOnce({
      products: [
        { id: 1, name: "Product A", price: 10 },
        { id: 2, name: "Product B", price: 20 },
      ],
      suggestions: [],
      categories: [],
      didYouMean: null,
    });

    render(<StoreSearchAutocomplete />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "prod" } });

    await waitFor(() => {
      expect(screen.getByText("Product A")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const productAOption = screen.getByRole("option", { selected: true });
    expect(productAOption).toHaveTextContent("Product A");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const productBOption = screen.getByRole("option", { selected: true });
    expect(productBOption).toHaveTextContent("Product B");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Product A");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockNavigate).toHaveBeenCalledWith("/product/1");
  });

  it("renders Did You Mean spelling correction and submits when clicked", async () => {
    const onSearchSubmit = jest.fn();
    apiFetch.mockResolvedValueOnce({
      products: [],
      suggestions: ["Paracetamol"],
      categories: [],
      didYouMean: "Paracetamol",
    });

    render(<StoreSearchAutocomplete onSearchSubmit={onSearchSubmit} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "paracetmol" } });

    await waitFor(() => {
      expect(screen.getByText(/did you mean/i)).toBeInTheDocument();
    });

    const correctionButton = screen.getAllByRole("button", { name: /paracetamol/i })[0];
    fireEvent.click(correctionButton);
    expect(onSearchSubmit).toHaveBeenCalledWith("Paracetamol");
  });

  it("closes dropdown on Escape", async () => {
    apiFetch.mockResolvedValueOnce({
      products: [{ id: 1, name: "Product A", price: 10 }],
      suggestions: [],
      categories: [],
      didYouMean: null,
    });

    render(<StoreSearchAutocomplete />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "prod" } });

    await waitFor(() => {
      expect(screen.getByText("Product A")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByText("Product A")).toBeNull();
  });
});
