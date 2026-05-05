const { DAY_IN_MS, roundNumber, startOfToday } = require('./forecast');

function buildExpiryRiskReport(predictions = [], options = {}) {
  const expiryRisk = [];
  const today = startOfToday();

  for (const prediction of predictions) {
    const avgDailySales = Number(prediction.sales.avgDailySales30 || 0);

    for (const batch of prediction.batches || []) {
      if (!batch.expiryDate || Number(batch.quantity || 0) <= 0) {
        continue;
      }

      const expiryDate = new Date(batch.expiryDate);
      expiryDate.setHours(0, 0, 0, 0);

      const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / DAY_IN_MS);
      const expectedSalesBeforeExpiry = avgDailySales * Math.max(daysToExpiry, 0);
      const atRiskUnits = Number(batch.quantity || 0) - expectedSalesBeforeExpiry;
      const isWithinWarningWindow = daysToExpiry <= Number(options.expiryWarningDays || 0);

      if (atRiskUnits > 0 && isWithinWarningWindow) {
        expiryRisk.push({
          medicineId: prediction.medicineId,
          name: prediction.name,
          category: prediction.category,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: Number(batch.quantity || 0),
          expiryDate: batch.expiryDate,
          daysToExpiry,
          expectedSalesBeforeExpiry: roundNumber(expectedSalesBeforeExpiry),
          atRiskUnits: Math.ceil(atRiskUnits),
          currentStock: Number(prediction.currentStock || 0),
          avgDailySales30: avgDailySales,
        });
      }
    }
  }

  expiryRisk.sort((left, right) => {
    if (left.daysToExpiry !== right.daysToExpiry) {
      return left.daysToExpiry - right.daysToExpiry;
    }

    return right.atRiskUnits - left.atRiskUnits;
  });

  return {
    expiryRisk,
    summary: {
      expiryRiskCount: expiryRisk.length,
      expiryRiskProductCount: new Set(expiryRisk.map((item) => item.medicineId)).size,
    },
  };
}

module.exports = {
  buildExpiryRiskReport,
};
