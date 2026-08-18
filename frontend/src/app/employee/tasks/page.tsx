"use client";

import { useEffect, useState } from "react";
import { ListChecks, Calendar, ChevronDown } from "lucide-react";
import { listMyTasks, updateTaskStatus } from "@/lib/api/tasks";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { cn } from "@/lib/utils";
import type { ApiTask, TaskStatus, TaskType } from "@/types/hr";

const STATUS_OPTIONS: TaskStatus[] = ["todo", "in_progress", "done"];
const TASK_TYPE_OPTIONS: TaskType[] = [
  "packing",
  "product_counting",
  "stock_checking",
  "warehouse",
  "customer_support",
  "data_entry",
  "product_preparation",
];

const PRIORITY_ACCENT: Record<string, string> = {
  high: "border-l-[#8a4a3f]",
  medium: "border-l-gold-500",
  low: "border-l-brown-500/30",
};

export default function EmployeeTasksPage() {
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TaskType | "">("");

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

  const visibleTasks = typeFilter ? tasks.filter((t) => t.type === typeFilter) : tasks;

  return (
    <div>
      <PageHeader title="My Tasks" description="Tasks assigned to you." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TaskType | "")}
          className="h-9 rounded border border-brown-600/20 bg-white px-3 text-sm text-green-950 focus:outline-none focus:ring-1 focus:ring-green-900/30"
        >
          <option value="">All task types</option>
          {TASK_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : visibleTasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks assigned" description="You're all caught up." />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleTasks.map((task) => (
            <div
              key={task._id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border border-l-4 border-brown-600/10 bg-white p-5 shadow-[0_1px_2px_rgba(61,43,31,0.04)] transition-shadow duration-150 hover:shadow-md sm:flex-row sm:items-center sm:justify-between",
                PRIORITY_ACCENT[task.priority] ?? "border-l-brown-500/30"
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold text-green-950">{task.title}</p>
                {task.description && <p className="mt-1 text-sm text-brown-500">{task.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-brown-500">
                  <span className="rounded-full bg-green-950/5 px-2.5 py-0.5 font-bold uppercase text-green-900">
                    {task.type.replace(/_/g, " ")}
                  </span>
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
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} />
                      Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge status={task.status} />
                <div className="relative">
                  <select
                    value={task.status}
                    disabled={updatingId === task._id}
                    onChange={(e) => handleStatusChange(task._id, e.target.value as TaskStatus)}
                    className="appearance-none rounded-lg border border-green-900/15 bg-cream-50 py-1.5 pl-2.5 pr-7 text-sm text-green-950 transition-colors hover:border-green-900/30 focus:border-green-900/40 focus:outline-none disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-brown-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
