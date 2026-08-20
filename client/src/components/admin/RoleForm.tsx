"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ApiPermissionGroup, ApiRole } from "@/types/api";

export interface RoleFormValues {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
}

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export function fromRole(role?: ApiRole): RoleFormValues {
  if (!role) {
    return { key: "", name: "", description: "", permissions: [], isActive: true };
  }
  return {
    key: role.key,
    name: role.name,
    description: role.description ?? "",
    permissions: [...role.permissions],
    isActive: role.isActive,
  };
}

/**
 * Create/edit form for a role.
 *
 * Two things are deliberately read-only rather than hidden when editing a
 * built-in role: its key and name are its identity (the key has to keep
 * matching `User.role`), and only its permission list can change. Editing a
 * built-in role at all is Super Admin only — the server rejects anyone else,
 * and the page doesn't offer the button.
 *
 * `grantablePermissions` is the actor's own permission list. Anything outside
 * it renders disabled, because the API refuses to let anyone grant a
 * permission they don't hold themselves; showing it greyed out explains the
 * boundary better than a 403 after submitting.
 */
export function RoleForm({
  initial,
  groups,
  sensitive,
  grantablePermissions,
  canGrantEverything,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiRole;
  groups: ApiPermissionGroup[];
  sensitive: string[];
  grantablePermissions: string[];
  /** Super Admin — every permission is grantable, nothing is disabled. */
  canGrantEverything: boolean;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: RoleFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<RoleFormValues>(() => fromRole(initial));
  const isSystem = initial?.isSystem ?? false;

  function toggle(permission: string) {
    setValues((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  }

  function toggleGroup(group: ApiPermissionGroup, on: boolean) {
    const keys = group.permissions
      .map((p) => p.key)
      .filter((key) => canGrantEverything || grantablePermissions.includes(key));
    setValues((prev) => ({
      ...prev,
      permissions: on
        ? [...new Set([...prev.permissions, ...keys])]
        : prev.permissions.filter((p) => !keys.includes(p)),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Role Key *</label>
          <input
            required
            readOnly={isSystem}
            value={values.key}
            onChange={(e) => setValues((prev) => ({ ...prev, key: e.target.value.toUpperCase() }))}
            placeholder="DIGITAL_MARKETER"
            className={`${fieldClasses} ${isSystem ? "cursor-not-allowed opacity-60" : ""}`}
          />
          <p className="mt-1 text-xs text-brown-500">
            {isSystem
              ? "Built-in roles cannot be renamed."
              : "Letters, numbers and underscores. Used as the stable identifier."}
          </p>
        </div>
        <div>
          <label className={labelClasses}>Display Name *</label>
          <input
            required
            readOnly={isSystem}
            value={values.name}
            onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Digital Marketer"
            className={`${fieldClasses} ${isSystem ? "cursor-not-allowed opacity-60" : ""}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Description</label>
          <textarea
            rows={2}
            readOnly={isSystem}
            value={values.description}
            onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Runs campaigns, coupons and marketing analytics."
            className={`${fieldClasses} ${isSystem ? "cursor-not-allowed opacity-60" : ""}`}
          />
        </div>
        {!isSystem && (
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-brown-600">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => setValues((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="accent-green-900"
              />
              Active
            </label>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className={labelClasses}>Permissions</span>
          <span className="text-xs text-brown-500">{values.permissions.length} selected</span>
        </div>

        <div className="flex max-h-[45vh] flex-col gap-4 overflow-y-auto rounded-lg border border-brown-600/15 bg-surface p-4">
          {groups.map((group) => {
            const keys = group.permissions.map((p) => p.key);
            const allOn = keys.every((key) => values.permissions.includes(key));
            return (
              <section key={group.group}>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-green-950">
                    {group.group}
                  </h4>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group, !allOn)}
                    className="cursor-pointer text-xs font-semibold text-brown-600 underline underline-offset-2 hover:text-green-950"
                  >
                    {allOn ? "Clear" : "Select all"}
                  </button>
                </div>
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {group.permissions.map((permission) => {
                    const grantable =
                      canGrantEverything || grantablePermissions.includes(permission.key);
                    const isSensitive = sensitive.includes(permission.key);
                    return (
                      <li key={permission.key}>
                        <label
                          title={
                            grantable
                              ? permission.key
                              : `${permission.key} — you cannot grant a permission you do not hold`
                          }
                          className={`flex items-start gap-2 text-sm ${
                            grantable
                              ? "cursor-pointer text-brown-600 hover:text-green-950"
                              : "cursor-not-allowed text-brown-500/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={!grantable}
                            checked={values.permissions.includes(permission.key)}
                            onChange={() => toggle(permission.key)}
                            className="mt-0.5 size-4 shrink-0 rounded-sm accent-green-900"
                          />
                          <span>
                            {permission.label}
                            {isSensitive && (
                              <AlertTriangle
                                size={12}
                                className="ml-1 inline-block align-[-1px] text-danger"
                                aria-label="Sensitive permission"
                              />
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-brown-500">
          <AlertTriangle size={12} className="text-danger" />
          Marked permissions grant authority over staff or the permission system itself.
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Role"}
        </Button>
      </div>
    </form>
  );
}
