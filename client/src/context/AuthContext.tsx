"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authApi from "@/lib/api/auth";
import { setAuthFailureHandler, setImpersonationToken, getImpersonationToken } from "@/lib/api/client";
import type { ApiUser } from "@/types/api";
import type { Permission } from "@/lib/permissions";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: ApiUser | null;
  status: AuthStatus;
  /**
   * The signed-in user's effective permissions, from `GET /auth/me` — their
   * built-in role's set plus any custom role's. Used to hide nav items and
   * pages the user can't use; the backend re-checks every one of them, so
   * this is presentation, never protection.
   */
  permissions: Permission[];
  /** Convenience wrapper: true when the user holds any of `required`. */
  hasPermission: (...required: Permission[]) => boolean;
  /** True while a Super Admin is acting as this user via support-login. */
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<ApiUser>;
  loginWithGoogle: (idToken: string) => Promise<ApiUser>;
  register: (payload: authApi.RegisterPayload) => Promise<ApiUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  startImpersonation: (token: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isImpersonating, setIsImpersonating] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.getMe();
      setUser(data.user);
      setPermissions(data.permissions ?? []);
      setIsImpersonating(Boolean(data.impersonatedBy));
      setStatus("authenticated");
    } catch {
      setUser(null);
      setPermissions([]);
      setIsImpersonating(false);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser();
  }, [refreshUser]);

  // Only fires when the API client tried a silent token refresh and the
  // refresh itself failed (refresh token expired/invalid too) — a normal
  // 401 that gets successfully refreshed-and-retried never reaches here, so
  // this never signs the user out just because one request happened to 401.
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      setPermissions([]);
      setIsImpersonating(false);
      setStatus("unauthenticated");
    });
    return () => setAuthFailureHandler(null);
  }, []);

  /**
   * Login/register/Google responses now carry `permissions` directly
   * (computed once, server-side, in the same request — see auth.controller),
   * so sign-in sets full auth state immediately instead of following up with
   * a second `GET /auth/me` round-trip just to learn what the user can do.
   * That second round-trip used to double the wait on every sign-in action;
   * `isImpersonating` is always false here since none of these flows can
   * ever be an impersonation session.
   */
  const login = useCallback(async (email: string, password: string): Promise<ApiUser> => {
    const { data } = await authApi.login(email, password);
    setUser(data.user);
    setPermissions(data.permissions ?? []);
    setIsImpersonating(false);
    setStatus("authenticated");
    return data.user;
  }, []);

  const startImpersonation = useCallback(
    async (token: string) => {
      setImpersonationToken(token);
      await refreshUser();
    },
    [refreshUser]
  );

  const stopImpersonation = useCallback(async () => {
    setImpersonationToken(null);
    await refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (payload: authApi.RegisterPayload) => {
    const { data } = await authApi.register(payload);
    setUser(data.user);
    setPermissions(data.permissions ?? []);
    setIsImpersonating(false);
    setStatus("authenticated");
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const { data } = await authApi.googleAuth(idToken);
    setUser(data.user);
    setPermissions(data.permissions ?? []);
    setIsImpersonating(false);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    // Signing out while impersonating must end the impersonation, not the
    // Super Admin's real session — drop the token and reload their own user.
    if (getImpersonationToken()) {
      setImpersonationToken(null);
      await refreshUser();
      return;
    }
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setPermissions([]);
      setIsImpersonating(false);
      setStatus("unauthenticated");
    }
  }, [refreshUser]);

  const hasPermission = useCallback(
    (...required: Permission[]) => required.some((permission) => permissions.includes(permission)),
    [permissions]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        permissions,
        hasPermission,
        isImpersonating,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshUser,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
