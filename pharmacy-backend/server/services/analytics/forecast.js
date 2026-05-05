const { Batch, Medicine, Sales } = require('../../models');

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULT_ANALYTICS_OPTIONS = {
  shortWindowDays: 7,
  baselineWindowDays: 30,
  historyDays: 60,
  leadTimeDays: 14,
  forecastDays: 14,
  bufferFactor: 1.65,
  deadStockDays: 30,
  deadStockSalesThreshold: 2,
  deadStockStockThreshold: 20,
  expiryWarningDays: 90,
};

function clampInteger(value, fallback, min, max) {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsedValue));
}

function clampFloat(value, fallback, min, max) {
  const parsedValue = Number.parseFloat(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsedValue));
}

function roundNumber(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date, amount) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function toDayKey(dateLike) {
  const value = new Date(dateLike);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildWindowSeries(salesByDay, days, offsetDays = 0) {
  const today = startOfToday();
  const values = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const targetDate = addDays(today, -(index + offsetDays));
    const dayKey = toDayKey(targetDate);
    values.push(Number(salesByDay.get(dayKey) || 0));
  }

  return values;
}

function sumSeries(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function findExtremeBucket(buckets, comparisonFn) {
  if (!Array.isArray(buckets) || buckets.length === 0) {
    return null;
  }

  return buckets.reduce((selected, current) => {
    if (!selected) {
      return current;
    }

    return comparisonFn(current, selected) ? current : selected;
  }, null);
}

function describeSeasonality(patternType, peakWeekday) {
  if (patternType === 'insufficient-data') {
    return 'No seasonality signal yet';
  }

  if (!peakWeekday) {
    return 'Seasonality pattern unavailable';
  }

  if (patternType === 'high') {
    return `Strong demand on ${peakWeekday.label}`;
  }

  if (patternType === 'moderate') {
    return `${peakWeekday.label} tends to outperform the weekly average`;
  }

  return 'Demand is fairly steady across the week';
}

function buildSeasonalityProfile(salesByDay, historyDays, referenceDailyAverage) {
  const weekdayBuckets = WEEKDAY_LABELS.map((label, index) => ({
    key: label.toLowerCase(),
    label,
    order: index,
    totalUnits: 0,
    periodsObserved: 0,
  }));
  const monthBuckets = MONTH_LABELS.map((label, index) => ({
    key: label.toLowerCase(),
    label,
    order: index,
    totalUnits: 0,
    periodsObserved: 0,
  }));
  const today = startOfToday();
  let totalUnits = 0;

  for (let index = historyDays - 1; index >= 0; index -= 1) {
    const targetDate = addDays(today, -index);
    const quantity = Number(salesByDay.get(toDayKey(targetDate)) || 0);
    const weekdayIndex = targetDate.getDay();
    const monthIndex = targetDate.getMonth();

    weekdayBuckets[weekdayIndex].periodsObserved += 1;
    weekdayBuckets[weekdayIndex].totalUnits += quantity;
    monthBuckets[monthIndex].periodsObserved += 1;
    monthBuckets[monthIndex].totalUnits += quantity;
    totalUnits += quantity;
  }

  const baselineDailyAverage =
    Number(referenceDailyAverage || 0) > 0
      ? Number(referenceDailyAverage || 0)
      : historyDays > 0
        ? totalUnits / historyDays
        : 0;

  const serializeBucket = (bucket) => {
    const averagePerObservedPeriod =
      bucket.periodsObserved > 0 ? bucket.totalUnits / bucket.periodsObserved : 0;
    const demandIndex =
      baselineDailyAverage > 0 ? averagePerObservedPeriod / baselineDailyAverage : 0;

    return {
      key: bucket.key,
      label: bucket.label,
      totalUnits: roundNumber(bucket.totalUnits),
      periodsObserved: bucket.periodsObserved,
      averagePerObservedPeriod: roundNumber(averagePerObservedPeriod),
      demandIndex: roundNumber(demandIndex),
    };
  };

  const weeklyPattern = weekdayBuckets.map(serializeBucket);
  const monthlyPattern = monthBuckets
    .filter((bucket) => bucket.periodsObserved > 0)
    .map(serializeBucket);
  const peakWeekday =
    totalUnits > 0
      ? findExtremeBucket(weeklyPattern, (current, selected) => current.demandIndex > selected.demandIndex)
      : null;
  const lowWeekday =
    totalUnits > 0
      ? findExtremeBucket(weeklyPattern, (current, selected) => current.demandIndex < selected.demandIndex)
      : null;
  const peakMonth =
    totalUnits > 0
      ? findExtremeBucket(monthlyPattern, (current, selected) => current.demandIndex > selected.demandIndex)
      : null;
  const strength =
    peakWeekday && lowWeekday ? Math.max(0, peakWeekday.demandIndex - lowWeekday.demandIndex) : 0;
  let patternType = 'steady';

  if (totalUnits === 0) {
    patternType = 'insufficient-data';
  } else if (strength >= 0.75) {
    patternType = 'high';
  } else if (strength >= 0.35) {
    patternType = 'moderate';
  }

  return {
    historyWindowDays: historyDays,
    weeklyPattern,
    monthlyPattern,
    peakWeekday: peakWeekday
      ? {
          label: peakWeekday.label,
          demandIndex: peakWeekday.demandIndex,
          averagePerObservedPeriod: peakWeekday.averagePerObservedPeriod,
        }
      : null,
    lowWeekday: lowWeekday
      ? {
          label: lowWeekday.label,
          demandIndex: lowWeekday.demandIndex,
          averagePerObservedPeriod: lowWeekday.averagePerObservedPeriod,
        }
      : null,
    peakMonth: peakMonth
      ? {
          label: peakMonth.label,
          demandIndex: peakMonth.demandIndex,
          averagePerObservedPeriod: peakMonth.averagePerObservedPeriod,
        }
      : null,
    strength: roundNumber(strength),
    patternType,
    description: describeSeasonality(patternType, peakWeekday),
  };
}

function buildSeasonalityAdjustedDemand(avgDailySales, seasonalityProfile, forecastDays) {
  if (!(avgDailySales > 0) || !seasonalityProfile?.weeklyPattern?.length || !(forecastDays > 0)) {
    return 0;
  }

  const weekdayIndexByKey = new Map(
    seasonalityProfile.weeklyPattern.map((bucket) => [bucket.key, Number(bucket.demandIndex || 0)])
  );
  const today = startOfToday();
  let totalDemand = 0;

  for (let index = 0; index < forecastDays; index += 1) {
    const targetDate = addDays(today, index);
    const weekdayKey = WEEKDAY_LABELS[targetDate.getDay()].toLowerCase();
    const seasonalMultiplier = weekdayIndexByKey.get(weekdayKey) || 1;
    totalDemand += avgDailySales * seasonalMultiplier;
  }

  return roundNumber(totalDemand);
}

function parseAnalyticsOptions(query = {}) {
  return {
    shortWindowDays: clampInteger(
      query.shortWindowDays,
      DEFAULT_ANALYTICS_OPTIONS.shortWindowDays,
      3,
      30
    ),
    baselineWindowDays: clampInteger(
      query.baselineWindowDays,
      DEFAULT_ANALYTICS_OPTIONS.baselineWindowDays,
      7,
      90
    ),
    historyDays: clampInteger(
      query.historyDays,
      DEFAULT_ANALYTICS_OPTIONS.historyDays,
      30,
      180
    ),
    leadTimeDays: clampInteger(
      query.leadTimeDays,
      DEFAULT_ANALYTICS_OPTIONS.leadTimeDays,
      1,
      90
    ),
    forecastDays: clampInteger(
      query.forecastDays,
      DEFAULT_ANALYTICS_OPTIONS.forecastDays,
      1,
      90
    ),
    bufferFactor: clampFloat(
      query.bufferFactor,
      DEFAULT_ANALYTICS_OPTIONS.bufferFactor,
      0,
      5
    ),
    deadStockDays: clampInteger(
      query.deadStockDays,
      DEFAULT_ANALYTICS_OPTIONS.deadStockDays,
      7,
      90
    ),
    deadStockSalesThreshold: clampInteger(
      query.deadStockSalesThreshold,
      DEFAULT_ANALYTICS_OPTIONS.deadStockSalesThreshold,
      0,
      1000
    ),
    deadStockStockThreshold: clampInteger(
      query.deadStockStockThreshold,
      DEFAULT_ANALYTICS_OPTIONS.deadStockStockThreshold,
      1,
      100000
    ),
    expiryWarningDays: clampInteger(
      query.expiryWarningDays,
      DEFAULT_ANALYTICS_OPTIONS.expiryWarningDays,
      1,
      365
    ),
  };
}

function normalizeBatches(rawBatches = []) {
  return [...rawBatches]
    .map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      quantity: Number(batch.quantity || 0),
      expiryDate: batch.expiryDate || null,
      costPrice: Number(batch.costPrice || 0),
      sellingPrice: Number(batch.sellingPrice || 0),
      receivedDate: batch.receivedDate || batch.createdAt || null,
      supplierId: batch.supplierId || null,
      warehouse: batch.warehouse || null,
    }))
    .sort((left, right) => {
      const leftTime = left.receivedDate ? new Date(left.receivedDate).getTime() : 0;
      const rightTime = right.receivedDate ? new Date(right.receivedDate).getTime() : 0;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return Number(left.id || 0) - Number(right.id || 0);
    });
}

async function buildForecastDataset(options = DEFAULT_ANALYTICS_OPTIONS) {
  const [medicines, sales] = await Promise.all([
    Medicine.findAll({
      order: [['name', 'ASC']],
      include: [{ model: Batch }],
    }),
    Sales.findAll({
      order: [['date', 'ASC']],
    }),
  ]);

  const medicineIdByName = new Map(
    medicines.map((medicine) => [String(medicine.name || '').trim().toLowerCase(), medicine.id])
  );
  const salesByMedicine = new Map();

  for (const sale of sales) {
    const resolvedMedicineId =
      sale.medicineId ||
      medicineIdByName.get(String(sale.name || '').trim().toLowerCase());

    if (!resolvedMedicineId) {
      continue;
    }

    if (!salesByMedicine.has(resolvedMedicineId)) {
      salesByMedicine.set(resolvedMedicineId, new Map());
    }

    const salesByDay = salesByMedicine.get(resolvedMedicineId);
    const dayKey = toDayKey(sale.date);
    const currentQuantity = Number(salesByDay.get(dayKey) || 0);
    salesByDay.set(dayKey, currentQuantity + Number(sale.quantity || 0));
  }

  const predictions = medicines.map((medicine) => {
    const batches = normalizeBatches(medicine.Batches);
    const salesByDay = salesByMedicine.get(medicine.id) || new Map();
    const historyDailyQuantities = buildWindowSeries(salesByDay, options.historyDays);
    const recentDailyQuantities = historyDailyQuantities.slice(-options.shortWindowDays);
    const baselineDailyQuantities = historyDailyQuantities.slice(-options.baselineWindowDays);
    const previousDailyQuantities = buildWindowSeries(
      salesByDay,
      options.shortWindowDays,
      options.shortWindowDays
    );

    const recentSales = sumSeries(recentDailyQuantities);
    const baselineSales = sumSeries(baselineDailyQuantities);
    const previousSales = sumSeries(previousDailyQuantities);
    const avgDailySales7 = recentSales / options.shortWindowDays;
    const avgDailySales30 = baselineSales / options.baselineWindowDays;
    const previous7DayAverage = previousSales / options.shortWindowDays;
    const trendPercent =
      previous7DayAverage > 0
        ? ((avgDailySales7 - previous7DayAverage) / previous7DayAverage) * 100
        : avgDailySales7 > 0
          ? 100
          : 0;

    let trendDirection = 'stable';
    if (avgDailySales7 > previous7DayAverage * 1.05) {
      trendDirection = 'up';
    } else if (avgDailySales7 < previous7DayAverage * 0.95) {
      trendDirection = 'down';
    }

    const currentStock = batches.reduce((total, batch) => total + Number(batch.quantity || 0), 0);
    const latestBatch = batches[batches.length - 1] || null;
    const earliestBatch = [...batches].sort((left, right) => {
      const leftTime = left.expiryDate ? new Date(left.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.expiryDate ? new Date(right.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    })[0] || null;
    const seasonality = buildSeasonalityProfile(
      salesByDay,
      options.historyDays,
      avgDailySales30
    );
    const seasonalityAdjustedLeadTimeDemand = buildSeasonalityAdjustedDemand(
      avgDailySales30,
      seasonality,
      options.leadTimeDays
    );
    const seasonalityAdjustedForecastDemand = buildSeasonalityAdjustedDemand(
      avgDailySales30,
      seasonality,
      options.forecastDays
    );

    return {
      medicineId: medicine.id,
      name: medicine.name,
      genericName: medicine.genericName || null,
      category: medicine.category || 'Uncategorized',
      lowStockThreshold: Number(medicine.lowStockThreshold || 0),
      currentStock,
      currentPrice: roundNumber(latestBatch?.sellingPrice || 0),
      totalInventoryCost: roundNumber(
        batches.reduce(
          (total, batch) => total + Number(batch.quantity || 0) * Number(batch.costPrice || 0),
          0
        )
      ),
      inventory: {
        batchesCount: batches.length,
        earliestExpiryDate: earliestBatch?.expiryDate || null,
        latestReceivedDate: latestBatch?.receivedDate || null,
      },
      sales: {
        last7Days: recentSales,
        last30Days: baselineSales,
        avgDailySales7: roundNumber(avgDailySales7),
        avgDailySales30: roundNumber(avgDailySales30),
        previous7DayAverage: roundNumber(previous7DayAverage),
        trendDirection,
        trendPercent: roundNumber(trendPercent),
        historyWindowDays: options.historyDays,
        historyDailyQuantities,
      },
      forecast: {
        leadTimeDays: options.leadTimeDays,
        horizonDays: options.forecastDays,
        leadTimeDemand: roundNumber(avgDailySales30 * options.leadTimeDays),
        forecastDemand: roundNumber(avgDailySales30 * options.forecastDays),
        seasonalityAdjustedLeadTimeDemand,
        seasonalityAdjustedForecastDemand,
      },
      seasonality,
      batches,
    };
  });

  predictions.sort((left, right) => {
    const forecastDifference = right.forecast.forecastDemand - left.forecast.forecastDemand;
    if (forecastDifference !== 0) {
      return forecastDifference;
    }

    return right.sales.last30Days - left.sales.last30Days;
  });

  const summary = {
    totalProducts: predictions.length,
    productsWithRecentSales: predictions.filter((item) => item.sales.last30Days > 0).length,
    productsTrendingUp: predictions.filter((item) => item.sales.trendDirection === 'up').length,
    productsTrendingDown: predictions.filter((item) => item.sales.trendDirection === 'down').length,
    productsWithSeasonalitySignals: predictions.filter((item) =>
      ['high', 'moderate'].includes(item.seasonality?.patternType)
    ).length,
  };

  return {
    options,
    summary,
    predictions,
  };
}

module.exports = {
  DEFAULT_ANALYTICS_OPTIONS,
  DAY_IN_MS,
  buildForecastDataset,
  parseAnalyticsOptions,
  roundNumber,
  startOfToday,
};
