import { api } from "./client";
import type { ApiTask, TaskPriority, TaskStatus, TaskType } from "@/types/hr";

export async function createTask(payload: {
  title: string;
  description?: string;
  type: TaskType;
  assignedTo: string;
  dueDate?: string;
  priority?: TaskPriority;
}) {
  return api.post<{ task: ApiTask }>("/tasks", payload);
}

export async function listMyTasks(page = 1, limit = 20) {
  return api.get<{ tasks: ApiTask[] }>(`/tasks/mine?page=${page}&limit=${limit}`);
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  return api.patch<{ task: ApiTask }>(`/tasks/${id}/status`, { status });
}

export async function listTasks(
  params: { assignedTo?: string; type?: TaskType; status?: TaskStatus; page?: number; limit?: number } = {}
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return api.get<{ tasks: ApiTask[] }>(`/tasks${qs ? `?${qs}` : ""}`);
}

export async function updateTask(
  id: string,
  payload: Partial<{
    title: string;
    description: string;
    type: TaskType;
    assignedTo: string;
    dueDate: string;
    priority: TaskPriority;
  }>
) {
  return api.patch<{ task: ApiTask }>(`/tasks/${id}`, payload);
}

export async function deleteTask(id: string) {
  return api.delete<null>(`/tasks/${id}`);
}
