import { api } from "./client";
import type {
  ApiExpense,
  ApiInvestment,
  ApiRefund,
  ExpenseCategory,
  ExpenseStatus,
  FinanceSummary,
  RefundReasonCategory,
  RefundStatus,
} from "@/types/api";

// -- Investments --

export interface CreateInvestmentPayload {
  investorName: string;
  amountBDT: number;
  investedAt?: string;
  note?: string;
}

export async function createInvestment(payload: CreateInvestmentPayload) {
  return api.post<{ investment: ApiInvestment }>("/investments", payload);
}

export async function listInvestments(params: { page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ investments: ApiInvestment[] }>(`/investments${qs ? `?${qs}` : ""}`);
}

// -- Expenses --

export interface CreateExpensePayload {
  category: ExpenseCategory;
  amountBDT: number;
  incurredAt?: string;
  note?: string;
}

export async function createExpense(payload: CreateExpensePayload) {
  return api.post<{ expense: ApiExpense }>("/expenses", payload);
}

export async function listExpenses(
  params: { status?: ExpenseStatus; category?: ExpenseCategory; page?: number; limit?: number } = {}
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.category) search.set("category", params.category);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ expenses: ApiExpense[] }>(`/expenses${qs ? `?${qs}` : ""}`);
}

export async function confirmExpense(id: string, note?: string) {
  return api.patch<{ expense: ApiExpense }>(`/expenses/${id}/confirm`, { note });
}

export async function rejectExpense(id: string, note?: string) {
  return api.patch<{ expense: ApiExpense }>(`/expenses/${id}/reject`, { note });
}

// -- Refunds --

export interface CreateRefundPayload {
  orderId: string;
  reasonCategory: RefundReasonCategory;
  requestedAmountBDT: number;
  note?: string;
}

export async function createRefund(payload: CreateRefundPayload) {
  return api.post<{ refund?: ApiRefund; pendingActionId?: string }>("/refunds", payload);
}

export async function listRefunds(params: { status?: RefundStatus; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ refunds: ApiRefund[] }>(`/refunds${qs ? `?${qs}` : ""}`);
}

export async function reviewRefund(id: string, decision: "approve" | "reject", note?: string) {
  return api.patch<{ refund: ApiRefund }>(`/refunds/${id}/review`, { decision, note });
}

export async function rejectRefund(id: string, note?: string) {
  return api.patch<{ refund: ApiRefund }>(`/refunds/${id}/reject`, { note });
}

export async function approveRefund(id: string) {
  return api.patch<{ refund?: ApiRefund; pendingActionId?: string }>(`/refunds/${id}/approve`, {});
}

// -- Finance summary --

export async function getFinanceSummary(params: { from?: string; to?: string } = {}) {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const qs = search.toString();
  return api.get<{ summary: FinanceSummary }>(`/finance/summary${qs ? `?${qs}` : ""}`);
}
