import React, { forwardRef } from 'react';
import styles from '../styles/Receipt.module.css';

const Receipt = forwardRef(({ transaction }, ref) => {
  // Always render the container so ref can attach
  // if (!transaction) return <div ref={ref} style={{display:'none'}}></div>;

  if (!transaction) return null;

  const {
    items = [],
    paymentMethod,
    payments = [],
    subTotal = 0,
    discount = 0,
    totalToPay = 0,
    date,
    receiptNo,
  } = transaction;
  const pharmacyName = process.env.REACT_APP_PHARMACY_NAME || "MediQuick Pharmacy";
  const pharmacyAddress = process.env.REACT_APP_PHARMACY_ADDRESS || "25147, Nationalist Rd, Lusaka";
  const pharmacyPhone = process.env.REACT_APP_PHARMACY_PHONE || "+260 97 439 2925";

  return (
    <div ref={ref} className={styles.receiptContainer}>
      <div className={styles.header}>
        <h3>{pharmacyName}</h3>
        <p>{pharmacyAddress}</p>
        <p>Tel: {pharmacyPhone}</p>
        <div className={styles.divider}></div>
        <p>Date: {date}</p>
        <p>Receipt #: {receiptNo || 'N/A'}</p>
        <p>Sold By: {transaction.cashierName || 'Not recorded'}</p>
        {transaction.customerName && <p>Customer: {transaction.customerName}</p>}
        {transaction.customerPhone && <p>Phone: {transaction.customerPhone}</p>}
        {transaction.customerEmail && <p>Email: {transaction.customerEmail}</p>}
      </div>

      <div className={styles.items}>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td>{item.name}</td>
                <td>{item.quantity}</td>
                <td>{Number(item.price || 0).toFixed(2)}</td>
                <td>{Number(item.total ?? item.price * item.quantity ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.totals}>
        <div className={styles.row}>
          <span>Subtotal:</span>
          <span>K {Number(subTotal || 0).toFixed(2)}</span>
        </div>
        <div className={styles.row}>
          <span>Discount:</span>
          <span>K {Number(discount || 0).toFixed(2)}</span>
        </div>
        <div className={`${styles.row} ${styles.bold}`}>
          <span>Total:</span>
          <span>K {Number(totalToPay || 0).toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.footer}>
        {payments.length > 0 ? payments.map((payment, index) => (
          <p key={`${payment.method}-${index}`}>
            Paid via {payment.method}: K {Number(payment.amount || 0).toFixed(2)}
            {payment.status === "CASHIER_CONFIRMED" ? " (cashier-confirmed)" : ""}
          </p>
        )) : (
          <>
            <p>Paid via: {paymentMethod}</p>
            <p>Payment amount: K {Number(totalToPay || 0).toFixed(2)}</p>
          </>
        )}
        <p>Thank you for shopping with us!</p>
      </div>
    </div>
  );
});

export default Receipt;
