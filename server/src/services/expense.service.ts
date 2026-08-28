import { Types } from "mongoose";
import { ExpenseModel, type IExpense } from "../models/Expense.model";
import { ApiError } from "../utils/ApiError";
import { uploadBufferToCloudinary } from "../config/cloudinary";
import { getApprovalSettings } from "./approvalSettings.service";
import { createPendingAction, registerPendingActionHandler } from "./pendingAction.service";
import { recordAuditLog } from "./auditLog.service";
import type { CreateExpenseInput, EditExpenseFields } from "../validators/expense.validator";
import type { Role } from "../constants/roles";

export interface ExpenseActor {
  id: string;
  role: Role;
}

/**
 * `admin`/`super_admin` entries are confirmed immediately. `co_admin`
 * entries always start `pending` (per ROLES_AND_PERMISSIONS_v2.md §6: "can
 * submit expense requests for approval"); if the amount is above the
 * Super-Admin-editable threshold, a pending action is also created so it
 * surfaces in the Super Admin's grant queue (§19), in addition to being
 * directly confirmable by an admin/super_admin below that threshold.
 */
export async function createExpense(
  input: CreateExpenseInput,
  actor: ExpenseActor,
  cashMemoFile?: Express.Multer.File
) {
  // A pasted URL (offered client-side when the chosen file exceeds the 2MB
  // upload limit) takes precedence over a file — the client only ever sends
  // one or the other, never both, but a file is the more deliberate action
  // if somehow both arrived.
  const cashMemo = cashMemoFile
    ? await uploadBufferToCloudinary(cashMemoFile.buffer, {
        folder: "saudi-authentic-product/expense-cash-memos",
      }).then((img) => ({ url: img.url, publicId: img.publicId }))
    : input.cashMemoUrl
      ? { url: input.cashMemoUrl }
      : undefined;

  if (actor.role === "admin" || actor.role === "super_admin") {
    const expense = await ExpenseModel.create({
      ...input,
      cashMemo,
      recordedBy: actor.id,
      recordedByRole: actor.role,
      status: "confirmed",
      confirmedBy: actor.id,
      confirmedAt: new Date(),
    });
    await recordAuditLog({
      actor: actor.id,
      actorRole: actor.role,
      action: "expense.create",
      resource: "Expense",
      resourceId: expense._id.toString(),
      newValue: input,
      note: "Auto-confirmed",
    });
    return expense;
  }

  // co_admin
  const expense = await ExpenseModel.create({
    ...input,
    cashMemo,
    recordedBy: actor.id,
    recordedByRole: actor.role,
    status: "pending",
  });
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "expense.create",
    resource: "Expense",
    resourceId: expense._id.toString(),
    newValue: input,
    note: "Submitted for approval",
  });

  const settings = await getApprovalSettings();
  if (input.amountBDT > settings.expenseApprovalThresholdBDT) {
    await createPendingAction("expense.confirm", { expenseId: expense._id.toString() }, actor);
  }

  return expense;
}

/** `"2026-08"` -> the `[start, end)` UTC range `incurredAt` must fall within — the same month key `getExpenseMonthSummaries` groups by. */
function monthRange(month: string): { $gte: Date; $lt: Date } {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(Date.UTC(year, m, 1));
  return { $gte: start, $lt: end };
}

export async function listExpenses(
  filter: { status?: string; category?: string; month?: string; page: number; limit: number },
  viewer: ExpenseActor
) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.category) query.category = filter.category;
  if (filter.month) query.incurredAt = monthRange(filter.month);
  // co_admin only ever sees their own submissions — admin/super_admin see
  // everything. `employee` also sees everything (unscoped), mirroring how
  // `orders.view`/`inventory.view` already give Employee a full read-only
  // list rather than a self-scoped one — an Employee never *submits* an
  // expense (no `expenses.create`), so self-scoping would leave them with
  // nothing to ever request an edit on.
  if (viewer.role === "co_admin") query.recordedBy = viewer.id;

  const skip = (filter.page - 1) * filter.limit;
  const [expenses, total] = await Promise.all([
    ExpenseModel.find(query)
      .populate("recordedBy", "name email")
      .populate("confirmedBy", "name email")
      .populate("lastEditedBy", "name email")
      .sort({ incurredAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    ExpenseModel.countDocuments(query),
  ]);

  return {
    expenses,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

/**
 * One row per calendar month that has at least one expense, newest month
 * first — "Monthly Expense Pages / Archive". Computed live via aggregation,
 * not a separately-maintained "period" record — a new month needs no setup,
 * it simply appears the first time an expense is recorded against it, and a
 * past month stays archived (still returned, at its own totals) forever.
 * Respects the same viewer-scoping `listExpenses` applies, so a Co-Admin's
 * (or Employee's) monthly archive only ever totals their own submissions.
 */
export async function getExpenseMonthSummaries(viewer: ExpenseActor) {
  const match: Record<string, unknown> = {};
  // Aggregation `$match` is sent straight to MongoDB with no Mongoose query
  // casting (unlike `.find()`), so a plain id string would never match an
  // ObjectId field — must cast explicitly.
  if (viewer.role === "co_admin") match.recordedBy = new Types.ObjectId(viewer.id);

  const rows = await ExpenseModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$incurredAt" } },
        totalBDT: { $sum: "$amountBDT" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  return rows.map((r) => ({ month: r._id as string, totalBDT: r.totalBDT as number, count: r.count as number }));
}

async function loadPendingExpense(id: string): Promise<IExpense> {
  const expense = await ExpenseModel.findById(id);
  if (!expense) throw ApiError.notFound("Expense not found");
  if (expense.status !== "pending") {
    throw ApiError.badRequest(`This expense is already ${expense.status}`);
  }
  return expense;
}

/**
 * Guards against an `admin` bypassing the Super-Admin-grant requirement by
 * hitting this endpoint directly for an over-threshold expense — the grant
 * flow (always `super_admin`) satisfies this check trivially.
 */
export async function confirmExpense(id: string, reviewer: ExpenseActor, reviewNote?: string) {
  const expense = await loadPendingExpense(id);

  const settings = await getApprovalSettings();
  if (expense.amountBDT > settings.expenseApprovalThresholdBDT && reviewer.role !== "super_admin") {
    throw ApiError.forbidden("Expenses above the approval threshold require Super Admin approval");
  }

  expense.status = "confirmed";
  expense.confirmedBy = reviewer.id as unknown as IExpense["confirmedBy"];
  expense.confirmedAt = new Date();
  expense.reviewNote = reviewNote;
  await expense.save();

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: "expense.confirm",
    resource: "Expense",
    resourceId: expense._id.toString(),
    newValue: { status: "confirmed" },
    note: reviewNote,
  });

  return expense;
}

export async function rejectExpense(id: string, reviewer: ExpenseActor, reviewNote?: string) {
  const expense = await loadPendingExpense(id);

  expense.status = "rejected";
  expense.confirmedBy = reviewer.id as unknown as IExpense["confirmedBy"];
  expense.confirmedAt = new Date();
  expense.reviewNote = reviewNote;
  await expense.save();

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: "expense.reject",
    resource: "Expense",
    resourceId: expense._id.toString(),
    newValue: { status: "rejected" },
    note: reviewNote,
  });

  return expense;
}

/** Internal helper reused by `refund.service.ts` to auto-log a confirmed expense for an approved refund. */
export async function createConfirmedExpense(input: {
  category: "refund";
  amountBDT: number;
  note?: string;
  linkedRefund: string;
  actor: ExpenseActor;
}) {
  const expense = await ExpenseModel.create({
    category: input.category,
    amountBDT: input.amountBDT,
    incurredAt: new Date(),
    reason: "Customer refund",
    note: input.note,
    status: "confirmed",
    recordedBy: input.actor.id,
    recordedByRole: input.actor.role,
    confirmedBy: input.actor.id,
    confirmedAt: new Date(),
    linkedRefund: input.linkedRefund,
  });
  await recordAuditLog({
    actor: input.actor.id,
    actorRole: input.actor.role,
    action: "expense.create",
    resource: "Expense",
    resourceId: expense._id.toString(),
    newValue: { category: input.category, amountBDT: input.amountBDT, linkedRefund: input.linkedRefund },
    note: "Auto-logged from refund approval",
  });
  return expense;
}

registerPendingActionHandler("expense.confirm", async (payload, reviewer) => {
  const expense = await confirmExpense(payload.expenseId as string, reviewer);
  return { resource: "Expense", resourceId: expense._id.toString() };
});

// -- Editing (direct + request-based) ------------------------------------
//
// Editing a confirmed expense is otherwise-final financial history, so it
// follows the same "only Super Admin acts directly, everyone else requests
// a grant" shape already established for stock changes, product deletion,
// and purchase receipts — not a bespoke rule for expenses.

const EDITABLE_EXPENSE_FIELDS = [
  "category",
  "amountBDT",
  "incurredAt",
  "reason",
  "otherCategoryDetail",
  "note",
] as const;

/** Same shape as `product.service.ts#diffProductFields` — only the fields actually present in `changes` are compared/recorded. */
function diffExpenseFields(before: IExpense, changes: EditExpenseFields) {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of EDITABLE_EXPENSE_FIELDS) {
    const next = (changes as Record<string, unknown>)[field];
    if (next === undefined) continue;
    const previous = (before as unknown as Record<string, unknown>)[field];
    const previousComparable = previous instanceof Date ? previous.toISOString() : previous;
    const nextComparable = next instanceof Date ? (next as Date).toISOString() : next;
    if (previousComparable !== nextComparable) diff[field] = { from: previous, to: next };
  }
  return diff;
}

/** Rejects a change that would leave the expense as `category: "other"` with no `otherCategoryDetail` — same rule `createExpenseSchema` enforces at submission time. */
function assertOtherCategoryDetail(before: IExpense, changes: EditExpenseFields): void {
  const resultingCategory = changes.category ?? before.category;
  const resultingDetail = changes.otherCategoryDetail ?? before.otherCategoryDetail;
  if (resultingCategory === "other" && !resultingDetail?.trim()) {
    throw ApiError.badRequest('Please specify the expense purpose for the "Other" category');
  }
}

function applyExpenseChanges(expense: IExpense, changes: EditExpenseFields): void {
  for (const field of EDITABLE_EXPENSE_FIELDS) {
    const value = (changes as Record<string, unknown>)[field];
    if (value !== undefined) (expense as unknown as Record<string, unknown>)[field] = value;
  }
}

/**
 * Direct edit — `expenses.edit` only (Super Admin by default; not even
 * Admin, matching this project's "even Admin is gated" convention for
 * high-trust corrections). Works on an expense of any status; a `confirmed`
 * one is otherwise immutable, so this is the one sanctioned way to correct
 * one after the fact. Records the field-level before/after diff on the
 * audit log — never silently overwrites history, the old values stay
 * queryable at `/admin/audit-logs`.
 */
export async function updateExpenseDirect(
  id: string,
  changes: EditExpenseFields,
  actor: ExpenseActor
): Promise<IExpense> {
  const expense = await ExpenseModel.findById(id);
  if (!expense) throw ApiError.notFound("Expense not found");

  assertOtherCategoryDetail(expense, changes);
  const diff = diffExpenseFields(expense, changes);
  if (Object.keys(diff).length === 0) return expense;

  applyExpenseChanges(expense, changes);
  expense.lastEditedAt = new Date();
  expense.lastEditedBy = actor.id as unknown as IExpense["lastEditedBy"];
  expense.lastEditViaRequest = false;
  await expense.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "expense.edit",
    resource: "Expense",
    resourceId: expense._id.toString(),
    oldValue: Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.from])),
    newValue: Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.to])),
    note: `Directly edited: ${Object.keys(diff).join(", ")}`,
  });

  return expense;
}

/**
 * Delete — `expenses.edit` only, same reasoning as the direct edit above.
 * There is still no delete route for any other role; a mistaken `pending`
 * submission is simply rejected, not deleted, everywhere but here.
 */
export async function deleteExpense(id: string, actor: ExpenseActor): Promise<void> {
  const expense = await ExpenseModel.findById(id);
  if (!expense) throw ApiError.notFound("Expense not found");

  await expense.deleteOne();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "expense.delete",
    resource: "Expense",
    resourceId: id,
    oldValue: {
      category: expense.category,
      amountBDT: expense.amountBDT,
      incurredAt: expense.incurredAt,
      reason: expense.reason,
      status: expense.status,
    },
  });
}

/**
 * Anyone holding `expenses.requestEdit` (Employee, Co-Admin, Admin — never
 * Super Admin, which edits directly) parks the intended change in the same
 * `pending_actions` queue the rest of the Grant-Based Approval Workflow
 * uses, reviewed **exclusively by Super Admin** through the existing
 * `/pending-actions/:id/grant`|`/deny` endpoints — no separate
 * approval/authorization system. The live record is untouched until then.
 */
export async function requestExpenseEdit(
  id: string,
  changes: EditExpenseFields,
  reason: string,
  actor: ExpenseActor
): Promise<{ pendingActionId: string }> {
  const expense = await ExpenseModel.findById(id);
  if (!expense) throw ApiError.notFound("Expense not found");

  assertOtherCategoryDetail(expense, changes);
  const diff = diffExpenseFields(expense, changes);
  if (Object.keys(diff).length === 0) {
    throw ApiError.badRequest("The requested changes match the expense's current values");
  }

  const action = await createPendingAction(
    "expense.edit",
    {
      expenseId: expense._id.toString(),
      changes,
      // `code` — not an arbitrary key — is one of the fields
      // `pendingAction.service.ts#payloadLabel()` (and the frontend's mirror,
      // `auditLogDisplay.tsx#extractName()`) already looks for, so the audit
      // log/approval queue shows this as the request's display name for free.
      code: `${expense.category} · ${expense.amountBDT} BDT · ${expense.reason}`,
    },
    actor,
    reason
  );

  return { pendingActionId: action._id.toString() };
}

registerPendingActionHandler("expense.edit", async (payload, reviewer) => {
  const expenseId = payload.expenseId as string;
  const changes = payload.changes as EditExpenseFields;

  const expense = await ExpenseModel.findById(expenseId);
  if (!expense) throw ApiError.notFound("Expense not found");

  // Re-validated at grant time, same reasoning `product.create`'s grant
  // handler re-validates its slug/categories — the record may have changed
  // while the request sat in the queue.
  assertOtherCategoryDetail(expense, changes);
  const diff = diffExpenseFields(expense, changes);

  applyExpenseChanges(expense, changes);
  expense.lastEditedAt = new Date();
  expense.lastEditedBy = reviewer.id as unknown as IExpense["lastEditedBy"];
  expense.lastEditViaRequest = true;
  await expense.save();

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: "expense.edit",
    resource: "Expense",
    resourceId: expense._id.toString(),
    oldValue: Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.from])),
    newValue: Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.to])),
    note: "Applied via approval grant",
  });

  return { resource: "Expense", resourceId: expense._id.toString() };
});
