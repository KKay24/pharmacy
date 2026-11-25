import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_PRESCRIPTION_FILE_BYTES,
  buildPrescriptionFileDataUri,
  buildPrescriptionUploadPayload,
  extractPrescriptionTrackError,
  formatDeliveryPreferenceLabel,
  formatFileSize,
  normalizePrescriptionMimeType,
} from './prescriptionUpload.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, '..');

const SAMPLE_JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64');
const SAMPLE_PDF_B64 = Buffer.from('%PDF-1.4\n%%EOF').toString('base64');

describe('mobile prescriptionUpload helpers', () => {
  test('normalizePrescriptionMimeType maps image/jpg, PNG, PDF, and filename extensions', () => {
    assert.equal(normalizePrescriptionMimeType('image/jpg'), 'image/jpeg');
    assert.equal(normalizePrescriptionMimeType('IMAGE/JPEG'), 'image/jpeg');
    assert.equal(normalizePrescriptionMimeType('image/png'), 'image/png');
    assert.equal(normalizePrescriptionMimeType('application/pdf'), 'application/pdf');
    assert.equal(normalizePrescriptionMimeType(undefined, 'scan.JPG'), 'image/jpeg');
    assert.equal(normalizePrescriptionMimeType(undefined, 'script.pdf'), 'application/pdf');
    assert.equal(normalizePrescriptionMimeType('image/webp', 'photo.webp'), null);
    assert.equal(normalizePrescriptionMimeType('image/svg+xml', 'icon.svg'), null);
  });

  test('buildPrescriptionFileDataUri strips line breaks, normalizes MIME, and enforces 5 MB limit', () => {
    const wrapped = `${SAMPLE_JPEG_B64.slice(0, 4)}\r\n${SAMPLE_JPEG_B64.slice(4)}`;
    const okJpeg = buildPrescriptionFileDataUri({
      base64: wrapped,
      mimeType: 'image/jpg',
      fileName: 'rx.jpg',
    });
    assert.equal(okJpeg.ok, true);
    if (okJpeg.ok) {
      assert.equal(okJpeg.mimeType, 'image/jpeg');
      assert.equal(okJpeg.isImage, true);
      assert.equal(okJpeg.fileData, `data:image/jpeg;base64,${SAMPLE_JPEG_B64}`);
    }

    const okPdf = buildPrescriptionFileDataUri({
      dataUri: `data:application/pdf;base64,${SAMPLE_PDF_B64}`,
      fileName: 'rx.pdf',
    });
    assert.equal(okPdf.ok, true);
    if (okPdf.ok) {
      assert.equal(okPdf.mimeType, 'application/pdf');
      assert.equal(okPdf.isImage, false);
    }

    const tooLarge = buildPrescriptionFileDataUri({
      base64: SAMPLE_JPEG_B64,
      mimeType: 'image/jpeg',
      byteSize: MAX_PRESCRIPTION_FILE_BYTES + 1,
    });
    assert.equal(tooLarge.ok, false);

    const badMime = buildPrescriptionFileDataUri({
      base64: SAMPLE_JPEG_B64,
      mimeType: 'image/webp',
    });
    assert.equal(badMime.ok, false);
  });

  test('buildPrescriptionUploadPayload sends real fileData and omits deliveryAddress on pickup', () => {
    const attachment = {
      uri: 'file:///tmp/rx.jpg',
      fileName: 'rx.jpg',
      mimeType: 'image/jpeg',
      byteSize: 2048,
      fileData: `data:image/jpeg;base64,${SAMPLE_JPEG_B64}`,
      isImage: true,
    };

    const deliveryPayload = buildPrescriptionUploadPayload({
      patientName: '  Chanda Banda  ',
      patientPhone: ' +260977112233 ',
      doctorName: ' Dr. Phiri ',
      medications: ' Amoxicillin 500mg ',
      deliveryPreference: 'delivery',
      deliveryAddress: ' Plot 42, Lusaka ',
      notes: ' Evening delivery ',
      attachment,
    });

    assert.deepEqual(deliveryPayload, {
      patientName: 'Chanda Banda',
      patientPhone: '+260977112233',
      doctorName: 'Dr. Phiri',
      medications: 'Amoxicillin 500mg',
      deliveryPreference: 'delivery',
      deliveryAddress: 'Plot 42, Lusaka',
      notes: 'Evening delivery',
      fileData: attachment.fileData,
      fileName: 'rx.jpg',
    });

    const pickupPayload = buildPrescriptionUploadPayload({
      patientName: 'Chanda Banda',
      patientPhone: '+260977112233',
      deliveryPreference: 'pickup',
      deliveryAddress: 'Should be ignored',
      attachment: null,
    });

    assert.equal(pickupPayload.deliveryAddress, undefined);
    assert.equal(pickupPayload.fileData, undefined);
  });

  test('extractPrescriptionTrackError prefers backend message over generic HTTP error label', () => {
    const nest404 = {
      response: {
        status: 404,
        data: {
          statusCode: 404,
          error: 'Not Found',
          message: 'Prescription not found',
        },
      },
    };
    assert.equal(extractPrescriptionTrackError(nest404), 'Prescription not found');

    const bare404 = { response: { status: 404, data: { error: 'Not Found' } } };
    assert.equal(
      extractPrescriptionTrackError(bare404),
      'No prescription found matching that reference code.'
    );
  });

  test('formatting helpers format delivery preferences and file sizes cleanly', () => {
    assert.equal(formatDeliveryPreferenceLabel('pickup'), 'In-Store Pickup');
    assert.equal(formatDeliveryPreferenceLabel('delivery'), 'Home Delivery');
    assert.equal(formatFileSize(512), '512 B');
    assert.equal(formatFileSize(150 * 1024), '150 KB');
    assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.50 MB');
  });

  test('mobile prescription screens no longer simulate uploads or link Track Prescription to /track-order', () => {
    const uploadScreen = readFileSync(join(mobileRoot, 'app', 'prescription-upload.tsx'), 'utf8');
    const tabScreen = readFileSync(join(mobileRoot, 'app', '(tabs)', 'prescriptions.tsx'), 'utf8');

    assert.equal(uploadScreen.includes('fileSimulated'), false);
    assert.equal(uploadScreen.includes("from 'expo-image-picker'"), true);
    assert.equal(uploadScreen.includes("from 'expo-document-picker'"), true);
    assert.equal(uploadScreen.includes('buildPrescriptionUploadPayload'), true);
    assert.equal(uploadScreen.includes("'Not specified'"), false);

    assert.equal(tabScreen.includes("'/track-order'"), false);
    assert.equal(tabScreen.includes("pathname: '/prescription-upload'"), true);
    assert.equal(tabScreen.includes("tab: 'track'"), true);
  });
});
