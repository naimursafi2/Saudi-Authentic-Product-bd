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

/**
 * Thin wrapper around fetch matching the backend's `{success, message, data,
 * pagination?}` envelope. Always sends cookies (`credentials: "include"`) so
 * the httpOnly accessToken/refreshToken cookies set by the API are used
 * automatically — the frontend never touches the tokens directly.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, isFormData = false, signal } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    // Product/order/inventory data changes via the admin portal at any
    // time — never let the browser or Next.js server-fetch cache serve a
    // stale response.
    cache: "no-store",
    headers: isFormData ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    signal,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? ((await res.json()) as ApiEnvelope<T>) : null;

  if (!res.ok || !payload?.success) {
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
