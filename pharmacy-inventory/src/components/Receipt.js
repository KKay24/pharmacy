import React, { forwardRef } from 'react';
import styles from '../styles/Receipt.module.css';

const Receipt = forwardRef(({ transaction }, ref) => {
  // Always render the container so ref can attach
  // if (!transaction) return <div ref={ref} style={{display:'none'}}></div>;

  if (!transaction) return null;

  const { items, paymentMethod, subTotal, totalToPay, date, receiptNo } = transaction;

  return (
    <div ref={ref} className={styles.receiptContainer}>
      <div className={styles.header}>
        <h3>Mediquick Pharmacy</h3>
        <p>123 Health Street, City</p>
        <p>Tel: +260 97 000 0000</p>
        <div className={styles.divider}></div>
        <p>Date: {date}</p>
        <p>Receipt #: {receiptNo || 'N/A'}</p>
        {transaction.customerName && <p>Customer: {transaction.customerName}</p>}
        {transaction.pending && (
          <p style={{ color: '#d97706', fontSize: '0.75rem', fontWeight: 700, margin: '4px 0' }}>
            🟠 Saved Locally (Pending Sync)
          </p>
        )}
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
                <td>{item.price.toFixed(2)}</td>
                <td>{(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.totals}>
        <div className={styles.row}>
          <span>Subtotal:</span>
          <span>K {subTotal.toFixed(2)}</span>
        </div>
        <div className={`${styles.row} ${styles.bold}`}>
          <span>Total:</span>
          <span>K {totalToPay.toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.footer}>
        <p>Paid via: {paymentMethod}</p>
        <p>Thank you for your business!</p>
        <p>No refunds after 24 hours.</p>
      </div>
    </div>
  );
});

export default Receipt;
