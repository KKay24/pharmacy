import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportsPage from './ReportsPage';
import { DataContext } from '../context/DataContext';
import { apiFetch } from '../utils/api';

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
  getApiErrorMessage: jest.fn(),
}));

describe('ReportsPage item sales history', () => {
  beforeEach(() => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          id: 17,
          date: '2026-10-10T09:30:00.000Z',
          name: 'Paracetamol',
          quantity: 2,
          totalPrice: 30,
          paymentMethod: 'Cash',
          soldBy: 'cashier-one',
          saleStatus: 'REVERSED',
          receiptNumber: 'REC-123',
        }],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads the selected day with cashier and reversal status details', async () => {
    render(
      <DataContext.Provider value={{ sales: [], expenses: [] }}>
        <ReportsPage />
      </DataContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /item history/i }));

    expect(await screen.findByText('Paracetamol')).toBeTruthy();
    expect(screen.getByText('REC-123')).toBeTruthy();
    expect(screen.getByText('cashier-one')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /sold by/i })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeTruthy();
    expect(screen.getByText('REVERSED')).toBeTruthy();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/sales\?/)));
    expect(apiFetch.mock.calls.find(([url]) => url.startsWith('/api/sales?'))[0]).toContain('limit=100');
  });

  it('shows the canonical daily totals and loads every item-history page', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.startsWith('/api/analytics/financial-report?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            totals: {
              revenue: 150,
              cogs: 50,
              grossProfit: 100,
              cogsKnown: true,
              receiptCount: 1,
              unknownCogsSaleCount: 0,
            },
          }),
        });
      }
      if (url.includes('page=2')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{ id: 2, date: '2026-10-10T09:31:00.000Z', name: 'Ibuprofen', quantity: 1, totalPrice: 75 }],
            pagination: { page: 2, limit: 100, total: 2, totalPages: 2 },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{ id: 1, date: '2026-10-10T09:30:00.000Z', name: 'Paracetamol', quantity: 2, totalPrice: 75 }],
          pagination: { page: 1, limit: 100, total: 2, totalPages: 2 },
        }),
      });
    });

    render(
      <DataContext.Provider value={{ sales: [], expenses: [] }}>
        <ReportsPage />
      </DataContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /item history/i }));
    fireEvent.change(screen.getByLabelText(/sale date/i), { target: { value: '2026-10-10' } });

    expect(await screen.findByText('Ibuprofen')).toBeTruthy();
    expect(screen.getByText('K150.00')).toBeTruthy();
    expect(screen.getByText('K50.00')).toBeTruthy();
    expect(screen.getByText('K100.00')).toBeTruthy();
    expect(screen.getByText('66.7% gross margin')).toBeTruthy();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/sales?')));
    expect(apiFetch.mock.calls.some(([url]) => url.includes('/api/sales?') && url.includes('page=2'))).toBe(true);
    expect(apiFetch.mock.calls.some(([url]) => url.includes('/api/analytics/financial-report?from=2026-10-10&to=2026-10-10'))).toBe(true);
  });

  it('lets an admin preview and confirm a completed receipt reversal', async () => {
    apiFetch.mockImplementation((url, options) => {
      if (url === '/api/sales/17/reversal-preview') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            saleId: 17,
            receiptNumber: 'REC-123',
            total: 30,
            inventoryImpact: [{ itemName: 'Paracetamol', batchNumber: 'B-001', quantity: 2 }],
          }),
        });
      }
      if (url === '/api/sales/17/reverse' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ saleIds: [17], receiptNumber: 'REC-123', saleStatus: 'REVERSED' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{
            id: 17, date: '2026-10-10T09:30:00.000Z', name: 'Paracetamol', quantity: 2,
            totalPrice: 30, soldBy: 'cashier-one', saleStatus: 'COMPLETED', receiptNumber: 'REC-123',
          }],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        }),
      });
    });

    render(
      <DataContext.Provider value={{ sales: [], expenses: [], userRole: 'admin' }}>
        <ReportsPage />
      </DataContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /item history/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^reverse$/i }));
    expect(await screen.findByRole('dialog', { name: /reverse receipt/i })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/reason for reversal/i), { target: { value: 'Customer returned the product' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm reversal/i }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/api/sales/17/reverse',
      expect.objectContaining({ method: 'PATCH' })
    ));
    expect(await screen.findByText('REVERSED')).toBeTruthy();
  });
});
