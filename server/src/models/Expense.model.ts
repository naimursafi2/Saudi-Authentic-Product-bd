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
export interface IExpense extends Document {
  _id: Types.ObjectId;
  category: ExpenseCategory;
  amountBDT: number;
  incurredAt: Date;
  note?: string;
  status: ExpenseStatus;
  recordedBy: Types.ObjectId;
  recordedByRole: string;
  confirmedBy?: Types.ObjectId;
  confirmedAt?: Date;
  reviewNote?: string;
  /** Set when this expense was auto-created by an approved refund. */
  linkedRefund?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    category: { type: String, required: true, enum: EXPENSE_CATEGORIES, index: true },
    amountBDT: { type: Number, required: true, min: 0 },
    incurredAt: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: EXPENSE_STATUSES, default: "pending", index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedByRole: { type: String, required: true },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    confirmedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    linkedRefund: { type: Schema.Types.ObjectId, ref: "Refund" },
  },
  { timestamps: true }
);

export const ExpenseModel: Model<IExpense> = model<IExpense>("Expense", expenseSchema);
