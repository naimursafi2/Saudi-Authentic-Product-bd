import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { paramStr } from "../utils/params";
import * as assetService from "../services/internalAsset.service";
import { InternalAssetModel } from "../models/InternalAsset.model";
import type { ListInternalAssetsQuery } from "../validators/internalAsset.validator";

function actorOf(req: Request): assetService.AssetActor {
  return { id: req.user!.id, role: req.user!.role };
}

/** Super Admin's centralized view of every internal upload. */
export const listAssets = catchAsync(async (req: Request, res: Response) => {
  const filter = req.query as unknown as ListInternalAssetsQuery;
  const { assets, pagination } = await assetService.listInternalAssets(filter);
  sendSuccess(res, 200, "Uploads fetched", { assets }, { pagination });
});

export const getAsset = catchAsync(async (req: Request, res: Response) => {
  const asset = await assetService.getInternalAsset(paramStr(req.params.id));
  sendSuccess(res, 200, "Upload fetched", { asset });
});

/** A staff member can see their own tracked uploads, never a colleague's. */
export const listMyAssets = catchAsync(async (req: Request, res: Response) => {
  const filter = req.query as unknown as ListInternalAssetsQuery;
  const { assets, pagination } = await assetService.listMyInternalAssets(req.user!.id, filter);
  sendSuccess(res, 200, "Your uploads fetched", { assets }, { pagination });
});

/**
 * A staff member asks for one of their uploads to be removed. Scoped to their
 * own files: holding `assets.request_delete` lets someone manage what they
 * uploaded, never what a colleague did. Super Admin (who holds
 * `assets.manage`) may request on anyone's behalf.
 */
export const requestDeletion = catchAsync(async (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const canManageAll = (req.user!.permissions ?? []).includes("assets.manage");

  if (!canManageAll) {
    const asset = await InternalAssetModel.findById(id).select("uploadedBy");
    if (!asset) throw ApiError.notFound("File not found");
    if (asset.uploadedBy.toString() !== req.user!.id) {
      throw ApiError.forbidden("You can only request deletion of files you uploaded");
    }
  }

  const asset = await assetService.requestAssetDeletion(id, actorOf(req), req.body?.reason);
  sendSuccess(res, 200, "Deletion requested — awaiting Super Admin review", { asset });
});

export const approveDeletion = catchAsync(async (req: Request, res: Response) => {
  const asset = await assetService.approveAssetDeletion(
    paramStr(req.params.id),
    actorOf(req),
    req.body?.reviewNote
  );
  sendSuccess(res, 200, "Deletion approved — moved to the Recycle Bin", { asset });
});

export const rejectDeletion = catchAsync(async (req: Request, res: Response) => {
  const asset = await assetService.rejectAssetDeletion(
    paramStr(req.params.id),
    actorOf(req),
    req.body?.reviewNote
  );
  sendSuccess(res, 200, "Deletion rejected — the file remains active", { asset });
});

/** Super Admin only: bypasses the request queue and moves an active file to the bin. */
export const recycleDirectly = catchAsync(async (req: Request, res: Response) => {
  const asset = await assetService.recycleAssetDirectly(
    paramStr(req.params.id),
    actorOf(req),
    req.body?.reason
  );
  sendSuccess(res, 200, "File moved to the Recycle Bin", { asset });
});

export const restoreAsset = catchAsync(async (req: Request, res: Response) => {
  const asset = await assetService.restoreAsset(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "File restored", { asset });
});

/** Irreversible. The validator requires an explicit `confirm: true`. */
export const purgeAssetNow = catchAsync(async (req: Request, res: Response) => {
  await assetService.purgeAssetNow(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "File permanently deleted");
});
