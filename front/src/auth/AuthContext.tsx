import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User as AuthUser } from '@contracts/users';
import { getMe, logout as apiLogout, getGoogleLoginUrl } from './api';
import { queryKeys } from '../lib/queryKeys';

interface AuthContextValue {
  user: AuthUser | null;
  loginWithGoogle: () => void;
  logout: () => void;
  isHydrated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => getMe({ signal }),
    staleTime: 5 * 60 * 1000,
  });

  const user = (data?.user as AuthUser | undefined) ?? null;
  const hydrated = !isPending;

  const loginWithGoogle = useCallback(() => {
    window.location.href = getGoogleLoginUrl();
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      queryClient.setQueryData(queryKeys.me(), null);
      queryClient.removeQueries({ queryKey: queryKeys.settings(), exact: false });
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user: hydrated ? user : null, loginWithGoogle, logout, isHydrated: hydrated }),
    [user, loginWithGoogle, logout, hydrated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
