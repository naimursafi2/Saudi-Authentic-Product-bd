"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Receipt, Check, X, Paperclip, Printer, Pencil, Trash2, History as HistoryIcon } from "lucide-react";
import {
  confirmExpense,
  createExpense,
  deleteExpense,
  getExpenseMonths,
  listExpenses,
  rejectExpense,
  requestExpenseEdit,
  updateExpense,
  type EditExpenseFields,
} from "@/lib/api/finance";
import { listAuditLogs } from "@/lib/api/auditLogs";
import { ApiClientError } from "@/lib/api/client";
import { printWithFilename } from "@/lib/print";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { cn, formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import { ActionButton, ActionButtonGroup } from "@/components/ui/ActionButton";
import { ActionBadge, actorName, friendlyNote } from "@/lib/auditLogDisplay";
import type { ApiAuditLog, ApiExpense, ExpenseCategory, ExpenseMonthSummary, Pagination } from "@/types/api";

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

function personName(person: ApiExpense["recordedBy"] | ApiExpense["lastEditedBy"]): string {
  if (!person) return "—";
  return typeof person === "string" ? person : person.name;
}

/** `"2026-08"` -> `"August 2026"`. */
function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function categoryLabel(expense: ApiExpense): string {
  return expense.category === "other" && expense.otherCategoryDetail
    ? `Other — ${expense.otherCategoryDetail}`
    : expense.category.replace(/_/g, " ");
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function editableFieldsFrom(expense: ApiExpense): Required<Omit<EditExpenseFields, "otherCategoryDetail" | "note">> &
  Pick<EditExpenseFields, "otherCategoryDetail" | "note"> {
  return {
    category: expense.category,
    amountBDT: expense.amountBDT,
    incurredAt: toDateInputValue(expense.incurredAt),
    reason: expense.reason,
    otherCategoryDetail: expense.otherCategoryDetail,
    note: expense.note,
  };
}

/**
 * The Purchase Batch / Landed Cost system's sibling for operational spend —
 * shared by `/admin/expenses` (Co-Admin/Admin/Super Admin) and
 * `/employee/expenses` (Employee, read-only + edit requests). One component
 * so the two portals can never drift: every capability here is gated purely
 * by `hasPermission(...)`, exactly as the rest of this project's shared
 * components (`ProfileSection`, `AddressBook`) already work across portals.
 */
export function ExpensesManager() {
  const { hasPermission } = useAuth();
  const confirmDialog = useConfirm();

  const canCreate = hasPermission("expenses.create");
  const canReview = hasPermission("expenses.approve");
  const canDirectEdit = hasPermission("expenses.edit");
  const canRequestEdit = hasPermission("expenses.requestEdit") && !canDirectEdit;
  const canEditAtAll = canDirectEdit || canRequestEdit;

  const [months, setMonths] = useState<ExpenseMonthSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null | undefined>(undefined);
  const didAutoSelect = useRef(false);

  const [expenses, setExpenses] = useState<ApiExpense[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [amountBDT, setAmountBDT] = useState("");
  const [incurredAt, setIncurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [otherCategoryDetail, setOtherCategoryDetail] = useState("");
  const [note, setNote] = useState("");
  const [cashMemoFile, setCashMemoFile] = useState<File | null>(null);
  const [cashMemoUrl, setCashMemoUrl] = useState("");
  const [cashMemoTooLarge, setCashMemoTooLarge] = useState(false);

  const [editingExpense, setEditingExpense] = useState<ApiExpense | null>(null);
  const [editFields, setEditFields] = useState<EditExpenseFields>({});
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [historyExpense, setHistoryExpense] = useState<ApiExpense | null>(null);
  const [historyLogs, setHistoryLogs] = useState<ApiAuditLog[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  function loadMonths() {
    getExpenseMonths()
      .then(({ data }) => {
        setMonths(data.months);
        if (!didAutoSelect.current) {
          didAutoSelect.current = true;
          setSelectedMonth(data.months[0]?.month ?? null);
        }
      })
      .catch(() => {
        if (!didAutoSelect.current) {
          didAutoSelect.current = true;
          setSelectedMonth(null);
        }
      });
  }

  useEffect(loadMonths, []);

  function load() {
    if (selectedMonth === undefined) return;
    setIsLoading(true);
    const params = selectedMonth ? { month: selectedMonth, limit: 100 } : { page, limit: 20 };
    listExpenses(params)
      .then(({ data, pagination: pg }) => {
        setExpenses(data.expenses);
        setPagination(selectedMonth ? null : (pg ?? null));
        setError(null);
      })
      .catch(() => setError("Could not load expenses."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [selectedMonth, page]);

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
      loadMonths();
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
    const reviewNote = prompt("Reason for rejecting this expense (optional):");
    // Cancelling the reason prompt must not reject the expense anyway.
    if (reviewNote === null) return;
    setActionError(null);
    setActingId(expense._id);
    try {
      await rejectExpense(expense._id, reviewNote || undefined);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not reject expense.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(expense: ApiExpense) {
    const ok = await confirmDialog({
      title: "Delete expense",
      message: `Delete "${expense.reason}" (${formatBDT(expense.amountBDT)})? This permanently removes the record and cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setActionError(null);
    setActingId(expense._id);
    try {
      await deleteExpense(expense._id);
      load();
      loadMonths();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not delete expense.");
    } finally {
      setActingId(null);
    }
  }

  function openEdit(expense: ApiExpense) {
    setEditingExpense(expense);
    setEditFields(editableFieldsFrom(expense));
    setEditReason("");
    setEditError(null);
  }

  function changedEditFields(expense: ApiExpense, fields: EditExpenseFields): EditExpenseFields {
    const original = editableFieldsFrom(expense);
    const changes: EditExpenseFields = {};
    if (fields.category !== undefined && fields.category !== original.category) changes.category = fields.category;
    if (fields.amountBDT !== undefined && Number(fields.amountBDT) !== original.amountBDT)
      changes.amountBDT = Number(fields.amountBDT);
    if (fields.incurredAt !== undefined && toDateInputValue(new Date(fields.incurredAt).toISOString()) !== original.incurredAt)
      changes.incurredAt = new Date(fields.incurredAt).toISOString();
    if (fields.reason !== undefined && fields.reason !== original.reason) changes.reason = fields.reason;
    if ((fields.otherCategoryDetail ?? "") !== (original.otherCategoryDetail ?? ""))
      changes.otherCategoryDetail = fields.otherCategoryDetail;
    if ((fields.note ?? "") !== (original.note ?? "")) changes.note = fields.note;
    return changes;
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingExpense) return;
    setEditError(null);

    const changes = changedEditFields(editingExpense, editFields);
    if (Object.keys(changes).length === 0) {
      setEditError("Change at least one field before saving.");
      return;
    }
    if ((changes.category ?? editingExpense.category) === "other" && !(changes.otherCategoryDetail ?? editingExpense.otherCategoryDetail)?.trim()) {
      setEditError('Please specify the expense purpose for the "Other" category.');
      return;
    }
    if (canRequestEdit && !editReason.trim()) {
      setEditError("Explain why this edit is needed.");
      return;
    }

    setIsSavingEdit(true);
    try {
      if (canDirectEdit) {
        await updateExpense(editingExpense._id, changes);
      } else {
        await requestExpenseEdit(editingExpense._id, changes, editReason.trim());
      }
      setEditingExpense(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiClientError ? err.message : "Could not save this edit.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  function openHistory(expense: ApiExpense) {
    setHistoryExpense(expense);
    setHistoryLogs(null);
    setHistoryError(null);
    listAuditLogs({ resource: "Expense", resourceId: expense._id, limit: 50 })
      .then(({ data }) => setHistoryLogs(data.logs))
      .catch(() => setHistoryError("Could not load this expense's history."));
  }

  function handlePrint() {
    if (!selectedMonth) return;
    printWithFilename("Expense-Report");
  }

  const monthTotalBDT = expenses.reduce((sum, e) => sum + e.amountBDT, 0);

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Expenses"
          description="Operational costs, organized by month. Co-Admin submissions require Admin/Super Admin confirmation."
          action={
            canCreate ? (
              <Button variant="primary" size="sm" onClick={() => setIsAdding(true)}>
                <Plus size={14} /> Record Expense
              </Button>
            ) : undefined
          }
        />
      </div>

      {months.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => setSelectedMonth(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              selectedMonth === null
                ? "border-brand-deep-2 bg-brand-deep-2 text-white"
                : "border-brown-600/15 bg-surface text-brown-600 hover:border-green-900/30"
            )}
          >
            All
          </button>
          {months.map((m) => (
            <button
              key={m.month}
              onClick={() => setSelectedMonth(m.month)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                selectedMonth === m.month
                  ? "border-brand-deep-2 bg-brand-deep-2 text-white"
                  : "border-brown-600/15 bg-surface text-brown-600 hover:border-green-900/30"
              )}
            >
              {monthLabel(m.month)} <span className="opacity-70">({m.count})</span>
            </button>
          ))}
        </div>
      )}

      {actionError && <p className="mb-4 text-sm text-danger print:hidden">{actionError}</p>}

      <div className="print-header">
        <strong>EXPENSES</strong>
        <br />
        {selectedMonth ? monthLabel(selectedMonth) : "All periods"} &middot; Printed {new Date().toLocaleDateString()}
      </div>
      <p className="print-footer">Saudi Authentic Product</p>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses yet" description="Record your first expense to get started." />
      ) : (
        <div className="print-area overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <div className="flex items-center justify-between px-4 pt-4 print:hidden">
            <h2 className="font-serif text-base text-green-950">
              {selectedMonth ? monthLabel(selectedMonth) : "All Expenses"}
            </h2>
            <Button variant="outline" size="xs" onClick={handlePrint} disabled={!selectedMonth} title={!selectedMonth ? "Select a month to print" : undefined}>
              <Printer size={13} /> Print
            </Button>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium capitalize text-green-950">
                    {categoryLabel(expense)}
                    {expense.cashMemo && (
                      <a
                        href={expense.cashMemo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View cash memo"
                        className="ml-1.5 inline-flex text-brown-500 hover:text-green-950 print:hidden"
                      >
                        <Paperclip size={13} />
                      </a>
                    )}
                    <p className="mt-0.5 truncate text-xs font-normal normal-case text-brown-500">{expense.reason}</p>
                    {expense.lastEditedAt && (
                      <p className="mt-0.5 text-[11px] font-normal normal-case text-gold-700 print:hidden">
                        Edited by {personName(expense.lastEditedBy)} on {new Date(expense.lastEditedAt).toLocaleDateString()}
                        {expense.lastEditViaRequest ? " (approved edit request)" : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(expense.amountBDT)}</td>
                  <td className="px-4 py-3 text-brown-600">{new Date(expense.incurredAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-brown-600">{personName(expense.recordedBy)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={expense.status} />
                  </td>
                  <td className="px-4 py-3 text-right print:hidden">
                    <ActionButtonGroup>
                      {canReview && expense.status === "pending" && (
                        <>
                          <ActionButton tone="success" disabled={actingId === expense._id} onClick={() => handleConfirm(expense)}>
                            <Check size={13} />
                            Confirm
                          </ActionButton>
                          <ActionButton tone="danger" disabled={actingId === expense._id} onClick={() => handleReject(expense)}>
                            <X size={13} />
                            Reject
                          </ActionButton>
                        </>
                      )}
                      {canEditAtAll && (
                        <ActionButton tone="info" disabled={actingId === expense._id} onClick={() => openEdit(expense)}>
                          <Pencil size={13} />
                          {canDirectEdit ? "Edit" : "Request Edit"}
                        </ActionButton>
                      )}
                      {canDirectEdit && (
                        <ActionButton tone="danger" disabled={actingId === expense._id} onClick={() => handleDelete(expense)}>
                          <Trash2 size={13} />
                          Delete
                        </ActionButton>
                      )}
                      <ActionButton tone="neutral" onClick={() => openHistory(expense)}>
                        <HistoryIcon size={13} />
                        History
                      </ActionButton>
                    </ActionButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-4 py-3 font-semibold text-green-950" colSpan={2}>
                  Total {selectedMonth ? monthLabel(selectedMonth) : ""} Expenses: {formatBDT(monthTotalBDT)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
          {!selectedMonth && (
            <div className="px-4 pb-4">
              <AdminPagination pagination={pagination} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}

      {isAdding && (
        <Modal title="Record Expense" onClose={() => setIsAdding(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Category *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={fieldClasses}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Amount (BDT) *</label>
                <input required type="number" min={0} value={amountBDT} onChange={(e) => setAmountBDT(e.target.value)} className={fieldClasses} />
              </div>
              <div>
                <label className={labelClasses}>Date *</label>
                <input required type="date" value={incurredAt} onChange={(e) => setIncurredAt(e.target.value)} className={fieldClasses} />
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
              <textarea required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why was this expense made?" className={fieldClasses} />
            </div>

            <div>
              <label className={labelClasses}>Cash Memo (optional)</label>
              {cashMemoTooLarge ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-danger">That file is larger than 2MB. Paste a link to the image instead.</p>
                  <input type="url" value={cashMemoUrl} onChange={(e) => setCashMemoUrl(e.target.value)} placeholder="https://..." className={fieldClasses} />
                </div>
              ) : cashMemoUrl ? (
                <div className="flex items-center gap-2">
                  <input type="url" value={cashMemoUrl} onChange={(e) => setCashMemoUrl(e.target.value)} placeholder="https://..." className={fieldClasses} />
                  <button type="button" onClick={() => setCashMemoUrl("")} className="shrink-0 text-xs font-semibold text-brown-500 hover:text-green-950">
                    Use file instead
                  </button>
                </div>
              ) : (
                <>
                  <input type="file" accept="image/*" onChange={(e) => handleCashMemoSelect(e.target.files?.[0])} className={fieldClasses} />
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

      {editingExpense && (
        <Modal title={canDirectEdit ? "Edit Expense" : "Request an Edit"} onClose={() => setEditingExpense(null)}>
          <form onSubmit={handleSaveEdit} className="flex flex-col gap-5">
            {!canDirectEdit && (
              <p className="rounded border border-gold-500/30 bg-gold-soft px-3 py-2 text-xs text-gold-700">
                Your changes will be submitted for Super Admin approval — the record stays unchanged until then.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Category</label>
                <select
                  value={editFields.category ?? editingExpense.category}
                  onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
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
                <label className={labelClasses}>Amount (BDT)</label>
                <input
                  type="number"
                  min={0}
                  value={editFields.amountBDT ?? editingExpense.amountBDT}
                  onChange={(e) => setEditFields((f) => ({ ...f, amountBDT: Number(e.target.value) }))}
                  className={fieldClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Date</label>
                <input
                  type="date"
                  value={editFields.incurredAt ?? toDateInputValue(editingExpense.incurredAt)}
                  onChange={(e) => setEditFields((f) => ({ ...f, incurredAt: e.target.value }))}
                  className={fieldClasses}
                />
              </div>
            </div>

            {(editFields.category ?? editingExpense.category) === "other" && (
              <div>
                <label className={labelClasses}>Please specify (Other category)</label>
                <input
                  type="text"
                  value={editFields.otherCategoryDetail ?? editingExpense.otherCategoryDetail ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f, otherCategoryDetail: e.target.value }))}
                  className={fieldClasses}
                />
              </div>
            )}

            <div>
              <label className={labelClasses}>Reason / Purpose</label>
              <textarea
                rows={2}
                value={editFields.reason ?? editingExpense.reason}
                onChange={(e) => setEditFields((f) => ({ ...f, reason: e.target.value }))}
                className={fieldClasses}
              />
            </div>

            <div>
              <label className={labelClasses}>Notes</label>
              <textarea
                rows={2}
                value={editFields.note ?? editingExpense.note ?? ""}
                onChange={(e) => setEditFields((f) => ({ ...f, note: e.target.value }))}
                className={fieldClasses}
              />
            </div>

            {!canDirectEdit && (
              <div>
                <label className={labelClasses}>Why is this edit needed? *</label>
                <textarea
                  required
                  rows={2}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Explain the correction, e.g. the receipt shows a different total"
                  className={fieldClasses}
                />
              </div>
            )}

            {editError && <p className="text-sm text-danger">{editError}</p>}

            <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingExpense(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : canDirectEdit ? "Save Changes" : "Submit for Approval"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {historyExpense && (
        <Modal title={`History — ${categoryLabel(historyExpense)}`} onClose={() => setHistoryExpense(null)} wide>
          <div className="mb-4 rounded border border-brown-600/10 bg-cream-50 p-3 text-xs text-brown-600">
            <p>
              Created by <strong className="text-green-950">{personName(historyExpense.recordedBy)}</strong> on{" "}
              {new Date(historyExpense.createdAt).toLocaleString()}
            </p>
            {historyExpense.lastEditedAt && (
              <p className="mt-1">
                Last edited by <strong className="text-green-950">{personName(historyExpense.lastEditedBy)}</strong> on{" "}
                {new Date(historyExpense.lastEditedAt).toLocaleString()}
                {historyExpense.lastEditViaRequest ? " — via an approved edit request" : " — direct edit"}
              </p>
            )}
          </div>
          {historyError ? (
            <p className="text-sm text-danger">{historyError}</p>
          ) : historyLogs === null ? (
            <div className="h-24 animate-pulse rounded-lg bg-cream-200" />
          ) : historyLogs.length === 0 ? (
            <p className="text-sm text-brown-500">No audit trail yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {historyLogs.map((log) => (
                <li key={log._id} className="rounded border border-brown-600/10 p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <ActionBadge action={log.action} />
                    <span className="text-xs text-brown-500">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-brown-600">
                    By <strong className="text-green-950">{actorName(log.actor)}</strong>
                  </p>
                  <p className="mt-1 text-xs text-brown-600">{friendlyNote(log)}</p>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
