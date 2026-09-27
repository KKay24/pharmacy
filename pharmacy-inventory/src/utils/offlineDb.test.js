// src/utils/offlineDb.test.js
import {
  _resetDatabaseInstanceForTesting,
  getOfflineProducts,
  saveOfflineProducts,
  deductOfflineProductStock,
  enqueuePendingOperation,
  getPendingOperations,
  removePendingOperation,
  getSyncMetadata,
  setSyncMetadata,
} from './offlineDb';

describe('offlineDb unit tests', () => {
  let mockStores = {};

  beforeEach(() => {
    _resetDatabaseInstanceForTesting();
    mockStores = {
      products: new Map(),
      customers: new Map(),
      recentSales: new Map(),
      pendingOperations: new Map(),
      syncMetadata: new Map(),
    };

    const createMockStore = (storeName) => ({
      get: (key) => {
        const req = {};
        setTimeout(() => {
          req.result = mockStores[storeName].get(key);
          if (req.onsuccess) req.onsuccess({ target: req });
        }, 1);
        return req;
      },
      getAll: () => {
        const req = {};
        setTimeout(() => {
          req.result = Array.from(mockStores[storeName].values());
          if (req.onsuccess) req.onsuccess({ target: req });
        }, 1);
        return req;
      },
      put: (item) => {
        const key = item.id !== undefined ? item.id : (item.clientTransactionId || item.key);
        mockStores[storeName].set(key, JSON.parse(JSON.stringify(item)));
        const req = { result: key };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess({ target: req });
        }, 1);
        return req;
      },
      delete: (key) => {
        mockStores[storeName].delete(key);
        const req = {};
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess({ target: req });
        }, 1);
        return req;
      },
    });

    const mockDb = {
      transaction: (storeNames) => {
        const tx = {
          objectStore: (name) => createMockStore(name),
        };
        setTimeout(() => {
          if (tx.oncomplete) tx.oncomplete();
        }, 10);
        return tx;
      },
      objectStoreNames: {
        contains: () => true,
      },
      close: jest.fn(),
    };

    window.indexedDB = {
      open: () => {
        const req = {};
        setTimeout(() => {
          req.result = mockDb;
          if (req.onsuccess) req.onsuccess({ target: req });
        }, 1);
        return req;
      },
    };
  });

  test('can save and retrieve offline products', async () => {
    const products = [
      { id: 1, name: 'Paracetamol 500mg', totalQuantity: 100, Batches: [{ id: 10, quantity: 100 }] },
      { id: 2, name: 'Amoxicillin 250mg', totalQuantity: 50, Batches: [{ id: 20, quantity: 50 }] },
    ];

    await saveOfflineProducts(products);
    const retrieved = await getOfflineProducts();
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].name).toBe('Paracetamol 500mg');
  });

  test('deductOfflineProductStock decreases batch and total quantities FIFO', async () => {
    const product = {
      id: 1,
      name: 'Ibuprofen 400mg',
      totalQuantity: 30,
      Batches: [
        { id: 1, quantity: 10, expiryDate: '2026-10-01' },
        { id: 2, quantity: 20, expiryDate: '2026-12-01' },
      ],
    };

    await saveOfflineProducts([product]);
    await deductOfflineProductStock(1, 15);

    const updated = await getOfflineProducts();
    const med = updated.find((p) => p.id === 1);
    expect(med.totalQuantity).toBe(15);
    // First batch had 10, fully consumed:
    expect(med.Batches[0].quantity).toBe(0);
    // Second batch had 20, 5 consumed:
    expect(med.Batches[1].quantity).toBe(15);
  });

  test('pending operations queue supports enqueue, list, and removal', async () => {
    const op = {
      clientTransactionId: 'tx_test_123',
      type: 'SALE',
      payload: { medicineId: 1, quantity: 2 },
    };

    await enqueuePendingOperation(op);
    const pendingList = await getPendingOperations();
    expect(pendingList).toHaveLength(1);
    expect(pendingList[0].clientTransactionId).toBe('tx_test_123');
    expect(pendingList[0].status).toBe('pending');

    await removePendingOperation('tx_test_123');
    const afterRemoval = await getPendingOperations();
    expect(afterRemoval).toHaveLength(0);
  });

  test('metadata store saves and retrieves key-value entries', async () => {
    await setSyncMetadata('lastSuccessfulSync', '2026-09-27T20:00:00.000Z');
    const val = await getSyncMetadata('lastSuccessfulSync');
    expect(val).toBe('2026-09-27T20:00:00.000Z');
  });
});
