import {
  InternalAssetModel,
  RECYCLE_BIN_RETENTION_DAYS,
  type IInternalAsset,
  type InternalAssetKind,
  type InternalAssetStatus,
} from "../models/InternalAsset.model";
import {
  deleteCloudinaryImage,
  uploadBufferToCloudinary,
  type UploadedImage,
} from "../config/cloudinary";
import { recordAuditLog } from "./auditLog.service";
import { ApiError } from "../utils/ApiError";
import type { Role } from "../constants/roles";

export interface AssetActor {
  id: string;
  role: Role;
}

/**
 * Roles whose uploads this system governs. A customer is deliberately absent:
 * their review photos and avatars keep the existing immediate-delete behaviour
 * and never enter the registry, the dashboard or the Recycle Bin.
 *
 * `delivery_agent` is included because a delivery-proof photo is an internal
 * operational record, not a customer upload — the exclusion here is about
 * customers, not about seniority.
 */
const INTERNAL_UPLOAD_ROLES: Role[] = [
  "employee",
  "delivery_agent",
  "order_manager",
  "co_admin",
  "admin",
  "super_admin",
];

export function isInternalRole(role: Role): boolean {
  return INTERNAL_UPLOAD_ROLES.includes(role);
}

function kindFromMimeType(mimeType?: string): InternalAssetKind {
  if (!mimeType) return "other";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) return "document";
  return "other";
}

export interface RecordAssetInput {
  publicId: string;
  url: string;
  /** Mongoose model name the file hangs off, e.g. "Purchase". Never hardcoded per feature. */
  resource: string;
  resourceId?: string;
  /** Dotted path to the field holding it, e.g. "costItems.proof". */
  fieldPath?: string;
  /** Display label for the dashboard's module filter. */
  module?: string;
  fileName?: string;
  mimeType?: string;
  bytes?: number;
  actor: AssetActor;
}

/**
 * Registers one internally-uploaded file. Call this straight after a
 * successful `uploadBufferToCloudinary` in any service that accepts a staff
 * upload.
 *
 * **Never throws** — same contract as `recordAuditLog`. Bookkeeping must not
 * be able to fail the upload it is describing; a lost registry row is a
 * reporting gap, whereas a thrown error here would lose the user's work.
 *
 * Returns the row, or null when the upload is a customer's (and so outside
 * this system) or when recording failed.
 */
export async function recordInternalAsset(input: RecordAssetInput): Promise<IInternalAsset | null> {
  if (!isInternalRole(input.actor.role)) return null;

  try {
    // Upsert on publicId: re-registering the same Cloudinary file is a no-op
    // rather than a duplicate-key error.
    return await InternalAssetModel.findOneAndUpdate(
      { publicId: input.publicId },
      {
        $setOnInsert: {
          publicId: input.publicId,
          url: input.url,
          fileName: input.fileName,
          mimeType: input.mimeType,
          kind: kindFromMimeType(input.mimeType),
          bytes: input.bytes,
          resource: input.resource,
          resourceId: input.resourceId,
          fieldPath: input.fieldPath,
          module: input.module,
          uploadedBy: input.actor.id,
          uploadedByRole: input.actor.role,
          status: "active",
          history: [
            { action: "uploaded", at: new Date(), by: input.actor.id, byRole: input.actor.role },
          ],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error(
      `[assets] failed to register upload ${input.publicId}:`,
      (err as Error).message
    );
    return null;
  }
}

export interface UploadInternalFileOptions {
  folder: string;
  /** Mongoose model name the file hangs off, e.g. "Purchase". */
  resource: string;
  resourceId?: string;
  fieldPath?: string;
  module?: string;
  actor: AssetActor;
}

/**
 * The one call a service makes to accept a staff upload: puts the file on
 * Cloudinary and registers it, in that order.
 *
 * Call sites keep their existing shape — this returns the same `UploadedImage`
 * `uploadBufferToCloudinary` did — so adopting it is a one-line swap rather
 * than a rewrite, and registration can never be forgotten at a new upload
 * site because there is nothing extra to remember.
 *
 * Registration is best-effort and never throws (see `recordInternalAsset`), so
 * a bookkeeping problem cannot lose the customer's or staff member's file.
 */
export async function uploadInternalFile(
  file: Express.Multer.File,
  options: UploadInternalFileOptions
): Promise<UploadedImage> {
  const uploaded = await uploadBufferToCloudinary(file.buffer, { folder: options.folder });

  await recordInternalAsset({
    publicId: uploaded.publicId,
    url: uploaded.url,
    resource: options.resource,
    resourceId: options.resourceId,
    fieldPath: options.fieldPath,
    module: options.module,
    fileName: file.originalname,
    mimeType: file.mimetype,
    bytes: file.size,
    actor: options.actor,
  });

  return uploaded;
}

function pushHistory(asset: IInternalAsset, event: IInternalAsset["history"][number]) {
  asset.history.push(event);
}

/**
 * The replacement for a bare `deleteCloudinaryImage(publicId)` anywhere staff
 * remove or replace a file.
 *
 * Instead of destroying the file, this routes it into the lifecycle: a
 * registered internal asset is put into `delete_requested` and its Cloudinary
 * file is **left intact**, so a Super Admin can still reject the request or
 * restore the file afterwards.
 *
 * The parent operation itself is unaffected — a product edit still drops the
 * image from the product, a logo change still swaps the logo. What changes is
 * only that the underlying file survives until Super Admin rules on it, which
 * is exactly the protection asked for without rewriting ten services'
 * semantics.
 *
 * Falls back to immediate deletion when the file is not a tracked internal
 * asset — customer review photos and customer avatars, and any file uploaded
 * before this system existed — so existing behaviour is preserved rather than
 * silently changed.
 *
 * Never throws: file cleanup must not fail the operation that triggered it,
 * which matches the old `deleteCloudinaryImage` contract every call site was
 * written against.
 */
export async function retireInternalAsset(
  publicId: string | undefined,
  actor: AssetActor | null,
  reason?: string
): Promise<void> {
  if (!publicId) return;

  try {
    const asset = await InternalAssetModel.findOne({ publicId });

    if (!asset || !actor || !isInternalRole(actor.role)) {
      await deleteCloudinaryImage(publicId);
      return;
    }
    // Already in the lifecycle — leave whatever state it is in alone.
    if (asset.status !== "active") return;

    asset.status = "delete_requested";
    asset.deleteRequestedBy = actor.id as unknown as IInternalAsset["deleteRequestedBy"];
    asset.deleteRequestedByRole = actor.role;
    asset.deleteRequestedAt = new Date();
    asset.deleteReason = reason;
    pushHistory(asset, {
      action: "delete_requested",
      at: new Date(),
      by: actor.id as unknown as IInternalAsset["history"][number]["by"],
      byRole: actor.role,
      note: reason,
    });
    await asset.save();

    await recordAuditLog({
      actor: actor.id,
      actorRole: actor.role,
      action: "internalAsset.delete.request",
      resource: "InternalAsset",
      resourceId: asset._id.toString(),
      newValue: { fileName: asset.fileName, resource: asset.resource, module: asset.module },
      note: reason ?? "File removed from its parent record; awaiting Super Admin review.",
    });
  } catch (err) {
    console.error(`[assets] failed to retire ${publicId}:`, (err as Error).message);
  }
}

/**
 * A staff member asks for a file to be deleted. Nothing is removed: the asset
 * stays live and in use until a Super Admin rules on the request, which is the
 * whole point — an internal upload can never be destroyed by the person who
 * uploaded it.
 */
export async function requestAssetDeletion(
  assetId: string,
  actor: AssetActor,
  reason?: string
): Promise<IInternalAsset> {
  const asset = await InternalAssetModel.findById(assetId);
  if (!asset) throw ApiError.notFound("File not found");

  if (asset.status === "delete_requested") {
    throw ApiError.conflict("A deletion request for this file is already awaiting review");
  }
  if (asset.status !== "active") {
    throw ApiError.badRequest(`This file is ${asset.status} and cannot be requested for deletion`);
  }

  asset.status = "delete_requested";
  asset.deleteRequestedBy = actor.id as unknown as IInternalAsset["deleteRequestedBy"];
  asset.deleteRequestedByRole = actor.role;
  asset.deleteRequestedAt = new Date();
  asset.deleteReason = reason;
  pushHistory(asset, {
    action: "delete_requested",
    at: new Date(),
    by: actor.id as unknown as IInternalAsset["history"][number]["by"],
    byRole: actor.role,
    note: reason,
  });
  await asset.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "internalAsset.delete.request",
    resource: "InternalAsset",
    resourceId: asset._id.toString(),
    newValue: { fileName: asset.fileName, resource: asset.resource, module: asset.module },
    note: reason ?? "Deletion requested; awaiting Super Admin review.",
  });

  return asset;
}

/** Super Admin declines the request. The file stays exactly as it was. */
export async function rejectAssetDeletion(
  assetId: string,
  actor: AssetActor,
  reviewNote?: string
): Promise<IInternalAsset> {
  const asset = await InternalAssetModel.findById(assetId);
  if (!asset) throw ApiError.notFound("File not found");
  if (asset.status !== "delete_requested") {
    throw ApiError.badRequest("This file has no deletion request awaiting review");
  }

  asset.status = "active";
  asset.reviewedBy = actor.id as unknown as IInternalAsset["reviewedBy"];
  asset.reviewedAt = new Date();
  asset.reviewNote = reviewNote;
  pushHistory(asset, {
    action: "delete_rejected",
    at: new Date(),
    by: actor.id as unknown as IInternalAsset["history"][number]["by"],
    byRole: actor.role,
    note: reviewNote,
  });
  await asset.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "internalAsset.delete.reject",
    resource: "InternalAsset",
    resourceId: asset._id.toString(),
    newValue: { fileName: asset.fileName },
    note: reviewNote ?? "Deletion request rejected; the file remains active.",
  });

  return asset;
}

/**
 * Super Admin approves the request: the asset moves to the Recycle Bin and
 * becomes restorable for the retention window.
 *
 * **The Cloudinary file is deliberately left in place.** That is what makes a
 * restore free — the original file is reused rather than re-uploaded — and it
 * is why permanent deletion is a separate, later step.
 */
export async function approveAssetDeletion(
  assetId: string,
  actor: AssetActor,
  reviewNote?: string
): Promise<IInternalAsset> {
  const asset = await InternalAssetModel.findById(assetId);
  if (!asset) throw ApiError.notFound("File not found");
  if (asset.status !== "delete_requested") {
    throw ApiError.badRequest("This file has no deletion request awaiting review");
  }

  const now = new Date();
  asset.status = "recycled";
  asset.reviewedBy = actor.id as unknown as IInternalAsset["reviewedBy"];
  asset.reviewedAt = now;
  asset.reviewNote = reviewNote;
  asset.recycledAt = now;
  asset.purgeAfter = new Date(now.getTime() + RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  pushHistory(asset, {
    action: "recycled",
    at: now,
    by: actor.id as unknown as IInternalAsset["history"][number]["by"],
    byRole: actor.role,
    note: reviewNote,
  });
  await asset.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "internalAsset.delete.approve",
    resource: "InternalAsset",
    resourceId: asset._id.toString(),
    newValue: { fileName: asset.fileName, purgeAfter: asset.purgeAfter },
    note: `Moved to the Recycle Bin; recoverable for ${RECYCLE_BIN_RETENTION_DAYS} days.`,
  });

  return asset;
}

/**
 * Brings a recycled asset back. The Cloudinary file was never removed, so the
 * original `url`/`publicId` are simply reactivated — no re-upload, no
 * duplicate file, and the parent document's existing reference keeps working.
 */
export async function restoreAsset(assetId: string, actor: AssetActor): Promise<IInternalAsset> {
  const asset = await InternalAssetModel.findById(assetId);
  if (!asset) throw ApiError.notFound("File not found");
  if (asset.status === "purged") {
    throw ApiError.badRequest("This file was permanently deleted and cannot be restored");
  }
  if (asset.status !== "recycled") {
    throw ApiError.badRequest("Only files in the Recycle Bin can be restored");
  }

  asset.status = "active";
  asset.recycledAt = undefined;
  asset.purgeAfter = undefined;
  asset.deleteRequestedBy = undefined;
  asset.deleteRequestedByRole = undefined;
  asset.deleteRequestedAt = undefined;
  asset.deleteReason = undefined;
  pushHistory(asset, {
    action: "restored",
    at: new Date(),
    by: actor.id as unknown as IInternalAsset["history"][number]["by"],
    byRole: actor.role,
  });
  await asset.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "internalAsset.restore",
    resource: "InternalAsset",
    resourceId: asset._id.toString(),
    newValue: { fileName: asset.fileName, resource: asset.resource },
    note: "Restored from the Recycle Bin; the original file was reused.",
  });

  return asset;
}

/**
 * Removes the file from Cloudinary for good and marks the row `purged`.
 *
 * The row itself is kept rather than deleted: it is the permanent audit record
 * of a file that existed, who uploaded it, who approved its removal and when
 * it went. A `purged` asset can never be restored.
 *
 * Returns false and records the failure instead of throwing when Cloudinary
 * cleanup fails, so the scheduler can move on and retry this one later rather
 * than losing track of the file.
 */
export async function purgeAsset(
  asset: IInternalAsset,
  actor: AssetActor | null,
  note: string
): Promise<boolean> {
  try {
    await deleteCloudinaryImage(asset.publicId);
  } catch (err) {
    asset.purgeAttempts += 1;
    asset.purgeError = (err as Error).message;
    pushHistory(asset, {
      action: "purge_failed",
      at: new Date(),
      by: actor?.id as unknown as IInternalAsset["history"][number]["by"],
      byRole: actor?.role,
      note: asset.purgeError,
    });
    await asset.save();
    console.error(`[assets] permanent deletion failed for ${asset.publicId}:`, asset.purgeError);
    return false;
  }

  asset.status = "purged";
  asset.purgedAt = new Date();
  asset.purgeError = undefined;
  pushHistory(asset, {
    action: "purged",
    at: new Date(),
    by: actor?.id as unknown as IInternalAsset["history"][number]["by"],
    byRole: actor?.role,
    note,
  });
  await asset.save();

  if (actor) {
    await recordAuditLog({
      actor: actor.id,
      actorRole: actor.role,
      action: "internalAsset.purge",
      resource: "InternalAsset",
      resourceId: asset._id.toString(),
      oldValue: { publicId: asset.publicId, fileName: asset.fileName },
      note,
    });
  }
  return true;
}

/**
 * Purges files by their Cloudinary ids, for the case where a Super Admin has
 * *already* ruled against the thing that owned them — a denied `product.create`
 * submission, say, whose images were uploaded up front so the reviewer could
 * see the real photos.
 *
 * Routing that cleanup through here rather than calling
 * `deleteCloudinaryImage` directly is what keeps the registry honest: without
 * it those rows would sit `active` forever, pointing at files that no longer
 * exist. Any id with no registry row falls back to a plain delete.
 *
 * Never throws — a denial must complete even if storage cleanup does not.
 */
export async function purgeAssetsByPublicId(
  publicIds: string[],
  actor: AssetActor,
  note: string
): Promise<void> {
  for (const publicId of publicIds) {
    try {
      const asset = await InternalAssetModel.findOne({ publicId });
      if (!asset) {
        await deleteCloudinaryImage(publicId);
        continue;
      }
      if (asset.status === "purged") continue;
      await purgeAsset(asset, actor, note);
    } catch (err) {
      console.error(`[assets] cleanup failed for ${publicId}:`, (err as Error).message);
    }
  }
}

/** Super Admin skips the retention window. Irreversible. */
export async function purgeAssetNow(assetId: string, actor: AssetActor): Promise<IInternalAsset> {
  const asset = await InternalAssetModel.findById(assetId);
  if (!asset) throw ApiError.notFound("File not found");
  if (asset.status === "purged") return asset;
  if (asset.status !== "recycled") {
    throw ApiError.badRequest("Only files in the Recycle Bin can be permanently deleted");
  }

  const ok = await purgeAsset(asset, actor, "Permanently deleted by Super Admin before the retention window ended.");
  if (!ok) {
    throw new ApiError(502, "Could not remove the file from storage. Nothing was changed — please try again.");
  }
  return asset;
}

/**
 * The scheduler's tick. Permanently deletes every Recycle Bin item whose
 * retention window has passed.
 *
 * Never throws, and one failure never stops the sweep: a file Cloudinary
 * refuses is counted, logged and left in the bin with its `purgeAttempts`
 * raised, so it stays visible to Super Admin and is retried next tick instead
 * of being silently dropped.
 */
export async function purgeExpiredAssets(): Promise<{ purged: number; failed: number }> {
  const due = await InternalAssetModel.find({
    status: "recycled",
    purgeAfter: { $lte: new Date() },
  }).limit(50);

  let purged = 0;
  let failed = 0;
  for (const asset of due) {
    try {
      const ok = await purgeAsset(
        asset,
        null,
        `Retention window of ${RECYCLE_BIN_RETENTION_DAYS} days elapsed; permanently deleted automatically.`
      );
      if (ok) purged += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error(`[assets] purge sweep error for ${asset.publicId}:`, (err as Error).message);
    }
  }
  return { purged, failed };
}

export interface ListAssetsFilter {
  status?: InternalAssetStatus;
  kind?: InternalAssetKind;
  uploadedBy?: string;
  role?: Role;
  resource?: string;
  module?: string;
  search?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

/** Super Admin's centralized view. Every filter the dashboard offers is applied here. */
export async function listInternalAssets(filter: ListAssetsFilter) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.kind) query.kind = filter.kind;
  if (filter.uploadedBy) query.uploadedBy = filter.uploadedBy;
  if (filter.role) query.uploadedByRole = filter.role;
  if (filter.resource) query.resource = filter.resource;
  if (filter.module) query.module = filter.module;
  if (filter.search) query.fileName = { $regex: filter.search, $options: "i" };
  if (filter.from || filter.to) {
    const createdAt: Record<string, Date> = {};
    if (filter.from) createdAt.$gte = filter.from;
    if (filter.to) createdAt.$lte = filter.to;
    query.createdAt = createdAt;
  }

  const skip = (filter.page - 1) * filter.limit;
  const [assets, total] = await Promise.all([
    InternalAssetModel.find(query)
      .populate("uploadedBy", "name email")
      .populate("deleteRequestedBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    InternalAssetModel.countDocuments(query),
  ]);

  return {
    assets,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

export async function getInternalAsset(assetId: string) {
  const asset = await InternalAssetModel.findById(assetId)
    .populate("uploadedBy", "name email")
    .populate("deleteRequestedBy", "name email")
    .populate("reviewedBy", "name email")
    .populate("history.by", "name email");
  if (!asset) throw ApiError.notFound("File not found");
  return asset;
}
