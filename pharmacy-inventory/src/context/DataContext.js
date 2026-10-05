// DataContext.js
import React, { createContext, useState, useEffect, useCallback } from "react";
import { apiFetch, getApiErrorMessage } from "../utils/api";
import { clearAuthSession, loadAuthSession, saveAuthSession } from "../utils/authStorage";
import {
  getOfflineProducts,
  saveOfflineProducts,
  deductOfflineProductStock,
  getOfflineCustomers,
  saveOfflineCustomers,
  getOfflineSales,
  saveOfflineSaleRecord,
  enqueuePendingOperation,
  getSyncMetadata,
  setSyncMetadata,
} from "../utils/offlineDb";
import { syncEngine } from "../utils/syncEngine";

const responseRows = (payload) => (Array.isArray(payload) ? payload : payload?.data || []);

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const initialSession = loadAuthSession();
  const [inventory, setInventory] = useState([]);
  const [inventoryCategories, setInventoryCategories] = useState([]);
  const [inventoryCategoriesError, setInventoryCategoriesError] = useState(null);
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

  // Sync state from syncEngine
  const [syncState, setSyncState] = useState(syncEngine.getState());

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

  // 1. Initial IndexedDB preload & sync subscription
  useEffect(() => {
    let isMounted = true;

    // Fast-load previously cached data from IndexedDB
    getOfflineProducts().then((cached) => {
      if (isMounted && cached && cached.length > 0) {
        setInventory(cached);
      }
    }).catch(console.warn);

    getOfflineCustomers().then((cached) => {
      if (isMounted && cached && cached.length > 0) {
        setCustomers(cached);
      }
    }).catch(console.warn);

    getOfflineSales().then((cached) => {
      if (isMounted && cached && cached.length > 0) {
        setSales(cached);
      }
    }).catch(console.warn);

    getSyncMetadata('dashboardSummary').then((cached) => {
      if (!isMounted || !cached) return;
      if (cached.analyticsData) setAnalyticsData(cached.analyticsData);
      if (cached.predictiveAnalytics) setPredictiveAnalytics(cached.predictiveAnalytics);
      if (cached.reorderInsights) setReorderInsights(cached.reorderInsights);
      if (cached.riskInsights) setRiskInsights(cached.riskInsights);
    }).catch(console.warn);

    // Subscribe to SyncEngine
    const unsubscribeSync = syncEngine.subscribe((state) => {
      if (isMounted) setSyncState(state);
    });

    const handleSyncComplete = () => {
      if (isMounted) {
        fetchInventory();
        fetchSales();
      }
    };

    window.addEventListener('mediquick:sync-complete', handleSyncComplete);

    return () => {
      isMounted = false;
      unsubscribeSync();
      window.removeEventListener('mediquick:sync-complete', handleSyncComplete);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInventory = useCallback(async () => {
    const rows = [];
    let page = 1;
    let totalPages = 1;
    try {
      do {
        const res = await apiFetch(`/api/inventory?page=${page}&limit=100`);
        if (!res.ok) {
          const cached = await getOfflineProducts();
          if (cached && cached.length > 0) {
            setInventory(cached);
            return { success: true, offline: true };
          }
          return { success: false, error: await getApiErrorMessage(res, "Failed to load inventory") };
        }
        const data = await res.json();
        rows.push(...responseRows(data));
        totalPages = data?.pagination?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      setInventory(rows);
      saveOfflineProducts(rows).catch(console.warn);
      return { success: true };
    } catch (err) {
      console.warn("Network error fetching inventory, using offline cache", err);
      const cached = await getOfflineProducts();
      if (cached && cached.length > 0) {
        setInventory(cached);
        return { success: true, offline: true };
      }
      return { success: false, error: "Unable to reach the inventory service" };
    }
  }, []);

  const fetchInventoryCategories = useCallback(async () => {
    try {
      const res = await apiFetch("/api/inventory/categories");
      if (!res.ok) {
        const error = await getApiErrorMessage(res, "Failed to load product categories");
        setInventoryCategoriesError(error);
        return { success: false, error };
      }
      const categories = await res.json();
      if (!Array.isArray(categories)) {
        setInventoryCategoriesError("The inventory service returned invalid category data");
        return { success: false, error: "The inventory service returned invalid category data" };
      }
      setInventoryCategories(categories);
      setInventoryCategoriesError(null);
      return { success: true };
    } catch (err) {
      console.error("Failed to fetch product categories", err);
      setInventoryCategoriesError("Unable to reach the category service");
      return { success: false, error: "Unable to reach the category service" };
    }
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      const res = await apiFetch("/api/sales");
      if (res.ok) {
        const data = await res.json();
        const rows = responseRows(data);
        setSales(rows);
        for (const item of rows) {
          saveOfflineSaleRecord({ ...item, clientTransactionId: item.clientTransactionId || `srv_${item.id}`, syncStatus: 'synced' }).catch(console.warn);
        }
      } else {
        const cached = await getOfflineSales();
        if (cached && cached.length > 0) setSales(cached);
      }
    } catch (err) {
      console.warn("Failed to fetch sales, reading offline store", err);
      const cached = await getOfflineSales();
      if (cached && cached.length > 0) setSales(cached);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await apiFetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        const rows = responseRows(data);
        setCustomers(rows);
        saveOfflineCustomers(rows).catch(console.warn);
      } else {
        const cached = await getOfflineCustomers();
        if (cached && cached.length > 0) setCustomers(cached);
      }
    } catch (err) {
      console.warn("Failed to fetch customers, reading offline store", err);
      const cached = await getOfflineCustomers();
      if (cached && cached.length > 0) setCustomers(cached);
    }
  }, []);

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
        const rows = responseRows(data);
        setAnalyticsData(rows);
        setSyncMetadata('dashboardSummary', { analyticsData: rows }).catch(console.warn);
      }
    } catch (err) {
      console.warn("Failed to fetch analytics", err);
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
      console.warn("Failed to fetch predictive analytics", err);
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
      console.warn("Failed to fetch reorder insights", err);
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
      console.warn("Failed to fetch risk insights", err);
    }
  };

  useEffect(() => {
    if (!username || !userRole) {
      return;
    }

    fetchInventory();
    fetchInventoryCategories();
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
  }, [username, userRole, fetchInventory, fetchInventoryCategories, fetchSales, fetchCustomers]);

  useEffect(() => {
    const handleForcedLogout = () => logoutUser();

    window.addEventListener("mediquick:logout", handleForcedLogout);
    return () => window.removeEventListener("mediquick:logout", handleForcedLogout);
  }, []);

  const addInventoryItem = async (item) => {
    if (!syncEngine.isOnline) {
      // Offline stock receipt queueing
      const clientTransactionId = `restock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await enqueuePendingOperation({
        clientTransactionId,
        type: 'RESTOCK',
        payload: {
          items: [item],
          supplier: item.supplier || 'Offline Restock',
          warehouse: item.warehouse || 'Main Pharmacy',
          invoiceNumber: `OFF-${Date.now().toString().slice(-6)}`,
          receivedDate: new Date().toISOString().split('T')[0],
        },
      });
      await syncEngine.refreshCounts();
      return { success: true, pending: true, message: "Saved locally. Stock will sync when online." };
    }

    try {
      const res = await apiFetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        await res.json();
        return fetchInventory();
      }
      return { success: false, error: await getApiErrorMessage(res, "Failed to add inventory item") };
    } catch (err) {
      console.error("Failed to add item", err);
    }
    return { success: false, error: "Unable to reach the inventory service" };
  };

  const updateInventoryItem = async (id, updates) => {
    if (!syncEngine.isOnline) {
      // Offline stock adjustment queueing
      const clientTransactionId = `adj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const currentMed = inventory.find((m) => m.id === id);
      const currentTotal = currentMed ? (currentMed.totalQuantity || currentMed.quantity || 0) : 0;
      const targetTotal = updates.totalQuantity !== undefined ? updates.totalQuantity : currentTotal;
      const quantityChange = targetTotal - currentTotal;

      if (quantityChange !== 0) {
        await enqueuePendingOperation({
          clientTransactionId,
          type: 'ADJUSTMENT',
          payload: { medicineId: id, quantityChange, reason: 'Offline stock adjustment' },
        });
        await syncEngine.refreshCounts();
      }

      // Update local state immediately
      setInventory((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates, totalQuantity: targetTotal, quantity: targetTotal } : item))
      );
      return { success: true, pending: true, message: "Adjusted locally. Will sync when online." };
    }

    try {
      const res = await apiFetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setInventory((prev) => prev.map((item) => (item.id === id ? data : item)));
        const refresh = await fetchInventory();
        return refresh.success
          ? { success: true }
          : { success: false, error: `Inventory was updated, but ${refresh.error.toLowerCase()}` };
      }
      return { success: false, error: await getApiErrorMessage(res, "Failed to update inventory item") };
    } catch (err) {
      console.error("Failed to update item", err);
    }
    return { success: false, error: "Unable to reach the inventory service" };
  };

  const deleteInventoryItem = async (id) => {
    try {
      const res = await apiFetch(`/api/inventory/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const refresh = await fetchInventory();
        return refresh.success
          ? { success: true }
          : { success: false, error: `Inventory was deleted, but ${refresh.error.toLowerCase()}` };
      }
      return { success: false, error: await getApiErrorMessage(res, "Failed to delete inventory item") };
    } catch (err) {
      console.error("Failed to delete item", err);
    }
    return { success: false, error: "Unable to reach the inventory service" };
  };

  /* ========================================================================
     OFFLINE SALES RECORDING WITH IDEMPOTENCY & AUTOMATIC QUEUEING
     ======================================================================== */
  const recordSale = async (saleData) => {
    const clientTransactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const items = Array.isArray(saleData) ? saleData : [saleData];
    const now = new Date();

    const preparedItems = items.map((item, index) => ({
      ...item,
      clientTransactionId: item.clientTransactionId || `${clientTransactionId}_${index}`,
      date: item.date || now.toISOString(),
      syncStatus: syncEngine.isOnline ? 'syncing' : 'pending',
    }));

    // 1. Immediately update local inventory stock in IndexedDB and React state
    for (const item of preparedItems) {
      if (item.medicineId && item.quantity) {
        await deductOfflineProductStock(item.medicineId, Number(item.quantity)).catch(console.warn);
      }
    }

    setInventory((prev) =>
      prev.map((med) => {
        const matched = preparedItems.find((p) => p.medicineId === med.id);
        if (!matched) return med;

        const deduction = Number(matched.quantity || 0);
        let remaining = deduction;

        const updatedBatches = (med.Batches || []).map((b) => {
          if (remaining <= 0) return b;
          const currentQty = Number(b.quantity || 0);
          const deduct = Math.min(currentQty, remaining);
          remaining -= deduct;
          return { ...b, quantity: currentQty - deduct };
        });

        const newTotal = Math.max(0, (med.totalQuantity || med.quantity || 0) - deduction);
        return {
          ...med,
          Batches: updatedBatches,
          totalQuantity: newTotal,
          quantity: newTotal,
        };
      })
    );

    // 2. Save each line item into IndexedDB recentSales store
    for (const item of preparedItems) {
      await saveOfflineSaleRecord(item).catch(console.warn);
    }
    setSales((prev) => [...prev, ...preparedItems]);

    // 3. Queue in IndexedDB pendingOperations store
    await enqueuePendingOperation({
      clientTransactionId,
      type: 'SALE',
      payload: preparedItems,
      clientTimestamp: now.toISOString(),
    });

    await syncEngine.refreshCounts();

    // 4. If online, trigger background sync
    if (syncEngine.isOnline) {
      syncEngine.triggerSync().then(() => {
        if (userRole === "admin" || userRole === "manager") {
          fetchAnalytics();
          fetchPredictiveAnalytics();
          fetchReorderInsights();
          fetchRiskInsights();
        }
      }).catch(console.error);

      return { success: true, pending: false, clientTransactionId };
    }

    // Offline: transaction is saved locally and safely queued
    return { success: true, pending: true, clientTransactionId };
  };

  const triggerManualSync = async () => {
    return syncEngine.triggerSync();
  };

  return (
    <DataContext.Provider
      value={{
        inventory,
        inventoryCategories,
        inventoryCategoriesError,
        setInventory,
        sales,
        setSales,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        recordSale,
        fetchInventory,
        fetchInventoryCategories,
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
        fetchSuppliers,
        syncState,
        triggerManualSync,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
