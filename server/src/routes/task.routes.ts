import { Router } from "express";
import * as taskController from "../controllers/task.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "../validators/task.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Any staff member --
router.get("/mine", taskController.listMine);
// Status updates are owner-or-staff-manager, enforced inside the service
// (the owner is only known after loading the task, so it can't be a route-level check).
router.patch(
  "/:id/status",
  validate({ params: mongoIdParamSchema, body: updateTaskStatusSchema }),
  taskController.updateStatus
);

// -- Admin / Co-Admin / Super Admin --
router.post(
  "/",
  requirePermission("tasks.create"),
  validate({ body: createTaskSchema }),
  taskController.create
);
router.get(
  "/",
  requirePermission("tasks.view"),
  validate({ query: listTasksQuerySchema }),
  taskController.list
);
router.patch(
  "/:id",
  requirePermission("tasks.edit"),
  validate({ params: mongoIdParamSchema, body: updateTaskSchema }),
  taskController.update
);
router.delete(
  "/:id",
  requirePermission("tasks.delete"),
  validate({ params: mongoIdParamSchema }),
  taskController.remove
);

export default router;
