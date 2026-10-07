export function getEffectiveBatchCost(batch, fallbackCost = 0) {
  return Number(batch?.costPrice || fallbackCost || 0);
}

export function getBatchStockValue(batch, fallbackCost = 0) {
  return Number(batch?.quantity || 0) * getEffectiveBatchCost(batch, fallbackCost);
}

export function getInventoryStockValue(inventoryItem) {
  const batches = Array.isArray(inventoryItem?.Batches) ? inventoryItem.Batches : [];
  const fallbackCost = Number(batches[0]?.costPrice || 0);

  return batches.reduce((total, batch) => total + getBatchStockValue(batch, fallbackCost), 0);
}
