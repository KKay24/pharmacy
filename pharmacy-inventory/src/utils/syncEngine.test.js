// src/utils/syncEngine.test.js
import { syncEngine } from './syncEngine';
import * as offlineDb from './offlineDb';
import * as api from './api';

jest.mock('./offlineDb');
jest.mock('./api');

describe('syncEngine unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    offlineDb.getSyncMetadata.mockResolvedValue('2026-09-27T10:00:00.000Z');
    offlineDb.setSyncMetadata.mockResolvedValue();
    offlineDb.removePendingOperation.mockResolvedValue();
    offlineDb.updateOfflineSaleStatus.mockResolvedValue();
    offlineDb.updatePendingOperationStatus.mockResolvedValue();
  });

  test('subscribes to state updates', () => {
    let capturedState = null;
    const unsubscribe = syncEngine.subscribe((state) => {
      capturedState = state;
    });

    expect(capturedState).toBeTruthy();
    expect(typeof capturedState.isOnline).toBe('boolean');
    expect(typeof capturedState.pendingCount).toBe('number');

    unsubscribe();
  });

  test('triggerSync skips when offline', async () => {
    syncEngine.isOnline = false;
    const result = await syncEngine.triggerSync();
    expect(result.success).toBe(false);
    expect(result.reason).toBe('offline');
  });

  test('triggerSync successfully processes pending operations', async () => {
    syncEngine.isOnline = true;
    offlineDb.getPendingOperations.mockResolvedValue([
      {
        clientTransactionId: 'tx_unit_1',
        type: 'SALE',
        status: 'pending',
        payload: [{ medicineId: 1, quantity: 1 }],
      },
    ]);

    api.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: [{ clientTransactionId: 'tx_unit_1', status: 'synced', data: { id: 101 } }],
      }),
    });

    const result = await syncEngine.triggerSync();
    expect(result.success).toBe(true);
    expect(offlineDb.removePendingOperation).toHaveBeenCalledWith('tx_unit_1');
    expect(offlineDb.updateOfflineSaleStatus).toHaveBeenCalledWith('tx_unit_1', 'synced', 101);
  });

  test('triggerSync flags conflicts without deleting pending operation', async () => {
    syncEngine.isOnline = true;
    offlineDb.getPendingOperations.mockResolvedValue([
      {
        clientTransactionId: 'tx_unit_conflict',
        type: 'SALE',
        status: 'pending',
        payload: [{ medicineId: 2, quantity: 999 }],
      },
    ]);

    api.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: [
          {
            clientTransactionId: 'tx_unit_conflict',
            status: 'conflict',
            message: 'Insufficient stock on server',
          },
        ],
      }),
    });

    const result = await syncEngine.triggerSync();
    expect(result.success).toBe(true);
    expect(offlineDb.updatePendingOperationStatus).toHaveBeenCalledWith(
      'tx_unit_conflict',
      'conflict',
      expect.objectContaining({ lastError: 'Insufficient stock on server' })
    );
    expect(offlineDb.removePendingOperation).not.toHaveBeenCalled();
  });
});
