// src/components/SyncStatusIndicator.test.js
import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
