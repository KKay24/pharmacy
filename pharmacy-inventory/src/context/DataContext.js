// DataContext.js
import React, { createContext, useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { clearAuthSession, loadAuthSession, saveAuthSession } from "../utils/authStorage";

const responseRows = (payload) => Array.isArray(payload) ? payload : (payload?.data || []);

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const initialSession = loadAuthSession();
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [predictiveAnalytics, setPredictiveAnalytics] = useState({
    predictions: [],
    summary: {},
    parameters: {},
    generatedAt: null,
  });
  const [reorderInsights, setReorderInsights] = useState({
    items: [],
    summary: {},
    parameters: {},
    generatedAt: null,
  });
  const [riskInsights, setRiskInsights] = useState({
    stockoutRisk: [],
    expiryRisk: [],
    deadStock: [],
    summary: {},
    parameters: {},
    generatedAt: null,
  });
  const [userRole, setUserRole] = useState(initialSession?.user?.role || null);
  const [username, setUsername] = useState(initialSession?.user?.username || null);

  const loginUser = (authPayload) => {
    const session = saveAuthSession(authPayload);
    setUsername(session?.user?.username || null);
    setUserRole(session?.user?.role || null);
  };

  const logoutUser = () => {
    clearAuthSession();
    setUsername(null);
    setUserRole(null);
    setInventory([]);
    setSales([]);
    setCustomers([]);
    setExpenses([]);
    setSuppliers([]);
    setAnalyticsData([]);
    setPredictiveAnalytics({ predictions: [], summary: {}, parameters: {}, generatedAt: null });
    setReorderInsights({ items: [], summary: {}, parameters: {}, generatedAt: null });
    setRiskInsights({
      stockoutRisk: [],
      expiryRisk: [],
      deadStock: [],
      summary: {},
      parameters: {},
      generatedAt: null,
    });
  };

  const fetchInventory = async () => {
    try {
      const res = await apiFetch("/api/inventory");
      if (res.ok) {
        const data = await res.json();
        setInventory(responseRows(data));
      }
    } catch (err) {
      console.error("Failed to fetch inventory", err);
    }
  };

  const fetchSales = async () => {
    try {
      const res = await apiFetch("/api/sales");
      if (res.ok) {
        const data = await res.json();
        setSales(responseRows(data));
      }
    } catch (err) {
      console.error("Failed to fetch sales", err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await apiFetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(responseRows(data));
      }
    } catch (err) {
      console.error("Failed to fetch customers", err);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await apiFetch("/api/expenses");
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (err) {
      console.error("Failed to fetch expenses", err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await apiFetch("/api/suppliers");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (err) {
      console.error("Failed to fetch suppliers", err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await apiFetch("/api/analytics/profit-loss");
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(responseRows(data));
      }
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    }
  };

  const fetchPredictiveAnalytics = async () => {
    try {
      const res = await apiFetch("/api/analytics/predictions");
      if (res.ok) {
        const data = await res.json();
        setPredictiveAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch predictive analytics", err);
    }
  };

  const fetchReorderInsights = async () => {
    try {
      const res = await apiFetch("/api/analytics/reorder-suggestions");
      if (res.ok) {
        const data = await res.json();
        setReorderInsights(data);
      }
    } catch (err) {
      console.error("Failed to fetch reorder insights", err);
    }
  };

  const fetchRiskInsights = async () => {
    try {
      const res = await apiFetch("/api/analytics/risks");
      if (res.ok) {
        const data = await res.json();
        setRiskInsights(data);
      }
    } catch (err) {
      console.error("Failed to fetch risk insights", err);
    }
  };

  useEffect(() => {
    if (!username || !userRole) {
      return;
    }

    fetchInventory();
    fetchSales();

    if (userRole === "admin" || userRole === "manager") {
      fetchCustomers();
      fetchExpenses();
      fetchSuppliers();
      fetchAnalytics();
      fetchPredictiveAnalytics();
      fetchReorderInsights();
      fetchRiskInsights();
    }
  }, [username, userRole]);

  useEffect(() => {
    const handleForcedLogout = () => logoutUser();

    window.addEventListener("mediquick:logout", handleForcedLogout);
    return () => window.removeEventListener("mediquick:logout", handleForcedLogout);
  }, []);

  const addInventoryItem = async (item) => {
    try {
      const res = await apiFetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const data = await res.json();
        setInventory((prev) => [...prev, data]);
        return { success: true };
      }
    } catch (err) {
      console.error("Failed to add item", err);
    }
    return { success: false };
  };

  const updateInventoryItem = async (id, updates) => {
    try {
      const res = await apiFetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setInventory((prev) => prev.map((item) => (item.id === id ? data : item)));
        fetchInventory(); // Refresh to be safe
      }
    } catch (err) {
      console.error("Failed to update item", err);
    }
  };

  const deleteInventoryItem = async (id) => {
    try {
      const res = await apiFetch(`/api/inventory/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInventory((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete item", err);
    }
  };

  const recordSale = async (saleData) => {
    try {
      const res = await apiFetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSales((prev) => [...prev, ...data]);
        } else {
          setSales((prev) => [...prev, data]);
        }
        fetchInventory();
        if (userRole === "admin" || userRole === "manager") {
          fetchAnalytics();
          fetchPredictiveAnalytics();
          fetchReorderInsights();
          fetchRiskInsights();
        }
        return { success: true };
      }
    } catch (err) {
      console.error("Failed to record sale", err);
    }
    return { success: false };
  };

  return (
    <DataContext.Provider
      value={{
        inventory,
        setInventory,
        sales,
        setSales,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        recordSale,
        fetchInventory,
        customers,
        fetchCustomers,
        userRole,
        username,
        loginUser,
        logoutUser,
        analyticsData,
        fetchAnalytics,
        predictiveAnalytics,
        fetchPredictiveAnalytics,
        reorderInsights,
        fetchReorderInsights,
        riskInsights,
        fetchRiskInsights,
        expenses,
        fetchExpenses,
        suppliers,
        fetchSuppliers
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
