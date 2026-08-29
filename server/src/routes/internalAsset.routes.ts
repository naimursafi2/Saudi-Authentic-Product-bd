import { Router } from "express";
import * as assetController from "../controllers/internalAsset.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize, requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  assetReasonSchema,
  assetReviewSchema,
  listInternalAssetsQuerySchema,
  purgeNowSchema,
} from "../validators/internalAsset.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Internal staff: may ask for their OWN upload to be removed. Ownership is
// enforced in the controller; the permission alone never grants reach over a
// colleague's files. --
router.post(
  "/:id/request-delete",
  requirePermission("assets.request_delete", "assets.manage"),
  validate({ params: mongoIdParamSchema, body: assetReasonSchema }),
  assetController.requestDeletion
);

router.get(
  "/mine",
  requirePermission("assets.request_delete", "assets.manage"),
  validate({ query: listInternalAssetsQuerySchema }),
  assetController.listMyAssets
);

// -- Super Admin: the centralized dashboard, review queue and Recycle Bin.
// `assets.manage` is in no other role's defaults, so this whole surface is
// Super Admin's alone unless one is explicitly granted the permission. --
router.get(
  "/",
  requirePermission("assets.manage"),
  validate({ query: listInternalAssetsQuerySchema }),
  assetController.listAssets
);
router.get(
  "/:id",
  requirePermission("assets.manage"),
  validate({ params: mongoIdParamSchema }),
  assetController.getAsset
);
router.patch(
  "/:id/approve",
  requirePermission("assets.manage"),
  authorize("super_admin"),
  validate({ params: mongoIdParamSchema, body: assetReviewSchema }),
  assetController.approveDeletion
);
router.patch(
  "/:id/reject",
  requirePermission("assets.manage"),
  authorize("super_admin"),
  validate({ params: mongoIdParamSchema, body: assetReviewSchema }),
  assetController.rejectDeletion
);
router.patch(
  "/:id/recycle",
  requirePermission("assets.manage"),
  authorize("super_admin"),
  validate({ params: mongoIdParamSchema, body: assetReasonSchema }),
  assetController.recycleDirectly
);
router.patch(
  "/:id/restore",
  requirePermission("assets.manage"),
  authorize("super_admin"),
  validate({ params: mongoIdParamSchema }),
  assetController.restoreAsset
);
// Permanent, irreversible deletion before the retention window ends. The body
// must carry `confirm: true`, so this cannot fire by accident.
router.post(
  "/:id/purge",
  requirePermission("assets.manage"),
  authorize("super_admin"),
  validate({ params: mongoIdParamSchema, body: purgeNowSchema }),
  assetController.purgeAssetNow
);

export default router;
