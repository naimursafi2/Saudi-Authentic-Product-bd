"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { assignRoleToUser, getUserPermissions, listRoles } from "@/lib/api/roles";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { Modal } from "@/components/admin/Modal";
import { Button } from "@/components/ui/Button";
import type { ApiRole, ApiUser, ApiUserPermissions } from "@/types/api";

/**
 * "Access" panel for one staff member: which custom role they hold, and the
 * full list of permissions that actually results from it.
 *
 * The permission list is read back from `GET /roles/users/:id` rather than
 * computed here, so it is the same answer the API will give when the person
 * makes a request — no chance of the panel claiming access the server won't
 * honour.
 */
export function AccessModal({
  user,
  onClose,
  onSaved,
}: {
  user: ApiUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user: actor } = useAuth();
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [access, setAccess] = useState<ApiUserPermissions | null>(null);
  const [selected, setSelected] = useState<string>(user.customRole?._id ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRoles(), getUserPermissions(user._id)])
      .then(([rolesRes, accessRes]) => {
        if (cancelled) return;
        setRoles(rolesRes.data.roles.filter((role) => !role.isSystem && role.isActive));
        setAccess(accessRes.data);
        setSelected(accessRes.data.customRole?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this user's access.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user._id]);

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      await assignRoleToUser(user._id, selected || null);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update this user's role.");
    } finally {
      setIsSaving(false);
    }
  }

  const isSuperAdmin = user.role === "super_admin";
  const changed = (access?.customRole?.id ?? "") !== selected;

  return (
    <Modal title={`Access — ${user.name}`} onClose={onClose}>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-brown-500">Loading access...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
              Built-in Role
            </span>
            <p className="text-sm capitalize text-green-950">{user.role.replace("_", " ")}</p>
            <p className="mt-1 text-xs text-brown-500">
              Changed from the Edit form. A custom role below adds to this, never replaces it.
            </p>
          </div>

          {isSuperAdmin ? (
            <p className="rounded-lg border border-brown-600/15 bg-gold-soft px-4 py-3 text-sm text-gold-700">
              A Super Admin already holds every permission, so a custom role would add nothing.
            </p>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
                Custom Role
              </label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 focus:border-green-900/40 focus:outline-none"
              >
                <option value="">None</option>
                {roles.map((role) => (
                  <option key={role._id} value={role._id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {roles.length === 0 && (
                <p className="mt-1 text-xs text-brown-500">
                  No custom roles exist yet — create one under Roles &amp; Permissions.
                </p>
              )}
            </div>
          )}

          <div>
            <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
              <ShieldCheck size={13} /> Current permissions ({access?.permissions.length ?? 0})
            </span>
            {access && access.permissions.length > 0 ? (
              <ul className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-brown-600/15 bg-surface p-3">
                {access.permissions.map((permission) => (
                  <li
                    key={permission}
                    className="rounded-full bg-success-soft px-2.5 py-1 font-mono text-[11px] text-green-900"
                  >
                    {permission}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-brown-600/15 px-4 py-3 text-sm text-brown-500">
                This account holds no permissions.
              </p>
            )}
            {changed && (
              <p className="mt-2 text-xs text-brown-500">
                This list refreshes once you save the role change.
              </p>
            )}
          </div>

          {actor?.role !== "super_admin" && (
            <p className="text-xs text-brown-500">
              You can only assign a role whose permissions you hold yourself.
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {!isSuperAdmin && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isSaving || !changed}
                onClick={handleSave}
              >
                {isSaving ? "Saving..." : "Save Role"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
