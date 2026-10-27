const { BadRequestException, Injectable, InternalServerErrorException } = require('@nestjs/common');
const { buildForecastDataset, parseAnalyticsOptions, roundNumber } = require('../../services/analytics/forecast');
const { buildStockInsights } = require('../../services/analytics/stockout');
const { buildExpiryRiskReport } = require('../../services/analytics/expiry');
const { buildFinancialReport } = require('../../services/financial/reporting');

class AnalyticsService {
  async profitLoss(query) {
    const report = await this.financialReport(query);
    // Financial statements must not be silently truncated like an operational list.
    return { data: report.monthly, pagination: { page: 1, limit: report.monthly.length, total: report.monthly.length, totalPages: 1 }, parameters: report.parameters, totals: report.totals, allocationWarnings: report.allocationWarnings };
  }

  async financialReport(query = {}) {
    try { return await buildFinancialReport(query); }
    catch (error) {
      if (error?.message?.includes('YYYY-MM-DD') || error?.message?.includes('on or before')) throw new BadRequestException(error.message);
      throw new InternalServerErrorException('Failed to fetch financial report');
    }
  }

  async reports(query) { return this.financialReport(query); }

  async snapshot(query = {}) {
    const options = parseAnalyticsOptions(query);
    const { predictions, summary: forecastSummary } = await buildForecastDataset(options);
    const stockInsights = buildStockInsights(predictions, options);
    const expiryInsights = buildExpiryRiskReport(predictions, options);
    const totalForecastDemand = predictions.reduce((total, item) => total + Number(item.forecast.forecastDemand || 0), 0);
    return { generatedAt: new Date().toISOString(), parameters: options, predictions, stockInsights, expiryInsights, summary: { ...forecastSummary, ...stockInsights.summary, ...expiryInsights.summary, forecastDemandTotal: roundNumber(totalForecastDemand) } };
  }

  async predictions(query) { const snapshot = await this.snapshot(query); return { generatedAt: snapshot.generatedAt, parameters: snapshot.parameters, summary: snapshot.summary, predictions: snapshot.predictions.map((prediction) => { const { batches, sales = {}, ...rest } = prediction; const { historyDailyQuantities, ...publicSales } = sales; return { ...rest, sales: publicSales }; }) }; }
  async reorderSuggestions(query) { const snapshot = await this.snapshot(query); return { generatedAt: snapshot.generatedAt, parameters: snapshot.parameters, summary: snapshot.summary, items: snapshot.stockInsights.reorderSuggestions }; }
  async risks(query) { const snapshot = await this.snapshot(query); return { generatedAt: snapshot.generatedAt, parameters: snapshot.parameters, summary: snapshot.summary, stockoutRisk: snapshot.stockInsights.stockoutRisk, expiryRisk: snapshot.expiryInsights.expiryRisk, deadStock: snapshot.stockInsights.deadStock }; }
}

Injectable()(AnalyticsService);
module.exports = AnalyticsService;
