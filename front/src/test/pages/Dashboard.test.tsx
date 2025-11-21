import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Dashboard } from '../../pages/Dashboard';
import { renderWithProviders } from '../utils/renderWithProviders';
import * as http from '../../lib/http';

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.spyOn(http, 'fetchJson').mockImplementation(async (path) => {
      if (path === '/api/dashboard/stats') {
        return {
          activeCustomers: 10,
          activePets: 5,
          visitsThisMonth: 20,
        };
      }
      if (path === '/api/dashboard/upcoming') {
        return [
          {
            id: '1',
            petName: 'Rex',
            customerName: 'John Doe',
            serviceType: 'Grooming',
            date: new Date().toISOString(),
            status: 'scheduled',
          },
        ];
      }
      return {};
    });
  });

  it('renders stats cards with data', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('ביקורים החודש')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('לקוחות פעילים')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('חיות מחמד פעילות')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('shows upcoming visits', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Rex - Grooming/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no upcoming visits', async () => {
    vi.spyOn(http, 'fetchJson').mockImplementation(async (path) => {
      if (path === '/api/dashboard/stats') {
        return { activeCustomers: 0, activePets: 0, visitsThisMonth: 0 };
      }
      if (path === '/api/dashboard/upcoming') {
        return [];
      }
      return {};
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('אין ביקורים קרובים')).toBeInTheDocument();
    });
  });
});
