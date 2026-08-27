import { api, API_BASE_URL, ApiClientError } from "./client";
import type { AdminDashboard, EmployeeDashboard, SalesSummary, SalesTimeSeriesPoint } from "@/types/hr";
import type { ApiDeliveryAgentPerformance } from "@/types/api";

export async function getAdminDashboard() {
  return api.get<{ dashboard: AdminDashboard }>("/reports/dashboard");
}

export async function getEmployeeDashboard() {
  return api.get<{ dashboard: EmployeeDashboard }>("/reports/employee-dashboard");
}

export async function getSalesSummary(from?: string, to?: string) {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const qs = search.toString();
  return api.get<{ sales: SalesSummary }>(`/reports/sales${qs ? `?${qs}` : ""}`);
}

export async function getDeliveryAgentPerformance() {
  return api.get<{ agents: ApiDeliveryAgentPerformance[] }>("/reports/delivery-performance");
}

export async function getSalesTimeSeries(groupBy: "day" | "week" | "month", from?: string, to?: string) {
  const search = new URLSearchParams({ groupBy });
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  return api.get<{ timeSeries: SalesTimeSeriesPoint[] }>(`/reports/sales-timeseries?${search.toString()}`);
}

/**
 * Fetches the Sales Report as a real generated PDF (not a browser
 * print-to-PDF) — a raw `fetch`, not the shared `api.get` helper, since
 * that helper only understands the `{success, data}` JSON envelope and
 * would treat a binary `application/pdf` response as a failure. The
 * caller is responsible for naming/saving the file (see `downloadBlob` in
 * `lib/csvExport.ts`) — this only returns the bytes.
 */
export async function getSalesReportPdf(groupBy: "day" | "week" | "month", from?: string, to?: string) {
  const search = new URLSearchParams({ groupBy });
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const res = await fetch(`${API_BASE_URL}/reports/sales-timeseries/pdf?${search.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json().catch(() => null) : null;
    throw new ApiClientError(res.status, body?.message ?? `Request failed with status ${res.status}`);
  }
  return res.blob();
}
