import { Router } from "express";
import * as notificationController from "../controllers/customerNotification.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { listNotificationsQuerySchema } from "../validators/notification.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// Every route here is self-scoped to req.user.id — no permission check
// needed, same as /users/me/* (a signed-in customer only ever reads their
// own website-notification inbox, staff included since staff accounts can
// also be a campaign recipient in principle).
router.use(authenticate);

router.get("/mine", validate({ query: listNotificationsQuerySchema }), notificationController.listMyNotifications);
router.patch(
  "/:id/read",
  validate({ params: mongoIdParamSchema }),
  notificationController.markNotificationRead
);
router.patch("/mark-all-read", notificationController.markAllNotificationsRead);

export default router;
