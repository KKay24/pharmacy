import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Pos from "./POS";

const mockApiFetch = jest.fn();
jest.mock("../utils/api", () => ({
  apiFetch: (...args) => mockApiFetch(...args),
  getApiErrorMessage: async (response, fallback) => {
    try {
      const data = await response.json();
      return data?.message || data?.error || fallback;
    } catch {
      return fallback;
    }
  },
}));

const sampleInventory = [
  {
    id: 10,
    name: "Paracetamol 500mg",
    genericName: "Paracetamol",
    mainCategoryId: 1,
    Batches: [{ id: 1, quantity: 20, costPrice: 5, sellingPrice: 12 }],
  },
];

const sampleCustomers = [
  {
    id: 1,
    patientCode: "MQP-000001",
    firstName: "Mwila",
    lastName: "Phiri",
    name: "Mwila Phiri",
    phone: "0971112233",
  },
  {
    id: 2,
    patientCode: "MQP-000002",
    firstName: "Mutale",
    lastName: "Mulenga",
    name: "Mutale Mulenga",
    phone: "0962223344",
  },
];

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: sampleCustomers }),
  });
});

test("POS Assign Patient modal supports existing patient search (name/phone/ID), Walking Customer, and Register New Patient without clearing cart", async () => {
  const handleSale = jest.fn().mockResolvedValue({ success: true });
  const addCustomer = jest.fn().mockResolvedValue({
    success: true,
    customer: {
      id: 3,
      patientCode: "MQP-000003",
      firstName: "Chanda",
      lastName: "Banda",
      name: "Chanda Banda",
      phone: "0977554433",
    },
  });

  render(
    <Pos
      inventory={sampleInventory}
      categories={[]}
      customers={sampleCustomers}
      addCustomer={addCustomer}
      handleSale={handleSale}
      cashierName="alick"
    />
  );

  // Add item to cart first
  fireEvent.click(screen.getByText("Paracetamol 500mg"));
  expect(screen.getAllByText("K12.00").length).toBeGreaterThanOrEqual(2);

  // Default trigger displays Walking Customer
  const customerTrigger = screen.getByRole("button", { name: /Walking Customer/i });
  fireEvent.click(customerTrigger);

  // 1. Search by Patient ID and select existing patient
  const searchInput = screen.getByLabelText("Search registered patients");
  fireEvent.change(searchInput, { target: { value: "MQP-000001" } });
  expect(await screen.findByText("Mwila Phiri")).toBeInTheDocument();
  expect(screen.queryByText("Mutale Mulenga")).not.toBeInTheDocument();

  fireEvent.click(screen.getByText("Mwila Phiri"));

  // Cart is preserved and header displays selected patient
  expect(screen.getAllByText("K12.00").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByRole("button", { name: /Mwila Phiri \(MQP-000001\)/i })).toBeInTheDocument();

  // 2. Switch to Walking Customer and verify cart is preserved
  fireEvent.click(screen.getByRole("button", { name: /Mwila Phiri \(MQP-000001\)/i }));
  fireEvent.click(screen.getByRole("button", { name: /Walking Customer/i }));
  expect(screen.getAllByText("K12.00").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByRole("button", { name: /Walking Customer/i })).toBeInTheDocument();

  // 3. Register New Patient, auto-assign, preserve cart, and complete sale
  fireEvent.click(screen.getByRole("button", { name: /Walking Customer/i }));
  fireEvent.click(screen.getByRole("button", { name: /Register New Patient/i }));

  fireEvent.change(screen.getByPlaceholderText("e.g. Chanda"), { target: { value: "Chanda" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. Banda"), { target: { value: "Banda" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. 0971234567"), { target: { value: "0977554433" } });
  fireEvent.click(screen.getByRole("button", { name: /Register & Assign to Sale/i }));

  await waitFor(() => {
    expect(addCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Chanda",
        lastName: "Banda",
        name: "Chanda Banda",
        phone: "0977554433",
      })
    );
  });

  // Newly registered patient is automatically assigned and cart is preserved
  expect(await screen.findByRole("button", { name: /Chanda Banda \(MQP-000003\)/i })).toBeInTheDocument();
  expect(screen.getAllByText("K12.00").length).toBeGreaterThanOrEqual(2);

  // Complete sale via Cash and verify customerId + customerType are passed
  fireEvent.click(screen.getByRole("button", { name: /Payment Method/i }));
  fireEvent.click(screen.getByRole("button", { name: /^Cash$/i }));
  fireEvent.click(screen.getByRole("button", { name: /Confirm Payment/i }));

  await waitFor(() => {
    expect(handleSale).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 3,
        customerType: "REGISTERED",
        customerName: "Chanda Banda",
      })
    );
  });
});

test("POS Register New Patient shows duplicate conflict warning with quick-select existing patient action", async () => {
  const addCustomer = jest.fn().mockResolvedValue({
    success: false,
    status: 409,
    error: "A patient with phone number 0971112233 is already registered (Mwila Phiri).",
    existingCustomer: sampleCustomers[0],
  });

  render(
    <Pos
      inventory={sampleInventory}
      categories={[]}
      customers={sampleCustomers}
      addCustomer={addCustomer}
      handleSale={jest.fn()}
      cashierName="alick"
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /Walking Customer/i }));
  fireEvent.click(screen.getByRole("button", { name: /Register New Patient/i }));
  fireEvent.change(screen.getByPlaceholderText("e.g. Chanda"), { target: { value: "Mwila" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. Banda"), { target: { value: "Phiri" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. 0971234567"), { target: { value: "0971112233" } });
  fireEvent.click(screen.getByRole("button", { name: /Register & Assign to Sale/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/already registered/i);
  const useExistingBtn = screen.getByRole("button", { name: /Select Existing: Mwila Phiri/i });
  fireEvent.click(useExistingBtn);

  expect(screen.getByRole("button", { name: /Mwila Phiri \(MQP-000001\)/i })).toBeInTheDocument();
});
