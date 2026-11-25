export const MAX_PRESCRIPTION_FILE_BYTES = 5 * 1024 * 1024;

export type SupportedPrescriptionMime =
  | 'image/jpeg'
  | 'image/png'
  | 'application/pdf';

export interface SelectedPrescriptionAttachment {
  uri: string;
  fileName: string;
  mimeType: SupportedPrescriptionMime;
  byteSize: number;
  fileData: string;
  isImage: boolean;
}

export interface PrescriptionUploadPayload {
  patientName: string;
  patientPhone: string;
  doctorName?: string;
  medications?: string;
  deliveryPreference: 'delivery' | 'pickup';
  deliveryAddress?: string;
  notes?: string;
  fileData?: string;
  fileName?: string;
}

export interface PrescriptionTrackResult {
  prescriptionNumber: string;
  status: string;
  date?: string | null;
  dueDate?: string | null;
  deliveryPreference?: string | null;
  patientName?: string | null;
  doctorName?: string | null;
}

export type BuildFileDataResult =
  | {
      ok: true;
      fileData: string;
      mimeType: SupportedPrescriptionMime;
      byteSize: number;
      isImage: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export function normalizePrescriptionMimeType(
  mimeType?: string | null,
  fileName?: string | null
): SupportedPrescriptionMime | null {
  const rawMime = typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';
  if (rawMime === 'image/jpeg' || rawMime === 'image/jpg') {
    return 'image/jpeg';
  }
  if (rawMime === 'image/png') {
    return 'image/png';
  }
  if (rawMime === 'application/pdf') {
    return 'application/pdf';
  }

  const ext = typeof fileName === 'string' ? fileName.trim().toLowerCase().split('.').pop() : '';
  if (ext === 'jpg' || ext === 'jpeg') {
    return 'image/jpeg';
  }
  if (ext === 'png') {
    return 'image/png';
  }
  if (ext === 'pdf') {
    return 'application/pdf';
  }

  return null;
}

export function cleanBase64(raw: string): string {
  return raw.replace(/\s+/g, '');
}

export function estimateBase64ByteSize(base64: string): number {
  const cleaned = cleanBase64(base64);
  if (!cleaned) return 0;
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function buildPrescriptionFileDataUri(input: {
  base64?: string | null;
  dataUri?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  byteSize?: number | null;
}): BuildFileDataResult {
  let rawBase64 = typeof input.base64 === 'string' ? input.base64 : '';
  let detectedMime = normalizePrescriptionMimeType(input.mimeType, input.fileName);

  if (!rawBase64 && typeof input.dataUri === 'string') {
    const match = input.dataUri.trim().match(/^data:([^;]+);base64,([\s\S]+)$/i);
    if (match) {
      detectedMime = normalizePrescriptionMimeType(match[1], input.fileName) ?? detectedMime;
      rawBase64 = match[2];
    }
  }

  if (!detectedMime) {
    return {
      ok: false,
      error: 'Unsupported file format. Please select a JPG, PNG, or PDF prescription.',
    };
  }

  const cleaned = cleanBase64(rawBase64);
  if (!cleaned || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
    return {
      ok: false,
      error: 'Could not read the selected prescription file. Please try again.',
    };
  }

  const computedBytes = estimateBase64ByteSize(cleaned);
  const effectiveBytes =
    typeof input.byteSize === 'number' && input.byteSize > 0
      ? Math.max(input.byteSize, computedBytes)
      : computedBytes;

  if (effectiveBytes <= 0 || effectiveBytes > MAX_PRESCRIPTION_FILE_BYTES) {
    return {
      ok: false,
      error: 'Prescription file must be 5 MB or smaller. Please choose a smaller photo or PDF.',
    };
  }

  return {
    ok: true,
    fileData: `data:${detectedMime};base64,${cleaned}`,
    mimeType: detectedMime,
    byteSize: computedBytes,
    isImage: detectedMime !== 'application/pdf',
  };
}

export function buildPrescriptionUploadPayload(input: {
  patientName: string;
  patientPhone: string;
  doctorName?: string;
  medications?: string;
  deliveryPreference: 'delivery' | 'pickup';
  deliveryAddress?: string;
  notes?: string;
  attachment?: SelectedPrescriptionAttachment | null;
}): PrescriptionUploadPayload {
  const payload: PrescriptionUploadPayload = {
    patientName: input.patientName.trim(),
    patientPhone: input.patientPhone.trim(),
    deliveryPreference: input.deliveryPreference,
  };

  const doctorName = input.doctorName?.trim();
  if (doctorName) payload.doctorName = doctorName;

  const medications = input.medications?.trim();
  if (medications) payload.medications = medications;

  if (input.deliveryPreference === 'delivery') {
    const address = input.deliveryAddress?.trim();
    if (address) payload.deliveryAddress = address;
  }

  const notes = input.notes?.trim();
  if (notes) payload.notes = notes;

  if (input.attachment?.fileData) {
    payload.fileData = input.attachment.fileData;
    payload.fileName = input.attachment.fileName;
  }

  return payload;
}

export function formatDeliveryPreferenceLabel(value?: string | null): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'pickup' || normalized === 'in-store pickup') {
    return 'In-Store Pickup';
  }
  return 'Home Delivery';
}

interface HttpErrorShape {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string | string[];
      error?: string;
    } | string | null;
  };
}

export function extractPrescriptionTrackError(error: unknown): string {
  const err = (error && typeof error === 'object' ? error : {}) as HttpErrorShape;
  const data = err.response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === 'object') {
    if (Array.isArray(data.message)) {
      const joined = data.message.filter(Boolean).join(', ').trim();
      if (joined) return joined;
    } else if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }

    if (err.response?.status === 404) {
      return 'No prescription found matching that reference code.';
    }

    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }
  }

  if (err.response?.status === 404) {
    return 'No prescription found matching that reference code.';
  }

  if (typeof err.message === 'string' && err.message.trim()) {
    return err.message.trim();
  }

  return 'No prescription found matching that reference code.';
}
