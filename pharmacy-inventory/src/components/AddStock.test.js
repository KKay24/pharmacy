import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddStock from "./AddStock";
import { getDocument } from "pdfjs-dist";
import { parseInvoiceText } from "../utils/invoiceParser";

jest.mock("tesseract.js", () => ({ recognize: jest.fn() }));

jest.mock("pdfjs-dist", () => ({
  __esModule: true,
  getDocument: jest.fn(),
  GlobalWorkerOptions: {},
  version: "test",
}));

jest.mock("../utils/invoiceParser", () => ({
  parseInvoiceText: jest.fn(() => ({ items: [], metadata: {} })),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

describe("AddStock PDF invoice scanning", () => {
  beforeEach(() => {
    getDocument.mockReset();
    parseInvoiceText.mockReturnValue({ items: [], metadata: {} });
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: jest.fn().mockResolvedValue({
          getTextContent: jest.fn().mockResolvedValue({
            items: [{ str: "Invoice with readable product details" }],
          }),
        }),
      }),
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("disables PDF.js string evaluation when loading invoice PDFs", async () => {
    const file = new File(["PDF content"], "invoice.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", {
      value: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
    const { container } = render(
      <AddStock
        items={[{ id: 1, name: "" }]}
        setItems={jest.fn()}
        metadata={{}}
        setMetadata={jest.fn()}
        onNext={jest.fn()}
        onCancel={jest.fn()}
        inventory={[]}
        suppliers={[]}
      />
    );

    fireEvent.change(container.querySelector("#invoice-up"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(getDocument).toHaveBeenCalledWith({
        data: expect.any(ArrayBuffer),
        isEvalSupported: false,
      });
      expect(parseInvoiceText).toHaveBeenCalled();
    });
  });
});
