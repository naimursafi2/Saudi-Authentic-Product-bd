import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiClientError, setAuthFailureHandler } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("api client — silent refresh-and-retry on 401", () => {
  beforeEach(() => {
    setAuthFailureHandler(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("refreshes once and retries the original request when a normal endpoint 401s", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/orders/mine")) {
        // First call 401s (expired access token); after refresh, succeed.
        if (calls.filter((c) => c.endsWith("/orders/mine")).length === 1) {
          return jsonResponse(401, { success: false, message: "Session expired" });
        }
        return jsonResponse(200, { success: true, message: "ok", data: { orders: [] } });
      }
      if (url.endsWith("/auth/refresh")) {
        return jsonResponse(200, { success: true, message: "Session refreshed", data: {} });
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.get<{ orders: unknown[] }>("/orders/mine");

    expect(result.data.orders).toEqual([]);
    expect(calls).toEqual([
      "http://localhost:5000/api/v1/orders/mine",
      "http://localhost:5000/api/v1/auth/refresh",
      "http://localhost:5000/api/v1/orders/mine",
    ]);
  });

  it("throws the original 401 and fires onAuthFailure when the refresh itself fails", async () => {
    const onAuthFailure = vi.fn();
    setAuthFailureHandler(onAuthFailure);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return jsonResponse(401, { success: false, message: "Invalid or expired refresh token" });
      }
      return jsonResponse(401, { success: false, message: "Session expired" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/orders/mine")).rejects.toBeInstanceOf(ApiClientError);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it("does not attempt a refresh for a 401 from the login endpoint itself", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { success: false, message: "Invalid email or password" })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.post("/auth/login", { email: "a@b.com", password: "x" })).rejects.toBeInstanceOf(
      ApiClientError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares a single in-flight refresh across concurrent 401s", async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(200, { success: true, message: "ok", data: {} });
      }
      // Every non-refresh call 401s once; since both requests race, just
      // always succeed on retry by keying off a per-URL counter isn't
      // needed here — both original calls happen before any retry.
      return jsonResponse(401, { success: false, message: "expired" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.allSettled([api.get("/orders/mine"), api.get("/reviews")]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(refreshCalls).toBe(1);
  });
});
