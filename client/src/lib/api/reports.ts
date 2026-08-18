import { api } from "./client";
import type { AdminDashboard, EmployeeDashboard, SalesSummary } from "@/types/hr";

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
