import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar, Download, RefreshCw, X } from 'lucide-react';
import { DataContext } from '../context/DataContext';
import { apiFetch, getApiErrorMessage } from '../utils/api';
import { addCalendarDays, isValidDateKey, lusakaDateKey } from '../utils/reportingPeriod';
import '../styles/profitLoss.css';

const money = (value) =>
  value === null || value === undefined
    ? 'Unavailable'
    : `K${Number(value).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EMPTY_PERIOD = {
  month: 'N/A',
  revenue: 0,
  cogs: 0,
  grossProfit: 0,
  operatingExpenses: 0,
  netProfit: 0,
  cashRefunds: 0,
  cogsKnown: true,
  unknownCogsSaleCount: 0,
};

function normalizeDayRow(data, selectedDate) {
  const dailyRow = data?.daily?.[0];
  if (dailyRow) {
    return { ...dailyRow, month: selectedDate, date: selectedDate };
  }
  const totals = data?.totals;
  if (!totals) {
    return { ...EMPTY_PERIOD, month: selectedDate, date: selectedDate };
  }
  const cogsKnown = totals.cogsKnown !== false;
  return {
    ...totals,
    month: selectedDate,
    date: selectedDate,
    revenue: totals.revenue ?? 0,
    cogs: cogsKnown ? (totals.cogs ?? 0) : null,
    grossProfit: cogsKnown ? (totals.grossProfit ?? 0) : null,
    operatingExpenses: totals.operatingExpenses ?? 0,
    netProfit: cogsKnown ? (totals.netProfit ?? 0) : null,
    cashRefunds: totals.cashRefunds ?? 0,
    cogsKnown,
    unknownCogsSaleCount: totals.unknownCogsSaleCount ?? 0,
  };
}

export default function ProfitLoss() {
  const { analyticsData = [], fetchAnalytics } = useContext(DataContext);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [dailyRow, setDailyRow] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState('');
  const requestIdRef = useRef(0);
  const todayKey = lusakaDateKey();
  const isDayMode = isValidDateKey(selectedDate);

  useEffect(() => {
    fetchAnalytics?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDayStatement = useCallback(async (dateKey) => {
    if (!isValidDateKey(dateKey)) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setDailyLoading(true);
    setDailyError('');
    try {
      const query = new URLSearchParams({
        start: dateKey,
        end: addCalendarDays(dateKey, 1),
      });
      const response = await apiFetch(`/api/analytics/financial-report?${query}`);
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Could not load daily profit and loss'));
      }
      const data = await response.json();
      if (requestIdRef.current === requestId) {
        setDailyRow(normalizeDayRow(data, dateKey));
      }
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setDailyRow(null);
        setDailyError(error.message || 'Could not load daily profit and loss');
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setDailyLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isDayMode) {
      requestIdRef.current += 1;
      setDailyRow(null);
      setDailyError('');
      setDailyLoading(false);
      return;
    }
    loadDayStatement(selectedDate);
  }, [isDayMode, selectedDate, loadDayStatement]);

  const handleMonthChange = (value) => {
    setSelectedMonth(value);
    if (selectedDate) {
      setSelectedDate('');
    }
  };

  const handleDateChange = (value) => {
    if (isValidDateKey(value)) {
      setSelectedMonth('');
      setSelectedDate(value);
    } else {
      setSelectedDate('');
    }
  };

  const handleRefresh = () => {
    if (isDayMode) {
      loadDayStatement(selectedDate);
    } else {
      fetchAnalytics?.();
    }
  };

  const monthlyCurrent = useMemo(
    () =>
      analyticsData.find((row) => row.month === selectedMonth) ||
      analyticsData[analyticsData.length - 1] ||
      EMPTY_PERIOD,
    [analyticsData, selectedMonth]
  );

  const current = useMemo(
    () =>
      isDayMode
        ? dailyRow || { ...EMPTY_PERIOD, month: selectedDate, date: selectedDate }
        : monthlyCurrent,
    [isDayMode, dailyRow, selectedDate, monthlyCurrent]
  );

  const monthlyChartData = useMemo(
    () =>
      analyticsData.map((row) => ({
        ...row,
        name: row.month,
        grossProfit: row.grossProfit ?? undefined,
        netProfit: row.netProfit ?? undefined,
      })),
    [analyticsData]
  );

  const dailyChartData = useMemo(
    () => [
      { name: 'Net sales', value: Number(current.revenue || 0), fill: '#3b82f6' },
      { name: 'Verified COGS', value: current.cogsKnown ? Number(current.cogs || 0) : 0, fill: '#ef4444' },
      { name: 'Gross profit', value: current.cogsKnown ? Number(current.grossProfit || 0) : 0, fill: '#10b981' },
      { name: 'Operating expenses', value: Number(current.operatingExpenses || 0), fill: '#f97316' },
      { name: 'Net profit', value: current.cogsKnown ? Number(current.netProfit || 0) : 0, fill: '#f59e0b' },
    ],
    [current]
  );

  const exportCsv = () => {
    if (isDayMode) {
      const header = 'Date,Revenue,COGS,Gross profit,Operating expenses,Net profit,Cash refunds,COGS verified\n';
      const body = [
        selectedDate,
        current.revenue,
        current.cogs ?? '',
        current.grossProfit ?? '',
        current.operatingExpenses,
        current.netProfit ?? '',
        current.cashRefunds ?? 0,
        current.cogsKnown ? 'Yes' : 'No',
      ].join(',');
      const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `MediQuick_profit_and_loss_${selectedDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const header = 'Month,Revenue,COGS,Gross profit,Operating expenses,Net profit,COGS verified\n';
    const body = analyticsData
      .map((row) =>
        [
          row.month,
          row.revenue,
          row.cogs ?? '',
          row.grossProfit ?? '',
          row.operatingExpenses,
          row.netProfit ?? '',
          row.cogsKnown ? 'Yes' : 'No',
        ].join(',')
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MediQuick_profit_and_loss.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pl-container">
      <div className="pl-filter-bar">
        <div className="pl-filters-group">
          <label className="pl-filter-item">
            Reporting month
            <select
              className="pl-select"
              value={isDayMode ? '' : selectedMonth}
              onChange={(event) => handleMonthChange(event.target.value)}
            >
              <option value="">Latest available month</option>
              {analyticsData.map((row) => (
                <option key={row.month} value={row.month}>
                  {row.month}
                </option>
              ))}
            </select>
          </label>

          <label className="pl-filter-item">
            Specific day
            <span className={`pl-date-picker ${isDayMode ? 'active' : ''}`}>
              <Calendar size={15} aria-hidden="true" />
              <input
                type="date"
                aria-label="Specific day"
                className="pl-date-input"
                max={todayKey}
                value={selectedDate}
                onChange={(event) => handleDateChange(event.target.value)}
              />
              {isDayMode && (
                <button
                  type="button"
                  className="pl-date-clear"
                  aria-label="Clear selected day"
                  onClick={(event) => {
                    event.preventDefault();
                    handleDateChange('');
                  }}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </span>
          </label>
        </div>

        <div className="pl-actions-group">
          <button
            className="btn-export"
            type="button"
            onClick={handleRefresh}
            disabled={dailyLoading}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn-export" type="button" onClick={exportCsv}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {dailyError && (
        <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>
          {dailyError}
        </p>
      )}

      {!current.cogsKnown && (
        <p role="alert" style={{ color: '#b45309', margin: 0 }}>
          Gross and net profit are unavailable because {current.unknownCogsSaleCount} sale row(s) in this period have no verified historical cost. Revenue has not been treated as profit.
        </p>
      )}

      <div className="pl-metrics-grid">
        {[
          ['Net sales', current.revenue],
          ['Verified COGS', current.cogs],
          ['Gross profit', current.grossProfit],
          ['Operating expenses', current.operatingExpenses],
          ['Net profit', current.netProfit],
          ['Cash refunds', current.cashRefunds],
        ].map(([label, value]) => (
          <div className="pl-metric-card" key={label}>
            <div className="pl-metric-info">
              <span className="pl-metric-title">{label}</span>
              <span className="pl-metric-value">
                {dailyLoading && isDayMode ? 'Loading…' : money(value)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="pl-main-card">
        <div className="pl-card-header">
          <h2>{isDayMode ? `Daily profit and loss — ${selectedDate}` : 'Monthly profit and loss'}</h2>
          <span>Africa/Lusaka reporting dates</span>
        </div>
        <div className="pl-card-body" style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            {isDayMode ? (
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]}>
                  {dailyChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <AreaChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => money(value)} />
                <Area type="monotone" dataKey="revenue" name="Net sales" stroke="#3b82f6" fill="#dbeafe" />
                <Area type="monotone" dataKey="grossProfit" name="Gross profit" stroke="#10b981" fill="none" />
                <Area type="monotone" dataKey="netProfit" name="Net profit" stroke="#f59e0b" fill="none" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pl-main-card">
        <div className="pl-card-header">
          <h2>Statement of profit or loss — {isDayMode ? selectedDate : current.month}</h2>
        </div>
        <table className="pl-details-table">
          <tbody>
            <tr>
              <td>Net sales (after discounts)</td>
              <td>{dailyLoading && isDayMode ? 'Loading…' : money(current.revenue)}</td>
            </tr>
            <tr>
              <td>Verified cost of goods sold</td>
              <td>{dailyLoading && isDayMode ? 'Loading…' : money(current.cogs)}</td>
            </tr>
            <tr>
              <td>Gross profit</td>
              <td>{dailyLoading && isDayMode ? 'Loading…' : money(current.grossProfit)}</td>
            </tr>
            <tr>
              <td>Operating expenses</td>
              <td>{dailyLoading && isDayMode ? 'Loading…' : money(current.operatingExpenses)}</td>
            </tr>
            <tr>
              <td>Net profit</td>
              <td>{dailyLoading && isDayMode ? 'Loading…' : money(current.netProfit)}</td>
            </tr>
            <tr>
              <td>Cash refunds (not deducted from reversed-sale revenue twice)</td>
              <td>{dailyLoading && isDayMode ? 'Loading…' : money(current.cashRefunds)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
