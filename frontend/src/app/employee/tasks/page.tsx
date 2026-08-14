"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { listMyTasks, updateTaskStatus } from "@/lib/api/tasks";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { cn } from "@/lib/utils";
import type { ApiTask, TaskStatus } from "@/types/hr";

const STATUS_OPTIONS: TaskStatus[] = ["todo", "in_progress", "done"];

export default function EmployeeTasksPage() {
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listMyTasks(1, 50)
      .then(({ data }) => {
        setTasks(data.tasks);
        setError(null);
      })
      .catch(() => setError("Could not load your tasks."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleStatusChange(id: string, status: TaskStatus) {
    setUpdatingId(id);
    try {
      await updateTaskStatus(id, status);
      load();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <PageHeader title="My Tasks" description="Tasks assigned to you." />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks assigned" description="You're all caught up." />
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <div key={task._id} className="flex flex-col gap-3 rounded-lg border border-brown-600/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-green-950">{task.title}</p>
                {task.description && <p className="mt-1 text-sm text-brown-500">{task.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-brown-500">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-bold uppercase",
                      task.priority === "high"
                        ? "bg-[#fbeceb] text-[#8a4a3f]"
                        : task.priority === "medium"
                          ? "bg-[#fcf8ee] text-[#735c00]"
                          : "bg-cream-300 text-brown-600"
                    )}
                  >
                    {task.priority} priority
                  </span>
                  {task.dueDate && (
                    <span>Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={task.status} />
                <select
                  value={task.status}
                  disabled={updatingId === task._id}
                  onChange={(e) => handleStatusChange(task._id, e.target.value as TaskStatus)}
                  className="rounded border border-green-900/15 bg-cream-50 px-2 py-1.5 text-sm text-green-950"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
