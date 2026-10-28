// src/components/SyncStatusIndicator.test.js
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SyncStatusIndicator from './SyncStatusIndicator';
import { DataContext } from '../context/DataContext';

describe('SyncStatusIndicator component', () => {
  test('renders Online badge when online and no pending operations', () => {
    const mockContext = {
      syncState: {
        isOnline: true,
        syncStatus: 'synced',
        pendingCount: 0,
        conflictCount: 0,
        lastSyncTime: new Date().toISOString(),
      },
      triggerManualSync: jest.fn(),
    };

    render(
      <DataContext.Provider value={mockContext}>
        <SyncStatusIndicator />
      </DataContext.Provider>
    );

    expect(screen.getByText(/Online/i)).toBeInTheDocument();
  });

  test('renders Offline badge when offline', () => {
    const mockContext = {
      syncState: {
        isOnline: false,
        syncStatus: 'idle',
        pendingCount: 3,
        conflictCount: 0,
        lastSyncTime: null,
      },
      triggerManualSync: jest.fn(),
    };

    render(
      <DataContext.Provider value={mockContext}>
        <SyncStatusIndicator />
      </DataContext.Provider>
    );

    expect(screen.getByText(/Offline \(3 pending\)/i)).toBeInTheDocument();
  });

  test('shows a conflicted sale reason and safely discards it after confirmation', async () => {
    const discardConflictedSale = jest.fn().mockResolvedValue({ success: true });
    const getSyncConflicts = jest.fn().mockResolvedValue([
      {
        clientTransactionId: 'tx_conflict',
        status: 'conflict',
        lastError: 'Insufficient stock on server',
      },
    ]);
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <DataContext.Provider value={{
        syncState: {
          isOnline: true,
          syncStatus: 'conflict',
          pendingCount: 0,
          failedCount: 0,
          conflictCount: 1,
          lastSyncTime: null,
        },
        triggerManualSync: jest.fn(),
        getSyncConflicts,
        discardConflictedSale,
      }}>
        <SyncStatusIndicator />
      </DataContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /1 conflict/i }));
    expect(await screen.findByText('Insufficient stock on server')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Discard & Refresh/i }));
    await waitFor(() => expect(discardConflictedSale).toHaveBeenCalledWith('tx_conflict'));
    window.confirm.mockRestore();
  });
});
