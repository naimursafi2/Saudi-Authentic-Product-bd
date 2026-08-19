import type { ApiEnvelope, Pagination } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export class ApiClientError extends Error {
  statusCode: number;
  errors?: Record<string, string[]> | unknown;

  constructor(statusCode: number, message: string, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export interface ApiResult<T> {
  data: T;
  message: string;
  pagination?: Pagination;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Pass a FormData body as-is (for Cloudinary image uploads) instead of JSON-encoding it. */
  isFormData?: boolean;
  signal?: AbortSignal;
}

// Auth endpoints where a 401 means "these credentials/this token were
// rejected", not "the access token expired" — retrying them after a silent
// refresh would be pointless (or, for /auth/refresh itself, recursive).
const NO_REFRESH_RETRY_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/google",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/auth/resend-verification",
];

/**
 * Silently exchanges the httpOnly refreshToken cookie for a new access
 * token via `POST /auth/refresh`. Concurrent 401s share one in-flight
 * refresh instead of each firing their own — the shared promise is cleared
 * once it settles so the next expiry starts a fresh refresh.
 */
let refreshPromise: Promise<boolean> | null = null;
function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Lets AuthContext react immediately when a refresh attempt itself fails
// (the refresh token is expired/invalid too) instead of waiting for the
// next `getMe()` poll — set once by AuthProvider on mount.
let onAuthFailure: (() => void) | null = null;
export function setAuthFailureHandler(handler: (() => void) | null) {
  onAuthFailure = handler;
}

const IMPERSONATION_STORAGE_KEY = "sap:impersonation";

/**
 * While a Super Admin is impersonating someone, every request is sent as
 * that user via `Authorization: Bearer` instead of the cookie session. The
 * admin's own httpOnly cookies stay untouched underneath, so ending the
 * impersonation is just dropping this token — no re-login needed. It lives
 * in sessionStorage so it dies with the tab and never leaks into another.
 */
let impersonationToken: string | null =
  typeof window === "undefined" ? null : window.sessionStorage.getItem(IMPERSONATION_STORAGE_KEY);

export function getImpersonationToken(): string | null {
  return impersonationToken;
}

export function setImpersonationToken(token: string | null) {
  impersonationToken = token;
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, token);
  else window.sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY);
}

/**
 * Thin wrapper around fetch matching the backend's `{success, message, data,
 * pagination?}` envelope. Always sends cookies (`credentials: "include"`) so
 * the httpOnly accessToken/refreshToken cookies set by the API are used
 * automatically — the frontend never touches the tokens directly. A 401 on
 * anything other than the auth endpoints above triggers one silent
 * refresh-and-retry; if the refresh itself fails, the original 401 is
 * thrown as usual and `onAuthFailure` fires so the UI drops out of its
 * signed-in state right away.
 */
async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<ApiResult<T>> {
  const { method = "GET", body, isFormData = false, signal } = options;

  const headers: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };
  if (impersonationToken) headers.Authorization = `Bearer ${impersonationToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    // Product/order/inventory data changes via the admin portal at any
    // time — never let the browser or Next.js server-fetch cache serve a
    // stale response.
    cache: "no-store",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    signal,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? ((await res.json()) as ApiEnvelope<T>) : null;

  if (!res.ok || !payload?.success) {
    // An expired impersonation token can't be refreshed — drop it so the
    // next request falls back to the Super Admin's own cookie session.
    if (res.status === 401 && impersonationToken) {
      setImpersonationToken(null);
      onAuthFailure?.();
    } else if (res.status === 401 && !isRetry && !NO_REFRESH_RETRY_PATHS.some((p) => path.startsWith(p))) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return request<T>(path, options, true);
      }
      onAuthFailure?.();
    }
    throw new ApiClientError(
      res.status,
      payload?.message ?? `Request failed with status ${res.status}`,
      (payload as unknown as { errors?: unknown } | null)?.errors
    );
  }

  return { data: payload.data, message: payload.message, pagination: payload.pagination };
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: "GET", signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "PATCH", body, signal }),
  delete: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: "DELETE", signal }),
  postForm: <T>(path: string, formData: FormData, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body: formData, isFormData: true, signal }),
  patchForm: <T>(path: string, formData: FormData, signal?: AbortSignal) =>
    request<T>(path, { method: "PATCH", body: formData, isFormData: true, signal }),
};
