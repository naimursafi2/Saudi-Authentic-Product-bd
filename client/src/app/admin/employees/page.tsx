"use client";

import { useEffect, useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { listUsers, createStaff, updateUserRole, updateUserStatus, updateStaffMeta } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { Button } from "@/components/ui/Button";
import { EmployeeForm, type EmployeeFormValues } from "@/components/admin/EmployeeForm";
import type { ApiUser } from "@/types/api";

const STAFF_ROLES = ["employee", "delivery_agent", "co_admin", "order_manager", "admin", "super_admin"] as const;

export default function AdminEmployeesPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "super_admin";

  const [staff, setStaff] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiUser | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    Promise.all(STAFF_ROLES.map((role) => listUsers({ role, limit: 100 })))
      .then((results) => {
        const combined = results.flatMap((r) => r.data.users);
        combined.sort((a, b) => a.name.localeCompare(b.name));
        setStaff(combined);
        setError(null);
      })
      .catch(() => setError("Could not load staff."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleSubmit(values: EmployeeFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const baseSalaryBDT = values.baseSalaryBDT ? Number(values.baseSalaryBDT) : undefined;

      if (editing === "new") {
        await createStaff({
          name: values.name,
          email: values.email,
          password: values.password,
          phone: values.phone || undefined,
          role: values.role,
          staffMeta: {
            employeeId: values.employeeId,
            department: values.department || undefined,
            designation: values.designation || undefined,
            baseSalaryBDT,
          },
        });
      } else if (editing) {
        const id = editing._id;
        if (values.role !== editing.role) await updateUserRole(id, values.role);
        if (values.isActive !== editing.isActive) await updateUserStatus(id, values.isActive);
        await updateStaffMeta(id, {
          department: values.department || undefined,
          designation: values.designation || undefined,
          baseSalaryBDT,
        });
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save employee.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage staff accounts, roles and profiles."
        action={
          canManage ? (
            <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
              <Plus size={14} /> Add Employee
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : staff.length === 0 ? (
        <EmptyState icon={UserCog} title="No staff yet" description="Add your first employee to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Department / Designation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {staff.map((person) => (
                <tr key={person._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{person.name}</td>
                  <td className="px-4 py-3 text-brown-600">{person.email}</td>
                  <td className="px-4 py-3 capitalize text-brown-600">{person.role.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-brown-600">{person.staffMeta?.employeeId ?? "—"}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {[person.staffMeta?.department, person.staffMeta?.designation].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        person.isActive ? "bg-[#e9f3ee] text-green-900" : "bg-cream-300 text-brown-500"
                      }`}
                    >
                      {person.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brown-600">
                    {person.staffMeta?.joinedAt
                      ? new Date(person.staffMeta.joinedAt).toLocaleDateString()
                      : new Date(person.createdAt).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {person.role !== "super_admin" && (
                        <button
                          onClick={() => setEditing(person)}
                          className="text-xs font-bold uppercase tracking-wide text-green-900 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add Employee" : "Edit Employee"} onClose={() => setEditing(null)}>
          <EmployeeForm
            initial={editing === "new" ? undefined : editing}
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
