import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * A shop / sourcing outlet a purchase batch belongs to.
 *
 * Shops exist so purchasing can be partitioned between staff: a Super Admin
 * (and any role holding `shops.manage`) sees every shop, while everyone else
 * — Co-Admin in particular — is scoped server-side to the shops listed in
 * their own `User.assignedShops`. See `purchase.service.ts#resolveShopScope`
 * for the single place that scoping is enforced.
 *
 * Deliberately minimal: a shop is an ownership boundary for purchases, not a
 * second storefront. Nothing on the customer-facing site reads this model.
 */
export interface IShop extends Document {
  _id: Types.ObjectId;
  name: string;
  /** Short human-readable identifier, unique and uppercased (e.g. "MADINAH-1"). */
  code: string;
  location?: string;
  note?: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const shopSchema = new Schema<IShop>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 32 },
    location: { type: String, trim: true, maxlength: 200 },
    note: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const ShopModel: Model<IShop> = model<IShop>("Shop", shopSchema);
