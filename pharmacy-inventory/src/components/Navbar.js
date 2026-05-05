import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Boxes,
  FileText,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  PieChart,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Wallet,
  Truck,
  Heart,
  Home,
} from "lucide-react";
import "../styles/App.css";
import { DataContext } from "../context/DataContext";

function Navbar() {
  const location = useLocation();
  const { userRole, logoutUser } = useContext(DataContext);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const mainLinks = [
    {
      show: userRole === "admin" || userRole === "manager",
      path: "/product-add",
      icon: Home,
      label: "Command Center",
    },
    {
      show: userRole === "admin" || userRole === "manager",
      path: "/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
    },
    {
      show: true,
      path: "/pos",
      icon: ShoppingCart,
      label: "New Sale",
    },
    {
      show: true,
      path: "/inventory",
      icon: Boxes,
      label: "Inventory",
    },
  ];

  const adminLinks = [
    {
      show: userRole === "admin" || userRole === "manager",
      path: "/add-stock",
      icon: PackagePlus,
      label: "Add Stock",
    },
    {
      show: userRole === "admin" || userRole === "manager",
      path: "/profit-loss",
      icon: TrendingUp,
      label: "Profit & Loss",
    },
    {
      show: userRole === "admin" || userRole === "manager",
      path: "/reports",
      icon: PieChart,
      label: "Reports",
    },
    {
      show: userRole === "admin" || userRole === "manager",
      path: "/prescriptions",
      icon: FileText,
      label: "Prescriptions",
    },
    {
      show: userRole === "admin",
      path: "/add-user",
      icon: UserPlus,
      label: "Team & HR",
    },
    {
      show: userRole === "admin" || userRole === "manager",
      path: "/expenses",
      icon: Wallet,
      label: "Expenses",
    },
    {
      show: userRole === "admin" || userRole === "manager",
      path: "/suppliers",
      icon: Truck,
      label: "Suppliers",
    },
    {
      show: userRole === "admin" || userRole === "manager",
      path: "/customers",
      icon: Heart,
      label: "Patients",
    },
  ];

  return (
    <>
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon" aria-hidden="true">
          <img src="/logo512.png" alt="Mediquick logo" width={44} height={44} />
        </div>
        <div className="sidebar-brand">
          <h1>Mediquick</h1>
          <p>Pharmacy command center</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <span className="sidebar-section__label">Workspace</span>
          {mainLinks
            .filter((link) => link.show)
            .map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-item ${isActive(link.path) ? "active" : ""}`}
                >
                  <Icon size={19} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
        </div>

        {adminLinks.some((link) => link.show) && (
          <div className="sidebar-section">
            <span className="sidebar-section__label">Management</span>
            {adminLinks
              .filter((link) => link.show)
              .map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`nav-item ${isActive(link.path) ? "active" : ""}`}
                  >
                    <Icon size={19} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
          </div>
        )}
      </nav>

    </aside>
    <nav className="mobile-nav">
      <Link to="/dashboard" className={`mobile-nav-item ${isActive("/dashboard") ? "active" : ""}`}>
        <LayoutDashboard size={20} />
        <span>Dash</span>
      </Link>
      <Link to="/pos" className={`mobile-nav-item ${isActive("/pos") ? "active" : ""}`}>
        <ShoppingCart size={20} />
        <span>POS</span>
      </Link>
      <Link to="/inventory" className={`mobile-nav-item ${isActive("/inventory") ? "active" : ""}`}>
        <Boxes size={20} />
        <span>Inv</span>
      </Link>
      <Link to="/profit-loss" className={`mobile-nav-item ${isActive("/profit-loss") ? "active" : ""}`}>
        <TrendingUp size={20} />
        <span>Profit</span>
      </Link>
      <button onClick={logoutUser} className="mobile-nav-item" style={{background: 'none', border: 'none', padding: 0}}>
        <LogOut size={20} />
        <span>Exit</span>
      </button>
    </nav>
    </>
  );
}

export default Navbar;
