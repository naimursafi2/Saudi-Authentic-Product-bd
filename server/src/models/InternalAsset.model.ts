import { Schema, model, type Document, type Model, type Types } from "mongoose";
import type { Role } from "../constants/roles";

/**
 * Central registry for every file uploaded by internal staff, and the whole
 * lifecycle that hangs off it: delete requests, Super Admin review, the
 * Recycle Bin, restoration and permanent deletion.
 *
 * ## Why a registry rather than a field on each model
 *
 * Files themselves stay exactly where they already live — embedded as
 * `{url, publicId}` on Product, Category, Expense, Purchase, HeroSlide and the
 * rest. This model does not replace those, it *indexes* them: one row per
 * uploaded file, pointing back at its owning document through a generic
 * `resource`/`resourceId`/`fieldPath` triple.
 *
 * That keeps the system additive — no existing upload path, product image or
 * parent schema changes — and it means a new internal upload type is supported
 * by recording it here, never by writing another delete/recycle flow. Nothing
 * in this model names a specific feature.
 *
 * ## What is deliberately absent
 *
 * Customer uploads. Review photos and a customer's own avatar are excluded at
 * the recording boundary (see `internalAsset.service.ts#isInternalRole`), so
 * they keep their current immediate-delete behaviour and never appear in the
 * Super Admin dashboard or the Recycle Bin.
 */

export const INTERNAL_ASSET_STATUSES = [
  /** Live and in use by its parent resource. */
  "active",
  /** A staff member has asked for deletion; still live until Super Admin rules on it. */
  "delete_requested",
  /** Deletion approved — recoverable until `purgeAfter`. */
  "recycled",
] as const;
export type InternalAssetStatus = (typeof INTERNAL_ASSET_STATUSES)[number];

/**
 * Broad file family, derived from the upload's MIME type. Kept coarse and
 * open-ended on purpose — this is for filtering the dashboard, not for
 * business logic, and a new upload kind must never require a code change here.
 */
export const INTERNAL_ASSET_KINDS = ["image", "document", "other"] as const;
export type InternalAssetKind = (typeof INTERNAL_ASSET_KINDS)[number];

/** One entry in an asset's lifecycle history. Append-only. */
export interface IInternalAssetEvent {
  action: "uploaded" | "delete_requested" | "delete_rejected" | "recycled" | "restored" | "purge_failed";
  at: Date;
  by?: Types.ObjectId;
  byRole?: Role;
  note?: string;
}

export interface IInternalAsset extends Document {
  _id: Types.ObjectId;

  // -- The file --
  /** Cloudinary's public id. The handle used for both reuse and eventual deletion. */
  publicId: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  kind: InternalAssetKind;
  bytes?: number;

  // -- Where it is used. Deliberately generic: a model name, that document's
  // id, and a dotted path to the field holding the file. No feature is named
  // in code. --
  resource: string;
  resourceId?: string;
  fieldPath?: string;
  /** Human-readable module label for the dashboard, e.g. "Purchases". Free-form. */
  module?: string;

  // -- Ownership --
  uploadedBy: Types.ObjectId;
  uploadedByRole: Role;

  // -- Lifecycle --
  status: InternalAssetStatus;
  deleteRequestedBy?: Types.ObjectId;
  deleteRequestedByRole?: Role;
  deleteRequestedAt?: Date;
  deleteReason?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  /** Set when the request was approved and the asset entered the Recycle Bin. */
  recycledAt?: Date;
  /** When the scheduler may permanently delete it. Null outside the Recycle Bin. */
  purgeAfter?: Date;
  /** Incremented when a permanent deletion attempt fails, so a stuck file is visible rather than lost. */
  purgeAttempts: number;
  purgeError?: string;

  history: IInternalAssetEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IInternalAssetEvent>(
  {
    action: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    byRole: { type: String },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const internalAssetSchema = new Schema<IInternalAsset>(
  {
    // Unique: one registry row per Cloudinary file. Also makes recording
    // idempotent if the same upload is somehow registered twice.
    publicId: { type: String, required: true, unique: true, index: true },
    url: { type: String, required: true },
    fileName: { type: String, trim: true, maxlength: 300 },
    mimeType: { type: String, trim: true, maxlength: 120 },
    kind: { type: String, enum: INTERNAL_ASSET_KINDS, default: "other", index: true },
    bytes: { type: Number, min: 0 },

    resource: { type: String, required: true, index: true },
    resourceId: { type: String, index: true },
    fieldPath: { type: String, trim: true, maxlength: 120 },
    module: { type: String, trim: true, maxlength: 80 },

    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    uploadedByRole: { type: String, required: true, index: true },

    status: { type: String, enum: INTERNAL_ASSET_STATUSES, default: "active", index: true },
    deleteRequestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deleteRequestedByRole: { type: String },
    deleteRequestedAt: { type: Date },
    deleteReason: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    recycledAt: { type: Date },
    purgeAfter: { type: Date, index: true },
    purgeAttempts: { type: Number, default: 0, min: 0 },
    purgeError: { type: String, trim: true, maxlength: 500 },

    history: { type: [eventSchema], default: [] },
  },
  { timestamps: true }
);

// The dashboard's default view and every filtered variant of it.
internalAssetSchema.index({ status: 1, createdAt: -1 });
// Finding an asset from its parent document, e.g. when the parent is edited.
internalAssetSchema.index({ resource: 1, resourceId: 1 });

/** How long an approved deletion stays recoverable in the Recycle Bin. */
export const RECYCLE_BIN_RETENTION_DAYS = 15;

export const InternalAssetModel: Model<IInternalAsset> = model<IInternalAsset>(
  "InternalAsset",
  internalAssetSchema
);
