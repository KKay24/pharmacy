import React from "react";
import { 
  Package, 
  AlertTriangle, 
  XCircle, 
  CalendarX 
} from "lucide-react";
import "../styles/dashboard.css";

function Dashboard({
  totalMedicines,
  lowStockCount,
  outOfStockCount,
  expiredCount,
  LOW_STOCK_THRESHOLD,
  setFilterType,
}) {
  
  const stats = [
    {
      title: "Total Medicines",
      value: totalMedicines,
      icon: <Package size={24} />,
      type: "total",
      description: "All items in inventory",
      onClick: () => setFilterType("ALL"),
    },
    {
      title: "Low Stock",
      value: lowStockCount,
      icon: <AlertTriangle size={24} />,
      type: "warning",
      description: `Items below ${LOW_STOCK_THRESHOLD}`,
      onClick: () => setFilterType("LOW_STOCK"),
    },
    {
      title: "Out of Stock",
      value: outOfStockCount,
      icon: <XCircle size={24} />,
      type: "danger",
      description: "Items with 0 quantity",
      onClick: () => setFilterType("OUT_OF_STOCK"),
    },
    {
      title: "Expired",
      value: expiredCount,
      icon: <CalendarX size={24} />,
      type: "expired",
      description: "Expired items",
      onClick: () => setFilterType("EXPIRED"),
    },
  ];

  return (
    <div className="dashboard-stats">
      <div className="dashboard-header">
        <h1 className="page-title">Dashboard Overview</h1>
        <p className="page-subtitle">Welcome back, here is what's happening today.</p>
      </div>

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`stat-card ${stat.type}`}
            onClick={stat.onClick}
          >
            <div className="stat-icon-wrapper">
              {stat.icon}
            </div>
            <div className="stat-content">
              <h3>{stat.title}</h3>
              <p className="stat-value">{stat.value}</p>
              <span className="stat-desc">{stat.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
