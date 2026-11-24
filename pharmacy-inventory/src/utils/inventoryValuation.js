const INACTIVE_BATCH_STATUSES = new Set(['archived', 'deleted']);

export function isInactiveBatch(batch) {
  return INACTIVE_BATCH_STATUSES.has(String(batch?.status || '').toLowerCase());
}

export function getActiveBatches(inventoryItem) {
  const batches = Array.isArray(inventoryItem?.Batches) ? inventoryItem.Batches : [];
  return batches.filter((batch) => !isInactiveBatch(batch));
}

export function getEffectiveBatchCost(batch, fallbackCost = 0) {
  return Number(batch?.costPrice || fallbackCost || 0);
}

export function getBatchStockValue(batch, fallbackCost = 0) {
  if (isInactiveBatch(batch)) return 0;
  return Number(batch?.quantity || 0) * getEffectiveBatchCost(batch, fallbackCost);
}

export function getInventoryStockValue(inventoryItem) {
  const batches = getActiveBatches(inventoryItem);
  const fallbackCost = Number(batches[0]?.costPrice || 0);

  return batches.reduce((total, batch) => total + getBatchStockValue(batch, fallbackCost), 0);
}
