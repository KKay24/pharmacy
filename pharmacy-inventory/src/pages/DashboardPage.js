import React, { useContext, useMemo } from "react";
import { DataContext } from "../context/DataContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  CalendarDays,
  Clock3,
  Package,
  PackageSearch,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import "../styles/dashboard.css";
import { getInventoryStockValue } from "../utils/inventoryValuation";

const EMPTY_PREDICTIVE_ANALYTICS = {
  predictions: [],
  summary: {},
  parameters: {},
  generatedAt: null,
};
const EMPTY_REORDER_INSIGHTS = {
  items: [],
  summary: {},
  parameters: {},
  generatedAt: null,
};
const EMPTY_RISK_INSIGHTS = {
  stockoutRisk: [],
  expiryRisk: [],
  deadStock: [],
  summary: {},
  parameters: {},
  generatedAt: null,
};

function getTotalQuantity(item) {
  if (Array.isArray(item.Batches)) {
    return item.Batches.reduce((total, batch) => total + Number(batch.quantity || 0), 0);
  }

  return Number(item.totalQuantity || item.quantity || 0);
}

function buildSparkData(value) {
  const numericValue = Math.max(1, Number(value) || 0);
  return [
    { v: numericValue * 0.55 },
    { v: numericValue * 0.72 },
    { v: numericValue * 0.63 },
    { v: numericValue },
  ];
}

function formatCurrency(value) {
  return `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDecimal(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
}

function formatTrendLabel(direction, percent) {
  if (direction === "up") {
    return `Up ${Math.abs(Number(percent || 0)).toFixed(1)}%`;
  }

  if (direction === "down") {
    return `Down ${Math.abs(Number(percent || 0)).toFixed(1)}%`;
  }

  return "Stable";
}

function formatPatternLabel(patternType) {
  if (patternType === "high") {
    return "Strong pattern";
  }

  if (patternType === "moderate") {
    return "Moderate pattern";
  }

  if (patternType === "steady") {
    return "Steady demand";
  }

  return "No pattern";
}

function formatDaysLabel(value) {
  if (value === null || value === undefined) {
    return "No sales signal";
  }

  if (value < 1) {
    return "<1 day";
  }

  return `${formatDecimal(value)} days`;
}

export default function DashboardPage() {
  const {
    inventory,
    sales = [],
    expenses = [],
    predictiveAnalytics = EMPTY_PREDICTIVE_ANALYTICS,
    reorderInsights = EMPTY_REORDER_INSIGHTS,
    riskInsights = EMPTY_RISK_INSIGHTS,
  } = useContext(DataContext);
  const LOW_STOCK_THRESHOLD = 10;
  const [inventoryBreakdownLevel, setInventoryBreakdownLevel] = React.useState("main");
  const predictions = predictiveAnalytics.predictions || [];
  const predictiveSummary = predictiveAnalytics.summary || {};
  const reorderSuggestions = reorderInsights.items || [];
  const stockoutRisk = riskInsights.stockoutRisk || [];
  const expiryRisk = riskInsights.expiryRisk || [];
  const deadStock = riskInsights.deadStock || [];
  const forecastDays = predictiveAnalytics.parameters?.forecastDays || 14;

  const totalProducts = inventory.length;

  const stockValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + getInventoryStockValue(item), 0);
  }, [inventory]);

  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => {
      const quantity = getTotalQuantity(item);
      return quantity > 0 && quantity <= Number(item.lowStockThreshold || LOW_STOCK_THRESHOLD);
    });
  }, [inventory]);

  const outOfStockItems = useMemo(() => {
    return inventory.filter((item) => getTotalQuantity(item) === 0);
  }, [inventory]);

  const expiryStockTotals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + 30);
    return inventory.reduce((totals, item) => {
      for (const batch of item.Batches || []) {
        const quantity = Number(batch.quantity || 0);
        if (quantity <= 0 || !batch.expiryDate) continue;
        const expiryDate = new Date(batch.expiryDate);
        if (expiryDate < today) totals.expiredUnits += quantity;
        else if (expiryDate <= warningDate) totals.nearExpiryUnits += quantity;
      }
      return totals;
    }, { expiredUnits: 0, nearExpiryUnits: 0 });
  }, [inventory]);

  const inventoryBreakdown = useMemo(() => {
    const groups = new Map();
    for (const item of inventory) {
      const label = inventoryBreakdownLevel === "main"
        ? item.MainCategory?.name || "Unclassified"
        : inventoryBreakdownLevel === "subcategory"
          ? item.Subcategory?.name || "Unclassified"
          : item.ProductForm?.name || "Unclassified";
      const current = groups.get(label) || { label, products: 0, units: 0, stockValue: 0 };
      current.products += 1;
      current.units += getTotalQuantity(item);
      current.stockValue += getInventoryStockValue(item);
      groups.set(label, current);
    }
    return [...groups.values()].sort((left, right) => right.stockValue - left.stockValue);
  }, [inventory, inventoryBreakdownLevel]);

  const getMonths = () => {
    const months = [];
    const now = new Date();

    for (let index = 5; index >= 0; index -= 1) {
      const value = new Date(now.getFullYear(), now.getMonth() - index, 1);
      months.push(value.toLocaleString("default", { month: "short" }));
    }

    return months;
  };

  const overviewMonths = getMonths();
  const stockOverviewData = overviewMonths.map((month) => ({
    name: month,
    InStock: totalProducts - outOfStockItems.length - lowStockItems.length,
    LowStock: lowStockItems.length,
    OutOfStock: outOfStockItems.length,
    OnOrder: 0,
  }));

  const salesActivityData = overviewMonths.map((month) => {
    const monthlySales = sales.filter(
      (sale) => new Date(sale.date).toLocaleString("default", { month: "short" }) === month
    ).length;
    const monthlyRestock = expenses.filter(
      (expense) => new Date(expense.date).toLocaleString("default", { month: "short" }) === month
    ).length;

    return { name: month, Sales: monthlySales, Restock: monthlyRestock, Returns: 0 };
  });

  const stockoutRiskCount = predictiveSummary.stockoutRiskCount ?? stockoutRisk.length;
  const deadStockCount = predictiveSummary.deadStockCount ?? deadStock.length;
  const expiringProductCount =
    predictiveSummary.expiryRiskProductCount ??
    new Set(expiryRisk.map((item) => item.medicineId)).size;
  const seasonalitySignalCount =
    predictiveSummary.productsWithSeasonalitySignals ??
    predictions.filter((item) => ["high", "moderate"].includes(item.seasonality?.patternType)).length;
  const topForecastProducts = [...predictions]
    .filter((item) => Number(item.forecast?.forecastDemand || 0) > 0)
    .sort(
      (left, right) =>
        Number(right.forecast?.seasonalityAdjustedForecastDemand || right.forecast?.forecastDemand || 0) -
        Number(left.forecast?.seasonalityAdjustedForecastDemand || left.forecast?.forecastDemand || 0)
    )
    .slice(0, 5);
  const seasonalProducts = predictions
    .filter((item) => item.sales?.last30Days > 0 && item.seasonality?.patternType !== "insufficient-data")
    .sort((left, right) => Number(right.seasonality?.strength || 0) - Number(left.seasonality?.strength || 0))
    .slice(0, 5);

  const metricCards = [
    {
      title: "Total Products",
      value: totalProducts.toLocaleString(),
      accentClass: "",
      sparkColor: "#3b82f6",
      sparkValue: totalProducts,
    },
    {
      title: "Stock Value",
      value: formatCurrency(stockValue),
      accentClass: "",
      sparkColor: "#10b981",
      sparkValue: stockValue,
    },
    {
      title: "Low Stock Items",
      value: lowStockItems.length,
      accentClass: "color-blue",
      sparkColor: "#2563eb",
      sparkValue: lowStockItems.length,
    },
    {
      title: "Stockout Risk",
      value: stockoutRiskCount,
      accentClass: "color-orange",
      sparkColor: "#f97316",
      sparkValue: stockoutRiskCount,
    },
    {
      title: "Expiring Soon",
      value: expiringProductCount,
      accentClass: "color-red",
      sparkColor: "#ef4444",
      sparkValue: expiringProductCount,
    },
    {
      title: "Expired Stock Units",
      value: expiryStockTotals.expiredUnits.toLocaleString(),
      accentClass: "color-red",
      sparkColor: "#b91c1c",
      sparkValue: expiryStockTotals.expiredUnits,
    },
    {
      title: "Near-Expiry Units",
      value: expiryStockTotals.nearExpiryUnits.toLocaleString(),
      accentClass: "color-orange",
      sparkColor: "#f97316",
      sparkValue: expiryStockTotals.nearExpiryUnits,
    },
    {
      title: "Dead Stock",
      value: deadStockCount,
      accentClass: "color-slate",
      sparkColor: "#475569",
      sparkValue: deadStockCount,
    },
  ];

  return (
    <div className="dashboard-grid">
      <div className="metrics-row">
        {metricCards.map((card) => (
          <div key={card.title} className="metric-card">
            <div className="metric-info">
              <span className="metric-title">{card.title}</span>
              <span className={`metric-value ${card.accentClass}`}>{card.value}</span>
            </div>
            <div className="metric-chart-spark">
              <ResponsiveContainer width={60} height={30}>
                <LineChart data={buildSparkData(card.sparkValue)}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={card.sparkColor}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-row">
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Stock Overview</h3>
            <div className="header-filters">
              <select className="dash-select">
                <option>Monthly</option>
              </select>
              <select className="dash-select">
                <option>Products: {totalProducts}</option>
              </select>
            </div>
          </div>
          <div className="dash-card-body" style={{ height: "320px" }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={stockOverviewData} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Bar dataKey="InStock" stackId="a" fill="#3b82f6" barSize={25} />
                <Bar dataKey="LowStock" stackId="a" fill="#facc15" />
                <Bar dataKey="OutOfStock" stackId="a" fill="#ef4444" />
                <Bar dataKey="OnOrder" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Sales & Restock Activity</h3>
            <span className="action-link">{sales.length} sales records</span>
          </div>
          <div className="dash-card-body" style={{ height: "320px" }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={salesActivityData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Line
                  type="monotone"
                  dataKey="Sales"
                  stroke="#1e3a8a"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#1e3a8a" }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="Restock"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: "white", stroke: "#3b82f6", strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Returns"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h3>Inventory Classification & Value</h3>
          <select
            className="dash-select"
            aria-label="Inventory reporting level"
            value={inventoryBreakdownLevel}
            onChange={(event) => setInventoryBreakdownLevel(event.target.value)}
          >
            <option value="main">Main category</option>
            <option value="subcategory">Subcategory</option>
            <option value="form">Product form</option>
          </select>
        </div>
        <div className="dash-card-body" style={{ padding: 0 }}>
          <table className="mini-table">
            <thead>
              <tr>
                <th>{inventoryBreakdownLevel === "main" ? "Main Category" : inventoryBreakdownLevel === "subcategory" ? "Subcategory" : "Product Form"}</th>
                <th>Products</th>
                <th>Units</th>
                <th>Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {inventoryBreakdown.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: "center", padding: "2rem" }}>No inventory is available for reporting.</td></tr>
              ) : inventoryBreakdown.map((row) => (
                <tr key={row.label}>
                  <td style={{ fontWeight: 600 }}>{row.label}</td>
                  <td>{row.products}</td>
                  <td>{row.units.toLocaleString()}</td>
                  <td>{formatCurrency(row.stockValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lists-row">
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Reorder Suggestions</h3>
            <span className="action-link">{reorderSuggestions.length} active</span>
          </div>
          <div className="dash-card-body" style={{ padding: 0 }}>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Current Stock</th>
                  <th>Reorder Point</th>
                  <th>Suggested Qty</th>
                </tr>
              </thead>
              <tbody>
                {reorderSuggestions.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", padding: "2rem" }}>
                      No dynamic reorder suggestions right now
                    </td>
                  </tr>
                ) : (
                  reorderSuggestions.slice(0, 5).map((item) => (
                    <tr key={item.medicineId}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ fontWeight: 700 }}>{item.currentStock}</td>
                      <td>{formatDecimal(item.reorderPoint)}</td>
                      <td>
                        <button className="reorder-btn">{item.suggestedReorderQuantity} units</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Demand Forecast</h3>
            <span className="action-link">Next {forecastDays} days</span>
          </div>
          <div className="dash-card-body" style={{ padding: 0 }}>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>7d Avg/Day</th>
                  <th>30d Avg/Day</th>
                  <th>Forecast</th>
                </tr>
              </thead>
              <tbody>
                {topForecastProducts.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", padding: "2rem" }}>
                      Forecasts will appear once products have recent sales history
                    </td>
                  </tr>
                ) : (
                  topForecastProducts.map((item) => (
                    <tr key={item.medicineId}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{formatDecimal(item.sales.avgDailySales7)}</td>
                      <td>{formatDecimal(item.sales.avgDailySales30)}</td>
                      <td>
                        <div className="forecast-cell">
                          <strong>
                            {formatDecimal(
                              item.forecast.seasonalityAdjustedForecastDemand || item.forecast.forecastDemand
                            )}
                          </strong>
                          <span className="forecast-subvalue">
                            Base {formatDecimal(item.forecast.forecastDemand)}
                          </span>
                          <span className={`trend-chip ${item.sales.trendDirection}`}>
                            {item.sales.trendDirection === "up" ? (
                              <TrendingUp size={12} />
                            ) : item.sales.trendDirection === "down" ? (
                              <TrendingDown size={12} />
                            ) : (
                              <Package size={12} />
                            )}
                            {formatTrendLabel(item.sales.trendDirection, item.sales.trendPercent)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <h3>Seasonal Trends</h3>
            <span className="action-link">{seasonalitySignalCount} active signals</span>
          </div>
          <div className="dash-card-body" style={{ padding: 0 }}>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Peak Day</th>
                  <th>Peak Month</th>
                  <th>Pattern</th>
                </tr>
              </thead>
              <tbody>
                {seasonalProducts.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", padding: "2rem" }}>
                      Seasonal trends will appear as more product history builds up
                    </td>
                  </tr>
                ) : (
                  seasonalProducts.map((item) => (
                    <tr key={item.medicineId}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>
                        <div className="seasonality-cell">
                          <strong>{item.seasonality?.peakWeekday?.label || "N/A"}</strong>
                          <span>{formatDecimal(item.seasonality?.peakWeekday?.demandIndex || 0)}x avg</span>
                        </div>
                      </td>
                      <td>{item.seasonality?.peakMonth?.label || "N/A"}</td>
                      <td>
                        <span className={`seasonality-chip ${item.seasonality?.patternType || "steady"}`}>
                          {formatPatternLabel(item.seasonality?.patternType)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="predictive-panels-row">
        <div className="risk-panel">
          <div className="risk-panel__header">
            <div className="risk-panel__title">
              <ShieldAlert size={18} />
              <h3>Stockout Risk</h3>
            </div>
            <span className="risk-panel__count">{stockoutRiskCount}</span>
          </div>
          <div className="risk-list">
            {stockoutRisk.length === 0 ? (
              <div className="risk-empty">No immediate stockout risks.</div>
            ) : (
              stockoutRisk.slice(0, 3).map((item) => (
                <div key={item.medicineId} className="risk-list-item">
                  <div className="risk-list-item__copy">
                    <strong>{item.name}</strong>
                    <span>{formatDaysLabel(item.daysUntilStockout)} until depletion</span>
                  </div>
                  <div className="risk-list-item__meta">
                    <span>{item.currentStock} units</span>
                    <span className="risk-chip risk-chip--orange">Lead time {item.leadTimeDays}d</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="risk-panel">
          <div className="risk-panel__header">
            <div className="risk-panel__title">
              <Clock3 size={18} />
              <h3>Expiring Soon</h3>
            </div>
            <span className="risk-panel__count">{expiringProductCount}</span>
          </div>
          <div className="risk-list">
            {expiryRisk.length === 0 ? (
              <div className="risk-empty">No near-term expiry exposure found.</div>
            ) : (
              expiryRisk.slice(0, 3).map((item) => (
                <div key={item.batchId} className="risk-list-item">
                  <div className="risk-list-item__copy">
                    <strong>{item.name}</strong>
                    <span>Batch {item.batchNumber} expires in {formatDaysLabel(item.daysToExpiry)}</span>
                  </div>
                  <div className="risk-list-item__meta">
                    <span>{item.quantity} units</span>
                    <span className="risk-chip risk-chip--red">{item.atRiskUnits} at risk</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="risk-panel">
          <div className="risk-panel__header">
            <div className="risk-panel__title">
              <PackageSearch size={18} />
              <h3>Dead Stock</h3>
            </div>
            <span className="risk-panel__count">{deadStockCount}</span>
          </div>
          <div className="risk-list">
            {deadStock.length === 0 ? (
              <div className="risk-empty">No dead stock flags at the current threshold.</div>
            ) : (
              deadStock.slice(0, 3).map((item) => (
                <div key={item.medicineId} className="risk-list-item">
                  <div className="risk-list-item__copy">
                    <strong>{item.name}</strong>
                    <span>{item.salesInWindow} sold in the last {item.deadStockWindowDays} days</span>
                  </div>
                  <div className="risk-list-item__meta">
                    <span>{item.currentStock} units</span>
                    <span className="risk-chip risk-chip--slate">Low velocity</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="risk-panel">
          <div className="risk-panel__header">
            <div className="risk-panel__title">
              <CalendarDays size={18} />
              <h3>Product Seasonality</h3>
            </div>
            <span className="risk-panel__count">{seasonalitySignalCount}</span>
          </div>
          <div className="risk-list">
            {seasonalProducts.length === 0 ? (
              <div className="risk-empty">No product seasonality signals yet.</div>
            ) : (
              seasonalProducts.slice(0, 3).map((item) => (
                <div key={item.medicineId} className="risk-list-item">
                  <div className="risk-list-item__copy">
                    <strong>{item.name}</strong>
                    <span>{item.seasonality?.description || "Seasonal signal unavailable"}</span>
                  </div>
                  <div className="risk-list-item__meta">
                    <span>Peak {item.seasonality?.peakWeekday?.label || "N/A"}</span>
                    <span className="risk-chip risk-chip--blue">
                      {formatDecimal(item.seasonality?.strength || 0)}x spread
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
