// useAuth.ts — Auth hook for login, logout, and session management.
// REACT NATIVE READY: no DOM dependencies.

import { useCallback } from 'react';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';
import type { LoginRequest, RegisterRequest } from '../types/auth.types';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, clearAuth } = useAuthStore();

  const login = useCallback(async (data: LoginRequest) => {
    const tokens = await authService.login(data);
    localStorage.setItem('access_token', tokens.access_token);
    const profile = await authService.getMe();
    setUser(profile);
  }, [setUser]);

  const register = useCallback(async (data: RegisterRequest) => {
    await authService.register(data);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    localStorage.removeItem('access_token');
    clearAuth();
  }, [clearAuth]);

  const checkSession = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setUser(null);
      return;
    }
    try {
      setLoading(true);
      const profile = await authService.getMe();
      setUser(profile);
    } catch {
      localStorage.removeItem('access_token');
      setUser(null);
    }
  }, [setUser, setLoading]);

  return { user, isAuthenticated, isLoading, login, register, logout, checkSession };
}
