const express = require('express');
const router = express.Router();
const { Expense, Sales } = require('../models');
const {
  buildForecastDataset,
  parseAnalyticsOptions,
  roundNumber,
} = require('../services/analytics/forecast');
const { buildStockInsights } = require('../services/analytics/stockout');
const { buildExpiryRiskReport } = require('../services/analytics/expiry');

function monthKey(value) {
  return new Date(value).toISOString().slice(0, 7);
}

function serializePrediction(prediction) {
  const { batches, sales = {}, ...rest } = prediction;
  const { historyDailyQuantities, ...publicSales } = sales;

  return {
    ...rest,
    sales: publicSales,
  };
}

async function getProfitLossAnalytics(req, res) {
  try {
    const [sales, expenses] = await Promise.all([
      Sales.findAll({ order: [['date', 'ASC']] }),
      Expense.findAll({ order: [['date', 'ASC']] }),
    ]);

    const monthlyData = new Map();

    for (const sale of sales) {
      const key = monthKey(sale.date);
      if (!monthlyData.has(key)) {
        monthlyData.set(key, {
          month: key,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          operatingExpenses: 0,
          netProfit: 0,
        });
      }

      const current = monthlyData.get(key);
      current.revenue += Number(sale.totalPrice || 0);
      current.cogs += Number(sale.totalCost || 0);
    }

    for (const expense of expenses) {
      const key = monthKey(expense.date);
      if (!monthlyData.has(key)) {
        monthlyData.set(key, {
          month: key,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          operatingExpenses: 0,
          netProfit: 0,
        });
      }

      const current = monthlyData.get(key);
      current.operatingExpenses += Number(expense.amount || 0);
    }

    const result = Array.from(monthlyData.values())
      .sort((left, right) => left.month.localeCompare(right.month))
      .map((entry) => {
        const grossProfit = entry.revenue - entry.cogs;
        return {
          ...entry,
          grossProfit,
          netProfit: grossProfit - entry.operatingExpenses,
        };
      });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}

async function buildPredictiveSnapshot(query = {}) {
  const options = parseAnalyticsOptions(query);
  const { predictions, summary: forecastSummary } = await buildForecastDataset(options);
  const stockInsights = buildStockInsights(predictions, options);
  const expiryInsights = buildExpiryRiskReport(predictions, options);
  const totalForecastDemand = predictions.reduce(
    (total, item) => total + Number(item.forecast.forecastDemand || 0),
    0
  );

  return {
    generatedAt: new Date().toISOString(),
    parameters: options,
    predictions,
    stockInsights,
    expiryInsights,
    summary: {
      ...forecastSummary,
      ...stockInsights.summary,
      ...expiryInsights.summary,
      forecastDemandTotal: roundNumber(totalForecastDemand),
    },
  };
}

router.get('/profit-loss', getProfitLossAnalytics);
router.get('/predictions', async (req, res) => {
  try {
    const snapshot = await buildPredictiveSnapshot(req.query);
    return res.json({
      generatedAt: snapshot.generatedAt,
      parameters: snapshot.parameters,
      summary: snapshot.summary,
      predictions: snapshot.predictions.map(serializePrediction),
    });
  } catch (error) {
    console.error('Predictive analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch predictive analytics' });
  }
});

router.get('/reorder-suggestions', async (req, res) => {
  try {
    const snapshot = await buildPredictiveSnapshot(req.query);
    return res.json({
      generatedAt: snapshot.generatedAt,
      parameters: snapshot.parameters,
      summary: snapshot.summary,
      items: snapshot.stockInsights.reorderSuggestions,
    });
  } catch (error) {
    console.error('Reorder suggestion error:', error);
    return res.status(500).json({ error: 'Failed to fetch reorder suggestions' });
  }
});

router.get('/risks', async (req, res) => {
  try {
    const snapshot = await buildPredictiveSnapshot(req.query);
    return res.json({
      generatedAt: snapshot.generatedAt,
      parameters: snapshot.parameters,
      summary: snapshot.summary,
      stockoutRisk: snapshot.stockInsights.stockoutRisk,
      expiryRisk: snapshot.expiryInsights.expiryRisk,
      deadStock: snapshot.stockInsights.deadStock,
    });
  } catch (error) {
    console.error('Risk analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch risk analytics' });
  }
});

module.exports = {
  getProfitLossAnalytics,
  router,
};
