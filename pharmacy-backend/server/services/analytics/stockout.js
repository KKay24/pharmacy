const { roundNumber } = require('./forecast');

function calculateStandardDeviation(values = []) {
  if (!values.length) {
    return 0;
  }

  const mean = values.reduce((total, value) => total + Number(value || 0), 0) / values.length;
  const variance =
    values.reduce((total, value) => total + (Number(value || 0) - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function buildStockInsights(predictions = [], options = {}) {
  const stockoutRisk = [];
  const reorderSuggestions = [];
  const deadStock = [];

  for (const prediction of predictions) {
    const avgDailySales = Number(prediction.sales.avgDailySales30 || 0);
    const currentStock = Number(prediction.currentStock || 0);
    const leadTimeDemand = Number(
      prediction.forecast?.seasonalityAdjustedLeadTimeDemand ||
      prediction.forecast?.leadTimeDemand ||
      0
    );
    const historyDailyQuantities = Array.isArray(prediction.sales.historyDailyQuantities)
      ? prediction.sales.historyDailyQuantities
      : [];
    const deadStockWindow = Math.min(
      Number(options.deadStockDays || 30),
      historyDailyQuantities.length || Number(options.deadStockDays || 30)
    );
    const salesInDeadStockWindow = historyDailyQuantities
      .slice(historyDailyQuantities.length - deadStockWindow)
      .reduce((total, value) => total + Number(value || 0), 0);

    const stdDeviation = calculateStandardDeviation(
      historyDailyQuantities.slice(historyDailyQuantities.length - Number(options.baselineWindowDays || 30))
    );
    const safetyStock = stdDeviation * Number(options.bufferFactor || 0);
    const reorderPoint = leadTimeDemand + safetyStock;
    const daysUntilStockout = avgDailySales > 0 ? currentStock / avgDailySales : null;
    const hasStockoutRisk =
      daysUntilStockout !== null && daysUntilStockout < Number(options.leadTimeDays || 0);
    const shouldReorder =
      avgDailySales > 0 && currentStock <= reorderPoint;
    const suggestedReorderQuantity = shouldReorder
      ? Math.max(0, Math.ceil(reorderPoint - currentStock))
      : 0;
    const isDeadStock =
      currentStock >= Number(options.deadStockStockThreshold || 0) &&
      salesInDeadStockWindow <= Number(options.deadStockSalesThreshold || 0);

    const insight = {
      medicineId: prediction.medicineId,
      name: prediction.name,
      genericName: prediction.genericName,
      category: prediction.category,
      currentStock,
      avgDailySales30: avgDailySales,
      salesLast30Days: Number(prediction.sales.last30Days || 0),
      daysUntilStockout: daysUntilStockout === null ? null : roundNumber(daysUntilStockout),
      leadTimeDays: Number(options.leadTimeDays || 0),
      leadTimeDemand: roundNumber(leadTimeDemand),
      reorderPoint: roundNumber(reorderPoint),
      safetyStock: roundNumber(safetyStock),
      suggestedReorderQuantity,
      trendDirection: prediction.sales.trendDirection,
      trendPercent: Number(prediction.sales.trendPercent || 0),
      forecastDemand: Number(prediction.forecast.forecastDemand || 0),
    };

    if (hasStockoutRisk) {
      stockoutRisk.push(insight);
    }

    if (shouldReorder) {
      reorderSuggestions.push(insight);
    }

    if (isDeadStock) {
      deadStock.push({
        ...insight,
        deadStockWindowDays: deadStockWindow,
        salesInWindow: salesInDeadStockWindow,
      });
    }
  }

  stockoutRisk.sort((left, right) => {
    const leftValue = left.daysUntilStockout === null ? Number.MAX_SAFE_INTEGER : left.daysUntilStockout;
    const rightValue =
      right.daysUntilStockout === null ? Number.MAX_SAFE_INTEGER : right.daysUntilStockout;
    return leftValue - rightValue;
  });

  reorderSuggestions.sort((left, right) => {
    if (right.suggestedReorderQuantity !== left.suggestedReorderQuantity) {
      return right.suggestedReorderQuantity - left.suggestedReorderQuantity;
    }

    return left.currentStock - right.currentStock;
  });

  deadStock.sort((left, right) => {
    if (right.currentStock !== left.currentStock) {
      return right.currentStock - left.currentStock;
    }

    return left.salesInWindow - right.salesInWindow;
  });

  return {
    stockoutRisk,
    reorderSuggestions,
    deadStock,
    summary: {
      stockoutRiskCount: stockoutRisk.length,
      reorderSuggestionCount: reorderSuggestions.length,
      deadStockCount: deadStock.length,
    },
  };
}

module.exports = {
  buildStockInsights,
};
