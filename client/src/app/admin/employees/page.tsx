"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserCog } from "lucide-react";
import {
  listUsers,
  createStaff,
  updateUserRole,
  updateUserStatus,
  updateStaffMeta,
  unlockUser,
  impersonateUser,
} from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { AccessModal } from "@/components/admin/AccessModal";
import { Button } from "@/components/ui/Button";
import { EmployeeForm, type EmployeeFormValues } from "@/components/admin/EmployeeForm";
import type { ApiUser } from "@/types/api";

const STAFF_ROLES = ["employee", "delivery_agent", "co_admin", "order_manager", "admin", "super_admin"] as const;

function isLocked(user: ApiUser): boolean {
  return Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());
}

export default function AdminEmployeesPage() {
  const { user, startImpersonation } = useAuth();
  const router = useRouter();
  const canManage = user?.role === "admin" || user?.role === "super_admin";
  const canImpersonate = user?.role === "super_admin";

  const [staff, setStaff] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiUser | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  /** The staff member whose role assignment + effective permissions are open. */
  const [managingAccess, setManagingAccess] = useState<ApiUser | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleUnlock(person: ApiUser) {
    setActionError(null);
    setActingId(person._id);
    try {
      await unlockUser(person._id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not unlock this account.");
    } finally {
      setActingId(null);
    }
  }

  async function handleImpersonate(person: ApiUser) {
    if (!confirm(`Sign in as ${person.name}? This is recorded in the audit log.`)) return;
    setActionError(null);
    setActingId(person._id);
    try {
      const { data } = await impersonateUser(person._id);
      await startImpersonation(data.accessToken);
      router.push("/account");
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not start a support login.");
    } finally {
      setActingId(null);
    }
  }

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

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : staff.length === 0 ? (
        <EmptyState icon={UserCog} title="No staff yet" description="Add your first employee to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
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
                  <td className="px-4 py-3 text-brown-600">
                    <span className="capitalize">{person.role.replace("_", " ")}</span>
                    {/* A custom role sits on top of the built-in one rather
                        than replacing it, so show both. */}
                    {person.customRole && (
                      <span className="mt-0.5 block text-xs font-semibold text-gold-700">
                        + {person.customRole.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brown-600">{person.staffMeta?.employeeId ?? "—"}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {[person.staffMeta?.department, person.staffMeta?.designation].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                          person.isActive ? "bg-success-soft text-green-900" : "bg-cream-300 text-brown-500"
                        }`}
                      >
                        {person.isActive ? "Active" : "Inactive"}
                      </span>
                      {isLocked(person) && (
                        <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
                          Locked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brown-600">
                    {person.staffMeta?.joinedAt
                      ? new Date(person.staffMeta.joinedAt).toLocaleDateString()
                      : new Date(person.createdAt).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {person.role !== "super_admin" && (
                        <div className="flex justify-end gap-3">
                          {isLocked(person) && (
                            <button
                              onClick={() => handleUnlock(person)}
                              disabled={actingId === person._id}
                              className="cursor-pointer text-xs font-bold uppercase tracking-wide text-danger hover:underline disabled:opacity-50"
                            >
                              Unlock
                            </button>
                          )}
                          {canImpersonate && person.isActive && (
                            <button
                              onClick={() => handleImpersonate(person)}
                              disabled={actingId === person._id}
                              className="cursor-pointer text-xs font-bold uppercase tracking-wide text-brown-600 hover:underline disabled:opacity-50"
                            >
                              Sign in as
                            </button>
                          )}
                          <button
                            onClick={() => setManagingAccess(person)}
                            className="cursor-pointer text-xs font-bold uppercase tracking-wide text-brown-600 hover:underline"
                          >
                            Access
                          </button>
                          <button
                            onClick={() => setEditing(person)}
                            className="cursor-pointer text-xs font-bold uppercase tracking-wide text-green-900 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {managingAccess && (
        <AccessModal
          user={managingAccess}
          onClose={() => setManagingAccess(null)}
          onSaved={() => {
            setManagingAccess(null);
            load();
          }}
        />
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
