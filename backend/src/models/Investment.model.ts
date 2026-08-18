import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * Partner Investment Ledger (ROLES_AND_PERMISSIONS_v2.md §10): each
 * investment is tracked as its own append-only ledger entry — never
 * overwritten. There is deliberately no update/delete route for this model;
 * a correction is a new entry, not an edit.
 */
export interface IInvestment extends Document {
  _id: Types.ObjectId;
  investorName: string;
  amountBDT: number;
  investedAt: Date;
  note?: string;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const investmentSchema = new Schema<IInvestment>(
  {
    investorName: { type: String, required: true, trim: true, maxlength: 120 },
    amountBDT: { type: Number, required: true, min: 0 },
    investedAt: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, maxlength: 500 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const InvestmentModel: Model<IInvestment> = model<IInvestment>("Investment", investmentSchema);
