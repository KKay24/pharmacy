import React, { useState, useContext, useMemo } from 'react';
import { 
    XAxis, YAxis, 
    Tooltip, 
    ResponsiveContainer,
    AreaChart, Area,
    PieChart, Pie, Cell,
    CartesianGrid
} from 'recharts';
import { 
    TrendingDown, 
    DollarSign, 
    Download,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    Activity,
    Table,
    Calendar,
    Check,
    FileSpreadsheet
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DataContext } from '../context/DataContext';
import "../styles/reports-modern.css";

const COLORS = ['#039d83', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const SHORTAGE_STORAGE_KEY = 'mediquick_daily_shortages';

function formatDateMMDDYYYY(dateObj) {
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${month}/${day}/${year}`;
}

function formatKwacha(amount) {
  const num = Number(amount || 0);
  return `k${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportsPage() {
  const { sales = [], expenses = [] } = useContext(DataContext);
  
  // Tabs: 'ledger' (spreadsheet view) vs 'analytics' (BI charts)
  const [activeTab, setActiveTab] = useState('ledger');
  const [ledgerView, setLedgerView] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [period, setPeriod] = useState('30d');
  
  // Daily Shortages state (persisted in localStorage)
  const [shortages, setShortages] = useState(() => {
    try {
      const saved = localStorage.getItem(SHORTAGE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Shortage edit modal
  const [editingShortageDate, setEditingShortageDate] = useState(null);
  const [shortageInputVal, setShortageInputVal] = useState('');

  const saveShortage = (dateKey, amount) => {
    const updated = { ...shortages, [dateKey]: Number(amount || 0) };
    setShortages(updated);
    try {
      localStorage.setItem(SHORTAGE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Could not save shortage', e);
    }
    setEditingShortageDate(null);
    toast.success(`Shortage updated for ${dateKey}`);
  };

  // --- 1. AGGREGATE SALES INTO DAILY LEDGER ROWS ---
  const dailyLedgerData = useMemo(() => {
    const map = {};

    sales.forEach(sale => {
      if (!sale.date && !sale.createdAt) return;
      const rawDate = sale.date || sale.createdAt;
      const dateObj = new Date(rawDate);
      if (isNaN(dateObj.getTime())) return;

      const dateKey = formatDateMMDDYYYY(dateObj);
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const amount = Number(sale.totalPrice || 0);
      const method = String(sale.paymentMethod || 'cash').toLowerCase();

      if (!map[dateKey]) {
        map[dateKey] = {
          dateKey,
          dateObj,
          monthKey,
          cash: 0,
          airtel: 0,
          mtn: 0,
          card: 0,
          other: 0,
          count: 0
        };
      }

      map[dateKey].count += 1;
      if (method.includes('airtel')) {
        map[dateKey].airtel += amount;
      } else if (method.includes('mtn')) {
        map[dateKey].mtn += amount;
      } else if (method.includes('card')) {
        map[dateKey].card += amount;
      } else {
        map[dateKey].cash += amount;
      }
    });

    // Sort by date ascending (chronological)
    const sorted = Object.values(map).sort((a, b) => a.dateObj - b.dateObj);
    return sorted;
  }, [sales]);

  // Available months list for dropdown
  const availableMonths = useMemo(() => {
    const set = new Set();
    dailyLedgerData.forEach(item => set.add(item.monthKey));
    return Array.from(set).sort().reverse();
  }, [dailyLedgerData]);

  // Filtered rows based on selected month
  const filteredDailyRows = useMemo(() => {
    if (selectedMonth === 'all') return dailyLedgerData;
    return dailyLedgerData.filter(item => item.monthKey === selectedMonth);
  }, [dailyLedgerData, selectedMonth]);

  // Compute daily rows with 7-day Weekly Subtotal rows (matching Table8)
  const rowsWithWeeklySubtotals = useMemo(() => {
    const result = [];
    let currentWeekCash = 0;
    let currentWeekAirtel = 0;
    let currentWeekMtn = 0;
    let currentWeekShortage = 0;
    let currentWeekTotal = 0;
    let daysInWeek = 0;
    let weekIndex = 1;

    filteredDailyRows.forEach((row, idx) => {
      const shortage = Number(shortages[row.dateKey] || 0);
      const totalSales = (row.cash + row.airtel + row.mtn + row.card) - shortage;

      result.push({
        type: 'day',
        dateKey: row.dateKey,
        cash: row.cash,
        airtel: row.airtel,
        mtn: row.mtn,
        shortage: shortage,
        totalSales: totalSales,
      });

      currentWeekCash += row.cash;
      currentWeekAirtel += row.airtel;
      currentWeekMtn += row.mtn;
      currentWeekShortage += shortage;
      currentWeekTotal += totalSales;
      daysInWeek += 1;

      // Every 7 days or at the very end of list, add weekly subtotal row
      const isSeventhDay = daysInWeek === 7;
      const isLastRow = idx === filteredDailyRows.length - 1;

      if (isSeventhDay || isLastRow) {
        result.push({
          type: 'weekly_subtotal',
          weekLabel: `Week ${weekIndex} Total (${daysInWeek} Days)`,
          cash: currentWeekCash,
          airtel: currentWeekAirtel,
          mtn: currentWeekMtn,
          shortage: currentWeekShortage,
          totalSales: currentWeekTotal,
        });

        currentWeekCash = 0;
        currentWeekAirtel = 0;
        currentWeekMtn = 0;
        currentWeekShortage = 0;
        currentWeekTotal = 0;
        daysInWeek = 0;
        weekIndex += 1;
      }
    });

    return result;
  }, [filteredDailyRows, shortages]);

  // Weekly Aggregates View
  const weeklyAggregates = useMemo(() => {
    const list = [];
    let weekCash = 0, weekAirtel = 0, weekMtn = 0, weekShortage = 0, weekTotal = 0;
    let days = 0, wNum = 1, startDay = '', endDay = '';

    filteredDailyRows.forEach((row, idx) => {
      if (days === 0) startDay = row.dateKey;
      endDay = row.dateKey;

      const shortage = Number(shortages[row.dateKey] || 0);
      const total = (row.cash + row.airtel + row.mtn + row.card) - shortage;

      weekCash += row.cash;
      weekAirtel += row.airtel;
      weekMtn += row.mtn;
      weekShortage += shortage;
      weekTotal += total;
      days += 1;

      if (days === 7 || idx === filteredDailyRows.length - 1) {
        list.push({
          label: `Week ${wNum} (${startDay} - ${endDay})`,
          cash: weekCash,
          airtel: weekAirtel,
          mtn: weekMtn,
          shortage: weekShortage,
          totalSales: weekTotal,
          daysCount: days
        });
        weekCash = 0; weekAirtel = 0; weekMtn = 0; weekShortage = 0; weekTotal = 0;
        days = 0; wNum += 1;
      }
    });

    return list;
  }, [filteredDailyRows, shortages]);

  // Monthly Aggregates View
  const monthlyAggregates = useMemo(() => {
    const map = {};
    dailyLedgerData.forEach(row => {
      const shortage = Number(shortages[row.dateKey] || 0);
      const total = (row.cash + row.airtel + row.mtn + row.card) - shortage;

      if (!map[row.monthKey]) {
        map[row.monthKey] = {
          monthKey: row.monthKey,
          label: row.dateObj.toLocaleString('default', { month: 'long', year: 'numeric' }),
          cash: 0,
          airtel: 0,
          mtn: 0,
          shortage: 0,
          totalSales: 0,
          daysCount: 0
        };
      }
      map[row.monthKey].cash += row.cash;
      map[row.monthKey].airtel += row.airtel;
      map[row.monthKey].mtn += row.mtn;
      map[row.monthKey].shortage += shortage;
      map[row.monthKey].totalSales += total;
      map[row.monthKey].daysCount += 1;
    });

    return Object.values(map);
  }, [dailyLedgerData, shortages]);

  // Grand Totals for current selection
  const grandTotals = useMemo(() => {
    let cash = 0, airtel = 0, mtn = 0, shortage = 0, totalSales = 0;
    filteredDailyRows.forEach(row => {
      const sh = Number(shortages[row.dateKey] || 0);
      const tot = (row.cash + row.airtel + row.mtn + row.card) - sh;
      cash += row.cash;
      airtel += row.airtel;
      mtn += row.mtn;
      shortage += sh;
      totalSales += tot;
    });
    return { cash, airtel, mtn, shortage, totalSales };
  }, [filteredDailyRows, shortages]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredDailyRows.length === 0) {
      toast.error("No sales records to export");
      return;
    }

    const headers = ["Date", "Cash", "Airtel", "MTN", "Shortage", "Total Sales"];
    const lines = [headers.join(",")];

    rowsWithWeeklySubtotals.forEach(row => {
      if (row.type === 'day') {
        lines.push([
          `"${row.dateKey}"`,
          row.cash.toFixed(2),
          row.airtel.toFixed(2),
          row.mtn.toFixed(2),
          row.shortage.toFixed(2),
          row.totalSales.toFixed(2)
        ].join(","));
      } else if (row.type === 'weekly_subtotal') {
        lines.push([
          `"--- ${row.weekLabel} ---"`,
          row.cash.toFixed(2),
          row.airtel.toFixed(2),
          row.mtn.toFixed(2),
          row.shortage.toFixed(2),
          row.totalSales.toFixed(2)
        ].join(","));
      }
    });

    // Add Grand Total
    lines.push([
      `"GRAND TOTAL"`,
      grandTotals.cash.toFixed(2),
      grandTotals.airtel.toFixed(2),
      grandTotals.mtn.toFixed(2),
      grandTotals.shortage.toFixed(2),
      grandTotals.totalSales.toFixed(2)
    ].join(","));

    const csvContent = "data:text/csv;charset=utf-8," + lines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MediQuick_Sales_Ledger_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Sales ledger exported successfully!");
  };

  // --- 2. ANALYTICS TAB CALCULATIONS ---
  const metrics = useMemo(() => {
    const now = new Date();
    const filterDate = new Date();
    if (period === '7d') filterDate.setDate(now.getDate() - 7);
    else if (period === '30d') filterDate.setDate(now.getDate() - 30);
    else filterDate.setFullYear(now.getFullYear() - 1);

    const filteredSales = sales.filter(s => new Date(s.date) >= filterDate);
    const filteredExpenses = expenses.filter(e => new Date(e.date) >= filterDate);

    const revenue = filteredSales.reduce((acc, s) => acc + (s.totalPrice || 0), 0);
    const cogs = filteredSales.reduce((acc, s) => acc + (s.totalCost || 0), 0);
    const opExpenses = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const netProfit = revenue - cogs - opExpenses;
    const margin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;

    return { revenue, opExpenses, netProfit, margin, salesCount: filteredSales.length };
  }, [sales, expenses, period]);

  const timelineData = useMemo(() => {
    const dataMap = {};
    const now = new Date();
    let daysToTrack = 7;
    if (period === '30d') daysToTrack = 30;
    else if (period === '1y') daysToTrack = 12;

    for (let i = daysToTrack - 1; i >= 0; i--) {
       if (period === '1y') {
           const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
           dataMap[d.toLocaleString('default', { month: 'short' })] = { revenue: 0, expense: 0 };
       } else {
           const d = new Date(now);
           d.setDate(d.getDate() - i);
           dataMap[d.toLocaleDateString('default', { month: 'short', day: 'numeric' })] = { revenue: 0, expense: 0 };
       }
    }

    sales.forEach(s => {
        const d = new Date(s.date);
        let key = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        if (period === '1y') key = d.toLocaleString('default', { month: 'short' });
        if (dataMap[key]) dataMap[key].revenue += (s.totalPrice || 0);
    });

    expenses.forEach(e => {
        const d = new Date(e.date);
        let key = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        if (period === '1y') key = d.toLocaleString('default', { month: 'short' });
        if (dataMap[key]) dataMap[key].expense += (e.amount || 0);
    });

    return Object.keys(dataMap).map(key => ({
        name: key,
        revenue: dataMap[key].revenue,
        expense: dataMap[key].expense
    }));
  }, [sales, expenses, period]);

  const categoryData = useMemo(() => {
    const counts = {};
    sales.forEach(s => {
        const cat = s.category || 'General';
        counts[cat] = (counts[cat] || 0) + (s.totalPrice || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [sales]);

  return (
    <div className="ri-container">
      {/* Top Level Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="ri-tab-bar">
          <button 
            type="button" 
            className={`ri-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            <Table size={16} /> Sales Ledger (Daily / Weekly / Monthly)
          </button>
          <button 
            type="button" 
            className={`ri-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={16} /> Visual Analytics &amp; KPIs
          </button>
        </div>

        {activeTab === 'ledger' && (
          <button 
            type="button"
            className="ri-export-btn"
            onClick={handleExportCSV}
          >
            <Download size={16} /> Export CSV / Excel
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: SPREADSHEET SALES LEDGER (Table8 style)                 */}
      {/* ============================================================== */}
      {activeTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Top Quick Metric Cards */}
          <div className="ri-stats-grid">
            <div className="ri-stat-card">
              <span className="ri-stat-label">💵 Total Cash</span>
              <span className="ri-stat-value">{formatKwacha(grandTotals.cash)}</span>
              <span className="ri-stat-sub">Physical cash payments</span>
            </div>
            <div className="ri-stat-card">
              <span className="ri-stat-label" style={{ color: '#dc2626' }}>📱 Airtel Money</span>
              <span className="ri-stat-value">{formatKwacha(grandTotals.airtel)}</span>
              <span className="ri-stat-sub">Airtel mobile payments</span>
            </div>
            <div className="ri-stat-card">
              <span className="ri-stat-label" style={{ color: '#ca8a04' }}>📱 MTN MoMo</span>
              <span className="ri-stat-value">{formatKwacha(grandTotals.mtn)}</span>
              <span className="ri-stat-sub">MTN mobile payments</span>
            </div>
            <div className="ri-stat-card">
              <span className="ri-stat-label" style={{ color: '#16a34a' }}>💰 Net Total Sales</span>
              <span className="ri-stat-value" style={{ color: '#15803d' }}>{formatKwacha(grandTotals.totalSales)}</span>
              {grandTotals.shortage > 0 && (
                <span className="ri-stat-sub" style={{ color: '#dc2626' }}>
                  Total Shortage: -{formatKwacha(grandTotals.shortage)}
                </span>
              )}
            </div>
          </div>

          {/* Main Ledger Table Card */}
          <div className="ri-ledger-card">
            {/* Toolbar */}
            <div className="ri-ledger-toolbar">
              <div className="ri-ledger-toolbar-left">
                <span className="ri-ledger-title">
                  <FileSpreadsheet size={20} color="#166534" />
                  Sales Ledger
                </span>

                {/* View Mode Toggle: Daily vs Weekly vs Monthly */}
                <div className="ri-period-selector">
                  <button 
                    type="button"
                    className={`ri-period-btn ${ledgerView === 'daily' ? 'active' : ''}`}
                    onClick={() => setLedgerView('daily')}
                  >
                    Daily (with Weekly Subtotals)
                  </button>
                  <button 
                    type="button"
                    className={`ri-period-btn ${ledgerView === 'weekly' ? 'active' : ''}`}
                    onClick={() => setLedgerView('weekly')}
                  >
                    Weekly Summary
                  </button>
                  <button 
                    type="button"
                    className={`ri-period-btn ${ledgerView === 'monthly' ? 'active' : ''}`}
                    onClick={() => setLedgerView('monthly')}
                  >
                    Monthly Summary
                  </button>
                </div>
              </div>

              {/* Month Selector */}
              {ledgerView !== 'monthly' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={16} color="#64748b" />
                  <select 
                    className="ri-select-input"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    <option value="all">All Dates &amp; Months</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>
                        {new Date(`${m}-01`).toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* TABLE CONTAINER */}
            <div className="ri-ledger-table-wrap">
              <table className="ri-ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Cash</th>
                    <th>Airtel</th>
                    <th>MTN</th>
                    <th>Shortage</th>
                    <th>Total Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {/* VIEW 1: DAILY ROWS WITH HIGHLIGHTED RED WEEKLY TOTALS */}
                  {ledgerView === 'daily' && rowsWithWeeklySubtotals.length > 0 && rowsWithWeeklySubtotals.map((row, idx) => {
                    if (row.type === 'weekly_subtotal') {
                      return (
                        <tr key={`week-sub-${idx}`} className="ri-ledger-subtotal-row">
                          <td style={{ textAlign: 'left' }}>{row.weekLabel}</td>
                          <td>{formatKwacha(row.cash)}</td>
                          <td>{formatKwacha(row.airtel)}</td>
                          <td>{formatKwacha(row.mtn)}</td>
                          <td>{formatKwacha(row.shortage)}</td>
                          <td style={{ fontSize: '1.05rem' }}>{formatKwacha(row.totalSales)}</td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={row.dateKey} className="ri-ledger-row">
                        <td>{row.dateKey}</td>
                        <td>{formatKwacha(row.cash)}</td>
                        <td>{formatKwacha(row.airtel)}</td>
                        <td>{formatKwacha(row.mtn)}</td>
                        <td>
                          <button 
                            type="button"
                            className={`ri-shortage-btn ${row.shortage > 0 ? 'ri-shortage-has-value' : ''}`}
                            onClick={() => {
                              setEditingShortageDate(row.dateKey);
                              setShortageInputVal(row.shortage || '');
                            }}
                            title="Click to record shortage for this date"
                          >
                            {formatKwacha(row.shortage)}
                          </button>
                        </td>
                        <td style={{ fontWeight: 700 }}>{formatKwacha(row.totalSales)}</td>
                      </tr>
                    );
                  })}

                  {/* VIEW 2: WEEKLY SUMMARY */}
                  {ledgerView === 'weekly' && weeklyAggregates.map((w, idx) => (
                    <tr key={`w-${idx}`} className="ri-ledger-row">
                      <td style={{ fontWeight: 700 }}>{w.label}</td>
                      <td>{formatKwacha(w.cash)}</td>
                      <td>{formatKwacha(w.airtel)}</td>
                      <td>{formatKwacha(w.mtn)}</td>
                      <td>{formatKwacha(w.shortage)}</td>
                      <td style={{ fontWeight: 800, color: '#15803d' }}>{formatKwacha(w.totalSales)}</td>
                    </tr>
                  ))}

                  {/* VIEW 3: MONTHLY SUMMARY */}
                  {ledgerView === 'monthly' && monthlyAggregates.map((m, idx) => (
                    <tr key={`m-${idx}`} className="ri-ledger-row">
                      <td style={{ fontWeight: 700 }}>{m.label} ({m.daysCount} active days)</td>
                      <td>{formatKwacha(m.cash)}</td>
                      <td>{formatKwacha(m.airtel)}</td>
                      <td>{formatKwacha(m.mtn)}</td>
                      <td>{formatKwacha(m.shortage)}</td>
                      <td style={{ fontWeight: 800, color: '#15803d' }}>{formatKwacha(m.totalSales)}</td>
                    </tr>
                  ))}

                  {/* Empty State */}
                  {filteredDailyRows.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No sales transactions recorded yet for this period. 
                        Make sales in the POS page to populate your daily ledger automatically!
                      </td>
                    </tr>
                  )}

                  {/* GRAND TOTAL ROW */}
                  {filteredDailyRows.length > 0 && (
                    <tr className="ri-ledger-grand-row">
                      <td style={{ textAlign: 'left' }}>GRAND TOTAL</td>
                      <td>{formatKwacha(grandTotals.cash)}</td>
                      <td>{formatKwacha(grandTotals.airtel)}</td>
                      <td>{formatKwacha(grandTotals.mtn)}</td>
                      <td>{formatKwacha(grandTotals.shortage)}</td>
                      <td>{formatKwacha(grandTotals.totalSales)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: VISUAL ANALYTICS & CHARTS                               */}
      {/* ============================================================== */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header & Options */}
          <div className="ri-options-bar">
            <span style={{ fontWeight: 700, color: '#334155' }}>Analytics Time Window:</span>
            <div className="ri-period-selector">
               {['7d', '30d', '1y'].map(p => (
                   <button 
                      key={p} 
                      type="button"
                      className={`ri-period-btn ${period === p ? 'active' : ''}`}
                      onClick={() => setPeriod(p)}
                   >
                      {p.toUpperCase()}
                   </button>
               ))}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="ri-stats-grid">
            <div className="ri-stat-card">
              <span className="ri-stat-label"><DollarSign size={14} /> Gross Revenue</span>
              <span className="ri-stat-value">K{metrics.revenue.toLocaleString()}</span>
              <span className="ri-stat-sub trend-up"><ArrowUpRight size={14} /> +12.5% vs last period</span>
            </div>
            <div className="ri-stat-card">
              <span className="ri-stat-label"><TrendingDown size={14} /> Total Expenses</span>
              <span className="ri-stat-value">K{metrics.opExpenses.toLocaleString()}</span>
              <span className="ri-stat-sub trend-down"><ArrowDownRight size={14} /> -3.2% vs last period</span>
            </div>
            <div className="ri-stat-card">
              <span className="ri-stat-label"><BarChart3 size={14} /> Net Profit</span>
              <span className="ri-stat-value" style={{color:'#10b981'}}>K{metrics.netProfit.toLocaleString()}</span>
              <span className="ri-stat-sub trend-up"><ArrowUpRight size={14} /> +8.1% vs last period</span>
            </div>
            <div className="ri-stat-card">
              <span className="ri-stat-label"><Activity size={14} /> Gross Margin</span>
              <span className="ri-stat-value">{metrics.margin.toFixed(1)}%</span>
              <span className="ri-stat-sub" style={{color:'#64748b'}}>Global Avg: 24.5%</span>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'1.5rem'}}>
            <div className="ri-chart-card">
              <div className="ri-chart-header">
                <h3 className="ri-chart-title">Revenue vs. Operational Expense</h3>
                <span style={{fontSize:'0.75rem', color:'#64748b', fontWeight:600}}>LAST 30 DAYS</span>
              </div>
              <div style={{height:'320px'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#039d83" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#039d83" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                        contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#039d83" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                    <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={0} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ri-chart-card">
              <div className="ri-chart-header">
                <h3 className="ri-chart-title">Revenue by Category</h3>
              </div>
              <div style={{height:'240px'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{marginTop:'1.5rem', display:'flex', flexDirection:'column', gap:'0.75rem'}}>
                 {categoryData.slice(0, 4).map((cat, idx) => (
                     <div key={idx} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                            <div style={{width:8, height:8, borderRadius:'50%', background:COLORS[idx % COLORS.length]}}></div>
                            <span style={{fontSize:'0.85rem', fontWeight:600, color:'#475569'}}>{cat.name}</span>
                        </div>
                        <span style={{fontSize:'0.85rem', fontWeight:700}}>K{cat.value.toLocaleString()}</span>
                     </div>
                 ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SHORTAGE MODAL */}
      {editingShortageDate && (
        <div className="ri-modal-overlay" onClick={() => setEditingShortageDate(null)}>
          <div className="ri-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="ri-modal-title">Record Daily Shortage</h3>
            <p className="ri-modal-subtitle">
              Enter cash or drawer discrepancy for <strong>{editingShortageDate}</strong>
            </p>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Shortage Amount (Kwacha):
              <input 
                type="number"
                step="0.01"
                min="0"
                autoFocus
                placeholder="e.g. 32.00"
                className="ri-select-input"
                style={{ width: '100%', fontSize: '1rem', padding: '0.65rem' }}
                value={shortageInputVal}
                onChange={(e) => setShortageInputVal(e.target.value)}
              />
            </label>

            <div className="ri-modal-actions">
              <button 
                type="button"
                className="ri-period-btn" 
                onClick={() => setEditingShortageDate(null)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="ri-export-btn"
                onClick={() => saveShortage(editingShortageDate, shortageInputVal)}
              >
                <Check size={16} /> Save Shortage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
