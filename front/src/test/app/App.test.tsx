import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import App from '../../App';
import * as authApi from '../../auth/api';
import type { User as AuthUser } from '@kalimere/types/users';
import { renderWithProviders } from '../utils/renderWithProviders';

const mockUser: AuthUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: null,
  phone: null,
};

vi.mock('../../auth/api');
vi.mock('../../api/treatments', () => ({
  listTreatments: vi.fn(async () => []),
}));
vi.mock('../../api/customers', () => ({
  listCustomers: vi.fn(async () => []),
}));

describe('App routing', () => {
  const getMeMock = vi.mocked(authApi.getMe);

  beforeEach(() => {
    getMeMock.mockResolvedValue({ user: mockUser });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderApp(path = '/') {
    return renderWithProviders(<App />, {
      router: {
        initialEntries: [path],
      },
    });
  }

  it('renders protected dashboard when authenticated', async () => {
    renderApp();

    await waitFor(() => expect(screen.getAllByText('דאשבורד')[0]).toBeInTheDocument());
    expect(screen.getByLabelText('Ready')).toBeInTheDocument();
  });

  it('redirects to login when unauthenticated', async () => {
    getMeMock.mockResolvedValueOnce(null);

    renderApp();

    await waitFor(() =>
      expect(screen.getByText('בשביל להמשיך צריך להתחבר עם Google')).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'התחברות באמצעות Google' })).toBeInTheDocument();
  });

  it('shows loader before hydration completes', async () => {
    let resolveGetMe: ((value: { user: typeof mockUser } | null) => void) | undefined;
    getMeMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveGetMe = resolve;
        })
    );

    renderApp();

    expect(screen.getByLabelText('Loading user')).toBeInTheDocument();

    resolveGetMe?.(null);
    await waitFor(() =>
      expect(screen.getByText('בשביל להמשיך צריך להתחבר עם Google')).toBeInTheDocument()
    );
  });
});
