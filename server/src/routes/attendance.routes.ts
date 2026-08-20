import { Router } from "express";
import * as attendanceController from "../controllers/attendance.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  checkOutSchema,
  listAttendanceQuerySchema,
  updateAttendanceSchema,
} from "../validators/attendance.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Any staff member: self check-in/out --
router.post("/check-in", attendanceController.checkIn);
router.post("/check-out", validate({ body: checkOutSchema }), attendanceController.checkOut);
router.get("/mine", attendanceController.listMine);

// -- Admin / Co-Admin / Super Admin --
router.get(
  "/summary/today",
  requirePermission("attendance.view"),
  attendanceController.todaySummary
);
router.get(
  "/",
  requirePermission("attendance.view"),
  validate({ query: listAttendanceQuerySchema }),
  attendanceController.list
);
router.patch(
  "/:id",
  requirePermission("attendance.manage"),
  validate({ params: mongoIdParamSchema, body: updateAttendanceSchema }),
  attendanceController.update
);

export default router;
