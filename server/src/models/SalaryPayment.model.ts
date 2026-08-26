import { Schema, model, type Document, type Model, type Types } from "mongoose";

export type SalaryPaymentStatus = "pending" | "paid";

export interface ISalaryPayment extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  month: number; // 1-12
  year: number;
  amountBDT: number;
  /** Daily allowance (TA/DA-style) paid alongside base salary for this month —
   * a manually-entered line item, same convention as `amountBDT` itself
   * (there is no automatic attendance-based computation). Total payable is
   * `amountBDT + dailyAllowanceBDT`, computed wherever the payment is shown. */
  dailyAllowanceBDT: number;
  status: SalaryPaymentStatus;
  paidAt?: Date;
  note?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const salaryPaymentSchema = new Schema<ISalaryPayment>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    amountBDT: { type: Number, required: true, min: 0 },
    dailyAllowanceBDT: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["pending", "paid"], default: "pending", index: true },
    paidAt: { type: Date },
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// One salary record per employee per calendar month.
salaryPaymentSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

export const SalaryPaymentModel: Model<ISalaryPayment> = model<ISalaryPayment>(
  "SalaryPayment",
  salaryPaymentSchema
);
