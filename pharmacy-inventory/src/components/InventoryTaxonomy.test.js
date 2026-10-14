import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddStock from "./AddStock";
import InventoryPage from "../pages/InventoryPage";
import DashboardPage from "../pages/DashboardPage";
import CommandOverviewPage from "../pages/Home";
import Pos from "./POS";
import { DataContext } from "../context/DataContext";
import { getInventoryStockValue } from "../utils/inventoryValuation";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(globalThis.location.search)],
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
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

test("stock value uses batch costs with first-batch fallback consistently", () => {
  const inventory = [
    {
      id: 1,
      name: "Amoxicillin",
      mainCategoryId: 1,
      subcategoryId: 11,
      productFormId: 111,
      MainCategory: { name: "Medicines" },
      Subcategory: { name: "Antibiotics" },
      ProductForm: { name: "Syrup" },
      Batches: [
        { id: 1, quantity: 5, costPrice: 10, expiryDate: "2030-12-31" },
        { id: 2, quantity: 10, costPrice: null, expiryDate: "2030-12-31" },
        { id: 3, quantity: 2, costPrice: 20, expiryDate: "2030-12-31" },
      ],
    },
  ];
  const context = {
    inventory,
    inventoryCategories: categories,
    updateInventoryItem: jest.fn(),
    deleteInventoryItem: jest.fn(),
    userRole: "admin",
  };

  expect(getInventoryStockValue(inventory[0])).toBe(190);

  const inventoryPage = render(
    <DataContext.Provider value={context}>
      <InventoryPage />
    </DataContext.Provider>
  );
  expect(screen.getByText("Stock Value").parentElement).toHaveTextContent("K190");
  inventoryPage.unmount();

  render(
    <DataContext.Provider value={context}>
      <DashboardPage />
    </DataContext.Provider>
  );
  const stockValueCard = Array.from(document.querySelectorAll(".metric-card"))
    .find(card => card.querySelector(".metric-title")?.textContent === "Stock Value");
  expect(stockValueCard).toHaveTextContent("K190");
  const dashboardMetricCards = Array.from(document.querySelectorAll(".metrics-row a.metric-card"));
  expect(dashboardMetricCards).toHaveLength(9);
  expect(dashboardMetricCards.every(card => card.getAttribute("href").startsWith("/inventory"))).toBe(true);
  expect(dashboardMetricCards.find(card => card.textContent.includes("Low Stock Items")))
    .toHaveAttribute("href", "/inventory?stockStatus=low");
  expect(dashboardMetricCards.find(card => card.textContent.includes("Out of Stock")))
    .toHaveAttribute("href", "/inventory?stockStatus=out");
  expect(dashboardMetricCards.find(card => card.textContent.includes("Expired Products")))
    .toHaveAttribute("href", "/inventory?expiryStatus=expired");
  expect(dashboardMetricCards.find(card => card.textContent.includes("Stockout Risk")))
    .toHaveAttribute("href", "/inventory?riskStatus=stockout-risk");
  expect(dashboardMetricCards.find(card => card.textContent.includes("Dead Stock")))
    .toHaveAttribute("href", "/inventory?riskStatus=dead-stock");
  const classificationTable = Array.from(document.querySelectorAll("table"))
    .find(table => Array.from(table.querySelectorAll("th")).some(header => header.textContent === "Stock Value"));
  expect(classificationTable.querySelector("tbody")).toHaveTextContent("K190");
});

test("dashboard Inventory Control card opens the inventory page", () => {
  render(
    <DataContext.Provider value={{ username: "Pharmacy Staff", inventory: [], sales: [], customers: [] }}>
      <CommandOverviewPage />
    </DataContext.Provider>
  );

  expect(screen.getByRole("link", { name: /Inventory Control/ })).toHaveAttribute("href", "/inventory");
});

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

test("stock table keeps row fields aligned and product details in a full-width detail row", () => {
  render(<AddStockHarness />);

  const table = screen.getByRole("table");
  const headers = Array.from(table.querySelectorAll("thead th"));
  const productRow = table.querySelector(".asm-product-row");
  const detailsRow = table.querySelector(".asm-product-details-row");
  const status = screen.getByText("⚠ New item");
  const statusColumn = headers.findIndex(header => header.textContent === "Status");

  expect(headers).toHaveLength(11);
  expect(productRow.cells).toHaveLength(headers.length);
  expect(productRow.cells[statusColumn]).toContainElement(status);
  expect(detailsRow.cells[0]).toHaveAttribute("colspan", "11");
  expect(screen.getByRole("textbox", { name: "Product name" }).closest("td")).toBe(productRow.cells[1]);
  expect(screen.getByRole("spinbutton", { name: "Purchase cost" }).closest("label")).toHaveClass("asm-currency-input");
  expect(screen.getByRole("spinbutton", { name: "Current price" }).closest("label")).toHaveClass("asm-currency-input");
  expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveClass("asm-quantity-input");
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

  const exportButton = screen.getByRole("button", { name: /Export Data/ });
  const addStockButton = screen.getByRole("button", { name: /Add New Stock/ });
  expect(exportButton).toBeDisabled();
  expect(exportButton.closest(".inv-health-row")).toBeTruthy();
  expect(addStockButton.closest(".inv-health-row")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "All Inventory" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Low Stock Items" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Expired Batches" })).not.toBeInTheDocument();
  const inventorySearch = screen.getByRole("textbox", { name: "Search inventory" });
  expect(inventorySearch.closest(".inv-inventory-filters")).toBeTruthy();
  expect(inventorySearch.closest(".inv-inventory-filters").lastElementChild).toBe(inventorySearch.parentElement);

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

test.each([
  {
    query: "?stockStatus=low",
    filterName: "Filter stock status",
    filterValue: "low",
    riskInsights: {},
    inventory: [
      { id: 1, name: "Low-stock medicine", Batches: [{ quantity: 5 }] },
      { id: 2, name: "In-stock medicine", Batches: [{ quantity: 20 }] },
    ],
    expectedName: "Low-stock medicine",
    excludedName: "In-stock medicine",
  },
  {
    query: "?stockStatus=out",
    filterName: "Filter stock status",
    filterValue: "out",
    riskInsights: {},
    inventory: [
      { id: 1, name: "Out-of-stock medicine", Batches: [{ quantity: 0 }] },
      { id: 2, name: "In-stock medicine", Batches: [{ quantity: 20 }] },
    ],
    expectedName: "Out-of-stock medicine",
    excludedName: "In-stock medicine",
  },
  {
    query: "?expiryStatus=expired",
    filterName: "Filter expiry status",
    filterValue: "expired",
    riskInsights: {},
    inventory: [
      { id: 1, name: "Expired medicine", Batches: [{ quantity: 5, expiryDate: "2020-01-01" }] },
      { id: 2, name: "Valid medicine", Batches: [{ quantity: 20, expiryDate: "2030-01-01" }] },
    ],
    expectedName: "Expired medicine",
    excludedName: "Valid medicine",
  },
  {
    query: "?riskStatus=stockout-risk",
    filterName: "Filter risk status",
    filterValue: "stockout-risk",
    riskInsights: { stockoutRisk: [{ medicineId: 1 }], deadStock: [] },
    inventory: [
      { id: 1, name: "At-risk medicine", Batches: [{ quantity: 5 }] },
      { id: 2, name: "Other medicine", Batches: [{ quantity: 20 }] },
    ],
    expectedName: "At-risk medicine",
    excludedName: "Other medicine",
  },
  {
    query: "?riskStatus=dead-stock",
    filterName: "Filter risk status",
    filterValue: "dead-stock",
    riskInsights: { stockoutRisk: [], deadStock: [{ medicineId: 2 }] },
    inventory: [
      { id: 1, name: "Active medicine", Batches: [{ quantity: 5 }] },
      { id: 2, name: "Dead-stock medicine", Batches: [{ quantity: 20 }] },
    ],
    expectedName: "Dead-stock medicine",
    excludedName: "Active medicine",
  },
])("inventory applies a dashboard filter from $query", ({
  query,
  filterName,
  filterValue,
  riskInsights,
  inventory,
  expectedName,
  excludedName,
}) => {
  window.history.pushState({}, "", `/inventory${query}`);
  render(
    <DataContext.Provider value={{
      inventory,
      inventoryCategories: [],
      updateInventoryItem: jest.fn(),
      deleteInventoryItem: jest.fn(),
      userRole: "admin",
      riskInsights,
    }}>
      <InventoryPage />
    </DataContext.Provider>
  );

  expect(screen.getByRole("combobox", { name: filterName })).toHaveValue(filterValue);
  expect(screen.getByTestId("inventory-results")).toHaveTextContent(expectedName);
  expect(screen.getByTestId("inventory-results")).not.toHaveTextContent(excludedName);
  window.history.replaceState({}, "", "/");
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
