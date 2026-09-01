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
  /**
   * Registration email-verification OTP — plaintext, `select: false`, same
   * pattern as Order.model's delivery OTP: short-lived (10 min) with a
   * capped attempt count, so plaintext storage is an acceptable trade-off
   * for not needing a hash-compare step. Cleared once verified or expired.
   */
  emailVerificationOtp?: string;
  emailVerificationOtpExpires?: Date;
  /** Incorrect `verify-registration-otp` attempts against the *current* code — reset
   * to 0 whenever a fresh code is generated (register or resend). */
  emailVerificationOtpAttempts: number;
  tokenVersion: number;
  addresses: IAddress[];
  staffMeta?: IStaffMeta;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastSeenAt?: Date;
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
    emailVerificationOtp: { type: String, select: false },
    emailVerificationOtpExpires: { type: Date },
    emailVerificationOtpAttempts: { type: Number, default: 0, min: 0 },
    tokenVersion: { type: Number, default: 0 },
    addresses: { type: [addressSchema], default: [] },
    staffMeta: { type: staffMetaSchema },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastSeenAt: { type: Date },
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
    delete obj.emailVerificationOtp;
    delete obj.__v;
    return obj;
  },
});

export const UserModel: Model<IUser> = model<IUser>("User", userSchema);
