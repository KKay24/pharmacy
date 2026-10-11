function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function buildReceiptEmailHtml({ rows, customer, payments = [], pharmacyName, pharmacyAddress, pharmacyPhone }) {
  const total = rows.reduce((sum, sale) => sum + Number(sale.totalPrice || 0), 0);
  const discount = rows.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);
  const subtotal = total + discount;
  return [
    `<h1>${escapeHtml(pharmacyName)}</h1>`,
    pharmacyAddress ? `<p>${escapeHtml(pharmacyAddress)}</p>` : '',
    pharmacyPhone ? `<p>${escapeHtml(pharmacyPhone)}</p>` : '',
    `<p>Receipt: ${escapeHtml(rows[0].receiptNumber || `Sale ${rows[0].id}`)}</p>`,
    `<p>Date: ${escapeHtml(new Date(rows[0].date).toLocaleString())}</p>`,
    `<p>Sold By: ${escapeHtml(rows[0].soldBy || 'Not recorded')}</p>`,
    `<table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>`,
    ...rows.map((sale) => `<tr><td>${escapeHtml(sale.name)}</td><td>${Number(sale.quantity)}</td><td>K${Number(sale.pricePerUnit || 0).toFixed(2)}</td><td>K${Number(sale.totalPrice || 0).toFixed(2)}</td></tr>`),
    `</tbody></table><p>Subtotal: K${subtotal.toFixed(2)}</p>`,
    `<p>Discount: K${discount.toFixed(2)}</p>`,
    ...(payments.length > 0
      ? payments.map((payment) => `<p>Payment method: ${escapeHtml(payment.method)} — K${Number(payment.amount || 0).toFixed(2)}</p>`)
      : [`<p>Payment method: ${escapeHtml(rows[0].paymentMethod || 'Not recorded')}</p>`]),
    `<p>Amount paid: K${total.toFixed(2)}</p>`,
    customer ? `<p>Customer: ${escapeHtml(customer.name)}${customer.phone ? ` — ${escapeHtml(customer.phone)}` : ''}${customer.email ? ` — ${escapeHtml(customer.email)}` : ''}</p>` : '',
    '<p>Thank you for shopping with us.</p>',
  ].join('');
}

async function sendReceiptEmail(url, options, fetchImpl = fetch) {
  const response = await fetchImpl(url, options);
  if (!response.ok) {
    const error = new Error('Receipt email provider rejected the request');
    error.status = response.status;
    throw error;
  }
  return response;
}

module.exports = { buildReceiptEmailHtml, sendReceiptEmail };
