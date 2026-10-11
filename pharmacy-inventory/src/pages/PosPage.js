import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { DataContext } from "../context/DataContext";
import Pos from "../components/POS";
import Receipt from "../components/Receipt";
import { useReactToPrint } from "react-to-print";
import { toast } from "react-hot-toast";
import { apiFetch, getApiErrorMessage } from "../utils/api";
import { createReceiptWhatsAppUrl } from "../utils/receiptSharing";

function makeReceiptNo(clientTransactionId) {
  const suffix = String(clientTransactionId || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(-14)
    .toUpperCase();
  return `MQ-${suffix || Date.now().toString(36).toUpperCase()}`;
}

function buildConfirmedReceipt(sales, checkout) {
  const rows = (Array.isArray(sales) ? sales : [sales]).filter(Boolean);
  const items = rows.map((sale) => ({
    name: sale.name || "Product",
    quantity: Number(sale.quantity || 0),
    price: Number(sale.pricePerUnit || 0),
    total: Number(sale.totalPrice || 0),
  }));
  const subTotal = rows.reduce((sum, sale) => sum + Number(sale.totalPrice || 0) + Number(sale.discount || 0), 0);
  const discount = rows.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);

  return {
    items,
    paymentMethod: rows[0]?.paymentMethod || checkout.paymentMethod,
    payments: rows[0]?.payments || checkout.payments || [],
    subTotal,
    discount,
    totalToPay: rows.reduce((sum, sale) => sum + Number(sale.totalPrice || 0), 0),
    customerName: checkout.customerName || "Walk-in Customer",
    customerPhone: checkout.customerPhone || "",
    customerEmail: checkout.customerEmail || "",
    cashierName: rows[0]?.soldBy || "Not recorded",
    date: rows[0]?.date ? new Date(rows[0].date).toLocaleString() : new Date().toLocaleString(),
    receiptNo: rows[0]?.receiptNumber || checkout.receiptNo,
    saleId: rows[0]?.saleId || rows[0]?.id || null,
    saleStatus: rows[0]?.saleStatus || "COMPLETED",
  };
}

export default function PosPage() {
  const {
    inventory,
    inventoryCategories = [],
    sales = [],
    recordSale,
    customers = [],
    addCustomer,
    username,
    fetchInventory,
    fetchSales,
    fetchAnalytics,
    triggerManualSync,
    discardConflictedSale,
  } = useContext(DataContext);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [clearCartToken, setClearCartToken] = useState(0);
  const [checkoutResetToken, setCheckoutResetToken] = useState(0);
  const [pendingCheckout, setPendingCheckout] = useState(null);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [bluetoothNotice, setBluetoothNotice] = useState("");
  const receiptRef = useRef(null);
  const pendingCheckoutRef = useRef(null);

  useEffect(() => {
    pendingCheckoutRef.current = pendingCheckout;
  }, [pendingCheckout]);

  const completeConfirmedCheckout = useCallback(async (confirmedSales, checkout) => {
    const transaction = buildConfirmedReceipt(confirmedSales, checkout);
    setLastTransaction(transaction);
    setReceiptEmail(checkout.customerEmail || "");
    setShowReceipt(true);
    setPendingCheckout(null);
    if (checkout.pending) setClearCartToken((token) => token + 1);
    toast.success(`Sale completed. Receipt ${transaction.receiptNo}`);
    await Promise.all([fetchInventory?.(), fetchSales?.(), fetchAnalytics?.()]);
    return transaction;
  }, [fetchAnalytics, fetchInventory, fetchSales]);

  useEffect(() => {
    const handleSyncComplete = (event) => {
      const checkout = pendingCheckoutRef.current;
      if (!checkout) return;
      const result = (event.detail?.results || []).find(
        (item) => item.clientTransactionId === checkout.clientTransactionId
      );
      if (!result) return;

      if (result.status === "synced" || result.status === "already_synced") {
        const confirmedSales = Array.isArray(result.data) ? result.data : [result.data];
        completeConfirmedCheckout(confirmedSales, checkout);
      } else if (result.status === "error" || result.status === "conflict") {
        const message = result.message || "The sale could not be synchronized.";
        if (result.status === "conflict") {
          discardConflictedSale(checkout.clientTransactionId)
            .then(() => {
              pendingCheckoutRef.current = null;
              setPendingCheckout(null);
              setCheckoutResetToken((token) => token + 1);
              toast.error(`${message} The cart was preserved; adjust it and retry.`);
            })
            .catch((error) => {
              setPendingCheckout((current) => current ? { ...current, message: error.message } : current);
              toast.error(error.message || "Could not refresh inventory after the failed sale.");
            });
        } else {
          setPendingCheckout((current) => current ? { ...current, message } : current);
          toast.error(message);
        }
      }
    };

    window.addEventListener("mediquick:sync-complete", handleSyncComplete);
    return () => window.removeEventListener("mediquick:sync-complete", handleSyncComplete);
  }, [completeConfirmedCheckout, discardConflictedSale]);

  const handleSale = async ({
    items,
    paymentMethod,
    payments,
    customerId,
    customerName,
    customerPhone,
    customerEmail,
    clientTransactionId,
  }) => {
    const now = new Date();
    const receiptNo = makeReceiptNo(clientTransactionId);
    const checkout = {
      paymentMethod,
      payments,
      customerName,
      customerPhone,
      customerEmail,
      cashierName: username,
      receiptNo,
      date: now.toISOString(),
      pending: true,
    };
    const saleItems = items.map((item) => {
      const inventoryItem = inventory.find((product) => product.id === item.id);
      return {
        medicineId: inventoryItem?.id || item.id,
        customerId: customerId || null,
        name: inventoryItem?.name || item.name,
        quantity: item.quantity,
        pricePerUnit: Number(item.price || 0),
        totalPrice: Number(item.price || 0) * Number(item.quantity || 0),
        discount: 0,
        paymentMethod,
        date: now.toISOString(),
        receiptNumber: receiptNo,
      };
    });

    const result = await recordSale({
      items: saleItems,
      payments,
      clientTransactionId,
    });

    if (result?.success && result.confirmed) {
      await completeConfirmedCheckout(result.sales, checkout);
      return result;
    }

    if (result?.pending) {
      const nextPendingCheckout = {
        ...checkout,
        clientTransactionId: result.clientTransactionId || clientTransactionId,
        message: result.error || "Sale is queued offline. Keep the cart open until synchronization completes.",
      };
      pendingCheckoutRef.current = nextPendingCheckout;
      setPendingCheckout(nextPendingCheckout);
      toast("Sale queued offline. It is not complete until the server confirms synchronization.", { icon: "⏳" });
      return result;
    }

    toast.error(result?.error || "Sale was not confirmed. Your cart has been preserved.");
    return result || { success: false, error: "Sale was not confirmed." };
  };

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  const handleWhatsAppShare = () => {
    if (!lastTransaction) return;
    const url = createReceiptWhatsAppUrl(lastTransaction, lastTransaction.customerPhone);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleEmailReceipt = async (event) => {
    event.preventDefault();
    if (!lastTransaction?.saleId) return;
    setEmailSending(true);
    try {
      const response = await apiFetch(`/api/sales/${lastTransaction.saleId}/email-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: receiptEmail }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "Receipt email could not be sent"));
      const result = await response.json();
      if (result?.success !== true) throw new Error("The server did not confirm that the receipt email was sent");
      toast.success(`Receipt emailed to ${receiptEmail}`);
    } catch (error) {
      toast.error(error.message || "Receipt email could not be sent");
    } finally {
      setEmailSending(false);
    }
  };

  const handleBluetoothInfo = async () => {
    if (!navigator.bluetooth || !window.isSecureContext) {
      setBluetoothNotice("This app does not implement direct Bluetooth printer connections. Pair a compatible printer in device settings, then use Print Receipt and select it in the system print dialog, or save as PDF.");
      return;
    }
    try {
      const available = await navigator.bluetooth.getAvailability();
      setBluetoothNotice(available
        ? "Bluetooth is available, but direct printer connection is not implemented in this app. Pair the printer in device settings and use Print Receipt to select it, or save as PDF."
        : "Bluetooth is turned off or unavailable, and direct printer connection is not implemented in this app. Pair the printer in device settings and use Print Receipt, or save as PDF.");
    } catch {
      setBluetoothNotice("This browser could not check Bluetooth availability, and direct printer connection is not implemented in this app. Use Print Receipt to choose a paired printer or save as PDF.");
    }
  };

  const handleRetrySync = () => {
    triggerManualSync?.().catch((error) => toast.error(error.message || "Sale synchronization failed"));
  };

  const totalRevenue = sales.reduce((total, sale) => (
    (sale.saleStatus || "COMPLETED") === "COMPLETED"
      && !["pending", "syncing", "failed", "conflict"].includes(sale.syncStatus)
      ? total + Number(sale.totalPrice || 0)
      : total
  ), 0);

  return (
    <>
      <Pos
        inventory={inventory}
        categories={inventoryCategories}
        sales={sales}
        handleSale={handleSale}
        totalRevenue={totalRevenue}
        customers={customers}
        addCustomer={addCustomer}
        cashierName={username}
        checkoutPending={Boolean(pendingCheckout)}
        clearCartToken={clearCartToken}
        checkoutResetToken={checkoutResetToken}
        pendingNotice={pendingCheckout?.message}
        retryPendingSync={handleRetrySync}
      />

      {showReceipt && lastTransaction && (
        <div
          className="modal-overlay"
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.58)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
            overflowY: "auto",
            padding: "1rem",
          }}
        >
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completed-sale-title"
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: "12px",
              width: "min(100%, 760px)",
              maxHeight: "95vh",
              overflowY: "auto",
            }}
          >
            <h2 id="completed-sale-title">Sale Completed</h2>
            <p>Receipt {lastTransaction.receiptNo} was recorded successfully.</p>
            <div style={{ margin: "1rem auto", border: "1px solid #e2e8f0", borderRadius: "8px", overflowX: "auto" }}>
              <Receipt ref={receiptRef} transaction={lastTransaction} />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", justifyContent: "center", marginTop: "1rem" }}>
              <button type="button" onClick={() => handlePrint()} style={receiptActionStyle}>Print Receipt</button>
              <button type="button" onClick={() => handlePrint()} style={receiptActionStyle}>Save as PDF</button>
              <button type="button" onClick={handleWhatsAppShare} style={receiptActionStyle}>Open WhatsApp</button>
              <button type="button" onClick={handleBluetoothInfo} style={receiptActionStyle}>Bluetooth Printer</button>
              <button type="button" onClick={() => setShowReceipt(false)} style={receiptActionStyle}>Close</button>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center" }}>
              WhatsApp opens a prefilled message; it does not send it or attach a PDF. Save as PDF and attach it manually in WhatsApp.
            </p>
            {bluetoothNotice && <p role="status" style={{ color: "#475569", fontSize: "0.85rem" }}>{bluetoothNotice}</p>}
            <form onSubmit={handleEmailReceipt} style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "end", marginTop: "1rem" }}>
              <label style={{ flex: "1 1 240px", display: "grid", gap: "0.35rem", color: "#475569", fontSize: "0.85rem" }}>
                Email receipt
                <input
                  type="email"
                  required
                  value={receiptEmail}
                  onChange={(event) => setReceiptEmail(event.target.value)}
                  placeholder="customer@example.com"
                  style={{ padding: "0.65rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </label>
              <button type="submit" disabled={emailSending || !receiptEmail} style={receiptActionStyle}>
                {emailSending ? "Sending…" : "Email Receipt"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const receiptActionStyle = {
  padding: "0.65rem 1rem",
  background: "var(--primary)",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};
