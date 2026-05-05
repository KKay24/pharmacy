export interface InventoryBatch {
  id?: number;
  quantity?: number | string | null;
  sellingPrice?: number | string | null;
  receivedDate?: string | null;
  createdAt?: string | null;
}

const toNumber = (value: number | string | null | undefined) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const getBatchTimestamp = (batch: InventoryBatch) => {
  const rawTimestamp = batch.receivedDate || batch.createdAt;
  if (!rawTimestamp) {
    return 0;
  }

  const timestamp = new Date(rawTimestamp).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const getMedicineBatches = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as InventoryBatch[];
  }

  return [...value]
    .filter((batch): batch is InventoryBatch => typeof batch === 'object' && batch !== null)
    .sort((left, right) => {
      const timestampDifference = getBatchTimestamp(left) - getBatchTimestamp(right);
      if (timestampDifference !== 0) {
        return timestampDifference;
      }

      return toNumber(left.id) - toNumber(right.id);
    });
};

export const getMedicineTotalQuantity = (batches: InventoryBatch[]) =>
  batches.reduce((total, batch) => total + toNumber(batch.quantity), 0);

export const getMedicineCurrentPrice = (batches: InventoryBatch[]) => {
  if (batches.length === 0) {
    return 0;
  }

  return toNumber(batches[batches.length - 1].sellingPrice);
};
