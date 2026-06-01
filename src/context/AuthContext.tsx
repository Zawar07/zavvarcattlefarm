'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

interface User {
  id: string;
  name: string;
  role: string;
  phone_number: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (phone_number: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fast auth check — timeout after 5s to avoid hanging forever
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    api.get('/auth/me', { signal: controller.signal })
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const login = async (phone_number: string, password: string) => {
    const res = await api.post('/auth/login', { phone_number, password });
    setUser(res.data.user);
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    sessionStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
