import { api } from "./client";
import type {
  ApiExpense,
  ApiInvestment,
  ApiRefund,
  ExpenseCategory,
  ExpenseMonthSummary,
  ExpenseStatus,
  FinanceSummary,
  RefundReasonCategory,
  RefundStatus,
} from "@/types/api";
import type { GrossProfitPoint, InventoryValuation, RevenueVsExpensePoint } from "@/types/hr";

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
  reason: string;
  otherCategoryDetail?: string;
  note?: string;
  /** A pasted link, offered client-side when the chosen cash-memo photo exceeds the 2MB upload limit. */
  cashMemoUrl?: string;
}

/** `cashMemoFile` is optional — an expense can be submitted with no receipt,
 * one uploaded to Cloudinary, or (see `payload.cashMemoUrl`) a pasted link. */
export async function createExpense(payload: CreateExpensePayload, cashMemoFile?: File) {
  if (!cashMemoFile) {
    return api.post<{ expense: ApiExpense }>("/expenses", payload);
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) formData.append(key, String(value));
  }
  formData.append("cashMemo", cashMemoFile);
  return api.postForm<{ expense: ApiExpense }>("/expenses", formData);
}

export async function listExpenses(
  params: {
    status?: ExpenseStatus;
    category?: ExpenseCategory;
    /** `"YYYY-MM"` — one archived monthly period. */
    month?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.category) search.set("category", params.category);
  if (params.month) search.set("month", params.month);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ expenses: ApiExpense[] }>(`/expenses${qs ? `?${qs}` : ""}`);
}

/** Every calendar month with at least one expense, newest first — the monthly archive index. */
export async function getExpenseMonths() {
  return api.get<{ months: ExpenseMonthSummary[] }>("/expenses/months");
}

export async function confirmExpense(id: string, note?: string) {
  return api.patch<{ expense: ApiExpense }>(`/expenses/${id}/confirm`, { note });
}

export async function rejectExpense(id: string, note?: string) {
  return api.patch<{ expense: ApiExpense }>(`/expenses/${id}/reject`, { note });
}

export interface EditExpenseFields {
  category?: ExpenseCategory;
  amountBDT?: number;
  incurredAt?: string;
  reason?: string;
  otherCategoryDetail?: string;
  note?: string;
}

/** Direct edit — `expenses.edit` only (Super Admin). */
export async function updateExpense(id: string, changes: EditExpenseFields) {
  return api.patch<{ expense: ApiExpense }>(`/expenses/${id}`, changes);
}

/** `expenses.edit` only (Super Admin). */
export async function deleteExpense(id: string) {
  return api.delete<null>(`/expenses/${id}`);
}

/** `expenses.requestEdit` (Employee/Co-Admin/Admin) — parks the change for exclusive Super Admin review via the existing pending-actions queue. */
export async function requestExpenseEdit(id: string, changes: EditExpenseFields, reason: string) {
  return api.post<{ pendingActionId: string }>(`/expenses/${id}/edit-request`, { changes, reason });
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

export async function getRevenueVsExpense(groupBy: "day" | "week" | "month", from?: string, to?: string) {
  const search = new URLSearchParams({ groupBy });
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  return api.get<{ timeSeries: RevenueVsExpensePoint[] }>(`/finance/revenue-vs-expense?${search.toString()}`);
}

/** The Purchase/Landed-Cost system's own profit report — net selling revenue minus real batch-level cost of goods sold. */
export async function getGrossProfit(groupBy: "day" | "week" | "month", from?: string, to?: string) {
  const search = new URLSearchParams({ groupBy });
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  return api.get<{ timeSeries: GrossProfitPoint[] }>(`/finance/gross-profit?${search.toString()}`);
}

/** Live stock valued at its actual landed cost, not a guessed/list price. */
export async function getInventoryValuation() {
  return api.get<InventoryValuation>("/finance/inventory-valuation");
}
