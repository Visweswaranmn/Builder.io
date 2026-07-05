import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/axios';
import type { AuthUser } from '@/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface LoginResponse {
  data: { user: AuthUser; accessToken: string };
}

interface MeResponse {
  data: { user: AuthUser };
}

/**
 * Bootstraps the session from a stored access token on load, and exposes
 * login/logout. The Axios request interceptor (lib/axios.ts) already reads
 * `accessToken` from localStorage, so setting it here is all wiring needed
 * for subsequent authenticated requests.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<MeResponse>('/auth/me')
      .then((res) => setUser(res.data.data.user))
      .catch(() => localStorage.removeItem('accessToken'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const res = await api.post<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem('accessToken', res.data.data.accessToken);
    setUser(res.data.data.user);
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
