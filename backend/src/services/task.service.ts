import { TaskModel } from "../models/Task.model";
import { UserModel } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { sendTaskAssignedEmail } from "./email.service";
import type {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from "../validators/task.validator";

export async function createTask(assignedById: string, input: CreateTaskInput) {
  const assignee = await UserModel.findById(input.assignedTo);
  if (!assignee || !assignee.staffMeta) {
    throw ApiError.badRequest("assignedTo must be an existing staff member");
  }

  const task = await TaskModel.create({ ...input, assignedBy: assignedById });

  void sendTaskAssignedEmail(assignee.email, assignee.name, {
    title: task.title,
    dueDate: task.dueDate?.toISOString().slice(0, 10),
  });

  return task;
}

export async function listMyTasks(employeeId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const filter = { assignedTo: employeeId };
  const [tasks, total] = await Promise.all([
    TaskModel.find(filter).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(limit),
    TaskModel.countDocuments(filter),
  ]);
  return {
    tasks,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function listTasks(query: ListTasksQuery) {
  const filter: Record<string, unknown> = {};
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.status) filter.status = query.status;

  const skip = (query.page - 1) * query.limit;
  const [tasks, total] = await Promise.all([
    TaskModel.find(filter)
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    TaskModel.countDocuments(filter),
  ]);
  return {
    tasks,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const task = await TaskModel.findById(id);
  if (!task) throw ApiError.notFound("Task not found");
  Object.assign(task, input);
  await task.save();
  return task;
}

export async function updateTaskStatus(id: string, requesterId: string, requesterRole: string, input: UpdateTaskStatusInput) {
  const task = await TaskModel.findById(id);
  if (!task) throw ApiError.notFound("Task not found");

  const isOwner = task.assignedTo.toString() === requesterId;
  const isStaffManager = ["admin", "super_admin", "co_admin"].includes(requesterRole);
  if (!isOwner && !isStaffManager) {
    throw ApiError.forbidden("You do not have permission to update this task");
  }

  task.status = input.status;
  await task.save();
  return task;
}

export async function deleteTask(id: string) {
  const task = await TaskModel.findById(id);
  if (!task) throw ApiError.notFound("Task not found");
  await task.deleteOne();
}
