import { Schema, model, type Document, type Model, type Types } from "mongoose";

export const EXPENSE_CATEGORIES = [
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
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = ["pending", "confirmed", "rejected"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

/**
 * `admin`/`super_admin`-recorded expenses are created already `confirmed`.
 * `co_admin`-submitted expenses always start `pending` and need an
 * `admin`/`super_admin` to confirm (or, above the approval threshold, a
 * Super Admin grant — see `finance.service.ts`). A `confirmed` expense is
 * immutable — there is no update/delete route once confirmed.
 */
export interface IExpenseCashMemo {
  url: string;
  /** Absent when `url` is a pasted external link rather than a Cloudinary upload
   * (offered when the chosen file exceeds the 2MB upload limit). */
  publicId?: string;
}

export interface IExpense extends Document {
  _id: Types.ObjectId;
  category: ExpenseCategory;
  amountBDT: number;
  incurredAt: Date;
  reason: string;
  /** Required only when `category === "other"` — what the expense actually was. */
  otherCategoryDetail?: string;
  note?: string;
  cashMemo?: IExpenseCashMemo;
  status: ExpenseStatus;
  recordedBy: Types.ObjectId;
  recordedByRole: string;
  confirmedBy?: Types.ObjectId;
  confirmedAt?: Date;
  reviewNote?: string;
  /** Set when this expense was auto-created by an approved refund. */
  linkedRefund?: Types.ObjectId;
  /**
   * Lightweight, display-only edit metadata — "was this record edited, when,
   * and by whom" for the UI. The actual before/after field values live in
   * `AuditLog` (see `expense.service.ts#updateExpenseDirect`/the
   * `expense.edit` grant handler), not duplicated here — this is the same
   * "presentation-only data, not a new source of truth" convention
   * `user.service.ts`'s audit-log `name`/`targetEmail` stash already follows.
   */
  lastEditedAt?: Date;
  /** Whoever's action actually changed the record — a direct Super Admin edit, or the Super Admin who granted an edit request. */
  lastEditedBy?: Types.ObjectId;
  /** True when the edit was applied through an approved `expense.edit` request rather than a direct edit. */
  lastEditViaRequest: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const expenseCashMemoSchema = new Schema<IExpenseCashMemo>(
  {
    url: { type: String, required: true },
    publicId: { type: String },
  },
  { _id: false }
);

const expenseSchema = new Schema<IExpense>(
  {
    category: { type: String, required: true, enum: EXPENSE_CATEGORIES, index: true },
    amountBDT: { type: Number, required: true, min: 0 },
    incurredAt: { type: Date, required: true, default: Date.now },
    // Required — why the expense was made, distinct from `note` (optional,
    // freeform extra context added at submission time).
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    otherCategoryDetail: { type: String, trim: true, maxlength: 200 },
    note: { type: String, trim: true, maxlength: 500 },
    // Optional receipt/cash-memo photo, uploaded to Cloudinary the same way
    // every other single-image upload in this project is (see
    // `expense.service.ts#createExpense`).
    cashMemo: { type: expenseCashMemoSchema },
    status: { type: String, enum: EXPENSE_STATUSES, default: "pending", index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedByRole: { type: String, required: true },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    confirmedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    linkedRefund: { type: Schema.Types.ObjectId, ref: "Refund" },
    lastEditedAt: { type: Date },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastEditViaRequest: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ExpenseModel: Model<IExpense> = model<IExpense>("Expense", expenseSchema);
