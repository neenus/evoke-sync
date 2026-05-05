import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface UseAuth extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuth {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    axios
      .get<{ success: boolean; data: { user: User } }>('/api/auth/app/me', {
        withCredentials: true,
      })
      .then(({ data }) => {
        setState({ user: data.data?.user ?? null, loading: false });
      })
      .catch(() => {
        setState({ user: null, loading: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await axios.post<{ success: boolean; data: { user: User } }>(
      '/api/auth/app/login',
      { email, password },
      { withCredentials: true },
    );
    setState({ user: data.data?.user ?? null, loading: false });
  }, []);

  const logout = useCallback(async () => {
    await axios.post('/api/auth/app/logout', {}, { withCredentials: true });
    setState({ user: null, loading: false });
  }, []);

  return { ...state, login, logout };
}
