import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  ChevronRight,
  Clock3,
  ExternalLink,
  Package,
  PackageSearch,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
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
    userRole,
    predictiveAnalytics = EMPTY_PREDICTIVE_ANALYTICS,
    reorderInsights = EMPTY_REORDER_INSIGHTS,
    riskInsights = EMPTY_RISK_INSIGHTS,
  } = useContext(DataContext);
  const isAdmin = userRole === "admin";
  const LOW_STOCK_THRESHOLD = 10;
  const [inventoryBreakdownLevel, setInventoryBreakdownLevel] = useState("main");
  const [activeListKey, setActiveListKey] = useState(null);
  const [modalSearch, setModalSearch] = useState("");
  const predictions = predictiveAnalytics.predictions || [];
  const predictiveSummary = predictiveAnalytics.summary || {};
  const reorderSuggestions = reorderInsights.items || [];
  const stockoutRisk = riskInsights.stockoutRisk || [];
  const expiryRisk = riskInsights.expiryRisk || [];
  const deadStock = riskInsights.deadStock || [];
  const forecastDays = predictiveAnalytics.parameters?.forecastDays || 14;

  useEffect(() => {
    if (!activeListKey) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveListKey(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeListKey]);

  const openItemsList = (key) => {
    setModalSearch("");
    setActiveListKey(key);
  };

  const handleCardKeyDown = (event, key) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openItemsList(key);
    }
  };

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

  const expiredProductCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inventory.filter((item) =>
      (item.Batches || []).some((batch) => {
        const expiryDate = batch.expiryDate ? new Date(batch.expiryDate) : null;
        return Number(batch.quantity || 0) > 0 && expiryDate && expiryDate < today;
      })
    ).length;
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
  const allForecastProducts = [...predictions]
    .filter((item) => Number(item.forecast?.forecastDemand || 0) > 0)
    .sort(
      (left, right) =>
        Number(right.forecast?.seasonalityAdjustedForecastDemand || right.forecast?.forecastDemand || 0) -
        Number(left.forecast?.seasonalityAdjustedForecastDemand || left.forecast?.forecastDemand || 0)
    );
  const topForecastProducts = allForecastProducts.slice(0, 5);
  const allSeasonalProducts = predictions
    .filter((item) => item.sales?.last30Days > 0 && item.seasonality?.patternType !== "insufficient-data")
    .sort((left, right) => Number(right.seasonality?.strength || 0) - Number(left.seasonality?.strength || 0));
  const seasonalProducts = allSeasonalProducts.slice(0, 5);

  const listModalConfigs = {
    "reorder-suggestions": {
      title: "Reorder Suggestions",
      subtitle: "Products currently at or below their dynamic reorder point.",
      inventoryLink: "/inventory?riskStatus=reorder-suggestions",
      emptyMessage: "No dynamic reorder suggestions right now.",
      items: reorderSuggestions,
      matchesQuery: (item, q) => String(item.name || "").toLowerCase().includes(q),
    },
    "demand-forecast": {
      title: "Demand Forecast",
      subtitle: `Projected unit demand across the next ${forecastDays} days based on recent sales velocity and seasonality.`,
      inventoryLink: "/inventory?riskStatus=demand-forecast",
      emptyMessage: "Forecasts will appear once products have recent sales history.",
      items: allForecastProducts,
      matchesQuery: (item, q) => String(item.name || "").toLowerCase().includes(q),
    },
    "seasonal-trends": {
      title: "Seasonal Trends",
      subtitle: "Products with measurable day-of-week or monthly demand patterns.",
      inventoryLink: "/inventory?riskStatus=seasonal-trends",
      emptyMessage: "Seasonal trends will appear as more product history builds up.",
      items: allSeasonalProducts,
      matchesQuery: (item, q) =>
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.seasonality?.peakWeekday?.label || "").toLowerCase().includes(q) ||
        String(item.seasonality?.peakMonth?.label || "").toLowerCase().includes(q),
    },
    "stockout-risk": {
      title: "Stockout Risk",
      subtitle: "Items projected to deplete before supplier replenishment arrives.",
      inventoryLink: "/inventory?riskStatus=stockout-risk",
      emptyMessage: "No immediate stockout risks.",
      items: stockoutRisk,
      matchesQuery: (item, q) => String(item.name || "").toLowerCase().includes(q),
    },
    "expiring-soon": {
      title: "Expiring Soon",
      subtitle: "Batches approaching expiry with units currently at risk.",
      inventoryLink: "/inventory?expiryStatus=near-expiry",
      emptyMessage: "No near-term expiry exposure found.",
      items: expiryRisk,
      matchesQuery: (item, q) =>
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.batchNumber || "").toLowerCase().includes(q),
    },
    "dead-stock": {
      title: "Dead Stock",
      subtitle: "Items in stock with little or no sales movement over the monitoring window.",
      inventoryLink: "/inventory?riskStatus=dead-stock",
      emptyMessage: "No dead stock flags at the current threshold.",
      items: deadStock,
      matchesQuery: (item, q) => String(item.name || "").toLowerCase().includes(q),
    },
    "product-seasonality": {
      title: "Product Seasonality",
      subtitle: "Products showing weekday or seasonal demand peaks and spread signals.",
      inventoryLink: "/inventory?riskStatus=product-seasonality",
      emptyMessage: "No product seasonality signals yet.",
      items: allSeasonalProducts,
      matchesQuery: (item, q) =>
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.seasonality?.description || "").toLowerCase().includes(q) ||
        String(item.seasonality?.peakWeekday?.label || "").toLowerCase().includes(q),
    },
  };

  const activeModal = activeListKey ? listModalConfigs[activeListKey] : null;
  const filteredModalItems = activeModal
    ? activeModal.items.filter((item) => {
        const q = modalSearch.trim().toLowerCase();
        return !q || activeModal.matchesQuery(item, q);
      })
    : [];

  const metricCards = [
    {
      title: "Total Products",
      value: totalProducts.toLocaleString(),
      accentClass: "",
      sparkColor: "#3b82f6",
      sparkValue: totalProducts,
      to: "/inventory",
    },
    ...(isAdmin
      ? [
          {
            title: "Stock Value",
            value: formatCurrency(stockValue),
            accentClass: "",
            sparkColor: "#10b981",
            sparkValue: stockValue,
            to: "/inventory",
          },
        ]
      : []),
    {
      title: "Low Stock Items",
      value: lowStockItems.length,
      accentClass: "color-blue",
      sparkColor: "#2563eb",
      sparkValue: lowStockItems.length,
      to: "/inventory?stockStatus=low",
    },
    {
      title: "Out of Stock",
      value: outOfStockItems.length,
      accentClass: "color-red",
      sparkColor: "#dc2626",
      sparkValue: outOfStockItems.length,
      to: "/inventory?stockStatus=out",
    },
    {
      title: "Stockout Risk",
      value: stockoutRiskCount,
      accentClass: "color-orange",
      sparkColor: "#f97316",
      sparkValue: stockoutRiskCount,
      to: "/inventory?riskStatus=stockout-risk",
    },
    {
      title: "Expiring Soon",
      value: expiringProductCount,
      accentClass: "color-red",
      sparkColor: "#ef4444",
      sparkValue: expiringProductCount,
      to: "/inventory?expiryStatus=near-expiry",
    },
    {
      title: "Expired Products",
      value: expiredProductCount,
      accentClass: "color-red",
      sparkColor: "#b91c1c",
      sparkValue: expiredProductCount,
      to: "/inventory?expiryStatus=expired",
    },
    {
      title: "Near-Expiry Units",
      value: expiryStockTotals.nearExpiryUnits.toLocaleString(),
      accentClass: "color-orange",
      sparkColor: "#f97316",
      sparkValue: expiryStockTotals.nearExpiryUnits,
      to: "/inventory?expiryStatus=near-expiry",
    },
    {
      title: "Dead Stock",
      value: deadStockCount,
      accentClass: "color-slate",
      sparkColor: "#475569",
      sparkValue: deadStockCount,
      to: "/inventory?riskStatus=dead-stock",
    },
  ];

  return (
    <div className="dashboard-grid">
      <div className="metrics-row">
        {metricCards.map((card) => (
          <Link
            key={card.title}
            to={card.to}
            className="metric-card"
            aria-label={`${card.title}: ${card.value}. Open Inventory Control.`}
          >
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
          </Link>
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
          <h3>{isAdmin ? "Inventory Classification & Value" : "Inventory Classification"}</h3>
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
                {isAdmin && <th>Stock Value</th>}
              </tr>
            </thead>
            <tbody>
              {inventoryBreakdown.length === 0 ? (
                <tr><td colSpan={isAdmin ? "4" : "3"} style={{ textAlign: "center", padding: "2rem" }}>No inventory is available for reporting.</td></tr>
              ) : inventoryBreakdown.map((row) => (
                <tr key={row.label}>
                  <td style={{ fontWeight: 600 }}>{row.label}</td>
                  <td>{row.products}</td>
                  <td>{row.units.toLocaleString()}</td>
                  {isAdmin && <td>{formatCurrency(row.stockValue)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lists-row">
        <div
          className="dash-card dash-card--clickable"
          role="button"
          tabIndex={0}
          aria-label={`Reorder Suggestions (${reorderSuggestions.length} active). Open full items list.`}
          onClick={() => openItemsList("reorder-suggestions")}
          onKeyDown={(event) => handleCardKeyDown(event, "reorder-suggestions")}
        >
          <div className="dash-card-header">
            <h3>Reorder Suggestions</h3>
            <span className="action-link dash-card-cta">
              {reorderSuggestions.length} active <ChevronRight size={15} aria-hidden="true" />
            </span>
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
                        <span className="reorder-btn">{item.suggestedReorderQuantity} units</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div
          className="dash-card dash-card--clickable"
          role="button"
          tabIndex={0}
          aria-label={`Demand Forecast (Next ${forecastDays} days). Open full items list.`}
          onClick={() => openItemsList("demand-forecast")}
          onKeyDown={(event) => handleCardKeyDown(event, "demand-forecast")}
        >
          <div className="dash-card-header">
            <h3>Demand Forecast</h3>
            <span className="action-link dash-card-cta">
              Next {forecastDays} days <ChevronRight size={15} aria-hidden="true" />
            </span>
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

        <div
          className="dash-card dash-card--clickable"
          role="button"
          tabIndex={0}
          aria-label={`Seasonal Trends (${seasonalitySignalCount} active signals). Open full items list.`}
          onClick={() => openItemsList("seasonal-trends")}
          onKeyDown={(event) => handleCardKeyDown(event, "seasonal-trends")}
        >
          <div className="dash-card-header">
            <h3>Seasonal Trends</h3>
            <span className="action-link dash-card-cta">
              {seasonalitySignalCount} active signals <ChevronRight size={15} aria-hidden="true" />
            </span>
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
        <div
          className="risk-panel risk-panel--clickable"
          role="button"
          tabIndex={0}
          aria-label={`Stockout Risk (${stockoutRiskCount} items). Open full items list.`}
          onClick={() => openItemsList("stockout-risk")}
          onKeyDown={(event) => handleCardKeyDown(event, "stockout-risk")}
        >
          <div className="risk-panel__header">
            <div className="risk-panel__title">
              <ShieldAlert size={18} />
              <h3>Stockout Risk</h3>
            </div>
            <div className="risk-panel__header-meta">
              <span className="risk-panel__count">{stockoutRiskCount}</span>
              <ChevronRight size={16} className="risk-panel__chevron" aria-hidden="true" />
            </div>
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

        <div
          className="risk-panel risk-panel--clickable"
          role="button"
          tabIndex={0}
          aria-label={`Expiring Soon (${expiringProductCount} items). Open full items list.`}
          onClick={() => openItemsList("expiring-soon")}
          onKeyDown={(event) => handleCardKeyDown(event, "expiring-soon")}
        >
          <div className="risk-panel__header">
            <div className="risk-panel__title">
              <Clock3 size={18} />
              <h3>Expiring Soon</h3>
            </div>
            <div className="risk-panel__header-meta">
              <span className="risk-panel__count">{expiringProductCount}</span>
              <ChevronRight size={16} className="risk-panel__chevron" aria-hidden="true" />
            </div>
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

        <div
          className="risk-panel risk-panel--clickable"
          role="button"
          tabIndex={0}
          aria-label={`Dead Stock (${deadStockCount} items). Open full items list.`}
          onClick={() => openItemsList("dead-stock")}
          onKeyDown={(event) => handleCardKeyDown(event, "dead-stock")}
        >
          <div className="risk-panel__header">
            <div className="risk-panel__title">
              <PackageSearch size={18} />
              <h3>Dead Stock</h3>
            </div>
            <div className="risk-panel__header-meta">
              <span className="risk-panel__count">{deadStockCount}</span>
              <ChevronRight size={16} className="risk-panel__chevron" aria-hidden="true" />
            </div>
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

        <div
          className="risk-panel risk-panel--clickable"
          role="button"
          tabIndex={0}
          aria-label={`Product Seasonality (${seasonalitySignalCount} signals). Open full items list.`}
          onClick={() => openItemsList("product-seasonality")}
          onKeyDown={(event) => handleCardKeyDown(event, "product-seasonality")}
        >
          <div className="risk-panel__header">
            <div className="risk-panel__title">
              <CalendarDays size={18} />
              <h3>Product Seasonality</h3>
            </div>
            <div className="risk-panel__header-meta">
              <span className="risk-panel__count">{seasonalitySignalCount}</span>
              <ChevronRight size={16} className="risk-panel__chevron" aria-hidden="true" />
            </div>
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

      {activeModal && (
        <div
          className="dash-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setActiveListKey(null);
          }}
        >
          <div
            className="dash-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-modal-title"
          >
            <div className="dash-modal__header">
              <div>
                <h2 id="dash-modal-title">{activeModal.title}</h2>
                <p>{activeModal.subtitle}</p>
              </div>
              <button
                type="button"
                className="dash-modal__close"
                aria-label={`Close ${activeModal.title} list`}
                onClick={() => setActiveListKey(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="dash-modal__toolbar">
              <label className="dash-modal__search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  placeholder={`Search ${activeModal.title.toLowerCase()}...`}
                  aria-label={`Search ${activeModal.title}`}
                  value={modalSearch}
                  onChange={(event) => setModalSearch(event.target.value)}
                />
              </label>
              <span className="dash-modal__count">
                {filteredModalItems.length} of {activeModal.items.length} item{activeModal.items.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="dash-modal__body">
              {filteredModalItems.length === 0 ? (
                <div className="dash-modal__empty">
                  {modalSearch.trim()
                    ? `No items matched "${modalSearch.trim()}".`
                    : activeModal.emptyMessage}
                </div>
              ) : (
                <table className="mini-table dash-modal__table">
                  {activeListKey === "reorder-suggestions" && (
                    <>
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Current Stock</th>
                          <th>Reorder Point</th>
                          <th>Suggested Qty</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalItems.map((item) => (
                          <tr key={item.medicineId}>
                            <td>
                              <Link
                                to={`/inventory?search=${encodeURIComponent(item.name || "")}`}
                                className="dash-modal__item-link"
                              >
                                {item.name}
                              </Link>
                            </td>
                            <td style={{ fontWeight: 700 }}>{item.currentStock}</td>
                            <td>{formatDecimal(item.reorderPoint)}</td>
                            <td>
                              <span className="reorder-btn">{item.suggestedReorderQuantity} units</span>
                            </td>
                            <td>
                              <Link to="/add-stock" className="dash-modal__action-link">
                                Restock
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {activeListKey === "demand-forecast" && (
                    <>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>7d Avg/Day</th>
                          <th>30d Avg/Day</th>
                          <th>Base Forecast</th>
                          <th>Adjusted Forecast &amp; Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalItems.map((item) => (
                          <tr key={item.medicineId}>
                            <td>
                              <Link
                                to={`/inventory?search=${encodeURIComponent(item.name || "")}`}
                                className="dash-modal__item-link"
                              >
                                {item.name}
                              </Link>
                            </td>
                            <td>{formatDecimal(item.sales?.avgDailySales7)}</td>
                            <td>{formatDecimal(item.sales?.avgDailySales30)}</td>
                            <td>{formatDecimal(item.forecast?.forecastDemand)}</td>
                            <td>
                              <div className="forecast-cell">
                                <strong>
                                  {formatDecimal(
                                    item.forecast?.seasonalityAdjustedForecastDemand || item.forecast?.forecastDemand
                                  )}
                                </strong>
                                <span className={`trend-chip ${item.sales?.trendDirection || "stable"}`}>
                                  {formatTrendLabel(item.sales?.trendDirection, item.sales?.trendPercent)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {activeListKey === "seasonal-trends" && (
                    <>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Peak Day</th>
                          <th>Peak Month</th>
                          <th>Pattern</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalItems.map((item) => (
                          <tr key={item.medicineId}>
                            <td>
                              <Link
                                to={`/inventory?search=${encodeURIComponent(item.name || "")}`}
                                className="dash-modal__item-link"
                              >
                                {item.name}
                              </Link>
                            </td>
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
                        ))}
                      </tbody>
                    </>
                  )}

                  {activeListKey === "stockout-risk" && (
                    <>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Current Stock</th>
                          <th>Days Until Depletion</th>
                          <th>Lead Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalItems.map((item) => (
                          <tr key={item.medicineId}>
                            <td>
                              <Link
                                to={`/inventory?search=${encodeURIComponent(item.name || "")}`}
                                className="dash-modal__item-link"
                              >
                                {item.name}
                              </Link>
                            </td>
                            <td style={{ fontWeight: 700 }}>{item.currentStock} units</td>
                            <td>{formatDaysLabel(item.daysUntilStockout)}</td>
                            <td>
                              <span className="risk-chip risk-chip--orange">Lead time {item.leadTimeDays}d</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {activeListKey === "expiring-soon" && (
                    <>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Batch</th>
                          <th>Time to Expiry</th>
                          <th>Batch Qty</th>
                          <th>At-Risk Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalItems.map((item) => (
                          <tr key={item.batchId || `${item.medicineId}-${item.batchNumber}`}>
                            <td>
                              <Link
                                to={`/inventory?search=${encodeURIComponent(item.name || "")}`}
                                className="dash-modal__item-link"
                              >
                                {item.name}
                              </Link>
                            </td>
                            <td>{item.batchNumber || "—"}</td>
                            <td>{formatDaysLabel(item.daysToExpiry)}</td>
                            <td>{item.quantity} units</td>
                            <td>
                              <span className="risk-chip risk-chip--red">{item.atRiskUnits} at risk</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {activeListKey === "dead-stock" && (
                    <>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Current Stock</th>
                          <th>Sales in Window</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalItems.map((item) => (
                          <tr key={item.medicineId}>
                            <td>
                              <Link
                                to={`/inventory?search=${encodeURIComponent(item.name || "")}`}
                                className="dash-modal__item-link"
                              >
                                {item.name}
                              </Link>
                            </td>
                            <td style={{ fontWeight: 700 }}>{item.currentStock} units</td>
                            <td>{item.salesInWindow} sold in {item.deadStockWindowDays} days</td>
                            <td>
                              <span className="risk-chip risk-chip--slate">Low velocity</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {activeListKey === "product-seasonality" && (
                    <>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Signal Summary</th>
                          <th>Peak Weekday</th>
                          <th>Spread</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalItems.map((item) => (
                          <tr key={item.medicineId}>
                            <td>
                              <Link
                                to={`/inventory?search=${encodeURIComponent(item.name || "")}`}
                                className="dash-modal__item-link"
                              >
                                {item.name}
                              </Link>
                            </td>
                            <td>{item.seasonality?.description || "Seasonal signal unavailable"}</td>
                            <td>{item.seasonality?.peakWeekday?.label || "N/A"}</td>
                            <td>
                              <span className="risk-chip risk-chip--blue">
                                {formatDecimal(item.seasonality?.strength || 0)}x spread
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              )}
            </div>

            <div className="dash-modal__footer">
              <Link to={activeModal.inventoryLink} className="dash-modal__inventory-btn">
                Open in Inventory Control <ExternalLink size={14} aria-hidden="true" />
              </Link>
              <button
                type="button"
                className="dash-modal__done-btn"
                onClick={() => setActiveListKey(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
