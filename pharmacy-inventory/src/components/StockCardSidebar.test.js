import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StockCardSidebar from "./StockCardSidebar";
import InventoryTable from "./InventoryTable";

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

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

const sampleMedicine = {
  id: 125,
  name: "VIT C PLUS",
  genericName: "Ascorbic Acid",
  strength: "500mg",
  supplier: "MedSupply Ltd",
  lowStockThreshold: 10,
  totalQuantity: 4,
  Batches: [
    {
      id: 101,
      batchNumber: "MQ-125-20261124-211530-USER07",
      quantity: 4,
      quantityReceived: 10,
      costPrice: 4.4,
      sellingPrice: 8.5,
      expiryDate: "2027-11-23",
      warehouse: "Head Office",
      supplier: "MedSupply Ltd",
      createdByUsername: "pharmacy-admin",
      createdAt: "2026-11-24T21:15:30.000Z",
      status: "active",
    },
    {
      id: 102,
      batchNumber: "MQ-125-20261015-091200-USER02",
      quantity: 0,
      quantityReceived: 12,
      costPrice: 4.4,
      sellingPrice: 8.5,
      expiryDate: "2027-10-28",
      warehouse: "Main Store",
      supplier: "MedSupply Ltd",
      createdByUsername: "stock-manager",
      createdAt: "2026-10-15T09:12:00.000Z",
      status: "depleted",
    },
  ],
};

beforeEach(() => {
  mockApiFetch.mockReset();
});

test("StockCardSidebar renders a bottom-right delete button on every batch card for admin and requires confirmation with batch number and product name", async () => {
  const onRemoveBatch = jest.fn().mockResolvedValue({
    success: true,
    medicine: {
      ...sampleMedicine,
      totalQuantity: 0,
      Batches: [sampleMedicine.Batches[1]],
    },
  });

  render(
    <StockCardSidebar
      medicine={sampleMedicine}
      userRole="admin"
      onClose={jest.fn()}
      onUpdate={jest.fn()}
      onAddBatch={jest.fn()}
      onRemoveBatch={onRemoveBatch}
      onArchiveBatch={jest.fn()}
    />
  );

  // Both active and 0-unit depleted batches have a delete button, status badge, and creator metadata
  const activeDeleteBtn = screen.getByRole("button", { name: /Delete batch MQ-125-20261124-211530-USER07/i });
  const depletedDeleteBtn = screen.getByRole("button", { name: /Delete batch MQ-125-20261015-091200-USER02/i });
  expect(activeDeleteBtn).toBeInTheDocument();
  expect(depletedDeleteBtn).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(screen.getByText("Depleted")).toBeInTheDocument();
  expect(screen.getByText("pharmacy-admin")).toBeInTheDocument();
  expect(screen.getByText("stock-manager")).toBeInTheDocument();

  // Clicking delete opens confirmation dialog without deleting immediately
  fireEvent.click(activeDeleteBtn);
  expect(onRemoveBatch).not.toHaveBeenCalled();

  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("VIT C PLUS");
  expect(dialog).toHaveTextContent("MQ-125-20261124-211530-USER07");

  // Cancelling closes the modal without calling onRemoveBatch
  fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onRemoveBatch).not.toHaveBeenCalled();

  // Re-open, enter reason, confirm delete
  fireEvent.click(activeDeleteBtn);
  fireEvent.change(screen.getByLabelText(/Deletion reason/i), {
    target: { value: "Damaged pack" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Confirm Delete/i }));

  await waitFor(() => {
    expect(onRemoveBatch).toHaveBeenCalledWith(125, 101, "Damaged pack");
  });
});

test("StockCardSidebar hides batch delete buttons for non-authorized user role", () => {
  render(
    <StockCardSidebar
      medicine={sampleMedicine}
      userRole="user"
      onClose={jest.fn()}
      onUpdate={jest.fn()}
      onAddBatch={jest.fn()}
      onRemoveBatch={jest.fn()}
    />
  );

  expect(screen.queryByRole("button", { name: /Delete batch/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Add Stock Batch/i })).not.toBeInTheDocument();
});

test("StockCardSidebar allows adding a new stock batch without entering a manual batch number and loads Batch History tab", async () => {
  const onAddBatch = jest.fn().mockResolvedValue({
    success: true,
    medicine: {
      ...sampleMedicine,
      totalQuantity: 14,
      Batches: [
        ...sampleMedicine.Batches,
        {
          id: 103,
          batchNumber: "MQ-125-20261124-220105-USER07",
          quantity: 10,
          quantityReceived: 10,
          costPrice: 4.5,
          sellingPrice: 9,
          expiryDate: "2029-01-01",
          supplier: "MedSupply Ltd",
          warehouse: "Head Office",
          createdByUsername: "pharmacy-admin",
          createdAt: "2026-11-24T22:01:05.000Z",
          status: "active",
        },
      ],
    },
  });

  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      batches: [
        ...sampleMedicine.Batches,
        {
          id: 99,
          batchNumber: "MQ-125-20260901-080000-USER01",
          quantity: 0,
          quantityReceived: 5,
          costPrice: 4.0,
          sellingPrice: 8.0,
          expiryDate: "2026-12-01",
          status: "deleted",
          createdByUsername: "pharmacy-admin",
          createdAt: "2026-09-01T08:00:00.000Z",
          deletedByUsername: "stock-manager",
          deletedAt: "2026-10-01T10:00:00.000Z",
          deletionReason: "Expired stock removed",
        },
      ],
      movements: [
        {
          id: 501,
          movementType: "PURCHASE",
          referenceType: "BATCH",
          quantityChange: 10,
          reason: "Batch MQ-125-20261124-211530-USER07 received",
          createdAt: "2026-11-24T21:15:30.000Z",
        },
      ],
    }),
  });

  render(
    <StockCardSidebar
      medicine={sampleMedicine}
      userRole="manager"
      onClose={jest.fn()}
      onUpdate={jest.fn()}
      onAddBatch={onAddBatch}
      onRemoveBatch={jest.fn()}
      onArchiveBatch={jest.fn()}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /Add Stock Batch/i }));
  fireEvent.change(screen.getByLabelText("Batch quantity"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Supplier batch number"), { target: { value: "SUP-LOT-88" } });
  fireEvent.click(screen.getByRole("button", { name: /Create New Batch/i }));

  await waitFor(() => {
    expect(onAddBatch).toHaveBeenCalledWith(
      125,
      expect.objectContaining({
        quantity: 10,
        supplierBatchNumber: "SUP-LOT-88",
      })
    );
  });
  expect(onAddBatch.mock.calls[0][1].batchNumber).toBeUndefined();

  // Switch to Batch History tab and verify archived/deleted batch + movements render
  fireEvent.click(screen.getByRole("tab", { name: /Batch History/i }));
  await waitFor(() => {
    expect(mockApiFetch).toHaveBeenCalledWith("/api/inventory/125/batches");
  });
  expect(await screen.findByText("MQ-125-20260901-080000-USER01")).toBeInTheDocument();
  expect(screen.getByText(/Expired stock removed/i)).toBeInTheDocument();
  expect(screen.getByText(/Stock Movements \(1\)/i)).toBeInTheDocument();
});

test("StockCardSidebar offers Archive Batch fallback when deletion is blocked by completed sales on a depleted batch", async () => {
  const onRemoveBatch = jest.fn().mockResolvedValue({
    success: false,
    status: 409,
    error: "This batch has been used in completed sales and cannot be deleted.",
  });
  const onArchiveBatch = jest.fn().mockResolvedValue({
    success: true,
    medicine: { ...sampleMedicine, Batches: [sampleMedicine.Batches[0]] },
  });

  render(
    <StockCardSidebar
      medicine={sampleMedicine}
      userRole="admin"
      onClose={jest.fn()}
      onUpdate={jest.fn()}
      onAddBatch={jest.fn()}
      onRemoveBatch={onRemoveBatch}
      onArchiveBatch={onArchiveBatch}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /Delete batch MQ-125-20261015-091200-USER02/i }));
  fireEvent.click(screen.getByRole("button", { name: /Confirm Delete/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/completed sales/i);
  const archiveBtn = screen.getByRole("button", { name: /Archive Batch/i });
  fireEvent.click(archiveBtn);

  await waitFor(() => {
    expect(onArchiveBatch).toHaveBeenCalledWith(125, 102, "");
  });
});

test("InventoryTable expanded batch cards include delete button with confirmation dialog", async () => {
  const onRemoveBatch = jest.fn().mockResolvedValue({ success: true, medicine: sampleMedicine });

  render(
    <InventoryTable
      inventory={[sampleMedicine]}
      userRole="admin"
      updateMedicine={jest.fn()}
      deleteMedicine={jest.fn()}
      onOpenCard={jest.fn()}
      onRemoveBatch={onRemoveBatch}
      onArchiveBatch={jest.fn()}
    />
  );

  // Expand the row
  const rowCells = screen.getAllByRole("cell");
  fireEvent.click(rowCells[0]);

  const deleteBtn = screen.getByRole("button", { name: /Delete batch MQ-125-20261124-211530-USER07/i });
  fireEvent.click(deleteBtn);

  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("VIT C PLUS");
  expect(dialog).toHaveTextContent("MQ-125-20261124-211530-USER07");

  fireEvent.click(screen.getByRole("button", { name: /Confirm Delete/i }));
  await waitFor(() => {
    expect(onRemoveBatch).toHaveBeenCalledWith(125, 101, "");
  });
});
