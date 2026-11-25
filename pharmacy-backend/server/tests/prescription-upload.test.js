const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const tempDirectory = mkdtempSync(join(tmpdir(), 'mediquick-rx-upload-test-'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.POSTGRES_URL = '';
process.env.SQLITE_STORAGE_PATH = join(tempDirectory, 'prescription-upload.sqlite');
process.env.ENABLE_DEMO_SEEDING = 'false';
process.env.JWT_SECRET = 'rx-upload-regression-secret-12345';

const { createApplication } = require('../src/main');
const { sequelize, User, Prescription } = require('../models');

const TINY_JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64');
const TINY_PNG_B64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
const TINY_PDF_B64 = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF').toString('base64');

let app;
let baseUrl;
let customerToken;
let staffToken;

async function requestJson(urlPath, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

describe('Prescription Upload & Tracking Regression Suite', () => {
  before(async () => {
    assert.equal(sequelize.getDialect(), 'sqlite');
    app = await createApplication();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    // Initialize migrations
    await requestJson('/api/products/categories');

    const custReg = await requestJson('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'rx_mobile_patient',
        name: 'Mobile Patient',
        phone: '+260966110022',
        email: 'rx.patient@example.test',
        password: 'Password123!',
      },
    });
    assert.equal(custReg.status, 201);
    customerToken = custReg.data.token;

    const staffReg = await requestJson('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'rx_mobile_pharmacist',
        name: 'Mobile Pharmacist',
        phone: '+260966110099',
        email: 'rx.pharmacist@example.test',
        password: 'Password123!',
      },
    });
    assert.equal(staffReg.status, 201);
    await User.update({ role: 'admin' }, { where: { id: staffReg.data.user.id } });

    const staffLogin = await requestJson('/api/auth/login', {
      method: 'POST',
      body: { username: 'rx_mobile_pharmacist', password: 'Password123!' },
    });
    assert.equal(staffLogin.status, 200);
    staffToken = staffLogin.data.token;
  });

  after(async () => {
    if (app) await app.close();
    await sequelize.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  test('authenticated mobile JPEG upload persists fileData, links account, and returns document on demand', async () => {
    const fileData = `data:image/jpeg;base64,${TINY_JPEG_B64}`;
    const uploadRes = await requestJson('/api/prescriptions/upload', {
      method: 'POST',
      token: customerToken,
      body: {
        patientName: 'Mobile Patient',
        patientPhone: '+260966110022',
        doctorName: 'Dr. Mwale',
        medications: 'Amoxicillin 500mg TDS',
        deliveryPreference: 'delivery',
        deliveryAddress: 'Plot 15, Kabulonga, Lusaka',
        notes: 'Call on arrival',
        fileData,
        fileName: 'rx_photo.jpg',
      },
    });

    assert.equal(uploadRes.status, 201);
    assert.equal(uploadRes.data.success, true);
    assert.match(uploadRes.data.prescriptionNumber, /^RX-/);

    const stored = await Prescription.findOne({
      where: { prescriptionNumber: uploadRes.data.prescriptionNumber },
    });
    assert.ok(stored);
    assert.equal(stored.imagePath, fileData);
    assert.equal(stored.deliveryAddress, 'Plot 15, Kabulonga, Lusaka');

    const myRes = await requestJson('/api/prescriptions/my', { token: customerToken });
    assert.equal(myRes.status, 200);
    const entry = (myRes.data.data || []).find(
      (item) => item.prescriptionNumber === uploadRes.data.prescriptionNumber
    );
    assert.ok(entry);
    assert.equal(entry.hasDocument, true);
    assert.equal(entry.imagePath, null);

    const docRes = await requestJson(`/api/prescriptions/my/${entry.id}/document`, {
      token: customerToken,
    });
    assert.equal(docRes.status, 200);
    assert.equal(docRes.data.imagePath, fileData);
  });

  test('accepts PNG, PDF, image/jpg alias, and line-wrapped base64 from mobile pickers', async () => {
    const cases = [
      {
        label: 'PNG',
        input: `data:image/png;base64,${TINY_PNG_B64}`,
        expected: `data:image/png;base64,${TINY_PNG_B64}`,
      },
      {
        label: 'PDF',
        input: `data:application/pdf;base64,${TINY_PDF_B64}`,
        expected: `data:application/pdf;base64,${TINY_PDF_B64}`,
      },
      {
        label: 'image/jpg alias + wrapped lines',
        input: `data:image/jpg;base64,${TINY_JPEG_B64.slice(0, 8)}\r\n${TINY_JPEG_B64.slice(8)}`,
        expected: `data:image/jpeg;base64,${TINY_JPEG_B64}`,
      },
    ];

    for (const tc of cases) {
      const res = await requestJson('/api/prescriptions/upload', {
        method: 'POST',
        body: {
          patientName: `Patient ${tc.label}`,
          patientPhone: '+260977223344',
          deliveryPreference: 'pickup',
          fileData: tc.input,
        },
      });
      assert.equal(res.status, 201, `${tc.label} should succeed`);
      const stored = await Prescription.findOne({
        where: { prescriptionNumber: res.data.prescriptionNumber },
      });
      assert.equal(stored.imagePath, tc.expected, `${tc.label} should normalize cleanly`);
    }
  });

  test('rejects missing required fields, unsupported MIME types, >5 MB files, and >8 MB bodies', async () => {
    const missingName = await requestJson('/api/prescriptions/upload', {
      method: 'POST',
      body: { patientPhone: '+260977000001' },
    });
    assert.equal(missingName.status, 400);

    const missingPhone = await requestJson('/api/prescriptions/upload', {
      method: 'POST',
      body: { patientName: 'No Phone' },
    });
    assert.equal(missingPhone.status, 400);

    const webp = await requestJson('/api/prescriptions/upload', {
      method: 'POST',
      body: {
        patientName: 'WebP User',
        patientPhone: '+260977000002',
        fileData: `data:image/webp;base64,${TINY_PNG_B64}`,
      },
    });
    assert.equal(webp.status, 400);

    const svg = await requestJson('/api/prescriptions/upload', {
      method: 'POST',
      body: {
        patientName: 'SVG User',
        patientPhone: '+260977000003',
        fileData: `data:image/svg+xml;base64,${Buffer.from('<svg></svg>').toString('base64')}`,
      },
    });
    assert.equal(svg.status, 400);

    const over5Mb = Buffer.alloc(5 * 1024 * 1024 + 1024, 0x41).toString('base64');
    const res400 = await requestJson('/api/prescriptions/upload', {
      method: 'POST',
      body: {
        patientName: 'Large File User',
        patientPhone: '+260977000004',
        fileData: `data:image/jpeg;base64,${over5Mb}`,
      },
    });
    assert.equal(res400.status, 400);
    assert.match(String(res400.data?.message || ''), /5 MB/i);

    const over8Mb = Buffer.alloc(6.5 * 1024 * 1024, 0x42).toString('base64');
    const res413 = await requestJson('/api/prescriptions/upload', {
      method: 'POST',
      body: {
        patientName: 'Huge Body User',
        patientPhone: '+260977000005',
        fileData: `data:image/jpeg;base64,${over8Mb}`,
      },
    });
    assert.equal(res413.status, 413);
  });

  test('public tracking redacts PII, returns clear 404 message, and reflects staff status updates', async () => {
    const upload = await requestJson('/api/prescriptions/upload', {
      method: 'POST',
      body: {
        patientName: 'Bwalya Mutale',
        patientPhone: '+260977554433',
        doctorName: 'Dr. Lungu',
        deliveryPreference: 'pickup',
        fileData: `data:application/pdf;base64,${TINY_PDF_B64}`,
      },
    });
    assert.equal(upload.status, 201);
    const ref = upload.data.prescriptionNumber;

    const trackBefore = await requestJson(`/api/prescriptions/track/${encodeURIComponent(ref)}`);
    assert.equal(trackBefore.status, 200);
    assert.equal(trackBefore.data.prescriptionNumber, ref);
    assert.equal(trackBefore.data.status, 'Pending');
    assert.equal(trackBefore.data.deliveryPreference, 'pickup');
    assert.equal(trackBefore.data.patientName, undefined);
    assert.equal(trackBefore.data.doctorName, undefined);

    const notFound = await requestJson('/api/prescriptions/track/RX-UNKNOWN999');
    assert.equal(notFound.status, 404);
    assert.match(String(notFound.data.message || ''), /Prescription not found/i);

    const queue = await requestJson('/api/prescriptions', { token: staffToken });
    assert.equal(queue.status, 200);
    const rows = queue.data.data || queue.data || [];
    const match = rows.find((item) => item.prescriptionNumber === ref);
    assert.ok(match);

    const updated = await requestJson(`/api/prescriptions/${match.id}/status`, {
      method: 'PUT',
      token: staffToken,
      body: { status: 'Ready for Pickup' },
    });
    assert.equal(updated.status, 200);

    const trackAfter = await requestJson(`/api/prescriptions/track/${encodeURIComponent(ref)}`);
    assert.equal(trackAfter.status, 200);
    assert.equal(trackAfter.data.status, 'Ready for Pickup');
  });
});
