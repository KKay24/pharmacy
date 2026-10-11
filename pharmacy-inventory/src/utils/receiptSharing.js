export function createReceiptWhatsAppUrl(transaction, phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const itemLines = transaction.items
    .map((item) => `${item.name} x${item.quantity} — K${Number(item.total ?? item.price * item.quantity ?? 0).toFixed(2)}`)
    .join("\n");
  const paymentLines = (transaction.payments || []).map(
    (payment) => `Paid via ${payment.method}: K${Number(payment.amount || 0).toFixed(2)}`,
  );
  const text = [
    "MediQuick Pharmacy receipt",
    `Receipt: ${transaction.receiptNo}`,
    `Date: ${transaction.date}`,
    `Sold by: ${transaction.cashierName}`,
    itemLines,
    ...paymentLines,
    `Total: K${Number(transaction.totalToPay || 0).toFixed(2)}`,
    "This message is a receipt summary. Attach the PDF manually after saving it.",
  ].filter(Boolean).join("\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
