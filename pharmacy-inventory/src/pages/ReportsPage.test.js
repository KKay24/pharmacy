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
          receiptNumber: 'REC-123',
        }],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads the selected day and shows the item and staff member who recorded it', async () => {
    render(
      <DataContext.Provider value={{ sales: [], expenses: [] }}>
        <ReportsPage />
      </DataContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /item sales history/i }));

    expect(await screen.findByText('Paracetamol')).toBeTruthy();
    expect(screen.getByText('cashier-one')).toBeTruthy();
    expect(screen.getByText('REC-123')).toBeTruthy();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/sales\?/)));
    expect(apiFetch.mock.calls[0][0]).toContain('limit=100');
  });
});
