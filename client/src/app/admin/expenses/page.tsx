"use client";

import { useEffect, useState } from "react";
import { Plus, Receipt, Check, X, Paperclip } from "lucide-react";
import { confirmExpense, createExpense, listExpenses, rejectExpense } from "@/lib/api/finance";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import { ActionButton, ActionButtonGroup } from "@/components/ui/ActionButton";
import type { ApiExpense, ExpenseCategory, Pagination } from "@/types/api";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "product_purchase",
  "packaging",
  "delivery",
  "shipping",
  "marketing",
  "advertising",
  "warehouse",
  "salaries",
  "software",
  "payment_fees",
  "refund",
  "other",
];

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

const MAX_CASH_MEMO_BYTES = 2 * 1024 * 1024;

function personName(person: ApiExpense["recordedBy"]): string {
  return typeof person === "string" ? person : person.name;
}

export default function AdminExpensesPage() {
  const { user } = useAuth();
  const canReview = user?.role === "admin" || user?.role === "super_admin";

  const [expenses, setExpenses] = useState<ApiExpense[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [amountBDT, setAmountBDT] = useState("");
  const [incurredAt, setIncurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [otherCategoryDetail, setOtherCategoryDetail] = useState("");
  const [note, setNote] = useState("");
  const [cashMemoFile, setCashMemoFile] = useState<File | null>(null);
  const [cashMemoUrl, setCashMemoUrl] = useState("");
  const [cashMemoTooLarge, setCashMemoTooLarge] = useState(false);

  function handleCashMemoSelect(file: File | undefined) {
    if (!file) {
      setCashMemoFile(null);
      setCashMemoTooLarge(false);
      return;
    }
    if (file.size > MAX_CASH_MEMO_BYTES) {
      setCashMemoFile(null);
      setCashMemoTooLarge(true);
      return;
    }
    setCashMemoFile(file);
    setCashMemoTooLarge(false);
    setCashMemoUrl("");
  }

  function load() {
    setIsLoading(true);
    listExpenses({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setExpenses(data.expenses);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load expenses."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (category === "other" && !otherCategoryDetail.trim()) {
      setFormError('Please specify the expense purpose for the "Other" category.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createExpense(
        {
          category,
          amountBDT: Number(amountBDT),
          incurredAt: new Date(incurredAt).toISOString(),
          reason,
          otherCategoryDetail: category === "other" ? otherCategoryDetail : undefined,
          note: note || undefined,
          cashMemoUrl: cashMemoUrl || undefined,
        },
        cashMemoFile ?? undefined
      );
      setIsAdding(false);
      setAmountBDT("");
      setReason("");
      setOtherCategoryDetail("");
      setNote("");
      setCashMemoFile(null);
      setCashMemoUrl("");
      setCashMemoTooLarge(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not record expense.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(expense: ApiExpense) {
    setActionError(null);
    setActingId(expense._id);
    try {
      await confirmExpense(expense._id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not confirm expense.");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(expense: ApiExpense) {
    const note = prompt("Reason for rejecting this expense (optional):");
    // Cancelling the reason prompt must not reject the expense anyway.
    if (note === null) return;
    setActionError(null);
    setActingId(expense._id);
    try {
      await rejectExpense(expense._id, note || undefined);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not reject expense.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Operational costs. Co-Admin submissions require Admin/Super Admin confirmation."
        action={
          <Button variant="primary" size="sm" onClick={() => setIsAdding(true)}>
            <Plus size={14} /> Record Expense
          </Button>
        }
      />

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses yet" description="Record your first expense to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium capitalize text-green-950">
                    {expense.category === "other" && expense.otherCategoryDetail
                      ? `Other — ${expense.otherCategoryDetail}`
                      : expense.category.replace(/_/g, " ")}
                    {expense.cashMemo && (
                      <a
                        href={expense.cashMemo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View cash memo"
                        className="ml-1.5 inline-flex text-brown-500 hover:text-green-950"
                      >
                        <Paperclip size={13} />
                      </a>
                    )}
                    <p className="mt-0.5 truncate text-xs font-normal normal-case text-brown-500">
                      {expense.reason}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(expense.amountBDT)}</td>
                  <td className="px-4 py-3 text-brown-600">{new Date(expense.incurredAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-brown-600">{personName(expense.recordedBy)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={expense.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canReview && expense.status === "pending" && (
                      <ActionButtonGroup>
                        <ActionButton tone="success" disabled={actingId === expense._id} onClick={() => handleConfirm(expense)}>
                          <Check size={13} />
                          Confirm
                        </ActionButton>
                        <ActionButton tone="danger" disabled={actingId === expense._id} onClick={() => handleReject(expense)}>
                          <X size={13} />
                          Reject
                        </ActionButton>
                      </ActionButtonGroup>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <AdminPagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}

      {isAdding && (
        <Modal title="Record Expense" onClose={() => setIsAdding(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className={fieldClasses}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Amount (BDT) *</label>
                <input
                  required
                  type="number"
                  min={0}
                  value={amountBDT}
                  onChange={(e) => setAmountBDT(e.target.value)}
                  className={fieldClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Date *</label>
                <input
                  required
                  type="date"
                  value={incurredAt}
                  onChange={(e) => setIncurredAt(e.target.value)}
                  className={fieldClasses}
                />
              </div>
            </div>

            {category === "other" && (
              <div>
                <label className={labelClasses}>Please specify (Other category) *</label>
                <input
                  required
                  type="text"
                  value={otherCategoryDetail}
                  onChange={(e) => setOtherCategoryDetail(e.target.value)}
                  placeholder="What was this expense for?"
                  className={fieldClasses}
                />
              </div>
            )}

            <div>
              <label className={labelClasses}>Reason / Purpose *</label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why was this expense made?"
                className={fieldClasses}
              />
            </div>

            <div>
              <label className={labelClasses}>Cash Memo (optional)</label>
              {cashMemoTooLarge ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-danger">
                    That file is larger than 2MB. Paste a link to the image instead.
                  </p>
                  <input
                    type="url"
                    value={cashMemoUrl}
                    onChange={(e) => setCashMemoUrl(e.target.value)}
                    placeholder="https://..."
                    className={fieldClasses}
                  />
                </div>
              ) : cashMemoUrl ? (
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={cashMemoUrl}
                    onChange={(e) => setCashMemoUrl(e.target.value)}
                    placeholder="https://..."
                    className={fieldClasses}
                  />
                  <button
                    type="button"
                    onClick={() => setCashMemoUrl("")}
                    className="shrink-0 text-xs font-semibold text-brown-500 hover:text-green-950"
                  >
                    Use file instead
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCashMemoSelect(e.target.files?.[0])}
                    className={fieldClasses}
                  />
                  <p className="mt-1 text-xs text-brown-500">JPG or PNG, up to 2MB.</p>
                </>
              )}
            </div>

            <div>
              <label className={labelClasses}>Notes</label>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClasses} />
            </div>

            {formError && <p className="text-sm text-danger">{formError}</p>}

            <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Record Expense"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
