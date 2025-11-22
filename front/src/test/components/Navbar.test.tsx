import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import Navbar from '../../Navbar';
import { renderWithProviders } from '../utils/renderWithProviders';
import { AppShell } from '@mantine/core';

describe('Navbar', () => {
  it('renders navigation links without nesting navbars', () => {
    const { container } = renderWithProviders(
      <AppShell navbar={{ width: 280, breakpoint: 'sm' }}>
        <AppShell.Navbar>
          <Navbar />
        </AppShell.Navbar>
      </AppShell>
    );

    expect(screen.getByText('דאשבורד')).toBeInTheDocument();
    expect(screen.getByText('סוגי טיפולים')).toBeInTheDocument();
    expect(screen.getByText('לקוחות')).toBeInTheDocument();
    expect(screen.getByText('הגדרות')).toBeInTheDocument();

    const navbars = container.querySelectorAll('nav');
    expect(navbars.length).toBe(1);
  });
});
