import dayjs from 'dayjs';
import { AppShell, MantineProvider } from '@mantine/core';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Navbar from '../Navbar';

describe('configureDayjsLocale', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders Hebrew labels in Mantine date components even if dayjs defaults to English', async () => {
    vi.resetModules();

    dayjs.locale('en');

    render(
      <MantineProvider>
        <MemoryRouter>
          <AppShell navbar={{ width: 280, breakpoint: 'sm' }}>
            <AppShell.Navbar>
              <Navbar />
            </AppShell.Navbar>
            <AppShell.Main />
          </AppShell>
        </MemoryRouter>
      </MantineProvider>
    );

    const dateSection = screen.getByRole('heading', { name: 'תאריכים' }).closest('div');
    const calendar = dateSection ? within(dateSection) : screen;

    expect(calendar.getByText('נובמבר 2025')).toBeInTheDocument();
    expect(calendar.getByText('א׳')).toBeInTheDocument();
  });

  it('sets dayjs to use the Hebrew locale', async () => {
    vi.resetModules();
    dayjs.locale('en');

    await import('./dayjsLocale');

    expect(dayjs.locale()).toBe('he');
  });
});
