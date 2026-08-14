import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as taskService from "../services/task.service";
import type { ListTasksQuery } from "../validators/task.validator";

export const create = catchAsync(async (req: Request, res: Response) => {
  const task = await taskService.createTask(req.user!.id, req.body);
  sendSuccess(res, 201, "Task created", { task });
});

export const listMine = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { tasks, pagination } = await taskService.listMyTasks(req.user!.id, page, limit);
  sendSuccess(res, 200, "Tasks fetched", { tasks }, { pagination });
});

export const list = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListTasksQuery;
  const { tasks, pagination } = await taskService.listTasks(query);
  sendSuccess(res, 200, "Tasks fetched", { tasks }, { pagination });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const task = await taskService.updateTask(paramStr(req.params.id), req.body);
  sendSuccess(res, 200, "Task updated", { task });
});

export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const task = await taskService.updateTaskStatus(
    paramStr(req.params.id),
    req.user!.id,
    req.user!.role,
    req.body
  );
  sendSuccess(res, 200, "Task status updated", { task });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  await taskService.deleteTask(paramStr(req.params.id));
  sendSuccess(res, 200, "Task deleted");
});
