// src/utils/offlineDb.js
// Production-ready IndexedDB storage layer for MediQuick PWA

const DB_NAME = 'mediquick_pharmacy_db';
const DB_VERSION = 1;

let dbInstance = null;
let dbPromise = null;

export const openOfflineDatabase = () => {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbPromise) {
    return dbPromise;
  }

  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Products Store (Catalog & Inventory)
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('name', 'name', { unique: false });
        productStore.createIndex('category', 'category', { unique: false });
        productStore.createIndex('productKey', 'productKey', { unique: false });
      }

      // 2. Customers Store
      if (!db.objectStoreNames.contains('customers')) {
        const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
        customerStore.createIndex('name', 'name', { unique: false });
        customerStore.createIndex('phone', 'phone', { unique: false });
      }

      // 3. Recent Sales Store (for offline viewing and daily tracking)
      if (!db.objectStoreNames.contains('recentSales')) {
        const salesStore = db.createObjectStore('recentSales', { keyPath: 'clientTransactionId' });
        salesStore.createIndex('receiptNumber', 'receiptNumber', { unique: false });
        salesStore.createIndex('date', 'date', { unique: false });
        salesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // 4. Pending Operations (Offline Sync Queue)
      if (!db.objectStoreNames.contains('pendingOperations')) {
        const opStore = db.createObjectStore('pendingOperations', { keyPath: 'clientTransactionId' });
        opStore.createIndex('type', 'type', { unique: false });
        opStore.createIndex('createdAt', 'createdAt', { unique: false });
        opStore.createIndex('status', 'status', { unique: false });
      }

      // 5. Sync Metadata Store (Key-Value)
      if (!db.objectStoreNames.contains('syncMetadata')) {
        db.createObjectStore('syncMetadata', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Failed to open MediQuick offline IndexedDB:', event.target.error);
      dbPromise = null;
      reject(event.target.error);
    };
  });

  return dbPromise;
};

// Generic store transaction helper
const runTransaction = async (storeNames, mode, callback) => {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Array.isArray(storeNames)
      ? storeNames.map((s) => transaction.objectStore(s))
      : transaction.objectStore(storeNames);

    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = (event) => reject(event.target.error);
    transaction.onabort = (event) => reject(event.target.error || new Error('Transaction aborted'));

    try {
      result = callback(stores, transaction);
    } catch (err) {
      transaction.abort();
      reject(err);
    }
  });
};

/* ==========================================================================
   PRODUCTS & INVENTORY
   ========================================================================== */

export const getOfflineProducts = async () => {
  return runTransaction('products', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
};

export const saveOfflineProducts = async (products) => {
  if (!Array.isArray(products) || products.length === 0) return;
  return runTransaction('products', 'readwrite', (store) => {
    for (const item of products) {
      if (item && item.id) {
        store.put(item);
      }
    }
  });
};

export const deductOfflineProductStock = async (medicineId, quantityDeducted) => {
  return runTransaction('products', 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const getReq = store.get(medicineId);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) {
          resolve(false);
          return;
        }

        // Deduct batches FIFO
        if (Array.isArray(item.Batches)) {
          let remaining = quantityDeducted;
          const updatedBatches = item.Batches.map((b) => {
            if (remaining <= 0) return b;
            const currentQty = Number(b.quantity || 0);
            const deduct = Math.min(currentQty, remaining);
            remaining -= deduct;
            return { ...b, quantity: currentQty - deduct };
          });
          item.Batches = updatedBatches;
        }

        const currentTotal = Number(item.totalQuantity || item.quantity || 0);
        item.totalQuantity = Math.max(0, currentTotal - quantityDeducted);
        if (item.quantity !== undefined) {
          item.quantity = item.totalQuantity;
        }

        store.put(item);
        resolve(true);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
};

/* ==========================================================================
   CUSTOMERS
   ========================================================================== */

export const getOfflineCustomers = async () => {
  return runTransaction('customers', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
};

export const saveOfflineCustomers = async (customers) => {
  if (!Array.isArray(customers) || customers.length === 0) return;
  return runTransaction('customers', 'readwrite', (store) => {
    for (const customer of customers) {
      if (customer && customer.id) {
        store.put(customer);
      }
    }
  });
};

/* ==========================================================================
   RECENT SALES (OFFLINE VISIBILITY)
   ========================================================================== */

export const getOfflineSales = async () => {
  return runTransaction('recentSales', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const sales = request.result || [];
        sales.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        resolve(sales);
      };
      request.onerror = () => reject(request.error);
    });
  });
};

export const saveOfflineSaleRecord = async (saleRecord) => {
  return runTransaction('recentSales', 'readwrite', (store) => {
    store.put(saleRecord);
  });
};

export const updateOfflineSaleStatus = async (clientTransactionId, status, serverId = null) => {
  return runTransaction('recentSales', 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const saleKey = String(clientTransactionId);
        const matchingSales = (req.result || []).filter((sale) => {
          const key = String(sale.clientTransactionId || '');
          return key === saleKey || key.startsWith(`${saleKey}_`);
        });

        matchingSales.forEach((sale, index) => {
          sale.syncStatus = status;
          if (serverId && matchingSales.length === 1) sale.id = serverId;
          if (serverId && matchingSales.length > 1 && Array.isArray(serverId)) {
            const serverSale = serverId[index];
            if (serverSale?.id) sale.id = serverSale.id;
          }
          store.put(sale);
        });
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  });
};

/* ==========================================================================
   OFFLINE SYNC QUEUE (PENDING OPERATIONS)
   ========================================================================== */

export const getPendingOperations = async () => {
  return runTransaction('pendingOperations', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const ops = request.result || [];
        ops.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        resolve(ops);
      };
      request.onerror = () => reject(request.error);
    });
  });
};

export const enqueuePendingOperation = async ({
  clientTransactionId,
  type,
  payload,
  clientTimestamp = new Date().toISOString(),
}) => {
  const operation = {
    clientTransactionId,
    type,
    payload,
    createdAt: clientTimestamp,
    status: 'pending', // 'pending' | 'syncing' | 'failed' | 'conflict'
    retryCount: 0,
    lastError: null,
    conflictDetails: null,
  };

  return runTransaction('pendingOperations', 'readwrite', (store) => {
    store.put(operation);
  });
};

export const updatePendingOperationStatus = async (
  clientTransactionId,
  status,
  { lastError = null, conflictDetails = null } = {}
) => {
  return runTransaction('pendingOperations', 'readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(clientTransactionId);
      req.onsuccess = () => {
        const op = req.result;
        if (op) {
          op.status = status;
          if (lastError !== undefined) op.lastError = lastError;
          if (conflictDetails !== undefined) op.conflictDetails = conflictDetails;
          if (status === 'failed') op.retryCount = (op.retryCount || 0) + 1;
          store.put(op);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  });
};

export const removePendingOperation = async (clientTransactionId) => {
  return runTransaction('pendingOperations', 'readwrite', (store) => {
    store.delete(clientTransactionId);
  });
};

/* ==========================================================================
   METADATA & DASHBOARD CACHING
   ========================================================================== */

export const getSyncMetadata = async (key) => {
  try {
    return await runTransaction('syncMetadata', 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.value ?? null);
        request.onerror = () => reject(request.error);
      });
    });
  } catch {
    return null;
  }
};

export const setSyncMetadata = async (key, value) => {
  return runTransaction('syncMetadata', 'readwrite', (store) => {
    store.put({ key, value, updatedAt: new Date().toISOString() });
  });
};

export const _resetDatabaseInstanceForTesting = () => {
  dbInstance = null;
  dbPromise = null;
};
