import { createReceiptWhatsAppUrl } from "./receiptSharing";

describe("createReceiptWhatsAppUrl", () => {
  it("targets the supplied customer number and URL-encodes the receipt summary", () => {
    const url = createReceiptWhatsAppUrl({
      receiptNo: "MQ-001",
      date: "10 Oct 2026",
      cashierName: "cashier-a",
      items: [{ name: "Vitamin C & Zinc", quantity: 2, price: 5, total: 10 }],
      totalToPay: 10,
    }, "+260 977 000 000");

    expect(url.startsWith("https://wa.me/260977000000?text=")).toBe(true);
    const message = decodeURIComponent(url.split("?text=")[1]);
    expect(message).toContain("Vitamin C & Zinc x2");
    expect(message).toContain("Receipt: MQ-001");
    expect(message).toContain("Attach the PDF manually");
  });
});
