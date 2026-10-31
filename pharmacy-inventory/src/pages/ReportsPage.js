import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, History, RefreshCw, Table } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiFetch, getApiErrorMessage } from '../utils/api';
import { DataContext } from '../context/DataContext';
import '../styles/reports-modern.css';

const COLORS = ['#039d83', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
const EMPTY_ARRAY = [];
const money = (value) => `K${Number(value || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const localDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
function selectedRange(period) {
  const to = new Date(); const from = new Date(to);
  from.setDate(from.getDate() - (period === '7d' ? 6 : period === '30d' ? 29 : 364));
  return { from: localDate(from), to: localDate(to) };
}
function nextDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
// Keep the item rows on the same Africa/Lusaka business day used by the
// canonical financial report, regardless of the browser's local time zone.
function itemHistoryRange(dateKey) {
  return {
    from: `${dateKey}T00:00:00+02:00`,
    to: `${nextDate(dateKey)}T00:00:00+02:00`,
  };
}
function paymentAmount(row, method) { return Number(row.payments?.find((payment) => payment.method === method)?.amount || 0); }
function csvValue(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

export default function ReportsPage() {
  const { userRole } = useContext(DataContext);
  const [tab, setTab] = useState('ledger');
  const [period, setPeriod] = useState('30d');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyDate, setHistoryDate] = useState(localDate(new Date()));
  const [history, setHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySummaryLoading, setHistorySummaryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historySummaryError, setHistorySummaryError] = useState('');
  const historyRequestId = useRef(0);
  const historySummaryRequestId = useRef(0);
  const [cashDate, setCashDate] = useState(localDate(new Date()));
  const [countedCash, setCountedCash] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [reconciliations, setReconciliations] = useState([]);
  const [reversalPreview, setReversalPreview] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalLoading, setReversalLoading] = useState(false);

  const range = useMemo(() => selectedRange(period), [period]);
  const loadReport = async () => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams(range);
      const response = await apiFetch(`/api/analytics/financial-report?${query}`);
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Could not load the financial report'));
      setReport(await response.json());
    } catch (loadError) { setReport(null); setError(loadError.message || 'Could not load the financial report'); }
    finally { setLoading(false); }
  };
  const loadHistory = useCallback(async () => {
    const requestId = historyRequestId.current + 1;
    historyRequestId.current = requestId;
    setHistoryLoading(true); setHistoryError('');
    try {
      const dateRange = itemHistoryRange(historyDate);
      const rows = [];
      let page = 1;
      let totalPages = 1;
      do {
        const query = new URLSearchParams({ ...dateRange, page: String(page), limit: '100' });
        const response = await apiFetch(`/api/sales?${query}`);
        if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Could not load sales history'));
        const data = await response.json();
        rows.push(...(data.data || []));
        totalPages = Number(data.pagination?.totalPages || 1);
        page += 1;
      } while (page <= totalPages);
      if (historyRequestId.current === requestId) setHistory(rows);
    } catch (loadError) {
      if (historyRequestId.current === requestId) {
        setHistory([]);
        setHistoryError(loadError.message || 'Could not load sales history');
      }
    } finally {
      if (historyRequestId.current === requestId) setHistoryLoading(false);
    }
  }, [historyDate]);
  const loadHistorySummary = useCallback(async () => {
    const requestId = historySummaryRequestId.current + 1;
    historySummaryRequestId.current = requestId;
    setHistorySummaryLoading(true); setHistorySummaryError('');
    try {
      const query = new URLSearchParams({ from: historyDate, to: historyDate });
      const response = await apiFetch(`/api/analytics/financial-report?${query}`);
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Could not load the daily financial summary'));
      const data = await response.json();
      if (historySummaryRequestId.current === requestId) setHistorySummary(data);
    } catch (loadError) {
      if (historySummaryRequestId.current === requestId) {
        setHistorySummary(null);
        setHistorySummaryError(loadError.message || 'Could not load the daily financial summary');
      }
    } finally {
      if (historySummaryRequestId.current === requestId) setHistorySummaryLoading(false);
    }
  }, [historyDate]);
  useEffect(() => { loadReport(); }, [range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab !== 'history') return;
    loadHistory();
    loadHistorySummary();
  }, [tab, loadHistory, loadHistorySummary]);
  const openReversal = async (sale) => {
    setReversalLoading(true);
    try {
      const response = await apiFetch(`/api/sales/${sale.id}/reversal-preview`);
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Could not load reversal details'));
      setReversalPreview(await response.json());
      setReversalReason('');
    } catch (previewError) {
      toast.error(previewError.message || 'Could not load reversal details');
    } finally {
      setReversalLoading(false);
    }
  };
  const closeReversal = () => {
    setReversalPreview(null);
    setReversalReason('');
  };
  const confirmReversal = async (event) => {
    event.preventDefault();
    if (!reversalPreview || !reversalReason.trim()) return;
    setReversalLoading(true);
    try {
      const response = await apiFetch(`/api/sales/${reversalPreview.saleId}/reverse`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reversalReason.trim() }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Could not reverse sale'));
      const result = await response.json();
      const reversedIds = new Set(result.saleIds || [reversalPreview.saleId]);
      setHistory((current) => current.map((sale) => reversedIds.has(sale.id)
        ? { ...sale, saleStatus: 'REVERSED' }
        : sale));
      closeReversal();
      await Promise.all([loadReport(), loadHistorySummary()]);
      toast.success(`Receipt ${result.receiptNumber || ''} reversed. Stock has been restored.`.trim());
    } catch (reverseError) {
      toast.error(reverseError.message || 'Could not reverse sale');
    } finally {
      setReversalLoading(false);
    }
  };
  const loadReconciliations = async () => {
    const response = await apiFetch('/api/cash-reconciliations');
    if (response.ok) setReconciliations(await response.json());
  };
  useEffect(() => { loadReconciliations().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const closeCashDrawer = async (event) => {
    event.preventDefault();
    try {
      const response = await apiFetch('/api/cash-reconciliations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessDate: cashDate, countedCash, notes: cashNotes }) });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Could not reconcile cash drawer'));
      setCountedCash(''); setCashNotes(''); await loadReconciliations(); toast.success('Cash drawer reconciled and locked');
    } catch (submitError) { toast.error(submitError.message || 'Could not reconcile cash drawer'); }
  };

  const daily = report?.daily || EMPTY_ARRAY;
  const totals = report?.totals || {};
  const historyTotals = historySummary?.totals || null;
  const historyHasCompletedReceipts = Number(historyTotals?.receiptCount || 0) > 0;
  const historyCogsKnown = historyTotals?.cogsKnown === true;
  const historyMargin = historyCogsKnown && Number(historyTotals?.revenue || 0) > 0
    ? (Number(historyTotals.grossProfit) / Number(historyTotals.revenue)) * 100
    : null;
  const paymentMethods = useMemo(() => [...new Set(daily.flatMap((row) => (row.payments || []).map((payment) => payment.method)))], [daily]);
  const exportLedger = () => {
    if (!daily.length) return toast.error('There are no report rows to export');
    const rows = [['Business date', 'Revenue', 'Operating expenses', 'Cash refunds', 'Receipts', ...paymentMethods]];
    daily.forEach((row) => rows.push([row.date, row.revenue, row.operatingExpenses, row.cashRefunds, row.receiptCount, ...paymentMethods.map((method) => paymentAmount(row, method))]));
    const blob = new Blob([rows.map((row) => row.map(csvValue).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `MediQuick_financial_ledger_${range.from}_to_${range.to}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="ri-container">
    <div className="ri-options-bar">
      <div className="ri-tab-bar">
        <button type="button" className={`ri-tab-btn ${tab === 'ledger' ? 'active' : ''}`} onClick={() => setTab('ledger')}><Table size={16} /> Financial ledger</button>
        <button type="button" className={`ri-tab-btn ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}><BarChart3 size={16} /> Analytics</button>
        <button type="button" className={`ri-tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}><History size={16} /> Item history</button>
      </div>
      <div className="ri-period-selector">
        {['7d', '30d', '1y'].map((value) => <button key={value} type="button" className={`ri-period-btn ${period === value ? 'active' : ''}`} onClick={() => setPeriod(value)}>{value.toUpperCase()}</button>)}
        <button type="button" className="ri-period-btn" onClick={loadReport} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>
    </div>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {report?.allocationWarnings?.length > 0 && <p role="alert" style={{ color: '#b45309' }}>Some legacy receipts have no complete payment allocation. Their revenue is included, but they are excluded from cash reconciliation until corrected.</p>}
    {tab === 'ledger' && <>
      <div className="ri-stats-grid">
        <div className="ri-stat-card"><span className="ri-stat-label">Net sales</span><span className="ri-stat-value">{money(totals.revenue)}</span><span className="ri-stat-sub">{totals.receiptCount || 0} completed receipts</span></div>
        <div className="ri-stat-card"><span className="ri-stat-label">Operating expenses</span><span className="ri-stat-value">{money(totals.operatingExpenses)}</span><span className="ri-stat-sub">Not inventory COGS</span></div>
        <div className="ri-stat-card"><span className="ri-stat-label">Cash refunds</span><span className="ri-stat-value">{money(totals.cashRefunds)}</span><span className="ri-stat-sub">Reported separately from revenue</span></div>
        <div className="ri-stat-card"><span className="ri-stat-label">COGS verification</span><span className="ri-stat-value">{totals.cogsKnown ? money(totals.cogs) : 'Review needed'}</span><span className="ri-stat-sub">{totals.unknownCogsSaleCount || 0} sale rows without verified cost</span></div>
      </div>
      <button type="button" className="ri-export-btn" onClick={exportLedger}><Download size={16} /> Export complete range CSV</button>
      <div className="ri-ledger-card"><div className="ri-ledger-table-wrap"><table className="ri-ledger-table"><thead><tr><th>Date (Africa/Lusaka)</th><th>Revenue</th><th>Expenses</th><th>Cash refunds</th><th>Receipts</th>{paymentMethods.map((method) => <th key={method}>{method}</th>)}</tr></thead><tbody>
        {daily.map((row) => <tr key={row.date}><td>{row.date}</td><td>{money(row.revenue)}</td><td>{money(row.operatingExpenses)}</td><td>{money(row.cashRefunds)}</td><td>{row.receiptCount}</td>{paymentMethods.map((method) => <td key={method}>{money(paymentAmount(row, method))}</td>)}</tr>)}
        {!loading && !daily.length && <tr><td colSpan={5 + paymentMethods.length}>No completed financial activity in this range.</td></tr>}
      </tbody></table></div></div>
      <div className="ri-ledger-card"><h3>Cash-drawer reconciliation</h3><p>Cash variance is kept separate from revenue and profit. Closing a date creates an immutable audit record.</p><form onSubmit={closeCashDrawer} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}><label>Business date<input required type="date" value={cashDate} onChange={(event) => setCashDate(event.target.value)} /></label><label>Counted cash (K)<input required min="0" step="0.01" type="number" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} /></label><label style={{ flex: 1 }}>Notes<input value={cashNotes} onChange={(event) => setCashNotes(event.target.value)} /></label><button className="ri-export-btn" type="submit">Close drawer</button></form>{reconciliations.slice(0, 5).map((item) => <p key={item.id}>{item.businessDate}: expected {money(Number(item.expectedCashMinor) / 100)}, counted {money(Number(item.countedCashMinor) / 100)}, variance {money(Number(item.varianceMinor) / 100)}</p>)}</div>
    </>}
    {tab === 'analytics' && <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
      <div className="ri-chart-card"><h3 className="ri-chart-title">Revenue and operating expenses — {range.from} to {range.to}</h3><div style={{ height: 320 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => money(value)} /><Area dataKey="revenue" name="Revenue" stroke="#039d83" fill="#d1fae5" /><Area dataKey="operatingExpenses" name="Operating expenses" stroke="#ef4444" fill="none" /></AreaChart></ResponsiveContainer></div></div>
      <div className="ri-chart-card"><h3 className="ri-chart-title">Revenue by product category</h3><div style={{ height: 260 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={report?.categories || []} dataKey="value" nameKey="name" outerRadius={90}>{(report?.categories || []).map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer></div></div>
    </div>}
    {tab === 'history' && <>
      <div className="ri-history-toolbar"><label>Sale date <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></label></div>
      <section className="ri-history-summary" aria-label={`Daily financial summary for ${historyDate}`}>
        <div className="ri-history-summary-heading"><h2>Daily financial summary</h2><p>Completed receipts for {historyDate} (Africa/Lusaka)</p></div>
        {historySummaryError && <p className="ri-history-summary-error" role="alert">{historySummaryError}</p>}
        <div className="ri-history-summary-grid">
          <div className="ri-stat-card"><span className="ri-stat-label">Total sales</span><span className="ri-stat-value">{historySummaryLoading ? 'Loading…' : historySummaryError ? 'Unavailable' : money(historyTotals?.revenue)}</span><span className="ri-stat-sub">{historySummaryLoading ? 'Loading completed receipts' : historySummaryError ? 'Try changing the date or refreshing' : historyHasCompletedReceipts ? `${historyTotals.receiptCount} completed receipt${historyTotals.receiptCount === 1 ? '' : 's'}` : 'No completed receipts'}</span></div>
          <div className="ri-stat-card"><span className="ri-stat-label">Total COGS</span><span className="ri-stat-value">{historySummaryLoading ? 'Loading…' : historySummaryError ? 'Unavailable' : historyCogsKnown ? money(historyTotals?.cogs) : 'Review needed'}</span><span className="ri-stat-sub">{historySummaryLoading ? 'Loading historical batch costs' : historySummaryError ? 'Historical COGS could not be verified' : !historyHasCompletedReceipts ? 'No completed receipts' : historyCogsKnown ? 'Historical sale-time batch costs' : `${historyTotals?.unknownCogsSaleCount || 0} sale row${historyTotals?.unknownCogsSaleCount === 1 ? '' : 's'} without verified cost`}</span></div>
          <div className="ri-stat-card"><span className="ri-stat-label">Gross profit</span><span className="ri-stat-value">{historySummaryLoading ? 'Loading…' : historySummaryError ? 'Unavailable' : historyCogsKnown ? money(historyTotals?.grossProfit) : 'Review needed'}</span><span className="ri-stat-sub">{historySummaryLoading ? 'Calculating gross profit' : historySummaryError ? 'Gross profit could not be verified' : !historyHasCompletedReceipts ? 'No completed receipts' : historyCogsKnown ? `${historyMargin.toFixed(1)}% gross margin` : 'Requires verified historical COGS'}</span></div>
        </div>
      </section>
      {historyError && <p className="ri-history-summary-error" role="alert">{historyError}</p>}
      <div className="ri-ledger-card"><div className="ri-ledger-table-wrap"><table className="ri-ledger-table"><thead><tr><th>Time</th><th>Item</th><th>Qty</th><th>Sale total</th><th>Sold by</th><th>Status</th><th>Receipt</th>{userRole === 'admin' && <th>Action</th>}</tr></thead><tbody>{history.map((sale) => <tr key={sale.id}><td>{new Date(sale.date).toLocaleTimeString()}</td><td>{sale.name}</td><td>{sale.quantity}</td><td>{money(sale.totalPrice)}</td><td>{sale.soldBy || '—'}</td><td>{sale.saleStatus || 'COMPLETED'}</td><td>{sale.receiptNumber || '—'}</td>{userRole === 'admin' && <td>{(sale.saleStatus || 'COMPLETED') === 'COMPLETED' ? <button type="button" className="ri-reverse-btn" onClick={() => openReversal(sale)} disabled={reversalLoading}>Reverse</button> : <span className="ri-reversed-label">Reversed</span>}</td>}</tr>)}{!historyLoading && !history.length && <tr><td colSpan={userRole === 'admin' ? '8' : '7'}>No item sales on this date.</td></tr>}{historyLoading && <tr><td colSpan={userRole === 'admin' ? '8' : '7'}>Loading item sales…</td></tr>}</tbody></table></div></div>
    </>}
    {reversalPreview && <div className="ri-modal-overlay" role="presentation"><form className="ri-modal-content ri-reversal-modal" onSubmit={confirmReversal} role="dialog" aria-modal="true" aria-labelledby="reverse-sale-title"><h2 id="reverse-sale-title" className="ri-modal-title">Reverse receipt</h2><p className="ri-modal-subtitle">Receipt {reversalPreview.receiptNumber || `sale #${reversalPreview.saleId}`} totals {money(reversalPreview.total)}. This restores the original batches to stock and cannot be undone.</p><div className="ri-reversal-items">{reversalPreview.inventoryImpact.map((item, index) => <p key={`${item.batchNumber}-${index}`}>{item.quantity} × {item.itemName} → batch {item.batchNumber || '—'}</p>)}</div><label className="ri-reversal-reason">Reason for reversal<textarea value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} required minLength="1" maxLength="500" disabled={reversalLoading} /></label><div className="ri-modal-actions"><button type="button" onClick={closeReversal} disabled={reversalLoading}>Cancel</button><button type="submit" className="ri-reverse-btn" disabled={reversalLoading || !reversalReason.trim()}>{reversalLoading ? 'Reversing…' : 'Confirm reversal'}</button></div></form></div>}
  </div>;
}
