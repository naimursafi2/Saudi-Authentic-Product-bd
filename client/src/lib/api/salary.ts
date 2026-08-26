import { api } from "./client";
import type { ApiSalaryPayment, SalaryPaymentStatus } from "@/types/hr";

export async function createSalaryPayment(payload: {
  employee: string;
  month: number;
  year: number;
  amountBDT: number;
  dailyAllowanceBDT?: number;
  note?: string;
}) {
  return api.post<{ payment: ApiSalaryPayment }>("/salary-payments", payload);
}

export async function listMySalaryPayments(page = 1, limit = 20) {
  return api.get<{ payments: ApiSalaryPayment[] }>(`/salary-payments/mine?page=${page}&limit=${limit}`);
}

export async function listSalaryPayments(
  params: { employee?: string; status?: SalaryPaymentStatus; year?: number; page?: number; limit?: number } = {}
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return api.get<{ payments: ApiSalaryPayment[] }>(`/salary-payments${qs ? `?${qs}` : ""}`);
}

export async function updateSalaryStatus(id: string, status: SalaryPaymentStatus, note?: string) {
  return api.patch<{ payment: ApiSalaryPayment }>(`/salary-payments/${id}/status`, { status, note });
}

export async function notifySalaryPayment(id: string) {
  return api.post<{ payment: ApiSalaryPayment }>(`/salary-payments/${id}/notify`);
}
