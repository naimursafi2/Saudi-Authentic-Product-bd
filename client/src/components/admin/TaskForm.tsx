"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiTask, TaskPriority, TaskType } from "@/types/hr";
import type { ApiUser } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high"];
export const TASK_TYPE_OPTIONS: TaskType[] = [
  "packing",
  "product_counting",
  "stock_checking",
  "warehouse",
  "customer_support",
  "data_entry",
  "product_preparation",
];

export interface TaskFormValues {
  title: string;
  description: string;
  type: TaskType;
  assignedTo: string;
  dueDate: string;
  priority: TaskPriority;
}

function fromTask(task?: ApiTask): TaskFormValues {
  if (!task) {
    return { title: "", description: "", type: "packing", assignedTo: "", dueDate: "", priority: "medium" };
  }
  return {
    title: task.title,
    description: task.description ?? "",
    type: task.type,
    assignedTo: typeof task.assignedTo === "string" ? task.assignedTo : task.assignedTo._id,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    priority: task.priority,
  };
}

export function TaskForm({
  initial,
  employees,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiTask;
  employees: ApiUser[];
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(initial);
  const [values, setValues] = useState<TaskFormValues>(() => fromTask(initial));

  function update<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClasses}>Title *</label>
        <input required value={values.title} onChange={(e) => update("title", e.target.value)} className={fieldClasses} />
      </div>
      <div>
        <label className={labelClasses}>Description</label>
        <textarea
          rows={3}
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          className={fieldClasses}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Task Type *</label>
          <select
            required
            value={values.type}
            onChange={(e) => update("type", e.target.value as TaskType)}
            className={fieldClasses}
          >
            {TASK_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses}>Assignee *</label>
          <select
            required
            value={values.assignedTo}
            onChange={(e) => update("assignedTo", e.target.value)}
            className={fieldClasses}
          >
            <option value="">Select employee</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses}>Due Date</label>
          <input
            type="date"
            value={values.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Priority</label>
          <select
            value={values.priority}
            onChange={(e) => update("priority", e.target.value as TaskPriority)}
            className={fieldClasses}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Assign Task"}
        </Button>
      </div>
    </form>
  );
}
