import React, { useContext, useState, useRef, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import {
  Bell,
  Boxes,
  ClipboardList,
  FileText,
  Headset,
  LayoutDashboard,
  PieChart,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Wallet,
  Truck,
  Heart,
  Home,
  LogOut,
  Settings,
  User,
  ChevronDown,
} from "lucide-react";
import { DataProvider, DataContext } from "./context/DataContext";
import Navbar from "./components/Navbar";
import { Toaster } from "react-hot-toast";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AddStockPage from "./pages/AddStockPage";
import InventoryPage from "./pages/InventoryPage";
import PosPage from "./pages/PosPage";
import ProfitLossPage from "./pages/ProfitLossPage";
import ReportsPage from "./pages/ReportsPage";
import PrescriptionPage from "./pages/PrescriptionPage";
import ProductAdd from "./pages/Home";
import AddUserPage from "./pages/AddUserPage";
import ExpensesPage from "./pages/ExpensesPage";
import SuppliersPage from "./pages/SuppliersPage";
import CustomersPage from "./pages/CustomersPage";
import ProtectedRoute from "./components/ProtectedRoute";

const PAGE_META = [
  {
    match: (pathname) => pathname.startsWith("/dashboard"),
    title: "Inventory Management Dashboard",
    subtitle: "Track stock health, urgent restocks, and daily performance at a glance.",
    icon: LayoutDashboard,
  },
  {
    match: (pathname) => pathname.startsWith("/pos"),
    title: "POS System",
    subtitle: "Build faster checkouts with a modern cart, customer lookup, and payment flow.",
    icon: ShoppingCart,
  },
  {
    match: (pathname) => pathname.startsWith("/inventory"),
    title: "Inventory Control",
    subtitle: "Review medicine availability, pricing, expiry windows, and stock movement.",
    icon: Boxes,
  },
  {
    match: (pathname) => pathname.startsWith("/profit-loss"),
    title: "Profit & Loss",
    subtitle: "Compare revenue, cost of goods, and profit trends across recent months.",
    icon: TrendingUp,
  },
  {
    match: (pathname) => pathname.startsWith("/reports"),
    title: "Reports & Analytics",
    subtitle: "Explore sales trends, inventory alerts, and financial performance in one place.",
    icon: PieChart,
  },
  {
    match: (pathname) => pathname.startsWith("/prescriptions"),
    title: "Prescription Management",
    subtitle: "Track pending fills, patient records, and prescription status updates.",
    icon: FileText,
  },
  {
    match: (pathname) => pathname.startsWith("/add-user"),
    title: "Team Administration & HR Hub",
    subtitle: "Provision staff accounts, manage access levels, and monitor system security.",
    icon: UserPlus,
  },
  {
    match: (pathname) => pathname.startsWith("/expenses"),
    title: "Expense Tracking",
    subtitle: "Record and audit operational costs to monitor pharmacy overhead.",
    icon: Wallet,
  },
  {
    match: (pathname) => pathname.startsWith("/suppliers"),
    title: "Supplier Management",
    subtitle: "Manage procurement partners, delivery logs, and outstanding balances.",
    icon: Truck,
  },
  {
    match: (pathname) => pathname.startsWith("/customers"),
    title: "Patient & Customer Hub",
    subtitle: "Manage medical history, allergy alerts, and transaction history.",
    icon: Heart,
  },
  {
    match: (pathname) => pathname.startsWith("/product-add"),
    title: "Pharmacy Command Center",
    subtitle: "Executive overview and mission control for all pharmacy operations.",
    icon: Home,
  },
];

function ShellLayout() {
  const location = useLocation();
  const { username, userRole, logoutUser } = useContext(DataContext);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pageMeta = PAGE_META.find((item) => item.match(location.pathname)) || {
    title: "Mediquick Workspace",
    subtitle: "Manage pharmacy operations with a clean, focused workflow.",
    icon: LayoutDashboard,
  };

  const Icon = pageMeta.icon;
  const displayName = username || "Staff Member";
  const displayRole = userRole ? `${userRole.charAt(0).toUpperCase()}${userRole.slice(1)}` : "Staff";
  const avatar = displayName.trim().charAt(0).toUpperCase();

  return (
    <div className="app-layout">
      <header className="shell-topbar">
        <div className="shell-topbar__title">
          <div className="shell-topbar__icon">
            <Icon size={22} />
          </div>
          <div className="shell-topbar__copy">
            <p className="shell-topbar__eyebrow">Mediquick Operations</p>
            <h1>{pageMeta.title}</h1>
            <span>{pageMeta.subtitle}</span>
          </div>
        </div>

        <div className="shell-topbar__actions">
          <button type="button" className="shell-icon-btn" aria-label="Notifications">
            <Bell size={19} />
          </button>
          <button type="button" className="shell-icon-btn" aria-label="Tasks">
            <ClipboardList size={19} />
          </button>
          <button type="button" className="shell-icon-btn" aria-label="Support">
            <Headset size={19} />
          </button>

          <div className="shell-profile-container" ref={dropdownRef}>
            <button 
              type="button" 
              className={`shell-profile-pill ${showProfileMenu ? 'active' : ''}`}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <div className="shell-profile-pill__copy">
                <strong>{displayName}</strong>
                <span>{displayRole}</span>
              </div>
              <div className="shell-avatar">{avatar}</div>
              <ChevronDown size={14} className={`dropdown-chevron ${showProfileMenu ? 'open' : ''}`} />
            </button>

            {showProfileMenu && (
              <div className="shell-dropdown">
                <div className="shell-dropdown__header">
                  <p>Account info</p>
                  <span>{displayName}</span>
                </div>
                <div className="shell-dropdown__divider"></div>
                <button className="shell-dropdown__item">
                  <User size={16} />
                  <span>My Profile</span>
                </button>
                <button className="shell-dropdown__item">
                  <Settings size={16} />
                  <span>Account Settings</span>
                </button>
                <div className="shell-dropdown__divider"></div>
                <button 
                  className="shell-dropdown__item logout"
                  onClick={logoutUser}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        <Navbar />

        <main className="main-content">
          <div className="workspace-panel">
            <Routes>
              <Route
                path="product-add/*"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager"]}>
                    <ProductAdd />
                  </ProtectedRoute>
                }
              />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager"]}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="add-stock"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager"]}>
                    <AddStockPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="profit-loss"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager"]}>
                    <ProfitLossPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager"]}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prescriptions"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager"]}>
                    <PrescriptionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="add-user"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AddUserPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="expenses"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager"]}>
                    <ExpensesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="suppliers"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager"]}>
                    <SuppliersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="customers"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager"]}>
                    <CustomersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="inventory"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
                    <InventoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="pos"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
                    <PosPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <DataProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/*" element={<ShellLayout />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </DataProvider>
  );
}

export default App;
