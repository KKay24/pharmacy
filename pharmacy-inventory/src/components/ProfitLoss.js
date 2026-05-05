import React, { useContext } from "react";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import { TrendingUp, TrendingDown, Download, Calendar, Home } from "lucide-react";
import "../styles/profitLoss.css";
import { DataContext } from "../context/DataContext";

const ProfitLoss = () => {
  const { analyticsData = [] } = useContext(DataContext);

  // 1. Current Month Data (last item in the sorted list)
  const currentData = analyticsData.length > 0 
    ? analyticsData[analyticsData.length - 1] 
    : { revenue: 0, cogs: 0, grossProfit: 0, operatingExpenses: 0, netProfit: 0, month: 'N/A' };

  // 2. Metrics Helpers
  const calcChange = (key) => {
    if (analyticsData.length < 2) return 0;
    const current = analyticsData[analyticsData.length - 1][key];
    const previous = analyticsData[analyticsData.length - 2][key];
    if (previous === 0) return 0;
    return (((current - previous) / previous) * 100).toFixed(1);
  };

  const getSparkData = (key) => analyticsData.slice(-4).map(d => ({ v: d[key] }));

  const MetricCard = ({ title, value, type, change, chartData, color }) => (
    <div className={`pl-metric-card ${type === 'loss' ? 'loss' : ''}`}>
      <div className="pl-metric-info">
        <span className="pl-metric-title">{title}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="pl-metric-value">K{Number(value).toLocaleString()}</span>
          {change !== 0 && change !== "0.0" && (
            <span className={`pl-metric-change ${Number(change) > 0 ? 'pl-change-up' : 'pl-change-down'}`}>
              {Number(change) > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(change)}%
            </span>
          )}
        </div>
      </div>
      <div className="pl-metric-spark">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <Area type="monotone" dataKey="v" stroke={color} fill={`${color}20`} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const formatMonthName = (monthStr) => {
    if (!monthStr || monthStr === 'N/A') return 'N/A';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const date = new Date(parts[0], parts[1] - 1);
    return date.toLocaleString('default', { month: 'short' });
  };

  const chartData = analyticsData.map(d => ({
    ...d,
    name: formatMonthName(d.month),
    Revenue: d.revenue,
    GrossProfit: d.grossProfit,
    NetProfit: d.netProfit
  }));

  return (
    <div className="pl-container">
      {/* 1. Filter Bar */}
      <div className="pl-filter-bar">
        <div className="pl-filters-group">
          <div className="pl-filter-item">
            <label>Report Period:</label>
            <select className="pl-select">
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Yearly</option>
            </select>
          </div>
          <div className="pl-filter-item">
            <Calendar size={18} color="#64748b" />
            <select className="pl-select">
              {analyticsData.map(d => (
                <option key={d.month}>{d.month}</option>
              ))}
              {analyticsData.length === 0 && <option>No data available</option>}
            </select>
          </div>
          <div className="pl-filter-item">
            <Home size={18} color="#64748b" />
            <select className="pl-select">
              <option>Main Pharmacy</option>
            </select>
          </div>
        </div>
        <button className="btn-export">
          <Download size={18} style={{ marginRight: '8px' }} />
          Export
        </button>
      </div>

      {/* 2. Metrics Grid */}
      <div className="pl-metrics-grid">
        <MetricCard 
          title="Gross Revenue" 
          value={currentData.revenue} 
          change={calcChange('revenue')}
          chartData={getSparkData('revenue')} 
          color="#3b82f6" 
        />
        <MetricCard 
          title="Cost of Goods" 
          value={currentData.cogs} 
          type="loss"
          chartData={getSparkData('cogs')} 
          color="#ef4444" 
        />
        <MetricCard 
          title="Gross Profit" 
          value={currentData.grossProfit} 
          change={calcChange('grossProfit')}
          chartData={getSparkData('grossProfit')} 
          color="#10b981" 
        />
        <MetricCard 
          title="Net Profit" 
          value={currentData.netProfit} 
          change={calcChange('netProfit')}
          chartData={getSparkData('netProfit')} 
          color="#10b981" 
        />
      </div>

      {/* 3. Main Chart */}
      <div className="pl-main-card">
        <div className="pl-card-header">
          <h2>Profit & Loss Trends</h2>
        </div>
        <div className="pl-card-body" style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {analyticsData.length > 0 ? (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(v) => `K${v/1000}K`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => `K${Number(value).toLocaleString()}`}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="GrossProfit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorGP)" />
                <Area type="monotone" dataKey="NetProfit" stroke="#f59e0b" strokeWidth={3} fillOpacity={0} />
              </AreaChart>
            ) : (
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#94a3b8'}}>
                    Waiting for data...
                </div>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Details Table */}
      <div className="pl-main-card">
        <div className="pl-card-header">
          <h2>Statement of Profit or Loss ({currentData.month})</h2>
        </div>
        <div className="pl-details-wrapper">
          <table className="pl-details-table">
          <thead>
            <tr>
              <th>Income Item</th>
              <th>Amount</th>
              <th>% Revenue</th>
              <th>Expense Item</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pl-row-category">Gross Revenue</td>
              <td className="pl-value-primary">K{currentData.revenue.toLocaleString()}</td>
              <td className="pl-percentage">100.0%</td>
              <td className="pl-row-category">Direct COGS</td>
              <td className="pl-value-primary" style={{ color: '#ef4444' }}>-K{currentData.cogs.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="pl-row-category">Gross Profit</td>
              <td className="pl-value-success">K{currentData.grossProfit.toLocaleString()}</td>
              <td className="pl-percentage" style={{ color: '#10b981' }}>{((currentData.grossProfit / (currentData.revenue || 1)) * 100).toFixed(1)}%</td>
              <td className="pl-row-category">Operating Expenses</td>
              <td className="pl-value-primary">-K{currentData.operatingExpenses.toLocaleString()}</td>
            </tr>
            <tr className="pl-row-highlight">
              <td colSpan={3} className="pl-row-category" style={{ textAlign: 'right', paddingRight: '2rem' }}>Total Monthly Net Profit:</td>
              <td colSpan={2} className="pl-value-success" style={{ fontSize: '1.25rem' }}>K{currentData.netProfit.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

export default ProfitLoss;
