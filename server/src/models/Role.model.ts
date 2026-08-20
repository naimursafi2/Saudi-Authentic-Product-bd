import { Schema, model, type Document, type Model, type Types } from "mongoose";
import { PERMISSIONS } from "../constants/permissions";

/**
 * A named bundle of permissions.
 *
 * Two kinds live in this collection:
 *
 * - **System roles** (`isSystem: true`) — one per entry in `ROLES`, seeded
 *   from `ROLE_DEFAULT_PERMISSIONS`. Their `key` matches `User.role` exactly,
 *   which is what keeps the whole legacy role system working: every existing
 *   user already points at one of these by virtue of the role string it
 *   already has. They can be re-permissioned but never renamed or deleted.
 * - **Custom roles** (`isSystem: false`) — created from the admin panel
 *   (VIDEO_EDITOR, DIGITAL_MARKETER, …). A user is assigned one through
 *   `User.customRole` *in addition to* their built-in `role`, so custom roles
 *   add capability and never take the base role's away.
 */
export interface IRole extends Document {
  _id: Types.ObjectId;
  /** Uppercase snake-case identifier, e.g. "DIGITAL_MARKETER". Immutable. */
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  /** True for the seven built-in roles; blocks rename/delete. */
  isSystem: boolean;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    key: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300 },
    permissions: [{ type: String, enum: PERMISSIONS }],
    isSystem: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const RoleModel: Model<IRole> = model<IRole>("Role", roleSchema);
