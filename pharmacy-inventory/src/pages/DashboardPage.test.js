import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import DashboardPage from "./DashboardPage";
import { DataContext } from "../context/DataContext";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

jest.mock("recharts", () => {
  const Mock = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock,
    BarChart: Mock,
    Bar: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    Legend: Mock,
    LineChart: Mock,
    Line: Mock,
  };
});

function buildDashboardContext() {
  const reorderItems = Array.from({ length: 6 }, (_, index) => ({
    medicineId: index + 1,
    name: `Reorder Med ${index + 1}`,
    currentStock: index + 2,
    reorderPoint: 15,
    suggestedReorderQuantity: 25 + index,
  }));

  const predictions = Array.from({ length: 6 }, (_, index) => ({
    medicineId: index + 10,
    name: `Forecast Med ${index + 1}`,
    sales: {
      last30Days: 40,
      avgDailySales7: 3.5 + index,
      avgDailySales30: 2.2 + index,
      trendDirection: "up",
      trendPercent: 12.5,
    },
    forecast: {
      forecastDemand: 30 + index * 5,
      seasonalityAdjustedForecastDemand: 35 + index * 5,
    },
    seasonality: {
      patternType: "high",
      strength: 1.8 + index * 0.1,
      description: `Peaks on Fridays for Forecast Med ${index + 1}`,
      peakWeekday: { label: "Friday", demandIndex: 1.6 },
      peakMonth: { label: "July" },
    },
  }));

  const stockoutRisk = Array.from({ length: 4 }, (_, index) => ({
    medicineId: index + 30,
    name: `Stockout Med ${index + 1}`,
    currentStock: 4,
    daysUntilStockout: 2 + index,
    leadTimeDays: 5,
  }));

  const expiryRisk = Array.from({ length: 4 }, (_, index) => ({
    batchId: index + 40,
    medicineId: index + 40,
    name: `Expiring Med ${index + 1}`,
    batchNumber: `BATCH-EXP-${index + 1}`,
    daysToExpiry: 10 + index,
    quantity: 12,
    atRiskUnits: 6,
  }));

  const deadStock = Array.from({ length: 4 }, (_, index) => ({
    medicineId: index + 50,
    name: `Dead Stock Med ${index + 1}`,
    currentStock: 20,
    salesInWindow: 0,
    deadStockWindowDays: 90,
  }));

  return {
    inventory: [],
    sales: [],
    expenses: [],
    reorderInsights: { items: reorderItems, summary: {}, parameters: {} },
    predictiveAnalytics: {
      predictions,
      summary: {
        stockoutRiskCount: stockoutRisk.length,
        deadStockCount: deadStock.length,
        expiryRiskProductCount: expiryRisk.length,
        productsWithSeasonalitySignals: predictions.length,
      },
      parameters: { forecastDays: 14 },
    },
    riskInsights: {
      stockoutRisk,
      expiryRisk,
      deadStock,
      summary: {},
      parameters: {},
    },
  };
}

describe("DashboardPage clickable analytics and risk components", () => {
  test("every requested component opens its full items list modal with search and Inventory Control link", () => {
    render(
      <DataContext.Provider value={buildDashboardContext()}>
        <DashboardPage />
      </DataContext.Provider>
    );

    const cases = [
      {
        cardLabel: /Reorder Suggestions/i,
        modalTitle: "Reorder Suggestions",
        overflowItem: "Reorder Med 6",
        expectedHref: "/inventory?riskStatus=reorder-suggestions",
      },
      {
        cardLabel: /Demand Forecast/i,
        modalTitle: "Demand Forecast",
        overflowItem: "Forecast Med 1",
        expectedHref: "/inventory?riskStatus=demand-forecast",
      },
      {
        cardLabel: /Seasonal Trends/i,
        modalTitle: "Seasonal Trends",
        overflowItem: "Forecast Med 1",
        expectedHref: "/inventory?riskStatus=seasonal-trends",
      },
      {
        cardLabel: /Stockout Risk.*Open full items list/i,
        modalTitle: "Stockout Risk",
        overflowItem: "Stockout Med 4",
        expectedHref: "/inventory?riskStatus=stockout-risk",
      },
      {
        cardLabel: /Expiring Soon.*Open full items list/i,
        modalTitle: "Expiring Soon",
        overflowItem: "Expiring Med 4",
        expectedHref: "/inventory?expiryStatus=near-expiry",
      },
      {
        cardLabel: /Dead Stock.*Open full items list/i,
        modalTitle: "Dead Stock",
        overflowItem: "Dead Stock Med 4",
        expectedHref: "/inventory?riskStatus=dead-stock",
      },
      {
        cardLabel: /Product Seasonality.*Open full items list/i,
        modalTitle: "Product Seasonality",
        overflowItem: "Forecast Med 1",
        expectedHref: "/inventory?riskStatus=product-seasonality",
      },
    ];

    for (const testCase of cases) {
      fireEvent.click(screen.getByRole("button", { name: testCase.cardLabel }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("heading", { name: testCase.modalTitle })).toBeInTheDocument();
      expect(within(dialog).getByText(testCase.overflowItem)).toBeInTheDocument();
      expect(
        within(dialog).getByRole("link", { name: /Open in Inventory Control/i })
      ).toHaveAttribute("href", testCase.expectedHref);

      // Search inside the modal filters items
      const searchInput = within(dialog).getByRole("searchbox");
      fireEvent.change(searchInput, { target: { value: testCase.overflowItem } });
      expect(within(dialog).getByText(testCase.overflowItem)).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole("button", { name: `Close ${testCase.modalTitle} list` }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  });

  test("supports opening via keyboard Enter and closing with Escape", () => {
    render(
      <DataContext.Provider value={buildDashboardContext()}>
        <DashboardPage />
      </DataContext.Provider>
    );

    const card = screen.getByRole("button", { name: /Reorder Suggestions/i });
    fireEvent.keyDown(card, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
