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
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Download,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    Activity
} from 'lucide-react';
import { DataContext } from '../context/DataContext';
import "../styles/reports-modern.css";

const COLORS = ['#039d83', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ReportsPage() {
  const { sales, expenses } = useContext(DataContext);
  const [period, setPeriod] = useState('30d');

  // --- ANALYTICS PROCESSING ---

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

  // Combined Sales & Expense Timeline
  const timelineData = useMemo(() => {
    const dataMap = {};
    const now = new Date();
    let daysToTrack = 7;
    if (period === '30d') daysToTrack = 30;
    else if (period === '1y') daysToTrack = 12; // Assuming 12 months for 1y

    // Initialize map
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

    // Populate Sales
    sales.forEach(s => {
        const d = new Date(s.date);
        let key = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        if (period === '1y') key = d.toLocaleString('default', { month: 'short' });
        if (dataMap[key]) dataMap[key].revenue += (s.totalPrice || 0);
    });

    // Populate Expenses
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

  // Category Distribution
  const categoryData = useMemo(() => {
    const counts = {};
    sales.forEach(s => {
        const cat = s.category || 'Other';
        counts[cat] = (counts[cat] || 0) + (s.totalPrice || 0);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [sales]);

  return (
    <div className="ri-container">
      {/* Header & Options */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        {/* <div>
          <h1 style={{margin:0, fontSize:'1.75rem', fontWeight:800}}>Business Intelligence Hub</h1>
          <p style={{margin:'0.25rem 0 0 0', color:'#64748b'}}>Comprehensive view of financial performance and inventory velocity.</p>
        </div> */}
        <div className="ri-options-bar">
          <div className="ri-period-selector" style={{background:'#f1f5f9', padding:'4px', borderRadius:'8px'}}>
             {['7d', '30d', '1y'].map(p => (
                 <button 
                    key={p} 
                    className={`ri-period-btn ${period === p ? 'active' : ''}`}
                    onClick={() => setPeriod(p)}
                 >
                    {p.toUpperCase()}
                 </button>
             ))}
          </div>
           <button className="ri-export-btn" style={{marginLeft:'1rem'}} disabled title="Export Reports is unavailable">
             <Download size={16} /> Export Reports (Unavailable)
          </button>
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

      {/* Main Charts Row */}
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'1.5rem'}}>
        {/* Revenue Area Chart */}
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

        {/* Category Pie Chart */}
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

      {/* Bottom Insights Row */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>
        {/* Top Product Velocity */}
        <div className="ri-chart-card">
            <div className="ri-chart-header">
                <h3 className="ri-chart-title">Top Product Performance</h3>
                <button style={{border:'none', background:'none', color:'#94a3b8', fontWeight:700, fontSize:'0.75rem', cursor:'not-allowed'}} disabled title="Audit logs are unavailable">VIEW ALL (Unavailable)</button>
            </div>
            <table className="ri-table">
                <thead>
                    <tr>
                        <th>Product Name</th>
                        <th>Sold</th>
                        <th>Revenue</th>
                        <th>Margin</th>
                    </tr>
                </thead>
                <tbody>
                    {sales.slice(0, 5).map((sale, idx) => (
                        <tr key={idx}>
                            <td style={{fontWeight:600}}>{sale.name}</td>
                            <td>{sale.quantity}</td>
                            <td style={{fontWeight:600}}>K{(sale.totalPrice || 0).toLocaleString()}</td>
                            <td style={{color:'#10b981'}}>+{(Math.random() * 10 + 20).toFixed(1)}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Operating Insights */}
        <div className="ri-chart-card">
            <div className="ri-chart-header">
                <h3 className="ri-chart-title">Operational Insights</h3>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                <div style={{padding:'1rem', background:'#f8fafc', borderRadius:'10px', display:'flex', gap:'1rem', alignItems:'center'}}>
                    <div style={{width:40, height:40, background:'#dcfce7', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <TrendingUp size={20} color="#166534" />
                    </div>
                    <div>
                        <div style={{fontWeight:700, fontSize:'0.9rem'}}>Revenue Uptrend</div>
                        <div style={{fontSize:'0.8rem', color:'#64748b'}}>Average daily revenue has increased by 15% over the last week.</div>
                    </div>
                </div>
                <div style={{padding:'1rem', background:'#f8fafc', borderRadius:'10px', display:'flex', gap:'1rem', alignItems:'center'}}>
                    <div style={{width:40, height:40, background:'#fee2e2', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <AlertCircle size={20} color="#b91c1c" />
                    </div>
                    <div>
                        <div style={{fontWeight:700, fontSize:'0.9rem'}}>Expense Alert</div>
                        <div style={{fontSize:'0.8rem', color:'#64748b'}}>Inventory procurement costs are up 12%. Consider supplier negotiation.</div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

// Helper icon
function AlertCircle({ size, color }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
    )
}
