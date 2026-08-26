import { Schema, model, type Document, type Model, type Types } from "mongoose";
import bcrypt from "bcryptjs";
import { ROLES, type Role } from "../constants/roles";

export interface IAddress {
  _id?: Types.ObjectId;
  label: string;
  fullAddress: string;
  district: string;
  cityArea: string;
  phone: string;
  isDefault: boolean;
}

export interface IStaffMeta {
  employeeId: string;
  department?: string;
  designation?: string;
  joinedAt?: Date;
  baseSalaryBDT?: number;
  nidNumber?: string;
  nidImage?: { url: string; publicId: string };
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: Role;
  /**
   * Optional custom role (VIDEO_EDITOR, DIGITAL_MARKETER, …) layered on top
   * of `role`. It ADDS permissions and never removes the base role's, so
   * assigning one can't quietly demote an account. `role` stays the single
   * source of role identity for every legacy check.
   */
  customRole?: Types.ObjectId;
  phone?: string;
  avatar?: { url: string; publicId: string };
  isActive: boolean;
  isEmailVerified: boolean;
  tokenVersion: number;
  addresses: IAddress[];
  staffMeta?: IStaffMeta;
  /**
   * Shops this staff member may record and view purchases for. Empty (the
   * default) means no shop access at all for a scoped role — a Co-Admin with
   * no assignment sees an empty purchase list rather than everything. Roles
   * holding `shops.manage` bypass this entirely; see
   * `purchase.service.ts#resolveShopScope`.
   */
  assignedShops: Types.ObjectId[];
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastSeenAt?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorPendingSecret?: string;
  twoFactorRecoveryCodes: string[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const addressSchema = new Schema<IAddress>(
  {
    label: { type: String, required: true, trim: true },
    fullAddress: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    cityArea: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const staffMetaSchema = new Schema<IStaffMeta>(
  {
    employeeId: { type: String, trim: true },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    joinedAt: { type: Date },
    baseSalaryBDT: { type: Number, min: 0 },
    nidNumber: { type: String, trim: true },
    nidImage: {
      url: { type: String },
      publicId: { type: String },
    },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: "customer", index: true },
    customRole: { type: Schema.Types.ObjectId, ref: "Role", index: true },
    phone: { type: String, trim: true },
    avatar: {
      url: { type: String },
      publicId: { type: String },
    },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    addresses: { type: [addressSchema], default: [] },
    staffMeta: { type: staffMetaSchema },
    assignedShops: [{ type: Schema.Types.ObjectId, ref: "Shop", index: true }],
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastSeenAt: { type: Date },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorPendingSecret: { type: String, select: false },
    twoFactorRecoveryCodes: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

// Mongoose 9's "save" pre-hooks are promise-based (no `next` callback) —
// just return/await, don't call next().
userSchema.pre("save", async function preSave() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.password;
    delete obj.twoFactorSecret;
    delete obj.twoFactorPendingSecret;
    delete obj.twoFactorRecoveryCodes;
    delete obj.__v;
    return obj;
  },
});

export const UserModel: Model<IUser> = model<IUser>("User", userSchema);
