// src/utils/syncEngine.js
// Client-side Synchronization Engine for MediQuick PWA

import { apiFetch } from './api';
import {
  getPendingOperations,
  removePendingOperation,
  updatePendingOperationStatus,
  updateOfflineSaleStatus,
  getSyncMetadata,
  setSyncMetadata,
} from './offlineDb';

class SyncEngine {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.syncStatus = 'idle'; // 'idle' | 'syncing' | 'synced' | 'failed' | 'conflict'
    this.pendingCount = 0;
    this.failedCount = 0;
    this.conflictCount = 0;
    this.lastSyncTime = null;
    this.subscribers = new Set();
    this.syncPromise = null;
    this.heartbeatTimer = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      this.init();
    }
  }

  async init() {
    this.lastSyncTime = await getSyncMetadata('lastSuccessfulSync');
    await this.refreshCounts();
    this.startHeartbeat();
    if (this.isOnline && this.pendingCount > 0) {
      this.triggerSync();
    }
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    // Periodically verify real backend connectivity every 30 seconds
    this.heartbeatTimer = setInterval(() => {
      this.checkConnectivity();
    }, 30000);
  }

  async checkConnectivity() {
    if (typeof window === 'undefined') return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await apiFetch('/health', { signal: controller.signal });
      clearTimeout(timeoutId);

      const wasOffline = !this.isOnline;
      this.isOnline = res.ok;
      if (this.isOnline && (wasOffline || this.pendingCount > 0)) {
        this.triggerSync();
      }
      this.notify();
    } catch {
      this.isOnline = false;
      this.notify();
    }
  }

  handleNetworkChange(online) {
    this.isOnline = online;
    if (online) {
      this.checkConnectivity();
      this.triggerSync();
    } else {
      this.syncStatus = this.pendingCount > 0 ? 'idle' : 'synced';
      this.notify();
    }
  }

  async refreshCounts() {
    try {
      const rawOps = await getPendingOperations();
      const ops = Array.isArray(rawOps) ? rawOps : [];
      this.pendingCount = ops.filter((o) => o && o.status !== 'conflict').length;
      this.failedCount = ops.filter((o) => o && o.status === 'failed').length;
      this.conflictCount = ops.filter((o) => o && o.status === 'conflict').length;
      this.notify();
    } catch (err) {
      console.warn('Could not refresh sync counts:', err);
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.subscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.error('SyncEngine subscriber error:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mediquick:sync-change', { detail: state }));
    }
  }

  getState() {
    return {
      isOnline: this.isOnline,
      syncStatus: this.syncStatus,
      pendingCount: this.pendingCount,
      failedCount: this.failedCount,
      conflictCount: this.conflictCount,
      lastSyncTime: this.lastSyncTime,
    };
  }

  async triggerSync() {
    if (this.syncPromise) {
      return this.syncPromise;
    }

    if (!this.isOnline) {
      await this.refreshCounts();
      return { success: false, reason: 'offline' };
    }

    this.syncPromise = (async () => {
      try {
        const pendingOps = await getPendingOperations();
        const nonConflicted = pendingOps.filter((o) => o.status !== 'conflict');

        if (nonConflicted.length === 0) {
          await this.refreshCounts();
          this.syncStatus = this.conflictCount > 0 ? 'conflict' : 'synced';
          this.notify();
          return { success: true, count: 0 };
        }

        this.syncStatus = 'syncing';
        this.notify();

        // Send pending operations to Render backend /api/sync
        const response = await apiFetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operations: nonConflicted }),
        });

        if (!response.ok) {
          throw new Error(`Sync API returned status ${response.status}`);
        }

        const data = await response.json();
        const results = data.results || [];

        for (const res of results) {
          const { clientTransactionId, status, message } = res;
          if (status === 'synced' || status === 'already_synced') {
            await updateOfflineSaleStatus(clientTransactionId, 'synced', res.data?.id);
            await removePendingOperation(clientTransactionId);
          } else if (status === 'conflict') {
            await updatePendingOperationStatus(clientTransactionId, 'conflict', {
              conflictDetails: res,
              lastError: message,
            });
          } else {
            await updatePendingOperationStatus(clientTransactionId, 'failed', {
              lastError: message,
            });
          }
        }

        await this.refreshCounts();

        const hasUnresolvedOperations = this.failedCount > 0 || this.conflictCount > 0;
        if (!hasUnresolvedOperations) {
          const now = new Date().toISOString();
          this.lastSyncTime = now;
          await setSyncMetadata('lastSuccessfulSync', now);
        }

        this.syncStatus = this.conflictCount > 0 ? 'conflict' : 'synced';
        if (this.failedCount > 0 && this.conflictCount === 0) this.syncStatus = 'failed';
        this.notify();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mediquick:sync-complete', { detail: data }));
        }

        return { success: true, data };
      } catch (err) {
        console.error('MediQuick SyncEngine execution error:', err);
        this.syncStatus = 'failed';
        await this.refreshCounts();
        this.notify();
        return { success: false, error: err.message };
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }
}

export const syncEngine = new SyncEngine();
