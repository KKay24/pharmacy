const { Injectable, InternalServerErrorException } = require('@nestjs/common');
const { Expense, Sales } = require('../../models');
const { buildForecastDataset, parseAnalyticsOptions, roundNumber } = require('../../services/analytics/forecast');
const { buildStockInsights } = require('../../services/analytics/stockout');
const { buildExpiryRiskReport } = require('../../services/analytics/expiry');
const { paginatedResponse, parsePagination } = require('../common/pagination');

function monthKey(value) { return new Date(value).toISOString().slice(0, 7); }

function serializePrediction(prediction) {
  const { batches, sales = {}, ...rest } = prediction;
  const { historyDailyQuantities, ...publicSales } = sales;
  return { ...rest, sales: publicSales };
}

class AnalyticsService {
  async profitLoss(query) {
    try {
      const [sales, expenses] = await Promise.all([Sales.findAll({ order: [['date', 'ASC']] }), Expense.findAll({ order: [['date', 'ASC']] })]);
      const monthlyData = new Map();
      const ensureMonth = (key) => {
        if (!monthlyData.has(key)) monthlyData.set(key, { month: key, revenue: 0, cogs: 0, grossProfit: 0, operatingExpenses: 0, netProfit: 0 });
        return monthlyData.get(key);
      };
      for (const sale of sales) { const current = ensureMonth(monthKey(sale.date)); current.revenue += Number(sale.totalPrice || 0); current.cogs += Number(sale.totalCost || 0); }
      for (const expense of expenses) { const current = ensureMonth(monthKey(expense.date)); current.operatingExpenses += Number(expense.amount || 0); }
      const rows = Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month)).map((entry) => ({ ...entry, grossProfit: entry.revenue - entry.cogs, netProfit: entry.revenue - entry.cogs - entry.operatingExpenses }));
      const pagination = parsePagination(query);
      return paginatedResponse(rows.slice(pagination.offset, pagination.offset + pagination.limit), rows.length, pagination);
    } catch { throw new InternalServerErrorException('Failed to fetch analytics'); }
  }

  async snapshot(query = {}) {
    const options = parseAnalyticsOptions(query);
    const { predictions, summary: forecastSummary } = await buildForecastDataset(options);
    const stockInsights = buildStockInsights(predictions, options);
    const expiryInsights = buildExpiryRiskReport(predictions, options);
    const totalForecastDemand = predictions.reduce((total, item) => total + Number(item.forecast.forecastDemand || 0), 0);
    return { generatedAt: new Date().toISOString(), parameters: options, predictions, stockInsights, expiryInsights, summary: { ...forecastSummary, ...stockInsights.summary, ...expiryInsights.summary, forecastDemandTotal: roundNumber(totalForecastDemand) } };
  }

  async predictions(query) { const snapshot = await this.snapshot(query); return { generatedAt: snapshot.generatedAt, parameters: snapshot.parameters, summary: snapshot.summary, predictions: snapshot.predictions.map(serializePrediction) }; }
  async reorderSuggestions(query) { const snapshot = await this.snapshot(query); return { generatedAt: snapshot.generatedAt, parameters: snapshot.parameters, summary: snapshot.summary, items: snapshot.stockInsights.reorderSuggestions }; }
  async risks(query) { const snapshot = await this.snapshot(query); return { generatedAt: snapshot.generatedAt, parameters: snapshot.parameters, summary: snapshot.summary, stockoutRisk: snapshot.stockInsights.stockoutRisk, expiryRisk: snapshot.expiryInsights.expiryRisk, deadStock: snapshot.stockInsights.deadStock }; }
}

Injectable()(AnalyticsService);
module.exports = AnalyticsService;