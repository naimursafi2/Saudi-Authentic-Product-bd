import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Permission } from "@/lib/permissions";
import { AdminNav } from "./AdminNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

const permissionsRef: { current: Permission[] } = { current: [] };

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    permissions: permissionsRef.current,
    hasPermission: (...required: Permission[]) =>
      required.some((permission) => permissionsRef.current.includes(permission)),
  }),
}));

function renderNavFor(permissions: Permission[]): string[] {
  permissionsRef.current = permissions;
  const { unmount } = render(<AdminNav />);
  const labels = screen.getAllByRole("link").map((link) => link.textContent ?? "");
  unmount();
  return labels;
}

/**
 * The Admin Portal's nav is driven by permissions rather than hardcoded role
 * lists, so that a custom role gets a sensible menu with no code change.
 * These pin the two things that could silently regress: the built-in roles'
 * menus must look exactly as they did before the migration, and a custom
 * role's menu must follow its permissions.
 */
describe("AdminNav permission filtering", () => {
  // Transcribed from server/src/constants/permissions.ts.
  const ORDER_MANAGER: Permission[] = [
    "orders.view",
    "orders.manage",
    "inventory.view",
    "refunds.view",
    "refunds.request",
    "refunds.review",
    "auditLogs.view",
  ];

  it("shows an Order Manager only their four working areas, plus Dashboard and Profile", () => {
    expect(renderNavFor(ORDER_MANAGER)).toEqual([
      "Dashboard",
      "Orders",
      "Refunds",
      "Audit Logs",
      "Profile",
    ]);
  });

  it("hides payroll, finance and site-configuration items from a role without them", () => {
    const labels = renderNavFor([
      "products.view",
      "orders.view",
      "marketing.view",
      "reports.view",
      "roles.view",
    ]);
    for (const hidden of ["Salary & Payments", "Finance", "Investments", "Settings", "Approvals"]) {
      expect(labels).not.toContain(hidden);
    }
    expect(labels).toEqual(expect.arrayContaining(["Products", "Coupons", "Roles & Permissions"]));
  });

  it("gives a custom marketing role its own menu without any role name being involved", () => {
    // Exactly the DIGITAL_MARKETER example: no built-in role produces this
    // combination, so it can only come from the permission list.
    expect(renderNavFor(["marketing.view", "content.homepage.manage", "reports.view"])).toEqual([
      "Dashboard",
      "Coupons",
      "Reports",
      "Homepage",
      "Profile",
    ]);
  });

  it("falls back to just Dashboard and Profile when a role carries no admin permissions", () => {
    expect(renderNavFor([])).toEqual(["Dashboard", "Profile"]);
  });

  it("surfaces the Approvals queue only for approvals.manage", () => {
    expect(renderNavFor(["approvals.manage"])).toContain("Approvals");
    expect(renderNavFor(["orders.view"])).not.toContain("Approvals");
  });
});
