import { z } from "zod";
import { INTERNAL_ASSET_KINDS, INTERNAL_ASSET_STATUSES } from "../models/InternalAsset.model";
import { ROLES } from "../constants/roles";

export const listInternalAssetsQuerySchema = z.object({
  status: z.enum(INTERNAL_ASSET_STATUSES).optional(),
  kind: z.enum(INTERNAL_ASSET_KINDS).optional(),
  uploadedBy: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  role: z.enum(ROLES).optional(),
  /** The Mongoose model name a file hangs off, e.g. "Purchase". */
  resource: z.string().trim().min(1).max(60).optional(),
  module: z.string().trim().min(1).max(80).optional(),
  /** Matched against the file name. */
  search: z.string().trim().min(1).max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const assetReasonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const assetReviewSchema = z.object({
  reviewNote: z.string().trim().max(500).optional(),
});

/**
 * Immediate permanent deletion is irreversible, so it takes an explicit
 * confirmation flag rather than being a bare DELETE — the UI shows a strong
 * warning and the API refuses without it, so a mis-fired request cannot
 * destroy a file.
 */
export const purgeNowSchema = z.object({
  confirm: z.literal(true, {
    message: "Permanent deletion must be explicitly confirmed",
  }),
  reason: z.string().trim().max(500).optional(),
});

export type ListInternalAssetsQuery = z.infer<typeof listInternalAssetsQuerySchema>;
