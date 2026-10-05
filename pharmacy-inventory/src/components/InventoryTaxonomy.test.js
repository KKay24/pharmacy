import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddStock from "./AddStock";
import InventoryPage from "../pages/InventoryPage";
import Pos from "./POS";
import { DataContext } from "../context/DataContext";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });
jest.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {} }), { virtual: true });
jest.mock("tesseract.js", () => ({ recognize: jest.fn() }), { virtual: true });

jest.mock("../components/InventoryTable", () => function InventoryTableMock({ inventory }) {
  return (
    <div data-testid="inventory-results">
      {inventory.map((medicine) => <span key={medicine.id}>{medicine.name}</span>)}
    </div>
  );
});

jest.mock("../components/StockCardSidebar", () => function StockCardSidebarMock() {
  return null;
});

const categories = [
  {
    id: 1,
    name: "Medicines",
    subcategories: [
      { id: 11, name: "Antibiotics", forms: [{ id: 111, name: "Syrup" }, { id: 112, name: "Tablet" }] },
      { id: 12, name: "Pain & Fever", forms: [{ id: 121, name: "Tablet" }] },
    ],
  },
  {
    id: 2,
    name: "Baby Products",
    subcategories: [{ id: 21, name: "Baby Care", forms: [{ id: 211, name: "Baby Lotion" }, { id: 212, name: "Baby Soap" }] }],
  },
];

const emptyStockItem = {
  id: 1,
  name: "",
  genericName: "",
  brandName: "",
  strength: "",
  packSize: "",
  unitOfMeasure: "",
  mainCategoryId: "",
  subcategoryId: "",
  productFormId: "",
  dosage: "",
  sku: "",
  costPrice: "",
  quantity: "",
  sellingPrice: "",
  expiryDate: "",
  batchNumber: "",
};

function AddStockHarness() {
  const [items, setItems] = useState([emptyStockItem]);
  return (
    <AddStock
      items={items}
      setItems={setItems}
      metadata={{ supplierId: "", invoiceNumber: "", orderDate: "2026-01-01", warehouse: "Main Pharmacy" }}
      setMetadata={jest.fn()}
      onNext={jest.fn()}
      onCancel={jest.fn()}
      inventory={[]}
      categories={categories}
      suppliers={[]}
    />
  );
}

test("stock entry scopes subcategories and product forms to the selected category", () => {
  render(<AddStockHarness />);

  const mainCategory = screen.getByRole("combobox", { name: "Main category" });
  expect(mainCategory).toBeRequired();
  fireEvent.change(mainCategory, { target: { value: "1" } });

  const subcategory = screen.getByRole("combobox", { name: "Subcategory" });
  expect(subcategory).not.toBeDisabled();
  fireEvent.change(subcategory, { target: { value: "11" } });

  const form = screen.getByRole("combobox", { name: "Product form" });
  expect(form).toHaveTextContent("Syrup");
  expect(form).not.toHaveTextContent("Baby Lotion");
  fireEvent.change(form, { target: { value: "111" } });

  fireEvent.change(mainCategory, { target: { value: "2" } });
  expect(subcategory).toHaveValue("");
  expect(form).toHaveValue("");
  expect(form).toBeDisabled();
});

test("inventory filters cascade through taxonomy and filter generic name and brand", () => {
  const inventory = [
    {
      id: 1,
      name: "Amoxicillin",
      genericName: "Amoxicillin",
      brandName: "MediBrand",
      supplier: "North Supply",
      mainCategoryId: 1,
      subcategoryId: 11,
      productFormId: 111,
      lowStockThreshold: 10,
      Batches: [{ quantity: 5, costPrice: 2, expiryDate: "2030-12-31" }],
    },
    {
      id: 2,
      name: "Baby Lotion",
      genericName: "",
      brandName: "SoftBrand",
      supplier: "Baby Supply",
      mainCategoryId: 2,
      subcategoryId: 21,
      productFormId: 211,
      lowStockThreshold: 10,
      Batches: [{ quantity: 30, costPrice: 1, expiryDate: "2030-12-31" }],
    },
  ];
  const context = {
    inventory,
    inventoryCategories: categories,
    updateInventoryItem: jest.fn(),
    deleteInventoryItem: jest.fn(),
    userRole: "admin",
  };

  render(
    <DataContext.Provider value={context}>
      <InventoryPage />
    </DataContext.Provider>
  );

  fireEvent.change(screen.getByRole("combobox", { name: "Filter main category" }), { target: { value: "1" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Filter subcategory" }), { target: { value: "11" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Filter product form" }), { target: { value: "111" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Filter generic name" }), { target: { value: "amoxi" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Filter brand" }), { target: { value: "medibrand" } });

  expect(screen.getByTestId("inventory-results")).toHaveTextContent("Amoxicillin");
  expect(screen.getByTestId("inventory-results")).not.toHaveTextContent("Baby Lotion");

  fireEvent.change(screen.getByPlaceholderText("Search name, generic, brand, supplier, or SKU..."), {
    target: { value: "Amoxi" },
  });
  expect(screen.getByTestId("inventory-results")).toHaveTextContent("Amoxicillin");
});

test("POS category filters show the hierarchy instead of dosage forms as main categories", () => {
  const inventory = [
    {
      id: 1,
      name: "Amoxicillin Syrup",
      genericName: "Amoxicillin",
      mainCategoryId: 1,
      subcategoryId: 11,
      productFormId: 111,
      Batches: [{ quantity: 8, sellingPrice: 2 }],
    },
    {
      id: 2,
      name: "Baby Lotion",
      mainCategoryId: 2,
      subcategoryId: 21,
      productFormId: 211,
      Batches: [{ quantity: 6, sellingPrice: 3 }],
    },
  ];

  render(<Pos inventory={inventory} categories={categories} handleSale={jest.fn()} />);

  expect(screen.getByRole("group", { name: "Main category" })).toHaveTextContent("Medicines");
  expect(screen.getByRole("group", { name: "Main category" })).not.toHaveTextContent("Syrup");
  expect(screen.queryByRole("group", { name: "Product form" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Medicines" }));
  fireEvent.click(screen.getByRole("button", { name: "Antibiotics" }));
  expect(screen.getByRole("group", { name: "Product form" })).toHaveTextContent("Syrup");
  fireEvent.click(screen.getByRole("button", { name: "Syrup" }));

  expect(screen.getByText("Amoxicillin Syrup")).toBeInTheDocument();
  expect(screen.queryByText("Baby Lotion")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Baby Products" }));
  expect(screen.queryByRole("group", { name: "Product form" })).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Subcategory" })).toHaveTextContent("Baby Care");
});
