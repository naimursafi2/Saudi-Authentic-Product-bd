"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { createTask, listTasks, updateTask, deleteTask } from "@/lib/api/tasks";
import { listUsers } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import { TaskForm, type TaskFormValues } from "@/components/admin/TaskForm";
import type { ApiTask } from "@/types/hr";
import type { ApiUser, Pagination } from "@/types/api";

function personName(person: string | { name: string }): string {
  return typeof person === "string" ? person : person.name;
}

export default function AdminTasksPage() {
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "super_admin";

  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [employees, setEmployees] = useState<ApiUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiTask | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listTasks({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setTasks(data.tasks);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load tasks."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  useEffect(() => {
    listUsers({ role: "employee", limit: 100 })
      .then(({ data }) => setEmployees(data.users))
      .catch(() => {});
  }, []);

  async function handleSubmit(values: TaskFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (editing === "new") {
        await createTask({
          title: values.title,
          description: values.description || undefined,
          type: values.type,
          assignedTo: values.assignedTo,
          dueDate: values.dueDate || undefined,
          priority: values.priority,
        });
      } else if (editing) {
        await updateTask(editing._id, {
          title: values.title,
          description: values.description,
          type: values.type,
          assignedTo: values.assignedTo,
          dueDate: values.dueDate || undefined,
          priority: values.priority,
        });
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(task: ApiTask) {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    await deleteTask(task._id);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Assign and track work across your team."
        action={
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> Assign Task
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks yet" description="Assign your first task to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{task.title}</td>
                  <td className="px-4 py-3 capitalize text-brown-600">{task.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-brown-600">{personName(task.assignedTo)}</td>
                  <td className="px-4 py-3 capitalize text-brown-600">{task.priority}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      aria-label="Edit"
                      onClick={() => setEditing(task)}
                      className="mr-3 text-brown-500 hover:text-green-950"
                    >
                      <Pencil size={15} />
                    </button>
                    {canDelete && (
                      <button
                        aria-label="Delete"
                        onClick={() => handleDelete(task)}
                        className="text-brown-500 hover:text-[#8a4a3f]"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />

      {editing && (
        <Modal title={editing === "new" ? "Assign Task" : "Edit Task"} onClose={() => setEditing(null)}>
          <TaskForm
            initial={editing === "new" ? undefined : editing}
            employees={employees}
            error={formError}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
