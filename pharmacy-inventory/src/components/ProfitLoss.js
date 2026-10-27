import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, RefreshCw } from 'lucide-react';
import { DataContext } from '../context/DataContext';
import '../styles/profitLoss.css';

const money = (value) => value === null || value === undefined ? 'Unavailable' : `K${Number(value).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function ProfitLoss() {
  const { analyticsData = [], fetchAnalytics } = useContext(DataContext);
  const [selectedMonth, setSelectedMonth] = useState('');
  useEffect(() => { fetchAnalytics?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const current = useMemo(() => analyticsData.find((row) => row.month === selectedMonth) || analyticsData[analyticsData.length - 1] || { month: 'N/A', revenue: 0, cogs: 0, grossProfit: 0, operatingExpenses: 0, netProfit: 0, cogsKnown: true }, [analyticsData, selectedMonth]);
  const chartData = analyticsData.map((row) => ({ ...row, name: row.month, grossProfit: row.grossProfit ?? undefined, netProfit: row.netProfit ?? undefined }));
  const exportCsv = () => {
    const header = 'Month,Revenue,COGS,Gross profit,Operating expenses,Net profit,COGS verified\n';
    const body = analyticsData.map((row) => [row.month, row.revenue, row.cogs ?? '', row.grossProfit ?? '', row.operatingExpenses, row.netProfit ?? '', row.cogsKnown ? 'Yes' : 'No'].join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'MediQuick_profit_and_loss.csv'; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="pl-container">
    <div className="pl-filter-bar"><div className="pl-filters-group"><label>Reporting month <select className="pl-select" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}><option value="">Latest available month</option>{analyticsData.map((row) => <option key={row.month} value={row.month}>{row.month}</option>)}</select></label></div><button className="btn-export" type="button" onClick={() => fetchAnalytics?.()}><RefreshCw size={16} /> Refresh</button><button className="btn-export" type="button" onClick={exportCsv}><Download size={16} /> Export</button></div>
    {!current.cogsKnown && <p role="alert" style={{ color: '#b45309' }}>Gross and net profit are unavailable because {current.unknownCogsSaleCount} sale row(s) in this period have no verified historical cost. Revenue has not been treated as profit.</p>}
    <div className="pl-metrics-grid">{[['Net sales', current.revenue], ['Verified COGS', current.cogs], ['Gross profit', current.grossProfit], ['Operating expenses', current.operatingExpenses], ['Net profit', current.netProfit], ['Cash refunds', current.cashRefunds]].map(([label, value]) => <div className="pl-metric-card" key={label}><div className="pl-metric-info"><span className="pl-metric-title">{label}</span><span className="pl-metric-value">{money(value)}</span></div></div>)}</div>
    <div className="pl-main-card"><div className="pl-card-header"><h2>Monthly profit and loss</h2><span>Africa/Lusaka reporting dates</span></div><div className="pl-card-body" style={{ height: 360 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(value) => money(value)} /><Area type="monotone" dataKey="revenue" name="Net sales" stroke="#3b82f6" fill="#dbeafe" /><Area type="monotone" dataKey="grossProfit" name="Gross profit" stroke="#10b981" fill="none" /><Area type="monotone" dataKey="netProfit" name="Net profit" stroke="#f59e0b" fill="none" /></AreaChart></ResponsiveContainer></div></div>
    <div className="pl-main-card"><div className="pl-card-header"><h2>Statement of profit or loss — {current.month}</h2></div><table className="pl-details-table"><tbody><tr><td>Net sales (after discounts)</td><td>{money(current.revenue)}</td></tr><tr><td>Verified cost of goods sold</td><td>{money(current.cogs)}</td></tr><tr><td>Gross profit</td><td>{money(current.grossProfit)}</td></tr><tr><td>Operating expenses</td><td>{money(current.operatingExpenses)}</td></tr><tr><td>Net profit</td><td>{money(current.netProfit)}</td></tr><tr><td>Cash refunds (not deducted from reversed-sale revenue twice)</td><td>{money(current.cashRefunds)}</td></tr></tbody></table></div>
  </div>;
}
