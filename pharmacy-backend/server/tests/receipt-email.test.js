const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildReceiptEmailHtml, sendReceiptEmail } = require('../src/sales/receipt-email');

test('receipt email content includes sale and customer details safely', () => {
  const html = buildReceiptEmailHtml({
    pharmacyName: 'MediQuick',
    pharmacyAddress: 'Lusaka',
    pharmacyPhone: '+260 97 000 0000',
    rows: [{
      id: 9,
      receiptNumber: 'MQ-009',
      date: '2026-10-11T09:00:00.000Z',
      soldBy: 'cashier <one>',
      name: 'Vitamin C & Zinc',
      quantity: 2,
      pricePerUnit: 5,
      totalPrice: 9,
      discount: 1,
      paymentMethod: 'Cash',
    }],
    customer: { name: 'Customer One', phone: '+260 977 000 000', email: 'customer@example.test' },
  });

  assert.match(html, /MediQuick/);
  assert.match(html, /Receipt: MQ-009/);
  assert.match(html, /Sold By: cashier &lt;one&gt;/);
  assert.match(html, /Vitamin C &amp; Zinc/);
  assert.match(html, /Subtotal: K10\.00/);
  assert.match(html, /Discount: K1\.00/);
  assert.match(html, /Payment method: Cash/);
  assert.match(html, /Amount paid: K9\.00/);
  assert.match(html, /customer@example\.test/);
});

test('receipt email sends the prepared receipt to the provider', async () => {
  let request;
  const response = await sendReceiptEmail(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: JSON.stringify({
        to: ['customer@example.test'],
        html: '<p>Sold By: cashier</p><p>Payment method: Cash</p>',
      }),
    },
    async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    },
  );

  assert.equal(response.status, 200);
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body).to, ['customer@example.test']);
  assert.match(JSON.parse(request.options.body).html, /Sold By: cashier/);
  assert.match(JSON.parse(request.options.body).html, /Payment method: Cash/);
});

test('receipt email rejects provider failures instead of reporting success', async () => {
  await assert.rejects(
    sendReceiptEmail(
      'https://api.resend.com/emails',
      { method: 'POST' },
      async () => ({ ok: false, status: 503 }),
    ),
    (error) => error.status === 503,
  );

  await assert.rejects(
    sendReceiptEmail(
      'https://api.resend.com/emails',
      { method: 'POST' },
      async () => { throw new Error('network unavailable'); },
    ),
    /network unavailable/,
  );
});
