import type { NextFunction, Request, Response } from "express";
import {
  authorize,
  authorizeSelfOrRoles,
  requirePermission,
  requireAllPermissions,
} from "../middlewares/rbac.middleware";
import { ApiError } from "../utils/ApiError";
import { ROLE_DEFAULT_PERMISSIONS, type Permission } from "../constants/permissions";

/** `permissions` became required on `req.user` when routes moved to
 * permission gating; these role-only tests don't exercise it, so it defaults
 * to empty and each permission test passes its own list explicitly. */
function mockReq(user?: Omit<NonNullable<Request["user"]>, "permissions"> & { permissions?: Permission[] }): Request {
  return { user: user ? { permissions: [], ...user } : undefined } as unknown as Request;
}

const res = {} as Response;

describe("authorize middleware", () => {
  it("calls next() with no error when the user has an allowed role", () => {
    const req = mockReq({ id: "u1", role: "admin", tokenVersion: 0, isEmailVerified: true });
    const next = jest.fn();
    authorize("admin", "super_admin")(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next() with a 403 ApiError when the role is not allowed", () => {
    const req = mockReq({ id: "u1", role: "customer", tokenVersion: 0, isEmailVerified: true });
    const next = jest.fn();
    authorize("admin", "super_admin")(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
  });

  it("calls next() with a 401 ApiError when there is no authenticated user", () => {
    const req = mockReq(undefined);
    const next = jest.fn();
    authorize("admin")(req, res, next as NextFunction);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(401);
  });

  it("recognises the order_manager and delivery_agent roles", () => {
    const managerReq = mockReq({ id: "u1", role: "order_manager", tokenVersion: 0, isEmailVerified: true });
    const managerNext = jest.fn();
    authorize("order_manager", "co_admin")(managerReq, res, managerNext as NextFunction);
    expect(managerNext).toHaveBeenCalledWith();

    const agentReq = mockReq({ id: "u2", role: "delivery_agent", tokenVersion: 0, isEmailVerified: true });
    const agentNext = jest.fn();
    authorize("delivery_agent")(agentReq, res, agentNext as NextFunction);
    expect(agentNext).toHaveBeenCalledWith();

    // a delivery agent is never implicitly granted order_manager-only routes
    const deniedNext = jest.fn();
    authorize("order_manager", "co_admin")(agentReq, res, deniedNext as NextFunction);
    const err = deniedNext.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(403);
  });
});

describe("authorizeSelfOrRoles middleware", () => {
  const getOwnerId = (req: Request) => (req.params as { userId?: string }).userId;

  it("allows the request through when the user owns the resource", () => {
    const req = {
      user: { id: "u1", role: "customer", tokenVersion: 0 },
      params: { userId: "u1" },
    } as unknown as Request;
    const next = jest.fn();
    authorizeSelfOrRoles(getOwnerId, "admin")(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows the request through when the user has a staff role, even if not the owner", () => {
    const req = {
      user: { id: "staff1", role: "admin", tokenVersion: 0 },
      params: { userId: "someone-else" },
    } as unknown as Request;
    const next = jest.fn();
    authorizeSelfOrRoles(getOwnerId, "admin")(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks the request when the user neither owns the resource nor has a staff role", () => {
    const req = {
      user: { id: "u1", role: "customer", tokenVersion: 0 },
      params: { userId: "someone-else" },
    } as unknown as Request;
    const next = jest.fn();
    authorizeSelfOrRoles(getOwnerId, "admin")(req, res, next as NextFunction);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(403);
  });
});


describe("requirePermission middleware", () => {
  const res2 = {} as Response;

  it("allows a caller holding the required permission", () => {
    const req = mockReq({
      id: "u1",
      role: "co_admin",
      permissions: ["products.edit"],
      tokenVersion: 0,
      isEmailVerified: true,
    });
    const next = jest.fn();
    requirePermission("products.edit")(req, res2, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows a caller holding ANY ONE of several accepted permissions", () => {
    const req = mockReq({
      id: "u1",
      role: "employee",
      permissions: ["employees.view"],
      tokenVersion: 0,
      isEmailVerified: true,
    });
    const next = jest.fn();
    requirePermission("roles.view", "employees.view")(req, res2, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it("403s a caller who holds other permissions but not the required one", () => {
    const req = mockReq({
      id: "u1",
      role: "co_admin",
      permissions: ["products.edit", "orders.view"],
      tokenVersion: 0,
      isEmailVerified: true,
    });
    const next = jest.fn();
    requirePermission("salary.manage")(req, res2, next as NextFunction);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(403);
  });

  it("401s when there is no authenticated user", () => {
    const next = jest.fn();
    requirePermission("products.edit")(mockReq(undefined), res2, next as NextFunction);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(401);
  });

  it("requireAllPermissions demands every listed permission", () => {
    const req = mockReq({
      id: "u1",
      role: "co_admin",
      permissions: ["products.edit"],
      tokenVersion: 0,
      isEmailVerified: true,
    });
    const denied = jest.fn();
    requireAllPermissions("products.edit", "products.delete")(req, res2, denied as NextFunction);
    expect((denied.mock.calls[0][0] as ApiError).statusCode).toBe(403);

    const allowed = jest.fn();
    requireAllPermissions("products.edit")(req, res2, allowed as NextFunction);
    expect(allowed).toHaveBeenCalledWith();
  });
});

/**
 * The default permission sets are a transcription of the role matrix the
 * routes used to hardcode. These pin the handful of asymmetries that are easy
 * to "tidy up" by mistake later.
 */
describe("built-in role permission defaults", () => {
  it("gives Co-Admin product deletion but not Admin", () => {
    expect(ROLE_DEFAULT_PERMISSIONS.co_admin).toContain("products.delete");
    expect(ROLE_DEFAULT_PERMISSIONS.admin).not.toContain("products.delete");
  });

  it("keeps salary and finance away from Co-Admin", () => {
    for (const permission of ["salary.view", "salary.manage", "finance.view"] as const) {
      expect(ROLE_DEFAULT_PERMISSIONS.co_admin).not.toContain(permission);
      expect(ROLE_DEFAULT_PERMISSIONS.admin).toContain(permission);
    }
  });

  it("scopes Order Manager to orders and refund review, with no catalog or staff access", () => {
    expect(ROLE_DEFAULT_PERMISSIONS.order_manager).toEqual(
      expect.arrayContaining(["orders.view", "orders.manage", "refunds.review"])
    );
    for (const permission of ["products.edit", "employees.view", "refunds.approve"] as const) {
      expect(ROLE_DEFAULT_PERMISSIONS.order_manager).not.toContain(permission);
    }
  });

  it("limits a delivery agent to its own delivery actions", () => {
    expect(ROLE_DEFAULT_PERMISSIONS.delivery_agent).toContain("orders.deliver");
    expect(ROLE_DEFAULT_PERMISSIONS.delivery_agent).not.toContain("orders.view");
  });

  it("never grants approvals.manage to anyone but Super Admin", () => {
    for (const permissions of Object.values(ROLE_DEFAULT_PERMISSIONS)) {
      expect(permissions).not.toContain("approvals.manage");
    }
  });
});
