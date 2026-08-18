import { ExpenseModel, type IExpense } from "../models/Expense.model";
import { ApiError } from "../utils/ApiError";
import { getApprovalSettings } from "./approvalSettings.service";
import { createPendingAction, registerPendingActionHandler } from "./pendingAction.service";
import { recordAuditLog } from "./auditLog.service";
import type { CreateExpenseInput } from "../validators/expense.validator";
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
export async function createExpense(input: CreateExpenseInput, actor: ExpenseActor) {
  if (actor.role === "admin" || actor.role === "super_admin") {
    const expense = await ExpenseModel.create({
      ...input,
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

export async function listExpenses(
  filter: { status?: string; category?: string; page: number; limit: number },
  viewer: ExpenseActor
) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.category) query.category = filter.category;
  // co_admin only ever sees their own submissions — admin/super_admin see everything.
  if (viewer.role === "co_admin") query.recordedBy = viewer.id;

  const skip = (filter.page - 1) * filter.limit;
  const [expenses, total] = await Promise.all([
    ExpenseModel.find(query)
      .populate("recordedBy", "name email")
      .populate("confirmedBy", "name email")
      .sort({ createdAt: -1 })
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
