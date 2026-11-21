import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfitLoss from './ProfitLoss';
import { DataContext } from '../context/DataContext';
import { apiFetch, getApiErrorMessage } from '../utils/api';

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
  getApiErrorMessage: jest.fn(),
}));

const MONTHLY_ANALYTICS = [
  {
    month: '2026-10',
    revenue: 1200,
    cogs: 500,
    grossProfit: 700,
    operatingExpenses: 200,
    netProfit: 500,
    cashRefunds: 0,
    cogsKnown: true,
    unknownCogsSaleCount: 0,
  },
];

describe('ProfitLoss specific calendar day selector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getApiErrorMessage.mockResolvedValue('Could not load daily profit and loss');
  });

  it('fetches and displays a specific calendar day P&L and switches back to monthly view when cleared', async () => {
    const fetchAnalytics = jest.fn();
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: [
          {
            date: '2026-10-15',
            month: '2026-10-15',
            revenue: 420,
            cogs: 180,
            grossProfit: 240,
            operatingExpenses: 60,
            netProfit: 180,
            cashRefunds: 15,
            cogsKnown: true,
            unknownCogsSaleCount: 0,
          },
        ],
        totals: {
          revenue: 420,
          cogs: 180,
          grossProfit: 240,
          operatingExpenses: 60,
          netProfit: 180,
          cashRefunds: 15,
          cogsKnown: true,
          unknownCogsSaleCount: 0,
        },
      }),
    });

    render(
      <DataContext.Provider value={{ analyticsData: MONTHLY_ANALYTICS, fetchAnalytics }}>
        <ProfitLoss />
      </DataContext.Provider>
    );

    expect(screen.getByRole('heading', { name: /statement of profit or loss — 2026-10/i })).toBeInTheDocument();

    const dateInput = screen.getByLabelText(/specific day/i);
    fireEvent.change(dateInput, { target: { value: '2026-10-15' } });

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/analytics/financial-report?start=2026-10-15&end=2026-10-16')
    );

    expect(await screen.findByRole('heading', { name: /daily profit and loss — 2026-10-15/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /statement of profit or loss — 2026-10-15/i })).toBeInTheDocument();
    expect(screen.getAllByText('K420.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('K240.00').length).toBeGreaterThan(0);

    // Clearing the specific day restores the monthly statement
    fireEvent.click(screen.getByRole('button', { name: /clear selected day/i }));
    expect(dateInput).toHaveValue('');
    expect(screen.getByRole('heading', { name: /statement of profit or loss — 2026-10/i })).toBeInTheDocument();
  });

  it('renders an alert when loading a specific calendar day fails', async () => {
    apiFetch.mockResolvedValue({ ok: false });

    render(
      <DataContext.Provider value={{ analyticsData: MONTHLY_ANALYTICS, fetchAnalytics: jest.fn() }}>
        <ProfitLoss />
      </DataContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/specific day/i), { target: { value: '2026-10-12' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load daily profit and loss');
  });
});
