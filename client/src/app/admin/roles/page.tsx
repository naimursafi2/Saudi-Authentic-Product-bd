"use client";

import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
} from "@/lib/api/roles";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { RoleForm, type RoleFormValues } from "@/components/admin/RoleForm";
import type { ApiPermissionGroup, ApiRole } from "@/types/api";

export default function AdminRolesPage() {
  const { user, permissions, hasPermission } = useAuth();
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [groups, setGroups] = useState<ApiPermissionGroup[]>([]);
  const [sensitive, setSensitive] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ApiRole | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";
  const canManage = hasPermission("roles.manage");

  function load() {
    setIsLoading(true);
    Promise.all([listRoles(), listPermissions()])
      .then(([rolesRes, permsRes]) => {
        setRoles(rolesRes.data.roles);
        setGroups(permsRes.data.groups);
        setSensitive(permsRes.data.sensitive);
        setError(null);
      })
      .catch(() => setError("Could not load roles and permissions."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleSubmit(values: RoleFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (editing === "new") {
        await createRole({
          key: values.key,
          name: values.name,
          description: values.description || undefined,
          permissions: values.permissions,
          isActive: values.isActive,
        });
      } else if (editing) {
        // A built-in role accepts only its permission list; sending name/key
        // would be ignored server-side, so don't pretend otherwise.
        await updateRole(
          editing._id,
          editing.isSystem
            ? { permissions: values.permissions }
            : {
                name: values.name,
                description: values.description,
                permissions: values.permissions,
                isActive: values.isActive,
              }
        );
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save role.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(role: ApiRole) {
    const warning =
      role.assignedUserCount && role.assignedUserCount > 0
        ? `${role.assignedUserCount} user(s) still have this role and must be reassigned first.`
        : "This cannot be undone.";
    if (!confirm(`Delete the ${role.name} role? ${warning}`)) return;
    try {
      await deleteRole(role._id);
      load();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Could not delete role.");
    }
  }

  const description =
    "Built-in roles keep every account working as it does today. Create custom roles to give new kinds of staff exactly the access they need, with no code change.";

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Roles & Permissions" description={description} />
        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Roles & Permissions" description={description} />
        <ErrorState message={error} />
      </div>
    );
  }

  const systemRoles = roles.filter((r) => r.isSystem);
  const customRoles = roles.filter((r) => !r.isSystem);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <PageHeader
          title="Roles & Permissions"
          description={description}
          action={
            canManage ? (
              <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
                <Plus size={14} /> New Role
              </Button>
            ) : undefined
          }
        />

        {!canManage && (
          <p className="mb-6 rounded-lg border border-brown-600/15 bg-gold-soft px-4 py-3 text-sm text-gold-700">
            You can view roles and permissions but not change them. Creating or editing a role
            needs the &quot;Create, edit &amp; delete roles&quot; permission.
          </p>
        )}

        <h3 className="mb-3 flex items-center gap-2 font-serif text-lg text-green-950">
          <KeyRound size={16} className="text-gold-600" /> Custom Roles
        </h3>
        {customRoles.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No custom roles yet"
            description="Create one for a job the built-in roles don't cover — a Video Editor or Digital Marketer, for example."
          />
        ) : (
          <RoleTable
            roles={customRoles}
            canEdit={canManage}
            canDelete={canManage}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        )}
      </div>

      <div>
        <h3 className="mb-1 flex items-center gap-2 font-serif text-lg text-green-950">
          <ShieldCheck size={16} className="text-gold-600" /> Built-in Roles
        </h3>
        <p className="mb-3 text-sm text-brown-600">
          These come with the platform and cannot be renamed or deleted. Only a Super Admin can
          change what they can reach; Super Admin itself always holds every permission, so it can
          never be locked out.
        </p>
        <RoleTable
          roles={systemRoles}
          canEdit={isSuperAdmin}
          canDelete={false}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      </div>

      {editing && (
        <Modal
          title={editing === "new" ? "New Role" : `Edit ${editing.name}`}
          onClose={() => setEditing(null)}
        >
          <RoleForm
            initial={editing === "new" ? undefined : editing}
            groups={groups}
            sensitive={sensitive}
            grantablePermissions={permissions}
            canGrantEverything={isSuperAdmin}
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

function RoleTable({
  roles,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  roles: ApiRole[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (role: ApiRole) => void;
  onDelete: (role: ApiRole) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Permissions</th>
            <th className="px-4 py-3">Users</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role._id} className="border-b border-brown-600/10 last:border-none">
              <td className="px-4 py-3">
                <span className="block font-medium text-green-950">{role.name}</span>
                <span className="block text-xs text-brown-500">{role.key}</span>
                {role.description && (
                  <span className="mt-0.5 block max-w-md text-xs text-brown-500">
                    {role.description}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-brown-600">
                {role.key === "SUPER_ADMIN" ? "All permissions" : `${role.permissions.length}`}
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1.5 text-brown-600">
                  <Users size={13} /> {role.assignedUserCount ?? 0}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={role.isActive ? "active" : "inactive"} />
              </td>
              <td className="px-4 py-3 text-right">
                {canEdit && role.key !== "SUPER_ADMIN" && (
                  <button
                    aria-label={`Edit ${role.name}`}
                    onClick={() => onEdit(role)}
                    className="mr-3 cursor-pointer text-brown-500 hover:text-green-950"
                  >
                    <Pencil size={15} />
                  </button>
                )}
                {canDelete && (
                  <button
                    aria-label={`Delete ${role.name}`}
                    onClick={() => onDelete(role)}
                    className="cursor-pointer text-brown-500 hover:text-danger"
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
  );
}
