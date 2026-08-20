"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { grantsAdminPortalAccess, type Permission } from "@/lib/permissions";
import type { Role } from "@/types/api";

/**
 * Blocks rendering until the current user is confirmed to belong here.
 *
 * Entry is granted by built-in role (`allowed`) **or** by permission: a user
 * whose custom role carries any admin-panel permission gets in even though
 * their built-in role is only `employee`. That is what lets a DIGITAL_MARKETER
 * exist without editing `ADMIN_PORTAL_ROLES` in code.
 *
 * This is UX only — it prevents a flash of a portal the user can't use. The
 * API enforces the real boundary with `requirePermission(...)` on every route,
 * so nothing here is load-bearing for security.
 */
export function RoleGuard({
  allowed,
  requireAnyPermission,
  children,
}: {
  allowed: Role[];
  /** When set, holding any one of these also grants entry. Defaults to
   * "any admin-panel permission" for the `/admin` shell. */
  requireAnyPermission?: Permission[];
  children: React.ReactNode;
}) {
  const { user, status, permissions } = useAuth();
  const router = useRouter();

  const byRole = Boolean(user && allowed.includes(user.role));
  const byPermission = requireAnyPermission
    ? requireAnyPermission.some((permission) => permissions.includes(permission))
    : false;
  const isAllowed = byRole || byPermission;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/account");
    else if (status === "authenticated" && user && !isAllowed) router.replace("/account");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user, isAllowed]);

  if (status === "loading" || status === "unauthenticated" || !user || !isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="size-8 animate-pulse rounded-full bg-green-900/20" />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Page-level permission gate used *inside* a portal the user is already
 * allowed into — renders `fallback` (typically an "Access restricted" empty
 * state) instead of the page body. Mirrors the page-level `isRestricted`
 * checks that `/admin/salary`, `/admin/finance` and friends already use, but
 * keyed off a permission rather than a hardcoded role name.
 */
export function usePermissionGate(...required: Permission[]): boolean {
  const { permissions, status } = useAuth();
  if (status !== "authenticated") return false;
  return required.some((permission) => permissions.includes(permission));
}

export { grantsAdminPortalAccess };
