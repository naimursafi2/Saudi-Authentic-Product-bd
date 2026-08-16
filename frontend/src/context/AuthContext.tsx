"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authApi from "@/lib/api/auth";
import type { ApiUser } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: ApiUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<ApiUser>;
  loginWithGoogle: (idToken: string) => Promise<ApiUser>;
  register: (payload: authApi.RegisterPayload) => Promise<ApiUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.getMe();
      setUser(data.user);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const register = useCallback(async (payload: authApi.RegisterPayload) => {
    const { data } = await authApi.register(payload);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const { data } = await authApi.googleAuth(idToken);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, loginWithGoogle, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
