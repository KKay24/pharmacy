import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, History, RefreshCw, Table } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiFetch, getApiErrorMessage } from '../utils/api';
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
function paymentAmount(row, method) { return Number(row.payments?.find((payment) => payment.method === method)?.amount || 0); }
function csvValue(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

export default function ReportsPage() {
  const [tab, setTab] = useState('ledger');
  const [period, setPeriod] = useState('30d');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyDate, setHistoryDate] = useState(localDate(new Date()));
  const [history, setHistory] = useState([]);
  const [cashDate, setCashDate] = useState(localDate(new Date()));
  const [countedCash, setCountedCash] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [reconciliations, setReconciliations] = useState([]);

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
  useEffect(() => { loadReport(); }, [range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab !== 'history') return;
    const start = new Date(`${historyDate}T00:00:00`); const end = new Date(start); end.setDate(end.getDate() + 1);
    const query = new URLSearchParams({ from: start.toISOString(), to: end.toISOString(), limit: '100' });
    apiFetch(`/api/sales?${query}`).then(async (response) => response.ok ? response.json() : Promise.reject(new Error(await getApiErrorMessage(response, 'Could not load sales history')))).then((data) => setHistory(data.data || [])).catch((loadError) => { setHistory([]); toast.error(loadError.message); });
  }, [tab, historyDate]);
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
    {tab === 'history' && <div className="ri-ledger-card"><label>Sale date <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></label><div className="ri-ledger-table-wrap"><table className="ri-ledger-table"><thead><tr><th>Time</th><th>Item</th><th>Qty</th><th>Sale total</th><th>Sold by</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{history.map((sale) => <tr key={sale.id}><td>{new Date(sale.date).toLocaleTimeString()}</td><td>{sale.name}</td><td>{sale.quantity}</td><td>{money(sale.totalPrice)}</td><td>{sale.soldBy || '—'}</td><td>{sale.saleStatus || 'COMPLETED'}</td><td>{sale.receiptNumber || '—'}</td></tr>)}{!history.length && <tr><td colSpan="7">No item sales on this date.</td></tr>}</tbody></table></div></div>}
  </div>;
}
